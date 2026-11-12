// SPDX-License-Identifier: Apache-2.0
// Renderable nodes: meshes with optional skinning, morphing and instancing,
// plus bones, skeletons and camera-facing sprites.
import {World3DError, requireCount3D} from './core3D.js';
import {Geometry3D} from './Geometry3D.js';
import {Material3D, createSpriteMaterial3D} from './Material3D.js';
import type {SpriteMaterialOptions3D} from './Material3D.js';
import {box3Empty, box3ExpandByPoint, mat4Compose, mat4Copy, mat4Identity, mat4Invert, mat4Multiply, sphereFromBox, sphereTransform} from './math3D.js';
import {Object3D} from './Object3D.js';
import {createQuadGeometry3D} from './primitives3D.js';

export const MESH3D_LIMITS = Object.freeze({maxBones: 1024, maxInstances: 1048576, maxMaterials: 64} as const);

export class Bone3D extends Object3D {
    constructor() {
        super('bone');
    }
}

/** Ordered bones with their inverse bind matrices; one instance may drive many meshes. */
export class Skeleton3D {
    readonly bones: readonly Object3D[];
    /** 16 floats per bone: bind-pose mesh space to bone space. */
    readonly inverseBindMatrices: Float32Array;
    /** 16 floats per bone: boneWorld * inverseBind, refreshed by update(). */
    readonly boneMatrices: Float32Array;
    /** Increases on every update(); backends compare it before re-uploading. */
    version = 0;
    #lastFrame = -1;

    constructor(bones: readonly Object3D[], inverseBindMatrices?: Float32Array) {
        requireCount3D(bones.length, 'bones', MESH3D_LIMITS.maxBones);
        if (inverseBindMatrices && inverseBindMatrices.length !== bones.length * 16) throw new World3DError('WORLD3D_INPUT_INVALID', 'inverseBindMatrices');
        this.bones = Object.freeze([...bones]);
        this.boneMatrices = new Float32Array(bones.length * 16);
        if (inverseBindMatrices) this.inverseBindMatrices = inverseBindMatrices;
        else {
            // Without explicit data, the current pose becomes the bind pose.
            this.inverseBindMatrices = new Float32Array(bones.length * 16);
            bones.forEach((bone, index) => {
                bone.updateWorldMatrix();
                const view = this.inverseBindMatrices.subarray(index * 16, index * 16 + 16);
                if (!mat4Invert(view, bone.matrixWorld)) mat4Identity(view);
            });
        }
    }
    /** Recompute skinning matrices once per frame id; later calls in the same frame are free. */
    update(frame: number): void {
        if (frame === this.#lastFrame) return;
        this.#lastFrame = frame;
        const bones = this.bones, out = this.boneMatrices, inverse = this.inverseBindMatrices;
        for (let i = 0; i < bones.length; i++) {
            const o = i * 16;
            mat4Multiply(out.subarray(o, o + 16), bones[i]!.matrixWorld, inverse.subarray(o, o + 16));
        }
        this.version++;
    }
}

export class Mesh3D extends Object3D {
    geometry: Geometry3D;
    /** One material, or one per geometry group addressed by materialIndex. */
    material: Material3D | Material3D[];
    /** Weight per geometry morph target; resized automatically to the target count. */
    morphWeights: Float32Array = new Float32Array(0);
    skeleton: Skeleton3D | undefined;
    /** Mesh-space to skeleton-space matrix captured at bind time. */
    readonly bindMatrix = mat4Identity(new Float32Array(16)) as Float32Array;
    readonly #worldSphere = new Float32Array(4);
    #sphereKey = '';

