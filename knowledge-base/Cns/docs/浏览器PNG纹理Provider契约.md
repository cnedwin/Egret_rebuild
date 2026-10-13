# 浏览器 PNG 纹理 Provider 契约 — BIP1

[English](../../en/docs/browser-png-contract.md) | 简体中文

## 当前 0.46.0 公开材料截止点 — 2026-10-14

可选浏览器 PNG 适配器的源码、4/4 终态回归、95/95 公开 CPU／冷导入用例、五组严格类型诊断（0/32/54/0/6）、公开类型门禁、17/17 新策略用例及 272/272 保留边界用例、39/39 观察器 UNIT 用例均已独立接受。各计数属于不同范围，不合并。原生采集器 R2 源码、采用／语法及输入准备已接受。独立保存结果评审已按 PASS_ACTUAL_BOUNDED_NATIVE_PNG_BROWSER_SUBSET_ONLY 接受限定默认浏览器 Canvas／WebGPU PNG 子集，包含 6 次提交／192 个像素／768 个通道，容差 0。当前完整仓库／推送门禁、本增量推送／PR／Main 与远端 CI 验收仍为 PENDING。

下方保留章节记录原 2026-10-13 源码／文档截止点，其中 NOT_RUN 保留当时的历史范围；当前状态以本后继章节为准，行为契约与冻结的数值安排不变。

当前公开文档草稿，2026-10-13。规格与当前实现已通过独立源码评审；有界 CPU／冷导入、严格类型及观察器 UNIT 证据已获独立接受。当前自有副本策略对照也已获独立实际接受；原生浏览器验证、完整仓库门禁及交付仍待完成。参见[证据与保留的失败](浏览器PNG验证证据.md)、[实施计划](浏览器PNG实施计划.md)及[原生验证日程](浏览器PNG原生验证计划.md)。本契约定义下面 profile 的一个可选浏览器资源适配器。

## 1. 公开边界与所有权

仅 `@egret/engine/web/image` 暴露一个运行时值 `createBrowserTextureProvider` 和以下四个擦除接口。Engine/runtime/contracts 默认入口、`@egret/engine/web`、WebGPU 入口及其依赖不增加图片 provider API 或浏览器工作。适配器只导入公开 contracts/runtime 身份，不增加依赖、fetch、timer、scheduler、cache 或 PNG codec。cold import 不读取浏览器全局，也不分配宿主资源。

```ts
export interface BrowserPngDecodeOptions {
  readonly imageOrientation: 'from-image';
  readonly premultiplyAlpha: 'none';
  readonly colorSpaceConversion: 'none';
}
export interface BrowserPngPorts {
  readonly decode: (blob: Blob, options: BrowserPngDecodeOptions) => Promise<ImageBitmap>;
  readonly createCanvas: () => HTMLCanvasElement;
}
export interface BrowserTextureProviderOptions {
  readonly readBytes: (ref: AssetRef<Texture>, context: AssetLoadContext) => Promise<Uint8Array<ArrayBuffer>>;
  readonly ports?: BrowserPngPorts;
}
export interface BrowserTextureProvider extends AssetProvider<Texture> {
  readonly profile: 'png-rgb-rgba8-browser-normalized-v1';
  readonly isClosed: boolean;
  close(): Promise<void>;
}
export function createBrowserTextureProvider(options: BrowserTextureProviderOptions): BrowserTextureProvider;
```

既有 `AssetProvider<Texture>` 提供 `load(ref, context): Promise<Texture>` 与同步 `dispose(value): void`。冻结的 provider record 对上述方法、close 和 isClosed 检查精确接收者；profile 在关闭后仍可读取。load 对错误接收者拒绝 Promise；dispose 和 close 同步抛出。重复调用真实 close() 返回同一个 Promise。

调用方拥有 provider，借用浏览器 ports/document。AssetManager 捕获 load/dispose 方法及接收者，**不**拥有或等待 provider.close。不能把 provider 当作 Disposable 交给 Scope.use。先关闭 Engine/manager 需求，再独立等待 provider.close。关闭 provider 不 dispose 已交付 Texture 或其租约；它们由 manager 需求控制退休。dispose 在关闭后继续可用，仅接受本 provider 创建并交付的 Texture，调用捕获的原始 Texture disposer，重复调用幂等。外来／伪造值拒绝且不触碰。

