# 实验性 WebGPU 图像驻留契约

[English](../../en/docs/gpu-image-residency-contract.md) | 简体中文 · [证据与限制](gpu-image-residency-evidence.md)

工程预览 **0.61.0** 增加由各 WebGPU Host 独立管理的内部图像缓存，复用先前提交已安全完成的精确裁剪 GPU 图像。机制位于 `WebGPUHost` 内部，不增加包入口、导出、选项、公开状态、错误码或依赖。工作区包仍为 private、版本 **0.0.0**，Host 协议仍为 **1.0**。公开准入与渲染行为继续遵循既有 [WebGPU 契约](WebGPU矩形执行合同.md)和[纹理几何契约](自有纹理几何与Mesh2D契约.md)。

本契约规定逻辑所有权和有限复用。操作次数对照与浏览器像素、物理 GPU 内存、性能验收分别记录。新增缓存专用浏览器矩阵延期并保持 OPEN；实际验证截止点见配套证据。

## 身份与渲染范围

每个条目归属一个不可伪造的 Host 会话身份。完整键由该身份、真实不可变 `ImageData2D` 对象身份、精确整数 crop `(x, y, width, height)` 及固定上传/采样配方组成。不同图像对象即使字节相同也不共享，不同 crop 不共享；两个 Host 即使借用同一 GPU device 也不共享。已准入 crop 的负零使用与零相同的规范拼写。

配方保持紧密排列的 `rgba8unorm` 图像、encoded-premultiplied 字节、nearest/clamp 采样、mip level 0、单 mip、sample count 1 和既有 texture usage 6。调用方不能选择配方标识。变换、裁剪、透明度和 Mesh light 值仍逐 draw 计算，不属于缓存身份。

普通 image draw、纹理 Mesh2D draw 与 scene overlay 使用同一内部机制。scene 的 depth、geometry 和 material 不属于图像缓存。Canvas 保持独立。本次变更不消除 CPU frame/projection copy，不做整图集重映射、batch 合并、外部 texture/video/readback target 缓存或自动设备恢复。fresh capture 仍验证原资源 lease 与显示对象寿命；原 Texture 释放后，已保存不可变 frame 保留既有重放语义。

## 所有权与安全复用

新建图像 texture 由其 submission record 独占。先前提交安全完成并具备提升资格之前，后续提交不能使用它。record 在读取 disposer/view 操作或检查重入状态变化之前，先登记真实返回的 native resource；创建未返回资源时不虚构清理义务。

提升要求提交成功、已观察 error scopes 与 queue fence 成功、所请求 readback 的 map/output 成功，以及 record 的非 candidate 资源清理成功。record 和 Host 均不得存在 failure 或 unsafe 状态；Host 必须仍 active、保持同一会话身份并启用复用。仅同步上传成功不构成资格。每次 native 清理返回后重新检查提升资格。

提升将精确资源从 record 独占清理集合向 cache 所有权转交一次。ready 条目仅保留 GPU 资源及有限所有权/索引元数据，不保留 CPU image/pixels、frame、projection plan、lease、Texture wrapper、submission 或 callback。弱图像索引不增加反向图像强引用。GPU 清理不依赖垃圾回收或 finalizer。

每个提交对同一 ready 条目只 pin 一次，不随重复 draw 或 image/Mesh 共用增加。view 是借用资源，不同时进入 submission 的独占 texture 清理集合。一个 reader 释放不能销毁仍被其他 reader pin 的条目。

并发 cold submission 不共享尚未验证的 candidate。若另一安全完成的 candidate 已发布同 key winner，保留该 winner，后来 candidate 由自身 record 清理；碰撞不更新 winner 的新旧次序。ready 目录已满时，后来 candidate 成为 transient，由 record 安全清理，不等待、不在退休期间驱逐、不进入提升队列，也不在随后复活。每次 native callback 之后重新检查资格、winner 和目录容量。

## 逻辑预算与确定性驱逐

图像分配/预留池为 **32 MiB（33554432 bytes）**。每个裁剪图像按 `4 × width × height` 记账；这是逻辑额度，不是实测 VRAM。最多 **256 个 ready 条目**可供查找；该目录限制不等于所有在途 candidate 的数量限制。

既有限制保持不变：每帧 projection 16 MiB、pending projection 32 MiB、128 views，以及既有 source/table/scratch/device/scene/geometry/upload/readback 限制。缓存命中或无覆盖 view 不退还原 frame 的完整逻辑 projection 额度。`pendingUploadBytes` 保持原 buffer/uniform 定义。普通与 B1 Host 的 `maxPendingFrames` 默认值仍为 2，并保留允许更大 positive safe integer 的原规则；textured 和 textured-scene 选项仍最多为 2。

