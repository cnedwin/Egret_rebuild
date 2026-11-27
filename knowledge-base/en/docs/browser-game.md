# One call for a game in a page

English | [简体中文](../../Cns/docs/browser-game.md)

`@egret/engine/web/game` starts a 2D game in a page with one call, and has a panel that shows what the game takes. For a whole small game, with input, sound, text and timers ready to use, start at [`play`](play.md), which is built on this entry.

The initial [starter example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.md) ran on software WebGL2 in headless Chromium. Node covers option handling and the statistics panel. The browser checks cover drawing, clicks, keys, taps, image loading and WebGL2 fallback when WebGPU or its adapter is unavailable.

[Starter and Graphics hardware results](starter-graphics-hardware.md) records the later Windows and Android checks and measurements.

## Use

```js
import { Sprite } from '@egret/engine';
import { createBrowserGame } from '@egret/engine/web/game';

const game = await createBrowserGame({
  canvas: document.querySelector('canvas'),
  width: 480, height: 270,          // the stage, in the game's own units
  update(seconds) { hero.x += 60 * seconds; },
});
const hero = game.stage.addChild(game.scope.use(new Sprite()));
hero.graphics.beginFill(0x4a7bd0).drawRect(0, 0, 24, 24).endFill();
```

That is a whole game: the square moves. `await game.dispose()` ends it.

## Three things to know first

**The loop starts when the call returns.** `update` is called on the next frame after `createBrowserGame` resolves, and on every frame after it, whatever the code below the call is still waiting for. A game that goes on to `await` its labels or sounds has `update` running meanwhile: a `let` or `const` declared further down is not there yet (`Cannot access 'state' before initialization`), and that error stops the loop. Make everything `update` reads before the first later `await`, or start the loop yourself when the setup is done:

```js
const game = await createBrowserGame({ canvas, width: 480, height: 270, autoStart: false, update });
const score = await game.createLabel({ text: '0' });   // update is not running yet
const state = { score: 0 };
game.loop.start();
```

**What the engine gives back is closed.** `game`, a label, input actions and the other objects the engine returns are frozen: `label.centre = () => …` throws `Cannot add property centre, object is not extensible`. Keep your own data in an object of your own beside them, such as `{ label, anchorX: 0.5 }`.

**An error's message ends with its cause.** What stops the loop is thrown where the console shows it, or given to `onError`. Its message reads from the outside in, `CLOCK_CALLBACK_FAILED: … Cause: DISPLAY_VALUE_INVALID: … Cause: RangeError: x was given NaN`; the last part is the first thing that went wrong. `error.code` is the outermost code and `error.cause` the next error in.

For the rest of a game: `animate` moves and fades display objects in a chain (`import { animate } from '@egret/engine'`, then `animate(game.engine, game.scope, sprite).to({ x: 100, alpha: 0 }, 0.3, 'quadOut').start()`; see the [API reference](api-reference.md)), the [2D camera](camera-2d.md) follows, zooms and shakes, the [game kit](game-kit.md) has input actions, sound cues, random numbers and saves, [audio](audio.md) plays and mixes, [Graphics](graphics.md) draws shapes, and there are [particles](particles.md) and [2D physics](physics-2d.md).

## What the call makes

| Part | On the game | Made as |
| --- | --- | --- |
| A Host that draws | `game.backend` is `'webgpu'` or `'webgl2'` | `createSharedWebGPUHost` or `createSharedWebGL2Host`, with only the chosen one's module loaded |
| An Engine and its stage | `game.engine`, `game.stage` | `createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D)` |
| A scope for what the game creates | `game.scope` | `engine.createScope()` |
| Touch, mouse and pen on display objects | `game.pointer` | `createBrowserPointerInput`, see [pointer input](multi-pointer-input.md) |
| The keyboard | `game.keyboard` | `createBrowserKeyboardInput`, see [keyboard input](keyboard-focus-input.md) |
| Hover and the mouse wheel, if asked for | `game.hover` | `createBrowserHoverInput`, see [hover input](pointer-hover.md); a scroll control's `wheel` takes it |
| The frame loop | `game.loop` | `createBrowserFrameLoop`, see [the frame loop](frame-loop.md) |
| The panel, if asked for | `game.stats` | `createBrowserStatsPanel`, below |

`await game.loadTexture(url)` loads a PNG image and gives the lease of its texture, for `new Bitmap(lease)` or `graphics.beginBitmapFill(lease)`; the lease belongs to `game.scope`, and one address loaded twice is one texture. Other formats are not read: use the [content build](content-build-pipeline.md) for them. `game.host` is the Host, for its status.

