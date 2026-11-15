import type { Object3D } from './Object3D.js';
import { type PhysicsWorld3D, type RigidBody3D } from './Physics3D.js';
export declare const VEHICLE3D_LIMITS: Readonly<{
    readonly maxWheels: 16;
}>;
export interface WheelOptions3D {
    /** Where the suspension is attached, in the chassis's local frame. */
    readonly position: readonly [number, number, number];
    readonly radius?: number;
    /** Length of the suspension at rest, from the attachment to the wheel's center. Defaults to 0.3. */
    readonly restLength?: number;
    /** Most the suspension may shorten or lengthen from rest. Defaults to 0.2. */
    readonly travel?: number;
    /** Spring strength in force per unit of compression. Defaults to hold a quarter of the chassis at a third of the travel. */
    readonly stiffness?: number;
    /** Damper strength in force per unit of speed. Defaults to a firm ride for the stiffness. */
    readonly damping?: number;
    /** Turns with the steering. */
    readonly steered?: boolean;
    /** Pushes with the engine. */
    readonly driven?: boolean;
    /** Sideways and braking grip as a multiple of the load on the wheel. Defaults to 1.2. */
    readonly grip?: number;
    /** Node placed at the wheel's center and turned with it; give it to a mesh whose axle is its local X axis. */
    readonly node?: Object3D;
}
export interface VehicleOptions3D {
    readonly wheels: readonly WheelOptions3D[];
    /** Force the engine shares between the driven wheels at full throttle. */
    readonly engineForce?: number;
    /** Force the brakes share between all wheels at full brake. */
    readonly brakeForce?: number;
    /** Largest steering angle in radians. Defaults to 0.6. */
    readonly maxSteer?: number;
    /** Speed along the ground beyond which the engine stops pushing. Defaults to 40. */
    readonly topSpeed?: number;
    /**
     * How much of the tyres' sideways push tips the chassis: 1 applies it at the
     * road, where a real tyre pushes, and lets a tall car roll over in a hard turn;
     * 0 applies it level with the center of mass, so the car never leans. Defaults to 0.2.
     */
    readonly rollInfluence?: number;
    /** Bodies the wheels' rays may land on. Defaults to everything. */
    readonly mask?: number;
}
export interface Wheel3D {
    readonly position: Float64Array;
    radius: number;
    restLength: number;
    travel: number;
    stiffness: number;
    damping: number;
    steered: boolean;
    driven: boolean;
    grip: number;
    node: Object3D | undefined;
    /** True when the wheel's ray reached the ground in the last update. */
    grounded: boolean;
    /** Present length of the suspension. */
    length: number;
    /** Load the wheel carried in the last update, as a force. */
    load: number;
    /** How far the wheel has rolled, in radians. */
    spin: number;
    /** Body under the wheel when grounded. */
    ground: RigidBody3D | undefined;
    /** World position of the contact patch when grounded. */
    readonly contact: Float64Array;
}
/**
 * Drives a chassis body on ray wheels. Set `throttle` (-1 to 1), `brake` (0
 * to 1) and `steering` (-1 to 1, positive turns left), then call update() once
 * before each world.step(). The chassis's local -Z is forward and +Y is up.
 */
export declare class Vehicle3D {
    readonly world: PhysicsWorld3D;
    readonly chassis: RigidBody3D;
    readonly wheels: Wheel3D[];
    engineForce: number;
    brakeForce: number;
    maxSteer: number;
    topSpeed: number;
    rollInfluence: number;
    mask: number;
    throttle: number;
    brake: number;
    steering: number;
    /** Speed along the chassis's forward direction after the last update; negative in reverse. */
    speed: number;
    constructor(world: PhysicsWorld3D, chassis: RigidBody3D, options: VehicleOptions3D);
    /** Number of wheels on the ground after the last update. */
    get groundedWheels(): number;
    /** Apply suspension, engine, brakes and tyre grip for the coming step of `deltaSeconds`. */
    update(deltaSeconds: number): void;
}
export declare function createVehicle3D(world: PhysicsWorld3D, chassis: RigidBody3D, options: VehicleOptions3D): Vehicle3D;
//# sourceMappingURL=Vehicle3D.d.ts.map