// SPDX-License-Identifier: Apache-2.0
// EGR2 uses a 24-byte little-endian header and 64-byte records. Page 0 is white.
// Each record contains page:u8, straight RGB:u8x3, opacity:f32, three affine
// corners, two UV corners and the intersected logical clip (left,top,right,bottom).
import {EFFECT_MAGIC, EFFECT_EXIT, MAX_EFFECT_GROUPS, MAX_EFFECT_DEPTH, prepareProjectEffect, writeEffectEnter} from './project-effects.mjs';

export const PROJECT_FRAME_MAGIC = 0x32524745;
const ATLAS_FRAME_MAGIC = 0x33524745;
const INDEXED_FRAME_MAGIC = 0x34524745;
const MATERIAL_FRAME_MAGIC = 0x35524745;
// The low two bits retain the EGR4 record kind. EGR5 adds only the fields an
// actual draw uses, leaving earlier neutral packets byte-for-byte unchanged.
const MULTIPLY = 4, ADD = 8, LINEAR = 16, VERTEX_LIGHT = 32, SOLID_PAGE = 64;
const HEADER = 24, QUAD = 64, MAX_QUADS = 4096;
const MAX_FRAME_BYTES = HEADER + MAX_QUADS * (QUAD + 24);
const INDEXED_HEADER = 52, INDEXED_VERTEX = 16, INLINE_MAPPING = 20;
const MAX_LOGICAL_SIZE = 1 << 20;
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

function materialFlags(material) {
  if (!material || !material.light.every(x => x === 1) || !material.dark.every(x => x === 0)
      || !['normal', 'multiply-factor', 'add-accumulate'].includes(material.blend)
      || !['linear', 'nearest'].includes(material.filter)
      || material.magFilter !== material.filter || material.minFilter !== material.filter
      || material.addressU !== 'clamp-to-edge' || material.addressV !== 'clamp-to-edge'
      || (material.mipmapFilter != null && material.mipmapFilter !== 'none')
      || material.mipLevel !== 0 || material.maxAnisotropy !== 1)
    throw new Error('Unsupported project material');
  let flags = material.filter === 'linear' ? LINEAR : 0;
  if (material.blend === 'multiply-factor') flags |= MULTIPLY;
  if (material.blend === 'add-accumulate') flags |= ADD;
  return flags;
}

function needsAtlasMapping(region, page) {
  const {packed, logicalWidth, logicalHeight, trimX, trimY, quarterTurn} = region;
  if (!packed || !Number.isSafeInteger(packed.x) || !Number.isSafeInteger(packed.y) ||
    !Number.isSafeInteger(packed.width) || !Number.isSafeInteger(packed.height) ||
    packed.x < 0 || packed.y < 0 || packed.width < 1 || packed.height < 1 ||
    packed.x + packed.width > page.width || packed.y + packed.height > page.height ||
    logicalWidth > MAX_LOGICAL_SIZE || logicalHeight > MAX_LOGICAL_SIZE)
    throw new RangeError('Invalid project atlas bounds');
  if (quarterTurn === 0 && trimX === 0 && trimY === 0 &&
      logicalWidth === packed.width && logicalHeight === packed.height) return false;
  if (!Number.isSafeInteger(logicalWidth) || !Number.isSafeInteger(logicalHeight) ||
    !Number.isSafeInteger(trimX) || !Number.isSafeInteger(trimY) || !Number.isSafeInteger(quarterTurn) ||
    logicalWidth < 1 || logicalHeight < 1 ||
    trimX < 0 || trimY < 0 || quarterTurn < 0 || quarterTurn > 3)
    throw new RangeError('Invalid project atlas mapping');
  const oddTurn = quarterTurn === 1 || quarterTurn === 3;
  if (trimX + (oddTurn ? packed.height : packed.width) > logicalWidth ||
      trimY + (oddTurn ? packed.width : packed.height) > logicalHeight)
    throw new RangeError('Invalid project atlas footprint');
  return true;
}

