# Egret Rebuild

English | [简体中文](README.zh-CN.md)

Egret Rebuild is an open-source effort to build a new game engine and creation workflow for people who primarily use AI to make games. The initial product direction covers 2D games with complex UI and lightweight 3D games. Rendering and runtime, continuously editable projects, Agent collaboration tools, and migration of legacy Egret projects are developed as parts of that direction.

The repository currently contains an experimental core and an engineering knowledge base. The current engineering preview is 0.19.0. A complete engine, production hosts, editor, Agent services, target-device performance, and complete legacy-project migration still require implementation or acceptance. Workspace packages remain private at 0.0.0, and protocol pins remain 1.0.

We welcome contributors worldwide. You can help with core implementation, reproducible counterexamples and fixes, documentation and translation, interface proposals, and game or migration samples that you own or are authorized to share. Start with the [contribution guide](CONTRIBUTING.md), explore the [engineering knowledge base](knowledge-base/en/README.md), and consult the [source record](source-origin.json). First-party code and documentation use [Apache-2.0](LICENSE); third-party dependencies and assets retain their own notices and attribution.

The latest confirmed GitHub delivery checkpoint is PR2 at [`fd4ad89`](https://github.com/cnedwin/Egret_rebuild/commit/fd4ad89). This confirms that checkpoint's remote delivery; it does not establish an npm release or full-product acceptance. The engineering records below preserve the scope and status of their original authoring checkpoints, including earlier HOLD_HTTP_403 delivery attempts. Those earlier attempts do not describe the latest confirmed PR2 delivery.

## 中文简介

新白鹭是面向全球开发者的开源重建工程，目标是让主要依靠 AI 制作游戏的创作者，能够持续编辑工程、协作创作并迁移旧白鹭项目；首期方向涵盖复杂 UI 的 2D 游戏与轻量 3D 游戏。当前 0.19.0 是实验性工程预览，完整引擎、生产宿主、编辑器、Agent 服务、设备性能与完整迁移仍待实施或验收。欢迎世界各地的开发者参与实现、反例与修复、文档翻译、接口讨论以及获授权的游戏或迁移样本。请阅读[完整中文介绍与工程记录](README.zh-CN.md)；下文保留完整英文工程记录。

## Current local engineering increment: 0.19.0

Read the implemented [Bitmap region contract](knowledge-base/en/docs/bitmap-region-contract.md) and [CPU evidence](knowledge-base/en/docs/bitmap-region-evidence.md), the [first-four texture collection](knowledge-base/en/docs/texture-first-four-evidence.md), and the [reproducible B1 browser verifier](knowledge-base/en/docs/b1-browser-verifier.md). Bitmap focused checks passed 113/113. The public B1 command recorded 7 baselines, 5 negatives, 11 renders and 8214 literal comparisons; its bounded saved-artifact independent review is accepted. Texture collection integrity is accepted, with numeric bounds UNKNOWN and full A2 incomplete.

This evidence curation records no successor complete prepush; a fresh prepush must pass before any push. Visible Bitmap sequence playback and device/performance/full-migration gates remain open. This is a local engineering label, not a release; package 0.0.0/protocol 1.0 are unchanged. Earlier records retain their own dates, identities and scopes.

## Historical local engineering preview: 0.18.0

Adds bounded CPU conversion of one named legacy MovieClip, preserving atlas crops, display offsets and authored-hold time. Focused tests passed 28/28 with real sequence-factory re-admission. Read the [contract](knowledge-base/en/docs/legacy-movieclip-contract.md), [evidence](knowledge-base/en/docs/legacy-movieclip-evidence.md) and [compact record](knowledge-base/evidence/legacy-movieclip-focused.json). The API remains internal; image reads, decoding and playback are unverified.

0.17.0 and earlier results retain their historical source identities. Default-mode, repository regression and complete prepush for this increment are UNRUN; current browser/device pixels, performance and complete R008/V006 migration await acceptance. 0.18.0 is a local engineering label; package 0.0.0/protocol 1.0 are unchanged. GitHub delivery remains HOLD_HTTP_403.

## Historical local engineering preview: 0.17.0

This preview adds owned CPU scene snapshots, fixed mesh helpers, bounded B1 Host source/mock integration, CPU sequence sampling and pure RES conversion intents. Read [CPU scene](knowledge-base/en/docs/3d-cpu-scene-contract.md), [mesh](knowledge-base/en/docs/3d-webgpu-mesh-contract.md), [Host](knowledge-base/en/docs/b1-host-contract.md), [sequence](knowledge-base/en/docs/sequence-clip-contract.md) and [RES intents](knowledge-base/en/docs/legacy-res-plan-contract.md), with their paired evidence. These interfaces remain internal; public barrels and package 0.0.0/protocol 1.0 are unchanged.

Recorded default Host verification passed 13/13 cases, CPU sequence sampling 25/25 and RES intent planning 14/14. The selected whole-repository run passed 901/901 tests, build, 282 boundary files and type gates. The 901 tests include Host regression coverage. Source bindings, the formatting-only successor and retained earlier failure are detailed in the [paired Host evidence](knowledge-base/en/docs/b1-host-evidence.md). Documentation adoption replays no product checks.

GitHub delivery is on HOLD after the recorded 403 response; final current-document review and complete prepush remain pending. Earlier 0.13.0–0.16.0 checkpoints keep their identities and results. Native SDKs, current browser/device pixels, performance, fonts, DragonBones, complete R008/V006 migration, V003/editor and full-product acceptance remain unverified or open.

## Historical local engineering preview: 0.16.0

The current additive scope covers accepted bounded image source/mock logic, CPU texture reference formulas, CPU 3D math/geometry/packing, and legacy RES declaration analysis. Read [core progress](knowledge-base/en/docs/core-progress.md), [3D CPU foundation](knowledge-base/en/docs/3d-foundation.md) and [legacy RES declarations](knowledge-base/en/docs/legacy-res-declarations.md) for contracts, exact historical evidence and open work. The label is an engineering preview; package 0.0.0 and protocol 1.0 remain unchanged. Final independent public review, prepush and this preview's GitHub delivery remain pending.

Earlier 0.13.0/0.14.0/0.15.0 sections are historical checkpoints with their own source identities and results. Their rectangle/browser observations do not validate current image or 3D native pixels. Task 5a provides CPU formulas/bounds only; A2 Task 5b/Task 6, P0–P7, device/text/animation/Native, V003 and complete R008/V006 migration remain open or UNRUN.


## Historical 0.14.0 project transaction core engineering preview

The local 0.14.0 engineering-preview candidate includes the private 0.0.0 headless `@egret/project` package for immutable authored snapshots, atomic edits/retries and retained-target restore through canonical journals. See the [package API](packages/project/README.md), [complete contract](knowledge-base/en/docs/project-transaction-core-contract.md) and [bounded implementation and memory evidence](knowledge-base/en/docs/project-transaction-core-evidence.md). Protocol pins remain 1.0. Historical 0.13 WebGPU/knowledge-base identities remain unchanged. At this documentation-authoring checkpoint, final independent preview review and public delivery remain pending; subsequent review and delivery evidence are tracked separately; V003/editor and complete R008/V006 migration are not accepted.

## Historical 0.13.0 WebGPU rectangle checkpoint — October 9, 2026

The opt-in `@egret/engine/webgpu` entry executes immutable `RenderFrame2D` rectangle commands synchronously. The root stays DOM-free; `@egret/engine/web` stays Canvas-only and requests no WebGPU or robust-predicates modules. DOM-free preparation uses the exact foundational dependency robust-predicates 3.0.3 through public `orient2d`, under Unlicense. Copying, bounded intersection construction, packing, WGSL and host lifetime are independently authored first-party code. See the [complete 0.6 contract](knowledge-base/en/docs/webgpu-rectangle-execution-contract.md), [implementation plan](knowledge-base/en/docs/webgpu-rectangle-implementation-plan.md) and [bounded evidence](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md).

The accepted desktop build records 177/177 CPU/mock/core tests, 28 expected negative type diagnostics and 123 boundary files. Its separate real WebGPU gate records 42 frames, 1709 raw assertions, 84 screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic assertion-only. These recorded results and scoped independent implementation review belong to the accepted source identities in [verification](verification/webgpu-verification.json) and [review](verification/webgpu-review.json); they are not fresh execution by document integration.

This experimental checkpoint was recorded before the final native run at 2026-10-08T21:23:54.294Z; its core/headless and desktop Canvas results are separately recorded. The subsequent final comment-build browser WebGPU run at `1aa0248a1ff6d8e54c42d631072223bb50483814`, 2026-10-08T21:23:54.294Z, exited 0 and recorded PASS: 42 frames, 1709 raw assertions, 84 PNG screenshots, 6808 composition assertions, eight intended negatives and zero unexpected errors. Seven negatives mutate copied production code; one is synthetic. All 233 inventoried source/build/tool/dependency identities remained equal before and after that execution and match that historical metadata-only successor. The execution was performed by its verification author; independent correction/native-binding closure, final semantic attestation and publication remain pending. Browser WebGPU is separate from a Native app/SDK. Screenshot composition does not certify physical scanout, acceleration, phones or performance. Textures/text/UI/animation/3D, editor/Agent creation, CI, complete migration and full-product acceptance remain open; R008/V006 and V003 retain their existing obligations. Historical 0.9–0.12 records below keep their original dates, identities and result scopes.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](knowledge-base/en/docs/display-and-frame-execution-contract.md) and [implementation plan](knowledge-base/en/docs/display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](knowledge-base/en/docs/display-and-frame-implementation-record.md) and [verification](verification/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

Egret Rebuild serves new creators who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. Rendering and runtime, continuously editable projects, Agent collaboration tools, and complete migration of legacy projects form the product direction. Code, bilingual documentation, tests, and publishable verification records are maintained throughout development.

The previous local 0.12.0 candidate covered bounded display frames, targeting the public repository [cnedwin/Egret_rebuild](https://github.com/cnedwin/Egret_rebuild). Remote submission status for this preview is recorded separately; no npm packages have been published. First-party code and documentation use the repository's original [Apache-2.0](LICENSE); third-party notices remain applicable. Packages retain `private: true`, and interfaces are experimental.

## Implemented core

| Package | Current responsibilities | Dependencies |
| --- | --- | --- |
| `@egret/project` | Immutable authored snapshots, atomic edits/retries and retained-target restore through canonical journals | contracts; private jsonc-parser 3.3.1 scanner/visitor adapter |
| `@egret/contracts` | Cancellation, synchronous cleanup, diagnostics, and headless host ports | None |
| `@egret/runtime` | Scope, display tree, typed synchronous events, CPU asset references/shared acquisition/independent leases | contracts |
| `@egret/engine` | Instance and asset-service assembly, surface reservation, startup, and bounded shutdown | contracts, runtime; explicit robust-predicates 3.0.3 for WebGPU preparation |

The public entry is `@egret/engine`. Core code does not depend on DOM/Node globals, and importing it does not start a host. The new `engine.assets` separates cancellation of a wait from the lifetime of a delivered lease: canceling one caller does not affect other waiters; generation invalidation changes future acquisition while old leases remain usable until release or manager shutdown. Scope and Engine manage cleanup during exit. See the [asset contract](knowledge-base/en/docs/resource-core-contract.md) and [implementation record](knowledge-base/en/docs/resource-core-implementation-record.md).

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

Before every push, run the [bilingual and public-content checks](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md), synchronizing Chinese/English reading versions, registry state, and English comments in critical code. New core code is independently authored from first-party contracts. Historical source/specification hashes and current revision identities are preserved separately in the [source record](source-origin.json).

[Knowledge base](knowledge-base/en/README.md) · [All bilingual documents](DOCUMENTATION.md) · [Contribution guide](CONTRIBUTING.md) · [Acknowledgements](ACKNOWLEDGEMENTS.md) · [Publication notes](PUBLICATION.md)

Current display/frame public APIs: DisplayObject x/y, scaleX/scaleY, rotation, alpha, visible and clipRect; Sprite.graphics owns rectangle fills; Engine.captureFrame/renderFrame captures/submits immutable RenderFrame2D. The separate `@egret/engine/web` entry exports createCanvasHost while the root remains DOM-free. Interfaces are experimental; complete text/textures/animation/UI/3D remain unfinished.

At the historical checkpoint, the local engineering-preview label was 0.14.0; private experimental workspace packages remain 0.0.0 and project/history/tool protocol pins remain 1.0. The preserved WebGPU checkpoint and its knowledge-base identities are historical 0.13.0 records.

## Public WebGPU use

Supply an HTMLCanvasElement as `canvas`. Readback is optional and arms the next accepted frame; `renderFrame` returns undefined synchronously. `result.bytes` is caller-owned premultiplied RGBA, not browser composition. `whenIdle` snapshots submitted work; only successful `close` proves safe return. Engine wrapping preserves the original cause. See the [example](examples/webgpu/README.md).

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

## CPU texture preview (local 0.15.0)

This slice adds immutable ImageData2D, Texture, a Bitmap that borrows an asset lease, saved mixed frames, and clipping/vertex preparation with attached UVs. Read the [API and ownership](docs/texture-a1.md) and [CPU evidence](docs/evidence/texture-a1.md). It extends the 0.14 project core experimentally; production Canvas/WebGPU image sampling, browser precision and GPU resource settlement await separate A2 validation. Source and documentation curation do not establish GitHub delivery. Historical evidence and full-product acceptance obligations remain.
