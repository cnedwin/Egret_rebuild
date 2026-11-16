# 白鹭引擎 Egret Engine 社区重建

English | [简体中文](README.zh-CN.md)

**Egret Engine is an open-source TypeScript game engine for the web.** The engineering preview supports 2D animation and UI on WebGPU and WebGL2, with optional World3D.

[Play games built with Egret](https://github.com/cnedwin/PortedGamesEgret) · [Build a game](#run-an-example) · [Documentation](DOCUMENTATION.md) · [Contribute](CONTRIBUTING.md) · [Project board](https://github.com/users/cnedwin/projects/2)

## A note from Edwin / 创始人寄语

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Run an example

Use **Node.js 26.7.0** and **pnpm 11.25.0**. Run these commands from the repository root.

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

The [starter](examples/starter/README.md) is a small game entry point you can copy. The [setup guide](knowledge-base/en/docs/getting-started.md), [examples](examples/README.md), [public imports](knowledge-base/en/docs/entry-points.md), and [Egret 5 API migration guide](knowledge-base/en/docs/egret-api-migration.md) cover the next steps.

## Egret today

The preview includes a shared 2D renderer, asset loading and lifetimes, sprite sequences and optional Spine animation, managed UI, multilingual text, and browser input. [World3D](knowledge-base/en/docs/world3d.md) adds standalone 3D rendering and physics.

The [capability map](knowledge-base/en/docs/core-progress.md) records supported paths and device evidence. The [engineering plan](knowledge-base/en/docs/engineering-plan.md) tracks remaining acceptance. An integrated AI-assisted creator, publishing to more hosts, and legacy project migration are product goals on the [roadmap](knowledge-base/en/docs/m2-m4-delivery-plan.md).

## Development and community

Find scoped work in the [project board](https://github.com/users/cnedwin/projects/2) or [Issues](https://github.com/cnedwin/Egret_rebuild/issues). Read the [contribution guide](CONTRIBUTING.md) before taking a task. Reproduction cases, translations, examples, and independent device validation are welcome.

## Recent deliveries / 最近交付

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#341](https://github.com/cnedwin/Egret_rebuild/pull/341) · [#342](https://github.com/cnedwin/Egret_rebuild/pull/342) | Safari PNG loading fix, verified on a physical iPhone with WebGL2 and WebGPU | 修复 Safari PNG 加载，已在 iPhone 真机验证两个后端 |
| [#340](https://github.com/cnedwin/Egret_rebuild/pull/340) | Windows World3D WebGL2 timer controls and interpretation | Windows World3D WebGL2 计时对照与读数说明 |
| [#337](https://github.com/cnedwin/Egret_rebuild/pull/337) · [#338](https://github.com/cnedwin/Egret_rebuild/pull/338) | Stage-level animation measurements and Spine atlas pages stored with premultiplied alpha | 动画分阶段测量，接入预乘透明度的 Spine 图集页 |
| [#336](https://github.com/cnedwin/Egret_rebuild/pull/336) | Build and verify installable preview archives | 支持构建和验证可安装的预览包 |

[Full changelog](knowledge-base/en/CHANGELOG.md) · [中文更新日志](knowledge-base/Cns/CHANGELOG.md) · [Earlier preview milestones](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.md)

## License and sources

First-party code and documentation use [Apache-2.0](LICENSE). Third-party libraries, fonts, animation runtimes, and examples retain their own terms. See [NOTICE](NOTICE) and [acknowledgements](ACKNOWLEDGEMENTS.md).
