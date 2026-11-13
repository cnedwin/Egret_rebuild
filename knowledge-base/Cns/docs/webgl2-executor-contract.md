# WebGL2 共享渲染协议执行器契约

[English](../../en/docs/webgl2-executor-contract.md) | 简体中文

> **场景模式已移除。** `createSharedSceneWebGPUHost`、`createSharedSceneWebGL2Host`、`renderSceneSharedFrame`、`stageSceneSharedFrame`、`getSceneStatus` 及 B1 路径已从 SDK 中移除。下文中描述它们的段落是记录，不是当前行为。

2026-10-18 · M1.4 实现契约草稿 · 完整验收与交付待完成

## 范围与证据

M1.3 已提供实现中的[共享渲染协议](shared-render-profile-contract.md)、真实不可变帧、纹理页身份、材质、有序几何准备和有界不透明 B1 合成。已实现的可选 WebGL2 执行器消费同一组值。Engine、Stage、Scope、时钟、AssetManager、租约和帧权威继续共用；执行器负责 GL 状态、原生资源和 context generation。不新增自定义 shader API、通用后端注册表或通用 3D 渲染器。

当前源码已实现可选入口、共享存储与保留账本集成、固定场景组装及 Host 生命周期。本草稿描述已选定的契约；实现状态与验收状态分别记录。精确 framebuffer/颜色路径已有单独记录的原始原生资格验证，四例 SDK 冒烟结果则仅适用于其记录的较早产物。两项结果均不能替代最终源码版本的完整像素、生命周期、深度与状态检查。公开严格类型声明、完整本地门禁及受保护交付还须提供各自的实际记录。不支持该配置时停止该路径；不能根据观察到的输出修改颜色方程或阈值。

M1.4 包含真实 WebGL context 恢复。M1.5 另行负责统一设备会话、资源清单、分阶段重载及持续恢复。就绪不证明两秒内得到匹配的恢复帧、五秒内完成分阶段重载、十次失效循环或三十分钟持续运行。完整 Spine R020/V020 与 M1.2 正式计时仍为 OPEN。参见 [M1 计划](m1-rendering-resource-plan.md)。

## 可选 API

| 入口 | 唯一运行时导出 | 擦除类型导出 |
| --- | --- | --- |
| `@egret/engine/webgl2` | `createSharedWebGL2Host(options): SharedLayerWebGL2Host` | `SharedWebGL2Host`、`SharedLayerWebGL2Host`、`SharedWebGL2Layer2D`、`SharedWebGL2LayerEffect2D`、`SharedWebGL2LayerPlacement2D`、`SharedWebGL2LayerStatus`、`SharedWebGL2HostOptions`、`SharedWebGL2HostStatus`、`SharedWebGL2Readback`、`WebGL2HostState`、`WebGL2HostErrorCode`、`WebGL2HostFailure`、`WebGL2HostDiagnostic`、`WebGL2HostStatus` |
| `@egret/engine/webgl2/scene3d` | `createSharedSceneWebGL2Host(options): SharedSceneWebGL2Host` | `SharedSceneWebGL2Host`、`SharedSceneWebGL2HostOptions` |

默认 Engine、Canvas 和现有 WebGPU 入口保持原接口。普通 GL 不加载可选 scene 组装。Scene 组装是固定第一方代码，不能由调用者提供协议。

`SharedWebGL2Host` 精确公开以下成员：

- `surface: HTMLCanvasElement`、`sharedFrameProfile: SharedFrameProfile2D`，后者使用现有值 `SHARED_FRAME_PROFILE_2D`。
- `start(): Promise<void>`、`stop(): void`、`close(): Promise<void>`、`setTimeout(callback: () => void, delayMs: number): () => void`。
- `renderSharedFrame(frame: SharedRenderFrame2D): undefined`、`whenIdle(): Promise<void>`、`whenReady(): Promise<void>`。
- `requestReadback(): Promise<SharedWebGL2Readback>`、`getStatus(): WebGL2HostStatus`、`getSharedStatus(): SharedWebGL2HostStatus`。

它不实现旧 `renderFrame` 或 `renderTexturedFrame` 兼容方法。现有 `createEngineForProfile` 直接完成协商，不新增 profile 或 core 分支。Scene Host 只增加 `renderSceneSharedFrame(scene: SceneFrame3D, overlay: SharedRenderFrame2D): undefined` 与 `getSceneStatus()`，后者返回不可变 `{host, pendingSceneBytes, pendingUniformBytes, pendingDepthBytes}`。两个输入必须是真实公共值；scene 输出与 overlay 均要求不透明。

