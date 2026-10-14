# @egret/runtime

English | [简体中文](README.zh-CN.md)

DisplayObjectContainer.getChildIndex(child: DisplayObject): number is a read-only query of the exact current direct child. It scans the authoritative private order in O(n), with no list snapshot/cache, tree mutation, owner transfer, resource operation or display callback. Sprite/Stage inherit it; root values/types, subpaths, dependencies and protocol are unchanged. Read the [0.50 contract](../../knowledge-base/en/docs/container-child-index-contract.md).

`DisplayObjectContainer.removeChildren(): void` clears a display layer while keeping its nodes, descendants, resources and cleanup owners alive. It authenticates the genuine receiver, checks Engine before receiver lifetime even when empty, preflights every direct edge and commits without caller hooks. Sprite and Stage inherit the method; root values/types, profiles, dependencies and protocol remain unchanged. Read the [0.49 contract](../../knowledge-base/en/docs/container-remove-children-contract.md).

Engineering preview 0.48.0 adds `NineSliceBitmap` and erased `NineSliceBitmapOptions` at the Runtime/Engine roots. It borrows a genuine Texture lease and resizes fixed-border NS1 content; positive rendering uses the explicit textured WebGPU host, while Canvas mesh is refused. See the [contract](../../knowledge-base/en/docs/nine-slice-bitmap-contract.md) and [bounded evidence](../../knowledge-base/en/docs/nine-slice-bitmap-evidence.md).

Inherited `getBounds` reads authoritative receiver-local content with type-only `BoundsQueryOptions`, explicit node/primitive budgets and a fresh frozen result. Read the [bounds contract](../../knowledge-base/en/docs/display-content-bounds-contract.md).

Inherited display coordinate queries use authentic display state, bounded ancestor/lifetime checks and optional `CoordinateQueryOptions`. Read the [coordinate contract](../../knowledge-base/en/docs/display-coordinate-query-contract.md).

Egret's experimental logic package depends only on `@egret/contracts`. It receives event descriptors, synchronous cleanup values and narrow lifecycle ports injected by Engine, and provides cancellation, Scope, display trees, synchronous dispatch and CPU asset acquisition/leases. It maintains Scope ownership, object-to-Engine binding, parent/child relationships and event state.

## Ownership and cleanup

`EngineContext`, `createScope` and `createStage` serve internal engine assembly and are not exported by the public facade. Engine creates Scope, Stage and AssetManager. Asset types and references are factory-created and checked at runtime. Shared acquisition tasks and independent leases remain separate; see the [asset contract](../../knowledge-base/en/docs/resource-core-contract.md).

Scope registration handles recursion on the same value, state rechecks after user callbacks, late values during shutdown and ownership conflicts. Internal mounting and finalization preserve actual tree state without implicitly calling public `removeChild` overrides; the current contract has no mount/remove notifications. Cleanup failures are recorded individually while remaining listeners and subtrees continue to be processed. Recursive finalization respects the initiating root's owner boundary.

Failed signal registration withdraws the subscription and attempts adapter rollback. If a synchronous event handler returns a Promise, it is rejected synchronously and its rejection is observed.

## Display and frame state

Internal visual state and iterative frame extraction retain authoritative tree order; public getters do not supply frame facts. Graphics belongs to its Sprite. Clip and rectangle values are copied and frozen so later edits cannot alter old frames. Detached but still-bound objects also obey engine closing restrictions.

Through the engine facade, `DisplayObject` exposes `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible` and `clipRect`; `Sprite.graphics` owns rectangle fills. `Engine.captureFrame`/`renderFrame` capture/submit immutable `RenderFrame2D`. The separate `@egret/engine/web` entry exports `createCanvasHost`, while the root remains DOM-free. See the [display and frame contract](../../knowledge-base/en/docs/display-and-frame-execution-contract.md); automatic frame scheduling is outside that contract.

## Verification and scope

