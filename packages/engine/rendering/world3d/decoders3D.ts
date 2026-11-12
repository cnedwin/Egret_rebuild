// SPDX-License-Identifier: Apache-2.0
// Adapters for the two official WebAssembly decoders the engine does not
// reimplement: Google's Draco mesh decoder and the Basis Universal texture
// transcoder. The application loads the decoder module itself (the engine
// ships neither) and passes it here; the result plugs into `decodeDraco` and
// `transcodeKtx2`. Nothing in this file touches the DOM.
import {World3DError} from './core3D.js';
import type {GltfDracoRequest3D, GltfDracoResult3D} from './Gltf3D.js';
import type {Ktx2Info3D, Ktx2Result3D} from './Ktx23D.js';
import type {CompressedFormat3D} from './Texture3D.js';

type Opaque = Record<string, unknown>;
/** The parts of an initialized Draco decoder module (`await DracoDecoderModule()`) this adapter calls. */
export interface DracoModule3D {
    readonly Decoder: new () => Opaque;
    readonly DecoderBuffer: new () => Opaque;
    readonly Mesh: new () => Opaque;
    readonly TRIANGULAR_MESH: number;
    readonly DT_INT8: number; readonly DT_UINT8: number; readonly DT_INT16: number; readonly DT_UINT16: number;
    readonly DT_INT32: number; readonly DT_UINT32: number; readonly DT_FLOAT32: number;
    readonly HEAPU8: Uint8Array;
    _malloc(bytes: number): number;
    _free(pointer: number): void;
    destroy(object: Opaque): void;
}
type AnyCall = (...args: unknown[]) => unknown;
const call = (object: Opaque, name: string, ...args: unknown[]): unknown => {
    const method = object[name];
    if (typeof method !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'decoder module has no ' + name);
    return (method as AnyCall).apply(object, args);
};
type DracoArray = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array | Int8Array;
type DracoArrayType = {new (buffer: ArrayBufferLike, byteOffset: number, length: number): DracoArray; readonly BYTES_PER_ELEMENT: number};

/**
 * Turn an initialized Draco decoder module into the `decodeDraco` option of
 * the glTF loader. Only triangle meshes are decoded, as the glTF extension
 * requires.
 */
export function createDracoDecoder3D(draco: DracoModule3D): (request: GltfDracoRequest3D) => GltfDracoResult3D {
    if (!draco || typeof draco.Decoder !== 'function' || typeof draco._malloc !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'Draco decoder module');
    const types: Record<number, [DracoArrayType, number]> = {
        5120: [Int8Array, draco.DT_INT8], 5121: [Uint8Array, draco.DT_UINT8], 5122: [Int16Array, draco.DT_INT16],
        5123: [Uint16Array, draco.DT_UINT16], 5125: [Uint32Array, draco.DT_UINT32], 5126: [Float32Array, draco.DT_FLOAT32],
    };
    return (request) => {
        const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), mesh = new draco.Mesh();
        let pointer = 0;
        try {
            call(buffer, 'Init', request.bytes, request.bytes.byteLength);
            if (call(decoder, 'GetEncodedGeometryType', buffer) !== draco.TRIANGULAR_MESH) throw new World3DError('WORLD3D_GLTF_INVALID', 'Draco data is not a triangle mesh');
            const status = call(decoder, 'DecodeBufferToMesh', buffer, mesh) as Opaque;
            if (!call(status, 'ok')) throw new World3DError('WORLD3D_GLTF_INVALID', 'Draco decoding failed: ' + String(call(status, 'error_msg')));
            const points = call(mesh, 'num_points') as number, faces = call(mesh, 'num_faces') as number;
            // The module writes into its own memory; each array is copied out before the memory is released.
            const read = (Type: DracoArrayType, length: number, fill: (bytes: number, at: number) => unknown): DracoArray => {
                const bytes = length * Type.BYTES_PER_ELEMENT;
                pointer = draco._malloc(bytes);
                if (fill(bytes, pointer) === false) throw new World3DError('WORLD3D_GLTF_INVALID', 'Draco attribute could not be read');
                const copy = new Type(draco.HEAPU8.buffer, pointer, length).slice();
                draco._free(pointer); pointer = 0;
                return copy;
            };
            const attributes: Record<string, DracoArray> = {};
            for (const [semantic, id] of Object.entries(request.attributes)) {
                const attribute = call(decoder, 'GetAttributeByUniqueId', mesh, id) as Opaque, entry = types[request.componentTypes[semantic] ?? 5126];
                if (!attribute || !entry) throw new World3DError('WORLD3D_GLTF_INVALID', 'Draco attribute ' + semantic);
                const components = call(attribute, 'num_components') as number;
                attributes[semantic] = read(entry[0], points * components, (bytes, at) => call(decoder, 'GetAttributeDataArrayForAllPoints', mesh, attribute, entry[1], bytes, at));
            }
            const wide = read(Uint32Array, faces * 3, (bytes, at) => call(decoder, 'GetTrianglesUInt32Array', mesh, bytes, at)) as Uint32Array;
            // Index arrays are handed back in the width the accessor declares.
            const indices = request.indexComponentType === 5123 ? Uint16Array.from(wide) : wide;
            return request.indexComponentType === undefined ? {attributes} : {attributes, indices};
        } finally {
            if (pointer) draco._free(pointer);
            draco.destroy(mesh); draco.destroy(buffer); draco.destroy(decoder);
        }
    };
}

