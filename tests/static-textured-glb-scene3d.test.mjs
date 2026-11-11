// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { readStaticGlbNodes3D, readStaticGlbTexturePlan3D, StaticGlb3DError }
  from '../packages/engine/dist/rendering/staticGlb3D.js';
import { createImageData2D } from '@egret/contracts';
import { createSceneCamera3D, prepareTexturedStaticGlbScene3D } from '@egret/engine/scene3d/authoring';
import { createTexturedRoomGlb } from '../examples/textured-scene3d/room-glb.mjs';

const MiB = 1024 * 1024;
const uvOffset = 44;
const align = value => Math.ceil(value / 4) * 4;

function chunk(type, data) {
  const bytes = Buffer.alloc(data.byteLength + 12);
  bytes.writeUInt32BE(data.byteLength, 0);
  bytes.write(type, 4, 4, 'ascii');
  bytes.set(data, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.byteLength)), 8 + data.byteLength);
  return bytes;
}

function png({ width = 2, height = 1, colorType = 2, extra = [], level = 6, red = 255 } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = colorType;
  const stride = width * (colorType === 6 ? 4 : 3) + 1;
  const rows = Buffer.alloc(height * stride);
  for (let row = 0; row < height; row++) rows[row * stride + 1] = red;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    ...extra, chunk('IDAT', deflateSync(rows, { level })), chunk('IEND', Buffer.alloc(0))]);
}

function glb({ images = [png(), png({ red: 31 })], edit = () => {}, editBinary = () => {} } = {}) {
  const bytes = [uvOffset + 24];
  for (const image of images) bytes.push(align(bytes.at(-1) + image.byteLength));
  const binary = new Uint8Array(bytes.at(-1));
  const view = new DataView(binary.buffer);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => view.setFloat32(index * 4, value, true));
  [0, 1, 2].forEach((value, index) => view.setUint16(36 + index * 2, value, true));
  [-.5, 0, 1, 0, 0, 1].forEach((value, index) => view.setFloat32(uvOffset + index * 4, value, true));
  images.forEach((image, index) => binary.set(image, bytes[index]));

  const extension = 'KHR_materials_unlit';
  const material = index => ({ doubleSided: true, alphaMode: 'OPAQUE', extensions: { [extension]: {} },
    ...(index === undefined ? {} : { pbrMetallicRoughness: { baseColorFactor: [.5, 1, 1, 1], baseColorTexture: { index } } }),
  });
  const model = {
    asset: { version: '2.0' }, extensionsUsed: [extension], extensionsRequired: [extension],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
      { buffer: 0, byteOffset: uvOffset, byteLength: 24 },
      ...images.map((image, index) => ({ buffer: 0, byteOffset: bytes[index], byteLength: image.byteLength }))],
    accessors: [{ bufferView: 0, count: 3, componentType: 5126, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, count: 3, componentType: 5123, type: 'SCALAR' },
      { bufferView: 2, count: 3, componentType: 5126, type: 'VEC2', min: [-.5, 0], max: [1, 1] }],
    images: images.map((_, index) => ({ bufferView: index + 3, mimeType: 'image/png' })),
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    textures: [{ sampler: 0, source: images.length > 1 ? 1 : 0 }, { sampler: 0, source: 0 }],
    materials: [material(0), material(1), material()],
    meshes: [{ primitives: [
      { attributes: { POSITION: 0, TEXCOORD_0: 2 }, indices: 1, material: 0 },
      { attributes: { POSITION: 0, TEXCOORD_0: 2 }, indices: 1, material: 1 },
      { attributes: { POSITION: 0 }, indices: 1, material: 2 },
    ] }],
    nodes: [{ children: [1, 2] }, { mesh: 0 }, { mesh: 0 }], scene: 0, scenes: [{ nodes: [0] }],
  };
  edit(model);
  editBinary(view);
  const json = new TextEncoder().encode(JSON.stringify(model)), jsonLength = align(json.byteLength);
  const output = new Uint8Array(28 + jsonLength + binary.byteLength);
  const header = new DataView(output.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, output.byteLength, true);
  header.setUint32(12, jsonLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  output.fill(32, 20, 20 + jsonLength);
  output.set(json, 20);
  header.setUint32(20 + jsonLength, binary.byteLength, true);
  header.setUint32(24 + jsonLength, 0x004e4942, true);
  output.set(binary, 28 + jsonLength);
  return output;
}

