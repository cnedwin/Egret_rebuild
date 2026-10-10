# WebGPU 矩形实现证据——修订 0.6

**发布检查点历史与最终原生绑定：** 下文已接受956原生结果保留原身份；在 `1aa0248` 运行前检查点，仅注释重建绑定当时仍待执行。随后仅注释入口重建的真实浏览器WebGPU运行在 `1aa0248a1ff6d8e54c42d631072223bb50483814`、2026-10-08T21:23:54.294Z以0退出并记录PASS：42帧、1709项原始断言、84张PNG截图、6808项合成断言、8项预期反例及0项意外错误。7项反例变异生产代码副本，1项为合成断言。233项源码/构建/工具/依赖清单身份在该运行前后相等，且与当时仅文档和元数据变更的后继版本一致。实际运行由验证作者执行；独立修正及原生绑定复审、最终语义凭据和发布仍待完成。见[仅注释证明](../evidence/webgpu-entry-comment-proof.json)、[整理验证](../evidence/webgpu-verification.json)及[范围审查记录](../evidence/webgpu-review.json)。

2026-10-09。[Complete English](WebGPU矩形实现证据.en.md) · [规范合同](WebGPU矩形执行合同.md) · [实施计划](WebGPU矩形实施计划.md)。

本文件是实验性浏览器矩形执行的有界已记录证据。数值 CPU 修复已取得范围内 SPEC/QUALITY 审查接受；随后完整原生运行与整项审查在修复源码取得 **PASS / SPEC PASS / QUALITY PASS**，公开证据核对及发布仍 PENDING。本草稿读取已有凭据，不宣称新执行、完整人工图像审计或最终公开批准。

## 证据状态与时间顺序

| 范围 | 已记录状态 | 边界 |
| --- | --- | --- |
| 帧复制/依赖/有界准备 | 在 `ee24f9fb0f5bb103a1cb34b9cd9b5ba63bd28d42` 接受 | 继承子系统 1 接受，不由计划重置。 |
| 集成 host/pass/生命周期及 R1–R4 修复 | 接受至 `c80d3f49aea64df2891418c0ae18d563bb5d2f9f` | 继承子系统 2+3 接受；mock 不证明原生像素。 |
| 文档修订 0.5 → 0.6 | 范围内 PASS | 仅受保护数值规则/相关计划，不转移实施或原生接受。 |
| 数值 CPU 修复 | `956e2f9894dc8e27291ffd0210a6cd8b4e651eab` 取得 SPEC PASS / QUALITY PASS | BASE `aea6314622083737631d56e8c7e757118779d0fa`；一份生产源码加两份测试文件，92 行新增 / 4 行删除。 |
| 历史原生尝试，包括第五/第六次 | FAIL，保留 | 严格规则下 F4 在两种读回配置准备失败；新结果不改写这些尝试。 |
| 修复源码原生续跑 | 已观察运行 PASS | 完整源码范围及最终原生 gate 独立审查 SPEC PASS/QUALITY PASS，公开证据投影仍 PENDING。 |
| 公开证据核对及交付 | PENDING | 已接受原生数量如实记录；最终导出身份、source-origin 投影及发布凭据仍待完成。 |

标注 0.4 的复制来源研究/决策记录保持历史身份；旧 pending/installed 标记及探针观察不作为当前实施或原生认证。仍有关的技术决策在下文整理。

## 失败、最小修复及回归历史

原规则使用规范 `t=u/(u+v)`，t 舍入到端点则拒绝。原样独立 F4 层级使用合法公开变换，生产复制通过，准备在打包前以精度错误拒绝。真实 CPU 观察得到有向 A=(15.999999999999996,36)、B=(16.000000000000004,-4)，规范 P=(4,16)、Q=(15.999999999999998,28)，u=480、v=2^-46、sum=480、t=1。在 480 附近 v 为 binary64 ULP 的四分之一。稳健异侧符号证明交叉，但不能阻止接近 1 的插值权重舍入至 1。

