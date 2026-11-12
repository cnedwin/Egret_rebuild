// SPDX-License-Identifier: Apache-2.0
import {
    KHR_DF_FLAG_ALPHA_STRAIGHT,
    KHR_DF_MODEL_RGBSDA,
    KHR_DF_PRIMARIES_BT709,
    KHR_DF_TRANSFER_SRGB,
    KHR_SUPERCOMPRESSION_BASISLZ,
    KHR_SUPERCOMPRESSION_NONE,
    KHR_SUPERCOMPRESSION_ZLIB,
    VK_FORMAT_R8G8B8A8_SRGB,
    read,
} from 'ktx-parse';
import { IntegrationError } from './errors.js';
import type { IntegrationErrorCode } from './errors.js';

export interface Ktx2LevelInfo {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly uncompressedByteLength: number;
}

export interface Ktx2Info {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly layerCount: number;
    readonly faceCount: number;
    readonly levelCount: number;
    readonly vkFormat: number;
    readonly supercompressionScheme: number;
    readonly levels: readonly Ktx2LevelInfo[];
}

export interface Ktx2Rgba8Image {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array<ArrayBuffer>;
    readonly format: 'rgba8unorm';
    readonly colorSpace: 'srgb';
    readonly alphaMode: 'straight';
    readonly origin: 'top-left';
}

const metadataKeyDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const maxFileBytes = 32 * 1024 * 1024;
const maxMetadataBytes = 256 * 1024;
const maxEdge = 16384;
const headerBytes = 80;
const levelRecordBytes = 24;
const identifier = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const byteLengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const byteTypeGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;

function fail(code: IntegrationErrorCode, message: string): never {
    throw new IntegrationError('ktx2', code, message);
}

function validateKeyValues(bytes: Uint8Array, data: DataView, start: number, end: number): void {
    const keys = new Set<string>();
    for (let offset = start; offset < end;) {
        if (end - offset < 4) fail('invalid-input', 'The KTX2 metadata record is truncated.');
        const length = data.getUint32(offset, true);
        const valueStart = offset + 4;
        const next = valueStart + Math.ceil(length / 4) * 4;
        if (length < 2 || next > end) fail('invalid-input', 'The KTX2 metadata record exceeds its section.');
        const pair = bytes.subarray(valueStart, valueStart + length);
        const terminator = pair.indexOf(0);
        if (terminator <= 0) fail('invalid-input', 'The KTX2 metadata key has no valid terminator.');
        const key = metadataKeyDecoder.decode(pair.subarray(0, terminator));
        if (key.charCodeAt(0) === 0xfeff || key === '__proto__' || keys.has(key)) {
            fail('invalid-input', 'The KTX2 metadata contains an unsafe or duplicate key.');
        }
        if (key === 'KTXorientation' || key === 'KTXswizzle') {
            const value = pair.subarray(terminator + 1);
            if (value.length < 2 || value.indexOf(0) !== value.length - 1) {
                fail('invalid-input', 'The KTX2 orientation or swizzle value is not a terminated string.');
            }
        }
        keys.add(key);
        offset = next;
    }
}

