# Blend modes

English | [简体中文](../../Cns/docs/blend-modes.md)

`DisplayObject.blendMode` decides how what an object and its children draw is combined with what is already under it, by the names Egret used: `normal`, `add`, `multiply`, `screen` and `erase`. Both shared hosts, WebGL2 and WebGPU, draw every mode; nothing has to be enabled.

**What is checked and what is not.** The modes are checked in Node and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/blend-modes/README.md) in headless Chromium with software WebGL2, where each pixel is compared with the value worked out from its equation. WebGPU was not drawn in a browser here: headless Chromium offers a SwiftShader adapter but drops its instance while a frame is checked, for every example alike. No hardware GPU or phone was run. See [What was run](#what-was-run).

## Use

```js
spark.display.blendMode = 'add';      // particles that brighten where they overlap
shadow.blendMode = 'multiply';        // darken what is under it
light.blendMode = 'screen';           // lighten softly
hole.blendMode = 'erase';             // take away what is under it, by its alpha
```

A mode applies to the object and everything under it, as the material does, unless a child sets its own. It is the blend of the object's `sharedMaterial`: setting it keeps the material's tints and filtering and replaces only the blend, and setting a material afterwards is what the mode then reads. `normal` on an object without a material leaves it without one.

| Mode | Material blend | What it gives, in linear premultiplied colour, source `S` with alpha `a` over destination `C` |
| --- | --- | --- |
| `normal` | `normal` | `S + C(1 − a)` |
| `add` | `add-accumulate` | `S + C`, alpha added too |
| `multiply` | `multiply-factor` | `S·C + C(1 − a)` |
| `screen` | `screen` | `S + C(1 − S)` |
| `erase` | `erase` (new) | `C(1 − a)`, alpha too: the source's colour is not used |

The equations are those of the [shared render profile](shared-render-profile-contract.md), in linear light, so they are not the gamma-space results of Egret's old WebGL renderer: an `add` of two mid colours is brighter here. `erase` on the stage takes away the background too, and the page shows through the canvas; to cut a hole in one picture only, erase inside a container with a render effect, whose group has a transparent target of its own. A material named `add-preserve` reads as `add`.

## Errors

| Code | When |
| --- | --- |
| `DISPLAY_VALUE_INVALID` | A mode that is not one of the five |

## What was run

| What | Where | Result |
| --- | --- | --- |
| Reading and setting each mode, tints and filtering kept, the same mode again changing nothing, materials set afterwards, refused names, a disposed object; modes captured for each draw beneath a container and a child's own mode kept; `erase` in the material contract, the WebGL2 blend factors and the WebGPU blend state of every mode | Node, [`tests/blend-modes.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/blend-modes.test.mjs) | 3 cases |
| The example: each mode over the same panel compared with its equation within 3 of 255, the panel itself, sparks under an `add` container at one, two and three overlaps, and the same sparks flat in `normal` | Headless Chromium 153, software WebGL2 | 2 scenarios |
| WebGPU in a browser, a hardware GPU, a phone | — | Not run |

## Not in this slice

- Modes that read the destination in a shader, such as overlay, darken, lighten or difference.
