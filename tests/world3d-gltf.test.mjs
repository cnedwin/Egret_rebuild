// SPDX-License-Identifier: Apache-2.0
// Public behavior of the world3d glTF 2.0 reader, using an original GLB
// assembled in memory.
import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationMixer3D, Mesh3D, World3DError, loadGltf3D } from '@egret/engine/world3d';
import { loadGltfFromUrl3D } from '@egret/engine/webgl2/world3d';

const near = (actual, expected, epsilon = 1e-5) => {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) <= epsilon, `[${i}] ${actual[i]} != ${expected[i]}`);
};
const code = value => error => error instanceof World3DError && error.code === value;

/** Pack typed arrays into one buffer and return accessor-ready views. */
function createAsset(mutate = json => json) {
  const chunks = [], bufferViews = [], accessors = [];
  let offset = 0;
  const view = (array, target) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes); chunks.push(padded);
    bufferViews.push({buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? {target} : {})});
    offset += padded.length;
    return bufferViews.length - 1;
  };
  const accessor = (array, type, componentType, extra = {}) => {
    const size = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[type];
    accessors.push({bufferView: view(array), componentType, count: array.length / size, type, ...extra});
    return accessors.length - 1;
  };
  const F = 5126, U16 = 5123;
  const position = accessor(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 'VEC3', F, {min: [0, 0, 0], max: [1, 1, 0]});
  const normal = accessor(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3', F);
  const uv = accessor(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 'VEC2', F);
  const joints = accessor(new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 'VEC4', U16);
  const weights = accessor(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 'VEC4', F);
  const indices = accessor(new Uint16Array([0, 1, 2, 2, 1, 3]), 'SCALAR', U16);
  const morph = accessor(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3', F);
  const times = accessor(new Float32Array([0, 1]), 'SCALAR', F, {min: [0], max: [1]});
  const translations = accessor(new Float32Array([0, 0, 0, 0, 2, 0]), 'VEC3', F);
  const morphWeights = accessor(new Float32Array([0, 1]), 'SCALAR', F);
  const inverseBind = accessor(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1]), 'MAT4', F);
  const image = view(new Uint8Array([137, 80, 78, 71]));
  const json = mutate({
    asset: {version: '2.0'}, scene: 0, scenes: [{name: 'main', nodes: [0]}],
    extensionsUsed: ['KHR_texture_transform', 'KHR_lights_punctual', 'KHR_materials_emissive_strength'],
    extensions: {KHR_lights_punctual: {lights: [{type: 'spot', color: [1, 0.5, 0.25], intensity: 3, range: 9, spot: {outerConeAngle: 0.6, innerConeAngle: 0.3}}]}},
    nodes: [
      {name: 'root', translation: [1, 0, 0], children: [1, 2, 4, 5]},
      {name: 'panel', mesh: 0, skin: 0},
      {name: 'hip', children: [3]},
      {name: 'knee', translation: [0, 1, 0]},
      {name: 'eye', camera: 0, rotation: [0, 0.7071068, 0, 0.7071068]},
      {name: 'lamp', extensions: {KHR_lights_punctual: {light: 0}}},
    ],
    cameras: [{type: 'perspective', perspective: {yfov: 1, aspectRatio: 2, znear: 0.5, zfar: 40}}],
    meshes: [{name: 'quad', extras: {targetNames: ['bulge']}, weights: [0.25], primitives: [{
      attributes: {POSITION: position, NORMAL: normal, TEXCOORD_0: uv, JOINTS_0: joints, WEIGHTS_0: weights}, indices, material: 0, targets: [{POSITION: morph}],
    }]}],
    skins: [{joints: [2, 3], inverseBindMatrices: inverseBind}],
    materials: [{
      name: 'paint', doubleSided: true, alphaMode: 'MASK', alphaCutoff: 0.3, emissiveFactor: [1, 1, 0],
      extensions: {KHR_materials_emissive_strength: {emissiveStrength: 4}},
      pbrMetallicRoughness: {baseColorFactor: [0.5, 0.25, 1, 0.8], metallicFactor: 0.1, roughnessFactor: 0.7,
        baseColorTexture: {index: 0, extensions: {KHR_texture_transform: {offset: [0.5, 0.25], scale: [2, 3], rotation: 0.1}}}},
    }],
    textures: [{source: 0, sampler: 0}], images: [{bufferView: image, mimeType: 'image/png'}],
    samplers: [{magFilter: 9728, minFilter: 9729, wrapS: 33071, wrapT: 33648}],
    animations: [{name: 'rise', channels: [{sampler: 0, target: {node: 3, path: 'translation'}}, {sampler: 1, target: {node: 1, path: 'weights'}}],
      samplers: [{input: times, output: translations, interpolation: 'LINEAR'}, {input: times, output: morphWeights}]}],
    accessors, bufferViews, buffers: [{byteLength: offset}],
  });
  const text = Buffer.from(JSON.stringify(json), 'utf8'), jsonChunk = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(jsonChunk);
  const bin = Buffer.concat(chunks), header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + bin.length, 8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return new Uint8Array(Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]));
}
const decodeImage = async request => ({width: 1, height: 1, data: new Uint8Array([request.bytes[0], 0, 0, 255])});

