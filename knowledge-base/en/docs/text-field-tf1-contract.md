# TextField TF1: explicit-line display and resource contract

English | [简体中文](../../Cns/docs/文字显示TF1契约.md) · [Text raster T1 contract](text-raster-t1-contract.md)

TF1 specifies a noneditable display leaf for explicit source lines and one complete uniform T1 request. It joins the existing text cache, genuine Texture caller leases, owned ImageData2D, display bounds and CPU image commands. This contract defines required behavior; it does not report completed verification, native font quality or complete UI acceptance.

## Explicit entry and authentic creation

Use `@egret/engine/text`. It adds `createTextField` as a value and `TextField`/`TextFieldStatus` as type-only exports. Its runtime values are exactly `createTextRasterCache` and `createTextField`; the existing cache factory identity is preserved. `@egret/runtime/text` retains only `createTextRasterCache` as a runtime value. Default package roots remain unchanged. There is no new subpath, dependency, public ownership handle, host method, scheduler or timer.

```ts
import { createTextField } from '@egret/engine/text';
import type { TextField, TextRasterRequestInput } from '@egret/engine/text';

// Supply a genuine Engine, its Scope, and a cache made from engine.assets.
const field: TextField = createTextField(engine, scope, cache);
field.setRequest(input as TextRasterRequestInput);
await field.prepare();
engine.stage.addChild(field);
// The Scope owns the field; the application still owns the shared cache.
```

This sketch is not a complete provider or runnable example. The factory signature is `createTextField(engine: Engine, scope: Scope, cache: TextRasterCache): TextField`. Creation requires the genuine Engine, a Scope created by that Engine, and a genuine cache belonging to the same Engine's authentic AssetManager. Lookalikes, proxies, borrowed receivers, public same-name state shadows and replaced public methods cannot supply identity or lifecycle authority. Unauthorised direct construction refuses before display creation, cache access or Scope ownership is installed. The factory's private creation authority is not a caller option or public constructor.

`TextField` is an opaque factory-produced type extending `DisplayObject`. It inherits display operations and adds:

| Operation | Required behavior |
| --- | --- |
| `setRequest(input: TextRasterRequestInput): void` | Synchronously adopts ten immutable scalars; no cache acquisition or provider work. |
| `prepare(): Promise<TextRasterMetrics>` | Explicitly acquires the current desired revision, even if that revision was previously committed. |
| `getStatus(): TextFieldStatus` | Returns a fresh frozen readonly snapshot, including after disposal. |
| `dispose(): void` | Idempotent synchronous terminal cleanup of this field. |

Status contains only readonly `state: 'unprepared' | 'ready' | 'disposed'`, `desiredRevision: number`, `committedRevision: number | undefined`, `pending: boolean` and `metrics: TextRasterMetrics | undefined`. It exposes no cache, lease, provider plan, mutable source or image buffer. Initially the desired revision is 0, committed revision and metrics are undefined, and pending is false. Every successful setter advances the desired revision, including identical input. Revisions are safe integers; advancing beyond `Number.MAX_SAFE_INTEGER` refuses without changing state. Ready means some result has committed, including an empty result; it remains ready while a replacement is pending or fails. Disposed status preserves final revisions and saved immutable metrics with pending false.

## Ten-scalar admission and reentry

Reads occur once in this order: `text`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `locale`, `direction`, `density`, `fillColor`. TF1 retains T1 admission:

| Scalar | Admitted values |
| --- | --- |
| `text` | Well-formed UTF-16, at most 8192 code units and 64 explicit source lines. |
| `fontFamily` | Nonempty string, at most 256 code units, under T1's control-character policy. |
| `fontSize` | Finite number from 1 through 512. |
| `fontWeight` | Integer from 1 through 1000. |
| `fontStyle` | `normal` or `italic`. |
| `lineHeight` | Finite number from 1 through 1024. |
| `locale` | At most 64 ASCII code units, fully matching `[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*`. |
| `direction` | `ltr` or `rtl`; no shaping or bidi algorithm is promised. |
| `density` | Finite number from 0.5 through 4. |
| `fillColor` | Integer from 0 through `0xffffff`. |