const failure = (code, field) => error => error instanceof StaticGlb3DError && error.code === 'SCENE3D_GLB_' + code &&
  (field === undefined || error.field === field);

test('textured GLB keeps image order, owned bytes and UV, and geometry identity through repeated nodes', () => {
  const pngs = [png(), png({ red: 31 }), png({ red: 127 })];
  const bytes = glb({ images: pngs });
  const wrapper = new Uint8Array(bytes.byteLength + 13);
  wrapper.set(bytes, 7);
  const plan = readStaticGlbTexturePlan3D(wrapper.subarray(7, 7 + bytes.byteLength));
  wrapper.fill(0);
  assert.deepEqual(plan.images.map(({ imageIndex, width, height }) => [imageIndex, width, height]), [[0, 2, 1], [1, 2, 1]]);
  assert.deepEqual(plan.primitives.map(primitive => primitive.imageIndex), [1, 0]);
  for (const image of plan.images) {
    const copy = image.copyBytes();
    assert.deepEqual(Buffer.from(copy), pngs[image.imageIndex]);
    copy.fill(0);
    assert.deepEqual(Buffer.from(image.copyBytes()), pngs[image.imageIndex]);
    assert.equal(image.byteLength, pngs[image.imageIndex].byteLength);
    assert(Object.isFrozen(image));
  }
  assert.equal(plan.nodes[1].meshes, plan.nodes[2].meshes);
  assert.equal(plan.nodes[1].meshes.length, 3);
  assert.equal(plan.nodes[1].meshes[0], plan.primitives[0].geometry);
  assert.equal(plan.nodes[1].meshes[1], plan.primitives[1].geometry);
  assert.deepEqual(plan.primitives[0].texcoords, [-.5, 0, 1, 0, 0, 1]);
  const halfSrgb = Math.fround(1.055 * .5 ** (1 / 2.4) - .055);
  assert.deepEqual(plan.primitives[0].geometry.colors.slice(0, 3), [halfSrgb, 1, 1]);
  for (const item of [plan, plan.images, plan.primitives, plan.nodes, plan.nodes[1].meshes, plan.nodes[1],
    plan.nodes[1].localMatrix, plan.primitives[0].texcoords]) assert(Object.isFrozen(item));
  assert.throws(() => readStaticGlbNodes3D(bytes), failure('UNSUPPORTED'));
});

test('textured GLB refuses default and unadmitted sampler settings', () => {
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => {
    delete model.samplers;
    model.textures.forEach(texture => { delete texture.sampler; });
  } })), failure('UNSUPPORTED', 'texture default sampler'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { delete model.samplers; } })),
    failure('INVALID', 'texture.sampler'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { delete model.textures[0].sampler; } })),
    failure('UNSUPPORTED', 'texture default sampler'));
  for (const change of [{ magFilter: 9729 }, { minFilter: 9984 }, { wrapS: 10497 }, { wrapT: undefined }]) {
    assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => Object.assign(model.samplers[0], change) })),
      failure('UNSUPPORTED', 'sampler nearest clamp'));
  }
});

test('textured GLB refuses RGBA, tRNS, external URI and a second texture coordinate set', () => {
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: [png({ colorType: 6 })] })),
    failure('UNSUPPORTED', 'image PNG RGB8 noninterlaced'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: [png({ extra: [chunk('tRNS', Buffer.alloc(6))] })] })),
    failure('UNSUPPORTED', 'image PNG chunk profile'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.images[0].uri = 'wall.png'; } })),
    failure('UNSUPPORTED', 'image.uri'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.images[0].mimeType = 'image/jpeg'; } })),
    failure('UNSUPPORTED', 'image MIME type'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.meshes[0].primitives[0].attributes.TEXCOORD_1 = 2; } })),
    failure('UNSUPPORTED', 'mesh primitive.attributes.TEXCOORD_1'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 1; } })),
    failure('UNSUPPORTED', 'material.baseColorTexture.texCoord'));
});

