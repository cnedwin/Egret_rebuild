# @egret/runtime

English | [简体中文](README.zh-CN.md)


## 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](../../knowledge-base/en/docs/display-and-frame-execution-contract.md) and [implementation plan](../../knowledge-base/en/docs/display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](../../knowledge-base/en/docs/display-and-frame-implementation-record.md) and [verification](../../verification/display-frame-verification.json).

Internal visual state and iterative frame extraction retain authoritative tree order; public getters do not supply frame facts. Graphics belongs to its Sprite. Clip and rectangle values are copied and frozen so later edits cannot alter old frames. Detached but still-bound objects also obey engine closing restrictions.

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

An experimental logic package depending only on `@egret/contracts`. It receives event descriptors, synchronous cleanup values, and narrow lifecycle ports injected by Engine, and provides cancellation, Scope, display trees, synchronous dispatch, and CPU asset acquisition/leases. This package maintains consistency of Scope ownership, object-to-Engine binding, parent/child relationships, and event state.

EngineContext and createScope/createStage serve engine's internal assembly and are not exported by the public facade. Engine creates Scope and Stage; AssetManager is created by Engine; asset types and references are factory-created and checked at runtime. Shared tasks and independent leases are separate; see the [asset contract](../../knowledge-base/en/docs/resource-core-contract.md). The successor display-frame scope is described above; automatic frame scheduling is outside that contract.

Scope registration handles recursion on the same value, state rechecks after user callbacks, late values during shutdown, and ownership conflicts. Internal mounting and finalization preserve actual tree state without implicitly calling public removeChild overrides; the current contract has no mount/remove notifications. Cleanup failures are recorded individually while remaining listeners and subtrees continue to be processed. Recursive finalization respects the initiating root's owner boundary. Failed signal registration withdraws the subscription and attempts adapter rollback. If a synchronous event handler returns a Promise, it is rejected synchronously and its rejection is observed.

Behavioral tests run through the public built engine entry point. Root verification is `node tools/verify.mjs`; see the [knowledge base](../../knowledge-base/en/README.md) for design and the [source record](../../source-origin.json) for sources. The package retains `private: true` to prevent accidental npm publication. First-party code and this document use [Apache-2.0](../../LICENSE).

Current display/frame public APIs: DisplayObject x/y, scaleX/scaleY, rotation, alpha, visible and clipRect; Sprite.graphics owns rectangle fills; Engine.captureFrame/renderFrame captures/submits immutable RenderFrame2D. The separate `@egret/engine/web` entry exports createCanvasHost while the root remains DOM-free. Interfaces are experimental; complete text/textures/animation/UI/3D remain unfinished.
