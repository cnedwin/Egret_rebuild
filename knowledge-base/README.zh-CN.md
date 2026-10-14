# 白鹭重构工程知识库

[English](README.md) | 简体中文

<!-- AAP-0.53.0-BEGIN -->
## 工程预览 0.53.0 — 可运行资源／动画链

**S107 / V058 · 2026-10-15。** 锚点图集示例连接真实资源租约、具名帧、共用时钟播放、Bitmap 指定枢轴及显式 Canvas／WebGPU 呈现。阅读[示例](../examples/anchored-atlas-playback/README.zh-CN.md)、[契约](Cns/docs/锚点图集播放契约.md)、[证据](Cns/docs/锚点图集播放证据.md)和[剩余计划](Cns/docs/锚点图集播放工程计划.md)。

独立当前 CPU／代码接受覆盖 16 项专项测试、全部 9 个代码阶段、Core 3147/3147 和保留 Spine 源码 160/160。桌面 Edge 155.0.4283.45 Canvas/WebGPU 验收覆盖 14 次主读取、32256 通道，在容差 0 下零差异；独立全新 Canvas 对照计入 0 个主案例。 最终公开 Source/双语评审、prepush/hooks 与新增交付保持 PENDING。完整 Spine R020/V020、迁移 R008/V006、完整 UI／3D／AI 及设备／性能保持开放或未验证。前次 0.52 已通过 PR #40 交付；早先记录的截止点保持历史范围。
<!-- AAP-0.53.0-END -->

<!-- AO-0.52.0-DRAFT-BEGIN -->
## 工程预览 0.52.0 — 显式显示枢轴

**S106 / V057 · 2026-10-15。** 继承的 `anchorOffsetX` 与 `anchorOffsetY` 使元素在缩放／旋转时以其位置放置指定枢轴。坐标、接收者局部边界、裁剪、命中和捕获遵循同一契约；零偏移保留原始矩阵字节。

独立当前代码接受覆盖 Core 3131/3131 与保留 Spine 源码 160/160。独立接受的桌面不透明 Canvas/WebGPU 执行覆盖 10 次主读回、23040 个通道，容差为 0；独立 Canvas 对照的主用例记账为 0。

阅读[契约](Cns/docs/显示锚点偏移契约.md)、[证据](Cns/docs/显示锚点偏移证据.md)和[剩余计划](Cns/docs/显示锚点偏移工程计划.md)。本截止点的公开源码／双语评审、正常 prepush、强制 hook 及新增 0.52 交付仍为 PENDING。完整 Spine R020/V020、迁移 R008/V006、完整 EUI／布局、高级 3D、AI、字体／设备及性能保持 OPEN 或未验证。

