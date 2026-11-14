# Tile maps

English | [简体中文](../../Cns/docs/tilemap.md)

`@egret/engine/tilemap` reads a map made in [Tiled](https://www.mapeditor.org/) from the JSON Tiled saves, and draws its tile layers from the images of their tilesets. Each tile layer is a container of chunks, and each chunk one mesh for each tileset it draws from, so that a map of thousands of tiles is a few dozen meshes and the chunks that cannot be seen are left out. It is an optional entry: a game that does not import it loads nothing of it.

**What is checked and what is not.** The importer and the drawn map are checked in Node, on a real Engine with leased textures, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/tilemap/README.md) in headless Chromium with software WebGL2, where colours are read from the canvas. The map of the example was written by a script in the form Tiled writes; no file saved by Tiled itself was imported. See [What was run](#what-was-run).

## Use

```js
import { createTileMap, importTiledMap } from '@egret/engine/tilemap';

const map = importTiledMap(await (await fetch('level1.tmj')).json());
// One leased texture for each tileset, by its name: the image the tileset names, loaded the way the game loads images.
const tiles = scope.use(createTileMap({ map, textures: { terrain: terrainLease, trees: treesLease }, chunkSize: 16 }));
world.addChild(tiles.display);

function frame() {
  tiles.cull(camera.snapshot().view);   // only what can be seen
  engine.renderSharedFrame(frameOptions);
}
```

## What is read

| Tiled | Read |
| --- | --- |
| Orthogonal maps, finite and infinite | Yes. An infinite layer is cut to the cells its chunks hold and keeps where it starts (`startX`, `startY`) |
| Tile layers as arrays (CSV) or base64 | Yes, base64 without compression. zlib, gzip and zstd are refused with `TILEMAP_COMPRESSION_UNSUPPORTED`: save with CSV or base64 uncompressed |
| Tilesets in the map, or in files of their own | Yes. A tileset of its own file is given as `importTiledMap(json, { tilesets: { 'trees.tsj': treesJson } })`. A set of separate images is refused |
| Margins, spacing, tiles taller than a cell | Yes. A taller tile stands on the bottom of its cell, as Tiled draws it |
| Flipped and turned tiles | Yes: across, down and about the diagonal |
| Groups | Flattened: a layer inside takes the group's offset, opacity, visibility and parallax, and its name is `group/layer` |
| Object layers | Read as data: rectangles, ellipses, points, polygons, polylines, text and tile objects, with their properties. They are not drawn |
| Properties | Of the map, tilesets, tiles, layers and objects, as strings, numbers and booleans. A class or object reference is kept as JSON text |
| Tile animations | Read as data (`tileset.tiles.get(id).animation`); the drawn map does not play them |
| Isometric, staggered and hexagonal maps; image layers; Wang sets | Refused or left out |

## The drawn map

`createTileMap({ map, textures, chunkSize })` takes the data and a leased texture for each tileset that is drawn (`TILEMAP_TEXTURE_MISSING` names a set without one). `chunkSize` is the cells across and down of a chunk, 4 to 128, 32 by default.

| Read or change | Meaning |
| --- | --- |
| `tiles.display`, `tiles.layer(name).display` | The containers to put in the world, and each tile layer's, with its offset, opacity and visibility |
| `tiles.tileAt(layer, column, row)` | The tile at a cell: its id, its tileset, its flips and its properties |
| `tiles.setTile(layer, column, row, gid)` | Puts a tile, with its flip flags, or takes it away with 0. Only its chunk is drawn again |
| `tiles.propertiesOf(gid)` | What a tile says of itself, such as whether it is solid |
| `tiles.cellAt(x, y)`, `tiles.cellOrigin(column, row)` | The cell under a point of the map, and the corner of a cell |
| `tiles.cull(view)` | Shows only the chunks that meet a rectangle of the map, allowing for tiles taller or wider than a cell, and says how many show |
| `tiles.layer(name).chunks` | Each chunk with its meshes, their geometry and how many tiles they draw |

A global id carries its flips in its top three bits (`TILE_FLIP_MASK`), as Tiled writes it. The map is drawn on the shared renderer as `Mesh2D` nodes; nothing of it is drawn on a canvas of the page.

## Errors

| Code | When |
| --- | --- |
| `TILEMAP_DATA_INVALID` | The JSON is not a map that can be read; its `cause` says where |
| `TILEMAP_ORIENTATION_UNSUPPORTED`, `TILEMAP_COMPRESSION_UNSUPPORTED`, `TILEMAP_LAYER_UNSUPPORTED`, `TILEMAP_TILESET_UNSUPPORTED` | A part of Tiled this entry does not read |
| `TILEMAP_TILESET_MISSING` | A tileset kept in its own file was not given |
| `TILEMAP_OPTIONS_INVALID` | An option is not what it may be |
| `TILEMAP_TEXTURE_MISSING` | A tileset that is drawn has no texture |
| `TILEMAP_LAYER_UNKNOWN`, `TILEMAP_CELL_INVALID`, `TILEMAP_TILE_INVALID` | No such tile layer, cell or tile |
| `TILEMAP_CLOSED`, `TILEMAP_CLEANUP_FAILED`, `TILEMAP_DRAW_FAILED` | The map was disposed, letting it go failed, or drawing it failed |

## What was run

| What | Where | Result |
| --- | --- | --- |
| The importer: tilesets, layers, groups, objects, base64, infinite maps, tilesets of their own files, every refusal and its edges; the drawn map: chunks, meshes per tileset, the cut of each tile past margins and spacing, flips, tall tiles, reading and changing cells, culling, infinite layers, a strict TypeScript consumer with five refused misuses, and the exports | Node, [`tests/tilemap.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/tilemap.test.mjs) | 14 cases |
| Every comparison, boolean and logical operator of the two built modules changed one at a time | Node | 226 changes, 212 caught. The 14 left are loop bounds where the extra step reads nothing, limits of sixteen million cells that were not built, a tileset boundary where the next set begins, and option checks where another check refuses the same value |
| The example: the first frame read from the canvas, walls and the river that stop the disciple, the camera to the edge of the map with chunks culled, the whole yard zoomed out, flowers planted and taken away by a press, the trees layer hidden, real-time keys, a tap on a phone profile | Headless Chromium 153, software WebGL2 | 8 scenarios |
| A map saved by Tiled itself; a hardware GPU; a real phone | — | Not run |

## Not in this slice

- Isometric and hexagonal maps; image layers; compressed layers; tile animations played; tilesets of separate images.
- Collision shapes drawn in the Tiled tile editor are not read; a tile's properties can say that it is solid, as the example does.