test('W3G01 a binary asset loads hierarchy, geometry, material, texture, camera and light', async () => {
  const asset = await loadGltf3D(createAsset(), {decodeImage});
  const root = asset.scene.getObjectByName('root'), panel = asset.scene.getObjectByName('panel');
  near(root.position, [1, 0, 0]);
  const mesh = panel instanceof Mesh3D ? panel : panel.children.find(child => child instanceof Mesh3D);
  assert.ok(mesh, 'the mesh node carries a Mesh3D');
  const geometry = mesh.geometry;
  assert.equal(geometry.vertexCount, 4); assert.equal(geometry.drawCount, 6);
  assert.deepEqual(Array.from(geometry.index.data), [0, 1, 2, 2, 1, 3]);
  // Bounds are conservative: they also enclose the fully applied morph target.
  const box = geometry.boundingBox;
  near([box[0], box[1], box[3], box[4]], [0, 0, 1, 1]);
  assert.ok(box[2] <= 0 && box[5] >= 1);
  assert.equal(geometry.morphTargets[0].name, 'bulge');
  near(mesh.morphWeights, [0.25]);
  const material = mesh.material;
  assert.equal(material.name, 'paint'); assert.equal(material.shading, 'standard');
  assert.equal(material.side, 'double'); assert.equal(material.alphaMode, 'mask'); near([material.alphaCutoff, material.opacity], [0.3, 0.8]);
  near(material.color, [0.5, 0.25, 1]); near([material.metallic, material.roughness, material.emissiveIntensity], [0.1, 0.7, 4]);
  const map = material.map;
  assert.equal(asset.textures.includes(map), true);
  assert.deepEqual([map.magFilter, map.wrapS, map.wrapT, map.colorSpace, map.flipY], ['nearest', 'clamp', 'mirror', 'srgb', false]);
  near([...map.offset, ...map.repeat], [0.5, 0.25, 2, 3]);
  assert.equal(map.source.data[0], 137, 'the injected decoder received the embedded bytes');
  const camera = asset.cameras[0];
  near([camera.fov, camera.aspect, camera.near, camera.far], [1 * 180 / Math.PI, 2, 0.5, 40], 1e-4);
  const lamp = asset.scene.getObjectByName('lamp');
  const light = lamp.lightType ? lamp : lamp.children.find(child => child.kind === 'light');
  assert.equal(light.lightType, 'spot'); near(light.color, [1, 0.5, 0.25]); near([light.range, light.angle], [9, 0.6]);
  asset.dispose(); asset.dispose();
  assert.equal(geometry.isDisposed && material.isDisposed && map.isDisposed, true);
});

