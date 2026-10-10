# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Changelog

### English

These are engineering and knowledge-base checkpoints, newest first, rather than npm or production releases. Workspace packages remain private at `0.0.0`; protocol pins remain `1.0`. Each result belongs to its recorded source and test scope.

| Checkpoint | Main problem addressed | Record |
| --- | --- | --- |
| Unreleased | English-first community entry, separate `en/` and `Cns/` knowledge-base editions, English filenames, founder introduction and bilingual Changelog. | [Details](knowledge-base/en/docs/documentation-layout.md) |
| 0.19.0 | Bitmap atlas regions and sequence-sample placement; reproducible B1 browser checks and preserved texture-collection evidence. Bitmap CPU checks passed; visible sequence playback and texture numeric bounds remain open. | [Details](knowledge-base/en/docs/bitmap-region-evidence.md) |
| 0.18.0 | Bounded CPU conversion of a named legacy MovieClip, preserving atlas crops, offsets and authored hold durations. Image decoding and playback remain unverified. | [Details](knowledge-base/en/docs/legacy-movieclip-evidence.md) |
| 0.17.0 | Owned CPU scene snapshots, fixed mesh helpers, bounded B1 host source/mock integration, CPU sequence sampling and RES conversion intents. | [Details](knowledge-base/en/docs/b1-host-evidence.md) |
| 0.16.0 | Bounded image-source/mock logic, CPU texture reference formulas, 3D math/geometry/packing and legacy RES declaration analysis. | [Details](knowledge-base/en/docs/core-progress.md) |
| 0.15.0 | Immutable ImageData2D, Texture, lease-borrowing Bitmap, saved mixed frames and clipping/vertex preparation with UVs. This checkpoint covers CPU texture preparation. | [Details](docs/texture-a1.md) |
| 0.14.0 | Headless project transaction core: immutable authored snapshots, atomic edits/retries and retained-target restoration through canonical journals. | [Details](knowledge-base/en/docs/project-transaction-core-evidence.md) |
| 0.13.0 | Opt-in WebGPU rectangle execution, independent WGSL preparation and host lifetime handling, with bounded desktop browser verification. | [Details](knowledge-base/en/docs/webgpu-rectangle-implementation-evidence.md) |
| 0.12.0 | Display transforms, inherited visibility/alpha, rectangle clipping, Sprite Graphics fills, immutable frame capture and the separate Canvas adapter. | [Details](knowledge-base/en/docs/display-and-frame-implementation-record.md) |
| 0.11.0 | CPU asset management: typed references, shared acquisition, waiter cancellation, independent leases, generation isolation and Scope/Engine cleanup. | [Details](knowledge-base/en/docs/resource-core-implementation-record.md) |
| 0.10.0 | Mandatory bilingual documentation, critical English code comments and public-content checks before every push. | [Details](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md) |
| 0.9.0 | Community contribution rules, source attribution and a local repository candidate combining core code with the knowledge base. | [Details](knowledge-base/en/CHANGELOG.md) |
| 0.8.0 | First independent core slice: three packages, typed events, display-tree/lifecycle logic, headless Engine and actual strict build/behavior checks. | [Details](knowledge-base/en/docs/core-framework-implementation-record.md) |
| 0.7.0 | Modern package structure, public API/naming contracts and code-quality gates while retaining Egret conventions. | [Details](knowledge-base/en/docs/engineering-architecture-and-project-structure.md) |
| 0.6.2 | Source-backed research into Shaders and Playground for effect assets and continuously editable AI creation workflows. Research only. | [Details](knowledge-base/en/docs/shaders-and-playground-lessons.md) |
| 0.6.1 | Independent implementation and dependency policy, with explicit references, attribution and implementation-origin records. | [Details](knowledge-base/en/docs/independent-implementation-and-dependency-policy.md) |
| 0.6.0 | Candidate selection for graphics backends, fast compilation and modular Native Runtime. Language/backend choices remain proposals. | [Details](knowledge-base/en/docs/graphics-backends-and-native-runtime-selection.md) |
| 0.5.0 | A bounded third-party Three.js real-asset research chain covering skinning, animation, text UI, resource release and context recovery. | [Details](knowledge-base/en/docs/round-3-integration-record.md) |
| 0.4.0 | Fixed-version open-source reference research and a plan for assets, fonts/atlases, compression, animation and resource ownership. | [Details](knowledge-base/en/docs/open-source-reference-implementations-and-adoption.md) |
| 0.3.0 | Contract and browser research on events, resources, nested UI and batching, with retained counterexamples and corrections. | [Details](knowledge-base/en/docs/round-2-validation-record.md) |
| 0.2.0 | Initial technical white paper, product requirements and engineering plan, plus the first verification and independent audit records. | [Details](knowledge-base/en/docs/technical-white-paper.md) |
| 0.1.0 | Structured knowledge base for confirmed requirements, candidate decisions, hypotheses, sources and delivery goals. | [Details](knowledge-base/en/CHANGELOG.md) |

