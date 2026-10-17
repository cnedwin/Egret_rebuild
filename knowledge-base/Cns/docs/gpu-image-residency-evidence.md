# 实验性 WebGPU 图像驻留：证据与限制

[English](../../en/docs/gpu-image-residency-evidence.md) | 简体中文 · [契约](gpu-image-residency-contract.md)

工程预览 **0.61.0** 增加由各 WebGPU Host 独立管理的内部缓存，复用精确裁剪图像，不改变公开 API、包入口、选项、依赖或 Host 协议。工作区包仍为 private、版本 **0.0.0**，Host 协议仍为 **1.0**。下述已接受证据覆盖所选源码与受控所有权/预算行为，不构成新增缓存完整 Native 像素矩阵或设备性能验收。

## 已记录的证据范围

| 范围 | 实际结果与边界 |
| --- | --- |
| Host 源码与指定对照 | 独立审查在受控 unit 范围内接受所选 Host 内部实现、精确指定机制副本及修正后的 collector。公开 Host 声明保持原字节。这不构成整分支或浏览器接受。 |
| 公开行为/寿命测试 | 一次完整 healthy 与一次完整 source-restored 运行分别通过同一组 **110/110 cases**，failed/cancelled/skipped/todo 均为 **0**。这是 110 个 case 的两次执行，不是 220 个不同 case。 |
| 预算敏感性 witness | 指定的仅在退休处理目录驱逐机制实际到达目标 ready-resource callback，准入一个合法 nested submission，得到逻辑 **Q=33555432**，比 **33554432 超出 1000 bytes**。healthy 和 restored witness 对该同步 nested submission 给出既有 `WEBGPU_REENTRANT`，不新建图像并保持预算内。 |
| 恢复与保存结果 | 独立结果审查接受完整 before/assigned/restored 顺序，该范围内开放 finding 为零。完整实际执行的 assigned 输入单独保存；恢复 owner 与 healthy 所选输入完全相同。 |
| 保留 strict/source/lifetime 检查 | 独立审查接受十二文件后继及其聚焦结果：普通寿命后继 2/2、strict 检查通过，原 7 个 negative 与 4 个 import-negative compiler tuple 保留；精确 source-pair 对照已接受。完整十四阶段集成结果仍待完成。 |
| 所选已有桌面回归 | 既有图集导入 Canvas/WebGPU 与纹理场景组合的有限保存结果已独立接受。图集四整帧比较 6144 channels；组合两帧比较 24 pixels/96 channels，均零差异。完整缓冲区保留与比较范围分别记录；可选图集帧重放未在当前源码运行。 |
| 其他历史桌面流程 | 截至本次编写，基础/B1/纹理、SpriteSheet/播放、其他 PNG 路径、资源槽、资源场景和组合准备均为 **NOT_RUN_AT_CURRENT_SOURCE（未在当前源码运行）**。历史通过不构成当前 Host 接受。 |
| 新增缓存专用 Native 矩阵 | 专用 collector 与新增六上下文/24 次主读回矩阵**延期并保持 OPEN**。设计场景和计划读回不计入验收。 |
| 最终公开内容与交付 | 截至本次编写，双语文档审查、完整正常 prepush、committed-snapshot push hook、实际 commit/push/PR/Main 与远端 CI 均待完成，不推断未来次数、hash 或交付结果。 |

正常完整验证具有十四个阶段；最终运行发生之前，本文不记录其结果。源码接受、保存 unit 结果接受、当前保留门禁、字面浏览器观察和仓库交付分别记账。

最初聚焦运行记录 179/180 通过，一项仍使用旧 idle 销毁期望的断言失败。窄范围后继修正该过时期望并通过两项普通寿命测试；strict 与 source-pair 结果分别接受。不据此声称最终 180/180，也不将其代替完整正常门禁。

## 受控行为与预算反例

永久测试通过 built public entry 使用受控 device，覆盖 identity/crop/Host 隔离、重复使用、pin 所有权、并发完成与碰撞、逻辑容量与确定性驱逐、原准入拒绝、native 操作重入、stop/failure/close 和 pending work。这些属于受控规格/所有权测试，不是真实 GPU 执行。复现时在正常 build 后，通过正常 Node test runner 选择 `tests/gpu-image-residency.test.mjs` 和 `tests/gpu-image-residency-lifecycle.test.mjs`；不同源码树必须产生新结果。

独立 witness 首先建立 **256 个真实 ready 条目**：七个 4 MiB crop 与 249 个不同的 4-byte crop。两个 reader、一个小 cold submission 与一个 nested 4 MiB frame 符合原 projection 准入限制；其字面总 projection 为 **29361128 bytes**，小于 33554432。该输入计算与 fixture 实际分配额度 Q 分开，不是 Host 私有 counter 观察。

