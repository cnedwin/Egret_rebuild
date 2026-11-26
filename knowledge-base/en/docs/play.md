# Play: a whole small game from one call

English | [简体中文](../../Cns/docs/play.md)

`@egret/engine/play` is where a game starts. One call makes the canvas, fits it to the page and runs the loop, and the game it gives back has the parts most games write for themselves: keys and a pointer to ask each frame, sound effects made in code, overlap tests, timers, text, tweens, bursts of particles, a shake, a flash and a hit stop. A game needs no image, sound or font file.

It is built from the public entries ([the browser game](browser-game.md), [audio](audio.md), [the game kit](game-kit.md), [Graphics](graphics.md)), which stay there for what it does not cover.

**What is checked.** Options, the sound effect recipes and their samples are checked in Node. In headless Chromium on software WebGL2, the game below started, drew, took keys and the pointer, broke bricks, played its effects and showed its centred text. That original full-game run did not cover hardware GPUs.

On November 18, 2026, the contract repairs based on main `ec17a5a2` passed on Windows Edge 157.0.4341.60 / RTX 5090 Laptop and Galaxy Z Fold7 / Android 17 / Chrome 157.0.8103.78 / Adreno 830, each with explicit WebGPU and WebGL2 and no software fallback. OS samples showed Edge in the foreground during capture; the phone stayed awake and unlocked during capture. Protocol mouse/touch on the actual devices changed the centre pixel from RGBA `255,32,64,255` to `32,255,96,255` on all four combinations. Pause, zero scale, half/eight-times scale, hit-stop, callback pause, loop stop/start and callback disposal passed in bounded public-SDK fixtures. Pending timers survived loop restart, and no chained callback ran after disposal. This does not qualify the complete games, audio audibility or performance.

## A game

```js
import { play } from '@egret/engine/play';

const W = 480, H = 320;
let paddle, ball, bricks = [], score = 0, label, vx = 150, vy = -180;

await play({
  width: W, height: H, background: 0x101828,
  setup(game) {
    paddle = game.rect(W / 2, H - 20, 70, 10, 0x8fa8ff);
    ball = game.circle(W / 2, H - 60, 6, 0xffffff);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        bricks.push(game.rect(40 + c * 57, 40 + r * 20, 50, 14, [0xff4d6d, 0xffa64d, 0xffe14d, 0x7be069][r]));
    label = game.text('Score 0', { x: W / 2, y: 6, size: 18, align: 'center' });
  },
  update(dt, game) {
    paddle.x += game.keys.axis().x * 300 * dt;
    if (game.pointer.down) paddle.x = game.pointer.x;
    ball.x += vx * dt;
    ball.y += vy * dt;
    if (ball.x < 6 || ball.x > W - 6) { vx = -vx; game.sfx.play('bounce'); }
    if (ball.y < 6) { vy = -vy; game.sfx.play('bounce'); }
    if (vy > 0 && game.overlaps(ball, paddle)) { vy = -vy; game.sfx.play('jump'); }
    const hit = game.hits(ball, bricks);
    if (hit) {
      bricks = bricks.filter(brick => brick !== hit);
      game.burst(hit.x, hit.y, { color: 0xffe14d });
      game.remove(hit);
      vy = -vy;
      label.text = 'Score ' + (score += 10);
      game.sfx.play('coin');
      game.shake(4, 0.15);
    }
    if (ball.y > H) { ball.y = H - 60; vy = -180; game.flash(0xff2040); game.sfx.play('hurt'); }
  },
});
```

That is the whole game. `setup` builds it; `update` runs once a frame with the seconds since the last one. `update` is not called until `setup` has returned, or the promise it returns has resolved, so everything `setup` makes is there.

## Options

