// SPDX-License-Identifier: Apache-2.0
// Built-in decoders of the World3D asset path: meshopt buffers, zlib and
// Zstandard streams, KTX2 supercompression, and the adapters for the official
// Draco and Basis Universal modules (exercised here with stand-in modules).
import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import {
  Mesh3D, World3DError, createBasisTranscoder3D, createDracoDecoder3D, decodeMeshopt3D, decompressZstd3D, inflate3D, loadGltf3D, parseKtx23D,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const u8 = values => new Uint8Array(values);
const as = (Type, bytes) => [...new Type(bytes.slice().buffer)];

/** Vertex stream writer for tests: every group picks the smallest of the four group encodings. */
function encodeVertices(bytes, count, stride) {
  const out = [0xa0], blockMax = Math.min(((8192 / stride) | 0) & ~15, 256), previous = new Uint8Array(stride);
  for (let first = 0; first < count; first += blockMax) {
    const block = Math.min(blockMax, count - first), aligned = (block + 15) & ~15;
    for (let k = 0; k < stride; k++) {
      const header = new Uint8Array(((aligned >> 4) + 3) >> 2), body = [];
      let p = previous[k];
      for (let group = 0; group < aligned; group += 16) {
        const deltas = [];
        for (let i = group; i < group + 16; i++) {
          if (i >= block) { deltas.push(0); continue; }
          const value = bytes[(first + i) * stride + k], signed = ((value - p + 128) & 255) - 128;
          deltas.push(((signed << 1) ^ (signed >> 31)) & 255); p = value;
        }
        const pack = bits => { const sentinel = (1 << bits) - 1, fixed = [], extra = []; for (let i = 0; i < 16; i += 8 / bits) { let byte = 0; for (let j = 0; j < 8 / bits; j++) { const d = deltas[i + j]; byte = (byte << bits) | (d >= sentinel ? sentinel : d); if (d >= sentinel) extra.push(d); } fixed.push(byte); } return [...fixed, ...extra]; };
        const choices = [deltas.every(d => d === 0) ? [] : undefined, pack(2), pack(4), deltas];
        let mode = 3;
        for (let m = 0; m < 3; m++) if (choices[m] && choices[m].length < choices[mode].length) mode = m;
        header[(group >> 4) >> 2] |= mode << (((group >> 4) & 3) * 2);
        body.push(...choices[mode]);
      }
      previous[k] = p;
      out.push(...header, ...body);
    }
  }
  for (let i = 0; i < Math.max(stride, 32); i++) out.push(0);
  return u8(out);
}

test('meshopt index streams decode to the published results', () => {
  // The triangle and sequence examples used by the reference implementation's own tests.
  const triangles = u8([0xe0, 0xf0, 0x10, 0xfe, 0xff, 0xf0, 0x0c, 0xff, 0x02, 0x02, 0x02, 0x00, 0x76, 0x87, 0x56, 0x67, 0x78, 0xa9, 0x86, 0x65, 0x89, 0x68, 0x98, 0x01, 0x69, 0x00, 0x00]);
  assert.deepEqual(as(Uint32Array, decodeMeshopt3D(triangles, 12, 4, 'TRIANGLES')), [0, 1, 2, 2, 1, 3, 4, 6, 5, 7, 8, 9]);
  assert.deepEqual(as(Uint16Array, decodeMeshopt3D(triangles, 12, 2, 'TRIANGLES')), [0, 1, 2, 2, 1, 3, 4, 6, 5, 7, 8, 9]);
  const sequence = u8([0xd1, 0x00, 0x04, 0xcd, 0x01, 0x04, 0x07, 0x98, 0x1f, 0x00, 0x00, 0x00, 0x00]);
  assert.deepEqual(as(Uint32Array, decodeMeshopt3D(sequence, 6, 4, 'INDICES')), [0, 1, 51, 2, 49, 1000]);
  assert.deepEqual(as(Uint16Array, decodeMeshopt3D(sequence, 6, 2, 'INDICES')), [0, 1, 51, 2, 49, 1000]);
  // Version 1 adds "one above" and "one below the last explicit index" codes (14 and 13) for the corner after a reused edge.
  // Traced by hand: a fresh triangle (0,1,2); its newest edge (0,2) with corner 0 + 1; then edge (0,1) with corner 1 - 1.
  const stepped = u8([0xe1, 0xfe, 0x0e, 0x0d, 0x00, ...new Array(16).fill(0)]);
  assert.deepEqual(as(Uint32Array, decodeMeshopt3D(stepped, 9, 4, 'TRIANGLES')), [0, 1, 2, 0, 2, 1, 0, 1, 0]);
  // Arbitrary triangles written with explicit indices only.
  const zigzag = delta => (delta << 1) ^ (delta >> 31), varint = value => { const bytes = []; do { bytes.push((value & 127) | (value > 127 ? 128 : 0)); value >>>= 7; } while (value > 0); return bytes; };
  const wanted = [100000, 3, 70000, 5, 5, 4, 0, 65536, 12];
  let last = 0;
  const data = [];
  for (let i = 0; i < wanted.length; i += 3) { data.push(0xff); for (const index of wanted.slice(i, i + 3)) { data.push(...varint(zigzag(index - last) >>> 0)); last = index; } }
  assert.deepEqual(as(Uint32Array, decodeMeshopt3D(u8([0xe0, 0xff, 0xff, 0xff, ...data, ...new Array(16).fill(0)]), 9, 4, 'TRIANGLES')), wanted);
  assert.throws(() => decodeMeshopt3D(triangles.subarray(0, 20), 12, 4, 'TRIANGLES'), code('WORLD3D_GLTF_INVALID'));
  assert.throws(() => decodeMeshopt3D(u8([0xe7, ...triangles.subarray(1)]), 12, 4, 'TRIANGLES'), code('WORLD3D_GLTF_INVALID'));
  assert.throws(() => decodeMeshopt3D(triangles, 12, 3, 'TRIANGLES'), code('WORLD3D_GLTF_INVALID'));
  assert.throws(() => decodeMeshopt3D(sequence.subarray(0, 9), 6, 4, 'INDICES'), code('WORLD3D_GLTF_INVALID'));
});

test('meshopt vertex streams decode every group encoding and apply filters', () => {
  // Four elements of four 16-bit values: (0,0,0,0) (300,0,0,0) (0,300,0,0) (300,300,0,0), worked out by hand:
  // per byte column, a header naming the 2-bit group form, four packed bytes, then the deltas too large to pack.
  const stream = u8([0xa0, 0x01, 0x3f, 0, 0, 0, 0x58, 0x57, 0x58, 0x01, 0x26, 0, 0, 0, 0x01, 0x0c, 0, 0, 0, 0x58, 0x01, 0x08, 0, 0, 0, 0, 0, 0, 0, ...new Array(32).fill(0)]);
  assert.deepEqual(as(Uint16Array, decodeMeshopt3D(stream, 4, 8, 'ATTRIBUTES')), [0, 0, 0, 0, 300, 0, 0, 0, 0, 300, 0, 0, 300, 300, 0, 0]);
  assert.throws(() => decodeMeshopt3D(stream.subarray(0, stream.length - 1), 4, 8, 'ATTRIBUTES'), code('WORLD3D_GLTF_INVALID'));
  assert.throws(() => decodeMeshopt3D(u8([0xb0, ...stream.subarray(1)]), 4, 8, 'ATTRIBUTES'), code('WORLD3D_GLTF_INVALID'));
  assert.throws(() => decodeMeshopt3D(stream, 4, 6, 'ATTRIBUTES'), code('WORLD3D_GLTF_INVALID'));
  // Data that makes the writer use all four group forms, across several blocks and an odd count.
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  for (const [count, stride] of [[1, 4], [17, 12], [1000, 16], [3000, 4], [700, 44]]) {
    const source = new Uint8Array(count * stride);
    for (let i = 0; i < source.length; i++) { const column = i % stride; source[i] = column === 0 ? 0 : column === 1 ? (i / stride) & 3 : column === 2 ? (i / stride * 5) & 255 : column === 3 ? random() * 256 : (random() * 12) | 0; }
    const packed = encodeVertices(source, count, stride);
    assert.deepEqual(decodeMeshopt3D(packed, count, stride, 'ATTRIBUTES'), source);
    assert.ok(count < 100 || packed.length < source.length, 'the writer really packed the easy columns');
  }
  // Filter inputs are the outputs the reference encoder publishes for these vectors.
  const filtered = (bytes, count, stride, filter) => decodeMeshopt3D(encodeVertices(bytes, count, stride), count, stride, 'ATTRIBUTES', filter);
  assert.deepEqual(as(Int8Array, filtered(u8([0x7f, 0, 0x7f, 0, 0, 0x81, 0x7f, 0, 0x3f, 0, 0x7f, 0x7f, 0x81, 0x40, 0x7f, 0x7f]), 4, 4, 'OCTAHEDRAL')), [127, 0, 0, 0, 0, -127, 0, 0, 89, 0, 91, 127, -89, 0, -91, 127]);
  const wide = new Uint8Array(new Uint16Array([0x7ff, 0, 0x7ff, 0, 0, 0xf801, 0x7ff, 0, 0x3ff, 0, 0x7ff, 0x7fff, 0xf801, 0x400, 0x7ff, 0x7fff]).buffer);
  assert.deepEqual(as(Int16Array, filtered(wide, 4, 8, 'OCTAHEDRAL')), [32767, 0, 0, 0, 0, -32767, 0, 0, 23158, 0, 23181, 32767, -23158, 0, -23181, 32767]);
  const turns = new Uint8Array(new Uint16Array([0, 0, 0, 0x7fc, 0, 0, 0, 0x7fd, 0x7ff, 0, 0, 0x7ff, 0x7ff, 0, 0, 0x7ff]).buffer);
  assert.deepEqual(as(Int16Array, filtered(turns, 4, 8, 'QUATERNION')), [32767, 0, 0, 0, 0, 32767, 0, 0, 23170, 0, 0, 23170, 23170, 0, 0, 23170]);
  const floats = new Uint8Array(new Uint32Array([0xf7000200, 0xf7ffd133, 0xf7ffffcd]).buffer);
  assert.deepEqual(as(Float32Array, filtered(floats, 3, 4, 'EXPONENTIAL')), [1, -23.400390625, -0.099609375]);
  assert.throws(() => filtered(turns, 8, 4, 'QUATERNION'), code('WORLD3D_GLTF_INVALID'));
  assert.throws(() => decodeMeshopt3D(u8([0xd1, 0, 0, 0, 0]), 0, 4, 'INDICES', 'OCTAHEDRAL'), code('WORLD3D_GLTF_INVALID'));
});

test('a meshopt-compressed glTF loads without a decoder hook', async () => {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
  const vertexStream = encodeVertices(new Uint8Array(positions.buffer), 4, 12);
  // Two triangles (0,1,2) and (2,1,3): a fresh triangle, then one that reuses its edge.
  const indexStream = u8([0xe1, 0xf0, 0x10, ...new Array(16).fill(0)]);
  const bin = new Uint8Array(vertexStream.length + indexStream.length);
  bin.set(vertexStream); bin.set(indexStream, vertexStream.length);
  const json = {
    asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}], nodes: [{mesh: 0, name: 'quad'}],
    extensionsUsed: ['EXT_meshopt_compression'], extensionsRequired: ['EXT_meshopt_compression'],
    meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1}]}],
    accessors: [{bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0]}, {bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR'}],
    bufferViews: [
      {buffer: 1, byteOffset: 0, byteLength: 48, byteStride: 12, extensions: {EXT_meshopt_compression: {buffer: 0, byteOffset: 0, byteLength: vertexStream.length, byteStride: 12, count: 4, mode: 'ATTRIBUTES'}}},
      {buffer: 1, byteOffset: 48, byteLength: 12, extensions: {EXT_meshopt_compression: {buffer: 0, byteOffset: vertexStream.length, byteLength: indexStream.length, byteStride: 2, count: 6, mode: 'TRIANGLES'}}},
    ],
    buffers: [{byteLength: bin.length, uri: 'quad.bin'}, {byteLength: 60, extensions: {EXT_meshopt_compression: {fallback: true}}}],
  };
  const asset = await loadGltf3D(new TextEncoder().encode(JSON.stringify(json)), {loadBuffer: async () => bin});
  const mesh = asset.scene.getObjectByName('quad');
  assert.ok(mesh instanceof Mesh3D);
  assert.deepEqual([...mesh.geometry.getAttribute('position').data], [...positions]);
  assert.deepEqual([...mesh.geometry.index.data], [0, 1, 2, 2, 1, 3]);
  asset.dispose();
});