范围内修复保留严格 `0<t<1` 时 x-then-y 的 `P+t*(Q-P)` 运算；仅 `t===1` 直接算 `s=v/sum`、要求有限 `0<s<=0.5`，再逐分量构造 `Q+s*(P-Q)`。互补约为 2.960594732333751e-17，该算术可以合法舍入至 Q；不是端点替换、1-t、钳制、吸附或容差。正且有限行列式、sum/t 检查、包络、分量范围、缓存、规范化与拓扑规则保留。

| 已记录步骤 | 实际结果 |
| --- | --- |
| 修改源码前：两项新增数值回归 | 退出 1、0/2；见证准备与完整不可变公共 F4 均以 Geometry preparation precision 失败，不是缺模块失败。 |
| 最小修复后编译构建 | 退出 0。 |
| 修复后首次聚焦运行 | 退出 1、19/20；两项新回归通过，唯一失败是旧预期精度拒绝（Missing expected exception）。予以保留，未隐藏。 |
| 窄幅替代历史预期 | 两次交点真实局部值 u=3、v=3*2^-60、sum=3、t=1；直接互补构造 x=-2^-60，闭 viewport 删除外侧薄片，points=[]/commands=[]、edgeTests=110。旧源码和实际原拒绝日志保留。 |
| 最终聚焦运行 | 退出 0、21/21，无失败/skip/cancellation。补充严格内部位模式检查在两项有意义 RED 后加入，不宣称它有独立修改前 RED。 |
| 最终顶层核心运行 | 退出 0、177/177，无失败/skip/cancellation；包含 21 几何、46 host、4 pass、10 Canvas host，以及已有核心检查。 |

Inspector helper 曾因错误相对模块 URL 在几何运行前失败，修正执行另行保留，该设置错误不属于数值 RED。最终观察禁止副作用地读取实际生产局部值，不修改源码、globals、谓词、prototypes 或私有状态。

两种遍历方向产生相同 binary64 点位模式、三个规范化见证点及 95 次边测试。严格内部 2/3=`3fe5555555555555`、4/3=`3ff5555555555555` 固定值在正向/反向/重复裁剪通过。原菱形/仿射端点、去重/共线/no-op、反射/错切、薄/近共线、嵌套有理数、包络、拓扑及预算样例保持通过。

一次裁剪边内相同无序端点对的 cache-hit 复用未实际运行观察。有界合法回归未触发 t===0、无效/非有限行列式/参数或不可用互补分支。这些保护及缓存复用保持原样/经源码审查，不虚构运行覆盖。

## 实际原样 F4 CPU 准备与打包

回归通过公共 createEngine/Sprite 构造固定层级：旋转外祖先、菱形祖先、x≥16 半裁剪、绿色叶节点、未裁蓝色兄弟。公开 Engine.captureFrame 得到不可变 48×40 透明清屏帧，随后实际生产 copy、preparation、packing 执行。CPU 预期不导入/变换原生 fixture、harness 或 oracle。

- 绿色多边形：(28,16)、(15.999999999999998,28)、(16.000000000000004,4.000000000000002)，pointIndices [0,1,2]、color 65280、alpha 1。
- 蓝色兄弟：(32,4)、(40,4)、(40,12)、(32,12)，pointIndices [3,4,5,6]、color 255、alpha 1。
- 七个存储点、两个保序命令、edgeTests=336；打包容量 **216 字节**；区间 **{firstVertex:0,vertexCount:3}**、**{firstVertex:3,vertexCount:6}**；collapsedTriangles=0；最大 float32 backing 重建位移 **4.76837158203125e-7**。

此 CPU 路径未记录后续交点/拓扑/打包失败。输出属于诊断，不能拟合原生像素预期。独立采样仍为绿色 (20,16)、透明 (10,16)/(26,6)、蓝色 (36,8)、两种读回配置及黑/白背景合成。

## 已记录编译、边界与关闭检查

| 检查 | 实际记录结果 |
| --- | --- |
| 编译构建 | 退出 0；构建先于最终测试，数值交接中随后无 source/test 改动。 |
| DOM/包/源码/构建/声明边界 | 退出 0；123 文件、实际导出及无 DOM 检查。 |
| 公开/无 DOM/负向类型 consumer | 退出 0；28 项实际预期负向诊断，不是未解释错误。 |
| Headless Engine 关闭 | 退出 0；scope/tree/Engine closed，pendingTimers=0。 |
| 独立数值实施审查 | SPEC PASS / QUALITY PASS；审查者读取已记录检查而未重跑，并重新检查全部 110 项最终记录 hash 及 13 个检查点路径。 |

