# 增量帧准备：验证记录与边界

[English](../../en/docs/incremental-frame-preparation-evidence.md) | 中文

2026-10-21 · 功能已交付；正式性能仍为 OPEN

## 当前验证记录截止点 — 2026-10-21

M1.2 功能与 M1.5 已分别通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 和 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付。最新候选累计改动七个既有渲染/Host 源文件，按第二份 schema 6 准备结果冻结；预检、正确性和操作计数已通过最终原始结果独立复核。诊断因环境资格失败而停止，正式计时未启动。**M1.2 正式性能仍为 OPEN。** 下文原 schema 5 完整 `FAIL_TIMING_TARGET` 及此前 schema 6 观察保持不变。

### 最新冻结候选：功能检查与环境限制

验证截止点：2026-10-20T19:59:54.746Z（本地日期 2026-10-21）。新配方在此前有界准备改动基础上，包含准入复用、角点临时数组移除及逐边裁剪改动。

| 阶段 | 实际结果 | 范围 |
| --- | --- | --- |
| 预检 | PASS；2 次 trial | 两侧冻结 SDK，按固定顺序执行 |
| 正确性 | PASS；6 次 trial | 7 组成对采样点／14 份 RGBA 读回 |
| 操作计数 | PASS；6 次 trial／24 帧 | 每帧基线 991 次 draw，候选 155 次 |
| 诊断 | INCOMPLETE；static 基线通过、候选不合格 | 系统前台资格失败，无合格配对 |
| 正式计时 | NOT STARTED | 本配方全部 30 次 trial 尚未执行 |

最终独立复核按物理路径去重，核验每份已记录产物及枚举输入。预检/正确性的全部九组 RGBA 配对逐字节一致，二十四帧操作轨迹已重新计数。记录显示 Host 安全关闭、pending 为零，浏览器/上下文/服务器协作关闭。这些是有限功能与计数结果；操作系统子进程退役及物理 GPU/内存释放仍未证明。

该配方的首次尝试已在任何帧或读回之前因 `OBSERVER_FIRST_FOREGROUND` 停止。独立恢复运行随后通过预检、正确性及计数，再于 static 候选诊断因 `OS_FOREGROUND_QUALIFICATION` 停止。原始观察在 elapsed 73636.4883 至 90770.2322 ms 之间记录十五次非浏览器前台采样。原生工作和清理完成，不能据此认定计时样本合格；不从被污染数据推导预算通过或提速。Sparse/full 诊断及正式计时均未执行。两次原始失败、中间通过的阶段及原始记录完整保留。

### 首份 schema 6 实际观察

| 阶段 | 实际记录结果 | 边界 |
| --- | --- | --- |
| 预检 | PASS；2 次 trial | 仅本次冻结 SDK/浏览器组合 |
| 正确性 | PASS；6 次 trial、7 组匹配／14 份 RGBA 读回 | 声明的采样点，不代表逐帧覆盖 |
| 操作计数 | PASS；6 次 trial、24 帧，每帧 draw 由 991 降至 155 | 绘制次数减少，不构成耗时验收 |
| 诊断 | PASS_DIAGNOSTIC；6 次 trial，每状态一对 | 诊断执行完整，不是五对正式计时 |

候选诊断的 p95 值（毫秒，已舍入）为：static 的 Host 5.0／update-through-render 7.9／capture 3.6；sparse 为 6.2／9.7／4.1；full 为 11.2／15.3／3.4。这些是单次诊断结果，不是五次中位数，各区间的分位数不能相加。诊断 Host 值大于 4 ms 不能证明独立准备阶段失败；独立准备耗时和 GPU 时间仍未测量。结果绑定后续准入/角点改动之前的冻结配方，不能转移到变更后的源码。

### 后续源码改动与私有 CPU 诊断

