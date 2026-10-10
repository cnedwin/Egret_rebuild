# 自有纹理几何与 Mesh2D：有界契约

[English](../../en/docs/textured-geometry-and-mesh2d-contract.md) | 简体中文 · [证据与检查点](自有纹理几何与Mesh2D证据.md)

工程检查点 **0.23.0**，整理于 2026-10-11。自有纹理几何、Mesh2D、不可变 profile 帧及显式 WebGPU 宿主已有有界 CPU、严格类型和桌面原生证据。原生运行的 11 个 calibration 与 10 个 held-out 窗口通过，16 个指定对照窗口全部检出了 12 项独立副本故障。独立保存结果审阅验收了此次记录的 Windows／Edge／NVIDIA 单一环境。公开复现工具、最终双语材料审阅、当前完整推送前检查和远端交付分别记录，本文不从原生 PASS 推断这些结论。

GPU 计划 Task 1 经 31/31 项 helper 与 37/37 项受影响旧用例后，验收私有共享 ledger 及可选准备/packing 接点；该检查点为 216 项源码/夹具与 328 项 emission。Task 2 经新构建、90/90 项合并用例（保留的 31 项预算加 59 项 Mesh）及单独 37/37 项受影响旧运行后，验收完整 tuple 的 Mesh CPU 准备、表示后 packing 与 rectangle/image/Mesh 有序 dispatch。新 runner 绑定 236 项选定源码/夹具输入及 340 项 emission。这些历史 helper 检查不建立后续宿主或原生像素证据。下文 API 块及宿主数值要求保持既有采用规格。

Task 3 随后通过 155/155 项合并 CPU 用例（31 项预算、59 项 Mesh、65 项准入），另有单独 94/94 项 projection/image-host 与 37/37 项旧几何运行；该阶段为 241 项选定输入与 352 项 emission。Task 4 通过 30/30 项公共受控宿主、14/14 项 profile/旧端口、新运行 155/155 项 helper，以及 146/146 项受影响旧 GPU 检查，含全部 13 项 B1 场景；其修正后构建具有 360 项 emission。这些历史结果覆盖有界源码／受控行为；后续固定桌面原生用例分别记录。

Task 6 通过严格 positive 消费者，核验 19 项单独定位且未抑制的新诊断，33/33 项新策略及 299/299 项保留策略用例通过。源码扫描在所记录的 363 文件边界通过；后续 native-only 新增文件保留单独来源范围。固定比较器在预期与 tolerance 不变的条件下，208/208 项 CPU 单元检查通过。构造字节数组与 metadata 检查建立比较器行为证据，不验证原生 shader 编译、像素或复制产品灵敏度。

## 接口与兼容性

该工作包提供不可变索引 XY/UV/light-RGBA 几何、纹理显示叶子、保留顺序的自有帧及显式渲染 profile。CPU 所有权可单独验收；整个包完成须由实际浏览器在既有矩形与 Bitmap 之间绘制可变形纹理 Mesh2D，保持顺序、裁剪、着色、alpha 与保留帧所有权。

### 已实现的 CPU 声明

这些声明描述已实现的 CPU 接口；尚待完成的最终阶段门禁见配对证据。

