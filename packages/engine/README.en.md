# @egret/engine

English | [简体中文](README.md)

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](../../knowledge-base/docs/WebGPU矩形执行合同.en.md), [implementation plan](../../knowledge-base/docs/WebGPU矩形实施计划.en.md) and [bounded evidence](../../knowledge-base/docs/WebGPU矩形实现证据.en.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](../../verification/webgpu-verification.json) and [review](../../verification/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match this metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](../../knowledge-base/docs/显示与帧执行合同.en.md) and [implementation plan](../../knowledge-base/docs/显示与帧执行实现计划.en.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](../../knowledge-base/docs/显示与帧执行实现记录.en.md) and [verification](../../verification/display-frame-verification.json).

captureFrame only captures a snapshot; renderFrame additionally submits it to the synchronous host port fixed at creation. With no render port, capture remains available while rendering rejects. Frame reads/execution reject reentry. Closing starts immediately, while cleanup waits for the frame call to exit. Canvas DOM types and execution remain in the web subentry, which the root does not re-export.

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

An experimental public facade with runtime/contracts internally and the exact external robust-predicates 3.0.3 dependency for WebGPU preparation. Inputs are an explicit HostAdapter, optional positive-integer shutdown deadline, and diagnostic callback; outputs are Engine, its Stage, Scope, and assets service, and a single shutdown Promise. Engine manages logical lifecycle and surface reservations; the host manages physical resources and the fact of safe return.

createEngine reserves the surface before awaiting host.start, and startup failure still enters cleanup. Shutdown first waits for the current frame call to exit, then handles Scope, Stage, and the CPU asset manager, then stops the host and waits for close within bounds. Only successful close releases the surface. Timeouts or rejection preserve isolation; late success may release the reservation. The core does not destroy borrowed surfaces/devices; this slice has no forced-release or recovery entry.

Scope or Stage cleanup failures do not stop subsequent steps. EgretError retains the original cause and cleanupErrors collected in order. Root exports contain only implemented slice capabilities; internal assembly interfaces are not exported.

Root verification is `node tools/verify.mjs`; the integrated example is `node examples/headless.mjs` and `node examples/assets.mjs`. See the [knowledge base](../../knowledge-base/README.en.md) for design and the [source record](../../source-origin.json) for sources. The package retains `private: true` to prevent accidental npm publication. First-party code and this document use [Apache-2.0](../../LICENSE).

Current display/frame public APIs: DisplayObject x/y, scaleX/scaleY, rotation, alpha, visible and clipRect; Sprite.graphics owns rectangle fills; Engine.captureFrame/renderFrame captures/submits immutable RenderFrame2D. The separate `@egret/engine/web` entry exports createCanvasHost while the root remains DOM-free. Interfaces are experimental; complete text/textures/animation/UI/3D remain unfinished.

## Public WebGPU use

Supply an HTMLCanvasElement as `canvas`. Readback is optional and arms the next accepted frame; `renderFrame` returns undefined synchronously. `result.bytes` is caller-owned premultiplied RGBA, not browser composition. `whenIdle` snapshots submitted work; only successful `close` proves safe return. Engine wrapping preserves the original cause. See the [example](../../examples/webgpu/README.en.md).

```ts
import { createEngine, Sprite } from '@egret/engine';
import { createWebGPUHost } from '@egret/engine/webgpu';

const host = createWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngine({ host });
const rect = new Sprite();
rect.graphics.beginFill(0x00ff00).drawRect(4, 4, 16, 16);
engine.stage.addChild(rect);
const pixels = host.requestReadback();
engine.renderFrame({ width: 48, height: 40, clearColor: 0, clearAlpha: 0 });
const result = await pixels;
await engine.dispose();
```