    constructor(geometry: Geometry3D = new Geometry3D(), material: Material3D | Material3D[] = new Material3D('unlit')) {
        super('mesh');
        if (!(geometry instanceof Geometry3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry');
        const list = Array.isArray(material) ? material : [material];
        if (list.length === 0 || list.length > MESH3D_LIMITS.maxMaterials || !list.every(item => item instanceof Material3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'material');
        this.geometry = geometry;
        this.material = material;
        this.castShadow = true;
        this.syncMorphWeights();
    }
    get isInstanced(): boolean { return false; }
    /** Material for a geometry group index, falling back to the first slot. */
    materialAt(index: number): Material3D {
        return Array.isArray(this.material) ? (this.material[index] ?? this.material[0]!) : this.material;
    }
    /** Keep the weight array the same length as the geometry's morph target list. */
    syncMorphWeights(): void {
        const count = this.geometry.morphTargets.length;
        if (this.morphWeights.length !== count) {
            const next = new Float32Array(count);
            next.set(this.morphWeights.subarray(0, Math.min(count, this.morphWeights.length)));
            this.morphWeights = next;
        }
    }
    /** Attach a skeleton; the current world matrix becomes the bind matrix. */
    bind(skeleton: Skeleton3D, bindMatrix?: ArrayLike<number>): this {
        this.skeleton = skeleton;
        if (bindMatrix) mat4Copy(this.bindMatrix, bindMatrix);
        else { this.updateWorldMatrix(); mat4Copy(this.bindMatrix, this.matrixWorld); }
        return this;
    }
    /**
     * World-space bounding sphere [x, y, z, radius], cached per geometry and
     * world version. Skinned meshes are bounded by their bones instead.
     */
    get worldBoundingSphere(): Float32Array {
        if (this.skeleton) return this.skinnedBounds();
        const key = this.geometry.id + ':' + this.geometry.version + ':' + this.worldVersion;
        if (key !== this.#sphereKey) {
            sphereTransform(this.#worldSphere, this.geometry.boundingSphere, this.matrixWorld);
            this.#sphereKey = key;
        }
        return this.#worldSphere;
    }
    private skinnedBounds(): Float32Array {
        const box = box3Empty(new Float32Array(6));
        for (const bone of this.skeleton!.bones) box3ExpandByPoint(box, bone.matrixWorld[12]!, bone.matrixWorld[13]!, bone.matrixWorld[14]!);
        sphereFromBox(this.#worldSphere, box);
        // Pad by the rest-pose radius so skin extending beyond joints stays visible.
        const rest = this.geometry.boundingSphere[3]!;
        if (this.#worldSphere[3]! >= 0 && rest > 0) this.#worldSphere[3]! += rest * 0.5;
        return this.#worldSphere;
    }
    override clone(recursive = true): this {
        const copy = new Mesh3D(this.geometry, this.material) as this;
        copy.copyFrom(this);
        if (recursive) for (const child of this.children) copy.addChild(child.clone(true));
        return copy;
    }
    protected override copyFrom(source: this): void {
        super.copyFrom(source);
        this.morphWeights = source.morphWeights.slice();
        this.skeleton = source.skeleton;
        this.bindMatrix.set(source.bindMatrix);
    }
}

const scratchScale = new Float32Array(3);
/** Draw one geometry many times in a single call with per-instance transforms and colors. */
export class InstancedMesh3D extends Mesh3D {
    readonly capacity: number;
    /** Number of instances drawn; at most `capacity`. */
    count: number;
    /** 16 floats per instance, relative to this node. */
    readonly instanceMatrices: Float32Array;
    /** Optional linear RGB per instance, created on first setColorAt(). */
    instanceColors: Float32Array | undefined;
    /** Bump after editing instance arrays directly. */
    instanceVersion = 1;
    #boundsVersion = 0;
    readonly #instanceSphere = new Float32Array(4);

    constructor(geometry: Geometry3D, material: Material3D | Material3D[], capacity: number) {
        super(geometry, material);
        this.capacity = requireCount3D(capacity, 'capacity', MESH3D_LIMITS.maxInstances);
        this.count = this.capacity;
        this.instanceMatrices = new Float32Array(this.capacity * 16);
        for (let i = 0; i < this.capacity; i++) mat4Identity(this.instanceMatrices.subarray(i * 16, i * 16 + 16));
    }
    override get isInstanced(): boolean { return true; }
    setMatrixAt(index: number, matrix: ArrayLike<number>): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
        for (let i = 0; i < 16; i++) this.instanceMatrices[index * 16 + i] = matrix[i]!;
        this.instanceVersion++;
    }
    setTransformAt(index: number, position: ArrayLike<number>, quaternion: ArrayLike<number> = [0, 0, 0, 1], scale: ArrayLike<number> | number = 1): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
        const s = typeof scale === 'number' ? (scratchScale[0] = scratchScale[1] = scratchScale[2] = scale, scratchScale) : scale;
        mat4Compose(this.instanceMatrices.subarray(index * 16, index * 16 + 16), position, quaternion, s);
        this.instanceVersion++;
    }
    setColorAt(index: number, r: number, g: number, b: number): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
        const colors = this.instanceColors ??= new Float32Array(this.capacity * 3).fill(1);
        colors[index * 3] = r; colors[index * 3 + 1] = g; colors[index * 3 + 2] = b;
        this.instanceVersion++;
    }
    /** Sphere enclosing every instance, in world space. */
    override get worldBoundingSphere(): Float32Array {
        const sphere = this.#instanceSphere;
        if (this.#boundsVersion !== this.instanceVersion) {
            const base = this.geometry.boundingSphere, box = box3Empty(new Float32Array(6)), m = this.instanceMatrices;
            let radius = 0;
            for (let i = 0; i < this.count; i++) {
                const o = i * 16, x = base[0]!, y = base[1]!, z = base[2]!;
                box3ExpandByPoint(box, m[o]! * x + m[o + 4]! * y + m[o + 8]! * z + m[o + 12]!,
                    m[o + 1]! * x + m[o + 5]! * y + m[o + 9]! * z + m[o + 13]!, m[o + 2]! * x + m[o + 6]! * y + m[o + 10]! * z + m[o + 14]!);
                const scale = Math.sqrt(Math.max(m[o]! ** 2 + m[o + 1]! ** 2 + m[o + 2]! ** 2, m[o + 4]! ** 2 + m[o + 5]! ** 2 + m[o + 6]! ** 2, m[o + 8]! ** 2 + m[o + 9]! ** 2 + m[o + 10]! ** 2));
                radius = Math.max(radius, base[3]! * scale);
            }
            sphereFromBox(this.localSphere, box);
            if (this.localSphere[3]! >= 0) this.localSphere[3]! += radius;
            this.#boundsVersion = this.instanceVersion;
        }
        return sphereTransform(sphere, this.localSphere, this.matrixWorld) as Float32Array;
    }
    private readonly localSphere = new Float32Array(4);
    override clone(): this {
        const copy = new InstancedMesh3D(this.geometry, this.material, this.capacity) as this;
        copy.copyFrom(this);
        copy.count = this.count;
        copy.instanceMatrices.set(this.instanceMatrices);
        if (this.instanceColors) copy.instanceColors = this.instanceColors.slice();
        return copy;
    }
}

let sharedQuad: Geometry3D | undefined;
/** Camera-facing textured quad. Scale the node to size it; all sprites share one quad geometry. */
export class Sprite3D extends Mesh3D {
    constructor(material: Material3D = createSpriteMaterial3D()) {
        super(sharedQuad ??= createQuadGeometry3D(), material);
        this.castShadow = false;
        this.receiveShadow = false;
    }
    override get worldBoundingSphere(): Float32Array {
        // A billboard may rotate to any orientation: bound it by its diagonal.
        const sphere = super.worldBoundingSphere;
        return sphere;
    }
    override clone(): this {
        const copy = new Sprite3D(this.material as Material3D) as this;
        copy.copyFrom(this);
        return copy;
    }
}
export function createSprite3D(options: SpriteMaterialOptions3D = {}): Sprite3D {
    return new Sprite3D(createSpriteMaterial3D(options));
}