完成全部既有验证、packing 和 projection copy 后，缓存才形成只读计划。有覆盖 view 按首次 draw 顺序去重。计划保护全部本次 hit，从最旧端选择足以满足未来字节和目录 slot 的合格 idle ready 前缀；pinned 条目与本次 hit 不可选。即使字节已足够，单独目录压力也可以选择 victim。无法取得未来目录 slot 不拒绝或延后其他方面合法的 frame，其 candidate 可以保持 transient。

commit 在既有同步 submission busy 边界内执行：先 pin hit，按首次使用顺序更新新旧次序，清理所选 victim，只有全部所需清理正常返回后才预留 cold 字节。真实返回的 cold texture 将 reservation 转为 allocated charge，不增加总额。命中不新建或上传 image texture；既有 draw setup、geometry/uniform 工作、fence 与所请求 readback 仍执行。

驱逐先移除 lookup/LRU 成员，再 attempt 捕获的清理操作；包括 callback 执行期间在内，额度始终保留到 `destroy` 正常返回。清理抛错保留未知回收额度，禁用复用/提升并沿原 unsafe failure 路径处理，不重试、不重新公布，也不基于假定销毁成功继续分配。

hit 在 submission commit 时移到最新端；安全提升的条目进入最新端。reader 完成、碰撞和观察不更新次序。退休不驱逐 ready 条目，不新增 busy 锁。原 record-owned 清理仍可按既有准入规则重入 active Host；ready 驱逐发生在同步 submission 中，其 nested render 受到既有 `WEBGPU_REENTRANT` 拒绝。

每个 record 的全部清理 callback 返回前，均保留原完整 pending charge。record-owned candidate 与 reservation 由该额度覆盖；已 detach 的 cache-owned victim 单独保留额度至清理成功。这一区分防止退休重入在被驱逐 texture 尚在销毁时超池分配。

## Stop、failure、idle 与 close

`stop()` 同步禁用 lookup 和提升，不执行 native 清理。安全在途 record 继续原结算；已 ready 条目仍由 Host 持有至显式 close。failure、实际送达的 device-loss 通知和 uncaptured-error event 同样禁用复用/提升。stopped 或 failed Host 不能重启该会话，重建沿既有设备契约使用新 Host。

`whenIdle()` 保持原工作快照含义，不刷新 resident 条目，也不承诺图像存储为零。

`close()` 保持原 cached Promise 与 barrier：禁用复用/提升，等待 startup、同步工作和 ledger outcome，并执行所需最终 queue fence。finalizing record 释放 pin、清理自有 candidate，不执行提升；随后 Host 对剩余 cache-owned 资源逐项 attempt 一次，再进入既有 surface/listener/device 清理。借用 device 仍为借用。已 attempt 清理不重复，未知回收不能报告为 safe。

未完成 fence、scope 或 readback 会使原 record、pin 与 close 保持 pending，不强制退休、不提前退款、不增加缓存超时。Engine close timeout 沿原规则报告超时并保留生命周期管理权限，晚到结算仍决定 safe 或 unsafe 完成。受控手动 timer 调用证明超时后的权限保留，不证明实际经过的墙钟时长。

device loss 遵循原 Promise 通知顺序：在同步 native callback 内 resolve 受控 `device.lost` Promise 只表示通知已排队，不表示 Host 已观察 loss。native 边界检查以当时实际观察到的状态为准。实际送达 loss 和同步 uncaptured-error event 分别作为对照。

## 来源与验收边界

实现、原始 fixture 与文档为 Codex 辅助编写的第一方工作，使用 Apache-2.0。本机制扩展既有第一方 Host、projection、资源所有权和 submission ledger。既有研究、基础依赖及其许可声明保持 [source-origin.json](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json)和[独立实现政策](独立实现与第三方依赖规范.md)记录的角色。本次变更不增加运行时依赖。

逻辑额度与受控操作次数不证明速度、能耗、热行为、驱动回收或物理 VRAM。新增缓存专用浏览器 collector 及其六上下文/24 次主读回矩阵延期并保持 OPEN。已有浏览器回归结果如被记录，仅适用于其精确当前输入和字面比较范围。生产 Host、目标手机、实际 device-loss 恢复、完整 UI/P04、Spine R020/V020、完整 3D 与迁移 R008/V006 仍开放。
