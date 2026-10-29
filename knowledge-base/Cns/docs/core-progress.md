# 核心工程进展

[English](../../en/docs/core-progress.md) | 简体中文

核心工程通过可运行增量连接显示、资源、动画、输入与宿主执行。本页概述当前接口及后续产品工作，链接的契约说明精确行为与验证范围。

## 响应式示例——2026-10-30

手机预览使用现有角色、多指针、UI 和段落 SDK，补齐响应式列布局、有界 DPR 和有序会话替换。固定验收文件与旧鼠标 API 保持不变。参阅[示例契约](mobile-examples.md)；桌面模拟不代表真机、输入法、性能或 M4 验收完成。

## M3.2 段落对齐与行数限制 — 2026-10-29

只读段落新增左／右／居中／start／end／两端对齐及固定省略号的 maxLines。硬换行／空白行溢出显示省略号，过窄时明确拒绝且保留已提交内容；继续复用既有 UI 几何与资源所有权。见[布局契约](paragraph-layout-controls.md)。针对性 36 项及每后端 20 项实际浏览器检查属于有限功能证据；完整 M3.2、设备、IME 和性能继续 OPEN。

## M3.2 只读 UI 段落与最终行双向排版 — 2026-10-29

可选只读 SDK 已用明确字体字节、按宽换行、自然／最小行高及现有资源租约驱动普通 UI 与虚拟列表。当前所选原生后端保留 P1 上下文并解析实际最终行，统一字形存储、矩形与命中查询。有限原生检查及 WebGL2／WebGPU 各 14 项真实 Edge 检查通过。[SDK 契约](readonly-paragraph-sdk.md)与[最终行记录](paragraph-line-bidi.md)给出精确范围。完整 M3.2、独立字形／墨迹、编辑／输入法、手机、性能和内存／OOM 继续 OPEN。以下检查点保留原有产物与采用边界。

## M3.2 私有 bidi 后端比较 — 2026-10-29

已构建的私有 SheenBidi 比较版本接入全部四个真实段落 builder 路径。声明的完整 bidi schedule 记录 953,627 次已观察尝试，严格比较零差异，另有 28 项固定 adapter 的 auto 案例为 NOT_OBSERVED；原 ICU 失败继续保留。真实段落 finite 检查及有界桌面 CPU raster／浏览器检查在各自范围内通过。本次不增加公开 SDK／provider 或产品运行时依赖。最终软换行 L1、独立 glyph／ink 参考、live／physical memory 验收、IME／移动端及 M4 仍为 OPEN。详见[比较结果、源码包与证据边界](paragraph-bidi-comparison.md)。

## 历史 M3.2 私有段落检查点 — 2026-10-28

此前有界私有 CPU 检查点记录18项聚焦控制通过，三个声明 profile 的完整 grapheme／line 边界输入均零差异。严格 bidi 比较仍保留105,785次 class 尝试失败，以及11项 character／11项固定 adapter 不符。在最大64MiB下，实际线性内存容量从32增长到38.4375MiB，不代表内存合格。截至该检查点，SheenBidi v3.0.0 仅完成源码比较准备，没有 adapter 或运行结果；没有交付公开段落 API，也没有采用 provider。详见 [M3.2 检查点、来源标注与剩余限制](m3-ui-text-input-plan.md)。

