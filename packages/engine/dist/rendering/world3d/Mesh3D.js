// SPDX-License-Identifier: Apache-2.0
// Renderable nodes: meshes with optional skinning, morphing and instancing,
// plus bones, skeletons and camera-facing sprites.
import { World3DError, requireCount3D } from './core3D.js';
import { Geometry3D } from './Geometry3D.js';
import { Material3D, createSpriteMaterial3D } from './Material3D.js';
import { box3Empty, box3ExpandByPoint, mat4Compose, mat4Copy, mat4Identity, mat4Invert, mat4Multiply, sphereFromBox, sphereTransform } from './math3D.js';
import { Object3D } from './Object3D.js';
import { createQuadGeometry3D } from './primitives3D.js';
export const MESH3D_LIMITS = Object.freeze({ maxBones: 1024, maxInstances: 1048576, maxMaterials: 64 });
export class Bone3D extends Object3D {
    constructor() {
        super('bone');
    }
}
/** Ordered bones with their inverse bind matrices; one instance may drive many meshes. */
export class Skeleton3D {
    bones;
    /** 16 floats per bone: bind-pose mesh space to bone space. */
    inverseBindMatrices;
    /** 16 floats per bone: boneWorld * inverseBind, refreshed by update(). */
    boneMatrices;
    /** Increases on every update(); backends compare it before re-uploading. */
    version = 0;
    #lastFrame = -1;
    constructor(bones, inverseBindMatrices) {
        requireCount3D(bones.length, 'bones', MESH3D_LIMITS.maxBones);
        if (inverseBindMatrices && inverseBindMatrices.length !== bones.length * 16)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'inverseBindMatrices');
        this.bones = Object.freeze([...bones]);
        this.boneMatrices = new Float32Array(bones.length * 16);
        if (inverseBindMatrices)
            this.inverseBindMatrices = inverseBindMatrices;
        else {
            // Without explicit data, the current pose becomes the bind pose.
            this.inverseBindMatrices = new Float32Array(bones.length * 16);
            bones.forEach((bone, index) => {
                bone.updateWorldMatrix();
                const view = this.inverseBindMatrices.subarray(index * 16, index * 16 + 16);
                if (!mat4Invert(view, bone.matrixWorld))
                    mat4Identity(view);
            });
        }
    }
    /** Recompute skinning matrices once per frame id; later calls in the same frame are free. */
    update(frame) {
        if (frame === this.#lastFrame)
            return;
        this.#lastFrame = frame;
        const bones = this.bones, out = this.boneMatrices, inverse = this.inverseBindMatrices;
        // Written out in place: a view per bone per frame would be thousands of short-lived objects.
        for (let i = 0; i < bones.length; i++) {
            const o = i * 16, a = bones[i].matrixWorld;
            const a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[4], a11 = a[5], a12 = a[6], a20 = a[8], a21 = a[9], a22 = a[10], a30 = a[12], a31 = a[13], a32 = a[14];
            for (let column = 0; column < 4; column++) {
                const c = o + column * 4, b0 = inverse[c], b1 = inverse[c + 1], b2 = inverse[c + 2], b3 = inverse[c + 3];
                out[c] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
                out[c + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
                out[c + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
                // Bone and bind matrices are affine, so the last row stays 0 0 0 1.
                out[c + 3] = b3;
            }
        }
        this.version++;
    }
}
export class Mesh3D extends Object3D {
    geometry;
    /** false leaves the mesh out of ray picking, as for effects whose drawn shape is not their geometry. */
    pickable = true;
    /** One material, or one per geometry group addressed by materialIndex. */
    material;
    /** Weight per geometry morph target; resized automatically to the target count. */
    morphWeights = new Float32Array(0);
    skeleton;
    /** Mesh-space to skeleton-space matrix captured at bind time. */
    bindMatrix = mat4Identity(new Float32Array(16));
    #worldSphere = new Float32Array(4);
    #sphereGeometry;
    // Whether this is exactly a Mesh3D, and whether its transform keeps the winding: asked for every mesh on every frame.
    #exact = false;
    #windingWorld = -1;
    #winding = true;
    #sphereVersion = -1;
    #sphereWorld = -1;
    constructor(geometry = new Geometry3D(), material = new Material3D('unlit')) {
        super('mesh');
        this.#exact = new.target === Mesh3D;
        if (!(geometry instanceof Geometry3D))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry');
        const list = Array.isArray(material) ? material : [material];
        if (list.length === 0 ||
            list.length > MESH3D_LIMITS.maxMaterials ||
            !list.every(item => item instanceof Material3D))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'material');
        this.geometry = geometry;
        this.material = material;
        this.castShadow = true;
        this.syncMorphWeights();
    }
    get isInstanced() {
        return false;
    }
    /**
     * True when an instanced draw could stand in for this mesh: it is a plain
     * Mesh3D without skinning or morphing, and its transform is not mirrored.
     * The renderer uses it to fold repeated meshes into one draw.
     */
    get canInstance() {
        if (!this.#exact || this.skeleton !== undefined || this.geometry.morphTargets.length > 0)
            return false;
        const version = this.worldVersion;
        if (version !== this.#windingWorld) {
            const m = this.matrixWorld;
            this.#winding =
                m[0] * (m[5] * m[10] - m[6] * m[9]) -
                    m[4] * (m[1] * m[10] - m[2] * m[9]) +
                    m[8] * (m[1] * m[6] - m[2] * m[5]) >
                    0;
            this.#windingWorld = version;
        }
        return this.#winding;
    }
    /** Material for a geometry group index, falling back to the first slot. */
    materialAt(index) {
        return Array.isArray(this.material) ? (this.material[index] ?? this.material[0]) : this.material;
    }
    /** Keep the weight array the same length as the geometry's morph target list. */
    syncMorphWeights() {
        const count = this.geometry.morphTargets.length;
        if (this.morphWeights.length !== count) {
            const next = new Float32Array(count);
            next.set(this.morphWeights.subarray(0, Math.min(count, this.morphWeights.length)));
            this.morphWeights = next;
        }
    }
    /** Attach a skeleton; the current world matrix becomes the bind matrix. */
    bind(skeleton, bindMatrix) {
        this.skeleton = skeleton;
        if (bindMatrix)
            mat4Copy(this.bindMatrix, bindMatrix);
        else {
            this.updateWorldMatrix();
            mat4Copy(this.bindMatrix, this.matrixWorld);
        }
        return this;
    }
    /**
     * World-space bounding sphere [x, y, z, radius], cached per geometry and
     * world version. Skinned meshes are bounded by their bones instead.
     */
    get worldBoundingSphere() {
        if (this.skeleton)
            return this.skinnedBounds();
        // Compared as numbers: this runs for every mesh on every frame.
        const geometry = this.geometry, version = geometry.version, world = this.worldVersion;
        if (geometry !== this.#sphereGeometry || version !== this.#sphereVersion || world !== this.#sphereWorld) {
            sphereTransform(this.#worldSphere, geometry.boundingSphere, this.matrixWorld);
            this.#sphereGeometry = geometry;
            this.#sphereVersion = version;
            this.#sphereWorld = world;
        }
        return this.#worldSphere;
    }
    skinnedBounds() {
        const box = box3Empty(new Float32Array(6));
        for (const bone of this.skeleton.bones)
            box3ExpandByPoint(box, bone.matrixWorld[12], bone.matrixWorld[13], bone.matrixWorld[14]);
        sphereFromBox(this.#worldSphere, box);
        // Pad by the rest-pose radius so skin extending beyond joints stays visible.
        const rest = this.geometry.boundingSphere[3];
        if (this.#worldSphere[3] >= 0 && rest > 0)
            this.#worldSphere[3] += rest * 0.5;
        return this.#worldSphere;
    }
    clone(recursive = true) {
        const copy = new Mesh3D(this.geometry, this.material);
        copy.copyFrom(this);
        if (recursive)
            for (const child of this.children)
                copy.addChild(child.clone(true));
        return copy;
    }
    copyFrom(source) {
        super.copyFrom(source);
        this.morphWeights = source.morphWeights.slice();
        this.skeleton = source.skeleton;
        this.bindMatrix.set(source.bindMatrix);
    }
}
const scratchScale = new Float32Array(3);
/** Draw one geometry many times in a single call with per-instance transforms and colors. */
export class InstancedMesh3D extends Mesh3D {
    capacity;
    /** Number of instances drawn; at most `capacity`. */
    count;
    /** 16 floats per instance, relative to this node. */
    instanceMatrices;
    /** Optional linear RGB (or RGBA) per instance, created on first setColorAt(). */
    instanceColors;
    /** Components per instance color: 3 for RGB, 4 when instances also carry opacity. */
    instanceColorSize;
    /** Bump after editing instance arrays directly. */
    instanceVersion = 1;
    /** Multiplies each instance's bounding radius, for instances that move beyond the geometry, such as animated ones. */
    boundsScale = 1;
    #boundsVersion = 0;
    #instanceSphere = new Float32Array(4);
    constructor(geometry, material, capacity, instanceColorSize = 3) {
        super(geometry, material);
        if (instanceColorSize !== 3 && instanceColorSize !== 4)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'instanceColorSize');
        this.instanceColorSize = instanceColorSize;
        this.capacity = requireCount3D(capacity, 'capacity', MESH3D_LIMITS.maxInstances);
        this.count = this.capacity;
        this.instanceMatrices = new Float32Array(this.capacity * 16);
        for (let i = 0; i < this.capacity; i++)
            mat4Identity(this.instanceMatrices.subarray(i * 16, i * 16 + 16));
    }
    get isInstanced() {
        return true;
    }
    setMatrixAt(index, matrix) {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
        for (let i = 0; i < 16; i++)
            this.instanceMatrices[index * 16 + i] = matrix[i];
        this.instanceVersion++;
    }
    setTransformAt(index, position, quaternion = [0, 0, 0, 1], scale = 1) {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
        const s = typeof scale === 'number' ? ((scratchScale[0] = scratchScale[1] = scratchScale[2] = scale), scratchScale) : scale;
        mat4Compose(this.instanceMatrices.subarray(index * 16, index * 16 + 16), position, quaternion, s);
        this.instanceVersion++;
    }
    setColorAt(index, r, g, b, a = 1) {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
        const size = this.instanceColorSize, colors = (this.instanceColors ??= new Float32Array(this.capacity * size).fill(1));
        colors[index * size] = r;
        colors[index * size + 1] = g;
        colors[index * size + 2] = b;
        if (size === 4)
            colors[index * size + 3] = a;
        this.instanceVersion++;
    }
    /** Sphere enclosing every instance, in world space. */
    get worldBoundingSphere() {
        const sphere = this.#instanceSphere;
        if (this.#boundsVersion !== this.instanceVersion) {
            const base = this.geometry.boundingSphere, box = box3Empty(new Float32Array(6)), m = this.instanceMatrices;
            let radius = 0;
            for (let i = 0; i < this.count; i++) {
                const o = i * 16, x = base[0], y = base[1], z = base[2];
                box3ExpandByPoint(box, m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12], m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13], m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14]);
                const scale = Math.sqrt(Math.max(m[o] ** 2 + m[o + 1] ** 2 + m[o + 2] ** 2, m[o + 4] ** 2 + m[o + 5] ** 2 + m[o + 6] ** 2, m[o + 8] ** 2 + m[o + 9] ** 2 + m[o + 10] ** 2));
                radius = Math.max(radius, base[3] * scale * this.boundsScale);
            }
            sphereFromBox(this.localSphere, box);
            if (this.localSphere[3] >= 0)
                this.localSphere[3] += radius;
            this.#boundsVersion = this.instanceVersion;
        }
        return sphereTransform(sphere, this.localSphere, this.matrixWorld);
    }
    localSphere = new Float32Array(4);
    clone() {
        const copy = new InstancedMesh3D(this.geometry, this.material, this.capacity, this.instanceColorSize);
        copy.copyFrom(this);
        copy.count = this.count;
        copy.instanceMatrices.set(this.instanceMatrices);
        if (this.instanceColors)
            copy.instanceColors = this.instanceColors.slice();
        return copy;
    }
}
let sharedQuad;
/** Camera-facing textured quad. Scale the node to size it; all sprites share one quad geometry. */
export class Sprite3D extends Mesh3D {
    constructor(material = createSpriteMaterial3D()) {
        super((sharedQuad ??= createQuadGeometry3D()), material);
        this.castShadow = false;
        this.receiveShadow = false;
    }
    get worldBoundingSphere() {
        // A billboard may rotate to any orientation: bound it by its diagonal.
        const sphere = super.worldBoundingSphere;
        return sphere;
    }
    clone() {
        const copy = new Sprite3D(this.material);
        copy.copyFrom(this);
        return copy;
    }
}
export function createSprite3D(options = {}) {
    return new Sprite3D(createSpriteMaterial3D(options));
}
//# sourceMappingURL=Mesh3D.js.map