// EGR3 keeps EGR2 geometry and packed UVs. Only transformed atlas draws get a
// suffix entry, keyed by drawable ordinal so barriers do not affect the lookup.
function appendAtlasMapping(words, ordinal, region) {
  words ??= [];
  words.push(ordinal, region.logicalWidth, region.logicalHeight, region.trimX, region.trimY, region.quarterTurn);
  return words;
}

function writeMapping(view, at, region) {
  view.setUint32(at, region.logicalWidth, true);
  view.setUint32(at + 4, region.logicalHeight, true);
  view.setUint32(at + 8, region.trimX, true);
  view.setUint32(at + 12, region.trimY, true);
  view.setUint32(at + 16, region.quarterTurn, true);
}

function textureBinding(frame, cmd, material, slots) {
  const region = frame.regions[cmd.regionIndex];
  if (!region || !Number.isSafeInteger(region.pageIndex) || region.pageIndex < 0)
    throw new RangeError('Invalid project atlas page');
  const page = frame.pages[region.pageIndex]?.source;
  if (!page) throw new Error('Invalid project image page');
  const r = region.packed;
  const mapped = needsAtlasMapping(region, page);
  const slot = slots[region.pageIndex];
  if (material.samplingDomain === 'page') {
    // A mesh authors page-domain UVs directly. Image corners, by contrast, refer to its view.
    if (cmd.kind === 'mesh') return {region, page, slot, mapped: false, uv: [0, 0, 1, 1]};
    if (mapped || r.x !== 0 || r.y !== 0 || r.width !== page.width || r.height !== page.height)
      throw new Error('Unsupported page sampling outside a project atlas crop');
  }
  return {region, page, slot, mapped,
    uv: [r.x/page.width, r.y/page.height, (r.x+r.width)/page.width, (r.y+r.height)/page.height]};
}

// EGR4 interleaves typed draws in capture order. Work out the exact allocation
// and enforce the same bridge ceiling as EGR3 before touching any vertex data.
function indexedLayout(frame, slots, flags) {
  let extended = false;
  let size = HEADER;
  const draws = [];
  for (const cmd of frame.commands) {
    if (cmd.kind === 'barrier') continue;
    const material = frame.materials[cmd.materialIndex];
    let policy = flags[cmd.materialIndex];
    const texture = cmd.kind === 'rect' ? undefined : textureBinding(frame, cmd, material, slots);
    const mappingBytes = texture?.mapped ? INLINE_MAPPING : 0;
    let kind = texture?.mapped ? 1 : 0;
    let length = 4 + QUAD + mappingBytes;
    let geometry;
    if (cmd.kind === 'mesh') {
      geometry = frame.geometries?.[cmd.geometryIndex];
      if (!Number.isSafeInteger(cmd.geometryIndex) || cmd.geometryIndex < 0 || !geometry)
        throw new RangeError('Invalid project mesh geometry');
      const {vertexCount, indexCount, positions, uvs, lightColors, darkColors, indices} = geometry;
      if (!Number.isSafeInteger(vertexCount) || vertexCount < 3 ||
          !Number.isSafeInteger(indexCount) || indexCount < 3 || indexCount % 3 !== 0 ||
          geometry.triangleCount !== indexCount / 3 || positions?.length !== vertexCount*2 ||
          uvs?.length !== vertexCount*2 || lightColors?.length !== vertexCount*4 ||
          (darkColors !== undefined && darkColors?.length !== vertexCount*3) || indices?.length !== indexCount)
        throw new RangeError('Invalid project mesh shape');
      kind += 2;
      if (texture.slot === 0) policy |= SOLID_PAGE;
      // Non-neutral particle colors are straight linear RGBA. Preserve them as
      // floats through interpolation; neutral meshes need no color payload.
      if (lightColors.some(value => value !== 1)) policy |= VERTEX_LIGHT;
      length = INDEXED_HEADER + mappingBytes + (INDEXED_VERTEX + (policy & VERTEX_LIGHT ? 16 : 0)) * vertexCount + 4 * indexCount;
    }
    size += length;
    if (size > MAX_FRAME_BYTES) throw new RangeError('Project frame byte limit exceeded');
    extended ||= policy !== 0;
    draws.push({kind: kind | policy, length, geometry, texture});
  }
  return {size, draws, extended};
}

