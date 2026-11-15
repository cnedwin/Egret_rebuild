import type { Object3D } from './Object3D.js';
import { PhysicsWorld3D, type BodyType3D, type JointType3D, type PhysicsWorldOptions3D } from './Physics3D.js';
/** A Worker, a worker's global scope, a MessagePort: anything that posts and receives messages. */
export interface PhysicsPort3D {
    postMessage(message: unknown, transfer?: never): void;
    addEventListener(type: 'message', listener: (event: {
        readonly data: unknown;
    }) => void): void;
    removeEventListener(type: 'message', listener: (event: {
        readonly data: unknown;
    }) => void): void;
    /** A MessagePort delivers nothing until it is started; workers have no such step. */
    start?(): void;
}
/** Shapes that can be described in a message. A convex hull is given by its corner points. */
export type RemoteShape3D = {
    readonly type: 'sphere';
    readonly radius: number;
} | {
    readonly type: 'box';
    readonly halfExtents: readonly [number, number, number];
} | {
    readonly type: 'capsule';
    readonly radius: number;
    readonly halfHeight: number;
} | {
    readonly type: 'plane';
} | {
    readonly type: 'convex';
    readonly points: readonly number[];
} | {
    readonly type: 'compound';
    readonly children: readonly {
        readonly shape: Exclude<RemoteShape3D, {
            type: 'plane' | 'compound';
        }>;
        readonly position?: readonly [number, number, number];
        readonly quaternion?: readonly [number, number, number, number];
    }[];
};
export interface RemoteBodyOptions3D {
    readonly type?: BodyType3D;
    readonly shape: RemoteShape3D;
    readonly mass?: number;
    readonly position?: readonly [number, number, number];
    readonly quaternion?: readonly [number, number, number, number];
    readonly restitution?: number;
    readonly friction?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    readonly isTrigger?: boolean;
    readonly layer?: number;
    readonly mask?: number;
    readonly fixedRotation?: boolean;
    readonly continuous?: boolean;
    /** Scene node moved to the body by update(). It stays on this side; it is not sent. */
    readonly node?: Object3D;
    readonly userData?: unknown;
}
export interface RemoteJointOptions3D {
    readonly type: JointType3D;
    readonly bodyA: RemoteBody3D;
    readonly bodyB?: RemoteBody3D;
    readonly anchor?: readonly [number, number, number];
    readonly anchorB?: readonly [number, number, number];
    readonly axis?: readonly [number, number, number];
    readonly limits?: readonly [number, number];
    readonly motorSpeed?: number;
    readonly maxMotorTorque?: number;
    readonly maxMotorForce?: number;
    readonly coneLimit?: number;
    readonly length?: number;
    readonly rope?: boolean;
    readonly stiffness?: number;
    readonly damping?: number;
    readonly collideConnected?: boolean;
}
export interface RemoteRaycastHit3D {
    readonly body: RemoteBody3D;
    readonly distance: number;
    readonly point: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
}
declare const ownsBody: unique symbol;
/**
 * Run a physics world on this end of a port and answer the messages of a
 * PhysicsClient3D. In a worker this is the whole script:
 *     import {servePhysics3D} from '@egret/engine/world3d';
 *     servePhysics3D(self);
 * Returns the world, for a host that wants to add to it directly.
 */
export declare function servePhysics3D(port: PhysicsPort3D, options?: PhysicsWorldOptions3D): PhysicsWorld3D;
/** The page's stand-in for a body that lives behind the port. */
export declare class RemoteBody3D {
    #private;
    readonly id: number;
    readonly type: BodyType3D;
    /** Where the body was after the latest step this side has heard of. */
    readonly position: Float32Array<ArrayBuffer>;
    readonly quaternion: Float32Array<ArrayBuffer>;
    /** @internal Where it was the step before, for blending between the two. */
    readonly previous: Float32Array<ArrayBuffer>;
    isSleeping: boolean;
    node: Object3D | undefined;
    userData: unknown;
    /** @internal */
    constructor(client: PhysicsClient3D, id: number, options: RemoteBodyOptions3D);
    get removed(): boolean;
    private send;
    /** Move the body there at once; this side shows it there straight away. */
    setPosition(x: number, y: number, z: number): this;
    setQuaternion(x: number, y: number, z: number, w: number): this;
    setLinearVelocity(x: number, y: number, z: number): this;
    setAngularVelocity(x: number, y: number, z: number): this;
    applyImpulse(x: number, y: number, z: number, point?: ArrayLike<number>): void;
    /** A force for the next step only, as with a local body. */
    applyForce(x: number, y: number, z: number): void;
    remove(): void;
}
export declare class RemoteJoint3D {
    #private;
    readonly id: number;
    /** @internal */
    constructor(client: PhysicsClient3D, id: number);
    remove(): void;
}
/**
 * The page's end of a remote physics world. Create bodies and joints as with a
 * local world, call step() once per frame, and update() to place the nodes.
 * Positions arrive a moment after they are asked for, so what is shown trails
 * the simulation by about one step; update(alpha) blends the last two steps
 * to hide the difference between the step rate and the frame rate.
 */
export declare class PhysicsClient3D {
    #private;
    /** Steps asked for and not yet answered. */
    get pending(): number;
    /** Number of the latest step whose result has arrived. */
    get frame(): number;
    onContactBegin: ((a: RemoteBody3D, b: RemoteBody3D) => void) | undefined;
    onContactEnd: ((a: RemoteBody3D, b: RemoteBody3D) => void) | undefined;
    /** Called when the other end could not carry out a request. */
    onError: ((message: string, about: string) => void) | undefined;
    /** Called after the result of a step has been taken in. */
    onStep: ((frame: number) => void) | undefined;
    constructor(port: PhysicsPort3D, options?: PhysicsWorldOptions3D);
    get bodies(): IterableIterator<RemoteBody3D>;
    /** @internal */ post(message: Record<string, unknown>): void;
    [ownsBody](body: unknown): body is RemoteBody3D;
    /** @internal */ forget(body: RemoteBody3D): void;
    createBody(options: RemoteBodyOptions3D): RemoteBody3D;
    createJoint(options: RemoteJointOptions3D): RemoteJoint3D;
    setGravity(x: number, y: number, z: number): void;
    /**
     * Ask for the world to advance. If `maxPending` earlier steps are still
     * unanswered the request is not sent and false is returned, so a slow
     * worker falls behind in time instead of piling up work.
     */
    step(deltaSeconds: number, maxPending?: number): boolean;
    /** The nearest solid body on a ray, as the world stands when the request arrives. */
    raycast(origin: ArrayLike<number>, direction: ArrayLike<number>, maxDistance?: number, mask?: number): Promise<RemoteRaycastHit3D | undefined>;
    private receive;
    /**
     * Place every body's node. `alpha` runs from 0, the step before last, to 1,
     * the latest step; pass how far the frame is between two steps to smooth
     * motion when frames and steps do not line up.
     */
    update(alpha?: number): void;
    /** Stop listening and answer every waiting ray with nothing. The worker itself is the caller's to end. */
    dispose(): void;
}
export declare function connectPhysics3D(port: PhysicsPort3D, options?: PhysicsWorldOptions3D): PhysicsClient3D;
export {};
//# sourceMappingURL=PhysicsRemote3D.d.ts.map