test('zlib and Zstandard streams from the platform compressors decode exactly', () => {
  let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const samples = {
    empty: new Uint8Array(0), one: u8([7]), zeros: new Uint8Array(100000),
    text: new TextEncoder().encode('The quick brown fox jumps over the lazy dog. '.repeat(2000) + '白鹭引擎 world3d '.repeat(400)),
    noise: Uint8Array.from({length: 70000}, () => random() * 256 | 0),
    skewed: Uint8Array.from({length: 200000}, () => (random() * random() * random() * 40) | 0),
    ramp: Uint8Array.from({length: 300000}, (_, i) => ((i >> 2) % 256 + (random() < 0.02 ? random() * 8 : 0)) & 255),
    blocks: (() => { const a = new Uint8Array(16 * 4096); for (let i = 0; i < a.length; i += 16) { a[i] = random() * 4 | 0; a[i + 1] = random() * 256 | 0; a.fill(random() < 0.5 ? 0x55 : 0xaa, i + 2, i + 16); } return a; })(),
  };
  const same = (actual, expected, label) => { assert.equal(actual.length, expected.length, label); assert.ok(actual.every((value, i) => value === expected[i]), label); };
  for (const [name, data] of Object.entries(samples)) {
    for (const level of [1, 6, 9]) same(inflate3D(new Uint8Array(zlib.deflateSync(data, {level}))), data, `zlib ${name} level ${level}`);
    same(inflate3D(new Uint8Array(zlib.deflateRawSync(data)), {raw: true}), data, `deflate ${name}`);
    for (const level of [1, 3, 9, 19]) {
      const packed = zlib.zstdCompressSync(data, {params: {[zlib.constants.ZSTD_c_compressionLevel]: level, [zlib.constants.ZSTD_c_checksumFlag]: level === 3 ? 1 : 0}});
      same(decompressZstd3D(new Uint8Array(packed), {sizeHint: data.length}), data, `zstd ${name} level ${level}`);
    }
  }
  // Several frames in a row, with a skippable frame between them.
  const first = zlib.zstdCompressSync(samples.text), second = zlib.zstdCompressSync(samples.one);
  const joined = decompressZstd3D(u8([...first, 0x50, 0x2a, 0x4d, 0x18, 3, 0, 0, 0, 1, 2, 3, ...second]));
  assert.deepEqual([joined.length, joined[joined.length - 1]], [samples.text.length + 1, 7]);
  assert.throws(() => decompressZstd3D(u8([1, 2, 3, 4, 5, 6, 7, 8])), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => decompressZstd3D(new Uint8Array(first.subarray(0, first.length - 5))), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => decompressZstd3D(new Uint8Array(0)), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => decompressZstd3D(new Uint8Array(zlib.zstdCompressSync(samples.zeros)), {maxBytes: 1000}), code('WORLD3D_BUDGET'));
  assert.throws(() => inflate3D(u8([1, 2, 3, 4, 5, 6, 7])), code('WORLD3D_INPUT_INVALID'));
  const deflated = new Uint8Array(zlib.deflateSync(samples.text));
  assert.throws(() => inflate3D(deflated.subarray(0, deflated.length >> 1)), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => inflate3D(deflated, {maxBytes: 100}), code('WORLD3D_BUDGET'));
});

