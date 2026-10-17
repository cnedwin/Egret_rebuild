# Warm WebGPU submission contract

English | [简体中文](../../Cns/docs/warm-submission-contract.md) · [Evidence](warm-submission-evidence.md) · [M1 plan](m1-rendering-resource-plan.md)

M1.1 reduces repeated work when rendering a frame whose images and native allocations can be safely reused. The existing ordinary, textured, B1 scene with ordinary overlay, and combined textured-scene routes share one Host submission and retirement authority. Public APIs, frame profiles, shaders, color interpretation, package entries and Host protocol remain unchanged.

## Image preparation

The Host first performs the existing route's validation and storage admission, and packs draws to determine actual coverage. A genuine covered image view can omit its pixel crop only when the exact current per-Host image entry is READY. Image identity, crop, device session and current residency revision all participate in that decision. Equal pixels in another image object, a different crop, a cold view and a view with no actual coverage do not acquire reuse permission from another draw.

Packing, per-draw uniforms and original logical charges remain. An all-warm frame still pays the same upload, geometry, projection, pending-frame and readback admission charges. Reuse cannot make an invalid frame admissible or consume an armed readback ticket on rejection. Saved immutable captures retain their existing replay contract; a disposed live lease can still prevent a fresh capture.

The private preparation module separates draw packing from projection materialization. Its original cold facade retains the original pack → copy → uniform → owner-recheck order. Ordinary and B1-overlay routes retain 2D packing before pending/readback admission; textured and combined routes retain whole-storage admission before payload allocation. These distinct error priorities are intentional compatibility behavior.

## Buffer ownership and bounded reuse

Eligible whole buffers are vertex buffers (usage 40), index buffers (24) and per-draw uniforms (72). Lookup requires exact usage and byte length within one Host/device session. Every leased allocation has one in-flight submission owner; per-draw uniform leases remain distinct. Repeated scene geometry retains the existing within-submission sharing. A new frame always rewrites its current vertex, index and uniform data. Reuse never means reusing stale geometry, alpha or matrix contents.

Idle retention is bounded by **33,554,432 bytes and 4,096 entries**. A submission first identifies its complete exact-match set, then evicts the oldest unmatched idle buffers needed by its retainable requests. Oversized or overflowing candidates remain transient without introducing a new public refusal. Return reservations count against retention capacity before any native cleanup callback can reenter. Leases return in request order, including mixed cold and warm requests.

The implementation uses an exact usage/size index with linked FIFO order. Planning costs O(requests + selected victims) under the usual hash-map model; it does not scan all idle buffers separately for every draw. This is an implementation complexity property, not a measured frame-time improvement or a JavaScript worst-case Map guarantee.

Readback staging buffers (usage 9) and depth textures remain transient. Their original mapping, unmapping and cleanup proofs are unchanged. The existing image cache has its own 32 MiB / 256 READY-entry limits; buffer retention does not enlarge image capacity.

## Binding identity

The searchable binding cache is bounded to **4,096 entries**. Its complete key includes the device session, exact layout, image allocation token and view where applicable, sampler, uniform allocation identity, offset and binding size. A 16-byte image uniform cannot alias a 64-byte scene uniform. Independent image and mesh layouts remain distinct even when their input values are equal.

Complete-key lookup uses a fixed-depth identity index. A hit updates linked LRU order; capacity eviction removes the least recently used searchable entry. Reverse indexes remove dependent bindings before an image or buffer allocation is destroyed, and empty branches are pruned. In-flight records keep their own binding references until retirement. Evicting searchable metadata does not destroy a binding or release its underlying native resource.

A binding becomes searchable only after its uniform buffer safely returns. Image-backed bindings additionally require their exact image entry to be READY, including successful publication of a new candidate. Cold-image collision losers, transient buffers and failed records do not publish bindings. Metadata publication failure clears and disables the binding directory while resource owners remain explicit.

## Submission, retirement and shutdown

1. Preserve the route's original CPU order and complete admission. Select read-only current image and buffer plans before committing the serial and original ledger charges.
2. Attach all leases and cleanup owners, pin image hits and claim buffer matches before the first native victim-destruction callback. Synchronous submission remains busy; nested rendering receives the existing reentrancy refusal.
3. Preserve native scope, upload, render-pass, submit, fence and readback order. Returned native objects enter an owner before subsequent getters or state checks can fail.
4. A fence alone does not authorize reuse. All original scope, queue and requested map/readback obligations must settle safely. Rejected or unknown proofs retain the original quarantine behavior.
5. Reserve potential returns while the retiring frame's original charges remain visible. Clean staging, overflow and other transient resources; finish image qualification; then recheck Host and record health before publishing buffer returns and eligible bindings.
6. Keep incomplete ownership transfers in their record for explicit close. Unknown native destruction remains charged, is never retried and never becomes free capacity. A buffer's once-only cleanup flag continues to mean native destruction was attempted, not that it is idle.
7. Stop, failure, delivered device loss and close disable reuse immediately. Close retains the existing completion barriers, then drains idle buffers and image owners. Finalizing records never repopulate caches.

Private helpers manage metadata only. They do not call the GPU, decide completion, acquire a device, change the scene or create another lifecycle owner. Captured collection operations keep their metadata transfers free of replaceable prototype callbacks.

## Compatibility and acceptance

Idle completion now permits bounded retained buffers; it no longer implies every draw buffer was destroyed. Explicit close still attempts every captured native cleanup once. Existing tests that require a retirement callback use genuine transient staging or pressure/eviction cases, preserving their original pending-charge and failure assertions.

Controlled counters establish operation counts and identity reuse. Native readbacks establish only the specified image domain on the recorded browser and adapter. Neither establishes physical VRAM, speed, power, phone support or device-loss recovery. The [evidence record](warm-submission-evidence.md) separates these domains and retains failed attempts and corrections.

Incremental capture/batching, shared texture pages and new materials, WebGL2, resource manifests and device-session reconstruction follow the later M1 packages. Complete Spine remains M2 acceptance. This package does not add those capabilities.

The implementation and fixtures are first-party, AI-assisted work under Apache-2.0, extending Egret's existing Host and resource contracts. No new runtime dependency is introduced. Existing sources and third-party notices remain in [source records](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json).
