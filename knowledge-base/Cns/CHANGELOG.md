# 变更记录

[English](../en/CHANGELOG.md) | 简体中文

下列版本号标识工程检查点；工作区包仍为 private、版本 0.0.0，宿主协议为 1.0。各检查点的验收范围以子系统契约和证据为准。

## 可选 Spine 资产 — 2026-10-30

固定官方 Core4.3.13，通过既有资源与 Scope 读取 JSON 设置资产及原始多页图集。可选 SDK 保留明确许可条件和不可变信息；完整播放、图形、稳定素材集与独立参考继续开放。 [SDK](docs/spine-content-ingress.md).

## 段落对齐与行数限制 — 2026-10-29

只读段落新增左／右／居中／start／end／两端对齐及固定省略号的 maxLines。硬换行／空白行溢出显示省略号，过窄时明确拒绝且保留已提交内容；继续复用既有 UI 几何与资源所有权。见[布局契约](docs/paragraph-layout-controls.md)。针对性 36 项及每后端 20 项实际浏览器检查属于有限功能证据；完整 M3.2、设备、IME 和性能继续 OPEN。

## 最终行双向排版 — 2026-10-29

可选段落运行库在换行后应用原生逐行 L1／L2，绘制、几何与命中共享 canonical 字形存储。有限原生及实际浏览器检查覆盖重置空格、控制逻辑槽和宽度恢复；完整 M3.2、设备与性能验收仍未完成。见[行契约](docs/paragraph-line-bidi.md)。

## M2.2 序列帧控制 — 2026-10-23

可选动画入口增加倍率、有限总播放次数、有序标记以及显式静默／重放跳转，共享既有时钟和资源所有权。新旧播放不能同时占用同一个 Bitmap。参见[序列帧控制契约](docs/sequence-controls.md)。完整 Spine 与 M2.2 验收仍然开放。

## M3.1 完整提交的 UI 面板 — 2026-10-23

M3.1 增加托管 UI 根、显式 prepare/commit、自动行列布局、稳定键变高列表和有界异步行复用。多个面板复用现有渲染器、输入路由和资源所有者。详见[UI 面板契约](docs/ui-data-panel.md)。完整控件、段落文字、焦点／IME、手势、移动端资格与性能验收继续开放。

## M2.1 内容构建基础 — 2026-10-23

M2.1 增加经过字节验证的 PNG／图集／序列帧构建、持久缓存复用、依赖失效和通过现有项目事务采用的不可变代次，保留源文件与旧代次。参阅[内容构建契约](docs/content-build-pipeline.md)。完整 Spine、字体和目标变体继续开放。

## M3.3 多触点基础 — 2026-10-23

M3.3 增加可选 DOM-free 触点路由及 Engine／浏览器入口，支持独立多触点会话、捕获、取消，以及视口和生命周期清理。附双区域示例与可复现桌面采集器，定向回归通过 176 项。参阅[契约与证据](docs/multi-pointer-input.md)。完整 M3.3 焦点／IME、M3.4 手势及 Android／iPhone 真机验收继续开放。

## M1.2 准备阶段后续优化 — 2026-10-21

有界裁剪校验与矩形复用、同槽缓存查找、角点临时数组减少及已包含边处理，减少重复准备工作，同时保留原有工作预算和失败顺序，不改变公开 API。候选的原生预检、像素及操作计数已通过，每帧 draw 仍为基线 991、候选 155。此前正式计时未达到目标；最新诊断因前台窗口切换中断，尚无有效候选成对计时或新一轮正式计时结果。M1.2 验收继续开放；参阅[验证记录与边界](docs/incremental-frame-preparation-evidence.md)。

## M1.5 交付 — 2026-10-21

资源清单、依赖感知的共享加载、分阶段上传及统一 WebGL2/WebGPU 恢复已通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付，main 为 `4924b471b52927184252191055f902c30c29af52`。[CI 执行 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) 的四个作业全部成功。Windows 完整集成门禁通过 290 项发布检查、4,528 项核心测试和 160 项 Spine F2 测试，各组失败、取消和跳过均为零。

