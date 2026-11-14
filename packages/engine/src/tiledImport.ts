// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type {
  ObjectLayerData, TileAnimationFrame, TiledImportOptions, TileLayerData, TileMapData, TileMapLayerData, TileMapObject, TileMapProperties, TileMapPropertyValue, TileSetData,
} from './tilemapTypes.js';

const MAX_CELLS = 1 << 24, MAX_LAYERS = 256, MAX_TILESETS = 256, MAX_OBJECTS = 100_000, MAX_SIDE = 1 << 16;
/** The top three bits of a global id say how the tile is turned; the rest is the id. */
export const TILE_FLIP_MASK = 0xe0000000;
type Json = Record<string, unknown>;
const record = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string, where: string): never => { throw new EgretError(code, { cause: new Error(where) }); };
function whole(value: unknown, least: number, most: number, where: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < least || (value as number) > most) fail('TILEMAP_DATA_INVALID', where);
  return value as number;
}
function number(value: unknown, where: string, otherwise?: number): number {
  if (value === undefined && otherwise !== undefined) return otherwise;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('TILEMAP_DATA_INVALID', where);
  return value as number;
}
function text(value: unknown, where: string, otherwise?: string): string {
  if (value === undefined && otherwise !== undefined) return otherwise;
  if (typeof value !== 'string') fail('TILEMAP_DATA_INVALID', where);
  return value as string;
}
function flag(value: unknown, where: string, otherwise: boolean): boolean {
  if (value === undefined) return otherwise;
  if (typeof value !== 'boolean') fail('TILEMAP_DATA_INVALID', where);
  return value as boolean;
}
/** `#RRGGBB` or `#AARRGGBB`, as Tiled writes it; the colour without its alpha. */
function colour(value: unknown, where: string): number | undefined {
  if (value === undefined) return undefined;
  const found = typeof value === 'string' ? /^#(?:[0-9a-fA-F]{2})?([0-9a-fA-F]{6})$/.exec(value) : null;
  if (found === null) return fail('TILEMAP_DATA_INVALID', where);
  return parseInt(found[1]!, 16);
}
function properties(value: unknown, where: string): TileMapProperties {
  if (value === undefined) return Object.freeze({});
  if (!Array.isArray(value)) return fail('TILEMAP_DATA_INVALID', where);
  const out: Record<string, TileMapPropertyValue> = {};
  for (const entry of value as unknown[]) {
    if (!record(entry)) fail('TILEMAP_DATA_INVALID', where);
    const name = text((entry as Json)['name'], where + '.name'), raw = (entry as Json)['value'];
    if (Object.hasOwn(out, name)) fail('TILEMAP_DATA_INVALID', where + ': ' + name + ' twice');
    // A property of a class or an object reference is kept as what it can be read as; a class is not followed.
    if (typeof raw === 'string' || typeof raw === 'boolean' || (typeof raw === 'number' && Number.isFinite(raw))) out[name] = raw;
    else if (raw === null || raw === undefined) out[name] = '';
    else if (record(raw)) out[name] = JSON.stringify(raw);
    else fail('TILEMAP_DATA_INVALID', where + ': ' + name);
  }
  return Object.freeze(out);
}
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Base64 without the host: the core has no `atob` of its own to lean on. */
function base64(value: string, where: string): Uint8Array {
  const clean = value.replace(/\s+/g, '');
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) fail('TILEMAP_DATA_INVALID', where);
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0, out = new Uint8Array(clean.length / 4 * 3 - padding);
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (ALPHABET.indexOf(clean[i]!) << 18) | (ALPHABET.indexOf(clean[i + 1]!) << 12) | (Math.max(0, ALPHABET.indexOf(clean[i + 2]!)) << 6) | Math.max(0, ALPHABET.indexOf(clean[i + 3]!));
    for (const shift of [16, 8, 0]) if (at < out.length) out[at++] = (n >>> shift) & 255;
  }
  return out;
}
/** The cells of a layer or a chunk, from an array of numbers or base64 of little-endian 32-bit words. */
function cells(raw: unknown, count: number, encoding: unknown, compression: unknown, where: string): Uint32Array {
  if (compression !== undefined && compression !== '') return fail('TILEMAP_COMPRESSION_UNSUPPORTED', where);
  const out = new Uint32Array(count);
  if (encoding === 'base64') {
    const bytes = base64(text(raw, where), where);
    if (bytes.length !== count * 4) fail('TILEMAP_DATA_INVALID', where + ': length');
    for (let i = 0; i < count; i++) out[i] = (bytes[i * 4]! | (bytes[i * 4 + 1]! << 8) | (bytes[i * 4 + 2]! << 16) | (bytes[i * 4 + 3]! << 24)) >>> 0;
    return out;
  }
  if (encoding !== undefined && encoding !== 'csv') return fail('TILEMAP_DATA_INVALID', where + ': encoding');
  if (!Array.isArray(raw) || raw.length !== count) return fail('TILEMAP_DATA_INVALID', where + ': length');
  for (let i = 0; i < count; i++) out[i] = whole(raw[i], 0, 0xffffffff, where);
  return out;
}

