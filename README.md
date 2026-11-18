# Egret Engine 7.0 · Community Rebuild

English | [简体中文](README.zh-CN.md)

**Egret Engine 7.0 is an open-source TypeScript game engine for the web.** The [`v7.0.1-rc.2` release candidate](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.2) supports 2D animation and UI on WebGPU and WebGL2, with optional World3D for 3D games.

[Play games built with Egret](https://github.com/cnedwin/PortedGamesEgret) · [Build a game](#run-an-example) · [Documentation](DOCUMENTATION.md) · [Contribute](CONTRIBUTING.md) · [Project board](https://github.com/users/cnedwin/projects/2)

## A note from Edwin / 创始人寄语

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Run an example

With Node.js 26.7.0, extract the [editable starter](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-first-game.zip) and run `npm install`, then `npm start` in that folder. Open `http://127.0.0.1:8000` and click the square. Change `STEP` from 32 to 64 in `main.mjs` and reload to double the distance it moves.

For an existing web page, [download the browser files and licences](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-browser.zip) and choose the 2D or 3D engine. npm projects can install the modules by archive URL. [7.0 release notes and checksums](knowledge-base/en/docs/release-archives.md) · [Early engineering preview](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) · [Original starter ZIP](https://github.com/cnedwin/Egret_rebuild/releases/download/v0.1.0-preview.1/egret-first-game.zip)

To work on the engine itself:

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
| [#372](https://github.com/cnedwin/Egret_rebuild/pull/372) | Independent mouse actions while multiple buttons are held | 多个鼠标键交叠按放时分别驱动动作 |
| [#369](https://github.com/cnedwin/Egret_rebuild/pull/369) · [#370](https://github.com/cnedwin/Egret_rebuild/pull/370) | Play and Play3D clocks, restart, retry and resource cleanup | Play 与 Play3D 时钟、重开、失败重试和资源清理 |
| [#366](https://github.com/cnedwin/Egret_rebuild/pull/366) · [#367](https://github.com/cnedwin/Egret_rebuild/pull/367) | Play3D entry and single-file browser builds | Play3D 入口与浏览器单文件构建 |
| [#341](https://github.com/cnedwin/Egret_rebuild/pull/341) · [#342](https://github.com/cnedwin/Egret_rebuild/pull/342) | Safari PNG loading fix, verified on a physical iPhone with WebGL2 and WebGPU | 修复 Safari PNG 加载，已在 iPhone 真机验证两个后端 |
| [#336](https://github.com/cnedwin/Egret_rebuild/pull/336) | Build and verify installable preview archives | 支持构建和验证可安装的预览包 |

[Full changelog](knowledge-base/en/CHANGELOG.md) · [中文更新日志](knowledge-base/Cns/CHANGELOG.md) · [Earlier preview milestones](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.md)

## License and sources

First-party code and documentation use [Apache-2.0](LICENSE). Third-party libraries, fonts, animation runtimes, and examples retain their own terms. See [NOTICE](NOTICE) and [acknowledgements](ACKNOWLEDGEMENTS.md).
