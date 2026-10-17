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
| 当前集成 | [实验性 WebGPU 图像驻留](docs/gpu-image-residency-contract.md) · [证据](docs/gpu-image-residency-evidence.md) |
| 当前集成 | [图集导入规划](docs/atlas-import-plan-contract.md) · [证据](docs/atlas-import-plan-evidence.md) |
| 当前集成 | [图集帧布局](docs/atlas-frame-layout-contract.md) · [证据](docs/atlas-frame-layout-evidence.md) |
| 当前集成 | [资源组合准备](docs/prepared-resource-groups-spec.md) |
| 当前集成 | [真实资源场景](docs/resource-scene-integration.md) |
| 进展与参与 | [能力与进展](docs/core-progress.md) |
| 进展与参与 | [变更记录](CHANGELOG.md) |
| 进展与参与 | [贡献指南](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md) |
| 资料来源 | [鸣谢](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md) |

## 实验性 WebGPU 图像驻留 — 0.61.0

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](docs/gpu-image-residency-contract.md)及[证据与限制](docs/gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 图集导入规划 — 0.60.0

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 入口，以一个显式 PNG 绑定规划严格单页 Aseprite stable-marker JSON-array。两个运行时值与十六个擦除类型为既有 SpriteSheet、SequenceClip 工厂生成自有、冻结的输入。精确 profile 为 `aseprite-json-array-1.3.18.6-v1`；exporter 输出兼容性、声明 hash 与许可资格仍未验证。

参阅[契约](docs/atlas-import-plan-contract.md)及[证据与限制](docs/atlas-import-plan-evidence.md)。

已独立接受的保存结果分别为聚焦 planner 47/47、较早正常 SDK 核心 3625/3625 与单独 F2 160/160，以及独立 CPU firstGREEN 5/5；这些重叠范围不相加。独立审查还接受所选新增 Native Canvas/WebGPU 四次读回结果。最终集成门禁/prepush 及 0.60 Git/远端交付仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

前一 0.59 增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。较早 0.59 读物和证据保留原编写截止点，新增交付说明不改写它们。未报告远端 status 或 check run，不据此推断 CI 通过。

## 标准化图集帧 — 0.59.0

**0.59.0 工程预览候选**已实现通过显式 `'trim-rotation-v1'` profile 使用标准化单页图集帧。SpriteSheet 和 SequenceClip 在裁去透明边缘或将像素顺时针旋转 90 度打包后，仍保留精灵的逻辑画布。动画各帧的 Bitmap 放置与自然尺寸保持一致；省略 profile 或传入 `undefined` 保留原矩形行为。

[裁边图集示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md)使用同一个不可变 clip 组合两个独立 once/loop actor，并演示 anchor 与 parent clip。输入、所有权及验证细节见[布局契约](docs/atlas-frame-layout-contract.md)和[证据与边界](docs/atlas-frame-layout-evidence.md)。

截至 2026-10-17 编写截止点，SDK 行为、严格消费者及源码边界检查已有接受结果。另经独立审查的桌面 Canvas 和纹理 WebGPU 运行完成六个全新上下文及 30 次完整 RGBA 读回，覆盖指定突变对照及原资源退役后的保存帧重放。最终公开内容/prepush 检查与 0.59 Git/远端交付仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 资源组合准备 — 0.58.0

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](docs/prepared-resource-groups-spec.md)、[证据与边界](docs/prepared-resource-groups-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md)。

## 真实资源场景 — 0.57.0

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](docs/resource-scene-integration.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 已交付的资源替换 — 0.56.0

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

工程预览 **0.56.0** 提供可恢复的资源替换。`Engine.createBitmapResourceSlot(scope, bitmap)` 通过既有根入口替换同一个持久 Bitmap 的 Texture，增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。槽借用初始绑定、拥有新替换租约；请求等待、失败或取消时保留先前可用绑定，只有最新已接受意图可以提交。Promise 拒绝及生命周期细节遵循[规格](docs/位图资源槽规格.md)，参阅[证据](docs/位图资源槽核验.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录。

前一个 0.55 布局增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付。更广泛的接口及剩余工作见[能力与进展](docs/core-progress.md)。工作区包仍为 private、版本 0.0.0，宿主协议仍为 1.0。

## 接口契约与示例

[文档导航](https://github.com/cnedwin/Egret_rebuild/blob/main/DOCUMENTATION.md)提供各子系统的契约、证据与可运行示例。详细契约定义所有权、有序读取、错误及资源释放行为；示例指南说明受支持路径的运行方法。

## 登记与历史

[需求](registry/需求.json)、[决策](registry/决策.json)、[假设](registry/假设.json)、[交付](registry/交付.json)和[来源](registry/来源.json)共用一套状态模型，英文版本由中文原始登记册同步。

历史研究整理在[第一轮](archive/第一轮研究.md)、[第二轮](archive/第二轮研究.md)和[第三轮](archive/第三轮研究.md)。日期、固定版本和实验结果保留其适用范围。版本演进见变更记录及相应的详细记录。

## 参与贡献

请先阅读[知识库贡献指南](CONTRIBUTING.md)，按贡献内容选用 [RFC](templates/RFC提案.md)、[ADR](templates/ADR决策记录.md)、[实验](templates/实验与验收.md)及[实现来源](templates/实现来源记录.md)模板。同步维护两种语言，并遵循[知识库维护规范](docs/知识库维护.md)。
