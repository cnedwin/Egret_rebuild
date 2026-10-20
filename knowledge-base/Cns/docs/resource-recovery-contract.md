# 资源清单、分阶段替换与设备恢复契约

[English](../../en/docs/resource-recovery-contract.md) | 简体中文

2026-10-20 · M1.5 · 验证截止点 · 固定 C7 与受影响的浏览器回归已验收

## 范围与状态

M1.5 将确定性资源清单、依赖加载、分阶段替换和设备重建连接到同一个真实 Engine 场景。已选设计扩展现有 AssetManager、租约、Scope、捕获登记与共享 Host。CPU 场景状态保持权威；原生资源由一个 Host 按设备代次持有。

本文规定已选行为与固定验收要求。在 2026-10-20 验证截止点，[验证记录](resource-recovery-evidence.md)记载了经独立评审的 C7 七案完成结果，环境为 Windows / Chrome for Testing 157.0.8103.6；C01/C02 各完成 100 次资源循环、十次原生丢失及 30 分钟前台运行。受影响的二十四个浏览器套件共三十六次实际调用及独立结果评审均已完成。最终工作包评审与完整受保护 CI 仍须完成；M1.2 正式性能与外部平台/设备验收继续开放，交付情况以实际 PR 历史为准。C1–C6 保留历史结果，旧 Edge 版本仍未验收。源码实现、受控检查、真实浏览器结果、正式性能和受保护交付分别需要证据。[M1 计划](m1-rendering-resource-plan.md)、[共享渲染契约](shared-render-profile-contract.md)与 [WebGL2 契约](webgl2-executor-contract.md)保留各自兼容边界。这些是同一个 M1.5 包内相连的步骤。

## 身份与字节完整性

版本化项目资源实体通过稳定逻辑 ID、源文件与产物文件记录、精确 importer 和工具版本、规范化设置、产物格式、目标配置、顺序依赖与影响构建的来源信息定义资源。项目显式引用必须与这些记录一致。重复 ID、缺失或循环依赖、不支持的版本及非法路径必须在 provider 工作前拒绝。

唯一的 contracts 准入校验模块验证并复制清单元数据，按拓扑顺序重算 SHA-256 构建键，拒绝声明键不一致。构建键包括源摘要/长度及依赖 ID/键；输出产物不进入构建键，以免自引用。运行时资源身份还包括项目/逻辑 ID、经元数据校验的构建键、产物摘要/长度、格式/媒体类型和目标。同逻辑 ID 或同构建键不能合并不同产物。真实资产类型身份仍参与获取；同类型名不代表同类型。URL 定位字节，不确立身份。

元数据准入只证明声明自洽。构建工具另外以原生密码学核验实际源文件和产物字节；浏览器在解码前核验收到的产物摘要与长度。单独解析清单既不证明文件完整性，也不证明加载成功。规范清单字节的摘要放在外部回执中，避免自哈希字段。

已选可选入口为 `@egret/contracts/resources`、`@egret/project/resources`、`@egret/engine/resources` 和 `@egret/engine/web/resources`。Engine/runtime 依赖 contracts，不依赖 project；默认包入口保持独立。准入上限为清单 UTF-8 4 MiB、4,096 个资源、8,192 条依赖边、深度 32、每项设置 64 KiB。

## 分组、依赖与取消

清单分组在获取前准入完整依赖闭包，要求每个选中项恰有一个真实且类型正确的 binding，并遵守现有每组 128 成员上限。依赖先于依赖方获取。现有 manager 可以合并加载，但每组独立持有真实租约。分组访问返回借用租约，调用方不得释放。Provider 加载自身产物；应用只在整组就绪后、分组仍存活时消费依赖值完成装配。

有界调度器负责顺序，不持有资源值或处置权。交互/后台两类各自 FIFO；两类均等待时，每准入四次交互获取后准入一次后台获取，并先满足依赖顺序与合并规则。每个 Engine 最多四次活跃获取、128 条清单获取排队记录。关闭一组不能撤销另一组的需求。