```ts
// @egret/contracts; also re-exported from the DOM-free @egret/engine root.
export type TexturedFloatArray2D =
  Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
export type TexturedIndexArray2D =
  Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
export interface TexturedGeometry2DInput {
  readonly positions: TexturedFloatArray2D;  // x,y, length 2*N
  readonly uvs: TexturedFloatArray2D;        // u,v, length 2*N
  readonly lightColors: TexturedFloatArray2D; // straight r,g,b,a, length 4*N
  readonly indices: TexturedIndexArray2D;   // triangle list, length I
}
declare const texturedGeometry2DBrand: unique symbol;
export interface TexturedGeometry2D {
  readonly [texturedGeometry2DBrand]: true;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
  readonly logicalByteLength: number;
  readonly positions: readonly number[];
  readonly uvs: readonly number[];
  readonly lightColors: readonly number[];
  readonly indices: readonly number[];
}
export function createTexturedGeometry2D(
  input: TexturedGeometry2DInput
): TexturedGeometry2D;
export function isTexturedGeometry2D(value: unknown): value is TexturedGeometry2D;
export const TEXTURED_FRAME_PROFILE_2D: "egret.textured-frame2d/1";
export type TexturedFrameProfile2D = typeof TEXTURED_FRAME_PROFILE_2D;
export interface TexturedMeshCommand2D {
  readonly kind: "mesh";
  readonly matrix: Matrix2D;
  readonly alpha: number;
  readonly clips: readonly ClipRectangle2D[];
  readonly imageIndex: number;
  readonly sourceRect: TextureRegion2D;
  readonly geometryIndex: number;
}
export type TexturedRenderCommand2D = RenderCommand2D | TexturedMeshCommand2D;
declare const texturedRenderFrame2DBrand: unique symbol;
export interface TexturedRenderFrame2D {
  readonly [texturedRenderFrame2DBrand]: true;
  readonly profile: TexturedFrameProfile2D;
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly clearColor: number;
  readonly clearAlpha: number;
  readonly commands: readonly TexturedRenderCommand2D[];
  readonly images: readonly ImageData2D[]; // required, including []
  readonly geometries: readonly TexturedGeometry2D[]; // required, including []
}
export interface TexturedRenderHostAdapter extends HostAdapter {
  readonly texturedFrameProfile: TexturedFrameProfile2D;
  renderTexturedFrame(frame: TexturedRenderFrame2D): undefined;
}

// @egret/runtime; re-exported by @egret/engine.
export class Mesh2D extends DisplayObject {
  constructor(textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D);
  get textureLease(): AssetLease<Texture> | undefined;
  get geometry(): TexturedGeometry2D | undefined;
  setContent(textureLease: AssetLease<Texture>, geometry: TexturedGeometry2D): void;
  clear(): void;
  override dispose(): void;
}

// @egret/engine root: additions to the existing Engine class.
export function createEngineForProfile(
  options: EngineOptions, profile: TexturedFrameProfile2D
): Promise<Engine>;
// Declaration additions to the existing Engine class; EngineOptions unchanged.
export interface Engine {
  readonly texturedFrameProfile: TexturedFrameProfile2D | undefined;
  captureTexturedFrame(options: FrameOptions2D): TexturedRenderFrame2D;
  renderTexturedFrame(options: FrameOptions2D): TexturedRenderFrame2D;
}

```

### 已实现的显式 GPU 声明及验证范围

下列显式工厂与宿主已实现，并在受控宿主范围验收。Task 6 也已验收其严格公共消费者及所记录类型/源码边界检查；固定桌面原生提交与像素具有单独已验收证据。窄 Pick 组合保留必需的旧 WebGPU 接口及两个纹理 adapter 成员。

```ts
// Explicit @egret/engine/webgpu entry only; DOM/GPU types stay out of root.
export interface TexturedWebGPUHostOptions extends WebGPUHostOptions {
  readonly maxSourceTriangles?: number;
  readonly maxFrameGeometryBytes?: number;
  readonly maxPendingGeometryBytes?: number;
  readonly maxTupleComparisons?: number;
}
export interface TexturedWebGPUHostStatus {
  readonly host: WebGPUHostStatus;
  readonly pendingGeometryBytes: number;
}
export interface TexturedWebGPUHost extends WebGPUHost, Pick<TexturedRenderHostAdapter, 'texturedFrameProfile' | 'renderTexturedFrame'> {
  getTexturedStatus(): TexturedWebGPUHostStatus;
}
export function createTexturedWebGPUHost(
  options: TexturedWebGPUHostOptions
): TexturedWebGPUHost;
```

