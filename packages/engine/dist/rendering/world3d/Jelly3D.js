// SPDX-License-Identifier: Apache-2.0
// A soft, springy look for rigid things. The body that collides stays rigid;
// what is drawn squashes along the direction of each knock, stretches back,
// and lets its top trail behind sudden moves before settling. The motion is a
// pair of damped springs on the CPU and a vertex hook that reshapes the mesh,
// so a jelly costs a few numbers per object and no extra simulation.
// DOM-free and backend-independent.
import { World3DError, requireFinite3D, requirePositive3D } from './core3D.js';
import { createCustomShader3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
const GLSL_VERTEX = `
vec3 customVertex(vec3 worldPosition, vec3 localPosition, vec3 normal, vec2 uv, vec4 color) {
    vec3 d = worldPosition - uCustom[2].xyz;
    float along = dot(d, uCustom[0].xyz);
    vec3 across = d - uCustom[0].xyz * along;
    float rise = clamp(dot(d, uCustom[3].xyz) * uCustom[1].w, 0.0, 1.0);
    return uCustom[2].xyz + across * uCustom[2].w + uCustom[0].xyz * (along * uCustom[0].w) + uCustom[1].xyz * (rise * rise);
}`;
const WGSL_VERTEX = `
fn customVertex(worldPosition: vec3f, localPosition: vec3f, normal: vec3f, uv: vec2f, color: vec4f) -> vec3f {
    let d = worldPosition - material.custom[2].xyz;
    let along = dot(d, material.custom[0].xyz);
    let across = d - material.custom[0].xyz * along;
    let rise = clamp(dot(d, material.custom[3].xyz) * material.custom[1].w, 0.0, 1.0);
    return material.custom[2].xyz + across * material.custom[2].w + material.custom[0].xyz * (along * material.custom[0].w) + material.custom[1].xyz * (rise * rise);
}`;
/** The vertex hook a jelly drives. Its parameters start as "no change". */
export function createJellyShader3D() {
    return createCustomShader3D({
        key: 'world3d-jelly',
        glslVertex: GLSL_VERTEX,
        wgslVertex: WGSL_VERTEX,
        uniforms: [0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0]
    });
}
/**
 * Makes everything drawn under `target` behave like jelly. Each mesh gets its
 * own copy of its material carrying the jelly's vertex hook, so other objects
 * that shared the material are not affected; a material that already has a
 * shader hook is left as it is. Call update() once per frame.
 */
export class Jelly3D {
    target;
    shader;
    stiffness;
    damping;
    squash;
    sensitivity;
    wobble;
    height;
    base;
    idle;
    idleRate;
    body;
    /** Meshes whose material now carries the hook. */
    meshes = [];
    #up = new Float64Array([0, 1, 0]);
    // The squash is a vector: its direction is the line of the knock, its length how flat the shape is along it.
    #strain = new Float64Array(3);
    #strainSpeed = new Float64Array(3);
    #axis = new Float64Array([0, 1, 0]);
    #lag = new Float64Array(3);
    #lagSpeed = new Float64Array(3);
    #velocity = new Float64Array(3);
    #place = new Float64Array(3);
    #seen = false;
    #clock = 0;
    constructor(target, options = {}) {
        if (!target || typeof target.traverse !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'jelly target');
        this.target = target;
        this.stiffness = requirePositive3D(options.stiffness ?? 3.5, 'stiffness');
        this.damping = requireFinite3D(options.damping ?? 0.22, 'damping');
        this.squash = requireFinite3D(options.squash ?? 0.4, 'squash');
        this.sensitivity = requireFinite3D(options.sensitivity ?? 0.05, 'sensitivity');
        this.wobble = requireFinite3D(options.wobble ?? 0.035, 'wobble');
        this.base = requireFinite3D(options.base ?? 0.5, 'base');
        this.idle = requireFinite3D(options.idle ?? 0, 'idle');
        this.idleRate = requireFinite3D(options.idleRate ?? 0.8, 'idleRate');
        if (this.damping < 0 || this.squash < 0 || this.squash > 0.9 || this.wobble < 0 || this.idle < 0)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'jelly options');
        this.body = options.body;
        if (options.up) {
            const size = Math.hypot(options.up[0], options.up[1], options.up[2]);
            if (!(size > 0))
                throw new World3DError('WORLD3D_INPUT_INVALID', 'up');
            this.#up[0] = options.up[0] / size;
            this.#up[1] = options.up[1] / size;
            this.#up[2] = options.up[2] / size;
        }
        this.shader = createJellyShader3D();
        let radius = 0;
        target.updateWorldMatrix();
        const origin = target.matrixWorld;
        target.traverse(object => {
            if (!(object instanceof Mesh3D))
                return;
            const own = (material) => {
                if (Array.isArray(material))
                    return material.map(one => own(one));
                if (material.shader)
                    return material;
                const copy = material.clone();
                copy.shader = this.shader;
                copy.touch();
                return copy;
            };
            object.material = own(object.material);
            this.meshes.push(object);
            object.updateWorldMatrix();
            const sphere = object.worldBoundingSphere;
            if (sphere[3] >= 0)
                radius = Math.max(radius, Math.hypot(sphere[0] - origin[12], sphere[1] - origin[13], sphere[2] - origin[14]) + sphere[3]);
        });
        this.height = requirePositive3D(options.height ?? (radius > 0 ? radius * 2 : 1), 'height');
        this.write();
    }
    /** How flat the shape is along its squash line right now: positive when pressed, negative when stretched. */
    get amount() {
        return this.#strain[0] * this.#axis[0] + this.#strain[1] * this.#axis[1] + this.#strain[2] * this.#axis[2];
    }
    /** The line the shape is squashed along, as a unit direction. */
    get axis() {
        return this.#axis;
    }
    /** How far the top currently trails, in world units. */
    get lag() {
        return this.#lag;
    }
    /**
     * Knock the jelly: `direction` is the way the blow travels, `strength` the
     * change of speed it stands for in metres per second.
     */
    impact(direction, strength) {
        const size = Math.hypot(direction[0], direction[1], direction[2]), speed = requireFinite3D(strength, 'strength');
        if (!(size > 0))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'direction');
        this.kick((direction[0] / size) * speed, (direction[1] / size) * speed, (direction[2] / size) * speed);
    }
    kick(dx, dy, dz) {
        const omega = 2 * Math.PI * this.stiffness, press = this.sensitivity * omega, s = this.#strainSpeed, l = this.#lagSpeed;
        s[0] += dx * press;
        s[1] += dy * press;
        s[2] += dz * press;
        // The top is left behind by the change of speed, then catches up.
        const trail = this.wobble * omega;
        l[0] -= dx * trail;
        l[1] -= dy * trail;
        l[2] -= dz * trail;
    }
    /** Advance the springs and hand the new shape to the shader. */
    update(deltaSeconds) {
        const dt = Math.min(Math.max(requireFinite3D(deltaSeconds, 'deltaSeconds'), 0), 0.1), body = this.body, target = this.target, place = this.#place, velocity = this.#velocity;
        target.updateWorldMatrix();
        const world = target.matrixWorld, x = world[12], y = world[13], z = world[14];
        if (dt > 0) {
            let vx, vy, vz;
            if (body) {
                vx = body.linearVelocity[0];
                vy = body.linearVelocity[1];
                vz = body.linearVelocity[2];
            }
            else if (this.#seen) {
                vx = (x - place[0]) / dt;
                vy = (y - place[1]) / dt;
                vz = (z - place[2]) / dt;
            }
            else {
                vx = vy = vz = 0;
            }
            if (this.#seen) {
                const dx = vx - velocity[0], dy = vy - velocity[1], dz = vz - velocity[2];
                // Free fall and steady motion change speed gently; only a real jolt is felt.
                if (dx * dx + dy * dy + dz * dz > 0.25)
                    this.kick(dx, dy, dz);
            }
            velocity[0] = vx;
            velocity[1] = vy;
            velocity[2] = vz;
            this.#seen = true;
            // Small fixed slices keep the springs stable whatever the frame time.
            const omega = 2 * Math.PI * this.stiffness, steps = Math.max(1, Math.ceil((dt * omega) / 0.35)), h = dt / steps, drag = 2 * this.damping * omega;
            for (let step = 0; step < steps; step++) {
                for (const [value, speed] of [
                    [this.#strain, this.#strainSpeed],
                    [this.#lag, this.#lagSpeed]
                ]) {
                    for (let i = 0; i < 3; i++) {
                        speed[i] = (speed[i] - omega * omega * value[i] * h) / (1 + drag * h);
                        value[i] = value[i] + speed[i] * h;
                    }
                }
            }
            this.#clock += dt;
        }
        place[0] = x;
        place[1] = y;
        place[2] = z;
        this.write();
    }
    /** Bring the shape back to rest at once. */
    reset() {
        this.#strain.fill(0);
        this.#strainSpeed.fill(0);
        this.#lag.fill(0);
        this.#lagSpeed.fill(0);
        this.#seen = false;
        this.write();
    }
    write() {
        const u = this.shader.uniforms, strain = this.#strain, axis = this.#axis, up = this.#up, lag = this.#lag, most = this.squash;
        const size = Math.hypot(strain[0], strain[1], strain[2]);
        if (size > 1e-6) {
            // Keep the line's direction from flipping as the shape swings through rest, so pressing turns into stretching.
            const facing = strain[0] * axis[0] + strain[1] * axis[1] + strain[2] * axis[2] < 0 ? -1 : 1;
            axis[0] = (strain[0] / size) * facing;
            axis[1] = (strain[1] / size) * facing;
            axis[2] = (strain[2] / size) * facing;
        }
        let amount = this.amount;
        amount = amount > most ? most : amount < -most ? -most : amount;
        let along = 1 - amount;
        const world = this.target.matrixWorld, drop = this.height * this.base;
        // Breathing presses and releases along up, on top of whatever the springs are doing.
        const breath = this.idle > 0
            ? this.idle *
                Math.sin(this.#clock * this.idleRate * 2 * Math.PI) *
                Math.abs(axis[0] * up[0] + axis[1] * up[1] + axis[2] * up[2])
            : 0;
        along -= breath;
        // Whatever is lost along the line is gained across it, so the volume stays about the same.
        const across = 1 / Math.sqrt(along);
        const reach = this.height * 0.5, far = Math.hypot(lag[0], lag[1], lag[2]), fit = far > reach ? reach / far : 1;
        u[0] = axis[0];
        u[1] = axis[1];
        u[2] = axis[2];
        u[3] = along;
        u[4] = lag[0] * fit;
        u[5] = lag[1] * fit;
        u[6] = lag[2] * fit;
        u[7] = 1 / this.height;
        u[8] = world[12] - up[0] * drop;
        u[9] = world[13] - up[1] * drop;
        u[10] = world[14] - up[2] * drop;
        u[11] = across;
        u[12] = up[0];
        u[13] = up[1];
        u[14] = up[2];
        u[15] = 0;
    }
    /** Where the shader puts a world-space point, for tests and for attaching things to the surface. */
    deform(out, x, y, z) {
        const u = this.shader.uniforms, dx = x - u[8], dy = y - u[9], dz = z - u[10], along = dx * u[0] + dy * u[1] + dz * u[2];
        let rise = (dx * u[12] + dy * u[13] + dz * u[14]) * u[7];
        rise = rise < 0 ? 0 : rise > 1 ? 1 : rise;
        const lift = rise * rise, keep = u[11], stretch = along * u[3];
        out[0] = u[8] + (dx - u[0] * along) * keep + u[0] * stretch + u[4] * lift;
        out[1] = u[9] + (dy - u[1] * along) * keep + u[1] * stretch + u[5] * lift;
        out[2] = u[10] + (dz - u[2] * along) * keep + u[2] * stretch + u[6] * lift;
        return out;
    }
}
export function createJelly3D(target, options = {}) {
    return new Jelly3D(target, options);
}
//# sourceMappingURL=Jelly3D.js.map