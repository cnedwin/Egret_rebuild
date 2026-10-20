# 有序增量帧准备契约

[English](../../en/docs/incremental-frame-preparation-contract.md) | 简体中文

M1.2 减少重复捕获与准备工作，并合并相邻兼容的二维绘制。显示树、已提交资源绑定和既有提交所有者继续作为权威。功能工程已通过 [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74) 交付。本文规定实现与 schema 6 测量协议的边界。已完成的 schema 5 计时批次保留有效的 `FAIL_TIMING_TARGET`。最新七源文件候选在新配方下通过固定预检、正确性及操作计数检查。诊断因系统前台采样不合格而停止；原生清理完成，但未产生合格诊断配对或正式计时比较。正式性能验收仍为 OPEN。[验证记录](incremental-frame-preparation-evidence.md)保留原始记录与精确范围。

## 公开行为与不可变值

现有 Engine 捕获与渲染方法、帧 profile、Host 选项、包入口及资源所有权保持不变。普通帧保留结构化输入契约；纹理提交仍要求真实注册的帧。不增加公开缓存 token、完成钩子或准入旁路。Canvas 保留原有能力；场景渲染只在既有二维 overlay 阶段使用这项优化。

成功捕获创建新帧和新的 commands 数组，沿用原有帧 ID 规则。存在的 image、geometry 表也重新构造；普通空图像表仍可省略。安全的不可变矩阵、矩形和裁剪记录允许共享。子记录身份稳定不是 API 保证：淘汰或键不合格时可以创建等值的新记录。可变创作状态和上传数组不会成为保存帧的底层存储。

在既有重放契约内，保存帧经过后续变换、重新挂接、绑定替换、资源释放及生产者销毁后仍保留原值。每次新捕获重新验证当前资源资格，按本次首次使用顺序建立图像与几何表，并从这些表分配索引，即使矩阵或裁剪记录得到复用。Host 从提交帧解析真实 image/geometry 身份；旧命令序号或表索引不能标识跨帧资源。

## 捕获、修订与遍历

私有修订记录成功的结构、变换、外观与裁剪、内容、绑定变化。发布前的验证与调用者字段读取保持原顺序；相等比较保留带符号零。Bitmap、Mesh/NineSlice 与 TextField 已提交变化经由原权威写入点发布；尚未提交的文字请求不替换显示内容。修订计数重新起算前，先使两个 profile 的旧条目失效。

节点/profile 候选必须匹配这些修订，以及本次完整的父矩阵、透明度和有序裁剪上下文。缓存不保存父节点、子列表或子树；遍历仍按绘制顺序读取权威显示树。纹理捕获每次执行完整的全树准入，包括隐藏及被抑制的后代：节点与父边身份、生命周期、Engine 归属、创作贡献、每次出现的三角形和唯一几何存储仍需检查。该过程需要 O(nodes) 遍历，总工作量还取决于创作几何和裁剪；不承诺捕获为 O(变化节点数)。普通捕获保留自己的既有遍历和拒绝顺序。

节点/profile 连续两次替换失配且中间没有命中时，暂时只保留标量准入探针。初次冷捕获仍为第二次静态捕获提供命中；持续变化复用这份有界元数据，不反复建立 payload 存储。成功观察到稳定探针后，允许一次完整冷重建；只有完整结果通过原末尾 open 检查并发布后，后续捕获才可能命中。探针计入同一所有者额度，不保留裁剪图。修订与父数值提示不授予复用资格，包括仅裁剪变化在内，每次真正命中仍比较完整键。捕获失败、淘汰、修订重新起算与终止沿用同一路径清除探针。

可见贡献在原位置检查精确 lease、有效 Texture 权威和 TextField Scope。缓存命中不能让已释放 lease 或正在关闭的 Scope 恢复有效。几何检查、透明度抑制、输出收费与资源读取之间原有的先后差异保持不变。旧的仅矩形 collector 不使用缓存。

只有完整候选通过 collector 最后的 Engine-open 检查后才可复用；失败和部分候选会被丢弃。随后 Engine 的帧 ID、冻结和注册仍独立执行；其失败无需回滚有效且可丢弃的派生值，也不能授予帧身份。节点终止使自身条目失效，真实 Stage 终止清空所属缓存。普通路径对已销毁 Stage 的既有行为保持兼容，且不会在终止后重新开启缓存。