test('textured GLB refuses invalid embedded byte ranges and unsafe UV data', () => {
  for (const change of [{ byteLength: 0 }, { byteLength: 8 * MiB }, { byteOffset: 8 * MiB }, { byteLength: -1 }]) {
    assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => Object.assign(model.bufferViews[3], change) })),
      failure('INVALID'));
  }
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: [Buffer.concat([png(), Buffer.from([0])])] })),
    failure('INVALID', 'image PNG IEND'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.accessors[2].bufferView = 3; } })),
    failure('INVALID', 'bufferView used by image and accessor'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.bufferViews[2].byteLength = 8; } })),
    failure('INVALID', 'accessor byte range'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ edit: model => { model.accessors[2].max = [2, 1]; } })),
    failure('INVALID', 'TEXCOORD_0 bounds'));
  for (const value of [Infinity, NaN, 2 ** 21, 2 ** -140]) {
    assert.throws(() => readStaticGlbTexturePlan3D(glb({ editBinary: view => view.setFloat32(uvOffset, value, true) })),
      failure('INVALID', 'TEXCOORD_0 binary32'));
  }
});

test('textured GLB bounds each encoded image and the aggregate before publication', () => {
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: [new Uint8Array(4 * MiB + 1)] })),
    failure('BUDGET', 'image PNG bytes'));
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: [png({ width: 4097 })] })),
    failure('BUDGET', 'image PNG dimensions'));
  const stored = png({ width: 1024, height: 1024, level: 0 });
  assert(stored.byteLength < 4 * MiB && 2 * stored.byteLength > 6 * MiB);
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: [stored, stored] })),
    failure('BUDGET', 'total image PNG bytes'));
  const compressed = png({ width: 1024, height: 1024 });
  assert.throws(() => readStaticGlbTexturePlan3D(glb({ images: Array(5).fill(compressed) })),
    failure('BUDGET', 'total image PNG pixels'));
});

test('public textured GLB binds one opaque image atomically and keeps old revisions usable', () => {
  const plan = prepareTexturedStaticGlbScene3D(createTexturedRoomGlb());
  const rgba = Uint8Array.of(255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255);
  const firstImage = createImageData2D({ width: 2, height: 2, pixels: rgba });
  const first = plan.bindImages([{ imageIndex: 0, source: firstImage }]);
  const camera = createSceneCamera3D({ eye: [0, 0, 5], target: [0, 0, 0],
    projection: { kind: 'orthographic', height: 3, aspect: 1.5, near: 1, far: 12 } });
  const expected = first.capture(camera);
  assert.equal(expected.draws[0].texture.source, firstImage);
  assert.deepEqual(expected.draws[0].texture.texcoords, [0, 0, 0, 1, 1, 0, 1, 1]);
  assert.equal(expected.sceneBytes, 152);
  assert.equal(expected.cpuLogicalBytes, 304);
  assert.equal(expected.uniformBytes, 64);
  assert.throws(() => plan.bindImages([]), failure('INVALID', 'image bindings'));
  assert.throws(() => plan.bindImages([{ imageIndex: 0, source: { ...firstImage } }]), failure('INVALID', 'image binding'));
  rgba[3] = 0;
  const transparent = createImageData2D({ width: 2, height: 2, pixels: rgba });
  assert.throws(() => plan.bindImages([{ imageIndex: 0, source: transparent }]), failure('UNSUPPORTED', 'image binding alpha'));
  assert.deepEqual(first.capture(camera), expected);
  rgba[3] = 255;
  rgba[0] = 127;
  const secondImage = createImageData2D({ width: 2, height: 2, pixels: rgba });
  const second = plan.bindImages([{ imageIndex: 0, source: secondImage }]);
  assert.equal(second.capture(camera).draws[0].texture.source, secondImage);
  assert.equal(first.capture(camera).draws[0].texture.source, firstImage);
});
