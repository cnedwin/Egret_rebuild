// SPDX-License-Identifier: Apache-2.0
// Character movement for games, built on the sliding capsule of the physics
// world. CharacterMotor3D turns "walk this way, jump now" into motion with
// gravity, jumping, steps, ground snapping, moving platforms and pushing.
// FollowCamera3D keeps a camera behind a target and pulls it in when a wall
// would come between them. Both are DOM-free; the browser entry adds pointer
// input for the camera.
import type {Camera3D} from './Camera3D.js';
import {World3DError, requireFinite3D} from './core3D.js';
import type {Object3D} from './Object3D.js';
import {CharacterController3D} from './Physics3D.js';
import type {CharacterControllerOptions3D, PhysicsWorld3D, RigidBody3D} from './Physics3D.js';

export interface CharacterMotorOptions3D extends CharacterControllerOptions3D {
    /** Upward speed given by a jump, in units per second. Defaults to 5. */
    readonly jumpSpeed?: number;
    /** Downward acceleration. Defaults to the size of the world's gravity. */
    readonly gravity?: number;
    /** Tallest ledge the character walks up without jumping. Defaults to 0.3. */
    readonly stepHeight?: number;
    /** How quickly walking speed changes on the ground, in units per second squared. Defaults to 60. */
    readonly acceleration?: number;
    /** Share of the ground acceleration available in the air, 0 to 1. Defaults to 0.3. */
    readonly airControl?: number;
    /** Seconds after walking off a ledge during which a jump still works. Defaults to 0.1. */
    readonly coyoteTime?: number;
    /** Force used to shove dynamic bodies the character walks into. Zero disables pushing. Defaults to 40. */
    readonly pushForce?: number;
    /** Fastest fall, in units per second. Defaults to 50. */
    readonly maxFallSpeed?: number;
}

/**
 * A walking, jumping character. Each frame, after `world.step()`, call
 * `update(deltaSeconds, wishX, wishZ, jump)` with the horizontal velocity the
 * player asks for. The motor owns the capsule in `controller`.
 */
export class CharacterMotor3D {
    readonly controller: CharacterController3D;
    readonly world: PhysicsWorld3D;
    /** Current velocity relative to whatever the character stands on. */
    readonly velocity = new Float64Array(3);
    jumpSpeed: number;
    gravity: number;
    stepHeight: number;
    acceleration: number;
    airControl: number;
    coyoteTime: number;
    pushForce: number;
    maxFallSpeed: number;
    /** Turn, in radians about +Y, that the ground gave the character during the last update. Add it to the character's facing. */
    carriedYaw = 0;
    /** True on the update in which a jump started. */
    jumped = false;
    #airTime = Infinity;
    #wasGrounded = false;
    #platform: RigidBody3D | undefined;
    #pushScale = 0;
    #supported = false;
    #ground: RigidBody3D | undefined;
    readonly #carry = new Float64Array(3);