## 可缓存的 2D 图层

WebGL2 工厂返回 `SharedLayerWebGL2Host`，继承原有宿主接口。每个地图块或静态绘制组对应一个 `SharedWebGL2Layer2D`。`update(frame)` 接收不可变的 Engine 捕获帧，要求透明清屏、预乘输出、整数像素尺寸，支持正常 source-over 矩形、图像和普通裁剪。宿主用共享渲染路径按每源单位一纹素烘焙，复用常规绘制的图像页驻留。

通过 `renderSharedFrameWithLayers(frame, placements)` 按绘制顺序提交可见块。每项包含 `layer`、`x`、`y`、`width` 和 `height`，位置和尺寸使用帧的逻辑坐标，随宿主像素比缩放。宿主以最近邻采样，将缓存合成到清屏底色上，再绘制常规帧。更高的 DPR 会缩放放置尺寸，源细节由烘焙分辨率决定。需要与角色交错遮挡的物件、角色和 UI 保留在常规帧中。镜头移动只更新放置参数。编辑地图时重新捕获并更新受影响的块。瓦片跨块时，旧、新足迹覆盖到的块都需要更新。

首次放置前等待 `update` 完成。替换烘焙完成前仍可使用上次就绪的版本，已提交帧持有其采样的版本。`dispose()` 让该块退出后续提交，待引用它的帧退役后释放纹理。宿主最多接纳 512 个活动句柄，每帧最多放置 512 项，单边上限 2,048 像素。RGBA8 缓存目标总额为 32 MiB，包含烘焙中和仍被帧持有的旧版本。现有设备、帧预算与背压限制同时适用。`getSharedLayerStatus()` 报告逻辑目标字节和就绪、待完成的句柄数。释放的句柄立即退出计数，在途纹理仍计费至退役。图像上传量由原有共享资源诊断统计。

上下文丢失后，曾就绪的图层变为 `stale`。应用应保留构建配方或源帧，在 `whenReady()` 后重新更新。缓存不可用期间，应用可使用直接绘制或 CPU 烘焙作为回退。关闭宿主会释放全部图层句柄。首批接口覆盖显式 WebGL2 2D 路径，WebGPU 图层和深度合成另行验收。

执行 `node tools/verify-webgl2-layer-cache.mjs <playwright-root> <fresh-output>` 复现 Edge 原生验证。夹具覆盖 DPR 2 下的放置、绘制顺序、透明度、非对称图案的方向、镜头移动复用、真实上下文丢失和显式重建。同一合成夹具在实体 Android Chrome 157（Samsung SM-F966U1、Adreno 830）上得到两组逐字节一致的缓存／直接绘制帧。移动图层未新增上传，真实上下文丢失后显式重建的回读结果一致。性能和设备验收见 [M4.2 计划](m4-core-acceptance-plan.md)。

### 场景局部光照与调色

WebGL2 宿主开启 `enableEffects: true` 时，缓存块的放置项可带一个 `effect`，包含 `bounds: { x, y, width, height }`，以及可选的 `multiply`、`add` RGB 三元组。区域与放置项使用相同的左上原点帧逻辑坐标。将同一半开矩形传给相邻块，可让效果跨越块边缘。渲染先将效果限制在逻辑帧内，再按物理像素中心判断区域，在不同像素比下保持小数边界一致。

RGB 乘数范围为 0 至 4，默认 `[1, 1, 1]`。RGB 加数范围为 0 至 1，默认 `[0, 0, 0]`。合成在线性预乘 RGB 上计算 `min(rgb × multiply + alpha × add, alpha)`，Alpha 保持原值。应用可对区域调色、压暗或加入有限的光色。区域外保持缓存原色。场景层仍先于常规帧绘制，因此随后绘制的 UI 和角色保持原样。每个放置项有一个区域。

调整效果时更新合成参数。缓存纹素、图像上传、纹理预算、替换及恢复继续遵循图层契约。上下文恢复后用原始输入重建块，再随放置项提交效果。这项第一方效果只作用于缓存合成。其他场景效果另有契约。

