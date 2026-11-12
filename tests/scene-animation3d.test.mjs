// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImageData2D } from '@egret/contracts';
import { createMeshGeometry3D, isSceneFrame3D } from '@egret/engine/scene3d';
import { createSceneAnimationClip3D, createSceneCamera3D, createSceneWorld3D } from '@egret/engine/scene3d/authoring';
import { createLambertSceneWorld3D } from '../packages/engine/dist/rendering/sceneWorld3D.js';

const translation = (x = 0, y = 0, z = 0) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
const camera = createSceneCamera3D({
  eye: [0,0,5], target: [0,0,0],
  projection: { kind: 'orthographic', height: 2, aspect: 1, near: 0, far: 16 },
});
const mesh = createMeshGeometry3D({
  positions: [-.5,-.5,0, .5,-.5,0, 0,.5,0],
  colors: [1,0,0, 1,0,0, 1,0,0], indices: [0,1,2],
});
const key = (timeSeconds, offset = [0,0,0], rotation = [0,0,0,1], scale = [1,1,1]) =>
  ({ timeSeconds, translation: offset, rotation, scale });
const track = (nodeId, keys, interpolation = 'linear') => ({ nodeId, interpolation, keys });
const makeClip = (...tracks) => createSceneAnimationClip3D({ tracks });
const actor = { id: 'actor', localMatrix: translation(), meshes: [mesh] };
const position = world => world.capture(camera).draws[0].mvp.slice(12, 14);

test('linear interpolation samples multiple local tracks in the same hierarchy revision', () => {
  const world = createSceneWorld3D([
    { ...actor, parentId: 'room', localMatrix: translation(-2) },
    { id: 'room', localMatrix: translation(9) },
  ]);
  const before = world.capture(camera);
  const clip = makeClip(
    track('room', [key(0), key(2, [4,0,0])]),
    track('actor', [key(0, [1,0,0]), key(2, [3,2,0])]),
  );
  assert.equal(clip.durationSeconds, 2);
  const middle = clip.sample(world, 1);
  const frame = middle.capture(camera);
  assert.equal(isSceneFrame3D(frame), true);
  assert.deepEqual(position(middle), [4,1]);
  assert.equal(frame.draws[0].geometry, before.draws[0].geometry);
  assert.deepEqual(world.capture(camera).draws, before.draws);
  assert.deepEqual(position(world), [7,0]);
});

test('linear rotation uses the short quaternion arc while scale interpolates componentwise', () => {
  const world = createSceneWorld3D([actor]);
  const clip = makeClip(track('actor', [
    key(0, [0,0,0], [0,0,0,2], [1,2,1]),
    key(2, [0,0,0], [0,0,-1,-1], [3,4,1]),
  ]));
  const { mvp } = clip.sample(world, 1).capture(camera).draws[0];
  const observed = [mvp[0], mvp[1], mvp[4], mvp[5]];
  const expected = [2,2,-3,3].map(value => value * Math.SQRT1_2);
  expected.forEach((value, index) => assert.ok(Math.abs(observed[index] - value) < 1e-6));
});

test('step switches at exact keys, once clamps and loop wraps the global duration', () => {
  const world = createSceneWorld3D([actor]);
  const clip = makeClip(track('actor', [
    key(1, [1,0,0]), key(2, [2,0,0]), key(4, [3,0,0]),
  ], 'step'));
  assert.equal(clip.durationSeconds, 4);
  assert.deepEqual(position(clip.sample(world, 0)), [1,0]);
  assert.deepEqual(position(clip.sample(world, 1.999)), [1,0]);
  assert.deepEqual(position(clip.sample(world, 2)), [2,0]);
  assert.deepEqual(position(clip.sample(world, 4)), [3,0]);
  assert.deepEqual(position(clip.sample(world, 8)), [3,0]);
  assert.deepEqual(position(clip.sample(world, 4, 'loop')), [1,0]);
  assert.deepEqual(position(clip.sample(world, 6, 'loop')), [2,0]);
  const constant = makeClip(track('actor', [key(0, [5,0,0])]));
  assert.equal(constant.durationSeconds, 0);
  assert.deepEqual(position(constant.sample(world, 30, 'loop')), [5,0]);
});

