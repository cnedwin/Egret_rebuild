# 纹理页与共享渲染契约

[English](../../en/docs/shared-render-profile-contract.md) | 中文

2026-10-18 · M1.3 · 实现规格；执行与验收尚待完成

## 目标与兼容

复杂界面和图集动画需要独立摆放同一图片中的大量区域。每个裁切区域单独上传纹理会重复工作，也模糊源数据、采样和 GPU 所有权的关系。M1.3 分离不可变源页、逻辑区域和设备资源，为二维内容及既有有限三维场景引入显式线性合成配置。

配置身份为 `egret.shared-frame2d/1`，沿用显示树、Texture、AssetLease、Engine 完成帧登记及 WebGPUHost 提交生命周期。既有 Canvas、纹理帧和编码空间 B1 继续遵守原契约与错误次序。旧入口明确拒绝其无法表达的新元数据，保存的旧帧不改变颜色解释。

本项属于 [M1 计划](m1-rendering-resource-plan.md)的一个完整工作包。完整 Spine 适配属于 M2，WebGL2 执行属于 M1.4，资源清单、设备重建和持续混合场景验收属于 M1.5。下文有限线性 B1 路径随 M1.3 交付。M1.2 性能验收独立保持开放。

## 公共接口与权威状态

contracts 为每种新材质/几何维护唯一真实性登记，通过包根导出 isSharedMaterial2D、isSharedGeometry2D 供 runtime/rendering 使用；runtime 和 engine facade 都不转发这两个 guard。它们不授予资产、完成帧或 GPU 权限。

根 SDK 增加三个 CPU 构造：`createTextureView(image, region)`、`createSharedMaterial2D(input)` 和 `createSharedGeometry2D(input)`。第一个返回真实的既有 Texture。材质和几何值不可变且分别认证；形似对象、复制符号或克隆不产生权威。

`SHARED_FRAME_PROFILE_2D` 选择 `createEngineForProfile` 的新分支。Engine 增加 `captureSharedFrame` 和 `renderSharedFrame`，共享原有帧 ID、存活/时钟/重入检查及完成帧登记。捕获失败不消耗 ID；帧登记后的 Host 失败消耗已提交 ID。保存帧重放不推进时钟或动画；旧捕获方法保留原返回类型。

`DisplayObject.sharedMaterial` 默认 null，继承最近祖先的完整材质。显式恒等材质可取消祖先效果，null 继续继承。材质作为完整值覆盖，不在每层祖先重复相乘。`renderBoundary` 为 `none` 或 `isolate`。写入遵守节点/Engine 生命周期并更新外观修订。

Mesh2D 的几何泛型默认 TexturedGeometry2D；clear/dispose 后 getter 保留 `G | undefined`。旧消费者保留原类型，新 SharedGeometry2D 不通过旧几何品牌检查。两者使用同一真实 mesh 内容槽和精确借用的 Texture 租约。

可选入口增加 `createSharedWebGPUHost`、`createSharedSceneWebGPUHost`，分别提供 `renderSharedFrame`、`renderSceneSharedFrame`，复用内部 Host/设备/提交所有者。新工厂只声明支持的协议；不支持的旧方法在读取帧内容前拒绝。场景工厂要求显式 outputAlpha 为 opaque，overlay 也必须 opaque；通用二维工厂默认 premultiplied。旧工厂行为不变。Canvas 继续隔离在 `@egret/engine/web`；默认 SDK 不增加浏览器或 Spine 依赖。

`SharedWebGPUHostOptions` 仅在既有 textured 选项上增加 outputAlpha。快照依次读取原有 18 个顶层字段、outputAlpha，再读取所选设备策略。`SharedWebGPUReadback.alphaMode` 如实返回 premultiplied 或 opaque；旧读回类型保留原有 premultiplied 字面值。`getSharedStatus()` 返回既有 Host 状态，以及 pendingGeometryBytes、pendingColorBytes 和 pendingCanonicalBytes；最后一项仅统计已接受且仍由提交保有的转换输出，不代表全部临时内存。共享场景另保留既有 `getSceneStatus()` 合同。

## 输入阶段与错误

材质按 light、dark、blend、samplingDomain、filter、addressU、addressV、regionIsolation、mipLevel、minFilter、magFilter、maxAnisotropy 顺序各读一次顶层字段，之后才检查 tuple 品牌/长度、读取自有元素、验证数值和组合，最后发布冻结自有值。几何按 positions、uvs、lightColors、darkColors、indices 读取；所有原生数组 tag 先于任何 backing 检查，shape/capacity 先于所有复制，全部原生复制先于组件验证。不使用调用方 iterator/species。读取抛错立即终止并保留原 cause。

