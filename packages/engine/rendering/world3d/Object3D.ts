// SPDX-License-Identifier: Apache-2.0
// Scene-graph node. Transform storage is mutable typed arrays; local and world
// matrices are recomputed lazily from dirty flags so static subtrees cost
// nothing per frame.
import {World3DError, allocateId3D} from './core3D.js';
import {
    mat4Compose, mat4Copy, mat4Decompose, mat4Identity, mat4Invert, mat4LookAt, mat4Multiply,
    quatFromAxisAngle, quatFromEuler, quatFromRotationMatrix, quatMultiply, quatNormalize, vec3TransformMat4,
} from './math3D.js';

export type Object3DKind = 'object' | 'scene' | 'mesh' | 'camera' | 'light' | 'bone';
export const WORLD3D_LIMITS = Object.freeze({
    maxDepth: 256, maxChildren: 65536, maxNameLength: 256,
} as const);

const UP = new Float32Array([0, 1, 0]);
const scratchMatrix = new Float32Array(16);
const scratchVector = new Float32Array(3);
const scratchQuat = new Float32Array(4);

export class Object3D {
    readonly id = allocateId3D();
    readonly kind: Object3DKind;
    name = '';
    /** Local translation, unit rotation quaternion and scale. Call markTransformDirty() after writing directly. */
    readonly position = new Float32Array(3);
    readonly quaternion = new Float32Array([0, 0, 0, 1]);
    readonly scale = new Float32Array([1, 1, 1]);
    /** Local and world matrices; valid after updateWorldMatrix(). */
    readonly matrix = mat4Identity(new Float32Array(16)) as Float32Array;
    readonly matrixWorld = mat4Identity(new Float32Array(16)) as Float32Array;
    visible = true;
    /** Bit mask matched against the camera mask; an object renders when the masks intersect. */
    layers = 1;
    /** Higher values draw later within the opaque or transparent pass. */
    renderOrder = 0;
    castShadow = false;
    receiveShadow = true;
    frustumCulled = true;
    /** Free-form application data; never read by the engine. */
    userData: Record<string, unknown> = {};

    #parent: Object3D | undefined;
    readonly #children: Object3D[] = [];
    #localDirty = true;
    #worldDirty = true;
    #worldVersion = 0;

    constructor(kind: Object3DKind = 'object') {
        this.kind = kind;
    }

