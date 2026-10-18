# 增量帧准备：验证记录与边界

[English](../../en/docs/incremental-frame-preparation-evidence.md) | 中文

2026-10-18 · 工程候选；性能验收仍未完成

## 状态与实现范围

M1.2 已实现增量捕获、有界准备缓存和相邻合批，并在下列范围完成正确性及生命周期验证。**性能验收仍为 OPEN，M1.2 里程碑尚未关闭。** 本记录描述候选 4 及已通过的本地完整门禁，不代表已合并发布或生产就绪。

实现保留公开捕获/渲染签名、帧 profile、painter 顺序、保存帧数值、当前资源资格和提交所有权。私有修订覆盖已提交的树、变换、外观、内容和绑定变化；捕获及 Host 缓存只保留有界派生结果。准入 probe 减少持续变化时的 payload 保留，但不能授予命中，完整 key 和当前资源身份仍是复用依据。Textured capture 每次仍执行全树准入，不宣称总捕获成本与变化节点数成正比。

相邻兼容 draw 可以合并；A–B–A 顺序、clip/material 变化、空屏障及 scene/overlay 分界仍保留。逻辑准入费用不退款，必要的每次提交副本保持隔离，已接受的拼接存储直到安全退役才释放费用。本包未引入纹理页或新渲染 profile。

## 源码与比较身份

参考为完整 M1.1 SDK，main 为 `fa88111f5e73503e1804f92a9f444207110b773c`。候选 4 是绑定原始字节及成功 build-4 记录的工作树 SDK 快照，并非候选提交或最终 main。其 manifest 为 181728 bytes，SHA-256 `783f84db7cfc56e56b957b8de3b080acfdc3e00ef9cce712feabc36678164c23`。快照保留源码、产物、配置、依赖与包别名；冻结字节本身不独立证明源码与编译产物等价。基线与两个 recipe 的精确身份见 (E1)。

修订、缓存和批处理是依据 Egret [增量准备契约](incremental-frame-preparation-contract.md)、[M1 计划](m1-rendering-resource-plan.md)与既有[提交所有权契约](warm-submission-contract.md)形成的第一方独立实现。完整旧 SDK 提供独立的全量重算参照；既有 robust-predicates 3.0.3 等依赖的归属与许可单独保留，Node、Playwright 属验证工具。

## 已执行的正确性与操作证据

| 证据 | 实际结果 | 结论边界 |
| --- | --- | --- |
| Regression 3 | 1560 通过；失败、取消、跳过均为零 | 选定回归集执行，不等于最终完整发布门禁 |
| Offline tool 3 | 16 通过 | 工具策略/recipe 控制；保留 offline 2 的沙箱 symlink EPERM 失败 |
| Controlled comparison 4 | 每 SDK 24 个对应帧通过 | 公开捕获值与有序上传三角形输入等价；受控端口，不证明像素或速度 |
| Native correctness 1 | 六个 trial 通过；每 SDK 994 帧、七份完整 RGBA | 声明采样点的成对像素一致 |
| Native counts 1 | 六个 trial、合计 24 帧通过 | 每状态/SDK 四帧；实际 draw 为基线 991、候选 155 |
| WebGPU 3 | 42 个 fixture 帧、84 张截图、6808 次合成检查、八个反例、零意外错误 | 本有界套件实际 PASS |
| Canvas 2 | exit 0；14 项检查，指定反例被检出，零意外错误 | 桌面无头 Canvas，不证明原生 GPU 或性能 |
| B1 5 | 候选 4 PASS；七正例/五控制；主阶段 11 次提交，合成阶段另三次 | 既有 scene 与公开 Engine 合成范围 |

原始记录见 (E2–E8)。受控比较还在小场景观察到 32 → 5 draw，在规模场景观察到 991 → 155，且有序三角形输入等价。原生计数通过真实 receiver 转发原方法并恢复包装；操作减少不能替代耗时结论，也不推定内部 batch-break 原因。

## 原生工作负载与覆盖限制

固定场景共 10000 个逻辑节点，含 Stage 和八个 clip 容器；有效可见 1000 个，产生 991 条命令及 7928 个 clip 引用。静态、确定性 1% 修改和全量修改使用相同的基线/候选输入。每 SDK 的正确性序列为一帧静态、991 帧 sparse、两帧 full，分别留存一、四、两份读回。

七组成对 RGBA 均逐字节一致。Sparse 的 0、1、99、990 四个采样点，其像素 hash 也与静态样本相同。因此该原生结果只证明已采样输出的基线/候选等价，不能证明 sparse 修改造成可见像素变化，也未逐帧检查全部 991 帧。另行读取 controlled comparison 4 原始记录并排除 frameId：static-03 → sparse-00 → 01 → 02 → 03 在每 SDK 中每步均改变十条命令的平移值，所选顶点流分别改变 99/90/125/130 bytes；对应基线/候选的流逐帧相等。按记录的 offset、stride 和 draw 范围，五帧全部所选范围均与实际上传字节一致。这证明受控三角形输入确有变化，不证明原生像素变化；单凭 capture 摘要不同仍不充分。(E3) Full 的两个样本包含不同输出。

有头比较实际使用 Edge 155.0.4283.45、Playwright/core 1.62.1、Node 26.7.0、Windows build 26300，adapter 报告 NVIDIA Blackwell 且非 fallback。CSS/backing 均为 1024 × 768，Host 显式像素比为 1；实际 window DPR 1.0000000298023224 原值保留，并依 profile 2 要求在合格配对内稳定且相等。前台/电源采样和协作式清理记录不证明连续无遮挡显示、物理显存退役或精确 adapter-driver 关联。

