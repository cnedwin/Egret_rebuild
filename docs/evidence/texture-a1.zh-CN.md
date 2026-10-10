# Texture A1 CPU证据

范围：可复现的CPU验证证据。测试使用实际工厂/runtime/捕获/混合copier/准备/打包；生产host拒绝用注入Canvas/GPU边界与真实host代码。浏览器图像采样、设备性能及GPU生命周期仍未测试。独立审查与发布验证和这些结果分别记录。见[API及所有权](../texture-a1.zh-CN.md)。

## 用例及独立来源

PASS：4×4裁剪x1..3的identity UV为.25/.75；a=-1,tx4反射交换UV并保持y对应。打包反射角x±.5/y±1及原匹配UV。Quad六顶点96字节，alpha保留.5元数据；95字节budget失败。

PASS：C2来自旧矩形回归的P=(4,16)、Q=(15.999999999999998,28)、48×40帧、指定单clip，并明确适配新工厂1×1红图。独立u=480,v=2^-46给t=1，直接s=v/(u+v)的坐标运算舍入到Q。A的Q UV=(1,0)；B交换变换局部轴，Q UV=(0,1)。位置集合相同不代表相同纹理映射。没有epsilon、输出反推像素或实验推导预期像素。见[独立fixture](../../tests/fixtures/image-affine-oracles.mjs)。

PASS：相邻相同位置/UV去重；冲突UV、非相邻重复、混合转向precision；保留五个共线属性点，全共线为空。2^-101/2^21报range；边预算0、quad顶点预算5报budget。零alpha/奇异/空clip仍验证后续非法clip，并保留空图像/区域/alpha元数据。打包反向precision，表示零面积输出0并计数1。u=1+2^-23精确保留，证明无钳制。

PASS：acquire→Texture→Bitmap→capture→mixed copy→CPU准备/打包，交替rect/image/rect/image；租约释放、资产失效、Engine关闭后仍保留字节/几何/打包/order，第二兼容CPU adapter可重放。非空嵌套clip的record/matrix/rect逐一冻结；独立表代理正常返回length，仅0索引抛FrameCopyError sentinel，FrameInputReadError保留精确cause。

PASS：测试自身聚合预算24fan顶点/352边测试，23顶点或351边失败；无生产混合dispatcher。旧texture-frame-types测试证明生产Canvas/WebGPU在修改前拒绝图像。数值endpoint/strict-interior/F4、矩形、host、lease、byte、priority、type、boundary回归通过，下表记录最终实际命令。

## 保留失败及敏感性对照

RED1保留六个预期missing-image-port失败及错误旧counter字面量65。抽取前RED2在未修改旧矩形源码上把pin修为122，矩形形状、打包浮点/ranges/位移精确通过。独立计数：subject corners9 + clip corners9 + clip traversal(16+12+16+12)=56 + viewport48 =122。是固定旧行为，不是从新实现重生fixture；旧位置/打包预期始终字面量。

GREEN1保留集成错误224；手算改352：每矩形9+4×12=57，每双层clip图像5+2×9+3×4×8=119，各两个总352。未变counter策略。GREEN2通过8/8，原失败与前后source身份见下表。

实际可丢弃已构建生产代码对照：在prepareImages2D输出仅反转UV，affine/C2两断言失败；在copyMixedFrame2D交换前两命令，painter-order一断言失败。保存原emitted字节，finally恢复并核对hash，恢复后8/8通过。正常测试内亦逐个affine/C2变体证明仅UV反转不符合其独立预期。未提交mutation；没有把仅改oracle当作敏感性证据。

## 全套测试限制

FAIL：tools/test.mjs首次完整调用产生413测试、411通过、2失败。boundaries.test.mjs:72 “boundary checker admits the exact external root only in engine rendering”的最小复制contracts facade缺图像value导出；project-boundaries.test.mjs:58 “unmodified actual package copies preserve root resolution and every approved renderer entry”加载了重复的IMAGE_LIMITS_2D身份。下文描述边界fixture修正。真实仓库直接boundary/type与affected157/157通过。首轮413项仍为FAIL，后续415项分别绑定各自源码主体。

