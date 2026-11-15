import type { Camera3D } from './Camera3D.js';
import type { Object3D } from './Object3D.js';
import { CharacterController3D } from './Physics3D.js';
import type { CharacterControllerOptions3D, PhysicsWorld3D, RigidBody3D } from './Physics3D.js';
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
export declare class CharacterMotor3D {
    #private;
    readonly controller: CharacterController3D;
    readonly world: PhysicsWorld3D;
    /** Current velocity relative to whatever the character stands on. */
    readonly velocity: Float64Array<ArrayBuffer>;
    jumpSpeed: number;
    gravity: number;
    stepHeight: number;
    acceleration: number;
    airControl: number;
    coyoteTime: number;
    pushForce: number;
    maxFallSpeed: number;
    /** Turn, in radians about +Y, that the ground gave the character during the last update. Add it to the character's facing. */
    carriedYaw: number;
    /** True on the update in which a jump started. */
    jumped: boolean;
    constructor(world: PhysicsWorld3D, options?: CharacterMotorOptions3D);
    get position(): Float64Array;
    /** True when the character stands on walkable ground, including the edge of a step. */
    get isGrounded(): boolean;
    get groundBody(): RigidBody3D | undefined;
    /**
     * Move the capsule and report whether it ends up standing. The capsule's
     * own test needs a walkable contact; perched on the lip of a step its round
     * foot touches at a slant, so there the surface straight below decides.
     */
    private settle;
    /** Place the character somewhere else and forget its motion. Invalid coordinates leave the motor unchanged. */
    teleport(x: number, y: number, z: number): void;
    /**
     * Advance the character. `wishX` and `wishZ` are the horizontal velocity
     * the player asks for in world units per second; `jump` asks for a jump
     * this frame.
     */
    update(deltaSeconds: number, wishX: number, wishZ: number, jump?: boolean): void;
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
export declare class FollowCamera3D {
    #private;
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
    constructor(camera: Camera3D, target: Object3D | ArrayLike<number>, options?: FollowCameraOptions3D);
    /**
     * Turn a "forward" and "right" input into a world-space direction on the
     * ground, relative to where the camera looks: (1, 0) walks away from the camera.
     */
    moveDirection(forward: number, right: number, out?: Float32Array | number[]): Float32Array | number[];
    /** Place the camera for the current target, angles and distance. */
    update(deltaSeconds?: number): void;
}
export declare function createCharacterMotor3D(world: PhysicsWorld3D, options?: CharacterMotorOptions3D): CharacterMotor3D;
export declare function createFollowCamera3D(camera: Camera3D, target: Object3D | ArrayLike<number>, options?: FollowCameraOptions3D): FollowCamera3D;
//# sourceMappingURL=Character3D.d.ts.map