**Textures painted in code.** `await game.textureFromCanvas(canvas)` gives the lease of a texture of what a canvas holds now — a particle dot, a splinter, a page of a bitmap font painted at start — and `await game.textureFromPixels(width, height, pixels)` one of RGBA bytes, rows from the top, alpha not multiplied in, as `ImageData` holds them. Each call is a texture of its own, its lease belongs to `game.scope`, and ending the lease ends the texture. A canvas drawn by WebGL is copied through a 2D canvas. At most 4,096 pixels on an edge and 4,194,304 in all; [`textureFromCanvas` of `@egret/engine/web/kit`](browser-images.md) scales larger pictures down and gives a bare texture instead of a lease.

**Text.** `const label = await game.createLabel({ text: '金币 0', fontSize: 14, color: 0xf0c030, locale: 'zh' })` makes a line of text; add `label.display` to the stage and place it, then set `label.text` whenever the words change. The new words are drawn when they are ready and the old ones stay until then; `await label.ready` waits for them. Any number of labels may be made or changed together: they are drawn two at a time and the rest wait their turn, and a label whose words change while it is drawn draws the newest next. After `ready`, `label.display.width` and `.height` are the size of the words, so `label.display.x = centre - label.display.width / 2` centres them. The fonts are the page's own: a system family, or one the page has loaded. A label is owned by `game.scope` unless `scope` names another: `game.createLabel({ text: 'Sound', scope: context.scope })` inside the `prepare` of a UI leaf's content makes a label the leaf can hold, which ends with that scope. The first label loads the page's text rasterizer, so the import map needs `@egret/engine/text`, `@egret/engine/web/text` and `@egret/runtime/text`.

**Many short labels.** Each label of `createLabel` is a texture of its own and holds a place in the text cache while it is shown. The cache holds at most 64 different texts and 128 labels, and a frame draws from at most 64 different images. A board of fifty word tags and a scene passes those limits. `await game.createAtlasLabel({ text: '仵作' })` takes the same options and is placed the same way: `label.display` is a sprite, `label.bounds` the box of the words (`label.display.x = centre - label.bounds.width / 2`), and `text`, `set`, `ready`, `setRasterActive` and `dispose` are as above. Its words are drawn by the same cache, copied onto a page shared with the words drawn with them, and the cache's place is given back at once. On November 26, 2026, in headless Chromium, 100 different texts of two characters were all drawn from one page; with labels of `createLabel` 13 of them were not drawn, and nothing said so. `game.text` of [play](play.md) draws its words this way. When the shared pages number 16, every label's words are packed again onto as few as hold them. A page is made once the labels drawn together have given their words, or after a quarter of a second.

**Labels end with their display.** A label whose `display` is disposed, or taken off a parent that is then disposed, is ended at the next frame: its place in the text cache is given back. A display owned by another scope than its parent is taken off, not disposed, when the parent is disposed; that is the case this covers. `game.getLabelStatus()` ends such labels before it counts. After 500 labels under one parent were removed, the cache held no label's place, only the 31 rasters it keeps for reuse.

**A frame's images.** A frame draws from at most 64 different images, 4,096 rectangles of them and 64 MiB. `game.getFrameUsage()` gives what the last frame drew from: `pages`, `regions`, `imageBytes`, the `limits`, and `refusedFrames`. A frame that holds more is not drawn, and the loop goes on: the last frame stays on the screen until one fits. With `onWarning`, the game is told when a frame comes within a fifth of a limit (`FRAME_IMAGES_NEAR_LIMIT`) and when a frame is not drawn (`FRAME_IMAGE_BUDGET`). It is also told when labels hold four fifths of the text cache (`LABEL_CACHE_NEAR_LIMIT`) and when a label's words could not be drawn (`LABEL_NOT_DRAWN`). `play` also tells `PLAY_MADE_EVERY_FRAME` when its `update` made a text, a shape or a sprite in each of the last 60 frames, which should be made once and changed. Each warning is told when it begins, not on every frame, and the engine writes nothing to the console. `game.drawFrame(frame)` draws a frame this way for a loop of the game's own.

**Warnings for a tool.** A page whose `globalThis.__egretAgent` has a `warning(warning)` function is told every warning as well, whether or not the game gave `onWarning`. `tools/verify-game.mjs` puts one there before the game starts and lists what it was told as `engineWarnings` in its report, so an agent sees a frame near its limit, or text made every frame, that the game itself never asked to hear about. What that function throws is the tool's own and is not told.

