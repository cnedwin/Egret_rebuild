// SPDX-License-Identifier: Apache-2.0
import { Inflate, zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { IntegrationError } from './errors.js';

export interface ArchiveAsset {
    readonly path: string;
    readonly bytes: Uint8Array;
}

export const ARCHIVE_LIMITS = Object.freeze({
    compressedBytes: 16 * 1024 * 1024,
    expandedBytes: 32 * 1024 * 1024,
    fileBytes: 16 * 1024 * 1024,
    files: 512,
});

function invalid(message: string): never {
    throw new IntegrationError('archive', 'invalid-input', message);
}

function limit(message: string): never {
    throw new IntegrationError('archive', 'limit-exceeded', message);
}

function unsupported(message: string): never {
    throw new IntegrationError('archive', 'unsupported', message);
}

const pathEncoder = new TextEncoder();
const pathDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function assetPath(path: string): string {
    if (typeof path !== 'string' || path.length > 256 ||
        pathEncoder.encode(path).length > 256 || pathDecoder.decode(pathEncoder.encode(path)) !== path || /[\\:\x00-\x1f\x7f<>|?*"]/.test(path) ||
        path.split('/').some(part => part === '' || part === '.' || part === '..' || part === '__proto__' || /[. ]$/.test(part))) {
        invalid('Archive entries need canonical relative asset paths.');
    }
    return path;
}

function checkFileBudget(size: number, total: number): number {
    if (size > ARCHIVE_LIMITS.fileBytes || size + total > ARCHIVE_LIMITS.expandedBytes) {
        limit('Expanded archive bytes exceed the asset budget.');
    }
    return total + size;
}

/** Create a reproducible ZIP from owned in-memory assets. No filesystem access. */
export function zipAssets(assets: readonly ArchiveAsset[]): Uint8Array {
    if (!Array.isArray(assets)) invalid('Expected a list of archive assets.');
    if (assets.length > ARCHIVE_LIMITS.files) limit('Too many archive entries.');
    const files = new Map<string, Uint8Array>();
    let total = 0;
    for (const asset of assets) {
        if (!asset) invalid('Expected an archive asset.');
        const { path: name, bytes } = asset;
        if (!(bytes instanceof Uint8Array)) invalid('Expected Uint8Array asset bytes.');
        const path = assetPath(name);
        if (files.has(path)) invalid('Duplicate archive entry: ' + path);
        total = checkFileBudget(bytes.byteLength, total);
        files.set(path, new Uint8Array(bytes));
    }
    const input = Object.create(null) as Zippable;
    for (const path of [...files.keys()].sort()) input[path] = files.get(path)!;
    const packed = zipSync(input, { level: 6, mtime: new Date(2000, 0, 1) });
    if (packed.byteLength > ARCHIVE_LIMITS.compressedBytes) limit('Compressed archive exceeds the asset budget.');
    return packed;
}

interface ZipEntry {
    readonly path: string;
    readonly size: number;
    readonly crc: number;
    readonly offset: number;
    readonly dataStart: number;
    readonly end: number;
    readonly method: 0 | 8;
}

function readPath(bytes: Uint8Array, utf8: boolean): string {
    if (!utf8 && bytes.some(value => value > 127)) unsupported('Non-ASCII ZIP names must be marked UTF-8.');
    let decoded: string;
    try { decoded = pathDecoder.decode(bytes); }
    catch (cause) {
        throw new IntegrationError('archive', 'invalid-input', 'Malformed UTF-8 archive path.', { cause });
    }
    return assetPath(decoded);
}

function inspectDirectory(bytes: Uint8Array): readonly ZipEntry[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (offset: number) => view.getUint16(offset, true);
    const u32 = (offset: number) => view.getUint32(offset, true);
    let footer = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
        if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.length) {
            footer = offset;
            break;
        }
    }
    if (footer < 0) invalid('ZIP directory footer is missing.');
    const count = u16(footer + 10);
    if (u16(footer + 4) || u16(footer + 6) || u16(footer + 8) !== count || count === 0xffff) {
        unsupported('Multi-disk and ZIP64 archives are outside this asset profile.');
    }
    if (count > ARCHIVE_LIMITS.files) limit('Too many archive entries.');
    const directory = u32(footer + 16);
    if (directory + u32(footer + 12) !== footer) invalid('ZIP directory range is invalid.');
    const entries: ZipEntry[] = [];
    const names = new Set<string>();
    let expanded = 0;
    let offset = directory;
    for (let index = 0; index < count; index++) {
        if (offset + 46 > footer || u32(offset) !== 0x02014b50) invalid('Invalid ZIP directory entry.');
        const flags = u16(offset + 8);
        const method = u16(offset + 10);
        if ((flags & ~0x0806) !== 0 || (method !== 0 && method !== 8) || u16(offset + 34)) {
            unsupported('ZIP assets use single-disk stored or deflate entries without encryption or streaming descriptors.');
        }
        const crc = u32(offset + 16);
        const compressed = u32(offset + 20);
        const size = u32(offset + 24);
        expanded = checkFileBudget(size, expanded);
        const nameStart = offset + 46;
        const nameEnd = nameStart + u16(offset + 28);
        const next = nameEnd + u16(offset + 30) + u16(offset + 32);
        if (next > footer) invalid('ZIP entry metadata exceeds the directory.');
        const path = readPath(bytes.subarray(nameStart, nameEnd), (flags & 0x800) !== 0);
        if (names.has(path)) invalid('Duplicate archive entry: ' + path);
        names.add(path);
        const local = u32(offset + 42);
        if (local + 30 > directory || u32(local) !== 0x04034b50 || u16(local + 6) !== flags ||
            u16(local + 8) !== method || u32(local + 14) !== crc || u32(local + 18) !== compressed ||
            u32(local + 22) !== size || (method === 0 && compressed !== size)) {
            invalid('Local ZIP entry does not match its directory.');
        }
        const localNameEnd = local + 30 + u16(local + 26);
        const dataStart = localNameEnd + u16(local + 28);
        const end = dataStart + compressed;
        if (end > directory || readPath(bytes.subarray(local + 30, localNameEnd), (flags & 0x800) !== 0) !== path) {
            invalid('Local ZIP entry bytes or path do not match its directory.');
        }
        entries.push({ path, size, crc, offset: local, dataStart, end, method });
        offset = next;
    }
    if (offset !== footer) invalid('ZIP directory length does not match the entry count.');
    const byPosition = [...entries].sort((left, right) => left.offset - right.offset);
    for (let index = 1; index < byPosition.length; index++) {
        if (byPosition[index]!.offset < byPosition[index - 1]!.end) invalid('Overlapping ZIP entry bytes.');
    }
    return entries;
}

