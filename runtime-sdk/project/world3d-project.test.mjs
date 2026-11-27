// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Scene3D,
  Attribute3D,
  Geometry3D,
  Bone3D,
  Skeleton3D,
  Mesh3D,
  InstancedMesh3D,
  Texture3D,
  createPerspectiveCamera3D,
  createBoxGeometry3D,
  createStandardMaterial3D,
  createDirectionalLight3D
} from '@egret/engine/world3d';
import { createWorldProjectEncoder } from './world3d-frame.mjs';
import { installWorld3DPlayerProject } from './world3d-player.mjs';

function fixture() {
  const scene = new Scene3D(),
    camera = createPerspectiveCamera3D({ fov: 55, aspect: 16 / 9, near: 0.1, far: 500 });
  camera.position[2] = 8;
  const material = createStandardMaterial3D({ color: 0xe8453c, roughness: 0.75 });
  const geometry = createBoxGeometry3D(1, 1, 1),
    mesh = new Mesh3D(geometry, material);
  scene.addChild(mesh);
  scene.addChild(createDirectionalLight3D({ color: 0xffffff, intensity: 2.4 }));
  const hud = new Uint8Array(24);
  const header = new DataView(hud.buffer);
  [0x32524745, 17, 960, 540, 0, 0].forEach((n, i) => header.setUint32(4 * i, n, true));
  return { scene, camera, geometry, material, mesh, hud };
}
test('native World3D carries current indexed meshes, camera/light and a transparent live HUD', () => {
  const data = fixture(),
    encode = createWorldProjectEncoder();
  const another = new Mesh3D(data.geometry, data.material);
  another.position[0] = 2;
  data.scene.addChild(another);
  const frame = encode(data, data.hud),
    view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  assert.deepEqual(
    [0, 4, 8, 12, 16].map((p) => view.getUint32(p, true)),
    [0x31443345, 17, 24, 1, 2]
  );
  assert.deepEqual(frame.subarray(-24), data.hud);
  const vertices = view.getUint32(164, true),
    indices = view.getUint32(168, true);
  assert.equal(vertices, data.geometry.getAttribute('position').count);
  assert.equal(indices, data.geometry.index.count);
  assert.equal(view.getFloat32(96, true), 8);
  const draw = 172 + 24 * vertices + 4 * indices;
  assert.equal(view.getUint32(draw, true), data.geometry.id);
  assert.equal(view.getFloat32(draw + 80, true), 0.75);
  const original = frame.slice();
  const positions = data.geometry.getAttribute('position');
  positions.data[0] += 0.03125;
  positions.touch();
  const changed = encode(data, data.hud);
  assert.notDeepEqual(changed, original);
  assert.deepEqual(frame, original);
  another.visible = false;
  assert.equal(new DataView(encode(data, data.hud).buffer).getUint32(16, true), 1);
});
test('native World3D keeps isolated HUD effects through ordinary and recovery composition', () => {
  const data = fixture(), encode = createWorldProjectEncoder();
  // A transparent HUD containing one isolated group with a one-pixel blur.
  const hud = new Uint8Array(56);
  hud.set(data.hud);
  const packet = new DataView(hud.buffer);
  packet.setUint32(0, 0x36524745, true);
  packet.setUint32(20, 2, true);
  packet.setUint32(24, 128, true);
  packet.setUint32(28, 2, true);
  packet.setFloat32(40, 960, true);
  packet.setFloat32(44, 540, true);
  packet.setFloat32(48, 1, true);
  packet.setUint32(52, 129, true);
  const pages = new Map();
  assert.deepEqual(encode(data, hud, pages, 1, -1).subarray(-hud.length), hud);
  packet.setUint32(4, 18, true);
  assert.deepEqual(encode(data, hud, pages, 1, 17).subarray(-hud.length), hud);
  assert.deepEqual(encode.recover(1, 18).subarray(-hud.length), hud);
});

