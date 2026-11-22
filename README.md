# Egret Engine 7.0 · Community Rebuild

English | [简体中文](README.zh-CN.md)

**Egret Engine 7.0 is an open-source TypeScript game engine.** Build browser games with animated characters, layered UI and lightweight 3D scenes on WebGPU or WebGL2. The 7.0.2 distribution includes standalone browser files, five npm-format modules and an editable starter. [7.0.2 downloads and installation](knowledge-base/en/docs/release-archives.md)

[Play games built with Egret](https://github.com/cnedwin/PortedGamesEgret) · [Build a game](#run-an-example) · [Documentation](DOCUMENTATION.md) · [Contribute](CONTRIBUTING.md) · [Project board](https://github.com/users/cnedwin/projects/2)

## A note from Edwin / 创始人寄语

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Run an example

With Node.js 26.7.0, extract the [editable starter](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-first-game.zip) and run `npm install`, then `npm start` in that folder. Open `http://127.0.0.1:8000` and click the square. Change `STEP` from 32 to 64 in `main.mjs` and reload to double the distance it moves.

For an existing web page, [download the browser files and licences](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-browser.zip) and choose the 2D or 3D engine. In an npm project, run `npm install @egret/engine` to install the public default version, or install the modules by archive URL. [7.0 release notes and checksums](knowledge-base/en/docs/release-archives.md) · [Previous RC3 release](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3)

To work on the engine itself:

Use **Node.js 26.7.0** and **pnpm 11.25.0**. Run these commands from the repository root.

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

The [starter](examples/starter/README.md) is a small game entry point you can copy. The [setup guide](knowledge-base/en/docs/getting-started.md), [examples](examples/README.md), [public imports](knowledge-base/en/docs/entry-points.md), and [Egret 5 API migration guide](knowledge-base/en/docs/egret-api-migration.md) cover the next steps.

## Choose a development path

- **Browser.** Start a game with `play` or `play3d` in one file. Import the shared 2D renderer, sprite sequences, optional Spine, managed UI, native text editing or World3D directly when your game needs finer control. [Play](knowledge-base/en/docs/play.md) · [Play3D](knowledge-base/en/docs/play3d.md) · [API index for AI tools](llms.txt)

- **Native Android.** The Runtime SDK exports an arm64 project for locally signed APKs and AABs. Trimmed V8 runs game scripts and a Rust GLES3 player renders the scene. A playable 2D act with Spine and scrolling UI and selected 3D levels with textured models and a 2D HUD have run on Galaxy Z Fold7. [Player guide and supported profiles](knowledge-base/en/docs/android-project-player.md)

- **WeChat Mini Games.** The repository includes a WebGL2 mini-game project exporter. The current check uses a simulated wx host. WeChat DevTools, the on-device WeChat client and platform review remain open. [Export guide](knowledge-base/en/docs/wechat-minigame.md)

The integrated visual creator, additional native hosts and one-click migration of older Egret projects are longer-term product goals. [Capabilities and device evidence](knowledge-base/en/docs/core-progress.md) · [Product requirements](knowledge-base/en/docs/product-requirements.md) · [Engineering plan](knowledge-base/en/docs/engineering-plan.md)

## Development and community

Find scoped work in the [project board](https://github.com/users/cnedwin/projects/2) or [Issues](https://github.com/cnedwin/Egret_rebuild/issues). Read the [contribution guide](CONTRIBUTING.md) before taking a task. Reproduction cases, translations, examples, and independent device validation are welcome.

## Recent deliveries / 最近交付

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#447](https://github.com/cnedwin/Egret_rebuild/pull/447) | Export a browser game as a WeChat Mini Game project and check it against a simulated wx host | 将浏览器游戏导出为微信小游戏工程，可在模拟 wx 环境中检查 |
| [#445](https://github.com/cnedwin/Egret_rebuild/pull/445) · [#446](https://github.com/cnedwin/Egret_rebuild/pull/446) | Verify selected browser paths on Windows and Fold7. Prebuild 22 static meshes for the 24-model gallery | Windows 和 Fold7 浏览器实测。含 24 个模型的画廊改为预生成 22 个静态网格 |
| [#436](https://github.com/cnedwin/Egret_rebuild/pull/436) · [#438](https://github.com/cnedwin/Egret_rebuild/pull/438) · [#441](https://github.com/cnedwin/Egret_rebuild/pull/441) | Keep native Android geometry resident and replay 210 frames of Rally driving | Android 原生播放器复用驻留几何，实机回放 210 帧赛车驾驶 |
| [#429](https://github.com/cnedwin/Egret_rebuild/pull/429) – [#432](https://github.com/cnedwin/Egret_rebuild/pull/432) | Signed local Android builds, a playable 2D act and selected World3D levels with textured GLBs | Android 本地签名构建，跑通 2D 关卡与包含贴图 GLB 的选定 3D 关卡 |
| [#411](https://github.com/cnedwin/Egret_rebuild/pull/411) | Build Spine 4.3 atlas, JSON and binary skeleton artifacts from exported inputs | 从 Spine 4.3 导出文件构建图集、JSON 及二进制骨骼产物 |

[Full changelog](knowledge-base/en/CHANGELOG.md) · [中文更新日志](knowledge-base/Cns/CHANGELOG.md) · [Earlier preview milestones](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.md)

## License and sources

First-party code and documentation use [Apache-2.0](LICENSE). Third-party libraries, fonts, animation runtimes, and examples retain their own terms. See [NOTICE](NOTICE) and [acknowledgements](ACKNOWLEDGEMENTS.md).