// fflate performs the codec work; CRC also checks the stored-data path.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    return value;
});

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!;
    return (crc ^ 0xffffffff) >>> 0;
}

function inflateEntry(source: Uint8Array, size: number): Uint8Array {
    const result = new Uint8Array(size);
    let offset = 0;
    const decoder = new Inflate(chunk => {
        if (chunk.length > size - offset) invalid('DEFLATE data expands past its declared size.');
        result.set(chunk, offset);
        offset += chunk.length;
    });
    if (source.length === 0) invalid('DEFLATE entry has no compressed stream.');
    // Bound work between output checks, even when a directory declares a tiny result.
    for (let start = 0; start < source.length; start += 2048) {
        const end = Math.min(start + 2048, source.length);
        decoder.push(source.subarray(start, end), end === source.length);
    }
    if (offset !== size) invalid('DEFLATE length does not match its directory.');
    return result;
}

/** Validate declared allocation sizes before handing entry slices to the decoder. */
export function unzipAssets(bytes: Uint8Array): readonly ArchiveAsset[] {
    if (!(bytes instanceof Uint8Array)) invalid('Expected Uint8Array ZIP bytes.');
    if (bytes.byteLength > ARCHIVE_LIMITS.compressedBytes) limit('Compressed archive exceeds the asset budget.');
    const source = new Uint8Array(bytes);
    const entries = inspectDirectory(source);
    return Object.freeze(entries.map(({ path, size, crc, dataStart, end, method }) => {
        let data: Uint8Array;
        try {
            data = method === 0 ? source.slice(dataStart, end) : inflateEntry(source.subarray(dataStart, end), size);
        } catch (cause) {
            if (cause instanceof IntegrationError) throw cause;
            throw new IntegrationError('archive', 'invalid-input', 'ZIP decompression failed: ' + path, { cause });
        }
        if (data.length !== size || crc32(data) !== crc) invalid('ZIP payload does not match its directory: ' + path);
        return Object.freeze({ path, bytes: data });
    }));
}
