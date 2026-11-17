# One call for a game in a page

English | [简体中文](../../Cns/docs/browser-game.md)

`@egret/engine/web/game` starts a 2D game in a page with one call, and has a panel that shows what the game takes.

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

**An error's message ends with its cause.** What stops the loop is thrown where the console shows it, or given to `onError`. Its message reads from the outside in, `CLOCK_CALLBACK_FAILED: … Cause: DISPLAY_VALUE_INVALID: … Cause: RangeError: alpha was given 1.07`; the last part is the first thing that went wrong. `error.code` is the outermost code and `error.cause` the next error in.

For the rest of a game: `animate` moves and fades display objects in a chain (`import { animate } from '@egret/engine'`, then `animate(game.engine, game.scope, sprite).to({ x: 100, alpha: 0 }, 0.3, 'quadOut').start()`; see the [API reference](api-reference.md)), the [2D camera](camera-2d.md) follows, zooms and shakes, the [game kit](game-kit.md) has input actions, sound cues, random numbers and saves, [audio](audio.md) plays and mixes, [Graphics](graphics.md) draws shapes, and there are [particles](particles.md) and [2D physics](physics-2d.md).

## What the call makes

| Part | On the game | Made as |
| --- | --- | --- |
| A Host that draws | `game.backend` is `'webgpu'` or `'webgl2'` | `createSharedWebGPUHost` or `createSharedWebGL2Host`, with only the chosen one's module loaded |
| An Engine and its stage | `game.engine`, `game.stage` | `createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D)` |
| A scope for what the game creates | `game.scope` | `engine.createScope()` |
| Touch, mouse and pen on display objects | `game.pointer` | `createBrowserPointerInput`, see [pointer input](multi-pointer-input.md) |
| The keyboard | `game.keyboard` | `createBrowserKeyboardInput`, see [keyboard input](keyboard-focus-input.md) |
| The frame loop | `game.loop` | `createBrowserFrameLoop`, see [the frame loop](frame-loop.md) |
| The panel, if asked for | `game.stats` | `createBrowserStatsPanel`, below |

`await game.loadTexture(url)` loads a PNG image and gives the lease of its texture, for `new Bitmap(lease)` or `graphics.beginBitmapFill(lease)`; the lease belongs to `game.scope`, and one address loaded twice is one texture. Other formats are not read: use the [content build](content-build-pipeline.md) for them. `game.host` is the Host, for its status.

**Text.** `const label = await game.createLabel({ text: '金币 0', fontSize: 14, color: 0xf0c030, locale: 'zh' })` makes a line of text; add `label.display` to the stage and place it, then set `label.text` whenever the words change. The new words are drawn when they are ready and the old ones stay until then; `await label.ready` waits for them. Any number of labels may be made or changed together: they are drawn two at a time and the rest wait their turn, and a label whose words change while it is drawn draws the newest next. After `ready`, `label.display.width` and `.height` are the size of the words, so `label.display.x = centre - label.display.width / 2` centres them. The fonts are the page's own: a system family, or one the page has loaded. The first label loads the page's text rasterizer, so the import map needs `@egret/engine/text`, `@egret/engine/web/text` and `@egret/runtime/text`.

**Fitting the canvas.** With `fit`, the game sizes the canvas inside its element now and whenever that element changes size, centred. The element needs a size of its own: one that takes its height from the canvas has nothing to fit to. With `'cover'` the canvas is larger than the element, which should hide what overflows. The stage keeps its width and height in its own units in every mode, and pointer places follow the canvas.
 `game.frame` is the frame the loop draws, and `game.toStage(clientX, clientY)` turns a place on the page, as a pointer event of the page gives it, into a place on the stage.

## Options

| Option | Meaning | Without it |
| --- | --- | --- |
| `canvas` | The canvas to draw on. The page gives it its size on the screen | Required |
| `width`, `height` | The size of the stage in the game's own units: whole numbers above 0 | Required |
| `backend` | `'auto'`, `'webgpu'` or `'webgl2'` | `'auto'` |
| `pixelRatio` | Canvas pixels for each unit of the canvas's own width | The device's ratio, at most 2 |
| `clearColor`, `clearAlpha` | What a frame is cleared to | `0x000000` and 1 |
| `update(seconds)` | One step of the game, before each frame | No step |
| `onError(error)` | Told once of what stopped the loop | The failure is thrown where the console shows it |
| `pointer`, `keyboard` | `false` leaves that input out | Both are made |
| `stats` | `true` shows the panel | No panel |
| `fit`, `fitTo` | How the canvas fills an element: `'contain'` whole inside it, `'cover'` covering it, `'stretch'` to its shape. `fitTo` is that element | `'none'`, and the canvas's parent |
| `autoStart` | `false` leaves the loop for `game.loop.start()` to start | The loop starts at once |

What is not a valid option is refused with `BROWSER_GAME_OPTIONS_INVALID` before anything is made.

**How `'auto'` chooses.** WebGPU when the browser has `navigator.gpu` and gives an adapter; WebGL2 otherwise. The adapter is asked for before the canvas is touched, because a canvas holds one kind of context for good. If WebGPU is chosen and its device then fails, the call fails with the Host's own error: it does not fall back, since the canvas can no longer be given to WebGL2.

## The panel

```text
webgl2
fps 60.0  longest 17.1 ms
commands 6  triangles 12
geometries 0  pages 0
pending 0  drawn 1204  skipped 3
```

| Line | Shows |
| --- | --- |
| `fps`, `longest` | Frames of the display a second, and the longest time between two of them, since the text last changed |
| `commands`, `triangles` | What the last drawn frame holds: its draw commands and the triangles they draw. A rectangle or an image is two triangles |
| `geometries`, `pages` | The different mesh geometries and the different images of that frame |
| `pending` | Frames the Host holds that it has not finished |
| `drawn`, `skipped` | Frames the loop has drawn, and frames it skipped because the Host held two |

- **Commands are not draw calls.** A Host joins commands that follow each other on one image and one material into one draw. The panel shows what the Engine asked for, not how many draws the Host made of it.
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
