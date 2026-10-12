# Spine 线性动画源规格证据

[English](../../en/docs/spine-linear-profile-evidence.md) | 简体中文

工程预览 **0.43.0 候选** · 规格 **S096** · 验证 **V047**。本文记录有限的 F2-B 源规格切片，保留初始类型截止点 **2026-10-12T19:55:10.1768364Z**，以及结束于 **2026-10-12T20:08:23.9496817Z** 的独立宿主观察。后继宿主结果的独立审查与完整开发集成在**本截止点保持 PENDING**。[契约](Spine线性动画源规格契约.md)定义支持的源形态和拒绝顺序。完整 Spine **R020/V020 保持 OPEN**；源规格证据不升级 Core、姿态、播放、资源或渲染验收。

## 已接受的源码、编译与行为

独立源码审查接受四个变化的产品源文件、共用 A 外壳的语义保留、r2 规格及 r3 位置补充，在这些有限范围均为 0 个未解决问题。保存结果的独立复核接受实际严格产品编译、具名公共 API、保留的 A／源策略测试，以及普通 B 行为。这些结果不是由复核者重跑 Core 或浏览器建立的。

| 观察 | 已保存实际结果 | 范围 |
| --- | --- | --- |
| 真实具名 API RED | 完整公共 SP1／A 基线标记先于 `createF2MeshProfilePlan` 唯一的 undefined／function 断言：1 test、0 pass、1 fail；skip／cancel／todo 为 0。 | 已构建、已交付 A 命名空间缺少符号，不是缺模块或伪对象 setup 失败；原 receipt 保留为历史。 |
| 产品严格编译与具名 API 后继 | 独立严格编译 exit 0，stdout／stderr 为空；另一次具名 API test 为 1／1。执行结束于 **2026-10-12T19:41:22.8058290Z**。 | TypeScript 7.0.2、ES2022／NodeNext 严格配置、真实实验入口；2 values／10 erased types。此编译不是 consumer type 验收。 |
| 保留 A 与源策略开发入口 | **25／25** tests，fail／cancelled／skipped／todo 均 0；结束于 **2026-10-12T19:46:53.2452198Z**。 | 16 个保留 A 行为案例、1 个具名 API 案例、8 个源策略案例：1 baseline 加 7 指定 controls。同一 API test 的独立执行不累计为独特覆盖。 |
| 普通 B 源规格行为 | **135／135** tests，包含 22 个源 family 内的嵌套测试，fail／cancelled／skipped／todo 均 0。执行时间为 **2026-10-12T19:53:42.5158899Z–2026-10-12T19:53:43.8094608Z**。 | 不可变自有结果、严格白名单、包含空 map 的引用、原始位置、有限域、binary64／Float32 时间资格与逻辑预算；不是 Core／姿态／播放／像素覆盖。 |
| SDK 身份复核 | 全部 **314** 个已封存基线 SDK emission 的物理 bytes／SHA-256 匹配，0 mismatches。 | 已交付基线的精确保存清单；不是默认 SDK 扩张或重复全 SDK 算法审计。 |

保留开发入口还维持 A 原 positive consumer 的 0 diagnostics 及 **39** 个有序 negative diagnostic tuples／完整 messages，与新 B consumer 通道分开。固定版本结构工具使用 TypeScript 7.0.2 公共 `typescript/unstable/sync` 与 `typescript/unstable/ast` APIs。已接受源策略范围为 5 个实验模块、2 个 public values、10 个 erased types；结构 controls 不是隔离或数值证明。

普通 B suite 包含 22 个成功 parent families 和 113 个成功嵌套案例。Literal expected results 和诊断 token 在产品执行前根据规格独立编写。见证覆盖 component-offset sparse deform、已知／未知空目标 map、祖先先于子引用并先于最少帧数、未激活附件、较晚动画错误、原 CRLF／astral／escaped-pointer 位置、省略／缺省与存在 time 的差别、Float32 时间合并，以及分别可达的数量／展开预算边界。防御性的 128 timeline guard 不作为普通 128／129 见证；支持的结构目标最多 96 timelines。Atlas 轴上限也使 RGBA byte guard 属于防御性约束。逻辑数量不是实测内存、GPU draw 或性能。

## 新 consumer types：初始截止点与后继

已审查的 B positive／negative 源 fixtures 和严格配置已用 TypeScript **7.0.2** 单独执行。实际 positive 编译 exit **0**，**0 diagnostics**，输出流为空。无 suppress 的 negative 编译 exit **1**，保存的原始输出得到 **100 diagnostic tuples**。包括源码采用的三个记录演员均无 timeout；negative exit 1 是预期的编译器拒绝观察。

实际 100 数量来自编译器输出，不是预测 marker 数量。已保存表保留 file／line／column／code／full-message tuples，仅将精确仓库根前缀替换为 `<repo>/`，原始输出保留。**B tuple 与 intent 关系及当前类型证据的独立接受在本截止点保持 PENDING。** Fixture 源审查不能替代 actual 接受。新 100 tuple 通道不替换或追溯改写 A 的 39 tuple 历史；不能据此推断完整开发集成、全仓库 pre-push 或远端结果。

前段保留初始 **19:55** 观察截止点。之后的独立 actual 审查接受默认环境 positive **0**、negative **100** 结果，0 个未解决问题：全部五字段 tuples／完整 messages 对应各自源 intent，无 unrelated／setup diagnostics；保留 A 原四个 consumer 文件与 39 tuple 表。

