# 白鹭引擎 7.0 · 社区重建

[English](README.md) | 简体中文

**白鹭引擎 7.0 是面向 Web 游戏的开源 TypeScript 引擎。** 当前候选版 [`v7.0.1-rc.2`](https://github.com/cnedwin/Egret_rebuild/releases/tag/v7.0.1-rc.2) 支持 WebGPU 与 WebGL2 上的 2D 动画和 UI，3D 游戏可按需启用 World3D。

[试玩白鹭游戏](https://github.com/cnedwin/PortedGamesEgret) · [开始开发](#运行示例) · [文档](DOCUMENTATION.zh-CN.md) · [参与贡献](CONTRIBUTING.zh-CN.md) · [项目看板](https://github.com/users/cnedwin/projects/2)

## 创始人寄语

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 运行示例

使用 Node.js 26.7.0，解压[可编辑入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-first-game.zip)，在该目录运行 `npm install` 和 `npm start`。打开 `http://127.0.0.1:8000`，点击方块，然后把 `main.mjs` 中的 `STEP` 从 32 改为 64 并刷新，方块每次移动的距离就会翻倍。

要在已有网页里使用白鹭，可以[下载浏览器引擎和许可证](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.1-rc.2/egret-browser.zip)并选用 2D 或 3D 单文件。使用 npm 的工程可按归档地址安装模块。[7.0 发行说明与校验清单](knowledge-base/Cns/docs/release-archives.md) · [早期工程预览](https://github.com/cnedwin/Egret_rebuild/releases/tag/v0.1.0-preview.1) · [旧版入门示例](https://github.com/cnedwin/Egret_rebuild/releases/download/v0.1.0-preview.1/egret-first-game.zip)

参与引擎本身的开发时，可以直接运行仓库里的示例。

使用 **Node.js 26.7.0** 和 **pnpm 11.25.0**，在仓库根目录运行以下命令。

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

可以复制[入门示例](examples/starter/README.zh-CN.md)作为游戏起点。后续可查阅[上手指南](knowledge-base/Cns/docs/getting-started.md)、[示例索引](examples/README.zh-CN.md)、[公共导入入口](knowledge-base/Cns/docs/entry-points.md)和 [Egret 5 API 迁移指南](knowledge-base/Cns/docs/egret-api-migration.md)。

## 当前白鹭引擎

预览版包含共享 2D 渲染、资源加载和生命周期管理、序列帧和可选 Spine 动画、托管 UI、多语言文字和浏览器输入。[World3D](knowledge-base/Cns/docs/world3d.md) 提供独立的 3D 渲染和物理能力。

[核心能力](knowledge-base/Cns/docs/core-progress.md)记录已实现的功能和设备证据，[工程规划](knowledge-base/Cns/docs/工程规划.md)跟踪剩余验收。一体化 AI 辅助创作平台、更多平台发布及旧工程迁移是[路线图](knowledge-base/Cns/docs/m2-m4-delivery-plan.md)上的产品目标。

## 开发与社区参与

可以在[项目看板](https://github.com/users/cnedwin/projects/2)或 [Issues](https://github.com/cnedwin/Egret_rebuild/issues) 中选择任务。开始前请阅读[贡献指南](CONTRIBUTING.zh-CN.md)。社区欢迎提供复现用例、翻译、示例和独立真机验证。

## 最近交付 / Recent deliveries

| PR | Main change | 主要变化 |
| --- | --- | --- |
| [#372](https://github.com/cnedwin/Egret_rebuild/pull/372) | Independent mouse actions while multiple buttons are held | 多个鼠标键交叠按放时分别驱动动作 |
| [#369](https://github.com/cnedwin/Egret_rebuild/pull/369) · [#370](https://github.com/cnedwin/Egret_rebuild/pull/370) | Play and Play3D clocks, restart, retry and resource cleanup | Play 与 Play3D 时钟、重开、失败重试和资源清理 |
| [#366](https://github.com/cnedwin/Egret_rebuild/pull/366) · [#367](https://github.com/cnedwin/Egret_rebuild/pull/367) | Play3D entry and single-file browser builds | Play3D 入口与浏览器单文件构建 |
| [#341](https://github.com/cnedwin/Egret_rebuild/pull/341) · [#342](https://github.com/cnedwin/Egret_rebuild/pull/342) | Safari PNG loading fix, verified on a physical iPhone with WebGL2 and WebGPU | 修复 Safari PNG 加载，已在 iPhone 真机验证两个后端 |
| [#336](https://github.com/cnedwin/Egret_rebuild/pull/336) | Build and verify installable preview archives | 支持构建和验证可安装的预览包 |

[完整更新日志](knowledge-base/Cns/CHANGELOG.md) · [English changelog](knowledge-base/en/CHANGELOG.md) · [早期预览里程碑](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.zh-CN.md)

## 许可与来源

第一方代码与文档采用 [Apache-2.0](LICENSE)。第三方库、字体、动画运行库和示例保留各自的许可条件。详见 [NOTICE](NOTICE) 和[来源鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)。
