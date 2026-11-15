import type { Object3D } from './Object3D.js';
import type { Joint3D, PhysicsWorld3D, RigidBody3D, ShapeDefinition3D } from './Physics3D.js';
export declare const RAGDOLL3D_LIMITS: Readonly<{
    readonly maxParts: 64;
}>;
export interface RagdollJoint3D {
    /** 'point' swings freely like a shoulder; 'hinge' bends one way like a knee. Defaults to 'point'. */
    readonly type?: 'point' | 'hinge';
    /** Direction in the bone's own frame: the hinge pin, or the direction a cone limit is measured around. Defaults to +Y. */
    readonly axis?: readonly [number, number, number];
    /** 'hinge': lowest and highest angle in radians from the pose at activation. */
    readonly limits?: readonly [number, number];
    /** 'point': the widest swing in radians from the pose at activation. */
    readonly coneLimit?: number;
}
export interface RagdollPart3D {
    /** The bone this part moves, or its name under the ragdoll's root. */
    readonly bone: Object3D | string;
    /** A sphere, capsule or box in world units. A capsule runs along the bone's local Y axis. */
    readonly shape: Extract<ShapeDefinition3D, {
        type: 'sphere' | 'capsule' | 'box';
    }>;
    readonly mass?: number;
    /** Center of the shape in the bone's local frame, in the bone's own units. Defaults to the bone's origin. */
    readonly offset?: readonly [number, number, number];
    /** Index of the part this one hangs from. Leave out for the part everything else hangs from; a parent comes before its children. */
    readonly parent?: number;
    /** How this part is attached to its parent, at this part's bone. */
    readonly joint?: RagdollJoint3D;
}
export interface RagdollOptions3D {
    readonly layer?: number;
    readonly mask?: number;
    readonly friction?: number;
    readonly restitution?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
}
/**
 * Bodies and joints for a skeleton, created from the current pose by activate()
 * and removed again by deactivate(). While active, call update() after each
 * world.step() to move the bones with the bodies; bones that no part names
 * keep whatever pose they had, carried along by their parents.
 */
export declare class Ragdoll3D {
    #private;
    readonly world: PhysicsWorld3D;
    readonly root: Object3D;
    readonly options: RagdollOptions3D;
    /** One body per part while active, in the order the parts were given. */
    readonly bodies: RigidBody3D[];
    readonly joints: Joint3D[];
    constructor(physics: PhysicsWorld3D, root: Object3D, parts: readonly RagdollPart3D[], options?: RagdollOptions3D);
    get active(): boolean;
    get bones(): readonly Object3D[];
    /**
     * Go limp from the pose the skeleton is in now. `velocity` is the speed
     * every part starts with, such as the character's own; `spin` adds a turn
     * about the root part.
     */
    activate(velocity?: ArrayLike<number>, spin?: ArrayLike<number>): void;
    /** Remove the bodies and joints; the bones stay where the bodies left them. */
    deactivate(): void;
    /** Move each bone to its body. Call after world.step() while active. */
    update(): void;
    dispose(): void;
}
export declare function createRagdoll3D(world: PhysicsWorld3D, root: Object3D, parts: readonly RagdollPart3D[], options?: RagdollOptions3D): Ragdoll3D;
//# sourceMappingURL=Ragdoll3D.d.ts.map