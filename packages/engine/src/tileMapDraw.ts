// SPDX-License-Identifier: Apache-2.0
import { DisplayObjectContainer, EgretError, Mesh2D } from '@egret/runtime';
import type { AssetLease, Texture } from '@egret/runtime';
import { createTexturedGeometry2D } from '@egret/contracts';
import type { TexturedGeometry2D } from '@egret/contracts';
import { TILE_FLIP_MASK } from './tiledImport.js';
import type { TileInfo, TileLayerData, TileMap, TileMapChunk, TileMapData, TileMapLayer, TileMapOptions, TileMapProperties, TileSetData } from './tilemapTypes.js';

const FLIP_H = 0x80000000, FLIP_V = 0x40000000, FLIP_D = 0x20000000;
const NONE: TileMapProperties = Object.freeze({});
interface Piece { tileset: string; mesh: Mesh2D; geometry: TexturedGeometry2D; tiles: number; }
interface Chunk { readonly column: number; readonly row: number; visible: boolean; pieces: Piece[]; readonly display: DisplayObjectContainer; face: TileMapChunk; }
interface Layer { readonly data: TileLayerData; readonly cells: Uint32Array; readonly display: DisplayObjectContainer; readonly chunks: Chunk[]; readonly across: number; face: TileMapLayer; }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * A map drawn from its tilesets. Each tile layer is a container of chunks, and each chunk one mesh
 * for each tileset it draws from, so that a large map is a few hundred meshes, not a node per tile.
 */
