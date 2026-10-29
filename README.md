# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Run and contribute

Start with the [getting-started guide](knowledge-base/en/docs/getting-started.md). With pinned Node 26.7.0 and pnpm 11.25.0, run `pnpm setup:dev`, `pnpm check:quick`, then `pnpm example:browser`. The same guide covers complete prerequisites, expected visuals and troubleshooting.

Report problems through [Issues](https://github.com/cnedwin/Egret_rebuild/issues), ask and discuss in [Discussions](https://github.com/cnedwin/Egret_rebuild/discussions), and follow the [public M0–M4 board](https://github.com/users/cnedwin/projects/2) and [Milestones](https://github.com/cnedwin/Egret_rebuild/milestones). [First contribution: newcomer rehearsal](https://github.com/cnedwin/Egret_rebuild/issues/52) includes scope, verification and the review contact. M0 improves environment and collaboration without new engine capabilities.

## M2–M4 architecture and community delivery

The [M2–M4 roadmap](knowledge-base/en/docs/m2-m4-delivery-plan.md) connects complete Spine/content, UI/text/input and mixed core acceptance. Choose a complete work package from [M2 #56](https://github.com/cnedwin/Egret_rebuild/issues/56), [M3 #57](https://github.com/cnedwin/Egret_rebuild/issues/57) or [M4 #58](https://github.com/cnedwin/Egret_rebuild/issues/58); each lists code entry points, dependencies and reviewable acceptance.

## Readonly paragraph SDK in Engine UI

The optional [readonly paragraph SDK](knowledge-base/en/docs/readonly-paragraph-sdk.md) wraps Latin, Chinese and Arabic text from explicit font bytes and feeds natural/minimum line height into ordinary UI and virtual lists. Run [the integrated example](examples/paragraph-panel/README.md) to resize, align, limit lines, change type size/density, and observe atomic content replacement. Final-line bidi L1/L2 is integrated with finite native/browser checks; full M3.2, editing/IME, physical devices and performance remain open.

可选[只读段落 SDK](knowledge-base/Cns/docs/readonly-paragraph-sdk.md)已接入普通 UI 与虚拟列表，支持明确字体下的中英阿文字换行、对齐、行数限制及真实/最小行高。最终行双向 L1／L2 已集成并通过有限原生／浏览器检查；M3.2 完整验收、编辑与输入法、真机及性能仍未完成。

## M2.2 sequence controls

The optional animation entry adds rate, finite total plays, ordered markers and explicit silent/replaying seek, sharing the existing clock and resource ownership. Legacy and new playback cannot simultaneously claim the same Bitmap. See the [sequence-control contract](knowledge-base/en/docs/sequence-controls.md). Complete Spine and M2.2 acceptance remain open.

## M3.1 committed UI panels

M3.1 adds an owned UI root with explicit prepare/commit, automatic row/column layout, stable-key variable-height lists and bounded asynchronous row recycling. Multiple panels share the existing renderer, input router and resource owners. Read the [UI panel contract](knowledge-base/en/docs/ui-data-panel.md). Full controls, paragraphs, focus/IME, gestures, mobile qualification and performance acceptance remain open.

## M2.1 content build foundation

M2.1 connects verified PNG/atlas/sequence builds to typed runtime resource groups, with persistent cache reuse, dependency invalidation and immutable generations adopted through the existing project transaction. Applications load selected resources by ID without handwritten metadata assembly; complete readiness, cancellation and explicit generation replacement reuse existing asset ownership. Sources and old generations remain intact. See the [content build contract](knowledge-base/en/docs/content-build-pipeline.md). Complete Spine, fonts and target variants remain open.

## M3.3 multi-contact foundation

M3.3 provides an optional DOM-free contact router and Engine/browser entries for independent multi-touch sessions, capture, cancellation and viewport/lifetime cleanup. The two-region example and reproducible desktop collector are included. Focused regression passes 176 tests. Read the [contract and evidence](knowledge-base/en/docs/multi-pointer-input.md). Full M3.3 focus/IME, M3.4 gestures and physical Android/iPhone acceptance remain open.

## What we are building

Egret Engine is an open-source game-engine rebuild for creators working with AI and for developers bringing mobile-game experience to the Web. The product centers on complex 2D interfaces and lightweight 3D, with a small rendering/runtime foundation, explicit resource ownership and a shared project model for code, visual tools and agents.

The repository contains an executable engineering preview. Display trees, resource leases, animation, browser input and selected Canvas/WebGPU/WebGL2 rendering paths are available within their documented contracts. Full UI tooling, complete Spine support, target-platform SDKs and automated legacy-project migration remain in development.

## Delivered — M1.5 resource manifests and recovery

M1.5 connects resource manifests and dependency-aware groups to shared resource ownership, bounded loading with integrity checks, staged uploads and unified WebGL2/WebGPU device recovery. Seven fixed desktop recovery cases passed on Windows / Chrome for Testing 157.0.8103.6; WebGL2 and WebGPU each completed 100 resource cycles, ten native loss/recovery cycles and a 30-minute foreground run. Both the fixed recovery results and the affected browser regression have passed independent review.

Delivery follow-up — 2026-10-21: [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) is merged into main `4924b471b52927184252191055f902c30c29af52`. [CI run 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) completed all four jobs successfully; the Windows integrated gate passed 290 publication, 4,528 core and 160 Spine F2 tests, with zero failures, cancellations or skips in each group. M1.2 formal paired performance acceptance remains open.

The [verification scope and evidence](knowledge-base/en/docs/resource-recovery-evidence.md) preserves earlier failed and incomplete attempts alongside the completed delivery.

## Implemented — M1.4 WebGL2 executor

M1.4 implements the optional `@egret/engine/webgl2` and `@egret/engine/webgl2/scene3d` entries over the shared render profile. Recorded desktop verification covers the fixed pixel matrix and finite lifetime/depth/state scenarios. These results do not establish mobile support, frame-time performance or sustained recovery. Read the [contract](knowledge-base/en/docs/webgl2-executor-contract.md), [observed results and limits](knowledge-base/en/docs/webgl2-executor-evidence.md), and [M1 plan](knowledge-base/en/docs/m1-rendering-resource-plan.md).

## Delivered — M1.3 shared rendering

M1.3 shared texture pages, linear color and ordered scene/UI composition were delivered through [PR #75](https://github.com/cnedwin/Egret_rebuild/pull/75), main `10a37d9dfdeb8762eced73577282127d1c4e4bde`. The [dated evidence follow-up](knowledge-base/en/docs/shared-rendering-evidence.md#m13-delivery-follow-up) preserves the earlier authoring cutoffs and their original pending states.

## Functional delivery — M1.2 incremental rendering

The functional changes were merged through [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74), main `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`. Formal performance acceptance remains open.

M1.2 adds bounded reuse of display capture and rendering preparation, with adjacent compatible batching that preserves painter order. Recorded correctness and native operation counts have separate acceptance from frame-time performance, which remains open. See the [evidence and limits](knowledge-base/en/docs/incremental-frame-preparation-evidence.md). See the [contract](knowledge-base/en/docs/incremental-frame-preparation-contract.md) and [M1 plan](knowledge-base/en/docs/m1-rendering-resource-plan.md).

Current delivery — 2026-10-21: [PR #81](https://github.com/cnedwin/Egret_rebuild/pull/81) is merged at `f9801b7`, with all required CI jobs passed. Six browser regression suites and the complete fixed 30-trial timing batch were independently reviewed. Static/sparse/full-dirty Engine median-p95 is 5.0/6.4/10.3 ms; full-dirty still exceeds 8 ms. M1.2 performance remains OPEN; GPU time is unmeasured.

## Delivered — M1.1 warm submission

M1.1 was merged through [PR #73](https://github.com/cnedwin/Egret_rebuild/pull/73), main `fa88111f5e73503e1804f92a9f444207110b773c`. It reduces repeated image preparation, buffer creation and binding creation. Public APIs and original admission remain unchanged. See the [contract](knowledge-base/en/docs/warm-submission-contract.md) and [verification status](knowledge-base/en/docs/warm-submission-evidence.md); no frame-time or mobile performance improvement is claimed.

## Current version — 0.61.0

The **0.61.0 engineering preview** adds an internal image cache with per-Host ownership, reusing exact cropped GPU images after safe completion. Its LRU mechanism keeps a 32 MiB logical image pool and at most 256 ready entries, preserving existing public admission, rendering profiles and lifecycle management. It adds no public API or dependency.

Read the [contract](knowledge-base/en/docs/gpu-image-residency-contract.md) and [evidence and limits](knowledge-base/en/docs/gpu-image-residency-evidence.md). Controlled specification/ownership results and any current desktop regression results have separate scopes. The new dedicated cache browser matrix remains deferred and OPEN. Physical GPU memory, performance, target devices and actual device-loss recovery remain unverified. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## Atlas import planning — 0.60.0

The **0.60.0 engineering preview** converts supported single-page atlas metadata with an explicit PNG binding into standard SpriteSheet and SequenceClip inputs. The optional `@egret/project/atlas` entry reuses the existing animation and resource-ownership model, so the resulting plan can be composed through the public Engine factories.

Read the [contract](knowledge-base/en/docs/atlas-import-plan-contract.md), [evidence and limits](knowledge-base/en/docs/atlas-import-plan-evidence.md) and [composition example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/atlas-import-playback/README.md). The supported profile is `aseprite-json-array-1.3.18.6-v1`; real exporter compatibility and entitlement remain unverified.

The recorded desktop Canvas/WebGPU composition passed its bounded four-readback verification. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## Delivered normalized atlas frames — 0.59.0

The preceding 0.59 increment was delivered through [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48), Main `44f49f9d97a7baebc400fd4940541529dc33d147`.

Normalized trim/clockwise90 runtime behavior follows the [layout contract](knowledge-base/en/docs/atlas-frame-layout-contract.md); the original 30 browser readbacks remain a separate accepted domain.

## Prepared resource groups — 0.58.0

Engineering preview **0.58.0** adds `Engine.captureBitmapBindings(scope, targets)` and the erased `BitmapBindingTicket` type. The prepared-outfit example waits for both clothing textures and commits their bindings together. Pending, failed, cancelled and obsolete changes preserve the working outfit; a ticket refuses to overwrite a later caller binding.

Recorded desktop Canvas and WebGPU checks passed six fresh contexts with 54 original RGBA readbacks, including separate old-layer controls, genuine mouse selection, animation boundaries and shutdown with original reads still pending. This is finite desktop evidence. General dependency manifests, additional content types, full UI, Spine, production hosts, mobile performance and physical-memory acceptance remain open.

Read the [contract](knowledge-base/en/docs/prepared-resource-groups-spec.md), [evidence and limits](knowledge-base/en/docs/prepared-resource-groups-evidence.md) and [example guide](examples/prepared-resource-groups/README.md).

## Real-resource scene — 0.57.0

Engineering preview **0.57.0** combines real PNG resources, shared atlas playback, text and mouse input through existing public Engine APIs. Canvas is the default; the textured WebGPU scene is an explicit experimental choice. Resource preparation, presentation readiness, input readiness and safe shutdown have separate boundaries. Read the [integration record](knowledge-base/en/docs/resource-scene-integration.md) and [example guide](examples/resource-scene/README.md).

The recorded desktop Canvas/WebGPU workflow completed seven fresh contexts and retained 64 original RGBA frames. Fixed-point and font-region comparisons, negative controls and retirement passed in the documented environment. Phone, cross-environment font, performance and energy acceptance remain open.

## Delivered resource replacement — 0.56.0

The 0.56 resource-replacement increment was delivered through [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45), Main `19c308af4d7c9590f886c8105d5d678e708184c5`. Earlier verification records retain their original cutoffs.

Engineering preview **0.56.0** focuses on recoverable resource replacement. `Engine.createBitmapResourceSlot(scope, bitmap)` provides explicit Texture replacement for one persistent Bitmap, with the erased `BitmapResourceSlot` and `BitmapResourceSlotState` types. The initial lease remains borrowed; the slot owns only fresh replacement leases. The prior usable binding survives pending, failed or cancelled requests, and only the latest accepted intent may commit. Cancellation and supersession reject their request Promises; detailed validation, conflict and lifetime errors follow the [specification](knowledge-base/en/docs/bitmap-resource-slot-spec.md). Read the [evidence](knowledge-base/en/docs/bitmap-resource-slot-evidence.md), [example guide](examples/bitmap-resource-slot/README.md) and [version history](knowledge-base/en/CHANGELOG.md).

Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence. The previous 0.55 layout increment was delivered through [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44). Workspace packages remain private 0.0.0; the host protocol remains 1.0.

## Recent changes

| Version / 版本 | Main change | 主要变化 |
| --- | --- | --- |
| Paragraph layout / 段落布局 · 2026-10-29 | Six alignments, maxLines and truthful overflow; hard-break marker and recoverable no-fit refusal | 六种对齐、maxLines 与真实溢出；硬换行省略号及过窄拒绝／恢复 |
| Final-line bidi / 最终行双向排版 · 2026-10-29 | Native line L1/L2 after wrapping; shared glyph/rect/hit order and sequential trailing-space geometry | 换行后原生行 L1／L2，字形／矩形／命中共享顺序，尾空格依次定位 |
| Readonly paragraphs / 只读段落 · 2026-10-29 | Width-based Latin/CJK/Arabic paragraph layout, natural/minimum line height, ordinary UI and variable-height list integration | 明确字体的中英阿文字自动换行、自然/最小行高，接入普通 UI 与动态高度列表 |
| M2.1 runtime integration / 运行时接入 · 2026-10-29 | Typed PNG/atlas/sequence groups reuse existing resources and lifetimes; complete readiness, cancellation and explicit generation replacement | PNG／图集／序列帧类型化组复用原资源与生命周期，支持完整就绪、取消及显式代际替换 |
| M1.5 delivered / 已交付 · 2026-10-21 | Resource manifests, shared resource loading and device recovery delivered through [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79); formal M1.2 performance remains open | 资源清单、共享资源加载与设备恢复通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付；M1.2 正式性能仍开放 |
| M1.5 recovery verification / 资源恢复验证 · 2026-10-20 | Seven fixed desktop recovery cases verified; [scope and remaining work](knowledge-base/en/docs/resource-recovery-evidence.md) | 七项固定桌面恢复验证完成；[范围与剩余工作](knowledge-base/Cns/docs/resource-recovery-evidence.md) |
| M1.4 | Implemented optional shared WebGL2 executor with finite desktop verification | 已实现可选共享 WebGL2 执行器，具有有限桌面验证 |
| M1.3 | Shared texture pages and linear scene/UI composition delivered through PR #75 | 共享纹理页与线性场景/UI 合成已通过 PR #75 交付 |
| M1.2 | Incremental capture and adjacent batching delivered; performance acceptance open | 增量捕获与相邻合批已交付；性能验收未完成 |
| M1.1 | Completion-safe GPU buffer and binding reuse | 安全完成后的 GPU 缓冲与绑定复用 |
| 0.61.0 | Internal WebGPU image cache with per-Host ownership | 各 Host 独立管理的 WebGPU 内部图像缓存 |
| 0.60.0 | Strict single-page atlas metadata planning with explicit PNG binding | 严格单页图集元数据规划与显式 PNG 绑定 |
| 0.59.0 | Normalized trimmed and clockwise90 atlas frames with stable logical dimensions | 标准化裁边与顺时针90度图集帧，保持逻辑尺寸 |
| 0.58.0 | Atomic multi-Bitmap binding and prepared two-layer outfits | 多 Bitmap 原子绑定与双层组合换装 |
| 0.57.0 | Real-resource scene composition connecting resources, animation, text and input | 连接资源、动画、文本与输入的真实资源场景组合 |
| 0.56.0 | Recoverable single-Bitmap resource replacement with latest accepted intent | 可恢复的单 Bitmap 资源替换与最新已接受意图 |
| 0.55.0 | Explicit local linear planning and a two-button composition example | 显式本地线性规划与双按钮组合示例 |
| 0.54.0 | Shared-input bitmap buttons with pressed/disabled skins and final activation picking | 共享输入位图按钮、按下与禁用皮肤、激活前最终命中复查 |
| 0.53.0 | Runnable atlas/animation playground with explicit pivots and saved/live frames | 图集与动画可运行示例、显式锚点和保存／实时画面 |
| 0.52.0 | Display anchor offsets shared by rendering, coordinates and picking | 渲染、坐标转换与拾取共用显示对象锚点 |

[Full Changelog](knowledge-base/en/CHANGELOG.md) · [Engineering plan](knowledge-base/en/docs/engineering-plan.md)

## Build and try the current playground

The selected development Node.js version is **26.7.0**, pinned exactly in `package.json`, `.node-version` and `.nvmrc`. Keep pnpm 11.25.0 and TypeScript 7.0.2 unchanged. Select Node 26.7.0 in your terminal and verify `node --version` before running the commands below.

Current contributor and migrated browser workflows use Node 26.7.0. Historical Node 24.19.0 receipts retain their original environment. Each browser family still requires its own current inputs and actual execution; changing a version pin alone establishes no compatibility. From the repository root:

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

The [resource replacement example](examples/bitmap-resource-slot/README.md) composes a persistent Bitmap, transformed clipping and independent Buttons; its bounded desktop Canvas/WebGPU checks are recorded in the linked evidence. Try the [layout example](examples/linear-layout/README.md) for explicit planning and Button composition, the [two-button example](examples/bitmap-button/README.md) for Canvas/WebGPU interaction, or the [atlas playground](examples/anchored-atlas-playback/README.md) for resources and animation. Their guides describe the local HTTP server and supported browser paths.

## Read and contribute

Start with [product direction](knowledge-base/en/docs/design-philosophy-and-positioning.md), [requirements](knowledge-base/en/docs/product-requirements.md) and the [technical white paper](knowledge-base/en/docs/technical-white-paper.md). Use the [documentation guide](DOCUMENTATION.md) to find API contracts and verification records.

Contributions follow the [contribution guide](CONTRIBUTING.md). First-party code and documentation use [Apache-2.0](LICENSE); dependencies and research assets retain their own notices. [Acknowledgements](ACKNOWLEDGEMENTS.md) and [source records](source-origin.json) describe their roles and AI-assisted work.
