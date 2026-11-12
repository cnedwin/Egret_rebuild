// SPDX-License-Identifier: Apache-2.0
// A soft, springy look for rigid things. The body that collides stays rigid;
// what is drawn squashes along the direction of each knock, stretches back,
// and lets its top trail behind sudden moves before settling. The motion is a
// pair of damped springs on the CPU and a vertex hook that reshapes the mesh,
// so a jelly costs a few numbers per object and no extra simulation.
// DOM-free and backend-independent.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import {createCustomShader3D, type CustomShader3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import type {Object3D} from './Object3D.js';
import type {RigidBody3D} from './Physics3D.js';

export interface JellyOptions3D {
    /** How many times per second the shape swings back and forth after a knock. Defaults to 3.5. */
    readonly stiffness?: number;
    /** 0 swings forever, 1 settles without overshoot. Defaults to 0.22. */
    readonly damping?: number;
    /** Most the shape may flatten or lengthen, as a share of its size. Defaults to 0.4. */
    readonly squash?: number;
    /** How strongly a change of speed deforms the shape: flattening per metre per second. Defaults to 0.05. */
    readonly sensitivity?: number;
    /** How far the top trails behind a sudden move, in seconds of the speed change. Defaults to 0.035; 0 turns it off. */
    readonly wobble?: number;
    /** Height of the object in world units, measured along `up` from its base. Defaults to twice the bounding radius. */
    readonly height?: number;
    /** Offset from the target's origin to the point the shape is squashed about, as a share of the height below the origin. Defaults to 0.5: the base. */
    readonly base?: number;
    /** Direction that counts as up. Defaults to +Y. */
    readonly up?: readonly [number, number, number];
    /** A slow breathing motion while idle: its size as a share of the height. Defaults to 0. */
    readonly idle?: number;
    /** Breaths per second of the idle motion. Defaults to 0.8. */
    readonly idleRate?: number;
    /** Body whose speed drives the jelly. Without one, the speed is taken from how the target moves. */
    readonly body?: RigidBody3D;
}

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
export function createJellyShader3D(): CustomShader3D {
    return createCustomShader3D({key: 'world3d-jelly', glslVertex: GLSL_VERTEX, wgslVertex: WGSL_VERTEX, uniforms: [0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0]});
}

/**
 * Makes everything drawn under `target` behave like jelly. Each mesh gets its
 * own copy of its material carrying the jelly's vertex hook, so other objects
 * that shared the material are not affected; a material that already has a
 * shader hook is left as it is. Call update() once per frame.
 */
export class Jelly3D {
    readonly target: Object3D;
    readonly shader: CustomShader3D;
    stiffness: number;
    damping: number;
    squash: number;
    sensitivity: number;
    wobble: number;
    height: number;
    base: number;
    idle: number;
    idleRate: number;
    body: RigidBody3D | undefined;
    /** Meshes whose material now carries the hook. */
    readonly meshes: Mesh3D[] = [];
    readonly #up = new Float64Array([0, 1, 0]);
    // The squash is a vector: its direction is the line of the knock, its length how flat the shape is along it.
    readonly #strain = new Float64Array(3);
    readonly #strainSpeed = new Float64Array(3);
    readonly #axis = new Float64Array([0, 1, 0]);
    readonly #lag = new Float64Array(3);
    readonly #lagSpeed = new Float64Array(3);
    readonly #velocity = new Float64Array(3);
    readonly #place = new Float64Array(3);
    #seen = false;
    #clock = 0;

