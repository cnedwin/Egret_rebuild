# 有序增量帧准备契约

[English](../../en/docs/incremental-frame-preparation-contract.md) | 简体中文

M1.2 减少重复捕获与准备工作，并合并相邻兼容的二维绘制。显示树、已提交资源绑定和既有提交所有者继续作为权威。本文规定候选实现的行为与边界，不报告实测提速，也不代表完整 M1 已通过验收。

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

候选连续两次替换失配且期间没有接受命中后，停止保留几何和 packing 结果。有界数值探针复用已有数值存储，不持有 image、geometry 或阶段 payload。同一次准备调用的 geometry 与 packing 只计一次观察；只有阶段成功发布才确认观察，被更新观察取代的旧发布或失败观察不能重新启用缓存。后续稳定的数值观察只允许重新执行完整冷计算，不能直接命中；复用仍需精确的当前资源身份和完整键。数值序列长度变化会丢弃探针，并禁止该槽再次保留结果。含 N 个数值的探针费用为 256 + 72 + 24 + 8 × N logical bytes，遵守同一 Host 额度。

几何复用遵循原命令阶段。矩形 packing 以原连续矩形 run 整体缓存，保留整个 run 的表示位置转换、方向检查、收费和 payload 分配顺序；拆分不能增加可用预算。图像和 mesh packing 留在原命令位置。失败计算不缓存。

成功阶段记录自身逻辑费用。只有每个相关剩余额度都足够，命中才重放该阶段完整的 prepared-vertex、predicate 和 tuple-comparison 费用。重放是原子的：任一维度不足，直接在原位置执行原计算，不先部分扣费，由原操作决定首个拒绝及 cause。源三角形准入，以及全帧 projection、upload、pending、device、readback、serial 检查仍执行。覆盖抑制、Float32 坍缩和更少的原生 draw 不产生新的逻辑退款。

各 profile 的优先级不变。普通提交与普通场景 overlay 保留 packing 在 pending/readback 检查之前的原位置；纹理与 combined 提交保留 storage 准入在 payload packing、复制和 uniform 创建之前。必要的本次提交副本留在这些位置；缓存 typed payload 不直接交给 queue 回调。

## 相邻批次与提交退役

原逻辑准入、packing 和 uniform 分配全部完成后才规划批次，并保留逻辑命令来源和绘制顺序。采样绘制只在同一提交阶段内合并相邻兼容项：pipeline/类型、本次 image view 与 crop、透明度、有序裁剪及该阶段的采样、混合和颜色解释必须一致。image 与 mesh 管线不混合。兼容的连续矩形范围可以在原 buffer 内合并，保留逐顶点颜色与透明度。

A–B–A 保持原顺序。材质或裁剪变化、空 image/mesh 贡献和 scene→overlay 边界会中断合并。不支持的状态保持原拒绝；不因此增加材质、混合 profile、纹理页或全局纹理排序。

每个逻辑单位先满足原 upload 与 device 限制，再让可选拼接遵守 device buffer 限制和剩余 scratch，只在原逻辑 draw 边界分段。容量不足或可选拼接分配/复制不可用时，提交未合并 payload。该降级不吞掉原 packing/uniform 失败或原生 GPU 错误。即使执行减少了 buffer、binding、uniform 或 draw，原逻辑费用仍完整收取。

scratch 在分配前预留，同时覆盖活动候选和已接受提交。未接受计划释放预留；已接受计划保留到既有提交退役完成。仅队列 fence 完成不能释放它。错误 scope、readback/map 义务、清理成功、混合 buffer 归还顺序、loss 和不安全关闭继续遵守 M1.1 所有权规则。清理失败保留原账本责任。缓存命中不证明 GPU buffer 中仍有旧内容，每次提交仍上传自己拥有的 payload。

## 验收边界

完整的上一版 SDK 作为相同操作序列的独立完整重算参考。实现不增加公开 debug 开关或永久的第二套渲染权威。正确性、实际原生操作减少、浏览器像素、耗时、内存观察和交付状态分别提供证据。不引入 dirty 百分比阈值，也不承诺提速比例。

M1 的静态、稀疏更新、全部变化工作负载及声明的桌面条件仍是验收目标。全部变化比较把更新工作纳入从 update 开始到 render 返回的连续时间段；五次运行各自 p95 的中位数，其 candidate/baseline 比值须满足声明的 1.10 上限。诊断 Host 耗时只能在该诊断窗口内给 preparation 提供上界；上界过大不能证明 preparation 自身超标。未测 GPU 时间、物理内存、不可用设备和不完整环境条件保持明确。完整 Spine、纹理页、后端恢复及其余 M1 包仍有独立范围与验收。

## 复现桌面对照验证

使用 Windows x64、Node **26.7.0**、**PowerShell 7**、已安装的 **Playwright 1.62.1** 包（含匹配的 playwright-core）和 Microsoft Edge。工具通过 msedge 通道启动有头 Edge，保留默认启动方式，不接受调用者附加浏览器参数。Node 不附带额外执行参数；任意大小写的非空 NODE_OPTIONS 或 NODE_PATH 均会被拒绝。保持交流供电、受测浏览器处于前台，同一配对中的电源计划、浏览器可执行文件及所记录设备/驱动清单须稳定。不要并发运行套件。

