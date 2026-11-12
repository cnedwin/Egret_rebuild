// SPDX-License-Identifier: Apache-2.0
// Decoder for the EXT_meshopt_compression glTF extension, written from the
// published bitstream description: the vertex codec ("ATTRIBUTES"), the
// triangle codec ("TRIANGLES"), the index sequence codec ("INDICES") and the
// three post-decoding filters. It needs no WebAssembly and no dependency, so
// glTF files compressed this way load without a decoder hook.
import {World3DError} from './core3D.js';

export type MeshoptMode3D = 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES';
export type MeshoptFilter3D = 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL';
export const MESHOPT3D_LIMITS = Object.freeze({maxStride: 256, maxElements: 268435456} as const);

const bad = (detail: string): World3DError => new World3DError('WORLD3D_GLTF_INVALID', 'meshopt ' + detail);

/** Vertex codec: each byte of the element is stored as deltas against the previous element, in groups of sixteen. */
function decodeVertices(source: Uint8Array, count: number, stride: number, out: Uint8Array): void {
    if (source.length < 1 + stride) throw bad('vertex data is too short');
    if ((source[0]! & 0xf0) !== 0xa0 || (source[0]! & 0x0f) !== 0) throw bad('vertex header');
    // The stream ends with a tail whose last `stride` bytes are the element before the first one.
    const tail = Math.max(stride, 32), end = source.length, last = source.slice(end - stride, end);
    const blockMax = Math.min((8192 / stride | 0) & ~15, 256), deltas = new Uint8Array(256);
    let at = 1;
    for (let first = 0; first < count; first += blockMax) {
        const block = Math.min(blockMax, count - first), aligned = (block + 15) & ~15, headerBytes = ((aligned >> 4) + 3) >> 2;
        for (let k = 0; k < stride; k++) {
            const header = at;
            at += headerBytes;
            if (at > end) throw bad('vertex data ends early');
            for (let group = 0; group < aligned; group += 16) {
                const index = group >> 4, mode = (source[header + (index >> 2)]! >> ((index & 3) * 2)) & 3;
                if (mode === 0) deltas.fill(0, group, group + 16);
                else if (mode === 3) {
                    if (at + 16 > end) throw bad('vertex data ends early');
                    deltas.set(source.subarray(at, at + 16), group);
                    at += 16;
                } else {
                    // Packed 2-bit or 4-bit deltas; the largest packed value means "read a whole byte instead".
                    const bits = mode === 1 ? 2 : 4, sentinel = (1 << bits) - 1, packed = mode === 1 ? 4 : 8, perByte = 8 / bits;
                    let extra = at + packed;
                    if (extra > end) throw bad('vertex data ends early');
                    for (let i = 0; i < 16; i++) {
                        const value = (source[at + (i / perByte | 0)]! >> (8 - bits - (i % perByte) * bits)) & sentinel;
                        if (value !== sentinel) { deltas[group + i] = value; continue; }
                        if (extra >= end) throw bad('vertex data ends early');
                        deltas[group + i] = source[extra++]!;
                    }
                    at = extra;
                }
            }
            let previous = last[k]!;
            for (let i = 0, write = first * stride + k; i < block; i++, write += stride) {
                // Deltas are stored zigzag: even values count up, odd values count down.
                const delta = deltas[i]!;
                previous = (previous + ((delta >> 1) ^ -(delta & 1))) & 255;
                out[write] = previous;
            }
            last[k] = previous;
        }
    }
    if (end - at !== tail) throw bad('vertex data has the wrong length');
}

/** Read a little-endian base-128 number of up to five bytes. */
function readVarint(source: Uint8Array, state: {at: number}, limit: number): number {
    let result = 0, shift = 0;
    for (let i = 0; i < 5; i++) {
        if (state.at >= limit) throw bad('index data ends early');
        const byte = source[state.at++]!;
        result |= (byte & 127) << shift;
        shift += 7;
        if (byte < 128) break;
    }
    return result >>> 0;
}