## A2证据：全部UNRUN

生产Canvas/WebGPU图像采样/回读/黑白背景合成；browser/device/version；alpha语料、小数DPR/缩小/接缝/外栅格边；数值界限；projection/color/layout；图像资源预留/提交结算；release-before-fence/write后encode/close重入/loss/rejection/hang/cleanup/exactly-once；native/editor/migration/performance均UNRUN。Mock拒绝与CPU位移不是认证。完整停止门槛见API文档，独立审查与发布验证为分别记录的门槛。

## 源码身份

实现基础BASE 29a7765f1bae9f91cbe88f9e467dd66ce71b4d0d，tree 7a7fa691be77ed0ccd0d64e5e68d8e7d5527c82e。此表绑定015a4036b83104c2a6f528dadb4a9dc057efaaa2源码字节，为历史主体。之后的共享绕序及有界表接纳变更分别记录源码与结果。Hash识别字节；文档描述验证，不是可执行证明。

| File | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/prepareImages2D.ts | 4446 | ae47a8eef62d7b455c71b6b7c30fcc9c4c1ff48ec32bdbed08e429734057af91 |
| packages/engine/rendering/packImageVertices2D.ts | 2652 | 99044ea7ed990a02251e1b5ecf67bd0f838af7783e4794670349c5bad5a4911a |
| tests/image-geometry-2d.test.mjs | 7322 | d9cbf647cc44810dd5a1a8cb4a8383e7b9e8a61317a13bbcaecffdf52f768f54 |
| tests/texture-a1-integration.test.mjs | 5444 | 85a75bc119436a4f01ffb2fd96277f297307a0f7e6422104b0ac3ab251faae5a |
| tests/fixtures/image-affine-oracles.mjs | 987 | fde9535e1b6fa9de954ca7c9eb81f4e651740ae9a485944ef27579323dd2e68b |
| packages/engine/rendering/prepareRectangles2D.ts | 10452 | 1a0c093f6168042d4316ab89b22c229d9a0ac1086dd099591355b3419ffd2da0 |
| packages/engine/web/webgpuPass.ts | 5107 | 26f9cff856de0e868a945cbe55379013877eb3046bc16f41d86776905278fcf5 |
| packages/engine/rendering/packedPosition2D.ts | 725 | 089777bcf9cb4dde92354091db7bea205f6dd616ee26a16d3b4a40ff2087fd26 |
| tests/boundaries.test.mjs | 8005 | 8671d2e417bc090fc0e595ad9451d2784fc4b250c9b4e19f858df740a5a64d23 |
| tests/project-boundaries.test.mjs | 12122 | 6972c3474605678f8d1d5cf48a6ea0316b87439bcb1928c7223d13b4e7bcaffa |

### 实现前fixture身份

| File | Bytes | SHA256 |
| --- | ---: | --- |
| tests/image-geometry-2d.test.mjs | 7324 | 912b2fd4f49ac998409bbc602052ea50461b522a84585cf053528e73a1bd4455 |
| tests/texture-a1-integration.test.mjs | 5365 | b57b8e62deea7c0734e01033d723ecda6352c7ba363f41d3243a8e76c8179545 |
| tests/fixtures/image-affine-oracles.mjs | 987 | fde9535e1b6fa9de954ca7c9eb81f4e651740ae9a485944ef27579323dd2e68b |

抽取前矩形源码SHA256为7aa74f20214988d8631f36f9c1e8e2b3a6a332cc86aa1a23dfac8c94be8ccbd3；原webgpuPass为780bb10de89b894ea01b6ae4122281a7c2b3c32e3435bed6d1e071be4969a5a5。独立affine fixture在生产实现前写入，字面值不变，不导入生产函数。packedPosition2D第一方抽取NDC fround、有限值保护和backing位移，最终hash及受影响webgpuPass hash见上表；不声称复制上游代码或新增依赖。

## 实际命令收据