准入改动已通过独立源码与结果评审：原聚焦运行保留 69 项通过和 4 项预期读取计数失败；集成后构建成功，六个既有套件的 249 项测试全部通过。角点生成重构在原实现上保留 10 项行为刻画通过，构建成功后，五个既有套件的 133 项测试通过。这些是受控 CPU 结果，不证明原生像素或性能验收。

三次独立的仅优化路径 Node 采样各保留 212 次调用、208 次完整相等检查和零错误。三份保存的完整输出/预算具有相同的完整二进制身份，前两次另有独立结果复核。前两次采样中，corners 的包含子调用归属时间分别为 323.000 ms 和 100.415 ms，每次汇集 160 次优化调用。这是独立 profiler 观察，不是成对性能试验或逐帧分位数。所有结果保留用于比较，会改变内存寿命及 GC；包含子调用的栈时间存在重叠。这些数据不能分摊浏览器 Host 耗时，也不能证明原生实测提速。

逐边包含裁剪已沿用既有可信准备边界完成集成并独立评审。原聚焦运行保留 58 项通过和 14 项预期失败；构建成功后，聚焦运行的 177 项全部通过，输入稳定。第三次私有 CPU 采样在该改动后执行。聚焦结果和采样均不能证明原生像素或正式计时通过。[契约](incremental-frame-preparation-contract.md)保留全部原费用与回退边界。

## 已完成的 schema 5 记录截止点 — 2026-10-21

M1.2 功能工程已通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 交付，main 为 `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`。M1.5 随后通过 [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) 交付，main 为 `4924b471b52927184252191055f902c30c29af52`。**M1.2 正式性能验收仍为 OPEN。** 下列已完成检查属于新的 runs-2 序列，绑定 prepared-3 的 schema 5 配方；后文原有的 2026-10-18 结果及 E1–E11 身份完整保留，作为历史证据。

新的比较通过 schema 5 配方绑定未改动的完整 M1.1 参考和稳定的 M1.5 后候选。两侧实际在 Windows 上使用 Chrome for Testing 157.0.8103.6、Node 26.7.0 及 Playwright/core 1.62.1。准备结果分别复制 450/579 个非证据文件，其中源码为 139/182 个；每份快照另行绑定两份提供的构建证据。原始源码/产物身份及构建记录来源已核对，复制文件不等于独立重新编译。新配方及清单身份见 E12。

| Schema 5 阶段 | 本截止点的实际结果 | 结论边界 |
| --- | --- | --- |
| 预检 | PASS；两次 trial，每 SDK 一次 | 本次固定比较的执行和环境资格 |
| 正确性 | PASS；六次 trial；七组匹配的 RGBA，共十四份完整读回 | 静态、稀疏及全量更新的声明采样点，不证明逐帧像素覆盖 |
| 操作计数 | PASS；六次 trial、二十四帧；每帧基线 991 次 draw、候选 155 次 | 操作减少，不构成帧率或耗时结论 |
| Diagnostic | PASS；六次 trial 已完成，每状态一对 | 执行和环境资格通过；诊断样本与正式 timing 验收分开 |
| Timing | COMPLETE；三十次 trial；FAIL_TIMING_TARGET | 执行和环境通过；实测性能目标尚未全部满足 |

新的正确性样本在两侧逐字节一致。Sparse 的 0、1、99、990 采样点与静态输出 hash 相同；这些样本证明已采样输出的成对等价，不证明 sparse 修改造成可见变化，也不覆盖全部 sparse 帧。Full 的 0、1 采样点包含不同输出 hash。新的操作计数在 static、sparse、full 三个状态均保持 991/155。这些结果不能证明耗时收益。

该已完成的 schema 5 批次通过 `egret.m1-2-capacity-paced/1` 使用容量节拍：只有 pending 少于两帧的回调才推进负载，保留全部回调及完整首部/内部/末尾墙钟间隔。提交、等待和结束回调的 CPU 样本组分开统计；保留原有按帧计数的 RAF 节奏，同时记录按时长加权的墙钟间隔 p95/p99，分别采用 16.7/33.4 ms。测量覆盖方式的调整不改变渲染 API 或既有 CPU/原生预算。