/** The parts of an initialized Basis Universal transcoder module (`await BASIS()`) this adapter calls. */
export interface BasisModule3D {
    initializeBasis(): void;
    readonly KTX2File: new (data: Uint8Array) => Opaque;
}
// Target numbers of the transcoder, which are fixed by its public interface.
const BASIS_TARGETS: Readonly<Record<CompressedFormat3D | 'rgba8', number>> = Object.freeze({'etc2-rgba8': 1, bc1: 2, bc3: 3, bc7: 6, 'astc-4x4': 10, rgba8: 13, 'etc2-rgb8': 0});

/**
 * Turn an initialized Basis Universal transcoder module into the
 * `transcodeKtx2` option. `supports` reports which compressed formats the
 * device can sample (pass `format => renderer.supportsCompressedFormat(format)`);
 * the best available one is chosen, with plain RGBA as the fallback.
 */
export function createBasisTranscoder3D(basis: BasisModule3D, supports: (format: CompressedFormat3D) => boolean): (info: Ktx2Info3D) => Ktx2Result3D {
    if (!basis || typeof basis.KTX2File !== 'function' || typeof supports !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'Basis transcoder module');
    let ready = false;
    return (info) => {
        if (!ready) { basis.initializeBasis(); ready = true; }
        const file = new basis.KTX2File(info.file);
        try {
            if (!call(file, 'isValid')) throw new World3DError('WORLD3D_INPUT_INVALID', 'ktx2: the transcoder rejected the file');
            const alpha = call(file, 'getHasAlpha') === true || call(file, 'getHasAlpha') === 1, uastc = call(file, 'isUASTC') === true || call(file, 'isUASTC') === 1;
            // High-quality UASTC maps best onto ASTC and BC7; ETC1S is cheapest to turn into ETC.
            const opaqueEtc: CompressedFormat3D = 'etc2-rgb8', order: CompressedFormat3D[] = uastc
                ? ['astc-4x4', 'bc7', alpha ? 'etc2-rgba8' : opaqueEtc, alpha ? 'bc3' : 'bc1']
                : [alpha ? 'etc2-rgba8' : opaqueEtc, 'bc7', 'astc-4x4', alpha ? 'bc3' : 'bc1'];
            const format = order.find(candidate => supports(candidate)), target = BASIS_TARGETS[format ?? 'rgba8'];
            if (!call(file, 'startTranscoding')) throw new World3DError('WORLD3D_INPUT_INVALID', 'ktx2: transcoding could not start');
            // The transfer function byte of the data format descriptor says whether colors are sRGB.
            const view = new DataView(info.file.buffer, info.file.byteOffset, info.file.byteLength), descriptor = view.getUint32(48, true);
            const colorSpace = descriptor > 0 && descriptor + 15 <= info.file.byteLength && info.file[descriptor + 14] === 2 ? 'srgb' : 'linear';
            const levels: Uint8Array[] = [];
            for (let level = 0; level < (format ? info.levelCount : 1); level++) {
                const size = call(file, 'getImageTranscodedSizeInBytes', level, 0, 0, target) as number, pixels = new Uint8Array(size);
                if (!call(file, 'transcodeImage', pixels, level, 0, 0, target, 0, -1, -1)) throw new World3DError('WORLD3D_INPUT_INVALID', 'ktx2: level ' + level + ' could not be transcoded');
                levels.push(pixels);
            }
            if (!format) return {source: {width: info.width, height: info.height, data: levels[0]!}, colorSpace};
            return {source: {width: info.width, height: info.height, format, levels}, colorSpace};
        } finally {
            call(file, 'close'); call(file, 'delete');
        }
    };
}
