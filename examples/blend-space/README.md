# Blend space: how translucent colours mix

English | [简体中文](README.zh-CN.md)

The engine mixes a translucent draw with what is under it in linear light by default. A 2D canvas, Egret 5 and most image tools mix the stored colour codes instead, so translucent light colours look much stronger in the engine than there: white at 10% over a dark ground is a faint white in a canvas and a clear grey in linear light. A game ported from Egret 5, or designed by eye in a canvas, can ask the engine to mix as a canvas does:

```js
const game = await createBrowserGame({ canvas, width, height, blendSpace: 'srgb' });
```

The Host and every frame then use the `srgb` space. The colour of each draw is the same in both spaces; only the mixing differs. `play()` uses `'srgb'` unless it is given `blendSpace: 'linear'`. The [render profile contract](../../knowledge-base/en/docs/shared-render-profile-contract.md#blend-space) has the rules.

The top half of the page is the engine and the bottom half the page's own 2D canvas drawing the same squares: a faint white, red at half over blue, black at a quarter over white, two faint colours over each other, and an opaque grey.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/blend-space/index.html` on the host and port the server prints. Add `?space=linear` or `?space=srgb`, and `&backend=webgl2` or `&backend=webgpu`.

## Check

```text
node examples/blend-space/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]
```

It draws the page on both Hosts in both spaces and reads each square. In `srgb` every square is within 3 of the 2D canvas; in `linear` the faint white is clearly brighter than there, and the opaque grey is the same in both. Without `software` it runs the installed Edge headed on the computer's GPU. With `software` it runs headless with software rendering, where a WebGPU adapter that cannot draw is recorded rather than failed. In the development container the WebGL2 checks passed with software rendering, every `srgb` square within 1 of the canvas; WebGPU there lost its device, also on main, so WebGPU awaits a hardware run.
