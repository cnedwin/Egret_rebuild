# @egret/engine

English | [简体中文](README.md)


## 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](../../knowledge-base/docs/显示与帧执行合同.en.md) and [implementation plan](../../knowledge-base/docs/显示与帧执行实现计划.en.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](../../knowledge-base/docs/显示与帧执行实现记录.en.md) and [verification](../../verification/display-frame-verification.json).

captureFrame only captures a snapshot; renderFrame additionally submits it to the synchronous host port fixed at creation. With no render port, capture remains available while rendering rejects. Frame reads/execution reject reentry. Closing starts immediately, while cleanup waits for the frame call to exit. Canvas DOM types and execution remain in the web subentry, which the root does not re-export.

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

An experimental public facade depending only on runtime and contracts. Inputs are an explicit HostAdapter, optional positive-integer shutdown deadline, and diagnostic callback; outputs are Engine, its Stage, Scope, and assets service, and a single shutdown Promise. Engine manages logical lifecycle and surface reservations; the host manages physical resources and the fact of safe return.

createEngine reserves the surface before awaiting host.start, and startup failure still enters cleanup. Shutdown first waits for the current frame call to exit, then handles Scope, Stage, and the CPU asset manager, then stops the host and waits for close within bounds. Only successful close releases the surface. Timeouts or rejection preserve isolation; late success may release the reservation. The core does not destroy borrowed surfaces/devices; this slice has no forced-release or recovery entry.

Scope or Stage cleanup failures do not stop subsequent steps. EgretError retains the original cause and cleanupErrors collected in order. Root exports contain only implemented slice capabilities; internal assembly interfaces are not exported.

Root verification is `node tools/verify.mjs`; the integrated example is `node examples/headless.mjs` and `node examples/assets.mjs`. See the [knowledge base](../../knowledge-base/README.en.md) for design and the [source record](../../source-origin.json) for sources. The package retains `private: true` to prevent accidental npm publication. First-party code and this document use [Apache-2.0](../../LICENSE).

Current display/frame public APIs: DisplayObject x/y, scaleX/scaleY, rotation, alpha, visible and clipRect; Sprite.graphics owns rectangle fills; Engine.captureFrame/renderFrame captures/submits immutable RenderFrame2D. The separate `@egret/engine/web` entry exports createCanvasHost while the root remains DOM-free. Interfaces are experimental; complete text/textures/animation/UI/3D remain unfinished.