几何声明/工厂/身份检查属于 contracts，由无 DOM 的 engine 根入口重导出。几何阶段仅新增 `TexturedFloatArray2D`、`TexturedIndexArray2D`、`TexturedGeometry2DInput`、`TexturedGeometry2D`、`createTexturedGeometry2D`、`isTexturedGeometry2D`；前四项只有类型。Mesh2D 属于 runtime，由 engine 重导出。宿主 DOM/GPU 声明仅属于 `@egret/engine/webgpu`。保留 engine → runtime/contracts、runtime → contracts、contracts → 无包依赖；根入口导入图不引入 rendering/WebGPU/robust-predicates。Canvas 仅允许 rendering 中无导入、无 DOM/GPU 的 `rendering/ownedPreparationFailure2D.js` 错误来源辅助模块；其导入图不引入 WebGPU 或 robust-predicates。

profile 字面量为 `egret.textured-frame2d/1`。既有协议固定值 `1.0`、`RenderCommand2D = rect | image`、`RenderFrame2D`、`RenderHostAdapter`、默认 `createEngine` 及默认工厂保留原路由/类型；不向旧 union 追加 mesh。两张帧表均为必需，允许空数组。没有公开帧工厂/注册器。仅精确模块的私有身份确认几何及已完成自有帧；结构复制和 Proxy 不授予权限。不承诺跨 loader 身份或恶意内建函数防护。

UV 是记录的整数 Texture crop 内、左上原点的归一化坐标。light RGBA 是 straight，各分量 [0,1]。已实现 profile 固定 normal source-over、nearest/clamp-to-edge、mip 0、编码预乘上传和 sRGB canvas；其他变体需要不同的显式 profile。WebGL、Canvas 网格近似、skinning、一般/反向 mask、dark tint、additive/multiply/screen、wrapping、linear filtering、mipmaps 均不在本 profile 内。

## 几何准入与所有权

准入顺序具有规范性。实例 iterator、覆盖的 tag/buffer/length、species 或负载属性回调不提供权限。通过捕获的正常 realm 内建函数接受真实固定 backing 的跨 realm typed array；普通数组、Proxy/仿造值、SharedArrayBuffer、resizable/detached backing 不受支持。

| 阶段 | 动作与优先级 |
| --- | --- |
| G0 | 必须为非 null object，拒绝 function：`TypeError("Textured geometry descriptor must be an object")`。 |
| G1 | 按 positions、uvs、lightColors、indices 各读一次，全部成功读取完成后检查语义。首个抛错停止：`TypeError("Textured geometry descriptor read failed", { cause: exactThrown })`。即使 cause 为 undefined 也精确保留；晚抛错优先于较早非法字段。 |
| G2 | 按字段顺序完成四项 brand 检查，再检查任何 backing。捕获的 TypedArray tag getter 接受前三项 Float32/Float64、索引 Uint16/Uint32。首个错误 tag：`TypeError("Textured geometry array brand is unsupported")`；内建抛错原样传播。 |
| G3 | 按字段顺序调用捕获的 buffer getter、ArrayBuffer byteLength getter、可用的 resizable getter、可用的 detached getter（否则 `new Uint8Array(backing,0,0)`），再调用 byteOffset/byteLength getter。ArrayBuffer getter 拒绝 shared backing；内建抛错原样传播。真实 resizable/detached：`TypeError("Textured geometry backing is unsupported")`。 |
| G4 | 推导精确元素长度，验证 2N/2N/4N/I 与空/三角形列表形状，再验证容量和安全整数 `64*N+4*I`。形状：`RangeError("Textured geometry array shape is invalid")`；容量：`RangeError("Textured geometry capacity exceeded")`。通过之前不复制负载、读索引或分配规范数组。 |
| G5 | 按字段顺序，使用捕获的构造器/set 将内建有效范围复制到新同元素类型固定 typed array。原生分配/复制错误原样传播，不保留源 buffer。 |
| G6 | 升序验证复制后的 positions、UV、lightColors、indices。位置有限，UV/light 有限且 [0,1]，索引整数 [0,N)。首个非法分量：`RangeError("Textured geometry numeric range is invalid")`。未引用顶点也验证；规范 dense 普通数组把 -0 改为 +0。 |
| G7 | 冻结四个独立数组和元数据，完成后才注册身份；失败不注册半成品。 |