**Insets and controls for a tool.** A page whose `globalThis.__egretAgent` has `insets` (`{ top, right, bottom, left }`, in CSS pixels of the window) has its game take them as the window's safe-area insets in place of the page's own, unless the game gave `insets`. A headless browser has no notch; `tools/verify-screens.mjs` stands in for one this way. A `play` game also calls the object's `controls(controls, { safe, canvas })`, about four times a second, with each node it takes taps on that is shown: its name and its rectangle on the page in CSS pixels. A node over the whole canvas, such as a modal view's backdrop, is left out, and so is each node it is drawn over. `safe` and `canvas` are rectangles of the page too. What either function throws is the tool's own.

**Fitting the canvas.** With `fit`, the game sizes the canvas inside its element now and whenever that element changes size, centred. The element needs a size of its own: one that takes its height from the canvas has nothing to fit to. With `'cover'` the canvas is larger than the element, which should hide what overflows. With `'cover'` and `'stretch'` the stage keeps its width and height in its own units. With `'contain'`, `'expand'` and the fixed modes of Egret 5 it follows [the plan of the screen](screen-fit.md): `game.screen` is the plan now, `game.onScreenChange(listener)` tells of a new one, and the stage takes the portrait size or, with `'expand'` and the fixed modes, fills the element. With `wholeScale: true` each unit is a whole number of device pixels, for pixel art. Pointer places follow the canvas in every mode.
 `game.frame` is the frame the loop draws, and `game.toStage(clientX, clientY)` turns a place on the page, as a pointer event of the page gives it, into a place on the stage.

**Touch targets.** A finger needs about 44 CSS pixels. `game.unitsPerCssPixel` is how many stage units one CSS pixel is as the canvas is shown now, and `game.padHitArea(node, cssPixels = 44)` gives a node a hit area at least that size, centred on what it draws and never smaller, so a 20-unit icon on a scaled-down phone canvas is still easy to press. The target includes the requested CSS square under ancestor scaling, reflection or rotation. Call it again after changing node or ancestor transforms, the drawn bounds, or the canvas size. A collapsed transform has no two-dimensional hit area on screen.

## Options

| Option | Meaning | Without it |
| --- | --- | --- |
| `canvas` | The canvas to draw on. The page gives it its size on the screen | Required |
| `width`, `height` | The size of the stage in the game's own units: whole numbers above 0 | Required |
| `backend` | `'auto'`, `'webgpu'` or `'webgl2'` | `'auto'` |
| `pixelRatio` | Canvas pixels for each unit of the canvas's own width | The device's ratio, at most 2; 1 with `wholeScale`, which takes no other |
| `clearColor`, `clearAlpha` | What a frame is cleared to | `0x000000` and 1 |
| `update(seconds)` | One step of the game, before each frame | No step |
| `onWarning(warning)` | Told of a frame near its limit of images, a frame not drawn for holding more, labels near the limit of the text cache, and words not drawn: `{ code, message, usage?, cause? }` | Not told |
| `onError(error)` | Told of what stopped the loop, and of an error the Engine can only report, such as a listener of a tap that threw and so ended pointer input | The failure is thrown, or reported to the page, where the console shows it |
| `pointer`, `keyboard` | `false` leaves that input out | Both are made |
| `hover` | `true` makes hover and wheel input, as `game.hover`; its module is loaded only then | No hover input |
| `stats` | `true` shows the panel | No panel |
| `fit`, `fitTo` | How the canvas fills an element: `'contain'` whole inside it, `'cover'` covering it, `'stretch'` to its shape, `'expand'` filling it with a stage that grows around the design, or as Egret 5's `'fixedWidth'`, `'fixedHeight'`, `'fixedNarrow'` and `'fixedWide'`. `fitTo` is that element | `'none'`, and the canvas's parent |
| `portrait`, `insets` | With a fit other than `'none'`, `'cover'` and `'stretch'`: the stage's size while the element is taller than wide, and what covers its edges in CSS pixels. See [Fitting a stage to a screen](screen-fit.md) | `width` × `height`, and the page's `safe-area-inset` values |
| `wholeScale` | With the same fits: a unit is a whole number of device pixels, the canvas is drawn at a pixel a unit and enlarged sharply, and the rest is bars | `false` |
| `autoStart` | `false` leaves the loop for `game.loop.start()` to start | The loop starts at once |

What is not a valid option is refused with `BROWSER_GAME_OPTIONS_INVALID` before anything is made.

**How `'auto'` chooses.** WebGPU when the browser has `navigator.gpu` and gives an adapter; WebGL2 otherwise. The adapter is asked for before the canvas is touched, because a canvas holds one kind of context for good. If WebGPU is chosen and its device then fails, the call fails with the Host's own error: it does not fall back, since the canvas can no longer be given to WebGL2. Where there is no adapter (a headless browser, for one), the browser itself may write "No available adapters." to the console while it is asked; the page did nothing wrong. A check that fails on any console error should give `backend: 'webgl2'`.