    get parent(): Object3D | undefined { return this.#parent; }
    get children(): readonly Object3D[] { return this.#children; }
    get numChildren(): number { return this.#children.length; }
    /** Increases every time matrixWorld is recomputed; dependants compare it to skip work. */
    get worldVersion(): number { return this.#worldVersion; }

    // ---- hierarchy ---------------------------------------------------------
    addChild<T extends Object3D>(child: T): T {
        return this.addChildAt(child, this.#children.length);
    }
    addChildAt<T extends Object3D>(child: T, index: number): T {
        if (!(child instanceof Object3D) || (child as Object3D) === this) throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'child');
        if (child.kind === 'scene') throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'a scene cannot be a child');
        if (!Number.isSafeInteger(index) || index < 0 || index > this.#children.length) throw new World3DError('WORLD3D_INPUT_INVALID', 'index');
        let depth = 0;
        for (let node: Object3D | undefined = this; node; node = node.#parent) {
            if (node === child) throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'cycle');
            if (++depth > WORLD3D_LIMITS.maxDepth) throw new World3DError('WORLD3D_BUDGET', 'depth');
        }
        if (this.#children.length >= WORLD3D_LIMITS.maxChildren && child.#parent !== this) throw new World3DError('WORLD3D_BUDGET', 'children');
        if (child.#parent) {
            const siblings = child.#parent.#children, at = siblings.indexOf(child);
            siblings.splice(at, 1);
            if (child.#parent === this && at < index) index--;
        }
        child.#parent = this;
        this.#children.splice(index, 0, child);
        child.#worldDirty = true;
        return child;
    }
    removeChild<T extends Object3D>(child: T): T {
        const index = this.#children.indexOf(child);
        if (index < 0) throw new World3DError('WORLD3D_HIERARCHY_INVALID', 'not a child');
        this.#children.splice(index, 1);
        child.#parent = undefined;
        child.#worldDirty = true;
        return child;
    }
    removeFromParent(): this {
        this.#parent?.removeChild(this);
        return this;
    }
    removeChildren(): void {
        for (const child of this.#children) { child.#parent = undefined; child.#worldDirty = true; }
        this.#children.length = 0;
    }
    getChildAt(index: number): Object3D | undefined { return this.#children[index]; }
    /** Depth-first search including this node. */
    getObjectByName(name: string): Object3D | undefined {
        if (this.name === name) return this;
        for (const child of this.#children) {
            const found = child.getObjectByName(name);
            if (found) return found;
        }
        return undefined;
    }
    /** Pre-order traversal. Returning false from the callback skips that subtree. */
    traverse(callback: (object: Object3D) => boolean | void): void {
        if (callback(this) === false) return;
        for (const child of this.#children) child.traverse(callback);
    }

    // ---- transform ---------------------------------------------------------
    setPosition(x: number, y: number, z: number): this {
        this.position[0] = x; this.position[1] = y; this.position[2] = z;
        this.#localDirty = true;
        return this;
    }
    setScale(x: number, y = x, z = x): this {
        this.scale[0] = x; this.scale[1] = y; this.scale[2] = z;
        this.#localDirty = true;
        return this;
    }
    setQuaternion(x: number, y: number, z: number, w: number): this {
        this.quaternion[0] = x; this.quaternion[1] = y; this.quaternion[2] = z; this.quaternion[3] = w;
        quatNormalize(this.quaternion, this.quaternion);
        this.#localDirty = true;
        return this;
    }
    /** Intrinsic XYZ Euler angles in radians. */
    setRotation(x: number, y: number, z: number): this {
        quatFromEuler(this.quaternion, x, y, z);
        this.#localDirty = true;
        return this;
    }
    /** Post-multiply a rotation about a local axis. */
    rotateOnAxis(axis: ArrayLike<number>, radians: number): this {
        quatFromAxisAngle(scratchQuat, axis, radians);
        quatMultiply(this.quaternion, this.quaternion, scratchQuat);
        this.#localDirty = true;
        return this;
    }
    /** Orient the negative Z axis (cameras, lights) toward a world-space point. */
    lookAt(x: number, y: number, z: number, up: ArrayLike<number> = UP): this {
        this.updateWorldMatrix();
        const world = this.matrixWorld;
        scratchVector[0] = x; scratchVector[1] = y; scratchVector[2] = z;
        mat4LookAt(scratchMatrix, [world[12]!, world[13]!, world[14]!], scratchVector, up);
        quatFromRotationMatrix(this.quaternion, scratchMatrix);
        const parent = this.#parent;
        if (parent) {
            // Convert the world orientation into the parent's frame.
            mat4Decompose(parent.matrixWorld, scratchVector, scratchQuat, new Float32Array(3));
            scratchQuat[0] = -scratchQuat[0]!; scratchQuat[1] = -scratchQuat[1]!; scratchQuat[2] = -scratchQuat[2]!;
            quatMultiply(this.quaternion, scratchQuat, this.quaternion);
        }
        this.#localDirty = true;
        return this;
    }
    /** Replace the local transform from an affine matrix. */
    setMatrix(matrix: ArrayLike<number>): this {
        mat4Decompose(matrix, this.position, this.quaternion, this.scale);
        this.#localDirty = true;
        return this;
    }
    /** Required after writing position, quaternion or scale arrays directly. */
    markTransformDirty(): void {
        this.#localDirty = true;
    }
    /**
     * Refresh matrixWorld for this node, resolving dirty ancestors first.
     * Returns true when the world matrix changed.
     */
    updateWorldMatrix(): boolean {
        const parent = this.#parent;
        const parentChanged = parent ? parent.updateWorldMatrix() : false;
        return this.refresh(parentChanged);
    }
    /** Refresh this subtree top-down. Call once per frame on the scene root. */
    updateWorldMatrices(parentChanged = false): void {
        const changed = this.refresh(parentChanged);
        const children = this.#children;
        for (let i = 0; i < children.length; i++) children[i]!.updateWorldMatrices(changed);
    }
    private refresh(parentChanged: boolean): boolean {
        if (this.#localDirty) {
            mat4Compose(this.matrix, this.position, this.quaternion, this.scale);
            this.#localDirty = false;
            this.#worldDirty = true;
        }
        if (!this.#worldDirty && !parentChanged) return false;
        if (this.#parent) mat4Multiply(this.matrixWorld, this.#parent.matrixWorld, this.matrix);
        else mat4Copy(this.matrixWorld, this.matrix);
        this.#worldDirty = false;
        this.#worldVersion++;
        this.onWorldMatrixChanged();
        return true;
    }
    /** Subclass hook, invoked after matrixWorld was recomputed. */
    protected onWorldMatrixChanged(): void {}

    /** World-space position; refreshes ancestors as needed. */
    getWorldPosition(out: Float32Array | number[] = new Float32Array(3)): Float32Array | number[] {
        this.updateWorldMatrix();
        out[0] = this.matrixWorld[12]!; out[1] = this.matrixWorld[13]!; out[2] = this.matrixWorld[14]!;
        return out;
    }
    localToWorld(out: Float32Array | number[], point: ArrayLike<number>): Float32Array | number[] {
        this.updateWorldMatrix();
        return vec3TransformMat4(out, point, this.matrixWorld) as Float32Array | number[];
    }
    worldToLocal(out: Float32Array | number[], point: ArrayLike<number>): Float32Array | number[] {
        this.updateWorldMatrix();
        if (!mat4Invert(scratchMatrix, this.matrixWorld)) throw new World3DError('WORLD3D_INPUT_INVALID', 'singular world matrix');
        return vec3TransformMat4(out, point, scratchMatrix) as Float32Array | number[];
    }

    /**
     * Copy this node and its subtree. Geometries, materials and skeleton data
     * are shared by reference; subclasses override copyFrom for their state.
     */
    clone(recursive = true): this {
        const copy = new (this.constructor as new () => this)();
        copy.copyFrom(this);
        if (recursive) for (const child of this.#children) copy.addChild(child.clone(true));
        return copy;
    }
    protected copyFrom(source: this): void {
        this.name = source.name;
        this.position.set(source.position); this.quaternion.set(source.quaternion); this.scale.set(source.scale);
        this.visible = source.visible; this.layers = source.layers; this.renderOrder = source.renderOrder;
        this.castShadow = source.castShadow; this.receiveShadow = source.receiveShadow; this.frustumCulled = source.frustumCulled;
        this.userData = {...source.userData};
        this.#localDirty = true;
    }
}

export type Fog3D =
    | {readonly kind: 'linear'; readonly color: readonly [number, number, number]; readonly near: number; readonly far: number}
    | {readonly kind: 'exponential'; readonly color: readonly [number, number, number]; readonly density: number};

/** Root of a renderable graph; owns environment-wide settings. Colors are linear RGB. */
export class Scene3D extends Object3D {
    /** Clear color, or a cube texture drawn as a skybox. `undefined` keeps the canvas transparent. */
    background: readonly [number, number, number] | import('./Texture3D.js').CubeTexture3D | undefined;
    backgroundIntensity = 1;
    /** Cube texture used for image-based lighting on standard materials. */
    environment: import('./Texture3D.js').CubeTexture3D | undefined;
    environmentIntensity = 1;
    fog: Fog3D | undefined;
    /** Draw every mesh with this material instead of its own, as for masks and depth-only views. */
    overrideMaterial: import('./Material3D.js').Material3D | undefined;
    /**
     * Up to four world-space planes as [nx, ny, nz, d]. Fragments on the
     * negative side (n . p + d < 0) are not drawn. Shadows are not clipped.
     */
    clippingPlanes: readonly (readonly [number, number, number, number])[] = [];
    constructor() {
        super('scene');
    }
}