function tileset(raw: unknown, where: string, external: Readonly<Record<string, unknown>>): TileSetData {
  if (!record(raw)) return fail('TILEMAP_DATA_INVALID', where);
  const firstGid = whole(raw['firstgid'], 1, 0x1fffffff, where + '.firstgid');
  let set: Json = raw;
  if (raw['source'] !== undefined) {
    const source = text(raw['source'], where + '.source'), found = Object.hasOwn(external, source) ? external[source] : undefined;
    if (!record(found)) return fail('TILEMAP_TILESET_MISSING', source);
    set = found;
  }
  if (set['image'] === undefined) return fail('TILEMAP_TILESET_UNSUPPORTED', where + ': a set of separate images');
  const tileWidth = whole(set['tilewidth'], 1, 4096, where + '.tilewidth'), tileHeight = whole(set['tileheight'], 1, 4096, where + '.tileheight');
  const spacing = whole(set['spacing'] ?? 0, 0, 4096, where + '.spacing'), margin = whole(set['margin'] ?? 0, 0, 4096, where + '.margin');
  const imageWidth = whole(set['imagewidth'], 1, 16384, where + '.imagewidth'), imageHeight = whole(set['imageheight'], 1, 16384, where + '.imageheight');
  const columns = whole(set['columns'], 1, 16384, where + '.columns'), tileCount = whole(set['tilecount'], 1, MAX_CELLS, where + '.tilecount');
  // Every tile the set says it has lies inside its image.
  const rows = Math.ceil(tileCount / columns);
  if (margin * 2 + columns * tileWidth + (columns - 1) * spacing > imageWidth || margin * 2 + rows * tileHeight + (rows - 1) * spacing > imageHeight)
    fail('TILEMAP_DATA_INVALID', where + ': the tiles do not fit the image');
  const tiles = new Map<number, { properties: TileMapProperties; animation?: readonly TileAnimationFrame[]; type?: string }>();
  if (set['tiles'] !== undefined) {
    if (!Array.isArray(set['tiles'])) fail('TILEMAP_DATA_INVALID', where + '.tiles');
    for (const tile of set['tiles'] as unknown[]) {
      if (!record(tile)) fail('TILEMAP_DATA_INVALID', where + '.tiles');
      const t = tile as Json, id = whole(t['id'], 0, tileCount - 1, where + '.tiles.id');
      let animation: TileAnimationFrame[] | undefined;
      if (t['animation'] !== undefined) {
        if (!Array.isArray(t['animation']) || t['animation'].length === 0) fail('TILEMAP_DATA_INVALID', where + '.animation');
        animation = (t['animation'] as unknown[]).map(frame => {
          if (!record(frame)) return fail('TILEMAP_DATA_INVALID', where + '.animation');
          return Object.freeze({ tileId: whole(frame['tileid'], 0, tileCount - 1, where + '.animation.tileid'), duration: whole(frame['duration'], 1, 3_600_000, where + '.animation.duration') });
        });
      }
      const type = t['type'] ?? t['class'];
      tiles.set(id, Object.freeze({ properties: properties(t['properties'], where + '.tiles.properties'), ...(animation === undefined ? {} : { animation: Object.freeze(animation) }), ...(typeof type === 'string' && type !== '' ? { type } : {}) }));
    }
  }
  return Object.freeze({ name: text(set['name'], where + '.name'), firstGid, tileWidth, tileHeight, columns, tileCount, spacing, margin, image: text(set['image'], where + '.image'),
    imageWidth, imageHeight, properties: properties(set['properties'], where + '.properties'), tiles });
}
function object(raw: unknown, where: string): TileMapObject {
  if (!record(raw)) return fail('TILEMAP_DATA_INVALID', where);
  const shape = raw['point'] === true ? 'point' : raw['ellipse'] === true ? 'ellipse' : Array.isArray(raw['polygon']) ? 'polygon' : Array.isArray(raw['polyline']) ? 'polyline' : record(raw['text']) ? 'text' : 'rectangle';
  const pointsRaw = shape === 'polygon' ? raw['polygon'] : shape === 'polyline' ? raw['polyline'] : undefined;
  const points = pointsRaw === undefined ? undefined : Object.freeze((pointsRaw as unknown[]).map(point => {
    if (!record(point)) return fail('TILEMAP_DATA_INVALID', where + '.points');
    return Object.freeze({ x: number(point['x'], where + '.x'), y: number(point['y'], where + '.y') });
  }));
  const type = raw['type'] ?? raw['class'] ?? '';
  return Object.freeze({
    id: whole(raw['id'], 0, Number.MAX_SAFE_INTEGER, where + '.id'), name: text(raw['name'], where + '.name', ''), type: text(type, where + '.type'),
    x: number(raw['x'], where + '.x'), y: number(raw['y'], where + '.y'), width: number(raw['width'], where + '.width', 0), height: number(raw['height'], where + '.height', 0),
    rotation: number(raw['rotation'], where + '.rotation', 0), visible: flag(raw['visible'], where + '.visible', true),
    ...(raw['gid'] === undefined ? {} : { gid: whole(raw['gid'], 1, 0xffffffff, where + '.gid') }), shape,
    ...(points === undefined ? {} : { points }), ...(shape === 'text' ? { text: text((raw['text'] as Json)['text'], where + '.text', '') } : {}),
    properties: properties(raw['properties'], where + '.properties'),
  });
}