N/I 同为零，或 N≥3、I≥3 且 I 能被 3 整除。允许重复索引/位置和未引用顶点。最大 N=65,536、I=196,608、triangleCount=65,536、logicalByteLength=4,980,736。逻辑字节是 `64*N+4*I`，与输入元素类型无关；三顶点/三索引三角形为 204 字节。Float32 以其实际表示值精确保存为 binary64 数值。计费不等于真实数组堆、暂存复制内存、RSS、GPU 内存或 OOM 保证；原生分配故障与确定性限额不同。

工厂扫描全部已复制分量一次。已实现的 capture 与显式纹理 host 按引用保留真实不可变几何，不逐命令完整复制或全顶点重扫；索引工作每三角形访问三个引用元组。工厂完成后修改输入视图/backing 或尝试修改返回数组/元数据，均不改变该值。

## Mesh 寿命、事务与边界——CPU 已验收

构造顺序为真实几何 → lease 身份 → 私有链路的精确有效 lease 值 → 真实/存活 Texture 与不可变 snapshot → lease Engine open → 绑定叶子 → 冻结内容 pair。错误顺序是 `MESH_GEOMETRY_INVALID`、`MESH_LEASE_INVALID`、既有精确 lease 权利失败、`MESH_TEXTURE_INVALID`、既有 Texture 存活失败、Engine-open 失败；可覆盖的 lease/Texture 属性不能建立权限。

`setContent` 依次检查 Mesh 身份（`MESH_INVALID`）、显示对象寿命、绑定 Engine open、修改 guard（`MESH_MUTATION_REENTRANT`）、旧槽位、几何、lease、Engine 归属（`ENGINE_MISMATCH`）、私有 lease/Texture 存活 snapshot，重查显示对象/Engine/旧槽位后原子替换；finally 清 guard。`clear` 做相同前四项检查后丢弃内容，不 release 借用 lease；clear 后仍保留 Engine 归属。getter 仅验证身份，返回缓存字段，clear/dispose 后为 undefined。dispose 在基类清理前丢弃内容，对已终止真实接收者幂等。

保留帧包含不可变 geometry/image/crop、矩阵、继承 alpha 与 clips，不引用叶子/Texture 包装器/AssetLease。后续内容替换、dispose、release 或 buffer 修改不能改变帧；新可见采集重新验证权限和 Texture 寿命。几何身份不授予像素/资源权限。

Mesh 边界扩展既有[内容边界契约](显示内容边界契约.md)，不增加 options。每个自有索引三角形在三次索引读取前收一个 primitive，maxPrimitives 默认 65,536/硬上限 262,144。每三角形最多三个引用 XY 点参与，包括点/线/共线三角形；未引用顶点不参与。缓存几何不因 lease/Texture 退休而消失，visibility/alpha/clips 不抑制它，clear 后无内容。保留 maxNodes 默认 4,096/硬上限 65,536、接收者局部排除自身/祖先变换、直接后代点算术、寿命/错误规则和非保守 binary64 限制；栅格抑制不得用于边界，不对孩子 AABB 再变换。

## 协商、采集与路由——CPU 已实现

`createEngineForProfile` 先比较 profile 字面量；不支持则 `ENGINE_RENDER_PROFILE_UNSUPPORTED`，无 cause，不读 options。再读 options.host 一次（原样抛错）；在一个读故障 wrapper 内依次读 host.texturedFrameProfile、renderTexturedFrame、renderFrame 各一次。读取抛错为 `INVALID_RENDERER` 且精确保留 cause；全部成功读取后才检查语义。先验证 advertisement（`ENGINE_RENDER_PROFILE_UNSUPPORTED`，无 cause），再验证必需的新 function 与 undefined-or-function 旧 port（`INVALID_RENDERER`，无 cause）。依次读 onDiagnostic、shutdownTimeoutMs 各一次，沿用 `??1000`/`INVALID_TIMEOUT` 并原样传播 getter 抛错，进入已有共享 surface reserve/start/cleanup/quarantine 尾部。协商失败不继续读 diagnostic/timeout/surface，不 reserve/start/分配或清理 Engine。默认 createEngine 保留原顺序，不读新 port。getter 重入副作用仍然真实，surface reserve 仍决定归属。