function validateLayout(bytes: Uint8Array): void {
    if (bytes.length < headerBytes + levelRecordBytes || !identifier.every((byte, index) => bytes[index] === byte)) {
        fail('invalid-input', 'A complete KTX2 header and identifier are required.');
    }
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const word = (offset: number) => data.getUint32(offset, true);
    const wide = (offset: number) => {
        const value = data.getBigUint64(offset, true);
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('limit-exceeded', 'A KTX2 index value exceeds exact integer range.');
        return Number(value);
    };
    const endOf = (offset: number, length: number, minimum: number) => {
        if (offset < minimum || length > bytes.length - offset) fail('invalid-input', 'A KTX2 section exceeds its file range.');
        return offset + length;
    };
    const vkFormat = word(12);
    const width = word(20);
    const height = word(24);
    const depth = word(28);
    const layers = word(32);
    const faces = word(36);
    const levels = Math.max(1, word(40));
    const scheme = word(44);
    if (width === 0 || (height === 0 && depth > 0) || (depth > 0 && layers > 0) ||
        (faces !== 1 && (faces !== 6 || width !== height || depth !== 0))) {
        fail('invalid-input', 'The KTX2 dimensions and texture shape are inconsistent.');
    }
    if (Math.max(width, height, depth) > maxEdge || layers > 2048) {
        fail('limit-exceeded', 'The KTX2 dimensions or layer count exceed inspection limits.');
    }
    if (levels > 1 + Math.floor(Math.log2(Math.max(width, height, depth)))) {
        fail('invalid-input', 'The KTX2 mip count exceeds the image dimensions.');
    }
    if (scheme > KHR_SUPERCOMPRESSION_ZLIB) fail('unsupported', 'The KTX2 supercompression scheme is not supported.');
    const indexEnd = headerBytes + levels * levelRecordBytes;
    const dfdOffset = word(48);
    const dfdLength = word(52);
    const kvdOffset = word(56);
    const kvdLength = word(60);
    const sgdOffset = wide(64);
    const sgdLength = wide(72);
    if (dfdLength < 28 || dfdOffset !== indexEnd) fail('invalid-input', 'The KTX2 format descriptor is incomplete.');
    const dfdEnd = endOf(dfdOffset, dfdLength, indexEnd);
    const descriptorLength = data.getUint16(dfdOffset + 10, true);
    if (word(dfdOffset) !== dfdLength || descriptorLength < 24 || (descriptorLength - 24) % 16 !== 0 ||
        4 + descriptorLength > dfdLength) {
        fail('invalid-input', 'The KTX2 format descriptor has an invalid size.');
    }
    if (word(dfdOffset + 4) !== 0 || data.getUint16(dfdOffset + 8, true) !== 2 || 4 + descriptorLength !== dfdLength) {
        fail('unsupported', 'KTX2 inspection requires one Khronos basic format descriptor.');
    }
    if (kvdLength > maxMetadataBytes) fail('limit-exceeded', 'The KTX2 key/value data exceeds the metadata budget.');
    if ((kvdLength === 0 && kvdOffset !== 0) || (kvdLength > 0 && kvdOffset !== dfdEnd)) {
        fail('invalid-input', 'The KTX2 key/value data offset is inconsistent.');
    }
    const metadataEnd = kvdLength === 0 ? dfdEnd : endOf(kvdOffset, kvdLength, dfdEnd);
    if (kvdLength > 0) validateKeyValues(bytes, data, kvdOffset, metadataEnd);

    let payloadStart = metadataEnd;
    if (scheme === KHR_SUPERCOMPRESSION_BASISLZ) {
        // The pinned parser reads one BasisLZ image descriptor per mip. Limit that path to simple 2D textures.
        if (height === 0 || depth !== 0 || layers !== 0 || faces !== 1) {
            fail('unsupported', 'BasisLZ inspection requires a single 2D image per mip.');
        }
        const prefixLength = 20 + 20 * levels;
        if (vkFormat !== 0 || word(40) === 0 || sgdOffset % 8 !== 0 || sgdLength < prefixLength) {
            fail('invalid-input', 'The KTX2 BasisLZ global data header is invalid.');
        }
        payloadStart = endOf(sgdOffset, sgdLength, metadataEnd);
        const payloadLength = word(sgdOffset + 4) + word(sgdOffset + 8) + word(sgdOffset + 12) + word(sgdOffset + 16);
        if (prefixLength + payloadLength !== sgdLength) fail('invalid-input', 'The KTX2 BasisLZ global data size is inconsistent.');
    } else if (sgdOffset !== 0 || sgdLength !== 0) {
        fail('invalid-input', 'This KTX2 scheme does not use supercompression global data.');
    }

    // Range-check the owned snapshot before the vendor creates buffer-relative views.
    for (let index = levels - 1; index >= 0; index--) {
        const record = headerBytes + index * levelRecordBytes;
        const offset = wide(record);
        const length = wide(record + 8);
        const inflated = wide(record + 16);
        if (length === 0 || (scheme === KHR_SUPERCOMPRESSION_NONE && inflated !== length) ||
            (scheme === KHR_SUPERCOMPRESSION_BASISLZ ? inflated !== 0 : inflated === 0)) {
            fail('invalid-input', 'A KTX2 mip level has an inconsistent byte length.');
        }
        payloadStart = endOf(offset, length, payloadStart);
        if (scheme === KHR_SUPERCOMPRESSION_BASISLZ) {
            const image = sgdOffset + 20 + index * 20;
            const rgbEnd = word(image + 4) + word(image + 8);
            const alphaEnd = word(image + 12) + word(image + 16);
            if (rgbEnd > length || alphaEnd > length) fail('invalid-input', 'A BasisLZ slice exceeds its KTX2 mip level.');
        }
    }
}

