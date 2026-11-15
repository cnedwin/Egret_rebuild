import type { Object3D } from './Object3D.js';
import { ConvexHullShape3D } from './PhysicsHull3D.js';
import { TriangleMeshShape3D } from './PhysicsMesh3D.js';
export declare const raycastExcludingBody3D: unique symbol;
export declare const PHYSICS3D_LIMITS: Readonly<{
    readonly maxBodies: 16384;
    readonly maxSubSteps: 8;
    readonly maxContactsPerPair: 8;
    readonly maxCompoundChildren: 32;
    readonly maxSolverSteps: 8;
}>;
export type BodyType3D = 'static' | 'kinematic' | 'dynamic';
export type ShapeDefinition3D = {
    readonly type: 'sphere';
    readonly radius: number;
} | {
    readonly type: 'box';
    readonly halfExtents: readonly [number, number, number];
}
/** Capsule along the local Y axis; `halfHeight` is half the distance between the two cap centers. */
 | {
    readonly type: 'capsule';
    readonly radius: number;
    readonly halfHeight: number;
}
/** Infinite plane through the body position, facing the body's local +Y axis. Static only. */
 | {
    readonly type: 'plane';
}
/** Convex solid given by its corner points; any body type. */
 | {
    readonly type: 'convex';
    readonly hull: ConvexHullShape3D;
}
/** Triangle mesh for level geometry, solid on the front side of each triangle. Static, or kinematic for moving platforms. */
 | {
    readonly type: 'mesh';
    readonly mesh: TriangleMeshShape3D;
}
/**
 * Several solid shapes that move as one body, such as a table or an L-shaped block.
 * The body's position is taken as its center of mass, so place the parts around the origin.
 */
 | {
    readonly type: 'compound';
    readonly children: readonly CompoundChild3D[];
};
/** One part of a compound shape, placed in the body's local frame. */
export interface CompoundChild3D {
    readonly shape: Extract<ShapeDefinition3D, {
        type: 'sphere' | 'box' | 'capsule' | 'convex';
    }>;
    readonly position?: readonly [number, number, number];
    readonly quaternion?: readonly [number, number, number, number];
}
export interface RigidBodyOptions3D {
    readonly type?: BodyType3D;
    readonly shape: ShapeDefinition3D;
    readonly mass?: number;
    readonly position?: readonly [number, number, number];
    readonly quaternion?: readonly [number, number, number, number];
    readonly restitution?: number;
    readonly friction?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    /** Report overlaps through contact events without pushing anything. */
    readonly isTrigger?: boolean;
    /** Collision category bits and the categories this body collides with. */
    readonly layer?: number;
    readonly mask?: number;
    /** Stop the body from rotating, as for an upright character. */
    readonly fixedRotation?: boolean;
    /**
     * Continuous collision for fast bodies such as projectiles: each step the
     * body's travel is cut short at the first surface in its path, so it
     * cannot pass through thin walls. The path is probed along the line of
     * the body's center.
     */
    readonly continuous?: boolean;
    /** Scene node placed at the body when it is added and moved with it after each step; it must not have a transformed parent. */
    readonly node?: Object3D;
    readonly userData?: unknown;
}
export interface PhysicsRaycastHit3D {
    readonly body: RigidBody3D;
    readonly point: [number, number, number];
    readonly normal: [number, number, number];
    readonly distance: number;
}
export interface PhysicsShapeCastHit3D {
    readonly body: RigidBody3D;
    /** How far the shape travelled before touching. */
    readonly distance: number;
    readonly point: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
}
/** What a pair of solid bodies did to each other in one step. The object is reused; copy what you keep. */
export interface PhysicsContact3D {
    readonly a: RigidBody3D;
    readonly b: RigidBody3D;
    /** Where they touch, averaged over the contact points and weighted by how hard each one pushed. */
    readonly point: ArrayLike<number>;
    /** Direction from `a` toward `b`. */
    readonly normal: ArrayLike<number>;
    /** Total push along the normal this step; divide by a body's mass for the change of speed it caused. */
    readonly impulse: number;
    /** True in the first step the pair touches. */
    readonly began: boolean;
}
export interface PhysicsWorldOptions3D {
    readonly gravity?: readonly [number, number, number];
    /** Length of one simulation step in seconds. */
    readonly fixedStep?: number;
    readonly maxSubSteps?: number;
    readonly iterations?: number;
    /**
     * Solve each fixed step in this many smaller slices, finding contacts once. More slices
     * hold tall stacks, long chains and heavy loads on light links far better than more
     * iterations do, at about the same cost when `iterations` is lowered to match. Defaults to 1.
     */
    readonly solverSteps?: number;
    readonly allowSleep?: boolean;
}
type Vec = Float64Array;
export declare class RigidBody3D {
    readonly id: number;
    readonly type: BodyType3D;
    readonly shape: ShapeDefinition3D;
    readonly position: Vec;
    /** Unit quaternion, xyzw. Call wake() after writing position or orientation directly. */
    readonly quaternion: Float64Array<ArrayBuffer>;
    readonly linearVelocity: Vec;
    readonly angularVelocity: Vec;
    readonly force: Vec;
    readonly torque: Vec;
    readonly mass: number;
    readonly inverseMass: number;
    restitution: number;
    friction: number;
    linearDamping: number;
    angularDamping: number;
    isTrigger: boolean;
    layer: number;
    mask: number;
    fixedRotation: boolean;
    continuous: boolean;
    node: Object3D | undefined;
    userData: unknown;
    isSleeping: boolean;
    /** @internal */ readonly rotation: Float64Array<ArrayBuffer>;
    /** @internal */ readonly inverseInertiaLocal: Vec;
    /** @internal */ readonly inverseInertiaWorld: Float64Array<ArrayBuffer>;
    /** @internal */ readonly aabb: Float64Array<ArrayBuffer>;
    /** @internal */ sleepTime: number;
    /** @internal */ slot: number;
    /** @internal */ world: PhysicsWorld3D | undefined;
    /** @internal Stand-in bodies for the parts of a compound shape, kept at their world poses by refresh(). */
    readonly parts: RigidBody3D[];
    /** @internal Local placement of each part: position, then quaternion. */
    readonly partPoses: Float64Array[];
    /** @internal Half extents of the box around a compound, used to weigh it. */
    readonly compoundHalf: Vec;
    constructor(options: RigidBodyOptions3D);
    wake(): void;
    setPosition(x: number, y: number, z: number): this;
    setQuaternion(x: number, y: number, z: number, w: number): this;
    setLinearVelocity(x: number, y: number, z: number): this;
    setAngularVelocity(x: number, y: number, z: number): this;
    /** Accumulate a force through the center of mass; cleared after each step. */
    applyForce(x: number, y: number, z: number): void;
    applyTorque(x: number, y: number, z: number): void;
    /** Change velocity at once; give `point` in world space to add spin. */
    applyImpulse(x: number, y: number, z: number, point?: ArrayLike<number>): void;
    /** @internal Recompute the rotation matrix, world inertia and bounds from the pose. */
    refresh(): void;
}
export type JointType3D = 'point' | 'hinge' | 'fixed' | 'distance' | 'slider';
export interface JointOptions3D {
    readonly type: JointType3D;
    readonly bodyA: RigidBody3D;
    /** Second body; leave out to pin bodyA to a fixed place in the world. */
    readonly bodyB?: RigidBody3D;
    /**
     * World-space pivot when the joint is created. Defaults to bodyA's position.
     * For 'distance' this is the attachment on bodyA.
     */
    readonly anchor?: readonly [number, number, number];
    /** 'distance' only: world-space attachment on bodyB (or in the world). Defaults to bodyB's position. */
    readonly anchorB?: readonly [number, number, number];
    /**
     * 'hinge': world-space direction of the hinge pin. 'point': the direction
     * `coneLimit` is measured around. 'slider': the direction bodyA may travel. Defaults to +Y.
     */
    readonly axis?: readonly [number, number, number];
    /**
     * 'hinge': lowest and highest angle in radians, relative to the pose at creation; both within -PI..PI.
     * 'slider': lowest and highest travel of bodyA along the axis, relative to where it was created.
     */
    readonly limits?: readonly [number, number];
    /** 'hinge': turning speed in radians per second the motor drives toward. 'slider': travel speed along the axis. */
    readonly motorSpeed?: number;
    /** 'hinge' only: strongest torque the motor may use. Zero, the default, turns the motor off. */
    readonly maxMotorTorque?: number;
    /** 'slider' only: strongest force the motor may use. Zero, the default, turns the motor off. */
    readonly maxMotorForce?: number;
    /**
     * 'distance' only: make the link a spring. `stiffness` is how many times per second it
     * swings back and forth; `damping` is 0 for no loss and 1 for settling without overshoot.
     */
    readonly stiffness?: number;
    readonly damping?: number;
    /** 'point' only: largest angle in radians bodyB may swing away from `axis`. */
    readonly coneLimit?: number;
    /** 'distance' only: rest length; defaults to the distance between the anchors at creation. */
    readonly length?: number;
    /** 'distance' only: act like a rope that goes slack when shorter than its length. */
    readonly rope?: boolean;
    /** Let the two bodies collide with each other. Defaults to false. */
    readonly collideConnected?: boolean;
}
interface JointPoint {
    localA: Vec;
    localB: Vec;
    ra: Vec;
    rb: Vec;
    bias: Vec;
    inverse: Float64Array;
}
/** A constraint between two bodies, or between a body and the world. Create it with world.createJoint(). */
export declare class Joint3D {
    readonly type: JointType3D;
    readonly bodyA: RigidBody3D;
    readonly bodyB: RigidBody3D | undefined;
    readonly collideConnected: boolean;
    enabled: boolean;
    /** 'distance' joints: rest length, and whether it only limits stretching. */
    length: number;
    rope: boolean;
    /** 'hinge' joints: angle range in radians, or undefined for a free hinge. */
    limits: [number, number] | undefined;
    /** 'hinge' joints: target speed in radians per second, and the torque available to reach it (0 = off). 'slider' joints: travel speed. */
    motorSpeed: number;
    maxMotorTorque: number;
    /** 'slider' joints: the force available to reach `motorSpeed` (0 = off). */
    maxMotorForce: number;
    /** 'distance' joints: swings per second of the spring (0 = rigid), and how quickly it settles. */
    stiffness: number;
    damping: number;
    /** @internal */ readonly slide: Vec;
    /** @internal */ slideMass: number;
    /** 'point' joints: largest swing angle in radians, or undefined for none. */
    coneLimit: number | undefined;
    /** @internal */ readonly points: JointPoint[];
    /** @internal */ readonly axisA: Vec;
    /** @internal */ readonly axisB: Vec;
    /** @internal */ readonly sideA: Vec;
    /** @internal */ readonly sideB: Vec;
    /** @internal */ readonly row: Vec;
    /** @internal */ rowMass: number;
    /** @internal */ rowArm: number;
    /** @internal */ readonly rowDirection: Vec;
    /** @internal */ readonly rowA: Vec;
    /** @internal */ readonly rowB: Vec;
    /** @internal */ rowLow: number;
    /** @internal */ rowHigh: number;
    /** @internal */ limitImpulse: number;
    /** @internal */ limitImpulseHigh: number;
    /** @internal */ motorImpulse: number;
    /** @internal */ current: number;
    /** @internal */ accumulated: number;
    /** @internal */ world: PhysicsWorld3D | undefined;
    constructor(options: JointOptions3D);
    /**
     * 'hinge' joints: how far bodyA has turned about the pin since creation,
     * relative to bodyB or the world, in radians. 'point' joints: how far
     * the two bodies have swung apart, measured between their copies of the axis.
     */
    /** 'slider' joints: how far bodyA has travelled along the axis since creation, relative to bodyB or the world. */
    get translation(): number;
    get angle(): number;
}
export declare class PhysicsWorld3D {
    #private;
    readonly gravity: Vec;
    fixedStep: number;
    maxSubSteps: number;
    iterations: number;
    solverSteps: number;
    allowSleep: boolean;
    /** Called when two bodies start or stop touching. Triggers report here too. */
    onContactBegin: ((a: RigidBody3D, b: RigidBody3D) => void) | undefined;
    onContactEnd: ((a: RigidBody3D, b: RigidBody3D) => void) | undefined;
    /**
     * Called after every step for each pair of solid bodies that pressed on each other, with
     * where, in which direction and how hard: enough to pick a sound, deal damage or squash a shape.
     */
    onContact: ((contact: PhysicsContact3D) => void) | undefined;
    constructor(options?: PhysicsWorldOptions3D);
    get bodies(): readonly RigidBody3D[];
    /** @internal A static body was repositioned: its place among the others is worked out again. */
    staticMoved(body: RigidBody3D): void;
    /** Visit every body whose bounds meet a box: planes, bodies that can move, then static ones. */
    private near;
    /** Contact points solved in the last step. */
    get contactCount(): number;
    addBody(body: RigidBody3D): RigidBody3D;
    /** Create a body from options and add it. */
    createBody(options: RigidBodyOptions3D): RigidBody3D;
    get joints(): readonly Joint3D[];
    /** Connect two bodies, or pin one to the world. Anchors are given in world space as the bodies stand now. */
    createJoint(options: JointOptions3D): Joint3D;
    removeJoint(joint: Joint3D): void;
    private prepareJoints;
    /**
     * Set up the rotational equation of a joint. Turning impulses are applied
     * as a push at the point where the more mobile body would pivot freely
     * about the joint (its center of percussion), which leaves the pivot
     * itself undisturbed and so settles in few iterations even for a small
     * weight on a long arm.
     */
    private prepareRow;
    private solveJoint;
    removeBody(body: RigidBody3D): void;
    /**
     * Advance by `deltaSeconds` in fixed steps, carrying the remainder to the
     * next call. Returns the number of steps taken.
     */
    step(deltaSeconds: number): number;
    private syncNodes;
    private fixedUpdate;
    /**
     * Share of this step's travel a fast body may make before its shape meets
     * a surface it is not already resting on. It stops just touching, so the
     * next step finds the contact and answers it with the body's full speed.
     */
    private sweep;
    /**
     * Walk `probe` along a unit direction and return how far it gets before touching one of
     * the accepted bodies, or -1. The probe is left where it touched and the body it met in
     * #castBody. With `skipTouching`, whatever the probe already rests on is not counted.
     */
    private cast;
    private findContacts;
    private testPair;
    private pairKey;
    /**
     * Work out everything one solver direction needs, so the iterations that follow are plain
     * sums and products. Returns the effective mass along that direction.
     */
    private prepareContactRow;
    /** Velocity of b relative to a at the contact, along the direction stored at `at`. */
    private rowVelocity;
    private applyRow;
    private solve;
    /** Nearest solid body hit by a ray; triggers are skipped. `direction` need not be normalized. */
    raycast(origin: ArrayLike<number>, direction: ArrayLike<number>, maxDistance?: number, mask?: number): PhysicsRaycastHit3D | undefined;
    /** @internal Skip one body before selecting the nearest hit. */
    [raycastExcludingBody3D](origin: ArrayLike<number>, direction: ArrayLike<number>, maxDistance: number, mask: number, excluded?: RigidBody3D): PhysicsRaycastHit3D | undefined;
    /** Solid bodies whose shape touches a sphere; triggers are skipped. */
    overlapSphere(center: ArrayLike<number>, radius: number, mask?: number): RigidBody3D[];
    /**
     * Move a shape along a unit direction and report the first body it
     * touches: the distance travelled, the point of contact and the surface
     * normal facing the shape. The path is walked in steps no longer than the
     * shape's thinnest half and the touch refined between two steps, so
     * anything thinner than that step may be passed over. Triggers are ignored.
     */
    shapeCast(shape: ShapeDefinition3D, origin: ArrayLike<number>, direction: ArrayLike<number>, maxDistance: number, mask?: number, quaternion?: ArrayLike<number>): PhysicsShapeCastHit3D | undefined;
    /** @internal Contacts of a free-standing shape against the world, for the character controller. */
    probe(body: RigidBody3D, mask: number, visit: (nx: number, ny: number, nz: number, depth: number, other: RigidBody3D) => void): void;
}
export interface CharacterControllerOptions3D {
    readonly radius?: number;
    /** Total height including both caps. */
    readonly height?: number;
    readonly position?: readonly [number, number, number];
    /** Steepest walkable slope in radians. */
    readonly slopeLimit?: number;
    /** Gap kept from surfaces so the capsule never rests exactly in contact. */
    readonly skin?: number;
    readonly mask?: number;
    readonly node?: Object3D;
}
/**
 * Kinematic capsule that slides along the world instead of being simulated.
 * Call move() with the displacement you want; it resolves penetration and
 * reports whether the capsule stands on walkable ground.
 */