执行 `node tools/verify-webgl2-layer-light.mjs <playwright-root> <fresh-output>` 复验有界调色、相邻块、DPR、透明度、叠层顺序和真实上下文恢复。Edge 与实体 Android Chrome（Adreno 830）均在 1×、2× 宿主像素比下通过。两块间的作用边界连续，UI 与 Alpha 覆盖不变；调整效果时上传与图层驻留计数不变。两种比例均在真实上下文丢失后重建并得到一致像素。

`SharedWebGL2HostOptions` 必须提供 `canvas: HTMLCanvasElement`，可选 `onDiagnostic?: (diagnostic: WebGL2HostDiagnostic) => unknown`。其余选项如下：

| 选项 | 默认值及最大值，pixelRatio 除外 |
| --- | ---: |
| pixelRatio | 1；有限正数，并受 backing 准入约束 |
| maxBackingPixels | 16,777,216 |
| maxCommands / maxClipRectangles | 65,536 / 262,144 |
| maxPreparedVertices / maxClipEdgeTests | 1,048,576 / 4,194,304 |
| maxSourceTriangles / maxTupleComparisons | 65,536 / 1,048,576 |
| maxUploadBytes / maxPendingUploadBytes | 33,554,432 / 67,108,864 |
| maxFrameGeometryBytes / maxPendingGeometryBytes | 16,777,216 / 33,554,432 |
| maxPendingFrames / maxReadbackBytes | 2 / 67,108,864 |
| maxFrameRegions | 4,096 |
| maxFramePageBytes / maxReadyPageBytes | 67,108,864 / 134,217,728 |
| enableReadback | false；只接受布尔值 |
| outputAlpha | 默认 `'premultiplied'`；也可为 `'opaque'` |
| restoreTimeoutMs | 默认 10,000；不超过 30,000 的正安全整数 |

Scene 选项必须显式提供 `outputAlpha: 'opaque'`。数值上限只能降低；除 pixelRatio 外，数值选项均为正安全整数。不读取未知属性。所有成功读取均只发生一次，并先于语义校验，顺序为：`canvas`、`onDiagnostic`、`pixelRatio`、`maxBackingPixels`、`maxCommands`、`maxClipRectangles`、`maxPreparedVertices`、`maxClipEdgeTests`、`maxUploadBytes`、`maxPendingUploadBytes`、`maxPendingFrames`、`maxReadbackBytes`、`enableReadback`、`maxSourceTriangles`、`maxFrameGeometryBytes`、`maxPendingGeometryBytes`、`maxTupleComparisons`、`outputAlpha`、`restoreTimeoutMs`、`maxFrameRegions`、`maxFramePageBytes`、`maxReadyPageBytes`。最后三项的判定也排在最后。Getter 错误以 `WEBGL2_OPTIONS_INVALID` 保留原始 cause。

Host 请求 `canvas.getContext('webgl2', {alpha:true, premultipliedAlpha:true, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false})`，核对实际属性与能力，并建立全部使用到的状态。两种输出模式均保留 alpha 存储；不透明输出写入 alpha 一。调用者在租用期间授予独占 GL 状态访问。浏览器可能返回已有同类型 context；无法检测其历史独占使用。首版不接受原始 context/device、任意属性、扩展选择器、功耗偏好、shader 或资源提供回调。

## 状态、失败与生命周期

`WebGL2HostState` 精确为 `new | starting | active | lost | restoring | stopped | failed | closing | closed`。不可变 `WebGL2HostStatus` 包含 `state`、`generation`、`lastSerial`、`pendingFrames`、`pendingUploadBytes`、`pendingReadbackBytes`、`firstFailure`、`generationFailure`、`callbackFailureCount`、`lastCallbackFailure` 和 `cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe'`。启动前 generation 为零，每次初始化尝试递增为正安全整数。原生操作由内部 token 授权，数字本身不授权。Serial 跨恢复保持单调递增。

`SharedWebGL2HostStatus` 包含 `host: WebGL2HostStatus`、`pendingGeometryBytes`、`pendingColorBytes`、`pendingCanonicalBytes` 和 `retention`。不可变 retention 快照有 `idleBytes`、`idleEntries`、`reservedBytes`、`reservedEntries`、`unknownBytes`、`unknownEntries`、`unknownNativeBytes`、`unknownNativeObjects`。Idle 与 reserved 互斥；unknown native 字段覆盖池外页面/PBO/对象。已知大小继续计费；program 和 sync 仅计对象数，不虚构字节估计。这些是账面费用，不是实测显存。私有实际 vertex/uniform arena 计数不增加公开字段。

