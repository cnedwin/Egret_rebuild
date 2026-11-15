export type MeshoptMode3D = 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES';
export type MeshoptFilter3D = 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL';
export declare const MESHOPT3D_LIMITS: Readonly<{
    readonly maxStride: 256;
    readonly maxElements: 268435456;
}>;
/**
 * Decode one EXT_meshopt_compression buffer view. `count` elements of
 * `stride` bytes are returned; for the two index modes the stride is 2 or 4.
 */
export declare function decodeMeshopt3D(source: Uint8Array, count: number, stride: number, mode: MeshoptMode3D, filter?: MeshoptFilter3D): Uint8Array;
//# sourceMappingURL=Meshopt3D.d.ts.map