test('a profile mismatch or invalid HUD is reported before crossing the device bridge', () => {
  const data = fixture(),
    encode = createWorldProjectEncoder();
  data.material.alphaMode = 'blend';
  assert.throws(() => encode(data, data.hud), /World3D/);
  data.material.alphaMode = 'opaque';
  const instances = new InstancedMesh3D(data.geometry, data.material, 2);
  data.scene.addChild(instances);
  assert.throws(() => encode(data, data.hud), /World3D/);
  data.scene.removeChild(instances);
  data.hud[16] = 255;
  assert.throws(() => encode(data, data.hud), /HUD/);
});

test('the Android player fits the camera to a landscape stage before World3D frustum culling', () => {
  const data = fixture();
  data.camera.aspect = 1;
  const frame = createWorldProjectEncoder()(data, data.hud);
  const matrix = new DataView(frame.buffer);
  assert.equal(data.camera.aspect, 960 / 540);
  assert.ok(Math.abs(matrix.getFloat32(24, true) * (960 / 540) - matrix.getFloat32(44, true)) < 1e-6);
});

test('textured draws name a live page and keep UV versions independent of positions', () => {
  const data = fixture(),
    map = new Texture3D({ width: 1, height: 1, data: new Uint8Array(4) }, { flipY: false });
  data.material.map = map;
  data.material.side = 'double';
  const pages = new Map([[map.source, 7]]),
    encode = createWorldProjectEncoder();
  const packet = () => new DataView(encode(data, data.hud, pages).buffer);
  const v = packet();
  assert.equal(v.getUint32(0, true), 0x32443345);
  const draw = 172 + 32 * v.getUint32(164, true) + 4 * v.getUint32(168, true);
  assert.equal(v.getUint32(draw + 88, true), 7);
  assert.equal(v.getUint32(draw + 92, true), 1);
  const uv = data.geometry.getAttribute('uv');
  uv.data[0] = 0.3125;
  uv.touch();
  assert.equal(packet().getFloat32(172 + 24, true), 0.3125);
  pages.clear();
  assert.throws(packet, /page/i);
  pages.set(map.source, 7);
  map.wrapS = 'mirror';
  assert.throws(packet, /sampl/i);
});

function capture(data, encode, frameId, epoch, previousFrameId, pages) {
  new DataView(data.hud.buffer).setUint32(4, frameId, true);
  const packet = encode(data, data.hud, pages, epoch, previousFrameId);
  return new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
}

test('camera motion reuses only a drawn geometry table in the same device epoch', () => {
  const data = fixture(), encode = createWorldProjectEncoder();
  const first = capture(data, encode, 0, 3, -1);
  assert.equal(first.getUint32(0, true), 0x31443345);
  data.camera.setPosition(0, 0, 9);
  const next = capture(data, encode, 1, 3, 0);
  assert.equal(next.getUint32(0, true), 0x33443345);
  assert.equal(next.getUint32(12, true), 0);
  assert.equal(next.getUint32(160, true), 0);
  assert.equal(next.getUint32(164, true), data.geometry.id);
  assert.equal(next.getFloat32(96, true), 9);
  assert.equal(next.byteLength, 164 + 88 + data.hud.length);
  // A dropped submission and an unsolicited EGL replacement both require a checkpoint.
  assert.equal(capture(data, encode, 2, 3, 0).getUint32(0, true), 0x31443345);
  assert.equal(capture(data, encode, 3, 4, 2).getUint32(0, true), 0x31443345);
  const recovery = capture(data, encode, 4, 4, -1);
  const replay = capture(data, createWorldProjectEncoder(), 4);
  assert.deepEqual(new Uint8Array(recovery.buffer), new Uint8Array(replay.buffer));
});