### 中文

以下按从新到旧排列工程与知识库检查点，不代表 npm 或生产发行。工作区包仍为 private、版本 `0.0.0`，协议固定值仍为 `1.0`；各项结果仅适用于其记录的源码和验证范围。

| 检查点 | 主要解决的问题 | 记录 |
| --- | --- | --- |
| 未发行 | 英文优先的社区入口、独立的 `en/` 与 `Cns/` 知识库、英文文件名、创始人介绍与双语 Changelog。 | [详情](knowledge-base/Cns/docs/documentation-layout.md) |
| 0.19.0 | Bitmap 图集区域与序列采样定位；可复现的 B1 浏览器检查与纹理采集证据。Bitmap CPU 检查已通过，可见序列播放及纹理数值边界仍待验证。 | [详情](knowledge-base/Cns/docs/bitmap-region-evidence.md) |
| 0.18.0 | 具名旧 MovieClip 的有界 CPU 转换，保留图集裁剪、偏移与作者持续段时间。图片解码和播放仍未验证。 | [详情](knowledge-base/Cns/docs/legacy-movieclip-evidence.md) |
| 0.17.0 | 自有 CPU 场景快照、固定网格辅助逻辑、有界 B1 宿主源码与模拟集成、CPU 序列采样及 RES 转换意图。 | [详情](knowledge-base/Cns/docs/b1-host-evidence.md) |
| 0.16.0 | 有界图像源码与模拟逻辑、CPU 纹理参考公式、3D 数学／几何／打包以及旧 RES 声明分析。 | [详情](knowledge-base/Cns/docs/core-progress.md) |
| 0.15.0 | 不可变 ImageData2D、Texture、借用租约的 Bitmap、混合帧快照及带 UV 的裁剪／顶点准备。本检查点覆盖 CPU 纹理准备。 | [详情](docs/texture-a1.zh-CN.md) |
| 0.14.0 | 无界面工程事务核心：不可变创作快照、原子编辑与重试，以及基于规范日志恢复保留目标。 | [详情](knowledge-base/Cns/docs/工程事务核心实现证据.md) |
| 0.13.0 | 独立入口的 WebGPU 矩形执行、自主 WGSL 准备与宿主生命周期处理，并完成有界桌面浏览器验证。 | [详情](knowledge-base/Cns/docs/WebGPU矩形实现证据.md) |
| 0.12.0 | 显示变换、继承可见性／透明度、矩形裁剪、Sprite Graphics 填充、不可变帧捕获及独立 Canvas 适配器。 | [详情](knowledge-base/Cns/docs/显示与帧执行实现记录.md) |
| 0.11.0 | CPU 资源管理：类型化引用、共享获取、等待取消、独立租约、代次隔离及 Scope／Engine 清理。 | [详情](knowledge-base/Cns/docs/资源核心实现记录.md) |
| 0.10.0 | 每次推送前必须补齐双语文档、关键代码英文注释和公开内容检查。 | [详情](knowledge-base/Cns/docs/双语文档与推送前检查.md) |
| 0.9.0 | 社区贡献规则、来源归属，以及整合核心代码和知识库的本地仓库候选。 | [详情](knowledge-base/Cns/CHANGELOG.md) |
| 0.8.0 | 首批自主核心：三个包、类型化事件、显示树／生命周期逻辑、无界面 Engine 及实际严格编译和行为检查。 | [详情](knowledge-base/Cns/docs/核心框架实现记录.md) |
| 0.7.0 | 在保留白鹭命名习惯的基础上，制定现代包结构、公共 API／命名合同和代码质量门禁。 | [详情](knowledge-base/Cns/docs/工程技术架构与项目结构.md) |
| 0.6.2 | 基于来源研究 Shaders 与 Playground 的效果资产及可持续编辑的 AI 创作流程；属于研究工作。 | [详情](knowledge-base/Cns/docs/Shaders与Playground产品技术启发.md) |
| 0.6.1 | 自主实现与依赖规范，明确参考出处、归属及实现来源记录。 | [详情](knowledge-base/Cns/docs/独立实现与第三方依赖规范.md) |
| 0.6.0 | 图形后端、快速编译及模块化 Native Runtime 的候选选型；语言和后端选择仍为提案。 | [详情](knowledge-base/Cns/docs/图形后端编译与原生Runtime选型.md) |
| 0.5.0 | 有界的第三方 Three.js 真实资产研究链，覆盖蒙皮、动画、文字 UI、资源释放和上下文恢复。 | [详情](knowledge-base/Cns/docs/第三轮集成记录.md) |
| 0.4.0 | 固定版本开源参考研究，规划资产、字体／图集、压缩、动画与资源所有权。 | [详情](knowledge-base/Cns/docs/开源参考实现与采用方案.md) |
| 0.3.0 | 事件、资源、嵌套 UI 与合批的合同及浏览器研究，保留反例和修正。 | [详情](knowledge-base/Cns/docs/第二轮验证记录.md) |
| 0.2.0 | 首批技术白皮书、产品需求与工程规划，以及第一轮验证和独立审计记录。 | [详情](knowledge-base/Cns/docs/技术白皮书.md) |
| 0.1.0 | 建立结构化知识库，登记确认需求、候选决策、假设、来源和交付目标。 | [详情](knowledge-base/Cns/CHANGELOG.md) |

