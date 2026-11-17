// SPDX-License-Identifier: Apache-2.0
// Point lights past the eight a frame lights directly: which go to the tiled
// list, and which screen tiles each one is listed in.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIGHT3D_LIMITS,
  RenderList3D,
  Scene3D,
  createPerspectiveCamera3D,
  createPointLight3D
} from '@egret/engine/world3d';
import { TILED_LIGHTS_3D, writeTiledLights3D } from '../packages/engine/dist/web/world3d/frame3D.js';
import { FRAME_BLOCK_FLOATS_3D, FRAME_OFFSETS_3D } from '../packages/engine/dist/web/world3d/frame3D.js';

function setup() {
  const scene = new Scene3D();
  const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1 });
  scene.addChild(camera);
  return { scene, camera };
}
function lamp(scene, x, y, z, range = 2) {
  const light = createPointLight3D({ intensity: 1, range });
  light.setPosition(x, y, z);
  scene.addChild(light);
  return light;
}
// The tiles a light is listed in, as [column, row] pairs.
function tilesOf(table, data, index) {
  const tilesX = data[FRAME_OFFSETS_3D.tileGrid],
    tilesY = data[FRAME_OFFSETS_3D.tileGrid + 1];
  const found = [];
  for (let t = 0; t < tilesX * tilesY; t++) {
    const header = (TILED_LIGHTS_3D.headerBase + t) * 4,
      start = table[header],
      count = table[header + 1];
    for (let k = 0; k < count; k++)
      if (table[TILED_LIGHTS_3D.indexBase * 4 + start + k] === index) found.push([t % tilesX, Math.floor(t / tilesX)]);
  }
  return found;
}

test('TL01 lights past the eight go to the tiled list, nearest first, instead of being dropped', () => {
  const { scene, camera } = setup();
  const lamps = [];
  for (let i = 20; i > 0; i--) lamps.push(lamp(scene, 0, 0, -i * 3));
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.equal(list.pointLights.length, LIGHT3D_LIMITS.maxPoint);
  assert.equal(list.tiledPointLights.length, 20 - LIGHT3D_LIMITS.maxPoint);
  assert.equal(list.stats.lightsDropped, 0);
  // Nearest of the rest first: lamps were added far to near.
  assert.deepEqual(list.tiledPointLights, lamps.slice(0, 12).reverse());
  assert.ok(list.tiledPointLights.every(light => !list.pointLights.includes(light)));

  list.tiledLights = false;
  list.build(scene, camera);
  assert.equal(list.tiledPointLights.length, 0);
  assert.equal(list.stats.lightsDropped, 12);
});

test('TL02 the tiled list holds at most 256 lights; the rest are counted as dropped', () => {
  const { scene, camera } = setup();
  for (let i = 0; i < 300; i++) lamp(scene, (i % 20) - 10, Math.floor(i / 20) - 7, -20);
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.equal(list.tiledPointLights.length, LIGHT3D_LIMITS.maxTiledPoint);
  assert.equal(list.stats.lightsDropped, 300 - LIGHT3D_LIMITS.maxPoint - LIGHT3D_LIMITS.maxTiledPoint);
});