test('clips snapshot caller-owned arrays and can seek repeatedly from the same world', () => {
  const first = key(0, [1,0,0]);
  const last = key(2, [3,0,0]);
  const tracks = [track('actor', [first, last])];
  const clip = createSceneAnimationClip3D({ tracks });
  first.translation[0] = 11;
  last.timeSeconds = 200;
  last.rotation[3] = 0;
  last.scale[0] = 8;
  tracks[0].nodeId = 'missing';
  tracks.length = 0;
  const world = createSceneWorld3D([actor]);
  const mid = clip.sample(world, 1);
  assert.equal(clip.durationSeconds, 2);
  assert.deepEqual(position(mid), [2,0]);
  assert.deepEqual(position(clip.sample(world, 2)), [3,0]);
  assert.deepEqual(position(clip.sample(world, 0)), [1,0]);
  assert.deepEqual(position(mid), [2,0]);
  assert.deepEqual(position(world), [0,0]);
});

test('empty and invalid batch edits preserve the original world', () => {
  const world = createSceneWorld3D([actor, { id: 'room', localMatrix: translation() }]);
  assert.equal(world.withNodeTransforms([]), world);
  const valid = { id: 'actor', localMatrix: translation(3) };
  for (const invalid of [
    { id: 'actor', localMatrix: translation(4) },
    { id: 'missing', localMatrix: translation() },
    { id: 'room', localMatrix: [1,0,0,0] },
  ]) {
    assert.throws(() => world.withNodeTransforms([valid, invalid]));
    assert.deepEqual(position(world), [0,0]);
  }
  const edit = translation(3);
  const changed = world.withNodeTransforms([{ id: 'actor', localMatrix: edit }]);
  edit[12] = 22;
  assert.deepEqual(position(changed), [3,0]);
  const partial = makeClip(track('actor', [key(0, [5,0,0])]), track('missing', [key(0)]));
  assert.throws(() => partial.sample(world, 0));
  assert.deepEqual(position(world), [0,0]);
});

test('clip admission rejects duplicate targets, bad times and unsafe transforms', () => {
  const single = track('actor', [key(0)]);
  for (const tracks of [
    [],
    [single, single],
    [track('actor', [key(1), key(1)])],
    [track('actor', [key(2), key(1)])],
    [track('actor', [key(Infinity)])],
    [track('actor', [key(0, [NaN,0,0])])],
    [track('actor', [key(0, [0,0,0], [0,0,0,0])])],
    [track('actor', [key(0, [0,0,0], [0,0,0,1], [0,1,1])])],
    [track('actor', [key(0), key(1, [0,0,0], [0,0,0,1], [-1,1,1])])],
    Array.from({ length: 257 }, (_, index) => track(String(index), [key(0)])),
  ]) assert.throws(() => createSceneAnimationClip3D({ tracks }));
  const world = createSceneWorld3D([actor]);
  const clip = makeClip(single);
  assert.throws(() => clip.sample(world, -1));
  assert.throws(() => clip.sample(world, NaN));
  assert.throws(() => clip.sample(world, 0, 'invalid'));
});

test('sampling a Lambert scene retains material and lighting and recomputes its normal matrix', () => {
  const source = createImageData2D({ width: 1, height: 1, pixels: Uint8Array.of(255,255,255,255) });
  const surfaces = new Map([[mesh, Object.freeze({
    source,
    texcoords: Object.freeze([0,0,1,0,.5,1]),
    normals: Object.freeze([0,0,1, 0,0,1, 0,0,1]),
  })]]);
  const world = createLambertSceneWorld3D([actor], surfaces, { direction: [0,0,1], ambient: .25, intensity: .75 });
  const clip = makeClip(track('actor', [key(0), key(2, [2,0,0], [0,0,0,1], [2,1,.5])]));
  const revised = clip.sample(world, 2);
  const before = world.capture(camera).draws[0];
  const moved = revised.capture(camera).draws[0];
  assert.deepEqual(position(revised), [2,0]);
  assert.equal(moved.geometry, before.geometry);
  assert.equal(moved.texture.source, source);
  assert.equal(moved.lambert.normals, before.lambert.normals);
  assert.deepEqual(moved.lambert.normalMatrix, [.25,0,0, 0,.5,0, 0,0,1]);
  const relit = revised.withLighting({ direction: [0,1,0], ambient: .125, intensity: .5 });
  assert.deepEqual(relit.capture(camera).draws[0].lambert.lighting.direction, [0,1,0]);
  assert.deepEqual(before.lambert.normalMatrix, [1,0,0, 0,1,0, 0,0,1]);
});