## 有界 CPU 保留

| 所有者 | 合计额度 | 保留范围 |
| --- | ---: | --- |
| 真实 Engine Stage，普通与纹理捕获共用 | 65,536 条目、16,777,216 logical bytes | 每节点/profile 最近的数值派生记录或标量探针，含待发布候选 |
| WebGPU Host，geometry 与 packing 共用 | 4,096 条目、16,777,216 logical bytes | 完整键、成功私有结果及阶段费用，或不持有资源的数值探针 |
| WebGPU Host，额外批次拼接 | 8,388,608 bytes | 已预留和已接受的拼接底层存储 |

条目数与字节数必须同时满足。每条缓存元数据基费为 256 bytes，捕获替换标记另计 8 bytes；保留的记录、数组和 typed payload 另有明确逻辑计费。记录为 32 bytes 加每字段 8 bytes，数组为 24 bytes 加每元素 8 bytes，typed backing 按实际 byteLength 计费。捕获探针保留 408 logical bytes，含一个矩阵的最小完整捕获条目为 616 bytes。捕获缓存在同一条目内按对象身份去重。Host 的 geometry 与 packing 各自拥有独立副本，即使源记录身份相同也分别计费；同一阶段内的别名只计一次。未变化的自有阶段沿用已测费用，不再递归扫描。Host 键保留不可变 image/geometry 身份时也计入相应数据。捕获条目不持有这些资源，也不持有 lease、Texture、Scope、帧或指回显示节点的强引用。弱节点索引不会保活离树节点；空弱索引的簿记不构成物理堆上限。

单条过大或缓存不可用时执行原计算，容量压力可以淘汰旧结果。可选缓存分配失败不新增公开拒绝；必要的快照、几何、packing 和上传副本分配失败保持原行为。Host 关闭或发生终局故障时清除准备缓存。这些逻辑额度与 GPU 驻留、提交收费、调用者保存快照和其他临时分配分别核算，不证明进程内存或垃圾回收上限。

## 准备等价与费用

Host 生命周期和重入检查、普通输入复制或纹理帧准入均先于复用。命令序号与 profile 只选择有界候选槽；是否相等仍依赖完整数值与身份键：backing 尺寸、像素比、准备配置、命令类型与属性、变换、有序裁剪、crop、透明度/颜色，以及本次 image/geometry 身份。数值采用 Object.is 语义，区分 +0 和 −0。资源以精确身份比较，不以相同像素或内容哈希替代。命中后重新绑定本次 command 与 projection-view 索引。

候选连续两次替换失配且期间没有接受命中后，停止保留几何和 packing 结果。有界数值探针复用已有数值存储，不持有 image、geometry 或阶段 payload。同一次准备调用的 geometry 与 packing 只计一次观察；只有阶段成功发布才确认观察，被更新观察取代的旧发布或失败观察不能重新启用缓存。后续稳定的数值观察只允许重新执行完整冷计算，不能直接命中；复用仍需精确的当前资源身份和完整键。数值序列长度变化会丢弃探针，并禁止该槽再次保留结果。含 N 个数值的探针费用为 256 + 80 + 24 + 8 × N logical bytes，遵守同一 Host 额度。

几何复用遵循原命令阶段。矩形 packing 以原连续矩形 run 整体缓存，保留整个 run 的表示位置转换、方向检查、收费和 payload 分配顺序；拆分不能增加可用预算。图像和 mesh packing 留在原命令位置。失败计算不缓存。

成功阶段记录自身逻辑费用。只有每个相关剩余额度都足够，命中才重放该阶段完整的 prepared-vertex、predicate 和 tuple-comparison 费用。重放是原子的：任一维度不足，直接在原位置执行原计算，不先部分扣费，由原操作决定首个拒绝及 cause。源三角形准入，以及全帧 projection、upload、pending、device、readback、serial 检查仍执行。覆盖抑制、Float32 坍缩和更少的原生 draw 不产生新的逻辑退款。