function writeMesh(view, at, cmd, draw, frame) {
  const {geometry, texture} = draw;
  const {vertexCount, indexCount, positions, uvs, lightColors, darkColors, indices} = geometry;
  const {mapped, region, uv, slot} = texture;
  view.setUint32(at + 4, slot, true);
  view.setFloat32(at + 8, unit(cmd.opacity), true);
  const clip = clipBounds(cmd.clips, frame.width, frame.height);
  for (let i = 0; i < 4; i++) {
    view.setFloat32(at + 12 + i*4, clip[i], true);
    view.setFloat32(at + 28 + i*4, uv[i], true);
  }
  view.setUint32(at + 44, vertexCount, true);
  view.setUint32(at + 48, indexCount, true);
  let cursor = at + INDEXED_HEADER;
  if (mapped) {
    writeMapping(view, cursor, region);
    cursor += INLINE_MAPPING;
  }
  const {a, b, c, d, tx, ty} = cmd.matrix;
  const withLight = (draw.kind & VERTEX_LIGHT) !== 0;
  for (let i = 0; i < vertexCount; i++, cursor += withLight ? 32 : INDEXED_VERTEX) {
    const x = positions[i*2], y = positions[i*2 + 1];
    const px = a*x + c*y + tx, py = b*x + d*y + ty;
    const u = uvs[i*2], v = uvs[i*2 + 1];
    if (!Number.isFinite(px) || !Number.isFinite(py) || Math.abs(px) > 16777216 || Math.abs(py) > 16777216 ||
        !Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1)
      throw new RangeError('Invalid project mesh coordinates');
    for (let channel = 0; channel < 4; channel++) {
      const light = lightColors[i*4 + channel];
      if (!Number.isFinite(light) || light < 0 || light > 1 ||
          (channel < 3 && darkColors && darkColors[i*3 + channel] !== 0))
        throw new Error('Unsupported project mesh vertex tint');
      if (withLight) view.setFloat32(cursor + INDEXED_VERTEX + 4*channel, light, true);
    }
    view.setFloat32(cursor, px, true);
    view.setFloat32(cursor + 4, py, true);
    // Trimmed margins and quarter-turns must be resolved after interpolation
    // in the shader. A plain crop can be expressed directly in page UVs.
    view.setFloat32(cursor + 8, mapped ? u : uv[0] + u*(uv[2]-uv[0]), true);
    view.setFloat32(cursor + 12, mapped ? v : uv[1] + v*(uv[3]-uv[1]), true);
  }
  for (let i = 0; i < indexCount; i++, cursor += 4) {
    const index = indices[i];
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) throw new RangeError('Invalid project mesh index');
    view.setUint32(cursor, index, true);
  }
}

// Captured region table entries can be recreated on every frame. The encoded UVs
// depend on their values, the source dimensions and the current resident slot.
function sameRegion(a, b) {
  return a === b || (a && b && a.quarterTurn === b.quarterTurn &&
    a.trimX === b.trimX && a.trimY === b.trimY &&
    a.logicalWidth === b.logicalWidth && a.logicalHeight === b.logicalHeight &&
    Object.is(a.packed.x, b.packed.x) && Object.is(a.packed.y, b.packed.y) &&
    Object.is(a.packed.width, b.packed.width) && Object.is(a.packed.height, b.packed.height));
}

function canReuse(saved, cmd, material, frame, slots) {
  if (saved.command !== cmd || saved.material !== material ||
      saved.width !== frame.width || saved.height !== frame.height) return false;
  if (cmd.kind === 'rect') return true;
  const region = frame.regions[cmd.regionIndex];
  if (!sameRegion(saved.region, region)) return false;
  const page = frame.pages[region.pageIndex]?.source;
  return page && saved.slot === slots[region.pageIndex] &&
    saved.pageWidth === page.width && saved.pageHeight === page.height;
}

