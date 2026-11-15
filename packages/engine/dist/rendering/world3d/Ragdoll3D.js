// SPDX-License-Identifier: Apache-2.0
// A ragdoll: rigid bodies and joints laid over a skeleton, built from the pose the
// character is in at the moment it goes limp, and written back to the bones after each
// physics step. DOM-free and backend-independent.
import { World3DError, requireFinite3D } from './core3D.js';
import { mat4Compose, mat4Decompose, mat4Invert, mat4Multiply, quatNormalize } from './math3D.js';
export const RAGDOLL3D_LIMITS = Object.freeze({ maxParts: 64 });
const world = new Float32Array(16), local = new Float32Array(16), inverse = new Float32Array(16);
const place = new Float32Array(3), turn = new Float32Array(4), size = new Float32Array(3);
/**
 * Bodies and joints for a skeleton, created from the current pose by activate()
 * and removed again by deactivate(). While active, call update() after each
 * world.step() to move the bones with the bodies; bones that no part names
 * keep whatever pose they had, carried along by their parents.
 */
export class Ragdoll3D {
    world;
    root;
    options;
    /** One body per part while active, in the order the parts were given. */
    bodies = [];
    joints = [];
    #parts;
    #bones = [];
    #scales = [];
    constructor(physics, root, parts, options = {}) {
        if (!physics || typeof physics.createBody !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'physics world');
        if (!root || typeof root.traverse !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll root');
        if (!Array.isArray(parts) || parts.length === 0)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll parts');
        if (parts.length > RAGDOLL3D_LIMITS.maxParts)
            throw new World3DError('WORLD3D_BUDGET', 'ragdoll parts');
        const named = new Map();
        root.traverse(object => {
            if (object.name && !named.has(object.name))
                named.set(object.name, object);
        });
        let roots = 0;
        for (const [index, part] of parts.entries()) {
            const bone = typeof part?.bone === 'string' ? named.get(part.bone) : part?.bone;
            if (!bone || typeof bone.updateWorldMatrix !== 'function')
                throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll bone ' + index);
            if (this.#bones.includes(bone))
                throw new World3DError('WORLD3D_INPUT_INVALID', 'a bone is named by two parts');
            const kind = part.shape?.type;
            if (kind !== 'sphere' && kind !== 'capsule' && kind !== 'box')
                throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll shapes are spheres, capsules or boxes');
            if (part.parent === undefined)
                roots++;
            else if (!Number.isInteger(part.parent) || part.parent < 0 || part.parent >= index)
                throw new World3DError('WORLD3D_INPUT_INVALID', 'a ragdoll parent comes before its children');
            if (part.offset)
                for (const value of part.offset)
                    requireFinite3D(value, 'ragdoll offset');
            const joint = part.joint;
            if (joint && joint.type !== undefined && joint.type !== 'point' && joint.type !== 'hinge')
                throw new World3DError('WORLD3D_INPUT_INVALID', 'ragdoll joint type');
            this.#bones.push(bone);
        }
        if (roots !== 1)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'a ragdoll has exactly one part without a parent');
        this.world = physics;
        this.root = root;
        this.options = { ...options };
        this.#parts = parts.map(part => ({ ...part }));
    }
    get active() {
        return this.bodies.length > 0;
    }
    get bones() {
        return this.#bones;
    }
    /**
     * Go limp from the pose the skeleton is in now. `velocity` is the speed
     * every part starts with, such as the character's own; `spin` adds a turn
     * about the root part.
     */
    activate(velocity = [0, 0, 0], spin = [0, 0, 0]) {
        if (this.active)
            return;
        const o = this.options;
        this.root.updateWorldMatrix();
        const bodies = [], joints = [], scales = [];
        try {
            for (const [index, part] of this.#parts.entries()) {
                const bone = this.#bones[index];
                bone.updateWorldMatrix();
                const m = bone.matrixWorld, at = part.offset ?? [0, 0, 0], scale = new Float32Array(3);
                mat4Decompose(m, place, turn, scale);
                scales[index] = scale;
                const body = this.world.createBody({
                    type: 'dynamic',
                    shape: part.shape,
                    mass: part.mass ?? 1,
                    position: [
                        m[0] * at[0] + m[4] * at[1] + m[8] * at[2] + m[12],
                        m[1] * at[0] + m[5] * at[1] + m[9] * at[2] + m[13],
                        m[2] * at[0] + m[6] * at[1] + m[10] * at[2] + m[14]
                    ],
                    quaternion: [turn[0], turn[1], turn[2], turn[3]],
                    friction: o.friction ?? 0.6,
                    restitution: o.restitution ?? 0,
                    linearDamping: o.linearDamping ?? 0.05,
                    angularDamping: o.angularDamping ?? 0.4,
                    ...(o.layer === undefined ? {} : { layer: o.layer }),
                    ...(o.mask === undefined ? {} : { mask: o.mask }),
                    userData: this
                });
                bodies.push(body);
                body.setLinearVelocity(velocity[0], velocity[1], velocity[2]);
            }
            const rootBody = bodies[this.#parts.findIndex(part => part.parent === undefined)];
            rootBody.setAngularVelocity(spin[0], spin[1], spin[2]);
            for (const [index, part] of this.#parts.entries()) {
                if (part.parent === undefined)
                    continue;
                const bone = this.#bones[index], m = bone.matrixWorld, joint = part.joint ?? {}, axis = joint.axis ?? [0, 1, 0];
                // The direction is given in the bone's frame; the joint wants it in the world.
                const ax = m[0] * axis[0] + m[4] * axis[1] + m[8] * axis[2], ay = m[1] * axis[0] + m[5] * axis[1] + m[9] * axis[2], az = m[2] * axis[0] + m[6] * axis[1] + m[10] * axis[2];
                const options = {
                    type: joint.type ?? 'point',
                    bodyA: bodies[index],
                    bodyB: bodies[part.parent],
                    anchor: [m[12], m[13], m[14]],
                    axis: [ax, ay, az],
                    ...(joint.limits && joint.type === 'hinge' ? { limits: joint.limits } : {}),
                    ...(joint.coneLimit !== undefined && joint.type !== 'hinge' ? { coneLimit: joint.coneLimit } : {})
                };
                joints.push(this.world.createJoint(options));
            }
        }
        catch (error) {
            // Only objects from this activation are rolled back. Keep the original refusal.
            for (const joint of joints)
                this.world.removeJoint(joint);
            for (const body of bodies)
                this.world.removeBody(body);
            throw error;
        }
        this.bodies.push(...bodies);
        this.joints.push(...joints);
        this.#scales.push(...scales);
    }
    /** Remove the bodies and joints; the bones stay where the bodies left them. */
    deactivate() {
        for (const joint of this.joints)
            this.world.removeJoint(joint);
        for (const body of this.bodies)
            this.world.removeBody(body);
        this.joints.length = 0;
        this.bodies.length = 0;
        this.#scales.length = 0;
    }
    /** Move each bone to its body. Call after world.step() while active. */
    update() {
        if (!this.active)
            return;
        for (const [index, part] of this.#parts.entries()) {
            const bone = this.#bones[index], body = this.bodies[index], at = part.offset ?? [0, 0, 0], scale = this.#scales[index];
            turn[0] = body.quaternion[0];
            turn[1] = body.quaternion[1];
            turn[2] = body.quaternion[2];
            turn[3] = body.quaternion[3];
            quatNormalize(turn, turn);
            // The bone's origin lies back from the body's center by the offset.
            place[0] = place[1] = place[2] = 0;
            mat4Compose(world, place, turn, scale);
            place[0] = body.position[0] - (world[0] * at[0] + world[4] * at[1] + world[8] * at[2]);
            place[1] = body.position[1] - (world[1] * at[0] + world[5] * at[1] + world[9] * at[2]);
            place[2] = body.position[2] - (world[2] * at[0] + world[6] * at[1] + world[10] * at[2]);
            world[12] = place[0];
            world[13] = place[1];
            world[14] = place[2];
            const parent = bone.parent;
            if (parent) {
                // Parents were written first, so their world matrices are already the new ones.
                parent.updateWorldMatrix();
                if (!mat4Invert(inverse, parent.matrixWorld))
                    continue;
                mat4Multiply(local, inverse, world);
                mat4Decompose(local, place, turn, size);
            }
            else
                mat4Decompose(world, place, turn, size);
            bone.position.set(place);
            bone.quaternion.set(turn);
            bone.scale.set(size);
            bone.markTransformDirty();
        }
    }
    dispose() {
        this.deactivate();
    }
}
export function createRagdoll3D(world, root, parts, options = {}) {
    return new Ragdoll3D(world, root, parts, options);
}
//# sourceMappingURL=Ragdoll3D.js.map