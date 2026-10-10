# Bitmap region contract

[简体中文](../../Cns/docs/bitmap-region-contract.md) · [API and naming](public-api-design-and-naming.md) · [CPU sequence contract](sequence-clip-contract.md)

`Bitmap.sourceRect` now lets one Bitmap change its crop while borrowing one atlas lease. The first-party implementation passed build, **113/113 focused CPU checks** and the selected type checks; independent source and saved-CPU review found no actionable P1/P2 issue. See the [bounded evidence](bitmap-region-evidence.md). This evidence curation contains no successor complete prepush; a fresh prepush must pass before any push. Native visible-sequence verification remains **UNRUN** at this checkpoint; this contract does not claim a runnable animation player.

## Coordinates, resets and ownership

The implemented member uses the existing `TextureRegion2D` type:

```ts
get sourceRect(): TextureRegion2D | undefined;
set sourceRect(value: TextureRegion2D | undefined);
```

The getter returns frozen, read-only metadata for the effective region in absolute `ImageData2D` coordinates. A region must fit both the authentic image and the Texture's original `sourceRect`; a restricted Texture cannot expose pixels outside its own view. For original view `(10,20,8,6)`, `(12,21,2,3)` is valid; `(2,1,2,3)` is not a relative shorthand. Selecting a region leaves Texture unchanged. Local destination geometry starts at `(0,0)` and `naturalWidth`/`naturalHeight` equal the selected width/height. Atlas x/y do not become display offsets.

| Operation | Required result |
| --- | --- |
| Construction or successful `textureLease` assignment, including the same lease | Select the Texture's entire original view. |
| `sourceRect = undefined` with a bound live lease/Texture | Reset to the original view. |
| `sourceRect = undefined` with an empty slot | No-op after receiver, node, Engine and mutation-guard checks. |
| A region assigned to an empty slot | `BITMAP_TEXTURE_REQUIRED` before reading region fields. |
| Clear `textureLease`, or dispose Bitmap | `sourceRect` becomes `undefined`; natural sizes become zero; no pending crop survives. |
| Failed lease replacement or region validation | Preserve the previous lease, crop, sizes and Engine affinity; external side effects retain their own effects. |

Bitmap borrows the exact `AssetLease<Texture>`; it never acquires or releases one implicitly. The caller owns release. Clearing or disposing Bitmap drops its borrow and retains its established Engine affinity. Two borrowers can select different crops; independently acquired leases keep independent entitlement. Asset invalidation does not revoke a still-active earlier lease.

While an undisposed Bitmap remains bound, its cached region and natural sizes remain readable after lease release, Texture disposal or Engine closure. Reading metadata grants no live image entitlement. Any bound region mutation, including reset, requires the exact live lease/Texture and an open Engine. Clearing the lease remains allowed after release while the node and Engine remain open.

## Atomic mutation and error priority

Both setters share one private per-Bitmap mutation guard. Initial checks occur in this order: authentic receiver (`BITMAP_INVALID`), node liveness (`OBJECT_DISPOSED`), Engine openness (`ENGINE_CLOSED`), then reentrancy (`BITMAP_MUTATION_REENTRANT`). A bound region assignment checks the exact lease entitlement and live Texture before reading external fields.

A non-null object supplies `x`, `y`, `width`, `height`, read once in that order. Known inherited fields are allowed; unknown fields are ignored. No iteration or coercion occurs. All four successful reads finish before numeric validation. Values must be primitive safe integers: nonnegative x/y, positive width/height, safe extents and absolute containment. Coordinate negative zero becomes positive zero. Shape, numeric and containment faults use `BITMAP_REGION_INVALID`. A throwing getter uses that code with its exact original `cause`, including `undefined` or an error-shaped object; error-like fields do not classify the cause. Allocation failures escape without committing.

After successful reads, the setter rechecks node, Engine, unchanged slot and exact live lease/Texture **before** validating the captured numbers. Crop and sizes commit together without callbacks. Getter-driven disposal therefore yields `OBJECT_DISPOSED`; Engine closure yields `ENGINE_CLOSED`; lease release and Texture disposal retain `ASSET_LEASE_RELEASED` and `TEXTURE_DISPOSED`. These post-read failures outrank invalid captured numbers. If a getter itself throws, its wrapped read fault takes priority over post-read checks.

Nested region or lease mutation fails without changing the slot. A getter that catches the reentrancy error can let a valid outer update finish. Disposal is still allowed: it clears the borrow before listener cleanup, and the outer setter cannot restore it. The guard clears in `finally`. This transaction does not undo external disposal, release or unrelated display changes.

## Capture, saved frames and finite budgets

Capture uses private authenticated state, never subclass-overridable public getters. It checks cached selected geometry before inherited-alpha suppression and entitlement, retaining existing painter, suppression and legacy-error priorities. Each visible capture resolves the exact lease again; its command and view budget use the selected crop. Saved commands copy/freeze that crop and retain immutable image values rather than a live Bitmap slot, lease or Texture wrapper. Later input mutation, crop changes, release, invalidation or shutdown cannot rewrite a saved frame. Replay to a compatible host is separate from certifying native output.

Existing `IMAGE_LIMITS_2D` remain unchanged: source edge 4096, source pixels 1,048,576, at most 64 image identities and 128 distinct views per frame, 16,777,216 bytes each for image tables and projections, and 33,554,432 bytes each for scratch and pending texture work. A view is image identity plus absolute `(x,y,width,height)`; identical views deduplicate within a capture. A fresh capture starts a fresh ledger. These limits do not bound caller-retained saved frames, garbage-collection timing or total process/driver memory.

## Historical manual sequence path and remaining work

The paragraphs below describe the 0.19.0 manual path. The later [SequencePlayer contract](sequence-player-contract.md) adds public explicit-time binding to a full-image atlas and eager dimension matching; it does not introduce a scheduler.

The internal CPU sequence sampler remains outside package barrels. The bounded CPU usage uses one full-image atlas Texture, one acquired lease and one Bitmap. Clip dimensions come from the authentic image. A bounded caller supplies elapsed seconds and fixed owned options, samples a region, assigns it through the intrinsic Bitmap setter, then captures or renders. Sampling and assignment are separate operations, not a transaction around arbitrary option getters. No per-frame Texture, asset acquisition, release or invalidation is required. Engine has no clock or `onFrame` API; `HostAdapter.setTimeout` is cancellable timing, not a frame loop. No public player or scheduler is added.

For a 6×2 atlas, regions `(0,0,2,2)`, `(2,0,1,2)`, `(3,0,3,1)` with durations `0.125/0.25/0.125` select sizes `2×2/1×2/3×1` at seconds `0/0.125/0.375`. At `0.5`, `once` retains the last region and `loop` selects the first. Pure clip declarations alone grant no image authority. Relative subatlas sequence binding, dimension reconciliation and eager validation of every frame against a bound Texture require future contracts.

Applying placement offsets with crop, labels/events, blank or trimmed/rotated frames, loaders/decoding, skeleton/DragonBones, complete migration, editors, Native SDKs, devices and performance remain open. R008/V006 and V003 obligations remain. This member is a public API addition to the already-exported Bitmap; private capture readers and the sampler stay internal; the later clip factory/player exports have their own contract. Package 0.0.0, protocol 1.0 and existing license/attribution obligations retain their scope. Native visible-sequence proof and publication remain separate pending steps.