Behavioral tests consume the public built engine entry. Run `node tools/verify.mjs` from the repository root. Design and version-bound evidence are in the [knowledge base](../../knowledge-base/en/README.md) and [display/frame implementation record](../../knowledge-base/en/docs/display-and-frame-implementation-record.md); source attribution is in the [source record](../../source-origin.json).

Interfaces remain experimental. Full text, texture, animation, UI and 3D execution, Native support, target-device performance, editors, Agent services and complete migration require separate acceptance. Package version `0.0.0` and `private: true` remain unchanged; no npm publication follows from this guide. First-party code and this document use [Apache-2.0](../../LICENSE).

## Explicit sequence animation

`createSequenceClip` owns validated atlas timing; `SequencePlayer` applies caller-supplied absolute seconds to one Bitmap and exact borrowed lease. Construction changes no crop; disposal releases no caller resource. There is no automatic scheduler. See the [contract and acceptance scope](../../knowledge-base/en/docs/sequence-player-contract.md) and public `examples/sequence-player` / `tools/sequence-player` guides.

## Owned binary reading

The root exports `ByteReader` and the frozen `BYTE_READER_LIMITS`, plus type-only `ByteOrder`. Readers copy an eligible fixed ordinary Uint8Array payload, default to bigEndian, and support bounded atomic scalar/copy reads. Returned bytes are independent copies; disposal clears owned references. Existing Scope may own a reader through its disposable shape. Read the [BR1 contract](../../knowledge-base/en/docs/byte-reader-br1-contract.md) and [recorded verification scope](../../knowledge-base/en/docs/byte-reader-br1-evidence.md). No binary format, text encoding or legacy ByteArray compatibility is promised. The Main integration and publication checks remain pending at this preparation cutoff.

<!-- NS1-DOC-0.41.0-BEGIN -->
## Engineering preview 0.41.0 — nine-slice stretch geometry NS1

**S094 / V045. Finite CPU, types, policy and browser observations accepted; complete publication gates and delivery remain PENDING.** Fixed-border stretch geometry reuses the existing Mesh2D texture lease; resizing replaces geometry. Runtime/engine roots expose one factory and two readonly types while retaining the original owned geometry identity.

Actual CPU checks passed 27/27: 11 NS groups, 6 Mesh groups and 10 geometry checks including nested cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/35 actual diagnostics, totaling 76 precise location records. Strict type and policy guards exited 0; assigned policy controls passed 13/13. The actual browser completed 2 frames and 96 color-channel comparisons with verified cleanup; see the evidence for the exact environment and scope.

The original NSP09 13/12/1 failure and its finite test-input correction remain separate.

ByteWriter 0.40.0 merged through [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27), with Main `8e1509878252cc2a9295fcc56d7597877d023c85` and tree `ca1f2f176713e388e09016ae22d610c5c1b95201` read back. The mandatory push hook exited 0 with 63 publication and 2724 core checks. Zero remote statuses/check runs do not establish remote CI PASS. Earlier PENDING cutoffs and failure records remain preserved.

[contract](../../knowledge-base/en/docs/nine-slice-geometry-ns1-contract.md) / [evidence](../../knowledge-base/en/docs/nine-slice-geometry-ns1-evidence.md).

This bounded geometry increment contributes to complex 2D UI; it establishes no complete UI/EUI, layout, full Spine, migration, phone energy/performance or native SDK/PC acceptance.
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## Owned binary authoring

The root exposes the original `ByteWriter` and frozen `BYTE_WRITER_LIMITS`: fixed capacity, strict integer domains and native IEEE floating conversion. `toUint8Array()` copies only the committed prefix; `Scope.use(writer)` uses existing lifetime ownership. ByteOrder stays type-only and optional host entries add no writer. See the [contract](../../knowledge-base/en/docs/byte-writer-bw1-contract.md) and [evidence](../../knowledge-base/en/docs/byte-writer-bw1-evidence.md) for the complete scope and separate acceptance stages. Package version, experimental status and npm publication conventions remain unchanged.
<!-- BW1-DOC-0.40.0-END -->
