# Play: a whole small game from one call

English | [简体中文](../../Cns/docs/play.md)

`@egret/engine/play` is where a game starts. One call makes the canvas, fits it to the page and runs the loop, and the game it gives back has the parts most games write for themselves: keys and a pointer to ask each frame, sound effects made in code, overlap tests, timers, text, tweens, bursts of particles, a shake, a flash and a hit stop. A game needs no image, sound or font file.

It is built from the public entries ([the browser game](browser-game.md), [audio](audio.md), [the game kit](game-kit.md), [Graphics](graphics.md)), which stay there for what it does not cover.

**What is checked.** Options, the sound effect recipes and their samples are checked in Node. In headless Chromium on software WebGL2, the game below started, drew, took keys and the pointer, broke bricks, played its effects and showed its centred text. Other browsers, phones and WebGPU were not run.

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
| `setup(game)` | Builds the game; may be `async` | Nothing is built |
| `update(seconds, game)` | One step of the game | No step |
| `parent` | An element to put the canvas in. It fills the element's width; an element with no height of its own takes the stage's shape | The game fills the window |
| `canvas` | A canvas of the page to draw on, left where it is | One is made |
| `onError(error)` | Told of what stopped the game | It is thrown where the console shows it |
| `seed` | The seed of `game.random` | A new one each time |
| `saveKey` | The name `game.save` keeps its values under | The page's path |
| `backend` | `'auto'`, `'webgpu'` or `'webgl2'` | `'auto'` |

Options that cannot make a game are refused with `PLAY_OPTIONS_INVALID`; the message ends with which one.

## Drawing

| Call | Gives |
| --- | --- |
| `game.rect(x, y, width, height, color, layer?)` | A filled rectangle whose **middle** is at (x, y) |
| `game.circle(x, y, radius, color, layer?)` | A filled circle whose middle is at (x, y) |
| `game.sprite(g => …)` | A sprite with what the function draws: `g` is its [Graphics](graphics.md), as in `g.beginFill(0xff0000).drawRoundRect(-20, -10, 40, 20, 6).endFill()` |
| `game.text(words, { x, y, size, color, align, bold })` | A line of text; see below |
| `game.button(words, { x, y, width, height, color }, onTap)` | A button in the `ui` layer, its middle at (x, y), with its words centred on it; `button.label.text` changes them |
| `game.remove(sprite)` | Takes it, and what is in it, off the stage and ends it. Removing it twice does nothing |
| `game.toFront(sprite)` | Puts it in front of the others of its layer |

Each gives a sprite. Set `x`, `y`, `rotation` (degrees), `scaleX`, `scaleY`, `alpha` (0 to 1) and `visible` on it at any time, read its `width` and `height`, and add properties of your own (`enemy.hp = 3`). A colour is a number, `0xRRGGBB`.

A sprite turns and scales about its own origin: the middle of a `rect` or a `circle`, and the point (0, 0) of what a `game.sprite` draws. So a card flips about its middle by tweening `scaleX` to 0 and back. Sprites are drawn in the order they were made, later ones in front. To change what a sprite looks like, draw it again: `sprite.graphics.clear().beginFill(0x00ff00).drawRect(-10, -10, 20, 20).endFill()`.

`game.world` is the layer these are drawn in. `game.ui` is a layer over it that stays put; pass it as the last argument, as in `game.rect(240, 20, 480, 40, 0x000000, game.ui)`, for a bar or a panel. Any sprite can be given as the layer: what is made in it moves, turns, fades and is removed with it. `game.view.x` and `game.view.y` say which part of the world is seen, so a level wider than the stage scrolls by `game.view.x = hero.x - game.width / 2`.

**Text.** `const score = game.text('Score 0', { x: 240, y: 8, align: 'center' })` is drawn in the `ui` layer and can be used at once; set `score.text = 'Score ' + n` (a number is taken as it is) whenever it changes. `align` says which part of the words `x` is: `'left'`, `'center'` or `'right'`. `size` is 24 and `color` white unless given. `y` is the top of the words, or their middle with `baseline: 'middle'`. A `\n` in the words starts a new line. `{ layer: 'world' }` puts a text in the world, as for a number that floats up from a hit, and `{ layer: tile, align: 'center', baseline: 'middle' }` puts it on a sprite, at the sprite's origin, to move with it. A text is a sprite, so it can be moved, faded, tweened and removed like one. The letters are the page's own fonts, which have Chinese, Japanese and Korean where the device does.

