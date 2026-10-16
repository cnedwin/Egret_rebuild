# Trimmed and rotated atlas frames

English | [简体中文](../../Cns/docs/atlas-frame-layout-contract.md) · [Evidence and limits](atlas-frame-layout-evidence.md)

Egret Engine's normalized atlas-frame layout keeps a sprite's logical canvas stable when transparent margins are removed or its pixels are packed clockwise by 90 degrees. Icons and animation frames can share one packed image while retaining their original dimensions and placement. The existing Bitmap, SpriteSheet, SequenceClip and SequencePlayer/SequencePlayback APIs provide the composition; no additional animation clock is needed.

The **0.59.0 engineering preview candidate** has accepted SDK and bounded desktop Canvas/WebGPU evidence at the 2026-10-17 authoring cutoff. The [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md) demonstrates the public APIs. The linked evidence records the actual environments, controls and remaining delivery gates.

## Use the explicit profile

The two existing factories accept an optional primitive string profile:

```ts
createSpriteSheet(atlasLease, frames, profile?: 'trim-rotation-v1'): SpriteSheet;
createSequenceClip(input: unknown, profile?: 'trim-rotation-v1'): SequenceClip;

interface AtlasFrameLayout {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly packedRotation: 0 | 90;
}
```

`AtlasFrameLayout` is the only new erased type, exported type-only from the Engine and Runtime roots. Existing frame-input and region types gain optional `layout`; an opted-in sheet region has type `TextureRegion2D & { readonly layout?: AtlasFrameLayout }`. There is no new runtime export, package entry, dependency, Engine method or Host protocol field.

Omitting the profile or passing `undefined` preserves the existing rectangle path: `layout`, `rotated` and `trimmed` are not inspected, and regions retain exactly the four crop fields. Only the exact primitive `'trim-rotation-v1'` opts in. Other values are refused without coercion. This is a programmatic normalized-input contract, not automatic interpretation of an exporter format, JSON text, URL or file.

The example consumes the built `@egret/engine` entry. `lease` is an already acquired, caller-owned lease for a full 6×6 atlas Texture; `resources` and `animation` are genuine Scopes from the same `engine`. Register resources in lease → sheet → Bitmap order, with animation cleanup before resource cleanup.

```ts
import { createSequenceClip, createSpriteSheet } from '@egret/engine';

const sheet = resources.use(createSpriteSheet(lease, [
  { name: 'A', x: 0, y: 0, width: 2, height: 3,
    layout: { sourceWidth: 4, sourceHeight: 5,
      trimX: 1, trimY: 1, packedRotation: 0 } },
  { name: 'B', x: 3, y: 0, width: 2, height: 3,
    layout: { sourceWidth: 4, sourceHeight: 5,
      trimX: 1, trimY: 2, packedRotation: 90 } },
], 'trim-rotation-v1'));
const actor = resources.use(sheet.createBitmap('A'));
engine.stage.addChild(actor);
const clip = createSequenceClip({
  atlasWidth: sheet.atlasWidth, atlasHeight: sheet.atlasHeight,
  frames: [
    { ...sheet.getRegion('A'), durationSeconds: 0.125 },
    { ...sheet.getRegion('B'), durationSeconds: 0.25 },
  ],
}, 'trim-rotation-v1');
engine.advanceTime(0); // Establish the absolute source-time baseline.
const playback = engine.createSequencePlayback(animation, actor, clip,
  { mode: 'loop' });
playback.start();
engine.advanceTime(0.125); // Select B; logical dimensions remain 4×5.
```

`sheet.createBitmap` returns a fresh caller-owned Bitmap, so adopt it into a Scope immediately. A cropped Bitmap is a valid SequencePlayer target when its lease's Texture view is the full image and the clip's atlas dimensions match. The requirement concerns the Texture view, rather than the Bitmap's current crop.

## Input and owned metadata

In the explicit profile, every frame owns a complete `layout` record with all five own fields. A missing layout, null, array, function or missing field is invalid; there are no per-frame defaults. `sourceWidth` and `sourceHeight` are positive safe integers; `trimX` and `trimY` are nonnegative safe integers; `packedRotation` is the primitive number `0` or `90`. Negative zero is normalized to zero. Strings, rotation aliases, mirrors and other angles are not accepted.

The packed `x/y/width/height` keep the existing rules: nonnegative safe coordinates, positive safe dimensions, safe sums and a crop inside the atlas. At rotation 0 the visible unpacked size is `(width, height)`; at rotation 90 it is `(height, width)`. Both `trimX + visibleWidth` and `trimY + visibleHeight` must be safe integers and fit within the logical source dimensions. Empty frames and negative trim are refused.

The existing limits remain: 1–1024 frames; sheet names contain 1–128 UTF-16 code units and at most 32768 units in total, with exact duplicate names refused. Sequence durations are positive finite binary64 seconds whose cumulative ends remain finite and strictly increase after rounding. Layout does not change timing or these limits.

Factories copy and freeze the region and its five-scalar layout, retaining no caller object graph. Extra unknown fields are neither read nor retained. `getRegion` and `sample.region` use the same owned shape, so spreading a sheet region into an opted-in sequence frame preserves its layout. Sheet metadata remains readable after sheet disposal or resource retirement; this does not revive resources or establish physical memory behavior.

## Logical bounds and packed drawing

