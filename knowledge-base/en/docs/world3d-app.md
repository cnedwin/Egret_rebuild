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

## Models shaped from distance fields

Boxes pushed through each other read as boxes. For a creature, a prop, a building or a plant, describe the shape as rounded parts joined smoothly, and let the engine make the mesh: `createSdfGeometry3D(shape, options)` turns a shape built from `sdf*` calls into one coloured mesh with smooth normals, colours blended where parts meet, and the shade of creases and hollows baked into its vertex colours.

```js
import { createSdfGeometry3D, createStandardMaterial3D, Mesh3D, sdfCapsule, sdfEllipsoid, sdfMirror, sdfSphere, sdfSubtract, sdfUnion } from '@egret/engine/world3d';

const fur = 0xf0a040;
const body = sdfUnion([
  sdfEllipsoid([0.6, 0.5, 0.72], { color: fur }),
  sdfSphere(0.42, { at: [0, 0.55, 0.55], color: fur }),
  sdfMirror(sdfEllipsoid([0.1, 0.22, 0.06], { at: [0.25, 0.98, 0.45], rotation: [0, 0, -0.4], color: fur })), // ears
  sdfMirror(sdfCapsule([0.3, -0.2, 0.3], [0.33, -0.62, 0.36], 0.14, { radiusEnd: 0.11, color: fur })), // front legs
  sdfEllipsoid([0.2, 0.14, 0.14], { at: [0, 0.45, 0.9], color: 0xfff0dd }) // muzzle
], { smooth: 0.1 });
const mouth = sdfSubtract(body, sdfEllipsoid([0.1, 0.03, 0.1], { at: [0, 0.37, 1.0], color: 0x6a1a1a }), { smooth: 0.02 });
const face = sdfUnion([mouth, sdfMirror(sdfSphere(0.07, { at: [0.17, 0.68, 0.9], color: 0x111111 }))], { smooth: 0.01 }); // eyes stay crisp
const critter = new Mesh3D(createSdfGeometry3D(face, { variation: { amount: 0.06 } }), createStandardMaterial3D({ vertexColors: true, roughness: 0.75 }));
```

Parts: `sdfSphere(radius)`, `sdfBox([w, h, d], { round })`, `sdfEllipsoid([rx, ry, rz])`, `sdfCapsule(from, to, radius, { radiusEnd })` for limbs, branches and horns, `sdfCylinder(radius, height, { round })`, `sdfCone(bottom, top, height)` and `sdfTorus(radius, tube)`. Each takes `at`, `rotation` (Euler radians), a single `scale` and a `color`; a part without a colour takes its group's. Joins: `sdfUnion(parts, { smooth })` blends parts over `smooth` units, `sdfSubtract(base, cuts, { smooth })` carves (a cut with a colour paints its hollow, as the inside of a mouth), `sdfIntersect(parts)` keeps what they share (parts with a colour paint it, cut faces included; a part without one only cuts), and `sdfMirror(part, { axis })` makes the pair of an eye, ear or leg. `sdfRound(shape, r)` grows and rounds, `sdfShell(shape, t)` hollows, and `sdfDisplace(shape, { amount, frequency, seed })` roughens rocks, bark and earth. A group takes the same `at`, `rotation`, `scale` and `color`, so a limb built of parts is placed as one. `shape.distance(x, y, z)` stays useful in play, for a hit test against the model.

Mesh options: `resolution` (cells along the longest side, 64 unless given, 8 to 192), `triangles` (at most this many, 8000 unless given; 0 keeps all), `occlusion` (how dark creases get, 0.7 unless given), `occlusionRadius`, `variation` ({ `amount`, `frequency`, `seed` }, uneven brightness so a big part is not one flat tone) and `color` for parts with none. `sharp: true` keeps hard surfaces hard: each vertex goes where the planes of the surface around it meet (dual contouring) and normals split where faces meet at more than 40 degrees (or the angle given), so crates, walls, roofs, weapons and machines keep their corners and edges shade as edges; leave it off for creatures and plants. Make models once at setup: at the defaults a model takes a few hundred milliseconds. Keep a separate group with a small `smooth` for eyes, buttons and other details that must not melt into what they sit on.