每个共享浏览器源最多持有四个实际网络操作、两个实际解码操作、128 个等待操作及 132 条保留或隔离的任务记录。直接读取与全部 provider 共用等待上限，网络排队、解码排队和重试延迟合并计数。每份编码输入最多 8 MiB。分配正文前，源按预期长度的两倍预留资源，合计不超过 32 MiB，用于稳定输出及当前分块或原生摘要输入；这项保守预留保留至实际结算。现有 PNG provider 另外保留总计四个任务、每份输入 8 MiB、编码输入副本合计 32 MiB 的限制。这些独立逻辑账本不代表合并后的物理内存测量。

整个任务期限从读取调用方上下文前开始，覆盖排队、fetch、核验、解码与结果生成：默认 10 s，最大 30 s。默认不重试；显式选项允许瞬态网络错误在实际传输清理后、延迟 100 ms 重试一次，仍受原期限约束。完整性、schema 和解码错误不得重试。

取消先撤销发布权，再释放分组租约。等待者拒绝、超时或发出 abort 请求均不释放运行中的 fetch/正文读取/解码槽位。槽位由捕获的底层实际操作持有到真正结算，迟到结算只释放一次。排队任务可在启动前移除，但仍须等待原异步执行链结束，才移除其保留记录。公开的拒绝结果本身不承诺立即提供替代任务容量。尚未确认结束的操作继续计入资源占用，并限制后续准入。源与 provider 分别等待自身实际工作完成，保留清理未完成的结果，均不关闭另一持有者，也不处置 manager 持有的资源值。

取得响应体后，取消流程先调用原始响应体或读取器的取消操作，再中止网络请求，避免网络中止先把可读流置为错误状态。关闭仍需等待原始取消结果和读取器锁释放；取消操作确实失败时，保留原始原因、未完成的清理状态和对应资源额度。

## 稳定 Host 与代次恢复

一个共享 Host 门面持有可替换的原生会话。会话区分 new、starting、ready、stopped、lost、restoring、failed、closing、closed；代次 token 授权异步发布。并发就绪/恢复调用共享对应已存屏障。就绪要求原生能力核验、管线/目标建立及旧代次退役已记账。成功恢复后保留历史首次失败；当前代次失败只在成功时清除。

共享 WebGPU 恢复须显式启用。未启用时保留现有丢失后的终止行为。自动恢复仅适用于 Host 获取并拥有的设备。手动自有模式重新获取原生设备；借用模式要求显式提供新的真实设备。Host 从不销毁借用设备。旧入口、textured/B1 入口保留既有失败、stopped/start、错误与关闭语义，不增加从 stopped 重启的能力。

丢失先撤销代次，再允许重入发布。过期的获取、验证、上传、完成和回读只能结算原持有者，不能发布到后续代次。关闭先撤销恢复，再清理；迟到自有设备需结算，迟到借用设备只分离，均不能重开 Host。恢复保留 Engine、Stage、Scope、租约、场景/动画状态和游戏时钟；由应用明确选择并重放不可变帧。

确认的原生丢失可使该精确代次仍为已知的原生持有者失效结算；CPU 工作和回调仍须结束。对于暂存提交和显式启用的恢复，已经归类 unknown 的持有者永久保留资源占用记录与不安全状态，即使同设备随后真实丢失也不例外。新代次不能抹去未知清理；无法协调的不安全持有使恢复终止。产品恢复期限默认 10 s、最大 30 s，与更严格验收目标分开。

未启用恢复的 WebGPU 即时提交保留既有终止记账行为：原操作结束且清理恰好尝试一次后，可以退役逻辑待处理计数，同时继续保留不安全关闭和表面隔离状态。待处理计数归零不证明原生资源销毁成功，也不授予未知持有状态恢复或安全复用的权限。新暂存提交中，错误作用域观察被拒绝时继续保留原占用记录；成功返回的验证错误，则可在其余证明与清理成功后释放该记录。报告仍保留最初的失败原因。

Idle 等待快照捕获已准入工作和调用时状态。包含受丢失影响工作的快照在清理后拒绝；健康空快照不被后来丢失追溯失效。启用恢复时，后续健康代次快照可在保留历史失败的同时成功。

