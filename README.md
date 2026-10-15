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

## Current version

Engineering preview **0.54.0** was integrated through [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42). Workspace packages remain private at 0.0.0 and the host protocol remains 1.0. The [capability overview](knowledge-base/en/docs/core-progress.md) explains what is implemented and which verification each subsystem has.

## Five recent changes

| Version / 版本 | Main change | 主要变化 |
| --- | --- | --- |
| 0.54.0 | Shared-input bitmap buttons with pressed/disabled skins and final activation picking | 共享输入位图按钮、按下与禁用皮肤、激活前最终命中复查 |
| 0.53.0 | Runnable atlas/animation playground with explicit pivots and saved/live frames | 图集与动画可运行示例、显式锚点和保存／实时画面 |
| 0.52.0 | Display anchor offsets shared by rendering, coordinates and picking | 渲染、坐标转换与拾取共用显示对象锚点 |
| 0.51.0 | Indexed display-child insertion with preserved ownership | 按索引插入显示子对象并保持所有权语义 |
| 0.50.0 | Query the current index of a direct display child | 查询直接显示子对象的当前索引 |

[Full Changelog](knowledge-base/en/CHANGELOG.md) · [Engineering plan](knowledge-base/en/docs/engineering-plan.md)

## Build and try the current playground

Use the recorded Node.js 24.19.0, pnpm 11.25.0 and TypeScript 7.0.2 toolchain. From the repository root:

    pnpm install --frozen-lockfile --ignore-scripts
    git config --local core.hooksPath .githooks
    node tools/verify.mjs
    node examples/headless.mjs

Run the [two-button example](examples/bitmap-button/README.md) for Canvas/WebGPU interaction, or the [atlas playground](examples/anchored-atlas-playback/README.md) for resources and animation. Their guides describe the local HTTP server and supported browser paths.

## Read and contribute

Start with [product direction](knowledge-base/en/docs/design-philosophy-and-positioning.md), [requirements](knowledge-base/en/docs/product-requirements.md) and the [technical white paper](knowledge-base/en/docs/technical-white-paper.md). Use the [documentation guide](DOCUMENTATION.md) to find API contracts and verification records.

Contributions follow the [contribution guide](CONTRIBUTING.md). First-party code and documentation use [Apache-2.0](LICENSE); dependencies and research assets retain their own notices. [Acknowledgements](ACKNOWLEDGEMENTS.md) and [source records](source-origin.json) describe their roles and AI-assisted work.