## Input

| Ask | Answer |
| --- | --- |
| `game.keys.down('left', 'a')` | Whether any of these keys is held |
| `game.keys.pressed('space')` | Whether it went down since the last update |
| `game.keys.released('space')` | Whether it came up since the last update |
| `game.keys.axis()` | The arrows and WASD as `{ x, y }`, each from -1 to 1, y down, of length 1 at most |
| `game.pointer.x`, `.y` | Where the mouse or finger is, on the stage; it follows the mouse with no button held |
| `game.pointer.down`, `.pressed`, `.released` | Whether a button or finger is down, went down, or came up |
| `game.pointer.swipe` | `'left'`, `'right'`, `'up'` or `'down'` in the update after a swipe ends |
| `game.pointer.over(sprite)` | Whether the pointer is over what the sprite draws |
| `game.onTap(sprite, () => …)` | Calls the function when the sprite is tapped or clicked. Where sprites overlap, the one in front gets the tap |

A key is `'left'`, `'right'`, `'up'`, `'down'`, `'space'`, `'enter'`, `'escape'`, `'shift'`, a letter, a digit, or a `KeyboardEvent.code` such as `'KeyQ'`. The arrows and Space do not scroll the page while the game runs. Before the mouse has moved, the pointer is at the middle of the stage. `game.pointer.pressed` is true for a press anywhere on the stage, on a button as well; where a press should not reach the game under a button, test `game.pointer.over(button)` first.

## Sound

`game.sfx.play('coin')` plays an effect made in code. The names are `jump`, `coin`, `hit`, `hurt`, `explosion`, `shoot`, `powerup`, `bounce`, `pop`, `click`, `win` and `lose`. `game.sfx.play('coin', { volume: 0.5, pitch: 1.2 })` changes one play. A name that is not there is refused with `PLAY_SFX_UNKNOWN`, and the message lists the names.

A browser plays no sound until the player has pressed a key or clicked; effects asked for before that are not heard, and the game goes on.

`game.sfx.define('zap', { wave: 'saw', from: 1200, to: 200, seconds: 0.15 })` adds an effect. A tone has a `wave` (`'sine'`, `'square'`, `'saw'`, `'triangle'` or `'noise'`), a pitch `from` and optionally `to` in hertz, `seconds`, and optionally `volume` (0 to 1), `decay` (0 holds, 4 is a pluck, 10 a tick) and `noise` (0 to 1 mixed in). A list of tones plays one after another, which makes a jingle. `game.sfx.volume` and `game.sfx.muted` act on every effect.

## Overlap

| Ask | Answer |
| --- | --- |
| `game.overlaps(a, b)` | Whether what two sprites draw overlaps, taken as upright boxes on the stage |
| `game.hits(a, list)` | The first sprite of the list that overlaps `a`, or `undefined` |
| `game.hitsAll(a, list)` | Every sprite of the list that overlaps `a` |
| `game.near(a, b, distance)` | Whether the middles of the two are within `distance`: a test of circles, as `game.near(bullet, enemy, 6 + 14)` for radii 6 and 14 |
| `game.pushOut(a, b)` | How far to move `a` so it no longer overlaps `b`, by the shorter way out: `{ x, y }` with one of them 0, or `undefined` when they do not overlap |

A third argument of `overlaps`, `hits` and `hitsAll` takes that many units off every side of both, for a more forgiving hit. A sprite that is hidden, removed or draws nothing overlaps nothing, and a sprite never hits itself, so the list may hold it.

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
| `game.shake(amount = 6, seconds = 0.25)` | Shakes the world by up to that many units; the `ui` layer stays put |
| `game.flash(color = 0xffffff, seconds = 0.15)` | Covers the stage with a colour that fades away |
| `game.hitStop(seconds = 0.06)` | Stops play for a moment: no updates and no timers |
| `game.burst(x, y, { color, count, speed, life, size, gravity })` | Throws pieces out from a point of the world. 12 white pieces unless said otherwise |

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

## When a game outgrows it

`game.browser` is the [browser game](browser-game.md) this is built on, and `game.engine` and `game.scope` its Engine and scope. From there every entry is open: images and atlases, [the 2D camera](camera-2d.md), [tilemaps](tilemap.md), [particles](particles.md) with textures, [2D physics](physics-2d.md), [the interface controls](ui-controls.md), [input by action with gamepads](game-kit.md) and [World3D](world3d.md). What they make can be added to `game.world` and `game.ui` beside what `play` made.