## 实验性 WebGPU 图像驻留 — 0.61.0

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](gpu-image-residency-contract.md)及[证据与限制](gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

0.61 增量已通过 [PR #50](https://github.com/cnedwin/Egret_rebuild/pull/50) 交付，Main 为 `030a34646774dea6c46cc947b55186da9265a6c8`。

## 图集导入规划 — 0.60.0

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 入口，以一个显式 PNG 绑定规划严格单页 Aseprite stable-marker JSON-array。两个运行时值与十六个擦除类型为既有 SpriteSheet、SequenceClip 工厂生成自有、冻结的输入。精确 profile 为 `aseprite-json-array-1.3.18.6-v1`；exporter 输出兼容性、声明 hash 与许可资格仍未验证。

参阅[契约](atlas-import-plan-contract.md)及[证据与限制](atlas-import-plan-evidence.md)。

已独立接受的保存结果分别为聚焦 planner 47/47、较早正常 SDK 核心 3625/3625 与单独 F2 160/160，以及独立 CPU firstGREEN 5/5；这些重叠范围不相加。独立审查还接受所选新增 Native Canvas/WebGPU 四次读回结果。截至当时的编写截止点，最终集成门禁/prepush 及 0.60 Git/远端交付仍待完成；0.60 增量随后已通过 [PR #49](https://github.com/cnedwin/Egret_rebuild/pull/49) 交付，Main 为 `8d94620d1134d347bf4cc08d2ef8d76c46c6b308`。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

前一 0.59 增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。较早 0.59 读物和证据保留原编写截止点，新增交付说明不改写它们。未报告远端 status 或 check run，不据此推断 CI 通过。

## 标准化图集帧 — 0.59.0

显式 `'trim-rotation-v1'` profile 通过一个擦除的 readonly `AtlasFrameLayout` 类型扩展现有 SpriteSheet 和 SequenceClip 工厂。带透明裁边及顺时针90度打包的 crop 通过 Bitmap、SequencePlayer 和 SequencePlayback 保留原始逻辑画布。两个 frame collector 均以 `M * S` 合成图像放置，parent clip、anchor 和 child 坐标仍使用原 display matrix。默认/undefined profile 保留原矩形路径。完整输入、精确 lease 与所有权规则见[契约](atlas-frame-layout-contract.md)、[证据](atlas-frame-layout-evidence.md)和[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md)。

经独立审查的十二阶段 SDK `node tools/verify.mjs` 运行通过 **3559/3559 项核心测试**及单独的 **160/160 项 Spine 实验测试**，两套的 failed/cancelled/skipped/todo 均为 **0**。该次运行完成构建、严格消费者和源码边界阶段。另经独立审查的桌面 Canvas 与纹理 WebGPU 运行通过六个全新上下文、30 次零容差完整 RGBA 读回，覆盖 once/loop 时间、持有时间恢复、anchor、parent clip、每后端两个指定突变对照，以及原资源退役后的保存帧重放。当前验证器增加了第十三个图集源码边界阶段；截至本次编写，完整重跑、最终公开内容/prepush、0.59 Git 交付及远端 CI 仍待完成。

此有限增量不关闭更广泛的 P03/P04/P05 工作范围。exporter 导入、多页、pivot/nine-slice 导入、动画资源事务与恢复、controller seek/rate/events、完整 UI、完整 Spine R020/V020、迁移 R008/V006、物理 GPU/移动端行为、内存和性能保持 OPEN。工作区包仍为 private、版本 0.0.0，Host 协议为 1.0。

## 资源组合准备 — 0.58.0

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](prepared-resource-groups-spec.md)、[证据与边界](prepared-resource-groups-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md)。

## 真实资源场景集成 — 0.57.0

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](resource-scene-integration.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 可恢复位图资源替换 — 0.56.0

`Engine.createBitmapResourceSlot(scope, bitmap)` 在替换 Texture 时保持同一 Bitmap 身份，根入口仅新增擦除类型名称 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。初始绑定继续借用，槽仅拥有新获取的替换租约；请求等待、失败或取消时保留先前可用绑定，只有最新已接受意图可以提交。拒绝、绑定冲突及生命周期细节遵循[规格](位图资源槽规格.md)，参阅[证据](位图资源槽核验.md)和[组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录。

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

## 显式本地布局 — 0.55.0

`@egret/engine/layout` 的纯函数 `planLinearLayout` 生成冻结矩形计划。调用方选择成员，再通过既有 display API 应用坐标；双 Button 示例展示布局、共享输入及保存/实时帧的组合。已记录的桌面 Canvas/WebGPU 检查覆盖固定双 Button 流程；环境及边界见证据记录。 参阅[规格](local-linear-layout-spec.md)和[证据](local-linear-layout-evidence.md)。

0.55 增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 合并，Main 为 `f6b7968db89febfdbe00fb1322f208ab2135f68f`，tree 为 `86e9d3da4831f4bbbc6a20545c4434ecc9a5b791`。该已交付截止点与 0.56 证据分别保留。

## 前次集成 — 0.54.0

工程预览 **0.54.0** 已通过 [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42) 合并。Main 为 efd2a9c91fb6cfe633214b50b82cf7952941452a，tree 为 2b39b8439a5b30ce3572edc162e8a7a916a76185。工作区包仍为 private、版本 0.0.0，宿主协议为 1.0。

## 已实现范围与边界

| 领域 | 当前工程能力 | 参考 |
| --- | --- | --- |
| 显示与输入 | DisplayObject/Container、变换与锚点、坐标／bounds、显式命中区域、主鼠标路由与位图按钮。 | [契约与范围](位图按钮契约.md) |
| 资源 | 类型化引用、共享获取、租约、Scope 释放、获取组、纹理、命名 SpriteSheet 裁剪及可选 PNG Provider；0.56 的可恢复单 Bitmap 替换已有受限行为、类型及桌面渲染证据。 | [获取范围](资源批量获取.md)、[替换规格](位图资源槽规格.md) |
| 动画 | 显式游戏时间、标量 Tween、图集序列采样及 Engine 时钟序列播放；标准化 trim/顺时针90度帧已有 SDK 及有限桌面 Canvas/WebGPU 证据。 | [播放](时钟驱动序列动画契约.md)、[帧布局](atlas-frame-layout-contract.md) |
| 二维呈现 | 不可变画面捕获、Canvas/WebGPU 路径、纹理几何／Mesh2D 及各自规格中的 NineSliceBitmap。 | [契约与范围](自有纹理几何与Mesh2D契约.md) |
| 文字 | 文字栅格编排、非编辑 TextField 及选定 Canvas 文字集成。 | [契约与范围](文字显示TF1契约.md) |
| 三维 | CPU 几何／矩阵、自有场景画面及选定的显式浏览器网格／场景路径。 | [契约与范围](公共3D场景契约.md) |
| Spine | 导入与网格源规划、线性动画源规格及实验性官方 Core 手动桥接。 | [契约与范围](SpineCore手动网格桥接.md) |
| 工程与迁移 | 自有二进制读写器、工程事务契约及受限旧 RES／MovieClip 分析。 | [契约与范围](旧工程迁移.md) |

默认核心不依赖 DOM/Node，Canvas 和 WebGPU 通过显式浏览器入口使用。显示组装、时间推进、捕获和提交分别定义契约。资源租约及 Scope/Engine 所有权明确取消与释放行为。

## 已集成 0.54 的验证

已记录的 0.54 工作完成全部九个本地代码阶段，核心 **3218/3218**、保留 Spine 源码 **160/160**、按钮聚焦检查 **163/163**。按钮类型正例产生 **0** 诊断，负例匹配 **19** 项诊断。正常 prepush、必需的提交／推送钩子均完成，合并代码树与已审阅文件核对一致。

桌面 Edge **155.0.4283.45** 的 Canvas/WebGPU 验证完成 **38** 次主读回及 **87552** 通道比较，容差 **0**、差异 **0**。另一个全新 Canvas 对照记录 **2** 次读回，故意错误的预期相差 **48** 像素和 **96** 通道，不计入主案例。详见[按钮验证记录](位图按钮核验.md)。这些计数对应不同范围，不能相加。

GitHub 未为 PR #42 返回状态或检查运行，以上本地验证与远端 CI 分别记录。桌面像素结果未完成目标手机性能、能耗、字体范围或完整宿主验收。

## 后续工作与贡献

- 在显式本地规划器之外继续完善 UI 组合，以及触摸、键盘、焦点、无障碍和编辑。
- 继续核验并扩展真实资源示例，推进多资源换装、恢复及动画重定向，明确所有权与宿主边界。
- 按 **R020/V020** 完成版本化 Spine 支持及功能／后端／宿主矩阵。
- 扩展三维场景、角色和特效，连接资产及生命周期。
- 生产浏览器／小游戏／原生宿主，以及目标设备文字与性能。
- 创作工具、Agent／工程接口及 **R008/V006** 完整旧工程迁移。

以上均保留工程与验收义务，范围由[工程规划](工程规划.md)、[交付计划](交付计划.md)和登记册跟踪。

## CPU 参考公式

历史 A2 Task5a 使用 tools/texture-oracle.mjs。expectedUploadRGBA 对整数 straight 通道计算 floor((C*A+127)/255)。expectedEncodedOver 在 premultiplied encoded 域内，按显式 opacity 计算 binary64 source-over，不进行 UNORM 量化或颜色传递转换。assertTexturePixel 要求调用方提供四个明确的绝对通道界限。设备校准单独进行。

## 历史工程证据

[变更记录](../CHANGELOG.md)说明各增量的主要作用。早期详细结果、失败与准备截点保存在子系统证据及[固定版本进展记录](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/docs/core-progress.md)中。历史计数和哈希继续标识原始源码，后续阅读整理不重新执行或扩大其结论。

可复现改动与审阅流程见[贡献指南](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md)。第一方实现、外部依赖和研究参考分别保留来源及许可。
