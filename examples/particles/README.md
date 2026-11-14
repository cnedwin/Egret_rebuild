# Particles

English | [简体中文](README.zh-CN.md)

Three streams of `@egret/engine/particles`: a brazier that burns, petals that fall in the wind, and sparks where the page is pressed. Each is one emitter drawn as one mesh over a soft dot the page paints, so the repository carries no picture.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/particles/index.html` on the host and port the server prints. Add `?backend=webgl2` for WebGL2.

## What to try

- Watch the brazier: flames are born over its width, rise, shrink and turn from yellow to red as they fade.
- Watch the petals drift across with the wind and turn as they fall.
- Press anywhere on the canvas, or the Sparks button: eighty sparks burst there, fall and die out.
- Put the fire out: what burns burns out. Light it again.

## How it works

| Part | From |
| --- | --- |
| The image of a particle | A white dot with a soft edge, painted by the page and leased from the Engine's assets; each particle tints and fades it |
| The fire | `rate`, `lifetime`, `speed`, `angle`, `gravity` upwards, `drag`, scale, colour and alpha from birth to death, a rectangle to be born over |
| The petals | A long rectangle above the view, sideways gravity for the wind, `rotation` and `spin` |
| The sparks | An emitter that does not run, moved to the press and given `burst(80)` |
| Time | The page gives each emitter `update(seconds)` each frame |

See the [particles guide](../../knowledge-base/en/docs/particles.md).

## Check

```text
node examples/particles/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

With `?manual` the check steps the streams; one scenario uses real time. Colours are read from screenshots of the canvas. No person pressed anything and no phone was used.