function ktx2(vkFormat, width, height, levels, supercompression, sizes) {
  const header = 80 + 24 * levels.length, total = header + levels.reduce((sum, level) => sum + level.length, 0), bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  [vkFormat, 1, width, height, 0, 0, 1, levels.length, supercompression].forEach((value, index) => view.setUint32(12 + index * 4, value, true));
  let offset = total;
  levels.forEach((level, index) => {
    offset -= level.length;
    bytes.set(level, offset);
    view.setBigUint64(80 + index * 24, BigInt(offset), true); view.setBigUint64(88 + index * 24, BigInt(level.length), true); view.setBigUint64(96 + index * 24, BigInt(sizes[index]), true);
  });
  return bytes;
}
test('KTX2 levels wrapped in Zstandard or zlib are unwrapped without a transcoder', async () => {
  const large = Uint8Array.from({length: 64}, (_, i) => i * 3 & 255), small = Uint8Array.from({length: 16}, (_, i) => 200 - i);
  for (const [scheme, pack] of [[2, data => new Uint8Array(zlib.zstdCompressSync(data))], [3, data => new Uint8Array(zlib.deflateSync(data))]]) {
    const result = await parseKtx23D(ktx2(145, 8, 8, [pack(large), pack(small)], scheme, [64, 16]));
    assert.deepEqual([result.source.format, result.colorSpace, result.source.levels.length], ['bc7', 'linear', 2]);
    assert.deepEqual([...result.source.levels[0]], [...large]); assert.deepEqual([...result.source.levels[1]], [...small]);
    const pixels = Uint8Array.from({length: 16}, (_, i) => i * 16);
    assert.deepEqual([...(await parseKtx23D(ktx2(43, 2, 2, [pack(pixels)], scheme, [16]))).source.data], [...pixels]);
    // A level that unpacks to a different size than the file states is refused.
    await assert.rejects(parseKtx23D(ktx2(145, 8, 8, [pack(large), pack(small)], scheme, [64, 12])), error => error instanceof World3DError);
  }
  // Basis Universal payloads still need the transcoder.
  await assert.rejects(parseKtx23D(ktx2(0, 4, 4, [new Uint8Array(12)], 1, [0])), code('WORLD3D_GLTF_UNSUPPORTED'));
});

