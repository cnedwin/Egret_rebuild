# Egret Rebuild

English | [简体中文](README.md)

## 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](knowledge-base/docs/WebGPU矩形执行合同.en.md), [implementation plan](knowledge-base/docs/WebGPU矩形实施计划.en.md) and [bounded evidence](knowledge-base/docs/WebGPU矩形实现证据.en.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](verification/webgpu-verification.json) and [review](verification/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match this metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](knowledge-base/docs/显示与帧执行合同.en.md) and [implementation plan](knowledge-base/docs/显示与帧执行实现计划.en.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](knowledge-base/docs/显示与帧执行实现记录.en.md) and [verification](verification/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

Egret Rebuild serves new creators who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. Rendering and runtime, continuously editable projects, Agent collaboration tools, and complete migration of legacy projects form the product direction. Code, bilingual documentation, tests, and publishable verification records are maintained throughout development.

The previous local 0.12.0 candidate covered bounded display frames, targeting the public repository [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild). Remote submission status for this preview is recorded separately; no npm packages have been published. First-party code and documentation use the repository's original [Apache-2.0](LICENSE); third-party notices remain applicable. Packages retain `private: true`, and interfaces are experimental.

## Implemented core

| Package | Current responsibilities | Dependencies |
| --- | --- | --- |
| `@egret/contracts` | Cancellation, synchronous cleanup, diagnostics, and headless host ports | None |
| `@egret/runtime` | Scope, display tree, typed synchronous events, CPU asset references/shared acquisition/independent leases | contracts |
| `@egret/engine` | Instance and asset-service assembly, surface reservation, startup, and bounded shutdown | contracts, runtime; explicit robust-predicates 3.0.3 for WebGPU preparation |

The public entry is `@egret/engine`. Core code does not depend on DOM/Node globals, and importing it does not start a host. The new `engine.assets` separates cancellation of a wait from the lifetime of a delivered lease: canceling one caller does not affect other waiters; generation invalidation changes future acquisition while old leases remain usable until release or manager shutdown. Scope and Engine manage cleanup during exit. See the [asset contract](knowledge-base/docs/资源核心合同.en.md) and [implementation record](knowledge-base/docs/资源核心实现记录.en.md).

This service manages CPU values returned by providers; appropriate providers supply networking and decoding. GPU texture upload/in-flight reclamation, complete GPU rendering backends, production text/animation/3D execution, real mini-game/Native hosts, migrators, editors, and Agent services remain unfinished. Third-party graphics research chains and independently authored product code are recorded separately.

## Running and verifying

Fixed tools: Node.js 24.19.0, pnpm 11.25.0, and TypeScript 7.0.2. Run from the root:

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

The historical CPU asset slice is documented by the [asset-core verification](verification/asset-core-verification.json) as the acceptance record. The earlier [44 headless checks](verification/headless-verification.json) and [bilingual revision record](verification/bilingual-publication-verification.json) retain their historical versions and scopes. Historical CPU asset verification does not establish GPU, device performance, CI, or full-product acceptance.

Before every push, run the [bilingual and public-content checks](knowledge-base/docs/双语文档与推送前检查.en.md), synchronizing Chinese/English reading versions, registry state, and English comments in critical code. New core code is independently authored from first-party contracts. Historical source/specification hashes and current revision identities are preserved separately in the [source record](source-origin.json).

[Knowledge base](knowledge-base/README.en.md) · [All bilingual documents](DOCUMENTATION.en.md) · [Contribution guide](CONTRIBUTING.en.md) · [Acknowledgements](ACKNOWLEDGEMENTS.en.md) · [Publication notes](PUBLICATION.en.md)

Current display/frame public APIs: DisplayObject x/y, scaleX/scaleY, rotation, alpha, visible and clipRect; Sprite.graphics owns rectangle fills; Engine.captureFrame/renderFrame captures/submits immutable RenderFrame2D. The separate `@egret/engine/web` entry exports createCanvasHost while the root remains DOM-free. Interfaces are experimental; complete text/textures/animation/UI/3D remain unfinished.

The local checkpoint and target knowledge-base revision are 0.13.0; private experimental workspace package versions remain 0.0.0.

## Public WebGPU use

Supply an HTMLCanvasElement as `canvas`. Readback is optional and arms the next accepted frame; `renderFrame` returns undefined synchronously. `result.bytes` is caller-owned premultiplied RGBA, not browser composition. `whenIdle` snapshots submitted work; only successful `close` proves safe return. Engine wrapping preserves the original cause. See the [example](examples/webgpu/README.en.md).

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