可选共享 Host 提供 `getSessionStatus()`、`whenReady()` 和 `stageSharedFrame(frame, options?)`；场景 Host 另提供 `stageSceneSharedFrame(scene, overlay, options?)`。只有共享 WebGPU 提供 `recover(device?)`。会话状态快照被冻结，包含状态、代次、尝试次数、历史首次失败及当前代次失败。既有 WebGPU 状态将 ready 映射为 active、lost 映射为 failed、restoring 映射为 starting，原状态联合类型保持不变。只有共享 WebGPU 回读增加 generation 字段。六个公共会话/上传类型仅通过可选后端入口导出为编译期类型。

每轮 WebGPU 丢失最多允许三次实际恢复尝试，其中包括一次自动尝试。失败已安全结算后，须由后续显式调用重试，不进行自动循环重试。初始启动的尝试编号为零。调用方设备验证失败不改变尝试计数或就绪屏障。成功捕获新原生代次即推进 token，即使后续重建失败也不回退；只有真正就绪后再次发生真实丢失，才重置该轮尝试额度。次数耗尽、期限届满或清理状态不确定均进入终止失败。公开超时不证明设备获取或原生工作已经结束。

启用恢复时，每个初始及替换设备，不论自有还是借用，均须通过真实浏览器 GPUDevice 的 lost/limits getter 核验，并完成固定方法捕获。只有该捕获的原生 lost promise 成功结算，才能证明其精确代次失效。观察 promise 拒绝，或仅有 lost promise 的结构相似设备，均不能证明失效。已经 unknown 的持有状态保持 unknown。未启用恢复时保留既有准入兼容行为。

lost/restoring 期间，`start()` 拒绝且不发起获取；`whenReady()` 观察当前屏障。一次安全失败使该屏障保持拒绝，直至有效的显式重试发布下一屏障。停止会先于清理回调撤销恢复及未提交上传的发布权，进入 stopped，阻止后续获取、重建或重开。已经启动的工作仍持有至实际结算。原始初次启动 promise 与已提交工作保留既有结算时序。WebGL2 保持现有恢复策略，不套用 WebGPU 的恢复尝试次数限制。

## 候选捕获、分阶段上传与提交

`Engine.capturePreparedSharedFrame(ticket, options)` 同步捕获属于同一 Engine、关联存活 Scope 的真实已准备 binding ticket，经现有共享遍历与完成登记返回不可变 `SharedRenderFrame2D`。帧 ID、捕获预算及帧/时钟重入规则与普通捕获共用。捕获不调用 Host、不推进时钟、不消耗已准备 ticket，也不接管分组租约。

唯一私有视图选取完整候选 Bitmap 状态，包括源、crop、view region、逻辑/自然尺寸、trim 与旋转元数据。全树准入与可见几何使用同一视图；已挂接的可见内容保留当前编写的变换、祖先裁剪与顺序。遍历前后均校验每个选中目标的绑定状态及新旧租约权限，隐藏或未挂接的目标也不例外。捕获不写入实时绑定、bounds 缓存或 revision；提交前，后续普通、legacy 和 textured 捕获继续使用旧绑定。

遍历不调用 `getBounds()`，也不从 bounds 推导已编写的裁剪。公开 bounds 查询继续测量实时场景。如果捕获路径需要内部 bounds 测量，必须使用同一候选视图和仅限本次调用的结果，不得将候选测量结果写入实时缓存。变换/裁剪祖先下的 16 × 16 到 64 × 64 用例，将候选帧内容与独立完成提交的参考比较；实时祖先 bounds 在提交前必须保持旧值。相邻对象坐标与裁剪按已编写值捕获，不增加自动布局。

读取调用方选项前，先校验 ticket 的真实身份及已准备阶段。按顺序读取选项结束或抛出后，候选捕获先复查 Engine/Scope/ticket 生命周期与阶段，再选择选项错误。若该复查通过，选项读取失败保留精确的原始 cause，包括 `undefined`。只有选项有效后才开始目标、绑定和租约校验。拒绝不消耗帧 ID；绑定冲突、生命周期或租约权限变化继续遵循既有拒绝行为。

