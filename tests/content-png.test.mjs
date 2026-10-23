// SPDX-License-Identifier: Apache-2.0
// Original literal scanlines/pixels; fixture compression and CRC use public Node zlib.
// This is offline Node/pngjs qualification, not browser/device or process-RSS evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { crc32, deflateSync } from 'node:zlib';

const moduleUrl = new URL('../tools/content/png.mjs', import.meta.url);
const api = existsSync(moduleUrl) ? await import(moduleUrl.href) : {};
function decode(source) {
  assert.equal(typeof api.decodeContentPng, 'function', 'finite offline PNG decoder must exist');
  return api.decodeContentPng(source);
}
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function word(value) { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; }
function chunk(type, payload = Buffer.alloc(0)) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  return Buffer.concat([word(payload.length), body, word(crc32(body))]);
}
function ihdr({ width = 1, height = 1, depth = 8, color = 6, compression = 0, filter = 0, interlace = 0 } = {}) {
  return chunk('IHDR', Buffer.concat([word(width), word(height), Buffer.from([depth, color, compression, filter, interlace])]));
}
const end = chunk('IEND');
const rgbaRaw = Buffer.from([0, 19, 37, 73, 0]);
const compressed = deflateSync(rgbaRaw);
const srgb = chunk('sRGB', Buffer.from([0]));
const gamma = chunk('gAMA', word(45455));
const chroma = chunk('cHRM', Buffer.concat([31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000].map(word)));
function png({ header = ihdr(), before = [], data = compressed, after = [], tail = Buffer.alloc(0) } = {}) {
  return Buffer.concat([signature, header, ...before, chunk('IDAT', data), ...after, end, tail]);
}
function refuse(bytes, code) {
  assert.throws(() => decode(bytes), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.code, 'CONTENT_PNG_' + code);
    assert.ok(error.message.length > 15, 'actionable error message');
    return true;
  });
}

