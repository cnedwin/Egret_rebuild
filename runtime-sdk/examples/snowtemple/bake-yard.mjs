// SPDX-License-Identifier: Apache-2.0
// Run with the game's vendor resolver, from the offline --lit-temple preparation.
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { Scene3D } from '@egret/engine/world3d';

const directory = path.resolve(process.argv[2]);
const { buildGround, buildCart, brazier, createBuilder, rounds } = await import(
  pathToFileURL(path.join(directory, 'original/yard-stage.mjs'))
);

// Preserve the original vertex positions, winding, indexed colors and normals.
// Keep complete triangles covering the playable route; skip the distant mountains.
function encodeGeometry(geometry, inside) {
  const [position, normal, color] = ['position', 'normal', 'color'].map(name => geometry.getAttribute(name));
  const indices = [], remap = new Map(), vertices = [];
  function take(i) {
    if (remap.has(i)) return remap.get(i);
    const target = remap.size;
    remap.set(i, target);
    for (const attribute of [position, normal, color]) {
      const start = i * attribute.itemSize;
      vertices.push(...attribute.data.subarray(start, start + 3));
    }
    return target;
  }
  const original = geometry.index.data;
  for (let i = 0; i < original.length; i += 3) {
    const triangle = original.subarray(i, i + 3);
    if (inside && !triangle.every(index => inside(position.data[index * 3], position.data[index * 3 + 2]))) continue;
    for (const index of triangle) indices.push(take(index));
  }
  const bytes = Buffer.alloc(8 + vertices.length * 4 + indices.length * 4);
  bytes.writeUInt32LE(remap.size);
  bytes.writeUInt32LE(indices.length, 4);
  vertices.forEach((v, i) => bytes.writeFloatLE(v, 8 + i * 4));
  indices.forEach((v, i) => bytes.writeUInt32LE(v, 8 + vertices.length * 4 + i * 4));
  return bytes;
}
const scene = new Scene3D();
buildGround(scene);
const cartAndBraziers = createBuilder(), coals = createBuilder();
for (const {kind, x, z} of rounds) {
  if (kind === 'cart') buildCart(cartAndBraziers, x, z);
  if (kind === 'brazier') brazier(cartAndBraziers, coals, x, z);
}
const sizes = {};
for (const [name, geometry, inside] of [
  ['yard-ground.bin', scene.children[0].geometry, (x, z) => Math.abs(x) <= 18 && z >= -43 && z <= 45],
  ['yard-props.bin', cartAndBraziers.geometry()],
  ['yard-coals.bin', coals.geometry()]
]) {
  const bytes = encodeGeometry(geometry, inside);
  await writeFile(path.join(directory, name), bytes);
  sizes[name] = bytes.length;
}
console.log(JSON.stringify(sizes));
