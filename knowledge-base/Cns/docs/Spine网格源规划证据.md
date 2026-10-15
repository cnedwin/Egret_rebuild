# Spine 网格源规划：F2-A 证据

工程预览候选 **0.42.0** · 规格 **S095** · 验证 **V046**。证据截止：**2026-10-12 UTC**。[English](../../en/docs/spine-mesh-source-plan-evidence.md) · [共享验证数据](../../evidence/spine-mesh-source-plan-verification.json)。

F2-A 增加了需主动启用的开发实验 `knowledge-base/experiments/spine-f2`。同步函数 `createF2MeshSourcePlan` 接收公共 `SpineImportInput`，拥有冻结的输入快照，保留公共 SP1 的首次拒绝，随后检查原始独立非加权网格数组和保守的静态 setup 计数。结果为不可变的源摘要与原文位置。它没有增加默认 SDK 导出、默认 API 或 npm 包。另行评审的根开发依赖为 jsonc-parser 3.3.1；SDK 各包的依赖保持不变。

## 已接受的实际观察

独立源码评审接受了产品与类型 fixtures。独立实际评审接受了下列已保存的安装、编译、入口、类型和 CPU 观察，均为 **0 项未解决问题**。私有原始日志继续保留；共享 JSON 公开必要结果、证据产物身份及仓库相对源文件身份。

| 观察 | 实际结果 | 边界 |
| --- | --- | --- |
| 标准依赖准备 | 首次源码采用退出 0；首次安装因 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 退出 1。单独的安装重试及安装资格检查退出 0。 | 重试保留 `--offline --frozen-lockfile --ignore-scripts`，增加 `--config.confirmModulesPurge=false`。正常安装拥有根 jsonc-parser 3.3.1 和四个工作区链接；没有手工创建 namespace alias。 |
| 独立编译与入口 | 严格编译退出 0，输出流为空；构建后 namespace 检查退出 0，并公开 `createF2MeshSourcePlan`。 | TypeScript 7.0.2，独立严格 NodeNext/ES2022 配置；没有扩展默认 SDK 入口。 |
| 普通 CPU 行为 | 16 项测试 / 16 项通过：原有 14 项加 2 项字段完整形状优先级测试；fail/cancelled/skipped/todo 均为 0。 | 实际源规划行为，具有真实的公共 SP1 前置条件。 |
| 严格类型正例 | 编译器退出 0；0 条诊断，输出流为空。 | 消费者类型 fixture 使用 `strict:true`、`skipLibCheck:false`、`noEmit:true`。 |
| 未抑制的类型负例 | 编译器退出 1；39 条实际诊断元组对应 39 个源码意图标记，缺失或无关诊断均为 0。 | 精确文件/行/列/code/完整 message 关系包含 3 条多行消息。公开预期表只把精确仓库根前缀替换为 `<repo>/`；私有原始输出保留。 |

已接受的 CPU 见证在任何 Uint16 缩窄之前，针对原始六顶点 fixture 检查索引 token `65536`、`0.5`、`-1`、`6`。它们还覆盖所有 skins、数字形键的源次序、冻结的 owned 结果，以及含 CRLF、astral 字符和转义 pointer 段的原始 UTF-16 token 位置。每份网格先完成 vertices 的数组/最小长度/偶数长度形状，再完成 UV 的数组/等长形状，随后完成 triangles 的数组/triplet 形状；之后才检查预算和数值。坐标须为有限 primitive number，UV 须有限且处于 [0, 1]，索引须为原始顶点范围内的安全整数。这些观察没有建立动画几何或 Core 兼容资格。

单网格准入上限为 **4096 顶点 / 12288 索引**。静态 setup 上限为 **32 个附件引用 / 4096 顶点 / 12288 索引**。静态引用是保守的逻辑计数，不是 Core command、batch 或 GPU draw 计数。已接受的回读中，全部 **314** 份已保存基线 SDK 构建产物身份与实体文件一致。当前实验构建产物身份仅作为来源记录：没有宣称未保存的前后构建产物 hash 相等。

## 保留的失败与修正

首次行为尝试退出 1，结果为 **14 项测试 / 13 项通过 / 1 项失败**。F2A07 的 fixture helper 在构造或调用该项指定变异输入之前，拒绝了不唯一的 literal selector。经评审的后继只修改了五行测试源码，使用完整上下文 selector，同时保留预定变异文本的字节、原始 offset、诊断 code、pointer、token 和 oracle。严格唯一性及 inverse 检查继续保留。单独的实际后继建立了 16/16 结果；失败回执和原测试身份仍作为历史保留。

首次类型 manifest 漏掉了三个已存在的源码意图标记：`success-has-no-stage`、`refusal-has-no-value`、`sp1-diagnostics-not-f2-tuple`。经评审的源码后继修正了该元数据，四份类型源码均保持原字节。39 条诊断元组来自真实准备完成后的编译器输出，没有从标记清单预先预测。首次安装失败与编译及引擎行为分别记录。

## 来源与先前交付基线

七份 literal 资产是为 Egret 编写的 Apache-2.0 测试材料。其 JSON、atlas、RGBA 和候选 oracle 文件均为第一方测试材料，没有作为 Spine Editor 导出物、canonical Core 或像素验收依据。AI 参与了设计、实现、测试编写和评审；契约评审、独立 literal 见证与明确归属的依赖共同定义证据边界。

