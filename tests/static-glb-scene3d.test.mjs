// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { isSceneFrame3D } from '@egret/engine/scene3d';
import { createSceneCamera3D, loadStaticGlbScene3D, StaticGlb3DError } from '@egret/engine/scene3d/authoring';

function glb(edit = () => {}, editBinary = () => {}) {
  const binary = new Uint8Array(92);
  const values = new DataView(binary.buffer);
  const vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  for (const [index, value] of vertices.entries()) values.setFloat32(index * 4, value, true);
  for (let index = 0; index < 9; index++) values.setFloat32(36 + index * 4, [0.5, 1, 0.25][index % 3], true);
  for (let index = 0; index < 3; index++) {
    values.setUint16(72 + index * 2, index, true);
    values.setUint32(80 + index * 4, 2 - index, true);
  }
  const document = {
    asset: { version: '2.0', generator: 'Egret procedural 世界 fixture 100%' },
    extensionsUsed: ['KHR_materials_unlit'],
    extensionsRequired: ['KHR_materials_unlit'],
    buffers: [{ byteLength: 92 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 72, byteLength: 6, target: 34963 },
      { buffer: 0, byteOffset: 80, byteLength: 12, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
      { bufferView: 3, componentType: 5125, count: 3, type: 'SCALAR' },
    ],
    materials: [{ doubleSided: true, extensions: { KHR_materials_unlit: {} },
      pbrMetallicRoughness: { baseColorFactor: [0.5, 0.5, 1, 1] } }],
    meshes: [{ primitives: [
      { attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2, material: 0 },
      { attributes: { POSITION: 0 }, indices: 3, material: 0 },
    ] }],
    nodes: [
      { translation: [1, 2, 0], children: [1, 2] },
      { translation: [2, 0, 0], mesh: 0 },
      { matrix: [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, -1, 0, 0, 1], mesh: 0 },
    ],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  edit(document);
  editBinary(values);
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binLength = 92;
  const bytes = new Uint8Array(28 + jsonLength + binLength);
  const header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, bytes.length, true);
  header.setUint32(12, jsonLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jsonLength);
  bytes.set(json, 20);
  header.setUint32(20 + jsonLength, binLength, true);
  header.setUint32(24 + jsonLength, 0x004e4942, true);
  bytes.set(binary.subarray(0, binLength), 28 + jsonLength);
  return bytes;
}

const failure = code => error => error instanceof StaticGlb3DError && error.code === code;
const encodeSrgb = value => 1.055 * value ** (1 / 2.4) - 0.055;

test('public static GLB preserves nested transforms, mesh sharing, index formats, and linear colors', () => {
  const original = glb();
  const container = new Uint8Array(original.length + 13);
  container.set(original, 7);
  const scene = loadStaticGlbScene3D(container.subarray(7, 7 + original.length));
  container.fill(0);
  assert.equal(scene.nodeCount, 3);
  const camera = createSceneCamera3D({ eye: [0, 0, 10], target: [0, 0, 0],
    projection: { kind: 'orthographic', height: 4, aspect: 1, near: 1, far: 17 } });
  const frame = scene.capture(camera);
  assert.equal(isSceneFrame3D(frame), true);
  assert.equal(frame.draws.length, 4);
  assert.equal(frame.geometries.length, 2);
  assert.equal(frame.draws[0].geometry, frame.draws[2].geometry);
  assert.equal(frame.draws[1].geometry, frame.draws[3].geometry);
  assert.deepEqual(frame.geometries[0].indices, [0, 1, 2]);
  assert.deepEqual(frame.geometries[1].indices, [2, 1, 0]);
  assert.deepEqual(frame.geometries[0].colors.slice(0, 3), [0.25, 0.5, 0.25].map(value => Math.fround(encodeSrgb(value))));
  assert.deepEqual(frame.draws[0].mvp.slice(12, 14), [1.5, 1]);
  assert.deepEqual(frame.draws[2].mvp.slice(12, 14), [0, 1]);
  assert.equal(frame.draws[2].mvp[0], 1);
});

test('GLB refuses unsupported profile features instead of silently projecting them', () => {
  const edits = [
    document => { document.buffers[0].uri = 'mesh.bin'; },
    document => { document.extensionsRequired.push('KHR_draco_mesh_compression'); },
    document => { document.materials[0].doubleSided = false; },
    document => { document.materials[0].alphaMode = 'MASK'; },
    document => { delete document.materials[0].extensions; },
    document => { document.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 }; },
    document => { document.accessors[0].sparse = {}; },
    document => { document.bufferViews[0].byteStride = 16; },
    document => { document.meshes[0].primitives[0].mode = 5; },
    document => { document.meshes[0].primitives[0].attributes.TEXCOORD_0 = 1; },
  ];
  for (const edit of edits) assert.throws(() => loadStaticGlbScene3D(glb(edit)), failure('SCENE3D_GLB_UNSUPPORTED'));
});