For the example, both frames have `naturalWidth === 4`, `naturalHeight === 5` and logical `getBounds()` of `(0, 0, 4, 5)`, including transparent margins. Their image-command `rect` remains `(0, 0, 2, 3)`, and `sourceRect` remains the original packed atlas crop. No logical-size pixel canvas is allocated by this contract. Bounds or visible pixels do not create an input region; mouse input still requires an explicit authored `hitArea`.

Let `M` be the existing display matrix, including parent transforms and anchor offsets. The packed-local placement matrix `S`, in `[a,b,c,d,tx,ty]` order, is:

| Packing | Local placement S |
| --- | --- |
| 0 | `[1, 0, 0, 1, trimX, trimY]` |
| Clockwise 90 | `[0, -1, 1, 0, trimX, trimY + packed.width]` |

Both `captureFrame` and `captureTexturedFrame` produce image matrix `M * S`, with finite composed coefficients and packed corners. `packed.width` means the packed crop width, not `sourceWidth`. Parent clips, scene-child traversal, coordinate conversion and anchor geometry retain `M`; the image-placement correction does not alter their coordinate system. Existing Canvas and textured WebGPU Hosts consume the unchanged command structure. Actual pixels require separate backend evidence.

## Applying frames and replacing bindings

The ordinary `Bitmap.sourceRect` setter ignores extra layout fields and clears any stored layout. Assigning `textureLease` also clears layout, including reassignment of the exact same lease. Applying a frame through `sheet.createBitmap` or `SequencePlayer.applyAt` restores the complete owned layout. The opted-in application prepares and commits crop, logical dimensions and layout together; `lastSample` changes only after application succeeds. A failure does not publish a partial frame or replace the previous sample, while external disposal side effects are not rolled back.

A player borrows its target's exact original lease. A distinct lease invalidates the old player with `SEQ_BINDING_CHANGED` even when both leases refer to the same Texture; clearing the binding does likewise. Reassigning the exact same lease permits the next application to restore the frame. Slot and ticket commits establish a new binding without old layout. Exact binding-state versions prevent an intervening frame application or a change-away-and-back from satisfying an obsolete prepared binding. These rules do not provide an atomic animated-resource retarget transaction.

Sheet, player and Bitmap borrow resource lifetime: the caller or AssetGroup owns the lease and Texture cleanup. Sheet/player disposal neither releases that lease nor disposes caller Bitmaps or Textures. A Scope can own the created objects in the existing reverse-cleanup order. Layout contains only scalars and conveys no resource ownership.

`once`, `loop`, pause and resume reuse the existing clock and sampler. A frame boundary selects the next frame; once retains the final frame at the duration, while loop wraps there. Paused resume immediately reapplies held elapsed time and rechecks the exact binding, without producing an extra clock tick. Capture, rendering and saved-frame replay do not advance time. No controller seek, rate or frame-event API is added.

## Contributor validation and failures

Profile validation follows sheet lease/full-atlas admission and precedes all frame reads; for clips it follows input-object admission and precedes own-field capture. In the opted-in sheet path, each record stages `name/x/y/width/height`, then `layout` and `sourceWidth/sourceHeight/trimX/trimY/packedRotation`; semantic checks follow staging of the whole table. Missing or invalid layout shape is staged, so a later source throw can precede an earlier layout error. Existing immediate array-hole/non-record refusals remain. Each successful caller-controlled sheet operation is followed by a live-resource recheck outside the source-read catch.

The clip captures each frame's `x/y/width/height/durationSeconds`, then its layout fields in the same layout order, and validates that frame before reading the next. An earlier invalid frame therefore prevents a later source read. The two schedules are intentional.

| Refusal family | Meaning |
| --- | --- |
| `SPRITE_SHEET_INPUT_INVALID` / `SEQ_INPUT_INVALID` | Invalid profile, layout record shape or missing own layout field |
| `SPRITE_SHEET_REGION_INVALID` / `SEQ_REGION_INVALID` | Invalid scalar, rotation, safe sum or logical/packed extent |
| `SPRITE_SHEET_READ_FAILED` / `SEQ_READ_FAILED` | Caller-controlled source operation threw; exact cause, including `undefined`, is retained |
| Existing sheet/player/resource/clock families | Their established identity, lifetime, limit, timing and application authority remains in force |

No new public error-class guarantee is introduced. An unsupported rotation is a region error; a missing opted-in layout is an input error. A successful getter that terminates a sheet resource yields the existing lifetime refusal rather than a source-read error. Existing trusted Bitmap-operation failures retain their primary cause and separate cleanup errors.

## Scope

This contract covers normalized single-page trim and clockwise90 packing through the existing runtime. Exporter adapters must separately validate their selected format and unsupported metadata before producing this shape. Exporter imports, multipage, pivots/nine-slice import, atomic animated-resource replacement, full Spine R020/V020 and legacy migration R008/V006 remain OPEN. Existing nine-slice APIs do not imply atlas-metadata import support.

Immutable saved-frame ownership includes owned pixels and complete placement matrices; distinct-Host replay requires its own real-browser evidence. It is not a device-loss, general recovery, physical-memory, GPU-retirement, mobile or performance guarantee. Those acceptance domains remain OPEN. First-party implementation and documentation use the existing repository runtime; [source records](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json) and [acknowledgements](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md) retain the applicable provenance and notices.
