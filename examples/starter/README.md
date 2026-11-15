# Starter

English | [简体中文](README.zh-CN.md)

A starting point for a 2D game: one Engine, one stage, a frame loop, pointer and keyboard input and one rule. A blue square walks to where you tap, or where the arrow keys send it, and picks up five coins. In `main.mjs`, replace the sections marked "Game" to add your own rules.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/starter/index.html` on the host and port the server prints. Add `?backend=webgl2` or `?backend=webgpu` to choose a backend, and `?stats` for a panel of frames a second and what a frame holds. `?image=/examples/resource-scene/assets/atlas-v1.png` loads that PNG with `game.loadTexture` and counts the taps on it.

## What is in it

| Step | In `main.mjs` |
| --- | --- |
| The game | `await createBrowserGame({ canvas, width, height, update })` from `@egret/engine/web/game`. One call makes the five things below |
| A Host | WebGPU where the browser gives an adapter, WebGL2 otherwise: `game.backend` says which |
| An Engine | `game.engine`, with its stage as `game.stage` |
| A scope | `game.scope`; `scope.use(new Sprite())` gives the scope what the game creates, and disposing the game disposes it |
| Input | `game.pointer` and `game.keyboard` for display objects. This example listens to the page's own `pointerdown` and `keydown` on the canvas, and `game.toStage` turns a place on the page into stage units |
| The loop | `game.loop`: it moves the Engine's clock, calls `update(seconds)` and draws |
| The stage | `engine.stage.addChild(...)`; a `Sprite` draws with `graphics`, and `x`, `y` place it |
| Motion | `animate(engine, scope, coin).to({ scaleX: 2, scaleY: 2, alpha: 0 }, 0.2, 'quadOut').call(...)` when a coin is picked up |

[One call for a game in a page](../../knowledge-base/en/docs/browser-game.md) describes the options and what to do when a game needs to make these itself.

The [frame loop](../../knowledge-base/en/docs/frame-loop.md) takes care of two things that are easy to miss by hand. A step is at most a tenth of a second, so a tab that was hidden does not come back with one enormous step. And a Host holds at most two frames it has not finished: the loop skips drawing a frame while there are two, instead of being refused.

## Make it yours

1. Copy the folder beside the other examples and open its `index.html` the same way.
2. Keep the import map of `index.html`. It tells the browser where each `@egret/...` name is in the built checkout. For another entry, such as `@egret/engine/particles`, add its line; [what to import](../../knowledge-base/en/docs/entry-points.md) lists them.
3. Replace the three "Game" parts of `main.mjs`: the state, the input and the step.

For a project outside this checkout, with a package manager and a bundler instead of an import map, see [using the preview from a clean project](../../knowledge-base/en/docs/clean-consumer.md).

## Check

```text
node examples/starter/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

It reads the colours of the square and the coins from the canvas, clicks, holds the arrow keys, presses the button and, on a phone profile, taps. It runs WebGL2 alone, in headless Chromium with software rendering when `software` is given. No person pressed anything, and WebGPU was not run.