已保存候选帧在之后无关的外观/树编辑期间保留不可变快照语义。提交时，ticket 仍要求目标绑定状态与新旧租约权限有效；快照捕获不建立整个场景的事务。现有 `BitmapBindingTicket.commit(): void` 仍是独立的同步发布步骤。CPU 快照捕获与受控捕获检查均不证明 Host stage 就绪、原生上传/绘制完成或真实浏览器参考正确回读。

分阶段上传预留全部现有资源预算，并占用与普通渲染相同的两个待完成帧槽位之一。每个调度任务的上传块最多 4 MiB，保持行/元素对齐。不增加第二套 staging 配额或全图拼接。资源从就绪前固定持有至 submit/dispose/loss 结算。

上传就绪证明该代次原生上传/验证完成。CPU commit、绘制提交、原生完成和参考正确回读是独立事件。Submit 仅可用一次，将同一持有者转交而不重复上传；过期 ticket 必须拒绝。固定 10 s 准入到提交期限包含就绪后持有时间。Idle 快照包含已准入但尚未提交的 stage，直到转交或拒绝已结算。

启用回读时，stage 在尚无请求时就预留完整的潜在回读预算，直到 submit 才选择请求；较早的普通渲染可以绑定自身符合条件的请求。GPU 计入带行填充的暂存及最终输出，GL 计入像素打包存储及输出。场景 stage 使用场景与 overlay 的最终尺寸。Staging 不得改变可见 canvas 尺寸或配置，不得获取其当前纹理、绘制、resolve 或回读。它只准备离屏资源，保留此前健康的画面；真实设备丢失仍可能使该画面失效。

上传句柄提供只读 `ready` promise、`submit()` 和 `dispose()`。Submit/dispose 必须由精确的原返回句柄调用；脱离接收者调用和复制句柄在访问 Host 状态前拒绝。Submit 返回冻结的 generation/frameId/serial 元数据和原生 `completed` promise。像素回读与最终资源退役各自保留观察结果。后续回读失败不能改写已成功的原生完成 promise。Submit 已接受后的 dispose 不取消已转交工作。

Stage 选项接受既有取消信号。信号及监听方法只捕获一次；准入前及订阅后立即分别检查 aborted。首次观察到 abort 后才读取 reason，且只读一次，读取前先设置重入保护。同步订阅中的 abort、终止回调或异常会撤销尚未启动的已计入记录，并且不返回句柄。句柄返回后的取消只撤销发布权，原上传与完成证明仍占用资源，直到实际结算。Host 终止状态优先于选项读取异常；否则保留精确原始 cause，包括 undefined。监听移除只执行一次，不额外释放容量。

应用顺序为：获取候选组 → 准备 binding ticket → 捕获候选帧 → stage 并等待就绪 → 无中间 await 地同步提交 CPU 绑定并 submit → 观察完成与独立回读 → 释放旧组。现有 `BitmapBindingTicket.commit(): void` 保持同步 CPU 绑定。提交前失败保留旧绑定；提交后原生失败要求显式回退或重建/重放，两组保持持有直到选择完成结算。

重新加载使用同一 Engine/manager：保留旧租约，准入替换闭包，在新获取前对每个选中根/依赖 ref 恰好 invalidate 一次，然后要求新的 CPU 资源代次、图像身份及真实整形网络 fetch/解码。旧租约对原持有者仍有效。重新获取 READY 项或重放保留字节不能满足重新加载验收。

## 固定实际验收

采集前冻结源码、声明/产物、资产、参考、用例、阈值和采集器。保留每次尝试、失败、未完成项、原生诊断、迟到错误和清理结果。受控故障证明拒绝行为，不能替代真实原生丢失。