## 性能验收仍为 OPEN

Host CPU diagnostic 3 完成四次 ABBA trial，共 192 次提交、144 个测量样本。它只测保存帧与受控 GPU 端口上的 Host 同步提交，排除修改、捕获和完成等待。Full 中位数为基线 19.36755/18.69425 ms、候选 21.26035/21.44570 ms；对应短样本 p95 为 20.3324/20.0924 与 23.1985/23.0525 ms。每状态/trial 仅 12 个测量样本，p95 即最大值；JIT、调度、保存帧 GC 与受控端口成本均限制解释。这是方向诊断，不构成正式验收或 10% 容差判定。(E9)

Recipe schema 3 的 native diagnostic 1 与 schema 4 的 diagnostic 2，都在首个 baseline static 预热中因 WEBGPU_BACKPRESSURE 停止。两次均为 INCOMPLETE、**零测量样本**，没有完成配对。Schema 3 接受预热帧 1–3，第四次尝试被拒绝。Schema 4 接受初始化帧 1–2 并完成退役，随后接受预热帧 3–4；第三次预热尝试被拒绝，当时有两次 pending 提交。清理完成且 pending 为零。这些结果不能归因于候选改动，也不能证明冷启动是唯一原因。(E10)

[W3C WebGPU 规范 Promise Ordering](https://www.w3.org/TR/2026/CRD-webgpu-20260915/) 只保证其中明确列出的 promise 顺序。因此，requestAnimationFrame 回调不能证明先前 queue/error-scope 义务已结算；本次实际延迟的具体原因仍未知。

正式的每状态五对、每 trial 预热 30 秒/测量 60 秒比较尚未完成。包含更新工作的 full-dirty p95 容差、CPU/帧目标及 GPU 时间没有获得 PASS，GPU 时间仍为 UNMEASURED。功能交付必须保留这些未决验收；首次完整核心测试为 3964 项，其中 3916 通过、48 失败，取消和跳过均为零。失败涉及旧源码准入、保留的 Host 身份断言和序列动画编译器输入；经审查的后继记录随后通过 220 项针对性检查；本地完整 prepush 又通过 241 项发布工具测试、4005 项核心测试及 160 项 Spine F2 实验测试，失败、取消和跳过均为零，并通过构建、源码/类型边界、示例与知识库检查。(E11) 原失败记录保留。最终独立评审及 PR/main/CI 交付状态另以最终记录确认。M1.3–M1.5、完整 Spine 和其他设备验收仍属后续范围。

## 记录身份

下列原始字节指纹对应本文所述的本地执行记录。本阅读版不包含机器路径、进程细节及未整理日志。公开验证工具和契约说明了如何复现新的结果；指纹本身不证明执行或性能。Recipe schema 3、4 及其各自绑定的工具源码分别保留。

| ID | 记录 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| E1 | Candidate SDK manifest | 181728 | `783f84db7cfc56e56b957b8de3b080acfdc3e00ef9cce712feabc36678164c23` |
| E1 | Merged baseline SDK manifest | 215851 | `12cbb6aff4b01b937c4153063a0c3c65ed0de5acb78c83fd3632c9873bdaf3ff` |
| E1 | Recipe 1 (schema 3) | 11334 | `d9e385d6474a9806e7a1986463d21f04e9196164509e32fdff778ca235ac750c` |
| E1 | Recipe 2 (schema 4) | 11392 | `bad24cc71da648fb4035ccc0e498930d21a39afc598b5a0eea206c74357072a0` |
| E2 | Selected regression 3 | 176174 | `63e03b690b00528aca825f3c86c6225fd09feeeb51cc82a0c14c2d1c2c3c6d5c` |
| E2 | Tool units 3 | 1550 | `799670f79b42d8a0d2b078c475e97f5ea89446fedcc035eae7b10b74c8cf57a1` |
| E3 | Controlled comparison 4 | 18923 | `b6b6079a6504123497525941893bf9115bc9cde4e5e23f0c3a2628f4f48949cf` |
| E4 | Native correctness 1 | 10406 | `06f1b7cacc40af37aced8c9d05d3567c79a42942793d6f54d96b1e55fb22b92e` |
| E5 | Native operation counts 1 | 9473 | `4b287a0f4a8e6d1499a9ebd25f90af89fd9aeb20123fb9bcbfe3692a925a244f` |
| E6 | WebGPU 3 | 2362633 | `02e11514ad841cfc5a07d9e911a7ef028ad450e4cf1b1ee8c8e68a9892855748` |
| E7 | Canvas 2 | 3224 | `0cf4bdf090d4f1807d0f19a68d2e4caeb7572703aeade2ce75fde3fa6e8327e0` |
| E8 | B1 5 | 632174 | `83ae4902af8e70682ef8d6c6092ff56e69fd33b0b8691c7706592e134672413d` |
| E9 | Controlled Host CPU diagnostic 3 | 108280 | `d8132221f08e22e37548213d5d3d8be1b7d4e34a912dbf31ef4de8eb9c123d08` |
| E10 | Native diagnostic 1 | 2858 | `f3db70e08cdb29c940b5febd30627cac722dd2686a52473acb080f1af6a88072` |
| E10 | Native diagnostic 2 | 2858 | `d5a17d82df793fc98b5d36171da10d4a97766a3f646adc9dd518658e6846c250` |
| E11 | Complete integrated prepush 2 | 920792 | `c191130451cb7e29d644333e4e8985ef9569e304a0ab8c3b113cdb7b3cd25417` |
