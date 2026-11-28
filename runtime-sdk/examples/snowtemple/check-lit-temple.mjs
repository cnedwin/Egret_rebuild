// SPDX-License-Identifier: Apache-2.0
// Run in a prepared --lit-temple project using --import ./vendor/node-register.mjs.
// The image stub exposes dimensions only. Pixel and presentation results use the real browser and APK.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadGltf3D } from '@egret/engine/world3d';
import { openScene } from './profile.mjs';

const assets = [];
const read = async file => new Uint8Array(await readFile(new URL(file, import.meta.url)));
const game = await openScene({
  bytes: read,
  async glb(file) {
    const asset = await loadGltf3D(await read(file), {
      async decodeImage({ bytes }) {
        const png = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return { width: png.getUint32(16), height: png.getUint32(20) };
      }
    });
    assets.push(asset);
    return asset;
  }
});
const tap = (x, y) => game.input({ type: 'down', x, y, id: 1 });
function project(x,y,z) {
  const ndc = game.camera.worldToScreenPoint(new Float32Array(3), [x,y,z]);
  return [Math.round((1 + ndc[0]) * 384), Math.round((1 - ndc[1]) * 216)];
}
try {
  tap(74, 98);
  for (let i = 0; i < 455; i++) game.update(1 / 60);
  assert.equal(game.state().tick, 422);
  assert.equal(game.state().lighting.lastHit, null);
  tap(207, 98);
  game.update(1 / 60);
  const hit = game.state();
  assert.equal(hit.tick, 423);
  assert.equal(hit.enemy.hp, 71);
  assert.equal(hit.lighting.lastHit.id, 3);
  assert.equal(hit.lighting.lastHit.amount, 13);
  assert(hit.lighting.flashIntensity > 0);
  tap(340, 98);
  assert.equal(game.state().lighting.shadow, false);
  tap(473, 98);
  assert.equal(game.state().lighting.flashIntensity, 0);
  tap(340, 98);
  tap(473, 98);
  assert.deepEqual(game.state(), hit);
  game.camera.updateViewMatrices();
  const h=hit.hero, enemy=hit.enemy, lamp=hit.lighting.lastHit;
  const probes = {
    heroFoot: project(h.x, 0, h.z), targetFoot: project(enemy.x, 0, enemy.z),
    impact: project(lamp.x, 1.6, lamp.z), projectedHeroShadow: project(h.x + 1.8*17/29, 0, h.z + 1.8*9/29)
  };
  tap(606, 98);
  game.update(1 / 60);
  assert.equal(game.state().tick, 424);
  tap(384, 26);
  assert.equal(game.state().tick, 0);
  assert.equal(game.state().lighting.lastHit, null);
  console.log(JSON.stringify({ tick: hit.tick, target: hit.enemy.id, damage: hit.lighting.lastHit.amount, probes }));
} finally {
  game.close();
  for (const asset of assets) asset.dispose();
}
