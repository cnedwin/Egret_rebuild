# Text raster T1: provider and resource contract

English | [简体中文](../../Cns/docs/文字栅格T1契约.md) · [Recorded evidence](text-raster-t1-evidence.md)

Engineering preview **0.24.0** introduces the first text-resource orchestration slice. T1 defines a DOM-free provider protocol that joins measurement, bounded raster preparation, actual Texture leases and cleanup. Independent review closed six core findings in the recorded final source; bounded CPU behavior, image authority, private units and source-boundary controls passed. Strict types and complete existing core-source verification passed in their recorded scopes; final prepush and delivery are recorded separately in delivery verification. This contract describes required behavior, not blanket engine acceptance. See the paired evidence for each verified scope and preserved failure.

## Explicit entry and provider

Use `@egret/engine/text`; it forwards the DOM-free runtime text entry. Its only runtime value is `createTextRasterCache`. The normal Engine root, host interfaces and lifecycle remain unchanged. An application supplies a provider; T1 does not create a Canvas, load fonts, shape text or add a TextField.

```ts
import { createTextRasterCache } from '@egret/engine/text';
import type { TextRasterProvider, TextRasterRequestInput } from '@egret/engine/text';

const input: TextRasterRequestInput = {
  text: 'A', fontFamily: 'Test', fontSize: 16, fontWeight: 400,
  fontStyle: 'normal', lineHeight: 10, locale: 'und', direction: 'ltr',
  density: 1, fillColor: 0xffffff,
};
// engine and provider are supplied by the application.
const cache = createTextRasterCache(engine.assets, {
  provider: provider as TextRasterProvider, maxResidentEntries: 0,
});
const prepared = await cache.acquire(input);
if (prepared.kind === 'image') {
  const texture = prepared.lease.value;
  // Bitmap borrows this exact lease; the caller owns release.
  prepared.lease.release();
}
cache.dispose();
await cache.whenIdle();
```

This integration sketch is not a complete font provider or runnable example. Provider `identity` must match `[A-Za-z0-9._-]{1,64}` and `profile` is `canvas-explicit-lines-v1`. The cache snapshots the provider receiver and `measure`, `rasterize`, `release` functions. Later property replacement or a mutable callback `.call` cannot change those captured operations.

`measure(request, context)` receives a frozen owned request and one invocation-scoped `context.createPlan` capability. That capability issues at most one authentic plan. `rasterize(plan, context)` receives the owned plan, cancellation signal and admitted image/scratch byte reservations; it returns authentic `ImageData2D`, or undefined for a no-ink plan. `release(plan)` is attempted once after the final measure/raster use settles, before successful public delivery. A structural, proxied, foreign or replayed plan has no issuer authority.

## Exact request and signed layout

The key preserves all ten request fields, provider identity/object/profile, the fixed straight-sRGB RGBA8 policy and explicit `fontGeneration`. No trimming, normalization or automatic density substitution occurs. `invalidate()` advances font generation and retires metrics/raster routing together; it does not detect system-font changes.

Text is well-formed UTF-16, at most 8192 code units and 64 explicit source lines. LF, CRLF and CR are preserved as exact source ranges; a terminal delimiter adds an empty final line. The finite control-character admission policy preserves Han, combining sequences, Arabic, ZWJ/ZWNJ and variation selectors without claiming glyph coverage or shaping. Family length is at most 256; locale is at most 64 ASCII code units under the recorded finite locale pattern.

Signed ink and overhangs remain separate from logical whitespace bounds. Baseline and per-line advance/ink metrics define owned logical, ink and content bounds. Raster edges use floor/ceil at the requested density plus a guard of 2 raster pixels. Each edge is at most 4096, pixels at most 1048576 and bytes at most 4194304. These are allocation ceilings and a defined padding policy, not measured font tolerances.

The frozen one-line witness has advance 8, baseline 5, ink (-1,-4,7,2) and line height 10. At density 1 it gives 12×10, image bytes 480 and scratch bytes 960; at density 1.5 it gives 17×14, 952 and 1904, with placement (-8/3,-2/3,34/3,28/3). These expected values are metadata arithmetic, not native glyph pixels. A no-ink result preserves layout, reserves zero image/scratch bytes, still calls rasterize/release and returns `kind: 'empty'` with no lease.