| 行 | 必需有限验收 |
| --- | --- |
| 集成场景 | 同一真实 Engine/Stage/Scope 场景组合文字、图集动画、透明顺序、裁剪、交互、双资源替换与现有有界 mesh/B1。固定参考分开文字布局和允许的抗锯齿差异。恢复保留时钟/场景/动画位置；后续显式 tick 证明继续运行。 |
| 资源/取消 | 每个可执行后端 100 个有序循环，重复成功替换、fetch 前取消、解码中取消、staging 中取消、替换冲突。核验旧/新像素与完整持有结算。 |
| 真实 WebGL2 | 十次真实 `WEBGL_lose_context` 丢失/恢复：五次保留源 ≤ 2 s，五次整形网络重新加载 ≤ 5 s。 |
| 自有自动 WebGPU | 十次真实原生设备丢失/重新获取，五次保留源 ≤ 2 s、五次整形重新加载 ≤ 5 s。恰好一次初始获取加十次成功自动获取；不得手动恢复、提供设备或重启 Engine。 |
| 借用/手动 WebGPU | 另加一次真实保留源原生丢失/新借用设备/手动恢复循环 ≤ 2 s。Host 不销毁任一借用设备。此必需行与十次自有自动循环分开。 |
| 关闭/拒绝 | 真实 loss/close 和 restore/acquire/close 竞态；关闭后零次新获取、无过期发布、迟到自有设备结算且借用持有不变。不可用原生路径注明原因并保留未执行。 |
| 压力 | 固定 40 × 512 × 512 RGBA8 页，每页 1 MiB；每帧最多 16 页。在超过 32 MiB READY 需求时证明真实驱逐、重新上传、正确回读与 staging 取消。压力资产在初始场景验收后加载。 |
| 持续运行 | 每个可执行后端前台 30 分钟，固定计划、周期性真实交互与计划内真实丢失。保留全部区间；逻辑计数与原生/进程内存采样分别报告。 |
| 冷启动 | 真实 10 Mbit/s、80 ms RTT 整形；冷缓存、禁用 service worker；应用 JavaScript ≤ 1 MiB gzip，不含可选 Spine/源资产；初始场景资产传输 ≤ 4 MiB；已验证交互 ≤ 5 s。从导航/启动到可信输入产生参考正确的变化回读计时。 |

自有 WebGPU 丢失采集观察实际原生 requestDevice promise，不替换 adapter/device/result，保留精确原 descriptor 与 promise/throw，只在初始正确回读后销毁已选真实设备。Host 负责重新获取。记录真实 lost 结算及不同真实设备；关闭时恢复 descriptor 并排空观察。不支持该观察方式时保留未执行。显式原生销毁只证明该丢失路径，不证明自发驱动重置。

恢复计时从捕获的实际原生丢失回调开始，到新代次回读匹配独立参考后结束。包括退役、重新获取、重建、整形 fetch/解码、staging、绘制、队列完成与回读，保留观察开销。不得以中位数替代每次 2 s/5 s 上限。启动和重新加载要求真实传输回执，计时器延迟的假 fetch 无效。

场景逻辑目标仍为保留解码 CPU ≤ 128 MiB、READY 图像 ≤ 32 MiB/256 项、可复用资源 ≤ 32 MiB、在途上传 ≤ 64 MiB、临时 CPU 上传 ≤ 32 MiB。统计同时持有的源、临时、待完成、READY 和可复用对象；回读/调用方保留帧单列。现有更严格上限继续生效。这些账本不证明物理内存或不存在原生泄漏。

## 运行集成恢复采集器

主动启用的 `resource-recovery` 套件通过构建后的公开 SDK 验证 M1.5 场景与资源生命周期。先完成标准构建和源码评审，再使用仓库之外尚不存在的输出目录：

~~~text
node tools/browser-verify.mjs --suite resource-recovery --playwright <absolute-installed-playwright-package> --output <absolute-fresh-directory-outside-repository>
~~~

固定七项案例覆盖 WebGL2 与自有设备 WebGPU 的持续恢复、借用设备 WebGPU 的恢复，以及四项丢失或恢复期间关闭的案例。两个主要后端各需在前台持续运行 30 分钟，并接收可信指针交互。运行期间请保持机器空闲，避免并行构建、修改源码、运行其他基准或切换浏览器焦点。包装入口为该套件设置 82 分钟上限，采集器另有更早的工作和清理截止时间。截止时间是上限，不代表预计耗时或验证成功。

采集器仅提供已评审的本地模块和素材，使用项目自制 PNG，并记录离线资源清单构建器的来源。实际网络按 10 Mbit/s、80 ms 整形，保留原始像素回读和显示截图，检查原资源所有者的清理结果。浏览器产物保存在外部输出目录。请同时查看包装入口的 `result.json`、`artifacts/report.json` 及索引列出的原始文件。七项案例、输入稳定性、数值基准、资源计数和清理必须全部通过；缺少原生能力或存在未完成项时，验收继续保持开放。合成完成记录测试只验证回执校验逻辑，不能代替本浏览器运行或独立的 M1.2 性能验收。