test('a textured delta defines changed or returning geometry and preserves the complete draw and HUD', () => {
  const data = fixture(), encode = createWorldProjectEncoder();
  const map = new Texture3D({width: 1, height: 1, data: new Uint8Array(4)}, {flipY: false});
  data.material.map = map;
  const pages = new Map([[map.source, 3]]);
  const extra = new Mesh3D(createBoxGeometry3D(0.5, 0.5, 0.5), data.material);
  data.scene.addChild(extra);
  const frame = (i, ack) => capture(data, encode, i, 1, ack, pages);
  assert.equal(frame(0, -1).getUint32(0, true), 0x32443345);
  const unchanged = frame(1, 0);
  assert.equal(unchanged.getUint32(0, true), 0x34443345);
  assert.equal(unchanged.getUint32(12, true), 0);
  assert.equal(unchanged.byteLength, 164 + 2 * 96 + data.hud.length);
  const uv = extra.geometry.getAttribute('uv');
  uv.data[0] = 0.4375;
  uv.touch();
  const changed = frame(2, 1);
  assert.equal(changed.getUint32(12, true), 1);
  assert.equal(changed.getUint32(164, true), extra.geometry.id);
  assert.equal(changed.getFloat32(164 + 12 + 24, true), 0.4375);
  assert.deepEqual(new Uint8Array(changed.buffer).subarray(-24), data.hud);
  extra.visible = false;
  assert.equal(frame(3, 2).getUint32(16, true), 1);
  extra.visible = true;
  const returned = frame(4, 3);
  assert.equal(returned.getUint32(12, true), 1);
  assert.equal(returned.getUint32(164, true), extra.geometry.id);
  pages.clear();
  assert.throws(() => frame(5, 4), /live page/);
  pages.set(map.source, 8);
  const retried = frame(5, 4);
  assert.equal(retried.getUint32(12, true), 0);
  assert.equal(retried.getUint32(164 + 88, true), 8);
  data.material.map = undefined;
  assert.equal(frame(6, 5).getUint32(0, true), 0x31443345);
});

test('a rejected mixed delta replays the exact original draws, definitions and HUD', () => {
  const data = fixture(), encode = createWorldProjectEncoder();
  data.material.side = 'double';
  const extra = new Mesh3D(createBoxGeometry3D(0.5, 0.5, 0.5), data.material);
  data.scene.addChild(extra);
  capture(data, encode, 0, 7, -1);
  const uv = extra.geometry.getAttribute('uv');
  uv.data[0] = 0.3125;
  uv.touch();
  assert.equal(capture(data, encode, 1, 7, 0).getUint32(12, true), 1);
  const full = createWorldProjectEncoder()(data, data.hud);
  data.mesh.visible = false;
  data.camera.setPosition(0, 1, 9);
  data.hud.fill(0);
  uv.data[0] = 0.75;
  uv.touch();
  assert.throws(() => encode.recover(8, 1), /unavailable/);
  assert.throws(() => encode.recover(7, 0), /unavailable/);
  assert.deepEqual(encode.recover(7, 1), full);
});

test('the World3D player retries a rejected frame without ticking or consuming the next frame ID', async t => {
  const data = fixture();
  const beforeNative = globalThis.EgretNativePlayer, beforePlayer = globalThis.EgretPlayerProject;
  t.after(() => {
    if (beforeNative === undefined) delete globalThis.EgretNativePlayer;
    else globalThis.EgretNativePlayer = beforeNative;
    if (beforePlayer === undefined) delete globalThis.EgretPlayerProject;
    else globalThis.EgretPlayerProject = beforePlayer;
  });
  globalThis.EgretNativePlayer = {};
  let updates = 0;
  const player = installWorld3DPlayerProject({
    width: 960, height: 540,
    create: () => ({update() { updates++; }, world3D: () => data})
  });
  await player.start();
  player.frame(0, 1, -1);
  const delta = player.frame(16, 1, 0);
  const header = new DataView(delta.buffer);
  assert.equal(header.getUint32(0, true), 0x33443345);
  const hud = delta.subarray(delta.length - header.getUint32(8, true));
  const expected = createWorldProjectEncoder()(data, hud);
  assert.deepEqual(player.recoverWorldFrame(1, 1), expected);
  assert.equal(updates, 2);
  const next = new DataView(player.frame(32, 1, 1).buffer);
  assert.equal(next.getUint32(0, true), 0x33443345);
  assert.equal(next.getUint32(4, true), 2);
  assert.equal(updates, 3);
  assert.throws(() => player.recoverWorldFrame(1, 1), /unavailable/);
  const closing = player.close();
  assert.throws(() => player.recoverWorldFrame(1, 2), /unavailable/);
  await closing;
  assert.throws(() => player.recoverWorldFrame(1, 2), /unavailable/);
});

