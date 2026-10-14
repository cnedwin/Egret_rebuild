// SPDX-License-Identifier: Apache-2.0
// This private adapter copies a qualified Core command, never pose algorithms.
import { EgretError, createTexturedGeometry2D } from '@egret/engine';
import type { TexturedGeometry2D } from '@egret/engine';
import { BlendMode } from '@esotericsoftware/spine-core';
import type { RenderCommand, Texture as CoreTexture } from '@esotericsoftware/spine-core';

const APPLY = Reflect.apply;
const DESCRIPTOR = Object.getOwnPropertyDescriptor;
const FLOATS = Float64Array;
const INDICES = Uint16Array;
const FINITE = Number.isFinite;
const INTEGER = Number.isSafeInteger;
const TYPED_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const ARRAY_TAG = DESCRIPTOR(TYPED_PROTOTYPE, Symbol.toStringTag)!.get!;
const ARRAY_LENGTH = DESCRIPTOR(TYPED_PROTOTYPE, 'length')!.get!;

/** Pool capacity fields are intentionally ignored; only native used views count. */
function nativeRange(value: unknown, tag: string, length: number): void {
  if (APPLY(ARRAY_TAG, value, []) !== tag || APPLY(ARRAY_LENGTH, value, []) !== length) {
    throw new EgretError('F2C_COMMAND_PROFILE');
  }
}

/** A private experiment port. Counts originate in the admitted source setup. */
export function copyF2CoreCommand(
  head: RenderCommand | undefined, pageWrapper: CoreTexture,
  expectedCounts: Readonly<{ vertices: number; indices: number }>,
): TexturedGeometry2D {
  if (head === undefined || head === null || head.next != null
    || head.blendMode !== BlendMode.Normal || head.texture !== pageWrapper) {
    throw new EgretError('F2C_COMMAND_PROFILE');
  }
  const vertices = head.numVertices;
  const count = head.numIndices;
  if (!INTEGER(vertices) || !INTEGER(count) || vertices < 3 || count < 3 || count % 3 !== 0) {
    throw new EgretError('F2C_COMMAND_PROFILE');
  }
  if (vertices > 4096 || count > 12288) throw new EgretError('F2C_COMMAND_CAPACITY');
  if (vertices !== expectedCounts.vertices || count !== expectedCounts.indices) {
    throw new EgretError('F2C_COMMAND_PROFILE');
  }
  nativeRange(head.positions, 'Float32Array', 2 * vertices);
  nativeRange(head.uvs, 'Float32Array', 2 * vertices);
  nativeRange(head.colors, 'Uint32Array', vertices);
  nativeRange(head.darkColors, 'Uint32Array', vertices);
  nativeRange(head.indices, 'Uint16Array', count);

  const positions = new FLOATS(2 * vertices);
  const uvs = new FLOATS(2 * vertices);
  const lightColors = new FLOATS(4 * vertices);
  const indices = new INDICES(count);
  for (let vertex = 0; vertex < vertices; vertex++) {
    const component = 2 * vertex;
    const x = head.positions[component]!;
    const y = head.positions[component + 1]!;
    const u = head.uvs[component]!;
    const v = head.uvs[component + 1]!;
    if (!FINITE(x) || !FINITE(y) || !FINITE(u) || !FINITE(v)
      || u < 0 || u > 1 || v < 0 || v > 1
      || head.colors[vertex] !== 0xffffffff || head.darkColors[vertex] !== 0) {
      throw new EgretError('F2C_COMMAND_PROFILE');
    }
    positions[component] = x;
    positions[component + 1] = -y; // The sole Core-to-Egret Y inversion.
    uvs[component] = u;
    uvs[component + 1] = v;
    for (let color = 0; color < 4; color++) lightColors[4 * vertex + color] = 1;
  }
  for (let index = 0; index < count; index++) {
    const value = head.indices[index]!;
    if (value >= vertices) throw new EgretError('F2C_COMMAND_PROFILE');
    indices[index] = value;
  }
  // The public factory authenticates, owns and freezes a second independent copy.
  // No returned geometry retains a Core command, its pool, or these native arrays.
  return createTexturedGeometry2D({ positions, uvs, lightColors, indices });
}