日期为2026-10-09 UTC；下表命令以Node24.19.0从仓库根实际执行。精确原生exe/cwd/start/end/exit、raw stdout/stderr及source hashes保存在收据，公开hash绑定原记录，不嵌入全文或机器专属路径。Type负面fixture预期编译diagnostics为验证结果，不是隐藏失败。首次及修正后完整调用亦各保留三组既有project导入审计harness diagnostics：ExperimentalWarning: VM Modules is an experimental feature and might change at any time。这些作为保留harness输出嵌入stdout，外层stderr为空；修正后外层415 PASS/0 FAIL保持记录结果。警告不证明图像实现回归，也未被压制。

| Receipt subject | Command (node executable; repository root cwd) | UTC start / end | Exit / result | SHA256 |
| --- | --- | --- | --- | --- |
| boundary-fixtures-green | `node --test tests/boundaries.test.mjs tests/project-boundaries.test.mjs` | 2026-10-09T04:37:49.362Z / 2026-10-09T04:38:32.532Z | 0; 36 tests, 0 fail | 4eae8fdf6bc5db4e4715981478e2a6fbfe491a06428f6b6b4b04942d3b9267ac |
| final-affected | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs tests/image-data-2d.test.mjs tests/texture-bitmap.test.mjs tests/texture-capture.test.mjs tests/texture-frame-types.test.mjs tests/mixed-frame-2d.test.mjs tests/geometry-webgpu.test.mjs tests/geometry-webgpu-numeric.test.mjs tests/webgpu-pass.test.mjs tests/canvas-host.test.mjs tests/webgpu-host.test.mjs` | 2026-10-09T04:30:46.856Z / 2026-10-09T04:30:47.467Z | 0; 157 tests, 0 fail | 33f3b3ee3ab7c8c1abe0120b666a727e5935b1edb65ca631bafe61785bb3cab8 |
| final-boundaries | `node tools/check-boundaries.mjs` | 2026-10-09T04:31:40.738Z / 2026-10-09T04:31:41.290Z | 0; - tests, - fail | d5997bc90ab7e1e435c8476340ea245125f51f2a77efcd20b157b90e077c3243 |
| final-build | `node tools/build.mjs` | 2026-10-09T04:30:46.363Z / 2026-10-09T04:30:46.798Z | 0; - tests, - fail | aea2d9005eed696df8337a07da986d76895ee29ba99b9f22af162cd6f76b68fb |
| final-eof-affected | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:41:22.834Z / 2026-10-09T04:41:23.016Z | 0; 8 tests, 0 fail | 82dd3a3bb580b86ff318247ac522949b399688eb3a85ad433f933699dfb508ec |
| final-full-corrected | `node tools/test.mjs` | 2026-10-09T04:38:37.901Z / 2026-10-09T04:39:24.562Z | 0; 415 tests, 0 fail | 2a4ad7e764b6bd5326fbe86610666a1b8ce3a44acf155a41f9395b64641eba9a |
| final-full | `node tools/test.mjs` | 2026-10-09T04:30:54.662Z / 2026-10-09T04:31:39.431Z | 1; 413 tests, 2 fail | f8eba4e51bd9878bc78008050a07d8b0568230ba11caec500ad11cf279e3ba9f |
| final-types | `node tools/check-types.mjs` | 2026-10-09T04:31:39.493Z / 2026-10-09T04:31:40.678Z | 0; - tests, - fail | 7094f7c38ff47065432fa74ae1dfd9cc522d6bf8902557eb67e14b36d4bfd0f5 |
| green-1 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs tests/geometry-webgpu-numeric.test.mjs` | 2026-10-09T04:27:12.894Z / 2026-10-09T04:27:13.083Z | 1; 11 tests, 1 fail | 82742472a7e80bba0429cbdb55e6932f46e99a4061f35a26ac869381446ad083 |
| green-2 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:27:33.590Z / 2026-10-09T04:27:33.774Z | 0; 8 tests, 0 fail | 48d977ed860f34d1d4818c59376ee7b0c6184a7a00fead6c448d8d10392b4f2a |
| green-build-1 | `node tools/build.mjs` | 2026-10-09T04:27:12.381Z / 2026-10-09T04:27:12.835Z | 0; - tests, - fail | dc4317456e6599b708b75518f132d48f8e66f75c6002a3c7a1a8a9b4411ccfdf |
| mutation-order | `node --test tests/texture-a1-integration.test.mjs` | 2026-10-09T04:28:32.195Z / 2026-10-09T04:28:32.368Z | 1; 2 tests, 1 fail | ec0c7f5720a27609c7472e2c2976861ea1c67001c293d66ae6590623fb7a6519 |
| mutation-uv | `node --test tests/image-geometry-2d.test.mjs` | 2026-10-09T04:28:31.996Z / 2026-10-09T04:28:32.139Z | 1; 6 tests, 2 fail | 64931a8513aadc9070f4f5e1ff1d2bbd9cf2b5491705d02549cad2b711139829 |
| red-1 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:25:39.142Z / 2026-10-09T04:25:39.319Z | 1; 8 tests, 7 fail | 602659eacee622d61db95fe159f480b6c4e32df4ad9000a1b5d09222c16ac808 |
| red-2 | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:25:47.976Z / 2026-10-09T04:25:48.152Z | 1; 8 tests, 6 fail | 62eef01c5fa349287211ea6bc85ef33fbe434c71395174ba94de200937649f9a |
| red-build | `node tools/build.mjs` | 2026-10-09T04:25:38.623Z / 2026-10-09T04:25:39.087Z | 0; - tests, - fail | ed6fb48e8f414b63410fe424aa7a5ed3a42dcbe9b533988f4c0f6a9f18ec3df3 |
| restored-green | `node --test tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs` | 2026-10-09T04:28:32.424Z / 2026-10-09T04:28:32.608Z | 0; 8 tests, 0 fail | f4c2279035e746c2f849d4d06ea54fbd409ae2cf60400a2cf39812a0ec5f24fd |
## 边界fixture修正