固定渲染表面的 CSS、视口和 backing 均为 **1024 × 768**，显式 Host 像素比为 **1**。实际 window DPR 保留原值，必须为有限正数、逐帧精确稳定，并在每对试验间精确相同；工具不会将其舍入为 1。此前 profile 1 的 INCOMPLETE 记录保持原状。

选择两个不同且已正常安装依赖的 SDK 根目录：本验收配方使用完整 M1.1 参考版本和 M1.2 候选版本。将以下 PowerShell 变量设为绝对路径：$baselineRoot、$candidateRoot；保存新原始构建记录的既有空私人目录 $records；尚不存在的快照输出目录 $prepared；用于各模式新输出的既有私人目录 $runs；已安装 Playwright 包目录 $playwright；PowerShell 7 可执行文件 $powershell。输出目录必须位于 SDK、验证工具仓库和已安装运行时目录之外。从包含已审工具的仓库运行；每个模式的输出目录均须是新目录。

先正常构建两侧并各自保存原始日志和退出码。下面这一步执行既有构建命令，后面的准备动作不会构建。使用 PowerShell 7，并预先选定 Node 26.7.0：

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

这个七对参数的准备动作生成 baseline、candidate 两个副本及 recipe.json。它只复制有界的核心 SDK 源码、发射文件、配置/包清单及已安装的 robust-predicates 3.0.3 全部原件；三个包别名分别指向各自副本内部。工具复核完整成员、原始字节和链接目标。清单角色为 built-sdk，状态为 FROZEN_BUILT_SDK_SNAPSHOT。baseline/candidate 仅表示比较位置，不表示已合并或已审通过。提供的成功日志/退出码与这些字节绑定；工具没有观察此前构建所用运行时，也不独立证明源码与发射文件的编译对应关系。它不会安装依赖、操作 Git 或执行 SDK。

使用同一批快照和精确生成的 recipe，依次运行五种模式。任何失败或未完成结果都应停止后续步骤；保留该输出，重试使用新目录。工具、规格或 SDK 字节改变后，需要重新准备快照和 recipe。

~~~powershell
foreach ($mode in 'preflight','correctness','counts','diagnostic','timing') {
  node tools/verify-incremental-rendering.mjs --baseline (Join-Path $prepared 'baseline') --candidate (Join-Path $prepared 'candidate') --recipe (Join-Path $prepared 'recipe.json') --playwright $playwright --powershell $powershell --mode $mode --output (Join-Path $runs $mode)
  if ($LASTEXITCODE -ne 0) { throw "Mode did not complete successfully: $mode" }
}
~~~

| 模式 | 固定范围与时长 |
| --- | --- |
| preflight | 每侧一个独立浏览器试验，各 12 帧、两份 RGBA；检查可运行、非空、配对字节相同及清理，不作计时验收。 |
| correctness | 每侧三个状态，共 994 帧、七份完整 RGBA；精确比较配对像素及公开值/费用。 |
| counts | 单独包装并转发真实原生方法，每状态四帧、每侧 12 帧；记录实际操作并检查固定的基线 991 / 候选 155 draw 预测，随后恢复包装。 |
| diagnostic | 六个独立试验，各预热 30 秒、测量 60 秒；至少九分钟，另加准备/清理。分别保留 capture 和 Host 时间。 |
| timing | 三个状态各五对、共 30 个独立试验，各预热 30 秒、测量 60 秒；至少 45 分钟，另加准备/清理，固定交替配对顺序和状态轮换。 |

在 diagnostic 与 timing 试验中，配方 schema 4 先在初始状态连续提交恰好两份新帧，不推进负载，两帧之间不等待；随后只等待一次退役，再开始完整预热。初始化记录与前四次预热尝试分别保留。两帧在途上限、期限、完整测量窗口与阈值均不变。初始化或后续背压拒绝会停止试验，不重试、不跳帧、不替换样本。此前 schema 3 的失败仍为未完成；后续初始化完成后的窗口通过，也不能证明冷启动是原失败的唯一原因。

计时保留所有有界原始样本，采用最近秩分位数，再比较五次试验各自 p95 的中位数。全脏比值使用“更新开始至渲染返回”的连续时间，要求不超过 1.10。单独 Host 诊断时间只在该诊断窗口内为准备耗时提供上界。GPU 时间仍为 UNMEASURED；即使已测 CPU 目标通过，整体 D60 仍为 INCOMPLETE。结果只覆盖实际记录的浏览器、适配器和固定负载，不代表未取得实体设备的验收、物理内存/显存释放、连续前台可见性或无遮挡扫描输出。

将 preparation.json、清单、recipe、comparison.json、各试验 report.json、原始样本/RGBA 及系统观察记录保存在私人本地证据目录；其中可能包含机器路径、进程号、命令行和设备/驱动详情。对外使用工具生成的 public-summary.json 投影。部分完成、失败及清理限制均应保留；复制成功或预检通过不能写成正式 timing PASS。