test('W3G02 skins bind to joints and animations drive nodes and morph weights by name', async () => {
  const asset = await loadGltf3D(createAsset(), {decodeImage});
  const mesh = (() => { let found; asset.scene.traverse(object => { if (object instanceof Mesh3D) found = object; }); return found; })();
  const skeleton = mesh.skeleton;
  assert.deepEqual(skeleton.bones.map(bone => bone.name), ['hip', 'knee']);
  asset.scene.updateWorldMatrices();
  skeleton.update(1);
  // Joints live in world space: in the bind pose each skinning matrix is the root offset alone.
  near(skeleton.boneMatrices.subarray(16, 32), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1]);
  const clip = asset.animations[0];
  assert.equal(clip.name, 'rise'); assert.equal(clip.duration, 1);
  const mixer = new AnimationMixer3D(asset.scene);
  mixer.clipAction(clip).play();
  mixer.update(0.5);
  near(asset.scene.getObjectByName('knee').position, [0, 1, 0]);
  near(mesh.morphWeights, [0.5]);
  asset.scene.updateWorldMatrices();
  skeleton.update(2);
  near(skeleton.boneMatrices.subarray(28, 31), [1, 0, 0], 1e-5);
  mixer.update(0.25);
  asset.scene.updateWorldMatrices(); skeleton.update(3);
  near(skeleton.boneMatrices.subarray(28, 31), [1, 0.5, 0], 1e-5);
  assert.ok(mesh.worldBoundingSphere[3] > 0);
});

test('W3G03 malformed or unsupported assets are refused without leaking resources', async () => {
  await assert.rejects(loadGltf3D(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), code('WORLD3D_GLTF_INVALID'));
  await assert.rejects(loadGltf3D(createAsset(json => ({...json, asset: {version: '1.0'}}))), error => error instanceof World3DError);
  await assert.rejects(loadGltf3D(createAsset(json => ({...json, extensionsRequired: ['KHR_draco_mesh_compression']})), {decodeImage}), code('WORLD3D_GLTF_UNSUPPORTED'));
  await assert.rejects(loadGltf3D(createAsset(json => { json.accessors[0].count = 400; return json; }), {decodeImage}), code('WORLD3D_GLTF_INVALID'));
  await assert.rejects(loadGltf3D(createAsset(json => { json.nodes[3].children = [2]; return json; }), {decodeImage}), code('WORLD3D_GLTF_INVALID'));
  await assert.rejects(loadGltf3D(createAsset(json => { json.meshes[0].primitives[0].indices = 99; return json; }), {decodeImage}), code('WORLD3D_GLTF_INVALID'));
  // Textured assets need an injected decoder: the DOM-free core cannot decode images.
  await assert.rejects(loadGltf3D(createAsset()), code('WORLD3D_GLTF_UNSUPPORTED'));
  // A JSON object with an external buffer uses the injected loader.
  const requested = [];
  const external = await loadGltf3D({asset: {version: '2.0'}, scenes: [{nodes: [0]}], nodes: [{mesh: 0}],
    meshes: [{primitives: [{attributes: {POSITION: 0}}]}], accessors: [{bufferView: 0, componentType: 5126, count: 3, type: 'VEC3'}],
    bufferViews: [{buffer: 0, byteLength: 36}], buffers: [{uri: 'tri.bin', byteLength: 36}]},
    {loadBuffer: async uri => { requested.push(uri); return new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer); }});
  assert.deepEqual(requested, ['tri.bin']);
  assert.equal(external.geometries[0].vertexCount, 3);
  // As glTF specifies, a primitive without normals is left for the renderer to flat-shade.
  assert.equal(external.geometries[0].getAttribute('normal'), undefined);
});

test('W3G04 independent scenes retain their roots and shared scene roots are rejected explicitly', async () => {
  const input = {
    asset: {version: '2.0'}, scene: 0, nodes: [{name: 'first'}, {name: 'second'}],
    scenes: [{nodes: [0]}, {nodes: [1]}],
  };
  const asset = await loadGltf3D(input);
  assert.equal(asset.scene.children[0].name, 'first');
  assert.equal(asset.scenes[1].children[0].name, 'second');
  asset.dispose();
  await assert.rejects(loadGltf3D({...input, scenes: [{nodes: [0]}, {nodes: [0]}]}),
    error => code('WORLD3D_GLTF_UNSUPPORTED')(error) && error.message.includes('shared scene root'));
});