此前记录路径中仅准备源码及窄历史几何测试改变，新增数值测试单独登记。13 个受保护检查点中 11 个逐字节不变，只有修复准备源码及生成 JS 不同。数值修复不改 Canvas、GPU copier、host/pass、runtime、默认值、配置或独立 F4 fixture。

## 已接受有界原生运行及独立审查；发布 PENDING

随后已记录原生运行在 2026-10-08T20:17:25.506Z 报告 **PASS**，源码 `956e2f9894dc8e27291ffd0210a6cd8b4e651eab`、退出 0：42 帧、0 个必要样例失败、1709 次原始检查、84 张截图、6808 次合成检查、8 个预期失败反例、0 个意外错误。原样 F4 在两种读回配置及全部四种黑/白背景组合通过。完整有界原生任务随后在相同源码身份取得独立 SPEC PASS/QUALITY PASS。已接受原生结果与公开证据核对及发布 PENDING 是不同状态，证据记录保留原始运行/最终审查身份和限制。

已记录环境：Edge 154.0.4258.62、Playwright 1.62.1、Node v24.19.0，全新默认 headless msedge profile、无额外 flags、安全 loopback、deviceScaleFactor/浏览器 DPR 1。API/default adapter/default device 成功。首选及实际生产 source format 为 bgra8unorm，返回 ticket 为 rgba8unorm/srgb/premultiplied。未由此认证未观察到的原生 rgba8unorm 目标设备。截图解码器为 pngjs 7.0.0/MIT，公开 PNG.sync.read、RGBA 输出、不调整 gamma；属于验证工具，不是新引擎运行时基础依赖。

捕获的 device limits（与 adapter limits 分开）：maxTextureDimension2D=8192、maxBufferSize=268435456、maxVertexBuffers=8、maxVertexAttributes=16、maxVertexBufferArrayStride=2048、maxColorAttachments=8、maxColorAttachmentBytesPerSample=32。adapter 报告限制依次为 16384、2147483648、8、30、2048、8、128。nvidia/blackwell/isFallbackAdapter=false 为报告元数据，不认证硬件加速。

原样 F4 原始检查及 nested readback/disabled × black/white 四组合成通过。84 张截图均有自动像素合成检查，不宣称全部 84 张接受人工视觉检查。完整审查者独立解码全部四张 F4 PNG 加 painter-readback-white.png（五图、20 个具名采样），视觉检查 nested-disabled-white.png、painter-readback-white.png。另一个更早视觉检查覆盖 nested-readback-black.png、nested-disabled-white.png。这些有限检查与全部 84 张自动比较分开，本草稿任务自身未检查图像。浏览器截图证明记录 CSS/backing/DPR/scale 下的合成，不证明物理扫描输出。

八个预期失败反例分为**七个复制生产代码的原生修改**（no-op、reversed order、removed diamond clip、double premultiply、translated geometry、missing clear、nominal-DPR substitution）和**一个仅断言端合成缓存字节案例**（cached-missing-clear-reset）。各自记录预期断言失败。反例副本不是接受的生产代码；记录 originalProductPreserved=true、result exitStatus=0。合成案例不是第八个原生 GPU 修改。

有界原生观察包括上传预算拒绝 FRAME_RENDER_FAILED/WEBGPU_FRAME_BUDGET、纹理限制拒绝 FRAME_RENDER_FAILED/WEBGPU_DEVICE_LIMIT，均先于尺寸/serial 修改；真实在途读回 close 安全退休；普通 close 后借用设备存活（之后工作映射 16 字节）；受控借用默认设备 destroy 记录 WEBGPU_DEVICE_LOST 与 ENGINE_CLOSE_FAILED/WEBGPU_CLOSE_UNSAFE。仅覆盖显式 destroy，不证明任意驱动重置。4096 字节分配成功，16 字节 usage=0 描述符产生真实 scoped GPUValidationError；属于验证证据，不是可移植 OOM 阈值或无界分配压力测试。真实在途 ticket 在 close 前记录一帧、144 上传字节及 17920 合计读回字节，随后安全关闭且全部 pending 计数为零。