    constructor(world: PhysicsWorld3D, options: CharacterMotorOptions3D = {}) {
        this.world = world;
        this.controller = new CharacterController3D(world, options);
        this.jumpSpeed = options.jumpSpeed ?? 5;
        this.gravity = options.gravity ?? Math.hypot(world.gravity[0]!, world.gravity[1]!, world.gravity[2]!);
        this.stepHeight = options.stepHeight ?? 0.3;
        this.acceleration = options.acceleration ?? 60;
        this.airControl = options.airControl ?? 0.3;
        this.coyoteTime = options.coyoteTime ?? 0.1;
        this.pushForce = options.pushForce ?? 40;
        this.maxFallSpeed = options.maxFallSpeed ?? 50;
        // Walking into something loose shoves it, in proportion to the time spent pushing.
        this.controller.onContact = (body, nx, ny, nz) => {
            if (ny < -0.2) this.#supported = true;
            if (this.#pushScale <= 0 || body.type !== 'dynamic' || Math.abs(ny) > 0.5) return;
            // Push no harder than needed to move the body at the character's own pace.
            const size = Math.hypot(nx, nz) || 1, x = nx / size, z = nz / size, v = this.velocity, carry = this.#carry;
            const closing = (v[0]! + carry[0]! - body.linearVelocity[0]!) * x + (v[2]! + carry[2]! - body.linearVelocity[2]!) * z;
            const impulse = Math.min(this.pushForce * this.#pushScale, closing * body.mass);
            if (impulse > 0) body.applyImpulse(x * impulse, 0, z * impulse);
        };
        // Find the ground the character starts on.
        this.#wasGrounded = this.settle(0, 0, 0);
        this.#platform = this.#ground;
    }
    get position(): Float64Array { return this.controller.position; }
    /** True when the character stands on walkable ground, including the edge of a step. */
    get isGrounded(): boolean { return this.#wasGrounded; }
    get groundBody(): RigidBody3D | undefined { return this.#platform; }
    /**
     * Move the capsule and report whether it ends up standing. The capsule's
     * own test needs a walkable contact; perched on the lip of a step its round
     * foot touches at a slant, so there the surface straight below decides.
     */
    private settle(dx: number, dy: number, dz: number): boolean {
        const c = this.controller;
        this.#supported = false;
        c.move(dx, dy, dz);
        this.#ground = c.groundBody;
        if (c.isGrounded) return true;
        if (!this.#supported) return false;
        const hit = this.world.raycast(c.position, [0, -1, 0], c.height / 2 + this.stepHeight + 0.05, c.mask);
        if (!hit || hit.normal[1] < Math.cos(c.slopeLimit)) return false;
        this.#ground = hit.body;
        return true;
    }
    /** Place the character somewhere else and forget its motion. Invalid coordinates leave the motor unchanged. */
    teleport(x: number, y: number, z: number): void {
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
    update(deltaSeconds: number, wishX: number, wishZ: number, jump = false): void {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds'), c = this.controller, v = this.velocity, p = c.position;
        requireFinite3D(wishX + wishZ, 'wish velocity');
        this.carriedYaw = 0; this.jumped = false;
        if (!(dt > 0)) return;
        // 1. Ride the ground: a moving or turning body under the feet carries the character along.
        const platform = this.#wasGrounded ? this.#platform : undefined, carry = this.#carry;
        carry.fill(0);
        this.#pushScale = 0;
        if (platform && platform.type !== 'static' && platform.world === this.world) {
            const w = platform.angularVelocity, rx = p[0]! - platform.position[0]!, ry = p[1]! - platform.position[1]!, rz = p[2]! - platform.position[2]!;
            carry[0] = platform.linearVelocity[0]! + w[1]! * rz - w[2]! * ry;
            carry[1] = platform.linearVelocity[1]! + w[2]! * rx - w[0]! * rz;
            carry[2] = platform.linearVelocity[2]! + w[0]! * ry - w[1]! * rx;
            this.carriedYaw = w[1]! * dt;
            c.move(carry[0]! * dt, carry[1]! * dt, carry[2]! * dt);
        }
        // 2. Vertical motion: stand, jump or fall.
        const grounded = this.#wasGrounded;
        this.#airTime = grounded ? 0 : this.#airTime + dt;
        if (grounded && v[1]! < 0) v[1] = 0;
        if (jump && this.#airTime <= this.coyoteTime) {
            v[1] = this.jumpSpeed;
            this.#airTime = Infinity;
            this.jumped = true;
            // Leaving a moving platform keeps its speed, like stepping off a moving walkway.
            v[0]! += carry[0]!; v[2]! += carry[2]!; v[1]! += Math.max(carry[1]!, 0);
        } else if (!grounded) v[1] = Math.max(v[1]! - this.gravity * dt, -this.maxFallSpeed);
        // 3. Horizontal motion: head toward the wished velocity, quickly on the ground and weakly in the air.
        const rate = this.acceleration * (grounded && !this.jumped ? 1 : this.airControl) * dt, ax = wishX - v[0]!, az = wishZ - v[2]!, gap = Math.hypot(ax, az);
        if (gap <= rate || !(rate < Infinity)) { v[0] = wishX; v[2] = wishZ; } else { v[0]! += ax / gap * rate; v[2]! += az / gap * rate; }
        // 4. Move, climbing a step when a low ledge blocks the way.
        const dx = v[0]! * dt, dz = v[2]! * dt, dy = v[1]! * dt, wanted = Math.hypot(dx, dz);
        const startX = p[0]!, startY = p[1]!, startZ = p[2]!;
        this.#pushScale = dt;
        let standing = this.settle(dx, dy, dz), ground = this.#ground, ceiling = c.hitCeiling;
        this.#pushScale = 0;
        if (grounded && !this.jumped && this.stepHeight > 0 && wanted > 1e-6) {
            const made = (p[0]! - startX) * dx / wanted + (p[2]! - startZ) * dz / wanted;
            if (made < wanted * 0.75) {
                const plainX = p[0]!, plainY = p[1]!, plainZ = p[2]!;
                p[0] = startX; p[1] = startY; p[2] = startZ;
                c.move(0, this.stepHeight, 0);
                const lifted = p[1]! - startY;
                c.move(dx, 0, dz);
                const landed = this.settle(0, -lifted - this.stepHeight, 0), stepped = (p[0]! - startX) * dx / wanted + (p[2]! - startZ) * dz / wanted;
                // Keep the climb only when it ends standing, got farther, and did not vault higher than a step.
                if (landed && stepped > made + 1e-4 && p[1]! - startY <= this.stepHeight + c.skin * 4) { standing = true; ground = this.#ground; ceiling = false; }
                else { p[0] = plainX; p[1] = plainY; p[2] = plainZ; c.move(0, 0, 0); }
            }
        }
        // 5. Stay on the ground when walking down steps and slopes instead of hopping off them.
        if (grounded && !this.jumped && !standing && v[1]! <= 0 && this.stepHeight > 0) {
            const x = p[0]!, y = p[1]!, z = p[2]!;
            if (this.settle(0, -this.stepHeight, 0)) { standing = true; ground = this.#ground; } else { p[0] = x; p[1] = y; p[2] = z; c.move(0, 0, 0); }
        }
        if (ceiling && v[1]! > 0) v[1] = 0;
        // Walking off a moving platform keeps its speed too.
        if (grounded && !standing && !this.jumped) { v[0]! += carry[0]!; v[2]! += carry[2]!; }
        // Landing on a moving platform: only the motion relative to it remains.
        if (!grounded && standing && ground && ground.type !== 'static') { v[0]! -= ground.linearVelocity[0]!; v[2]! -= ground.linearVelocity[2]!; }
        this.#wasGrounded = standing;
        this.#platform = ground;
    }
}

export interface FollowCameraOptions3D {
    /** Distance kept behind the target when nothing is in the way. Defaults to 6. */
    readonly distance?: number;
    readonly minDistance?: number;
    readonly maxDistance?: number;
    /** Height above the target's position that the camera looks at. Defaults to 1.4. */
    readonly height?: number;
    /** Starting direction: `yaw` about +Y (0 looks along -Z) and `pitch` downward, in radians. */
    readonly yaw?: number;
    readonly pitch?: number;
    readonly minPitch?: number;
    readonly maxPitch?: number;
    /** Physics world whose solid bodies block the view. Leave out for no collision. */
    readonly world?: PhysicsWorld3D;
    /** Collision categories that block the view. */
    readonly mask?: number;
    /** Space kept between the camera and a blocking surface. Defaults to 0.25. */
    readonly margin?: number;
    /** Seconds the camera takes to settle back after an obstacle clears. Zero snaps. Defaults to 0.25. */
    readonly recovery?: number;
}

/**
 * Third-person camera: orbits a target at a distance, and moves closer when
 * a wall would hide the target, easing back out afterwards. Set `yaw`,
 * `pitch` and `distance` from input, then call `update()` each frame after
 * the target has moved. The camera must not sit under a transformed parent.
 */
export class FollowCamera3D {
    readonly camera: Camera3D;
    /** Followed object, or a fixed world position. */
    target: Object3D | ArrayLike<number>;
    yaw: number;
    pitch: number;
    distance: number;
    minDistance: number;
    maxDistance: number;
    minPitch: number;
    maxPitch: number;
    height: number;
    world: PhysicsWorld3D | undefined;
    mask: number;
    margin: number;
    recovery: number;
    /** Distance actually used on the last update, after obstacles. */
    currentDistance: number;
    readonly #pivot = new Float32Array(3);

    constructor(camera: Camera3D, target: Object3D | ArrayLike<number>, options: FollowCameraOptions3D = {}) {
        if (!camera || !target) throw new World3DError('WORLD3D_INPUT_INVALID', 'follow camera');
        this.camera = camera; this.target = target;
        this.distance = options.distance ?? 6; this.minDistance = options.minDistance ?? 1; this.maxDistance = options.maxDistance ?? 30;
        this.height = options.height ?? 1.4;
        this.yaw = options.yaw ?? 0; this.pitch = options.pitch ?? 0.35;
        this.minPitch = options.minPitch ?? -0.3; this.maxPitch = options.maxPitch ?? 1.4;
        this.world = options.world; this.mask = options.mask ?? -1;
        this.margin = options.margin ?? 0.25; this.recovery = options.recovery ?? 0.25;
        this.currentDistance = this.distance;
    }
    /**
     * Turn a "forward" and "right" input into a world-space direction on the
     * ground, relative to where the camera looks: (1, 0) walks away from the camera.
     */
    moveDirection(forward: number, right: number, out: Float32Array | number[] = [0, 0, 0]): Float32Array | number[] {
        const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
        out[0] = -s * forward + c * right; out[1] = 0; out[2] = -c * forward - s * right;
        return out;
    }
    /** Place the camera for the current target, angles and distance. */
    update(deltaSeconds = 0): void {
        const target = this.target, pivot = this.#pivot;
        if ('getWorldPosition' in target) { target.updateWorldMatrix(); target.getWorldPosition(pivot); } else { pivot[0] = target[0]!; pivot[1] = target[1]!; pivot[2] = target[2]!; }
        pivot[1]! += this.height;
        this.pitch = Math.min(Math.max(this.pitch, this.minPitch), this.maxPitch);
        this.distance = Math.min(Math.max(this.distance, this.minDistance), this.maxDistance);
        // Direction from the pivot back to the camera.
        const cp = Math.cos(this.pitch), bx = Math.sin(this.yaw) * cp, by = Math.sin(this.pitch), bz = Math.cos(this.yaw) * cp;
        let allowed = this.distance;
        if (this.world) {
            const hit = this.world.raycast(pivot, [bx, by, bz], this.distance + this.margin, this.mask);
            if (hit) allowed = Math.max(hit.distance - this.margin, Math.min(this.minDistance, hit.distance * 0.5));
        }
        // Move in at once so the target is never hidden; move back out gradually.
        if (allowed <= this.currentDistance || !(this.recovery > 0) || !(deltaSeconds > 0)) this.currentDistance = allowed;
        else this.currentDistance += (allowed - this.currentDistance) * Math.min(deltaSeconds / this.recovery * 3, 1);
        const d = this.currentDistance, camera = this.camera;
        camera.setPosition(pivot[0]! + bx * d, pivot[1]! + by * d, pivot[2]! + bz * d);
        camera.lookAt(pivot[0]!, pivot[1]!, pivot[2]!);
    }
}

export function createCharacterMotor3D(world: PhysicsWorld3D, options: CharacterMotorOptions3D = {}): CharacterMotor3D { return new CharacterMotor3D(world, options); }
export function createFollowCamera3D(camera: Camera3D, target: Object3D | ArrayLike<number>, options: FollowCameraOptions3D = {}): FollowCamera3D { return new FollowCamera3D(camera, target, options); }
