# Examples

English | [简体中文](README.zh-CN.md)

The 56 examples of this checkout, by what they show. Each has its own page with how to run it and what to try. "Checked" means the example has a `verify.mjs` that drives it in a real browser and reads the result; its page says what that check covers.

Each example's page gives the command it is run with. Most are served like this, from the repository root:

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Then open `/examples/<name>/index.html` on the host and port the server prints.

## Start here

| Example | Folder | Checked |
| --- | --- | --- |
| [Starter](starter/README.md) | `starter` | Yes |
| [Play: three whole games](play/README.md) | `play` | Yes |
| [Responsive Egret examples](mobile/README.md) | `mobile` | — |
| [Egret Outfit Studio](outfit-studio/README.md) | `outfit-studio` | Yes |
| [Canvas Rectangle Example](canvas-scene/README.md) | `canvas-scene` | — |

## Display and rendering

| Example | Folder | Checked |
| --- | --- | --- |
| [Blend modes](blend-modes/README.md) | `blend-modes` | Yes |
| [Filters](filters/README.md) | `filters` | Yes |
| [Graphics](graphics/README.md) | `graphics` | Yes |
| [Display picking example](hit-test/README.md) | `hit-test` | — |
| [Isometric map with WebGL2](isometric-map/README.md) | `isometric-map` | — |
| [Prepared subtree example](prepared-subtree/README.md) | `prepared-subtree` | Yes |
| [Bitmap resource replacement](bitmap-resource-slot/README.md) | `bitmap-resource-slot` | — |

## 2D world

| Example | Folder | Checked |
| --- | --- | --- |
| [A 2D camera](camera-2d/README.md) | `camera-2d` | Yes |
| [A tile map](tilemap/README.md) | `tilemap` | Yes |
| [Particles](particles/README.md) | `particles` | Yes |
| [2D physics](physics-2d/README.md) | `physics-2d` | Yes |
| [Bitmap fonts](bitmap-font/README.md) | `bitmap-font` | Yes |

## Content and animation

| Example | Folder | Checked |
| --- | --- | --- |
| [From source to motion](content-build/README.md) | `content-build` | — |
| [Editable animation and outfit reference](animation-outfits/README.md) | `animation-outfits` | Yes |
| [Explicit-time sequence example](sequence-player/README.md) | `sequence-player` | — |
| [Sequence controls](sequence-controls/README.md) | `sequence-controls` | Yes |
| [Sequence RESET example](sequence-reset/README.md) | `sequence-reset` | Yes |
| [Multipage atlas example](atlas-pages/README.md) | `atlas-pages` | — |
| [Atlas import playback composition](atlas-import-playback/README.md) | `atlas-import-playback` | — |
| [Anchored atlas playback playground](anchored-atlas-playback/README.md) | `anchored-atlas-playback` | — |
| [Trimmed atlas playback](trimmed-atlas-playback/README.md) | `trimmed-atlas-playback` | — |
| [Spine asset version RESET](spine-reset/README.md) | `spine-reset` | Yes |
| [Resource scene](resource-scene/README.md) | `resource-scene` | — |
| [Prepared resource groups](prepared-resource-groups/README.md) | `prepared-resource-groups` | — |

## Input

| Example | Folder | Checked |
| --- | --- | --- |
| [Primary mouse Canvas example](mouse-input/README.md) | `mouse-input` | — |
| [Multi-pointer example](multi-pointer/README.md) | `multi-pointer` | — |
| [Hover and wheel](pointer-hover/README.md) | `pointer-hover` | Yes |
| [Shared-input bitmap buttons](bitmap-button/README.md) | `bitmap-button` | — |
| [Text input over a canvas](text-input/README.md) | `text-input` | Yes |

## Text

| Example | Folder | Checked |
| --- | --- | --- |
| [Explicit Canvas text example](canvas-text/README.md) | `canvas-text` | — |
| [Paragraph geometry example](paragraph-geometry/README.md) | `paragraph-geometry` | — |
| [Readonly paragraphs in UI](paragraph-panel/README.md) | `paragraph-panel` | — |
| [Native editing in managed UI](text-editing/README.md) | `text-editing` | — |

## UI

| Example | Folder | Checked |
| --- | --- | --- |
| [Explicit local linear layout](linear-layout/README.md) | `linear-layout` | — |
| [Control states](ui-controls/README.md) | `ui-controls` | Yes |
| [Settings screen](ui-settings/README.md) | `ui-settings` | Yes |
| [Tabs and progress](ui-tabs/README.md) | `ui-tabs` | Yes |
| [Amounts in steps](ui-stepper/README.md) | `ui-stepper` | Yes |
| [Text fields](ui-text-field/README.md) | `ui-text-field` | Yes |
| [Dropdown in a list](ui-dropdown/README.md) | `ui-dropdown` | Yes |
| [A menu for a row](ui-context-menu/README.md) | `ui-context-menu` | Yes |
| [Several of a list](ui-multi-select/README.md) | `ui-multi-select` | Yes |
| [A bag of items](ui-inventory/README.md) | `ui-inventory` | Yes |
| [A table that sorts](ui-roster-table/README.md) | `ui-roster-table` | Yes |
| [A tree that opens and closes](ui-tree/README.md) | `ui-tree` | Yes |
| [UI data panel example](ui-data-panel/README.md) | `ui-data-panel` | Yes |
| [Key-directed virtual-list navigation](ui-key-navigation/README.md) | `ui-key-navigation` | Yes |
| [List semantics](ui-list-semantics/README.md) | `ui-list-semantics` | Yes |

## Sound and video

| Example | Folder | Checked |
| --- | --- | --- |
| [Music and effects](audio-mixer/README.md) | `audio-mixer` | Yes |
| [Video](video/README.md) | `video` | Yes |

## 3D

| Example | Folder | Checked |
| --- | --- | --- |
| [World3D example](world3d/README.md) | `world3d` | — |