`WebGL2HostFailure` 包含 `code`、`serial: number | null`、`generation`、`phase: 'startup' | 'frame' | 'readback' | 'context' | 'restore' | 'cleanup' | 'callback'` 与原始 `cause`。`WebGL2HostDiagnostic` 增加 `severity: 'error'`。保留整个生命周期的首个失败；只有允许的恢复成功发布新 active generation 时才清除 `generationFailure`。诊断重入及回调返回的 rejected promise 单独隔离、记录。

`WebGL2HostErrorCode` 是以下带 `WEBGL2_` 前缀的有限集合：`OPTIONS_INVALID`、`CONTEXT_UNAVAILABLE`、`CONTEXT_ATTRIBUTES_UNSUPPORTED`、`FORMAT_UNSUPPORTED`、`START_FAILED`、`START_CANCELLED`、`NOT_STARTED`、`STOPPED`、`CLOSED`、`FAILED`、`REENTRANT`、`FRAME_PROFILE_UNSUPPORTED`、`FRAME_INVALID`、`BACKING_LIMIT`、`GEOMETRY_RANGE`、`PRECISION_UNSUPPORTED`、`FRAME_BUDGET`、`BACKPRESSURE`、`CONTEXT_LIMIT`、`SERIAL_EXHAUSTED`、`GENERATION_EXHAUSTED`、`RENDER_FAILED`、`VALIDATION`、`OUT_OF_MEMORY`、`CONTEXT_LOST`、`CONTEXT_RESTORING`、`RESTORE_FAILED`、`RESTORE_TIMEOUT`、`READBACK_DISABLED`、`READBACK_PENDING`、`READBACK_FAILED`、`SYNC_FAILED`、`SYNC_TIMEOUT`、`DIAGNOSTIC_CALLBACK_FAILED`、`CLOSE_UNSAFE`。错误保留原始 cause，不暴露资源或 shader 内容。

| 调用或事件 | 必须行为 |
| --- | --- |
| new 时 start | 在可重入边界前保存唯一 startup promise；完整初始化后才从 starting 进入 active。 |
| starting/active 时 start | 返回同一个 startup promise。 |
| lost/restoring 时 start | 拒绝对应 context 状态错误；由 `whenReady` 等待恢复。 |
| stopped/failed/closing/closed 时 start | 拒绝 STOPPED/FAILED/CLOSED，不能返回旧成功结果。 |
| 初次启动期间失效 | 撤销初始化、拒绝 CONTEXT_LOST、清理；除已进入 closing 外，最终 terminal failed。 |
| active 时确认失效 | 撤销 token、进入 lost、拒绝受影响 outcome/ticket，并启动一次有界恢复循环。 |
| 符合条件的真实恢复 | 进入 restoring，结清旧 CPU/已知 owner，复查 deadline，在新 token 下重建并重新验证资格，仍有资格时才发布 active。 |
| 恢复期间再次失效 | 撤销该次 generation；不同的真实失效可启动新有界循环。重复 loss 事件不能延长同一 deadline。 |
| 未恢复或恢复过晚 | 以 RESTORE_TIMEOUT 失败；晚到事件不能激活 Host。 |
| stop/close | 同步禁止新提交和恢复。Stop 不可逆；close 进入 closing，重复调用返回同一 promise。已接受工作保留有限退休所有权。 |

重入 stop/close 后，已经返回的 pending startup promise 保持身份但必须拒绝；之后的 start 按当前状态处理。`whenReady` 不是 async 方法，返回存储的 promise：starting 时是 startup promise，active 时为该代唯一 resolved promise，失效/恢复期间为该循环唯一 promise。New 和终态拒绝对应错误。调用不会增加 Host waiter 列表、逐调用 listener/timer，也不会启动恢复。调用者自行添加的 promise reactions 仍是调用者状态。

恢复只拥有一个单调 deadline 和至多一个 timer。`restoreTimeoutMs` 包括等待事件、旧 CPU 静止和重建。每个恢复执行点及最终 active 发布前都检查时间和 lifecycle epoch。JavaScript 暂停可能延迟拒绝送达，但不能授权迟到成功。循环结束后释放 timer 和 continuation。固定内部 30,000 ms fence deadline 使用同一规则；这是等待策略，不是性能保证。

