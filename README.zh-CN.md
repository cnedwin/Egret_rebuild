# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 我们正在构建的产品

白鹭引擎面向使用 AI 创作游戏的新创作者，也服务于希望将手游制作经验带到 Web 的开发者。产品以复杂二维界面和轻量三维内容为中心，通过精简的渲染与运行时、明确的资源所有权，以及代码、可视化工具和 Agent 共用的工程模型，支撑持续创作。

当前仓库提供可运行的工程预览。显示树、资源租约、动画、浏览器输入及部分 Canvas/WebGPU 渲染路径，均有各自的接口契约和验证范围。完整 UI 工具、完整 Spine 支持、目标平台 SDK 和旧工程自动迁移仍在开发中。

## 当前版本

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](knowledge-base/Cns/docs/resource-scene-integration.md)和[示例指南](examples/resource-scene/README.zh-CN.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 已交付的资源替换 — 0.56.0

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

工程预览 **0.56.0** 提供可恢复的资源替换。`Engine.createBitmapResourceSlot(scope, bitmap)` 为同一个持久 Bitmap 提供显式 Texture 替换，并增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。初始租约继续借用，槽仅拥有替换请求实际获取的新租约。请求等待、失败或取消时保留先前可用绑定；只有最新已接受意图可以提交。取消和被新请求取代会拒绝各自请求的 Promise，精确校验、冲突及生命周期错误遵循[规格](knowledge-base/Cns/docs/位图资源槽规格.md)。参阅[证据](knowledge-base/Cns/docs/位图资源槽核验.md)、[示例指南](examples/bitmap-resource-slot/README.zh-CN.md)及[版本历史](knowledge-base/Cns/CHANGELOG.md)。

聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录。前一个 0.55 布局增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付。工作区包仍为 private、版本 0.0.0，宿主协议仍为 1.0。

## 最近更新

| Version / 版本 | Main change | 主要变化 |
| --- | --- | --- |
| 0.57.0 | Real-resource scene composition connecting resources, animation, text and input | 连接资源、动画、文本与输入的真实资源场景组合 |
| 0.56.0 | Recoverable single-Bitmap resource replacement with latest accepted intent | 可恢复的单 Bitmap 资源替换与最新已接受意图 |
| 0.55.0 | Explicit local linear planning and a two-button composition example | 显式本地线性规划与双按钮组合示例 |
| 0.54.0 | Shared-input bitmap buttons with pressed/disabled skins and final activation picking | 共享输入位图按钮、按下与禁用皮肤、激活前最终命中复查 |
| 0.53.0 | Runnable atlas/animation playground with explicit pivots and saved/live frames | 图集与动画可运行示例、显式锚点和保存／实时画面 |
| 0.52.0 | Display anchor offsets shared by rendering, coordinates and picking | 渲染、坐标转换与拾取共用显示对象锚点 |

[完整变更记录](knowledge-base/Cns/CHANGELOG.md) · [工程规划](knowledge-base/Cns/docs/工程规划.md)

## 构建与运行示例

使用已记录的 Node.js 24.19.0、pnpm 11.25.0 和 TypeScript 7.0.2 工具链，在仓库根目录执行：

    pnpm install --frozen-lockfile --ignore-scripts
    git config --local core.hooksPath .githooks
    node tools/verify.mjs
    node examples/headless.mjs

[资源替换示例](examples/bitmap-resource-slot/README.zh-CN.md)组合持久 Bitmap、变换裁剪及独立按钮，其限定桌面 Canvas/WebGPU 检查已记录在所链接证据中。[布局示例](examples/linear-layout/README.zh-CN.md)展示显式规划与按钮组合；[双按钮示例](examples/bitmap-button/README.zh-CN.md)展示 Canvas/WebGPU 交互，[图集示例](examples/anchored-atlas-playback/README.zh-CN.md)展示资源与动画。各自指南说明本地 HTTP 服务与支持的浏览器运行方式。

## 阅读与参与

建议从[产品定位](knowledge-base/Cns/docs/设计理念与定位.md)、[产品需求](knowledge-base/Cns/docs/产品需求说明书.md)和[技术白皮书](knowledge-base/Cns/docs/技术白皮书.md)开始，再通过[文档导航](DOCUMENTATION.zh-CN.md)查阅接口契约与验证记录。

社区贡献遵循[贡献指南](CONTRIBUTING.zh-CN.md)。第一方代码与文档采用 [Apache-2.0](LICENSE)，依赖与研究资产保留各自声明。[鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)和[来源记录](source-origin.json)说明相关项目及 AI 辅助工作的实际角色。