## Current scope and participation

The current engineering preview is **0.19.0**. We are rebuilding an open-source game engine and creation workflow for people who primarily use AI to make games, initially targeting complex 2D UI and lightweight 3D. The repository contains an experimental core and a structured knowledge base. The complete engine, production platform hosts, editor, Agent services, target-device performance and complete legacy-project migration still require implementation or acceptance.

Contributors worldwide are welcome to help with implementation, reproducible bugs and fixes, documentation and translations, API proposals, and game or migration samples they own or are authorized to share. Start with the [contribution guide](CONTRIBUTING.md), [English knowledge base](knowledge-base/en/README.md), [Chinese knowledge base](knowledge-base/Cns/README.md), [document index](DOCUMENTATION.md), [source records](source-origin.json) and [acknowledgements](ACKNOWLEDGEMENTS.md).

## Running and verifying

Pinned tools: Node.js 24.19.0, pnpm 11.25.0 and TypeScript 7.0.2. Run from the repository root:

```text
pnpm install --frozen-lockfile --ignore-scripts
node tools/verify.mjs
node examples/headless.mjs
node examples/assets.mjs
node tools/prepush.mjs
```

Before every push, review both language editions, source attribution and public content, complete critical English code comments, and run the full pre-push checks. Browser rendering, device performance and complete migration require their own scoped verification. See the [publication policy](knowledge-base/en/docs/bilingual-documentation-and-prepush-checks.md).

First-party code and documentation use [Apache-2.0](LICENSE); third-party dependencies and assets retain their original notices and attribution.

<details>
<summary>Detailed historical engineering records</summary>

The following paragraphs preserve their original authoring checkpoints. Statements such as UNRUN, pending or HOLD_HTTP_403 belong to those historical checkpoints; they do not override later verified commits and pull requests. This README edit reruns no browser/device measurements and upgrades no product acceptance.

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

</details>
