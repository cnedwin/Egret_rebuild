# 2D physics

English | [简体中文](README.zh-CN.md)

A training hall in `@egret/engine/physics2d`: walls made from a grid of cells, a disciple moved by the keys who slides along them, stones that fall, bounce and slide, a slope, a pond that lights up while a stone is in it, and a ray cast to the right of the disciple. The stones and the disciple are images the page paints, so the repository carries no picture.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/physics-2d/index.html` on the host and port the server prints. Add `?backend=webgl2` for WebGL2.

## What to try

- Move the disciple with the arrow keys or WASD: it stops at the walls and slides along the ledge when pushed into it at a slant.
- Press anywhere on the canvas, or Drop stones: stones fall, bounce, rest on the ledge, slide down the slope and pile up.
- Drop a stone into the pond: the pond lights up while a stone is in it. Clear takes all the stones away.
- Watch the yellow ray: it stops at the first wall, slope or stone it meets.

## How it works

| Part | From |
| --- | --- |
| The walls | `addTileColliders` over the hall's grid of 32 by 18 cells: six static boxes |
| The slope and the pond | A static box turned by -20 degrees; a static sensor box whose contacts are counted |
| The stones | Dynamic circles with `restitution` and `friction`, each with its image as `display` |
| The disciple | A kinematic box moved by `moveAndSlide` each frame; it pushes stones and is not pushed |
| The ray | `raycast` from the disciple to the right each frame |
| Time | The page gives the world `step(seconds)` each frame; the world takes fixed steps of 1/60 |

See the [2D physics guide](../../knowledge-base/en/docs/physics-2d.md).

## Check

```text
node examples/physics-2d/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

With `?manual` the check steps the world; one scenario uses real time. Colours are read from screenshots of the canvas. No person pressed anything and no phone was used.
