# 可编辑 3D 场景与引擎路线

[English](../../en/docs/authored-scene3d.md) | 简体中文

> **已移除。** `scene3d` 入口以及矩形、图像和纹理帧的 WebGPU 宿主已从 SDK 中移除。本文档保留为当时的记录，不描述当前 SDK。当前的 2D 渲染见[共享渲染 Profile](shared-render-profile-contract.md)，当前的 3D 见 [World3D](world3d.md)。

## 场景、相机与资源所有权

白鹭的可选入口 `@egret/engine/scene3d/authoring` 创建可编辑的不可变场景版本。节点包含稳定 ID、可选父节点、列主序仿射局部变换和自有网格引用。每个版本解析层级，实例和编辑之间复用网格身份。`withNodeTransform(id, matrix)` 返回一个新版本，保存过的场景、帧与 UI 显示列表可继续使用。创作场景最多含 256 个节点和 合计 64 项网格与卡片绘制，沿用现有帧几何与 uniform 预算。

`createSceneCamera3D` 接收眼点、目标点、可选的向上向量，以及透视或正交投影。透视视角为垂直弧度；正交高度为完整垂直跨度。两种投影都显式指定宽高比和近、远裁剪面。相机使用右手坐标系，沿视图负 Z 方向看。捕获时以 binary64 合成世界、视图和反向深度投影，最后将 MVP 舍入一次至有限的正常 float32 或精确零。溢出、下溢至零或超出既有算术余量时拒绝提交。原有场景捕获继续使用既定的精确 binary32 准入。

`capture(camera)` 为两个现有共享场景宿主生成真实的 `SceneFrame3D`。渲染先绘制带深度的不透明场景，再合成普通 2D 叠层。网格与相机由 CPU 侧持有，宿主恢复后应用可重新提交帧。GPU 状态与缓冲仍由宿主管理。首版复用已有原生网格缓冲池，每次提交仍写入网格数据。

## 静态 GLB 范围

`loadStaticGlbScene3D(bytes)` 接收最大 8 MiB 的自包含 GLB 2.0 文件，含单个场景和嵌入式二进制缓冲。网格图元要求紧密排列的 float32 位置、16 或 32 位无符号三角形索引，可选紧密排列的 float32 线性 RGB 顶点色。材质要求不透明、双面和 `KHR_materials_unlit`。材质色与顶点色在线性空间相乘，结果转换一次到现有场景的 sRGB 顶点表示。引用同一网格的节点复用几何。节点支持矩阵或 TRS，导入 ID 为 `gltf-node-<源索引>`。

导入上限为 64 个节点、绘制项和独立图元，192 项缓冲视图和访问器，以及 512 KiB JSON 块。外部 URI、纹理、蒙皮、动画、压缩、稀疏数据、交错属性、单面或混合材质会得到结构化拒绝。应用可用现有带校验的资源提供者取得字节，并通过 AssetManager／Scope 租约持有场景版本。替换失败时，已发布版本可继续使用。入口同步解析传入字节，加载、取消、哈希校验和版本发布由既有资源所有者负责。

运行 `node tools/serve-example.mjs`，打开 `/examples/authored-scene3d/index.html?backend=webgl2`，也可将后端改成 `webgpu`。示例生成自己的小型 GLB，展示相机移动和有父节点的模型编辑。运行 `node tools/verify-authored-scene3d.mjs <playwright-root> <fresh-output>` 复验浏览器参考。Edge 上两个后端对模型顺序反转、前后深度、节点编辑、相机移动、正交视图和 2D HUD 的回读逐字节一致。实体 Android Chrome 以最终相机和解析器产物在两个后端通过同一夹具。每个后端的六次回读均与桌面逐字节一致。这里记录的是功能验证。

## 带不透明贴图的 GLB

使用 `prepareTexturedStaticGlbScene3D(bytes)` 导入带基础颜色贴图的限定静态模型。带贴图的图元使用一组紧密排列的 float32 `TEXCOORD_0`、不透明双面 `KHR_materials_unlit` 材质，以及嵌入式非隔行 RGB8 PNG。采样器显式选择最近邻放大和缩小，两个轴均钳制到边缘。UV 原点位于左上角。缺省重复寻址、第二组纹理坐标、RGBA 图像、外部图像引用和其他材质模式会得到结构化拒绝。

准备结果列出带索引的图像请求。每次调用 `copyBytes()` 都返回一份新副本，可交给现有 PNG 提供者。应用通过 AssetManager 和 Scope 取得解码贴图。等全部图像就绪后，将每张贴图的 `imageData` 交给 `plan.bindImages([{ imageIndex, source }, ...])`。绑定在发布场景版本前核验图像身份、尺寸和完全不透明。传入图像与嵌入式 PNG 的对应关系由字节提供者和解码流程保证。使用场景期间持有源图像租约，所有替换图像成功绑定后再发布新版本。