/** Triangle codec: one code byte per triangle refers to recently used edges and vertices. */
function decodeTriangles(source: Uint8Array, count: number, out: Uint16Array | Uint32Array): void {
    if (count % 3 !== 0) throw bad('triangle index count');
    const triangles = count / 3;
    if (source.length < 1 + triangles + 16) throw bad('index data is too short');
    const version = source[0]! & 0x0f;
    if ((source[0]! & 0xf0) !== 0xe0 || version > 1) throw bad('index header');
    const edges = new Uint32Array(32).fill(0xffffffff), vertices = new Uint32Array(16).fill(0xffffffff);
    const limit = source.length - 16, table = limit, state = {at: 1 + triangles}, directLimit = version >= 1 ? 13 : 15;
    let edgeAt = 0, vertexAt = 0, next = 0, last = 0;
    const pushEdge = (a: number, b: number): void => { edges[edgeAt * 2] = a; edges[edgeAt * 2 + 1] = b; edgeAt = (edgeAt + 1) & 15; };
    // The slot is always written; it only becomes part of the history when `keep` is set.
    const pushVertex = (v: number, keep: boolean): void => { vertices[vertexAt] = v; if (keep) vertexAt = (vertexAt + 1) & 15; };
    const readIndex = (): number => { const v = readVarint(source, state, limit); return last = (last + ((v >>> 1) ^ -(v & 1))) >>> 0; };
    for (let i = 0; i < triangles; i++) {
        const code = source[1 + i]!;
        let a: number, b: number, c: number;
        if (code < 0xf0) {
            // Reuse an edge from the history; the third corner is new, recent, or given outright.
            const slot = (edgeAt - 1 - (code >> 4)) & 15, third = code & 15;
            a = edges[slot * 2]!; b = edges[slot * 2 + 1]!;
            if (third < directLimit) {
                c = third === 0 ? next++ : vertices[(vertexAt - 1 - third) & 15]!;
                pushVertex(c, third === 0);
            } else {
                c = third === 15 ? readIndex() : (last = (last + (third === 13 ? -1 : 1)) >>> 0);
                pushVertex(c, true);
            }
            pushEdge(c, b); pushEdge(a, c);
        } else {
            if (code < 0xfe) {
                // A new first corner; the other two come from a small table stored at the end of the stream.
                const aux = source[table + (code & 15)]!, second = aux >> 4, third = aux & 15;
                a = next++;
                b = second === 0 ? next++ : vertices[(vertexAt - second) & 15]!;
                c = third === 0 ? next++ : vertices[(vertexAt - third) & 15]!;
                pushVertex(a, true); pushVertex(b, second === 0); pushVertex(c, third === 0);
            } else {
                if (state.at >= limit) throw bad('index data ends early');
                const aux = source[state.at++]!, second = aux >> 4, third = aux & 15, firstGiven = code === 0xff;
                if (aux === 0) next = 0;
                a = firstGiven ? 0 : next++;
                b = second === 0 ? next++ : vertices[(vertexAt - second) & 15]!;
                c = third === 0 ? next++ : vertices[(vertexAt - third) & 15]!;
                if (firstGiven) a = readIndex();
                if (second === 15) b = readIndex();
                if (third === 15) c = readIndex();
                pushVertex(a, true); pushVertex(b, second === 0 || second === 15); pushVertex(c, third === 0 || third === 15);
            }
            pushEdge(b, a); pushEdge(c, b); pushEdge(a, c);
        }
        out[i * 3] = a; out[i * 3 + 1] = b; out[i * 3 + 2] = c;
    }
    if (state.at !== limit) throw bad('index data has the wrong length');
}

/** Index sequence codec: each index is a delta against one of two running values. */
function decodeSequence(source: Uint8Array, count: number, out: Uint16Array | Uint32Array): void {
    if (source.length < 1 + count + 4) throw bad('index data is too short');
    if ((source[0]! & 0xf0) !== 0xd0 || (source[0]! & 0x0f) > 1) throw bad('index header');
    const limit = source.length - 4, state = {at: 1}, last = [0, 0];
    for (let i = 0; i < count; i++) {
        const v = readVarint(source, state, limit), which = v & 1, rest = v >>> 1;
        out[i] = last[which] = (last[which]! + ((rest >>> 1) ^ -(rest & 1))) >>> 0;
    }
    if (state.at !== limit) throw bad('index data has the wrong length');
}

