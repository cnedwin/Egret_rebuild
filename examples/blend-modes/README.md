# Blend modes

English | [简体中文](README.zh-CN.md)

`DisplayObject.blendMode` by Egret's names: the same amber square, at an alpha of 0.6, over the same blue panel in `normal`, `add`, `multiply`, `screen` and `erase`, and below them three sparks in a container whose mode is `add`.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/blend-modes/index.html` on the host and port the server prints. Add `?backend=webgl2` or `?backend=webgpu` to choose a backend.

## What to try

- Compare the five squares: the same colours, combined five ways. Through the erased one the page shows.
- Press the button: the sparks go from `add`, brighter where they overlap, to `normal`, flat.

## How it works

| Part | From |
| --- | --- |
| The squares | One `Sprite` each, a sibling of its panel, with its own `blendMode` |
| The sparks | Three squares in a `DisplayObjectContainer` whose `blendMode` is `add`; the children take it from the container |

See the [blend mode guide](../../knowledge-base/en/docs/blend-modes.md).

## Check

```text
node examples/blend-modes/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

Each pixel is compared with the value worked out from its blend equation. With `software`, WebGL2 alone is checked; in Edge both backends are. No person pressed anything.
