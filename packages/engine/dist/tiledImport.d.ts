import type { TiledImportOptions, TileMapData } from './tilemapTypes.js';
/** The top three bits of a global id say how the tile is turned; the rest is the id. */
export declare const TILE_FLIP_MASK = 3758096384;
/**
 * Reads a map saved by Tiled as JSON (`.tmj`, or `.json`), orthogonal, with tile layers as arrays or as
 * base64 without compression, finite or infinite, object layers and groups. What it cannot read it refuses.
 */
export declare function importTiledMap(json: unknown, options?: TiledImportOptions): TileMapData;
//# sourceMappingURL=tiledImport.d.ts.map