Engine 捕获 ports，以 `Reflect.apply(port, originalHost,[frame])` 调用；后续覆盖不改路由。任何 Engine 都可 captureTexturedFrame；renderTexturedFrame 必须有捕获的新 port（帧 options 读取前 `RENDERER_REQUIRED`），不回退旧 port。显式 Engine 保留旧 capture/render 方法，存在旧 port 时使用已捕获旧 port。四个帧方法共用 open/busy（`FRAME_REENTRANT`）、适用时 renderer-required、width/height/clearColor/clearAlpha 按序各读一次、全部成功读取后检查语义、open 重检、安全正 frame-ID 流、freeze/register、port 调用与 finally barrier。port 返回 undefined，保留原结果检查及 `FRAME_RENDER_FAILED` wrapper；冻结成功即消耗 ID，即使提交失败。

旧采集对实际到达且继承有效 alpha 非零的 occupied Mesh，在 Graphics/Bitmap 之后、mesh lease/索引读取之前给出 `FRAME_MESH_UNSUPPORTED`，空几何也一样。原 invisible/自身 alpha 零/空 clip 跳过保留；继承 alpha 舍入为零或 clear Mesh 不触发。第一方 Canvas 旧提交以 `CANVAS_FRAME_PROFILE_UNSUPPORTED` 拒绝全部已注册新帧；旧 WebGPU 使用 `WEBGPU_FRAME_PROFILE_UNSUPPORTED`，包括 clear-only/all-rectangle，均先于 target/queue/ledger 修改。已实现的新 WebGPU 端口对未注册/Proxy/普通结构帧，不读字段而 `WEBGPU_FRAME_INVALID`。既有旧宿主 guard 顺序保持精确：Canvas 先 active state 后 busy，WebGPU 先 busy 后 active state；两者均先执行寿命 guard，再拒绝新 profile 和复制任何旧输入。拒绝/预检故障为非终态。自定义宿主的保证仅覆盖 Engine 协商/路由；直接验证由其作者负责。

新采集使用两遍同步私有迭代 DFS，每祖先一个 child cursor，Stage 计节点，检查真实存活身份/parent/Engine/重复节点并重查 Engine open。Pass A 访问隐藏/alpha 零/clip 零的全部后代，slots 前收 node，完整 primitive 数加 occupied Bitmap/Mesh 槽位收费（空几何也算）。每次 Mesh 的完整 triangleCount 先于索引/位置收费；重复使用重复收 source work，唯一几何逻辑存储只收一次。不读负载/lease/存活 Texture/transform/clip 坐标，不验证隐藏算术/权限。超 metadata cap 则在 Pass B 前拒绝。

Pass B 按 Graphics → Bitmap → Mesh → authored-order children 发出。Invisible/自身零/继承舍入零分支在 transform/lease 前跳过；验证有限 transform/alpha、active clips，再跳过零尺寸 clip 分支。可见但屏外 Mesh 仍检查权限和引用 affine 结果。geometry table 是已发出身份的首次发出顺序，Pass A 存储也收费隐藏身份。source work 不重复计费或退款；命令/clip references 准入后才 append/展平，空可见几何也发出 mesh command。私有 slots 读取间无回调；失败不发布帧/ID，不修改宿主。

## 采集与显式 GPU 容量

下表采集列是已实现的 CPU 准入规则。宿主列、GPU options、提交顺序及 WEBGPU preparation codes 已实现，并有受控宿主证据；原生行为仅在另行记录的固定桌面用例范围验收。计数均为逻辑准入单位；安全整数算术在 append/迭代/分配前检查剩余额，不溢出、饱和或退款。仅显式新宿主可配整数为 1..硬上限，默认等于上限；默认工厂保留原验证/最大值。pixelRatio 有限正数，enableReadback 默认 false。