test('a shared animated skeleton crosses once per frame with resident vertices and exact recovery', () => {
  const data = fixture(), encode = createWorldProjectEncoder();
  const count = data.geometry.getAttribute('position').count;
  const joints = new Attribute3D(new Uint16Array(count * 4), 4);
  const weights = new Attribute3D(new Float32Array(count * 4), 4);
  const colors = new Attribute3D(new Float32Array(count * 3).fill(0.75), 3);
  for (let i = 0; i < count; i++) weights.data[4 * i] = 1;
  data.geometry.setAttribute('joints', joints).setAttribute('weights', weights).setAttribute('color', colors);
  const bone = new Bone3D();
  data.scene.addChild(bone);
  const skeleton = new Skeleton3D([bone]);
  data.mesh.bind(skeleton);
  const second = new Mesh3D(data.geometry, data.material);
  second.bind(skeleton);
  data.scene.addChild(second);
  const pages = new Map();
  for (const [property, id, colorSpace] of [
    ['map', 7, 'srgb'], ['metallicRoughnessMap', 11, 'linear'], ['normalMap', 13, 'linear']
  ]) {
    const image = { width: 1, height: 1, data: new Uint8Array(4) };
    data.material[property] = new Texture3D(image, { flipY: false, colorSpace });
    pages.set(image, id);
  }
  data.material.vertexColors = true;
  data.material.normalScale = 0.5;
  data.material.emissive.set([0, 0.5, 1]);
  data.material.emissiveIntensity = 3;
  const full = capture(data, encode, 0, 8, -1, pages);
  assert.equal(full.getUint32(0, true), 0x35443345);
  assert.equal(full.getUint32(160, true), 68);
  assert.equal(full.getFloat32(164 + 12 + 52, true), 0.75);
  assert.equal(full.getFloat32(164 + 12 + 64, true), 1); // RGB attribute has implicit alpha one.
  bone.setPosition(1, 0, 0);
  data.mesh.setPosition(0.25, 0, 0); // Already bound: this is not the skin's world-space transform.
  const pose = capture(data, encode, 1, 8, 0, pages);
  assert.equal(pose.getUint32(0, true), 0x36443345);
  assert.equal(pose.getUint32(12, true), 0);
  assert.equal(pose.getUint32(164, true), 68);
  assert.equal(pose.getUint32(168, true), 1);
  assert.equal(pose.getFloat32(172 + 48, true), 1);
  assert.equal(pose.byteLength, 168 + 68 + 2 * 128 + 24);
  for (const draw of [236, 364]) {
    assert.equal(pose.getFloat32(draw + 4 + 48, true), 0);
    assert.deepEqual([88, 92, 96, 100, 104].map(p => pose.getUint32(draw + p, true)), [7, 2, 11, 13, 1]);
    assert.deepEqual([108, 112, 116, 120, 124].map(p => pose.getFloat32(draw + p, true)), [0.5, 0.5, 0, 1.5, 3]);
  }
  assert.deepEqual(encode.recover(8, 1), createWorldProjectEncoder()(data, data.hud, pages));
  colors.data[0] = 0.25;
  colors.touch();
  assert.equal(capture(data, encode, 2, 8, 1, pages).getUint32(12, true), 1);
  assert.equal(capture(data, encode, 3, 9, 2, pages).getUint32(0, true), 0x35443345);
  data.geometry.setAttribute('tangent', new Attribute3D(new Float32Array(count * 4), 4));
  assert.throws(() => capture(data, encode, 4, 9, 3, pages), /authored tangents/);
  data.material.normalMap = undefined;
  joints.data[0] = 1;
  joints.touch();
  assert.throws(() => capture(data, encode, 4, 9, 3, pages), /joint outside skin palette/);
});

