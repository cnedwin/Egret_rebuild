# 白鹭引擎 7.0 · 社区重建

[English](README.md) | 简体中文

**白鹭引擎 7.0 是面向游戏开发者的开源 TypeScript 引擎。** 可以用 WebGPU 或 WebGL2 制作有复杂 UI、角色动画和轻量 3D 场景的浏览器游戏。7.0.2 提供浏览器单文件、五个 npm 格式模块和可编辑的入门工程。[7.0.2 下载与安装说明](knowledge-base/Cns/docs/release-archives.md)

[试玩白鹭游戏](https://github.com/cnedwin/PortedGamesEgret) · [开始开发](#运行示例) · [文档](DOCUMENTATION.zh-CN.md) · [参与贡献](CONTRIBUTING.zh-CN.md) · [项目看板](https://github.com/users/cnedwin/projects/2)

## 创始人寄语

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 运行示例

使用 Node.js 26.7.0，解压[可编辑入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-first-game.zip)，在该目录运行 `npm install` 和 `npm start`。打开 `http://127.0.0.1:8000`，点击方块，然后把 `main.mjs` 中的 `STEP` 从 32 改为 64 并刷新，方块每次移动的距离就会翻倍。

要在已有网页里使用白鹭，可以[下载浏览器引擎和许可证](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-browser.zip)并选用 2D 或 3D 单文件。使用 npm 的工程可运行 `npm install @egret/engine` 安装公共默认版本，也可按归档地址安装模块。[7.0 发行说明与校验清单](knowledge-base/Cns/docs/release-archives.md) · [历史版本 RC3](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.3)

如果希望从 npm 安装现成的浏览器单文件包，2D 游戏选 `npm install @egret/2d@7.0.2`，带 World3D 的游戏选 `npm install @egret/3d@7.0.2`。[浏览器包用法](knowledge-base/Cns/docs/single-file.md)

参与引擎本身的开发时，可以直接运行仓库里的示例。

使用 **Node.js 26.7.0** 和 **pnpm 11.25.0**，在仓库根目录运行以下命令。

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

可以复制[入门示例](examples/starter/README.zh-CN.md)作为游戏起点。后续可查阅[上手指南](knowledge-base/Cns/docs/getting-started.md)、[示例索引](examples/README.zh-CN.md)、[公共导入入口](knowledge-base/Cns/docs/entry-points.md)和 [Egret 5 API 迁移指南](knowledge-base/Cns/docs/egret-api-migration.md)。

## 选择开发路径

- **浏览器。** `play` 和 `play3d` 适合从一个文件开始。需要更多控制时，可直接导入共享 2D、序列帧、可选 Spine、托管 UI、原生文字输入或 World3D 模块。[游戏入口](knowledge-base/Cns/docs/play.md) · [3D 入门](knowledge-base/Cns/docs/play3d.md) · [给 AI 工具的接口索引](llms.txt)

- **Android 原生。** Runtime SDK 可导出 arm64 工程，用外部签名构建 APK 和 AAB。默认使用裁剪 V8 与 Rust GLES3 播放器。Fold7 已运行带 Spine 和滚动 UI 的 2D 关卡，以及带纹理模型和 2D HUD 的选定 3D 关卡。[原生播放器与适用范围](knowledge-base/Cns/docs/android-project-player.md)

- **微信小游戏。** 仓库工具可导出使用 WebGL2 的小游戏工程。现有检查使用模拟 wx 宿主，微信开发者工具、微信客户端真机和提交审核仍待验证。[微信小游戏导出指南](knowledge-base/Cns/docs/wechat-minigame.md)

一体化可视化创作平台、更多原生宿主和旧工程一键迁移属于后续产品目标。[核心能力与真机证据](knowledge-base/Cns/docs/core-progress.md) · [产品需求](knowledge-base/Cns/docs/产品需求说明书.md) · [工程规划](knowledge-base/Cns/docs/工程规划.md)

## 开发与社区参与

可以在[项目看板](https://github.com/users/cnedwin/projects/2)或 [Issues](https://github.com/cnedwin/Egret_rebuild/issues) 中选择任务。开始前请阅读[贡献指南](CONTRIBUTING.zh-CN.md)。社区欢迎提供复现用例、翻译、示例和独立真机验证。

## 最近交付 / Recent deliveries

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#447](https://github.com/cnedwin/Egret_rebuild/pull/447) | Export a browser game as a WeChat Mini Game project and check it against a simulated wx host | 将浏览器游戏导出为微信小游戏工程，可在模拟 wx 环境中检查 |
| [#445](https://github.com/cnedwin/Egret_rebuild/pull/445) · [#446](https://github.com/cnedwin/Egret_rebuild/pull/446) | Verify selected browser paths on Windows and Fold7. Prebuild 22 static meshes for the 24-model gallery | Windows 和 Fold7 浏览器实测。含 24 个模型的画廊改为预生成 22 个静态网格 |
| [#436](https://github.com/cnedwin/Egret_rebuild/pull/436) · [#438](https://github.com/cnedwin/Egret_rebuild/pull/438) · [#441](https://github.com/cnedwin/Egret_rebuild/pull/441) | Keep native Android geometry resident and replay 210 frames of Rally driving | Android 原生播放器复用驻留几何，实机回放 210 帧赛车驾驶 |
| [#429](https://github.com/cnedwin/Egret_rebuild/pull/429) – [#432](https://github.com/cnedwin/Egret_rebuild/pull/432) | Signed local Android builds, a playable 2D act and selected World3D levels with textured GLBs | Android 本地签名构建，跑通 2D 关卡与包含贴图 GLB 的选定 3D 关卡 |
| [#411](https://github.com/cnedwin/Egret_rebuild/pull/411) | Build Spine 4.3 atlas, JSON and binary skeleton artifacts from exported inputs | 从 Spine 4.3 导出文件构建图集、JSON 及二进制骨骼产物 |

[完整更新日志](knowledge-base/Cns/CHANGELOG.md) · [English changelog](knowledge-base/en/CHANGELOG.md) · [早期预览里程碑](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.zh-CN.md)

## 许可与来源

第一方代码与文档采用 [Apache-2.0](LICENSE)。第三方库、字体、动画运行库和示例保留各自的许可条件。详见 [NOTICE](NOTICE) 和[来源鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)。
