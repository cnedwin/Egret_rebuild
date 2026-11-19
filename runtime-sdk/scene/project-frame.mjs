// SPDX-License-Identifier: Apache-2.0
// EGR2 uses a 24-byte little-endian header and 64-byte records. Page 0 is white.
// Each record contains page:u8, straight RGB:u8x3, opacity:f32, three affine
// corners, two UV corners and the intersected logical clip (left,top,right,bottom).
export const PROJECT_FRAME_MAGIC = 0x32524745;
const HEADER = 24, QUAD = 64, MAX_QUADS = 4096;
const barriers = new Set(['clip-enter', 'clip-exit', 'explicit-enter', 'explicit-exit', 'empty']);

function unit(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Invalid project alpha');
  return value;
}

function rgb(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) throw new RangeError('Invalid project color');
  return value;
}

function corners({a, b, c, d, tx, ty}, {x, y, width, height}) {
  const left = a*x + c*y + tx, top = b*x + d*y + ty;
  const values = [left, top, left + a*width, top + b*width, left + c*height, top + d*height];
  if (values.some(v => !Number.isFinite(v) || Math.abs(v) > 16777216)) throw new RangeError('Invalid project corner');
  return values;
}

function clipBounds(clips, width, height) {
  let left = 0, top = 0, right = width, bottom = height;
  for (const {matrix, rect} of clips) {
    if (!(matrix.b === 0 && matrix.c === 0) && !(matrix.a === 0 && matrix.d === 0))
      throw new Error('Unsupported non-axis-aligned project clip');
    const [x, y, u, v, s, t] = corners(matrix, rect);
    left = Math.max(left, Math.min(x, u, s));
    right = Math.min(right, Math.max(x, u, s));
    top = Math.max(top, Math.min(y, v, t));
    bottom = Math.min(bottom, Math.max(y, v, t));
  }
  left = Math.min(left, width);
  top = Math.min(top, height);
  return [left, top, Math.max(left, right), Math.max(top, bottom)];
}

function supportedMaterial(material) {
  return material?.blend === 'normal' && material.light.every(x => x === 1) && material.dark.every(x => x === 0)
    && material.filter === 'nearest' && material.magFilter === 'nearest' && material.minFilter === 'nearest'
    && material.addressU === 'clamp-to-edge' && material.addressV === 'clamp-to-edge'
    && material.mipLevel === 0 && material.maxAnisotropy === 1;
}

// pageIds is the project's Map from the original ImageData2D object to the
// resident slot uploaded by its native host. Capture-local page order can vary.
export function encodeProjectFrame(frame, frameId, pageIds) {
  if (frame.profile !== 'egret.shared-frame2d/1' || frame.colorRecipe !== 'egret.linear-srgb-pma/1' ||
      frame.targetRepresentation !== 'egret.srgb-pma8-target/1' ||
      !(frame.outputAlpha === 'premultiplied' || (frame.outputAlpha === 'opaque' && frame.clearAlpha === 1)))
    throw new Error('Unsupported project frame profile');
  if (!Number.isInteger(frameId) || frameId < 0 || frameId > 0xffffffff ||
      [frame.width, frame.height].some(v => !Number.isInteger(v) || v < 1 || v > 16384))
    throw new RangeError('Invalid project frame header');
  const used = new Set();
  const slots = frame.pages.map(({source}) => {
    const slot = pageIds.get(source);
    if (!Number.isInteger(slot) || slot < 1 || slot > 255 || used.has(slot)) throw new Error('Invalid or missing project page');
    used.add(slot);
    return slot;
  });
  let count = 0;
  for (const command of frame.commands) {
    if (command.kind === 'barrier') {
      if (!barriers.has(command.reason)) throw new Error('Unsupported project barrier: ' + command.reason);
    } else if (command.kind === 'rect' || command.kind === 'image') {
      if (++count > MAX_QUADS) throw new RangeError('Project quad limit exceeded');
    } else throw new Error('Unsupported project draw: ' + command.kind);
  }
  const buffer = new ArrayBuffer(HEADER + QUAD * count);
  const view = new DataView(buffer);
  const clear = rgb(frame.clearColor)*256 + Math.round(unit(frame.clearAlpha)*255);
  [PROJECT_FRAME_MAGIC, frameId, frame.width, frame.height, clear, count]
    .forEach((value, i) => view.setUint32(i*4, value, true));
  let base = HEADER;
  for (const cmd of frame.commands) {
    if (cmd.kind === 'barrier') continue;
    if (!supportedMaterial(frame.materials[cmd.materialIndex])) throw new Error('Unsupported project material');
    let slot = 0, color = 0xffffff, opacity = unit(cmd.opacity), uv = [0, 0, 1, 1];
    if (cmd.kind === 'rect') {
      color = rgb(cmd.fillColor);
      opacity *= unit(cmd.fillAlpha);
    } else {
      const region = frame.regions[cmd.regionIndex];
      if (!region || region.quarterTurn !== 0 || region.trimX !== 0 || region.trimY !== 0 ||
          region.logicalWidth !== region.packed.width || region.logicalHeight !== region.packed.height)
        throw new Error('Unsupported project atlas mapping');
      const page = frame.pages[region.pageIndex]?.source;
      if (!page) throw new Error('Invalid project image page');
      const r = region.packed;
      if (frame.materials[cmd.materialIndex].samplingDomain === 'page' &&
          (r.x !== 0 || r.y !== 0 || r.width !== page.width || r.height !== page.height))
        throw new Error('Unsupported page sampling outside a project atlas crop');
      uv = [r.x/page.width, r.y/page.height, (r.x+r.width)/page.width, (r.y+r.height)/page.height];
      if (uv.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new RangeError('Invalid project atlas bounds');
      slot = slots[region.pageIndex];
    }
    view.setUint8(base, slot);
    view.setUint8(base+1, color >>> 16);
    view.setUint8(base+2, color >>> 8);
    view.setUint8(base+3, color);
    const floats = [opacity, ...corners(cmd.matrix, cmd.rect), ...uv, ...clipBounds(cmd.clips, frame.width, frame.height)];
    floats.forEach((v, i) => view.setFloat32(base+4+i*4, v, true));
    base += QUAD;
  }
  return new Uint8Array(buffer);
}
