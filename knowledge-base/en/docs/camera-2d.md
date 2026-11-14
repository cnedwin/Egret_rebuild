# A 2D camera

English | [简体中文](../../Cns/docs/camera-2d.md)

`@egret/engine/camera` is a view of a 2D world. Put the world in one container; the camera places that container — its place, scale, rotation and anchor — so that the world is seen from where the camera looks. It follows a target with a dead zone, stays inside bounds, zooms, shakes, pans to a place, and moves layers in front of or behind the world at their own speed. It keeps no clock: the game calls `update(seconds)` once a frame. A game that does not import it loads nothing of it.

**What is checked and what is not.** The camera is checked in Node against a real display tree, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/camera-2d/README.md) in headless Chromium with software WebGL2, where colours are read from the canvas. No hardware GPU or phone was run. See [What was run](#what-was-run).

## Use

```js
import { createCamera2D } from '@egret/engine/camera';

const world = engine.stage.addChild(scope.use(new Sprite()));      // everything of the level goes in here
const camera = scope.use(createCamera2D({ world, width: 480, height: 270, bounds: { x: 0, y: 0, width: 1600, height: 900 } }));
camera.follow(hero, { smoothing: 0.2, deadZone: { width: 80, height: 50 } });

function frame(seconds) {
  moveHero(seconds);
  camera.update(seconds);
  engine.renderSharedFrame(frameOptions);
}
```

| Option | Meaning | Default |
| --- | --- | --- |
| `world` | The container that holds the world. The camera owns its place, scale, rotation and anchor while it lives, and gives them back when it is disposed | — |
| `width`, `height` | The size of what is shown, in stage units | — |
| `center`, `zoom`, `rotation` | Where the camera looks first, how close, and how turned (degrees) | the middle of the view, 1, 0 |
| `minZoom`, `maxZoom` | The zoom it may take | 0.25, 4 |
| `bounds` | A rectangle of the world the camera never shows past. A world smaller than the view stands in its middle. Rotation is not taken into account | none |
| `shakeOffset`, `shakeRotation`, `shakeDecay`, `shakeFrequency`, `seed` | How far a shake moves (stage units) and turns (degrees) the view, how much trauma it loses a second, how fast it shakes, and which shake | 16, 0, 1, 15, 1 |
| `roundToPixel` | Places the world on whole stage units so that pixel art does not shimmer | false |

## Following

`follow(target, { smoothing, deadZone, offset })` takes a display object anywhere inside the world, however nested and transformed, or a function that returns a point of the world. `smoothing` is the time, in seconds, in which the camera closes about 63 % of the distance; the same distance is closed in the same time however many frames there are. Inside the dead zone, a rectangle around the middle of the view in world units, the target moves alone; outside it the camera is pulled to its edge. `stopFollowing()` lets go. `panTo(x, y, seconds)` eases to a place and stops a follow; `lookAt(x, y)` looks at once.

## Zoom, rotation and size

`setZoom`, `zoomTo(zoom, seconds)`, `setRotation(degrees)` and `resize(width, height)` change the view around its middle. Bounds are kept after each.

## Shake

`shake({ trauma })` adds trauma, up to 1. The view moves and turns as far as the square of the trauma, along smooth noise; the trauma falls by `shakeDecay` a second, and at nothing the view is where it was. The same seed shakes the same way at the same time.

## Layers

`addLayer(layer, { factor, zoomFactor })` moves another container — hills behind, leaves in front — at its own speed: `factor` 0 stands still, 1 moves with the world, 0.3 at three tenths of its speed; it may differ across and down (`{ x, y }`). `zoomFactor` is how much of the zoom it takes. When the camera looks at the middle of the view the layer is where it was put. The function returned gives the layer back its place.

## Reading

`worldToScreen` and `screenToWorld` convert as the camera places the world now, shake and rotation included; use `screenToWorld` for a press on the stage. `isVisible(rect)` says whether a rectangle of the world is in the view, to leave out what cannot be seen. `snapshot()` gives the center, zoom, rotation, trauma, the rectangle shown, whether it follows, and the time it has been updated for.

## Errors

| Code | When |
| --- | --- |
| `CAMERA_OPTIONS_INVALID` | An option or an argument is not what it may be |
| `CAMERA_TARGET_INVALID` | A target is no display object or function, was disposed, or said no point |
| `CAMERA_LAYER_INVALID` | A layer is no display object, the world itself, disposed, or already a layer |
| `CAMERA_CLOSED` | The camera was disposed |
| `CAMERA_CLEANUP_FAILED` | Giving the world or a layer back failed |

## What was run

| What | Where | Result |
| --- | --- | --- |
| The camera over a real display tree: where it puts the world and its layers, points both ways with zoom and rotation, bounds, follows at different frame rates, dead zones, nested targets, pans, zooms, shakes, pixels, disposal, a strict TypeScript consumer with six refused misuses, and the exports | Node, [`tests/camera-2d.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/camera-2d.test.mjs) | 17 cases |
| Every comparison, boolean and logical operator of the built module changed one at a time | Node | 175 changes, 163 caught. Of the 12 left, 9 sit on a boundary where both sides give the same place (a target exactly on the edge of the dead zone, a world exactly as large as the view, a pan or zoom that ends exactly on its time), 1 renumbers the channels of the noise, and 2 are option checks where another check refuses the same value |
| The example: the first frame, a follow at sixty and twenty frames a second, the walls, zoom by button and wheel with the layers' share, parallax, a shake that settles, a look at the gate and back, real-time keys, and a phone profile | Headless Chromium 153, software WebGL2 | 9 scenarios |
| A hardware GPU, WebGPU, a real phone | — | Not run |

## Not in this slice

- Several cameras, split screens and cameras that draw into a texture.
- Bounds for a turned view, and a follow that looks ahead of a moving target.