// Only the project player feeds this encoder immutable Engine captures. A command
// can keep its identity while its material, atlas entry or page binding changes.
export function createCapturedProjectEncoder({subtreeEffects = true} = {}) {
  const records = [];
  return {
    encode(frame, frameId, pageIds) {
      try { return encode(frame, frameId, pageIds, records, subtreeEffects); }
      catch (error) { records.length = 0; throw error; }
    },
    clear() { records.length = 0; }
  };
}

// pageIds is the project's Map from the original ImageData2D object to the
// resident slot uploaded by its native host. Capture-local page order can vary.
export function encodeProjectFrame(frame, frameId, pageIds) {
  return encode(frame, frameId, pageIds);
}

function encode(frame, frameId, pageIds, records, subtreeEffects = true) {
  if (frame.profile !== 'egret.shared-frame2d/1' || frame.colorRecipe !== 'egret.linear-srgb-pma/1' ||
      frame.targetRepresentation !== 'egret.srgb-pma8-target/1' ||
      !(frame.outputAlpha === 'premultiplied' || (frame.outputAlpha === 'opaque' && frame.clearAlpha === 1)))
    throw new Error('Unsupported project frame profile');
  if (!Number.isInteger(frameId) || frameId < 0 || frameId > 0xffffffff ||
      [frame.width, frame.height].some(v => !Number.isInteger(v) || v < 1 || v > 16384))
    throw new RangeError('Invalid project frame header');
  const used = new Set();
  const slots = frame.pages.map(({source, builtin}) => {
    // A normal 1×1 white texture is still owned by the game. Only the vector
    // capture's dedicated page is supplied by the native renderer at slot zero.
    if (builtin === 'solid-white' && source.width === 1 && source.height === 1) return 0;
    const slot = pageIds.get(source);
    if (!Number.isInteger(slot) || slot < 1 || slot > 255 || used.has(slot)) throw new Error('Invalid or missing project page');
    if (!Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) ||
        source.width < 1 || source.height < 1) throw new RangeError('Invalid project page size');
    used.add(slot);
    return slot;
  });
  const flags = [];
  let count = 0, needsTypedDraws = false;
  let groups, stack, groupCount = 0, markerBytes = 0, markerCount = 0;
  for (const command of frame.commands) {
    if (command.kind === 'barrier') {
      if (command.effect !== undefined && command.reason !== 'effect-enter')
        throw new Error('Unsupported project effect metadata on barrier: ' + command.reason);
      if (command.reason === 'effect-enter') {
        if (!subtreeEffects) throw new Error('Subtree effects require an EGR6-capable Android player');
        const effect = command.effect;
        if (!effect || !Array.isArray(effect.clips) || effect.clips.length > 8 ||
            !Number.isSafeInteger(command.boundaryId) || command.boundaryId < 0)
          throw new Error('Unsupported project effect boundary');
        groups ??= new Map();
        stack ??= [];
        if (++groupCount > MAX_EFFECT_GROUPS || stack.length >= MAX_EFFECT_DEPTH)
          throw new RangeError('Project effect group limit exceeded');
        const group = prepareProjectEffect(effect, clipBounds(effect.clips, frame.width, frame.height));
        stack.push(command.boundaryId);
        groups.set(command, group);
        markerBytes += group.length;
        markerCount++;
        needsTypedDraws = true;
      } else if (command.reason === 'effect-exit') {
        if (!stack?.length || stack.pop() !== command.boundaryId) throw new Error('Unbalanced project effect boundary');
        markerBytes += 4;
        markerCount++;
      } else if (!barriers.has(command.reason)) throw new Error('Unsupported project barrier: ' + command.reason);
    } else if (command.kind === 'rect' || command.kind === 'image' || command.kind === 'mesh') {
      if (++count > MAX_QUADS) throw new RangeError('Project draw limit exceeded');
      const index = command.materialIndex;
      const policy = flags[index] ??= materialFlags(frame.materials[index]);
      if (command.kind === 'mesh' || policy !== 0) needsTypedDraws = true;
    } else throw new Error('Unsupported project draw: ' + command.kind);
  }
  if (stack?.length) throw new Error('Unclosed project effect boundary');
  const indexed = needsTypedDraws ? indexedLayout(frame, slots, flags) : undefined;
  const size = (indexed?.size ?? (HEADER + QUAD * count)) + markerBytes;
  if (size > MAX_FRAME_BYTES) throw new RangeError('Project frame byte limit exceeded');
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const clear = rgb(frame.clearColor)*256 + Math.round(unit(frame.clearAlpha)*255);
  [groups ? EFFECT_MAGIC : indexed?.extended ? MATERIAL_FRAME_MAGIC : indexed ? INDEXED_FRAME_MAGIC : PROJECT_FRAME_MAGIC, frameId, frame.width, frame.height, clear, count + markerCount]
    .forEach((value, i) => view.setUint32(i*4, value, true));
  const bytes = new Uint8Array(buffer);
  if (records) records.length = count;
  let base = HEADER, index = 0;
  let atlasWords;
  for (const cmd of frame.commands) {
    if (cmd.kind === 'barrier') {
      if (cmd.reason === 'effect-enter') {
        const group = groups.get(cmd);
        writeEffectEnter(view, base, group);
        base += group.length;
      } else if (cmd.reason === 'effect-exit') {
        view.setUint32(base, EFFECT_EXIT, true);
        base += 4;
      }
      continue;
    }
    const material = frame.materials[cmd.materialIndex];
    const saved = records?.[index];
    const draw = indexed?.draws[index];
    index++;
    if (draw) {
      view.setUint32(base, draw.kind, true);
      if (draw.geometry) {
        // Mesh deformation may replace the geometry table entry on each frame.
        // Quad record retention never takes ownership of these vertex buffers.
        writeMesh(view, base, cmd, draw, frame);
        if (records) records[index - 1] = undefined;
        base += draw.length;
        continue;
      }
      base += 4;
      if (draw.texture?.mapped) writeMapping(view, base + QUAD, draw.texture.region);
    }
    if (saved && canReuse(saved, cmd, material, frame, slots)) {
      bytes.set(saved.bytes, base);
      if (saved.mapped && !indexed) atlasWords = appendAtlasMapping(atlasWords, index - 1, saved.region);
      base += draw ? draw.length - 4 : QUAD;
      continue;
    }
    let region, page, mapped = false;
    let slot = 0, color = 0xffffff, opacity = unit(cmd.opacity), uv = [0, 0, 1, 1];
    if (cmd.kind === 'rect') {
      color = rgb(cmd.fillColor);
      opacity *= unit(cmd.fillAlpha);
    } else {
      ({region, page, mapped, uv, slot} = draw?.texture ?? textureBinding(frame, cmd, material, slots));
      if (mapped && !indexed) atlasWords = appendAtlasMapping(atlasWords, index - 1, region);
    }
    view.setUint8(base, slot);
    view.setUint8(base+1, color >>> 16);
    view.setUint8(base+2, color >>> 8);
    view.setUint8(base+3, color);
    const floats = [opacity, ...corners(cmd.matrix, cmd.rect), ...uv, ...clipBounds(cmd.clips, frame.width, frame.height)];
    floats.forEach((v, i) => view.setFloat32(base+4+i*4, v, true));
    if (records) {
      // A changing ordinal keeps only its command identity. Pay for a private
      // byte copy once the same immutable command recurs at that ordinal.
      if (saved === cmd || saved?.command === cmd) {
        const recordBytes = saved === cmd ? new Uint8Array(QUAD) : saved.bytes;
        recordBytes.set(bytes.subarray(base, base + QUAD));
        records[index - 1] = {command: cmd, material, region, mapped, width: frame.width, height: frame.height,
          slot, pageWidth: page?.width, pageHeight: page?.height, bytes: recordBytes};
      } else records[index - 1] = cmd;
    }
    base += draw ? draw.length - 4 : QUAD;
  }
  if (!atlasWords) return bytes;
  const packet = new Uint8Array(bytes.length + atlasWords.length * 4);
  packet.set(bytes);
  const output = new DataView(packet.buffer);
  output.setUint32(0, ATLAS_FRAME_MAGIC, true);
  for (let i = 0; i < atlasWords.length; i++) output.setUint32(bytes.length + 4*i, atlasWords[i], true);
  return packet;
}