纯 contracts 工厂采用规定文本的 TypeError/RangeError；读取包装保留 cause，真实 intrinsic/分配异常保留原身份，不依赖 runtime EgretError。runtime 只新增 TEXTURE_VIEW_REGION_INVALID、TEXTURE_VIEW_REGION_IMMUTABLE、FRAME_PROFILE_METADATA_UNSUPPORTED、SHARED_MATERIAL_UNSUPPORTED。最后一项表示资源资格检查后的有效材质/内容不匹配，不代表工厂选项不支持。旧源、租约、生命周期及首因顺序保持。Engine render 将直接 Host 失败包为 FRAME_RENDER_FAILED 并保留原 cause；直接 Host 调用得到 Host 错误。

## 源页、区域与常用显示内容

当前源为真实的 straight-alpha、左上原点、sRGB RGBA8 ImageData2D，以对象身份区分。两个源即使字节相同也不合并所有者。Texture.imageData 仍返回真实源；Texture.width/height 与 sourceRect 保留 packed 含义。新增只读 viewRegion 包含 packed 矩形、logicalWidth/Height、trimX/Y 及顺时针 quarterTurn 0–3；奇数转向交换内容宽高。所有字段均为安全整数，内容同时落在图片页和未裁边逻辑范围内。

视图描述按 packed、logicalWidth、logicalHeight、trimX、trimY、quarterTurn 顺序读取，再读取 packed 的 x、y、width、height。验证和自有快照全部完成后发布。销毁 Texture 包装不使已完成帧保留的源值失效。显式视图拒绝 sourceRect 修改，替换通过新视图和既有绑定事务完成。

| 使用方 | 共享配置行为 |
| --- | --- |
| Bitmap 与资源/绑定槽 | 保留精确租约、使用资格、token 及原子提交/回滚。真实 bitmap 槽同时保存 packed 与逻辑区域，自然尺寸使用逻辑范围。 |
| SequenceClip/SequencePlayer | 保留旧 Texture 整页资格、精确租约及 applyAt 规则。捕获只转换一次已提交 crop/layout，不推进时间。跨页及完整 Spine sequence 仍属后续适配。 |
| NineSliceBitmap | 以未裁边、未旋转逻辑尺寸布局，九片共同采样完整区域，内部切片边界不独立 clamp。叶状态与 mesh 槽原子发布，拒绝 page 域。 |
| Mesh2D | 在显式新配置中，旧几何提供线性 light 系数和零 dark；新几何提供 light RGBA、dark RGB 与合格 UV。材质明确选择 UV 域。 |
| Graphics | 每个图元保留编码空间填色及 alpha；RGB 解码一次，图元 alpha 只进入最终源一次，与祖先透明度分开。 |
| TextField | 只消费已提交 raster 和当前 Scope/租约；捕获不请求字体、不准备文字，不重复应用已烘焙颜色/alpha。 |

SequencePlayer 和 SpriteSheet 接受既有整页 Texture 图集合同。显式视图即使 packed 矩形覆盖整张源页，也保持不可变。SequencePlayer 在原 atlas 检查处以 SEQ_ATLAS_MISMATCH 拒绝，仍先完成 mode 和 clip 真实性检查；SpriteSheet 在当前资源资格检查之后、读取帧描述之前以 SPRITE_SHEET_ATLAS_INVALID 拒绝。既有播放器的 Bitmap 换成另一租约时，仍优先报告 SEQ_BINDING_CHANGED。内部图集发布不能绕过视图的裁切限制。旧图集 layout 保留原有整数范围；转换为本共享配置时，逻辑尺寸和 trim 值均不得超过 2^20。在完成当前资源资格检查后，无法表示的 layout 以 FRAME_PROFILE_METADATA_UNSUPPORTED 拒绝，旧捕获路径保持原规则。

region 域 Bitmap 使用完整逻辑四边形及虚拟透明 trim；page 域只在 trim 偏移处绘制真实内容，使用 packed 页 UV，不再应用 region 覆盖。既有边界、布局与显式 hitArea 保持各自权威。

## 材质与颜色解释