| 计数 | 采集上限 | 显式宿主默认/硬上限 | 计费 |
| --- | --- | --- | --- |
| Nodes / authoring units | 65,536 / 65,536 | — | 全部私有 metadata，隐藏/空也算。 |
| Commands / maxCommands | 65,536 | 65,536 | append/command scan 前。 |
| Source triangles / maxSourceTriangles | 65,536 | 65,536 | 每次完整计数先于索引，含 alpha 零/退化/singular/clipped。 |
| Unique geometries | 128 | 128 固定 | 下一个精确身份前。 |
| Unique geometry bytes / maxFrameGeometryBytes | 16,777,216 | 16,777,216 | 唯一 logicalByteLength；采集含隐藏，宿主用 emitted table。 |
| Clip references / maxClipRectangles | 262,144 | 262,144 | 每命令重复引用，flatten/scan 前。 |
| Prepared vertices / maxPreparedVertices | — | 1,048,576 | rect/image/mesh 共用；fan append 前 3*(corners-2)。 |
| Robust predicates / maxClipEdgeTests | — | 4,194,304 | 每次 prepare/pack orientation，含旧 rect/image 工作。 |
| Mesh polygon corners | — | 64 固定 | clipping append 前；旧 rect/image 保留 1,024。 |
| Mesh tuple comparisons / maxTupleComparisons | — | 1,048,576 | 每次 XY/全属性 pair，含提前 mismatch/嵌套扫描。 |
| Upload / maxUploadBytes | — | 33,554,432 | prepared rect*24 + image*16 + mesh*32 +16（每 prepared 非空 image/mesh draw）。 |
| Pending upload / maxPendingUploadBytes | — | 67,108,864 | 每 pending submission/replay 的相同准入上界。 |
| Pending geometry / maxPendingGeometryBytes | — | 33,554,432 | 每 submission 唯一 emitted 逻辑字节；不同 pending 帧分别收费。 |
| Pending frames / maxPendingFrames | — | 2 | 每准入 submission 一个。 |
| Backing pixels / maxBackingPixels | — | 16,777,216 | ceil(logical edge*pixelRatio) 为安全正整数，乘积不超上限。 |
| Readback / maxReadbackBytes | — | 67,108,864 | ceil(4W/256)*256*H staging +4WH output；共享 pending 总和。 |

原 image 限制不变：source edge 4,096；source pixels 1,048,576；images/frame 64；crop views/frame 128；image table/projected crops 各 16,777,216 字节；scratch/pending texture 各 33,554,432 字节。collapse 不退 projection 准入；独立 loader 不合并身份。

Options 各读取一次：canvas、device、onDiagnostic；pixelRatio,maxBackingPixels,maxCommands,maxClipRectangles,maxPreparedVertices,maxClipEdgeTests,maxUploadBytes,maxPendingUploadBytes,maxPendingFrames,maxReadbackBytes,enableReadback；最后 maxSourceTriangles,maxFrameGeometryBytes,maxPendingGeometryBytes,maxTupleComparisons。成功读取全部完成后检查语义；再读 policy.kind，仅 borrow 读 policy.device；canvas/policy/callback 先于按捕获顺序验证数字。读错误为 `WEBGPU_OPTIONS_INVALID`，精确保留 cause；语义 cause 为 TypeError/RangeError。准入前不调用 canvas/GPU；仅显式实例有 own nonwritable/nonconfigurable advertisement。