function parseKtx2(source: Uint8Array): ReturnType<typeof read> {
    if (Reflect.apply(byteTypeGetter, source, []) !== 'Uint8Array') fail('invalid-input', 'KTX2 input must be a Uint8Array.');
    const length = Reflect.apply(byteLengthGetter, source, []) as number;
    if (length > maxFileBytes) fail('limit-exceeded', 'KTX2 input exceeds the 32 MiB file budget.');
    const bytes = new Uint8Array(length);
    try {
        bytes.set(source);
        validateLayout(bytes);
        return read(bytes);
    } catch (cause) {
        if (cause instanceof IntegrationError) throw cause;
        throw new IntegrationError('ktx2', 'invalid-input', 'The KTX2 container could not be parsed.', { cause });
    }
}

function mipSize(dimension: number, level: number): number {
    return dimension === 0 ? 0 : Math.max(1, Math.floor(dimension / 2 ** level));
}

/** Read bounded structural metadata, retaining numeric encoding and mip information. */
export function inspectKtx2(source: Uint8Array): Ktx2Info {
    const texture = parseKtx2(source);
    return Object.freeze({
        width: texture.pixelWidth,
        height: texture.pixelHeight,
        depth: texture.pixelDepth,
        layerCount: texture.layerCount,
        faceCount: texture.faceCount,
        levelCount: texture.levelCount,
        vkFormat: texture.vkFormat,
        supercompressionScheme: texture.supercompressionScheme,
        levels: Object.freeze(texture.levels.map((mip, level) => Object.freeze({
            width: mipSize(texture.pixelWidth, level),
            height: mipSize(texture.pixelHeight, level),
            depth: mipSize(texture.pixelDepth, level),
            byteOffset: mip.levelData.byteOffset,
            byteLength: mip.levelData.byteLength,
            uncompressedByteLength: mip.uncompressedByteLength,
        }))),
    });
}

/** Convert an uncompressed, straight sRGB 2D mip to tightly packed RGBA8 image bytes. */
export function decodeKtx2Rgba8(source: Uint8Array, level = 0): Ktx2Rgba8Image {
    if (!Number.isSafeInteger(level) || level < 0) fail('invalid-input', 'Use a nonnegative integer KTX2 mip index.');
    const texture = parseKtx2(source);
    const mip = texture.levels[level];
    if (mip === undefined) fail('invalid-input', 'The KTX2 mip index is out of range.');
    const [descriptor] = texture.dataFormatDescriptor;
    const { KTXorientation: orientation, KTXswizzle: swizzle } = texture.keyValue;
    const channels = [0, 1, 2, 15];
    if (texture.vkFormat !== VK_FORMAT_R8G8B8A8_SRGB || texture.typeSize !== 1 ||
        texture.supercompressionScheme !== KHR_SUPERCOMPRESSION_NONE || texture.pixelHeight === 0 ||
        texture.pixelDepth !== 0 || texture.layerCount !== 0 || texture.faceCount !== 1 ||
        (orientation !== undefined && orientation !== 'rd') || (swizzle !== undefined && swizzle !== 'rgba') ||
        descriptor === undefined || descriptor.colorModel !== KHR_DF_MODEL_RGBSDA ||
        descriptor.transferFunction !== KHR_DF_TRANSFER_SRGB || descriptor.colorPrimaries !== KHR_DF_PRIMARIES_BT709 ||
        descriptor.flags !== KHR_DF_FLAG_ALPHA_STRAIGHT ||
        descriptor.texelBlockDimension.some((component) => component !== 0) ||
        descriptor.bytesPlane.some((value, index) => value !== (index === 0 ? 4 : 0)) ||
        descriptor.samples.length !== channels.length || descriptor.samples.some((sample, index) =>
            sample.bitOffset !== index * 8 || sample.bitLength !== 7 || (sample.channelType & 15) !== channels[index])) {
        fail('unsupported', 'Direct KTX2 decode requires uncompressed top-left straight sRGB RGBA8 in a single 2D image.');
    }
    const width = mipSize(texture.pixelWidth, level);
    const height = mipSize(texture.pixelHeight, level);
    if (width > 4096 || height > 4096 || width * height > 1048576) {
        fail('limit-exceeded', 'The selected KTX2 mip exceeds the Egret RGBA8 image budget.');
    }
    if (mip.levelData.byteLength !== width * height * 4) {
        fail('invalid-input', 'The KTX2 RGBA8 mip does not contain tightly packed pixels.');
    }
    return Object.freeze({
        width,
        height,
        pixels: mip.levelData.slice(),
        format: 'rgba8unorm',
        colorSpace: 'srgb',
        alphaMode: 'straight',
        origin: 'top-left',
    });
}
