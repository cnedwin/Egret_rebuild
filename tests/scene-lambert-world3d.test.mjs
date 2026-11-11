// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImageData2D } from '@egret/contracts';
import { createMeshGeometry3D } from '@egret/engine/scene3d';
import { createSceneCamera3D, createSceneWorld3D } from '@egret/engine/scene3d/authoring';
import { createLambertSceneWorld3D } from '../packages/engine/dist/rendering/sceneWorld3D.js';
import { packSharedSceneLambertUniform3D } from '../packages/engine/dist/web/sharedSubmissionStorage2D.js';

const matrix = (x = 1, y = 1, z = 1) => [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1];
const geometry = createMeshGeometry3D({
  positions: [-1,-1,0, 1,-1,0, 0,1,0], colors: [1,1,1, 1,1,1, 1,1,1], indices: [0,1,2],
});
const source = createImageData2D({ width: 1, height: 1, pixels: Uint8Array.of(255,255,255,255) });
const sloped = Math.fround(Math.SQRT1_2);
const normals = Object.freeze([sloped,0,sloped, sloped,0,sloped, sloped,0,sloped]);
const surfaces = new Map([[geometry, Object.freeze({ source, texcoords: Object.freeze([0,0,1,0,.5,1]), normals })]]);
const light = { direction: [0,0,5], ambient: .25, intensity: .75 };
const camera = createSceneCamera3D({ eye: [0,0,5], target: [0,0,0], projection: {
  kind: 'orthographic', height: 5, aspect: 1, near: 1, far: 12,
} });
const node = (id, localMatrix) => ({ id, localMatrix, meshes: [geometry] });

test('Lambert normal transform preserves inverse-transpose and reflection independently', () => {
  const world = createLambertSceneWorld3D([node('normal', matrix(2,1,.5)), node('mirror', matrix(-2,1,.5))], surfaces, light);
  const frame = world.capture(camera);
  const [normal, mirror] = frame.draws;
  assert.deepEqual(normal.lambert.normalMatrix, [.25,0,0, 0,.5,0, 0,0,1]);
  assert.deepEqual(mirror.lambert.normalMatrix, [-.25,0,0, 0,.5,0, 0,0,1]);
  assert.equal(normal.lambert.mirrored, false);
  assert.equal(mirror.lambert.mirrored, true);
  assert.equal(normal.lambert.normals, mirror.lambert.normals);
  assert.equal(frame.geometries.length, 1);
  assert.deepEqual([frame.cpuLogicalBytes, frame.sceneBytes, frame.uniformBytes], [288,144,256]);
  const packed = packSharedSceneLambertUniform3D(mirror);
  assert.equal(packed.byteLength, 128);
  assert.deepEqual([...packed.slice(16)], [-.25,0,0,.25, 0,.5,0,-1, 0,0,1,0, 0,0,1,.75]);
  const revised = world.withLighting({ direction: [0,1,0], ambient: .125, intensity: .5 }).capture(camera);
  assert.equal(revised.draws[1].lambert.normalMatrix, mirror.lambert.normalMatrix);
  assert.deepEqual(revised.draws[1].lambert.lighting.direction, [0,1,0]);
  assert.deepEqual(world.capture(camera).draws[1].lambert.lighting.direction, [0,0,1]);
});

test('unstable Lambert transforms and light edits refuse without changing the saved world', () => {
  const world = createLambertSceneWorld3D([node('subject', matrix())], surfaces, light);
  for (const transform of [matrix(0,1,1), matrix(2 ** -20,1,1)]) {
    assert.throws(() => world.withNodeTransform('subject', transform), { code: 'SCENE3D_INPUT_INVALID' });
    assert.equal(createSceneWorld3D([node('ordinary', transform)]).capture(camera).draws.length, 1);
  }
  for (const edit of [{ ...light, direction: [0,0,0] }, { ...light, ambient: .5 }]) {
    assert.throws(() => world.withLighting(edit), { code: 'SCENE3D_INPUT_INVALID' });
  }
  assert.equal(world.capture(camera).draws[0].lambert.lighting.ambient, .25);
  const repeated = createLambertSceneWorld3D(Array.from({ length: 33 }, (_, i) => node('mesh-' + i, matrix())), surfaces, light);
  assert.throws(() => repeated.capture(camera), { code: 'SCENE3D_BUDGET' });
});
