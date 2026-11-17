// SPDX-License-Identifier: Apache-2.0
// Which point and spot lights a frame keeps when more are lit than the
// renderer draws, and the blended pass that non-normal blending asks for.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIGHT3D_LIMITS,
  RenderList3D,
  Scene3D,
  createPerspectiveCamera3D,
  createPointLight3D,
  createSpotLight3D,
  createStandardMaterial3D,
  createUnlitMaterial3D
} from '@egret/engine/world3d';

function sceneWithCamera() {
  const scene = new Scene3D();
  const camera = createPerspectiveCamera3D();
  camera.setPosition(0, 0, 0);
  scene.addChild(camera);
  return { scene, camera };
}

function lamp(scene, create, x, options = {}) {
  const light = create({ intensity: 1, ...options });
  light.name = `at ${x}`;
  light.setPosition(x, 0, 0);
  scene.addChild(light);
  return light;
}

test('LS01 the nearest point lights are kept when more are lit than the limit', () => {
  const { scene, camera } = sceneWithCamera();
  // Added far to near, so scene order alone would keep the farthest.
  const lamps = [];
  for (let i = LIGHT3D_LIMITS.maxPoint + 4; i > 0; i--) lamps.push(lamp(scene, createPointLight3D, i * 10));
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.equal(list.pointLights.length, LIGHT3D_LIMITS.maxPoint);
  const kept = new Set(list.pointLights);
  const nearest = lamps.slice(-LIGHT3D_LIMITS.maxPoint);
  assert.ok(nearest.every(light => kept.has(light)));
  assert.equal(list.stats.lightsDropped, 4);
  // Kept lights stay in scene order.
  assert.deepEqual(list.pointLights, nearest);
});

test('LS02 a light whose range reaches the camera outranks a brighter one that does not', () => {
  const { scene, camera } = sceneWithCamera();
  for (let i = 0; i < LIGHT3D_LIMITS.maxPoint; i++) lamp(scene, createPointLight3D, 5 + i, { intensity: 50, range: 2 });
  const reaching = lamp(scene, createPointLight3D, 30, { intensity: 1, range: 40 });
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.ok(list.pointLights.includes(reaching));
  assert.equal(list.pointLights.length, LIGHT3D_LIMITS.maxPoint);
});

test('LS03 spot lights are chosen the same way; within the limit nothing changes', () => {
  const { scene, camera } = sceneWithCamera();
  const spots = [];
  for (let i = LIGHT3D_LIMITS.maxSpot + 2; i > 0; i--) spots.push(lamp(scene, createSpotLight3D, i * 3));
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.deepEqual(list.spotLights, spots.slice(-LIGHT3D_LIMITS.maxSpot));
  assert.equal(list.stats.lightsDropped, 2);

  const small = sceneWithCamera();
  const few = [lamp(small.scene, createPointLight3D, 50), lamp(small.scene, createPointLight3D, 1)];
  list.build(small.scene, small.camera);
  assert.deepEqual(list.pointLights, few);
  assert.equal(list.stats.lightsDropped, 0);
});

test('LS04 unlit lights do not take a place', () => {
  const { scene, camera } = sceneWithCamera();
  for (let i = 0; i < LIGHT3D_LIMITS.maxPoint + 2; i++) lamp(scene, createPointLight3D, 1 + i, { intensity: 0 });
  const lit = lamp(scene, createPointLight3D, 100);
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.deepEqual(list.pointLights, [lit]);
  assert.equal(list.stats.lightsDropped, 0);
});

test('LS05 additive, multiply and premultiplied blending default to the blended pass', () => {
  for (const blending of ['additive', 'multiply', 'premultiplied']) {
    for (const create of [createStandardMaterial3D, createUnlitMaterial3D]) {
      const material = create({ blending });
      assert.equal(material.alphaMode, 'blend', `${create.name} ${blending}`);
      assert.equal(material.isTransparent, true);
      assert.equal(material.depthWrite, false);
    }
  }
  assert.equal(createStandardMaterial3D().alphaMode, 'opaque');
  assert.equal(createStandardMaterial3D({ blending: 'normal' }).alphaMode, 'opaque');
  assert.equal(createStandardMaterial3D({ blending: 'additive', alphaMode: 'opaque' }).alphaMode, 'opaque');
});
