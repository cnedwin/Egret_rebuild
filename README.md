# Egret Engine 7.0 · Community Rebuild

English | [简体中文](README.zh-CN.md)

**Egret Engine 7.0 is an open-source TypeScript game engine for animated 2D games, complex UI and lightweight 3D.** Play games in a browser with WebGPU or WebGL2, or package supported scenes for Android with the Egret Runtime SDK (RSDK).

[Play the games](https://cnedwin.github.io/PortedGamesEgret/) · [Create a game](#run-an-example) · [Build an Android APK/AAB with RSDK](knowledge-base/en/docs/android-migration-build-kit.md) · [Documentation](DOCUMENTATION.md) · [Project board](https://github.com/users/cnedwin/projects/2)

## A note from Edwin / 创始人寄语

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## Run an example

With Node.js 26.7.0, extract the [editable starter](https://github.com/cnedwin/Egret_rebuild/releases/latest/download/egret-first-game.zip) and run `npm install`, then `npm start` in that folder. Open `http://127.0.0.1:8000` and click the square. Change `STEP` from 32 to 64 in `main.mjs` and reload to double the distance it moves.

For an existing web page, [download the browser files and licences](https://github.com/cnedwin/Egret_rebuild/releases/latest/download/egret-browser.zip) and choose the 2D or 3D engine. In an npm project, run `npm install @egret/engine` to install the public default version, or install the modules by archive URL. [7.0 release notes and checksums](knowledge-base/en/docs/release-archives.md) · [Previous RC3 release](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3)

For a prebuilt browser bundle from npm, choose `npm install @egret/2d` for 2D or `npm install @egret/3d` for World3D. [Browser bundle guide](knowledge-base/en/docs/single-file.md)

To work on the engine itself:

Use **Node.js 26.7.0** and **pnpm 11.25.0**. Run these commands from the repository root.

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

The [starter](examples/starter/README.md) is a small game entry point you can copy. The [setup guide](knowledge-base/en/docs/getting-started.md), [examples](examples/README.md), [public imports](knowledge-base/en/docs/entry-points.md), and [Egret 5 API migration guide](knowledge-base/en/docs/egret-api-migration.md) cover the next steps.

## Choose a development path

- **Browser games.** Use `play` for 2D or `play3d` for World3D. Both support a layered UI. The shared 2D renderer draws sprites, frame animation and optional Spine characters. World3D supports textured glTF/GLB models, lights, shadows and a UI overlay. [2D guide](knowledge-base/en/docs/play.md) · [3D guide](knowledge-base/en/docs/play3d.md) · [Graphics coverage](knowledge-base/en/docs/core-progress.md) · [Windows and Fold7 tests](knowledge-base/en/docs/november-27-claude-hardware.md)
- **Android apps with RSDK.** Export a Gradle project for arm64, run game code in trimmed V8 and render with Rust/GLES3. Generate a locally signed APK or AAB. The receiver guide covers rebuilding, comparing two releases and preserving a save across an update. [Game player](knowledge-base/en/docs/android-project-player.md) · [Packaging and handoff](knowledge-base/en/docs/android-migration-build-kit.md)
- **Existing Egret 5 games.** Use Egret Migrate to inspect the original project and select a route. Supported projects can migrate to Egret 7 on the web. Selected original 5.3 games can retain their engine modules and run in RSDK on Android. [Egret Migrate](tools/egret-migrate/README.md) · [Compatibility evidence](knowledge-base/en/docs/original5-atlas-verification.md)
- **Creating with an Agent.** Start with the API index, build a small playable loop, then run the gameplay checker against the first action and restart. The integrated visual creator remains a product goal. [Agent entry point](llms.txt) · [Product requirements](knowledge-base/en/docs/product-requirements.md)
- **Other hosts.** The iOS JavaScriptCore/Metal project runs a 2D fixture in the simulator. The WeChat exporter runs against a simulated wx host. Physical iPhone installation of RSDK and testing in the WeChat client remain open. [RSDK platform status](knowledge-base/en/docs/runtime-sdk.md) · [WeChat guide](knowledge-base/en/docs/wechat-minigame.md)

## Development and community

Find scoped work in the [project board](https://github.com/users/cnedwin/projects/2) or [Issues](https://github.com/cnedwin/Egret_rebuild/issues). Read the [contribution guide](CONTRIBUTING.md) before taking a task. Reproduction cases, translations, examples, and independent device validation are welcome.

## Recent deliveries / 最近交付

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#539](https://github.com/cnedwin/Egret_rebuild/pull/539) | Retain original Egret 5 login controls and system text editing in an Android Release APK | 在 Android 发行包中运行旧作原版登录、系统输入和选服界面 |
| [#537](https://github.com/cnedwin/Egret_rebuild/pull/537) · [#538](https://github.com/cnedwin/Egret_rebuild/pull/538) | Select a migration route and replay a two-player match from a real Egret 5 game | 识别旧工程迁移路径，验证双人联机旧作打完一局并重新发牌 |
| [#536](https://github.com/cnedwin/Egret_rebuild/pull/536) | Check signing identity and saved progress across a local Android upgrade | 验证 Android 本地签名包覆盖升级与读回存档 |
| [#535](https://github.com/cnedwin/Egret_rebuild/pull/535) | Check World3D native UI hit areas in a software browser at Fold7 cover-screen dimensions | 在软件浏览器用 Fold7 外屏尺寸核对 World3D 原生 UI 命中区域 |

[Full changelog](knowledge-base/en/CHANGELOG.md) · [中文更新日志](knowledge-base/Cns/CHANGELOG.md) · [Earlier preview milestones](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.md)

## License and sources

First-party code and documentation use [Apache-2.0](LICENSE). Third-party libraries, fonts, animation runtimes, and examples retain their own terms. See [NOTICE](NOTICE) and [acknowledgements](ACKNOWLEDGEMENTS.md).
