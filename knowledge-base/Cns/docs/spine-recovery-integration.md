# Spine 应用设备恢复

中文 | [English](../../en/docs/spine-recovery-integration.md)

本次有界 M2.4 增量把普通 Spine RESET 示例接入既有共享 Host 恢复契约，不新增 SDK API、资源管理器、设备 session 或动画时钟。应用借用 Engine、Host 和 RESET slot；原生权限仍由既有 Host generation 票据决定，资源版本标签仅为元数据。

## 应用流程

示例 recovery-flow.mjs 协调单个当前意图。prepare 加载真实 RESET 候选、捕获不可变帧并交给既有 Host 暂存，等待真实上传就绪并记录设备 generation。commit 在 CPU 发布前确认 Host 就绪且 generation 相同。即使自有前驱清理抛出，或诊断回调取消／关闭 flow，也按真实票据的 committed 状态记录 CPU 发布结果；CPU 清理后再次检查当前意图、flow 生命周期与 Host generation。submit 在进入原生提交前重复最终检查。普通 replace 同步调用 commit 与 submit，中间没有 await；分开的教学按钮也使用同样的代际检查。

cpuPublished、nativeSubmitted、nativeSettled 分别描述该操作的不同领域。nativeSubmitted 在调用 submit 前从 false 变为 unknown，只有 Host 返回提交对象才变为 true。原生同步抛出可能发生在已发出绘制之后，因此保留 unknown，不撤销 CPU 发布，也不重放游戏事件。原生完成可以独立成功或失败。提交后取消会拒绝调用方的等待，但原始完成仍被观察，所有权仍归 Host。

replay 先取消当前未发布 RESET／上传，再等待同一个 Host 的 whenReady 屏障，捕获真正当前场景、在新 generation 暂存并显式提交。它不调用 RESET，不重建玩家，不重新获取 CPU 资源组，也不推进时间。若 CPU 已成功提交，即使首次原生提交失败，新活动玩家仍为权威状态。自有 WebGPU 使用既有自动恢复选项，WebGL2 使用原有上下文恢复；应用在原生恢复可用后显式调用 recover。Host 恢复失败沿用其原有手动重试规则，本示例不新增自动重试循环。

新的 prepare／replay、cancel 或 close 会撤销旧应用延续；迟到的就绪／完成不能覆盖新意图。取消／关闭会及时结束调用方等待，但不宣称原始原生工作已完成。Flow close 仅撤销自身未提交票据需求，借用 Engine／Host／slot；随后应用 close 按既有顺序关闭 owner、loader、Engine 与 Host。

## 时钟与所有权

原有 Engine GameClock 订阅仅在调用方显式 tick 时推进当前活动玩家及共享兄弟；不增加 RAF、定时器或恢复时钟。在短暂的捕获／暂存／提交窗口中，普通 Step 操作拒绝执行；加载期间调用方可继续推进游戏。显式 advance 保留给有意构造陈旧快照的演示。恢复测试在比较快照期间固定应用时钟，随后接受下一次显式 tick 验证事件继续消费。

CPU 快照保留轨道、选中皮肤、速率、经过时间、tick 标识和已消费事件观察。恢复保留原有实例和资源组；取消替换仅释放候选。关闭自有前驱或 flow 不会释放借用的初始玩家及共享兄弟。本范围为设备资源重建，不是跨版本保留状态替换、seek、物理回放或完整 Spine 验收。

## 验证边界

新增应用 UNIT 案例使用测试自有受控端口，覆盖 generation 变化、CPU 清理重入、原生发出后抛出的不确定性、完成失败、取消、替代与显式重试，仅证明应用顺序。既有真实 RESET 行为与未抑制的编译类型拒绝另行执行。

可选收集器 examples/spine-reset/verify-recovery.mjs 使用同一套原创双版本几何素材、真实公共 SDK、PNG 传输与共享 Host，仅在 Host 启动前安装已评审的 owned-requestDevice 观察器，原样转发调用／Promise、观察真实 lost Promise，在 Host 关闭与排空后完整恢复描述符。WebGL2 在自己的画布调用 WEBGL_lose_context，并确认可信丢失／恢复事件。每个 backend 四轮丢失覆盖借用活动非零状态、已就绪未提交候选、自有活动非零状态、CPU 已发布但未原生提交；另检查显式继续、取消、共享消费者与持有就绪上传时关闭。每幅图像使用五个固定像素点、单通道容差 1；快照／计数与像素证据分别记录。

使用 Node 26.7.0、Playwright 1.62.1、pngjs 7.0.0，以及默认有界面 msedge，不加额外启动参数：