`whenIdle` 快照调用时已接受的 record 与调用时的 Host 状态。它等待这些 record 的清理并报告失败，不加入后续工作或未来 generation。快照包含受失效影响的待决 record 时，即使恢复先完成也会拒绝；已经 idle 时取得的空快照不必因后续失效而改为拒绝。新的 active 快照可以成功，不被历史 firstFailure 永久污染。Lost/restoring 快照在既有清理结束后拒绝对应调用时 context 状态。

Engine 在调用 Host 前提交真实帧与 frame ID。因此 GL 的同步拒绝可能已经消费该 ID，并成为 `FRAME_RENDER_FAILED`，Engine 仍保持打开。之后发生的失效拒绝 Host outcome/readback 并产生诊断，不会追溯地让已经返回的 Engine 调用抛错。Engine 打开期间，capture、租约、Stage/Scope 和时钟身份继续可用；恢复不重启、暂停或推进时钟，也不取消它的普通 timer。

## 提交、清理与读回

保留以下顺序：真实帧/profile/output/backing/scene 准入；共享逻辑准备；联合费用、原生能力和首次 pending 检查；必要 scene/shared 打包；页面驻留计划；冷页峰值预约、物化与容量复查；可选相邻合批；实际 arena 计划/容量；当前计划及最终容量检查、serial/owner 提交；原生实现与提交。合批不退还逻辑费用，必要分配不能借可选 concat 回退隐藏失败。

每个 continuation 带原始 generation token 和 lifecycle epoch。旧工作只能结清自己的 owner，不能访问失效 GL、修改后代、发布 readiness 或用新 canvas 完成旧 ticket。Closing 只为仍有效 context 中已发出的 fence/PBO 保留有限退休权限。健康 context 上的合成 DOM 事件不证明原生对象失效。

三种清理事实必须区分。确认原生失效使已知对象无效，记录为 context-invalidated，不能称为已绘制、完成或删除。CPU 数组、已进入的回调、待调度 poll 和 listener 必须单独结束或取消。创建/删除/发布结果未知时永久保留全额费用，禁止新接受与复用，并使 close 不安全；后来的 loss 不能抹去未知。产品清理不主动制造 context loss 作为退款证明。Safe close 要求全部已知原生和 CPU 义务结束且没有未知 owner；unsafe close 拒绝并保持现有 Engine surface 隔离。

每代拥有一个 shared program、一个固定输出 resolve program，scene 才增加 B1 program；对应 VAO 至多三个。一个 working FBO 绑定当前 record 租用的 color/depth。没有逐 draw program/VAO 或 target 组合缓存。建立全部依赖的 framebuffer、draw/read buffer、viewport、vertex/UBO/texture、blend、mask、depth/scissor/cull/stencil/dither/sample 与 pixel-store 状态；附件改变时检查完整性。淘汰和关闭时解除保存的原生引用；resize 核对实际 drawing-buffer 尺寸。

同步 render 调用内，在上传/绘制/resolve 后，为 ticket owner 发出 `readPixels` 到其专用 PIXEL_PACK_BUFFER，再 fence 与 flush。复制命令必须先于返回或 yield；后续 extraction 读取该 PBO，不重新读取当前 canvas。一个有界退休 pump 为至多两个已接受 record 拥有至多一个 timer，在之后的 event-loop task 用零 timeout 查询 fence，并在没有后续 render 时继续推进。不使用自旋或 glFinish。Fence 超时或无法证明清理时保留所有权并以 unsafe 失败；单独 fence 不授权复用。

`requestReadback` 只允许 active 且 enableReadback。唯一 outstanding ticket 绑定下一次已接受提交；第二次请求拒绝 READBACK_PENDING。纯准入拒绝保留未绑定 ticket；stop/loss/close/终态失败拒绝它。不可变结果包含 `serial`、`frameId`、`generation`、`width`、`height`、`format: 'rgba8unorm'`、`sourceFormat: 'rgba8unorm'`、`colorSpace: 'srgb'`、`alphaMode: 'premultiplied' | 'opaque'`，以及独立拥有、按左上起始行排列的 `bytes: Uint8Array`。格式承诺以前置资格通过为条件。PBO 与输出各计 `4*width*height`，均纳入 maxReadbackBytes。PACK_ALIGNMENT 为 1，row/skip 参数为零；恰好归一化一次行方向，不暗增未计费的全尺寸副本。

## 分配与颜色边界