先执行六次 diagnostic，再执行三十次 timing：三个状态各五对 timing，每次预热 30 秒、测量 60 秒。一般计时预算未达标或比较不可用仍保留在固定序列中，执行、完整性、环境、原生、期限或清理失败则停止。保留每次结果与五次中位数，不选择更快基线，也不丢弃未达标样本。

该已完成的 schema 5 批次仅允许通过包含准备工作的 timing Engine 区间判定 4 ms 上界：某角色/状态的五次 Engine p95 中位数 ≤ 4 ms 时，上界成立；更大或缺失不能证明准备阶段失败。独立准备耗时及实际 GPU 时间仍未测量。功能检查、C7 时长和绘制次数减少不能替代成对计时。Diagnostic 和 timing 已完整执行。实测目标尚未全部满足，实际 timing 汇总结果见下文；最终独立结果评审已完成，结果完整性问题为零；性能目标未通过的结论保持不变。

## 已完成的 schema 5 计时：目标未通过

Runs-2 的 timing 序列按未改动的 prepared-3 配方完成全部三十次计划 trial。结果为 `FAIL_TIMING_TARGET`，执行及环境资格均报告 PASS。这是已完整完成、但目标未通过的测量，不是执行中断。每个角色/状态均按规定保留五次 trial，并计算五次中位数；不能用个别通过 trial 代替汇总结果。源码与结果的独立对应评审已完成，结果完整性问题为零。评审重算全部 72 个预热/测量容量窗口及五次中位数，保留每项实际未达标结果。

下表为各 trial 的 p95/p99 经五次中位数聚合后的结果，单位为毫秒。为便于阅读显示四位小数，验收使用未舍入的原始记录。

| 状态 / SDK | Engine p95 | RAF p95 / p99 | 墙钟间隔 p95 / p99 |
| --- | ---: | ---: | ---: |
| static / baseline | 20.2000 | 25.1000 / 37.5000 | 25.1000 / 46.9000 |
| static / candidate | 8.1000 | 12.6000 / 12.6000 | 11.6000 / 13.6000 |
| sparse / baseline | 19.7000 | 25.1000 / 37.3000 | 25.1000 / 44.3000 |
| sparse / candidate | 9.6000 | 16.6000 / 16.7000 | 13.2000 / 16.0000 |
| full / baseline | 19.7000 | 25.1000 / 37.5000 | 25.4000 / 47.6000 |
| full / candidate | 21.4000 | 29.2000 / 33.3000 | 25.4000 / 44.5000 |

候选 static、sparse、full 的 Engine p95 中位数分别为 8.100000023841858、9.599999964237213、21.400000035762787 ms，均超过 8 ms 目标。候选 static 与 sparse 的两种节奏指标均通过；full 两项均未通过：按帧计数的 RAF p95 超过 16.7 ms，按时长加权的墙钟间隔 p95/p99 超过 16.7/33.4 ms。基线在三个状态的 Engine 及两项节奏目标均未通过。

Full-dirty 的 update-through-render p95 中位数为基线 20.30000001192093 ms、候选 22.399999976158142 ms，记录比值为 **1.1034482740396065**，超过 **1.10** 上限。各角色/状态的包含区间均未建立 4 ms 准备耗时上界（`null`）；这不等于独立准备阶段的直接测量或失败判定。独立准备耗时和 GPU 时间仍为 UNMEASURED，整体 D60 仍为 INCOMPLETE，因此 M1.2 工程验收保持 OPEN。

后续包含裁剪候选不在本批冻结输入中。它的针对性检查单独记于下文，不能归入本次三十 trial 比较；原始结果和固定预算保持不变。

## 包含裁剪候选：针对性检查

