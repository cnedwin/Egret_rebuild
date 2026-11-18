// SPDX-License-Identifier: Apache-2.0
const HEADER = 24;
const QUAD = 48;
export const FRAME_MAGIC = 0x31524745; // EGR1, little-endian

// EGR1 intentionally represents only this opaque, nearest-filtered 2D profile.
// Refusing an unsupported frame prevents replay from silently changing its image.
function admit(command, frame) {
  if (command.kind !== 'image' && command.kind !== 'rect') throw new Error('Unsupported draw: ' + command.kind);
  const m = frame.materials[command.materialIndex];
  if (command.opacity !== 1 || command.clips.length || m.blend !== 'normal' ||
      m.light.some(value => value !== 1) || m.dark.some(value => value !== 0) ||
      m.filter !== 'nearest' || m.minFilter !== 'nearest' || m.magFilter !== 'nearest' ||
      m.addressU !== 'clamp-to-edge' || m.addressV !== 'clamp-to-edge' ||
      m.mipLevel !== 0 || m.maxAnisotropy !== 1) throw new Error('Unsupported draw state');
}

function rgba(rgb) {
  return ((rgb << 8) | 255) >>> 0;
}

// The wire frame id identifies the animation slot, independent of the
// engine's monotonic capture id. It is identical for live and replay cycles.
export function encodeFrame(frame, slot, atlas, atlasId) {
  if (frame.profile !== 'egret.shared-frame2d/1' || frame.outputAlpha !== 'opaque' ||
      frame.clearAlpha !== 1 || frame.pages.length !== 1 || frame.pages[0].source !== atlas ||
      frame.commands.length > 4096) throw new Error('Unsupported frame or unleased page');
  if (!Number.isInteger(slot) || slot < 0 || slot >= 0xffffffff ||
      !Number.isInteger(atlasId) || atlasId < 1 || atlasId > 255) throw new RangeError('Invalid wire identifier');
  const buffer = new ArrayBuffer(HEADER + QUAD * frame.commands.length);
  const view = new DataView(buffer);
  const header = [FRAME_MAGIC, slot + 1, frame.width, frame.height, rgba(frame.clearColor), frame.commands.length];
  header.forEach((value, i) => view.setUint32(i * 4, value, true));
  for (const [i, command] of frame.commands.entries()) {
    admit(command, frame);
    const base = HEADER + i * QUAD;
    const { x, y, width, height } = command.rect;
    const { a, b, c, d, tx, ty } = command.matrix;
    const ox = a * x + c * y + tx;
    const oy = b * x + d * y + ty;
    let pageId = 0;
    let color = 0xffffffff;
    let uv = [0, 0, 1, 1];
    if (command.kind === 'rect') {
      if (command.fillAlpha !== 1) throw new Error('Unsupported rectangle alpha');
      color = rgba(command.fillColor);
    } else {
      const region = frame.regions[command.regionIndex];
      if (region.pageIndex !== 0 || region.quarterTurn !== 0 || region.trimX || region.trimY ||
          region.logicalWidth !== region.packed.width || region.logicalHeight !== region.packed.height)
        throw new Error('Unsupported atlas mapping');
      const r = region.packed;
      uv = [r.x / atlas.width, r.y / atlas.height, (r.x + r.width) / atlas.width, (r.y + r.height) / atlas.height];
      pageId = atlasId;
    }
    view.setUint32(base, pageId, true);
    view.setUint32(base + 4, color, true);
    const coords = [ox, oy, ox + a * width, oy + b * width, ox + c * height, oy + d * height, ...uv];
    coords.forEach((value, j) => view.setFloat32(base + 8 + j * 4, value, true));
  }
  return new Uint8Array(buffer);
}

export function base64(bytes) {
  // Chunking keeps the argument count bounded for a full accepted frame.
  let text = '';
  for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(text);
}