Shared 顶点 stride 为 52B，五个属性的 offset 为 0/8/16/32/44。128B uniform 在 0/16/32 是 float vec4，在 48/64/80/96/112 是 uint uvec4。带区域的绘制使用的程序在顶点阶段还有第二个 block，位于绑定点 1：区域表的一个窗口，1,023 个 uvec4，共 16,368 字节。不带区域的绘制使用没有这个 block 的程序。每个程序的每个 block，GLSL highp/std140 链接后的 offset 和 block size 都必须匹配。启动时要求 MAX_VERTEX_ATTRIBS ≥ 5、MAX_UNIFORM_BLOCK_SIZE ≥ 16,368、MAX_UNIFORM_BUFFER_BINDINGS ≥ 2、MAX_VERTEX_UNIFORM_BLOCKS ≥ 2，均在 OpenGL ES 3.0 的保证范围内。B1 保持 24B 顶点、64B uniform 和 Uint32 索引，包括索引 65,535。

每个已接受 record 至多使用一个 shared vertex arena 和一个 UBO arena。原 typed payload 上传到原生范围，不增加全帧 CPU concat。N 个 physical shared batch 时，查询 A，要求安全整数且 `4 <= A <= 256 && A % 4 === 0`。使用 `s128=ceil(128/A)*A`；V 是原 payload 字节之和，U 为 `N*s128`。范围 i 从 `i*s128` 开始，大小为 128 字节。最后 padding 也分配、计费，但只上传原始字节。没有 draw 就没有 arena；MAX_UNIFORM_BLOCK_SIZE 限制单块，不限制整个 arena。不假设 alignment 是二次幂。

含有带区域绘制的 record 另外租用一个 uniform buffer 存放区域表，不属于上述两个 arena。取 `sW=ceil(16368/A)*A`，共 W 个窗口，窗口 w 从 `w*sW` 开始，buffer 大小为 `(W-1)*sW+16368` 字节，保证最后一个窗口也能整块绑定；只上传帧内各区域的行。W 最大为 13，对应 4,096 个区域。所有绘制都不带区域的 record 不租用这个 buffer。

| 实际 arena 上限 | 每 record | 两个 pending record |
| --- | ---: | ---: |
| V | 33,554,432 B | 67,108,864 B |
| U | 16,777,216 B | 33,554,432 B |

原联合 upload 与调用者更低的上限继续有效。整块 arena 在 record 的 fence/PBO/CPU 义务全部结束前保持独占。安全归还与其他 buffer/color/depth 竞争同一 32 MiB/4,096 idle-plus-reserved 预算；安全但超额的 owner 被删除。B1 至多增加 128 个 geometry buffer，每个 scene record 的 draw-related buffer 因而至多 130 个，不含页面/target/PBO/sync/固定状态。这些是账面/对象边界，不是实测速度或内存。保留每帧 64 页/16 MiB 逻辑需求、32 MiB/256 READY 页面、32 MiB 冷 CPU 峰值和 8 MiB batch scratch。

Canonical capped page bytes 保持 RGBA8。整数 tap 先解码再进行逻辑 nearest/linear 插值，保留 page/region 寻址、trim、quarter turn、虚拟透明、strict isolation 和 8,192 periodic / 2^20 nonperiodic 资格。物理 filter 为 NEAREST、level 为零；POT 与 NPOT 使用同一配方。不新增 16F 或假定硬件 sRGB filtering 的路径。

通过资格的路径使用单采样 SRGB8_ALPHA8 working target，以及 LINEAR attachment encoding 的普通 unsigned-normalized 八位 RGBA 默认存储。另行请求并记录 sRGB canvas 解释。保留五种 FUNC_ADD blend 配方、逐写入 target 量化、禁用 dithering 和一次最终 resolve。对解码 target (C,a)，透明 resolve 为 `(a*E(clamp(C,0,a)/a), a)`，alpha 零时为零；不透明为 `(E(clamp(C,0,1)),1)`。Add-preserve 仅允许 opaque。手工 sampling 不允许 framebuffer-feedback blending。

B1 使用 `zGL=2*zExisting-w`、clear depth 零/GREATER/depth writes、透视插值，然后关闭 depth 绘制 UI，全程一次 clear 与一次 resolve。Backing-space Y 映射、working-target fetch 和左下起始 readback 归一化必须构成固定一致映射。

