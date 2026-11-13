// SPDX-License-Identifier: Apache-2.0
// A ragdoll: rigid bodies and joints laid over a skeleton, built from the pose the
// character is in at the moment it goes limp, and written back to the bones after each
// physics step. DOM-free and backend-independent.
import {World3DError, requireFinite3D} from './core3D.js';
import {mat4Compose, mat4Decompose, mat4Invert, mat4Multiply, quatNormalize} from './math3D.js';
import type {Object3D} from './Object3D.js';
import type {Joint3D, JointOptions3D, PhysicsWorld3D, RigidBody3D, ShapeDefinition3D} from './Physics3D.js';

export const RAGDOLL3D_LIMITS = Object.freeze({maxParts: 64} as const);

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
    readonly shape: Extract<ShapeDefinition3D, {type: 'sphere' | 'capsule' | 'box'}>;
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

const world = new Float32Array(16), local = new Float32Array(16), inverse = new Float32Array(16);
const place = new Float32Array(3), turn = new Float32Array(4), size = new Float32Array(3);

/**
 * Bodies and joints for a skeleton, created from the current pose by activate()
 * and removed again by deactivate(). While active, call update() after each
 * world.step() to move the bones with the bodies; bones that no part names
 * keep whatever pose they had, carried along by their parents.
 */
export class Ragdoll3D {
    readonly world: PhysicsWorld3D;
    readonly root: Object3D;
    readonly options: RagdollOptions3D;
    /** One body per part while active, in the order the parts were given. */
    readonly bodies: RigidBody3D[] = [];
    readonly joints: Joint3D[] = [];
    readonly #parts: readonly RagdollPart3D[];
    readonly #bones: Object3D[] = [];
    readonly #scales: Float32Array[] = [];

