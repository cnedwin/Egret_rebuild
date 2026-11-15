import type { TileMap, TileMapOptions } from './tilemapTypes.js';
/**
 * A map drawn from its tilesets. Each tile layer is a container of chunks, and each chunk one mesh
 * for each tileset it draws from, so that a large map is a few hundred meshes, not a node per tile.
 */
export declare function createTileMap(options: TileMapOptions): TileMap;
//# sourceMappingURL=tileMapDraw.d.ts.map