合成policy fixture提供不变checker所需四个图像值、engine同身份重导出、声明及低层runtime capture facade；仅证明policy/resolution，不证明实际runtime/native。实际复制Project fixture保留包/依赖普通副本；唯一测试拥有的node_modules contracts根文件显式重导出已保留packages/contracts根。断言固定此解析桥接前后原复制根字节。旧DAG/deep/继承键/声明对照保留。缺图像export反例按executable-surface原因失败；重复真实contracts模块按IMAGE_LIMITS_2D身份原因失败。

PASS：聚焦修正fixture36/36。新增adapter修正后的必要完整重跑415/415、exit0；两个新对照解释413→415。首轮413/411/2 FAIL保持独立收据。生产字节未变，旧实际build/type/直接boundary收据只证明相同生产主体，不重复运行。全套仍含原consumer type-gate测试；文档在这些运行后完成，不是可执行测试主体。独立审查与全部A2另行门控。

修正前保留源码身份：

| 文件 | 字节 | SHA256 |
| --- | ---: | --- |
| tests/boundaries.test.mjs | 6757 | 2814620db64516ff9890afd142f863c6444e6ffac9d5e9021d9f62c2b284370c |
| tests/project-boundaries.test.mjs | 11327 | 19bc9edfd1e62f033876d2321543a4ee2ef774985af194c8375938091c01f4f6 |

两个新测试和两个API文档仅规范EOF空白，原字节保留。随后affected8/8通过（final-eof-affected）。生产及修正boundary fixture字节仍等同415项完整运行；该运行保留原测试身份。断言未变。

## 共享绕序重构：历史新源码证据

重构基础015a4036b83104c2a6f528dadb4a9dc057efaaa2，tree a86d2aaf73bfe7006582eff748b833e63c688a33。前文原源码表、413失败/415修正/final8及mutation收据保留为历史主体，不挪作新字节结果。重构仅在现有私有准备模块共享finishPolygonWinding2D；矩形删除共线点与图像UV/重复规则分别保留。连续三点sign顺序、计数、混合转向precision、全共线为空及完整点反转不变。绕序收尾辅助函数仅engine相对私有，未新增文件/framework/公开barrel。API双语补齐完整图像语义优先级及TEXTURE_FACTORY_REQUIRED。