原生资格记录实际 attributes、component type/size 和 attachment encoding；默认 DRAW_FRAMEBUFFER 绑定时查询 BACK，working FBO 查询 COLOR_ATTACHMENT0。必须用固定 literal witness 验证 working 完整性、readPixels 存储值解释、最终 transfer 和黑/白背景合成。仅 `drawingBufferColorSpace` 不够。精确配置不支持时拒绝 FORMAT_UNSUPPORTED；不替换未验证格式、不新增 drawingBufferStorage 依赖、不根据输出补偿 transfer。

## 复现有限像素矩阵

显式独立入口为 `tools/verify-shared-webgl2.mjs`。先按文档准备固定版本工具链与构建产物，再从仓库根目录使用已安装的 Playwright 1.62.1 运行；输出必须是仓库及依赖所有者目录之外、尚不存在的绝对目录：

    node tools/verify-shared-webgl2.mjs --playwright <absolute-installed-playwright-directory> --channel msedge --output <absolute-fresh-output-directory>

入口以默认无界面模式启动 Edge，不添加图形参数。保留原有 30 个用例、321 个点位、1,236 个通道及 104 个渗色见证，再依次执行十一组全新基线／指定变异／健康还原，共 63 个全新浏览器 context。每个指定变异保留唯一源码锚点及已审查的原始／变更原始字节哈希，只能修改一个被服务的构建模块。仓库产品文件不被改写。现有共享 WebGPU 用例、反例、标量参考与阈值分别保留。

采集器记录完整有限输入闭包、原始 RGBA、黑白背景 PNG、各 context 结果与清理记录。`result.json` 仅对该次运行记录的输入与验收范围有效；进程零退出不能独立证明验收。能力缺失、清理未完成或输入变化均不能通过。本像素入口不证明原生恢复／深度／状态验收、性能、手机或跨设备支持；这些义务须有各自记录。[证据记录](webgl2-executor-evidence.md)分别记录已观察的私有／公开结果、独立复核、完整门禁与交付。

## 有限验收与来源

验收区分公共 API/strict 边界、受控行为、私有元数据 unit、原生资格、原生像素/生命周期、性能及交付。公共行为消费真实 built SDK 值；私有 unit import 需要精确策略许可。执行前冻结 source closure、案例、阈值和控制。

必需分组覆盖选项/receiver/Engine 语义；exact-fit/+1 费用和 A=4/12/16/256、A=3 拒绝；A=12 混合范围/padding；整块 owner 退休及未知清理；连续提交两帧且 B 覆盖 canvas 后延迟读回仍为 A；稳定 readiness promise/deadline/旧工作/close 竞态；真实 WEBGL_lose_context 失效、恢复、saved-frame 重放与 safe close。扩展或实际恢复缺失时为 INCOMPLETE。

复用原 30 cases/321 points、独立 scalar reference，以及声明 fixture 的逐通道界 Q0 `[0,0,0,0]`、Q1 `[1,1,1,1]`、Q2 `[2,2,2,1]`、Q3 `[3,3,3,2]`，至多四次有效颜色写入。Bounded 禁止蓝色 bleed 至多一；strict bleed 与透明安全区域精确零。指定错误模型 margin 至少 16 且至少 `4T+4`。冻结十一项 GL 控制，以行归一化错误替换 BGRA 专属控制，并加入固定 depth-remap/state-reset witness。保留原始 RGBA、黑/白 capture、实际浏览器/context/renderer 信息与清理。OS 清单不能确定实际选用的 GPU；仅后端相等不足以证明正确。保留受影响 Canvas/WebGPU/B1 回归与完整门禁。

实现依据现有第一方契约独立编写，并保留相应标准参考与依赖归属。第一方代码与文档保持 Apache-2.0，并保留依赖和素材归属。继承已审设计的第一手参考：[Khronos WebGL context/drawing buffer](https://registry.khronos.org/webgl/specs/latest/1.0/)、[Khronos WebGL2](https://registry.khronos.org/webgl/specs/latest/2.0/)、[OpenGL ES 3.0.6](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf) §§2.12.6.5、2.18、3.8.16、4.1.7–4.1.8、4.3.2、6.1.13 与 Table 6.33，以及 [drawingBufferColorSpace](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawingBufferColorSpace)。原设计记录查阅日期为 2026-10-18；因 `/latest/` 会变化，实施准入必须保存采用的版本/文本。当前执行结果与剩余支持边界分别记入[证据记录](webgl2-executor-evidence.md)。
