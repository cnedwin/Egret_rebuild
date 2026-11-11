// SPDX-License-Identifier: Apache-2.0
// Original two-by-two RGB8 fixture with distinct top-left, top-right, bottom-left and bottom-right colors.
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=';
const unlit = 'KHR_materials_unlit';

export function createTexturedRoomGlb() {
  const png = Uint8Array.from(atob(pngBase64), character => character.charCodeAt(0));
  const binary = new Uint8Array(Math.ceil((92 + png.length) / 4) * 4);
  const view = new DataView(binary.buffer);
  const positions = [-1.9, 1.3, 0, -1.9, -1.3, 0, 1.9, 1.3, 0, 1.9, -1.3, 0];
  const uv = [0, 0, 0, 1, 1, 0, 1, 1];
  positions.forEach((value, index) => view.setFloat32(4 * index, value, true));
  [0, 1, 2, 2, 1, 3].forEach((value, index) => view.setUint16(48 + 2 * index, value, true));
  uv.forEach((value, index) => view.setFloat32(60 + 4 * index, value, true));
  binary.set(png, 92);
  const model = {
    asset: { version: '2.0' },
    extensionsUsed: [unlit],
    extensionsRequired: [unlit],
    buffers: [{ byteLength: 92 + png.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48, target: 34962 },
      { buffer: 0, byteOffset: 48, byteLength: 12, target: 34963 },
      { buffer: 0, byteOffset: 60, byteLength: 32, target: 34962 },
      { buffer: 0, byteOffset: 92, byteLength: png.length },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-1.9, -1.3, 0], max: [1.9, 1.3, 0] },
      { bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
    ],
    images: [{ bufferView: 3, mimeType: 'image/png' }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    textures: [{ sampler: 0, source: 0 }],
    materials: [{
      doubleSided: true, extensions: { [unlit]: {} },
      pbrMetallicRoughness: { baseColorFactor: [.5, 1, 1, 1], baseColorTexture: { index: 0 } },
    }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 2 }, indices: 1, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const json = new TextEncoder().encode(JSON.stringify(model));
  const jsonBytes = Math.ceil(json.length / 4) * 4;
  const result = new Uint8Array(28 + jsonBytes + binary.length);
  const header = new DataView(result.buffer);
  [0x46546c67, 2, result.length, jsonBytes, 0x4e4f534a].forEach((value, index) => header.setUint32(4 * index, value, true));
  result.fill(32, 20, 20 + jsonBytes);
  result.set(json, 20);
  header.setUint32(20 + jsonBytes, binary.length, true);
  header.setUint32(24 + jsonBytes, 0x004e4942, true);
  result.set(binary, 28 + jsonBytes);
  return result;
}