提交顺序：state/busy/真实帧 → header/backing 与 command/image/geometry 长度 cap → geometry 身份/唯一字节，再 image 身份/字节 → painter-order command kind/source-triangle 先于 indices/matrix-alpha-table-crop-clip metadata 和全部 clips → 共享 polygon preparation → upload 上界、各 maxBufferSize、crop/backing 硬件尺寸与 readback cap → pending frames/upload/readback/texture/geometry 同序 → serial exhaustion → 自有 Float32 packing/projection copy → active/capacity 重检 → serial/ledger/readback reserve 与 GPU 工作。早期已准入普通 tuples 可存在；packed buffers/projection payload/GPU 分配必须等待对应准入。alpha 零 Mesh 仍验证索引/clip/退化；f32 collapse 无实际 draw，但不退 source/projection/prepared/upload。几何保留至真实 ledger retirement，geometry/upload/texture/readback 此时只释放一次。共享 close/quarantine 与借用 device 权限保留。`getTexturedStatus()` 返回冻结 `{host:getStatus(),pendingGeometryBytes}`，不独立保证 idle 或设备安全。

| 失败 | Code |
| --- | --- |
| 身份/metadata | WEBGPU_FRAME_INVALID |
| Backing cap / preparation envelope | WEBGPU_BACKING_LIMIT / WEBGPU_GEOMETRY_RANGE |
| Orientation/属性/交点/packing 精度 | WEBGPU_PRECISION_UNSUPPORTED |
| Source/table/clips/prepared/predicate/tuple/upload/配置 readback | WEBGPU_FRAME_BUDGET |
| Pending / 硬件上限 / serial | WEBGPU_BACKPRESSURE / WEBGPU_DEVICE_LIMIT / WEBGPU_SERIAL_EXHAUSTED |
| Capture metadata/output quotas / 非有限 captured transform | FRAME_BUDGET_EXCEEDED / FRAME_TRANSFORM_INVALID |

资源错误保留 Mesh/私有 entitlement 权威；allocation/copy/GPU 失败用既有私有来源分类，不根据调用者公开错误 code 归类。预检失败不改 target/queue/serial/ledger，不必撤销早期已准入 CPU 分配。Upload 上界/pending geometry 是逻辑计数，不是真实 GPU writes/堆测量。

## 数值、裁剪与像素模型

沿用 `robust-predicates` 3.0.3 公共 orient2d 链路，传统 sign 为 `-Math.sign(orient2d(...))`，每次调用前收费。准备坐标要求有限，且为零或绝对值 [2^-100,2^20]，-0 规范为 +0；覆盖 matrix 系数/引用局部 XY/每项 affine product,sum,translation/backing-ratio 结果。UV/light 保持 [0,1]；退化前验证 matrix/clips 和三个完整引用 tuple。线性 rank 取 (0,0),(a,b),(c,d) 的 robust sign，不用经验 epsilon。

| 阶段 | 判断 |
| --- | --- |
| 自有 A | A=0 在舍入 affine transform 前抑制栅格，authoredDegenerateTriangles 增加；bounds 保留点。 |
| Matrix M | A≠0,M=0 在 transform 前抑制，singularSuppressedTriangles 增加；仍验证 local tuple/matrix/clip。 |
| Transformed T | 沿用有序 affine 后 pixelRatio；T=0 增加 transformedCollapsedTriangles/跳过；T≠A*M 拒绝 precision；T<0 整个 tuple 反转为正 backing winding。 |
| Clipped polygon | 有序 transformed clips 后 viewport，保留 XY/UV/RGBA。空/全共线增加 clippedCollapsedTriangles/跳过；不一致非零 convex turn、非邻接重复、相同 XY/不同属性拒绝 precision。相同 tuple 可去重，携带属性的共线点保留。 |
| Prepared fan | 预留 3*(corners-2)，保留 tuples；alpha 零在有界工作后无输出。 |
| Packed fan | x=fround(2*x/W-1),y=fround(1-2*y/H)，UV/light fround；传统 NDC sign<0 通过，=0 增加 packedCollapsedTriangles/跳过，>0 拒绝 precision。值有限、属性 [0,1]，不退款。 |

