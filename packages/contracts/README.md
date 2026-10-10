# @egret/contracts

English | [简体中文](README.zh-CN.md)

`Point2D` is a readonly type-only logical coordinate result. Read the [coordinate contract](../../knowledge-base/en/docs/display-coordinate-query-contract.md).

Egret's experimental type package defines `CancellationSignal`, `Disposable`/`Releasable`, `Diagnostic` and `HostAdapter` contracts from the lifecycle specification. It has no package or third-party runtime dependencies, DOM/Node environment globals, or host-initialization side effects.

## Host and frame obligations

`HostAdapter.surface` denotes stable object identity; the host owns physical resources. `close()` resolves only after safely returning the surface and completing in-flight host work. If it rejects, Engine retains the exclusive reservation. The injected millisecond-deadline port should support synchronous cancellation. Type contracts do not verify a real host.

The [display and frame contract](../../knowledge-base/en/docs/display-and-frame-execution-contract.md) defines `Matrix2D`, `Rectangle2D`, `ClipRectangle2D`, `RectangleCommand2D`, `FrameOptions2D`, `RenderFrame2D` and `RenderHostAdapter`. `renderFrame` synchronously returns `undefined`; host `close` still proves completion of in-flight work. A CPU frame does not serve as a device completion fence.

Through the engine facade, `DisplayObject` provides `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible` and `clipRect`; `Sprite.graphics` owns rectangle fills, and `Engine.captureFrame`/`renderFrame` capture/submit immutable frames. `createCanvasHost` belongs to the separate `@egret/engine/web` entry; the root remains DOM-free.

## Verification and scope

From the repository root, run `node tools/verify.mjs` for strict compilation, declarations/import boundaries and positive/negative type samples. Design and version-bound evidence live in the [knowledge base](../../knowledge-base/en/README.md) and [display/frame implementation record](../../knowledge-base/en/docs/display-and-frame-implementation-record.md). Attribution is in the [source record](../../source-origin.json).

Interfaces remain experimental. Full text, texture, animation, UI and 3D execution, GPU/Native acceptance, target-device performance, editors, Agent services and complete migration remain separate obligations. Package version `0.0.0`, protocol `1.0` and `private: true` remain unchanged; accidental npm publication stays disabled. First-party code and this document use [Apache-2.0](../../LICENSE).
