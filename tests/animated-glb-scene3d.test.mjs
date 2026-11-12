// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { isSceneFrame3D } from '@egret/engine/scene3d';
import {
  createSceneCamera3D, loadAnimatedGlbScene3D, loadStaticGlbScene3D, StaticGlb3DError,
} from '@egret/engine/scene3d/authoring';

const FLOAT = 5126;
const rotationOffset = 76;
const scaleOffset = 108;
const indicesOffset = 132;

function glb(edit = () => {}, editBinary = () => {}) {
  const binary = new Uint8Array(140);
  const view = new DataView(binary.buffer);
  const write = (offset, data) => data.forEach((value, index) => view.setFloat32(offset + 4 * index, value, true));
  write(0, [0, 0, 0, 1, 0, 0, 0, 1, 0]);
  write(36, [1, 3]);
  write(44, [0, 2]);
  write(52, [2, 0, 0, 6, 0, 0]);
  write(rotationOffset, [0, 0, 0, 1, 0, 0, 1, 0]);
  write(scaleOffset, [1, 1, 1, 2, 3, 1]);
  for (let index = 0; index < 3; index++) view.setUint16(indicesOffset + 2 * index, index, true);

  const document = {
    asset: { version: '2.0', generator: 'Egret animated hierarchy fixture' },
    extensionsUsed: ['KHR_materials_unlit'],
    extensionsRequired: ['KHR_materials_unlit'],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 8 },
      { buffer: 0, byteOffset: 44, byteLength: 8 },
      { buffer: 0, byteOffset: 52, byteLength: 24 },
      { buffer: 0, byteOffset: rotationOffset, byteLength: 32 },
      { buffer: 0, byteOffset: scaleOffset, byteLength: 24 },
      { buffer: 0, byteOffset: indicesOffset, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: FLOAT, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: FLOAT, count: 2, type: 'SCALAR', min: [1], max: [3] },
      { bufferView: 2, componentType: FLOAT, count: 2, type: 'SCALAR', min: [0], max: [2] },
      { bufferView: 3, componentType: FLOAT, count: 2, type: 'VEC3' },
      { bufferView: 4, componentType: FLOAT, count: 2, type: 'VEC4' },
      { bufferView: 5, componentType: FLOAT, count: 2, type: 'VEC3' },
      { bufferView: 6, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    materials: [{ doubleSided: true, extensions: { KHR_materials_unlit: {} } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 6, material: 0 }] }],
    nodes: [
      { mesh: 0, scale: [1, 2, 1], children: [1] },
      { mesh: 0, translation: [0, 1, 0] },
    ],
    scenes: [{ nodes: [0] }],
    scene: 0,
    animations: [{
      name: 'Travel and turn',
      samplers: [
        { input: 1, output: 3, interpolation: 'LINEAR' },
        { input: 2, output: 4 },
        { input: 2, output: 5, interpolation: 'STEP' },
      ],
      channels: [
        { sampler: 0, target: { node: 0, path: 'translation' } },
        { sampler: 1, target: { node: 1, path: 'rotation' } },
        { sampler: 2, target: { node: 1, path: 'scale' } },
      ],
    }],
  };
  edit(document);
  editBinary(view);
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(28 + jsonLength + binary.length);
  const header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, bytes.length, true);
  header.setUint32(12, jsonLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jsonLength);
  bytes.set(json, 20);
  header.setUint32(20 + jsonLength, binary.length, true);
  header.setUint32(24 + jsonLength, 0x004e4942, true);
  bytes.set(binary, 28 + jsonLength);
  return bytes;
}

const camera = createSceneCamera3D({
  eye: [0, 0, 10], target: [0, 0, 0],
  projection: { kind: 'orthographic', height: 16, aspect: 1, near: 1, far: 17 },
});
const failure = code => error => error instanceof StaticGlb3DError && error.code === code;

function pose(world, rootX, childBasis) {
  const frame = world.capture(camera);
  assert(isSceneFrame3D(frame));
  assert.equal(frame.draws.length, 2);
  assert.equal(frame.geometries.length, 1);
  assert.equal(frame.draws[0].geometry, frame.draws[1].geometry);
  const [root, child] = frame.draws;
  // The projection scales world-space X and Y by 1/8. The child's unanimated Y offset
  // inherits the parent's Y scale, while its rotation and scale affect only its basis.
  assert.deepEqual(root.mvp.slice(12, 14), [rootX / 8, 0]);
  assert.deepEqual(child.mvp.slice(12, 14), [rootX / 8, 1 / 4]);
  assert.deepEqual([root.mvp[0], root.mvp[1], root.mvp[4], root.mvp[5]], [1 / 8, 0, 0, 1 / 4]);
  const basis = [child.mvp[0], child.mvp[1], child.mvp[4], child.mvp[5]];
  for (const [index, expected] of childBasis.entries()) {
    assert(Math.abs(basis[index] - expected) < 1e-6, 'Child basis component ' + index);
  }
  return frame;
}

const authoredBasis = [1 / 8, 0, 0, 1 / 4];
const quarterTurnBasis = [0, 1 / 4, -1 / 8, 0];
const endBasis = [-1 / 4, 0, 0, -3 / 4];