| 变更生产源码 | 字节 | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/prepareRectangles2D.ts | 10705 | 4ff620e1670d594550534bd8ef70366ee0fda6c46307116060154e8415711473 |
| packages/engine/rendering/prepareImages2D.ts | 4139 | 1749ecc606a7a3f412b254a332842cbeadce2fab6b91a438ee685dd143a9e3ab |

| 新修复收据 | 实际命令（Node；仓库根cwd） | UTC开始/结束 | exit/结果 | Receipt SHA256 |
| --- | --- | --- | --- | --- |
| fix1-build | `node tools/build.mjs` | 2026-10-09T05:04:09.025Z / 2026-10-09T05:04:09.505Z | 0; build PASS | 76dad149c295bbbe320807f865cba1e7f71d2dc1d36e925c9b7d24968bcd2c6b |
| fix1-focused | `node --test tests/geometry-webgpu.test.mjs tests/geometry-webgpu-numeric.test.mjs tests/image-geometry-2d.test.mjs tests/texture-a1-integration.test.mjs tests/webgpu-pass.test.mjs` | 2026-10-09T05:04:09.563Z / 2026-10-09T05:04:10.176Z | 0; 33 PASS / 0 FAIL | 4169ada46816d16eeb6926afb61122761ba465bb9da6d40e84bca0c280e8b1c8 |
| fix1-types | `node tools/check-types.mjs` | 2026-10-09T05:04:19.931Z / 2026-10-09T05:04:21.134Z | 0; positive + expected compiler-negative fixtures PASS | 2d884b9ea7707f336c1b140f64650484b6dc4e591ccb94992e37fc2ef0f7bdb0 |
| fix1-boundaries | `node tools/check-boundaries.mjs` | 2026-10-09T05:04:21.190Z / 2026-10-09T05:04:21.898Z | 0; 237-file boundary PASS | 56fbf3ce88be74a82c7262afe39c1bb04e172bc6487425d5d83b0883fae17bda |

新聚焦33/33覆盖两种策略、旧122边的矩形形状/打包、352边聚合、反射UV、两种C2 Q映射、拓扑/range/budget及旧表示打包行为。测试未改，独立字面值来源不变。Build仅一次，相关type/直接boundary对新源码通过。预期编译负例与旧数值diagnostics保留；聚焦外层stderr为空，没有VM警告。本轮未重跑415全套/浏览器，后续整理版prepush另列下文，旧415不挪用。文档字节晚于这些执行收据，仅描述其验证范围。所有A2仍UNRUN。

已知历史harness范围：此前两次完整调用均在stdout保留三组VM Modules ExperimentalWarning，外层stderr为空。修正full收据SHA256为2a4ad7e764b6bd5326fbe86610666a1b8ce3a44acf155a41f9395b64641eba9a，其stdout-only SHA256为aa212eee2dfa7455abcabbcde3e7ff45b3194d5061f497dae3e61fe2af18d8c3，属于不同hash主体。是既有project import-audit harness噪声，原样保留，未压制、未当作新生产回归。

## 整理版全源码验证（历史）

独立prepush在af94a9a74be76d06a0964f9003b33af948f30a6a从仓库根运行`node tools/prepush.mjs`，UTC 2026-10-09T05:27:21.779Z / 2026-10-09T05:28:15.018Z，exit0。收据SHA256 d5671b127cfd1a757c2d26bad3050620438c7d874d44fc0120b0dd034653cc0a绑定该主体：全套415/415、build/type/直接237文件boundary、发布结构检查、headless示例与KB通过；源码清单/HEAD未变且工作区干净。stdout保留三组既有VM Modules警告，外层stderr为空。此历史415结果早于下列表接纳变更。

## 有界表接纳：新源码证据

