# Graphics

English | [简体中文](README.zh-CN.md)

Shapes drawn with a sprite's `graphics`: a circle, an ellipse, a rounded rectangle with a line, a translucent disc over it, a filled path with a notch, a line with a corner, a curve, a ring of four wedges drawn with arcs, a gradient from red to blue, a frame with a hole, and a dashed line with round ends.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/graphics/index.html` on the host and port the server prints. Add `?backend=webgl2` or `?backend=webgpu` to choose a backend.

## What to try

- Look at the edges: curves are straight pieces and edges are not smoothed.
- Add `&many=300` to the address: three hundred more discs, each of its own size, each a drawing of its own.
- Press the button: the ring is cleared and drawn again with its two colours changed over.

## How it works

| Part | From |
| --- | --- |
| Circle, ellipse, rounded rectangle | `drawCircle`, `drawEllipse`, `drawRoundRect` after `beginFill`, the last also after `lineStyle` |
| Translucent disc | A second sprite with `beginFill(color, 0.5)` |
| Notched shape | `moveTo` and `lineTo` under a fill, closed by `endFill` |
| Line and curve | `lineStyle`, then `moveTo`, `lineTo` and `curveTo`, with no fill |
| Wedges | `moveTo`, an outer `drawArc` one way and an inner `drawArc` back, under a fill |
| Gradient | `beginLinearGradientFill` with two stops, then `drawRect` |
| Frame with a hole | One fill, two `moveTo` parts: the inner one drawn the other way round |
| Dashed line | `lineStyle` with `{ dash: [16, 12], caps: 'round' }` |

See the [graphics guide](../../knowledge-base/en/docs/graphics.md).

## Check

```text
node examples/graphics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

It reads colours from the canvas inside and outside each outline, where the translucent disc lies over the panel and over the background, the gradient at its ends and halfway, the frame and its hole, and a dash and a gap, each compared with the value worked out from the colours. It runs WebGL2 alone. No person pressed anything, and WebGPU was not run.
