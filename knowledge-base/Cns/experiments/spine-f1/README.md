# 原创 F1 Spine 实验

[English](../../../en/experiments/spine-f1/README.md) | 简体中文

<!-- F1C-DOC-0.37.0-BEGIN -->
## 工程预览 0.37.0 — 可选 F1 Clock 候选

**S090 / V041** 登记原创 F1 Clock 实验；**D017 仍为 proposed**，仅涉及实验的受信会话及显式可选出处。已保存私有 CPU 执行通过 **10/10** Clock 用例，包含具名推进后故障；**3** 项指定错误副本对照各有新基线。原手动 **12/12** 保持不变。已保存私有桌面 WebGPU 执行通过 **10** 次正例回读及 **1** 次独立重复推进对照：**30** 个原始正例采样点、**120** 个通道、容差 **0**，并观察完整字节重复与限定清理。各阶段数量不与历史运行相加。

**公开 Clock 可移植源码／重放、当前完整门禁、最终双语评审、必要推送及 0.37.0 交付，在本次策展截止时均为 PENDING。** 私有结果不能替代这些步骤。下方 0.36.0 段落保留历史 pending 截止状态；0.36.0 后续已通过 [PR #23](https://github.com/cnedwin/Egret_rebuild/pull/23) 交付，Main 为 `36909c3c1b2b9ef9784cb71d949ef6eba142fc0a`。

官方外置 `@esotericsoftware/spine-core@4.3.13` 明确署名，不打包、不改许可。集成／分发资格仍未核实。完整 Spine **R020/V020 继续 OPEN**；上述观察不构成手机／Native SDK、物理 GPU、操作系统进程退役、性能／能耗或完整产品验收。

### 受信会话与时间所有权

实验拟在可选原创桥中提供 `createF1ClockSession(options: EngineOptions): Promise<F1ClockSession>`，不加入默认 Engine 导出。它为既有纹理 profile 创建真实 Engine，在暴露 Engine 或调用资源 provider 前捕获原始 `engine.clock.onTick`，返回带 `engine` 与 `createResources(resourceScope, refs)` 的冻结会话；不接受调用方替换的 Clock。真实配置的 `maxDeltaSeconds` 仅在不超过 **0.25** 时符合此实验。合法但更大的配置会先启动真实 Engine，再以 `F1_CLOCK_PROFILE_UNSUPPORTED` 拒绝并等待销毁；清理拒绝以 `F1_CLOCK_SESSION_CLEANUP_FAILED` 保留原 profile cause 和清理错误，不返回可用会话。非法 Engine 配置仍保留 SDK 原先错误。成功返回后由调用方负责 `session.engine.dispose()`。

通过会话创建的实例使用 `bindClock(subscriptionScope): GameClockSubscription`，订阅由真实 Scope 持有。每次运行中的原始 tick 只按原 delta 推进一次，实例本地 elapsed 独立于 Engine elapsed 起算。不引入钳制、时间欠账、丢弃区间或第二次 update。超出配置上限的间隔在桥回调前被 Clock 拒绝；恢复拒绝的卡顿间隔需要真实 pause/resume 与新的来源基线，已在 running 状态时调用 resume 不能恢复。暂停间隙不计入推进。渲染、捕获、空闲和零时间观察不推进动画。

有效绑定排斥手动 `step`，包括 `step(0)` 和非法 delta；二次绑定以 `F1_CLOCK_BOUND` 拒绝。原手动工厂实例请求绑定时以 `F1_CLOCK_CONTEXT_REQUIRED` 拒绝。显式销毁 handle 或订阅 Scope 完成关闭后，可以恢复手动推进或重新绑定；真实 Scope 处于 `closing` 时，tombstone 仍以 `F1_CLOCK_SCOPE_CLOSED` 拒绝直接 step/bind，包含逆序清理前的 abort listener 窗口。关闭中的回调安全退役，不推进，也不制造 callback failure。生命周期／profile／绑定检查保留已接受顺序，先于标量验证。

实例／资源销毁先退役绑定，再清理 core／显示对象；资源 group 持有借用的 page lease。销毁实例不自动关闭调用方持有的实例 Scope。推进后发生未知故障时仅该实例进入 inert 并退役绑定，不承诺 rollback。刻意注入的具名故障验证此边界和 B 实例独立性，不代表自然生产故障。每个实际创建的 handle 都须销毁；从未创建的绑定保持 absent/null，不伪造销毁观察。

### 复现提案与历史证据

拟议可移植后继保留既有 `run.mjs --spine-core <absolute official package directory> --output <absolute fresh external directory>` 命令，以及成对可选 `--webgpu --playwright <absolute existing Playwright index.mjs>` 输入。它需要已构建的当前公开 SDK、严格 TypeScript **7.0.2**、显式提供的精确 **137** 个官方 Core 内容文件，以及位于输入根外的新输出；不安装、不打包 Core。内容清单摘要不是持有特定压缩包的要求。公开重放仍须完成原手动 **12** 用例和 **6** 手动对照，再完成 Clock **10** 用例与 **3** Clock 对照；每个错误副本须先有新完整基线。**9** 通过／**1** pending 的 bootstrap 只为具名故障准备，不是完整 Clock 验收。仅测试 metadata／出处可以投影，语义 oracle、图像与原始字面量保持不变。本段不声称当前公开可移植复现成功。

首轮私有 GPU wrapper 在取得浏览器前停止：将单命令 JSON 数组当作对象读取，触发 `undefined !== 0`。保留的 `INCOMPLETE` 回执是 helper 准入失败。有限后继选择唯一具名命令并核对数组数量，保持产品、oracle 与 guard 字节不变。随后私有运行完成 **10+1** 回读。G09/G10 在 A 销毁与 B 订阅 Scope 关闭后复用原本地 **0.5** 帧。对照完整回读等于正例 **1** 秒帧，但原 **0.5** 中点 `(25,19)` 失败：预期 `[255,0,0,255]`，实际 `[0,0,0,0]`；没有拟合容差或新 oracle。

记录环境为普通 Edge **155.0.4283.45**、Playwright **1.62.1**、默认无附加 flags 的 headless `msedge`、**64×48**、DPR **1**。观察到 contexts／browser／server 及 API 资源／device 清理。物理硬件加速、浏览器执行文件／PID 与 OS 退役仍未观察或核实。Canvas 明确拒绝此纹理 profile；Canvas／WebGL、其他资产／导出、复杂 Spine 功能、UI／3D 合成及生产宿主仍开放。

阅读 [Clock 指南](README.md)、[已保存核验](../../../evidence/spine-f1-clock-verification.json)和[待完成公开投影](../../../evidence/spine-f1-clock-public-projection.json)。
随后在独立克隆中实际重放公开源码：手动 **12/12** 及 **6** 项原对照、完整 Clock **10/10** 及 **3** 项指定对照通过；具名故障实际执行，获接受用例跳过数为 **0**。独立默认无界面 WebGPU 执行通过 **10+1** 次回读、**30** 个正例采样点和 **120** 个通道，容差 **0**，保持原完整字节关系与限定清理。冷导入／帮助观察 **280** 个模块，Core／GPU／宿主访问均为 **0**。已保存 CPU 集合保留较早的 native-pending 截止状态；独立 native 回执才是实际后继。原创源码与输入身份未变。此处独立保存结果评审、最终仓库门禁和交付仍为 PENDING；完整 Spine **R020/V020 继续 OPEN**。当前后继见所链接的 Clock 核验／投影记录。
<!-- F1C-DOC-0.37.0-END -->

An opt-in original animation experiment connects genuine Egret resources, immutable meshes and the textured-frame port. Complete Spine support remains open.

工程预览 **0.36.0**，来源 **S089**，限定交付 **V040**，整理日期 **2026-10-12**。本可选实验把独立原创的动画样例接入真实白鹭资源组、资源租约、不可变 Mesh2D 几何与既有纹理帧接口。完整 Spine **R020/V020 继续 OPEN**。本截止点最终公开门禁与 0.36.0 交付为 **PENDING**。

## Profile 与所有权

外部官方运行时精确采用 `@esotericsoftware/spine-core@4.3.13`，修订 `b7beb2ccbbce667a12c02f44d070644f59b04968`。F1 包含两个未裁边、未旋转的 region 附件、一个平移骨骼、一个非循环 `slide` 动画和一张 16×16 的完整 nearest/clamp 纹理。图集中的逻辑 `.png` 名称显式绑定 1024 字节原创 RGBA 数据；这不实现 PNG 解码或验收 Editor 导出流程。

`createF1ManualResources` 通过真实同类资源组加载两个文本头和一张 Texture。每个实例有独立的 Skeleton、AnimationState、renderer 与保留的显示根。私有包装器通过真实租约认证 core 的 unknown 纹理身份。不可变几何只复制实际有效命令区间，先于 core 缓冲池复用；Y 仅反转一次，根坐标为 `(24,24)`。Float64 接入保留精确整数通道/255 色值。固定实测协议为两个 normal/light-tint 命令，每个四顶点、六索引。

`step` 仅接受 **0 至 0.25 秒**的有限增量。零增量、capture、render 不推进动画或 Engine 时钟。两个活动实例是明确的 F1 实验限制。Scope／资源组及保留节点的生命周期检查先于推进，并在可能回调的操作后复核。关闭单个实例不释放共享资源；关闭资源所有者先终止实例，再清理包装器／资源组。包装器不释放资源组所有的租约。正向推进后失败会令该实例停止继续推进，不承诺回滚或通用场景事务。不支持的 F1 特性明确拒绝。

## 复现 CPU 子集

按仓库既有指南构建常规工程，使用 Node **24.19.0** 和当前 clone 的 TypeScript **7.0.2**。依所列条款独立取得精确官方运行时，放在 checkout 外。runner 不下载、安装或新增默认依赖。

```text
node knowledge-base/experiments/spine-f1/run.mjs --help
node knowledge-base/experiments/spine-f1/run.mjs --spine-core <absolute official package directory> --output <absolute fresh external directory>
```

输出父目录必须存在，输出目录必须全新，位于所有已接入输入根之外；每次重试换一个目录。runner 核查官方包全部 **137** 个文件，以生成的局部严格 ES2022/DOM 配置仅编译原创第一方源码，重新核查当前宿主，并保留原始进程日志、哈希与自有副本逆向修改记录。当前 clone 快照与历史 Main 身份分开。

实际可移植 CPU 执行通过 **12/12** 项原始测试，其中包括十一项子契约。**6** 项对照均先通过全新的 **12/12** 基线：拒绝 additive profile、错误 Y、重复正向推进、反转实际命令顺序、遗漏实例 Scope 接入检查，以及在真实推进后刻意注入异常。最后一项只验证失败后停止推进的处理。记录的前后身份保留 **737** 个 SDK source/dist 文件、**40** 个依赖／辅助文件和 **137** 个 core 文件。独立源码／已存回执评审有 **0** 项开放问题。另行 cold import/help 实测解析 **280** 个模块，core 导入 **0**、GPU 入口导入 **0**、宿主访问 **0**；这不是完整默认测试／prepush 执行。

CPU 位置使用独立评审确定的固定绝对界限 **2^-20**，只适用于原创浅层 F1 及满足未改三角函数前提的宿主。UV、通道、索引、身份和时间均精确；原像素容差仍为 **0**。最初精确坐标相等失败和 `RENDERER_REQUIRED` 环境设置失败作为历史保留；有限后继分别核查浮点精度及协商既有纹理 profile。环境失败从未计为动画验收。

## 分开的桌面证据与待完成公开后继

另行执行的原创桌面验证程序 通过 **8** 次 WebGPU 正例提交、**22** 个精确字面像素样点、完整字节重复、B 实例独立性及共享资源清理。其一个重复推进指定错误对照在原创中点 `(25,19)` 观察点按预期失败。另一个分类 actor 通过 **3** 次读回验证 `PIXEL_FAIL`、退出码 **1** 和保留的清理。这些数量不合计。已存桌面／分类评审有 **0** 项开放问题。

该历史执行使用普通 Edge **155.0.4283.45**、Playwright **1.62.1**、DPR **1** 和默认 adapter/device。API adapter 信息报告 `nvidia`／`blackwell`，不独立确认实体设备身份、硬件加速、电耗／性能或操作系统子进程回收。借用设备关闭及自有 `device.destroy` 是已记录的 API 生命周期证据。

已准备的公开 CPU／浏览器复现工具在一个新 clone 实际执行：CPU **12/12** 与 **6** 项全新基线对照，随后浏览器 **8+1**、**22** 个精确正例样点、完整重复、原创中点对照与限定清理通过；runner 报告 **1651** 项输入身份未改。该后继与不可变 CPU collection 的 `REQUESTED_PENDING_SEPARATE_ENTRY` 截止点、早先桌面／分类记录分开，不增加其他特性覆盖。其有限独立源码／存据评审通过，有 **0** 项开放问题。公开 checkout 也通过相同 CPU／浏览器 profile，其阶段回执作为独立后继。本截止点，最终门禁及交付仍为 **PENDING**。可选复现命令如下：

```text
node knowledge-base/experiments/spine-f1/run.mjs --spine-core <absolute official package directory> --output <absolute fresh external directory> --webgpu --playwright <absolute existing Playwright index.mjs>
```

缺少浏览器验证输入或设置失败返回 `INCOMPLETE`，单独 CPU 命令仍有效。退出码为 **0** `PASS_F1_CPU_SUBSET`、**1** `FAIL_F1_CPU_SUBSET`、**2** `INCOMPLETE`，以及另行请求浏览器验证时的 **3** `UNSUPPORTED_DEFAULT_ENVIRONMENT`。分别查看各阶段自己的回执。见[验证](../../../evidence/spine-f1-manual-verification.json)与[公开投影](../../../evidence/spine-f1-public-projection.json)。

## 来源、许可与待完成工作

原创桥接、测试和美术输入是第一方 Apache-2.0 工作。官方运行时保持自己的 [Runtime License](https://esotericsoftware.com/spine-runtimes-license)，更新于 **2025-04-05**，没有在此打包或改换许可。[Editor Agreement](https://esotericsoftware.com/spine-editor-license#s2)、固定修订的 [spine-ts README](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/README.md) 与[许可 FAQ](https://esotericsoftware.com/spine-purchase)区分评估、具备资格的集成、工具链用户制作／修改含 runtime 产品，以及再分发通知要求。Editor Trial 不是 runtime 集成授权。外部取得、源码可见和执行成功不建立豁免或个人资格。集成／分发资格仍为 **unverified**。

当前 Canvas 拒绝此 Engine 所有的纹理 profile。Canvas／WebGL 验收、自动 GameClock 集成、其他美术／导出版本、二进制、PNG 解码、PMA／双色／混合／网格／形变／裁剪／轨道混合／事件／约束／物理、复杂 UI／3D 合成、手机／Native SDK 与性能／电耗仍未完成。继续[完整 Spine 验收](../../docs/Spine动画支持需求与验收.md)与[工程规划](../../docs/工程规划.md)，保留更完整 UI／runtime、AI 创作者及旧工程迁移义务。

前一版本 **0.35.0** 经 [PR #22](https://github.com/cnedwin/Egret_rebuild/pull/22) 交付，Main 为 `d16f91c7ef41c9143469b21f4b3ef8b4efd1868e`，树为 `a46b03f314b0f9b6c5c45a74affef498db97a7d6`。其必要推送门禁通过 **2678/2678** 项核心、**63/63** 项公开检查、**148** 对文档及 **177** 项关键来源。GitHub 返回 **0** 项状态和 **0** 项检查任务，不宣称远端 CI 通过。早先待完成截止点继续作为历史保留。

提交空白检查随后拒绝了浏览器脚本末尾的一行多余 LF。仅格式后继删除该 LF 并更新清单身份，其余源字节及全部原创验收数据不变。当前 CPU **12/12**、**6** 项对照和浏览器 **8+1** 再次通过。原来源与执行身份继续作为历史保留，见[投影出处](../../../evidence/spine-f1-public-projection.json)中的格式后继；最终门禁与交付仍须各自记录。