后续候选集成了五个已审源码文件的改动，并在一个既有测试文件中补充用例。原始针对性运行共 44 项测试，34 项通过、10 项失败。集成后记录的构建退出码为 0；随后执行八个既有测试文件，228 项全部通过，失败、取消和跳过均为零，观察到的输入稳定。这些执行记录保留于 E14。

这些检查与上文已完成的 prepared-3 / runs-2 测量分开。在本次后续记录截止点，本文尚无该候选的新原生浏览器或计时完成结果。针对性测试通过不能证明光栅结果等价、准备耗时改善或性能验收通过；这些结论需要绑定变更后候选的新证据。

## 保留的首次 schema 5 诊断与采集器修正

首次 schema 5 序列完成 baseline static 诊断后，在 candidate static 因 `SAMPLE_INVALID` 停止。该候选记录仍为 INCOMPLETE：保留 117 个已接受样本、187 个 callback，没有完整测量窗口的结束点。失败发生在 render 返回之后、下一个 sample 写入之前；没有事后补写样本或将窗口改为完成。

独立评审将拒绝原因定位为未获支持的跨 API 排序假设：单独采样的 `performance.now()` 值比该回调的 RAF 时间戳小约 0.1 ms，但 CPU 阶段序列和 RAF 自身序列均保持有序。修正将三处跨 API 大小比较改为非负检查，保留各序列内部顺序、原始数值、callback/sample 绑定、容量边界及全部验收预算。这是采集器修正，不构成渲染器失败或浏览器采用不同时间原点的证据。协作式清理已完成，未记录清理失败；聚合错误标签不能用来认定发生了清理失败。

三个新增回归用例首先得到 38/41。首次修正运行得到 40/41，原因是测试将实际二进制浮点差 `32.000000000000014` 误写为精确的 `32`；改为比较原始减法后，实际结果为 41/41、exit 0。上述记录和原失败诊断均保留于 E13。修正工具绑定新的 prepared-3 配方，新的 runs-2 diagnostic 已完成六次 trial。诊断完成和工具测试不能替代三十次 timing 的性能目标。

## 原始状态与实现范围 — 2026-10-18

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

## Schema 5 当前记录身份 — E12

E12 对应 prepared-3 / runs-2 的完整实际记录，包括目标未通过的 timing 结果。E13 保留较早的不完整诊断及实际修正检查，均不替换原 E1–E11 记录。

| ID | 记录 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| E12 | Schema-5 recipe (prepared-3) | 12051 | `ee4af29e5f66f997b23a042612e78e6e500a3a1a4ae8f37a5ee5cef60eecf863` |
| E12 | Prepared baseline SDK manifest | 182814 | `5089695dd016371c903d1f719bb2d0ec3d8dcca4bc59e0269e2dd50cca7af32a` |
| E12 | Prepared candidate SDK manifest | 223550 | `684523c1125c8b41a3036bb692f3d4c615487a96d9ab292071e0fb076c68abf0` |
| E12 | Schema-5 runs-2 preflight summary | 2775 | `5183bad52de07f6bb5e8ea7a36de36bd93a81d231c05d8f111781d2fe1e165ae` |
| E12 | Schema-5 runs-2 correctness summary | 5645 | `6603554e31de96d00bce6cce06d1faeb5a013e2a42bc664fabea47131291df6b` |
| E12 | Schema-5 runs-2 counts summary | 4743 | `191bfa281de566ea25cdfb48ccb2cdea78516ea5a882e9d1fdc5df9e79348991` |
| E12 | Schema-5 runs-2 diagnostic summary | 16403 | `f5a361c5345cd7e92aad74dbed04f2cd64360fbe6176cc28b89d22c6aca76adc` |
| E12 | Schema-5 runs-2 timing summary (FAIL_TIMING_TARGET) | 73218 | `de886f24a196fb7d1d1b2c0b99b6d4f4b5004c00c9ba89ac987b4e330a2dd5fe` |
| E12 | Independent final result review (valid complete results; targets failed) | 146712 | `72ab73497c913549acfffbbf3eca8569fe0b3bdd5372d6bd9cfc6a42eef147a2` |

