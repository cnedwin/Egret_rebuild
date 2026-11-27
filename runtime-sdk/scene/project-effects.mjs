// SPDX-License-Identifier: Apache-2.0
// EGR6 interleaves EGR5 draws with a small, bounded set of isolated groups.
export const EFFECT_MAGIC = 0x36524745;
export const EFFECT_ENTER = 128, EFFECT_EXIT = 129;
export const MAX_EFFECT_GROUPS = 8, MAX_EFFECT_DEPTH = 4;

function within(value, low, high) {
  return Number.isFinite(value) && low <= value && value <= high;
}

/** Check the complete group before allocating the frame or reading mesh payloads. */
export function prepareProjectEffect(effect, compositionClip) {
  if (!effect || effect.maskPageIndex !== undefined || effect.maskRect !== undefined)
    throw new Error('Unsupported project effect or mask');
  const matrix = effect.colorMatrix, blur = effect.blurRadius, glow = effect.glow;
  if (!Number.isInteger(blur) || !within(blur, 0, 8)) throw new RangeError('Invalid project blur radius');
  if (matrix !== undefined && (!Array.isArray(matrix) || matrix.length !== 20 ||
      !Array.from(matrix).every(v => within(v, -65536, 65536))))
    throw new RangeError('Invalid project color matrix');
  if (glow !== undefined && (!glow || typeof glow !== 'object' || !['glow', 'outline'].includes(glow.kind) || !Number.isInteger(glow.color) ||
      !within(glow.color, 0, 0xffffff) || !within(glow.alpha, 0, 1) || !within(glow.strength, 0, 255) ||
      !within(glow.spread, 0, 16) || !within(glow.offsetX, -256, 256) || !within(glow.offsetY, -256, 256) ||
      typeof glow.inner !== 'boolean' || typeof glow.knockout !== 'boolean'))
    throw new RangeError('Invalid project glow');
  // A deliberately empty group still isolates its children's blending. Represent it with radius zero.
  const flags = (matrix ? 1 : 0) | (blur || (!matrix && !glow) ? 2 : 0) | (glow ? 4 : 0);
  return {flags, matrix, blur, glow, compositionClip,
    length: 24 + (matrix ? 80 : 0) + (flags & 2 ? 4 : 0) + (glow ? 28 : 0)};
}

export function writeEffectEnter(view, at, group) {
  const {flags, matrix, blur, glow, compositionClip} = group;
  view.setUint32(at, EFFECT_ENTER, true);
  view.setUint32(at + 4, flags, true);
  let p = at + 8;
  for (const edge of compositionClip) { view.setFloat32(p, edge, true); p += 4; }
  if (matrix) for (const factor of matrix) { view.setFloat32(p, factor, true); p += 4; }
  if (flags & 2) { view.setFloat32(p, blur, true); p += 4; }
  if (glow) {
    view.setFloat32(p, glow.spread, true);
    view.setFloat32(p + 4, glow.strength, true);
    view.setUint32(p + 8, glow.color, true);
    view.setFloat32(p + 12, glow.alpha, true);
    view.setFloat32(p + 16, glow.offsetX, true);
    view.setFloat32(p + 20, glow.offsetY, true);
    view.setUint32(p + 24, (glow.inner ? 1 : 0) | (glow.knockout ? 2 : 0) | (glow.kind === 'outline' ? 4 : 0), true);
  }
}
