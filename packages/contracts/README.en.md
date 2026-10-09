# @egret/contracts

English | [简体中文](README.md)


## 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](../../knowledge-base/docs/显示与帧执行合同.en.md) and [implementation plan](../../knowledge-base/docs/显示与帧执行实现计划.en.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](../../knowledge-base/docs/显示与帧执行实现记录.en.md) and [verification](../../verification/display-frame-verification.json).

The frame contract adds Matrix2D, Rectangle2D, ClipRectangle2D, RectangleCommand2D, FrameOptions2D, RenderFrame2D and RenderHostAdapter. renderFrame synchronously returns undefined; host close still proves completion of in-flight work. A CPU frame is not a device completion fence.

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

An experimental type package providing CancellationSignal, Disposable/Releasable, Diagnostic, and HostAdapter contracts. Its input is the Egret lifecycle specification. It has no third-party runtime dependencies, DOM/Node environment globals, or host-initialization side effects. Package `private: true` prevents accidental npm publication.

HostAdapter surface denotes stable object identity; the host owns physical resources. `close()` resolves only after safely returning the surface and completing in-flight host work; if it rejects, Engine retains the exclusive reservation. The injected millisecond-deadline port should support synchronous cancellation. This package provides type contracts; real hosts require separate verification.

From the repository root, use `node tools/verify.mjs` to verify strict compilation, declarations/import boundaries, and positive/negative type samples. See the [knowledge base](../../knowledge-base/README.en.md) for design and the [source record](../../source-origin.json) for attribution. First-party code and this document use [Apache-2.0](../../LICENSE).

Current display/frame public APIs: DisplayObject x/y, scaleX/scaleY, rotation, alpha, visible and clipRect; Sprite.graphics owns rectangle fills; Engine.captureFrame/renderFrame captures/submits immutable RenderFrame2D. The separate `@egret/engine/web` entry exports createCanvasHost while the root remains DOM-free. Interfaces are experimental; complete text/textures/animation/UI/3D remain unfinished.
