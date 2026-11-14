# Filters

English | [简体中文](../../Cns/docs/filters.md)

A render effect can now change what a subtree draws in the ways Egret's filters did: a colour matrix, a glow, a drop shadow and an inner glow, and an outline. They run in the existing effect group — the subtree drawn into a target of its own — after its blur and before its mask and clips, on both shared hosts, WebGL2 and WebGPU. Like the blur, they need a host made with `enableEffects: true`.

**What is checked and what is not.** The descriptors, what a frame carries and what each group's uniform holds are checked in Node, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/filters/README.md) in headless Chromium with software WebGL2, where every checked pixel is compared with a value worked out independently from the equations below. WebGPU was not drawn in a browser here: headless Chromium offers a SwiftShader adapter but drops its instance while a frame is checked, for every example alike. No hardware GPU or phone was run. See [What was run](#what-was-run).

## Use

```js
const host = createSharedWebGL2Host({ canvas, enableEffects: true });

icon.renderEffect = { colorMatrix: GREY };                                    // Egret's ColorMatrixFilter
title.renderEffect = { glow: { color: 0xffc040, blur: 6, strength: 2 } };      // GlowFilter
card.renderEffect = { glow: { color: 0, alpha: 0.7, blur: 3, strength: 1, offsetX: 6, offsetY: 6 } }; // DropShadowFilter
button.renderEffect = { outline: { color: 0xe04040, width: 3 } };
gem.renderEffect = { glow: { color: 0xffffff, blur: 4, inner: true } };
ghost.renderEffect = { glow: { color: 0x40ff80, knockout: true } };
```

| Part | Fields | Defaults and limits |
| --- | --- | --- |
| `colorMatrix` | Twenty numbers: rows of red, green, blue and alpha, each four factors and an offset of 0 to 255, as Egret's | Applied to colour as it is seen, without its alpha multiplied in, so a matrix from an Egret project gives the same colours |
| `glow` | `color`, `alpha`, `blur`, `strength`, `inner`, `knockout`, `offsetX`, `offsetY` | alpha 1, blur 6 (0–16 logical pixels), strength 2 (0–255), offsets 0 (±256 logical pixels): Egret's defaults |
| `outline` | `color`, `width`, `alpha` | width 1–8 logical pixels; alpha 1 |

One effect has a glow or an outline, not both: nest two effects for both. A drop shadow is a glow with an offset; Egret's distance and angle are `offsetX = distance·cos(angle)` and `offsetY = distance·sin(angle)`. Offsets and spreads are in pixels of the surface, multiplied by the host's pixel ratio, and do not turn or scale with the object.

## How it is drawn

In linear premultiplied colour, for the group's colour `c` and alpha field `A`:

- **Spread.** One pass spreads `A`, read from where the offset moves it from, across into the group's scratch target, as an average for a glow or a maximum for an outline; the composite spreads it down the same way. The radius is `ceil(blur × ratio)` for a glow and `round(width × ratio)` for an outline, at most 16 backing pixels, as the blur's. An outline is square at its corners.
- **Colour matrix.** `v = (encode(c.rgb / c.a), c.a)`; the output is `clamp(M·v + offset/255)`, decoded and premultiplied again.
- **Glow.** `k = min(1, g·strength)·alpha` (for an outline `k = g·alpha`); the glow `(colour·k, k)` goes under the group: `c + glow·(1 − c.a)`, or `glow·(1 − c.a)` with knockout.
- **Inner glow.** `k = min(1, (1 − g)·strength)·alpha` inside the group: `c.rgb·(1 − k) + colour·k·c.a`, the alpha kept; with knockout the inner glow alone.

The group then takes its mask and clips and is drawn over its parent with normal source-over, as before. A group's uniform grows from 448 to 576 bytes; the limits of eight groups, four levels and two targets a level are unchanged, and a WebGPU device needs three sampled textures a stage for effects.

## Errors

| Code | When |
| --- | --- |
| `DISPLAY_EFFECT_INVALID` | A matrix not of twenty finite numbers, a glow or outline outside its limits, or both in one effect |

## What was run

| What | Where | Result |
| --- | --- | --- |
| Descriptors copied and frozen with Egret's defaults, every limit refused one at a time, what a frame carries for each kind of effect, the uniform of each group (matrix rows and offsets, spread in backing pixels, colour in linear light, offsets rounded, the 16-pixel cap), and both hosts' shader sources | Node, [`tests/filters.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/filters.test.mjs) | 4 cases |
| The effect tests already in the repository, with the larger uniform | Node | 323 cases |
| The example: sixteen places around each of six tiles — inside, at each side, a corner and further out — against values worked out independently from the equations, within 2 of 255; and the same places with the effects removed | Headless Chromium 153, software WebGL2 | 2 scenarios |
| WebGPU in a browser, a hardware GPU, a phone, the cost of many glowing groups a frame | — | Not run |

## Not in this slice

- Custom shader filters; backdrop blur; a blur of different width across and down (Egret's `blurX` and `blurY` are one `blur` here); quality levels; a glow that turns with its object.