### 隔离选择浏览器

现有包装入口使用已安装的 `msedge` 通道。直接采集入口也可通过 `--executable` 选择隔离安装的 Chromium 兼容浏览器，该选项与 `--channel msedge` 互斥：

~~~text
node tools/verify-resource-recovery.mjs --playwright <absolute-installed-playwright-package> --executable <absolute-browser-executable> --output <absolute-fresh-directory-outside-repository>
~~~

继续使用 Windows x64 环境和现有锁定版本的 Node、Playwright。采集器不安装或更新浏览器，不接受额外启动参数，并拒绝未知、重复、混用或相对路径的浏览器选择。报告记录所选可执行文件的规范路径、原始字节长度及 SHA-256，在启动前和清理后核对同一身份，同时保留实际启动的浏览器版本及可取得的 CDP 版本信息。身份发生变化时，运行保持未完成。该指纹只覆盖所选可执行文件，不代表整个浏览器发行包的所有文件。

直接采集入口将 `report.json` 和索引中的原始产物直接写入输出目录，不生成外层包装入口的 `result.json`；原有工作与清理截止时间继续生效。七项案例、每个主要后端的 100 次资源循环、十次实际设备丢失、30 分钟前台持续运行、网络断言、参考像素和清理要求全部保留。结果只适用于实际验证的浏览器版本、操作系统和设备。选择另一可执行文件或发现上游浏览器修复，不等于已有新的通过结果，也不能消除历史失败；未测浏览器版本仍属未验证。

## 其余验收边界

正式 M1.2 性能保持独立且 OPEN，直到精确流程执行：10,000 逻辑/1,000 可见节点、八层裁剪、静态/精确 1%/全脏负载、D60 profile 2、两次初始立即提交、30 s 预热及每负载五次 60 s 试验。保留五次各轮 p95 的中位数比较；帧 p95 ≤ 16.7 ms/p99 ≤ 33.4 ms，CPU p95 ≤ 8 ms（其中准备 ≤ 4 ms），实测 GPU p95 ≤ 8 ms，全脏 CPU 回退 ≤ 10%。M1.5 功能、启动或恢复结果不能关闭尚未完成的 M1.2 计时。

未测移动端、小游戏及外部 Host 行保持未执行。完整 Spine 仍属 M2；完整文字/列表/IME 仍属 M3。公开 SDK 发现、双语证据、完整本地门禁、受影响浏览器结果与受保护交付分别保留状态。

## 只读资源诊断

字节来源、固定 PNG provider 与共享渲染器的资源诊断已经实现，用于 M1.5 压力验证。它通过可选浏览器与共享渲染入口，呈现既有所有者的逻辑计量，不新增分配权限、调度器、资源所有者或重置操作。固定 C7 执行已提供验证记录中的实际压力与恢复证据；正式计时及整包验收仍为 OPEN。

ManifestByteSource.getStatus() 返回 ManifestByteSourceStatus。固定清单 PNG 装配返回带有 getStatus(): ManifestTextureProviderStatus 的 ManifestTextureProvider 子类型；普通 BrowserTextureProvider 保持原有接口。两个共享后端及其场景变体通过 getSharedStatus() 暴露 resources: SharedHostResourceStatus。既有 getStatus() 字段及 WebGL2 retention 投影保持原有含义。来源与 provider 的状态方法要求真实接收者。

每次返回新的深度冻结普通数据快照，包含 current、highWater 和布尔值 saturated；Host 另外包含 totals。计数分组只包含安全非负整数，不暴露原生对象、资源身份、Promise 或时间戳。读取不执行原生调用、调度推进、淘汰、回调或清理，关闭后仍可读取。高水位在实际所有权变化时更新，包括同步分配，而非仅在读取时更新。每个字段分别表示自身的生命周期最大值；不同字段或代次的最大值不能相加作为同时内存峰值。发生饱和的累计值不能用于精确数量验收。

