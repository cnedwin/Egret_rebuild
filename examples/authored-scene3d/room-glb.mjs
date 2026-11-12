// SPDX-License-Identifier: Apache-2.0
// This original fixture generates a self-contained GLB rather than using external art.
const panels = [
  { width: .92, height: .72, color: [1, 0, 0, 1] },
  { width: 1.85, height: 1.35, color: [0, 0, 1, 1] },
];
const quad = [0, 1, 2, 0, 2, 3];
const positionBytes = 4 * 3 * Float32Array.BYTES_PER_ELEMENT;
const indexBytes = quad.length * Uint16Array.BYTES_PER_ELEMENT;
const panelBytes = positionBytes + indexBytes;
const unlit = 'KHR_materials_unlit';

export function createPanelGlb({ reverse = false, animated = false } = {}) {
  const meshBytes = panels.length * panelBytes;
  const animation = animated ? {
    moveTime: [0, 2], move: [-.2, 0, 1, 1.65, 0, 1],
    scaleTime: [0, 1, 2], scale: [1, 1, 1, 1, .5, 1, 1, 1, 1],
  } : undefined;
  const animationBytes = animation ? Object.values(animation)
    .reduce((bytes, values) => bytes + values.length * Float32Array.BYTES_PER_ELEMENT, 0) : 0;
  const bin = new Uint8Array(meshBytes + animationBytes);
  const payload = new DataView(bin.buffer);
  const bufferViews = [], accessors = [], meshes = [], materials = [];
  for (const [index, panel] of panels.entries()) {
    const offset = index * panelBytes;
    const w = Math.fround(panel.width), h = Math.fround(panel.height);
    const position = [-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0];
    position.forEach((value, i) => payload.setFloat32(offset + i * 4, value, true));
    quad.forEach((value, i) => payload.setUint16(offset + positionBytes + i * 2, value, true));
    const view = bufferViews.length;
    bufferViews.push(
      { buffer: 0, byteOffset: offset, byteLength: positionBytes, target: 34962 },
      { buffer: 0, byteOffset: offset + positionBytes, byteLength: indexBytes, target: 34963 },
    );
    const accessor = accessors.length;
    accessors.push(
      { bufferView: view, componentType: 5126, count: 4, type: 'VEC3', min: [-w, -h, 0], max: [w, h, 0] },
      { bufferView: view + 1, componentType: 5123, count: quad.length, type: 'SCALAR', min: [0], max: [3] },
    );
    materials.push({ doubleSided: true, alphaMode: 'OPAQUE',
      extensions: { [unlit]: {} }, pbrMetallicRoughness: { baseColorFactor: panel.color },
    });
    meshes.push({ primitives: [{ attributes: { POSITION: accessor }, indices: accessor + 1, material: index, mode: 4 }] });
  }

  const model = {
    asset: { version: '2.0' },
    extensionsUsed: [unlit], extensionsRequired: [unlit],
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [
      { translation: [.25, 0, 0], children: reverse ? [2, 1] : [1, 2] },
      { mesh: 0, translation: [-.2, 0, 1] },
      { mesh: 1, translation: [0, 0, -1] },
    ],
    buffers: [{ byteLength: bin.byteLength }], bufferViews, accessors, materials, meshes,
  };
  if (animation) {
    let offset = meshBytes;
    function appendFloatAccessor(type, count, values, bounds = {}) {
      const accessor = accessors.length;
      const byteLength = values.length * Float32Array.BYTES_PER_ELEMENT;
      accessors.push({ bufferView: bufferViews.length, componentType: 5126, count, type, ...bounds });
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength });
      values.forEach((value, i) => payload.setFloat32(offset + i * 4, value, true));
      offset += byteLength;
      return accessor;
    }
    const moveTime = appendFloatAccessor('SCALAR', 2, animation.moveTime, { min: [0], max: [2] });
    const move = appendFloatAccessor('VEC3', 2, animation.move);
    const scaleTime = appendFloatAccessor('SCALAR', 3, animation.scaleTime, { min: [0], max: [2] });
    const scale = appendFloatAccessor('VEC3', 3, animation.scale);
    model.animations = [{ name: 'Slide and scale',
      samplers: [{ input: moveTime, output: move }, { input: scaleTime, output: scale, interpolation: 'STEP' }],
      channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }, { sampler: 1, target: { node: 1, path: 'scale' } }],
    }];
  }
  const json = new TextEncoder().encode(JSON.stringify(model));
  const jsonSize = Math.ceil(json.byteLength / 4) * 4;
  const out = new Uint8Array(12 + 8 + jsonSize + 8 + bin.byteLength);
  const header = new DataView(out.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, out.byteLength, true);
  header.setUint32(12, jsonSize, true);
  header.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonSize);
  out.set(json, 20);
  header.setUint32(20 + jsonSize, bin.byteLength, true);
  header.setUint32(24 + jsonSize, 0x004e4942, true);
  out.set(bin, 28 + jsonSize);
  return out;
}