`simplifyGeometry3D(geometry, { triangles | ratio, maxError })` brings any indexed triangle geometry down to a budget, a generated or scanned model or a far level of detail. It collapses the cheapest edges first by the quadric error metric, refuses collapses that would turn a triangle over or pinch the surface, keeps vertices on open edges and texture seams where they are, keeps each vertex's own attributes and the geometry's material groups, and returns `{ geometry, before, after, error }`. Geometries with morph targets are refused.

Two more parts come from outlines. `sdfLathe(profile, { round })` turns a closed outline of [radius, height] points about the y axis: vases, bottles, pillars, bells, lamp posts. `sdfExtrude(outline, depth, { round })` pushes a closed outline of [x, y] points `depth` deep along z: signs, gables, blades, stars, cut-out shapes.

`sdfPattern(shape, { kind, color, frequency, amount, axis, size, from, to, seed })` paints over a shape's colours without moving its surface: `'spots'` (a coat, a toadstool), `'stripes'` across `axis` (a tiger, planks, layers of rock), `'noise'` patches (moss, dirt, a mottled skin) and `'gradient'` along `axis` from `from` to `to` (darker feet, moss creeping up a wall). Patterns live in the vertex colours, so keep `frequency` to a few per unit. The mesh option `edges: { amount, color }` lights the outer edges, as on worn wood or chipped paint; without `color` each part's edges take a lighter shade of it. The simplifier weighs vertex colours, so a painted edge keeps its line when triangles are taken away.

`exportGlb3D(geometryOrObject)` writes a model as the bytes of a .glb: geometry, vertex colours, texture coordinates, material groups, the node tree with each node's position, rotation and scale, and each material's colour, opacity, metalness and roughness (not textures, skins, morph targets or animations). Save a model made in code once and load it with `loadGltf3D` after, or open it in Blender.

In a checkout, `node tools/model-preview.mjs <absolute Playwright index.mjs> <model.mjs> <picture.png> [--glb <model.glb>]` draws a model from four sides in a headless browser and writes one picture of the four, with its triangles, vertices, size and the time it took to make. The module's default export makes the model from the exports of `@egret/engine/world3d` and returns a shape, a geometry or an object; `export const meshOptions` gives the mesh options of a shape. Look at the picture after each change to a model: proportions, a part painted the wrong colour or a detail that melted show there and not in the code.

The model library in `examples/models` has twenty-four such models, animals, people, buildings, plants and props, each checked from four sides, with the lessons making them taught. Start a new model from the nearest one.

`createSdfLod3D(shape, options)` makes a model in levels of detail, a `Lod3D` that shows the full mesh near the camera and simpler ones further off, each simplified from the one before: unless `levels` ([triangles, distance] pairs) says otherwise, a quarter of the triangles beyond 12 times the model's size and a sixteenth beyond 30 times. A scene of many trees or rocks draws far fewer triangles.

Making a model takes a few hundred milliseconds. `node tools/bake-models.mjs <models folder or model.mjs ...> <new output folder>` makes them ahead of time, in Node with no browser, and writes each as a .glb: the 24 models of the library bake in about 16 seconds and then load with `loadGltf3D` in about 50 milliseconds together. Rigs are made at run time.

`createSurfaceMaterial3D({ surface, scale, strength, bump, ...standard options })` draws a surface between the vertices, in colour and in relief: `'wood'`, `'stone'`, `'brick'`, `'plaster'`, `'metal'`, `'cloth'` or `'bark'`. It is a standard material (vertex colours on unless `vertexColors: false`) whose shader computes the pattern from the world position, projected from the three axes, so it needs no texture and no texture coordinates and is as fine as the pixels rather than the triangles. `scale` is pattern units per world unit (each surface has its own), `strength` how much it darkens and lightens (0.5), `bump` how deep the relief looks (0.5). The pattern is laid in the world: on a model that moves, the model moves through it, so use it for buildings, props and scenery. Both WebGL2 and WebGPU draw it. A library model that exports `surface` (the crate, barrel, chest and signpost in wood, the cottage in plaster, the well and the watchtower in stone) is drawn with it in the gallery and the preview.

The model preview also lists `notes`: a mesh in several pieces (a part floating loose, too thin to join, or a hollow sealed inside), a model sunk below y = 0 or floating above it, and one slow to make. Every model of the library is one piece; the check found a dog's tail floating, a door slab loose in its doorway and a well sealed under a lid.

## Models that move