test('animated GLB composes independent LINEAR and STEP channels with authored hierarchy defaults', () => {
  const source = glb();
  const storage = new Uint8Array(source.length + 11);
  storage.set(source, 7);
  const result = loadAnimatedGlbScene3D(storage.subarray(7, 7 + source.length));
  storage.fill(0);

  const { world, clips } = result;
  assert.equal(world.nodeCount, 2);
  assert.equal(clips.length, 1);
  const [clip] = clips;
  assert.equal(clip.name, 'Travel and turn');
  assert.equal(clip.durationSeconds, 3);
  assert(Object.isFrozen(result) && Object.isFrozen(clips) && Object.isFrozen(clip));

  const baseFrame = pose(world, 0, authoredBasis);
  pose(clip.sample(0), 2, authoredBasis);
  pose(clip.sample(1), 2, quarterTurnBasis);
  pose(clip.sample(1.5), 3, [-Math.SQRT1_2 / 8, Math.SQRT1_2 / 4, -Math.SQRT1_2 / 8, -Math.SQRT1_2 / 4]);
  const stepFrame = pose(clip.sample(2), 4, endBasis);
  pose(clip.sample(10), 6, endBasis);
  pose(clip.sample(3, 'loop'), 2, authoredBasis);
  pose(clip.sample(4, 'loop'), 2, quarterTurnBasis);
  pose(clip.sample(1), 2, quarterTurnBasis);
  assert.equal(stepFrame.geometries[0], baseFrame.geometries[0]);
  pose(world, 0, authoredBasis);
});

test('animated GLB clips sample from the original world independently', () => {
  const result = loadAnimatedGlbScene3D(glb(document => {
    document.animations.push({
      samplers: [{ input: 2, output: 4 }],
      channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } }],
    });
  }));
  const [first, second] = result.clips;
  assert.equal(second.name, undefined);
  assert.equal(second.durationSeconds, 2);
  pose(first.sample(2), 4, endBasis);
  pose(second.sample(2), 0, [-1 / 8, 0, 0, -1 / 4]);
  pose(first.sample(2), 4, endBasis);
  pose(result.world, 0, authoredBasis);
});

test('animated GLB accepts a static file without widening the static loader profile', () => {
  const bytes = glb(document => { delete document.animations; });
  const animated = loadAnimatedGlbScene3D(bytes);
  assert.deepEqual(animated.clips, []);
  const frame = pose(animated.world, 0, authoredBasis);
  assert.deepEqual(loadStaticGlbScene3D(bytes).capture(camera), frame);
  assert.throws(() => loadStaticGlbScene3D(glb()), failure('SCENE3D_GLB_UNSUPPORTED'));
});

test('animated GLB rejects malformed targets, sampler references, and key data', () => {
  const invalid = failure('SCENE3D_GLB_INVALID');
  for (const edit of [
    document => { document.animations[0].channels[0].target.node = 99; },
    document => { document.animations[0].channels[0].sampler = 99; },
    document => { document.animations[0].samplers[0].input = 99; },
    document => { document.animations[0].channels.push(document.animations[0].channels[0]); },
    document => { document.accessors[1].max = [4]; },
    document => { document.accessors[3].count = 1; },
    document => { document.nodes[1].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1];
      delete document.nodes[1].translation; },
  ]) assert.throws(() => loadAnimatedGlbScene3D(glb(edit)), invalid);
  for (const editBinary of [
    view => view.setFloat32(40, 1, true),
    view => view.setFloat32(40, 0.5, true),
    view => view.setFloat32(36, NaN, true),
    view => view.setFloat32(52, Infinity, true),
    view => view.setFloat32(rotationOffset + 12, 0, true),
  ]) assert.throws(() => loadAnimatedGlbScene3D(glb(undefined, editBinary)), invalid);
});

test('animated GLB explicitly refuses out-of-profile interpolation, paths, and scales', () => {
  const unsupported = failure('SCENE3D_GLB_UNSUPPORTED');
  assert.throws(() => loadAnimatedGlbScene3D(glb(document => {
    document.animations[0].samplers[0].interpolation = 'CUBICSPLINE';
  })), unsupported);
  assert.throws(() => loadAnimatedGlbScene3D(glb(document => {
    document.animations[0].channels[0].target.path = 'weights';
  })), unsupported);
  assert.throws(() => loadAnimatedGlbScene3D(glb(document => {
    document.animations[0].samplers[2].interpolation = 'LINEAR';
  }, view => view.setFloat32(scaleOffset + 12, -2, true))), unsupported);
});

test('animated GLB refuses animation data in a geometry buffer view', () => {
  assert.throws(() => loadAnimatedGlbScene3D(glb(document => {
    delete document.bufferViews[0].target;
    document.accessors[3].bufferView = 0;
  })), failure('SCENE3D_GLB_INVALID'));
});

test('animated GLB enforces clip and key bounds before reading key payloads', () => {
  const budget = failure('SCENE3D_GLB_BUDGET');
  assert.throws(() => loadAnimatedGlbScene3D(glb(document => {
    document.animations = Array(33).fill(document.animations[0]);
  })), budget);
  assert.throws(() => loadAnimatedGlbScene3D(glb(document => {
    document.accessors[1].count = 8193;
  })), budget);
});
