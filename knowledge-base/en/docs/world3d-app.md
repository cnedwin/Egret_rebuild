# A World3D game in one call

English | [简体中文](../../Cns/docs/world3d-app.md)

This page covers what most 3D games built their own: starting, models made in code, labels over the picture and a performance readout.

`createWorld3DApp` starts a 3D game on a canvas. It chooses the backend, makes an Engine on a World3D host, makes a renderer for a picture quality, runs the frame loop, and lowers the drawing resolution while frames are slow. It is exported by both `@egret/engine/webgl2/world3d` and `@egret/engine/webgpu/world3d`.

**Verification.** Node checks cover backend selection, presets and resolution control. The original software-WebGL2 run covered fallback, geometry merging, markers, the statistics readout and overlay compositing. Windows Edge 157 on an RTX 5090 Laptop GPU and Fold7 Chrome on an Adreno 830 subsequently exercised app start, pause, resize and disposal, markers, skinned retargeting and instance range changes on WebGPU and WebGL2.

In the hardware check of baseline `c049bc38`, the ninth point light had no effect on a 128 × 65 WebGPU target even though selection reported it. A full-target comparison against the same light in the direct path confirmed this on Windows. The 128 × 64 control and both WebGL2 sizes retained the light. With fragment-space row assignment corrected, all 33,280 RGBA8 bytes at 128 × 65 matched the direct path on both devices. This is pixel and lifecycle evidence for the sampled scenes.

## Use

```js
import { createWorld3DApp } from '@egret/engine/webgl2/world3d';
import { Scene3D, createPerspectiveCamera3D } from '@egret/engine/world3d';

const app = await createWorld3DApp(canvas, {
  storedQuality: save.quality,
  onError: error => showTrouble(error),
  onDeviceLost: () => showTrouble('The graphics device stopped working.'),
});
const scene = new Scene3D();
const camera = createPerspectiveCamera3D({ fov: 60 });
scene.addChild(camera);
app.show(scene, camera, { onUpdate: (seconds) => game.update(seconds) });
```

`app.show` replaces what was shown and starts the loop. `app.stop()` and `app.start()` pause and resume it. `app.dispose()` ends the loop, the view, the renderer and the Engine.

## Backend

`backend` is `webgl2` or `webgpu`. Without it the address decides: `?backend=webgpu` asks for WebGPU, anything else gives WebGL2. When WebGPU is asked for and the browser offers no adapter, WebGL2 draws instead and `app.fellBack` is true. `pickWorld3DBackend(query, fallback)` gives the same choice to a page that makes its own renderer.

## Quality

`quality` is `low`, `medium`, `high` or `auto` (the default). `auto` reads, in order:

1. the address's `?quality=`;
2. `storedQuality`, a choice the player made before;
3. the device: `low` when WebGL is drawn by software (a headless browser, a virtual machine, a blocked graphics card), for a finger or for a window shorter than 600 pixels; `medium` for 4 GB of memory or less; `high` otherwise.

`pickWorld3DQuality(hints)` gives the same answer when its `softwareRenderer` hint is `isSoftwareRendered3D()`, which the app asks for you.

| Quality | Pixel ratio | Antialias | Shadows | Post-processing |
| --- | --- | --- | --- | --- |
| `low` | 1 | off | off | off |
| `medium` | 1.5 | on | on, 2048 atlas | bloom and FXAA |
| `high` | 2 | on | on, 4096 atlas | bloom, FXAA and ambient occlusion |

`WORLD3D_QUALITY_PRESETS` holds the table. `app.setQuality(quality)` applies another row's shadows, post-processing and pixel ratio. Antialiasing and the shadow atlas size are fixed when the renderer is made. A game may still set any other `renderer.postProcess` field itself after starting.

## Drawing resolution

The drawing resolution follows the frame rate unless `dynamicResolution: false` is passed. When the smoothed rate stays below 45 frames a second for 1.5 seconds, the share of the pixel ratio drops by 0.15, down to 0.6. When it stays above 57 for 6 seconds, the share climbs back. `app.resolutionScale` gives the share in use. The thresholds are options of `dynamicResolution`. `createDynamicResolution3D(options)` gives the same controller to a page that drives its own loop: call `update(seconds)` each frame and multiply the pixel ratio by the share it returns.

## Models made in code

`createGeometryBuilder3D()` puts many placed, coloured parts into one geometry, so a truck made of boxes or a field of stones draws in one call.