test('W3G05 omitted glTF inverse bind matrices are identity for every joint', async () => {
  const asset = await loadGltf3D(createAsset(json => {
    delete json.skins[0].inverseBindMatrices;
    return json;
  }), {decodeImage});
  const mesh = asset.scene.getObjectByName('panel');
  assert.ok(mesh instanceof Mesh3D);
  const skeleton = mesh.skeleton;
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  near(skeleton.inverseBindMatrices, [...identity, ...identity]);
  asset.scene.updateWorldMatrices();
  skeleton.update(1);
  near(skeleton.boneMatrices.subarray(28, 31), [1, 1, 0]);
  asset.dispose();
});

test('W3G06 accessor byte offsets must be integers', async () => {
  await assert.rejects(loadGltf3D(createAsset(json => {
    const position = json.accessors[0];
    position.byteOffset = 0.5;
    json.bufferViews[position.bufferView].byteLength += 4;
    return json;
  }), {decodeImage}), code('WORLD3D_GLTF_INVALID'));
});

test('W3G07 sparse accessors decode bounded values over a zero-filled base', async () => {
  const asset = await loadGltf3D(createAsset(json => {
    const position = json.accessors[0];
    delete position.bufferView;
    position.sparse = {
      count: 3,
      indices: {bufferView: json.accessors[5].bufferView, componentType: 5123},
      values: {bufferView: json.accessors[1].bufferView},
    };
    return json;
  }), {decodeImage});
  near(asset.geometries[0].getAttribute('position').data, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0]);
  asset.dispose();
  await assert.rejects(loadGltf3D(createAsset(json => {
    const position = json.accessors[0];
    position.sparse = {
      count: position.count + 1,
      indices: {bufferView: json.accessors[3].bufferView, componentType: 5121},
      values: {bufferView: json.accessors[1].bufferView},
    };
    json.bufferViews[position.sparse.values.bufferView].byteLength += 12;
    return json;
  }), {decodeImage}), code('WORLD3D_GLTF_INVALID'));
});

test('W3G09 texture coordinate selection accepts UV0 and rejects unsupported UV sets', async () => {
  const fixture = (baseCoordinate, transformCoordinate) => createAsset(json => {
    const texture = json.materials[0].pbrMetallicRoughness.baseColorTexture;
    texture.texCoord = baseCoordinate;
    if (transformCoordinate !== undefined) texture.extensions.KHR_texture_transform.texCoord = transformCoordinate;
    return json;
  });
  const asset = await loadGltf3D(fixture(1, 0), {decodeImage});
  assert.equal(asset.textures.length, 1);
  asset.dispose();
  for (const input of [fixture(1), fixture(0, 1)]) {
    await assert.rejects(loadGltf3D(input, {decodeImage}),
      error => code('WORLD3D_GLTF_UNSUPPORTED')(error) && error.detail === 'texture coordinate set 1');
  }
});

test('W3G08 the browser loader closes a decode completed after another image fails', async t => {
  const glb = createAsset(json => {
    json.textures.push({source: 1});
    json.images.push({uri: 'invalid.png'});
    json.materials[0].normalTexture = {index: 1};
    return json;
  });
  t.mock.method(globalThis, 'fetch', async url => new Response(String(url).endsWith('invalid.png') ? 'invalid' : glb));
  const originalDecoder = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  let releaseBitmap;
  let started;
  const startedDecode = new Promise(resolve => { started = resolve; });
  const lateBitmap = new Promise(resolve => { releaseBitmap = resolve; });
  let closes = 0;
  Object.defineProperty(globalThis, 'createImageBitmap', {configurable: true, value: async blob => {
    if (blob.type !== 'image/png') {
      await startedDecode;
      throw Error('invalid image');
    }
    started();
    return lateBitmap;
  }});
  try {
    await assert.rejects(loadGltfFromUrl3D('https://fixture.invalid/asset.glb'), code('WORLD3D_RESOURCE_FAILED'));
    releaseBitmap({close() { closes++; }});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(closes, 1);
  } finally {
    releaseBitmap({close() {}});
    if (originalDecoder) Object.defineProperty(globalThis, 'createImageBitmap', originalDecoder);
    else delete globalThis.createImageBitmap;
  }
});