基础af94a9a74be76d06a0964f9003b33af948f30a6a。长度上限现为分配/索引读取之前的接纳检查，明确改变超长表优先级：非法第65项和虚拟2^32长度现报FrameCopyError('budget')，分别替代认证invalid与原生RangeError。接纳0..64表仍在字节/视图/几何之前认证全部条目。

新测试在未修改生产代码上产生29项、24通过、5个预期失败：非法第65项优先级及虚拟65/1024/2^32/MAX_SAFE_INTEGER四长度。代理fixture仅分配空/小数组，索引保护立即抛出，因此RED不遍历巨大表。修复后各虚拟长度读取length一次，索引/迭代器零次。接纳64项逐个读取一次；未引用末项非法仍先于字节与几何失败；仅索引抛出的sentinel保留精确cause。旧矩形/header/lazy/getter/view/payload测试保留。

变更前源码主体：

| File | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/copyMixedFrame2D.ts | 3906 | addd9c4bea9648bdf15e3f8da6873958a54080495f13a4d7e0ded2164c944365 |
| packages/engine/rendering/imageFrameBudget.ts | 1803 | 302063eb2a42f8543a1b728b10546618795b1d97f491ad4752e10f10d72a82e8 |
| tests/mixed-frame-2d.test.mjs | 16622 | 6246cd51ad8315b97bb87d9ae3c489ed42ba4f3e36233ee79e02924879d34ef2 |

变更后源码主体：

| File | Bytes | SHA256 |
| --- | ---: | --- |
| packages/engine/rendering/copyMixedFrame2D.ts | 4109 | 919f38d2c972c770f88d2ca9695e066895e790e2425b3935098d3743ba29cb61 |
| packages/engine/rendering/imageFrameBudget.ts | 1813 | cb4f33b67f24d95430a334d4d9381c405e6ac7f75ffc419372a3edd1adc5f803 |
| tests/mixed-frame-2d.test.mjs | 18110 | 0606c34108f4a54efb52cd3aaab47a8ed03e960fb7bbdb36e681e6ef746ee3f7 |

| Receipt | Command (Node; repository root cwd) | UTC start / end | Exit / result | Receipt SHA256 |
| --- | --- | --- | --- | --- |
| admission-red | `node --test tests/mixed-frame-2d.test.mjs` | 2026-10-09T05:46:45.565Z / 2026-10-09T05:46:45.746Z | 1; 29 tests / 24 pass / 5 fail | f731a834ed091657140ae2ab4fb09b16839ed2a63456f6c8c9eba7073b1d123f |
| admission-build | `node tools/build.mjs` | 2026-10-09T05:47:11.201Z / 2026-10-09T05:47:11.693Z | 0; build PASS | 6b86256f17fbdf37dac541451ae14630dac560f914d75f452d087bbfeae4af06 |
| admission-focused | `node --test tests/mixed-frame-2d.test.mjs tests/texture-a1-integration.test.mjs tests/image-geometry-2d.test.mjs tests/texture-frame-types.test.mjs` | 2026-10-09T05:47:11.750Z / 2026-10-09T05:47:11.956Z | 0; 41 pass / 0 fail | 6ed2bc4193a36338c5ae34d85af3199efba1a531171311da19efd0c6cdc8af62 |
| admission-types | `node tools/check-types.mjs` | 2026-10-09T05:47:12.015Z / 2026-10-09T05:47:13.230Z | 0; positive and expected negative fixtures PASS | b5b6ab78e27f8b6c23d59b8707b4958fa739eeaedc928d4a00f18b8600e10fad |
| admission-boundaries | `node tools/check-boundaries.mjs` | 2026-10-09T05:47:13.293Z / 2026-10-09T05:47:13.916Z | 0; 237-file boundary PASS | 6788d1a8cb7d4510418bb0d2933cd149898db0899a179a653c35f9a5cf7851d5 |

Build仅一次；新源码聚焦41/41、相关type及直接boundary通过，预期编译负例diagnostics保留。本变更未重跑415全套/浏览器/设备；旧415及聚焦33均为历史主体。文档在这些执行收据之后编辑，字节身份分别记录。最终源码审查与发布验证待完成，全部A2证据UNRUN。