每张嵌入图像的编码上限为 4 MiB，边长上限为 4096，像素上限为 1,048,576。单个资产最多包含 6 MiB 的嵌入 PNG 字节和 4,194,304 个解码像素。UV 为每个顶点增加八字节原生几何开销。共享 WebGL2 和 WebGPU 复用现有图页所有者与反向深度通道，基础颜色和顶点色因子在线性 RGB 中相乘后再做输出转换。同一张图像可让网格、裁剪卡片和 HUD 共用一个原生图页。

运行 `node tools/serve-example.mjs`，打开 `/examples/textured-scene3d/index.html?backend=webgl2`，也可选择 `webgpu`。运行 `node tools/verify-textured-glb-scene3d.mjs <playwright-root> <new-output-directory>` 可复验桌面结果。示例生成四色 PNG，并把 2D 角色卡片移动到墙前和墙后。桌面 Edge 与实体 Android Chrome 的两个后端在此夹具中均匹配六项指定像素与五次完整回读。首帧上传一个图页，热帧没有重复上传，原生设备恢复后首次提交重新上传一次。这些证据覆盖本节所述的导入范围和生命周期。

## 创作场景的方向光

通过 `prepareLambertStaticGlbScene3D(bytes)` 显式启用白鹭的不透明漫反射材质。它沿用贴图 GLB 范围，要求带贴图的图元提供紧密排列的单位长度 float32 `NORMAL`。将同一批图像租约提供给 `plan.bindImages(bindings, lighting)`。光照包含在世界空间指向光源的 `direction`，以及两个非负线性系数 `ambient` 和 `intensity`，两者之和最多为一。无贴图图元沿用无光照材质。

`world.withLighting(lighting)` 发布新的光照版本，并复用几何、图像和已经准备好的法线变换。编辑节点时重新计算对应的世界变换。引擎用缩放后的逆转置矩阵处理法线，计入镜像绕序，并在双面光照中翻转原始背面的法线。受光节点的奇异或病态变换会在替换场景版本前被拒绝。插值法线相消为零时使用环境光。

受光通道用 `ambient + intensity * max(0, dot(normal, direction))` 乘以线性基础色，并复用现有不透明场景深度、图页、设备生命周期及后续 HUD。法线为每个顶点增加 12 字节原生几何与 24 字节 CPU 逻辑开销。每个受光绘制项使用 128 字节 uniform，和无光照网格及卡片共用既有 4096 字节帧预算。该白鹭材质由调用方显式启用。标准 glTF 金属度／粗糙度材质和阴影留在后续范围。

