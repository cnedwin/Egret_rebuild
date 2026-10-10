# 异步资源合同探针

[English](../../../en/experiments/async-resource-probe/README.md) | 简体中文

研究原型，日期：2026-10-08。它验证手动交错的回调顺序与资源状态，不执行白鹭历史源码、真实 CPU 解码或 GPU 操作，不作为完整引擎实现或生产选型验收。

## 本次实际结果

- 审计修正后的新模型：25 个案例全部通过。结果见 `../../evidence/async-resource-probe-results.json`。
- 旧政策反例：7 个案例全部失败。结果见 `../../evidence/async-resource-probe-legacy-red-results.json`。这是预期的研究失败，执行返回码为 1；不能把它报为新实现失败或通过。
- 失败阶段先编写测试，再通过测试侧适配器直接调用上一轮真实 `../contract-probe/model.mjs` 中的 `ResourceModel`。适配器仅映射观察接口，保留 owner Set、合并 complete 和同步 rebuild 的实际旧政策。新模型随后实现。其余 17 个扩展案例验证新模型的合同边界，未声称这 17 个案例也曾全部在旧模型中执行并失败。
- JSON 记录实际环境、时间、每项结果、观察点、源码 SHA256 和限制。首次 24/24 结果保存在 `async-resource-probe-pre-fence-audit-results.json`，对应源码在 `history/pre-fence-audit/`；旧政策失败报告中的测试源码引用已指向这一归档，其摘要及原始观察未改动。没有统一 package 测试命令，本探针按独立执行入口运行。
- 独立审阅发现 fence 默认当前 epoch 会误认漏传设备代次的旧回调。新增反例实际执行为 24 通过/1 失败，已保存在 `async-resource-probe-audit-red-results.json`，对应修正前模型与新增测试源码在 `history/fence-audit-red/`。随后删除默认 epoch，正常调用显式捕获设备代次，最终 25/25 通过。

真实旧反例：同一 `scene` 两次 acquire，owner Set 仅记录 1；资源成功后 release 第一个句柄，资源直接删除；第二个句柄 use 抛出 `Resource unavailable`。相同场景的两项获取因此必须是两份独立租约。

## 候选合同

| 方面 | 模型约定 |
| --- | --- |
| 资源身份 | 同 ID 的记录每次销毁后重建递增 resourceGeneration；在 fence 保留记录期间重新 acquire 沿用资源身份，但获得新 leaseId。 |
| 持有身份 | 每次 acquire 产生独立 leaseId；同 owner 可有多个租约。use、任务启动、release/cancel 都检查该租约仍有效。 |
| CPU 任务 | decodeStart 返回独立 taskId；CPU 任务只受资源身份及任务身份约束，不携带 deviceEpoch。设备丢失期间仍可 completeDecode，CPU 成功只产生 decoded 数据。 |
| GPU 任务 | uploadStart 要求有效租约、decoded CPU 数据和可用设备。上传 token 带 resourceGeneration、taskId、deviceEpoch。当前任务的成功完成才设置 resident。 |
| 共享任务 | 一个资源的多个租约共享当前 decode/upload 任务；发起租约取消后，只要其他租约存在，结果仍可提交。最后一个租约释放会使未完成任务失效。 |
| 设备恢复 | loseDevice 使 GPU 状态变为 lost 并失效上传 token，保留 CPU 数据和未完成解码。restoreDevice 仅开放后续提交，不同步设置 resident；需重新 uploadStart/completeUpload。 |
| 错误与重试 | complete 的 `true` 表示当前结果已接受，也可能是失败结果。失败记录 stage/code/taskId/resourceGeneration，上传另有 deviceEpoch。OOM 和普通上传失败均不驻留，CPU 数据可用于显式重试；新任务 ID 拒绝迟到的旧成功。 |
| 最后释放 | 句柄立即失效；若当前设备存在未完成 use，则保留记录至 fence。没有未完成 use 则删除记录。旧 release/cancel/use 不影响重新获取的租约。 |
| fence | use 使用尚未完成的正整数帧号；fence 必须显式传入非负整数 frame 和正整数 deviceEpoch，省略 epoch 抛错且不修改状态。旧设备 fence 被拒绝；每个新设备从完成帧 0 开始。调用方必须在提交/注册回调时捕获代次，不能在迟到回调中读取当前代次。 |
| 设备丢失边界 | 本模型假设设备丢失已使旧 GPU 分配和旧使用全部失效，清除旧 lastUse。真实驱动是否还需等待销毁通知、同步或延迟回收，尚未验证。 |

CPU 状态为 `empty → decoding → decoded/decode_failed`，解码失败可显式重试。GPU 状态为 `empty/lost/upload_failed → uploading → resident/upload_failed`。任何设备丢失均转为 `lost`；恢复本身不改变它。非法及重复回调不得替换当前数据或错误。

## 接口与复跑

`acquire(id, owner)` 返回租约；`decodeStart(lease)` / `uploadStart(lease)` 返回任务 token，已有当前任务时共享 token，已完成时返回 null。任务完成接受 `{ ok: true, data }`（解码）、`{ ok: true }`（上传）或 `{ ok: false, code }`。`release(lease)` / `cancel(lease)` 只释放这一份租约；`snapshot(id)` 输出租约数、逐 owner 数量、两个状态、任务身份、设备代次、帧水位和最近错误。

在本实验目录使用已有 Node 运行时，无需安装依赖：

```powershell
node 'run.mjs' --legacy-red
node 'run.mjs'
```

两条命令分别改写自己的红/绿结果 JSON，不修改旧探针。若以后修改测试或旧模型，应先保存当前 JSON 与相应源码版本，再重跑红阶段，避免历史摘要失去对应源码。

## 未知边界

这不是真实异步执行器；测试用明确调用顺序注入成功、失败和设备事件。25 个案例不能证明所有交错、完整线程安全、锁策略、跨语言序列化或资源 ABA 安全。租约/token 字段是本地生命周期身份，不是跨信任域的授权凭证。

CPU 数据只是字符串夹具；没有解码格式、内存大小、缓存预算、压缩资源、资产版本、GPU 多副本或真实 OOM/驱动上传失败。恢复调度、并行数量、后台资源策略、上传期间的 CPU 生命周期、超时以及重试退避也未实现。单资源仅保留最近错误，不是错误历史台账。

fence 为测试显式注入；未使用实际图形 API，不能外推硬件释放时机、移动端/小程序/原生宿主表现、性能收益或画质。这里的证据只支持继续细化资源生命周期候选合同。

2026年10月10日调整阅读文档位置。文中的实验命令仍在仓库根目录下的共享目录 `knowledge-base/experiments/async-resource-probe` 中运行。此次阅读文档迁移没有重跑实验，也没有改写原始证据。
