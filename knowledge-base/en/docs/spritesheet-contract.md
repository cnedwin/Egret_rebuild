# Named SpriteSheet contract — SS1

English | [简体中文](../../Cns/docs/命名图集契约.md)

Engineering preview 0.45.0. This first-party increment gives named icons and sequence animation one immutable rectangle table over one genuine atlas lease. It adds `createSpriteSheet` and the type-only `SpriteSheet` / `SpriteSheetFrameInput` to the built Engine and Runtime roots. It introduces no dependency, public subpath, Engine instance method or second animation clock.

This SS1 reading describes the established default rectangle path. The optional third `'trim-rotation-v1'` argument extends `createSpriteSheet` with normalized trim/clockwise90 layout; omitted or `undefined` profiles preserve the behavior below. See the separate [layout contract](atlas-frame-layout-contract.md) and [evidence](atlas-frame-layout-evidence.md); the original SS1 evidence keeps its scope.

## Public interface

```ts
createSpriteSheet(
  atlasLease: AssetLease<Texture>,
  frames: readonly SpriteSheetFrameInput[],
): SpriteSheet;

interface SpriteSheetFrameInput {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

The opaque, frozen `SpriteSheet` facade has readonly `frameCount`, `names`, `atlasWidth`, `atlasHeight` and `isDisposed`; `getRegion(name)`, `createBitmap(name)` and idempotent `dispose()`. Methods and getters require their exact original receiver. Borrowing a method onto another sheet is invalid. The public type has no constructible class or exposed assembly port.

## Input and bounds

The lease must be a genuine live manager-issued `AssetLease<Texture>` associated with a genuine open Engine context. Its Texture must represent the entire image: origin zero and dimensions equal to the image. A cropped Texture is refused. Existing legitimate Runtime context assembly remains supported; admission does not depend on a private list of Engine class instances. Sheet creation acquires no new lease and releases none.

The frame array has 1–1024 own indexed records and an own length. Each record must be a non-null object, excluding arrays and functions, with own `name/x/y/width/height` fields. Extra fields are ignored without being read. The five fields are staged in that order; semantic validation follows the complete staged table. A structurally absent array slot or non-record is refused at that point. Each successful caller-controlled operation is followed by a live-resource check; that check is outside the source-operation catch.

Names are exact strings of 1–128 UTF-16 code units, with at most 32768 units across the table. Case, whitespace, surrogate code units and `__proto__` are retained without trimming or normalization. Duplicate exact names are invalid. Input order determines `names`. Coordinates are safe integers: `x/y >= 0`, `width/height > 0`; sums must remain safe and inside the image. Negative zero becomes zero. Overlapping rectangles and different names for the same rectangle are allowed; rotation, trimming, pivots and atlas packing are outside SS1.

The sheet owns frozen metadata and regions. Caller changes to the array or records cannot change the published table. Unknown fields do not become metadata. This is an owned copy contract, rather than a physical memory or garbage collection claim.

## Resource ownership and lifetime

`getRegion` returns the owned frozen rectangle for an exact name. Metadata and valid lookups remain readable after sheet disposal, lease release, Texture disposal or Engine close.

`createBitmap` returns a genuine caller-owned Bitmap using the same original lease and the named crop. Each call returns a fresh object. The sheet does not cache it or put it into a Scope. The caller should immediately adopt it into a Scope. Disposing the sheet revokes further Bitmap creation and drops its live lease/image references; it neither releases the lease nor disposes caller Bitmaps. Existing Bitmaps and a sequence controller may therefore continue while their own resources remain live.

Creation checks the exact receiver, sheet disposal, Engine openness and same-sheet reentry before consulting the live atlas and requested name. Its busy guard covers construction and crop application. A successful trusted operation is followed by another lifetime check before publication. On failure after construction, the local Bitmap is retired once; a constructor failure before a returned handle does not invent cleanup. The primary code/cause is retained, including a caller throwing `undefined`; associated cleanup failures are retained separately.

The internal Bitmap seam captures only the original construct/crop/dispose operations. Its bounded prototype qualification concerns replacing Bitmap's `sourceRect` setter or `dispose` method before/after sheet entry initialization. It makes no general guarantee against changes to ancestor classes or JavaScript intrinsics. This seam is absent from the public roots.

## Public composition

The lease below is already acquired from the real Engine asset manager and owned by a caller resource Scope; its image is the original 6×2 atlas. The running example includes original pixels, provider registration and complete cleanup.

```ts
import { createSequenceClip, createSpriteSheet } from '@egret/engine';

const sheet = resources.use(createSpriteSheet(lease, [
  { name: 'red', x: 0, y: 0, width: 2, height: 2 },
  { name: 'green', x: 2, y: 0, width: 1, height: 2 },
  { name: 'blue', x: 3, y: 0, width: 3, height: 1 },
  { name: '__proto__', x: 3, y: 0, width: 3, height: 1 },
]));
const actor = resources.use(sheet.createBitmap('red'));
const icon = resources.use(sheet.createBitmap('__proto__'));
engine.stage.addChild(actor);
engine.stage.addChild(icon);
const clip = createSequenceClip({
  atlasWidth: sheet.atlasWidth, atlasHeight: sheet.atlasHeight,
  frames: [
    { ...sheet.getRegion('red'), durationSeconds: 0.125 },
    { ...sheet.getRegion('green'), durationSeconds: 0.25 },
    { ...sheet.getRegion('blue'), durationSeconds: 0.125 },
  ],
});
engine.advanceTime(0); // Absolute source baseline; no tick.
const playback = engine.createSequencePlayback(animation, actor, clip);
playback.start();
engine.advanceTime(0.125); // Absolute source time; selects green.
sheet.dispose(); // Existing caller-owned Bitmaps keep their lease.
```

Run `node examples/spritesheet-headless.mjs` from the repository root. Its recording host exercises public composition and explicit clock advancement. Capture and rendering do not advance the animation clock; the example does not draw native pixels.

## Refusal families and acceptance

| Refusal | Meaning |
| --- | --- |
| `SPRITE_SHEET_LEASE_INVALID` / `SPRITE_SHEET_ATLAS_INVALID` | Invalid lease identity / full-image atlas admission |
| `SPRITE_SHEET_INPUT_INVALID` | Array, record, required-field or primitive type refusal |
| `SPRITE_SHEET_NAME_INVALID` / `SPRITE_SHEET_LIMIT` | Empty/duplicate name / frame or UTF-16 limits |
| `SPRITE_SHEET_REGION_INVALID` / `SPRITE_SHEET_FRAME_UNKNOWN` | Invalid rectangle / absent exact name |
| `SPRITE_SHEET_READ_FAILED` | Caller-controlled source operation threw; exact cause retained |
| `SPRITE_SHEET_INVALID` / `SPRITE_SHEET_DISPOSED` / `SPRITE_SHEET_REENTRANT` | Receiver / revocation / same-sheet creation guard |
| `SPRITE_SHEET_BITMAP_FAILED` | Trusted Bitmap construction/crop operation threw |

Existing Engine, Texture and lease lifetime errors keep their own authority. A successful source getter that terminates a resource yields the terminal lifetime refusal; it is not mislabeled as a source-read exception. Later staged source exceptions can precede earlier semantic errors because complete staging comes first.

SS01–SS10 denote specification families, not Node test counts. Public behavior, controlled original-operation units, exact consumer diagnostics, package policy, recording example, native opaque pixels and final delivery have separate evidence lanes. See the [verification reading](spritesheet-evidence.md). Full Spine R020/V020, migration R008/V006, complete UI/EUI, phone/native SDK and performance acceptance remain separate.
