// SPDX-License-Identifier: Apache-2.0
import type { AssetLease, DisplayObjectContainer, Mesh2D, Texture } from '@egret/runtime';
import type { TexturedGeometry2D } from '@egret/contracts';

export type TileMapPropertyValue = string | number | boolean;
export type TileMapProperties = Readonly<Record<string, TileMapPropertyValue>>;
export interface TileAnimationFrame { readonly tileId: number; readonly duration: number; }
export interface TileSetData {
  readonly name: string;
  /** The global id of the first tile of the set. */
  readonly firstGid: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly columns: number;
  readonly tileCount: number;
  readonly spacing: number;
  readonly margin: number;
  /** Where the image is, as the map says it; the game loads it. */
  readonly image: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly properties: TileMapProperties;
  /** What a tile of the set says of itself, by its id in the set. */
  readonly tiles: ReadonlyMap<number, { readonly properties: TileMapProperties; readonly animation?: readonly TileAnimationFrame[]; readonly type?: string }>;
}
export interface TileLayerData {
  readonly type: 'tile';
  readonly name: string;
  /** Cells across and down. An infinite map is cut to the cells it has, starting at `startX`, `startY`. */
  readonly width: number;
  readonly height: number;
  readonly startX: number;
  readonly startY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly opacity: number;
  readonly visible: boolean;
  readonly parallaxX: number;
  readonly parallaxY: number;
  readonly properties: TileMapProperties;
  /** A global id with its flip flags in the top three bits, row by row. 0 is no tile. */
  readonly data: Uint32Array;
}
export interface TileMapObject {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly visible: boolean;
  /** A tile drawn as the object, with its flip flags. */
  readonly gid?: number;
  readonly shape: 'rectangle' | 'ellipse' | 'point' | 'polygon' | 'polyline' | 'text';
  readonly points?: readonly { readonly x: number; readonly y: number }[];
  readonly text?: string;
  readonly properties: TileMapProperties;
}
export interface ObjectLayerData {
  readonly type: 'object';
  readonly name: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly opacity: number;
  readonly visible: boolean;
  readonly properties: TileMapProperties;
  readonly objects: readonly TileMapObject[];
}
export type TileMapLayerData = TileLayerData | ObjectLayerData;
/** A map as plain, frozen data: what a tile map is made from. */
export interface TileMapData {
  readonly orientation: 'orthogonal';
  /** Cells across and down, and the size of one. */
  readonly width: number;
  readonly height: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly infinite: boolean;
  readonly backgroundColor: number | undefined;
  readonly properties: TileMapProperties;
  readonly tilesets: readonly TileSetData[];
  /** Back to front. Layers inside groups are given with the names of their groups before theirs, `group/layer`. */
  readonly layers: readonly TileMapLayerData[];
}
export interface TiledImportOptions {
  /** Tilesets kept in files of their own, by the `source` the map names, as the JSON Tiled writes for them. */
  readonly tilesets?: Readonly<Record<string, unknown>>;
}
export interface TileInfo {
  /** The global id, without flip flags. */
  readonly gid: number;
  readonly tileset: TileSetData;
  /** The id inside its set. */
  readonly id: number;
  readonly flippedHorizontally: boolean;
  readonly flippedVertically: boolean;
  readonly flippedDiagonally: boolean;
  readonly properties: TileMapProperties;
}
export interface TileMapChunk {
  /** The first cell of the chunk. */
  readonly column: number;
  readonly row: number;
  readonly visible: boolean;
  /** One mesh for each tileset the chunk draws from. */
  readonly meshes: readonly { readonly tileset: string; readonly mesh: Mesh2D; readonly geometry: TexturedGeometry2D; readonly tiles: number }[];
}
export interface TileMapLayer {
  readonly name: string;
  readonly data: TileLayerData;
  readonly display: DisplayObjectContainer;
  readonly chunks: readonly TileMapChunk[];
}
export interface TileMapOptions {
  readonly map: TileMapData;
  /** The image of each tileset that is drawn, by its name. A set without one cannot be drawn. */
  readonly textures: Readonly<Record<string, AssetLease<Texture>>>;
  /** Cells across and down in one chunk, 4 to 128. Defaults to 32. */
  readonly chunkSize?: number;
}
/** A map drawn: one container for each tile layer, cut into chunks of meshes that can be left out when they cannot be seen. */
export interface TileMap {
  readonly state: 'active' | 'closed';
  readonly data: TileMapData;
  /** Holds the layers back to front. Put it in the world. */
  readonly display: DisplayObjectContainer;
  readonly layers: readonly TileMapLayer[];
  layer(name: string): TileMapLayer;
  /** The tile at a cell of a layer, or undefined for none or a cell outside it. */
  tileAt(layer: string, column: number, row: number): TileInfo | undefined;
  /** Puts a tile, with its flip flags, at a cell, or takes it away with 0. Its chunk is drawn again. */
  setTile(layer: string, column: number, row: number, gid: number): void;
  /** What a tile says of itself, by global id. */
  propertiesOf(gid: number): TileMapProperties;
  /** The cell under a point of the map, and the top left corner of a cell. */
  cellAt(x: number, y: number): { readonly column: number; readonly row: number };
  cellOrigin(column: number, row: number): { readonly x: number; readonly y: number };
  /** Shows only the chunks that meet a rectangle of the map. Returns how many chunks show. */
  cull(view: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): number;
  /** Takes the meshes off the display and lets go of them. A scope can own a tile map through this. */
  dispose(): void;
}