各 profile 的优先级不变。普通提交与普通场景 overlay 保留 packing 在 pending/readback 检查之前的原位置；纹理与 combined 提交保留 storage 准入在 payload packing、复制和 uniform 创建之前。必要的本次提交副本留在这些位置；缓存 typed payload 不直接交给 queue 回调。

### 有界准备热路径

仅普通 TEXTURED Host 准备在真实帧准入后、使用原始第一方账本方法（包括 tuple 准入）时，启用完全包含裁剪和同调用裁剪矩形复用。已成功规范化的多边形完全处于标准正向、轴对齐的四角裁剪矩形内部时，可省去重复相交与规范化。原 predicate 和 tuple 费用保留：矩形收取 12n predicates，图像收取 8n，网格收取 8n predicates 加 2n(n+1) tuples。局部额度与全局原子重放均须足够，否则由原计算确定首个错误。确实需要相交计算的边、不支持的裁剪、通用/直接调用、自定义或被覆盖的回调、shared/MIXED 配置和 B1 保留原计算。

同一次准备调用可按已准入的不可变 clip 身份复用成功的裁剪矩形几何，options、像素比和账本必须相同。临时上下文最多保留 64 个 clips、256 个 XY 点和 512 个数值字段，另有簿记开销；这是逻辑数量边界，不是物理堆上限。成功失配计算发布自有不可变副本和实际 predicate 费用；命中时原子重放费用，或在原位置回退，失败计算不缓存。第 65 项仍执行完整计算；可选分配失败关闭复用，不吞掉必要几何计算失败。dispatcher 在 finally 中、打包前清空上下文，不跨调用或帧保留。

同一几何/打包槽中，成功的完整键比较可通过非零自有键数值身份复用。每次访问仍读取当前 Map 条目并拒绝探针状态；槽不增加对键、条目或资源的引用。相同键发布保留身份，替换和重新启用分配新身份。清空、淘汰、重入或不同条目不能让旧槽获得复用资格；编号耗尽后的零身份始终进行完整比较。自有键和探针各增加的 8 bytes 纳入原有不变额度。这些实现边界已有源码评审和聚焦验证，不能证明原生像素或实测性能。

普通 TEXTURED Host 准入仅在自有捕获帧/options 链中，可于单次调用内复用不可变 clip 记录已成功的数值验证。最多保留 64 个 clip 引用，后续不同 clip 仍完整计算。每次出现仍在原位置检查 clip 额度并执行源回调；失败验证不记录，finally 释放全部引用。直接/默认调用及其他 profile 保留原准入行为。

角点生成采用单一实现，去除临时验证数组和坐标对数组，保留验证前的十字段完整预读、变换前的全部坐标对字段读取、逐点已检查算术和矩阵字段读取，以及 determinant/零尺寸检查的先后顺序。输出值与 predicate 费用保持原语义。这是分配方式调整，不增加数值捷径，也不保证性能收益。

逐边裁剪已集成并通过独立源码/结果评审与聚焦验证。最新冻结候选已通过有限原生正确性/计数检查，诊断环境资格与正式性能仍待完成。在既有普通 TEXTURED 选择及原始账本方法检查下，当前已规范化的多边形完全处于标准轴对齐 clip 某一边内部时，可复用该边的不变变换。按当前边的顶点数原子重放原费用：矩形为 3n predicates；图像为 2n；网格为 2n predicates 加 n(n+1)/2 tuples。局部或全局额度不足时，由原计算确定首个错误；成功结果仍须复制，网格完整 tuple 保留。通用/自定义调用、不支持的 clip 和其他 profile 保留原路径；不增加缓存或新权威。聚焦验证不代表原生或性能验收通过。

## 相邻批次与提交退役

原逻辑准入、packing 和 uniform 分配全部完成后才规划批次，并保留逻辑命令来源和绘制顺序。采样绘制只在同一提交阶段内合并相邻兼容项：pipeline/类型、本次 image view 与 crop、透明度、有序裁剪及该阶段的采样、混合和颜色解释必须一致。image 与 mesh 管线不混合。兼容的连续矩形范围可以在原 buffer 内合并，保留逐顶点颜色与透明度。

