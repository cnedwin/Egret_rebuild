// SPDX-License-Identifier: Apache-2.0
// Scene-graph node. Transform storage is mutable typed arrays; local and world
// matrices are recomputed lazily from dirty flags so static subtrees cost
// nothing per frame.
import { World3DError, allocateId3D } from './core3D.js';
import { mat4Compose, mat4Copy, mat4Decompose, mat4Identity, mat4Invert, mat4LookAt, mat4Multiply, quatFromAxisAngle, quatFromEuler, quatFromRotationMatrix, quatMultiply, quatNormalize, vec3TransformMat4 } from './math3D.js';
export const WORLD3D_LIMITS = Object.freeze({
    maxDepth: 256,
    maxChildren: 65536,
    maxNameLength: 256
});
const UP = new Float32Array([0, 1, 0]);
const scratchMatrix = new Float32Array(16);
const scratchVector = new Float32Array(3);
const scratchQuat = new Float32Array(4);
export class Object3D {
    id = allocateId3D();
    kind;
    name = '';
    /** Local translation, unit rotation quaternion and scale. Call markTransformDirty() after writing directly. */
    position = new Float32Array(3);
    quaternion = new Float32Array([0, 0, 0, 1]);
    scale = new Float32Array([1, 1, 1]);
    /** Local and world matrices; valid after updateWorldMatrix(). */
    matrix = mat4Identity(new Float32Array(16));
    matrixWorld = mat4Identity(new Float32Array(16));
    visible = true;
    /** Bit mask matched against the camera mask; an object renders when the masks intersect. */
    layers = 1;
    /** Higher values draw later within the opaque or transparent pass. */
    renderOrder = 0;
    castShadow = false;
    receiveShadow = true;
    frustumCulled = true;
    /** Free-form application data; never read by the engine. */
    userData = {};
    #parent;
    #children = [];
    #localDirty = true;
    #worldDirty = true;
    #worldVersion = 0;
    /** World version of the parent that matrixWorld was last computed from. */
    #parentVersion = -1;
    constructor(kind = 'object') {
        this.kind = kind;
    }
    get parent() {
        return this.#parent;
    }
    get children() {
        return this.#children;
    }
    get numChildren() {
        return this.#children.length;
    }
    /** Increases every time matrixWorld is recomputed; dependants compare it to skip work. */
    get worldVersion() {
        return this.#worldVersion;
    }
    // ---- hierarchy ---------------------------------------------------------
    addChild(child) {
        return this.addChildAt(child, this.#children.length);
    }
    addChildAt(child, index) {
        if (!(child instanceof Object3D) || child === this)
            throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'child');
        if (child.kind === 'scene')
            throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'a scene cannot be a child');
        if (!Number.isSafeInteger(index) || index < 0 || index > this.#children.length)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'index');
        let depth = 0;
        for (let node = this; node; node = node.#parent) {
            if (node === child)
                throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'cycle');
            if (++depth > WORLD3D_LIMITS.maxDepth)
                throw new World3DError('WORLD3D_BUDGET', 'depth');
        }
        if (this.#children.length >= WORLD3D_LIMITS.maxChildren && child.#parent !== this)
            throw new World3DError('WORLD3D_BUDGET', 'children');
        if (child.#parent) {
            const siblings = child.#parent.#children, at = siblings.indexOf(child);
            siblings.splice(at, 1);
            if (child.#parent === this && at < index)
                index--;
        }
        child.#parent = this;
        this.#children.splice(index, 0, child);
        child.#worldDirty = true;
        return child;
    }
    removeChild(child) {
        const index = this.#children.indexOf(child);
        if (index < 0)
            throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'not a child');
        this.#children.splice(index, 1);
        child.#parent = undefined;
        child.#worldDirty = true;
        return child;
    }
    removeFromParent() {
        this.#parent?.removeChild(this);
        return this;
    }
    removeChildren() {
        for (const child of this.#children) {
            child.#parent = undefined;
            child.#worldDirty = true;
        }
        this.#children.length = 0;
    }
    getChildAt(index) {
        return this.#children[index];
    }
    /** Depth-first search including this node. */
    getObjectByName(name) {
        if (this.name === name)
            return this;
        for (const child of this.#children) {
            const found = child.getObjectByName(name);
            if (found)
                return found;
        }
        return undefined;
    }
    /** Pre-order traversal. Returning false from the callback skips that subtree. */
    traverse(callback) {
        if (callback(this) === false)
            return;
        for (const child of this.#children)
            child.traverse(callback);
    }
    // ---- transform ---------------------------------------------------------
    setPosition(x, y, z) {
        this.position[0] = x;
        this.position[1] = y;
        this.position[2] = z;
        this.#localDirty = true;
        return this;
    }
    setScale(x, y = x, z = x) {
        this.scale[0] = x;
        this.scale[1] = y;
        this.scale[2] = z;
        this.#localDirty = true;
        return this;
    }
    setQuaternion(x, y, z, w) {
        this.quaternion[0] = x;
        this.quaternion[1] = y;
        this.quaternion[2] = z;
        this.quaternion[3] = w;
        quatNormalize(this.quaternion, this.quaternion);
        this.#localDirty = true;
        return this;
    }
    /** Intrinsic XYZ Euler angles in radians. */
    setRotation(x, y, z) {
        quatFromEuler(this.quaternion, x, y, z);
        this.#localDirty = true;
        return this;
    }
    /** Post-multiply a rotation about a local axis. */
    rotateOnAxis(axis, radians) {
        quatFromAxisAngle(scratchQuat, axis, radians);
        quatMultiply(this.quaternion, this.quaternion, scratchQuat);
        this.#localDirty = true;
        return this;
    }
    /** Orient the negative Z axis (cameras, lights) toward a world-space point. */
    lookAt(x, y, z, up = UP) {
        this.updateWorldMatrix();
        const world = this.matrixWorld;
        scratchVector[0] = x;
        scratchVector[1] = y;
        scratchVector[2] = z;
        mat4LookAt(scratchMatrix, [world[12], world[13], world[14]], scratchVector, up);
        quatFromRotationMatrix(this.quaternion, scratchMatrix);
        const parent = this.#parent;
        if (parent) {
            // Convert the world orientation into the parent's frame.
            mat4Decompose(parent.matrixWorld, scratchVector, scratchQuat, new Float32Array(3));
            scratchQuat[0] = -scratchQuat[0];
            scratchQuat[1] = -scratchQuat[1];
            scratchQuat[2] = -scratchQuat[2];
            quatMultiply(this.quaternion, scratchQuat, this.quaternion);
        }
        this.#localDirty = true;
        return this;
    }
    /** Replace the local transform from an affine matrix. */
    setMatrix(matrix) {
        mat4Decompose(matrix, this.position, this.quaternion, this.scale);
        this.#localDirty = true;
        return this;
    }
    /** Required after writing position, quaternion or scale arrays directly. */
    markTransformDirty() {
        this.#localDirty = true;
    }
    /**
     * Refresh matrixWorld for this node, resolving dirty ancestors first.
     * Returns true when the world matrix changed.
     */
    updateWorldMatrix() {
        const parent = this.#parent;
        const parentChanged = parent ? parent.updateWorldMatrix() : false;
        return this.refresh(parentChanged);
    }
    /** Refresh this subtree top-down. Call once per frame on the scene root. */
    updateWorldMatrices(parentChanged = false) {
        const changed = this.refresh(parentChanged);
        const children = this.#children;
        for (let i = 0; i < children.length; i++)
            children[i].updateWorldMatrices(changed);
    }
    refresh(parentChanged) {
        if (this.#localDirty) {
            mat4Compose(this.matrix, this.position, this.quaternion, this.scale);
            this.#localDirty = false;
            this.#worldDirty = true;
        }
        // The parent may have been refreshed on its own earlier, so its change no longer arrives
        // through `parentChanged`; comparing versions catches that.
        const parent = this.#parent;
        if (!this.#worldDirty && !parentChanged && (!parent || this.#parentVersion === parent.#worldVersion))
            return false;
        if (parent) {
            mat4Multiply(this.matrixWorld, parent.matrixWorld, this.matrix);
            this.#parentVersion = parent.#worldVersion;
        }
        else
            mat4Copy(this.matrixWorld, this.matrix);
        this.#worldDirty = false;
        this.#worldVersion++;
        this.onWorldMatrixChanged();
        return true;
    }
    /** Subclass hook, invoked after matrixWorld was recomputed. */
    onWorldMatrixChanged() { }
    /** World-space position; refreshes ancestors as needed. */
    getWorldPosition(out = new Float32Array(3)) {
        this.updateWorldMatrix();
        out[0] = this.matrixWorld[12];
        out[1] = this.matrixWorld[13];
        out[2] = this.matrixWorld[14];
        return out;
    }
    localToWorld(out, point) {
        this.updateWorldMatrix();
        return vec3TransformMat4(out, point, this.matrixWorld);
    }
    worldToLocal(out, point) {
        this.updateWorldMatrix();
        if (!mat4Invert(scratchMatrix, this.matrixWorld))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'singular world matrix');
        return vec3TransformMat4(out, point, scratchMatrix);
    }
    /**
     * Copy this node and its subtree. Geometries, materials and skeleton data
     * are shared by reference; subclasses override copyFrom for their state.
     */
    clone(recursive = true) {
        const copy = new this.constructor();
        copy.copyFrom(this);
        if (recursive)
            for (const child of this.#children)
                copy.addChild(child.clone(true));
        return copy;
    }
    copyFrom(source) {
        this.name = source.name;
        this.position.set(source.position);
        this.quaternion.set(source.quaternion);
        this.scale.set(source.scale);
        this.visible = source.visible;
        this.layers = source.layers;
        this.renderOrder = source.renderOrder;
        this.castShadow = source.castShadow;
        this.receiveShadow = source.receiveShadow;
        this.frustumCulled = source.frustumCulled;
        this.userData = { ...source.userData };
        this.#localDirty = true;
    }
}
/** Root of a renderable graph; owns environment-wide settings. Colors are linear RGB. */
export class Scene3D extends Object3D {
    /** Clear color, or a cube texture drawn as a skybox. `undefined` keeps the canvas transparent. */
    background;
    backgroundIntensity = 1;
    /** Cube texture used for image-based lighting on standard materials. */
    environment;
    environmentIntensity = 1;
    fog;
    /** Draw every mesh with this material instead of its own, as for masks and depth-only views. */
    overrideMaterial;
    /**
     * Up to four world-space planes as [nx, ny, nz, d]. Fragments on the
     * negative side (n . p + d < 0) are not drawn. Shadows are not clipped.
     */
    clippingPlanes = [];
    constructor() {
        super('scene');
    }
}
//# sourceMappingURL=Object3D.js.map