材质保存 light RGBA、dark RGB、blend、samplingDomain、filter、addressU/V、regionIsolation、mipLevel、minFilter/magFilter、maxAnisotropy。默认恒等 light、零 dark、normal、region、nearest、clamp-to-edge、bounded、mip 0、各向异性 1。支持 nearest/linear，要求 minFilter = magFilter = filter。region 只支持 clamp，page 额外支持 repeat/mirror-repeat。不支持的请求明确拒绝。page 域 isolation 使用 bounded 占位值，strict 只用于区域隔离。

light/dark 均为 [0,1] 线性系数。页采样为预乘 (P,a)，顶点系数为 Lv/Kv/tv，材质系数为 Lm/Km/tm，累计显示透明度为 o：

```text
V  = P * Lv + (a - P) * Kv
S  = o * tv * tm * (V * Lm + (a - V) * Km)
as = o * tv * tm * a
```

图片/文字顶点使用恒等系数；Graphics 可使用白色源、Lv = 解码填色、tv = 图元 alpha。UV/颜色插值采用明确舍入的 f32 准备值，二维线性插值，B1 保留透视插值。

| 混合 | 目标 RGB 为 C 时的结果 | 目标 alpha 为 ad 时的结果 |
| --- | --- | --- |
| normal | S + C(1 − as) | as + ad(1 − as) |
| add-accumulate | S + C | as + ad |
| add-preserve | S + C | ad |
| multiply-factor | S*C + C(1 − as) | as + ad(1 − as) |
| screen | S + C(1 − S) | as + ad(1 − as) |

目标随后执行饱和与量化。add-preserve 要求 opaque 输出并以 alpha 1 清屏；透明输出在呈现前拒绝。multiply-factor 表示此因子方程，不代表 CSS multiply。线性配方不承诺与编码空间 Spine renderer 像素一致。

## 页表示、过滤与输出

源表示为 `egret.srgb-straight-rgba8/1`，页表示为 `egret.alpha8-capped-srgb-pma8/1`。D/E 分别为标准 sRGB 解码/编码。源通道字节 C、alpha 字节 A 给出 a = A/255、P = aD(C/255)。保存 alpha A，RGB 保存 min(round(255E(P)), cap[A])；cap[A] 是满足 D(b/255) ≤ a 的最大字节 b，round = floor(x+0.5)，透明 RGB 为零。固定 256 项码表具有独立精确参考。相对普通编码，每通道最多额外下降一码；这不代表无损或最终图像误差保证。

页采用单 mip 的 rgba8unorm-srgb，每 texel 四字节。按完整源页收费，并在首次驻留时转换，不按每个区域重复转换。encoded-PMA 和浮点源只是预留扩展，在本包明确不支持，不伪装成既有 ImageData2D。

region 采样的 q = (uW,vH) 为插值后的逻辑 texel 位置。每轴逻辑尺寸 W、trim t、内容尺寸 w 对应：

```text
r = clamp(q, 0.5, W - 0.5)
c = clamp(r, t + 0.5, t + w - 0.5)
g = min(1, max(0, r - t + 0.5), max(0, t + w + 0.5 - r))

```

bounded linear 将 c 按 quarter-turn 映射到 packed 页坐标，采样结果乘 gx*gy。strict 使用四个整数逻辑 tap，在加权前处理透明 trim 和整数旋转。nearest 使用固定 floor 规则和整数读取。page 域直接寻址源页，在采样阶段处理 clamp/repeat/mirror；顶点插值前不做 clamp 或 wrap。POT/NPOT 采用相同策略，描述不要求图集留边。

WebGPU hardware linear 先解码 sRGB texel 再过滤。bounded region 路径接受下述有限质量目标，不承诺所有情况邻区贡献严格为零；strict 整数读取保持 texel 索引边界。采样后 RGB 限于 alpha 只是数值保护。WebGL2 的适用规范允许不同 sRGB 过滤顺序，因此可通过手动解码/过滤执行相同页参考。

工作目标为 rgba8unorm-srgb，线性混合后每次写入均按格式量化，不是浮点目标。清屏色以编码 RGB 提供，解码后乘 clearAlpha；透明输出默认零 alpha，opaque 必须 alpha 1。帧与 Host 的 outputAlpha 必须一致。

最终只 resolve 一次，写入普通 preferred rgba8unorm/bgra8unorm 画布视图并关闭混合。目标解码值 (C,a) 先将 RGB 限于 [0,a]；透明输出为 (aE(C/a),a)，a=0 时为零；opaque 输出为 (E(C),1)。画布色彩空间为 sRGB，alpha 模式与输出一致。直接复制内部编码预乘像素到浏览器画布并不等价。回读记录并规范化真实 RGBA/BGRA 通道顺序。

