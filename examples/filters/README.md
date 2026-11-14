# Filters

English | [简体中文](README.zh-CN.md)

Six copies of the same tile, each with a render effect: Egret's grey colour matrix, a gold glow, a drop shadow, a red outline, a white inner glow and a green glow alone. The host is made with `enableEffects: true`, and one stage unit is one canvas pixel, so the canvas is shown at its own size.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/filters/index.html` on the host and port the server prints. Add `?backend=webgl2` or `?backend=webgpu` to choose a backend.

## What to try

- Compare the six tiles with the plain colour of the tile.
- Press the button: the effects are removed and put back, and the tiles go plain and back.

## How it works

| Part | From |
| --- | --- |
| Each tile | A `Sprite` in a `DisplayObjectContainer` whose `renderEffect` has a `colorMatrix`, a `glow` or an `outline` |
| The drop shadow | A black `glow` with an alpha of 0.7 and an offset of 6 across and 6 down |

See the [filters guide](../../knowledge-base/en/docs/filters.md).

## Check

```text
node examples/filters/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

The check reads the canvas pixel by pixel and works out each expected value itself from the equations in the guide. No person pressed anything.