LF, CRLF and CR remain distinct exact source ranges; a terminal delimiter adds an empty final line. There is no trimming, normalization or automatic wrapping. T1 refuses unsupported controls and unpaired surrogates while admitting its defined Han, combining, Arabic, ZWJ/ZWNJ and variation-selector subset without claiming font coverage. The immutable scalar copy does not retain the caller's record.

Live admission checks field disposal, intrinsic Engine openness and intrinsic Scope openness before the short same-field request guard. A nested setter refuses synchronously with `TEXT_FIELD_BUSY` before reading its input. A nested prepare rejects with that code before checking desired/pending state or starting cache work. Other fields remain independent; status and disposal remain available. The guard retires in finally on every path and before post-commit cancellation callbacks.

After all ten reads succeed, lifetime is rechecked before numeric/semantic validation and revision commitment. A thrown getter uses T1's `TEXT_REQUEST_INVALID` with the identical cause, even when that getter also disposes an owner. Caller getter effects are not rolled back. Refused admission leaves desired, pending and committed field state unchanged apart from those caller effects. An ordinary later setter may supersede an asynchronous preparation.

## Atomic preparation and ownership

Each field retains one committed caller lease or an empty committed layout, and at most one current demanded preparation. There is no implicit work, retry, work queue, revision history or per-field residency cache. Preparing without a desired request rejects `TEXT_FIELD_UNPREPARED`; a second current prepare rejects `TEXT_FIELD_BUSY`. Each explicit prepare uses the cache's current font generation. `cache.invalidate()` neither launches field work nor silently replaces visible content. TF1 adds no public cancellation port.

A successful setter replaces the desired revision and retires old pending authority before canceling that demand. Its old preparation rejects `TEXT_FIELD_SUPERSEDED`. Canceling one field cannot cancel another field's coalesced demand: shared work may use the same Texture, but successful fields own separate genuine caller leases. Pending replacement retains the old committed image, metrics and bounds.

A returned result is staged and genuine field/Engine/Scope/cache lifetime and current revision are rechecked. Current success atomically commits copied immutable metrics, raster placement and the genuine lease, or an empty layout without a lease, before releasing the old lease. Late or superseded delivery releases its caller lease and cannot republish. No-ink success clears drawing while preserving logical layout. Provider failure and its exact cause pass through without a silent blank placeholder or downscaling. Cleanup continues required attempts while preserving the first failure; release reentry cannot restore retired or terminal state.

The supplied Scope owns the field; detaching or reparenting changes display parentage, not ownership. Disposal makes display/state routing and pending demand terminal before external cancellation/release callbacks can reenter. It releases only this field's resources, leaving shared cache, provider, other fields, fonts and unrelated leases under their owners.

Scope enters closing before abort observers and reverse cleanup. Live field admission, current commitment and reached bounds/capture contributions require intrinsic Scope openness before accessing their contribution or lease. Closing/closed Scope uses `SCOPE_CLOSED`; Engine closure uses its existing lifecycle error. Capture preserves established visibility/alpha/clip skips, and cannot emit a closing Scope's image. Observational status need not report disposed until the field's actual cleanup occurs. Public same-name shadows do not reopen an owner. Engine cleanup does not wait indefinitely for arbitrary provider work: logical cancellation and actual settlement remain distinct, with the latter observable through T1 `cache.whenIdle()`. Saved immutable metrics and captured owned ImageData remain readable under their existing contracts after cleanup.

## Display, blank layout and density

Both `captureFrame`/`renderFrame` and `captureTexturedFrame`/`renderTexturedFrame` use the existing image command protocol, transforms, painter order, visibility, alpha and local clips. A committed image uses T1 `metrics.raster` x/y/logicalWidth/logicalHeight and the full pixel source rectangle. Density is already represented by that placement: no second density scale or alpha conversion occurs. Pixels retain straight-sRGB `rgba8unorm` semantics. The rectangle-only `collectFrameCommands` route refuses a would-be emitted image with `FRAME_IMAGE_UNSUPPORTED` after its existing skips. Empty/no-ink text emits no image command.

Bounds contribute exactly one committed `contentBounds` rectangle: logical layout union real ink, excluding the 2-raster-pixel allocation guard. Bounds do not depend on visibility or clips. A zero-width or zero-height rectangle still costs one primitive and contributes no corners; logical whitespace metrics remain available. The receiver's own and ancestor transforms are excluded. Descendants contribute four direct corners under their completed relative matrix, without repeatedly transforming intermediate AABBs. No hit test or automatic parent resize is added.