```js
import { createBoxGeometry3D, createCylinderGeometry3D, createGeometryBuilder3D, createStandardMaterial3D, Mesh3D } from '@egret/engine/world3d';

const truck = createGeometryBuilder3D()
  .add(createBoxGeometry3D({ width: 2, height: 1, depth: 1.6 }), { position: [0, 1, 0], color: 0x4b5d3a })
  .add(createCylinderGeometry3D({ radiusTop: 0.4, radiusBottom: 0.4, height: 0.3 }), { position: [0.7, 0.4, 0.85], rotation: [Math.PI / 2, 0, 0], color: 0x1a1a1a })
  .build();
scene.addChild(new Mesh3D(truck, createStandardMaterial3D({ vertexColors: true })));
```

A part is placed by `position`, `rotation` (Euler radians) or `quaternion`, and `scale`, or by a `matrix`. `color` is a hex colour as seen on screen or linear RGB; it is written into the vertex colours as linear values, so the material needs `vertexColors: true`. `keepColors` multiplies colours the part already has. A mirrored part keeps its triangles facing out. The merged geometry has positions, normals, colours and, when every part has them, texture coordinates. `linearColor3D(hex)` gives the linear values of a hex colour for vertex colours written by hand.

## Labels and markers over the picture

The interface of a 3D game is usually page elements over the canvas. `createScreenMarkers3D({ container, camera })` keeps such elements on scene points.

```js
const markers = createScreenMarkers3D({ container: hud, camera });
markers.add(nameTag, { target: enemy, offset: [0, 2.1, 0], maxDistance: 40 });
markers.add(objective, { target: [120, 0, -40], clampToEdge: true, margin: 32 });
// each frame, after the camera moved
markers.update();
```

An element is moved with a CSS transform, so give it `position: absolute; left: 0; top: 0`. A marker hides while its target is behind the camera or beyond `maxDistance`. With `clampToEdge` it stays at the edge of the screen instead, gets `data-on-edge`, and `marker.angle` gives the direction for an arrow. `projectToViewport3D(camera, point, width, height)` gives the same projection to code that draws its own markers.

## The engine's 2D interface over the scene

```js
import { createWorld3DApp, createWorld3DOverlay } from '@egret/engine/webgl2/world3d';
import { Sprite } from '@egret/engine';

const app = await createWorld3DApp(canvas);
const ui = await createWorld3DOverlay(canvas, { width: 1280, height: 720 });
const pause = new Sprite();
pause.graphics.beginFill(0x203040).drawRect(0, 0, 120, 48).endFill();
pause.touchEnabled = true;
ui.game.stage.addChild(pause);
```

`createWorld3DOverlay` lays a transparent canvas exactly over the 3D canvas, which must sit in a positioned parent, and starts a 2D game on it with `createBrowserGame`. Menus, bars, text, bitmap buttons and the `ui` controls then draw with the engine's 2D stage on top of the scene. The overlay follows the 3D canvas's box as the page resizes. By default it stretches its stage over that box, which squashes the interface when a phone turns; `fit: 'contain'` keeps the stage's shape, as large as fits and centred, and `fit: 'cover'` keeps its shape and fills the box, its edges cut off by the parent. `overlay.box` says where the stage is now and its scale in CSS pixels per unit. The stage's own `width` and `height` stay as made: for a layout that changes with the shape, make the overlay again at the new width.

A press or wheel over a 2D node with `touchEnabled` stays on the overlay. A press in an empty area and the rest of its drag go to the 3D canvas. A browser-native primary click goes to the scene only if it comes from a scene-owned press that also ended in an empty area. The forwarded event is a DOM copy. A drag from a 2D control into an empty area keeps its original ownership. Hover moves go where the interface is empty. `passThrough: false` keeps every event on the overlay. `ui.dispose()` ends the 2D game and removes the overlay. Windows mouse and Fold7 touch automation verified click routing and the drag control on both backends.

The 2D stage uses WebGL2 by default, so the 3D renderer keeps WebGPU for itself where it uses it. The two canvases are composited by the page; nothing is copied between them.

## A performance readout

`createWorld3DStats(renderer, { container })` shows frame time, the game's own parts of a frame, and what the renderer drew: draw calls, triangles, lights dropped, programs, geometries and textures. Call `begin()` at the start of a frame, `lap(name)` after each part, and `end()` after drawing. Without `container` the numbers are still gathered, for automated checks.

## Limits

The app draws one scene through one camera at a time. A game with a second view or a picture-in-picture drives `World3DView` itself. A device that is lost is reported to `onDeviceLost`; making a new app is the way back.