const round = (value: number): number => value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
/** Unit vectors stored as a point on an octahedron; the fourth component is left as it is. */
function filterOctahedral(data: Uint8Array, count: number, stride: number): void {
    if (stride !== 4 && stride !== 8) throw bad('octahedral filter stride');
    const view = stride === 4 ? new Int8Array(data.buffer, data.byteOffset, count * 4) : new Int16Array(data.buffer, data.byteOffset, count * 4), max = stride === 4 ? 127 : 32767;
    for (let i = 0; i < count * 4; i += 4) {
        let x = view[i]!, y = view[i + 1]!;
        const one = view[i + 2]!, z = one - Math.abs(x) - Math.abs(y), fold = Math.max(-z, 0);
        x += x >= 0 ? -fold : fold; y += y >= 0 ? -fold : fold;
        const scale = max / Math.sqrt(x * x + y * y + z * z);
        view[i] = round(x * scale); view[i + 1] = round(y * scale); view[i + 2] = round(z * scale);
    }
}
/** Unit quaternions stored as their three smallest components; the largest is rebuilt. */
function filterQuaternion(data: Uint8Array, count: number, stride: number): void {
    if (stride !== 8) throw bad('quaternion filter stride');
    const view = new Int16Array(data.buffer, data.byteOffset, count * 4);
    for (let i = 0; i < count * 4; i += 4) {
        const packed = view[i + 3]!, scale = Math.SQRT1_2 / (packed | 3), x = view[i]! * scale, y = view[i + 1]! * scale, z = view[i + 2]! * scale;
        const w = Math.sqrt(Math.max(1 - x * x - y * y - z * z, 0)), largest = packed & 3;
        view[i + ((largest + 1) & 3)] = round(x * 32767); view[i + ((largest + 2) & 3)] = round(y * 32767);
        view[i + ((largest + 3) & 3)] = round(z * 32767); view[i + largest] = round(w * 32767);
    }
}
/** Floats stored as an 8-bit exponent above a 24-bit mantissa. */
function filterExponential(data: Uint8Array, count: number, stride: number): void {
    if (stride % 4 !== 0) throw bad('exponential filter stride');
    const total = count * stride / 4, ints = new Int32Array(data.buffer, data.byteOffset, total), floats = new Float32Array(data.buffer, data.byteOffset, total);
    for (let i = 0; i < total; i++) { const v = ints[i]!; floats[i] = Math.pow(2, v >> 24) * ((v << 8) >> 8); }
}

/**
 * Decode one EXT_meshopt_compression buffer view. `count` elements of
 * `stride` bytes are returned; for the two index modes the stride is 2 or 4.
 */
export function decodeMeshopt3D(source: Uint8Array, count: number, stride: number, mode: MeshoptMode3D, filter: MeshoptFilter3D = 'NONE'): Uint8Array {
    if (!(source instanceof Uint8Array)) throw bad('source');
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(stride) || stride <= 0 || stride > MESHOPT3D_LIMITS.maxStride) throw bad('count or stride');
    if (count * stride > MESHOPT3D_LIMITS.maxElements) throw new World3DError('WORLD3D_BUDGET', 'meshopt output size');
    // A four-byte multiple keeps the typed views used by the filters and index writers aligned.
    const out = new Uint8Array(new ArrayBuffer((count * stride + 3) & ~3), 0, count * stride);
    if (mode === 'ATTRIBUTES') {
        if (stride % 4 !== 0) throw bad('vertex stride must be a multiple of four');
        if (count > 0) decodeVertices(source, count, stride, out); else if (source.length > 0 && (source[0]! & 0xf0) !== 0xa0) throw bad('vertex header');
        if (filter === 'OCTAHEDRAL') filterOctahedral(out, count, stride);
        else if (filter === 'QUATERNION') filterQuaternion(out, count, stride);
        else if (filter === 'EXPONENTIAL') filterExponential(out, count, stride);
        else if (filter !== 'NONE') throw bad('filter');
        return out;
    }
    if (filter !== 'NONE') throw bad('filters apply to vertex data only');
    if (stride !== 2 && stride !== 4) throw bad('index stride must be two or four');
    const indices = stride === 2 ? new Uint16Array(out.buffer, 0, count) : new Uint32Array(out.buffer, 0, count);
    if (mode === 'TRIANGLES') decodeTriangles(source, count, indices);
    else if (mode === 'INDICES') decodeSequence(source, count, indices);
    else throw bad('mode');
    return out;
}