export function createTileMap(options: TileMapOptions): TileMap {
  if (!record(options)) throw new EgretError('TILEMAP_OPTIONS_INVALID');
  const { map, textures, chunkSize = 32 } = options;
  if (!record(map) || map.orientation !== 'orthogonal' || !Array.isArray(map.layers) || !Array.isArray(map.tilesets) || !record(textures)
    || !Number.isSafeInteger(chunkSize) || chunkSize < 4 || chunkSize > 128) throw new EgretError('TILEMAP_OPTIONS_INVALID');
  const sets = map.tilesets as readonly TileSetData[];
  const setOf = (gid: number): TileSetData | undefined => {
    for (let i = sets.length - 1; i >= 0; i--) { const set = sets[i]!; if (gid >= set.firstGid) return gid < set.firstGid + set.tileCount ? set : undefined; }
    return undefined;
  };
  const display = new DisplayObjectContainer();
  const layers: Layer[] = [];
  let closed = false;

  /** The quads of the tiles of one tileset in one chunk, as one geometry. */
  function geometryOf(layer: Layer, chunk: Chunk, set: TileSetData): { geometry: TexturedGeometry2D; tiles: number } | undefined {
    const { width, height } = layer.data, endColumn = Math.min(chunk.column + chunkSize, width), endRow = Math.min(chunk.row + chunkSize, height);
    const found: number[] = [];
    for (let row = chunk.row; row < endRow; row++) for (let column = chunk.column; column < endColumn; column++) {
      const raw = layer.cells[row * width + column]!, gid = (raw & ~TILE_FLIP_MASK) >>> 0;
      if (gid !== 0 && setOf(gid) === set) found.push(row * width + column);
    }
    if (found.length === 0) return undefined;
    const n = found.length, positions = new Float64Array(n * 8), uvs = new Float64Array(n * 8), indices = new Uint32Array(n * 6);
    const lightColors = new Float64Array(n * 16).fill(1);
    found.forEach((cell, k) => {
      const raw = layer.cells[cell]!, id = ((raw & ~TILE_FLIP_MASK) >>> 0) - set.firstGid, column = cell % width, row = (cell - column) / width;
      // A tile taller than a cell stands on the bottom of its cell, as Tiled draws it.
      const x = (column + layer.data.startX) * map.tileWidth, y = (row + layer.data.startY + 1) * map.tileHeight - set.tileHeight;
      positions.set([x, y, x + set.tileWidth, y, x + set.tileWidth, y + set.tileHeight, x, y + set.tileHeight], k * 8);
      const sx = set.margin + (id % set.columns) * (set.tileWidth + set.spacing), sy = set.margin + Math.floor(id / set.columns) * (set.tileHeight + set.spacing);
      const u0 = sx / set.imageWidth, v0 = sy / set.imageHeight, u1 = (sx + set.tileWidth) / set.imageWidth, v1 = (sy + set.tileHeight) / set.imageHeight;
      // The corners top left, top right, bottom right, bottom left, then turned as the flags say.
      let corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      if (raw & FLIP_D) corners = [corners[0]!, corners[3]!, corners[2]!, corners[1]!];
      if (raw & FLIP_H) corners = [corners[1]!, corners[0]!, corners[3]!, corners[2]!];
      if (raw & FLIP_V) corners = [corners[3]!, corners[2]!, corners[1]!, corners[0]!];
      uvs.set(corners.flat(), k * 8);
      indices.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
    });
    return { geometry: createTexturedGeometry2D({ positions, uvs, lightColors, indices }), tiles: n };
  }
  function faceOf(chunk: Chunk): TileMapChunk {
    return Object.freeze({ column: chunk.column, row: chunk.row, get visible(): boolean { return chunk.visible; },
      meshes: Object.freeze(chunk.pieces.map(piece => Object.freeze({ tileset: piece.tileset, mesh: piece.mesh, geometry: piece.geometry, tiles: piece.tiles }))) });
  }
  /** Draws a chunk again: a mesh is kept and given its new geometry where it can be, made where a set appears, and let go where one disappears. */
  function draw(layer: Layer, chunk: Chunk): void {
    const before = new Map(chunk.pieces.map(piece => [piece.tileset, piece])), next: Piece[] = [];
    for (const set of sets) {
      const lease = Object.hasOwn(textures, set.name) ? (textures as Record<string, AssetLease<Texture>>)[set.name] : undefined;
      const built = geometryOf(layer, chunk, set), old = before.get(set.name);
      if (built === undefined) continue;
      if (lease === undefined) throw new EgretError('TILEMAP_TEXTURE_MISSING', { cause: new Error(set.name) });
      if (old !== undefined) { old.mesh.setContent(lease, built.geometry); old.geometry = built.geometry; old.tiles = built.tiles; before.delete(set.name); next.push(old); continue; }
      const mesh = new Mesh2D(lease, built.geometry);
      chunk.display.addChild(mesh);
      next.push({ tileset: set.name, mesh, geometry: built.geometry, tiles: built.tiles });
    }
    for (const gone of before.values()) { chunk.display.removeChild(gone.mesh); gone.mesh.dispose(); }
    // Back to front in the order of the tilesets, as they are drawn.
    next.forEach((piece, index) => { if (chunk.display.getChildIndex(piece.mesh) !== index) chunk.display.setChildIndex(piece.mesh, index); });
    chunk.pieces = next;
    chunk.face = faceOf(chunk);
  }
  function release(): unknown[] {
    const failures: unknown[] = [];
    for (const layer of layers) for (const chunk of layer.chunks) for (const piece of chunk.pieces) try { piece.mesh.dispose(); } catch (cause) { failures.push(cause); }
    try { display.dispose(); } catch (cause) { failures.push(cause); }
    return failures;
  }
  try {
    for (const data of map.layers) {
      if (data.type !== 'tile') continue;
      const container = display.addChild(new DisplayObjectContainer());
      container.x = data.offsetX; container.y = data.offsetY; container.alpha = data.opacity; container.visible = data.visible;
      const layer: Layer = { data, cells: new Uint32Array(data.data), display: container, chunks: [], across: Math.ceil(data.width / chunkSize), face: undefined as unknown as TileMapLayer };
      for (let row = 0; row < data.height; row += chunkSize) for (let column = 0; column < data.width; column += chunkSize) {
        const chunk: Chunk = { column, row, visible: true, pieces: [], display: container.addChild(new DisplayObjectContainer()), face: undefined as unknown as TileMapChunk };
        draw(layer, chunk);
        layer.chunks.push(chunk);
      }
      layer.face = Object.freeze({ name: data.name, data, display: container, get chunks(): readonly TileMapChunk[] { return Object.freeze(layer.chunks.map(chunk => chunk.face)); } });
      layers.push(layer);
    }
  } catch (cause) {
    const cleanupErrors = release();
    if (cause instanceof EgretError) throw new EgretError(cause.code, { cause: cause.cause, cleanupErrors });
    throw new EgretError('TILEMAP_DRAW_FAILED', { cause, cleanupErrors });
  }

  function layerOf(name: unknown): Layer {
    const layer = layers.find(candidate => candidate.data.name === name);
    if (layer === undefined) throw new EgretError('TILEMAP_LAYER_UNKNOWN');
    return layer;
  }
  function info(raw: number): TileInfo | undefined {
    const gid = (raw & ~TILE_FLIP_MASK) >>> 0, set = gid === 0 ? undefined : setOf(gid);
    if (set === undefined) return undefined;
    const id = gid - set.firstGid;
    return Object.freeze({ gid, tileset: set, id, flippedHorizontally: (raw & FLIP_H) !== 0, flippedVertically: (raw & FLIP_V) !== 0, flippedDiagonally: (raw & FLIP_D) !== 0,
      properties: set.tiles.get(id)?.properties ?? NONE });
  }
  const cellIndex = (layer: Layer, column: unknown, row: unknown): number => {
    if (!Number.isSafeInteger(column) || !Number.isSafeInteger(row)) throw new EgretError('TILEMAP_CELL_INVALID');
    const c = (column as number) - layer.data.startX, r = (row as number) - layer.data.startY;
    return c < 0 || r < 0 || c >= layer.data.width || r >= layer.data.height ? -1 : r * layer.data.width + c;
  };
  const open = (): void => { if (closed) throw new EgretError('TILEMAP_CLOSED'); };

  return Object.freeze({
    get state(): 'active' | 'closed' { return closed ? 'closed' : 'active'; },
    data: map as TileMapData, display,
    get layers(): readonly TileMapLayer[] { return Object.freeze(layers.map(layer => layer.face)); },
    layer: (name: string): TileMapLayer => layerOf(name).face,
    tileAt(name: string, column: number, row: number): TileInfo | undefined {
      const layer = layerOf(name), index = cellIndex(layer, column, row);
      return index < 0 ? undefined : info(layer.cells[index]!);
    },
    setTile(name: string, column: number, row: number, gid: number): void {
      open();
      const layer = layerOf(name), index = cellIndex(layer, column, row);
      if (index < 0) throw new EgretError('TILEMAP_CELL_INVALID');
      if (!Number.isSafeInteger(gid) || gid < 0 || gid > 0xffffffff) throw new EgretError('TILEMAP_TILE_INVALID');
      const id = (gid & ~TILE_FLIP_MASK) >>> 0;
      if (id !== 0 && setOf(id) === undefined) throw new EgretError('TILEMAP_TILE_INVALID');
      if (layer.cells[index] === gid >>> 0) return;
      const before = layer.cells[index]!;
      layer.cells[index] = gid >>> 0;
      const c = index % layer.data.width, r = (index - c) / layer.data.width;
      const chunk = layer.chunks[Math.floor(r / chunkSize) * layer.across + Math.floor(c / chunkSize)]!;
      try { draw(layer, chunk); } catch (cause) { layer.cells[index] = before; throw cause; }
    },
    propertiesOf(gid: number): TileMapProperties {
      if (!Number.isSafeInteger(gid) || gid < 0) throw new EgretError('TILEMAP_TILE_INVALID');
      return info(gid >>> 0)?.properties ?? NONE;
    },
    cellAt(x: number, y: number): { readonly column: number; readonly row: number } {
      if (!finite(x) || !finite(y)) throw new EgretError('TILEMAP_CELL_INVALID');
      return Object.freeze({ column: Math.floor(x / map.tileWidth), row: Math.floor(y / map.tileHeight) });
    },
    cellOrigin(column: number, row: number): { readonly x: number; readonly y: number } {
      if (!Number.isSafeInteger(column) || !Number.isSafeInteger(row)) throw new EgretError('TILEMAP_CELL_INVALID');
      return Object.freeze({ x: column * map.tileWidth, y: row * map.tileHeight });
    },
    cull(view: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): number {
      if (!record(view) || !finite(view.x) || !finite(view.y) || !finite(view.width) || !finite(view.height) || view.width < 0 || view.height < 0) throw new EgretError('TILEMAP_OPTIONS_INVALID');
      open();
      let shown = 0;
      // A tile taller than a cell reaches above its chunk: the margin is the tallest tile.
      const reach = Math.max(0, ...sets.map(set => set.tileHeight - map.tileHeight)), wide = Math.max(0, ...sets.map(set => set.tileWidth - map.tileWidth));
      for (const layer of layers) for (const chunk of layer.chunks) {
        const left = (chunk.column + layer.data.startX) * map.tileWidth + layer.data.offsetX, top = (chunk.row + layer.data.startY) * map.tileHeight + layer.data.offsetY - reach;
        const right = left + chunkSize * map.tileWidth + wide, bottom = top + reach + chunkSize * map.tileHeight;
        const visible = left <= view.x + view.width && right >= view.x && top <= view.y + view.height && bottom >= view.y;
        if (visible !== chunk.visible) { chunk.visible = visible; chunk.display.visible = visible; }
        if (visible) shown++;
      }
      return shown;
    },
    dispose(): void {
      if (closed) return;
      closed = true;
      const failures = release();
      if (failures.length > 0) throw new EgretError('TILEMAP_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
}
