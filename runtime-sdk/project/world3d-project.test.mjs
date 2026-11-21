// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Scene3D,
  Mesh3D,
  InstancedMesh3D,
  Texture3D,
  createPerspectiveCamera3D,
  createBoxGeometry3D,
  createStandardMaterial3D,
  createDirectionalLight3D
} from '@egret/engine/world3d';
import { createWorldProjectEncoder } from './world3d-frame.mjs';

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
