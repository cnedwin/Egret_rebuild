# @egret/runtime

English | [简体中文](README.zh-CN.md)

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
