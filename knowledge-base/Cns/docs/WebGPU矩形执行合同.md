# WebGPU 矩形执行合同——修订 0.6

**发布检查点历史与最终原生绑定：** 下文已接受956原生结果保留原身份；在 `1aa0248` 运行前检查点，仅注释重建绑定当时仍待执行。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。见[仅注释证明](../../evidence/webgpu-entry-comment-proof.json)、[整理验证](../../evidence/webgpu-verification.json)及[范围审查记录](../../evidence/webgpu-review.json)。

2026-10-09。修订 **0.6**，范围为实验性浏览器矩形执行。有界完整原生 gate 已独立审查为 **PASS**，公开证据核对及交付仍 **PENDING**。[Complete English](../../en/docs/webgpu-rectangle-execution-contract.md) 与本中文版均包含完整规范合同。[实施计划](WebGPU矩形实施计划.md)定义验收，[实现证据](WebGPU矩形实现证据.md)区分 CPU 证据、已接受有界原生结果及待完成公开交付。

0.6 保留 0.5 两遍打包的分配边界，仅改变规范参数 `t===1` 的受保护交点构造。严格 `0<t<1` 的算术及其他 API、默认值、入口、Canvas 兼容性、预算、拓扑、float32 和生命周期要求不变。帧复制/准备与集成 host/pass/生命周期实现继承已接受状态。源码修订 `956e2f9894dc8e27291ffd0210a6cd8b4e651eab` 的范围内数值修复取得 SPEC PASS、QUALITY PASS，已记录核心套件为 177/177。历史原生 F4 失败仍属于失败，CPU 修复不证明原生像素、浏览器合成或发布就绪。

随后已记录原生运行在 2026-10-08T20:17:25.506Z 报告 **PASS**，源码 `956e2f9894dc8e27291ffd0210a6cd8b4e651eab`、退出 0：42 帧、0 个必要样例失败、1709 次原始检查、84 张截图、6808 次合成检查、8 个预期失败反例、0 个意外错误。原样 F4 在两种读回配置及全部四种黑/白背景组合通过。完整有界原生任务随后在相同源码身份取得独立 SPEC PASS/QUALITY PASS。已接受原生结果与公开证据核对及发布 PENDING 是不同状态，证据记录保留原始运行/最终审查身份和限制。

## 1. 范围、位置和权威

执行现有不可变 `RenderFrame2D`，保留同步 `renderFrame(frame): undefined`。实际协议文件是 `packages/contracts/src/RenderFrame2D.ts`，不是 `render.ts`。核心/runtime 保持无 DOM，不遍历节点、不重算祖先 alpha、不重排命令、不改变 Engine 捕获语义、不扩大内部依赖 DAG（engine → runtime/contracts；runtime → contracts）。

不改变工厂/类型公开名称，仅从 opt-in `@egret/engine/webgpu` 导出，由 `packages/engine/web/webgpu.ts` 实现，package exports 的 types 指向 `./dist/web/webgpu.d.ts`、import 指向 `./dist/web/webgpu.js`。现有 `@egret/engine/web` 保持 Canvas-only，不重导出或预先加载 GPU/数学模块；root 也不导出 GPU 类型。这样保护微型 H5 基础加载量，并允许后续后端入口而不增加包/DAG 层。必须证明原 Canvas 导入/示例不请求 GPU 模块或 robust-predicates。

浏览器协调放在 `packages/engine/web/WebGPUHost.ts`，WGSL/pass 放在 `web/webgpuPass.ts`，无 DOM 准备放在 `packages/engine/rendering/{copyFrame2D,prepareRectangles2D}.ts`。本阶段已接受的 CanvasHost 和 copyCanvasFrame 代码**严格保持原样**，包括 for-of/自定义迭代器行为以及错误/cause 身份。Canvas 共用复制推迟至明确兼容性设计。根据协议独立编写有界索引式 GPU copier，不复制整个 Canvas 例程；可在内部使用小型纯标量 helper 而不修改 Canvas。私有 invalid/backing/budget 分类仅代表自身验证，任意 getter/分配异常保留原 cause；WebGPU 将预检输入读取失败映射 FRAME_INVALID 并保留 cause。准备几何使用 backing 像素坐标、RGBA 和保序区间，WebGPU NDC 打包留在适配器，供未来可能的 WebGL/native 复用而本阶段不实现它们。