有日期的前次交付为 [PR #39](https://github.com/cnedwin/Egret_rebuild/pull/39)，Main `0afc8020d30bf4f30a982c671a905bf6786293c4`、tree `43cea3da992cdfaa100857060f52ccea4284a834`。原 0.51 公开 PENDING 截止点保留为历史；不声明远端 CI PASS。
<!-- AO-0.52.0-DRAFT-END -->

<!-- ADI-0.51.0-DRAFT-BEGIN -->
## 工程预览 0.51.0 — 按索引插入子节点 · 源码草稿

**S105 / V056 · 2026-10-14。** `DisplayObjectContainer.addChildAt<T extends DisplayObject>(child: T, index: number): T` 一次操作将精确对象放到指定层。整数 [0,n] 包含 -0 和 n 追加；同父 index 表示最终位置，n 是末尾位置别名。按当前来源换父节点保留其他兄弟、子树及清理所有者。Sprite／Stage 继承该成员，Stage 不能成为子节点。

**R3 当前源码草稿 · 已接受的代码验证后继，2026-10-14。** 经独立审阅的完整运行在 14:05:03 UTC 结束：全部 9 项代码阶段完成，Core 3113/3113、Spine 源码检查 160/160，失败、取消、跳过均为零。原始独立严格类型使用方和完整类型阶段保留 ADI 0/10、CGI 0/12、DCA 0/10 完整未抑制诊断向量。已接受的实际结果审阅为 262199 bytes / 5b4516bd58e875d25559b8426f4ed8ee6e9d7268afd3f40c55680f070d1863df。该接受仅覆盖当前本地代码验证；完整 Spine 产品 R020/V020 保持 OPEN。

经认证的当前清单包含 25 个不同的已采用源码文件，其中包括经审阅的 Native 支持和保留的读取器。当前产品身份绑定 3 个源码文件和 6 项 JS/DTS；修复后的 2 个源码文件和 2 项 JS 产物替换旧身份，全部 3 项声明继续保留此前已接受的字节。**R3 Native 后继 · 2026-10-14。** 经独立接受的桌面不透明 Canvas／WebGPU 运行在 14:35:58 UTC 结束。主运行完成 10 次提交、10 份完整原始 RGBA 读回，比较 5760 个像素和 23040 个通道，容差 0，均无差异。实际有 8 次新捕获、2 次保存帧重放。N5 在同一存活 Engine 上使用精确保存的 N1 帧，而当前 N4 树仍保持变更。另行的新鲜 Canvas C1 对照增加 2 次提交和 2 份读回，主运行计入 0；其故意错误索引产生预期的 64 个差异像素和 128 个差异通道。已接受的 Native 审阅为 59975 bytes / 334c304b4ad1f2b66e6beddb8f40f89b8b08b11d7b9cd0d5e41b95c5a057c370。保存的证据为原始 RGBA 文件，没有保存 PNG 文件。Scope／Engine／host／context／browser／server 均完成安全退役，没有主错误、清理错误或待处理 ticket。采集器记录了 175 项已接受 runtime pin 的稳定状态；审阅者另行认证了当前 175 项 pin。该后续观察不虚构逐文件回溯 before／after 数组。公开源码／双语审阅、普通完整 prepush、强制 hook、新 0.51 Git 交付仍为 PENDING。物理 GPU 身份、字体、手机、性能及完整 Spine 仍未验证或 OPEN，不宣称远端 CI PASS。阅读[契约](Cns/docs/容器按索引插入契约.md)、[证据](Cns/docs/容器按索引插入证据.md)及[剩余计划](Cns/docs/容器按索引插入工程计划.md)。

2026-10-14 上一交付有日期后继：[PR #38](https://github.com/cnedwin/Egret_rebuild/pull/38) 将有限 0.50.0 交付到 Main `13200c72dd51d35d12e84c6d1c81dfeaef94af53`、tree `c6f1a791f649c96606fb5e2a1b2a096c2a3f027b`。原 0.50 公开 PENDING 截止点保留为历史；后续 Root DATA 指针投影不增加独立审阅或远端 CI PASS。

完整 Spine R020/V020、迁移 R008/V006、完整 EUI／布局、高级 3D、AI、手机／平台／性能仍为 OPEN 或未验证。第一方源码遵循白鹭规格和熟悉 API，包含关键英文注释并注明 AI 协助；package 保持私有 0.0.0，协议 1.0，依赖／notice 不变。
<!-- ADI-0.51.0-DRAFT-END -->

<!-- CGI-0.50.0-BEGIN -->
## 工程预览 0.50.0 — 查询直接子节点当前索引

**S104 / V055.** DisplayObjectContainer.getChildIndex(child: DisplayObject): number 只读查询精确当前直接子节点，以 O(n) 扫描私有真实顺序，不建立列表快照／缓存，不修改树、转移 owner、操作资源或调用显示回调。Sprite／Stage 继承，根值／类型、子入口、依赖及协议不变。

独立接受两文件产品／四项 JS-DTS、构建 exit 0、专项 CPU 128/128（新增六项、保留 122 项），及两组重叠原始严格类型 0/12 诊断、十二个完整未抑制元组。具名缺成员 RED 前真实旧操作／清理已完成；此前旧 build 的 122 通过／6 失败保留为历史，不是产品缺陷。原生源码已接受；之后全部九个当前代码阶段实际成功完成（Core 3091/3091、保留 Spine 源码检查 160/160），包含当前 CGI 0/12 与保留 DCA 0/10 严格类型，独立保存结果评审已接受该范围；Native Canvas／WebGPU 另行接受两个后端例、六份完整 24×24 读回／四次捕获／两次同存活 Engine 重放，13824 通道零容差。公开源码／双语审阅及 prepush／hook／交付仍待完成。

阅读[契约](Cns/docs/容器子节点索引契约.md), [evidence](Cns/docs/容器子节点索引证据.md) / [implementation plan](Cns/docs/容器子节点索引工程计划.md).

2026-10-14 有日期后继：[PR #37](https://github.com/cnedwin/Egret_rebuild/pull/37) 将有限 0.49.0 批量分离交付至 Main `01e8e8063c2f2234b66486beba8bc9529f1f77b0`，tree `3585d370cc637edde2a94856909daa6bc74960d4`，功能提交 `c95bde158a0ec941ff9e494da5b1567465ff2d8b`；原 0.49 整理 PENDING 截止点／失败保留为历史，远端状态／check run 为零、汇总 pending 不等于 CI PASS。

完整 Spine R020/V020、迁移 R008/V006、EUI／布局、高级 3D、AI 接口及手机／平台／性能接受保持 OPEN 或未验证；package 私有 0.0.0、宿主协议 1.0。
<!-- CGI-0.50.0-END -->

<!-- DCA-0.49.0-BEGIN -->
## 工程预览 0.49.0 — 分离全部直接显示子节点

**S103 / V054.** `DisplayObjectContainer.removeChildren(): void` 清空显示层，同时保留节点、后代、资源及清理所有者。它认证真实接收者，空容器也先检查 Engine 再检查接收者生命周期，在全部直接边校验后无调用者 hook 提交；Sprite 和 Stage 继承方法，根值／类型、规格、依赖和协议不变。

独立接受 122 项专项 CPU（API 一项、行为五项、保留 116 项），及两组原始并行严格类型：正例零诊断，负例十个实际未抑制完整元组。具名缺成员 RED 前已完成真实旧行为及清理。新严格 driver 及全部九个当前默认代码／策略门禁已独立接受：Core 3085/3085、保留 F2 源码检查 160/160。Native R1 在提交前于夹具中失败，独立评审另行接受 R2 Canvas／WebGPU：六份完整 24×24 读回、四次捕获／两次同存活 Engine 重放，13824 通道零容差；公开发布仍待完成；源码清理修复不等于执行过清理故障。

阅读[契约](Cns/docs/容器清空子节点契约.md), [evidence](Cns/docs/容器清空子节点证据.md) / [native schedule](Cns/docs/容器清空子节点原生核验指南.md).

2026-10-14 有日期后继：[PR #36](https://github.com/cnedwin/Egret_rebuild/pull/36) 将有限 0.48.0 NineSliceBitmap 交付至 Main `cca65d0322807e53bfa3f7cc7fbcf8d903dcbc59`，tree `bc5c205ee988aa6aa4245391068a6ee73120594e`，功能提交 `f1f4bcbe5b12171f5077e66775d8bd1a9b771b44`。原 0.48 整理 PENDING 截止点保留为历史；远端状态／check run 为 0/0、汇总 pending，不等于 CI PASS。

完整 Spine R020/V020、迁移 R008/V006、完整 UI／布局、高级 3D 及目标设备／性能接受保持 OPEN 或未验证；package 私有 0.0.0、宿主协议 1.0。
<!-- DCA-0.49.0-END -->

<!-- NLB-0.48.0-BEGIN -->
## 工程预览 0.48.0 — NineSliceBitmap 固定边框背景

**S102 / V053。** `NineSliceBitmap` 从真实 Texture 裁剪取得源尺寸，借用调用者租约，以一次 `resize` 调整固定边框背景并保留旧帧。Runtime／Engine 根入口新增一个类值和一个擦除 options 类型，复用独立 NS1 几何及既有纹理渲染；不增加第三方依赖。

独立接受的专项 CPU 为 71/71（十四项 NLB、一项独立 TXI、五十六项保留回归）；严格类型为三组 0/17/8 诊断，共二十五个实际未抑制完整元组。记录型示例为两个尺寸／两个帧、一次加载／释放、零 timer，不是原生像素验证。原四项源码拒绝及两项真实 RED 继续保留；Engine 关闭反例保持 source-only。

2026-10-14 的独立评审已经接受全部九个代码验证阶段，普通测试 3079/3079、保留 F2 源码测试 160/160。真实 WebGPU 的一个主例完成三份 24×24 读回、两次捕获及一次资源退役后重放，6912 个通道零容差通过；两项 Canvas 拒绝、正向 Canvas 提交为零，adapter 身份未观察。整理后公开材料门禁、双语审阅及 0.48 推送／PR/Main 仍待完成。完整 EUI／布局、Spine R020/V020 与迁移 R008/V006 保持 OPEN；package 私有 0.0.0，宿主协议 1.0。

阅读[契约](Cns/docs/九宫格位图契约.md)、[证据](Cns/docs/九宫格位图证据.md)和[原生核验指南](Cns/docs/九宫格位图原生核验指南.md)。

2026-10-14 的交付后继：[PR #35](https://github.com/cnedwin/Egret_rebuild/pull/35) 已将有限 0.47.0 Spine 手动桥接合入 Main `5ae877705d76a470ec942a29cfe0212f069da6fb`，tree `60d224ec1ed6bc0824cd2f93871595809d3c21d5`，功能提交 `29e6f97d1d594efe3a49f9c530b1728a4756fe2c`。这与新 NineSlice 基线准入分别记录；旧 PENDING 截止点保留。远端状态／check run 为 0/0、汇总 pending，不构成 CI PASS。
<!-- NLB-0.48.0-END -->

<!-- F2C-0.47.0-BEGIN -->
## 工程预览 0.47.0 — Spine Core 手动网格桥接

**R004 / R012 / R015 / R016 / R019 / R020 / R021 · S101 / V052。** 可选 F2-C 实验将真实白鹭资源、显示树与外部官方 Core 4.3.13 连接，支持限定非加权 mesh 的手动绝对时间 translate／deform 采样、两个驻留实例与自有不可变几何。默认 SDK 不增加 Core 依赖或导出。已独立接受十项主 CPU、四项独立资源事务、十四组类型（二十五个实际未抑制诊断元组）和一项 G1 回调观察器；后者具有单独的前后普通基线。实现后普通默认套件通过 3064/3064。各次执行范围分别计数，数值界仅适用于原始五点夹具。

受控复制源码执行已独立接受：十次独立完整原始基线、两个可区分变异与三个故障单元，五次恢复均通过。它们不增加主用例、类型组或诊断元组的唯一计数。

固定策略／冷导入／help 观察另行接受：八个默认根入口、145 个可达键、1416 条字面关系及七个新子进程。同步文件访问、DOM 与调度的负向观察限定于所选操作；不能推导普遍不存在。

独立原生 R2 评审接受一项 F2C11 默认 Edge WebGPU 用例：七次提交／七份 64 × 48 读回、DPR 1，五个字面像素／二十个通道及两个完整重复／后退帧／24576 个通道以零容差一致。Canvas 另行拒绝且提交为零；清理通过。不透明夹具不验收其他 alpha 模式，未记录 adapter 身份；这些不是设备性能证据。

本整理截止点为 2026-10-14：当前完整公开／推送门禁及 0.47.0 PR/Main 仍待完成。完整 Spine R020/V020 与迁移 R008/V006 保持 OPEN；Clock／混合、加权网格、手机／平台性能及许可资格不在本次接受范围。外部 SDK 不打包，许可资格 unknown、分发资格 unverified；package 保持私有 0.0.0，宿主协议 1.0。

阅读[契约与指南](Cns/docs/SpineCore手动网格桥接.md)和[验证与待完成工作](Cns/docs/SpineCore手动网格桥接证据.md)。

前一版本 0.46.0 已经 [PR #34](https://github.com/cnedwin/Egret_rebuild/pull/34) 于 2026-10-13T18:18:51Z 合并，Main `562543ea10d9a6b8124561a7027811f3f7dede4c`、tree `ff54205b5e4ba83bfbb75867226e1cbca0e27a32`。分别执行的本机／必要推送钩子套件通过 137/137 公开材料、3064/3064 核心及 160/160 实验测试；1486 个提交原始 blob 检查的问题为零。远端状态／check run 为 0/0、汇总 pending，不宣称远端 CI PASS。保留此前 PENDING 截止点。
<!-- F2C-0.47.0-END -->

<!-- BIP1-0.46.0-BEGIN -->
## 工程预览 0.46.0 — 可选浏览器 PNG 纹理

**R004 / R012 / R015 / R016 / R019 / R021 · S100 / V051.** 可选浏览器 PNG 适配器的源码、4/4 终态回归、95/95 公开 CPU／冷导入用例、五组严格类型诊断（0/32/54/0/6）、公开类型门禁、17/17 新策略用例及 272/272 保留边界用例、39/39 观察器 UNIT 用例均已独立接受。各计数属于不同范围，不合并。原生采集器 R2 源码、采用／语法及输入准备已接受。独立保存结果评审已按 PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY 接受限定默认浏览器 Canvas／WebGPU PNG 子集，包含 6 次提交／192 个像素／768 个通道，容差 0。当前完整仓库／推送门禁、本增量推送／PR／Main 与远端 CI 验收仍为 PENDING。

支持范围限定为 8 位 RGB／RGBA、非隔行的静态 PNG，输出是经浏览器规范化的 straight sRGB RGBA8。这不保证所有 PNG 的无损解码：Canvas 可能丢失隐藏 RGB 与半透明精度。适配器沿用 engine.assets 租约、Texture、SpriteSheet、Bitmap 与时钟的既有所有权。应用关闭时先退役 Engine／资源管理器需求，再单独等待 provider.close()。默认核心入口仍不依赖 DOM；唯一可选工厂与四个擦除接口不增加运行时依赖。上限仍为四个占用任务、每份输入 8 MiB 与占用编码字节合计 32 MiB。完整 Spine R020/V020 与旧工程迁移 R008/V006 仍为 OPEN。

阅读 [契约](Cns/docs/浏览器PNG纹理Provider契约.md) · [实施计划](Cns/docs/浏览器PNG实施计划.md) · [原生验证安排与 CLI](Cns/docs/浏览器PNG原生验证计划.md) · [证据与保留修复记录](Cns/docs/浏览器PNG验证证据.md).

此前已完成交付：[PR #33](https://github.com/cnedwin/Egret_rebuild/pull/33) 将 0.45.1 合并到 Main `8fb5384a8517f20318ead797ce031c6a321a7b9e`，树 `56e49e879d93fae351c948375e0ec12f21c739ab`。强制推送门禁分别通过 137/137 公开材料、2,909/2,909 核心及 160/160 实验测试，知识库问题为 0。此后继记录保留旧 PENDING 截止点，不宣称远端 CI 验收。
<!-- BIP1-0.46.0-END -->

阅读[中文知识库](Cns/README.md)、[技术白皮书](Cns/docs/技术白皮书.md)、[产品需求说明书](Cns/docs/产品需求说明书.md)、[工程规划](Cns/docs/工程规划.md)和[贡献指南](Cns/CONTRIBUTING.md)。
<!-- HYGIENE-0.45.1-BEGIN -->
## 工程预览 0.45.1 — 仓库路径与字节规范

**R016 / R019 / R021 · S099 / V050。** 仓库工具现在分别处理完整、保留大小写的逻辑路径和按平台语义比较的物理路径，文件指纹始终绑定原始字节。限定独立评审接受 111/111 项回归、构建及分别执行的 SpriteSheet／Sequence 严格诊断；修复前真实大小写别名 RED（0 项通过／2 项指定失败）继续保留。

另行真实 Node／PowerShell 写入执行通过 3/3 并已独立接受；保存的隔离 Git 对照通过 12/12，独立相关集合通过 123/123，其中包括 9 项知识库用例。各次重叠运行不累加，Gate 保存结果独立评审已按 **PASS_ACTUAL_REPOSITORY_HYGIENE_DATA** 接受有限数据。完整本机公开门禁、提交快照资格、必要推送钩子及本次 PR/Main 交付在**此整理截止点继续 PENDING**。package 仍为私有 `0.0.0`，宿主协议为 `1.0`；完整 Spine **R020/V020** 和旧工程迁移 **R008/V006** 保持 **OPEN**。

前一版本实际交付：[PR #32](https://github.com/cnedwin/Egret_rebuild/pull/32) 将 0.45.0 合入 Main `863b29c90b92b62e37ce77cf32e02c4294135a16`，树 `1c7b706163ab58e41916bdaa8a6d45f74743a4f9`。其必要钩子分别通过 63 项 publication、2,909 项 core 和 160 项实验测试，知识库问题为 0；不宣称远端 CI PASS。较早 PENDING 章节保留原截止点。

[规范](Cns/docs/仓库路径身份与换行规范.md) / [证据](Cns/docs/仓库路径与换行验证记录.md)。
<!-- HYGIENE-0.45.1-END -->

<!-- SS1-0.45.0-BEGIN -->
## 工程预览 0.45.0 — 命名图集

**S098 / V049。** 命名 `createSpriteSheet` 在不可变命名裁剪、静态图标和既有 Engine 时钟序列控制器之间复用一个整图租约。Runtime／Engine 根入口新增一个工厂和两个擦除类型 `SpriteSheet` / `SpriteSheetFrameInput`；package 仍为私有 `0.0.0`，宿主协议为 `1.0`。不新增依赖、公开子路径或动画时钟。

已保存的公开 CPU 100/100 通过，保留 CPU 133/133 分别计数；SS01–SS10 是规格类别。SpriteSheet 正例类型诊断为 0，普通／导入负例分别 22/14，共 36 个精确元组及 6 行续行。原始操作单元 10/10 通过；策略 5/5 含 4 项指定对照，保留通用策略另有 272/272 通过。记录型示例有 8 行、6 次显式 tick、1 次加载和 1 次释放。已独立接受的 Canvas／WebGPU 观察完成 18 次提交（16 个新捕获 + 2 次已保存帧重放）、576 个像素及 2304 个通道的 0 容差比较，并核对有限清理。最终发布门禁、必要推送 hook 与 0.45 PR/Main 保持 PENDING。

已记录的 0.44 交付：PR #31 已合并；Main `1dce76a62cd0a4180969949939041f889eb1d923`、tree `b10ccbc11e9a2db5bacbf913858c8f4dd73f9d26`。其 hook 分别通过 63 项 publication、2794 项 core 和 160 项实验测试，KB 问题为 0。远端 status/check-run 数 0/0 不能证明远端 CI PASS；旧 PENDING 截止点保留为历史。

这是 Apache-2.0 下的第一方有限命名裁剪组合增量。完整 Spine R020/V020 和旧工程迁移 R008/V006 保持 OPEN；完整 UI/EUI、打包图集导入、手机／Native SDK 和比较性能仍属于后续工作。

[契约](en/docs/spritesheet-contract.md) / [证据](en/docs/spritesheet-evidence.md). Native tool: `tools/spritesheet/README.md`.
<!-- SS1-0.45.0-END -->

<!-- NS1-DOC-0.41.0-BEGIN -->
## 工程预览 0.41.0 — 九宫格拉伸几何 NS1

**S094 / V045。有限 CPU、类型、策略和浏览器结果已接受；完整发布门禁与交付仍为 PENDING。** 固定边框的拉伸网格复用现有 Mesh2D 纹理租约，调整尺寸时仅替换几何。运行时／引擎根入口提供一个工厂与两个只读类型，保留原有自有几何身份。

实际 CPU 27/27 项通过，其中 11 个 NS 组、6 个 Mesh 组及包含嵌套用例的 10 项几何检查。正例类型诊断为 0；两组刻意负例实际为 41/35 条，共 76 条精确位置记录。严格类型门禁与策略检查退出码为 0；指定策略对照 13/13 通过。实际浏览器完成 2 帧和 96 次颜色通道比较，并验证资源清理；具体环境与范围见证据。

原始 NSP09 的 13/12/1 失败与有限测试输入修正分别保留。

0.40.0 ByteWriter 已通过 [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27) 合并；已回读 Main `8e1509878252cc2a9295fcc56d7597877d023c85` 与 tree `ca1f2f176713e388e09016ae22d610c5c1b95201`。必要推送门禁退出码为 0，公开校验 63 项、核心校验 2724 项。远端状态／检查运行数均为零，不能据此声明远端 CI PASS。较早的 PENDING 截止点和失败记录继续保留。

[契约](Cns/docs/九宫格几何NS1契约.md) / [证据](Cns/docs/九宫格几何NS1证据.md)。

这是复杂 2D UI 的有限几何增量，不构成完整 UI/EUI、布局、完整 Spine、迁移、手机能耗／性能或原生 SDK／PC 验收。
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## 工程预览 0.40.0 — 自有 ByteWriter

**S093 / V044。有限 CPU、类型和指定边界结果已接受；完整发布门禁与交付仍为 PENDING。** ByteWriter 提供固定容量的严格二进制追加、原生 IEEE 浮点转换和已提交前缀的独立快照，复用原有 ByteOrder 与 Scope 生命周期。

实际构建与 37/37 项公开／回归用例通过，其中包括 8 组 BW、23 项 ByteReader 和 6 项 Scope；另有 2/2 个独立进程故障测试文件通过。BW 的 24 条内部观察包含 22 次受控故障触达，不是额外的测试用例。正向类型诊断为 0，两类刻意负向诊断分别为 41/16，共 57 条精确位置／代码记录。严格类型门禁和边界检查退出码均为 0，指定边界对照为 17/17。

保留完整边界套件状态：PENDING_AT_SOURCE_CURATION。它与指定的有限对照及尚待完成的最终完整 prepush 分别记录。

已记录的 0.39.0 交付后继：纹理场景合成已通过 [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26) 合并，Main `ac490f90b7467164e461112a9f572a3269107c02` 与 tree `c137666681de663360a9bc153d85e6e71f48bd42` 已在本地和远端回读一致。必要推送门禁退出码为 0。远端状态与检查运行数均为零，不声明远端 CI PASS。较早的待完成截止点与首轮失败 prepush 继续作为历史记录保留。

阅读[契约](Cns/docs/字节写入器BW1契约.md)与[证据](Cns/docs/字节写入器BW1证据.md)。这是一项原创实现的第一方工具类工程增量，不构成文件格式、旧 ByteArray 兼容、完整 Spine、迁移、原生 SDK 或设备／性能验收。历史失败、准备截止点与未完成项保持原样。
<!-- BW1-DOC-0.40.0-END -->

<!-- CHOST-DOC-0.39.0-BEGIN -->
## 0.39.0 拟议 — 纹理场景合成

**CPU 有限范围已接受；原生验收、完整门禁和发布待完成。S092 / V043。** 显式 `createTexturedSceneWebGPUHost` 通过同一所有者、两遍渲染和一次提交，绘制不透明 RGB 场景及真实 Engine 捕获的纹理覆盖层。必须设置 `clearAlpha: 1` 并调用 `renderSceneTexturedFrame`；既有工厂与捕获帧生命周期保持原契约。

已记录的实际结果覆盖构建、组合测试 **12/12**、保留场景／纹理测试 **48/48**、正向类型 **0** 项诊断、完整负向清单 **8/16/15**、边界检查和四项指定边界对照 **4/4**。本次文档整理为 **SOURCE_ONLY / NOT_RUN**，未新增产品执行。

**180 秒**完整边界测试尝试为 **INCOMPLETE**。强制完整推送前检查和发布仍为 **PENDING**。新浏览器／GPU 执行在**本准备截止点为 NOT_RUN**；不声明实体手机、性能或原生 SDK 验收。FullSpine **R020/V020** 与迁移 **R008/V006** 继续保持 **OPEN**。

**已记录的 0.38.0 交付后继：** 公共 Matrix 创作已经由 [PR #25](https://github.com/cnedwin/Egret_rebuild/pull/25) 合并，Main `893f1ca86af10a092066dcccdaaa16ac194efded` 与树 `5960109ca14c9a53ba1cd7ba80d967e6451ad102` 已完成本地和远端读回。这是较早待交付标签的后继，保留其历史截止点；不构成 0.39 交付或远端 CI PASS。

详见[纹理场景契约](Cns/docs/textured-scene-host-contract.md)及[计划中的公共核验记录](evidence/textured-scene-host-verification.json)；该记录待最终证据整理。
**实际浏览器后继：**默认无头 Edge **155.0.4283.45** 完成 **2** 幅真实捕获帧。全部 **24** 个固定像素（每幅 **12** 个）与精确 RGBA 预期一致；每份 **16384** 字节的归一化缓冲保存在共享记录中。将首幅覆盖预期用于第二幅缓冲，在 **(34, 32)** 拒绝了变化后的 UI 顺序，未增加渲染帧。Host 安全关闭、资源／Scope／租约／Engine 清理、应用销毁设备以及浏览器协作式关闭均通过。此处仅验收有限合成能力；操作系统进程退出、实体硬件、手机、性能、完整 3D 和完整 Spine 仍需独立验收。完整 prepush 与 GitHub 交付在本后继截止点仍为 PENDING。
<!-- CHOST-DOC-0.39.0-END -->

<!-- MATRIX4-DOC-0.38.0-BEGIN -->
## 0.38.0 拟议 — 公共 Matrix4 创作

**SOURCE_ONLY / NOT_RUN。S091 / V042** 拟在 `@egret/engine/scene3d` 提供类型化矩阵创作：`createMatrix4`、`multiplyMatrix4` 及原有 `Math3DError` / `Math3DErrorCode` 绑定。编辑器与 JSON 源数组可转换为自有元组，在既有场景捕获前组合变换。方案通过轻量公共转发器复用白鹭独立创作的矩阵算法。

实现、实际 RED/GREEN、公共行为／类型、当前完整门禁及交付均为 **PENDING**。Clock **0.37.0** 交付在**本准备截止点仍为 PENDING**；保留较早记录的结果与截止点。更广的场景／渲染、性能、完整 Spine 及迁移验收继续单独处理。

**已记录的交付后继：** Clock **0.37.0** 已经由 [PR #24](https://github.com/cnedwin/Egret_rebuild/pull/24) 合并，Main `8f84d5f99281ad051abd2e061b5aff90d6d0f40b` 已完成本地与远端读回。这是较早交付检查点的后继，保留原检查点，不构成 Matrix 验收或远端 CI PASS。

拟议 API 与创作示例见[公共场景契约](Cns/docs/公共3D场景契约.md)。
**实际 0.38.0 后继：**旧公开 SDK 通过 **17** 项原有用例，**4** 项新增用例在具名缺失 API 断言处失败；正向类型消费者报出 **4** 个缺失导出。新构建 SDK 通过 **168/168** 项原数学、投影、场景及公开用例，其中公开用例为 **21/21**。正向消费者编译通过；**11** 项有意导入负例对应真实诊断，精确边界与严格类型门禁通过，非预期失败为 **0**。原数学算法保持不变。此处不新增 GPU、设备或性能验收结论。独立源码／双语评审、完整仓库门禁与交付在本后继截止点仍为 PENDING。见[共享核验记录](evidence/public-matrix-authoring-verification.json)。
<!-- MATRIX4-DOC-0.38.0-END -->

<!-- F1C-DOC-0.37.0-BEGIN -->
## Engineering preview 0.37.0 — opt-in F1 Clock candidate

**S090 / V041** records the original F1 Clock experiment; **D017 remains proposed** and concerns only its trusted session and explicit opt-in provenance. Saved private CPU execution passed **10/10** Clock cases, including the named after-advance fault, and **3** assigned wrong-copy controls with fresh baselines. The original manual **12/12** remains unchanged. Saved private desktop WebGPU execution passed **10** positive readbacks and **1** separate double-update control: **30** original positive samples, **120** channels, tolerance **0**, with full-byte repeats and bounded cleanup. Counts are not added to historical runs.

**Portable public Clock source/replay, current full gates, final bilingual review, mandatory push and 0.37.0 delivery are PENDING at this curation cutoff.** Private results do not substitute for them. The former 0.36.0 blocks below retain their historical pending cutoff; 0.36.0 was subsequently delivered through [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23), Main `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`.

Official external `@esotericsoftware/spine-core@4.3.13` is attributed, neither bundled nor relicensed. Integration/distribution qualification remains unverified. Complete Spine **R020/V020 remains OPEN**; these observations establish no phone/Native SDK, physical GPU, OS process retirement, performance/energy or complete-product acceptance.

Read [Clock guide](en/experiments/spine-f1/README.md), [saved verification](evidence/spine-f1-clock-verification.json) and [pending public projection](evidence/spine-f1-clock-public-projection.json).

### 中文 / Chinese

## 工程预览 0.37.0 — 可选 F1 Clock 候选

**S090 / V041** 登记原创 F1 Clock 实验；**D017 仍为 proposed**，仅涉及实验的受信会话及显式可选出处。已保存私有 CPU 执行通过 **10/10** Clock 用例，包含具名推进后故障；**3** 项指定错误副本对照各有新基线。原手动 **12/12** 保持不变。已保存私有桌面 WebGPU 执行通过 **10** 次正例回读及 **1** 次独立重复推进对照：**30** 个原始正例采样点、**120** 个通道、容差 **0**，并观察完整字节重复与限定清理。各阶段数量不与历史运行相加。

**公开 Clock 可移植源码／重放、当前完整门禁、最终双语评审、必要推送及 0.37.0 交付，在本次策展截止时均为 PENDING。** 私有结果不能替代这些步骤。下方 0.36.0 段落保留历史 pending 截止状态；0.36.0 后续已通过 [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23) 交付，Main 为 `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`。

官方外置 `@esotericsoftware/spine-core@4.3.13` 明确署名，不打包、不改许可。集成／分发资格仍未核实。完整 Spine **R020/V020 继续 OPEN**；上述观察不构成手机／Native SDK、物理 GPU、操作系统进程退役、性能／能耗或完整产品验收。

阅读 [Clock 指南](Cns/experiments/spine-f1/README.md)、[已保存核验](evidence/spine-f1-clock-verification.json)和[待完成公开投影](evidence/spine-f1-clock-public-projection.json)。
随后在独立克隆中实际重放公开源码：手动 **12/12** 及 **6** 项原对照、完整 Clock **10/10** 及 **3** 项指定对照通过；具名故障实际执行，获接受用例跳过数为 **0**。独立默认无界面 WebGPU 执行通过 **10+1** 次回读、**30** 个正例采样点和 **120** 个通道，容差 **0**，保持原完整字节关系与限定清理。冷导入／帮助观察 **280** 个模块，Core／GPU／宿主访问均为 **0**。已保存 CPU 集合保留较早的 native-pending 截止状态；独立 native 回执才是实际后继。原创源码与输入身份未变。此处独立保存结果评审、最终仓库门禁和交付仍为 PENDING；完整 Spine **R020/V020 继续 OPEN**。当前后继见所链接的 Clock 核验／投影记录。
<!-- F1C-DOC-0.37.0-END -->

<!-- SP1B-DOC-0.36.0-BEGIN -->
## Engineering preview 0.36.0 — original F1 Spine experiment

An opt-in original two-region manual bridge connects real resources and owned Mesh2D geometry. Portable CPU execution passed **12/12** original tests and **6** assigned controls, each with a fresh baseline. Complete Spine **R020/V020 remains OPEN**.

Separate browser WebGPU validation recorded **8** positive submissions and **1** assigned double-update error control; a separate **3**-read classification actor verified `PIXEL_FAIL`. These results are not combined. The prepared public CPU/browser reproduction tool also passed in a new clone with the same **8+1** profile; these are repeated observations, not additional feature coverage. Its finite independent review has **0** open findings. The public checkout also passed the same CPU/browser profile. **Final publication gates and 0.36.0 delivery remain PENDING at this cutoff.** Read [the experiment guide](en/experiments/spine-f1/README.md), [verification](evidence/spine-f1-manual-verification.json) and [projection provenance](evidence/spine-f1-public-projection.json) for exact profiles, original oracles, source terms and remaining UI/runtime/creator/migration work.

The preceding **0.35.0** was actually delivered through [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22). Its recorded gates and Main identities are in the guide/evidence; **0** remote statuses and **0** check runs establish no remote CI PASS. Earlier PENDING cutoffs below remain history.
<!-- SP1B-DOC-0.36.0-END -->

### 中文 / Chinese

<!-- SP1B-DOC-0.36.0-BEGIN -->
## 工程预览 0.36.0 — 原创 F1 Spine 实验

可选的原创两区域手动动画桥接接入真实资源与自有 Mesh2D 几何。可移植 CPU 执行通过 **12/12** 项原始测试及 **6** 项指定错误对照，各项均先通过全新基线。完整 Spine **R020/V020 继续 OPEN**。

另行浏览器 WebGPU 桌面验证记录 **8** 次正例提交及 **1** 项重复推进指定错误对照；独立的 **3** 次读回分类 actor 验证 `PIXEL_FAIL`，各组结果不合计。已准备的公开 CPU／浏览器复现工具也在一个新 clone 通过相同 **8+1** profile；这是重复观察，不增加特性覆盖。其有限独立评审有 **0** 项开放问题。公开 checkout 也通过相同 CPU／浏览器 profile。**本截止点，最终公开门禁及 0.36.0 交付继续 PENDING。** 精确 profile、原创 oracle、来源条款及后续 UI／runtime／创作／迁移工作见[实验指南](Cns/experiments/spine-f1/README.md)、[验证](evidence/spine-f1-manual-verification.json)与[投影出处](evidence/spine-f1-public-projection.json)。

前一版本 **0.35.0** 已经 [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22) 实际交付；其记录的门禁及 Main 身份见指南／证据。远端 **0** 项状态和 **0** 项检查任务不证明 CI 通过。以下早先 PENDING 截止点继续保留为历史。
<!-- SP1B-DOC-0.36.0-END -->


这是持续迭代的开源工程。文档区分设计提案、已实现切片、已有验证与待验证事项。中文阅读文档位于 `Cns/`，英文阅读文档位于 `en/`，代码、原始证据与上游许可共享原有出处。项目默认入口优先提供英文简介，再附中文简介，欢迎全球开发者参与。
