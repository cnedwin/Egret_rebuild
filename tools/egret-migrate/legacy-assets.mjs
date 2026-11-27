// SPDX-License-Identifier: Apache-2.0
import path from 'node:path';
import { crc32 } from 'node:zlib';
import { PNG } from 'pngjs';
import { planLegacyResourceManifestConversion } from '../../packages/project/dist/legacy-res-plan.js';
import { logicalPath } from '../lib/file-identity.mjs';

function refused(message, details) {
  throw Object.assign(new Error(message), { code: 'MIGRATE_RES_UNSUPPORTED', details });
}

/** Normalize old indexed/grayscale/interlaced PNGs offline, retaining an identical RGBA pixel plane. */
export function normalizeLegacyPng(bytes, key) {
  if (
    path.posix.extname(key).toLowerCase() !== '.png' ||
    bytes.length < 29 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  )
    return bytes;
  const recognized = new Set(['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM']);
  const convertible = new Set(['PLTE', 'tRNS', 'tEXt', 'iTXt', 'zTXt', 'pHYs', 'tIME']);
  let native = bytes[24] === 8 && [2, 6].includes(bytes[25]) && bytes[26] === 0 && bytes[27] === 0 && bytes[28] === 0;
  const chunks = new Map();
  const colorChunks = [];
  for (let at = 8; at < bytes.length; ) {
    if (bytes.length - at < 12) refused('Malformed legacy PNG chunk framing.', { path: key });
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('ascii', at + 4, at + 8);
    if (length > bytes.length - at - 12) refused('Malformed legacy PNG chunk length.', { path: key });
    if (!recognized.has(type)) {
      if (!convertible.has(type))
        refused('Legacy PNG metadata requires an explicit color or asset conversion.', { path: key, type });
      native = false;
    }
    if (['sRGB', 'gAMA', 'cHRM'].includes(type)) {
      if (chunks.has(type) || crc32(bytes.subarray(at + 4, at + length + 8)) !== bytes.readUInt32BE(at + length + 8))
        refused('Invalid legacy PNG color metadata.', { path: key, type });
      chunks.set(type, bytes.subarray(at + 8, at + 8 + length));
      colorChunks.push(bytes.subarray(at, at + 12 + length));
    }
    at += length + 12;
  }
  const srgb = chunks.get('sRGB'),
    gamma = chunks.get('gAMA'),
    chromaticity = chunks.get('cHRM');
  if (
    (srgb && (srgb.length !== 1 || srgb[0] > 3)) ||
    ((gamma || chromaticity) && !srgb) ||
    (gamma && (gamma.length !== 4 || gamma.readUInt32BE() !== 45455)) ||
    (chromaticity &&
      (chromaticity.length !== 32 ||
        [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000].some(
          (value, i) => chromaticity.readUInt32BE(i * 4) !== value
        )))
  )
    refused('Legacy PNG uses a color profile outside the admitted sRGB subset.', { path: key });
  if (native) return bytes;
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216)
    refused('Legacy PNG exceeds the offline conversion size limit.', { path: key });
  try {
    const source = PNG.sync.read(bytes);
    // pngjs reads gamma but cannot write its companion sRGB intent. Keep the admitted color chunks together.
    const encoded = PNG.sync.write(
      { width, height, data: source.data },
      { colorType: 6, inputColorType: 6, bitDepth: 8, inputHasAlpha: true }
    );
    const converted = colorChunks.length
      ? Buffer.concat([encoded.subarray(0, 33), ...colorChunks, encoded.subarray(33)])
      : encoded;
    const checked = PNG.sync.read(converted);
    if (source.width !== checked.width || source.height !== checked.height || !source.data.equals(checked.data))
      refused('Legacy PNG pixel identity could not be preserved.', { path: key });
    return converted;
  } catch (error) {
    if (error?.code === 'MIGRATE_RES_UNSUPPORTED') throw error;
    refused('Legacy PNG could not be normalized losslessly.', { path: key, reason: error.message });
  }
}