固定构建位置：新增 `packages/engine/tsconfig.rendering.json`，继承现有 base，启用 composite、types []、lib [ES2022]、rootDir rendering、outDir dist/rendering、tsBuildInfoFile tsconfig.rendering.tsbuildinfo、include rendering/**/*.ts，仅 reference contracts。web 保持 rootDir web/outDir dist/web 及现有 ./web 目标，增加 rendering reference，由 GPU 模块使用 ../rendering/*.js 导入保证输出相对路径解析，仅增加上述 ./webgpu export。root engine 仍仅 src。构建顺序、边界/发布发现显式纳入 rendering 纯源码/声明，区别于 web 的 DOM 许可。内部包 DAG/reference 检查与外部 robust-predicates 精确包/根导入白名单分开；外部依赖不能自动转为 TS project reference。几何单测可直接导入私有构建 helper，公开生命周期/像素验收走 engine 加 engine/webgpu；窄例外不扩大公开导出。已记录 composite/NodeNext 编译及无 DOM consumer 结果属于有界 CPU 证据，见实现证据记录。

固定外部基础依赖：`robust-predicates` **3.0.3**，公开命名导出 `orient2d`，Unlicense。已记录的官方 npm 产物审计验证精确 40820 字节 tarball 与 registry SRI 一致，并确认公开 orient2d 声明、自带类型和 Unlicense 存在。旧 web 工具类型/registry 失败仅为历史，不再阻塞。实施仍需精确 pin/lock integrity；审计不证明 npm-latest、已安装/运行测试或浏览器 bundle 大小。使用已致谢的公开基础 API，不允许内部依赖路径、fast 谓词、自制 expansion 系统或产品有理数子系统。TypeScript 7.0.2 已含 GPU 声明，设计引用审计本身未安装或运行依赖，当前实施证据另行记录。

Canvas 兼容性包括：普通非 Egret getter 异常包装为 CANVAS_RENDER_FAILED 并保留原 cause；getter 抛出的 EgretError 原样传播；命令/clip 自定义迭代器保持当前行为。GPU 索引遍历不重新定义 Canvas 合同。host/pass/生命周期协调采用集成设计；私有 scope-batch/submission-record helper 可跟踪结果/自有清理，但只有 WebGPUHost 控制状态/提交/所有权，helper 不销毁借用 device。异步 pipeline 创建独立观察，任何 await 前先 pop scopes。

## 2. 固定的浏览器公共 API

```ts
export type WebGPUHostState =
  'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed';
export type WebGPUHostErrorCode =
  'WEBGPU_OPTIONS_INVALID' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_ADAPTER_UNAVAILABLE' |
  'WEBGPU_DEVICE_FAILED' | 'WEBGPU_CONTEXT_UNAVAILABLE' | 'WEBGPU_FORMAT_UNSUPPORTED' |
  'WEBGPU_START_FAILED' | 'WEBGPU_START_CANCELLED' | 'WEBGPU_NOT_STARTED' |
  'WEBGPU_STOPPED' | 'WEBGPU_CLOSED' | 'WEBGPU_FAILED' | 'WEBGPU_REENTRANT' |
  'WEBGPU_FRAME_INVALID' | 'WEBGPU_BACKING_LIMIT' | 'WEBGPU_GEOMETRY_RANGE' |
  'WEBGPU_PRECISION_UNSUPPORTED' | 'WEBGPU_FRAME_BUDGET' | 'WEBGPU_BACKPRESSURE' |
  'WEBGPU_DEVICE_LIMIT' | 'WEBGPU_SERIAL_EXHAUSTED' | 'WEBGPU_RENDER_FAILED' |
  'WEBGPU_VALIDATION' | 'WEBGPU_OUT_OF_MEMORY' | 'WEBGPU_INTERNAL' |
  'WEBGPU_SCOPE_FAILED' | 'WEBGPU_QUEUE_FAILED' | 'WEBGPU_DEVICE_LOST' |
  'WEBGPU_UNCAPTURED_ERROR' | 'WEBGPU_READBACK_DISABLED' | 'WEBGPU_READBACK_PENDING' |
  'WEBGPU_READBACK_FAILED' | 'WEBGPU_DIAGNOSTIC_CALLBACK_FAILED' | 'WEBGPU_CLOSE_UNSAFE';
export interface WebGPUHostFailure {
  readonly code: WebGPUHostErrorCode;
  readonly serial: number | null;
  readonly phase: 'startup' | 'frame' | 'readback' | 'device' | 'cleanup' | 'callback';
  readonly cause: unknown;
}
export interface WebGPUHostDiagnostic extends WebGPUHostFailure {
  readonly severity: 'error';
}
export interface WebGPUHostOptions {
  readonly canvas: HTMLCanvasElement;
  readonly device?: { readonly kind: 'acquire' } |
    { readonly kind: 'borrow'; readonly device: GPUDevice };
  readonly pixelRatio?: number;
  readonly maxBackingPixels?: number;
  readonly maxCommands?: number;
  readonly maxClipRectangles?: number;
  readonly maxPreparedVertices?: number;
  readonly maxClipEdgeTests?: number;
  readonly maxUploadBytes?: number;
  readonly maxPendingUploadBytes?: number;
  readonly maxPendingFrames?: number;
  readonly maxReadbackBytes?: number;
  readonly enableReadback?: boolean;
  readonly onDiagnostic?: (diagnostic: WebGPUHostDiagnostic) => unknown;
}
export interface WebGPUReadback {
  readonly serial: number;
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly format: 'rgba8unorm';
  readonly sourceFormat: 'rgba8unorm' | 'bgra8unorm';
  readonly colorSpace: 'srgb';
  readonly alphaMode: 'premultiplied';
  readonly bytes: Uint8Array;
}
export interface WebGPUHostStatus {
  readonly state: WebGPUHostState;
  readonly lastSerial: number;
  readonly pendingFrames: number;
  readonly pendingUploadBytes: number;
  readonly pendingReadbackBytes: number;
  readonly firstFailure: WebGPUHostFailure | null;
  readonly callbackFailureCount: number;
  readonly lastCallbackFailure: WebGPUHostFailure | null;
  readonly cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe';
}
export interface WebGPUHost extends RenderHostAdapter {
  readonly surface: HTMLCanvasElement;
  start(): Promise<void>;
  stop(): void;
  close(): Promise<void>;
  renderFrame(frame: RenderFrame2D): undefined;
  whenIdle(): Promise<void>;
  requestReadback(): Promise<WebGPUReadback>;
  getStatus(): WebGPUHostStatus;
  setTimeout(callback: () => void, delayMs: number): () => void;
}
export function createWebGPUHost(options: WebGPUHostOptions): WebGPUHost;
```

错误使用 `EgretError(code, {cause})`，保留原始抛出/拒绝原因以及 Engine 现有 `FRAME_RENDER_FAILED` 包装。`firstFailure` 仅保留首次终止性的启动/后端失败；输入、背压、误用不使 host 失败。回调失败使用独立的有界字段。状态/诊断元数据是冻结快照，任意 cause 保留身份，不遍历/冻结其对象。读回元数据冻结，`bytes` 是调用方拥有的可变副本。不保存无限增长的诊断历史。

工厂/导入仅执行纯模块定义及选项复制验证。每个选项和嵌套策略字段读一次，保存 canvas/device/callback 身份及基本值。仅 `undefined` 使用默认值；拒绝 null、错误标签/类型、非有限/非正 ratio、非正/非安全整数预算。构造时 canvas 和借用 device 必须是非空对象，原生可用性在 start 检查。工厂不读 canvas 方法/属性、navigator/GPU、device 成员、调度函数，不申请资源。surface 固定不可写/不可配置且严格等于传入对象。未知选项不枚举、直接忽略。getter 异常包装为含 cause 的 `WEBGPU_OPTIONS_INVALID`。

start 时一次捕获 canvas/context、GPU provider、device、queue 方法和所需 limit 值并保留原接收者。每次外部读/调用都可能抛错或重入：随后以及下一次修改前检查状态/代次。后续创建的每个自有资源也仅捕获其方法一次；不重读可变选项、设备策略、回调、queue 或 canvas.getContext。伪造 GPU 或外部破坏性修改不属于支持的原生环境，但不得绕过终止提交闸门。`setTimeout` 首次使用时才捕获全局 set/clear 函数及接收者，stop/close 后仍可供 Engine 截止计时使用。导入/工厂/start 不调度工作。返回的取消函数同步幂等；host 计时器由调用方控制，不证明 GPU 清理完成。

## 3. 默认值、验证和有界工作

| 选项 | 默认值 |
| --- | ---: |
| pixelRatio | 1 |
| maxBackingPixels | 16777216 |
| maxCommands | 65536 |
| maxClipRectangles | 全帧合计 262144 |
| maxPreparedVertices | 1048576 |
| maxClipEdgeTests | 4194304 |
| maxUploadBytes | 33554432 |
| maxPendingUploadBytes | 67108864 |
| maxPendingFrames | 2 |
| maxReadbackBytes | 67108864 |
| enableReadback | false |
| device | {kind:'acquire'} |

以上是应用边界，不是设备保证或性能声明。每个多边形另有固定上限 **1024** 顶点。一次 clip-edge test 是一个待裁顶点对一条有向裁剪边的分类；统计实际执行的每次分类，包括裁剪后用同一谓词执行的验证/方向检查。未检查的乘积、生成数量、数组长度或字节和不能驱动遍历/分配。命令/裁剪数组长度须为安全整数，保存长度，用索引逐项读取一次而不使用用户迭代器；即使 alpha/几何最终不产生像素，也复制全部命令/裁剪。裁剪总数包括不活动/空链。增量多边形/边测试/顶点限制防止二次复杂度逃过预算。CPU 分配失败显式作为预检帧失败，不转换为空覆盖。

协议验证：frameId 为正安全整数，逻辑宽高为正有限数；颜色为 0..0xffffff 整数；alpha 在 0..1；六个矩阵分量及矩形 x/y 有限、宽高非负；kind 严格为 `rect`；要求数组。检查 right/bottom、变换角点中的每次乘法/加法、名义 DPR 乘法及后续构造值有限。W=ceil(width*ratio)、H=ceil(height*ratio)，均为正安全整数且 ≤4294967295；先除后乘验证 W*H≤maxBackingPixels。无效输入→FRAME_INVALID，backing 超限→BACKING_LIMIT，几何包络→GEOMETRY_RANGE，构造不一致→PRECISION_UNSUPPORTED，配置的工作/存储边界→FRAME_BUDGET。各错误均带 `WEBGPU_` 前缀。

核对实际 device 的 maxTextureDimension2D 与 W/H、maxBufferSize 与每个 buffer；要求 maxVertexBuffers≥1、maxVertexAttributes≥2、maxVertexBufferArrayStride≥24、maxColorAttachments≥1、maxColorAttachmentBytesPerSample≥4。不申请可选 feature 或提升 requiredLimits。u32 顶点数量/区间参数另限于 4294967295。上传 GPU buffer 容量计入上传及待完成上传预算；CPU typed data 同样受单帧上传预算约束，但不算 GPU pending bytes。零顶点帧不分配 vertex buffer。读回预算统计全部在途 ticket 的 staging 容量**加上**紧密输出容量；移交输出所有权后解除其计费。第一次 canvas/GPU 修改前预留全部 pending 容量，纯清屏帧也占 pending-frame。同步拒绝 `WEBGPU_BACKPRESSURE`，不丢帧/合并/重排。仅在实际退休后释放预留，不能在 renderFrame 返回时释放。

### 3.1. 私有打包的分配边界（0.5 修订）

打包器接收调用方已验证的 `maxUploadBytes` 及实际 device 已捕获的 `maxBufferSize` 基本值。在分配任何输出 `Float32Array` 或其底层存储之前，先按第 4 节 float32 转换/方向/坍缩规则确定实际存活三角形数量，再用精确输出容量核对两项限制。host 仅在打包之后检查不满足 CPU 边界。不得按上传字节推导的数量收紧 `maxPreparedVertices`：准备阶段既有独立工作上限不变，预计三角扇顶点合法坍缩后可以零字节上传。

在私有打包器内使用两遍处理。第一遍按既有 NDC 表达式用 `Math.fround` 对每个不同的已准备点仅转换一次，以已准备点身份为索引，将转换结果保存在普通 number/point 数组。这些可精确表示为 float32 的数保证三角扇复用时最终写入的位模式一致。对每个候选三角形仅执行一次既有有限性/方向检查，只保留存活三角形的索引三元组，保持输入命令/扇形顺序，并累计每命令区间、坍缩数量和最大 backing 重建位移。即使三角形坍缩，其转换点仍计入位移诊断。点/索引/区间暂存数组受已执行的准备点、预计三角扇和命令数量上限约束；转换/计数不分配 typed 暂存 buffer，不扩大预算，不改变数值算法。

令 V 为实际存活顶点数。每次数量/区间递增均核对安全整数，核对既有 u32 draw/区间上限（违反为 DEVICE_LIMIT），并在计算 `uploadBytes = V * 24` 前确认 V ≤ floor(Number.MAX_SAFE_INTEGER / 24)；不安全的存储字节数为 FRAME_BUDGET。先检查 `V > floor(maxUploadBytes / 24)`（FRAME_BUDGET），再检查 `V > floor(maxBufferSize / 24)`（DEVICE_LIMIT）；两项字节限制同时违反时，调用方预算错误优先。错误均带既有 WEBGPU_ 前缀。步幅 24 无须 padding：V 非零时，申请的 GPU vertex-buffer 容量和 CPU 输出 byteLength 均严格为 uploadBytes。全部检查先于输出 typed 分配及每帧任何 surface/GPU 修改。

第二遍严格分配 `new Float32Array(V * 6)`，根据保留的转换点与存活索引填充，沿用每命令预乘颜色/布局。物化时不重新转换点、不重新夹取坐标、不重算三角形方向/坍缩。V=0 允许零长度输出，上传零字节且不创建 GPU vertex buffer；沿用既有纯清屏、pending-frame、读回和退休规则。host 在首次修改前按精确 GPU 容量预留，不新增 pending-CPU 计费。

私有打包验证 reason 为 `precision|budget|device`，分别映射 PRECISION_UNSUPPORTED、FRAME_BUDGET 和 DEVICE_LIMIT。两遍内任意 CPU 分配异常均保留为原始异常，不是私有验证错误；预检映射 FRAME_INVALID 并保持原 cause 身份，host 仍 active，armed 读回仍未绑定，不发生每帧 surface/GPU 修改。不能将分配失败变为空覆盖。本修订不增加公共选项/类型/错误码、测试 seam 或 device 能力要求。

## 4. 固定数值算法与限制

这是有界 float64 几何，不是任意有限数的精确几何。固定数值包络为 **0 或 2^-100 ≤ abs(value) ≤ 2^20**，适用于矩阵/矩形标量输入、DPR、其非零角点构造算术中间值、变换后的 backing 点及新构造点分量。逻辑帧尺寸另遵守 backing 规则。包络外整帧以 GEOMETRY_RANGE 拒绝，包括不可见命令；负零规范为零。谓词内部、行列式估计 u/v、插值 t/s、NDC 和颜色算术不使用坐标包络，而遵循下文各自明确的有限/符号/区间检查。明确拒绝极端缩放/平移/消去，不要求方向谓词修复溢出/下溢。这是需要样例验证的应用支持范围，不是已经证明的通用误差界。禁止全局 epsilon、近共线角度阈值、网格吸附及固定像素位移拒绝门槛。

使用 `sign = -Math.sign(orient2d(ax,ay,bx,by,cx,cy))` 转为传统代数叉积符号。固定 (0,0),(1,0),(0,1) 的适配符号必须为 +1。检查谓词返回值有限；意外非有限/零值矛盾拒绝为精度问题。符号分类对象是已表示的 binary64 点，大小仅是舍入后的行列式估计。矩阵稳健行列式为零（orient2d(0,0,a,b,c,d)==0），或矩形宽/高为零，则图元无覆盖；退化裁剪移除该命令。该检查在完整输入/算术预检之后、角点拓扑判断之前进行，避免精确奇异变换因角点舍入产生人工面积。

局部角点顺序为 (x,y),(right,y),(right,bottom),(x,bottom)，使用 `((a*x)+(c*y))+tx` 和 `((b*x)+(d*y))+ty`，再分别乘名义 DPR。非退化多边形规范到适配符号为正的方向。删除精确相同的相邻点（包括首尾重复）；仅当共线中间点在两个坐标上都位于相邻点之间时删除。不足三个不同点或全部共线是支持的 no-op。混合转向符号、非相邻重复点，或非退化变换矩形凸性不一致，都拒绝为精度问题。

按输入 clip 顺序逐边与规范方向的裁剪多边形求交，最后裁到 viewport [0,W]×[0,H]，使用闭半平面（适配符号≥0）。边界端点原样保留，仅对严格非零异侧端点生成交点。求交前按 x 然后 y 的字典序排序线段端点，使反向遍历使用完全相同的算术。计算 `u=abs(orient2d(A,B,P))`、`v=abs(orient2d(A,B,Q))`，要求 u>0、v>0 且两者有限。计算 `sum=u+v`、`t=u/sum`，要求 sum、t 有限。严格 `0<t<1` 时保留既有逐分量运算顺序及位模式：`I=P+t*(Q-P)`。仅当 `t===1` 时直接计算 `s=v/sum`，绝不能使用 `1-t`；要求 s 有限且 `0<s<=0.5`，再逐分量按该顺序构造 `I=Q+s*(P-Q)`。其他 t 或无效互补权重均拒绝为精度问题，包括 t 舍入为 0。两条构造路径使用相同坐标包络及端点闭区间 min/max 分量检查。允许构造的 I 经舍入后等于端点；这不是直接替换端点、钳制、容差或吸附规则。一次裁剪边处理内按精确无序端点对缓存交点，共用同一 I 对象；生成三角扇时复用存活点。不得把谓词大小当作精确面积，也不得宣称交点是精确有理数。

每条边后执行上述去重/共线规范化及凸性检查，拓扑无效就拒绝，不能伪装为空几何。**不**要求舍入生成的 I 对其生成直线的谓词恰好为零，否则普通交点也会被拒绝。生成边界的小位移是明确的光栅边缘限制，必须用独立有理数样例测量。无需构造交点的精确共线/接触表示案例仍为精确 no-op。多次舍入后的近接触可能因拓扑拒绝或产生亚像素覆盖，不承诺任意实数意义的接触仍精确。包络内的普通近共线正样例必须通过计划验收，不能仅凭分类谓词宣布成功。

各凸结果独立扇形三角化，不合并命令。保持 backing 坐标到 GPU 打包阶段；每个不同点仅一次转换为 float32 NDC `(2*X/W-1, 1-2*Y/H)`，所有三角形复用该点的位模式。y 翻转使预期方向反转。非有限转换或非零三角形符号反转均拒绝。float32 零面积三角形属于支持的无采样几何并省略，不能拒绝所有窄/薄形状。测试产物记录 float32 坍缩及重建 backing 像素的最大位移，不新增公共失败阈值。每命令生成连续区间，保持 painter 顺序，仅跳过合法零顶点区间。扇内共享顶点严格相同；不同相邻命令独立裁剪的边界不承诺普遍无缝。

## 5. 单一生产绘制、颜色与读回

独立编写 WGSL，把 vec2<f32> position 转为 vec4(position,0,1)，将 flat 常量预乘 RGBA 传至 fragment 输出。顶点步幅 **24** 字节：offset 0/location 0 为 float32x2 位置，offset 8/location 1 为 float32x4 颜色。flat 插值避免无必要的片元颜色舍入。triangle-list，无 index/uniform/bind group，无 depth/stencil，cullMode none，sample count 1，alphaToCoverage false，开启全部颜色通道。显式 viewport/scissor 覆盖 W/H，完整 pass 状态设一次，按输入顺序 draw 区间。

RGB 是 sRGB 编码整数/255，只乘一次已经继承的 command alpha；clear RGB 同样预乘，零 alpha 为透明黑。颜色**和** alpha 混合均为 operation add、srcFactor one、dstFactor one-minus-src-alpha。这是编码通道 source-over，不是线性光混合。规范字节语义为 rgba8unorm。start 捕获 `navigator.gpu.getPreferredCanvasFormat()`，仅接受 `rgba8unorm` 或 `bgra8unorm`，构建唯一一条针对实际格式、其他配置相同的管线。其他格式拒绝，不使用 -srgb view。BGRA UNORM 仅改变存储顺序，不改变 RGBA 着色器/混合算术。配置 colorSpace srgb、alphaMode premultiplied；usage 为 RENDER_ATTACHMENT，仅 enableReadback 时加 COPY_SRC。不需要诊断镜像、规范离屏目标、重复 draw pass 或无关测试着色器。

完整预检/预留后，仅在尺寸变化时写 canvas.width/height，读回且要求严格 W/H。start 和尺寸变化后用捕获的配置 configure，每个外部边界复查终止状态。每个接受帧通过 loadOp clear/storeOp store 清除**全部** attachment，包括向上取整多出的像素，并在该同步调用内重新取得 current-texture 引用。浏览器在过期前可能对多次调用返回同一纹理对象，host 不得保证每帧不同对象。同步编码/提交调用结束后或跨 await 不保留/使用 current texture。空帧仍清屏；同尺寸完整重置依赖 clear，不依赖 Canvas2D 重置语义。

`requestReadback()` 为 opt-in，仅 active 可用并返回 Promise；所有误用均以 Promise 拒绝。最多一个 armed 或 in-flight ticket：未开启→READBACK_DISABLED，已有 ticket→READBACK_PENDING，其他使用对应状态错误。它绑定**下一次通过预检的帧**，本身不提交。输入/背压拒绝后 ticket 仍 armed；接受尝试发生首次修改时才绑定预留 serial/frameId，之后失败拒绝该 ticket。stop/close 用 STOPPED/CLOSED 拒绝尚未绑定的 ticket；已提交 ticket 除非帧失败，允许正常结束。调用模式为 `const pixels = host.requestReadback(); engine.renderFrame(options); const result = await pixels;` 内部立即观察拒绝，忽略 ticket 不产生未处理拒绝，但调用者仍收到原始拒绝。

预先计算并验证安全整数：`rowPitch=ceil((W*4)/256)*256`、`stagingBytes=rowPitch*H`、`outputBytes=W*H*4`；修改前将两种容量都计入 maxReadbackBytes。创建 MAP_READ|COPY_DST staging buffer。在**同一生产 render pass** 后，从**同一 current canvas texture** 向**同一 command encoder** 追加 copyTextureToBuffer，bytesPerRow=rowPitch、rowsPerImage=H、extent W,H,1；仅 submit 一次，不需要 host 自有目标纹理。提交后调用 mapAsync(READ) 并立即观察，然后建立 queue fence（在 map 请求之后）。完成前保留自有 buffers，不保留 current texture。unmap 前复制映射行到紧密 RGBA 输出，仅 bgra8unorm 交换 B/R；不做反预乘、传递函数转换、行翻转或 padding 复制。map、queue fence、关联 scopes 全成功且 buffer 退休后才 resolve；错误/loss 拒绝。返回左上原点逐行数据。这证明生产目标像素，不证明浏览器合成或物理显示；经过浏览器绘制机会后的真实截图仍需单独验收。

## 6. 生命周期、作用域和清理权威

new 调用 `start()` 时先缓存唯一 Promise，再进入 starting、获取 context/device/pipeline；设备一到立即安装 loss/error 观察，检查 limits、configure，启动 scopes 干净完成后才能 active。starting/active 重复 start 返回同一 pending/settled Promise。acquire 用捕获的 navigator.gpu.requestAdapter()，随后 adapter.requestDevice()，均使用默认选项、不要求可选 feature/limit；null adapter 为 ADAPTER_UNAVAILABLE。borrow 严格使用指定 device 和捕获的 device.queue，不接受无关 queue。借用 device/queue/context 从 start 到 close 需要调用方合作授予独占使用权；外部提交、scope 操作、context 重新配置或销毁 device 均违约，host 无法跨其他库强制。申请设备归 host，借用设备永不销毁。context 不可用包括已有其他 context mode，不原地切换模式作为 fallback。

stop 同步幂等：new/starting/active→stopped，关闭提交入口并取消未绑定 ticket；failed 保持 failed，closing/closed 不变。启动取消最终以 START_CANCELLED 拒绝，每次 await 后检查代次。晚到的自有设备仍被观察并在 close 清理，不能配置 surface；晚到借用设备保持完整。stopped/failed/closing/closed 后 start 返回 STOPPED/FAILED/CLOSED 拒绝（closing 用 CLOSED），不重启。render/requestReadback 要求 active；new/starting→NOT_STARTED，failed→FAILED 并带首次 cause。render **读取任何 frame 前**设置 busy，重入 render→REENTRANT。getter 触发 stop/close 后，在下一 host 修改/提交前中止；回调不能重新开启终止闸门。

每次进入修改的尝试预留递增正安全 serial；抛错也不复用，frameId 不是 GPU 代次。序号耗尽在修改前拒绝。启动和每次修改尝试按 **out-of-memory、internal、validation** 顺序 push scopes；finally 中按逆序 pop 实际成功 push 的数量，立即安装成功/拒绝处理器。scopes 打开时不能 await。GPU 创建/编码/writeBuffer/submit/configure 均在 scopes 内。结果关联启动（serial null）或具体 serial，不按 Promise 完成顺序归属。validation/OOM/internal 使用对应错误码，pop 拒绝为 SCOPE_FAILED。用 addEventListener 安装 device uncapturederror，不替换他人的监听；uncaptured error 终止 host。立即处理 device.lost 为 DEVICE_LOST，安全清理后主动销毁自有设备除外。close 不等待健康设备永远 pending 的 device.lost。

render 同步复制/准备/预留，非空上传新建 VERTEX|COPY_DST buffer、编码、提交、建立台账并返回 **undefined**，禁止 async renderer/thenable。预检后同步修改异常→RENDER_FAILED 且终止，不承诺回滚；queue 拒绝→QUEUE_FAILED，map/copy 失败→READBACK_FAILED。异步失败关闭闸门、保留 firstFailure、拒绝受影响 waiters 并安排诊断。每个 serial 都有**区别于成功资源退休的 outcome-settlement 屏障**；所有 host 自有 fence/scope/map 后续结算后，无论成功失败，该屏障均结算且绝不等待公共 close。观察/排空全部结果，不能用 fail-fast Promise.all 遗弃其他资源拥有者。成功允许正常退休；fence/map 拒绝、scope 证明破损或其他无法证明完成的情况锁定 unsafe，并保留所有权/预算到尽力清理。writeBuffer 后无 submit 仍 fence。真正未结算的驱动操作可保持 pending，已结算拒绝不能造成等待仅成功退休的死锁。

`whenIdle()` 保存调用时 lastSerial、当前 startup Promise 和现有台账；后续普通提交不属于该快照。new 无工作直接成功，starting 等待启动，stopped 等待已接受工作，failed 拒绝 firstFailure，closing 等待所捕获工作（不虚构显示 fence），closed-safe 若无先前渲染失败则成功，closed-unsafe 拒绝 CLOSE_UNSAFE。捕获 serial/startup 失败，或 settlement 前设备级 loss，均拒绝；已成功结算结果不可撤销。已退休成功项无需保留，只保留累计首次终止失败及有界 pending 台账。成功只说明捕获的 queue 工作/scopes/readback 处理器成功完成，不说明显示器扫描输出。

诊断回调在微任务中执行，必须先稳定台账并关闭所有同步打开的 scopes。回调身份只捕获一次，用 undefined 接收者调用；隔离同步异常。返回值用 Promise.resolve 同化并立即安装拒绝处理器；跨 realm Promise/thenable 及抛错 then getter 不能泄漏未处理拒绝。回调失败使有界安全整数计数递增（到 Number.MAX_SAFE_INTEGER 饱和），以 DIAGNOSTIC_CALLBACK_FAILED 替换 lastCallbackFailure；**不**递归报告给同一回调，也不变成 GPU 失败。close 不等待用户返回 Promise，回调返回 close()/whenIdle() 不能死锁。回调后续可在 close 后更新纯诊断计数，但不能持有 GPU/context 权限；closed 后抑制尚未送出的回调。最终拆除监听阶段不再调度新回调。

`close()` 在任何重入前缓存 Promise，进入 closing、关闭闸门、拒绝未绑定 ticket，等待 startup 获取/回滚、活动 CPU finally 屏障及**已跟踪结果/CPU 后续全部结算**，绝不等待仅成功退休。startup 记录失败并释放屏障，不得 await 正等待自己的公共 close。结果全部结算后选择安全/不安全清理；拒绝证明走尽力分支，清理尝试完成时对本地所有权/预算恰好退休一次并拒绝 CLOSE_UNSAFE，此台账退休不证明安全归还或成功绘制。host 无内部超时。正常 close 在最后 host queue 工作后取得最终 fence，要求成功且无意外 loss，unmap/destroy 自有 buffers，仅 unconfigure 租用 context、移除自有监听，再仅销毁申请设备。证明边界前复查 loss，主动最终销毁自有设备不算渲染失败。晚到获取须清理后才结算。未取得 device/工作只需安全本地清理。startup/render validation 失败本身可在 fence/scopes 完成且归还可证明时安全清理。Engine 先销毁 CPU assets 仅因 GPU 资源归 host 才有效，未来纹理需独立在途协议。

意外 device loss、完成证明拒绝、scope 台账破坏、清理抛错或无法证明安全归还时，尽力清理自有资源并以含原因的 CLOSE_UNSAFE 拒绝；cleanupOutcome=unsafe、state=closed。正常 close 为 safe/closed。不销毁借用 device，不移除 canvas，不清他人监听，不把 loss/map 拒绝/timeout 转为成功绘制或安全 close。所有重复 close 返回严格同一 Promise，包括拒绝。驱动/获取挂起可使其一直 pending；Engine 超时只拒绝调用者，不取消或释放。现有 Engine 对 close 拒绝继续 quarantine，真正成功的延迟 close 可按当前规则释放。渲染失败与清理结果是两件事，不新增强制释放 API。

## 7. 证据边界

保存的纯环境探针时间为 2026-10-08T16:37:08.788Z（本地日期 2026-10-09），报告 Edge 154.0.4258.62、Playwright 1.62.1、headless msedge、无额外 flags、安全 loopback、首选 bgra8unorm、maxTextureDimension2D 8192、maxBufferSize 268435456。适配器报告元数据为 nvidia/blackwell/isFallbackAdapter=false，不认证硬件加速。另一个 4×4 rgba8unorm 常量 clear 得到 [127,64,32,255]，与 [128,64,32,255] 差 ≤1，三个 scopes 均 null、无意外错误。这只建立前提可行性，不证明矩形执行器、shader、生产 canvas 读回、合成或性能；属于已记录历史证据，不是本次新运行探针。

源码修订 `956e2f9894dc8e27291ffd0210a6cd8b4e651eab` 的数值修复有独立记录的 SPEC PASS/QUALITY PASS、聚焦几何 21/21、核心 177/177；CPU/mock 检查不证明原生 GPU 分配、像素或合成。完整有界原生任务在独立 SPEC/QUALITY 审查后为 **PASS**，包括通过公开 Engine/WebGPU、enableReadback=true/false 的原样强制 F4、开启时直接生产读回，以及黑/白背景浏览器合成截图。公开证据核对及交付仍 **PENDING**。旧原生 FAIL 历史须与未来结果分开保留。精确 CPU 输出及未实际观察的保护分支见[证据记录](WebGPU矩形实现证据.md)。

单采样外边缘可与 Canvas 抗锯齿不同，分别构造的相邻边界可能不同；不承诺普遍无缝或逐字节 Canvas 等价。本阶段不证明物理手机、加速、性能、文字/纹理/UI、3D、迁移或完整引擎。默认 adapter/device 失败或缺目标证据均为验收不完整，不能当作成功 fallback，也不能作为启用不安全启动参数的理由。

## 8. 基础依赖、致谢与引用边界

矩形组织、有界裁剪策略、host 所有权及验收样例属于一方设计。稳健方向判断使用 **Vladimir Agafonkin 的 robust-predicates 3.0.3**，从公开包根导入 `orient2d`，许可为 **Unlicense**。其符号用于已表示 binary64 点的分类，舍入后的行列式大小不提供精确交点。上游许可须原样保留，见 NOTICE (`NOTICE`, repository root) 与[保留的 Unlicense](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE)。

以下为设计来源记录中保留的、**记录于 2026-10-09 的历史引用读取**。本草稿未重新获取这些网页，也不把它们当作当前原生实现验证。

- [robust-predicates 3.0.3 标签版公共 API](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/README.md)、[元数据](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/package.json)与[许可](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE)：公开签名/方向约定、ESM/根导出、声明类型和许可。另有精确版本官方产物审计验证 40820 字节 tarball 和 registry SRI；不由此宣称 npm-latest 或交付浏览器体积。
- GPUWeb 一手 API 引用：[GPUCanvasContext](https://gpuweb.github.io/types/interfaces/GPUCanvasContext.html)、[GPUCanvasConfiguration](https://gpuweb.github.io/types/interfaces/GPUCanvasConfiguration.html)、[GPUQueue](https://gpuweb.github.io/types/interfaces/GPUQueue.html)、[GPUDevice](https://gpuweb.github.io/types/interfaces/GPUDevice.html)、[GPUBuffer](https://gpuweb.github.io/types/interfaces/GPUBuffer.html)、[GPUTexelCopyBufferLayout](https://gpuweb.github.io/types/interfaces/GPUTexelCopyBufferLayout.html)。历史读取范围为 current-texture 过期/复用、格式/alpha/usage、queue 完成、loss/errors、mapping 与带 padding 的复制布局。合作式独占租约和保守 unsafe-close 策略是应用决策。
- [WGSL 2026 年 9 月 21 日候选推荐草案](https://www.w3.org/TR/2026/CRD-WGSL-20260921/)：保留发布/版本身份，不代表完整 shader 或语言一致性审计。

原研究工具因内容长度限制未取得完整 WebGPU 规范，改读定向 GPUWeb 引用。此前类型文件 cache miss、npm 页面 403 和 latest endpoint 不可访问保留为历史访问失败。后续精确版本产物审计已建立类型/许可/SRI 证据，但不证明最新 dist-tag。完整交付依赖字节统计及性能证据仍待完成。