~~~text
node examples/spine-reset/verify-recovery.mjs <absolute-playwright-index.mjs> <fresh-absolute-external-output>
~~~

启动前冻结完整输入闭包。收集器保留实际请求与 Node 侧输入身份、原始读回／截图、全部失败及原生清理观察。Playwright／pngjs 检查外部工具版本，并非工具发行包逐字节指纹。结果另记于 recovery-verification-summary.json。源码、受控行为、真实原生执行、独立评审、完整门禁与远程交付分别记录。这些受控真实入口不证明自发驱动、手机或原生 SDK 恢复；M1.2 的 10.3 ms／8 ms 性能结果仍 OPEN。不新增依赖或许可；第一方接入由 AI 辅助独立编写，采用 Apache-2.0，Core 4.3.13 原有独立许可保持不变。

### 已记录结果与生命周期修复

2026-11-04，默认有界面 Edge 156.0.4314.58 在两个 backend 各通过四次真实丢失／恢复、九次图像观察、活动／自有玩家快照与事件继续消费、陈旧 generation 拒绝、取消以及持有就绪上传时关闭。自有 WebGPU 观察器记录恰好五次真实设备获取，关闭后原生观察待结算为零，完整恢复描述符。应用 UNIT 为 14/14；RESET／类型／应用合并运行 35/35，相关 Host／session／暂存／账本／应用检查 111/111。这些有重叠的数字属于独立运行，不能相加为唯一测试数。

保留第一次真实运行的失败证据。WebGPU 持有就绪上传时的丢失暴露原有 Host 顺序缺陷：确认丢失后，原生 owner 标记失效，却在 CPU 保留账本失效前同步退休 stage；context-invalidated 结算因此进入仍 active 的账本并抛出，随后变成终止性的 unknown 所有权。最小修复将原有账本／cache 失效移到 stage 撤销前，保留已有 unknown 分支，也不把失效冒充原生销毁。相同四轮丢失方案随后通过。最初 WebGL2 夹具还在 lost 状态重新获取扩展，现改为持有原始真实扩展；未修改 WebGL2 产品实现。

收集器明确采用调整后的加载顺序：仅拦截本示例的精确 HTML 响应，移除 main.mjs 模块脚本，安装原生观察器后再导入未改写的应用模块。这不属于原始 HTML 未经修改的导航路径。另行重跑的原 RESET 收集器采用普通示例加载路径，两个 backend 均通过；其历史摘要保持不变。

最终应用还在外层就绪延续进入 commit、submit 或 phase 写回前绑定其原始意图。两项确定的原始 Promise 微任务控制此前观察到被取消的外层调用返回 FLOW_STAGE_FIRST／FLOW_COMMIT_FIRST；现在返回 FLOW_CANCELLED，新意图在自身显式 commit 前不受影响。未复现跨意图错误发布。明确该取消契约后，使用最终应用源码重新执行相同四轮原生丢失矩阵及原 RESET 浏览器回归，均通过。

最终收集器在 Node 侧将页面 evaluate 等待限定为 15 秒、最终快照探测限定为 2 秒、realm／浏览器／服务器关闭限定为 5 秒。截止后记录 incomplete／unknown，不使原始 Promise 完成，也不宣称 Host 已清理或描述符已恢复；继续观察迟到拒绝，realm 关闭单独记录。输入闭包及最终源码完整性失败保留到结果中，不再阻止已有失败记录落盘。Node author 实际执行的 contracts/resources 闭包独立于浏览器导航固定身份。一个测试自有、永不完成的页面 Promise 验证了收集器截止与 realm 关闭；该控制不创建 GPU，也不是原生丢失模拟。使用最终收集器再次执行相同四轮 backend 丢失矩阵，均通过。

## 整合交付证据

候选显示子树、CPU RESET 槽与应用恢复层现组成一个位于已合入 UI 基线之上的交付候选。产品实现是独立评审链与该基线的精确并集。M2.4 完整验收仍 OPEN。

原恢复采集器的 245 项实际输入及相邻 RESET 采集器的 243 项实际输入与当前候选逐字节一致，含重新生成的原创夹具资源；这里复用原观察，没有新跑设备丢失矩阵。原 RESET 的 242 项输入回执仍绑定其较早应用版本。候选子树回执的 144 项输入中，整链只改变 Host 产物和示例服务器，因此在整合候选上将原固定 WebGPU/WebGL2 场景重跑一次，全部 144 项实际执行输入均匹配新的运行前快照。公开摘要保留原回执，并单独追加本次整合记录。

有限源码／声明绑定与惰性策略夹具一并更新；历史 pin 和编译诊断元组保持不变。整包独立评审及受保护的完整集成 CI／合入仍与这些本地结果分开。