/** Extend the manifest's copy intents with local data files and atlas metadata. The conservative analyzer retains its original public profile. */
export function planMigratedResources(text, root, read) {
  const original = planLegacyResourceManifestConversion(text, root);
  if (original.plan) return { plan: original.plan };
  if (
    original.status !== 'unsupported' ||
    !original.report.resources.some(item => ['sheet', 'bin', 'text'].includes(item.type)) ||
    original.report.diagnostics.some(
      item =>
        !['LEGACY_RES_TYPE_UNSUPPORTED', 'LEGACY_RES_SUBKEYS_UNSUPPORTED', 'LEGACY_RES_REFERENCE_UNRESOLVED'].includes(
          item.code
        )
    )
  ) {
    refused('The RES declaration is outside this profile.', original.report.diagnostics);
  }
  const source = JSON.parse(text);
  const names = new Set(source.resources.map(item => item.name));
  const aliases = new Map();
  const sheets = [];
  const pages = [];
  const dataTypes = new Map();
  for (const item of source.resources) {
    if (item.type === 'text' || item.type === 'bin') {
      const allowed = item.type === 'text' ? ['.txt', '.csv'] : ['.bin', '.dat'];
      if (!allowed.includes(path.posix.extname(item.url).toLowerCase()))
        refused('Unexpected local data file extension.', { name: item.name });
      dataTypes.set(item.name, item.type);
      // The analyzer validates copy paths, duplicates and group references. Its simple-file branch reads no content.
      item.type = 'json';
      continue;
    }
    if (item.type !== 'sheet') continue;
    let atlas;
    try {
      atlas = JSON.parse(read(root + '/' + item.url).bytes.toString('utf8'));
    } catch {
      refused('Expected a local JSON sprite sheet.', { name: item.name });
    }
    if (
      !atlas ||
      Object.keys(atlas).some(key => !['file', 'frames'].includes(key)) ||
      typeof atlas.file !== 'string' ||
      !atlas.frames ||
      Array.isArray(atlas.frames) ||
      typeof atlas.frames !== 'object'
    )
      refused('Unsupported sprite sheet metadata.', { name: item.name });
    const dir = path.posix.dirname(item.url);
    let pagePath;
    try {
      pagePath = logicalPath((dir === '.' ? '' : dir + '/') + atlas.file);
    } catch {
      refused('Sprite sheet page must be local and portable.', { name: item.name });
    }
    const entries = Object.entries(atlas.frames);
    if (!entries.length || entries.length > 4096) refused('Sprite sheet exceeds frame limits.', { name: item.name });
    const frames = entries.map(([name, f]) => {
      if (!name || name.includes(',') || (item.subkeys?.split(',').includes(name) && aliases.has(name)))
        refused('Invalid sprite sheet subkey.', { name });
      if (
        !f ||
        f.rotated ||
        Object.keys(f).some(key => !['x', 'y', 'w', 'h', 'offX', 'offY', 'sourceW', 'sourceH', 'rotated'].includes(key))
      )
        refused('Unsupported sprite sheet frame.', { name });
      const { x, y, w, h, offX = 0, offY = 0, sourceW = w, sourceH = h } = f;
      if (
        ![x, y, w, h, offX, offY, sourceW, sourceH].every(value => Number.isSafeInteger(value) && value >= 0) ||
        w === 0 ||
        h === 0 ||
        offX + w > sourceW ||
        offY + h > sourceH
      )
        refused('Invalid sprite sheet region or trim.', { name });
      return {
        name,
        x,
        y,
        width: w,
        height: h,
        sourceWidth: sourceW,
        sourceHeight: sourceH,
        offsetX: offX,
        offsetY: offY
      };
    });
    const subkeys = item.subkeys === undefined ? [] : item.subkeys.split(',');
    if (new Set(subkeys).size !== subkeys.length) refused('Duplicate sheet subkey.', { name: item.name });
    for (const name of subkeys) {
      if (names.has(name) || aliases.has(name) || !frames.some(frame => frame.name === name))
        refused('Ambiguous or missing sheet subkey.', { name });
      aliases.set(name, item.name);
    }
    const page = '__migrate_sheet_page_' + sheets.length;
    if (names.has(page)) refused('Sheet page name collides with RES.', { name: page });
    names.add(page);
    pages.push({ name: page, type: 'image', url: pagePath });
    sheets.push({ name: item.name, page, frames, subkeys });
    item.type = 'json';
    delete item.subkeys;
  }
  for (const group of source.groups)
    group.keys = group.keys
      .split(',')
      .map(key => aliases.get(key) ?? key)
      .join(',');
  source.resources.push(...pages);
  const normalized = planLegacyResourceManifestConversion(JSON.stringify(source), root);
  if (!normalized.plan) refused('The extended RES declaration is outside this profile.', normalized.report.diagnostics);
  const plan = normalized.plan;
  const resources = plan.resources.map(item =>
    dataTypes.has(item.name) ? { ...item, type: dataTypes.get(item.name) } : item
  );
  return { plan: { ...plan, resources }, ...(sheets.length ? { sheets } : {}) };
}
