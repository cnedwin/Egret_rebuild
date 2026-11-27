// SPDX-License-Identifier: Apache-2.0
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const edge = 2046; // The interior plus one neighboring sample on each side fits a 2048-square image.

function refuse(message, details) {
  throw Object.assign(new Error(message), { code: 'MIGRATE_MOVIE_ATLAS', details });
}

/** Split the entire pixel plane so whole-page Bitmaps and crops that cross a boundary remain addressable. */
export function sliceMovieAtlas(bytes, prefix) {
  if (
    bytes.length < 33 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  )
    refuse('Expected a PNG atlas.', { prefix });
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216)
    refuse('Source atlas exceeds the offline 8192-edge or 16777216-pixel limit.', { width, height });
  if (width <= 4096 && height <= 4096 && width * height <= 4194304) return undefined;
  if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]))
    refuse('Normalize the source to an eight-bit PNG before slicing.', { prefix });

  let offset = 8;
  const color = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) refuse('Truncated PNG chunk.', { prefix });
    const length = bytes.readUInt32BE(offset),
      end = offset + 12 + length;
    if (end > bytes.length) refuse('Truncated PNG chunk.', { prefix });
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (['sRGB', 'gAMA', 'cHRM'].includes(type)) color.push(bytes.subarray(offset, end));
    else if (!['IHDR', 'IDAT', 'IEND'].includes(type))
      refuse('PNG requires color or format review before slicing.', { type });
    offset = end;
  }

  const source = PNG.sync.read(bytes),
    tiles = [],
    assets = [];
  for (let y = 0; y < height; y += edge) {
    for (let x = 0; x < width; x += edge) {
      const w = Math.min(edge, width - x),
        h = Math.min(edge, height - y);
      const left = x > 0 ? 1 : 0,
        top = y > 0 ? 1 : 0;
      const physicalW = w + left + (x + w < width ? 1 : 0);
      const physicalH = h + top + (y + h < height ? 1 : 0);
      const data = Buffer.alloc(physicalW * physicalH * 4);
      for (let line = 0; line < physicalH; line++) {
        const start = ((y - top + line) * width + x - left) * 4;
        source.data.copy(data, line * physicalW * 4, start, start + physicalW * 4);
      }
      const encoded = PNG.sync.write(
        { width: physicalW, height: physicalH, data },
        { colorType: 6, inputColorType: 6, inputHasAlpha: true }
      );
      const result = color.length ? Buffer.concat([encoded.subarray(0, 33), ...color, encoded.subarray(33)]) : encoded;
      if (!PNG.sync.read(result).data.equals(data)) refuse('A generated tile did not preserve RGBA bytes.', { x, y });
      const url = prefix + '/' + x + '-' + y + '.png';
      assets.push({ key: url, bytes: result });
      tiles.push({ x, y, width: w, height: h, left, top, url });
    }
  }
  return { width, height, tiles, assets };
}

export function prepareMovieAtlases(mappings, selection, read, normalize) {
  if (mappings === undefined) return { plans: [], assets: [], replaced: new Set(), transforms: [] };
  if (!Array.isArray(mappings) || !mappings.length || mappings.length > 128)
    refuse('Expected 1 to 128 explicit RES data and texture name pairs.');
  const { resources, files } = selection.resources;
  const byName = new Map(resources.map(item => [item.name, item]));
  const occupied = new Set(files.map(f => f.destinationPath.toLowerCase()));
  const named = new Set(),
    replaced = new Set(),
    plans = [],
    assets = [],
    transforms = [];
  for (const mapping of mappings) {
    if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).some(k => !['data', 'texture'].includes(k)))
      refuse('Expected RES data and texture names.');
    const data = byName.get(mapping.data),
      texture = byName.get(mapping.texture);
    if (data?.type !== 'json' || texture?.type !== 'image' || named.has(mapping.texture))
      refuse('Expected distinct mapped RES PNG textures and JSON metadata.', mapping);
    named.add(mapping.texture);
    const input = files[texture.fileIndex];
    const raw = read(input.sourcePath);
    let json;
    try {
      json = JSON.parse(read(files[data.fileIndex].sourcePath).toString('utf8'));
    } catch {
      refuse('Expected a MovieClip JSON document.', mapping);
    }
    if (!json?.mc || !json.res || !Object.keys(json.mc).length || !input.sourcePath.toLowerCase().endsWith('.png'))
      refuse('Expected MovieClip metadata and a PNG source.', mapping);
    if (
      resources.some(other => other !== texture && other.fileIndex === texture.fileIndex) ||
      selection.sheets?.some(sheet => sheet.page === mapping.texture) ||
      selection.bones?.some(rig => rig.texturePath === input.sourcePath)
    )
      refuse('The atlas is also declared under a second resource or adapter.', mapping);
    const normalized = normalize(raw, input.sourcePath);
    const sliced = sliceMovieAtlas(normalized, 'migrated-movie-pages/' + plans.length);
    if (!sliced) continue;
    const { width, height, tiles } = sliced;
    for (const file of sliced.assets) {
      if (occupied.has(file.key.toLowerCase())) refuse('Generated page path is already occupied.', { path: file.key });
      occupied.add(file.key.toLowerCase());
      assets.push(file);
    }
    replaced.add(input.sourcePath);
    plans.push({ texture: mapping.texture, width, height, tiles });
    transforms.push({
      path: input.destinationPath,
      rule: 'movie-atlas-paged-rgba8',
      inputSha256: digest(raw),
      pages: sliced.assets.map(file => ({ path: file.key, sha256: digest(file.bytes) }))
    });
  }
  return { plans, assets, replaced, transforms };
}
