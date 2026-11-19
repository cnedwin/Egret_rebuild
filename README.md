# Egret Engine 7.0 · Community Rebuild

English | [简体中文](README.zh-CN.md)

**Egret Engine 7.0 is an open-source TypeScript game engine for the web.** The [`v7.0.1-rc.3` release candidate](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3) supports 2D animation and UI on WebGPU and WebGL2, with optional World3D for 3D games.

[Play games built with Egret](https://github.com/cnedwin/PortedGamesEgret) · [Build a game](#run-an-example) · [Documentation](DOCUMENTATION.md) · [Contribute](CONTRIBUTING.md) · [Project board](https://github.com/users/cnedwin/projects/2)

## A note from Edwin / 创始人寄语

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Run an example

With Node.js 26.7.0, extract the [editable starter](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-first-game.zip) and run `npm install`, then `npm start` in that folder. Open `http://127.0.0.1:8000` and click the square. Change `STEP` from 32 to 64 in `main.mjs` and reload to double the distance it moves.

For an existing web page, [download the browser files and licences](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.3/egret-browser.zip) and choose the 2D or 3D engine. In an npm project, run `npm install @egret/engine` to get `7.0.1-rc.3`, or install the modules by archive URL. [7.0 release notes and checksums](knowledge-base/en/docs/release-archives.md) · [Early engineering preview](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) · [Original starter ZIP](https://github.com/cnedwin/Egret_rebuild/releases/download/v0.1.0-preview.1/egret-first-game.zip)

To work on the engine itself:

Use **Node.js 26.7.0** and **pnpm 11.25.0**. Run these commands from the repository root.

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

The [starter](examples/starter/README.md) is a small game entry point you can copy. The [setup guide](knowledge-base/en/docs/getting-started.md), [examples](examples/README.md), [public imports](knowledge-base/en/docs/entry-points.md), and [Egret 5 API migration guide](knowledge-base/en/docs/egret-api-migration.md) cover the next steps.

## Egret today

The release candidate includes a shared 2D renderer, asset loading and lifetimes, sprite sequences and optional Spine animation, managed UI, multilingual text, and browser input. [World3D](knowledge-base/en/docs/world3d.md) adds standalone 3D rendering and physics.

- **A whole game in one file.** [`play`](knowledge-base/en/docs/play.md) and [`play3d`](knowledge-base/en/docs/play3d.md) start a small 2D or 3D game from one call, with input, sound made in code, tweens and overlap tests. The [single files](knowledge-base/en/docs/single-file.md) `egret2d.js` and `egret3d.js` need no build step, and [`llms.txt`](llms.txt) is the page an AI agent reads to write one.
- **Android.** The [Runtime SDK](knowledge-base/en/docs/runtime-sdk.md) preview runs an exported 2D game in an Android app through a Rust GLES3 player, with a WebView or optional embedded V8 script host. The [Android project player](knowledge-base/en/docs/android-project-player.md) guide covers the AAR and export. World3D on the native host is not available yet ([#393](https://github.com/cnedwin/Egret_rebuild/issues/393)).

The [capability map](knowledge-base/en/docs/core-progress.md) records supported paths and device evidence. The [engineering plan](knowledge-base/en/docs/engineering-plan.md) tracks remaining acceptance. An integrated AI-assisted creator, publishing to more hosts, and legacy project migration are product goals on the [roadmap](knowledge-base/en/docs/m2-m4-delivery-plan.md).

## Development and community

Find scoped work in the [project board](https://github.com/users/cnedwin/projects/2) or [Issues](https://github.com/cnedwin/Egret_rebuild/issues). Read the [contribution guide](CONTRIBUTING.md) before taking a task. Reproduction cases, translations, examples, and independent device validation are welcome.

## Recent deliveries / 最近交付

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#384](https://github.com/cnedwin/Egret_rebuild/pull/384) – [#392](https://github.com/cnedwin/Egret_rebuild/pull/392) | Android project player: embedded V8, native command replay, atlas regions, packaged text and binary assets | Android 项目播放器：内嵌 V8、原生命令重放、图集区域、包内文本与二进制资源 |
| [#381](https://github.com/cnedwin/Egret_rebuild/pull/381) · [#383](https://github.com/cnedwin/Egret_rebuild/pull/383) | Android Rust Runtime SDK with WebView and V8 hosts, measured on a Galaxy Z Fold7 | Android Rust Runtime SDK，含 WebView 与 V8 宿主，已在 Galaxy Z Fold7 实测 |
| [#379](https://github.com/cnedwin/Egret_rebuild/pull/379) · [#382](https://github.com/cnedwin/Egret_rebuild/pull/382) | One tag releases browser files, packages and the starter; `7.0.1-rc.3` on npm under `next` | 一个标签发布浏览器文件、包和入门工程；`7.0.1-rc.3` 以 `next` 发布到 npm |
| [#369](https://github.com/cnedwin/Egret_rebuild/pull/369) – [#373](https://github.com/cnedwin/Egret_rebuild/pull/373) | Play and Play3D clocks, restart and cleanup; agent guide cards; mouse chords and drag pointers | Play 与 Play3D 时钟、重开和清理；智能体指南卡片；鼠标组合键与拖动指针 |
| [#360](https://github.com/cnedwin/Egret_rebuild/pull/360) – [#368](https://github.com/cnedwin/Egret_rebuild/pull/368) | Play and Play3D, `llms.txt` and the `egret2d.js` / `egret3d.js` single files | Play 与 Play3D、`llms.txt` 以及 `egret2d.js`／`egret3d.js` 单文件 |

[Full changelog](knowledge-base/en/CHANGELOG.md) · [中文更新日志](knowledge-base/Cns/CHANGELOG.md) · [Earlier preview milestones](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.md)

## License and sources

First-party code and documentation use [Apache-2.0](LICENSE). Third-party libraries, fonts, animation runtimes, and examples retain their own terms. See [NOTICE](NOTICE) and [acknowledgements](ACKNOWLEDGEMENTS.md).