复用既有 `createImageData2D(input: ImageData2DInput): ImageData2D` 与 `createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture`，不添加 Engine 方法或私有 context assembly。Texture/ImageData2D 身份本身没有 Engine 亲和性。由真实 engine.assets 获取值，在该 Engine 的 Scope 中保留 AssetLease<Texture>，再将同一 lease 交给 createSpriteSheet/Bitmap；既有原始 lease/context 检查继续拥有裁决权。Provider 可登记到多个 manager，不合并它们的 generation 或租约所有权。

## 2. Factory 与调用快照

options 必须是非空对象。按 readBytes、ports 顺序各读取一次，再校验值；不读取未知字段。后续读取抛错优先于此前非法值。显式 ports 必须为非空对象，否则 OPTIONS_INVALID，不读取方法。对准入 ports 按 decode、createCanvas 顺序各读一次，再验证函数。捕获 callback 及原接收者：readBytes 使用 options 接收者，提供的方法使用 ports 接收者。用内建调用方式，不依赖可替换的 .call/.apply 属性。

省略 ports 时，factory 捕获当前同窗口 document、其原始 createElement、window.createImageBitmap 及接收者、原始 ImageBitmap.prototype.close、Blob 构造器；能力缺失即拒绝。默认 createCanvas 创建全新未挂接 Canvas。显式 ports 是可信平台／测试操作，遵守同一所有权协议；不证明浏览器解码或认证 native handle。显式 ports 仍需捕获 native Blob 构造器，但不读 window/document；调用者不会获得 provider 自有字节数组。不提供备用 decoder，也不懒替换已捕获操作。

每次 load 在读 context 或调用 callback 前预留 job。顺序：精确接收者 → provider 已关闭 → occupied-job 上限 → context 快照。非对象／null context 在读字段前以 CONTEXT_INVALID 拒绝。按 signal、resourceGeneration、taskId 顺序各读一次，每次成功后检查 closed gate；bootstrap 不轮询尚未验证的 signal。完整快照后再做值校验：signal 是非空对象，两数值身份是正安全整数；随后进入普通 checkpoint。其含义仍局限于 manager，provider 不做全局 generation 查找，不认证伪造 AssetRef；真实 manager 在调用前认证 ref。向 readBytes 原样传递**原始** ref 和冻结的 manager context，后续检查使用已捕获 signal。

普通 checkpoint 中，provider 关闭优先于 signal 取消。未关闭时读取 signal.aborted，必须为 boolean；仅在 true 时读取 reason。signal getter 抛错是 signal-read error。成功的外部读／call／write 前后以及 source/decode await 结算后检查。多字段快照中，每次成功读取后先 checkpoint 再读下一字段；仅完成全部快照后才做值校验。callback/getter 抛错保持该阶段主失败，即使同时取消／关闭，也不能被后续 checkpoint 替换。第 5 节退休准备是例外，用于释放刚返回的 handle。

Signal 轮询本身就是 checkpoint，不递归轮询；每次 aborted/reason 成功读取后，仅再次检查 closed gate，再校验／继续。Aborted 类型非法是 SIGNAL_READ_FAILED，cause 为 TypeError；signal getter throw 保留原始 cause。成功的 signal getter 若关闭 provider，则 PROVIDER_CLOSED 先于取消。

## 3. 固定 profile 与上限

固定且不可由 factory 覆盖：4 occupied jobs，每次编码字节 8,388,608，已准入编码 payload 总计 33,554,432，1,024 chunks，source edge 4,096、pixels 1,048,576（后两项复用 IMAGE_LIMITS_2D）。无队列或自动重试。occupied 包括未结算及隔离 job。这些约束准入和源码所有的记账，**不**约束浏览器内部副本、decode 峰值、GPU 分配、实体 RAM 或 OOM 安全。

Aggregate 上限等于四个最大 payload；固定 job/per-load 上限下，无法合法到达独立 aggregate one-over load。应验证四 payload 端点及指定 JOB_LIMIT／单次 INPUT_LIMIT 拒绝，不虚构不可达 aggregate-negative 见证。

