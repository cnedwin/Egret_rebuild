# 白鹭引擎知识库

[English](../en/README.md) | 简体中文

白鹭引擎以渲染与运行时为基础，将复杂二维界面、轻量三维内容、资源与动画、创作工具及工程自动化连接起来。知识库说明各部分之间的关系，以及相应的验证方式。

## 从这里开始

| 主题 | 阅读 |
| --- | --- |
| 产品方向 | [定位](docs/设计理念与定位.md) |
| 产品方向 | [需求](docs/产品需求说明书.md) |
| 技术架构 | [技术白皮书](docs/技术白皮书.md) |
| 技术架构 | [系统架构](docs/技术架构.md) |
| 技术架构 | [渲染与运行时](docs/渲染引擎与运行时.md) |
| 技术架构 | [产品组成](docs/产品组成.md) |
| 工程实施 | [工程规划](docs/工程规划.md) |
| 工程实施 | [交付与验收](docs/交付计划.md) |
| 工程实施 | [工程结构](docs/工程技术架构与项目结构.md) |
| 工程实施 | [API 设计](docs/公共API设计与命名规范.md) |
| 创作与兼容 | [AI 与工程接口](docs/AI创作与工程接口.md) |
| 创作与兼容 | [Spine 支持](docs/Spine动画支持需求与验收.md) |
| 创作与兼容 | [旧工程迁移](docs/旧工程迁移.md) |
| 当前集成 | [资源组合准备](docs/prepared-resource-groups-spec.md) |
| 当前集成 | [真实资源场景](docs/resource-scene-integration.md) |
| 进展与参与 | [能力与进展](docs/core-progress.md) |
| 进展与参与 | [变更记录](CHANGELOG.md) |
| 进展与参与 | [贡献指南](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.zh-CN.md) |
| 资料来源 | [鸣谢](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.zh-CN.md) |

## 资源组合准备 — 0.58.0

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](docs/prepared-resource-groups-spec.md)、[证据与边界](docs/prepared-resource-groups-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.zh-CN.md)。

## 真实资源场景 — 0.57.0

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](docs/resource-scene-integration.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.zh-CN.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 已交付的资源替换 — 0.56.0

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

工程预览 **0.56.0** 提供可恢复的资源替换。`Engine.createBitmapResourceSlot(scope, bitmap)` 通过既有根入口替换同一个持久 Bitmap 的 Texture，增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。槽借用初始绑定、拥有新替换租约；请求等待、失败或取消时保留先前可用绑定，只有最新已接受意图可以提交。Promise 拒绝及生命周期细节遵循[规格](docs/位图资源槽规格.md)，参阅[证据](docs/位图资源槽核验.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录。

前一个 0.55 布局增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付。更广泛的接口及剩余工作见[能力与进展](docs/core-progress.md)。工作区包仍为 private、版本 0.0.0，宿主协议仍为 1.0。

## 接口契约与示例

[文档导航](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.zh-CN.md)提供各子系统的契约、证据与可运行示例。详细契约定义所有权、有序读取、错误及资源释放行为；示例指南说明受支持路径的运行方法。

## 登记与历史

[需求](registry/需求.json)、[决策](registry/决策.json)、[假设](registry/假设.json)、[交付](registry/交付.json)和[来源](registry/来源.json)共用一套状态模型，英文版本由中文原始登记册同步。

历史研究整理在[第一轮](archive/第一轮研究.md)、[第二轮](archive/第二轮研究.md)和[第三轮](archive/第三轮研究.md)。日期、固定版本和实验结果保留其适用范围。版本演进见变更记录及相应的详细记录。

## 参与贡献

请先阅读[知识库贡献指南](CONTRIBUTING.md)，按贡献内容选用 [RFC](templates/RFC提案.md)、[ADR](templates/ADR决策记录.md)、[实验](templates/实验与验收.md)及[实现来源](templates/实现来源记录.md)模板。同步维护两种语言，并遵循[知识库维护规范](docs/知识库维护.md)。
