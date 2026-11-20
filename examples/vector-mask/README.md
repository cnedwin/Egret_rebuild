# Masks of shapes and lines of gradients

English | [简体中文](README.zh-CN.md)

Two things of Egret 5's Graphics that the engine now has. A node is masked by the shape of a Sprite's Graphics, as `mask = displayObject` did, with `renderEffect = { shapeMask: sprite }`. A line takes a gradient, as `lineGradientStyle` gave one:

```js
const game = await createBrowserGame({ canvas, width, height, effects: true });
const window = scope.use(new Sprite());
window.graphics.beginFill(0xffffff).drawCircle(80, 80, 60).endFill();
picture.renderEffect = { shapeMask: window };

lines.graphics
  .lineStyle(16, 0xffffff)
  .lineLinearGradientStyle(340, 0, 460, 0, [{ offset: 0, color: 0xff2020 }, { offset: 1, color: 0x2040ff }])
  .moveTo(340, 40)
  .lineTo(460, 40);
```

The top half of the page is the engine, and the bottom half is the page's own 2D canvas drawing the same with its clip and gradient strokes. It shows stripes through a circle and through a star, a thick line from red to blue, and a ring from gold on its inside to green on its outside. See [filters](../../knowledge-base/en/docs/filters.md#masks-of-shapes) for masks and [graphics](../../knowledge-base/en/docs/graphics.md#gradients) for gradients.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/vector-mask/index.html` on the host and port the server prints, with `?backend=webgl2` or `?backend=webgpu` to choose.

## Check

```text
node examples/vector-mask/verify.mjs <absolute Playwright index.mjs> [<new output directory>] [software]
```

It draws the page on both Hosts and reads thirteen points away from any edge, in the engine and in the 2D canvas. Each must be within 8 of the canvas. The ground must show outside the masks and in the notch of the star; the stripes must show inside them. The line must run from red to blue, and the ring from gold to green. Without `software` it runs the installed Edge headed on the computer's GPU; with it, headless with software rendering, where a WebGPU adapter that cannot draw is recorded rather than failed. In the development container WebGL2 passed with software rendering, the ring within 4 of the canvas; WebGPU there lost its device, also on main, so WebGPU awaits a hardware run.