test('installed decoder qualification uses Node 26.7.0 and exact pngjs 7.0.0', () => {
  assert.equal(process.versions.node, '26.7.0');
  const require = createRequire(import.meta.url);
  assert.equal(JSON.parse(readFileSync(require.resolve('pngjs/package.json'), 'utf8')).version, '7.0.0');
});
test('public PNG surface exports only the finite decoder', () => {
  assert.deepEqual(Object.keys(api), ['decodeContentPng']);
});
test('RGBA transparent RGB is retained in owned straight-alpha bytes and source stays intact', () => {
  const source = png(), original = Buffer.from(source);
  const output = decode(source);
  assert.deepEqual(Object.keys(output).sort(), ['height', 'rgba', 'scanlineBytes', 'width']);
  assert.ok(Object.isFrozen(output));
  assert.equal(output.width, 1); assert.equal(output.height, 1); assert.equal(output.scanlineBytes, 5);
  assert.ok(output.rgba instanceof Uint8Array);
  assert.deepEqual([...output.rgba], [19, 37, 73, 0]);
  assert.deepEqual(source, original);
  output.rgba[0] = 88;
  assert.deepEqual([...decode(source).rgba], [19, 37, 73, 0]);
  source.fill(0);
  assert.deepEqual([...output.rgba], [88, 37, 73, 0]);
});
test('RGB is expanded to RGBA with literal alpha 255, top-left tight rows', () => {
  const raw = Buffer.from([0, 1, 2, 3, 4, 5, 6, 0, 9, 8, 7, 6, 5, 4]);
  const output = decode(png({ header: ihdr({ width: 2, height: 2, color: 2 }), data: deflateSync(raw) }));
  assert.equal(output.width, 2); assert.equal(output.height, 2); assert.equal(output.scanlineBytes, 14);
  assert.deepEqual([...output.rgba], [1, 2, 3, 255, 4, 5, 6, 255, 9, 8, 7, 255, 6, 5, 4, 255]);
});
const topRow = [0, 10, 20, 30, 40, 50, 60, 70, 80];
for (const [filter, row] of [
  [0, [3, 5, 7, 9, 20, 30, 40, 50]],
  [1, [3, 5, 7, 9, 17, 25, 33, 41]],
  [2, [249, 241, 233, 225, 226, 226, 226, 226]],
  [3, [254, 251, 248, 245, 250, 254, 2, 6]],
  [4, [249, 241, 233, 225, 226, 226, 10, 10]],
]) test('public codec maps independently authored PNG filter ' + filter, () => {
  const output = decode(png({ header: ihdr({ width: 2, height: 2 }), data: deflateSync(Buffer.from([...topRow, filter, ...row])) }));
  assert.equal(output.scanlineBytes, 18);
  assert.deepEqual([...output.rgba], [10, 20, 30, 40, 50, 60, 70, 80, 3, 5, 7, 9, 20, 30, 40, 50]);
});
for (const before of [[srgb], [srgb, gamma], [srgb, chroma], [srgb, gamma, chroma], [chroma, gamma, srgb]]) {
  test('admitted color metadata preserves encoded samples: ' + before.map(bytes => bytes.toString('ascii', 4, 8)).join(','), () => {
    assert.deepEqual([...decode(png({ before })).rgba], [19, 37, 73, 0]);
  });
}
for (const intent of [1, 2, 3]) test('sRGB intent ' + intent + ' is admitted', () => {
  assert.deepEqual([...decode(png({ before: [chunk('sRGB', Buffer.from([intent]))] })).rgba], [19, 37, 73, 0]);
});
test('consecutive IDAT includes empty pieces and exact subarray views are accepted', () => {
  const bytes = Buffer.concat([signature, ihdr(), chunk('IDAT', compressed.subarray(0, 3)), chunk('IDAT'), chunk('IDAT', compressed.subarray(3)), end]);
  const surrounding = Buffer.concat([Buffer.from([0, 1]), bytes, Buffer.from([2, 3])]);
  assert.deepEqual([...decode(new Uint8Array(surrounding.buffer, surrounding.byteOffset + 2, bytes.length)).rgba], [19, 37, 73, 0]);
});
for (const [name, source] of [
  ['null', null], ['object callback', { decode() {} }], ['string', 'PNG'], ['array', [137, 80]],
  ['Uint8ClampedArray', new Uint8ClampedArray(8)], ['DataView', new DataView(new ArrayBuffer(8))],
  ['shared bytes', new Uint8Array(new SharedArrayBuffer(8))], ['resizable bytes', new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 }))],
]) test('rejects non-owned-input profile ' + name, () => refuse(source, 'INPUT'));
test('rejects detached bytes', () => {
  const source = new Uint8Array(8); structuredClone(source.buffer, { transfer: [source.buffer] }); refuse(source, 'INPUT');
});
test('intrinsic capture does not invoke shadowed byte-view properties', () => {
  const source = new Uint8Array(png());
  for (const name of ['buffer', 'byteOffset', 'byteLength', 'length']) {
    Object.defineProperty(source, name, { get() { assert.fail('source getter must not execute: ' + name); } });
  }
  assert.deepEqual([...decode(source).rgba], [19, 37, 73, 0]);
});
test('rejects optional decode ports or callbacks rather than calling them', () => {
  assert.throws(() => api.decodeContentPng(png(), { decode() { assert.fail('decode port must not run'); } }),
    { code: 'CONTENT_PNG_INPUT' });
});
for (const [name, bytes] of [
  ['bad signature', Buffer.from([0, 80, 78, 71, 13, 10, 26, 10])],
  ['incomplete chunk', Buffer.concat([signature, Buffer.from([0, 0, 0])])],
  ['oversized chunk length', Buffer.concat([signature, word(0x80000000), Buffer.from('IHDR'), Buffer.alloc(4)])],
  ['missing header', Buffer.concat([signature, chunk('IDAT', compressed), end])],
  ['missing end', Buffer.concat([signature, ihdr(), chunk('IDAT', compressed)])],
  ['duplicate header', png({ before: [ihdr()] })], ['nonempty end', Buffer.concat([signature, ihdr(), chunk('IDAT', compressed), chunk('IEND', Buffer.from([0]))])],
  ['duplicate end', png({ tail: end })], ['byte after end', png({ tail: Buffer.from([0]) })],
  ['no IDAT', Buffer.concat([signature, ihdr(), end])], ['empty IDAT', png({ data: Buffer.alloc(0) })],
  ['zero width', png({ header: ihdr({ width: 0 }) })], ['zero height', png({ header: ihdr({ height: 0 }) })],
  ['short IHDR', png({ header: chunk('IHDR', Buffer.alloc(12)) })],
  ['lowercase reserved chunk bit', png({ before: [chunk('abcd')] })],
  ['non-letter chunk', png({ before: [chunk('ab1D')] })],
  ['metadata after IDAT', png({ after: [srgb] })], ['duplicate metadata', png({ before: [srgb, srgb] })],
  ['short sRGB', png({ before: [chunk('sRGB')] })], ['short gAMA', png({ before: [chunk('gAMA', Buffer.alloc(3))] })],
  ['short cHRM', png({ before: [chunk('cHRM', Buffer.alloc(31))] })],
  ['split IDAT', Buffer.concat([signature, ihdr(), chunk('IDAT', compressed.subarray(0, 3)), chunk('aaAA'), chunk('IDAT', compressed.subarray(3)), end])],
]) test('rejects structural fault ' + name, () => refuse(bytes, 'STRUCTURE'));
for (const [name, bytes] of [
  ['interlace', png({ header: ihdr({ interlace: 1 }) })], ['16-bit', png({ header: ihdr({ depth: 16 }) })],
  ['palette', png({ header: ihdr({ color: 3 }) })], ['grayscale', png({ header: ihdr({ color: 0 }) })],
  ['compression method', png({ header: ihdr({ compression: 1 }) })], ['filter method', png({ header: ihdr({ filter: 1 }) })],
  ['tRNS', png({ before: [chunk('tRNS', Buffer.alloc(6))] })], ['PLTE', png({ before: [chunk('PLTE', Buffer.alloc(3))] })],
  ['APNG', png({ before: [chunk('acTL', Buffer.alloc(8))] })], ['unknown ancillary', png({ before: [chunk('aaAA')] })],
  ['unknown critical', png({ before: [chunk('ABCD')] })], ['text', png({ before: [chunk('tEXt', Buffer.from('x'))] })],
  ['gamma without sRGB', png({ before: [gamma] })], ['chroma without sRGB', png({ before: [chroma] })],
  ['gamma incompatible', png({ before: [srgb, chunk('gAMA', word(45454))] })], ['sRGB invalid intent', png({ before: [chunk('sRGB', Buffer.from([4]))] })],
  ['chroma incompatible', png({ before: [srgb, chunk('cHRM', Buffer.alloc(32))] })],
]) test('rejects unsupported profile ' + name, () => refuse(bytes, 'PROFILE'));
for (const type of ['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM']) test('checks CRC for admitted ' + type, () => {
  const bytes = png({ before: [srgb, gamma, chroma] });
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('ascii', at + 4, at + 8) === type) { bytes[at + 8 + length] ^= 1; break; }
    at += length + 12;
  }
  refuse(bytes, 'CRC');
});
const badChecksum = Buffer.from(compressed); badChecksum[badChecksum.length - 1] ^= 1;
for (const [name, data] of [
  ['extra scanline', deflateSync(Buffer.from([...rgbaRaw, ...rgbaRaw]))],
  ['one byte short scanline', deflateSync(rgbaRaw.subarray(0, 4))], ['empty decompressed bytes', deflateSync(Buffer.alloc(0))],
  ['truncated zlib', compressed.subarray(0, compressed.length - 1)], ['bad checksum', badChecksum],
  ['trailing zlib garbage', Buffer.concat([compressed, Buffer.from([0])])],
  ['second compressed stream', Buffer.concat([compressed, deflateSync(Buffer.from([0]))])], ['invalid zlib', Buffer.from([1, 2, 3])],
]) test('strict zlib preflight refuses ' + name, () => refuse(png({ data }), 'INFLATE'));
test('invalid PNG row filter is an actionable codec refusal', () => refuse(png({ data: deflateSync(Buffer.from([5, 19, 37, 73, 0])) }), 'DECODE'));
for (const dimensions of [{ width: 4097 }, { height: 4097 }, { width: 1025, height: 1024 }]) {
  test('rejects dimension/pixel bound ' + JSON.stringify(dimensions), () => refuse(png({ header: ihdr(dimensions) }), 'LIMIT'));
}
test('accepts exactly 1048576 RGBA pixels and reports exact two-pass work unit', () => {
  const raw = Buffer.alloc(4195328);
  const output = decode(png({ header: ihdr({ width: 1024, height: 1024 }), data: deflateSync(raw) }));
  assert.equal(output.scanlineBytes, 4195328); assert.equal(output.rgba.length, 4194304);
  assert.equal(output.width, 1024); assert.equal(output.height, 1024); assert.ok(output.rgba.every(value => value === 0));
});
test('accepts maximum 4096 edge within pixel capacity', () => {
  const output = decode(png({ header: ihdr({ width: 4096 }), data: deflateSync(Buffer.alloc(16385)) }));
  assert.equal(output.width, 4096); assert.equal(output.height, 1); assert.equal(output.scanlineBytes, 16385);
});
test('accepts maximum height and maximum raw scanline length for the finite profile', () => {
  const output = decode(png({ header: ihdr({ width: 256, height: 4096 }), data: deflateSync(Buffer.alloc(4198400)) }));
  assert.equal(output.width, 256); assert.equal(output.height, 4096); assert.equal(output.scanlineBytes, 4198400);
  assert.equal(output.rgba.length, 4194304); assert.ok(output.rgba.every(value => value === 0));
});
function withChunkCount(count) {
  return Buffer.concat([signature, ihdr(), ...Array.from({ length: count - 3 }, () => chunk('IDAT')), chunk('IDAT', compressed), end]);
}
test('admits exactly 1024 chunks', () => assert.deepEqual([...decode(withChunkCount(1024)).rgba], [19, 37, 73, 0]));
test('refuses 1025 chunks', () => refuse(withChunkCount(1025), 'LIMIT'));
test('refuses more than 8 MiB encoded before parsing', () => refuse(new Uint8Array(8388609), 'LIMIT'));
test('exact 8 MiB reaches framing rather than encoded-size refusal', () => refuse(new Uint8Array(8388608), 'STRUCTURE'));
