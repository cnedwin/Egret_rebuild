# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

**白鹭是面向 Web 游戏的开源 TypeScript 引擎。** 当前为工程预览，WebGPU 和 WebGL2 支持 2D 动画与 UI，并可按需启用 World3D。

[试玩白鹭游戏](https://github.com/cnedwin/PortedGamesEgret) · [开始开发](#运行示例) · [文档](DOCUMENTATION.zh-CN.md) · [参与贡献](CONTRIBUTING.zh-CN.md) · [项目看板](https://github.com/users/cnedwin/projects/2)

## 创始人寄语

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 运行示例

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
| [#341](https://github.com/cnedwin/Egret_rebuild/pull/341) · [#342](https://github.com/cnedwin/Egret_rebuild/pull/342) | Safari PNG loading fix, verified on a physical iPhone with WebGL2 and WebGPU | 修复 Safari PNG 加载，已在 iPhone 真机验证两个后端 |
| [#340](https://github.com/cnedwin/Egret_rebuild/pull/340) | Windows World3D WebGL2 timer controls and interpretation | Windows World3D WebGL2 计时对照与读数说明 |
| [#337](https://github.com/cnedwin/Egret_rebuild/pull/337) · [#338](https://github.com/cnedwin/Egret_rebuild/pull/338) | Stage-level animation measurements and Spine atlas pages stored with premultiplied alpha | 动画分阶段测量，接入预乘透明度的 Spine 图集页 |
| [#336](https://github.com/cnedwin/Egret_rebuild/pull/336) | Build and verify installable preview archives | 支持构建和验证可安装的预览包 |

[完整更新日志](knowledge-base/Cns/CHANGELOG.md) · [English changelog](knowledge-base/en/CHANGELOG.md) · [早期预览里程碑](https://github.com/cnedwin/Egret_rebuild/blob/ab2527359e475f2f24f6758538d925abcce53846/README.zh-CN.md)

## 许可与来源

第一方代码与文档采用 [Apache-2.0](LICENSE)。第三方库、字体、动画运行库和示例保留各自的许可条件。详见 [NOTICE](NOTICE) 和[来源鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)。