`createSdfRig3D(shape, bones, options)` makes a model from distance fields move. Each bone names the joint it turns at (`at`), the bone it hangs from (`parent`), and the parts it moves; every vertex of the mesh follows the bones whose parts are nearest, up to four, so the skin bends at a joint instead of tearing. `mirror: 'x'` makes a pair from one side, `name.L` on +x and `name.R`. The parts only guide the weights: they can be the shapes the model was built from or simpler shapes near them. The options are those of `createSdfGeometry3D`, with `material` and `blend` (how far a joint's skin is shared between its bones, a fiftieth of the model's size unless given).

```js
const leg = sdfCapsule([0.08, 0.3, 0], [0.09, 0.08, 0.01], 0.06);
const rig = createSdfRig3D(villagerShape, [
  { name: 'body', at: [0, 0.34, 0], parts: torso },
  { name: 'head', parent: 'body', at: [0, 0.74, 0], parts: head },
  { name: 'leg', parent: 'body', at: [0.08, 0.3, 0], parts: leg, mirror: 'x' }
]);
const walk = rig.clip('walk', 0.8, {
  'leg.L': [[0, [0.5, 0, 0]], [0.4, [-0.5, 0, 0]], [0.8, [0.5, 0, 0]]],
  'leg.R': [[0, [-0.5, 0, 0]], [0.4, [0.5, 0, 0]], [0.8, [-0.5, 0, 0]]],
  body: [[0, [0, 0, 0]], [0.2, [0, 0, 0], [0, 0.025, 0]], [0.4, [0, 0, 0]]]
});
scene.addChild(rig.root);
rig.play(walk);
// each frame: rig.update(seconds)
```

`rig.clip(name, duration, poses)` turns poses of named bones into a clip: each key is a time, Euler angles in radians from the bone's rest pose, and optionally an offset from where it rests. A clip loops cleanly when each bone's last key equals its first. `rig.play(clip, fade)` fades from what was playing (0.2 seconds unless given); `rig.update(seconds)` moves it on. `rig.root` holds the bones and the skinned `rig.mesh`; move it to move the model. `rig.bones` gives each bone by name, for a hand to hold a sword or a head to turn toward the player. In the model library, the villager and the fox have rigs: `rig(W)` returns one with `clips`.

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

`createWorld3DOverlay` lays a transparent canvas exactly over the 3D canvas, which must sit in a positioned parent, and starts a 2D game on it with `createBrowserGame`. Menus, bars, text, bitmap buttons and the `ui` controls then draw with the engine's 2D stage on top of the scene. The overlay follows the 3D canvas's box as the page resizes. By default it stretches its stage over that box, which squashes the interface when a phone turns; `fit: 'contain'` keeps the stage's shape, as large as fits and centred, and `fit: 'cover'` keeps its shape and fills the box, its edges cut off by the parent. `overlay.box` says where the stage is now and its scale in CSS pixels per unit. With these three the stage's own `width` and `height` stay as made.

An interface that should reach every edge on any shape takes `fit: 'expand'`, or one of the fixed modes of Egret 5 (`fixedWidth`, `fixedHeight`, `fixedNarrow`, `fixedWide`). The 2D game then plans its stage as `createBrowserGame` does with those fits:

- **The stage follows the 3D canvas.** The design is kept whole at its scale, and the stage grows to fill the canvas.
- **A portrait size applies while the canvas is taller than wide.** `portrait: { width, height }` gives it.
- **The safe part keeps clear of a notch.** `game.screen.safe` leaves out the page's safe-area insets, or the `insets` given.
- **Each change is told.** `game.onScreenChange` tells of it, so the game places its interface again instead of making the overlay again:

```js
const ui = await createWorld3DOverlay(canvas, { width: 1280, height: 720, portrait: { width: 720, height: 1280 }, fit: 'expand' });
const place = () => {
  const safe = ui.game.screen.safe;
  pause.x = safe.x + safe.width - 16 - pause.width;
  pause.y = safe.y + 16;
};
place();
ui.game.onScreenChange(place);
```

`portrait` and `insets` with `stretch`, `contain` or `cover` are refused with `WORLD3D_OVERLAY_OPTIONS_INVALID`.

`examples/world3d/verify-overlay.mjs` checks this in headless Chromium (SwiftShader WebGL2), with the insets of a notch given as `__egretAgent.insets`:

- **Sideways, 852 × 393.** The stage was 1560 × 720 and the overlay covered the 3D canvas. The safe part left out 59 CSS pixels at each side, and the pause button sat at its top right. A tap on the button stayed with the interface, and a tap on an empty part reached the 3D canvas.
- **Turned upright, 393 × 852.** The stage was 720 × 1560, `onScreenChange` told of it, and the button moved below the notch.

No phone, Safari, Firefox or WebGPU overlay was run.

A press or wheel over a 2D node with `touchEnabled` stays on the overlay. A press in an empty area and the rest of its drag go to the 3D canvas. A browser-native primary click goes to the scene only if it comes from a scene-owned press that also ended in an empty area. The forwarded event is a DOM copy. A drag from a 2D control into an empty area keeps its original ownership. Hover moves go where the interface is empty. `passThrough: false` keeps every event on the overlay. `ui.dispose()` ends the 2D game and removes the overlay. Windows mouse and Fold7 touch automation verified click routing and the drag control on both backends.

The 2D stage uses WebGL2 by default, so the 3D renderer keeps WebGPU for itself where it uses it. The two canvases are composited by the page; nothing is copied between them.

### Retain a static interface and measure startup

```js
const ui = await createWorld3DOverlay(canvas, {
  width: 800, height: 420, portrait: { width: 380, height: 680 },
  fit: 'expand', uiScale: { min: 44 / 48, max: 1.35 },
  renderMode: 'on-demand', webgl2PageBatching: 'single-page'
});
console.log(ui.getStartupTiming());
```

- The original default is continuous rendering. In on-demand mode the 2D clock, update, input and label maintenance continue every display step. The overlay retains its last submitted frame while its display revision, screen plan, retained layers and native generation are unchanged. Moving a projected 3D marker's display object draws again; use `ui.game.invalidate()` for presentation data outside the display tree. A refused draw stays dirty. No 3D draw is suppressed.
- `uiScale` bounds CSS pixels per logical unit for the filling fits: the overlay screen, safe rectangle, pointer and semantics follow the same native plan independently of 3D. See [screen fit](screen-fit.md). The multi-screen verifier reports native control hit rectangles and real semantic names when available; axis-aligned boxes are not pixel-level occlusion proof.
- `webgl2PageBatching: 'single-page'` draws consecutive compatible draws on one texture page together and splits the batch at another page. It omits the multi-page shader at startup and never compiles it later on that host, rather than moving startup work to the first interaction. The default remains `'multi-page'`, and the option applies only to WebGL2. Pixel resolution, composition, blend order and effects remain the same; a UI with many alternating pages may make more draw calls. `effects: false` separately opts out of effects if none are used; the overlay default is true.
- `ui.getStartupTiming()` reports milliseconds for placement, readiness and `game` phases (backend selection/module loading, host creation, engine open, game setup). `ui.game.getStartupTiming()` includes time to the first accepted SDK submission if one has occurred; this is not a GPU fence or display presentation. The WebGL2 observation separates context/capability checks, common program preparation, sampled, solid, resolve, effects, paged and finish startup phases in its successful generation. When parallelPrograms is true, programPreparationMs is the shared compile/link wait; subsequent per-program timings are retrieval and binding, not independent compile durations. Without the extension, sequential phases include the main branch's cooperative yields. A cold cached-vs-uncached browser is not the same experiment. Inspect both `game.loop.snapshot().steps` and `.frames` to distinguish application updates from submitted frames.

`node examples/world3d/verify-overlay.mjs <absolute Playwright index.mjs>` exercises the on-demand clock, first frame, visual mutation and explicit invalidation, rotation and native pointer ownership, and checks exact real WebGL2 readback equality for two alternating translucent pages in both batching policies. The software Chromium run matched all 768 RGBA bytes and made two versus five draw calls in that intentionally alternating sample. This is a functional and pixel test, not device FPS qualification.

## A performance readout

`createWorld3DStats(renderer, { container })` shows frame time, the game's own parts of a frame, and what the renderer drew: draw calls, triangles, lights dropped, programs, geometries and textures. Call `begin()` at the start of a frame, `lap(name)` after each part, and `end()` after drawing. Without `container` the numbers are still gathered, for automated checks.

## Limits

The app draws one scene through one camera at a time. A game with a second view or a picture-in-picture drives `World3DView` itself. A device that is lost is reported to `onDeviceLost`; making a new app is the way back.