test('the Draco and Basis adapters drive a decoder module and release what they take', async () => {
  // Stand-ins that follow the calling conventions of the official modules.
  const heap = new Uint8Array(4096), live = new Set(), freed = [];
  let top = 16;
  const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), colors = u8([255, 0, 0, 0, 255, 0, 0, 0, 255]);
  class Handle { constructor() { live.add(this); } }
  const draco = {
    TRIANGULAR_MESH: 1, DT_INT8: 1, DT_UINT8: 2, DT_INT16: 3, DT_UINT16: 4, DT_INT32: 5, DT_UINT32: 6, DT_FLOAT32: 9, HEAPU8: heap,
    _malloc(bytes) { const at = top; top += (bytes + 7) & ~7; live.add(at); return at; }, _free(at) { live.delete(at); freed.push(at); }, destroy(object) { live.delete(object); },
    DecoderBuffer: class extends Handle { Init(bytes, length) { this.kind = bytes[0]; assert.equal(length, bytes.length); } },
    Mesh: class extends Handle { num_points() { return 3; } num_faces() { return 1; } },
    Decoder: class extends Handle {
      GetEncodedGeometryType(buffer) { return buffer.kind; }
      DecodeBufferToMesh(buffer) { return {ok: () => buffer.kind === 1, error_msg: () => 'bad stream'}; }
      GetAttributeByUniqueId(mesh, id) { return {num_components: () => 3, id}; }
      GetAttributeDataArrayForAllPoints(mesh, attribute, type, bytes, at) { const source = attribute.id === 7 ? new Uint8Array(points.buffer) : colors; assert.equal(bytes, source.length); assert.equal(type, attribute.id === 7 ? 9 : 2); heap.set(source, at); return true; }
      GetTrianglesUInt32Array(mesh, bytes, at) { assert.equal(bytes, 12); heap.set(new Uint8Array(new Uint32Array([0, 1, 2]).buffer), at); return true; }
    },
  };
  const decode = createDracoDecoder3D(draco);
  const result = decode({bytes: u8([1, 9, 9]), attributes: {POSITION: 7, COLOR_0: 3}, componentTypes: {POSITION: 5126, COLOR_0: 5121}, indexComponentType: 5123});
  assert.deepEqual([[...result.attributes.POSITION], [...result.attributes.COLOR_0], [...result.indices]], [[...points], [...colors], [0, 1, 2]]);
  assert.ok(result.attributes.POSITION instanceof Float32Array && result.attributes.COLOR_0 instanceof Uint8Array && result.indices instanceof Uint16Array);
  assert.equal(result.attributes.POSITION.buffer !== heap.buffer, true);            // copied out of the module's memory
  assert.deepEqual([live.size, freed.length], [0, 3]);                               // every handle and allocation released
  assert.throws(() => decode({bytes: u8([0]), attributes: {}, componentTypes: {}, indexComponentType: undefined}), code('WORLD3D_GLTF_INVALID'));
  assert.equal(live.size, 0);
  assert.throws(() => createDracoDecoder3D({}), code('WORLD3D_INPUT_INVALID'));

  const calls = [];
  const basis = {
    initializeBasis() { calls.push('init'); },
    KTX2File: class {
      constructor(data) { this.data = data; calls.push('open'); }
      isValid() { return this.data[0] === 0xab; } getHasAlpha() { return true; } isUASTC() { return true; } startTranscoding() { return true; }
      getImageTranscodedSizeInBytes(level, layer, face, format) { return format === 13 ? 64 >> (level * 2) : 16 >> (level * 2) || 16; }
      transcodeImage(pixels, level, layer, face, format) { pixels.fill(format + level); return true; }
      close() { calls.push('close'); } delete() { calls.push('delete'); }
    },
  };
  const file = ktx2(0, 4, 4, [new Uint8Array(12)], 0, [0]);
  // A file whose descriptor marks sRGB: descriptor offset in the header, transfer function 14 bytes in.
  const tagged = new Uint8Array(file.length + 32); tagged.set(file); new DataView(tagged.buffer).setUint32(48, file.length, true); tagged[file.length + 14] = 2;
  const info = {vkFormat: 0, width: 4, height: 4, levelCount: 1, supercompression: 0, levels: [], file: tagged};
  const bc7Only = createBasisTranscoder3D(basis, format => format === 'bc7')(info);
  assert.deepEqual([bc7Only.source.format, bc7Only.colorSpace, bc7Only.source.levels[0][0]], ['bc7', 'srgb', 6]);
  const astc = createBasisTranscoder3D(basis, () => true)(info);
  assert.equal(astc.source.format, 'astc-4x4');                                      // UASTC prefers ASTC when the device has it
  const plain = createBasisTranscoder3D(basis, () => false)({...info, file});
  assert.deepEqual([plain.source.data.length, plain.source.data[0], plain.colorSpace], [64, 13, 'linear']);   // no compressed format: RGBA
  assert.deepEqual(calls.filter(name => name === 'open').length, calls.filter(name => name === 'delete').length);
  assert.throws(() => createBasisTranscoder3D(basis, () => true)({...info, file: new Uint8Array(100)}), code('WORLD3D_INPUT_INVALID'));
  assert.equal(calls.filter(name => name === 'open').length, calls.filter(name => name === 'delete').length);
  // The adapter plugs straight into the KTX2 reader.
  const viaReader = await parseKtx23D(ktx2(0, 4, 4, [new Uint8Array(12)], 1, [0]), {transcode: createBasisTranscoder3D(basis, format => format === 'bc3')});
  assert.equal(viaReader.source.format, 'bc3');
});
