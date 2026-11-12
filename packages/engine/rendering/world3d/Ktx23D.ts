// SPDX-License-Identifier: Apache-2.0
// KTX 2.0 container reader for 2D textures. Block-compressed and RGBA8
// payloads stored without supercompression are read directly. Basis Universal
// payloads and Zstandard or zlib supercompression need a transcoder, which the
// caller injects so this module stays dependency-free and DOM-free.
import {World3DError} from './core3D.js';
import {COMPRESSED_BLOCK_BYTES_3D} from './Texture3D.js';
import type {CompressedFormat3D, CompressedPixels3D, TextureColorSpace3D, TexturePixels3D} from './Texture3D.js';

export interface Ktx2Info3D {
    /** Vulkan format number; 0 marks a Basis Universal payload. */
    readonly vkFormat: number;
    readonly width: number;
    readonly height: number;
    readonly levelCount: number;
    /** 0 none, 1 BasisLZ, 2 Zstandard, 3 zlib. */
    readonly supercompression: number;
    /** Stored level byte ranges, largest level first. */
    readonly levels: readonly Uint8Array[];
    /** The complete file, for transcoders that parse the container themselves. */
    readonly file: Uint8Array;
}
export interface Ktx2Result3D {
    readonly source: TexturePixels3D | CompressedPixels3D;
    readonly colorSpace: TextureColorSpace3D;
}
export interface Ktx2Options3D {
    /** Convert a payload this reader cannot use directly into pixels or a supported compressed chain. */
    readonly transcode?: (info: Ktx2Info3D) => Promise<Ktx2Result3D> | Ktx2Result3D;
}

const IDENTIFIER = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
const FORMATS: Readonly<Record<number, {format: CompressedFormat3D | 'rgba8'; colorSpace: TextureColorSpace3D}>> = Object.freeze({
    37: {format: 'rgba8', colorSpace: 'linear'}, 43: {format: 'rgba8', colorSpace: 'srgb'},
    133: {format: 'bc1', colorSpace: 'linear'}, 134: {format: 'bc1', colorSpace: 'srgb'},
    137: {format: 'bc3', colorSpace: 'linear'}, 138: {format: 'bc3', colorSpace: 'srgb'},
    145: {format: 'bc7', colorSpace: 'linear'}, 146: {format: 'bc7', colorSpace: 'srgb'},
    147: {format: 'etc2-rgb8', colorSpace: 'linear'}, 148: {format: 'etc2-rgb8', colorSpace: 'srgb'},
    151: {format: 'etc2-rgba8', colorSpace: 'linear'}, 152: {format: 'etc2-rgba8', colorSpace: 'srgb'},
    157: {format: 'astc-4x4', colorSpace: 'linear'}, 158: {format: 'astc-4x4', colorSpace: 'srgb'},
});
const KTX2_LIMITS = Object.freeze({maxEdge: 8192, maxLevels: 14} as const);

/** True when `bytes` starts with the KTX 2.0 file identifier. */
export function isKtx23D(bytes: Uint8Array): boolean {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12) return false;
    for (let i = 0; i < 12; i++) if (bytes[i] !== IDENTIFIER[i]) return false;
    return true;
}
function fail(detail: string): never {
    throw new World3DError('WORLD3D_INPUT_INVALID', 'ktx2: ' + detail);
}

/** Read a KTX 2.0 file holding one 2D texture and its mip chain. */
export async function parseKtx23D(bytes: Uint8Array, options: Ktx2Options3D = {}): Promise<Ktx2Result3D> {
    if (!isKtx23D(bytes)) fail('identifier');
    if (bytes.byteLength < 80) fail('header');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const vkFormat = view.getUint32(12, true), width = view.getUint32(20, true), height = view.getUint32(24, true);
    const depth = view.getUint32(28, true), layers = view.getUint32(32, true), faces = view.getUint32(36, true);
    const levelCount = Math.max(1, view.getUint32(40, true)), supercompression = view.getUint32(44, true);
    if (width === 0 || height === 0 || width > KTX2_LIMITS.maxEdge || height > KTX2_LIMITS.maxEdge) fail('size');
    if (depth !== 0 || layers !== 0 || faces !== 1) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'ktx2: only single 2D textures are supported');
    if (levelCount > KTX2_LIMITS.maxLevels || 80 + levelCount * 24 > bytes.byteLength) fail('level index');
    const levels: Uint8Array[] = [];
    for (let level = 0; level < levelCount; level++) {
        const base = 80 + level * 24;
        // Offsets are 64-bit; files this reader accepts fit comfortably in the low 53 bits.
        const offset = Number(view.getBigUint64(base, true)), length = Number(view.getBigUint64(base + 8, true));
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || length > bytes.byteLength - offset) fail('level range');
        levels.push(bytes.subarray(offset, offset + length));
    }
    const known = FORMATS[vkFormat];
    if (supercompression !== 0 || !known) {
        if (!options.transcode) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'ktx2: this payload needs a transcoder (vkFormat ' + vkFormat + ', supercompression ' + supercompression + ')');
        return await options.transcode({vkFormat, width, height, levelCount, supercompression, levels, file: bytes});
    }
    if (known.format === 'rgba8') {
        const first = levels[0]!;
        if (first.byteLength !== width * height * 4) fail('rgba8 level size');
        return {source: {width, height, data: first.slice()}, colorSpace: known.colorSpace};
    }
    const block = COMPRESSED_BLOCK_BYTES_3D[known.format];
    let w = width, h = height;
    for (const level of levels) {
        if (level.byteLength !== Math.ceil(w / 4) * Math.ceil(h / 4) * block) fail('compressed level size');
        w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
    }
    return {source: {width, height, format: known.format, levels: levels.map(level => level.slice())}, colorSpace: known.colorSpace};
}