The T1 arithmetic witness has advance 8, baseline 5, ink (-1,-4,7,2) and line height 10. Density 1 gives 12×10 pixels, 480 image bytes and 960 scratch bytes. Density 1.5 gives 17×14, 952 and 1904, with placement (-8/3,-2/3,34/3,28/3). These are metadata formulas, not native glyph quality or performance measurements.

## Inherited budgets

TF1 increases no cap. Admission precedes added geometry, output and image allocation; hiding a child does not waive all-tree admission.

| Route or resource | Fixed limit |
| --- | --- |
| Bounds nodes | Default 4096; selectable integer 1–65536. |
| Bounds primitives | Default 65536; selectable integer 1–262144; blank committed rectangle costs one. |
| Textured route nodes / authoring units / source triangles | 65536 each; committed fields, including blank ones, add one authoring unit. Triangle limits retain their existing Mesh meaning. |
| Textured route unique geometries / logical geometry bytes | 128 / 16777216, unchanged. |
| Textured route commands / clip references | 65536 / 262144. |
| Image source edge / pixels | 4096 / 1048576; a T1 raster is at most 4194304 bytes. |
| Frame images / views | 64 / 128. |
| Image table / projection bytes | 16777216 each. |
| Image scratch / pending Texture bytes | 33554432 each, under the existing image contract. |

Bounds retain `BOUNDS_TREE_LIMIT` and `BOUNDS_CONTENT_LIMIT`. Textured all-tree limits apply before visible emission; ordinary frame capture retains its own existing image budgets and does not acquire the textured route's tree/geometry limits. T1 metric magnitude remains at most 1048576 with a guard of 2 raster pixels.

| T1 cache option | Default and hard maximum | Minimum |
| --- | ---: | ---: |
| `maxGenerations` | 64 | 1 |
| `maxPendingJobs` | 4 | 1 |
| `maxWaiters` | 128 | 1 |
| `maxCallerLeases` | 128 | 1 |
| `maxResidentEntries` | 32 | 0 |
| `maxMetadataBytes` | 2097152 | 4096 |
| `maxLogicalImageBytes` | 16777216 | 1 |
| `maxPendingRasterBytes` | 8388608 | 1 |

T1 options are safe integers: undefined selects the default; null is invalid. T1 keeps exactly 32 fixed routes and at most 8 pending idle observers. Current/retired generations, live callers, still-settling actors and quarantined charges retain their caps. Cancellation does not invent a refund for active work. These logical charges are not physical JS, Canvas, font or GPU memory measurements.

## Refusals and later work

| TF1 code | Meaning |
| --- | --- |
| `TEXT_FIELD_INVALID` | Wrong creation authority, unauthorised construction or forged receiver. |
| `TEXT_FIELD_DISPOSED` | A field-specific live operation after disposal. |
| `TEXT_FIELD_UNPREPARED` | Prepare before a desired request exists. |
| `TEXT_FIELD_BUSY` | Same-field request reentry or another current preparation. |
| `TEXT_FIELD_SUPERSEDED` | An old preparation's demand was replaced. |
| `TEXT_FIELD_REVISION_LIMIT` | Desired revision cannot safely advance. |

Factory, setter, status and disposal use synchronous channels; prepare failures reject its Promise. Existing Engine/Scope, T1 validation/capacity/provider/resource and display refusals retain their identities and original causes. The first failure is preserved while required cleanup proceeds.

This first-party design composes existing Egret text, resource, image, ownership and display contracts, with AI-assisted implementation. That declaration records a bounded process, not a certification of global originality or model training sources. Code and documentation retain Apache-2.0; existing third-party notices and research rights remain separate.

TF1 does not add editing, caret/selection/IME, text input/hit testing, automatic wrapping, rich text, font fallback/selection, shaping/bidi algorithms, glyph atlases/SDF, automatic layout/parent resize, EUI/EXML/widgets/virtual lists or legacy TextField property compatibility. It adds no host protocol or sampler change, 3D or Spine support. Complete UI, phones, Native SDKs, full migration, CJK glyph coverage and native font performance remain separate open requirements. CPU literal integration and separate bounded native font evidence cannot establish those outcomes.