| 所有者或分组 | 字段与计量边界 |
| --- | --- |
| 字节来源 | jobs、queuedNetwork、queuedDecode、retryWaiting、activeNetwork、activeDecode、encodedCreditBytes、ownedEncodedBytes、borrowedChunkBytes、quarantinedJobs。编码额度为已接纳产物长度的两倍；自有字节统计实际输出缓冲区，借用分块长度描述复制时已校验的视图。额度和分块长度均不衡量传输内部缓冲。 |
| 清单 PNG provider | jobs、encodedCreditBytes、ownedEncodedBytes、blobLogicalBytes、activeDecodes、bitmapLogicalBytes、rasterLogicalBytes、readbackCpuBytes、materializedCpuBytes、quarantinedJobs、unknownNativeObjects。复制缓冲区、Blob 载荷、原生解码／光栅义务与发布前图像数据分别计量。原生尺寸表示逻辑 RGBA 大小，不代表物理分配。 |
| Host pending | frames、uploadCreditBytes、pageCreditBytes、readbackCreditBytes、geometryCreditBytes、colorCreditBytes、sceneCreditBytes、uniformCreditBytes、depthCreditBytes。投影既有记录与准入额度；READY 页的引用也可能出现在 pending 额度中，不得计为另一份分配。 |
| Host cpu | canonicalBytes、scratchBytes、temporaryBytes。临时字节为同一时刻自有规范化缓冲区和实际源复制缓冲区之和。同步重叠在分配与释放时记录，包含异常退出；静态准入上限不等于实测峰值。 |
| Host images | readyBytes、readyEntries、pinnedReadyBytes、pinnedReadyEntries、allocatedLogicalBytes、reservedCreditBytes。被固定的 READY 是 READY 的子集；实际分配与尚未实体化的预留额度分别报告。 |
| Host reusable | idleBytes、idleEntries、leasedBytes、leasedEntries、reservedBytes、reservedEntries、detachedBytes、detachedEntries、unknownBytes、unknownEntries。idle、leased、detached 与 unknown 描述原有账本的分配状态。reserved 是与 leased 分配重叠的归还额度，计算已分配字节时不再重复累加。保留策略将 idle 与 reserved 的字节合计限制为 32 MiB。 |
| Host unknownNative | knownLogicalBytes、objects。未确定的原生义务在关闭和代次变化后仍可见。对象大小未知时，已知字节数为零不能证明安全清理。 |
| Host totals | pageWriteCalls、pageWriteBytes、readyCapacityEvictions。仅统计正常返回的原生页写入及实际因容量导致的 READY 移除。这些累计量描述传输／淘汰，不代表实时内存或原生验证成功。 |

固定 PNG provider 的 blobLogicalBytes 使用原生 Blob 成功构造后、已校验的单一分块载荷长度，不额外读取 Blob.size getter。activeDecodes 从进入捕获的解码器调用开始，持续到其原始结果结算，包含同步调用区间；因此同步抛出异常也可能产生短暂高水位，随后由原有 finally 释放计数。unknownNativeObjects 统计既有无效或校验失败的义务，以及无法确认清理的对象；正常获取后尚未完成常规校验，本身不构成未知义务。迟到且已取消的 bitmap 不增加尺寸读取，清理失败按原始对象去重计数。

原有结算与所有权规则继续决定行为。取消发布不返还仍在执行的操作额度。readBytes 安全移交后移除来源持有的缓冲区计数；纹理安全发布后由应用所有者统计图像。原有隔离引用继续报告，不为诊断创建副本或额外保留引用。跨设备代次只使用既有有界所有者和标量历史。已知失效不能清除未知义务。旧即时 GPU 提交的 pending 记录可能已退役，但未确定的原生清理仍在 unknownNative 中可见。

在指定压力场景中，应用按真实图像身份对组、租约和保留帧中的引用去重，几何与调用者持有的读回另行记录。来源、provider 与 Host 的 current 快照在同一无回调任务中采集；各字段生命周期高水位单独呈现更短暂的局部峰值。40 页淘汰／重新上传计划仍须实际原生调用、成功就绪／读回、参考像素和清理证据。解码器内部、传输缓冲、物理 GPU 内存和垃圾回收不在这些逻辑测量范围内。
