export declare const COMPRESSION3D_LIMITS: Readonly<{
    readonly maxOutputBytes: 536870912;
}>;
/**
 * Decompress a zlib stream, or a bare deflate stream when `raw` is set.
 * `sizeHint` is the expected output length when known.
 */
export declare function inflate3D(source: Uint8Array, options?: {
    readonly raw?: boolean;
    readonly sizeHint?: number;
    readonly maxBytes?: number;
}): Uint8Array;
/**
 * Decompress Zstandard data: one or more frames, including skippable ones.
 * Frames that need a dictionary are refused.
 */
export declare function decompressZstd3D(source: Uint8Array, options?: {
    readonly sizeHint?: number;
    readonly maxBytes?: number;
}): Uint8Array;
//# sourceMappingURL=Compression3D.d.ts.map