## 完成帧、顺序与有限 B1 组合

完成帧拥有冻结的 commands/pages/regions/materials/geometries 数组。按首次真实绘制需要建表：页按源身份，区域按源及完整区域值，材质按完整值，几何按真实不可变身份。每次调用产生新的顶层数组和帧身份，保存帧不持有可变显示对象、租约或 Texture 包装。

绘制顺序保持节点矩形、Bitmap、Mesh、已提交文字、子节点。命令保留连续 ordinal、源 occurrence、材质、透明度和有序裁剪。遍历到的 isolate 节点即使隐藏、alpha 零或无内容，仍保留 enter/exit；整个祖先子树被跳过时不生成后代事件。有效裁剪边界及经过验证的空/退化/全裁空内容保留屏障。这提供渲染边界，不表示完整 Spine slot 适配已实现。捕获只为其自身已证明为空的合格内容发出公共 empty 屏障；Host 后续裁剪保留保存帧及其表不变，将新发现的空绘制保留为私有有序准备边界。资源或能力拒绝仍是错误。

只合批连续兼容绘制，保留完整原 ordinal 范围，不跨 A–B–A、不同区域、空事件或屏障。共享页不要求所有区域合成一次绘制。缓存命中仍执行当前资源/Scope 检查和完整逻辑收费；暂未缓存的部分可采用正确冷路径。

新场景方法接收真实既有 SceneFrame3D 和 opaque 共享帧。保留有限 opaque 顶点 RGB 几何、现有 MVP/index 及反向深度 clear 0/greater/write。每个编码 RGB 顶点先解码，再 f32 打包并透视插值；旧编码 B1 着色器/参考独立保留。场景与 UI 原子规划，共用一个自有目标、一次清屏和一次 resolve；UI 不受三维深度影响，不支持的场景/alpha 组合在提交前拒绝。

首版共享捕获与几何准备采用完整冷路径，既有派生缓存配置及地址规则保持不变，不另设缓存额度。相邻合批仍属于本阶段要求，并使用同一个 8 MiB 拼接所有者。兼容条件包含完整材质、区域、源、采样策略、透明度及有序裁剪；逻辑费用先于物理合并收取。冷路径正确性与性能验收分别判断。

## 预算与生命周期

以下为逻辑准入/所有权账本，不是精确 JavaScript 堆或驱动显存测量。检查整数运算并完成费用预留后才能发布，缓存命中和部分可见不减少逻辑收费。

| 账本 | 上限 |
| --- | --- |
| 源 | 保留每轴≤4096、像素≤1,048,576、每图≤4 MiB |
| 帧页表 | ≤64 个不同源；源字节≤16 MiB，canonical 请求字节另计≤16 MiB，包含 ready 命中 |
| 区域/材质 | ≤128 个区域，≤256 个完整材质 |
| 树/命令 | 节点、authoring units、按 occurrence 收费的源三角形、绘制加屏障各≤65,536；有序裁剪引用≤262,144 |
| 几何 | V≤65,536、I≤196,608，索引为三元组；新载荷88V+4I、旧载荷64V+4I；单项≤4,980,736字节，每帧≤128项/16 MiB |
| 准备 | 顶点≤1,048,576、谓词≤4,194,304、tuple 比较≤1,048,576、裁剪多边形角≤64 |
| 上传 | 默认每次32 MiB/在途64 MiB；新二维顶点44字节、非动态 draw uniform 128字节，另计生成索引/B1 |
| 页临时/驻留 | 在途纹理≤32 MiB，CPU 转换/上传临时≤32 MiB；全部配置共享 ready≤32 MiB/256项 |
| 派生缓存 | 既有每 Stage 16 MiB/65,536项、每 Host 16 MiB/4,096地址；新旧配置共用 |
| 活跃颜色目标 | 每 backing 像素4字节，每帧≤64 MiB，最多两帧合计≤128 MiB；配置/设备可更严 |
| 复用留存 | 缓冲与自有颜色/深度目标共用32 MiB/4,096项的 idle 加返还预留权威 |
| 其他既有限制 | 合批拼接≤8 MiB；回读 staging 加输出默认≤64 MiB；原 B1 几何/uniform/深度限制保留，其中深度每次≤16 MiB/在途≤32 MiB |