## 保留的诊断修正记录 — E13

| ID | 记录 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| E13 | First schema-5 diagnostic comparison (INCOMPLETE) | 89768 | `3549fc31667b3f7f702af14a8261f01a10b69b2688c139c80f996be9da89c77c` |
| E13 | First schema-5 candidate diagnostic report (SAMPLE_INVALID) | 74735 | `c1044b9134116a9c3ebd9b12f2c3f4c62124b04c63d6cb3e4f8bfd124f6e2b0f` |
| E13 | Independent clock-observation diagnosis and correction review | 21824 | `24fc7cf8e8b00c762d547b5a53d0806ca310adc1a19c5def21b20b586629f385` |
| E13 | m12-clock-red-1 (38/41) | 2018 | `002b6a742d3598743697e14e8a44ababb915d8d911abf12ae8c2594ad2be369a` |
| E13 | m12-clock-green-1 (40/41) | 2026 | `ae15d99212da819e4f43b40bbea91ca7564e41e4dbd2069ecb7a1d241840a6fa` |
| E13 | m12-clock-green-2 (41/41) | 2026 | `1eb8ab7a2e283eb5a063b5e20b7ab6f71bf65c22a1ce66112761fd8b6270673e` |

## 独立候选检查记录 — E14

| ID | 记录 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| E14 | Contained-clipping independent source review | 10217 | `9cbbfb5141cf9fc780964a6c2194a5cf77ad3f7695e8e4e84095a41ea224591f` |
| E14 | Original focused tests: 34 passed / 10 failed | 2036 | `4954bd9e3950fe2ef8245b59478650381da48b02679715fab5a0d2a515fe2731` |
| E14 | Candidate build log | 44 | `166710cb105690b244b48c5dcc5672a4c0bc8280e995ae7d2f5bd46141491cea` |
| E14 | Candidate build exit | 2 | `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` |
| E14 | Eight test-file run: 228 passed | 2372 | `c7bb8a08f94ca5093ab0a0d90ecbae0ab9d8debcc8bbbe0d09ea566f657fc33f` |

## 后续观察记录身份 — E15

| 记录 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Schema 6 预检汇总 | 2775 | `5fee0dafceea734f8b3ec2af1ab297782b20ce8f179b707ce00b6d986b1acc69` |
| Schema 6 正确性汇总 | 5645 | `de93de254af99d3acbf56b4184bae5dd077ceeb8aeddbbe9fc96246c4ae9d100` |
| Schema 6 操作计数汇总 | 4743 | `7e958ac32619b7781aff7f520f398294cdf90c9e6bc2a985fd3ad340cbcc02be` |
| Schema 6 诊断汇总 | 16414 | `79caa2ef006f6b4b66a423143b5a1ec4bf55fbc35291c5a375345c53795e214c` |
| 准入源码/结果评审 | 15768 | `b8f5eb1dd53a29a7b50ffa445b4bb2bccaa9991086d13a4523c377de400b73dc` |
| 角点源码/结果评审 | 9279 | `a338269013548180a868df948118283bc03f60a56714cd2927ccde9dff27a99c` |
| 第二次仅优化路径 CPU 采样评审 | 3668 | `42729f4a7b80b5dad9575eb6afc0cfc31a46d1a6d6d40cfe83bcf53db6d27b77` |
| 逐边裁剪源码/结果评审 | 18902 | `22751d22084d00a95124428ad35be5c32f8f28c0da6145ccded8953152e6ce10` |
| 第三次仅优化路径 CPU 采样记录 | 114267 | `d3f37a2f385a50ebde3c40c2cef95826c20bfc43db009626cb50549e9d8235f3` |

## 最新冻结候选记录身份 — E16

