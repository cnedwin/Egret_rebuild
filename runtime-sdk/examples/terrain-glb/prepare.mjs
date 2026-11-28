// SPDX-License-Identifier: Apache-2.0
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// An indexed height field. Every vertex contributes to the silhouette, lighting
// or UVs of a rendered triangle. The only padding is GLB's four-byte alignment.
export async function makeTerrainGlb() {
  const cells = 164;
  const side = cells + 1;
  const vertices = side * side;
  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const indices = new Uint16Array(cells * cells * 6);
  let low = Infinity, high = -Infinity, nextIndex = 0;
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      const v = row * side + col;
      const x = 8 * col / cells - 4, z = 8 * row / cells - 4;
      const h = Math.fround(0.7 * Math.sin(x) * Math.cos(z));
      positions.set([x, h, z], 3 * v);
      low = Math.min(low, h);
      high = Math.max(high, h);
      const nx = -0.7 * Math.cos(x) * Math.cos(z), nz = 0.7 * Math.sin(x) * Math.sin(z);
      const length = Math.hypot(nx, 1, nz);
      normals.set([nx / length, 1 / length, nz / length], 3 * v);
      uv.set([4 * col / cells, 4 * row / cells], 2 * v);
      if (row < cells && col < cells) {
        indices.set([v, v + side, v + 1, v + 1, v + side, v + side + 1], nextIndex);
        nextIndex += 6;
      }
    }
  }
  const image = await readFile(new URL('../indexed-mesh/assets/mantle.png', import.meta.url));
  const parts = [positions, normals, uv, indices].map(array => Buffer.from(array.buffer));
  parts.push(image);
  let bytes = 0;
  const views = parts.map(part => {
    const byteOffset = bytes;
    bytes += part.byteLength;
    return { buffer: 0, byteOffset, byteLength: part.byteLength };
  });
  const json = {
    asset: { version: '2.0', generator: 'Egret terrain example' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertices, type: 'VEC3', min: [-4,low,-4], max: [4,high,4] },
      { bufferView: 1, componentType: 5126, count: vertices, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: vertices, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: indices.length, type: 'SCALAR' }
    ],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
    textures: [{ source: 0 }], images: [{ mimeType: 'image/png', bufferView: 4 }],
    buffers: [{ byteLength: bytes }], bufferViews: views
  };
  const metadata = Buffer.from(JSON.stringify(json));
  const aligned = size => Math.ceil(size / 4) * 4;
  const jsonSize = aligned(metadata.length), binSize = aligned(bytes);
  const binary = Buffer.alloc(28 + jsonSize + binSize);
  binary.write('glTF');
  binary.writeUInt32LE(2, 4);
  binary.writeUInt32LE(binary.length, 8);
  binary.writeUInt32LE(jsonSize, 12);
  binary.write('JSON', 16);
  binary.fill(0x20, 20, 20 + jsonSize);
  metadata.copy(binary, 20);
  binary.writeUInt32LE(binSize, 20 + jsonSize);
  binary.write('BIN\0', 24 + jsonSize);
  for (const [i, part] of parts.entries()) part.copy(binary, 28 + jsonSize + views[i].byteOffset);
  return binary;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node prepare.mjs <new-project-directory>');
  const binary = await makeTerrainGlb();
  await mkdir(output);
  for (const name of ['main.mjs','project.json','index.html']) {
    await copyFile(new URL(name, import.meta.url), path.join(output, name));
  }
  await writeFile(path.join(output, 'terrain.glb'), binary);
  console.log('terrain.glb:', binary.length, 'bytes');
}