完整原生报告及独立审查已绑定接受的修复源码/构建/观察。审查者独立核对 233 个当前 source/build/tool/lock/dependency hash、1702 个坐标原始检查加七项全零记录、五张解码 PNG/20 个具名采样、七个修改树各 60 文件且各仅一个声明改动、六项生命周期状态及保留历史失败。完整审查范围为 c80d3f49aea64df2891418c0ae18d563bb5d2f9f → 956e2f9894dc8e27291ffd0210a6cd8b4e651eab，11 改动文件、650 行新增及四行删除，未报告差异或可操作缺陷。审查读取运行记录及产物，未重跑 gate。最终公开源码/导出/投影绑定仍属待完成证据/发布步骤。null 字段只能由真实后续证据填入；null 表示待完成，不是零或 PASS。整理公开投影现已保存为[验证](../evidence/webgpu-verification.json)与[审查](../evidence/webgpu-review.json)，保留已接受凭据身份及明确待完成的最终绑定。

```json
{
  "nativeAcceptance": "PASS",
  "acceptedSourceCommit": "956e2f9894dc8e27291ffd0210a6cd8b4e651eab",
  "acceptedBuildReceiptSha256": "cc258d839e50d5e0cf220528399d5c29a6bcc5c3a9ee2616a915627e0363d91d",
  "nativeFinalReportSha256": "2d1941c0c151b161a4ceb0c33acf454410caaa69c938ce7623efef4641f9da72",
  "nativeIndependentReviewSha256": "44646d844f948f21deb86317216456f472c653aaf077e8b306da3ab6968a91b1",
  "nativeFinalCounts": {
    "frames": 42,
    "failedRequiredFixtures": 0,
    "rawChecks": 1709,
    "screenshots": 84,
    "compositionChecks": 6808,
    "counterexamples": 8,
    "unexpectedErrors": 0
  },
  "curatedVerificationPath": "../evidence/webgpu-verification.json",
  "curatedReviewPath": "../evidence/webgpu-review.json",
  "deliveredDependencyBytes": null,
  "performanceEvidence": null,
  "publicationStatus": "PENDING"
}
```

已接受原生诊断保留有理数/Canvas 等价预乘 801 个严格检查及 32 个外边差异、相邻命令两个严格检查及 127 个共享/外边差异、普通近共线两个严格检查且超容差差异为零。这些有限结果不证明普遍 Canvas 等价或无缝。入口隔离包括原样 Canvas 页面 30 项真实请求均无 GPU/rendering/robust 模块，六模块公开 robust-predicates 根图仅出现在 opt-in GPU 页面。

## 源码与凭据身份

以下识别已记录 source/build/fixture 及有界报告，不是最终 export manifest。已接受原生 source/build inventory 及最终报告/审查凭据已记录，其公开投影及最终交付身份仍须在待完成证据 gate 中核对。原始内部日志保留在公开阅读文档之外，此处只投影凭据身份及有用范围。

