import type { Attribute3D, Geometry3D, MorphTarget3D } from '../../rendering/world3d/Geometry3D.js';
import type { Mesh3D } from '../../rendering/world3d/Mesh3D.js';
export declare function convertVertexAttribute3D(name: string, attribute: Attribute3D): Float32Array | Uint32Array;
export declare function packMorphStorage3D(targets: readonly MorphTarget3D[], channels: number, vertexCount: number): Float32Array;
export declare function packWireIndices3D(geometry: Geometry3D): Uint32Array;
/** The renderer calls this only when its geometry has a morph storage buffer. */
export declare function writeObjectMorph3D(mesh: Mesh3D, gpu: {
    readonly morph: {
        readonly vertexCount: number;
        readonly channels: number;
    } | undefined;
}, floats: Float32Array, ints: Int32Array, o: number): void;
//# sourceMappingURL=webgpuPacking3D.d.ts.map