[公共 SP1 契约](../../en/docs/spine-import-plan-contract.md) 提供既有规划边界。[Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 提供公共语法基础；已安装的 3.3.1 版本声明 MIT。适用的 [Spine Runtimes](https://esotericsoftware.com/spine-runtimes-license) 与 [Spine Editor](https://esotericsoftware.com/spine-editor-license) 条款仍独立适用。2026-10-12 的来源刷新记录了这些官方页面的最后更新时间为 2025-04-05；它没有验证 Editor 权益，也没有授予分发权利。

先前已交付基线为 **0.41.0**、[PR #28](https://github.com/cnedwin/Egret_rebuild/pull/28)、Main `758e516410a126483973a1d65eea0c6ca7f57ef6`、tree `ef0183ba3f555df5fd7a53cb98a677cd01f67356`。其实际 mandatory push hook 通过公开检查 **63/63**、核心检查 **2748/2748**。这些属于先前版本的观察，不是 0.42.0 的门禁。截止该时点，远端 status/check 记录为空且为 pending；这不构成远端 CI PASS。原先的待验证截止状态继续保留。

## 该证据截止点的未完成事项

0.42.0 的工具 policy 实际执行、开发 verifier 的重新编译/集成、全仓库 pre-push 检查及 GitHub 交付均为 **PENDING**。`F2_SOURCE_VIEW` 与 `F2_INTERNAL_ERROR` 两项受控故障见证也为 **PENDING**。完整 profile 语义、deform/动画、资源身份、Core 兼容、渲染、许可权益、实体手机/native 行为及完整 Spine **R020/V020** 仍为 **OPEN**。这项有限源规划结果不会升级它们的验收标志。

## 开发入口后继 — 2026-10-12，17:35 UTC

前文观察及待验证陈述保留原截止时间 **2026-10-12T17:21:06.5985450Z**。单独完成的开发入口从 **2026-10-12T17:35:11.3839958Z** 运行至 **2026-10-12T17:35:13.2950779Z**，退出 **0**，独立实际评审接受且有 **0 项未解决问题**。重新进行的严格独立编译与构建入口导入先于四份普通测试文件中的 **22 项测试 / 22 项通过** 完成：其中有 **16** 项既有行为测试、**1** 项源码边界基线和 **5** 项指定源码边界控制。fail/cancelled/skipped/todo 均为 **0**。这些有限实验测试与仓库核心测试分别计数；没有宣称新的全量核心结果。

已完成的入口实际使用 TypeScript **7.0.2** 公共开发 API `typescript/unstable/sync` 和 `typescript/unstable/ast`。有限源码边界检查验证了既有公共 SP1 路径、Core 路径拒绝、配置、入口表面及缩窄控制。这属于开发工具的结构性证据，没有建立通用安全性或数值正确性保证。严格类型正例编译报告 **0 条诊断**；未抑制的负例编译器退出 **1**，全部 **39** 条有序文件/行/列/code/完整 message 元组与既有实际预期表一致。精确仓库前缀归一化及多行消息保留规则没有变化。

开发入口检查点的根 `package.json` 为 **762 字节**，SHA-256 `b522c278e5f0b4070fec73da2aa336da5c57a4dc189c0855d9e5770f879009bd`；经评审的修改增加了开发验证 script。另行评审的 `tools/verify.mjs` 修改在既有验证阶段之后加入该入口。**691 字节**的根文件身份只在原截止时点有效。依赖版本与 lockfile 保持不变。共享 JSON 区分原有 **21 文件**源码范围和当前 **15 文件**开发评审范围；新增准入的源码边界测试不会追加入原测试清单。

对于本次开发执行，重新编译之前保存的 **6** 份实验构建产物与之后的 **6** 份产物，其字节数及 SHA-256 均相同。全部 **314** 份已保存 SDK 构建产物身份也继续一致。这次新观察到的等式没有补造较早行为后继缺失的快照。有限源码边界控制与这次开发入口在新截止时点已经接受；原待验证字段继续作为历史保留。全量 **0.42.0** pre-push 检查、GitHub 交付及远端 CI 仍为 **PENDING**。两项故障控制及原先开放的 profile、deform、资源、Core、渲染、许可、手机/native 和 **R020/V020** 边界保持原状态。

<!-- F2-A-ACTUAL-DELIVERY-0.42.0-BEGIN -->
## Recorded 0.42.0 delivery — Spine F2-A / 已记录的 0.42.0 交付 — Spine F2-A

0.42.0 已经由 [PR #29](https://github.com/cnedwin/Egret_rebuild/pull/29) 合并；Main `e7a82283ef02b57976e5a94e10306fc6aee516b5` 与 tree `319de5686631afe3213699f9fc2a4a424d7bcbdf` 已回读。其必要推送 hook 通过 63 项 publication、2748 项 core 与 22 项实验检查，分别计数。远程 status/check-run 均为 0，不构成远端 CI PASS。较早 Pending 截止点继续保留。
<!-- F2-A-ACTUAL-DELIVERY-0.42.0-END -->
