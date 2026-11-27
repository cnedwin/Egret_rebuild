# 白鹭引擎 7.0 · 社区重建

[English](README.md) | 简体中文

**白鹭引擎 7.0 是面向 2D 动画、复杂 UI 和轻量 3D 游戏的开源 TypeScript 引擎。** 游戏可以通过 WebGPU 或 WebGL2 在浏览器运行，支持的场景也可以使用白鹭原生打包方案 Egret Runtime SDK（RSDK）生成 Android 应用。

[试玩游戏展示站](https://cnedwin.github.io/PortedGamesEgret/) · [开始做游戏](#运行示例) · [用 RSDK 打包 Android APK／AAB](knowledge-base/Cns/docs/android-migration-build-kit.md) · [文档](DOCUMENTATION.zh-CN.md) · [项目看板](https://github.com/users/cnedwin/projects/2)

## 创始人寄语

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 运行示例

使用 Node.js 26.7.0，解压[可编辑入门示例](https://github.com/cnedwin/Egret_rebuild/releases/latest/download/egret-first-game.zip)，在该目录运行 `npm install` 和 `npm start`。打开 `http://127.0.0.1:8000`，点击方块，然后把 `main.mjs` 中的 `STEP` 从 32 改为 64 并刷新，方块每次移动的距离就会翻倍。

要在已有网页里使用白鹭，可以[下载浏览器引擎和许可证](https://github.com/cnedwin/Egret_rebuild/releases/latest/download/egret-browser.zip)并选用 2D 或 3D 单文件。使用 npm 的工程可运行 `npm install @egret/engine` 安装公共默认版本，也可按归档地址安装模块。[7.0 发行说明与校验清单](knowledge-base/Cns/docs/release-archives.md) · [历史版本 RC3](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3)

如果希望从 npm 安装现成的浏览器单文件包，2D 游戏选 `npm install @egret/2d`，带 World3D 的游戏选 `npm install @egret/3d`。[浏览器包用法](knowledge-base/Cns/docs/single-file.md)

参与引擎本身的开发时，可以直接运行仓库里的示例。

使用 **Node.js 26.7.0** 和 **pnpm 11.25.0**，在仓库根目录运行以下命令。

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

可以复制[入门示例](examples/starter/README.zh-CN.md)作为游戏起点。后续可查阅[上手指南](knowledge-base/Cns/docs/getting-started.md)、[示例索引](examples/README.zh-CN.md)、[公共导入入口](knowledge-base/Cns/docs/entry-points.md)和 [Egret 5 API 迁移指南](knowledge-base/Cns/docs/egret-api-migration.md)。

## 选择开发路径

- **浏览器游戏。** 2D 从 `play` 开始，World3D 从 `play3d` 开始，两者都能叠加 UI。共享 2D 渲染器支持精灵、序列帧和可选的 Spine 角色。World3D 支持带贴图的 glTF／GLB 模型、灯光、阴影及界面叠层。[2D 指南](knowledge-base/Cns/docs/play.md) · [3D 指南](knowledge-base/Cns/docs/play3d.md) · [图形能力](knowledge-base/Cns/docs/core-progress.md) · [Windows 与 Fold7 实测](knowledge-base/Cns/docs/november-27-claude-hardware.md)
- **用 RSDK 构建 Android 应用。** 导出 arm64 Gradle 工程，用裁剪 V8 运行游戏逻辑，由 Rust／GLES3 绘制，生成本地签名的 APK 或 AAB。交接指南覆盖独立重建、两个发行包比对和升级后读回存档。[游戏播放器](knowledge-base/Cns/docs/android-project-player.md) · [打包与交接](knowledge-base/Cns/docs/android-migration-build-kit.md)
- **维护白鹭 5 老游戏。** 用 Egret Migrate 检查原工程并选路。符合支持范围的工程可迁到白鹭 7 网页版，部分 5.3 游戏也可保留原版引擎模块，用 RSDK 在 Android 上运行。[迁移工具](tools/egret-migrate/README.zh-CN.md) · [兼容实测](knowledge-base/Cns/docs/original5-atlas-verification.md)
- **用 Agent 做游戏。** 从接口索引出发，先做出一个可玩的循环，再用试玩工具核对首次有效操作和重开。集成可视化创作平台仍在产品规划中。[Agent 创作入口](llms.txt) · [产品需求](knowledge-base/Cns/docs/产品需求说明书.md)
- **其他宿主。** iOS 的 JavaScriptCore／Metal 工程已在模拟器运行 2D 样例，微信导出器已在模拟 wx 宿主运行。RSDK 的实体 iPhone 安装和微信客户端真机验证仍待完成。[RSDK 各平台进度](knowledge-base/Cns/docs/runtime-sdk.md) · [微信导出](knowledge-base/Cns/docs/wechat-minigame.md)

## 开发与社区参与

可以在[项目看板](https://github.com/users/cnedwin/projects/2)或 [Issues](https://github.com/cnedwin/Egret_rebuild/issues) 中选择任务。开始前请阅读[贡献指南](CONTRIBUTING.zh-CN.md)。社区欢迎提供复现用例、翻译、示例和独立真机验证。

## 最近交付 / Recent deliveries

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#539](https://github.com/cnedwin/Egret_rebuild/pull/539) | Retain original Egret 5 login controls and system text editing in an Android Release APK | 在 Android 发行包中运行旧作原版登录、系统输入和选服界面 |
| [#537](https://github.com/cnedwin/Egret_rebuild/pull/537) · [#538](https://github.com/cnedwin/Egret_rebuild/pull/538) | Select a migration route and replay a two-player match from a real Egret 5 game | 识别旧工程迁移路径，验证双人联机旧作打完一局并重新发牌 |
| [#536](https://github.com/cnedwin/Egret_rebuild/pull/536) | Check signing identity and saved progress across a local Android upgrade | 验证 Android 本地签名包覆盖升级与读回存档 |
| [#535](https://github.com/cnedwin/Egret_rebuild/pull/535) | Check World3D native UI hit areas in a software browser at Fold7 cover-screen dimensions | 在软件浏览器用 Fold7 外屏尺寸核对 World3D 原生 UI 命中区域 |

[完整更新日志](knowledge-base/Cns/CHANGELOG.md) · [English changelog](knowledge-base/en/CHANGELOG.md) · [早期预览里程碑](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.zh-CN.md)

## 许可与来源

第一方代码与文档采用 [Apache-2.0](LICENSE)。第三方库、字体、动画运行库和示例保留各自的许可条件。详见 [NOTICE](NOTICE) 和[来源鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)。