    constructor(physics: PhysicsWorld3D, root: Object3D, parts: readonly RagdollPart3D[], options: RagdollOptions3D = {}) {
        if (!physics || typeof physics.createBody !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'physics world');
        if (!root || typeof root.traverse !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll root');
        if (!Array.isArray(parts) || parts.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll parts');
        if (parts.length > RAGDOLL3D_LIMITS.maxParts) throw new World3DError('WORLD3D_BUDGET', 'ragdoll parts');
        const named = new Map<string, Object3D>();
        root.traverse((object) => { if (object.name && !named.has(object.name)) named.set(object.name, object); });
        let roots = 0;
        for (const [index, part] of parts.entries()) {
            const bone = typeof part?.bone === 'string' ? named.get(part.bone) : part?.bone;
            if (!bone || typeof bone.updateWorldMatrix !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll bone ' + index);
            if (this.#bones.includes(bone)) throw new World3DError('WORLD3D_INPUT_INVALID', 'a bone is named by two parts');
            const kind = part.shape?.type;
            if (kind !== 'sphere' && kind !== 'capsule' && kind !== 'box') throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll shapes are spheres, capsules or boxes');
            if (part.parent === undefined) roots++;
            else if (!Number.isInteger(part.parent) || part.parent < 0 || part.parent >= index) throw new World3DError('WORLD3D_INPUT_INVALID', 'a ragdoll parent comes before its children');
            if (part.offset) for (const value of part.offset) requireFinite3D(value, 'ragdoll offset');
            const joint = part.joint;
            if (joint && joint.type !== undefined && joint.type !== 'point' && joint.type !== 'hinge') throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll joint type');
            this.#bones.push(bone);
        }
        if (roots !== 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'a ragdoll has exactly one part without a parent');
        this.world = physics; this.root = root; this.options = {...options}; this.#parts = parts.map(part => ({...part}));
    }
    get active(): boolean { return this.bodies.length > 0; }
    get bones(): readonly Object3D[] { return this.#bones; }
    /**
     * Go limp from the pose the skeleton is in now. `velocity` is the speed
     * every part starts with, such as the character's own; `spin` adds a turn
     * about the root part.
     */
    activate(velocity: ArrayLike<number> = [0, 0, 0], spin: ArrayLike<number> = [0, 0, 0]): void {
        if (this.active) return;
        const o = this.options;
        this.root.updateWorldMatrix();
        const bodies: RigidBody3D[] = [], joints: Joint3D[] = [], scales: Float32Array[] = [];
        try {
            for (const [index, part] of this.#parts.entries()) {
                const bone = this.#bones[index]!;
                bone.updateWorldMatrix();
                const m = bone.matrixWorld, at = part.offset ?? [0, 0, 0], scale = new Float32Array(3);
                mat4Decompose(m, place, turn, scale);
                scales[index] = scale;
                const body = this.world.createBody({
                    type: 'dynamic', shape: part.shape, mass: part.mass ?? 1,
                    position: [m[0]! * at[0] + m[4]! * at[1] + m[8]! * at[2] + m[12]!, m[1]! * at[0] + m[5]! * at[1] + m[9]! * at[2] + m[13]!, m[2]! * at[0] + m[6]! * at[1] + m[10]! * at[2] + m[14]!],
                    quaternion: [turn[0]!, turn[1]!, turn[2]!, turn[3]!],
                    friction: o.friction ?? 0.6, restitution: o.restitution ?? 0, linearDamping: o.linearDamping ?? 0.05, angularDamping: o.angularDamping ?? 0.4,
                    ...(o.layer === undefined ? {} : {layer: o.layer}), ...(o.mask === undefined ? {} : {mask: o.mask}), userData: this,
                });
                bodies.push(body);
                body.setLinearVelocity(velocity[0]!, velocity[1]!, velocity[2]!);
            }
            const rootBody = bodies[this.#parts.findIndex(part => part.parent === undefined)]!;
            rootBody.setAngularVelocity(spin[0]!, spin[1]!, spin[2]!);
            for (const [index, part] of this.#parts.entries()) {
                if (part.parent === undefined) continue;
                const bone = this.#bones[index]!, m = bone.matrixWorld, joint = part.joint ?? {}, axis = joint.axis ?? [0, 1, 0];
                // The direction is given in the bone's frame; the joint wants it in the world.
                const ax = m[0]! * axis[0] + m[4]! * axis[1] + m[8]! * axis[2], ay = m[1]! * axis[0] + m[5]! * axis[1] + m[9]! * axis[2], az = m[2]! * axis[0] + m[6]! * axis[1] + m[10]! * axis[2];
                const options: JointOptions3D = {
                    type: joint.type ?? 'point', bodyA: bodies[index]!, bodyB: bodies[part.parent]!, anchor: [m[12]!, m[13]!, m[14]!], axis: [ax, ay, az],
                    ...(joint.limits && (joint.type === 'hinge') ? {limits: joint.limits} : {}), ...(joint.coneLimit !== undefined && joint.type !== 'hinge' ? {coneLimit: joint.coneLimit} : {}),
                };
                joints.push(this.world.createJoint(options));
            }
        } catch (error) {
            // Only objects from this activation are rolled back. Keep the original refusal.
            for (const joint of joints) this.world.removeJoint(joint);
            for (const body of bodies) this.world.removeBody(body);
            throw error;
        }
        this.bodies.push(...bodies);
        this.joints.push(...joints);
        this.#scales.push(...scales);
    }
    /** Remove the bodies and joints; the bones stay where the bodies left them. */
    deactivate(): void {
        for (const joint of this.joints) this.world.removeJoint(joint);
        for (const body of this.bodies) this.world.removeBody(body);
        this.joints.length = 0; this.bodies.length = 0; this.#scales.length = 0;
    }
    /** Move each bone to its body. Call after world.step() while active. */
    update(): void {
        if (!this.active) return;
        for (const [index, part] of this.#parts.entries()) {
            const bone = this.#bones[index]!, body = this.bodies[index]!, at = part.offset ?? [0, 0, 0], scale = this.#scales[index]!;
            turn[0] = body.quaternion[0]!; turn[1] = body.quaternion[1]!; turn[2] = body.quaternion[2]!; turn[3] = body.quaternion[3]!;
            quatNormalize(turn, turn);
            // The bone's origin lies back from the body's center by the offset.
            place[0] = place[1] = place[2] = 0;
            mat4Compose(world, place, turn, scale);
            place[0] = body.position[0]! - (world[0]! * at[0] + world[4]! * at[1] + world[8]! * at[2]);
            place[1] = body.position[1]! - (world[1]! * at[0] + world[5]! * at[1] + world[9]! * at[2]);
            place[2] = body.position[2]! - (world[2]! * at[0] + world[6]! * at[1] + world[10]! * at[2]);
            world[12] = place[0]!; world[13] = place[1]!; world[14] = place[2]!;
            const parent = bone.parent;
            if (parent) {
                // Parents were written first, so their world matrices are already the new ones.
                parent.updateWorldMatrix();
                if (!mat4Invert(inverse, parent.matrixWorld)) continue;
                mat4Multiply(local, inverse, world);
                mat4Decompose(local, place, turn, size);
            } else mat4Decompose(world, place, turn, size);
            bone.position.set(place); bone.quaternion.set(turn); bone.scale.set(size);
            bone.markTransformDirty();
        }
    }
    dispose(): void { this.deactivate(); }
}

export function createRagdoll3D(world: PhysicsWorld3D, root: Object3D, parts: readonly RagdollPart3D[], options: RagdollOptions3D = {}): Ragdoll3D {
    return new Ragdoll3D(world, root, parts, options);
}