    constructor(target: Object3D, options: JellyOptions3D = {}) {
        if (!target || typeof target.traverse !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'jelly target');
        this.target = target;
        this.stiffness = requirePositive3D(options.stiffness ?? 3.5, 'stiffness');
        this.damping = requireFinite3D(options.damping ?? 0.22, 'damping');
        this.squash = requireFinite3D(options.squash ?? 0.4, 'squash');
        this.sensitivity = requireFinite3D(options.sensitivity ?? 0.05, 'sensitivity');
        this.wobble = requireFinite3D(options.wobble ?? 0.035, 'wobble');
        this.base = requireFinite3D(options.base ?? 0.5, 'base');
        this.idle = requireFinite3D(options.idle ?? 0, 'idle');
        this.idleRate = requireFinite3D(options.idleRate ?? 0.8, 'idleRate');
        if (this.damping < 0 || this.squash < 0 || this.squash > 0.9 || this.wobble < 0 || this.idle < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'jelly options');
        this.body = options.body;
        if (options.up) {
            const size = Math.hypot(options.up[0], options.up[1], options.up[2]);
            if (!(size > 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'up');
            this.#up[0] = options.up[0] / size; this.#up[1] = options.up[1] / size; this.#up[2] = options.up[2] / size;
        }
        this.shader = createJellyShader3D();
        let radius = 0;
        target.updateWorldMatrix();
        const origin = target.matrixWorld;
        target.traverse((object) => {
            if (!(object instanceof Mesh3D)) return;
            const own = (material: Mesh3D['material']): Mesh3D['material'] => {
                if (Array.isArray(material)) return material.map(one => own(one)) as Mesh3D['material'];
                if (material.shader) return material;
                const copy = material.clone();
                copy.shader = this.shader; copy.touch();
                return copy;
            };
            object.material = own(object.material);
            this.meshes.push(object);
            object.updateWorldMatrix();
            const sphere = object.worldBoundingSphere;
            if (sphere[3]! >= 0) radius = Math.max(radius, Math.hypot(sphere[0]! - origin[12]!, sphere[1]! - origin[13]!, sphere[2]! - origin[14]!) + sphere[3]!);
        });
        this.height = requirePositive3D(options.height ?? (radius > 0 ? radius * 2 : 1), 'height');
        this.write();
    }
    /** How flat the shape is along its squash line right now: positive when pressed, negative when stretched. */
    get amount(): number { return this.#strain[0]! * this.#axis[0]! + this.#strain[1]! * this.#axis[1]! + this.#strain[2]! * this.#axis[2]!; }
    /** The line the shape is squashed along, as a unit direction. */
    get axis(): ArrayLike<number> { return this.#axis; }
    /** How far the top currently trails, in world units. */
    get lag(): ArrayLike<number> { return this.#lag; }
    /**
     * Knock the jelly: `direction` is the way the blow travels, `strength` the
     * change of speed it stands for in metres per second.
     */
    impact(direction: ArrayLike<number>, strength: number): void {
        const size = Math.hypot(direction[0]!, direction[1]!, direction[2]!), speed = requireFinite3D(strength, 'strength');
        if (!(size > 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'direction');
        this.kick(direction[0]! / size * speed, direction[1]! / size * speed, direction[2]! / size * speed);
    }
    private kick(dx: number, dy: number, dz: number): void {
        const omega = 2 * Math.PI * this.stiffness, press = this.sensitivity * omega, s = this.#strainSpeed, l = this.#lagSpeed;
        s[0]! += dx * press; s[1]! += dy * press; s[2]! += dz * press;
        // The top is left behind by the change of speed, then catches up.
        const trail = this.wobble * omega;
        l[0]! -= dx * trail; l[1]! -= dy * trail; l[2]! -= dz * trail;
    }
    /** Advance the springs and hand the new shape to the shader. */
    update(deltaSeconds: number): void {
        const dt = Math.min(Math.max(requireFinite3D(deltaSeconds, 'deltaSeconds'), 0), 0.1), body = this.body, target = this.target, place = this.#place, velocity = this.#velocity;
        target.updateWorldMatrix();
        const world = target.matrixWorld, x = world[12]!, y = world[13]!, z = world[14]!;
        if (dt > 0) {
            let vx: number, vy: number, vz: number;
            if (body) { vx = body.linearVelocity[0]!; vy = body.linearVelocity[1]!; vz = body.linearVelocity[2]!; }
            else if (this.#seen) { vx = (x - place[0]!) / dt; vy = (y - place[1]!) / dt; vz = (z - place[2]!) / dt; }
            else { vx = vy = vz = 0; }
            if (this.#seen) {
                const dx = vx - velocity[0]!, dy = vy - velocity[1]!, dz = vz - velocity[2]!;
                // Free fall and steady motion change speed gently; only a real jolt is felt.
                if (dx * dx + dy * dy + dz * dz > 0.25) this.kick(dx, dy, dz);
            }
            velocity[0] = vx; velocity[1] = vy; velocity[2] = vz;
            this.#seen = true;
            // Small fixed slices keep the springs stable whatever the frame time.
            const omega = 2 * Math.PI * this.stiffness, steps = Math.max(1, Math.ceil(dt * omega / 0.35)), h = dt / steps, drag = 2 * this.damping * omega;
            for (let step = 0; step < steps; step++) {
                for (const [value, speed] of [[this.#strain, this.#strainSpeed], [this.#lag, this.#lagSpeed]] as const) {
                    for (let i = 0; i < 3; i++) {
                        speed[i] = (speed[i]! - omega * omega * value[i]! * h) / (1 + drag * h);
                        value[i] = value[i]! + speed[i]! * h;
                    }
                }
            }
            this.#clock += dt;
        }
        place[0] = x; place[1] = y; place[2] = z;
        this.write();
    }
    /** Bring the shape back to rest at once. */
    reset(): void {
        this.#strain.fill(0); this.#strainSpeed.fill(0); this.#lag.fill(0); this.#lagSpeed.fill(0); this.#seen = false;
        this.write();
    }
    private write(): void {
        const u = this.shader.uniforms, strain = this.#strain, axis = this.#axis, up = this.#up, lag = this.#lag, most = this.squash;
        const size = Math.hypot(strain[0]!, strain[1]!, strain[2]!);
        if (size > 1e-6) {
            // Keep the line's direction from flipping as the shape swings through rest, so pressing turns into stretching.
            const facing = strain[0]! * axis[0]! + strain[1]! * axis[1]! + strain[2]! * axis[2]! < 0 ? -1 : 1;
            axis[0] = strain[0]! / size * facing; axis[1] = strain[1]! / size * facing; axis[2] = strain[2]! / size * facing;
        }
        let amount = this.amount;
        amount = amount > most ? most : amount < -most ? -most : amount;
        let along = 1 - amount;
        const world = this.target.matrixWorld, drop = this.height * this.base;
        // Breathing presses and releases along up, on top of whatever the springs are doing.
        const breath = this.idle > 0 ? this.idle * Math.sin(this.#clock * this.idleRate * 2 * Math.PI) * Math.abs(axis[0]! * up[0]! + axis[1]! * up[1]! + axis[2]! * up[2]!) : 0;
        along -= breath;
        // Whatever is lost along the line is gained across it, so the volume stays about the same.
        const across = 1 / Math.sqrt(along);
        const reach = this.height * 0.5, far = Math.hypot(lag[0]!, lag[1]!, lag[2]!), fit = far > reach ? reach / far : 1;
        u[0] = axis[0]!; u[1] = axis[1]!; u[2] = axis[2]!; u[3] = along;
        u[4] = lag[0]! * fit; u[5] = lag[1]! * fit; u[6] = lag[2]! * fit; u[7] = 1 / this.height;
        u[8] = world[12]! - up[0]! * drop; u[9] = world[13]! - up[1]! * drop; u[10] = world[14]! - up[2]! * drop; u[11] = across;
        u[12] = up[0]!; u[13] = up[1]!; u[14] = up[2]!; u[15] = 0;
    }
    /** Where the shader puts a world-space point, for tests and for attaching things to the surface. */
    deform(out: Float32Array | Float64Array | number[], x: number, y: number, z: number): typeof out {
        const u = this.shader.uniforms, dx = x - u[8]!, dy = y - u[9]!, dz = z - u[10]!, along = dx * u[0]! + dy * u[1]! + dz * u[2]!;
        let rise = (dx * u[12]! + dy * u[13]! + dz * u[14]!) * u[7]!;
        rise = rise < 0 ? 0 : rise > 1 ? 1 : rise;
        const lift = rise * rise, keep = u[11]!, stretch = along * u[3]!;
        out[0] = u[8]! + (dx - u[0]! * along) * keep + u[0]! * stretch + u[4]! * lift;
        out[1] = u[9]! + (dy - u[1]! * along) * keep + u[1]! * stretch + u[5]! * lift;
        out[2] = u[10]! + (dz - u[2]! * along) * keep + u[2]! * stretch + u[6]! * lift;
        return out;
    }
}

export function createJelly3D(target: Object3D, options: JellyOptions3D = {}): Jelly3D { return new Jelly3D(target, options); }