| 记录 | 字节数 | SHA-256 |
| --- | ---: | --- |
| 恢复预检汇总 | 2775 | `722da558ad81f8c83f21959e4a5f7c31e32e04652ab9e937edb2310d4214befa` |
| 恢复正确性汇总 | 5645 | `ed7cb09f682fd8da5a078501ff2762eac57d50f5c0c311b62cab06db8d206562` |
| 恢复操作计数汇总 | 4743 | `0907312410a7a18f811afc0e7ccd029476b3a804db634812603bd8c700a96012` |
| 中断诊断汇总 | 4245 | `aa4a39e9d06d67ca03956d2b74cae550dae9e390a786fce10b0f0c7052946f83` |
| 最终原始结果独立复核 | 51600 | `7431f487672e1364a6e8aaaf0e384f0f13e83a60d6fc2d8de40c4cddd4828a7b` |
| 保留的首次前台拒绝汇总 | 1859 | `f6f9b469bd32553c67e0186fee261008c82a92ff423b2f14db155b169a0f4077` |

## E17 — 受影响桌面回归，2026-10-21

最终七个既有源文件的实现已在 Windows、Node 26.7.0、Edge 155.0.4283.62 上通过六套既有收集器验证，保留原场景、像素目标、指定反例及清理要求。这些属于功能回归；E16 的 schema-6 计时中断及历史 schema-5 未达标结果保持原记录。

| 收集器 | 已验证范围 | 原结果身份（字节 / SHA-256） |
|---|---|---|
| 普通 WebGPU | 固定像素、合成矩阵及指定反例 | 2611216 / 7dee3c38e8720b5ca81c85a5d7a2d70144ed06ca90bfd9be6a82faa11ac21c5e |
| B1 场景合成 | 7 个正常帧、5 个反例、11 个提交帧 | 835040 / 1c98c7be104d0596a7a16a86a12a6aac9d77662c1691f9d35ed4ad376e0a781d |
| 共享 WebGPU | 63 个上下文中的 30 个场景和 11 组反例与恢复检查 | 2358374 / fa239bad565ceb07bd66f2ddd92ea56011bafcc828a48321b935826f814db81b |
| 共享 WebGL2 | 63 个上下文中的 30 个场景和 11 组反例与恢复检查 | 2030649 / 97453cde77810eb490a6b65f2839c6af56e5b507060b64d7715c962899d19a3f |
| 纹理 WebGPU | 11 个校准场景、10 个留出场景、12 个有效敏感性反例 | 3627670 / 445032f28148480d6e288961135e1612197c757fe9c4aebf24c74c5f9c43a4f9 |
| 纹理场景合成 | 两帧、24 个零容差采样点及原敏感性反例 | 188550 / 1d8d748fc1e980022c9521475984354e439371a4290c5a86bf85135e1580f9bd |

B1 与共享 WebGPU 收集器首先在浏览器创建前拒绝了旧 M1.5 Host 身份，纹理准备阶段首先拒绝了已过期的 C06 源码定位；这些执行仍保留。经评审的当前后继记录保留历史身份与原错误注入作用。修正后的既有工具回归通过 58/58，既有维护回归通过 86/86，未将收集器拒绝改记为像素通过。

本检查点记录收集器的实际完成结果，独立结果评审以及完整本地、受保护合并门禁在交付前分别追踪。这些桌面功能结果不证明 M1.2 耗时目标、手机支持、持续恢复或独立的操作系统进程退休；M1.2 性能验收继续 OPEN。

早期完整本地运行还拒绝了既有检查器及隔离夹具中过期的依赖声明，以及 B1 静态检查中尚未登记的一条精确除法表达式。这些失败执行记录继续保留。声明已修正，产品源码、解析规则、控制目标和配额未变；随后四项选定边界控制及完整十三场景 B1 加载/Host 检查通过。完整本地回归与受保护 CI 仍是分别完成的交付要求。
