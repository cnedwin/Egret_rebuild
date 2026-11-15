import type { GltfDracoRequest3D, GltfDracoResult3D } from './Gltf3D.js';
import type { Ktx2Info3D, Ktx2Result3D } from './Ktx23D.js';
import type { CompressedFormat3D } from './Texture3D.js';
type Opaque = Record<string, unknown>;
/** The parts of an initialized Draco decoder module (`await DracoDecoderModule()`) this adapter calls. */
export interface DracoModule3D {
    readonly Decoder: new () => Opaque;
    readonly DecoderBuffer: new () => Opaque;
    readonly Mesh: new () => Opaque;
    readonly TRIANGULAR_MESH: number;
    readonly DT_INT8: number;
    readonly DT_UINT8: number;
    readonly DT_INT16: number;
    readonly DT_UINT16: number;
    readonly DT_INT32: number;
    readonly DT_UINT32: number;
    readonly DT_FLOAT32: number;
    readonly HEAPU8: Uint8Array;
    _malloc(bytes: number): number;
    _free(pointer: number): void;
    destroy(object: Opaque): void;
}
/**
 * Turn an initialized Draco decoder module into the `decodeDraco` option of
 * the glTF loader. Only triangle meshes are decoded, as the glTF extension
 * requires.
 */
export declare function createDracoDecoder3D(draco: DracoModule3D): (request: GltfDracoRequest3D) => GltfDracoResult3D;
/** The parts of an initialized Basis Universal transcoder module (`await BASIS()`) this adapter calls. */
export interface BasisModule3D {
    initializeBasis(): void;
    readonly KTX2File: new (data: Uint8Array) => Opaque;
}
/**
 * Turn an initialized Basis Universal transcoder module into the
 * `transcodeKtx2` option. `supports` reports which compressed formats the
 * device can sample (pass `format => renderer.supportsCompressedFormat(format)`);
 * the best available one is chosen, with plain RGBA as the fallback.
 */
export declare function createBasisTranscoder3D(basis: BasisModule3D, supports: (format: CompressedFormat3D) => boolean): (info: Ktx2Info3D) => Ktx2Result3D;
export {};
//# sourceMappingURL=decoders3D.d.ts.map