# WebGPU 矩形实施计划——修订 0.6

**发布检查点历史与最终原生绑定：** 下文已接受956原生结果保留原身份；在 `1aa0248` 运行前检查点，仅注释重建绑定当时仍待执行。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。见[仅注释证明](../../evidence/webgpu-entry-comment-proof.json)、[整理验证](../../evidence/webgpu-verification.json)及[范围审查记录](../../evidence/webgpu-review.json)。

2026-10-09。[Complete English](../../en/docs/webgpu-rectangle-implementation-plan.md) · [完整规范合同](WebGPU矩形执行合同.md) · [实现证据](WebGPU矩形实现证据.md)

**目标：** 独立编写浏览器 WebGPU 矩形执行，以可审计生命周期及独立生产像素验收。

**架构：** 有界不可变帧复制与凸几何准备供给唯一首选格式生产 canvas pass；同一 encoder 复制该实际纹理读回。Engine 登记 surface，host close 证明 GPU 清理。

**工具链：** 已记录 Node 24.19.0、pnpm 11.25.0、TypeScript 7.0.2、WebGPU/WGSL，以及 Unlicense 下 robust-predicates 3.0.3 公开 orient2d。不增加内部包或类型依赖。这些是已记录实施输入，不是厂商性能声明。

## 已记录状态与计划读法

本五子系统计划保留实现及验收要求。条目是判据，不是重复执行已接受工作的指令。子系统 1 在 `ee24f9fb0f5bb103a1cb34b9cd9b5ba63bd28d42` 接受；集成子系统 2+3 及 R1–R4 闭环接受至 `c80d3f49aea64df2891418c0ae18d563bb5d2f9f`。子系统 4 内的数值 CPU 修复在 `956e2f9894dc8e27291ffd0210a6cd8b4e651eab` 取得范围内 SPEC/QUALITY 审查接受，聚焦 21/21、核心 177/177。子系统 4 的**完整有界原生 gate 在相同源码修订取得独立 SPEC/QUALITY 审查接受 PASS**，子系统 5 的完整证据/发布 gate 仍 PENDING。历史原生 FAIL 结果保留。

合同具有规范效力；证据记录说明实际执行、源码审查以及尚未观察的范围。历史 0.4 来源研究记录不作为当前原生证明。文档整理或结构性双语核对不等于发布或批准本里程碑。

随后已记录原生运行在 2026-10-08T20:17:25.506Z 报告 **PASS**，源码 `956e2f9894dc8e27291ffd0210a6cd8b4e651eab`、退出 0：42 帧、0 个必要样例失败、1709 次原始检查、84 张截图、6808 次合成检查、8 个预期失败反例、0 个意外错误。原样 F4 在两种读回配置及全部四种黑/白背景组合通过。完整有界原生任务随后在相同源码身份取得独立 SPEC PASS/QUALITY PASS。已接受原生结果与公开证据核对及发布 PENDING 是不同状态，证据记录保留原始运行/最终审查身份和限制。

## 全局约束

- 保留 RenderFrame2D 和 renderFrame(frame): undefined；root/runtime/contracts 无 DOM；engine → runtime/contracts、runtime → contracts。
- 公共工厂/类型仅在 @egret/engine/webgpu。导入/工厂不接触 canvas/GPU/调度器；surface 身份和选项/成员捕获保持稳定。
- 默认：pixelRatio 1；backing 16777216；commands 65536；clips 合计 262144；准备顶点 1048576；边测试 4194304；单帧上传 33554432 字节；待完成上传 67108864 字节和 2 帧；合计读回 67108864 字节；readback false；acquire device。固定多边形上限 1024、步幅 24、非零数值包络 2^-100..2^20。
- 全部预算是应用边界，另需实际设备限制及分配失败观察。不使用全局 epsilon、自制 expansion 系统，采用已致谢的基础谓词。普通近共线正例必须保持支持。
- close 安全成功才释放所有权；失败/不确定 close 沿用 Engine quarantine。未来 GPU 纹理资源不能直接继承当前 CPU 资源销毁顺序，必须另有在途生命周期证明；本阶段仅有 host 自有 GPU buffers 和浏览器拥有的显示纹理。
- 默认环境失败表示验收不完整，不用不安全 flags 或隐式软件 fallback，不宣称物理显示/性能/手机/UI/3D/迁移完成。