assigned 副本恢复一种已拒绝机制：在退休期间驱逐 ready resource 处理目录压力，取代同步 submission 阶段处理。它作为一个经审查的语义对照，同时移除 submission 目录驱逐并恢复退休对应驱逐；fixture 和 oracle 保持不变。目标 callback 发生时 victim 仍被记账；清理返回前，一个合法 nested frame 被准入，导致图像池超额。

| Witness | 目标阶段 | Nested 结果 | 新建图像 | Q 峰值 | 最终 serial / close / Q |
| --- | --- | --- | ---: | ---: | --- |
| Healthy before | Submission | `WEBGPU_REENTRANT` | 0 | 29361124 | 259 / safe / 0 |
| Assigned mechanism | Retirement | 接受，返回 `undefined` | 1 | **33555432** | 260 / safe / 0 |
| 正常 build 后 source-restored | Submission | `WEBGPU_REENTRANT` | 0 | 29361124 | 259 / safe / 0 |

assigned collector 有意先记录完整 trace 再判定，退出码为 0；超预算结果属于 semantic RED，不是进程、setup 或 import failure。它真实到达预定退休 callback，并记录 nested 准入、serial 增长和新分配。最终 safe close 不消除早先预算违反。

两个 healthy witness 文件字节完全相同，均包含完整 safe cleanup 至 Q=0。其生命周期汇总次数和最终零不能独立证明每个 resource 的 exactly-once cleanup，因为保存 trace 没有逐资源标识。已接受所有权源码与永久公开 object-counter case 分别提供支持。Q 来自真实返回的受控图像 descriptor，每项额度从 destroy callback 进入至正常返回始终保留；它不是物理 VRAM。

所选 healthy/restored 源码身份为 `WebGPUHost.ts`，**92002 bytes**，SHA256 `d3d75dbdb3e1fe906301344e06ac25275189e8f7fe481abff1b98563f9fc832a`；emitted Host JavaScript 为 **85885 bytes**，SHA256 `6287b56f10c6899c12dc6a05a0b40f188c74e22f1b92e4c55dae9f80d29d834b`。未变 Host declaration 为 **4489 bytes**，SHA256 `3901c425c45da83e0a4331ea3945e318335abd78798dd3da6f3ea8be9b802576`。这些标识已接受 unit 源码，不标识未来最终 release tree。

## 已接受的有限桌面回归

所选既有流程已通过独立源码和保存结果审查：图集导入 Canvas 与 WebGPU 各保留两份完整 24×16 RGBA 画面，纹理场景组合保留两份 64×64 RGBA 缓冲区。合计六次读回、38912 bytes 原始数据。图集四帧以零容差比较全部 6144 channels，无差异；组合流程每帧比较 12 个字面像素，共 24 pixels/96 channels，零容差、无差异。组合流程保留完整缓冲区，但不声称整帧相等。

组合流程在安全 idle 后，第二次呈现改变 UI 顺序，同时保留同一真实图像及 view/裁剪键。这构成有源码依据的已驻留资源消费回归，不提供 Native 命中、新建图像或上传次数。图集流程使用同一真实图像和不同裁剪 A=(0,0,2,3)、B=(3,0,2,3)，属于顺序不同裁剪回归，不是保存帧重放。CHNC01 使用保留字节拒绝一个故意错误的像素期望，新增 Native frame 为零。

保存运行没有意外浏览器、渲染或清理错误。原异步工作全部结算，记录的 Host pending counter 归零，WebGPU close 为 safe；page/context/browser/server 的协作式 API 清理已接受。物理资源回收、channel 实际启动的可执行文件身份以及 OS 子进程退役仍未绑定。

记录环境为 Node 24.19.0、Windows x64、Edge 155.0.4283.45、Playwright 1.62.1，使用 msedge channel，调用方未增加启动 flags。这些有限流程不接受新增缓存专用矩阵，也不接受未在当前源码重跑的历史流程。

## 证据限制与后续工作

独立结果审查接受保存执行及正常源码恢复/build 顺序，该范围内开放 finding 为零。原 witness 和进程记录保持保存。上列源码身份标识该 unit 截止点，永久公开测试提供相应受控行为的复现入口。

继承的手动 timer case 通过显式调用受控 callback，证明关闭超时后生命周期管理权限仍保留，**不证明**实际经过 17 ms 或设备时限。该证据限定单独保持 deferred，不提供时间测量。

实现、fixture 与文档是 Apache-2.0 下的 Codex 辅助第一方工作，扩展既有 Host/ledger/resource/projection 基础设施。已有研究、依赖及其许可声明保留[来源记录](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json)中的归因。本次变更不增加运行时依赖。

物理 GPU 内存、驱动回收、帧时间、速度、功耗、热、目标手机、跨浏览器/GPU 行为及实际 device-loss 恢复均未验证；新增缓存专用 Native 矩阵保持 OPEN。完整 UI/P04、完整 Spine R020/V020、完整 3D、生产 Host 与迁移 R008/V006 仍为独立工作。受控测试或保留回归通过不能关闭这些义务。