顶点 stride 为44字节：position float32x2 位于0，UV float32x2 位于8，light float32x4 位于16，dark float32x3 位于32。128字节 draw uniform 为八个对齐 vec4：viewport/opacity位于0，light/tint位于16，dark位于32，逻辑尺寸/trim位于48，内容尺寸/packed原点位于64，packed尺寸/转向/域位于80，采样策略位于96，页/执行数据位于112。未使用padding为零；opacity、顶点alpha和材质alpha各应用一次。即使合批减少物理分配，每个逻辑draw仍收128字节uniform费用。blend/output策略及资源/会话身份继续作为完整独立key字段。

帧元数据另设32 MiB逻辑上限：header256，五张表各24+8*length，page96、region128、material192、draw192、barrier64，自有clip值80，clip-array为24+8*length。载荷单独计费，共享不可变clip值计一次但每个引用均收费。这不限制调用方保留帧总量，也不表示实际堆内存上界。

纹理页 key 包含真实源身份、表示、格式、usage、mip 数和设备会话；目标 key 包含类型、尺寸、格式、usage、sample/mip/layer 数、配方和会话。借用画布纹理不进入池。已接受的目标独占，直到 queue、error-scope、map、readback 义务全部结束。

Host 保持唯一原生生命周期所有者；共享私有留存权威只处理原子预留和身份。发布 idle 前预留返还容量，回滚保留仍需原生清理的所有者；淘汰按全局返还 FIFO。过大或溢出目标作为临时资源处理，不新增可选池拒绝。销毁结果未知时保留费用、禁用该会话复用并停止接收，不当作成功释放；未知费用可超过 idle 上限，须单独报告。

页转换准入同时统计已保有的共享 canonical 输出、本次调用各个冷页的输出，以及最大的单页源复制临时量，峰值上限为 32 MiB。单次调用自身超限报告 WEBGPU_FRAME_BUDGET；叠加待完成工作后超限报告 WEBGPU_BACKPRESSURE，两者均在原生副作用之前拒绝。READY 命中仍承担逻辑页费用，但不再复制转换。同一源的两次并发冷转换分别拥有输出并收费；允许最多两个并发帧，并不保证同时接收两个最大冷负载。缓冲与目标的领取、返还预留在同一个留存权威中原子完成。

## 数值资格与验证

新 position/UV 先检查输入有限性，明确 Math.fround 后再检查舍入值的有限性/范围；light/dark 必须先满足原始输入有限且处于[0,1]，再舍入，不能将越界输入舍入为合法。新不可变工厂规范化正负零。逻辑尺寸及合格插值 q 受2^20限制，这是算术范围，不是精度证明。GPU q 资格由 Host 准备阶段验证，纯捕获不执行该设备运行规则。周期 page q 初始收紧至绝对值8192 texel，超出明确拒绝，不通过顶点 wrap 或一次 probe 放行。独立参考保留声明的舍入输入，区分 binary64 参考运算与产品 f32 执行。

原生执行前固定源/构建身份、完整 case、sample 坐标、输出策略、字面 RGBA 期望、叠层数和负控差距。参考独立完成源编码、tap/trim/旋转、材质、每次混合与目标量化，再 resolve；不调用产品辅助函数生成期望。

| 有限质量行 | RGBA8各通道绝对误差上限 |
| --- | --- |
| Q0：恒等材质下的透明零、opaque原色/黑白端点、明确无覆盖区 | [0,0,0,0] |
| Q1：单层恒色/nearest | [1,1,1,1] |
| Q2：单层过滤/trim/双色，或单场景渐变 | [2,2,2,1] |
| Q3：包含场景和UI的2–4次有效颜色写入 | [3,3,3,2] |

每个命名像素/通道都必须通过，不用平均值掩盖失败。红区域/蓝邻区另要求禁用蓝通道：bounded hardware≤1，strict必须零；透明安全区保持严格零。深度拒绝的场景片元不算颜色层，远面先写再被近面覆盖计两次。四层限制此组夹具的证明范围，不限制一般场景规模。

原生错误模型在执行前必须与正确模型相差至少16码，且至少4T+4，T为该通道容差。超时或导入错误不能代替像素反例；一码cap遗漏通过CPU精确控制。保留完整raw，并另检查透明RGB≤alpha、opaque alpha=255；这些检查不等于全图颜色对照。

覆盖四旋转、trim、无留边隔离、两UV域、wrap、九宫格、clip、双色、全部blend/alpha策略、顺序、保存帧、真实并发目标、故障及新线性B1。小型与最大合法POT/NPOT页对分别运行，保持页预算。真实浏览器、分配/上传计数、耗时、其他设备及物理显示分别记录；失败保留，阈值不得看结果后拟合。

