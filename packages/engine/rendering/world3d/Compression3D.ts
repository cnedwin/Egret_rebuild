// SPDX-License-Identifier: Apache-2.0
// Decompressors for the two general-purpose schemes KTX 2.0 files may wrap
// their texture levels in: zlib (RFC 1950 and 1951) and Zstandard (RFC 8878).
// Both are written from the published formats, need no WebAssembly, and work
// on whole buffers. Zstandard dictionaries are not supported, and checksums
// are skipped rather than verified.
import {World3DError} from './core3D.js';

export const COMPRESSION3D_LIMITS = Object.freeze({maxOutputBytes: 536870912} as const);
const bad = (detail: string): World3DError => new World3DError('WORLD3D_INPUT_INVALID', 'compressed data: ' + detail);
const tooBig = (): World3DError => new World3DError('WORLD3D_BUDGET', 'decompressed size');

/** Growable output; sized up front when the caller knows the result length. */
class Output {
    bytes: Uint8Array;
    length = 0;
    readonly #max: number;
    constructor(hint: number, max: number) { this.#max = max; this.bytes = new Uint8Array(Math.min(Math.max(hint, 64), max)); }
    reserve(extra: number): void {
        const need = this.length + extra;
        if (need <= this.bytes.length) return;
        if (need > this.#max) throw tooBig();
        const grown = new Uint8Array(Math.min(Math.max(need, this.bytes.length * 2), this.#max));
        grown.set(this.bytes.subarray(0, this.length));
        this.bytes = grown;
    }
    result(): Uint8Array { return this.bytes.subarray(0, this.length); }
}

// ---- zlib ---------------------------------------------------------------------
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
interface PrefixTable { readonly counts: Uint16Array; readonly symbols: Uint16Array }
/** Canonical prefix code from code lengths: symbols ordered by length, then by value. */
function prefixTable(lengths: ArrayLike<number>, count: number): PrefixTable {
    const counts = new Uint16Array(16), offsets = new Uint16Array(16), symbols = new Uint16Array(count);
    for (let i = 0; i < count; i++) counts[lengths[i]!]!++;
    counts[0] = 0;
    for (let i = 1; i < 16; i++) offsets[i] = offsets[i - 1]! + counts[i - 1]!;
    for (let i = 0; i < count; i++) if (lengths[i]! !== 0) symbols[offsets[lengths[i]!]!++] = i;
    return {counts, symbols};
}
/**
 * Decompress a zlib stream, or a bare deflate stream when `raw` is set.
 * `sizeHint` is the expected output length when known.
 */
export function inflate3D(source: Uint8Array, options: {readonly raw?: boolean; readonly sizeHint?: number; readonly maxBytes?: number} = {}): Uint8Array {
    if (!(source instanceof Uint8Array)) throw bad('source');
    let at = 0, hold = 0, held = 0;
    if (!options.raw) {
        if (source.length < 6 || (source[0]! & 15) !== 8 || ((source[0]! << 8) | source[1]!) % 31 !== 0 || (source[1]! & 32) !== 0) throw bad('zlib header');
        at = 2;
    }
    const out = new Output(options.sizeHint ?? source.length * 3, options.maxBytes ?? COMPRESSION3D_LIMITS.maxOutputBytes);
    const bits = (n: number): number => {
        while (held < n) { if (at >= source.length) throw bad('deflate data ends early'); hold |= source[at++]! << held; held += 8; }
        const value = hold & ((1 << n) - 1);
        hold >>>= n; held -= n;
        return value;
    };
    const symbol = (table: PrefixTable): number => {
        // Walk the code one bit at a time; codes of each length are consecutive.
        let code = 0, first = 0, index = 0;
        for (let length = 1; length < 16; length++) {
            code |= bits(1);
            const count = table.counts[length]!;
            if (code - count < first) return table.symbols[index + (code - first)]!;
            index += count; first = (first + count) << 1; code <<= 1;
        }
        throw bad('deflate code');
    };
    const fixedLengths = new Uint8Array(288);
    fixedLengths.fill(8, 0, 144); fixedLengths.fill(9, 144, 256); fixedLengths.fill(7, 256, 280); fixedLengths.fill(8, 280, 288);
    let fixed: [PrefixTable, PrefixTable] | undefined;
    for (let final = false; !final;) {
        final = bits(1) === 1;
        const type = bits(2);
        if (type === 0) {
            hold = 0; held = 0;
            if (at + 4 > source.length) throw bad('deflate data ends early');
            const length = source[at]! | (source[at + 1]! << 8);
            if ((length ^ (source[at + 2]! | (source[at + 3]! << 8))) !== 0xffff) throw bad('stored block');
            at += 4;
            if (at + length > source.length) throw bad('deflate data ends early');
            out.reserve(length);
            out.bytes.set(source.subarray(at, at + length), out.length);
            out.length += length; at += length;
            continue;
        }
        if (type === 3) throw bad('deflate block type');
        let literals: PrefixTable, distances: PrefixTable;
        if (type === 1) [literals, distances] = fixed ??= [prefixTable(fixedLengths, 288), prefixTable(new Uint8Array(30).fill(5), 30)];
        else {
            const literalCount = bits(5) + 257, distanceCount = bits(5) + 1, codeCount = bits(4) + 4, codeLengths = new Uint8Array(19);
            for (let i = 0; i < codeCount; i++) codeLengths[CODE_ORDER[i]!] = bits(3);
            const codes = prefixTable(codeLengths, 19), lengths = new Uint8Array(literalCount + distanceCount);
            for (let i = 0; i < lengths.length;) {
                const s = symbol(codes);
                if (s < 16) { lengths[i++] = s; continue; }
                let repeat: number, value = 0;
                if (s === 16) { if (i === 0) throw bad('deflate lengths'); value = lengths[i - 1]!; repeat = bits(2) + 3; } else repeat = s === 17 ? bits(3) + 3 : bits(7) + 11;
                if (i + repeat > lengths.length) throw bad('deflate lengths');
                while (repeat-- > 0) lengths[i++] = value;
            }
            literals = prefixTable(lengths.subarray(0, literalCount), literalCount); distances = prefixTable(lengths.subarray(literalCount), distanceCount);
        }
        for (;;) {
            const s = symbol(literals);
            if (s < 256) { out.reserve(1); out.bytes[out.length++] = s; continue; }
            if (s === 256) break;
            if (s > 285) throw bad('deflate length code');
            const length = LENGTH_BASE[s - 257]! + bits(LENGTH_EXTRA[s - 257]!), d = symbol(distances);
            if (d > 29) throw bad('deflate distance code');
            const distance = DISTANCE_BASE[d]! + bits(DISTANCE_EXTRA[d]!);
            if (distance > out.length) throw bad('deflate distance');
            out.reserve(length);
            const bytes = out.bytes;
            for (let i = 0, from = out.length - distance; i < length; i++) bytes[out.length++] = bytes[from + i]!;
        }
    }
    return out.result();
}

// ---- Zstandard ----------------------------------------------------------------
/** Reads a bitstream from its end toward its start, as Zstandard stores entropy-coded data. */
class BackwardBits {
    readonly #bytes: Uint8Array;
    readonly #start: number;
    /** Number of unread bits. Negative once more was read than stored; such reads return zeros. */
    left: number;
    constructor(bytes: Uint8Array, start: number, end: number) {
        if (end <= start || bytes[end - 1] === 0) throw bad('zstd bitstream');
        this.#bytes = bytes; this.#start = start;
        // The highest set bit of the last byte marks the end of the data.
        this.left = (end - start) * 8 - (Math.clz32(bytes[end - 1]!) - 24) - 1;
    }
    read(count: number): number {
        if (count === 0) return 0;
        this.left -= count;
        let value = 0;
        // Gather bit by byte: bit `left` is the lowest of the field being read.
        for (let got = 0, position = this.left; got < count;) {
            if (position < 0) { const skip = Math.min(-position, count - got); got += skip; position += skip; continue; }
            const offset = position & 7, take = Math.min(8 - offset, count - got);
            value += ((this.#bytes[this.#start + (position >> 3)]! >> offset) & ((1 << take) - 1)) * 2 ** got;
            got += take; position += take;
        }
        return value;
    }
}
interface FseTable { readonly log: number; readonly symbol: Uint8Array; readonly bits: Uint8Array; readonly base: Uint16Array }
function fseBuild(norm: ArrayLike<number>, count: number, log: number): FseTable {
    const size = 1 << log, symbol = new Uint8Array(size), bitsOut = new Uint8Array(size), base = new Uint16Array(size), next = new Uint16Array(count);
    let high = size - 1;
    for (let s = 0; s < count; s++) { if (norm[s] === -1) { symbol[high--] = s; next[s] = 1; } else next[s] = norm[s]!; }
    const step = (size >> 1) + (size >> 3) + 3, mask = size - 1;
    for (let s = 0, position = 0; s < count; s++) {
        for (let i = 0; i < norm[s]!; i++) {
            symbol[position] = s;
            do position = (position + step) & mask; while (position > high);
        }
    }
    for (let i = 0; i < size; i++) {
        const s = symbol[i]!, state = next[s]!++, n = log - (31 - Math.clz32(state));
        bitsOut[i] = n; base[i] = (state << n) - size;
    }
    return {log, symbol, bits: bitsOut, base};
}
/** Read an FSE table description stored as a forward bitstream. Returns the table and where the description ends. */
function fseRead(source: Uint8Array, at: number, end: number, maxSymbol: number, maxLog: number): {table: FseTable; at: number} {
    let hold = 0, held = 0;
    const need = (n: number): void => { while (held < n) { hold += (at < end ? source[at]! : 0) * 2 ** held; at++; held += 8; } };
    const take = (n: number): number => { need(n); const value = hold % (1 << n); hold = Math.floor(hold / (1 << n)); held -= n; return value; };
    const log = take(4) + 5;
    if (log > maxLog) throw bad('zstd table accuracy');
    const norm = new Int16Array(maxSymbol + 1);
    let remaining = (1 << log) + 1, threshold = 1 << log, nbBits = log + 1, s = 0;
    while (remaining > 1 && s <= maxSymbol) {
        const max = 2 * threshold - 1 - remaining;
        need(nbBits);
        let value = hold % threshold, used = nbBits - 1;
        if (value >= max) { value = hold % (2 * threshold); used = nbBits; if (value >= threshold) value -= max; }
        hold = Math.floor(hold / 2 ** used); held -= used;
        const probability = value - 1;
        remaining -= Math.abs(probability);
        norm[s++] = probability;
        if (probability === 0) {
            // A zero is followed by a count of further zeros, two bits at a time.
            for (let repeat = 3; repeat === 3;) { repeat = take(2); s += repeat; }
        }
        while (remaining < threshold) { nbBits--; threshold >>= 1; }
    }
    if (remaining !== 1 || s > maxSymbol + 1) throw bad('zstd table');
    // Whole bytes that were fetched but not used belong to what follows.
    at -= held >> 3;
    if (at > end) throw bad('zstd table');
    return {table: fseBuild(norm, s, log), at};
}
const LL_NORM = [4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1, -1, -1, -1, -1];
const ML_NORM = [1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1];
const OF_NORM = [1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1];
const LL_BASE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
const LL_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const ML_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 39, 41, 43, 47, 51, 59, 67, 83, 99, 131, 259, 515, 1027, 2051, 4099, 8195, 16387, 32771, 65539];
const ML_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
/** One-symbol table, for the "every code is the same" mode. */
const fseSingle = (value: number): FseTable => ({log: 0, symbol: new Uint8Array([value]), bits: new Uint8Array(1), base: new Uint16Array(1)});

interface HuffmanTable { readonly log: number; readonly symbol: Uint8Array; readonly bits: Uint8Array }
/** Read a Huffman tree description; returns the table and where the description ends. */
function huffmanRead(source: Uint8Array, at: number, end: number): {table: HuffmanTable; at: number} {
    if (at >= end) throw bad('zstd literals');
    const header = source[at++]!, weights = new Uint8Array(256);
    let count = 0;
    if (header >= 128) {
        // Weights stored directly, four bits each.
        count = header - 127;
        const bytes = (count + 1) >> 1;
        if (at + bytes > end) throw bad('zstd literals');
        for (let i = 0; i < count; i++) weights[i] = i & 1 ? source[at + (i >> 1)]! & 15 : source[at + (i >> 1)]! >> 4;
        at += bytes;
    } else {
        // Weights compressed with two interleaved FSE states.
        const stop = at + header;
        if (stop > end) throw bad('zstd literals');
        const {table, at: dataAt} = fseRead(source, at, stop, 255, 6), stream = new BackwardBits(source, dataAt, stop);
        let a = stream.read(table.log), b = stream.read(table.log);
        for (;;) {
            if (count > 254) throw bad('zstd weights');
            weights[count++] = table.symbol[a]!;
            if (stream.left < table.bits[a]!) { weights[count++] = table.symbol[b]!; break; }
            a = table.base[a]! + stream.read(table.bits[a]!);
            if (count > 254) throw bad('zstd weights');
            weights[count++] = table.symbol[b]!;
            if (stream.left < table.bits[b]!) { weights[count++] = table.symbol[a]!; break; }
            b = table.base[b]! + stream.read(table.bits[b]!);
        }
        at = stop;
    }
    // The last weight is implied: together the weights fill a power of two exactly.
    let total = 0;
    for (let i = 0; i < count; i++) { if (weights[i]! > 11) throw bad('zstd weights'); if (weights[i]! > 0) total += 1 << (weights[i]! - 1); }
    if (total === 0) throw bad('zstd weights');
    const log = 32 - Math.clz32(total), rest = (1 << log) - total;
    if (log > 11 || (rest & (rest - 1)) !== 0) throw bad('zstd weights');
    weights[count++] = 32 - Math.clz32(rest);
    const size = 1 << log, symbol = new Uint8Array(size), bitsOut = new Uint8Array(size);
    for (let weight = 1, position = 0; weight <= log; weight++) {
        const span = 1 << (weight - 1);
        for (let s = 0; s < count; s++) {
            if (weights[s] !== weight) continue;
            symbol.fill(s, position, position + span); bitsOut.fill(log + 1 - weight, position, position + span);
            position += span;
        }
    }
    return {table: {log, symbol, bits: bitsOut}, at};
}
function huffmanStream(table: HuffmanTable, source: Uint8Array, start: number, end: number, out: Uint8Array, at: number, count: number): void {
    const stream = new BackwardBits(source, start, end), log = table.log;
    // Keep `log` bits in view; each symbol uses the top few and the rest slide up.
    let state = stream.read(log);
    for (let i = 0; i < count; i++) {
        out[at + i] = table.symbol[state]!;
        const used = table.bits[state]!;
        state = ((state << used) & ((1 << log) - 1)) | stream.read(used);
    }
    if (stream.left !== -log) throw bad('zstd literal stream');
}

interface FrameState { literals: HuffmanTable | undefined; ll: FseTable | undefined; of: FseTable | undefined; ml: FseTable | undefined; readonly offsets: [number, number, number] }
function zstdBlock(source: Uint8Array, start: number, end: number, out: Output, frameStart: number, state: FrameState): void {
    // ---- literals ----
    let at = start;
    if (at >= end) throw bad('zstd block');
    const first = source[at]!, type = first & 3, format = (first >> 2) & 3;
    let literals: Uint8Array, literalCount: number;
    if (type < 2) {
        let headerBytes: number;
        if ((format & 1) === 0) { literalCount = first >> 3; headerBytes = 1; }
        else if (format === 1) { literalCount = (first >> 4) | (source[at + 1]! << 4); headerBytes = 2; }
        else { literalCount = (first >> 4) | (source[at + 1]! << 4) | (source[at + 2]! << 12); headerBytes = 3; }
        at += headerBytes;
        if (type === 0) { if (at + literalCount > end) throw bad('zstd literals'); literals = source.subarray(at, at + literalCount); at += literalCount; }
        else { if (at >= end) throw bad('zstd literals'); literals = new Uint8Array(literalCount).fill(source[at]!); at += 1; }
    } else {
        let compressed: number, headerBytes: number;
        const streams = format === 0 ? 1 : 4;
        if (at + 3 > end) throw bad('zstd literals');
        const h = first | (source[at + 1]! << 8) | (source[at + 2]! << 16);
        if (format < 2) { literalCount = (h >> 4) & 1023; compressed = (h >> 14) & 1023; headerBytes = 3; }
        else if (format === 2) { const top = source[at + 3] ?? 0; literalCount = (h >> 4) & 16383; compressed = (h >>> 18) | (top << 6); headerBytes = 4; }
        else { const b3 = source[at + 3] ?? 0, b4 = source[at + 4] ?? 0; literalCount = (h >> 4) & 262143; compressed = (h >> 22) | (b3 << 2) | (b4 << 10); headerBytes = 5; }
        at += headerBytes;
        const stop = at + compressed;
        if (stop > end) throw bad('zstd literals');
        if (type === 2) { const read = huffmanRead(source, at, stop); state.literals = read.table; at = read.at; }
        const table = state.literals;
        if (!table) throw bad('zstd literals reuse a table that was never sent');
        literals = new Uint8Array(literalCount);
        if (streams === 1) huffmanStream(table, source, at, stop, literals, 0, literalCount);
        else {
            if (at + 6 > stop) throw bad('zstd literals');
            const s1 = source[at]! | (source[at + 1]! << 8), s2 = source[at + 2]! | (source[at + 3]! << 8), s3 = source[at + 4]! | (source[at + 5]! << 8), each = (literalCount + 3) >> 2;
            at += 6;
            if (at + s1 + s2 + s3 > stop) throw bad('zstd literals');
            huffmanStream(table, source, at, at + s1, literals, 0, each);
            huffmanStream(table, source, at + s1, at + s1 + s2, literals, each, each);
            huffmanStream(table, source, at + s1 + s2, at + s1 + s2 + s3, literals, each * 2, each);
            huffmanStream(table, source, at + s1 + s2 + s3, stop, literals, each * 3, literalCount - each * 3);
        }
        at = stop;
    }
    // ---- sequences ----
    if (at >= end) throw bad('zstd sequences');
    let sequences = source[at++]!;
    if (sequences >= 128) {
        if (sequences === 255) { if (at + 2 > end) throw bad('zstd sequences'); sequences = source[at]! + (source[at + 1]! << 8) + 0x7f00; at += 2; }
        else { if (at >= end) throw bad('zstd sequences'); sequences = ((sequences - 128) << 8) + source[at++]!; }
    }
    let literalAt = 0;
    if (sequences > 0) {
        if (at >= end) throw bad('zstd sequences');
        const modes = source[at++]!;
        if (modes & 3) throw bad('zstd sequences');
        const table = (mode: number, previous: FseTable | undefined, norm: readonly number[], log: number, maxSymbol: number, maxLog: number): FseTable => {
            if (mode === 0) return fseBuild(norm, norm.length, log);
            if (mode === 1) { if (at >= end) throw bad('zstd sequences'); const value = source[at++]!; if (value > maxSymbol) throw bad('zstd sequences'); return fseSingle(value); }
            if (mode === 2) { const read = fseRead(source, at, end, maxSymbol, maxLog); at = read.at; return read.table; }
            if (!previous) throw bad('zstd sequences reuse a table that was never sent');
            return previous;
        };
        const ll = state.ll = table(modes >> 6, state.ll, LL_NORM, 6, 35, 9);
        const of = state.of = table((modes >> 4) & 3, state.of, OF_NORM, 5, 31, 8);
        const ml = state.ml = table((modes >> 2) & 3, state.ml, ML_NORM, 6, 52, 9);
        const stream = new BackwardBits(source, at, end), offsets = state.offsets;
        let llState = stream.read(ll.log), ofState = stream.read(of.log), mlState = stream.read(ml.log);
        for (let i = 0; i < sequences; i++) {
            const ofCode = of.symbol[ofState]!, mlCode = ml.symbol[mlState]!, llCode = ll.symbol[llState]!;
            if (ofCode > 31) throw bad('zstd offset');
            const offsetValue = 2 ** ofCode + stream.read(ofCode), matchLength = ML_BASE[mlCode]! + stream.read(ML_BITS[mlCode]!), literalLength = LL_BASE[llCode]! + stream.read(LL_BITS[llCode]!);
            let offset: number;
            if (offsetValue > 3) { offset = offsetValue - 3; offsets[2] = offsets[1]; offsets[1] = offsets[0]; offsets[0] = offset; }
            else {
                // The three most recent offsets can be named again; with no literals the numbering shifts by one.
                const index = offsetValue - 1 + (literalLength === 0 ? 1 : 0);
                if (index === 0) offset = offsets[0];
                else {
                    offset = index === 3 ? offsets[0] - 1 : offsets[index]!;
                    if (index > 1) offsets[2] = offsets[1];
                    offsets[1] = offsets[0]; offsets[0] = offset;
                }
            }
            if (i + 1 < sequences) {
                llState = ll.base[llState]! + stream.read(ll.bits[llState]!);
                mlState = ml.base[mlState]! + stream.read(ml.bits[mlState]!);
                ofState = of.base[ofState]! + stream.read(of.bits[ofState]!);
            }
            if (literalAt + literalLength > literalCount) throw bad('zstd literal length');
            out.reserve(literalLength + matchLength);
            const bytes = out.bytes;
            bytes.set(literals.subarray(literalAt, literalAt + literalLength), out.length);
            out.length += literalLength; literalAt += literalLength;
            if (offset <= 0 || offset > out.length - frameStart) throw bad('zstd offset');
            for (let k = 0, from = out.length - offset; k < matchLength; k++) bytes[out.length++] = bytes[from + k]!;
        }
        if (stream.left !== 0) throw bad('zstd sequence stream');
    } else if (at !== end) throw bad('zstd sequences');
    const rest = literalCount - literalAt;
    out.reserve(rest);
    out.bytes.set(literals.subarray(literalAt), out.length);
    out.length += rest;
}
/**
 * Decompress Zstandard data: one or more frames, including skippable ones.
 * Frames that need a dictionary are refused.
 */
export function decompressZstd3D(source: Uint8Array, options: {readonly sizeHint?: number; readonly maxBytes?: number} = {}): Uint8Array {
    if (!(source instanceof Uint8Array)) throw bad('source');
    const max = options.maxBytes ?? COMPRESSION3D_LIMITS.maxOutputBytes, out = new Output(options.sizeHint ?? source.length * 4, max);
    const u32 = (at: number): number => (source[at]! | (source[at + 1]! << 8) | (source[at + 2]! << 16) | (source[at + 3]! << 24)) >>> 0;
    let at = 0, frames = 0;
    while (at < source.length) {
        if (at + 4 > source.length) throw bad('zstd frame');
        const magic = u32(at);
        at += 4;
        if ((magic & 0xfffffff0) >>> 0 === 0x184d2a50) {
            if (at + 4 > source.length) throw bad('zstd frame');
            at += 4 + u32(at);
            if (at > source.length) throw bad('zstd frame');
            continue;
        }
        if (magic !== 0xfd2fb528) throw bad('zstd magic number');
        if (at >= source.length) throw bad('zstd frame');
        const descriptor = source[at++]!, single = (descriptor & 32) !== 0, dictionary = descriptor & 3, sizeFlag = descriptor >> 6;
        if (descriptor & 8) throw bad('zstd frame header');
        if (!single) at += 1;   // window size: output is kept whole, so it is not needed
        if (dictionary !== 0) throw bad('zstd dictionaries are not supported');
        const sizeBytes = sizeFlag === 0 ? (single ? 1 : 0) : 1 << sizeFlag;
        if (at + sizeBytes > source.length) throw bad('zstd frame');
        let declared = -1;
        if (sizeBytes === 1) declared = source[at]!;
        else if (sizeBytes === 2) declared = (source[at]! | (source[at + 1]! << 8)) + 256;
        else if (sizeBytes === 4) declared = u32(at);
        else if (sizeBytes === 8) declared = u32(at) + u32(at + 4) * 4294967296;
        at += sizeBytes;
        if (declared > max) throw tooBig();
        if (declared > 0) out.reserve(declared);
        const frameStart = out.length, state: FrameState = {literals: undefined, ll: undefined, of: undefined, ml: undefined, offsets: [1, 4, 8]};
        for (let last = false; !last;) {
            if (at + 3 > source.length) throw bad('zstd block');
            const header = source[at]! | (source[at + 1]! << 8) | (source[at + 2]! << 16), size = header >> 3, kind = (header >> 1) & 3;
            last = (header & 1) === 1;
            at += 3;
            if (kind === 0) {
                if (at + size > source.length) throw bad('zstd block');
                out.reserve(size);
                out.bytes.set(source.subarray(at, at + size), out.length);
                out.length += size; at += size;
            } else if (kind === 1) {
                if (at >= source.length) throw bad('zstd block');
                out.reserve(size);
                out.bytes.fill(source[at]!, out.length, out.length + size);
                out.length += size; at += 1;
            } else if (kind === 2) {
                if (at + size > source.length) throw bad('zstd block');
                zstdBlock(source, at, at + size, out, frameStart, state);
                at += size;
            } else throw bad('zstd block type');
        }
        if (declared >= 0 && out.length - frameStart !== declared) throw bad('zstd frame size');
        if (descriptor & 4) at += 4;   // content checksum, not verified
        if (at > source.length) throw bad('zstd frame');
        frames++;
    }
    if (frames === 0) throw bad('zstd data holds no frame');
    return out.result();
}