| 产物 / 凭据 | SHA-256 |
| --- | --- |
| 历史准备源码 | `394cf3deb8ee4dd3a3357d471a1acbc55868736ad40c7ab3c08c5b786dff3aba` |
| 历史构建准备 JS | `d78e9ba8c3096c211feb9d32dfa00b145419b28527379c6e3c84a0feb43ea03b` |
| 当前准备源码 | `5003eef853f6982c9b7f5f36999279688e7b6aa4184e88ff5673af2ad02aa74f` |
| 当前构建准备 JS | `ec3f3ceff5501fd65517fa9850a3cf42e0f8505e431a474d93f471789b56048a` |
| 不变 F4 样例 | `58d9c04eee8f32dab50f49ff01f686085132d390a0b3e936e2860865a0a07a6f` |
| 新增数值回归 | `4ab922fdcc92b79712674ec328f166dc439534822ee988fa9cf32b655ef9b4a9` |
| 受保护 CanvasHost 源码 | `ae6c2f46bd3e43b44e8a915a5b4fb9c1cbebab6b5f14b93178b7bd7eb5f0c7cb` |
| 受保护 copyCanvasFrame 源码 | `274069cd40f81ddbb9aa298f4119be2cf8e4791d17c0c2b2652033a0d4957637` |
| 受保护 copyFrame2D 源码 | `28e29667b474a244103eab0fab11fd373b62079073d2a2bea2cc9bfd0bda882d` |
| host 源码 | `f07f59068f1c65f1247500ca8665747bb957d99e07286b16e3d6d08be3da51bc` |
| pass 源码 | `780bb10de89b894ea01b6ae4122281a7c2b3c32e3435bed6d1e071be4969a5a5` |
| 锁文件 | `ed9759a4ae0d1ca6e2d707fd1a324d1eff3b326cb2a8c827eecf14e3ebfb53d4` |
| 已记录生产 WGSL | `71d623c069fad3d84b50ff17f2fabaad30f149b5faeb4677d63c1aaf9907b2a6` |
| 已记录原生 harness | `99e85364bbb2619f8e83e9877e68acce7443bc23b320fe19f7cd953c8b5b9b26` |
| 已记录独立 oracle | `c58cc871e0996469eaad28b7d088534b3b9164c44678227b796088ce6fa3e741` |
| 数值 CPU 报告凭据 | `c53e4384826f43c9a7a47bb3ed9c64d4b22e97e0d9d4f83495030960d7c51184` |
| 独立数值审查凭据 | `06d3297946e23286b2cf20d7f4b8f3f52e25641e6a68c3ddd05458bdf6637ca9` |
| 已观察原生结果凭据 | `8cdff26d8067961588144ac6149aa40b83d70a74101745480d9b5e2daa35e695` |
| 最终完整原生报告凭据 | 2d1941c0c151b161a4ceb0c33acf454410caaa69c938ce7623efef4641f9da72 |
| 独立完整原生审查凭据 | 44646d844f948f21deb86317216456f472c653aaf077e8b306da3ab6968a91b1 |
| 最终原生构建凭据 | cc258d839e50d5e0cf220528399d5c29a6bcc5c3a9ee2616a915627e0363d91d |
| 最终原生清单凭据 | b79db92e2062fec87a8fa485c64a2f3d37f9506d8310842a9ba650a3fb0a6a43 |
| 历史原生尝试 5 | 4048cce24f4efa5c2a4cebc719865e614c15038c9a0f83c9242770b07b92b601 |
| 历史原生尝试 6 | 9f3d12543d6e39b94b7cbd45589c352aaad3fdf4137627e691061bf06e7197fc |
| 历史 native-third 日志 | 56266723d7472810bdef88edea601b229e762a20d985f4d9b12c67a18972613f |

当前公开源码引用：RenderFrame2D (`packages/contracts/src/RenderFrame2D.ts`)、准备 (`packages/engine/rendering/prepareRectangles2D.ts`)、GPU host (`packages/engine/web/WebGPUHost.ts`)、pass (`packages/engine/web/webgpuPass.ts`)、数值回归 (`tests/geometry-webgpu-numeric.test.mjs`)、原生 harness (`tools/verify-webgpu.mjs`)、独立 oracle (`tools/webgpu-oracle.mjs`)。草稿核对链接存在/源码身份，完整实施接受仍取决于实际审查。

## 依赖证据与来源引用边界

