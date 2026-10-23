# 白鹭引擎 Egret Engine 社区重建

[English](README.md) | 简体中文

I'm Edwin, the founder of Egret Engine. In late 2013, WanderWang and I founded Egret Labs and started the Egret Engine project. After twelve years of development, the venture ultimately failed for a variety of reasons.

Years later, as times change and technology advances, many developers continue to encourage us. I hope to rebuild this game engine with the help of AI and the community.

### 中文介绍

我是白鹭引擎的创始人 Edwin，从 2013 年底开始和 WanderWang 一起创建了 Egret Labs 和 Egret Engine 项目。历经 12 年的发展，最终因为种种原因失败了。

多年以后，时代变迁，技术革新，依然有很多开发者在鼓励我们。我希望借助 AI 和社区的力量，重建这个游戏引擎。

## 快速开始与参与

先阅读[上手指南](knowledge-base/Cns/docs/getting-started.md)，使用固定 Node 26.7.0 和 pnpm 11.25.0 运行 `pnpm setup:dev`、`pnpm check:quick`、`pnpm example:browser`。完整工具要求、预期画面及故障处理都在同一指南中。

通过 [Issues](https://github.com/cnedwin/Egret_rebuild/issues) 报告问题，通过 [Discussions](https://github.com/cnedwin/Egret_rebuild/discussions) 提问和讨论；查看[公开 M0–M4 看板](https://github.com/users/cnedwin/projects/2)和 [Milestones](https://github.com/cnedwin/Egret_rebuild/milestones) 了解状态与阶段。[首次贡献：新人演练](https://github.com/cnedwin/Egret_rebuild/issues/52)包含范围、验证步骤与评审入口。M0 完善环境与协作基础，不新增引擎能力。


## M2–M4 架构与社区交付

[M2–M4 路线](knowledge-base/Cns/docs/m2-m4-delivery-plan.md)衔接完整 Spine／内容、UI／文字／输入及混合核心验收。从 [M2 #56](https://github.com/cnedwin/Egret_rebuild/issues/56)、[M3 #57](https://github.com/cnedwin/Egret_rebuild/issues/57) 或 [M4 #58](https://github.com/cnedwin/Egret_rebuild/issues/58) 选择完整工作包，每项说明代码入口、依赖和可评审验收。

## M2.1 内容构建基础

M2.1 增加经过字节验证的 PNG／图集／序列帧构建、持久缓存复用、依赖失效和通过现有项目事务采用的不可变代次，保留源文件与旧代次。参阅[内容构建契约](knowledge-base/Cns/docs/content-build-pipeline.md)。完整 Spine、字体和目标变体继续开放。

## M3.3 多触点基础

M3.3 增加可选 DOM-free 触点路由及 Engine／浏览器入口，支持独立多触点会话、捕获、取消，以及视口和生命周期清理。附双区域示例与可复现桌面采集器，定向回归通过 176 项。参阅[契约与证据](knowledge-base/Cns/docs/multi-pointer-input.md)。完整 M3.3 焦点／IME、M3.4 手势及 Android／iPhone 真机验收继续开放。

## 我们正在构建的产品

白鹭引擎面向使用 AI 创作游戏的新创作者，也服务于希望将手游制作经验带到 Web 的开发者。产品以复杂二维界面和轻量三维内容为中心，通过精简的渲染与运行时、明确的资源所有权，以及代码、可视化工具和 Agent 共用的工程模型，支撑持续创作。

当前仓库提供可运行的工程预览。显示树、资源租约、动画、浏览器输入及部分 Canvas/WebGPU/WebGL2 渲染路径，均有各自的接口契约和验证范围。完整 UI 工具、完整 Spine 支持、目标平台 SDK 和旧工程自动迁移仍在开发中。

## 已交付 — M1.5 资源清单与恢复

M1.5 将资源清单与依赖感知资源组接入共享资源所有权、有界加载与完整性校验、分阶段上传，以及统一的 WebGL2/WebGPU 设备恢复。七项固定桌面恢复验证已在 Windows / Chrome for Testing 157.0.8103.6 上通过；WebGL2 与 WebGPU 各完成 100 次资源循环、十次原生丢失与恢复循环及 30 分钟前台运行。固定恢复结果与受影响的浏览器回归均已通过独立评审。

交付后续记录 — 2026-10-21：[PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 已合入 main `4924b471b52927184252191055f902c30c29af52`。[CI 执行 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) 的四个作业全部成功；Windows 完整集成门禁通过 290 项发布检查、4,528 项核心测试及 160 项 Spine F2 测试，各组失败、取消和跳过均为零。M1.2 正式成对性能验收继续开放。

[验证范围与证据](knowledge-base/Cns/docs/resource-recovery-evidence.md)保留此前失败和未完成的执行，并另行记录已完成的交付。

## 已实现 — M1.4 WebGL2 执行器

M1.4 在共享渲染协议之上实现可选的 `@egret/engine/webgl2` 与 `@egret/engine/webgl2/scene3d` 入口。已记录的桌面验证覆盖固定像素矩阵及有限生命周期／深度／状态场景。这些结果不证明移动端支持、帧耗时性能或持续恢复。参阅[契约](knowledge-base/Cns/docs/webgl2-executor-contract.md)、[已观察结果与边界](knowledge-base/Cns/docs/webgl2-executor-evidence.md)及 [M1 计划](knowledge-base/Cns/docs/m1-rendering-resource-plan.md)。

## 已交付 — M1.3 共享渲染

M1.3 共享纹理页、线性颜色及有序场景/UI 合成已通过 [PR #75](https://github.com/cnedwin/Egret_rebuild/pull/75) 交付，main `10a37d9dfdeb8762eced73577282127d1c4e4bde`。[带日期的证据后续记录](knowledge-base/Cns/docs/shared-rendering-evidence.md#m13-交付后续记录)保留较早编写截止时点及其原始待完成状态。

## 功能已交付 — M1.2 增量渲染

功能改动已通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 合并，主干提交为 `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`；正式性能验收继续开放。

M1.2 为显示捕获和渲染准备增加有界复用，并在保留绘制顺序的前提下合并相邻兼容批次。已记录的正确性与原生操作计数分别验收，帧耗时性能验收仍未完成。参阅[验证记录与边界](knowledge-base/Cns/docs/incremental-frame-preparation-evidence.md)。参阅[契约](knowledge-base/Cns/docs/incremental-frame-preparation-contract.md)及 [M1 计划](knowledge-base/Cns/docs/m1-rendering-resource-plan.md)。

当前交付 — 2026-10-21：[PR #81](https://github.com/cnedwin/Egret_rebuild/pull/81) 已在 `f9801b7` 合入 main，必需 CI 全部通过。六套浏览器回归及完整固定 30 次计时批次均经独立复核。静态／稀疏／全脏 Engine p95 中位数为 5.0／6.4／10.3 ms，全脏仍超过 8 ms。M1.2 性能继续 OPEN，GPU 时间未测量。

## 已交付 — M1.1 提交复用

M1.1 已通过 [PR #73](https://github.com/cnedwin/Egret_rebuild/pull/73) 合并，主干提交为 `fa88111f5e73503e1804f92a9f444207110b773c`。它减少重复图像准备、缓冲创建与绑定创建，保留公开 API 和原准入规则。参阅[契约](knowledge-base/Cns/docs/warm-submission-contract.md)与[验证状态](knowledge-base/Cns/docs/warm-submission-evidence.md)；尚不宣称帧耗时或移动端性能提升。

## 当前版本 — 0.61.0

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](knowledge-base/Cns/docs/gpu-image-residency-contract.md)及[证据与限制](knowledge-base/Cns/docs/gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 图集导入规划 — 0.60.0

**0.60.0 工程预览**将受支持的单页图集元数据与显式 PNG 绑定转换为标准 SpriteSheet、SequenceClip 输入。可选 `@egret/project/atlas` 入口复用既有动画和资源所有权模型，生成的计划可通过公开 Engine 工厂进行组合。

参阅[契约](knowledge-base/Cns/docs/atlas-import-plan-contract.md)、[证据与限制](knowledge-base/Cns/docs/atlas-import-plan-evidence.md)及[组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/atlas-import-playback/README.md)。受支持的 profile 为 `aseprite-json-array-1.3.18.6-v1`；实际 exporter 兼容性与许可资格仍未验证。

记录的桌面 Canvas/WebGPU 组合通过其有限四次读回验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 已交付标准化图集帧 — 0.59.0

前一 0.59 增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。

标准化 trim/clockwise90 runtime 行为遵循[布局契约](knowledge-base/Cns/docs/atlas-frame-layout-contract.md)，原 30 次浏览器读回仍为单独接受领域。

## 资源组合准备 — 0.58.0

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](knowledge-base/Cns/docs/prepared-resource-groups-spec.md)、[证据与边界](knowledge-base/Cns/docs/prepared-resource-groups-evidence.md)及[示例指南](examples/prepared-resource-groups/README.zh-CN.md)。

## 真实资源场景 — 0.57.0

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](knowledge-base/Cns/docs/resource-scene-integration.md)和[示例指南](examples/resource-scene/README.zh-CN.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 已交付的资源替换 — 0.56.0

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

工程预览 **0.56.0** 提供可恢复的资源替换。`Engine.createBitmapResourceSlot(scope, bitmap)` 为同一个持久 Bitmap 提供显式 Texture 替换，并增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。初始租约继续借用，槽仅拥有替换请求实际获取的新租约。请求等待、失败或取消时保留先前可用绑定；只有最新已接受意图可以提交。取消和被新请求取代会拒绝各自请求的 Promise，精确校验、冲突及生命周期错误遵循[规格](knowledge-base/Cns/docs/位图资源槽规格.md)。参阅[证据](knowledge-base/Cns/docs/位图资源槽核验.md)、[示例指南](examples/bitmap-resource-slot/README.zh-CN.md)及[版本历史](knowledge-base/Cns/CHANGELOG.md)。

聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录。前一个 0.55 布局增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付。工作区包仍为 private、版本 0.0.0，宿主协议仍为 1.0。

## 最近更新

| Version / 版本 | Main change | 主要变化 |
| --- | --- | --- |
| M1.5 delivered / 已交付 · 2026-10-21 | Resource manifests, shared resource loading and device recovery delivered through [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79); formal M1.2 performance remains open | 资源清单、共享资源加载与设备恢复通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付；M1.2 正式性能仍开放 |
| M1.5 recovery verification / 资源恢复验证 · 2026-10-20 | Seven fixed desktop recovery cases verified; [scope and remaining work](knowledge-base/en/docs/resource-recovery-evidence.md) | 七项固定桌面恢复验证完成；[范围与剩余工作](knowledge-base/Cns/docs/resource-recovery-evidence.md) |
| M1.4 | Implemented optional shared WebGL2 executor with finite desktop verification | 已实现可选共享 WebGL2 执行器，具有有限桌面验证 |
| M1.3 | Shared texture pages and linear scene/UI composition delivered through PR #75 | 共享纹理页与线性场景/UI 合成已通过 PR #75 交付 |
| M1.2 | Incremental capture and adjacent batching delivered; performance acceptance open | 增量捕获与相邻合批已交付；性能验收未完成 |
| M1.1 | Completion-safe GPU buffer and binding reuse | 安全完成后的 GPU 缓冲与绑定复用 |
| 0.61.0 | Internal WebGPU image cache with per-Host ownership | 各 Host 独立管理的 WebGPU 内部图像缓存 |
| 0.60.0 | Strict single-page atlas metadata planning with explicit PNG binding | 严格单页图集元数据规划与显式 PNG 绑定 |
| 0.59.0 | Normalized trimmed and clockwise90 atlas frames with stable logical dimensions | 标准化裁边与顺时针90度图集帧，保持逻辑尺寸 |
| 0.58.0 | Atomic multi-Bitmap binding and prepared two-layer outfits | 多 Bitmap 原子绑定与双层组合换装 |
| 0.57.0 | Real-resource scene composition connecting resources, animation, text and input | 连接资源、动画、文本与输入的真实资源场景组合 |
| 0.56.0 | Recoverable single-Bitmap resource replacement with latest accepted intent | 可恢复的单 Bitmap 资源替换与最新已接受意图 |
| 0.55.0 | Explicit local linear planning and a two-button composition example | 显式本地线性规划与双按钮组合示例 |
| 0.54.0 | Shared-input bitmap buttons with pressed/disabled skins and final activation picking | 共享输入位图按钮、按下与禁用皮肤、激活前最终命中复查 |
| 0.53.0 | Runnable atlas/animation playground with explicit pivots and saved/live frames | 图集与动画可运行示例、显式锚点和保存／实时画面 |
| 0.52.0 | Display anchor offsets shared by rendering, coordinates and picking | 渲染、坐标转换与拾取共用显示对象锚点 |

[完整变更记录](knowledge-base/Cns/CHANGELOG.md) · [工程规划](knowledge-base/Cns/docs/工程规划.md)

## 构建与运行示例

开发环境指定使用 **Node.js 26.7.0**，在 `package.json`、`.node-version` 和 `.nvmrc` 中固定精确版本。pnpm 11.25.0 与 TypeScript 7.0.2 保持不变。执行下列命令前，请在终端选择 Node 26.7.0 并通过 `node --version` 确认。

当前贡献流程及已迁移的浏览器流程使用 Node 26.7.0。历史 Node 24.19.0 回执保留原始环境。每类浏览器验证仍需当前输入和实际执行，修改版本配置本身不代表兼容性已通过。在仓库根目录执行：

    pnpm setup:dev
    pnpm check:quick
    pnpm example:browser

[资源替换示例](examples/bitmap-resource-slot/README.zh-CN.md)组合持久 Bitmap、变换裁剪及独立按钮，其限定桌面 Canvas/WebGPU 检查已记录在所链接证据中。[布局示例](examples/linear-layout/README.zh-CN.md)展示显式规划与按钮组合；[双按钮示例](examples/bitmap-button/README.zh-CN.md)展示 Canvas/WebGPU 交互，[图集示例](examples/anchored-atlas-playback/README.zh-CN.md)展示资源与动画。各自指南说明本地 HTTP 服务与支持的浏览器运行方式。

## 阅读与参与

建议从[产品定位](knowledge-base/Cns/docs/设计理念与定位.md)、[产品需求](knowledge-base/Cns/docs/产品需求说明书.md)和[技术白皮书](knowledge-base/Cns/docs/技术白皮书.md)开始，再通过[文档导航](DOCUMENTATION.zh-CN.md)查阅接口契约与验证记录。

社区贡献遵循[贡献指南](CONTRIBUTING.zh-CN.md)。第一方代码与文档采用 [Apache-2.0](LICENSE)，依赖与研究资产保留各自声明。[鸣谢](ACKNOWLEDGEMENTS.zh-CN.md)和[来源记录](source-origin.json)说明相关项目及 AI 辅助工作的实际角色。