A–B–A 保持原顺序。材质或裁剪变化、空 image/mesh 贡献和 scene→overlay 边界会中断合并。不支持的状态保持原拒绝；不因此增加材质、混合 profile、纹理页或全局纹理排序。

每个逻辑单位先满足原 upload 与 device 限制，再让可选拼接遵守 device buffer 限制和剩余 scratch，只在原逻辑 draw 边界分段。容量不足或可选拼接分配/复制不可用时，提交未合并 payload。该降级不吞掉原 packing/uniform 失败或原生 GPU 错误。即使执行减少了 buffer、binding、uniform 或 draw，原逻辑费用仍完整收取。

scratch 在分配前预留，同时覆盖活动候选和已接受提交。未接受计划释放预留；已接受计划保留到既有提交退役完成。仅队列 fence 完成不能释放它。错误 scope、readback/map 义务、清理成功、混合 buffer 归还顺序、loss 和不安全关闭继续遵守 M1.1 所有权规则。清理失败保留原账本责任。缓存命中不证明 GPU buffer 中仍有旧内容，每次提交仍上传自己拥有的 payload。

## 验收边界

完整的上一版 SDK 作为相同操作序列的独立完整重算参考。实现不增加公开 debug 开关或永久的第二套渲染权威。正确性、实际原生操作减少、浏览器像素、耗时、内存观察和交付状态分别提供证据。不引入 dirty 百分比阈值，也不承诺提速比例。

M1 的静态、稀疏更新、全部变化工作负载及声明的桌面条件仍是验收目标。全部变化比较把更新工作纳入从 update 开始到 render 返回的连续时间段；五次运行各自 p95 的中位数，其 candidate/baseline 比值须满足声明的 1.10 上限。诊断 Host 耗时只能在该诊断窗口内给 preparation 提供上界；上界过大不能证明 preparation 自身超标。未测 GPU 时间、物理内存、不可用设备和不完整环境条件保持明确。完整 Spine、纹理页、后端恢复及其余 M1 包仍有独立范围与验收。

## 容量节拍测量协议 — 后续配方 schema 6

配方 schema 6 保留 `egret.m1-2-capacity-paced/1`，增加 `engine-host-span/1`，首份诊断序列与正式计时分开记录；保留固定的静态、精确 1% 修改及全脏负载、原生所有权规则和两帧在途上限。每次 diagnostic 或 timing 试验先连续同步提交恰好两份初始状态新帧，不推进负载，两次提交之间不等待，再统一等待两帧退役。随后完整预热 30 秒；预热退役、固定负载重置及重置帧退役后，开始完整的 60 秒测量。六次 diagnostic 与三十次 timing 试验分别执行；timing 的三个状态各保留五对基线/候选，按固定角色交替和状态轮换执行。

每次真实动画回调先记录进入时刻，再检查环境和容量。Host 处于 active 且只有零或一次 pending 提交时，推进恰好一个下一负载序号并提交一份新帧。已有两次 pending 提交时，只记录容量等待并请求下一次真实回调，不更新、不捕获、不提交。意外拒绝、非法容量状态或原生错误仍属于执行失败。不提前返还容量，不猜测式重试，不生成虚拟帧或合并逻辑更新，也不逐帧等待 `whenIdle`。

窗口从第一次实际回调进入时刻 T0 开始，在首个达到或超过 T0 + D 的后续进入时刻 T1 结束；结束回调不更新或渲染。分别记录 W = T1 − T0、请求时长 D、超时部分、请求至首次回调的延迟及后续退役等待。对获准提交的进入时刻 a1…aN，保留 a1 − T0、全部相邻提交进入间隔及 T1 − aN；没有提交时，将 W 保留为一个间隔。各区间必须有限、有序、非负且合计为 W；固定的 0.000001 ms 算术容差只用于区间求和的一致性，不适用于任何性能阈值。首尾区间属于覆盖观察，不虚构成帧间隔。零长度区间保留原始记录，权重为零。

