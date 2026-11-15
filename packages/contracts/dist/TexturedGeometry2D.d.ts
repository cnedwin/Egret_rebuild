declare const texturedGeometry2DBrand: unique symbol;
export type TexturedFloatArray2D = Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
export type TexturedIndexArray2D = Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
export interface TexturedGeometry2DInput {
    readonly positions: TexturedFloatArray2D;
    readonly uvs: TexturedFloatArray2D;
    readonly lightColors: TexturedFloatArray2D;
    readonly indices: TexturedIndexArray2D;
}
/** Immutable CPU geometry identity; the brand grants no asset or GPU authority. */
export interface TexturedGeometry2D {
    readonly [texturedGeometry2DBrand]: true;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly triangleCount: number;
    readonly logicalByteLength: number;
    readonly positions: readonly number[];
    readonly uvs: readonly number[];
    readonly lightColors: readonly number[];
    readonly indices: readonly number[];
}
export declare function createTexturedGeometry2D(input: TexturedGeometry2DInput): TexturedGeometry2D;
export declare function isTexturedGeometry2D(value: unknown): value is TexturedGeometry2D;
export {};
//# sourceMappingURL=TexturedGeometry2D.d.ts.map