/**
 * Reads a map saved by Tiled as JSON (`.tmj`, or `.json`), orthogonal, with tile layers as arrays or as
 * base64 without compression, finite or infinite, object layers and groups. What it cannot read it refuses.
 */
export function importTiledMap(json: unknown, options: TiledImportOptions = {}): TileMapData {
  if (!record(options) || (options.tilesets !== undefined && !record(options.tilesets))) throw new EgretError('TILEMAP_OPTIONS_INVALID');
  if (!record(json) || (json['type'] !== undefined && json['type'] !== 'map')) return fail('TILEMAP_DATA_INVALID', 'map');
  if (json['orientation'] !== 'orthogonal') return fail('TILEMAP_ORIENTATION_UNSUPPORTED', String(json['orientation']));
  const infinite = flag(json['infinite'], 'infinite', false);
  const width = whole(json['width'], infinite ? 0 : 1, MAX_SIDE, 'width'), height = whole(json['height'], infinite ? 0 : 1, MAX_SIDE, 'height');
  const tileWidth = whole(json['tilewidth'], 1, 4096, 'tilewidth'), tileHeight = whole(json['tileheight'], 1, 4096, 'tileheight');
  if (!Array.isArray(json['tilesets']) || json['tilesets'].length > MAX_TILESETS) return fail('TILEMAP_DATA_INVALID', 'tilesets');
  const tilesets = (json['tilesets'] as unknown[]).map((set, index) => tileset(set, 'tilesets.' + index, (options.tilesets ?? {}) as Readonly<Record<string, unknown>>)).sort((a, b) => a.firstGid - b.firstGid);
  for (let i = 1; i < tilesets.length; i++) if (tilesets[i]!.firstGid < tilesets[i - 1]!.firstGid + tilesets[i - 1]!.tileCount) fail('TILEMAP_DATA_INVALID', 'tilesets overlap');
  const layers: TileMapLayerData[] = [];
  let objectCount = 0;
  function walk(list: unknown, prefix: string, ox: number, oy: number, opacity: number, visible: boolean, px: number, py: number, depth: number): void {
    if (!Array.isArray(list) || depth > 32) return fail('TILEMAP_DATA_INVALID', prefix + 'layers');
    for (const raw of list as unknown[]) {
      if (!record(raw)) fail('TILEMAP_DATA_INVALID', prefix + 'layer');
      const layer = raw as Json, name = prefix + text(layer['name'], 'layer.name', ''), where = 'layer ' + name;
      const x = ox + number(layer['offsetx'], where, 0), y = oy + number(layer['offsety'], where, 0);
      const alpha = opacity * number(layer['opacity'], where, 1), shown = visible && flag(layer['visible'], where, true);
      const parallaxX = px * number(layer['parallaxx'], where, 1), parallaxY = py * number(layer['parallaxy'], where, 1);
      if (alpha < 0 || alpha > 1) fail('TILEMAP_DATA_INVALID', where + ': opacity');
      if (layers.length >= MAX_LAYERS) fail('TILEMAP_DATA_INVALID', 'too many layers');
      if (layer['type'] === 'group') { walk(layer['layers'], name + '/', x, y, alpha, shown, parallaxX, parallaxY, depth + 1); continue; }
      const common = { name, offsetX: x, offsetY: y, opacity: alpha, visible: shown, properties: properties(layer['properties'], where) };
      if (layer['type'] === 'tilelayer') {
        let data: Uint32Array, w: number, h: number, startX = 0, startY = 0;
        if (layer['chunks'] !== undefined) {
          // An infinite layer: the chunks are laid into one grid that holds them all.
          if (!Array.isArray(layer['chunks'])) fail('TILEMAP_DATA_INVALID', where + ': chunks');
          const chunks = (layer['chunks'] as unknown[]).map((chunk, index) => {
            if (!record(chunk)) return fail('TILEMAP_DATA_INVALID', where + ': chunk');
            const cw = whole(chunk['width'], 1, MAX_SIDE, where), ch = whole(chunk['height'], 1, MAX_SIDE, where);
            return { x: whole(chunk['x'], -MAX_SIDE, MAX_SIDE, where), y: whole(chunk['y'], -MAX_SIDE, MAX_SIDE, where), width: cw, height: ch,
              data: cells(chunk['data'], cw * ch, layer['encoding'], layer['compression'], where + ': chunk ' + index) };
          });
          if (chunks.length === 0) { w = 0; h = 0; data = new Uint32Array(0); }
          else {
            startX = Math.min(...chunks.map(c => c.x)); startY = Math.min(...chunks.map(c => c.y));
            w = Math.max(...chunks.map(c => c.x + c.width)) - startX; h = Math.max(...chunks.map(c => c.y + c.height)) - startY;
            if (w * h > MAX_CELLS) fail('TILEMAP_DATA_INVALID', where + ': too many cells');
            data = new Uint32Array(w * h);
            for (const chunk of chunks) for (let row = 0; row < chunk.height; row++) data.set(chunk.data.subarray(row * chunk.width, (row + 1) * chunk.width), (chunk.y - startY + row) * w + chunk.x - startX);
          }
        } else {
          w = whole(layer['width'], 1, MAX_SIDE, where); h = whole(layer['height'], 1, MAX_SIDE, where);
          if (w * h > MAX_CELLS) fail('TILEMAP_DATA_INVALID', where + ': too many cells');
          data = cells(layer['data'], w * h, layer['encoding'], layer['compression'], where);
        }
        // Every id is one of a tileset, or none.
        for (const gid of data) {
          const id = (gid & ~TILE_FLIP_MASK) >>> 0;
          if (id !== 0 && !tilesets.some(set => id >= set.firstGid && id < set.firstGid + set.tileCount)) fail('TILEMAP_DATA_INVALID', where + ': tile ' + id + ' of no tileset');
        }
        layers.push(Object.freeze({ type: 'tile', ...common, width: w, height: h, startX, startY, parallaxX, parallaxY, data }) as TileLayerData);
      } else if (layer['type'] === 'objectgroup') {
        if (!Array.isArray(layer['objects'])) fail('TILEMAP_DATA_INVALID', where + ': objects');
        objectCount += (layer['objects'] as unknown[]).length;
        if (objectCount > MAX_OBJECTS) fail('TILEMAP_DATA_INVALID', 'too many objects');
        layers.push(Object.freeze({ type: 'object', ...common, objects: Object.freeze((layer['objects'] as unknown[]).map((o, i) => object(o, where + ': object ' + i))) }) as ObjectLayerData);
      } else fail('TILEMAP_LAYER_UNSUPPORTED', where + ': ' + String(layer['type']));
    }
  }
  walk(json['layers'], '', 0, 0, 1, true, 1, 1, 0);
  return Object.freeze({ orientation: 'orthogonal', width, height, tileWidth, tileHeight, infinite, backgroundColor: colour(json['backgroundcolor'], 'backgroundcolor'),
    properties: properties(json['properties'], 'properties'), tilesets: Object.freeze(tilesets), layers: Object.freeze(layers) });
}
