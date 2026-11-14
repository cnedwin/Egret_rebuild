# A 2D camera

English | [简体中文](README.zh-CN.md)

A courtyard larger than the view, seen through the camera of `@egret/engine/camera`. It follows a disciple with a dead zone, stops at the walls, may look over the far wall at the hills, zooms, shakes, looks at the gate and comes back, and moves far hills and near leaves at their own speed.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/camera-2d/index.html` on the host and port the server prints. Add `?backend=webgl2` for WebGL2.

## What to try

- Walk with the arrow keys or WASD. The disciple moves inside a box around the middle before the camera follows, and the camera catches up smoothly.
- Walk into a corner. The camera stops at the walls and the disciple walks on to the edge of the view.
- Zoom in and out with the buttons or the wheel. The leaves take all of the zoom and the hills three tenths of it.
- Shake. The view moves and turns, and settles where it was.
- Look at the gate: the camera stops following and eases to it, over the far wall. Follow takes it back.

## How it works

| Part | From |
| --- | --- |
| The yard and the disciple | One container, the world, given to `createCamera2D` |
| Following | `camera.follow(hero, { smoothing, deadZone })` |
| The walls | `bounds`, reaching a little above the yard |
| Hills and leaves | `camera.addLayer(layer, { factor, zoomFactor })` |
| Zoom, shake, the gate | `zoomTo`, `shake`, `panTo` |
| Time | The page gives `camera.update(seconds)` the time of each frame |

See the [camera guide](../../knowledge-base/en/docs/camera-2d.md).

## Check

```text
node examples/camera-2d/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

With `?manual` the page does not move by itself and the check steps the game; one scenario uses real time and the keyboard. Colours are read from screenshots of the canvas. No person pressed a key and no phone was used.