运行 `node tools/verify-lambert-glb-scene3d.mjs <playwright-root> <new-output-directory>` 可复验浏览器结果。桌面 Edge 和实体 Android Chrome 的两个后端在此生成模型上匹配全部八次回读。非均匀缩放斜面样点为 252，背面环境光为 137，镜像正面与调整方向后照亮的背面均为 255。WebGL2 验收在创建宿主前将上下文正面绕序预设为顺时针。首帧和原生设备恢复后首次提交各上传一个共享图页，热帧没有重复上传。 [Three.js 漫反射材质](https://threejs.org/docs/pages/MeshLambertMaterial.html) · [法线矩阵参考](https://threejs.org/docs/pages/Matrix3.html#getNormalMatrix)

## 参与深度遮挡的 2D 角色

`createSceneWorldCard3D({ source, width, height, region, pivotX, pivotY, alphaCutoff })` 创建不可变图像卡片。传入现有资源租约持有的 `ImageData2D`。宽、高使用世界单位，可选图集区域使用以左上角为原点的像素坐标。锚点相对裁剪区域，可落在区域之外，默认位于底边中心。Alpha 阈值表示第一个可绘制的字节值，范围为 1 至 255，默认 128。

通过节点的 `cards` 字段挂载卡片。用 `world.withNodes([...])` 向场景追加节点并生成新版本，场景也可以来自 GLB。节点变换决定卡片的位置和朝向。WebGL2 与 WebGPU 让卡片和不透明场景共用深度缓冲。低于 Alpha 阈值的像素在写入深度前丢弃。其余像素从规范预乘图页还原直通 RGB，并以完全不透明的方式输出。普通 HUD 在场景之后合成。当前支持显式朝向的最近邻采样裁剪卡片。

卡片、HUD 图像和图集裁剪共用既有图像存储、准备预算与设备生命周期。两张卡片即使取图集中的不同区域，也只为同一源图像分配一页。应用在使用卡片期间持有图像租约。设备恢复后首次提交时，宿主用持有的 CPU 数据重建 GPU 图页。含卡片的帧通过共享场景宿主及其提交路径绘制。


```ts
import { createSceneWorldCard3D } from "@egret/engine/scene3d/authoring";

const card = createSceneWorldCard3D({
  source: actorImage,
  width: 1,
  height: 1.5,
  region: { x: 32, y: 0, width: 32, height: 48 },
});
const revision = world.withNodes([{
  id: "actor",
  localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 4, 1],
  cards: [card],
}]);
const frame = revision.capture(camera);
```

运行 `node tools/verify-world-depth-cards.mjs <playwright-root> <new-output-directory>` 可在两个后端验证项目生成的 GLB 和图集夹具。检查涵盖建筑前后遮挡、透明孔洞、图集坐标、Alpha 阈值、HUD、分阶段和直接提交、上传复用，以及原生设备丢失与恢复。跨后端验收比较指定像素。边界正好落在采样位置时，不同实现的光栅覆盖与最近邻采样可能有差异。

桌面 Edge 与实体 Android Chrome 的两个后端都通过九项指定像素检查。同一宿主中，使用同一场景进行分阶段提交、直接提交、反转顺序与恢复后提交，回读逐字节一致。夹具记录到冷启动上传两次、热帧上传零次、原生设备恢复后上传两次。这些是功能和生命周期结果。

## 刚体节点动画

通过 `@egret/engine/scene3d/authoring` 的 `createSceneAnimationClip3D` 为现有节点编写局部变换动画，也可用于静态 GLB 中的节点。每条轨道指定一个节点，并为每个关键帧提供完整平移、按 `[x, y, z, w]` 排列的四元数旋转和缩放。关键帧时间以秒为单位，非负且严格递增。阶跃轨道保持上一帧的值，直到下一个关键帧。线性轨道逐分量插值平移与缩放，旋转沿四元数最短弧插值。片段创建时保存输入快照，最多支持 256 条轨道和 8,192 个关键帧。平移和缩放各分量的绝对值上限为 2²⁴，缩放各分量的绝对值至少为 2⁻²⁴。线性轨道的每个缩放分量始终保持同一符号，避免变换退化。

将游戏时钟或时间轴的经过秒数传给 `clip.sample(world, elapsedSeconds)`。单次模式在片段结束后保持末帧，传入 `"loop"` 可在片段结束时循环。每条轨道在自身时间范围之外保持首帧或末帧。时长为零时保持固定姿态。每次采样将目标节点的局部变换一次写入新的不可变场景版本，继续复用几何、贴图、光照和父子关系。原版本可用于重置和任意时刻采样。`world.withNodeTransforms(edits)` 也可直接接受一组局部矩阵。空批次返回原场景。无效矩阵、重复节点或不存在的目标会拒绝整个批次。

可编辑场景示例提供播放、固定中点、末帧和循环边界控件。运行 `node tools/verify-authored-scene3d.mjs <playwright-root> <new-output-directory>` 可复验动画采样与原有静态场景见证点。该接口用于以代码编写刚体变换。 [glTF 插值参考](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#appendix-c-animation-sampler-interpolation-modes)

### 导入 GLB 刚体动画

`loadAnimatedGlbScene3D(bytes)` 使用不透明无光照 GLB 配置，返回基础场景和有序、不可变的片段列表。片段名称可选，重名时用列表索引选择片段。调用 `clips[i].sample(elapsedSeconds, mode)` 可从导入场景采样一个新版本。平移、旋转和缩放通道各自保留时间轴和 `LINEAR` 或 `STEP` 插值规则。缺失通道沿用节点原有值。片段时长由所有被引用通道中最晚的关键帧决定。示例中的 **GLB 动画中点** 将线性平移与独立时间轴上的阶跃缩放结合。

导入器支持紧密排列、非稀疏的 float32 局部刚体变换通道。沿用现有 GLB 文件容量限制，最多 32 个片段，每个片段最多 192 个通道和 192 个采样器，所有片段合计最多 8,192 个被引用的关键帧。三次样条、骨骼蒙皮、形变目标及动画扩展会被拒绝。静态、贴图及 Lambert GLB 入口沿用原配置。 [glTF 动画通道与采样器](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations)

## 后续 3D 工作

| 工作包 | 引擎决策与验收 |
| --- | --- |
| 更多光照和材质类型 | 扩展导入到显式 UV、法线、图像语义和版本化材质契约。光照在线性空间计算，输出统一转换一次，共用纹理与设备生命周期。验收创作颜色、法线方向、曝光范围和不透明／裁剪／混合规则。 |
| 3D 角色蒙皮与场景特效 | 关节姿势复用已采样的节点变换，再增加蒙皮权重、逆绑定矩阵和动画事件。实例状态独立，复用不可变网格和蒙皮数据。在既有绘制顺序和能力预算中接入有界特效。验证模型导入到预览编辑的完整链路、资源替换、设备恢复和声明的帧预算。 |

Three.js 提供资产解析、场景创作、渲染阶段和颜色管理的公开设计参考。白鹭独立实现，采用现有场景身份、后端和生命周期。GLB 与所选材质扩展遵循 Khronos 规范。[Three.js 模型加载](https://threejs.org/docs/pages/GLTFLoader.html) · [Three.js 颜色管理](https://threejs.org/manual/pages/color-management.html) · [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) · [KHR_materials_unlit](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit)
