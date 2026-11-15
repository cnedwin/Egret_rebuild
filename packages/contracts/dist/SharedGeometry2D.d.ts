declare const sharedGeometry2DBrand: unique symbol;
export type SharedFloatArray2D = Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
export type SharedIndexArray2D = Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
export interface SharedGeometryInput2D {
    readonly positions: SharedFloatArray2D;
    readonly uvs: SharedFloatArray2D;
    readonly lightColors: SharedFloatArray2D;
    readonly darkColors: SharedFloatArray2D;
    readonly indices: SharedIndexArray2D;
}
/** Immutable CPU geometry identity; the brand grants no asset or GPU authority. */
export interface SharedGeometry2D {
    readonly [sharedGeometry2DBrand]: true;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly triangleCount: number;
    readonly logicalByteLength: number;
    readonly positions: readonly number[];
    readonly uvs: readonly number[];
    readonly lightColors: readonly number[];
    readonly darkColors: readonly number[];
    readonly indices: readonly number[];
}
export declare function createSharedGeometry2D(input: SharedGeometryInput2D): SharedGeometry2D;
export declare function isSharedGeometry2D(value: unknown): value is SharedGeometry2D;
export {};
//# sourceMappingURL=SharedGeometry2D.d.ts.map