Canonical crossing 顺序/cache 保留全部 tuple。u=abs(det(edge,p)),v=abs(det(edge,q)),sum=u+v；有限 0<t=u/sum<1 时全部分量用 p+t*(q-p)。t 舍入为 1 时直接算 s=v/sum，要求有限 0<s≤0.5，全部用 q+s*(p-q)，不能用 1-t。保留 endpoint/finite 检查，仅规范属性零；represented 属性越界拒绝，不 clamp。Predicate/corner/tuple 工作先收费。f32 maxBackingDisplacement/maxUVDisplacement/maxLightColorDisplacement 描述舍入，没有继承位移阈值或结果拟合 tolerance。模型为 represented binary64/float32，不保证 exact-real affine/intersection。

h=2^-34,T=2^19 时，自有 (0,0),(h,h),(3h,3h) 共线；平移 (T,0) 将 T+h 舍入到 T、T+3h 舍入到 T+4h，变换后 determinant 为 -4h²。必须先抑制 authored 退化，bounds 仍保留 authored 点/线。

仅显式 host 初始化 mesh pipeline。设备要求 maxVertexBuffers≥1、maxVertexAttributes≥3、maxVertexBufferArrayStride≥32、maxInterStageShaderVariables≥2，并满足既有 buffer/texture 限制；不足在 target configure 前 `WEBGPU_DEVICE_LIMIT`。Float32 stride 32 为 locations 0/1/2 的 XY/UV/lightRGBA；两个 varying 为 vec2 UV、vec4 straight light。CPU 裁剪将索引输入展开为有序非索引 GPU triangle list。编码预乘 nearest sample S、straight 插值 light L=(r,g,b,A)、opacity O：RGB=S.rgb*L.rgb*A*O，alpha=S.a*A*O，再 premultiplied normal source-over。不切换 linear-light/sRGB decode。仅相邻 rectangle runs 可 batch；中间 image/mesh 即使无输出仍是顺序 barrier，保留 authored triangle 顺序。

固定第一方 native fixtures 已独立评审 rational/literal 预期、channel/sample points/coverage criteria/tolerances，calibration 与 held-out confirmation 分离。夹具覆盖 texture alpha 0,1,127,128,254,255、tint/opacity、nearest edges/gradients、反序、变换 clips、complementary-weight 对抗、退化、非 identity pixelRatio。未修改比较器 208/208 项 CPU 单元检查通过；后续原生观察及全部 12 项复制产品灵敏度对照在所记录桌面环境通过。Shader 字符串、假设备、合成字节数组及既有 alpha 观察不建立新 mesh 像素或 whole-A2 验收。

## 来源与验收边界

第一方规格与公开文档整理采用了 AI 辅助。几何准入明确复用既有第一方 ImageData2D 内建准入模式；Mesh/resource/frame/bounds/host 寿命集成基于既有第一方机制，私有完整 tuple clipping 保留其 complementary-weight transport。第一方代码/文档保留 Apache-2.0；既有外部 `robust-predicates` 3.0.3 保留 Unlicense。本设计/文档准备不引入新依赖或复制上游实现。这是有范围的署名，不是全球原创性或训练来源认证；实际实现复用须依据最终已评审源码另行记录。

已实现、已评审、已验收与待完成检查点见[几何/Mesh 证据](自有纹理几何与Mesh2D证据.md)及[Profile CPU 证据](纹理Profile的CPU证据与待完成门禁.md)。CPU 验收本身不建立可绘制 Mesh2D、Spine runtime、完整 A2/3D/UI/fonts、实体手机、性能、生产宿主、完整迁移或发布验收。

已验收几何实现使用捕获的内建函数及无原型 descriptor，将规范数字槽位创建为自有属性。descriptor getter 安装的 Array 继承数字 setter 无法吞掉写入；该有界回归已验证，不代表一般恶意内建函数防护。

隔离的精确二进有理数算术检查还确认了 16×16 backing 的 packing 朝向翻转例：P=(12,4)，Q=(12+2^-21,4-95·2^-27)，R=(12+2^-20,4-161·2^-27)。传统 determinant 在 backing 空间为 +29·2^-48，在 NDC 舍入前为 -29·2^-54，Float32 NDC 舍入后为 +2^-48。这支持设置明确拒绝用例；该检查没有执行产品 packer、裁剪或 GPU 像素。
