// SPDX-License-Identifier: Apache-2.0
// Public behavior of the World3D additions that need no GPU: compressed
// texture sources, the KTX2 reader, glTF decoder hooks, scene documents,
// AssetManager providers, the animation state machine and rigid-body physics.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetRef, createEngine } from '@egret/engine';
import {
  AnimationMixer3D, InstancedMesh3D, Mesh3D, Object3D, RenderTarget3D, Scene3D, Texture3D, World3DError,
  createAmbientLight3D, createAnimationClip3D, createAnimationStateMachine3D, createBoxGeometry3D, createCharacterController3D,
  createDirectionalLight3D, createLambertMaterial3D, createPerspectiveCamera3D, createPhysicsWorld3D, createScreenLayer3D,
  createCustomShader3D, createGeometry3D, createMeshShape3D, createStandardMaterial3D, deserializeScene3D, isKtx23D, loadGltf3D, parseKtx23D, serializeScene3D,
} from '@egret/engine/world3d';
import {
  GLTF_ASSET_3D, SCENE_ASSET_3D, TEXTURE_ASSET_3D, createPostProcessSettings3D, registerWorld3DAssets,
} from '@egret/engine/webgl2/world3d';
import { createCustomPost3D } from '@egret/engine/webgpu/world3d';
import { host } from './helpers.mjs';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

/** A KTX2 container with one or more uncompressed-size levels of the given Vulkan format. */
function ktx2(vkFormat, width, height, levels, supercompression = 0) {
  const header = 80 + 24 * levels.length, total = header + levels.reduce((sum, level) => sum + level.length, 0);
  const bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  [vkFormat, 1, width, height, 0, 0, 1, levels.length, supercompression].forEach((value, index) => view.setUint32(12 + index * 4, value, true));
  // Levels are stored smallest first, as the container requires.
  let offset = total;
  levels.forEach((level, index) => {
    offset -= level.length;
    bytes.set(level, offset);
    view.setBigUint64(80 + index * 24, BigInt(offset), true); view.setBigUint64(88 + index * 24, BigInt(level.length), true); view.setBigUint64(96 + index * 24, BigInt(level.length), true);
  });
  return bytes;
}
function quadGltf(extra = {}) {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
  const bin = new Uint8Array(60); bin.set(new Uint8Array(positions.buffer)); bin.set(new Uint8Array(indices.buffer), 48);
  const json = {
    asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}], nodes: [{mesh: 0, name: 'quad'}],
    meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1}]}],
    accessors: [{bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0]}, {bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR'}],
    bufferViews: [{buffer: 0, byteOffset: 0, byteLength: 48}, {buffer: 0, byteOffset: 48, byteLength: 12}], buffers: [{byteLength: 60, uri: 'quad.bin'}], ...extra,
  };
  return {json, bin, bytes: new TextEncoder().encode(JSON.stringify(json))};
}