首次完整开发 verifier 之后 exit **1**，此前普通测试 **160／160**，fail／cancelled／skipped／todo 均 0。它在保留 A39 的精确 message 比对处停止，没有到达 B type 阶段。执行环境把正常 pnpm 工作区 junction 命名空间表示为 `node_modules` 路径，与原 `packages` 消息身份不同。另一次正常 Windows 宿主对相同 A 输入的观察恢复了原 package-path messages；A 表、产品与契约无需修改。这是保存的环境／message 身份边界，不是引擎行为或性能结论，失败 receipt 保留为历史。

正常宿主 B 后继执行于 **2026-10-12T20:08:23.5927431Z–2026-10-12T20:08:23.9496817Z**：positive exit **0**、空输出流、**0** diagnostics；无 suppress 的 negative exit **1**、实际 **100** tuples。其 package-owner path messages 与默认环境表分开保存。**本截止点的宿主后继独立接受及新的完整开发 verifier 结果仍为 PENDING。** 不改写路径消息 oracle 使失败门禁通过，不预测未来完整门禁结果。

## 产物身份与保留的修正

源码审查接受、actual 复核匹配的四个变化源身份如下：

| 仓库相对路径 | Bytes | SHA-256 |
| --- | --- | --- |
| `knowledge-base/experiments/spine-f2/src/index.ts` | 577 | `51d992b5a6ab5f75f203b8bcd289d4af9d67b80935c2cd26b2d8031368886b2c` |
| `knowledge-base/experiments/spine-f2/src/source-plan.ts` | 22487 | `4a1e57abdaf93a42236f72bcf6fef1569fe039efff1f56378862d539a30be728` |
| `knowledge-base/experiments/spine-f2/src/profile-plan.ts` | 4718 | `70ea7129f28ee52ae6f12bcf853c94279c09aff917ec97db83562b3b8875b700` |
| `knowledge-base/experiments/spine-f2/src/profile-source.ts` | 30397 | `5f2d9ee9b4a5c9f7582643e80eea805de2507373d417b97802ed370df6248d75` |

普通 B stdout 为 **8054 bytes**、SHA-256 `46afd87b3950d252920f30843bd07d015f5f3f5cc97de28bf5a978348e6a56b8`，stderr 为空。当前 **10** 个实验 JS／声明身份是已保存的当前 readback。行为执行前没有已冻结的 post-compile 十文件清单，**compile 到 behavior 两时点的 before／after 字节等式为 NOT_ESTABLISHED**。已接受源码 pins、真实严格编译、实际 135 案例输出仍是不同证据；不把缺失的历史快照重建为事实。

首次 B 行为源码审查在执行前发现两处错误 expected locations：descriptor getter 案例应指向 `/skeleton`；省略的第二个 time 应使用 frame pointer／opening，存在 time 仍使用 `/time`。已审查后继只改两条期望行，whole-file inverse 恢复原始测试 bytes，fixture helper 完全相同。135 案例成功执行采用该后继。原 NEEDS_REPAIR 源审查保留，并非产品执行失败。B type-source 后继增加五个严格配置 flags，同时保留两个 TS fixtures，原源审查历史仍保留。旧 A 失败与 PENDING 截止点继续保存在 [A 证据](Spine网格源规划证据.md)，本新文档不静默改写它们。

## 上次交付、署名与后续工作

上次已交付 **0.42.0** 基线为 [PR #29](https://github.com/cnedwin/Egret_rebuild/pull/29)、Main `e7a82283ef02b57976e5a94e10306fc6aee516b5`、tree `319de5686631afe3213699f9fc2a4a424d7bcbdf`。其实际强制 push hook 接受 publication **63／63**、core **2748／2748**、experiment **22／22**，knowledge-base issues 为 0。这些是 **0.42.0 交付观察**，不是 0.43.0 门禁。保存的远端 status／check 清单为空、combined state pending，不宣称远端 CI PASS。当前 0.43.0 全仓库 pre-push、GitHub 交付与 remote CI 保持 **PENDING**。

规划器代码与七个保留的程序化 assets 是 Apache-2.0 下的原创 Egret 第一方素材；见仓库根 `LICENSE`、`NOTICE`。Fixtures 不是 Spine Editor 导出或 canonical Core／像素资格材料。AI 辅助参与设计、实现、测试编写与独立审查，固定规格与 literal 见证限定证据范围。[jsonc-parser](https://github.com/microsoft/node-jsonc-parser) **3.3.1**、MIT，保持现有根开发依赖家族。

源研究使用本地固定的官方 **Spine Core 4.3.13**，上游 `b7beb2ccbbce667a12c02f44d070644f59b04968`，包括 [原始 SkeletonJson 源码](https://github.com/EsotericSoftware/spine-runtimes/blob/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core/src/SkeletonJson.ts)。它是源语义参考，不是实际执行的 Core 权限；不包含上游实现或美术。已保存的 **2026-10-12** 官方 [Runtimes License](https://esotericsoftware.com/spine-runtimes-license) 与 [Editor License](https://esotericsoftware.com/spine-editor-license) 刷新记录最后更新于 **2025-04-05**，不建立 Editor entitlement、导出资格或分发权利。

受控 once-call ownership、source-view、internal-error 故障覆盖保持 **PENDING**；源码检查的调用结构不是已执行受控故障证据。Core 兼容、姿态数值、实际变形／采样、播放、resources／leases、渲染、browser／native／手机／设备／OS 行为、性能、许可及完整 Spine **R020/V020** 按各自边界保持 **OPEN 或 unverified**。S096/V047 只记录本次有限源规格增量。
