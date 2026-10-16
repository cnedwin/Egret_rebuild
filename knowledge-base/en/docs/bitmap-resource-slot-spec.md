# Bitmap resource slot specification

English | [简体中文](../../Cns/docs/位图资源槽规格.md)

The resource slot adds explicit asynchronous Texture replacement to one persistent Bitmap. The old live binding remains visible while a replacement loads, fails or is cancelled. Only the latest accepted request may commit. This contract covers binding readiness; GPU upload, presentation, multiresource changes and animation retargeting have separate acceptance.

## Public interface

The existing built `@egret/engine` entry exposes one Engine method and two erased types:

```ts
type BitmapResourceSlotState =
  'idle' | 'pending' | 'ready' | 'failed' | 'conflicted' | 'disposed';

interface BitmapResourceSlot {
  readonly state: BitmapResourceSlotState;
  replace(ref: AssetRef<Texture>): Promise<void>;
  cancel(reason?: unknown): void;
  dispose(): void;
}

Engine.createBitmapResourceSlot(scope: Scope, bitmap: Bitmap): BitmapResourceSlot;
```

The handle is frozen; each method and getter requires that exact receiver. This increment adds no public constructor, free factory, package subpath or dependency, and does not change the Host protocol.

Creation requires an open Engine, its genuine open Scope and a genuine live same-Engine Bitmap with a nonempty live Texture lease. The current crop is retained. Each Bitmap admits one live slot; each Engine admits at most 256. Disposing a slot releases its claim and capacity.

## Ownership

The initial Bitmap, parent and lease remain borrowed from their existing owners. The slot never releases or restores the initial lease. It registers one handle with Scope and owns only the fresh leases obtained by its replacement requests.

A successful replacement uses the entire new Texture base region and updates its natural dimensions together. Parent/order, position, scale, rotation, pivots, visibility, alpha, clipping, listeners and the authored hit area remain unchanged. Layout and hit areas do not resize automatically.

A lease observed through Bitmap remains a borrow. Reusing or cropping a slot-owned lease manually does not transfer ownership. Applications needing a manual binding to survive slot disposal must acquire an independent lease.

## Request order and outcomes

1. Validate the receiver, intrinsic Engine/Scope lifetime, slot state and exact current binding, then synchronously authenticate the typed reference, provider and ID compatibility.
2. Invalid ordinary input throws synchronously and preserves any already pending request.
3. Install each accepted request as the latest intent before cancelling the preceding request. Each accepted call returns a distinct handled Promise.
4. Keep the old binding during acquisition and preparation. Before publication, verify that this request is still current and both old and candidate entitlements remain live.
5. Commit the prepared binding and ownership metadata without application callbacks. Set ready and fulfill with undefined before releasing the previous slot-owned lease.

A success means that the binding committed at one synchronous point. A subsequent request or cleanup callback may already have changed or disposed it before the awaiting caller resumes.

| Outcome | State and Promise |
| --- | --- |
| Successful current request | ready; fulfilled with undefined |
| Acquisition or preparation failure | failed; BITMAP_RESOURCE_REPLACE_FAILED, preserving the original cause chain |
| Superseded request | BITMAP_RESOURCE_SUPERSEDED; the newer intent keeps its own state |
| Explicit cancellation | BITMAP_RESOURCE_CANCELLED with the exact supplied reason, including undefined; return to ready if an owned binding exists, otherwise idle |
| Slot/Scope/Engine disposal | disposed; pending BITMAP_RESOURCE_DISPOSED, retaining the lifetime cause |
| Manual binding/crop conflict | conflicted; pending BITMAP_RESOURCE_BINDING_CHANGED directly |

Cancellation does not require a cooperative provider to finish. If acquisition already delivered a lease before its Promise continuation, stale work must release that exact lease. A provider value never delivered as a lease remains the AssetManager's cleanup responsibility. The slot never directly disposes provider values or revokes external waiters.

Loaders, type guards, cancellation listeners, disposers and diagnostic callbacks may reenter. Every started acquisition has fulfillment and rejection observers. An outer operation cannot reinstall an obsolete request after such a callback.

## Manual changes and revoked resources

Every successful nonempty manual lease/crop assignment changes the private binding token. Same-lease assignment, crop reset and A→B→A changes therefore conflict even when public values compare equal. Failed manual assignments leave the token unchanged.

The next slot control or candidate reaction detects a conflict. The slot retains its claim until explicit disposal, does not adopt the manual binding and never overwrites it during cleanup.

