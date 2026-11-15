import { World3DError, requireFinite3D } from './core3D.js';
import { CharacterController3D } from './Physics3D.js';
/**
 * A walking, jumping character. Each frame, after `world.step()`, call
 * `update(deltaSeconds, wishX, wishZ, jump)` with the horizontal velocity the
 * player asks for. The motor owns the capsule in `controller`.
 */
export class CharacterMotor3D {
    controller;
    world;
    /** Current velocity relative to whatever the character stands on. */
    velocity = new Float64Array(3);
    jumpSpeed;
    gravity;
    stepHeight;
    acceleration;
    airControl;
    coyoteTime;
    pushForce;
    maxFallSpeed;
    /** Turn, in radians about +Y, that the ground gave the character during the last update. Add it to the character's facing. */
    carriedYaw = 0;
    /** True on the update in which a jump started. */
    jumped = false;
    #airTime = Infinity;
    #wasGrounded = false;
    #platform;
    #pushScale = 0;
    #supported = false;
    #ground;
    #carry = new Float64Array(3);
    constructor(world, options = {}) {
        this.world = world;
        this.controller = new CharacterController3D(world, options);
        this.jumpSpeed = options.jumpSpeed ?? 5;
        this.gravity = options.gravity ?? Math.hypot(world.gravity[0], world.gravity[1], world.gravity[2]);
        this.stepHeight = options.stepHeight ?? 0.3;
        this.acceleration = options.acceleration ?? 60;
        this.airControl = options.airControl ?? 0.3;
        this.coyoteTime = options.coyoteTime ?? 0.1;
        this.pushForce = options.pushForce ?? 40;
        this.maxFallSpeed = options.maxFallSpeed ?? 50;
        // Walking into something loose shoves it, in proportion to the time spent pushing.
        this.controller.onContact = (body, nx, ny, nz) => {
            if (ny < -0.2)
                this.#supported = true;
            if (this.#pushScale <= 0 || body.type !== 'dynamic' || Math.abs(ny) > 0.5)
                return;
            // Push no harder than needed to move the body at the character's own pace.
            const size = Math.sqrt(nx * nx + nz * nz) || 1, x = nx / size, z = nz / size, v = this.velocity, carry = this.#carry;
            const closing = (v[0] + carry[0] - body.linearVelocity[0]) * x + (v[2] + carry[2] - body.linearVelocity[2]) * z;
            const impulse = Math.min(this.pushForce * this.#pushScale, closing * body.mass);
            if (impulse > 0)
                body.applyImpulse(x * impulse, 0, z * impulse);
        };
        // Find the ground the character starts on.
        this.#wasGrounded = this.settle(0, 0, 0);
        this.#platform = this.#ground;
    }
    get position() {
        return this.controller.position;
    }
    /** True when the character stands on walkable ground, including the edge of a step. */
    get isGrounded() {
        return this.#wasGrounded;
    }
    get groundBody() {
        return this.#platform;
    }
    /**
     * Move the capsule and report whether it ends up standing. The capsule's
     * own test needs a walkable contact; perched on the lip of a step its round
     * foot touches at a slant, so there the surface straight below decides.
     */
    settle(dx, dy, dz) {
        const c = this.controller;
        this.#supported = false;
        c.move(dx, dy, dz);
        this.#ground = c.groundBody;
        if (c.isGrounded)
            return true;
        if (!this.#supported)
            return false;
        const hit = this.world.raycast(c.position, [0, -1, 0], c.height / 2 + this.stepHeight + 0.05, c.mask);
        if (!hit || hit.normal[1] < Math.cos(c.slopeLimit))
            return false;
        this.#ground = hit.body;
        return true;
    }
    /** Place the character somewhere else and forget its motion. Invalid coordinates leave the motor unchanged. */
    teleport(x, y, z) {
        this.controller.position.set([requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')]);
        this.velocity.fill(0);
        this.#airTime = Infinity;
        this.#wasGrounded = this.settle(0, 0, 0);
        this.#platform = this.#ground;
    }
    /**
     * Advance the character. `wishX` and `wishZ` are the horizontal velocity
     * the player asks for in world units per second; `jump` asks for a jump
     * this frame.
     */
    update(deltaSeconds, wishX, wishZ, jump = false) {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds'), c = this.controller, v = this.velocity, p = c.position;
        requireFinite3D(wishX + wishZ, 'wish velocity');
        this.carriedYaw = 0;
        this.jumped = false;
        if (!(dt > 0))
            return;
        // 1. Ride the ground: a moving or turning body under the feet carries the character along.
        const platform = this.#wasGrounded ? this.#platform : undefined, carry = this.#carry;
        carry.fill(0);
        this.#pushScale = 0;
        if (platform && platform.type !== 'static' && platform.world === this.world) {
            const w = platform.angularVelocity, rx = p[0] - platform.position[0], ry = p[1] - platform.position[1], rz = p[2] - platform.position[2];
            carry[0] = platform.linearVelocity[0] + w[1] * rz - w[2] * ry;
            carry[1] = platform.linearVelocity[1] + w[2] * rx - w[0] * rz;
            carry[2] = platform.linearVelocity[2] + w[0] * ry - w[1] * rx;
            this.carriedYaw = w[1] * dt;
            c.move(carry[0] * dt, carry[1] * dt, carry[2] * dt);
        }
        // 2. Vertical motion: stand, jump or fall.
        const grounded = this.#wasGrounded;
        this.#airTime = grounded ? 0 : this.#airTime + dt;
        if (grounded && v[1] < 0)
            v[1] = 0;
        if (jump && this.#airTime <= this.coyoteTime) {
            v[1] = this.jumpSpeed;
            this.#airTime = Infinity;
            this.jumped = true;
            // Leaving a moving platform keeps its speed, like stepping off a moving walkway.
            v[0] += carry[0];
            v[2] += carry[2];
            v[1] += Math.max(carry[1], 0);
        }
        else if (!grounded)
            v[1] = Math.max(v[1] - this.gravity * dt, -this.maxFallSpeed);
        // 3. Horizontal motion: head toward the wished velocity, quickly on the ground and weakly in the air.
        const rate = this.acceleration * (grounded && !this.jumped ? 1 : this.airControl) * dt, ax = wishX - v[0], az = wishZ - v[2], gap = Math.sqrt(ax * ax + az * az);
        if (gap <= rate || !(rate < Infinity)) {
            v[0] = wishX;
            v[2] = wishZ;
        }
        else {
            v[0] += (ax / gap) * rate;
            v[2] += (az / gap) * rate;
        }
        // 4. Move, climbing a step when a low ledge blocks the way.
        const dx = v[0] * dt, dz = v[2] * dt, dy = v[1] * dt, wanted = Math.sqrt(dx * dx + dz * dz);
        const startX = p[0], startY = p[1], startZ = p[2];
        this.#pushScale = dt;
        let standing = this.settle(dx, dy, dz), ground = this.#ground, ceiling = c.hitCeiling;
        this.#pushScale = 0;
        if (grounded && !this.jumped && this.stepHeight > 0 && wanted > 1e-6) {
            const made = ((p[0] - startX) * dx) / wanted + ((p[2] - startZ) * dz) / wanted;
            if (made < wanted * 0.75) {
                const plainX = p[0], plainY = p[1], plainZ = p[2];
                p[0] = startX;
                p[1] = startY;
                p[2] = startZ;
                c.move(0, this.stepHeight, 0);
                const lifted = p[1] - startY;
                c.move(dx, 0, dz);
                const landed = this.settle(0, -lifted - this.stepHeight, 0), stepped = ((p[0] - startX) * dx) / wanted + ((p[2] - startZ) * dz) / wanted;
                // Keep the climb only when it ends standing, got farther, and did not vault higher than a step.
                if (landed && stepped > made + 1e-4 && p[1] - startY <= this.stepHeight + c.skin * 4) {
                    standing = true;
                    ground = this.#ground;
                    ceiling = false;
                }
                else {
                    p[0] = plainX;
                    p[1] = plainY;
                    p[2] = plainZ;
                    c.move(0, 0, 0);
                }
            }
        }
        // 5. Stay on the ground when walking down steps and slopes instead of hopping off them.
        if (grounded && !this.jumped && !standing && v[1] <= 0 && this.stepHeight > 0) {
            const x = p[0], y = p[1], z = p[2];
            if (this.settle(0, -this.stepHeight, 0)) {
                standing = true;
                ground = this.#ground;
            }
            else {
                p[0] = x;
                p[1] = y;
                p[2] = z;
                c.move(0, 0, 0);
            }
        }
        if (ceiling && v[1] > 0)
            v[1] = 0;
        // Walking off a moving platform keeps its speed too.
        if (grounded && !standing && !this.jumped) {
            v[0] += carry[0];
            v[2] += carry[2];
        }
        // Landing on a moving platform: only the motion relative to it remains.
        if (!grounded && standing && ground && ground.type !== 'static') {
            v[0] -= ground.linearVelocity[0];
            v[2] -= ground.linearVelocity[2];
        }
        this.#wasGrounded = standing;
        this.#platform = ground;
    }
}
/**
 * Third-person camera: orbits a target at a distance, and moves closer when
 * a wall would hide the target, easing back out afterwards. Set `yaw`,
 * `pitch` and `distance` from input, then call `update()` each frame after
 * the target has moved. The camera must not sit under a transformed parent.
 */
export class FollowCamera3D {
    camera;
    /** Followed object, or a fixed world position. */
    target;
    yaw;
    pitch;
    distance;
    minDistance;
    maxDistance;
    minPitch;
    maxPitch;
    height;
    world;
    mask;
    margin;
    recovery;
    /** Distance actually used on the last update, after obstacles. */
    currentDistance;
    #pivot = new Float32Array(3);
    constructor(camera, target, options = {}) {
        if (!camera || !target)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'follow camera');
        this.camera = camera;
        this.target = target;
        this.distance = options.distance ?? 6;
        this.minDistance = options.minDistance ?? 1;
        this.maxDistance = options.maxDistance ?? 30;
        this.height = options.height ?? 1.4;
        this.yaw = options.yaw ?? 0;
        this.pitch = options.pitch ?? 0.35;
        this.minPitch = options.minPitch ?? -0.3;
        this.maxPitch = options.maxPitch ?? 1.4;
        this.world = options.world;
        this.mask = options.mask ?? -1;
        this.margin = options.margin ?? 0.25;
        this.recovery = options.recovery ?? 0.25;
        this.currentDistance = this.distance;
    }
    /**
     * Turn a "forward" and "right" input into a world-space direction on the
     * ground, relative to where the camera looks: (1, 0) walks away from the camera.
     */
    moveDirection(forward, right, out = [0, 0, 0]) {
        const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
        out[0] = -s * forward + c * right;
        out[1] = 0;
        out[2] = -c * forward - s * right;
        return out;
    }
    /** Place the camera for the current target, angles and distance. */
    update(deltaSeconds = 0) {
        const target = this.target, pivot = this.#pivot;
        if ('getWorldPosition' in target) {
            target.updateWorldMatrix();
            target.getWorldPosition(pivot);
        }
        else {
            pivot[0] = target[0];
            pivot[1] = target[1];
            pivot[2] = target[2];
        }
        pivot[1] += this.height;
        this.pitch = Math.min(Math.max(this.pitch, this.minPitch), this.maxPitch);
        this.distance = Math.min(Math.max(this.distance, this.minDistance), this.maxDistance);
        // Direction from the pivot back to the camera.
        const cp = Math.cos(this.pitch), bx = Math.sin(this.yaw) * cp, by = Math.sin(this.pitch), bz = Math.cos(this.yaw) * cp;
        let allowed = this.distance;
        if (this.world) {
            const hit = this.world.raycast(pivot, [bx, by, bz], this.distance + this.margin, this.mask);
            if (hit)
                allowed = Math.max(hit.distance - this.margin, Math.min(this.minDistance, hit.distance * 0.5));
        }
        // Move in at once so the target is never hidden; move back out gradually.
        if (allowed <= this.currentDistance || !(this.recovery > 0) || !(deltaSeconds > 0))
            this.currentDistance = allowed;
        else
            this.currentDistance += (allowed - this.currentDistance) * Math.min((deltaSeconds / this.recovery) * 3, 1);
        const d = this.currentDistance, camera = this.camera;
        camera.setPosition(pivot[0] + bx * d, pivot[1] + by * d, pivot[2] + bz * d);
        camera.lookAt(pivot[0], pivot[1], pivot[2]);
    }
}
export function createCharacterMotor3D(world, options = {}) {
    return new CharacterMotor3D(world, options);
}
export function createFollowCamera3D(camera, target, options = {}) {
    return new FollowCamera3D(camera, target, options);
}
//# sourceMappingURL=Character3D.js.map