export declare class CharacterController3D {
    #private;
    readonly world: PhysicsWorld3D;
    readonly position: Vec;
    readonly radius: number;
    readonly height: number;
    slopeLimit: number;
    skin: number;
    mask: number;
    node: Object3D | undefined;
    /** True when the last move ended on a walkable surface. */
    isGrounded: boolean;
    /** Normal of the ground under the capsule after the last move. */
    readonly groundNormal: Vec;
    /** Body standing under the capsule, when grounded. */
    groundBody: RigidBody3D | undefined;
    /** True when the last move was stopped by something overhead. */
    hitCeiling: boolean;
    /** Called for every obstacle the capsule is pushed out of during a move; the normal points from the capsule into the obstacle. */
    onContact: ((body: RigidBody3D, nx: number, ny: number, nz: number, depth: number) => void) | undefined;
    constructor(world: PhysicsWorld3D, options?: CharacterControllerOptions3D);
    /** Move by a world-space displacement, sliding along anything in the way. */
    move(dx: number, dy: number, dz: number): void;
}
export declare function createPhysicsWorld3D(options?: PhysicsWorldOptions3D): PhysicsWorld3D;
export declare function createCharacterController3D(world: PhysicsWorld3D, options?: CharacterControllerOptions3D): CharacterController3D;
export {};
//# sourceMappingURL=Physics3D.d.ts.map