test('GLB refuses malformed chunks, transforms, references, and numeric data', () => {
  const malformed = glb().subarray(0, 35);
  assert.throws(() => loadStaticGlbScene3D(malformed), failure('SCENE3D_GLB_INVALID'));
  for (const edit of [
    document => { document.nodes[1].children = [0]; },
    document => { document.nodes[0].children = [1, 2, 1]; },
    document => { document.nodes[2].translation = [0, 0, 0]; },
    document => { document.nodes[1].rotation = [0, 0, 0, 0]; },
    document => { document.accessors[0].byteOffset = 4; },
    document => { document.accessors[0].max = [2, 1, 0]; },
    document => { delete document.extensionsUsed; },
    document => { document.accessors[0].bufferView = 20; },
  ]) assert.throws(() => loadStaticGlbScene3D(glb(edit)), failure('SCENE3D_GLB_INVALID'));
  for (const edit of [
    view => view.setUint16(72, 3, true),
    view => view.setFloat32(0, NaN, true),
    view => view.setFloat32(36, -0.5, true),
  ]) assert.throws(() => loadStaticGlbScene3D(glb(undefined, edit)), failure('SCENE3D_GLB_INVALID'));
});

test('GLB admits fixed file and geometry quotas before allocating payloads', () => {
  assert.throws(() => loadStaticGlbScene3D(new Uint8Array(8 * 1024 * 1024 + 1)), failure('SCENE3D_GLB_BUDGET'));
  assert.throws(() => loadStaticGlbScene3D(glb(document => { document.accessors[0].count = 65537; })),
    failure('SCENE3D_GLB_BUDGET'));
});

test('GLB bytes use genuine cross-realm typed-array storage and ignore shadowed fields', () => {
  const bytes = glb();
  const foreign = runInNewContext('new Uint8Array(source)', { source: bytes });
  let reads = 0;
  for (const name of ['byteOffset', 'byteLength', 'buffer', Symbol.toStringTag]) {
    Object.defineProperty(foreign, name, { get() { reads++; throw Error('shadow metadata'); } });
  }
  assert.equal(loadStaticGlbScene3D(foreign).nodeCount, 3);
  assert.equal(reads, 0);
  const shared = new Uint8Array(new SharedArrayBuffer(bytes.length));
  shared.set(bytes);
  const resizable = new Uint8Array(new ArrayBuffer(bytes.length, { maxByteLength: bytes.length + 1 }));
  resizable.set(bytes);
  const detached = bytes.slice();
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const candidate of [shared, resizable, detached, new Uint8ClampedArray(bytes), new DataView(bytes.buffer),
    Object.create(Uint8Array.prototype), new Proxy(bytes, {})]) {
    assert.throws(() => loadStaticGlbScene3D(candidate), error => failure('SCENE3D_GLB_INVALID')(error) && error.field === 'GLB bytes');
  }
});