test('compressed texture sources validate their block chains', () => {
  const block = new Uint8Array(8);
  const texture = new Texture3D({width: 4, height: 4, format: 'bc1', levels: [block]}, {mipmaps: false});
  assert.equal(texture.source.format, 'bc1');
  assert.throws(() => new Texture3D({width: 8, height: 8, format: 'bc1', levels: [block]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => new Texture3D({width: 4, height: 4, format: 'pvrtc', levels: [block]}), code('WORLD3D_INPUT_INVALID'));
  texture.dispose();
});

test('KTX2 reader returns pixels, compressed chains and delegates the rest', async () => {
  const rgba = await parseKtx23D(ktx2(43, 2, 2, [new Uint8Array(16).fill(200)]));
  assert.equal(rgba.colorSpace, 'srgb');
  assert.deepEqual([rgba.source.width, rgba.source.height, rgba.source.data.length], [2, 2, 16]);
  const bc7 = await parseKtx23D(ktx2(145, 8, 8, [new Uint8Array(64).fill(1), new Uint8Array(16).fill(2)]));
  assert.equal(bc7.source.format, 'bc7');
  assert.equal(bc7.colorSpace, 'linear');
  assert.deepEqual(bc7.source.levels.map(level => [level.length, level[0]]), [[64, 1], [16, 2]]);
  assert.equal(isKtx23D(new Uint8Array(20)), false);
  // Basis Universal payloads (vkFormat 0) need the injected transcoder.
  const basis = ktx2(0, 4, 4, [new Uint8Array(12)], 1);
  await assert.rejects(parseKtx23D(basis), code('WORLD3D_GLTF_UNSUPPORTED'));
  const seen = [];
  const transcoded = await parseKtx23D(basis, {transcode: info => { seen.push([info.vkFormat, info.supercompression, info.width]); return {source: {width: 4, height: 4, data: new Uint8Array(64)}, colorSpace: 'srgb'}; }});
  assert.deepEqual(seen, [[0, 1, 4]]);
  assert.equal(transcoded.source.data.length, 64);
  await assert.rejects(parseKtx23D(ktx2(43, 2, 2, [new Uint8Array(16)]).subarray(0, 90)), code('WORLD3D_INPUT_INVALID'));
});

test('glTF accepts meshopt and Draco only through injected decoders', async () => {
  const plain = quadGltf();
  const meshopt = quadGltf({extensionsUsed: ['EXT_meshopt_compression'], extensionsRequired: ['EXT_meshopt_compression']});
  meshopt.json.bufferViews[0].extensions = {EXT_meshopt_compression: {buffer: 0, byteOffset: 0, byteLength: 48, byteStride: 12, count: 4, mode: 'ATTRIBUTES'}};
  const bytes = new TextEncoder().encode(JSON.stringify(meshopt.json)), loadBuffer = async () => plain.bin;
  await assert.rejects(loadGltf3D(bytes, {loadBuffer}), code('WORLD3D_GLTF_UNSUPPORTED'));
  const requests = [];
  const asset = await loadGltf3D(bytes, {loadBuffer, decodeMeshopt: request => { requests.push([request.count, request.stride, request.mode, request.filter]); return request.source.slice(); }});
  assert.deepEqual(requests, [[4, 12, 'ATTRIBUTES', 'NONE']]);
  const mesh = asset.scene.getObjectByName('quad');
  assert.ok(mesh instanceof Mesh3D);
  assert.equal(mesh.geometry.getAttribute('position').count, 4);
  asset.dispose();
  await assert.rejects(loadGltf3D(bytes, {loadBuffer, decodeMeshopt: () => new Uint8Array(3)}), code('WORLD3D_GLTF_INVALID'));
});

test('glTF EXT_mesh_gpu_instancing nodes load as instanced meshes', async () => {
  const quad = quadGltf({extensionsUsed: ['EXT_mesh_gpu_instancing'], extensionsRequired: ['EXT_mesh_gpu_instancing']});
  // Three instances: translations as floats, rotations as normalized shorts, uniform scales.
  const translations = new Float32Array([0, 0, 0, 5, 0, 0, 0, 7, 0]), scales = new Float32Array([1, 1, 1, 2, 2, 2, 1, 1, 1]);
  const half = Math.round(Math.SQRT1_2 * 32767), rotations = new Int16Array([0, 0, 0, 32767, 0, 0, half, half, 0, 0, 0, 32767]);
  const bin = new Uint8Array(60 + 36 + 36 + 24);
  bin.set(quad.bin); bin.set(new Uint8Array(translations.buffer), 60); bin.set(new Uint8Array(scales.buffer), 96); bin.set(new Uint8Array(rotations.buffer), 132);
  const json = quad.json;
  json.buffers[0].byteLength = bin.length;
  json.bufferViews.push({buffer: 0, byteOffset: 60, byteLength: 36}, {buffer: 0, byteOffset: 96, byteLength: 36}, {buffer: 0, byteOffset: 132, byteLength: 24});
  json.accessors.push({bufferView: 2, componentType: 5126, count: 3, type: 'VEC3'}, {bufferView: 3, componentType: 5126, count: 3, type: 'VEC3'}, {bufferView: 4, componentType: 5122, count: 3, type: 'VEC4', normalized: true});
  json.nodes[0].extensions = {EXT_mesh_gpu_instancing: {attributes: {TRANSLATION: 2, SCALE: 3, ROTATION: 4}}};
  const asset = await loadGltf3D(new TextEncoder().encode(JSON.stringify(json)), {loadBuffer: async () => bin});
  const mesh = asset.scene.getObjectByName('quad');
  assert.ok(mesh instanceof InstancedMesh3D);
  assert.equal(mesh.count, 3);
  const m = mesh.instanceMatrices;
  assert.deepEqual([m[12], m[13], m[14]], [0, 0, 0]);
  assert.equal(m[16 + 12], 5, 'second instance is moved');
  // It is also scaled by 2 and turned 90 degrees about Z: its X axis points along +Y and its Y axis along -X.
  close(m[16 + 0], 0, 1e-3); close(m[16 + 1], 2, 1e-3); close(m[16 + 4], -2, 1e-3); close(m[16 + 10], 2, 1e-3);
  assert.equal(m[32 + 13], 7);
  asset.dispose();
  json.nodes[0].extensions.EXT_mesh_gpu_instancing.attributes.SCALE = 0;
  await assert.rejects(loadGltf3D(new TextEncoder().encode(JSON.stringify(json)), {loadBuffer: async () => bin}), code('WORLD3D_GLTF_INVALID'));
});

test('scene documents round-trip nodes, resources and skip what cannot be saved', () => {
  const scene = new Scene3D(); scene.name = 'level'; scene.background = [0.1, 0.2, 0.3]; scene.fog = {kind: 'linear', color: [1, 1, 1], near: 2, far: 9};
  const camera = createPerspectiveCamera3D({fov: 40, aspect: 2, near: 0.5, far: 50}); camera.name = 'eye'; camera.setPosition(1, 2, 3); scene.addChild(camera);
  const sun = createDirectionalLight3D({intensity: 2, castShadow: true}); sun.shadow.cascades = 3; scene.addChild(sun);
  scene.addChild(createAmbientLight3D({intensity: 0.25}));
  const embedded = new Texture3D({width: 1, height: 1, data: new Uint8Array([9, 8, 7, 255])}, {mipmaps: false});
  const keyed = new Texture3D({width: 1, height: 1, data: new Uint8Array(4)}, {name: 'atlas'});
  const material = createStandardMaterial3D({color: [0.5, 0.25, 1], map: embedded, normalMap: keyed, roughness: 0.3});
  const geometry = createBoxGeometry3D({width: 2});
  const box = new Mesh3D(geometry, material); box.name = 'box'; box.userData = {hp: 3, tags: ['a'], skip() {}}; box.setPosition(4, 5, 6); scene.addChild(box);
  const twin = new Mesh3D(geometry, material); box.addChild(twin);
  const instances = new InstancedMesh3D(geometry, createLambertMaterial3D({}), 8); instances.count = 2; instances.instanceMatrices[12] = 7; scene.addChild(instances);
  scene.addChild(createScreenLayer3D({width: 1, height: 1, data: new Uint8Array(4)}));

  const saved = serializeScene3D(scene, {textureKey: texture => texture === keyed ? 'atlas.png' : undefined});
  assert.equal(saved.geometries.length, 1, 'shared geometry is stored once');
  assert.equal(saved.materials.length, 2);
  assert.equal(saved.skipped.length, 1);
  const text = JSON.stringify(saved);
  const resolved = [];
  const restored = deserializeScene3D(JSON.parse(text), {resolveTexture: key => { resolved.push(key); return keyed; }});
  assert.deepEqual(resolved, ['atlas.png']);
  const root = restored.root;
  assert.ok(root instanceof Scene3D);
  assert.deepEqual([...root.background].map(value => +value.toFixed(3)), [0.1, 0.2, 0.3]);
  assert.equal(root.fog.far, 9);
  assert.equal(restored.cameras[0].name, 'eye');
  assert.equal(restored.cameras[0].fov, 40);
  const copy = root.getObjectByName('box');
  assert.deepEqual([...copy.position], [4, 5, 6]);
  assert.deepEqual(copy.userData, {hp: 3, tags: ['a']});
  assert.equal(copy.children[0].geometry, copy.geometry, 'sharing survives the round trip');
  assert.equal(copy.material.roughness, 0.3);
  assert.deepEqual([...copy.material.map.source.data], [9, 8, 7, 255]);
  assert.equal(copy.material.normalMap, keyed);
  const light = root.children.find(child => child.lightType === 'directional');
  assert.deepEqual([light.intensity, light.castShadow, light.shadow.cascades], [2, true, 3]);
  const restoredInstances = root.children.find(child => child instanceof InstancedMesh3D);
  assert.deepEqual([restoredInstances.capacity, restoredInstances.count, restoredInstances.instanceMatrices[12]], [8, 2, 7]);
  assert.equal(restored.textures.length, 1, 'only embedded textures are owned by the result');
  restored.dispose();
  assert.equal(copy.geometry.isDisposed, true);
  assert.equal(keyed.isDisposed, false);

  assert.throws(() => deserializeScene3D({...saved, version: 99}), code('WORLD3D_INPUT_INVALID'));
  const broken = JSON.parse(text); broken.nodes[1].parent = 5;
  assert.throws(() => deserializeScene3D(broken), code('WORLD3D_INPUT_INVALID'));
});

test('half-float render targets and post-processing settings', () => {
  const target = new RenderTarget3D(4, 4, {format: 'rgba16f'});
  assert.equal(target.format, 'rgba16f');
  assert.equal(target.texture.colorSpace, 'linear');
  assert.equal(new RenderTarget3D(4, 4).format, 'rgba8');
  assert.throws(() => new RenderTarget3D(4, 4, {format: 'rgba32f'}), code('WORLD3D_INPUT_INVALID'));
  const post = createPostProcessSettings3D();
  assert.equal(post.enabled, false);
  assert.deepEqual([post.bloom, post.fxaa, post.saturation, post.vignette], [true, true, 1, 0]);
});

test('AssetManager providers lease, share and dispose World3D resources', async t => {
  const engine = await createEngine({host: host().adapter});
  const gltf = quadGltf(), scene = new Scene3D(); scene.addChild(new Mesh3D(createBoxGeometry3D({}), createLambertMaterial3D({})));
  const files = new Map([
    ['https://assets.test/quad.gltf', gltf.bytes], ['https://assets.test/quad.bin', gltf.bin],
    ['https://assets.test/tile.ktx2', ktx2(37, 2, 2, [new Uint8Array(16).fill(128)])],
    ['https://assets.test/level.json', new TextEncoder().encode(JSON.stringify(serializeScene3D(scene)))],
  ]);
  const requested = [], originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    requested.push(String(url));
    const body = files.get(String(url));
    return body ? new Response(body, {status: 200}) : new Response('', {status: 404});
  };
  t.after(async () => { globalThis.fetch = originalFetch; await engine.dispose(); });
  registerWorld3DAssets(engine.assets, {resolveUrl: id => 'https://assets.test/' + id});

  const first = await engine.assets.acquire(createAssetRef(GLTF_ASSET_3D, 'quad.gltf'));
  const second = await engine.assets.acquire(createAssetRef(GLTF_ASSET_3D, 'quad.gltf'));
  assert.equal(first.value, second.value, 'one load serves both leases');
  assert.equal(requested.filter(url => url.endsWith('quad.gltf')).length, 1);
  const geometry = first.value.geometries[0];
  first.release();
  assert.equal(geometry.isDisposed, false, 'still leased');
  second.release();
  assert.equal(geometry.isDisposed, true, 'last release disposes the asset');

  const texture = await engine.assets.acquire(createAssetRef(TEXTURE_ASSET_3D, 'tile.ktx2'));
  assert.ok(texture.value instanceof Texture3D);
  const loaded = texture.value;
  assert.equal(loaded.source.width, 2);
  texture.release();
  assert.equal(loaded.isDisposed, true);

  const level = await engine.assets.acquire(createAssetRef(SCENE_ASSET_3D, 'level.json'));
  assert.ok(level.value.root.children[0] instanceof Mesh3D);
  level.release();
  await assert.rejects(engine.assets.acquire(createAssetRef(TEXTURE_ASSET_3D, 'missing.ktx2')));
});

test('animation state machine follows parameters, triggers, exit times and events', () => {
  const root = new Object3D(), node = new Object3D(); node.name = 'n'; root.addChild(node);
  const clip = (name, x, duration) => createAnimationClip3D({name, tracks: [{targetName: 'n', path: 'position', times: [0, duration], values: [x, 0, 0, x, 1, 0]}]});
  const machine = createAnimationStateMachine3D(new AnimationMixer3D(root)), log = [];
  machine.addState('idle', {clip: clip('idle', 0, 1)})
    .addState('move', {blend: {parameter: 'speed', clips: [{clip: clip('walk', 10, 1), threshold: 1}, {clip: clip('run', 20, 0.5), threshold: 3}]}})
    .addState('jump', {clip: clip('jump', 100, 0.4), loop: false});
  machine.addTransition({from: 'idle', to: 'move', duration: 0.2, conditions: [{parameter: 'speed', op: '>', value: 0.1}]});
  machine.addTransition({from: 'move', to: 'idle', duration: 0.2, conditions: [{parameter: 'speed', op: '<=', value: 0.1}]});
  machine.addTransition({from: '*', to: 'jump', duration: 0.1, conditions: [{parameter: 'jump'}]});
  machine.addTransition({from: 'jump', to: 'idle', duration: 0.1, exitTime: 1});
  machine.addEvent('jump', 0.5, () => log.push('apex'));
  machine.onStateChange = (from, to) => log.push(from + '>' + to);
  machine.set('speed', 0).play('idle');
  machine.update(0.1);
  assert.equal(machine.current, 'idle');
  machine.set('speed', 1);
  machine.update(0.1);
  assert.equal(machine.isTransitioning, true);
  close(node.position[0], 5);                       // half way through the fade
  machine.update(0.1);
  close(node.position[0], 10);
  machine.set('speed', 2); machine.update(0.1);
  close(node.position[0], 15);                      // blend of walk and run
  machine.trigger('jump'); machine.update(0.05);
  assert.equal(machine.current, 'jump');
  machine.update(0.05); machine.update(0.2); machine.update(0.2);
  close(machine.normalizedTime, 1);
  machine.set('speed', 0); machine.update(0.2);
  assert.equal(machine.current, 'idle');
  assert.deepEqual(log, ['undefined>idle', 'idle>move', 'move>jump', 'apex', 'jump>idle']);
  assert.throws(() => machine.addTransition({from: 'idle', to: 'nowhere', conditions: [{parameter: 'x'}]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => machine.addTransition({from: 'idle', to: 'move'}), code('WORLD3D_INPUT_INVALID'));
});

test('rigid bodies fall, rest, stack and sleep', () => {
  const world = createPhysicsWorld3D();
  world.createBody({shape: {type: 'plane'}});
  const ball = world.createBody({shape: {type: 'sphere', radius: 0.5}, position: [5, 4, 0]});
  const boxes = [0, 1, 2, 3].map(i => world.createBody({shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, position: [0, 0.5 + i * 1.01, 0]}));
  const node = new Object3D(); boxes[3].node = node;
  for (let i = 0; i < 600; i++) world.step(1 / 60);
  close(ball.position[1], 0.5, 0.02);
  boxes.forEach((box, i) => { close(box.position[1], 0.5 + i, 0.03); close(box.position[0], 0, 0.05); close(box.position[2], 0, 0.05); });
  assert.ok(boxes.every(box => box.isSleeping) && ball.isSleeping, 'a resting pile goes to sleep');
  close(node.position[1], boxes[3].position[1], 1e-6);
  // Removing the support wakes what rested on it.
  world.removeBody(boxes[0]);
  for (let i = 0; i < 240; i++) world.step(1 / 60);
  close(boxes[1].position[1], 0.5, 0.03);
});

test('physics reports contacts, triggers, rays and overlaps', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const zone = world.createBody({type: 'static', shape: {type: 'sphere', radius: 1}, isTrigger: true});
  const mover = world.createBody({type: 'kinematic', shape: {type: 'sphere', radius: 0.2}, position: [-3, 0, 0]}).setLinearVelocity(3, 0, 0);
  const events = [];
  world.onContactBegin = (a, b) => events.push(['begin', a === zone || b === zone]);
  world.onContactEnd = () => events.push(['end']);
  for (let i = 0; i < 180; i++) world.step(1 / 60);
  assert.deepEqual(events, [['begin', true], ['end']]);
  close(mover.position[0], 6, 0.01);

  const box = world.createBody({type: 'static', shape: {type: 'box', halfExtents: [1, 1, 1]}, position: [0, 1, -5]});
  const capsule = world.createBody({type: 'static', shape: {type: 'capsule', radius: 0.5, halfHeight: 1}, position: [5, 1.5, 0], layer: 2});
  let hit = world.raycast([0, 1, 0], [0, 0, -2]);
  assert.equal(hit.body, box); close(hit.distance, 4); assert.deepEqual(hit.normal, [0, 0, 1]);
  hit = world.raycast([0, 1, 0], [1, 0, 0], 100, 2);
  assert.equal(hit.body, capsule); close(hit.distance, 4.5);
  assert.equal(world.raycast([0, 1, 0], [1, 0, 0], 2, 2), undefined, 'maxDistance limits the ray');
  assert.equal(world.raycast([0, 5, 0], [0, 1, 0]), undefined);
  assert.deepEqual(world.overlapSphere([0, 1, -3.5], 0.6), [box]);
  assert.throws(() => world.createBody({shape: {type: 'plane'}, type: 'dynamic'}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.addBody(box), code('WORLD3D_INPUT_INVALID'));
});

test('dynamic bodies collide with each other and respect layers', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const a = world.createBody({shape: {type: 'sphere', radius: 0.5}, position: [-2, 0, 0], restitution: 1, friction: 0, linearDamping: 0}).setLinearVelocity(4, 0, 0);
  const b = world.createBody({shape: {type: 'sphere', radius: 0.5}, position: [2, 0, 0], restitution: 1, friction: 0, linearDamping: 0});
  const ghost = world.createBody({shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, position: [0, 0, 0], layer: 2, mask: 2});
  for (let i = 0; i < 120; i++) world.step(1 / 60);
  // Equal masses in an elastic head-on hit exchange velocities; the other layer is untouched.
  close(a.linearVelocity[0], 0, 0.1); close(b.linearVelocity[0], 4, 0.1);
  close(ghost.position[0], 0, 1e-6);
});

test('character controller slides along walls and finds the ground', () => {
  const world = createPhysicsWorld3D();
  world.createBody({shape: {type: 'plane'}});
  world.createBody({type: 'static', shape: {type: 'box', halfExtents: [1, 2, 5]}, position: [4, 2, 0]});
  const character = createCharacterController3D(world, {position: [0, 3, 0], radius: 0.35, height: 1.8});
  let fall = 0;
  for (let i = 0; i < 240; i++) {
    fall = character.isGrounded ? 0 : fall - 9.81 / 60;
    character.move(3 / 60, fall / 60 - (character.isGrounded ? 0.01 : 0), 1 / 60);
  }
  assert.equal(character.isGrounded, true);
  close(character.position[1], 0.9, 0.03);          // half the height above the floor
  close(character.position[0], 3 - 0.35, 0.03);     // stopped by the wall
  close(character.position[2], 4, 0.03);            // but still sliding along it
  close(character.groundNormal[1], 1, 1e-6);
});

test('triangle-mesh colliders carry bodies, characters and rays across level geometry', () => {
  // A 40 m square of 1 m cells: flat where x < 0, then a 20 degree ramp.
  const cells = 40, slope = Math.tan(20 * Math.PI / 180), positions = [], indices = [];
  for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) { const x = i - cells / 2; positions.push(x, x < 0 ? 0 : x * slope, j - cells / 2); }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) { const a = j * (cells + 1) + i, b = a + 1, c = a + cells + 1; indices.push(a, c, b, b, c, c + 1); }
  const level = new Object3D();
  level.addChild(new Mesh3D(createGeometry3D({positions, indices}), createLambertMaterial3D({})));
  const wall = new Mesh3D(createBoxGeometry3D({width: 1, height: 4, depth: 10}), createLambertMaterial3D({}));
  wall.setPosition(-8, 2, 0); level.addChild(wall);
  const shape = createMeshShape3D(level);
  assert.equal(shape.triangleCount, cells * cells * 2 + 12);
  const world = createPhysicsWorld3D();
  const ground = world.createBody({shape: {type: 'mesh', mesh: shape}});
  assert.equal(ground.type, 'static');
  assert.throws(() => world.createBody({shape: {type: 'mesh', mesh: shape}, type: 'dynamic'}), code('WORLD3D_INPUT_INVALID'));

  const crate = world.createBody({shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, position: [-5.2, 2, 5.3]});
  // Rolling exactly along a row of triangle edges must not bump or drift.
  const roller = world.createBody({shape: {type: 'sphere', radius: 0.5}, position: [-4, 0.5, -8], friction: 0, linearDamping: 0}).setLinearVelocity(0, 0, 6);
  let bump = 0;
  for (let i = 0; i < 240; i++) { world.step(1 / 60); if (i > 30) bump = Math.max(bump, Math.abs(roller.position[1] - 0.5)); }
  assert.ok(bump < 0.02, 'seams are smooth: ' + bump);
  close(roller.position[0], -4, 0.01); close(roller.linearVelocity[2], 6, 0.05);
  close(crate.position[1], 0.53, 0.03);
  assert.equal(crate.isSleeping, true);

  let hit = world.raycast([5, 20, 0], [0, -1, 0]);
  close(hit.distance, 20 - 5 * slope, 1e-3);
  close(hit.normal[1], Math.cos(20 * Math.PI / 180), 1e-3);
  hit = world.raycast([0, 1, 0], [-1, 0, 0]);
  close(hit.distance, 7.5, 1e-3);
  assert.deepEqual(hit.normal, [1, 0, 0]);
  assert.equal(world.raycast([5, -5, 0], [0, 1, 0]), undefined, 'triangles are solid from the front only');

  const character = createCharacterController3D(world, {position: [-5, 2, -5]});
  let fall = 0;
  for (let i = 0; i < 360; i++) { fall = character.isGrounded ? 0 : fall - 9.81 / 60; character.move(3 / 60, fall / 60 - (character.isGrounded ? 0.02 : 0), 0); }
  assert.equal(character.isGrounded, true);
  assert.ok(character.position[0] > 9, 'walked up the ramp');
  close(character.position[1], character.position[0] * slope + 0.9 / Math.cos(20 * Math.PI / 180), 0.06);
  close(character.groundNormal[1], Math.cos(20 * Math.PI / 180), 1e-3);
  const blocked = createCharacterController3D(world, {position: [-5, 0.95, 0]});
  for (let i = 0; i < 120; i++) blocked.move(-3 / 60, -0.01, 0);
  close(blocked.position[0], -7.5 + 0.35, 0.03);
});

test('scene overrides, clipping planes and shader hooks are plain data', () => {
  const scene = new Scene3D();
  assert.equal(scene.overrideMaterial, undefined);
  assert.deepEqual(scene.clippingPlanes, []);
  const wind = createCustomShader3D({key: 'wind', glslVertex: 'vec3 customVertex(vec3 w, vec3 l, vec3 n, vec2 uv, vec4 c) { return w; }'});
  assert.equal(wind.glsl, undefined);
  assert.equal(typeof wind.glslVertex, 'string');
  const post = createPostProcessSettings3D();
  assert.deepEqual([post.ssao, post.outlineLayers, post.custom], [false, 0, undefined]);
  const fog = createCustomPost3D({key: 'fog', glsl: 'vec3 customPost(vec3 c, vec2 uv) { return c; }', uniforms: [1, 2]});
  assert.deepEqual([...fog.uniforms.subarray(0, 3)], [1, 2, 0]);
  assert.throws(() => createCustomPost3D({key: 'none'}), code('WORLD3D_INPUT_INVALID'));
  assert.equal(new RenderTarget3D(4, 4, {depthTexture: true}).depthTexture, true);
  assert.equal(new RenderTarget3D(4, 4, {depth: false, depthTexture: true}).depthTexture, false);
});