## The panel

```text
webgl2
fps 60.0  longest 17.1 ms
commands 6  draws 2  triangles 12
geometries 0  pages 0
pending 0  drawn 1204  skipped 3
```

| Line | Shows |
| --- | --- |
| `fps`, `longest` | Frames of the display a second, and the longest time between two of them, since the text last changed |
| `commands`, `triangles` | What the last drawn frame holds: its draw commands and the triangles they draw. A rectangle or an image is two triangles |
| `draws` | The draw calls the Host made for its last frame, from `host.getFrameDrawCalls()`: its batches, a pass for each effect and one to copy the frame to the canvas. Batching makes it smaller than `commands` |
| `geometries`, `pages` | The different mesh geometries and the different images of that frame |
| `pending` | Frames the Host holds that it has not finished |
| `drawn`, `skipped` | Frames the loop has drawn, and frames it skipped because the Host held two |

- **Commands are not draw calls.** A Host joins commands that follow each other on one image and one material into one draw. `commands` is what the Engine asked for; `draws` is how many draws the Host made of it.
- The text changes twice a second. The panel lies over the top left corner of the canvas and does not take the pointer: what is under it is still pressed.
- `game.stats.snapshot()` gives the same numbers to a program.

Without `createBrowserGame`, make the panel and tell it once for each frame of the display:

```js
import { createBrowserStatsPanel } from '@egret/engine/web/game';
const panel = createBrowserStatsPanel({ canvas, label: 'my game' });
// in the game's step:
panel.sample({ frame: lastDrawnFrame, pendingFrames: host.getStatus().pendingFrames, ...loop.snapshot() });
```

## When a game outgrows it

Everything the call makes is what the separate entries make. A game that needs a Host with its own limits, readback, several scopes, or a loop of its own makes those itself, as [what to import](entry-points.md) lists them, and does not use this entry. Nothing else in the Engine depends on it.

In a page without a bundler, the import map needs `@egret/engine/web/game` and what it loads: copy the map of the [starter](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/index.html).

## Retained GPU backgrounds (WebGL2, opt-in)

Pass `staticLayers: true` to `createBrowserGame` or `play`. The actual WebGL2 game exposes `game.staticLayers` (under `game.browser.staticLayers` in Play). It is absent on WebGPU and without the option; keep the ordinary painter as a fallback. This uses the WebGL2 Host's real [cached layer targets](webgl2-executor-contract.md#cached-2d-layers), not a CPU canvas or a texture upload for each placement.

Use an Engine capture of a chunk or a static draw group, with transparent clear and no dynamic actors. The Host only accepts its documented layer recipe. For example, during initial setup with an isolated background on the stage:

```js
const cache = game.browser.staticLayers; // Play with backend: 'webgl2', staticLayers: true
if (cache) {
  const layer = cache.createLayer();
  const source = game.engine.captureSharedFrame({
    width: 128, height: 64, clearColor: 0, clearAlpha: 0,
    outputAlpha: 'premultiplied'
  });
  await layer.update(source);
  // Only after readiness: detach the source's display nodes from the live stage.
  game.world.removeChild(backgroundSource);
  cache.setPlacements([{ layer, x: 0, y: 0, width: 128, height: 64 }]);
}
```

The layers are composited in the array's painter order **before all ordinary stage draws**, at stage coordinates. Keep actors, interleaved occluders, UI and hit targets in the ordinary display tree. The cached layer is not a touch object and does not automatically follow camera/world transforms. On a camera move update only the placements. When a chunk changes, rebake that chunk using a new genuine capture, await `layer.update`, then reapply `setPlacements` (even if the positions stayed the same). A replacement retains the old ready texture until completion. Setting placements copies coordinates/effects, validates ready handles created by this cache, and wakes on-demand Play. See the Host contract for effect, blend, clipping, extent, placement and memory limits. An effect requires the game's effects option.

Before disposal, clear a layer from placements. On native context loss the layer becomes stale: clear or replace the placements, await `cache.whenReady()` and rebake from the retained source recipe before placing it again. The game closes its Host and all its retained layers. No automatic display-tree snapshotting, arbitrary z-interleaving, partial framebuffer redraw or WebGPU layer support is claimed by this bridge.

The public fixture `node tools/verify-play-static-layers.mjs <playwright-root> <chrome> <new-output>` compares initial, moved and edited cached pixels against direct rendering. The controlled browser game test also compares ordinary frame commands and upload bytes. These are scoped acceptance checks, not a phone frame-rate claim.