If the manual change reuses the slot-owned lease, disposal leaves those manual fields untouched but still releases its owned entitlement. A fresh capture can then fail. An independently owned manual binding remains usable.

External release of an unchanged initial/current lease, or disposal of its Texture, is a separate failure. The original fields remain, but their liveness is outside the old-visible guarantee. A pending request fails with BITMAP_RESOURCE_REPLACE_FAILED retaining ASSET_LEASE_RELEASED or TEXTURE_DISPOSED. A synchronous control observing this condition throws the existing resource cause and accepts no new request.

## Lifetime and cleanup

Control precedence is receiver → Engine open → genuine Scope membership/open → terminal slot state → live target/exact binding → reference admission. State observation only authenticates the receiver and reads the record; it performs no polling or cleanup.

Scope closing refuses reentrant new work through captured intrinsic state. Ordinary reverse Scope cleanup disposes its one handle without awaiting a provider. State observation during an earlier Scope abort listener may still show the previous record state until that cleanup runs.

Engine closing retires every slot and clears each matching owned borrow before the first abort, release or diagnostic callback and before waiting for an active frame. Dispose is idempotent and remains available after closure.

Cleanup clears only a matching committed owned token. It never clears the initial borrow or a later manual binding. Logical routing and ownership cells retire before callbacks; all cleanup obligations are attempted. Provider disposal faults retain AssetManager's ASSET_CLEANUP_FAILED diagnostic. Additional slot cleanup faults use BITMAP_RESOURCE_CLEANUP_FAILED. Precommit failure preserves its primary cause and immediately observed secondary cleanup errors; cleanup cannot undo committed success.

These are logical ownership guarantees. They do not establish physical provider interruption, garbage collection, GPU retirement or bounded AssetManager ID history.

## Admission and stable errors

| Condition | Code |
| --- | --- |
| Extracted method/getter with another receiver | BITMAP_RESOURCE_INVALID |
| Foreign, fake or proxied Scope | BITMAP_RESOURCE_SCOPE_INVALID |
| Closing/closed Engine or genuine Scope | ENGINE_CLOSED / SCOPE_CLOSED |
| Foreign, fake or proxied target | BITMAP_RESOURCE_TARGET_INVALID |
| Disposed target | OBJECT_DISPOSED; the pending Promise rejects with BITMAP_RESOURCE_DISPOSED caused by OBJECT_DISPOSED |
| Empty initial binding | BITMAP_RESOURCE_TEXTURE_REQUIRED |
| Existing active claim / 257th live slot | BITMAP_RESOURCE_TARGET_BUSY / BITMAP_RESOURCE_LIMIT |
| Control after disposal / conflict | BITMAP_RESOURCE_DISPOSED / BITMAP_RESOURCE_BINDING_CHANGED |

Typed-reference/provider/ID errors retain existing AssetManager codes. Engine/Scope closure outranks a terminal slot error on replace/cancel; dispose remains usable.

## Implementation and verification

Runtime Bitmap owns exact binding tokens and a narrow bridge cached per exact EngineContext. Every bridge operation authenticates context and genuine object identity. Prepared tokens are private, target-bound and consumed once by successful commit; fabricated/copied/foreign tokens cannot publish. Both captured and candidate lease/Texture liveness are freshly checked before the callback-free write. The public runtime assembly can obtain only its own context's authority.

The Engine owner captures genuine manager operations and original Scope authority before public objects escape. The core remains DOM/Node-free. Existing SpriteSheet original-operation units retain their separate permissions.

Implementation proceeds through admission/borrow tests, request and interleaving tests, lifecycle/composition tests, then strict interface, source boundary, browser and complete publication gates. Each stage preserves failed runs and distinguishes authored fixtures from executed acceptance. Read the [verification record](bitmap-resource-slot-evidence.md).

## Composition limits

Stop/dispose a SequencePlayer or SequencePlayback before using the same Bitmap for replacement. Concurrent crop writes conflict; an old exact-lease player cannot silently retarget a new texture. A sequence on another Bitmap remains independent.

BitmapButton owns its internal display and skin crops. Its internal Bitmap is outside this slot's supported targets as a caller precondition; the factory does not claim to identify Button internals. Independent Buttons can control an ordinary target.

Saved immutable frames retain their original image/crop values after later replacement or retirement. A successful slot request does not acknowledge a rendered frame; subsequent frame validation or Host failure does not roll the binding back.

Complete game UI, multiresource outfit/scene switching, full Spine R020/V020, advanced 3D and production host/device acceptance remain separate engineering work. First-party code, original fixtures and documentation use Apache-2.0; this increment adds no external runtime library.