robust-predicates **3.0.3**、Vladimir Agafonkin、**Unlicense**、公开包根 orient2d 是已致谢的基础数学依赖。2026-10-08T17:08:34.467Z 的官方精确版本审计验证 **40820 字节**、SHA-256 `54952e6a8c9e69e404f9be09bfb92a68482cf77702283399a44a689d67ba661c`、registry SRI `sha512-NS3levdsRIUOmiJ8FZWCP7LG3QpJyrs/TE0Zpf1yvZu8cAJJ6QMW92H1c7kWpdIHo8RvmLxN/o2JXTKHp74lUA==`、类型声明/公开 orient2d 及许可存在。这是产物审计，不是运行执行。实际包元数据固定 3.0.3，编译/import 证据另如上。tarball 字节不是交付/浏览器传输字节。完整交付依赖统计仍待完成，不推导 npm-latest 或性能。须保留 NOTICE (`NOTICE`, repository root) 及[上游许可](https://raw.githubusercontent.com/mourner/robust-predicates/v3.0.3/LICENSE)。

历史读取的一手 GPUWeb 与有日期 WGSL 引用、精确研究范围及访问失败见[合同第 8 节](WebGPU矩形执行合同.md#8-基础依赖致谢与引用边界)。来源研究记录于 2026-10-09，本草稿未重新获取网页。0.4 来源记录为历史研究，不是新当前原生证明。

## 设计决策及保留取舍

| 决策 | 理由与边界 |
| --- | --- |
| 完整语言对及固定 API | 双语都包含全部规范及相同 API，英文不是缩略跳转。结构性相等仍需独立语义审查。 |
| 同包 opt-in 浏览器入口 | Canvas 隔离 GPU/数学预加载；纯 rendering 单独输出、TS 仅引用 contracts。基础加载量优先说明隔离理由，不宣称未测量字节/性能。 |
| 唯一首选格式生产目标 | 同一 encoder 复制同一纹理；镜像/离屏重画削弱真实路径 oracle。每次重新获取不保证不同纹理对象。 |
| 致谢稳健方向判断及有界构造 | 已表示点符号稳健，大小近似；0 或 2^-100..2^20 包络明确排除极端及消去中间值。不加产品精确有理数系统，不证明普遍精度。 |
| 精确退化先于舍入角点拓扑 | 奇异矩阵及无需交点构造的表示接触仍 no-op；多次舍入后的近接触可拒绝或有亚像素覆盖。 |
| 撤回固定 1/1024 像素拒绝 | 记录 float32 坍缩/位移，拒绝非有限/符号反转而非所有薄形状。外边及分别裁剪邻居须独立诊断。 |
| 工作量与输出均设限 | 1024 多边形顶点、4194304 默认边测试补充输入/准备/上传上限；不允许 unchecked product 或安静截断。 |
| Canvas 原样及独立索引式 GPU 复制 | 曾提出的共用 Canvas copier/wrapper 因迭代器/错误身份兼容要求而撤回；Canvas 文件严格不变，未来共享需新兼容性设计。 |
| 两遍输出分配 | 实际存活 V 在 typed 输出分配前决定精确上传字节；调用方预算优先于设备 cap。预计扇顶点可坍缩为零，不能据上传顶点数钳制准备预算。 |
| 0.6 仅 t===1 使用受保护互补 | 直接 s=v/sum 保留小正互补而不改变严格内部位模式；否决全面较近端点改写、1-t、吸附、epsilon、放宽容差、豁免 F4。 |
| outcome 结算与成功退休分开 | 拒绝 fence/map 仍须排空并进入尽力 unsafe 清理，不能等待仅成功退休而死锁。台账退休不证明安全归还。 |
| 申请/借用所有权及保守隔离 | 借用设备永不销毁；合作独占租约无法跨其他库强制。绘制失败与清理安全分开。 |
| 观察回调而不等待用户后续 | 跨 realm/thenable 拒绝隔离；返回 close/whenIdle 的回调不能使 GPU 清理死锁。健康 device.lost 不是 close 屏障。 |
| 失败保留为历史 | 产物访问失败、严格规则数值拒绝及旧原生 FAIL 均保留；修复后的 CPU/原生结果具有新身份及有界范围。 |

## 仍存限制

包络是应用支持范围，不是通用误差界；稳健符号不使构造交点精确。多次舍入裁剪可使边界位移或拓扑拒绝；分别构造的相邻命令不承诺普遍无缝。单采样外边不同于 Canvas 抗锯齿；预乘 WebGPU 原始字节不能直接比较直通 alpha Canvas 字节。CPU mocks、生产读回、浏览器合成、物理扫描输出是不同证据层。

完整有界原生任务已独立接受，公开证据核对及发布待完成。不宣称 benchmark、加速领先、物理手机、Runtime SDK、3D、文字/纹理/UI、迁移、编辑器/AI 创作循环或完整引擎。广泛产品要求仍依各自已有证据约束，本矩形里程碑不能关闭它们。
