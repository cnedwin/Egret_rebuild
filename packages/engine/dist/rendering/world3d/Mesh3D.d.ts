import { Geometry3D } from './Geometry3D.js';
import { Material3D } from './Material3D.js';
import type { SpriteMaterialOptions3D } from './Material3D.js';
import { Object3D } from './Object3D.js';
export declare const MESH3D_LIMITS: Readonly<{
    readonly maxBones: 1024;
    readonly maxInstances: 1048576;
    readonly maxMaterials: 64;
}>;
export declare class Bone3D extends Object3D {
    constructor();
}
/** Ordered bones with their inverse bind matrices; one instance may drive many meshes. */
export declare class Skeleton3D {
    #private;
    readonly bones: readonly Object3D[];
    /** 16 floats per bone: bind-pose mesh space to bone space. */
    readonly inverseBindMatrices: Float32Array;
    /** 16 floats per bone: boneWorld * inverseBind, refreshed by update(). */
    readonly boneMatrices: Float32Array;
    /** Increases on every update(); backends compare it before re-uploading. */
    version: number;
    constructor(bones: readonly Object3D[], inverseBindMatrices?: Float32Array);
    /** Recompute skinning matrices once per frame id; later calls in the same frame are free. */
    update(frame: number): void;
}
export declare class Mesh3D extends Object3D {
    #private;
    /** Optional hook the render list calls once per frame before the mesh is culled and sorted. */
    beforeRender?(camera: import('./Camera3D.js').Camera3D): void;
    geometry: Geometry3D;
    /** false leaves the mesh out of ray picking, as for effects whose drawn shape is not their geometry. */
    pickable: boolean;
    /** One material, or one per geometry group addressed by materialIndex. */
    material: Material3D | Material3D[];
    /** Weight per geometry morph target; resized automatically to the target count. */
    morphWeights: Float32Array;
    skeleton: Skeleton3D | undefined;
    /** Mesh-space to skeleton-space matrix captured at bind time. */
    readonly bindMatrix: Float32Array;
    constructor(geometry?: Geometry3D, material?: Material3D | Material3D[]);
    get isInstanced(): boolean;
    /**
     * True when an instanced draw could stand in for this mesh: it is a plain
     * Mesh3D without skinning or morphing, and its transform is not mirrored.
     * The renderer uses it to fold repeated meshes into one draw.
     */
    get canInstance(): boolean;
    /** Material for a geometry group index, falling back to the first slot. */
    materialAt(index: number): Material3D;
    /** Keep the weight array the same length as the geometry's morph target list. */
    syncMorphWeights(): void;
    /** Attach a skeleton; the current world matrix becomes the bind matrix. */
    bind(skeleton: Skeleton3D, bindMatrix?: ArrayLike<number>): this;
    /**
     * World-space bounding sphere [x, y, z, radius], cached per geometry and
     * world version. Skinned meshes are bounded by their bones instead.
     */
    get worldBoundingSphere(): Float32Array;
    private skinnedBounds;
    clone(recursive?: boolean): this;
    protected copyFrom(source: this): void;
}
/** Draw one geometry many times in a single call with per-instance transforms and colors. */
export declare class InstancedMesh3D extends Mesh3D {
    #private;
    readonly capacity: number;
    /** Number of instances drawn; at most `capacity`. */
    count: number;
    /** 16 floats per instance, relative to this node. */
    readonly instanceMatrices: Float32Array;
    /** Optional linear RGB (or RGBA) per instance, created on first setColorAt(). */
    instanceColors: Float32Array | undefined;
    /** Components per instance color: 3 for RGB, 4 when instances also carry opacity. */
    readonly instanceColorSize: 3 | 4;
    /** Bump after editing instance arrays directly. */
    instanceVersion: number;
    /** Multiplies each instance's bounding radius, for instances that move beyond the geometry, such as animated ones. */
    boundsScale: number;
    constructor(geometry: Geometry3D, material: Material3D | Material3D[], capacity: number, instanceColorSize?: 3 | 4);
    get isInstanced(): boolean;
    setMatrixAt(index: number, matrix: ArrayLike<number>): void;
    setTransformAt(index: number, position: ArrayLike<number>, quaternion?: ArrayLike<number>, scale?: ArrayLike<number> | number): void;
    setColorAt(index: number, r: number, g: number, b: number, a?: number): void;
    /** Sphere enclosing every instance, in world space. */
    get worldBoundingSphere(): Float32Array;
    private readonly localSphere;
    clone(): this;
}
/** Camera-facing textured quad. Scale the node to size it; all sprites share one quad geometry. */
export declare class Sprite3D extends Mesh3D {
    constructor(material?: Material3D);
    get worldBoundingSphere(): Float32Array;
    clone(): this;
}
export declare function createSprite3D(options?: SpriteMaterialOptions3D): Sprite3D;
//# sourceMappingURL=Mesh3D.d.ts.map