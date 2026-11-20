# Filters

English | [简体中文](../../Cns/docs/filters.md)

A render effect can now change what a subtree draws in the ways Egret's filters did: a colour matrix, a glow, a drop shadow and an inner glow, and an outline. They run in the existing effect group — the subtree drawn into a target of its own — after its blur and before its mask and clips, on both shared hosts, WebGL2 and WebGPU. Like the blur, they need a host made with `enableEffects: true`.

The original checks used Node and headless Chromium with software WebGL2. See the [Shared 2D hardware results](shared-2d-hardware-results.md) for the later native Windows and Android evidence and its workload limits.

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

## Masks of shapes

`renderEffect = { shapeMask: sprite }` masks a node by a shape, as Egret's `mask = displayObject` did: what the node and its children draw shows only where the sprite's Graphics covers, and partly where its fill is translucent.

```js
const window = scope.use(new Sprite());
window.graphics.beginFill(0xffffff).drawCircle(80, 80, 60).endFill();
picture.renderEffect = { shapeMask: window };     // picture shows through the circle
window.x = 40;                                    // the mask moves; the next frame shows it
```

- The mask is placed as if it were a child of the masked node: its `x`, `y`, scale, rotation and skew count; its alpha and visibility do not. Only its own drawing counts, not its children's.
- It need not be on the stage. If it is, it is not drawn there while it masks, as in Egret; once no node takes it as a mask it is drawn again.
- It is drawn on the CPU as an image of its alpha, at twice the size the masked node is seen at, up to 2,048 pixels a side, and that image masks as an `alphaMask` does. It is drawn again when the mask's drawing or place changes, or when the node's size on the screen changes by more than a step of a fifth or so; otherwise the same image is used. A mask that is redrawn every frame costs a new image every frame.
- One effect has an `alphaMask` or a `shapeMask`. It can share the effect with a blur, a colour matrix, a glow or an outline. A mask that draws nothing hides everything.
- `createBrowserGame({ effects: true })` makes a game's host with effects on.

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
| Hardware WebGPU and WebGL2, including multiple groups and native device recovery | Windows and Android evidence | [Shared 2D hardware results](shared-2d-hardware-results.md) |

## Not in this slice

- Custom shader filters; backdrop blur; a blur of different width across and down (Egret's `blurX` and `blurY` are one `blur` here); quality levels; a glow that turns with its object.