test('a multi-actor checkpoint and recovery stage bounded geometry before one pose without advancing the game', () => {
  const data = fixture(), encode = createWorldProjectEncoder(), geometries = [];
  data.scene.removeChild(data.mesh);
  data.material.emissive[0] = 0.1;
  for (let i = 0; i < 3; i++) {
    const geometry = new Geometry3D();
    geometry.setAttribute('position', new Attribute3D(new Float32Array(36000), 3));
    geometry.setAttribute('normal', new Attribute3D(new Float32Array(36000), 3));
    geometry.setIndex(new Uint16Array([0, 1, 2]));
    const actor = new Mesh3D(geometry, data.material);
    actor.frustumCulled = false;
    data.scene.addChild(actor);
    geometries.push(geometry);
  }
  const batches = (draw, epoch) => Array.from({length: draw.getUint32(168, true)}, (_, ordinal) => {
    const batch = encode.geometryBatch(epoch, draw.getUint32(4, true), ordinal);
    const view = new DataView(batch.buffer);
    assert.ok(batch.byteLength <= 2 * 1024 * 1024);
    assert.deepEqual([0, 4, 8, 12, 20].map(p => view.getUint32(p, true)),
      [0x31473345, draw.getUint32(4, true), ordinal, draw.getUint32(168, true), 0x35443345]);
    return batch;
  });
  const first = capture(data, encode, 0, 1, -1);
  assert.equal(first.getUint32(0, true), 0x37443345);
  assert.equal(first.getUint32(160, true), 1);
  assert.equal(first.byteLength, 176 + 3 * 128 + 24);
  const initial = batches(first, 1);
  assert.deepEqual(initial.map(packet => new DataView(packet.buffer).getUint32(16, true)), [2, 1]);
  assert.ok(initial.reduce((total, batch) => total + batch.length, 0) > 2 * 1024 * 1024);
  const next = capture(data, encode, 1, 1, 0);
  assert.equal(next.getUint32(160, true), 0);
  assert.deepEqual(batches(next, 1), []);
  const reset = new DataView(encode.recover(1, 1).buffer);
  assert.equal(reset.getUint32(160, true), 1);
  assert.deepEqual(new Uint8Array(reset.buffer, 172), new Uint8Array(next.buffer, 172));
  assert.deepEqual(batches(reset, 1).map(packet => packet.subarray(24)), initial.map(packet => packet.subarray(24)));
  const changed = geometries[1].getAttribute('position');
  changed.data[0] = 0.125; changed.touch();
  const edit = capture(data, encode, 2, 1, 1);
  assert.equal(edit.getUint32(160, true), 0);
  const replacement = batches(edit, 1);
  assert.equal(replacement.length, 1);
  assert.equal(new DataView(replacement[0].buffer).getUint32(24, true), geometries[1].id);
  const restored = capture(data, encode, 3, 2, -1);
  assert.equal(restored.getUint32(160, true), 1);
  assert.equal(batches(restored, 2).length, 2);
  assert.throws(() => encode.geometryBatch(1, 3, 0), /unavailable/);
  const last = data.scene.children.find(mesh => mesh.geometry === geometries[2]);
  last.visible = false;
  const culled = capture(data, encode, 4, 2, 3);
  assert.equal(culled.getUint32(0, true), 0x37443345);
  assert.equal(culled.getUint32(168, true), 0);
  last.visible = true;
  assert.equal(batches(capture(data, encode, 5, 2, 4), 2).length, 1);
});