## 审查重点及文件地图

下列步骤明确验证五类风险：选项/frame getter 在读取中 close；异步/跨 realm 回调拒绝或回调返回 close；严格非零近共线与精确 no-op 的区别；queue/map 拒绝后的帧/读回生命期；禁用执行器或破坏裁剪/顺序后测试仍通过。

实施文件范围：`packages/engine/rendering/copyFrame2D.ts`、`prepareRectangles2D.ts`、`packages/engine/web/WebGPUHost.ts`、`webgpuPass.ts`、`tests/geometry-webgpu.test.mjs`、`tests/webgpu-host.test.mjs`、`tools/verify-webgpu.mjs`、`examples/webgpu/index.html`、`examples/webgpu/main.mjs`。新建 `packages/engine/web/webgpu.ts`，保持 `web/index.ts`、`CanvasHost.ts`、`copyCanvasFrame.ts` 原样。修改 engine manifest、lockfile，以及编译中立模块和独立 web 入口所需的现有构建/边界配置。向现有正/负 consumer fixtures 加 WebGPU 公共检查，不放松 root DOM 排除。要求完整双语合同/计划/证据记录，无需改写 Engine 所有权机制。

所需 `packages/engine/tsconfig.rendering.json` 严格遵循合同第 1 节：composite、types []、lib [ES2022]、rootDir rendering、outDir dist/rendering、tsBuildInfoFile tsconfig.rendering.tsbuildinfo、include rendering/**/*.ts、仅 reference contracts。在 `tsconfig.web.json` 增加该 reference，不改变 web rootDir/outDir 或 ./web 导出路径，web 导入 ../rendering/*.js。构建顺序及纯源码/声明边界/发布发现登记 rendering，root 仍仅 src。直接导入私有构建 helper 仅用于有理由的几何单测，不能替代公开生命周期/像素验收。已记录编译及负向 DOM consumer 检查证明有界 CPU 边界，实际回执值见证据记录。

## 子系统 1——中立复制、依赖及有界几何准备

**接口：** `copyFrame2D(input: unknown, options: {readonly pixelRatio:number; readonly maxBackingPixels:number; readonly maxCommands:number; readonly maxClipRectangles:number}): {readonly frame:RenderFrame2D; readonly width:number; readonly height:number}`。内部 `FrameCopyError` 带 readonly `reason:'invalid'|'backing'|'budget'` 和 cause。GPU copier 要求两个数量上限；自身验证错误须区别于原始输入 getter/分配异常，保留后者身份供后端映射，Canvas 共用复制推迟，不公开导出此类型。`prepareRectangles2D(frame:RenderFrame2D, width:number, height:number, options: {readonly pixelRatio:number; readonly maxPreparedVertices:number; readonly maxClipEdgeTests:number}): PreparedRectangles2D`。DTO 为 readonly `points:readonly {x:number;y:number}[]`、`commands:readonly {pointIndices:readonly number[];color:number;alpha:number}[]`、`edgeTests:number`；pointIndices 列凸多边形，不列场景节点。打包前对预计三角扇顶点数设限，固定多边形上限在内部。准备错误携带 `range|precision|budget` 及原 cause，适配器严格映射到合同错误码。

- 实施前编写缺模块/公共导出红测及有意义的固定几何断言，保存失败输出。缺模块只是功能级红证据，不证明每个断言均独立失败过。
- engine runtime 依赖精确固定 3.0.3；依赖安装禁用生命周期脚本，记录 lock integrity、许可证/类型和浏览器输出模块。检查公共根导入解析，保留许可通知；构建后才记录实际交付字节。采用已记录官方产物审计：40820 字节、版本 3.0.3、registry SRI 匹配、类型和 Unlicense 存在；不证明安装/运行或浏览器 bundle 大小。旧 registry 访问失败仅属历史，仍不声明 npm-latest。
- 按协议独立实现有界索引式 GPU copier，标量单读、增量上限；不复制整个 Canvas 例程、不修改已接受 Canvas 代码。原始 getter/分配 cause 与自身验证分开。增加 Canvas 回归：命令/clip 自定义迭代器；普通 Error getter -> CANVAS_RENDER_FAILED 且 cause 同一；getter 抛 EgretError 原样；无效值 -> CANVAS_FRAME_INVALID；backing 超限 -> CANVAS_BACKING_LIMIT。这些固定兼容性而不共用 copier。
- 实现合同规定的适配谓词、精确退化处理、端点规范排序、舍入 u/(u+v) 交点及第 4 节仅限 t===1 的受保护互补构造、拓扑拒绝和上限。几何无 DOM，不遍历 scene/runtime。
- 独立固定方形/菱形样例：subject [0,2]²，clip (0,-3),(3,0),(0,3),(-3,0)，预期交集 (0,0),(2,0),(2,1),(1,2),(0,2)，仅允许循环起点/方向规范化。
- 独立仿射 clip：局部单位方形，矩阵 a=20,b=-10,c=-10,d=-20,tx=-10,ty=6.5，subject [0,2]²；预期 (0,0),(2,0),(2,0.5),(0,1.5)。这些二进制可表示坐标必须精确匹配。再测边界 x+3y≤4、交点 2/3 与 4/3，使用仅测试端 BigInt 有理数 oracle，小样例坐标误差上限 8 ULP；此样例容差不是生产 epsilon。
- 加精确零宽/高、奇异矩阵、共线、边/角接触、分离 no-op；负缩放/反射、错切、逆向遍历及重复冗余 clip。验证矩阵行列式先于舍入角点拓扑。
- 正向近共线样例：rect x=1,y=1,width=8,height=2^-40；clip 矩阵 a=1,b=2^-30,c=0,d=1 配普通 8×8 矩形，再测反射/重复 clips。不得仅因薄或斜率而拒绝，float32 无采样坍缩可以接受并记录。加非二进制有理数嵌套 clips，独立记录构造位移；包括有效大平移 2^19 配有效小几何；2^21、2^-101 非零标量、非有限中间值、t 舍入至 0、其他无效/非有限参数或不可用互补权重、混合拓扑及各上限边界应以精确错误拒绝。 t===1 且有限 0<s=v/(u+v)<=0.5 的交点现在属于第 4 节正向构造，不再预期拒绝；原严格规则下的失败证据保留为历史。
- 使用仓库现有构建路径，运行 `node --test tests/geometry-webgpu.test.mjs` 及已有 Canvas 测试，均对构建产物执行。要求全部固定/正向/拒绝样例通过，Canvas 无新回归。不能把失败正例改成预期拒绝。若固定构造算法不能通过普通正例，停止提升验收，带具体样例返回审查数值修订，不能用 epsilon 隐藏或默默扩展范围。

## 子系统 2——启动、稳定捕获及终止生命周期

**集成归属：** 子系统 2 和 3 形成集成的 host/pass/生命周期设计及审查范围；两者之间不发布启动 stub、替代测试管线或公共测试 seam。WebGPUHost 拥有状态/权限，webgpuPass 负责打包/WGSL/编码；可用适度私有 scope-batch 和 submission-record helper 管理 push/pop 结果、buffer 结算及幂等清理，但不能独立改变 host 状态、提交工作或销毁借用设备。避免巨大 class 或泛化渲染框架。

**接口：** 在 `WebGPUHost.ts` 实现合同第 2 节全部公开签名/选项/状态/status/错误 union；纯 `getStatus()` 返回有界元数据快照。稳定保留 device/context/queue/自有 buffer 方法接收者。`webgpuPass.ts` 提供管线和编码；本子系统测试替身记录调用，不替代 GPU 验收。

- 生命周期红测断言导入/工厂没有 canvas/GPU/scheduler 读取；surface 不可变；getter 只读一次；仅 undefined 默认；无效选项和原 cause。跨 realm device-shaped/thenable 仅为防御边界测试，不认证原生设备支持。
- starting/active 返回同一 start Promise；start 前 stop；adapter/device/pipeline await 时 stop/close；晚到自有设备销毁/借用设备存活；取消后无 configure/submit；close 成功/拒绝均重复返回同一 Promise。
- getter 触发 render/stop/close 在下一次修改前生效，render busy 先于 frame getter。捕获后替换原选项 callback/canvas.getContext/device.queue 不得改变工作去向。测试资源方法 getter 中重入、push/pop 失败，并核对成功打开的 scopes 数量平衡。
- 实现默认 acquire、标签 borrow 租约、格式/limits 捕获、设备 loss/自有监听及 OOM/internal/validation push、逆序 pop；每个 Promise 立即观察，包括失败启动。各阶段分别使用 UNAVAILABLE、ADAPTER_UNAVAILABLE、DEVICE_FAILED、CONTEXT_UNAVAILABLE、FORMAT_UNSUPPORTED 和兜底 START_FAILED，均带 WEBGPU_；跟踪清理后，取消启动优先 START_CANCELLED。
- 实现有界失败/status/诊断。测试回调抛错、返回拒绝原生/跨 realm Promise、then getter 抛错的 thenable、返回 host.close()/whenIdle()；无递归诊断、未处理拒绝、GPU 失败污染或 close 死锁。验证回调计数饱和与 closed 后抑制。
- 实现 close CPU/startup 屏障和清理证明，不等待健康 device.lost 或用户回调 Promise。借用设备永不 destroy，自有最终 destroy 属预期；安全边界前 loss 导致 CLOSE_UNSAFE，Engine surface 登记保持不可用。Engine 超时后真正成功的延迟 close 释放登记。CPU assets 可以先销毁，因为本阶段 GPU 资源仅由 host 拥有。
- 增加拒绝证明测试：自有 buffer 的 fence 拒绝而 scopes 结算后，close 必须尽力清理恰好一次、进入 closed/unsafe 并拒绝 CLOSE_UNSAFE，不能永久 pending；再测 map 拒绝且 fence 已结算。以独立于成功退休的 outcome 屏障排空全部资源后续，不能 fail-fast 遗弃其他拥有者，close 不能等待仅成功退休。
- 对子系统 2 + 3 集成构建运行 `node --test tests/webgpu-host.test.mjs`。要求状态/调用顺序/错误/Promise 身份断言通过。模拟只证明生命周期，子系统 4 保留真实 loss 测试。

## 子系统 3——生产绘制、serial 台账及同目标读回

**接口：** `webgpuPass.ts` 内部 `packWebGPUVertices(prepared:PreparedRectangles2D,width:number,height:number,limits:{readonly maxUploadBytes:number;readonly maxBufferSize:number}): {data:Float32Array;ranges:readonly {firstVertex:number;vertexCount:number}[];collapsedTriangles:number;maxBackingDisplacement:number}`；`encodeWebGPURectangles(pass:GPURenderPassEncoder,pipeline:GPURenderPipeline,buffer:GPUBuffer|undefined,ranges:readonly {firstVertex:number;vertexCount:number}[],width:number,height:number):void`。shader/pipeline 创建在本文件私有，遵守合同第 5 节。host 负责纹理获取、pass descriptor、copy、submit、scopes 和资源台账。不增加测试专用生产导出或替代 shader。

私有打包验证采用 reason `precision|budget|device` 并保留原 cause；原始 CPU 分配异常交由 host 预检映射 FRAME_INVALID。limits 参数仅含已验证/捕获的基本值，不读取 GPU 对象或用户选项。输出 typed 存储分配前执行合同 3.1 节。

- 将已捕获的 `maxUploadBytes` 和实际 device `maxBufferSize` 传给生产打包器。实现合同 3.1 节有界普通数组转换/计数、精确字节限制检查、随后一次精确长度输出 Float32Array。准备代码/选项保持原样，仅允许另行审查的合同第 4 节数值修复；不能用预计三角扇字节代替实际存活打包字节，不能放松 CPU 上传限制。保留转换点位模式、扇内复用、命令顺序、坍缩/位移诊断和既有精度拒绝。
- 增加固定小型打包边界：单位变换、ratio 1、W=H=16、其他预算充分；普通 rect x=1,y=1,width=8,height=8 有两个存活三角形，V=6、36 个 float32 分量、144 字节。调用方 maxUploadBytes=143、device cap≥144 时，输出 typed 分配前拒绝 FRAME_BUDGET；调用方 cap=144/device cap=144 精确通过。调用方 cap≥144/device maxBufferSize=143 时，输出 typed 分配前拒绝 DEVICE_LIMIT。两项 cap=143 优先 FRAME_BUDGET。device cap=144 允许精确 buffer 申请；极小 device cap 属受控 mock/私有边界样例，不声称原生设备最小 limit 如此。
- maxUploadBytes=1 且独立准备/device/pending 限制充分时，接受 W=H=16 下 rect x=1,y=1,width=8,height=2^-40：两个扇形三角形均在 float32 坍缩，collapsedTriangles=2、V=0、byteLength=0。同样 cap 下空帧也通过，collapsedTriangles=0。两者仍清屏、各占一个 pending frame，上传零字节、不建 GPU vertex buffer。记录薄样例位移，不把 maxPreparedVertices 降为 floor(1/24)。增加坍缩/非坍缩混合保序帧以固定存活区间和坍缩诊断。
- 公开 host 测试断言每个打包预检拒绝均不改变每帧 canvas/GPU 修改计数（包括无 resize/configure/current-texture 获取/createBuffer/writeBuffer/编码/submit）、lastSerial 和 pending 预留不变、host active、已有 armed 读回仍未绑定。计数相对已完成 startup。原始 CPU 分配异常映射 FRAME_INVALID 且 cause 身份严格保留，不能吞成 no-op 或改为 FRAME_BUDGET/DEVICE_LIMIT。
- 明确通过生产源码顺序审查证明两项字节检查均先于输出 typed 分配；精确 cap 结果/错误测试本身不能证明该顺序。仅当确实连到实际分配器/错误路径、不增加公共/测试专用生产导出且不改公共签名时，允许窄私有几何单测探针或小型生产分配 helper。不承诺或要求不安全的全局 Float32Array 替换。明确哪些分配故障路径实际观察过、哪些由源码审查建立；不进行巨大分配压力测试，不从这些样例推导原生分配或性能声明。

- 编写打包/保序编码测试：24 字节布局、flat color、NDC y 翻转后的方向、共享顶点位模式、合法 float32 坍缩、符号翻转拒绝、空帧无 buffer、draw 区间保留命令顺序。
- 预算红测：配置边界精确值/超一值、实际 texture/buffer limit、包括纯清屏帧的全局 pending 预留、rowPitch 和 staging/output 合计、每类预检失败均无 surface/GPU 修改。模拟异步乱序完成，断言不提前退休或复用 serial。
- 实现独立 WGSL、唯一首选 rgba8unorm/bgra8unorm 管线、编码 sRGB 预乘混合、完整 clear、名义 DPR、尺寸读回和仅尺寸变化重新配置。不加 depth/stencil/MSAA、材质排序、镜像或离屏重画，只有 opt-in 才配置 COPY_SRC。
- 实现每帧新建 VERTEX|COPY_DST buffer 提交，分配/上传/编码/提交均在 scopes 内；修改前记录 serial；writeBuffer 后抛错仍 fence。立即观察 scope/fence 拒绝，维护有界台账、快照 whenIdle，乱序完成不丢 firstFailure。
- 实现 requestReadback armed、输入/背压拒绝后保留、修改时绑定、单 encoder/pass/copy/submit、MAP_READ|COPY_DST staging、去行 padding，仅 BGRA 交换 B/R。map 请求先于 queue fence，unmap 前复制，ticket 成功前资源安全退休；失败拒绝走已结算结果和尽力清理，不等待仅成功路径。stop 只取消未绑定 ticket。异步 map/scopes/fence 失败拒绝读回，不能报告绘制成功；仅 validation 绘制失败且证明成立时仍可安全清理，但 fence/map 证明拒绝必须锁定 unsafe。
- 运行两个新套件及已有核心检查，要求无修改、操作顺序、字节转换、状态、退休断言通过。模拟生命周期不算原生分配成功。

## 子系统 4——真实公开路径像素和浏览器合成

### 子系统 4 内已审查的数值修复（0.6）

原样强制 F4 公共层级在两种读回配置下曾于准备阶段失败。有界 CPU 诊断确定规范 P=(4,16)、Q=(15.999999999999998,28)，有向 A=(15.999999999999996,36)、B=(16.000000000000004,-4)，u=480、v=2^-46、sum=480、t=1。直接互补 s=v/sum 约为 2.960594732333751e-17；规定的反端点算术可以合法舍入至 Q。原严格规则失败保留为历史。

经审查修复现已在两种遍历方向通过实际生产准备，保持规范排序及相同 binary64 点位模式，并通过完整不可变公共 F4 capture → copy → preparation → packing。严格内部参数 2/3、4/3 固定位模式在正向/反向/重复裁剪下仍为 `3fe5555555555555`、`3ff5555555555555`。原精确端点、规范化、拓扑、包络、预算及薄/近共线/有理数样例保留。数值证据为聚焦 21/21、核心 177/177，范围内 SPEC PASS/QUALITY PASS。

完整 F4 CPU 输出为七个存储点、两个保序绿色/蓝色命令，edgeTests=336、打包 216 字节、区间 (0,3)/(3,6)、零坍缩三角形、最大 backing 重建位移 4.76837158203125e-7。这些诊断不能变成像素预期。cache-hit 对象身份及 t===0/无效行列式/参数/不可用互补权重仍为源码审查，未实际运行观察，须保留该限制。

原生验收仍须通过公开 Engine/WebGPU、enableReadback=true/false、默认启动运行完整原样 F4：绿色 (20,16)、透明 (10,16)/(26,6)、蓝色兄弟 (36,8)，开启时直接生产读回，以及黑/白背景浏览器合成。旧原生失败与新 source/build/harness 身份分开保留。后续失败须有界诊断、经审查修复及受影响复验，不能扩大容差、拟合 oracle、删除 F4 或扩大重写。

### 完整原生验收要求


**接口：** harness `node tools/verify-webgpu.mjs --playwright <installed-playwright-module> --channel msedge --output <result-directory>`。通过明确 import map/bundle 导入构建后的 `@egret/engine` 与 `@egret/engine/webgpu`，创建真实 Engine/host，先请求读回，再调用公开 Engine.renderFrame。私有几何结果单独测；像素预期不调用生产变换/裁剪工具。提供 favicon，记录意外 console/page/network/GPU 错误。

- 用静态依赖扫描和真实现有 Canvas 示例请求日志证明入口隔离：@egret/engine/web 仅 Canvas，不加载 WebGPU 或 robust-predicates 模块；新 @egret/engine/webgpu 的 types/import 分别映射 ./dist/web/webgpu.d.ts、./dist/web/webgpu.js，同包依赖不授权 eager reexport。内部 DAG 检查与精确外部依赖/根导入白名单分开。
- 固定样例页在 harness 隔离实现 no-op/错误顺序/移除裁剪反例模式。保存原产品构建 hash，反例不是接受的生产代码。信任 green 前，禁用/no-op 必须败于有色内部点，反序败于半透明重叠，移除裁剪败于菱形外但 AABB 内点。另测重复预乘、平移错误、不清屏、替换名义 DPR。逐个记录应失败的断言。
- 默认 headless Edge、新 profile、安全 loopback、**无额外 flags**。已保存可用性/clear 探针仅是前提。申请默认 adapter/device；null/unsupported/创建失败记录为验收不完整，不得 skip-as-pass。不默默强制软件/fallback 或加不安全 flags。
- 通过固定公开 ticket API 读取真实生产 current-texture，记录实际 source format。普通内部像素每通道容差 **2**；完全透明黑及适用的已知 clear 像素须精确零。人工预计算像素坐标，严格内外样例距预期边界至少 **1 backing 像素**，边界/DPR 诊断明确单列。

| 样例 | 独立预期 |
| --- | --- |
| Painter 顺序 | 不透明黑底红 .5 后蓝 .5，约 [64,0,128,255]；反序 [128,0,64,255]。 |
| 透明预乘 | 透明黑底同序，原始预乘 [64,0,128,191]；直通 alpha 的 Canvas 约 [85,0,170,191]，须比较同一表示。 |
| Clear/零 alpha | 非黑 clearColor 配 clearAlpha=0，及 alpha-zero 命令均为 [0,0,0,0]；红 clearAlpha=.5 为 [128,0,0,128]。 |
| 继承 alpha | 父 .5 × 子 .5 × 填充 .5 仅一次得到 .125；透明底红内部约 [32,0,0,32]。 |
| 仿射变换 | 父平移 (10,20)、缩放 (2,1)，子平移 (3,4)、旋转 90°，局部 rect (1,2,3,4) 四角 (12,25),(12,28),(4,28),(4,25)。反射/错切单独样例。 |
| 嵌套裁剪/兄弟 | 菱形 (16,4),(28,16),(16,28),(4,16) 与 x≥16 求交，中心 (20.5,16.5) 内，(10.5,16.5)、(26.5,6.5) 外。再加独立旋转祖先，未裁兄弟仍可见。 |
| 名义 DPR | 逻辑宽 10.2、ratio 1.5 得 W=16，坐标仍乘 1.5；独立选边界敏感标记识别 16/10.2 错误，区别于严格内点判据。 |
| Reset | 亮色/裁剪/半透明后空透明帧的全部读回像素清空，同尺寸和 resize 都测。 |
| 扇形接缝 | .5-alpha 矩形及裁剪凸多边形内部对角线无额外暗/亮线或洞；扫描跨接缝内部点，比较固定混合值，不比较 Canvas 外边抗锯齿。 |
| 快照 | 捕获不可变 A，修改/重挂源场景，向 host 直接提交 A 两次比较；公开 B 有变化。 |
| 分配/loss | 预算/device limit 修改前拒绝，scoped error/受控 device.destroy 显式失败；普通 close 后借用设备存活。受控 destroy 仅证明这条 loss 路径，不证明所有驱动重置。 |

- 独立比较适度有理数/Canvas 内外覆盖，外边缘/相邻命令接缝差异单独公布。不根据 GPU 输出调整预期几何，也不删除不便的普通近共线案例。
- 在已知黑/白页面背景上，浏览器有绘制机会后取得公开 canvas 截图。半透明内部合成、几何、reset、resize 对比固定预期颜色，容差 2，记录 CSS/backing/DPR 和截图比例。enableReadback=false/true 都测，防止配置分歧。canvas texture copy 成功不替代此证据；截图证明浏览器合成，不证明物理扫描输出。
- 验证一次受控 loss、真实在途读回 close、原生分配/scoped-error 观察。仅在明确命名的测试窗口允许预期错误，意外错误失败。不做巨大无界内存压力测试。报告分配失败，不从旧 Canvas 65536×1 结果推导可移植阈值。
- 保存 result JSON、RGBA dumps、截图和日志；原生要求是选定固定检查全通过且意外错误为零。即使单测通过，缺合成证据或默认启动失败仍是不完整验收。

## 子系统 5——审查、证据及发布交接

- 记录 source/build/lock/compiler/WGSL/harness hashes、精确 browser/Playwright 版本、启动 flags、secure-context/API/adapter/device 阶段、实际 limits、首选/实际 format、alpha/colorSpace、backing/CSS/DPR、各样例预期/观察像素及错误窗口。适配器元数据仅作报告，不认证加速。借用设备 adapter 元数据可缺失，写 unknown，不虚构 adapter。
- 记录数值接受/拒绝案例、构造误差、float32 位移/坍缩、接缝/边缘限制、CPU/mock/native 证据区别、外部依赖版本/许可/integrity 和交付身份。保留证据记录归纳的撤回设计方案及历史 CPU/Canvas 证据边界。
- GPU 独立准备集成后运行当前有意义的核心 gate、Canvas 回归，最终构建运行真实 WebGPU gate。要求范围内独立设计/实施审查并修复具体发现。新增修改后仅重跑受影响检查。
- 核对完整 EN/CN API 代码块、默认值、状态、错误码、读回/生命周期语义、限制和结果状态。任何已授权 push 前运行仓库要求的 `node tools/prepush.mjs`。检查成功属于审查证据，本计划本身不建立发布就绪状态。
- 只发布最终产物支持的有界结果。任何数值正例、生命周期安全、真实像素或合成 gate 失败/缺失，标记实验性/未完成并保留原因。不新增物理手机、性能、硬件加速、3D、纹理/文字/UI、迁移或完整引擎验收。