固定 C7 七案以及二十四个受影响的浏览器套件（三十六次调用）均已完成实际执行与独立评审。M1.2 正式成对性能及外部平台/设备验收继续开放。[验证记录](docs/resource-recovery-evidence.md)保留较早截止点与本地失败执行，并另行记录此次完成的交付。

## M1.5 资源恢复验证 — 2026-10-20

M1.5 增加资源清单、依赖感知加载和共享资源所有权，支持有界加载与完整性校验、分阶段上传，以及统一的 WebGL2/WebGPU 恢复。Windows / Chrome for Testing 157.0.8103.6 上的七项固定恢复验证及受影响的浏览器回归均已通过独立评审。WebGL2 与 WebGPU 各完成 100 次资源循环、十次原生丢失与恢复循环及 30 分钟前台运行。在此验证截止点，最终工作包评审、M1.5 受保护合并门禁与 M1.2 正式性能验收仍待完成。参阅[验证记录](docs/resource-recovery-evidence.md)。

流程简化已单独通过 [PR #78](https://github.com/cnedwin/Egret_rebuild/pull/78) 合并。交付情况以仓库的 [PR 记录](https://github.com/cnedwin/Egret_rebuild/pulls)为准；较早条目保留各自记录截止点。

## M1.3 候选 — 共享纹理页与渲染

显式共享配置分离源页、逻辑纹理区域、材质状态和已完成帧身份。多个图集区域共享规范化上传，裁边/旋转、九宫格、明暗双色、有序边界和有界目标复用共同支撑复杂 2D 界面。有限线性 B1 路径先合成不透明 3D 与共享 UI，最后统一转换一次输出；既有颜色配置继续保留。

100 项聚焦检查、24 项类型负例，以及固定桌面矩阵中的 30 个正常场景和 11 组三段数值反例，均在记录范围内通过。完整回归和受保护集成仍待完成。参阅[契约](docs/shared-render-profile-contract.md)与[结果及限制](docs/shared-rendering-evidence.md)。这些结果不构成性能、手机或完整 Spine 声明。

## M1.2 功能已交付 — 增量有序帧准备

已通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 合并，主干提交为 `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`；正式性能验收仍开放。下文早期候选观察保留各自记录截止点。

M1.2 复用未变化的显示变换、裁剪和已准备几何，并在保持绘制顺序及公开 API 的前提下合并相邻兼容绘制。当前资源仍执行完整准入，保存帧保持与后续修改隔离。固定原生操作场景记录的每帧 draw 为基线 991、候选 155。

参阅[契约](docs/incremental-frame-preparation-contract.md)及[验证记录与边界](docs/incremental-frame-preparation-evidence.md)。操作计数不能证明耗时提升。在该早期截止点，基线在固定预热中达到两帧在途上限。后续完成的计时及当前候选状态另见上文，M1.2 性能验收继续开放。完整发布门禁和仓库交付分别记录。

## M1.1 已交付 — WebGPU 提交复用

已通过 [PR #73](https://github.com/cnedwin/Egret_rebuild/pull/73) 合并，主干提交为 `fa88111f5e73503e1804f92a9f444207110b773c`。早期证据保留原记录截止点；仓库交付不扩大其性能或平台支持声明。

M1.1 增加安全完成后的顶点、索引、uniform 缓冲复用及完整键绑定复用，并省去已覆盖热图像的裁剪复制。有限缓存保留原准入规则、绘制顺序与公开 API。参阅[契约](docs/warm-submission-contract.md)及[当前证据](docs/warm-submission-evidence.md)。实际操作计数、原生图像验证、性能与仓库交付分别验收。

## 0.61.0 — 实验性 WebGPU 图像驻留

**0.61.0 工程预览**增加由各 WebGPU Host 独立管理的内部图像缓存，复用已安全完成的精确裁剪 GPU 图像。LRU 机制维持 32 MiB 逻辑图像池和最多 256 个可复用条目，保留原公开准入、渲染模式与生命周期管理，不增加公开 API 或依赖。

参阅[契约](docs/gpu-image-residency-contract.md)及[证据与限制](docs/gpu-image-residency-evidence.md)。受控规格/所有权结果和实际当前桌面回归结果具有各自范围。新增缓存专用浏览器矩阵延期并保持 OPEN。物理 GPU 内存、性能、目标设备与实际 device-loss 恢复仍未验证。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 0.60.0 候选 — 图集导入规划

**0.60.0 工程预览**增加可选 `@egret/project/atlas` 入口，以一个显式 PNG 绑定规划严格单页 Aseprite stable-marker JSON-array。两个运行时值与十六个擦除类型为既有 SpriteSheet、SequenceClip 工厂生成自有、冻结的输入。精确 profile 为 `aseprite-json-array-1.3.18.6-v1`；exporter 输出兼容性、声明 hash 与许可资格仍未验证。

参阅[契约](docs/atlas-import-plan-contract.md)及[证据与限制](docs/atlas-import-plan-evidence.md)。

已独立接受的保存结果分别为聚焦 planner 47/47、较早正常 SDK 核心 3625/3625 与单独 F2 160/160，以及独立 CPU firstGREEN 5/5；这些重叠范围不相加。独立审查还接受所选新增 Native Canvas/WebGPU 四次读回结果。最终集成门禁/prepush 及 0.60 Git/远端交付仍待完成。工作区包仍为 private、版本 0.0.0，Host 协议仍为 1.0。

## 0.59.0 交付更新

前一 0.59 增量已通过 [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48) 交付，Main 为 `44f49f9d97a7baebc400fd4940541529dc33d147`。较早 0.59 读物和证据保留原编写截止点，新增交付说明不改写它们。未报告远端 status 或 check run，不据此推断 CI 通过。

## 0.59.0 候选 — 标准化图集帧 — 2026-10-17

现有 SpriteSheet 与 SequenceClip 工厂的显式 `'trim-rotation-v1'` profile 支持带透明裁边和顺时针90度打包的单页帧。拥有的 layout 通过 Bitmap 和现有序列播放保留逻辑尺寸与放置，默认矩形路径保持兼容。参阅[契约](docs/atlas-frame-layout-contract.md)、[证据与边界](docs/atlas-frame-layout-evidence.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md)。

已获独立接受的十二阶段 SDK `node tools/verify.mjs` 运行通过 **3559/3559 项核心测试**及单独的 **160/160 项 Spine 实验测试**，两套的 failed/cancelled/skipped/todo 均为 **0**。单独的桌面 Canvas 与纹理 WebGPU 验证通过六个全新上下文和 30 次零容差完整 RGBA 读回，包括指定突变对照及原资源退役后的重放。当前验证器增加了第十三个图集源码边界阶段；截至本次编写，完整重跑、最终公开内容/prepush、0.59 Git 交付与远端 CI 仍待完成。此前失败与修复保留在所链接证据中。exporter 导入、多页、pivot/nine-slice 导入、动画 retarget、controller seek/rate/events、完整 Spine R020/V020、迁移 R008/V006 以及物理设备/性能接受保持 OPEN。

## 0.58.0 — Bitmap 原子绑定与组合换装

工程预览 **0.58.0** 增加 `Engine.captureBitmapBindings(scope, targets)` 及擦除类型 `BitmapBindingTicket`。组合换装示例等待两张服装纹理全部就绪，再同时提交两个图层的绑定。请求等待、失败、取消或被后续请求替代时保留可用服装；票据拒绝覆盖调用方之后设置的绑定。

已记录的桌面 Canvas 与 WebGPU 检查通过六个独立上下文，保留 54 份原始 RGBA 读回，覆盖独立的旧图层对照、真实鼠标选择、动画边界，以及原始读取尚未结束时关闭。该结果只适用于有限桌面范围；通用依赖清单、更多内容类型、完整 UI、Spine、生产宿主、移动性能和物理内存验收仍保持开放。

参阅[规格](docs/prepared-resource-groups-spec.md)、[证据与边界](docs/prepared-resource-groups-evidence.md)及[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md)。

## 0.57.0 — 真实资源场景集成

工程预览 **0.57.0** 通过既有公开 Engine API，组合真实 PNG 资源、共享图集播放、文本与鼠标输入。默认使用 Canvas，纹理 WebGPU 场景作为显式选择的实验路径。资源准备、画面就绪、输入就绪及安全关闭具有各自边界。参阅[集成记录](docs/resource-scene-integration.md)和[示例指南](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md)。

桌面 Canvas/WebGPU 流程已完成七个独立上下文，保留 64 份原始 RGBA 画面；在记录的环境中，固定点与字体区域比较、错误对照和完整关闭均通过。手机、跨环境字体、性能与能耗验收仍保持开放。

## 0.56.0 交付更新 — 2026-10-16

0.56 资源替换增量已通过 [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45) 交付，Main 为 `19c308af4d7c9590f886c8105d5d678e708184c5`；早期核验记录保留各自原有截止点。

## 0.56.0 — 可恢复位图资源替换

`Engine.createBitmapResourceSlot(scope, bitmap)` 通过既有根入口，为一个持久 Bitmap 增加显式异步 Texture 替换，并增加擦除类型 `BitmapResourceSlot` 与 `BitmapResourceSlotState`。槽借用初始绑定，仅拥有新替换租约。请求等待、失败或取消时保留先前可用绑定，只有最新已接受意图可以提交；取消或被新请求取代会拒绝对应请求 Promise。参阅[规格](docs/位图资源槽规格.md)、[证据及剩余验收](docs/位图资源槽核验.md)和[组合示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md)。

聚焦行为、严格消费者及记录的桌面 Canvas/WebGPU 组合已通过各自限定检查；完整本地／公开门禁及仓库交付在所链接证据中分别记录，完整 UI、Spine R020/V020 与旧工程迁移 R008/V006 保持 OPEN。前一个 0.55 增量已通过 [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44) 交付，Main 为 `f6b7968db89febfdbe00fb1322f208ab2135f68f`；较早条目继续保留各自历史证据截止点。

## 0.55.0 — 显式本地线性布局

可选 `@egret/engine/layout` 将显式数字记录转换为冻结的局部矩形计划，调用方负责过滤成员、排列子对象并应用坐标。双 Button 示例连接既有共享输入、借用程序化图集、嵌套裁剪及保存/实时帧。参阅[规格](docs/local-linear-layout-spec.md)及[验证范围](docs/local-linear-layout-evidence.md)。

## 文档维护 — 2026-10-15

公开叙述围绕产品目标、设计推导、契约与交付重新组织，产品文档、导航和双语阅读版本共同维护，来源、许可及原始实验证据保持可追溯。本次文字整理不增加引擎能力。

## 前次集成 — 0.54.0

工程预览 0.54.0 已通过 [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42) 集成，Main 为 efd2a9c91fb6cfe633214b50b82cf7952941452a，tree 为 2b39b8439a5b30ce3572edc162e8a7a916a76185。已记录的完整本地检查通过核心 3218/3218 和 Spine 源码 160/160；桌面 Canvas/WebGPU 检查完成 38 次主读回和 87552 通道比较，容差为 0。这些验证范围分别记录且存在重叠。远端 CI 没有返回检查项，不据此推断 CI 通过。

## 0.54.0

可复用位图按钮连接共享鼠标输入、资源租约及按下／禁用皮肤，在事件路由结束后最终复查命中。 [详细说明](docs/位图按钮契约.md).

## 0.53.0

可运行图集示例连接纹理加载、SpriteSheet 裁剪、Engine 时钟播放、显式锚点及保存／实时画面。 [详细说明](docs/锚点图集播放契约.md).

## 0.52.0

显式锚点偏移在画面收集、坐标转换、bounds 和拾取中共用变换语义。 [详细说明](docs/显示锚点偏移契约.md).

## 0.51.0

按索引插入子对象，保持父子顺序、所有权和重入校验。 [详细说明](docs/容器按索引插入契约.md).

## 0.50.0

查询直接子对象当前索引，不改变显示树。 [详细说明](docs/容器子节点索引契约.md).

## 0.49.0

批量分离全部直接子对象，保持各自资源与生命周期规则。 [详细说明](docs/容器清空子节点契约.md).

## 0.48.0

NineSliceBitmap 基于既有几何、纹理租约和自有画面提供固定边框背景。 [详细说明](docs/九宫格位图契约.md).

## 0.47.0

实验性官方 Spine Core 桥接将原创手动测试内容接入 Mesh2D 画面，完整 Spine 仍按独立需求验收。 [详细说明](docs/SpineCore手动网格桥接.md).

## 0.46.0

可选浏览器 PNG Provider 在既有资源系统上增加受限静态图像解码和显式关闭。 [详细说明](docs/浏览器PNG纹理Provider契约.md).

## 0.45.1

共用路径／字节身份工具、规范文本写入器和必需钩子，处理 Windows 路径写法及换行漂移。 [详细说明](docs/仓库路径身份与换行规范.md).

## 0.45.0

命名 SpriteSheet 帧让静态裁剪与序列播放共用一个图集租约。 [详细说明](docs/命名图集契约.md).

## 0.44.0

Scope 所有的序列播放使用显式 Engine 时钟，支持单次与循环控制。 [详细说明](docs/时钟驱动序列动画契约.md).

## 0.43.0

Spine 线性动画源规格定义版本化输入及源码层检查。 [详细说明](docs/Spine线性动画源规格契约.md).

## 0.42.0

Spine 网格源规划定义自有网格画面准备及校验范围。 [详细说明](docs/Spine网格源规划契约.md).

## 0.41.0

九宫格几何定义边框与拉伸语义，为显示组件提供基础。 [详细说明](docs/九宫格几何NS1契约.md).

## 0.40.0

ByteWriter 提供自有二进制输出、显式字节序和事务式游标行为。 [详细说明](docs/字节写入器BW1契约.md).

## 0.39.0

纹理场景组合通过显式浏览器 Host 连接选定三维 pass 与独立于深度的 UI。 [详细说明](docs/textured-scene-host-contract.md).

## 0.38.0

公共 Matrix4 编写接口开放既有第一方 CPU 矩阵语义。 [详细说明](docs/公共3D场景契约.md).

## 0.37.0

原创 Spine F1 实验增加显式选择的 Engine 时钟集成。

## 0.36.0

原创 F1 Spine 实验连接手动动画测试内容、网格画面与浏览器验证。

## 0.35.0

Scope 所有权针对已记录的公开属性覆盖及释放重入案例得到修正。 [详细说明](docs/Scope私有所有权.md).

## 0.34.0

可选 Spine 导入规划器增加严格元数据与扫描优先的拒绝语义。 [详细说明](docs/Spine导入计划契约.md).

## 0.33.0

主鼠标输入连接显式命中区域、类型化显示事件和 Scope 生命周期。 [详细说明](docs/主鼠标输入契约.md).

## 0.32.0

可选公共场景与网格入口开放选定的自有 CPU 画面和浏览器 Host。 [详细说明](docs/公共3D场景契约.md).

## 0.31.0

资源获取组增加完整输入预检、受限本地等待队列及统一释放。 [详细说明](docs/资源批量获取.md).

## 0.30.0

Canvas 拾取示例展示公共命中查询、类型化路由及派发后的视觉反馈。 [详细说明](docs/显示拾取示例.md).

## 0.29.0

逻辑命中测试定义显式矩形输入及显示树拾取。 [详细说明](docs/显示命中HT1.md).

## 0.28.0

Canvas 文字路径在已验证子集中连接栅格图像、替换、代际与生命周期。 [详细说明](docs/Canvas文字WC1.md).

## 0.27.2

显示树挂接减少特定同级扫描，保持校验与释放顺序。 [详细说明](docs/显示树扩展性.md).

## 0.27.1

ByteReader 提供自有标量读取、显式字节序、独立复制及原子游标。 [详细说明](docs/字节读取器BR1契约.md).

## 0.27.0

可选的非编辑 TextField 连接已准备文字图像、资源租约和显式替换。 [详细说明](docs/文字显示TF1契约.md).

## 0.26.0

标量 Tween 增加 Scope 所有的过渡、选定缓动函数及终态释放。 [详细说明](docs/标量补间契约.md).

## 0.25.0

显式 Engine 时钟将游戏时间推进与渲染、捕获分开。 [详细说明](docs/游戏时间核心契约.md).

## 0.24.0

文字栅格编排增加精确请求、带符号度量、资源槽位及显式预算。 [详细说明](docs/文字栅格T1契约.md).

## 0.23.0

自有纹理几何与 Mesh2D 增加不可变捕获、准备和显式 WebGPU 路径。 [详细说明](docs/自有纹理几何与Mesh2D契约.md).

## 0.22.0

接收者局部内容 bounds 增加不可变测量结果与显式遍历预算。 [详细说明](docs/显示内容边界契约.md).

## 0.21.0

公共局部／全局坐标查询增加不可变点及祖先／生命周期边界。 [详细说明](docs/显示坐标查询契约.md).

## 0.20.0

SequencePlayer 提供显式时间图集采样及公共浏览器示例。 [详细说明](docs/显式时间序列播放器契约.md).

## 0.19.0

Bitmap 区域接纳／捕获与 B1 浏览器验证器建立独立的图像和场景检查。 [详细说明](docs/bitmap-region-contract.md).

## 0.18.0

单个命名旧 MovieClip 的 CPU 转换保留裁剪、偏移和编写的停留时间，完整迁移仍未完成。 [详细说明](docs/legacy-movieclip-contract.md).

## 0.17.0

内部 CPU 场景、网格、序列与 RES 意图扩展初始核心，未完成生产宿主验收。 [详细说明](docs/3d-cpu-scene-contract.md).

## 0.16.0

图像源投影、画面准备、CPU 混合参考及三维／RES 分析形成统一证据记录。 [详细说明](docs/核心框架实现记录.md).

## 0.13.0

浏览器 WebGPU 矩形执行建立固定的渲染与生命周期规格。 [详细说明](docs/WebGPU矩形执行合同.md).

## 0.12.0

显示变换、继承可见性／透明度、裁剪及不可变画面接入独立 Canvas 适配器。 [详细说明](docs/显示与帧执行合同.md).

## 0.11.0

类型化资源增加共享获取、独立租约、取消与代际隔离。 [详细说明](docs/资源核心合同.md).

## 0.10.0

双语阅读、当前文件身份、关键英文注释与推送前检查形成共用贡献规范。 [详细说明](docs/双语文档与推送前检查.md).

## 0.9.0

仓库整合独立核心源码与知识库，建立公开协作和来源署名。 [详细说明](docs/开源协作与公开表达规范.md).

## 0.8.0

首个独立无界面核心实现 contracts、runtime 与 engine 的职责、生命周期及类型化事件。 [详细说明](docs/核心框架实现记录.md).

## 0.7.0

工程结构、现代 API 约定与代码质量规范形成共用实现基础。 [详细说明](docs/工程技术架构与项目结构.md).

## 0.6.2

技术研究补充 shader 资产分发和工程持续编辑流程的设计考虑。 [详细说明](docs/Shaders与Playground产品技术启发.md).

## 0.6.1

独立实现、显式依赖与研究来源分别建立规范。 [详细说明](docs/独立实现与第三方依赖规范.md).

## 0.6.0

图形后端、编译与原生运行时方案作为候选设计进行分析。 [详细说明](docs/图形后端编译与原生Runtime选型.md).

## 0.5.0

固定版本第三方资产实验检查动画实例、文字、资源释放和上下文恢复。

## 0.4.0

参考研究明确源码版本、许可、集成角色与验证职责。 [详细说明](docs/开源实现优先与验证分工.md).

## 0.3.0

事件、资源、UI 和混合图形实验细化身份、代际与恢复约束。

## 0.2.0

首版白皮书、需求与工程规划将设计假设连接到技术实验。

## 0.1.0

初始知识库组织产品范围、架构候选、交付与社区参与。

## 历史验证记录

早期结果、失败、修正及 PENDING 状态，按原日期和源码身份保存在对应证据及[固定版本详细记录](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/CHANGELOG.md)中，表达历史检查点，不代表当前集成状态。本页记录各版本主要变化，详细测试数值随相关实验或子系统维护。

完整 Spine 支持于 2026-10-10 登记为 R020/V020，上述导入、网格及手动 Core 实验尚未完成这项要求。旧工程自动迁移 R008/V006 仍未完成。