用 Promise 机制解析 readBytes，不假设 native Promise 品牌。成功值必须为内建 Uint8Array，可接受合法非零 offset view；拒绝 SharedArrayBuffer、detached/resizable buffer、非法 backing/type。先用内建读 backing/offset/length，再精确复制所选字节到一个私有数组；不调用用户 iterator、species 或实例 getter。复制前预留 encoded credit，仅在完整干净退休后返还。不修改／detach reader 输入。复制与完整 preflight 结束前不触发浏览器操作。

Preflight 是自有副本上的有界结构读取。完整 framing 与准入 chunk 长度／次序检查先于 value/profile 检查，故后续 framing fault 优先于此前 unsupported feature；未完成扫描不进入 decode。格式依据 [PNG 3 第 5、11 节](https://www.w3.org/TR/2025/REC-png-3-20250624/)；以下是 **Egret 子集**，不是所有合法 PNG：

- 精确八字节 PNG signature。以边界检查、无符号 big-endian 整数读取 length/type/data/四字节 CRC，要求精确结束，不假设 alignment；length 不超过 2^31−1，type 是四个 ASCII 字母且第三个大写；至多 1,024 chunks。
- 首个且唯一 IHDR，data 长 13；正尺寸且在上限内。bit depth 8，color type 2 或 6，compression/filter/interlace 字段 0；其他组合 unsupported。
- IDAT 前，sRGB、gAMA、cHRM 各至多一个。sRGB 长一字节，值 0–3；gAMA 长四字节、值 45455；cHRM 长 32 字节，依次为 31270,32900,64000,33000,30000,60000,15000,6000。gAMA/cHRM 要求 sRGB 同时存在。兼容值来自 [第 11.3.2.5 节](https://www.w3.org/TR/2025/REC-png-3-20250624/)，不保证设备 rendering-intent 保真。
- 一个或多个连续 IDAT，data 累计非零；唯一空 data 的 IEND 结束文件。准入 chunks 重复／错序及 trailing bytes 是结构错误。其他类型包括 palette、tRNS、ICC/HDR、EXIF、文本／private 与动画 chunks 全部拒绝为 unsupported，不静默剥离。

读取器只核对 CRC **存储位置**，不核算正确性，不实现解压、滤波或颜色 profile 算法。浏览器接受才提供实际解码，也不是完整 CRC／conformance 保证。不产生完整性哈希或安全认证。

## 4. 解码与归一化值

由自有副本构造 immutable image/png Blob。捕获的 decode 只调用一次，传入全新冻结的三字段 options，顺序为 imageOrientation、premultiplyAlpha、colorSpaceConversion；无 resize/crop 字段。[当前 HTML ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap) 的方向选项是 from-image/flipY；本适配器选 from-image，preflight 拒绝 EXIF。

Bitmap fulfillment 后先登记实际返回 handle 的退休责任，捕获 close 及接收者；随后 checkpoint，再按 width、height 顺序读取，要求正安全整数且精确匹配 IHDR。Decode 拒绝没有 bitmap 退休。默认 ports 使用捕获的原始 native close；显式 handle 提供一个捕获 close 方法。无法关闭的 object 结果隔离该 job；primitive／缺失结果不虚构 handle。

通过 port 取得一个全新、自有、未挂接 Canvas。显式 port 承诺新建 Canvas 并转移独占临时所有权；无法仅凭返回值认证未见过、未挂接 Canvas 的借用关系。isConnected 读取一次，必须为 false。拒绝本 provider 已观察过的 bitmap/Canvas 身份，不关闭或 resize 其此前所有者的 handle。已连接或重复 surface 非法，不能 resize/detach，应保留所有权拒绝原因并隔离。身份记账是 weak handle registry，不是 asset cache。在普通工作前确定返回 surface 是否可安全退休，即使创建 callback 已发生 terminal 变化；退休准备后遵守普通 checkpoint。

依次设置 width、height 并验证回读。捕获 getContext，首次请求 2d，options `{alpha:true,colorSpace:'srgb',willReadFrequently:true}`；捕获 getContextAttributes，按 alpha、colorSpace 快照后校验为 true/srgb，不读其他返回属性。willReadFrequently 仅是请求 hint，不是成功条件或性能结论。按 setTransform、drawImage、getImageData 顺序捕获后才验证函数／使用。调用 setTransform(1,0,0,1,0,0)；依次设置并验证 globalAlpha=1、globalCompositeOperation='copy'、imageSmoothingEnabled=false、filter='none'、shadowBlur=0、shadowOffsetX=0、shadowOffsetY=0、shadowColor='rgba(0, 0, 0, 0)'。Bitmap 在 (0,0) 绘制一次，不缩放；读取完整 image 一次。

回读按 width、height、data、colorSpace 顺序快照，再校验；尺寸须精确、srgb、内建 Uint8ClampedArray，backing 是 fixed attached ArrayBuffer，紧密字节为 4*width*height。创建内建 Uint8Array view，再用既有 createImageData2D 获得自有 pixels；不改写颜色／alpha channel。完成临时退休，再 checkpoint，然后调用既有 createTexture(image) 的完整 image 默认值。load 解析前登记已发行的真实 Texture，commit 不调用用户 callback。

输出是**浏览器归一化的 straight sRGB RGBA8/top-left 字节**，不是作者 PNG 无损相等。[Canvas 使用预乘 backing](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context)，故 decode 选项不能避免 hidden RGB 与半透明精度损失。Opaque／transparent-black golden 的成功比较只证明记录中的浏览器子集；当前原生 PNG 运行尚待完成，不证明 full-alpha/HDR/颜色管理保真。[Blob 表示](https://w3c.github.io/FileAPI/#blob-section) 的来源是 Editor's Draft；raw-data immutability 不等于 codec 支持结论。

## 5. 终止、清理和关闭

状态路径：reserve → read → owned/preflighted → decode pending → bitmap owned → surface/readback → cleanup → commit → clean retirement。失败／取消跳过后续普通工作，但仍退休实际取得的每个 handle。Source/decode Promise 不结算时继续占用 job/credit；不新增 abort listener、timer 或虚构取消完成。Manager 可以先拒绝 waiter，直接 provider.load 仍可能等待外部结算。

退休准备可在 await/callback 返回后且已 terminal 时获取 bitmap.close 或确定 surface 所有权，但不能 draw/read pixels。退休 getter 失败必须保留并隔离未知所有权。尝试 bitmap close 一次，再 canvas width=0/回读、height=0/回读；第一次 reset 失败也继续第二次。不关闭 document/window/借用 ports。实际 cleanup-attempt errors 按尝试顺序记录；使用独立主失败 boolean，让 thrown undefined 仍是主因。

无法关闭的 object、已连接／重复 handle 或退休 descriptor 抛错，另保留 quarantine reason，不虚构清理尝试。若无更早工作失败，load 主 code 为非法形状／所有权的 BITMAP_INVALID/SURFACE_INVALID，或 descriptor 抛错的 DESCRIPTOR_READ_FAILED；cause 是原始 thrown 值或自定 TypeError。未尝试 close/reset 时，load.cleanupErrors 保持空。Quarantine reasons 按观察顺序包含上述所有权／能力拒绝及实际清理失败值；保留原因本身也可能是 undefined。

已有工作失败时保留 code/cause，并附完整冻结 cleanupErrors。没有工作失败但清理失败时，以 WEB_PNG_CLEANUP_FAILED 拒绝，cause 是首个 cleanup 值；不发行 Texture。干净 cleanup 后才进行最终 terminal checkpoint 和 commit。清理失败保留 job slot/encoded credit 及失败自有 handle 记录为隔离，不给予重试或资源回收结论。

真实 close 在观察前同步关闭准入门，再等待全部已准入 job 结算并尝试退休。它不 abort 原 manager signal，不中断 native decode，不 invalidate ref，不 dispose 已发行 Texture。外部不结算使 close 持续 pending，timeout/containment 由应用／外部 host 拥有。结算后仍有隔离时 close 以 WEB_PNG_CLOSE_INCOMPLETE 拒绝，cause 为首个保留 quarantine reason；其冻结 cleanupErrors 包含全部 reasons，按 job 准入顺序，再按各 job 观察顺序。这一 close 专用列表包含拒绝，不能据此断言不可用操作实际执行。保留同一 close Promise；干净 close 解析 undefined。调用者 Texture dispose 后续仍独立可用。

Manager invalidate 仅移除未来路由，旧 waiter/lease 可以在旧 entry 完成；必须测试两代，不重定义为取消。最后需求消失或 manager/Engine 关闭可 abort signal。已 terminal entry 的晚到成功按既有一次性 dispose 路径处理；不增加 provider cache 或共享 ref-id map。

## 6. 错误与观察

稳定 provider codes：WEB_PNG_OPTIONS_INVALID、WEB_PNG_DESCRIPTOR_READ_FAILED、WEB_PNG_UNAVAILABLE、WEB_PNG_PROVIDER_INVALID、WEB_PNG_PROVIDER_CLOSED、WEB_PNG_JOB_LIMIT、WEB_PNG_CONTEXT_INVALID、WEB_PNG_SIGNAL_READ_FAILED、WEB_PNG_CANCELLED、WEB_PNG_READ_FAILED、WEB_PNG_BYTES_INVALID、WEB_PNG_INPUT_LIMIT、WEB_PNG_STRUCTURE_INVALID、WEB_PNG_PROFILE_UNSUPPORTED、WEB_PNG_BLOB_FAILED、WEB_PNG_DECODE_FAILED、WEB_PNG_BITMAP_INVALID、WEB_PNG_SURFACE_INVALID、WEB_PNG_RASTER_FAILED、WEB_PNG_READBACK_INVALID、WEB_PNG_VALUE_INVALID、WEB_PNG_CLEANUP_FAILED、WEB_PNG_CLOSE_INCOMPLETE。契约其他位置的简称始终保留 WEB_PNG_ 前缀。

外部属性读取用 DESCRIPTOR_READ_FAILED，signal 读取用 SIGNAL_READ_FAILED；默认浏览器 capability 捕获／缺失用 UNAVAILABLE，source call/rejection 用 READ_FAILED，Blob 构造用 BLOB_FAILED，decode call/rejection 用 DECODE_FAILED，surface/context/drawing/write 失败用 RASTER_FAILED。非法返回形状对应 BITMAP/SURFACE/READBACK_INVALID，标量／字节准入对应 input code。自有 image/Texture 物化或外来 value dispose 拒绝用 VALUE_INVALID。全部保留原始 cause，含 undefined；unsupported／malformed／budget 用 TypeError/RangeError cause，不冒充浏览器错误。Manager acquire 可以包为 ASSET_LOAD_FAILED，测试检查原 provider cause，不改 manager 语义。计数、字节或逻辑 close 不证明 GC/device 回收。

## 7. 八类验收与证据边界

| Family | 必需独立见证 |
| --- | --- |
| BIP01 | 精确 optional facade/types、cold import inert、DOM/Node-free roots、DAG/default routes 保持。 |
| BIP02 | 快照顺序、getter throw、内建 offset view、backing refusal、callback 前 copy 所有权、encoded/chunk/dimension 上限及 fresh legal controls。 |
| BIP03 | 窄 chunk/profile 拒绝后不调用 decoder，literal 原始 PNG 与独立生成字节／pixels；产品负责结构准入，图片解码交由浏览器。 |
| BIP04 | 原 ref/context/receiver、四 pending jobs／无队列、source/decode 取消／晚到 fulfillment，不提前返容量或遗漏 rejection。 |
| BIP05 | 返回 bitmap/surface 退休准备、精确 readback/normalization、全部失败点、含 undefined 主因、所有 cleanup 尝试与隔离。 |
| BIP06 | 真 built AssetManager 共享／独立 leases、invalidate 两代需求、Engine 关闭／晚到值、provider close 保留交付 Texture、幂等 dispose。 |
| BIP07 | 真公开 SpriteSheet/Bitmap/clip/clock 合成，默认真实浏览器 RGB／RGBA opaque+transparent-black decode，Canvas/WebGPU pixels 与保存 image/frame 生命周期；执行前固定 counts/tolerances。 |
| BIP08 | 无 suppression 严格 types、baseline-first policy controls、独立 native/source/actual review、中英来源／含义及完整 prepush／hook／交付。 |

显式 ports 的 CPU 结果验证适配器行为。原生 codec／渲染接受须使用默认真实浏览器路径、第一方原始 PNG 和独立的 RGBA 字面预期；该运行仍待完成。手机、小游戏、Native SDK、实体 GPU、耗电与性能覆盖未验证。这个独立实现的 Egret 适配器不增加运行时依赖。完整 PNG／alpha／3D material、完整 Spine R020/V020 及迁移 R008/V006 保持 OPEN。相关既有契约：[资源](资源核心合同.md)、[命名图集](命名图集契约.md)及[时钟驱动序列动画](时钟驱动序列动画契约.md)。