`wallGapCoverage` 将所有间隔 g 按长度排序，以 g 自身时长作为权重。其按时长加权的最近秩分位数 Q(p)，是累计正时长权重达到 p × W 时的最小间隔值；p95 与 16.7 ms 比较，p99 与 33.4 ms 比较。这是明确新增的覆盖判据，不重新解释或替代原有按帧计数、来自内部已提交帧 RAF 时间戳差的最近秩节奏。回调进入时刻的 performance.now 读数与浏览器传入的 RAF 时间戳分别采样，保留两者原值，不钳制偏差，也不强加两者之间的先后关系；各自序列及 CPU 区间仍须满足有限、非负与单调顺序检查。[High Resolution Time](https://www.w3.org/TR/hr-time-3/#sec-coarsen-time) 允许降低时间戳精度；[RAF API 说明](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) 区分传入时间戳与回调进入时的 performance.now 读数。不对阈值取整，不删除样本、不隐藏等待，也不缩短窗口。

在有界存储中保留预热和测量的每个原始回调：进入/结束时刻、RAF 时间戳、准入决定、pending 数、已接受序号/帧 ID、各阶段时钟和前台标记。缺失的阶段时钟保持缺失，不补为零 CPU 样本。提交、容量等待与结束回调的 CPU 样本组分别统计。保留已提交帧的更新、渲染以及连续更新至渲染区间；diagnostic 另行区分捕获和 Host。完整回调时长覆盖准入、记录及调度操作至最后一次时钟读取；该时钟无法覆盖随后写入时间戳和 return 的尾部，必须明确披露。不用低耗时等待回调稀释引擎 CPU，也不扣除观察开销。记录缺失或存储溢出属于完整性失败。

Timing 沿用真实 workload.render → Engine → Host 路径。采集器通过公开 HostAdapter 委托转发原 receiver、surface、frame、生命周期返回值与渲染器异常，不导入产品私有钩子，也不绕过真实帧准入。每次获准 timing 回调必须对同一返回帧调用恰好一次 Host；由采集器提供的两次时钟读取包围该调用，且位于 Engine 区间内。预热和测量原始记录保留 hostEnter、hostExit、调用数及帧/回调对应关系；不可用区间保持缺失。基线与候选使用相同观测，委托、时钟与记录开销计入 Engine/回调总时间，不作扣减。未计时的初始化/重置转发不增加这两次时钟。独立 diagnostic 仍为新捕获后直接调用 Host，不能充当五对正式计时证据。

| 指标 | 验收与解释 |
| --- | --- |
| 原有节奏 | 对内部已提交帧 RAF 间隔按帧计数：p95 ≤ 16.7 ms、p99 ≤ 33.4 ms。 |
| 新增墙钟间隔覆盖 | 对完整窗口间隔按时长加权：p95 ≤ 16.7 ms、p99 ≤ 33.4 ms。 |
| 引擎 CPU | timing 中已提交帧的 render 区间 p95 ≤ 8 ms。该同步区间包含捕获、Host 准备、打包和提交。 |
| 全脏比较 | 五次运行“更新至渲染”p95 中位数的 candidate/baseline 比值 ≤ 1.10。相对比较通过不能覆盖绝对 CPU、节奏或覆盖判据未达标。 |
| 准备耗时上界 | 每个角色/状态先计算每次正式 timing 内嵌套 Host 的 p95，再取五次中位数。Host 包含准备、打包、编码与提交；捕获位于其外，仍计入 Engine 时间。数值 ≤ 4 ms 时建立准备上界（`true`）；更大或缺失时为未建立（`null`），不能判为准备耗时失败。候选三个状态均须建立上界。独立准备耗时仍为 `UNMEASURED_IN_MAIN_WINDOW`，原有 Engine CPU 判据保持独立。 |
| 实际 GPU 时间 | 缺少另外的实际测量支持时仍为 `UNMEASURED`。CPU 区间和队列延迟不能代替 GPU 计时。 |

每个指标按角色和负载独立计算五次运行各自分位数的中位数，保留每次结果、未达标项和样本数。不跨运行混合样本，也不新增“每次都必须通过”的门槛。零或一次提交可构成完整记录窗口，但不能验收内部帧节奏或成对相对 CPU 比较。缺失样本组及相对比较的零分母保持不可用。有效但较慢的基线保留在比较中。吞吐量、最大间隔、等待次数/时长和回调开销仅作诊断，不新增帧率下限、等待占比上限、任意样本数下限或额外 CPU 阈值。

一般计时预算未达标或比较样本不足，仍继续每状态五对的固定执行序列。执行、完整性、环境、原生、期限或清理失败则停止。执行完成的 `FAIL_TIMING_TARGET` 或 `INCOMPLETE_TIMING_COMPARISON` 与执行未完成分别记录。正式验收仍需同一浏览器的新基线/候选证据；原 schema 3/4 不完整执行和 schema 5 已完成的性能失败保留原配方身份及结果，新的观测不能追溯证明这些运行已满足上界。

## 复现桌面对照验证

使用 Windows x64、Node **26.7.0**、**PowerShell 7** 和已安装的 **Playwright 1.62.1** 包（含匹配的 playwright-core）。默认通过 msedge 通道启动有头 Microsoft Edge。准备配方时也可显式增加一对参数 `--executable $browserExecutable`，其中变量是独立浏览器执行文件的绝对路径；配方记录其原始长度和 SHA-256，并在实际执行前后及进程观察中核对。两侧使用同一浏览器选择，不悄悄替换默认 Edge，也不把不同浏览器身份的结果组成一对。实际版本、适配器和电源状态另行记录；不接受调用者附加浏览器参数。Node 不附带额外执行参数；任意大小写的非空 NODE_OPTIONS 或 NODE_PATH 均会被拒绝。保持交流供电、受测浏览器处于前台，同一配对中的电源计划、浏览器可执行文件及所记录设备/驱动清单须稳定。不要并发运行套件。

固定渲染表面的 CSS、视口和 backing 均为 **1024 × 768**，显式 Host 像素比为 **1**。实际 window DPR 保留原值，必须为有限正数、逐帧精确稳定，并在每对试验间精确相同；工具不会将其舍入为 1。此前 profile 1 的 INCOMPLETE 记录保持原状。

选择两个不同且已正常安装依赖的 SDK 根目录：本验收配方使用完整 M1.1 参考版本和 M1.2 候选版本。将以下 PowerShell 变量设为绝对路径：$baselineRoot、$candidateRoot；保存新原始构建记录的既有空私人目录 $records；尚不存在的快照输出目录 $prepared；用于各模式新输出的既有私人目录 $runs；已安装 Playwright 包目录 $playwright；PowerShell 7 可执行文件 $powershell。输出目录必须位于 SDK、验证工具仓库和已安装运行时目录之外。从包含已审工具的仓库运行；每个模式的输出目录均须是新目录。

全新独立复现时，先正常构建两侧并各自保存原始日志和退出码；下面的循环仅适用于这种新准备的根目录。既有冻结 M1.1 正式参考不得为新配方重新构建或改写，应提供其真实成功构建记录。若原构建包含在完整门禁日志中，可精确摘录该构建的原始字节，但须保留完整原日志、身份、字节区间、命令边界和真实父执行退出码，明确标为派生摘录，不能伪称独立构建。准备动作本身不会构建。使用 PowerShell 7，并预先选定 Node 26.7.0：

~~~powershell
foreach ($role in 'baseline','candidate') {
  $sdkRoot = if ($role -eq 'baseline') { $baselineRoot } else { $candidateRoot }
  Push-Location $sdkRoot
  try { node tools/build.mjs *> (Join-Path $records "$role-build.log"); $buildCode = $LASTEXITCODE }
  finally { Pop-Location }
  [IO.File]::WriteAllText((Join-Path $records "$role-build.exit"), [string]$buildCode, [Text.UTF8Encoding]::new($false))
  if ($buildCode -ne 0) { throw "Build failed: $role" }
}
node tools/verify-incremental-rendering.mjs --prepare --baseline $baselineRoot --candidate $candidateRoot --baseline-build-log (Join-Path $records 'baseline-build.log') --baseline-build-exit (Join-Path $records 'baseline-build.exit') --candidate-build-log (Join-Path $records 'candidate-build.log') --candidate-build-exit (Join-Path $records 'candidate-build.exit') --output $prepared
if ($LASTEXITCODE -ne 0) { throw 'Preparation incomplete; inspect its private receipt' }
~~~

准备动作有七对必需参数及可选的 `--executable` 参数对，生成 baseline、candidate 两个副本及 schema 6 recipe.json。它只复制有界的核心 SDK 源码、发射文件、配置/包清单及已安装的 robust-predicates 3.0.3 全部原件；三个包别名分别指向各自副本内部。工具复核完整成员、原始字节和链接目标。清单角色为 built-sdk，状态为 FROZEN_BUILT_SDK_SNAPSHOT。baseline/candidate 仅表示比较位置，不表示已合并或已审通过。提供的成功日志/退出码与这些字节绑定；工具没有观察此前构建所用运行时，也不独立证明源码与发射文件的编译对应关系。它不会安装依赖、操作 Git 或执行 SDK。

使用同一批快照和精确生成的 recipe，按表中顺序逐项运行五种模式，每次先检查已保存结果。执行、完整性、环境、原生、期限或清理失败时停止。一般计时预算未达标或比较样本不足，由 timing 模式继续完成每状态五对的固定序列，不重试、不替换样本。退出码 1 也可能对应执行完整的 `FAIL_TIMING_TARGET` 或 `INCOMPLETE_TIMING_COMPARISON`；须结合完整三十条 trial、执行/环境/清理字段和预算结果判读，不能只据退出码称为执行中断。保留原输出，后续另一次尝试使用新目录。工具、规格或 SDK 字节改变后，需要重新准备快照和 recipe；配方还绑定五个测量工具及英文 M1 计划的原始字节。

~~~powershell
$mode = 'preflight' # Then correctness, counts, diagnostic, timing; inspect each completed result first.
node tools/verify-incremental-rendering.mjs --baseline (Join-Path $prepared 'baseline') --candidate (Join-Path $prepared 'candidate') --recipe (Join-Path $prepared 'recipe.json') --playwright $playwright --powershell $powershell --mode $mode --output (Join-Path $runs $mode)
$modeExit = $LASTEXITCODE
~~~

| 模式 | 固定范围与时长 |
| --- | --- |
| preflight | 每侧一个独立浏览器试验，各 12 帧、两份 RGBA；检查可运行、非空、配对字节相同及清理，不作计时验收。 |
| correctness | 每侧三个状态，共 994 帧、七份完整 RGBA；精确比较配对像素及公开值/费用。 |
| counts | 单独包装并转发真实原生方法，每状态四帧、每侧 12 帧；记录实际操作并检查固定的基线 991 / 候选 155 draw 预测，随后恢复包装。 |
| diagnostic | 六个独立试验，各预热 30 秒、测量 60 秒；至少九分钟，另加准备/清理。分别保留 capture 和 Host 时间。 |
| timing | 三个状态各五对、共 30 个独立试验，各预热 30 秒、测量 60 秒；至少 45 分钟，另加准备/清理，固定交替配对顺序和状态轮换。 |

上述模式采用前文的 schema 6 初始化、容量准入、嵌套 Host 观测和完整墙钟记录。原 schema 3/4 失败、未完成状态及配方身份完整保留在[验证记录](incremental-frame-preparation-evidence.md)中，不改称为新协议的结果。

Schema 6 按前文规则分别聚合原有节奏、CPU 和新增墙钟覆盖指标。单独 Host 诊断只约束自己的诊断窗口；每个角色/状态的正式 4 ms 准备上界，来自五对 timing 中真实嵌套 Host 区间每次 p95 的五次中位数，不用诊断值替代这些观测。GPU 时间仍为 UNMEASURED；即使已测 CPU 目标通过，整体 D60 仍为 INCOMPLETE。完整 timing 至少需要 45 分钟，不能套用 30 分钟的外层子进程终止期限；保留原有逐 trial 的期限与清理限制。结果只覆盖实际记录的浏览器、适配器和固定负载，不代表未取得实体设备的验收、物理内存/显存释放、连续前台可见性或无遮挡扫描输出。

将 preparation.json、清单、recipe、comparison.json、各试验 report.json、原始样本/RGBA 及系统观察记录保存在私人本地证据目录；其中可能包含机器路径、进程号、命令行和设备/驱动详情。对外使用工具生成的 public-summary.json 投影。部分完成、失败及清理限制均应保留；复制成功或预检通过不能写成正式 timing PASS。
