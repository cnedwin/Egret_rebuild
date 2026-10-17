# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## What we are building

Egret Engine is an open-source game-engine rebuild for creators working with AI and for developers bringing mobile-game experience to the Web. The product centers on complex 2D interfaces and lightweight 3D, with a small rendering/runtime foundation, explicit resource ownership and a shared project model for code, visual tools and agents.

The repository contains an executable engineering preview. Display trees, resource leases, animation, browser input and selected Canvas/WebGPU rendering paths are available within their documented contracts. Full UI tooling, complete Spine support, target-platform SDKs and automated legacy-project migration remain in development.

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

Use the recorded Node.js 24.19.0, pnpm 11.25.0 and TypeScript 7.0.2 toolchain. From the repository root:

    pnpm install --frozen-lockfile --ignore-scripts
    git config --local core.hooksPath .githooks
    node tools/verify.mjs
    node examples/headless.mjs

The [resource replacement example](examples/bitmap-resource-slot/README.md) composes a persistent Bitmap, transformed clipping and independent Buttons; its bounded desktop Canvas/WebGPU checks are recorded in the linked evidence. Try the [layout example](examples/linear-layout/README.md) for explicit planning and Button composition, the [two-button example](examples/bitmap-button/README.md) for Canvas/WebGPU interaction, or the [atlas playground](examples/anchored-atlas-playback/README.md) for resources and animation. Their guides describe the local HTTP server and supported browser paths.

## Read and contribute

Start with [product direction](knowledge-base/en/docs/design-philosophy-and-positioning.md), [requirements](knowledge-base/en/docs/product-requirements.md) and the [technical white paper](knowledge-base/en/docs/technical-white-paper.md). Use the [documentation guide](DOCUMENTATION.md) to find API contracts and verification records.

Contributions follow the [contribution guide](CONTRIBUTING.md). First-party code and documentation use [Apache-2.0](LICENSE); dependencies and research assets retain their own notices. [Acknowledgements](ACKNOWLEDGEMENTS.md) and [source records](source-origin.json) describe their roles and AI-assisted work.
