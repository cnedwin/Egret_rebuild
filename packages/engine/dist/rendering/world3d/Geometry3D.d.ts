import { Resource3D } from './core3D.js';
export type AttributeArray3D = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array | Int8Array;
export type Topology3D = 'triangles' | 'lines' | 'line-strip' | 'points';
export declare const GEOMETRY3D_LIMITS: Readonly<{
    readonly maxVertices: 4194304;
    readonly maxIndices: 12582912;
    readonly maxMorphTargets: 256;
    readonly maxGroups: 1024;
}>;
/** Well-known attribute names understood by the built-in materials. */
export declare const ATTRIBUTE_3D: Readonly<{
    readonly position: 'position';
    readonly normal: 'normal';
    readonly tangent: 'tangent';
    readonly uv: 'uv';
    readonly uv1: 'uv1';
    readonly color: 'color';
    readonly joints: 'joints';
    readonly weights: 'weights';
}>;
export declare class Attribute3D {
    #private;
    readonly data: AttributeArray3D;
    readonly itemSize: number;
    /** Integer data is mapped to [0, 1] or [-1, 1] when sampled as float. */
    readonly normalized: boolean;
    /** Hint that data changes often, so the backend picks a streaming buffer. */
    dynamic: boolean;
    constructor(data: AttributeArray3D, itemSize: number, normalized?: boolean);
    get count(): number;
    get version(): number;
    touch(): void;
}
export interface GeometryGroup3D {
    readonly start: number;
    readonly count: number;
    readonly materialIndex: number;
}
export interface MorphTarget3D {
    readonly name: string;
    /** Per-vertex deltas relative to the base attribute. */
    readonly position?: Float32Array;
    readonly normal?: Float32Array;
}
export declare class Geometry3D extends Resource3D {
    #private;
    topology: Topology3D;
    get attributes(): ReadonlyMap<string, Attribute3D>;
    get index(): Attribute3D | undefined;
    get groups(): readonly GeometryGroup3D[];
    get morphTargets(): readonly MorphTarget3D[];
    get layoutVersion(): number;
    get vertexCount(): number;
    /** Number of indices, or vertices when the geometry is not indexed. */
    get drawCount(): number;
    setAttribute(name: string, attribute: Attribute3D): this;
    getAttribute(name: string): Attribute3D | undefined;
    removeAttribute(name: string): this;
    setIndex(index: Uint16Array | Uint32Array | readonly number[] | undefined): this;
    /** Assign a material slot to an index (or vertex) range. */
    addGroup(start: number, count: number, materialIndex?: number): this;
    clearGroups(): this;
    setMorphTargets(targets: readonly MorphTarget3D[]): this;
    /** Local-space [minX, minY, minZ, maxX, maxY, maxZ], cached until positions change. */
    get boundingBox(): Float32Array;
    /** Local-space [x, y, z, radius]; radius is negative for an empty geometry. */
    get boundingSphere(): Float32Array;
    /** Call after editing position data in place. */
    invalidateBounds(): void;
    /** Area-weighted smooth normals for triangle geometry. */
    computeNormals(): this;
    /** Per-vertex tangents (xyz + handedness) from positions, normals and UVs. */
    computeTangents(): this;
}
export interface GeometryInput3D {
    readonly positions: ArrayLike<number>;
    readonly normals?: ArrayLike<number>;
    readonly uvs?: ArrayLike<number>;
    readonly colors?: ArrayLike<number>;
    readonly indices?: ArrayLike<number>;
    readonly topology?: Topology3D;
}
/** Build a geometry from plain arrays; missing normals are computed for triangles. */
export declare function createGeometry3D(input: GeometryInput3D): Geometry3D;
//# sourceMappingURL=Geometry3D.d.ts.map