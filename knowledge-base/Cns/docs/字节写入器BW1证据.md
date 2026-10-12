# 字节写入器 BW1 证据

[English](../../en/docs/byte-writer-bw1-evidence.md) | 简体中文

本记录绑定第一方 BW1 实现与独立保存的实际结果。源码按白鹭规格及 ECMAScript 内建操作原创实现，采用 Apache-2.0；不新增产品依赖。字节序复用原有 ByteReader 类型。策展读取已有证据，不新增产品执行。

## 工程预览 0.40.0 — 自有 ByteWriter

**S093 / V044。有限 CPU、类型和指定边界结果已接受；完整发布门禁与交付仍为 PENDING。** ByteWriter 提供固定容量的严格二进制追加、原生 IEEE 浮点转换和已提交前缀的独立快照，复用原有 ByteOrder 与 Scope 生命周期。

实际构建与 37/37 项公开／回归用例通过，其中包括 8 组 BW、23 项 ByteReader 和 6 项 Scope；另有 2/2 个独立进程故障测试文件通过。BW 的 24 条内部观察包含 22 次受控故障触达，不是额外的测试用例。正向类型诊断为 0，两类刻意负向诊断分别为 41/16，共 57 条精确位置／代码记录。严格类型门禁和边界检查退出码均为 0，指定边界对照为 17/17。

保留完整边界套件状态：PENDING_AT_SOURCE_CURATION。它与指定的有限对照及尚待完成的最终完整 prepush 分别记录。

已记录的 0.39.0 交付后继：纹理场景合成已通过 [PR #26](https://github.com/cnedwin/Egret_rebuild/pull/26) 合并，Main `ac490f90b7467164e461112a9f572a3269107c02` 与 tree `c137666681de663360a9bc153d85e6e71f48bd42` 已在本地和远端回读一致。必要推送门禁退出码为 0。远端状态与检查运行数均为零，不声明远端 CI PASS。较早的待完成截止点与首轮失败 prepush 继续作为历史记录保留。

阅读[契约](字节写入器BW1契约.md)与[证据](字节写入器BW1证据.md)。这是一项原创实现的第一方工具类工程增量，不构成文件格式、旧 ByteArray 兼容、完整 Spine、迁移、原生 SDK 或设备／性能验收。历史失败、准备截止点与未完成项保持原样。


## 实际 RED 与 GREEN 的边界

旧 SDK 的 Engine、Scope 与字面值 ByteReader 基线及清理先完成，再在 BW1_PUBLIC_WRITER_REQUIRED 断言处观察到缺失 API。原始正向类型消费者产生 4 条缺失导出诊断和 13 条未解析类型造成的后继断言诊断；它们不是新负向清单。更早的 ENOENT 属于测试环境准备失败，继续单独保存。

独立故障文件在恢复环境描述符后只武装捕获的忠实原生包装器：两类构造分配、两类快照失败、八个标量写入器的写入前／后故障，以及批量复制前／后故障。异常身份、长度与完整已提交前缀、重试字面值、环境恢复及释放均有实际观察。不据此承诺真实内存耗尽恢复、任意篡改 realm 隔离、重入防护、清零或物理回收。

初轮边界对照的失败与精确测试目标修正记录在共享文件中。源码审查、观察收集器、实际严格类型门禁、边界对照及完整 prepush 是各自独立的阶段；不将较早失败改为成功。

## 重现与未完成项

在已安装项目工具链的环境中运行下列命令。它们是重现说明，不是本文件再次执行或新的验收记录。

```sh
node tools/build.mjs
node --test --test-reporter=tap tests/byte-writer.test.mjs tests/byte-reader.test.mjs tests/cancellation-scope.test.mjs
node --test --test-reporter=tap tests/byte-writer-allocation.test.mjs tests/byte-reader-allocation.test.mjs
node tools/check-types.mjs
node tools/check-boundaries.mjs
node --test --test-reporter=tap tests/byte-writer-boundaries.test.mjs
node tools/prepush.mjs
```

精确的当前源码、发射、类型清单与见证身份保存在[共享核验记录](../../evidence/byte-writer-bw1-verification.json)。完整发布门禁、必要推送与 BW1 的 PR/Main 交付在本策展截止点仍为 PENDING。完整 Spine R020/V020 与迁移 R008/V006 保持 OPEN；无新增 GPU／宿主、手机、性能或完整产品验收。

<!-- BW1-DELIVERY-0.40.0-SUCCESSOR-BEGIN -->

## 已完成的交付后继

0.40.0 ByteWriter 已通过 [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27) 合并；已回读 Main `8e1509878252cc2a9295fcc56d7597877d023c85` 与 tree `ca1f2f176713e388e09016ae22d610c5c1b95201`。必要推送门禁退出码为 0，公开校验 63 项、核心校验 2724 项。远端状态／检查运行数均为零，不能据此声明远端 CI PASS。较早的 PENDING 截止点和失败记录继续保留。

<!-- BW1-DELIVERY-0.40.0-SUCCESSOR-END -->