## 可复现的有限原生矩阵

固定输入和目标字节位于 `tools/shared-rendering/native-cases.json`。运行 `node tools/shared-rendering/check-native-cases.mjs`，可从源页图案、几何、UV、裁切、材质及层叠顺序重建输入与参考值的关系。该检查共用标量颜色参考，不构成第二套独立颜色参考，也不代表产品或浏览器验收。

| 分组 | 场景数 | 命名采样点 | 范围 |
| --- | ---: | ---: | --- |
| A | 3 | 42 | 精确端点、平面透明度及输出转换 |
| B | 4 | 52 | 双轴过滤与双色系数 |
| C | 4 | 56 | 裁边、旋转及 bounded/strict 区域隔离 |
| D | 3 | 46 | region/page 采样域、寻址接缝及 nearest 向下取整 |
| E | 5 | 34 | UV 插值、九宫格接缝及裁切覆盖 |
| F | 4 | 31 | 混合模式、混合顺序及透明度策略 |
| G | 4 | 12 | 线性 B1、零至三次 UI 写入及嵌套裁切 |
| H | 3 | 48 | 合法 POT/NPOT 页尺寸配对及相邻区域串色 |

321 个点包含 299 个颜色点和 22 个仅检查覆盖的点，共有 1,236 项指定通道比较及 104 项独立串色检查。11 个错误模型已有固定标量差距。每个实际原生变异仍须完成健康运行、一次有记录的产品编译产物修改、指定数值失败及恢复后的健康运行。能力缺失、启动错误或超时均不能充当数值失败。

按需运行 `node tools/verify-shared-webgpu.mjs --playwright <已安装包的绝对路径> --channel msedge --output <不存在的私有绝对目录>`。采集器使用选定的 Node 26.7.0、Playwright 1.62.1 和无附加参数的默认 Edge，backing 尺寸为 256×256，显式渲染像素比为 1。如实记录浏览器 DPR、adapter、设备限制、源文件及编译产物、读回与清理结果。已确认的 fallback adapter 不属于本次硬件质量验证范围。清理前保留完整 RGBA，以及黑白背景截图；截图不验证物理显示器或 ICC 表现。

原始文件和失败收据保留为私有执行产物，公共证据记录实际范围及相关身份。执行资格成立后的指定像素越界为 FAIL；执行、源身份或清理无法确认时为 INCOMPLETE。固定检查不替代旧浏览器回归、完整本地门禁、其他设备和持续性能验证。

当前贡献者入口也提供此采集器：`node tools/browser-verify.mjs --suite shared-webgpu --playwright <absolute-installed-package> --output <fresh-absolute-private-directory>`。入口要求完整的 63 次运行顺序、保留的原始采样、指定反例及清理记录。[实现记录](shared-rendering-evidence.md)将实测结果与工作包剩余义务分开说明。

## 实施与验收

按四个连续步骤实施：真实CPU输入与独立参考；既有显示/租约捕获和有序准备；共享页/目标/Host执行及线性B1和最终resolve；完整回归、真实浏览器矩阵、双语证据和受保护集成。这些是同一交付包的内部步骤，不新增项目里程碑。

完成条件包括公共SDK完整链路、旧严格消费者、有意义的失败控制、独立源码/结果评审、所有受影响旧浏览器门禁和新有限原生验收。完整Spine、授权Editor素材、手机宿主、M1.2正式计时及M1.5恢复/持续负载保留各自开放验收；减少分配或上传本身不证明提速。

## 来源与独立实现

表示和所有权代码为Apache-2.0第一方白鹭实现。API和数值要求参考[WebGPU格式规则](https://gpuweb.github.io/gpuweb/#texture-formats)、[过滤模式](https://gpuweb.github.io/gpuweb/#enumdef-gpufiltermode)、[WGSL textureSampleLevel](https://gpuweb.github.io/gpuweb/wgsl/#texturesamplelevel)、[WebGPU一致性测试](https://github.com/gpuweb/cts)及[OpenGL ES 3.0.6](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf)。这些说明相关语义，不证明本引擎已观察到的质量或速度。

Spine需求采用已记录的core4.3.13及[revision b7beb2cc](https://github.com/EsotericSoftware/spine-runtimes/tree/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core)。本包不新增第三方renderer或runtime分发。原始声明、API资格、授权导出兼容和分发条件，与第一方实现及后续完整Spine验收分别保留。