## Fixed routing and independent budgets

One committed cache lifetime belongs to one authentic AssetManager. It reserves exactly 32 reusable refs, `egret.text-raster.t1.slot.00` through `.31`, under a dedicated private type. Namespace collision refuses creation with the original manager cause; it cannot allocate another prefix or reopen the committed lifetime. Ready LRU routes may retire while old caller leases remain entitled. Loading routes with live demand cannot be stolen.

| Option | Default and hard maximum | Minimum |
| --- | ---: | ---: |
| `maxGenerations` | 64 | 1 |
| `maxPendingJobs` | 4 | 1 |
| `maxWaiters` | 128 | 1 |
| `maxCallerLeases` | 128 | 1 |
| `maxResidentEntries` | 32 | 0 |
| `maxMetadataBytes` | 2097152 | 4096 |
| `maxLogicalImageBytes` | 16777216 | 1 |
| `maxPendingRasterBytes` | 8388608 | 1 |

All options are safe integers; undefined selects the default, while null is invalid. Retained generations include current and retired records. Old live callers, late actors and quarantined records continue consuming their respective caps. Logical metadata/image/scratch units are separate from physical JS, font, Canvas or GPU memory measurements. Raster admission checks output before scratch and commits neither reservation when a later proposal fails. Cancellation does not refund an actor that still uses its record. Up to 8 pending idle observers are admitted.

## Genuine leases and honest terminal cleanup

Image results carry a distinct real `AssetLease<Texture>` per successful caller. Callers sharing work may share the actual Texture while owning separate entitlements. Bitmap borrows the exact lease; Scope may own its release. Cache residency begins only after genuine ready delivery and joins the exact manager generation. Dropping residency releases a cache lease, never an old caller's lease. Saved metrics and owned ImageData2D remain readable after caller release. Directly disposing a borrowed Texture is misuse: the existing `TEXTURE_DISPOSED` condition remains terminal and a future cache route must retire that stale generation.

One caller cancellation removes only that demand. Last cancellation first makes local routes/waiters inert, then aborts or detaches external work. Late measure/raster settlement can only clean up. `dispose()` closes the cache synchronously and idempotently, continues after faults and releases its own residency; genuine caller leases survive until their release or manager/Engine revocation. Automatic AssetManager close makes all its entries, leases and waiters inert before trusted cache closure and external cleanup. Existing Scope/Stage ordering stays intact.

`getStatus()` returns a fresh frozen scalar snapshot, including retained/quarantined counters, and works after close. `whenIdle()` waits for current and retired actors plus listener cleanup; ordinary ready callers/residency do not block it. Engine disposal retains its existing completion contract and does not wait indefinitely for an arbitrary text provider. A late text actor's cleanup remains separately observable through cache idle/diagnostics.

Cleanup that cannot be proved complete is quarantined without invented refunds or retries. A release fault prevents publication, preserves any primary error and associates the exact cleanup cause. Idle rejects `TEXT_CACHE_CLEANUP_FAILED` only after actual actor settlement. Returned wrong plans use `TEXT_PLAN_INVALID`; actual measure throws/rejections use `TEXT_MEASURE_FAILED` with the identical cause. Caller-thrown matching public classes/codes and replayed failures do not gain first-party invocation authority. A revoked would-be delivered lease uses `TEXT_RESOURCE_FAILED` with the real manager cause; no fake lease is published.

## Independence and later work

This first-party design composes existing Egret resource, image, ownership and cancellation contracts, with AI-assisted implementation. Its process declaration is bounded provenance, not a certification of global originality or model training sources. Code and documentation retain Apache-2.0; existing third-party notices and research rights remain separate. Native font backends require separate design, provenance and acceptance.

T2 must establish actual browser fonts, raster surfaces/background work, TextField/layout and target-platform behavior. Spine, complete UI/3D, phones, Native SDKs, shaping, performance and full migration retain their existing open requirements. Earlier 0.23.0 Mesh2D/native evidence is historical rendering evidence and cannot prove text acceptance.