| Option | Meaning | Without it |
| --- | --- | --- |
| `width`, `height` | The size of the stage in the game's own units: whole numbers above 0. The canvas is scaled to fit and keeps this shape | Required |
| `background` | The colour a frame is cleared to | Black |
| `transparent` | `true` clears a frame to nothing, so what the page has under the canvas shows through | The background is drawn |
| `audio` | Enable the built-in effects and music. Set `false` for a silent game or a game with its own mixer | `true` |
| `setup(game)` | Builds the game; may be `async` | Nothing is built |
| `update(seconds, game)` | One step of the game | No step |
| `parent` | An element to put the canvas in. It fills the element's width; an element with no height of its own takes the stage's shape | The game fills the window |
| `canvas` | A canvas of the page to draw on, left where it is | One is made |
| `onError(error)` | Told of what stopped the game | It is thrown where the console shows it |
| `onWarning(warning)` | Told of a frame near its limit of images, a frame not drawn for holding more, words not drawn, and text, shapes or sprites that `update` made in each of the last 60 frames (`PLAY_MADE_EVERY_FRAME`); see [the browser game](browser-game.md) | Not told |
| `seed` | The seed of `game.random` | A new one each time |
| `saveKey` | The name `game.save` keeps its values under | The page's path |
| `semantics` | A tree from `createUiSemantics` of `@egret/engine/ui/semantics`: views of `game.show` add their named parts to it, and it is published at the end of every frame, for a [UI tester](ui-testing.md) and for assistive technology | No tree |
| `backend` | `'auto'`, `'webgpu'` or `'webgl2'` | `'auto'` |
| `pixelRatio` | Positive multiplier for the 2D drawing buffer. The stage, layout, input and semantic bounds use the same logical units at every density | Browser device pixel ratio, capped at 2 |
| `blendSpace` | How translucent things mix: `'srgb'` as a 2D canvas and Egret 5 do, so white at 10% over a dark ground is a faint white; `'linear'` mixes light, and the same white looks stronger | `'srgb'` |
| `fit` | `'expand'` fills the window: the same scale, and the stage reaches past `width` × `height` to the edges. See [Screens of any shape](#screens-of-any-shape) | `'contain'`: bars where the window has another shape |
| `portrait` | `{ width, height }`: the stage while the window is taller than wide | `width` × `height` either way |
| `insets` | `{ top, right, bottom, left }` in CSS pixels: what a notch, rounded corners or a home bar cover | The page's `safe-area-inset` values |
| `arrange(game)` | Places what depends on the screen: called after `setup` and whenever the window changes size or turns | Nothing moves |

Options that cannot make a game are refused with `PLAY_OPTIONS_INVALID`; the message ends with which one.

## Retaining a static 2D frame

```js
const game = await play({ width: 1280, height: 800, renderMode: 'on-demand', setup });
game.invalidate();
```

On-demand drawing retains the last submitted frame when the display tree and canvas are unchanged. Mouse, touch and keyboard input and canvas resizing request a fresh draw. Asynchronous images and prepared text appear when ready. Call `game.invalidate()` when a source outside the display tree changes. The clock, input and the application's `update` run at the normal cadence. A moving sprite or a tween draws as it changes. Continuous drawing is the default for `play` and remains the drawing mode for `play3d`.

Build the workspace and run `node examples/play/verify-demand-render.mjs <Playwright index.mjs> <new output.json> [webgl2|webgpu] [Chromium executable] [software|hardware]`. The fixture measures submitted frames and checks input, resize, asynchronous resources, text and tween pause and resume.

On Windows Chrome for Testing 157.0.8103.6, with a 1280 × 800 browser viewport and a 640 × 400 design, the fixture recorded 31 submissions in a 30-interval idle window with continuous drawing and zero in on-demand mode. Both windows had 31 engine steps. This held on SwiftShader WebGL2 and the NVIDIA Blackwell WebGPU adapter. Mouse, touch, Space, resize, explicit redraw, texture readiness and text readiness each brought back drawing. A paused tween produced zero submissions and resumed to its target. The synthetic software WebGL2 idle P95 was 4.2 ms in both modes. The title-screen workload of an external game, phone browsers and software WebGPU performance require separate measurements.

## Screens of any shape

A phone is held either way, a window is any shape, and a notch or a home bar covers part of the screen. Three rules cover these, the same for every game:

1. **The design is always whole.** `width` × `height` is shown at the scale that fits it, whatever the window's shape. With `fit: 'expand'` the stage then reaches to the window's edges, so a wider phone shows more of the stage at the sides rather than bars; `(0, 0)` stays the design's corner, so a game laid out for its size stays in the middle.
2. **A portrait size for a tall window.** With `portrait: { width: 1080, height: 1920 }` beside `width: 1920, height: 1080`, the stage takes the portrait size while the window is taller than wide. The two share their short side, so a button is as large on the screen held either way.
3. **Edges come from the safe part.** `game.screen` is what the window shows and `game.safe` the part of it nothing covers, both in the game's units. What belongs at an edge (a score, a pause button, a stick) is placed from `game.safe` in `arrange`, which is called after `setup` and again whenever the window changes size, the phone turns or the safe part moves.

```js
const game = await play({
  width: 1920, height: 1080, portrait: { width: 1080, height: 1920 }, fit: 'expand',
  setup(g) {
    score = g.text('0', { size: 48 });
    pause = g.button('II', { x: 0, y: 0, width: 96, height: 96 }, () => g.pause());
  },
  arrange(g) {
    score.x = g.safe.x + 32; score.y = g.safe.y + 24;
    pause.x = g.safe.x + g.safe.width - 64; pause.y = g.safe.y + 64;
  }
});
```

`game.orientation` is `'portrait'` or `'landscape'`, and `game.width` and `game.height` are the design that applies now. Boxes of words, menus, notices and the touch stick are placed in `game.safe` on their own. A page gives `safe-area-inset` values only when its viewport meta tag says `viewport-fit=cover`; `insets` gives them where a page or a host knows better. [Fitting a stage to a screen](screen-fit.md) has the arithmetic, for a game that fits its own stage.

## Embedding a game alongside page controls

Pass `parent` or a page-owned `canvas` to give the game its own keyboard focus. Click the canvas or Tab to it to play. Tab and Shift+Tab continue through the page, and a focused HTML button gets its normal Space or Enter activation. Leaving the canvas releases held keyboard keys, even if the key is released later over another element. When neither option is supplied, the game keeps its window-wide keyboard shortcuts, including Tab.

An embedded canvas with no `tabindex` gets `0` while the game is open. An explicit value such as `-1` is respected. For a decorative stage whose interaction is entirely in HTML, mark its container `inert`. With `transparent: true`, both the rendered surface and the engine-created holder let the page show through. A caller-provided canvas keeps its own styles.

For a fixed-ratio game, use `fit: 'contain'` and pass the logical stage width and height to `createBrowserSemantics({ semantics, canvas: game.canvas, width, height })` from `@egret/engine/web/semantics`. The projection measures the fitted canvas inside the letterbox. Positive axis-aligned CSS scaling and translation on its ancestors are supported. Call `projection.sync()` after changing an ancestor’s CSS transform without resizing it. Rotated, skewed, reflected and perspective surfaces are refused.

Run `pnpm example:browser --port 4173` and open `/examples/play/index.html?game=semantic-letterbox` on the local server for the fixed-ratio workshop example in `examples/play/semantic-letterbox.mjs`. The sample uses a 640 × 360 stage and a 480 × 270 drawing buffer. In `play3d`, `pixelRatio` controls the foreground UI. The 3D background uses its own quality settings.

## Drawing

| Call | Gives |
| --- | --- |
| `game.rect(x, y, width, height, color, layer?)` | A filled rectangle whose **middle** is at (x, y) |
| `game.circle(x, y, radius, color, layer?)` | A filled circle whose middle is at (x, y) |
| `game.sprite(g => …)` | A sprite with what the function draws: `g` is its [Graphics](graphics.md), as in `g.beginFill(0xff0000).drawRoundRect(-20, -10, 40, 20, 6).endFill()` |
| `game.text(words, { x, y, size, color, align, bold })` | A line of text; see below |
| `game.button(words, { x, y, width, height, color }, onTap)` | A button in the `ui` layer, its middle at (x, y), with its words centred on it; `button.label.text` changes them |
| `game.remove(sprite)` | Takes it, and what is in it, off the stage at once and ends it when the update is over. Removing it twice does nothing |
| `game.toFront(sprite)` | Puts it in front of the others of its layer |

Each gives a sprite. Set `x`, `y`, `rotation` (degrees, clockwise), `scaleX`, `scaleY`, `alpha` (0 to 1) and `visible` on it at any time, read its `width` and `height`, and add properties of your own (`enemy.hp = 3`). A colour is a number, `0xRRGGBB`. A removed sprite may still be set until the update it was removed in is over, so a loop that still holds it does not fail; after that, setting it throws `OBJECT_DISPOSED`, and `sprite.isDisposed` is true.

A sprite turns and scales about its own origin: the middle of a `rect` or a `circle`, and the point (0, 0) of what a `game.sprite` draws. So a card flips about its middle by tweening `scaleX` to 0 and back. Sprites are drawn in the order they were made, later ones in front. To change what a sprite looks like, draw it again: `sprite.graphics.clear().beginFill(0x00ff00).drawRect(-10, -10, 20, 20).endFill()`.

`game.world` is the layer these are drawn in. `game.ui` is a layer over it that stays put; pass it as the last argument, as in `game.rect(240, 20, 480, 40, 0x000000, game.ui)`, for a bar or a panel. Any sprite can be given as the layer: what is made in it moves, turns, fades and is removed with it. `game.view.x` and `game.view.y` say which part of the world is seen, so a level wider than the stage scrolls by `game.view.x = hero.x - game.width / 2`.

**Text.** `const score = game.text('Score 0', { x: 240, y: 8, align: 'center' })` is drawn in the `ui` layer and can be used at once; set `score.text = 'Score ' + n` (a number is taken as it is) whenever it changes. `align` says which part of the words `x` is: `'left'`, `'center'` or `'right'`. `size` is 24 and `color` white unless given; `score.color` and `score.size` change them later. `y` is the top of the words, or their middle with `baseline: 'middle'`. A `\n` in the words starts a new line. `{ layer: 'world' }` puts a text in the world, as for a number that floats up from a hit, and `{ layer: tile, align: 'center', baseline: 'middle' }` puts it on a sprite, at the sprite's origin, to move with it. A text is a sprite, so it can be moved, faded, tweened and removed like one. The letters are the page's own fonts, which have Chinese, Japanese and Korean where the device does. The words of all texts are drawn on a few shared pages, so a hundred short texts on one screen are within what a frame may hold. `{ vertical: true }` writes the words top to bottom, in columns from right to left, for a title or a seal. Marks such as `，。（）《》「」` turn to their upright forms, a `\n` starts a new column, and `{ vertical: { column: 4 } }` puts at most four characters in a column. `align` and `baseline` place the whole block, and `text` stays the words as given. This is the simple form: one character under another, in straight columns for Chinese and Japanese, whose characters are of one width. Latin letters stand upright and are not turned, and a paragraph does not yet lay out vertical text or give its columns' geometry. `verticalPlayWords(words, column)` gives the rows the text draws.

## Input

| Ask | Answer |
| --- | --- |
| `game.keys.down('left', 'a')` | Whether any of these keys is held |
| `game.keys.pressed('space')` | Whether it went down since the last update |
| `game.keys.released('space')` | Whether it came up since the last update |
| `game.keys.axis()` | The arrows and WASD as `{ x, y }`, each from -1 to 1, y down, of length 1 at most; a gamepad's left stick counts as well |
| `game.keys.look()` | A gamepad's right stick as `{ x, y }`, for looking or aiming; 0 and 0 without a pad |
| `game.pointer.x`, `.y` | Where the mouse or finger is, in the game's units (those of the `ui` layer); it follows the mouse with no button held |
| `game.toStage(x, y)`, `game.fromStage(x, y)` | A place in the game's units as a place on the stage, as `localToGlobal`, `globalToLocal` and hover events give it, and back. With `fit: 'expand'` they differ by where the design is on the stage: on a 390 × 844 phone, a 720 × 1280 design starts 139 units down |
| `game.pointer.down`, `.pressed`, `.released` | Whether a button or finger is down, went down, or came up |
| `game.pointer.swipe` | `'left'`, `'right'`, `'up'` or `'down'` in the update after a swipe ends |
| `game.pointer.over(sprite)` | Whether the pointer is over what the sprite draws |
| `game.pointer.dx`, `.dy` | How far the mouse moved since the last update, in pixels of the screen, also while it is locked |
| `game.pointer.wheel` | The turns of the mouse wheel since the last update, above 0 towards the player. The page does not scroll under the game |
| `game.pointer.lock()`, `.unlock()`, `.locked` | Hides the cursor and keeps the mouse to the game, for a first-person view. A browser allows it only after a click, so call it from a tap or when `pressed` is true; Escape gives the mouse back |
| `game.onTap(sprite, () => …, { name })` | Calls the function when the sprite is tapped or clicked. Where sprites overlap, the one in front gets the tap. A sprite with children and no `hitArea` of its own is hit anywhere in its bounds, its children included, as they move; one that draws itself and has no children is hit on what it draws. With `name`, the sprite is also a button of that name in `semantics`, where it is drawn, left out while it is hidden, gone with it; activating it there taps it. The function may be `async`; what it throws, at once or later, stops the game as what `update` throws does |
| `game.gestures(sprite, { hold, doubleTap, drag, swipe, pinch })` | A long press, a double tap, a drag with its steps, a swipe and a two-finger pinch on the sprite, each told once, in game units; returns a function that stops them. A press that became a drag or a long press is no tap. A sprite with children and no `hitArea` is hit in its bounds, as for `onTap`. [Gestures](gestures.md) has the thresholds |
| `game.show(description, { state, bind })` | A screen described as data: panels, rows and columns of texts, buttons, bars and toggles, placed in `game.safe` and again when the screen changes, with portrait parts for a phone held upright. `bind` keeps named parts to `state`, read every frame, and answers presses. Returns the view: `get(name)`, `rect(name)`, `show()`, `hide()`, `close()`. [Screens as data](ui-views.md) has the parts and the bindings |
| `game.confirm(question, { yes, no })`, `game.hints(list)`, `game.loading(tasks)`, `game.badges`, `game.compact(n)`, `game.request(send)`, `game.device` | A question answered yes or no, a bar naming keys in the words of the player's device, counted loading, red dots that add up, short numbers (12.3K, 1.2万) and a request a button cannot send twice. See [Parts most screens need](ui-views.md#parts-most-screens-need) |
| `game.dragAndDrop()` | `.source(sprite, { data, ghost })` and `.target(sprite, { drop, accepts, hover })`, each returning its removal, and `.dragging`. The dragged sprite stays put while the picture `ghost` makes follows the finger over everything; the innermost target that accepts the data takes it |

A key is `'left'`, `'right'`, `'up'`, `'down'`, `'space'`, `'enter'`, `'escape'`, `'shift'`, a letter, a digit, or a `KeyboardEvent.code` such as `'KeyQ'`. The arrows and Space do not scroll the page while the game runs. Before the mouse has moved, the pointer is at the middle of the stage. `game.pointer.pressed` is true for a press on the stage that no button and no sprite with `onTap` is under: a press on one of those is theirs alone, so a game that places something wherever the stage is pressed does not place it under its own buttons. `game.pointer.down` stays true while the owning pointer is held, including a press on a button.

The first pointer pressed on the Play canvas owns `game.pointer` until it lifts or is cancelled. Other fingers can tap independent UI controls during a drag. They leave the owner's position, swipe origin and release edge alone. An already-held finger does not take over after the owner lifts. On Galaxy Z Fold7 (Android 17, Chrome 157), browser-protocol touch on WebGL2 and WebGPU verified both release orders, the owner's swipe, a separate UI tap and cancellation.

## Sound

If your game owns its audio, pass `audio: false` to `play` or `play3d`. For the lifetime of the game, Play creates no audio context or audio-unlock listeners and skips synthesis and decoding of all 14 presets. Calling `sfx.define`, `sfx.play`, `sfx.loop` or `music.play` later keeps built-in audio off. A loop handle is already stopped and can be safely stopped again. The game owns pause, resume and cleanup for its own mixer. If `setup` also runs on restart, reuse that mixer across calls.

With `audio: true` or the option omitted, Play prepares the presets before `setup`. Use `game.sfx.muted` to mute this mixer temporarily.

`game.sfx.play('coin')` plays an effect made in code. The names are `jump`, `coin`, `hit`, `hurt`, `explosion`, `shoot`, `powerup`, `bounce`, `pop`, `click`, `hum`, `wind`, `win` and `lose`. `game.sfx.play('coin', { volume: 0.5, pitch: 1.2 })` changes one play. A name that is not there is refused with `PLAY_SFX_UNKNOWN`, and the message lists the names.

**Sounds that go on.** `const engine = game.sfx.loop('hum', { volume: 0.5 })` plays an effect again and again until `engine.stop()`, which fades it over a tenth of a second, or over the seconds given. Set `engine.pitch = 1 + speed / 20` as a car speeds up, and `volume` and `pan` likewise while it plays. `hum` and `wind` are made to be looped; a tune defined with `define` loops as music, and a tone with `seamless: true` joins itself without a click when it is whole waves long. A pause holds every loop, and `restart` and `dispose` stop them.

A browser plays no sound until the player has pressed a key or clicked; effects asked for before that are not heard, and the game goes on.

`game.sfx.define('zap', { wave: 'saw', from: 1200, to: 200, seconds: 0.15 })` adds an effect. A tone has a `wave` (`'sine'`, `'square'`, `'saw'`, `'triangle'` or `'noise'`), a pitch `from` and optionally `to` in hertz, `seconds`, and optionally `volume` (0 to 1), `decay` (0 holds, 4 is a pluck, 10 a tick) and `noise` (0 to 1 mixed in). A list of tones plays one after another, which makes a jingle. `game.sfx.volume` and `game.sfx.muted` act on every effect.

### Windows startup measurements

On Windows with Chrome 157 and an RTX 5090 Laptop GPU, a WebGL2 page started Play on a click and created its own mixer in `setup`. Each run used a fresh browser process and profile. Five of six alternating pairs stayed in the foreground throughout. With built-in audio enabled, the page created two contexts and decoded 14 presets. With `audio: false`, it created one context and decoded zero presets. Median time from the launch click to the first coloured pixel in a browser-composited frame was 2726.4 ms and 2602.7 ms respectively. The first in-game click changed that pixel in 9.4 ms and 9.3 ms. The first in-game click triggered no context construction or preset decoding in either configuration.

Three further pairs ran the first wave of *Nezha Stirs the Sea* locally on WebGPU. Median navigation-to-actionable-title time fell from 830.8 ms to 717.7 ms. The median from clicking Start to the return of the first GPU submission for an advancing simulation step was 72.6 ms and 72.2 ms respectively. The game decoded its own 23 sounds in both configurations. Its mixer still does some of that work after Start.

## Overlap

| Ask | Answer |
| --- | --- |
| `game.overlaps(a, b)` | Whether what two sprites draw overlaps, taken as upright boxes on the stage |
| `game.hits(a, list)` | The first sprite of the list that overlaps `a`, or `undefined` |
| `game.hitsAll(a, list)` | Every sprite of the list that overlaps `a` |
| `game.near(a, b, distance)` | Whether the middles of the two are within `distance`: a test of circles, as `game.near(bullet, enemy, 6 + 14)` for radii 6 and 14 |
| `game.pushOut(a, b)` | How far to move `a` so it no longer overlaps `b`, by the shorter way out: `{ x, y }` with one of them 0, or `undefined` when they do not overlap |

A third argument of `overlaps`, `hits` and `hitsAll` takes that many units off every side of both, for a more forgiving hit. A sprite that is hidden with `visible = false`, removed or draws nothing overlaps nothing; one with `alpha` 0 still overlaps. A sprite never hits itself, so the list may hold it.

A level of tiles is one call: `const map = game.tiles(['##########', '#........#', '##########'], { size: 32, x: 0, y: 0, colors: { '#': 0x445566 } })` draws the rows as one sprite, `map.sprite`, with the top left corner at `x`, `y`. `#` is solid unless `solid` gives the solid characters, and a character without a colour is not drawn. `map.pushOut(hero)` is how far to move a sprite out of the solid tiles it overlaps, `{ x, y }` or `undefined`, out of the most overlapped tile first; `map.solidAt(x, y)` and `map.cellAt(x, y)` read a point of the layer, `map.at(column, row)` a cell, and `map.set(column, row, '.')` changes one and draws the map again. `game.mix(a, b, t)` is the colour a fraction `t` of the way from `a` to `b`, both `0xRRGGBB`.

`pushOut` is how a character stands on a platform and stops at a wall:

```js
hero.y += vy * dt;
for (const block of blocks) {
  const push = game.pushOut(hero, block);
  if (!push) continue;
  hero.x += push.x;
  hero.y += push.y;
  if (push.y < 0) { vy = 0; onGround = true; }   // pushed up: it landed
  if (push.y > 0) vy = 0;                         // pushed down: it hit its head
}
```

## Time

| Call | Does |
| --- | --- |
| `game.after(seconds, fn)` | Calls `fn` once, after that much play. It returns a function that calls it off |
| `game.every(seconds, fn)` | Calls `fn` again and again. It returns a function that ends it |
| `game.tween(sprite).to({ x: 100, alpha: 0 }, 0.3, 'quadOut')` | Moves numbers of an object over time, from what they are. It starts by itself. Chain `.to`, `.wait(seconds)`, `.call(fn)`, `.loop(times)` and `.onFinish(fn)`. Easings: `linear`, `quadIn`, `quadOut`, `quadInOut`, `cubicOut`, `backOut`, `elasticOut`, `bounceOut` and the rest of [`animate`](api-reference.md)'s |
| `await game.tween(sprite).to({ y: 200 }, 0.2).done` | Waits for a tween to finish, so steps can follow one another in an `async` function |
| `await game.wait(seconds)` | Waits for that much play |
| `game.time` | Seconds of play so far |
| `game.timeScale = 0.5` | Slow motion; 1 is as played |
| `game.pause()`, `game.resume()`, `game.paused` | Stops and starts updates and timers. `update` is not called while paused; a button's `onTap` still is, which is how a paused game is resumed |
| `game.restart()` | Removes everything in the world and the `ui` layer, calls off timers and tweens, and runs `setup` again |

Use these and not `setTimeout`: they stop with a pause, a hit stop and a hidden tab, as the game does.

## Effects of a hit

| Call | Does |
| --- | --- |
| `game.shake(amount = 6, seconds = 0.25)` | Shakes the world by up to that many units; the `ui` layer stays put. Nothing while `game.reducedMotion` is on |
| `game.reducedMotion` | Less motion for a player who asks for it: no shakes and faint flashes. Follows the system's `prefers-reduced-motion` unless the `reducedMotion` option or a settings menu sets it |
| `game.flash(color = 0xffffff, seconds = 0.15)` | Covers the stage with a colour that fades away |
| `game.hitStop(seconds = 0.06)` | Stops play for a moment: no updates and no timers |
| `game.burst(x, y, { color, count, speed, life, size, gravity })` | Throws pieces out from a point of the world. 12 white pieces unless said otherwise |

Tweens, timers and `update` use the same gameplay seconds. Pause and a zero `timeScale` hold their progress; `hitStop` holds it for its duration. Drawing and input continue, so an interface can resume a paused game. A callback that pauses, restarts or closes the game prevents the old update from continuing. The active loop is `game.browser.loop`. Closing the game stops pending motions, and repeated `dispose()` calls wait for the same cleanup.

Repeated calls to `game.restart()` during setup return the same Promise and run setup once. Gameplay updates resume when setup succeeds. If setup throws or rejects, the Promise reports that error, the partial round is cleaned up and another call to `restart()` retries. A setup callback must finish before its own restart Promise can resolve. Await that Promise from the caller outside setup.

During initial setup or restart, `game.dispose()` closes the game even if an application load is still pending. The interrupted startup or restart rejects with `SCOPE_CLOSED`. If the load later finishes, it cannot attach game objects through the closed SDK handle or resume updates. Applications own cancellation of their external downloads.

## Pictures

`await game.image(url, { x, y, width, height, smooth, layer })` reads a picture and places its middle at `x`, `y` on the world layer by default. PNG retains strict validation. JPEG, WebP, GIF and AVIF use the browser decoder when the browser supports them. The encoded bytes select the decoder. Each game admits up to four simultaneous image loads, with an 8 MiB encoded limit per image. Disposing the game aborts pending fetches and releases any decoded result returned after cancellation.

Give only `width` or `height` to preserve the picture's shape, or omit both to use its original size. The default uses [smaller copies](shared-render-profile-contract.md) when scaling down. Set `smooth: false` for sharp pixel art. Repeated loads of the same address share a texture while it is leased.

An unsuccessful HTTP status keeps the error chain `ASSET_LOAD_FAILED` → `WEB_PNG_READ_FAILED` → `BROWSER_GAME_IMAGE_FAILED`. The URL can be retried. In the Chromium 157 software WebGL2 check, the first request to a `.png` URL returned 404. The second request to the same URL returned WebP bytes with a PNG media type and produced a 48 × 32 image.

## Words, menus and bars

A story, a title screen and a health bar are the parts most games draw for themselves. Play has them, made of the game's own sprites and texts on the ui layer, so a restart takes them away and each plays by keyboard, pointer and finger.

```js
async setup(game) {
  hp = game.bar({ x: 12, y: 12, width: 140, value: 4, max: 4, color: 0xef4444 });
  if ((await game.menu(['Start', 'Quiet start'], { title: 'The Night Yard' })) === 1) game.sfx.muted = true;
  const answer = await game.say('Will you light the lanterns?', { who: 'Keeper', choices: ['I will.', 'Why?'] });
},
update(seconds, game) {
  if (game.asking) return; // a box of words or a menu is open
  // ...
  hp.value -= 1;           // the bar slides down and leaves a pale trail
  game.toast('Lantern lit');
}
```

- `game.bar({ x, y, width = 120, height = 12, value, max = 1, color, back, layer })` is a sprite whose `x` and `y` are its top left. Setting `value` slides it there, within 0 and `max`.
- `game.toast(words, { seconds = 2, color })` shows a notice at the top that fades; several stack.
- `await game.say(words, { who, choices, color, speed = 40 })` opens a box at the bottom whose words appear `speed` letters a second, wrapped to its width. Space, Enter, Z or a tap shows the rest; another closes it, and it gives `undefined`. With `choices` the answers appear once the words have; the arrows or W and S and a stick move between them, Enter, Space, Z or a tap takes one, and it gives its index. A box asked for while one is open waits its turn. Words longer than a box holds go on in further boxes, each closed by a press; the answers come with the last.
- `await game.menu(items, { title, x, y, width, color })` opens a list in the middle of the stage, or around `x`, `y`, and gives the index chosen in the same ways. A new menu closes the one open, which then gives nothing.
- `game.asking` is whether a box or a menu is open.

They answer while the game is paused, and `setup` may await them: frames are drawn while it waits, though `update`, timers and tweens begin only when it has finished. A restart takes them away; what was being awaited is then not answered. The words of a box are drawn once, line by line, and uncovered letter by letter: a box does not draw its words again each frame. `examples/play/story.mjs` uses every one.

## Phones, pads and music

A game written for the keyboard is played on a phone by adding controls on the glass, and on a gamepad without changing anything:

```js
game.touchStick();                                            // counts in game.keys.axis()
game.touchButton('A', { x: 430, y: 230, key: 'space' });      // holds Space while a finger is on it
if (game.keys.pressed('space', 'pad:a')) jump();              // the pad's lower face button
game.music.play('mystery');
game.music.intensity = lanterns / 3;                          // parts come in as it rises
```

- `game.touchStick({ x, y, radius = 48, always })` and `game.touchButton(words, { x, y, key = 'space', radius = 32, color, always })` are drawn over the ui layer, so a box of words does not hide them, once a finger has touched the stage, or at once with `always`. Each finger keeps the control it started on until it lifts, so a thumb on the stick and another on a button work together. A finger that starts elsewhere is the game's pointer as before.
- The buttons of the first gamepad in the standard layout are keys named `pad:a`, `pad:b`, `pad:x`, `pad:y`, `pad:l1`, `pad:r1`, `pad:l2`, `pad:r2`, `pad:select`, `pad:start` and `pad:up`, `pad:down`, `pad:left`, `pad:right`: `down`, `pressed` and `released` take them. The d-pad counts in `keys.axis()`, and `pad:a` and the d-pad answer boxes of words and menus.
- `game.music.play(mood)` writes a piece in code (`'calm'`, `'mystery'`, `'tense'`, `'battle'` or `'triumph'`), or from `{ mood, seed, tempo, bars }`, as four parts of one length: held chords, a bass, drums and a tune. It loops them together, and a piece already playing fades out. `game.music.intensity` (0 to 1) brings in the bass, then the drums, then the tune, over about a second and a half. `volume` is 0.6 unless set, and the effects' volume and mute apply too. `stop(seconds)` fades it out. A pause holds it; a restart stops it. `composeMusic` and `musicMix` are exported for a game that wants the samples.

A menu or a box of words that the first `setup` awaits starts the frames as it opens, so it is seen and answered. Otherwise the frames start when `setup` has finished, as before.

## Chance and saves

`game.random` gives numbers that repeat for the same `seed`: `int(1, 6)`, `range(0, 1)`, `chance(0.25)`, `pick(list)`, and `shuffle(list)`, which gives a new list and leaves the one it was given.

`game.save('best', score)` keeps a value in the page's storage, as JSON, and `game.load('best', 0)` reads it back, or gives the second argument when there is none. Where the page has no storage the value is kept for the visit.

## The page

```html
<!doctype html>
<meta charset="utf-8">
<script type="importmap">{ "imports": { "@egret/engine/play": "…/web/play.js", … } }</script>
<script type="module">
  import { play } from '@egret/engine/play';
  await play({ width: 480, height: 270, setup(game) { … }, update(dt, game) { … } });
</script>
```

Nothing else is needed: `play` makes the canvas and fills the window with it, keeping the stage's shape with bars where the window's differs.

A page can also take the engine as [one file](single-file.md), with no import map: `<script src="egret2d.js"></script>`, then `const { play } = Egret;`. Three whole games are in the [play example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.md).

## In three dimensions

[`play3d`](play3d.md) is this with a world of boxes, balls and a ground under it, a camera that follows and a sun: the keys, the pointer, sound, time, text and buttons are the same.

## When a game outgrows it

`game.canvas` is the canvas `play` draws on: the one given as `canvas`, or the one it made inside `parent` or the page. `game.browser` is the [browser game](browser-game.md) this is built on, which has no canvas of its own, and `game.engine` and `game.scope` its Engine and scope. From there every entry is open: images and atlases, [the 2D camera](camera-2d.md), [tilemaps](tilemap.md), [particles](particles.md) with textures, [2D physics](physics-2d.md), [the interface controls](ui-controls.md), [input by action with gamepads](game-kit.md) and [World3D](world3d.md). What they make can be added to `game.world` and `game.ui` beside what `play` made.
