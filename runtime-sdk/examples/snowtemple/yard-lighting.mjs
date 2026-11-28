// SPDX-License-Identifier: Apache-2.0
import {
  Mesh3D, createAmbientLight3D, createDirectionalLight3D, createGeometry3D,
  createHemisphereLight3D, createPointLight3D, createStandardMaterial3D
} from '@egret/engine/world3d';
import { ROUNDS } from './original/rules/arena.mjs';

const profile = Object.freeze({ mapSize: 1024 });
const stageControls = [
  ['Before hit', 74, 98, 116], ['Hit/step', 207, 98, 116], ['Shadows', 340, 98, 116],
  ['Hit light', 473, 98, 116], ['Play', 606, 98, 116]
];
function unpack(bytes) {
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vertices = source.getUint32(0, true), count = source.getUint32(4, true);
  if (!vertices || !count || vertices * 36 + count * 4 + 8 !== bytes.byteLength) throw new RangeError('Yard model lengths');
  const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), colors = new Float32Array(vertices * 3);
  const indices = new Uint32Array(count);
  let offset = 8;
  for (let i = 0; i < vertices; i++) {
    for (const attribute of [positions, normals, colors]) {
      for (let component = 0; component < 3; component++, offset += 4) {
        attribute[i * 3 + component] = source.getFloat32(offset, true);
      }
    }
  }
  for (let i = 0; i < count; i++, offset += 4) indices[i] = source.getUint32(offset, true);
  return createGeometry3D({ positions, normals, colors, indices });
}
function yardLamps() {
  const lamps = [];
  for (const { kind, x, z } of ROUNDS) {
    let spec;
    if (kind === 'stack' && x > 0) spec = [5, 0xff6a20, 15, 17, 0.4];
    if (kind === 'lantern') spec = [1.4, 0xffb66b, 11, 8.5, 0.1];
    if (kind === 'brazier') spec = [1.3, 0xff8f48, 20, 11, 0.25];
    if (kind === 'censer') spec = [2.6, 0xffb070, 30, 16, 0.2];
    if (spec) lamps.push({ x, z, spec, share: 0 });
  }
  return lamps;
}

export async function createYardLighting(scene, read) {
  const owned = [];
  const add = object => { owned.push(object); return scene.addChild(object); };
  const materials = [], geometry = [];
  function close() {
    for (const mesh of owned.splice(0)) mesh.removeFromParent();
    for (const resource of [...geometry.splice(0), ...materials.splice(0)]) resource.dispose();
  }
  try {
    for (const [file, options, casts] of [
      ['yard-ground.bin', { roughness: 0.82 }, false],
      ['yard-props.bin', { roughness: 0.85 }, true],
      ['yard-coals.bin', { roughness: 1, emissive: 0xff8a3a, emissiveIntensity: 1.66 }, false]
    ]) {
      const shape = unpack(await read(file));
      geometry.push(shape);
      const mat = createStandardMaterial3D({ ...options, vertexColors: true });
      materials.push(mat);
      const mesh = add(new Mesh3D(shape, mat));
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
    }
    scene.background = [0.012, 0.017, 0.034];
    scene.fog = { kind: 'exponential', color: [0.026, 0.036, 0.07], density: 0.016 };
    add(createHemisphereLight3D({ color: 0x8a9cbd, groundColor: 0x292c42, intensity: 0.32 }));
    add(createAmbientLight3D({ intensity: 0.055 }));
    const moon = add(createDirectionalLight3D({ color: 0xb6c8ec, intensity: 0.82, castShadow: true }));
    Object.assign(moon.shadow, { mapSize: 1024, extent: 24, near: 1, far: 90, cascades: 1 });
    const lamps = yardLamps();
    for (const lamp of lamps) {
      const [y, color, , range] = lamp.spec;
      lamp.light = add(createPointLight3D({ color, range, intensity: 0 }));
      lamp.light.setPosition(lamp.x, y, lamp.z);
    }
    const flashes = Array.from({ length: 2 }, () => ({
      light: add(createPointLight3D({ color: 0xffffff, intensity: 0, range: 8 })), left: 0, peak: 0
    }));
    let showHitLight = true, holdAt = null, lastHit = null;
    function reset() {
      holdAt = lastHit = null;
      moon.castShadow = true; showHitLight = true;
      for (const flash of flashes) { flash.left = flash.peak = 0; flash.light.visible = false; }
      for (const lamp of lamps) { lamp.share = 0; lamp.light.visible = false; }
    }
    function update(game, events, dt) {
      const { x, z } = game.hero;
      moon.setPosition(x - 17, 29, z - 9).lookAt(x, 0, z);
      const near = [...lamps].sort((a,b) => Math.hypot(a.x-x, a.z-z) - Math.hypot(b.x-x, b.z-z));
      near.forEach((lamp, i) => {
        const [, , peak, , flicker] = lamp.spec;
        lamp.share += ((i < 6 ? 1 : 0) - lamp.share) * Math.min(1, dt * 3);
        lamp.light.visible = i < 6 && lamp.share > 0;
        const wave = Math.sin(game.time * 11 + lamp.x) + Math.sin(game.time * 23 + lamp.z);
        lamp.light.intensity = peak * lamp.share * (1 + wave * flicker * 0.5);
      });
      materials[2].emissiveIntensity = 1.66 + Math.sin(game.time * 9) * 0.13;
      for (const event of events) {
        if (event.type !== 'hit' || event.source === 'fire') continue;
        const px = event.x - Math.sin(event.face) * 0.45, pz = event.z - Math.cos(event.face) * 0.45;
        const flash = flashes.reduce((a, b) => a.left < b.left ? a : b);
        flash.peak = event.source === 'riposte' ? 41 : event.heavy ? 26 : 12;
        flash.left = 0.16;
        flash.light.color.set([1, 0.8, 0.55]);
        flash.light.setPosition(px, 1.6, pz);
        lastHit = { id: event.id, source: event.source, amount: event.amount, x: px, z: pz };
      }
      for (const flash of flashes) {
        flash.left = Math.max(0, flash.left - dt);
        flash.light.intensity = flash.peak * (flash.left / 0.16) ** 1.5;
        flash.light.visible = showHitLight && flash.left > 0;
      }
    }
    function diagnostic(x, y, run) {
      if (Math.abs(y - 98) > 18) return false;
      const button = stageControls.findIndex(([, cx, , width]) => Math.abs(x - cx) <= width / 2);
      if (button < 0) return false;
      // Both checkpoint commands drive the original seeded simulation through step().
      // They never inject a hit, set actor positions or forge a damage event.
      if (button === 0 && run.tick <= 422) { run.command(2); holdAt = 422; }
      if (button === 1 && holdAt !== null && run.tick === holdAt) holdAt++;
      if (button === 2) moon.castShadow = !moon.castShadow;
      if (button === 3) {
        showHitLight = !showHitLight;
        for (const flash of flashes) flash.light.visible = showHitLight && flash.left > 0;
      }
      if (button === 4) holdAt = null;
      return true;
    }
    reset();
    return { controls: stageControls, shadows: profile, diagnostic, reset, close, update,
      held: tick => holdAt !== null && tick >= holdAt,
      state: () => ({ shadow: moon.castShadow, hitLight: showHitLight, holdAt, lastHit,
        flashIntensity: flashes.reduce((max, f) => Math.max(max, f.light.visible ? f.light.intensity : 0), 0) }) };
  } catch (error) { close(); throw error; }
}
