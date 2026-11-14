# A tile map

English | [简体中文](README.zh-CN.md)

A sect courtyard of 64 by 40 cells in the JSON Tiled saves, read by `importTiledMap` and drawn by `createTileMap` in chunks of sixteen cells, seen through the 2D camera. The page paints the images of its two tilesets, so the repository carries no picture.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/tilemap/index.html` on the host and port the server prints. Add `?backend=webgl2` for WebGL2.

## What to try

- Walk with the arrow keys or WASD. Water, walls and trees stop the disciple, who slides along them; the gate in the far wall is open.
- Watch the line under the canvas: of the 36 chunks only those in view are drawn.
- Zoom out to see the whole yard with its river and bridge.
- Click a cell of grass: flowers grow there, and a second click takes them away. Only that chunk is drawn again.
- Hide the trees: they are a layer of their own inside a group.

## How it works

| Part | From |
| --- | --- |
| The map | `courtyard.tmj`: a ground layer as an array, a group with a layer of details in base64 and a layer of trees taller than a cell, and an object layer with the spawn point |
| Reading it | `importTiledMap(json)` |
| The tileset images | Painted by the page into textures, leased from the Engine's assets |
| Drawing it | `createTileMap({ map, textures, chunkSize: 16 })`, with the disciple put between the details and the trees |
| What may be walked on | `tiles.tileAt` and the `solid` and `water` properties the tileset gives its tiles |
| What is drawn | `tiles.cull(camera.snapshot().view)` each frame |
| Planting | `camera.screenToWorld`, `tiles.cellAt` and `tiles.setTile` |

See the [tile map guide](../../knowledge-base/en/docs/tilemap.md).

## Check

```text
node examples/tilemap/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

With `?manual` the check steps the game; one scenario uses real time and the keyboard. Colours are read from screenshots of the canvas. No person pressed a key and no phone was used.