test('TL03 a light is listed in the tiles its reach covers, in the row order the backend asks for', () => {
  const { scene, camera } = setup();
  const upperLeft = lamp(scene, -3, 3, -10, 1);
  const behind = lamp(scene, 0, 0, 10, 1);
  const around = lamp(scene, 0, 0, -0.5, 2);
  camera.updateViewMatrices();
  for (const light of [upperLeft, behind, around]) light.updateWorldMatrix();
  const data = new Float32Array(FRAME_BLOCK_FLOATS_3D);
  const table = new Float32Array(TILED_LIGHTS_3D.width * TILED_LIGHTS_3D.rows * 4);
  const lights = [upperLeft, behind, around];

  assert.equal(writeTiledLights3D(data, table, lights, camera.viewProjectionMatrix, 256, 256, false), 3);
  assert.deepEqual([...data.subarray(FRAME_OFFSETS_3D.tileGrid, FRAME_OFFSETS_3D.tileGrid + 4)], [8, 8, 32, 0]);
  // Rows count from the bottom: the upper left light sits in high rows, low columns.
  const up = tilesOf(table, data, 0);
  assert.ok(up.length > 0 && up.length < 16);
  assert.ok(up.every(([x, y]) => x < 4 && y >= 4));
  assert.deepEqual(tilesOf(table, data, 1), []);
  // A light whose reach takes in the camera covers every tile.
  assert.equal(tilesOf(table, data, 2).length, 64);
  // The light's place, reach and colour times intensity.
  assert.deepEqual([...table.subarray(0, 8)], [-3, 3, -10, 1, 1, 1, 1, 0]);

  // Rows from the top, as WebGPU's fragment positions count them: the same tiles mirrored.
  writeTiledLights3D(data, table, lights, camera.viewProjectionMatrix, 256, 256, true, 16, 24);
  const down = tilesOf(table, data, 0);
  assert.deepEqual(down.map(([x, y]) => `${x},${7 - y}`).sort(), up.map(([x, y]) => `${x},${y}`).sort());
  assert.equal(data[FRAME_OFFSETS_3D.tileGrid + 3], 16);
  assert.equal(data[FRAME_OFFSETS_3D.tileInfo + 3], 24);

  // No lights clears the grid, so the shader loop does nothing.
  assert.equal(writeTiledLights3D(data, table, [], camera.viewProjectionMatrix, 256, 256, false), 0);
  assert.equal(data[FRAME_OFFSETS_3D.tileInfo], 0);
});

test('TL04 a large viewport uses larger tiles so the table never overflows', () => {
  const { scene, camera } = setup();
  const light = lamp(scene, 0, 0, -0.5, 2);
  camera.updateViewMatrices();
  light.updateWorldMatrix();
  const data = new Float32Array(FRAME_BLOCK_FLOATS_3D);
  const table = new Float32Array(TILED_LIGHTS_3D.width * TILED_LIGHTS_3D.rows * 4);
  writeTiledLights3D(data, table, [light], camera.viewProjectionMatrix, 7680, 4320, false);
  const tilesX = data[FRAME_OFFSETS_3D.tileGrid],
    tilesY = data[FRAME_OFFSETS_3D.tileGrid + 1];
  assert.ok(tilesX * tilesY <= TILED_LIGHTS_3D.maxTiles);
  assert.equal(data[FRAME_OFFSETS_3D.tileGrid + 2], 128);
});

test('TL05 partial-height viewports assign a light to the tile in fragment row order', () => {
  const { scene, camera } = setup();
  camera.aspect = 128 / 65;
  const light = lamp(scene, 0, -1.35, -6, 0.35);
  camera.updateViewMatrices();
  light.updateWorldMatrix();
  const data = new Float32Array(FRAME_BLOCK_FLOATS_3D);
  const table = new Float32Array(TILED_LIGHTS_3D.width * TILED_LIGHTS_3D.rows * 4);

  // Its reach occupies bottom-origin row 0, but top-origin row 1, with a partial third tile.
  writeTiledLights3D(data, table, [light], camera.viewProjectionMatrix, 128, 65, false, 9, 17);
  const bottomUp = tilesOf(table, data, 0);
  assert.ok(bottomUp.length > 0 && bottomUp.every(([, row]) => row === 0));

  writeTiledLights3D(data, table, [light], camera.viewProjectionMatrix, 128, 65, true, 9, 17);
  assert.deepEqual(
    tilesOf(table, data, 0),
    bottomUp.map(([column]) => [column, 1])
  );
  assert.equal(data[FRAME_OFFSETS_3D.tileGrid + 3], 9);
  assert.equal(data[FRAME_OFFSETS_3D.tileInfo + 3], 17);
});
