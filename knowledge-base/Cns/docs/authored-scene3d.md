# 可编辑 3D 场景与引擎路线

[English](../../en/docs/authored-scene3d.md) | 简体中文

## 场景、相机与资源所有权

白鹭的可选入口 `@egret/engine/scene3d/authoring` 创建可编辑的不可变场景版本。节点包含稳定 ID、可选父节点、列主序仿射局部变换和自有网格引用。每个版本解析层级，实例和编辑之间复用网格身份。`withNodeTransform(id, matrix)` 返回一个新版本，保存过的场景、帧与 UI 显示列表可继续使用。创作场景最多含 256 个节点和 64 项网格绘制，沿用现有帧几何与 uniform 预算。

`createSceneCamera3D` 接收眼点、目标点、可选的向上向量，以及透视或正交投影。透视视角为垂直弧度；正交高度为完整垂直跨度。两种投影都显式指定宽高比和近、远裁剪面。相机使用右手坐标系，沿视图负 Z 方向看。捕获时以 binary64 合成世界、视图和反向深度投影，最后将 MVP 舍入一次至有限的正常 float32 或精确零。溢出、下溢至零或超出既有算术余量时拒绝提交。原有场景捕获继续使用既定的精确 binary32 准入。

`capture(camera)` 为两个现有共享场景宿主生成真实的 `SceneFrame3D`。渲染先绘制带深度的不透明场景，再合成普通 2D 叠层。网格与相机由 CPU 侧持有，宿主恢复后应用可重新提交帧。GPU 状态与缓冲仍由宿主管理。首版复用已有原生网格缓冲池，每次提交仍写入网格数据。

## 静态 GLB 范围

`loadStaticGlbScene3D(bytes)` 接收最大 8 MiB 的自包含 GLB 2.0 文件，含单个场景和嵌入式二进制缓冲。网格图元要求紧密排列的 float32 位置、16 或 32 位无符号三角形索引，可选紧密排列的 float32 线性 RGB 顶点色。材质要求不透明、双面和 `KHR_materials_unlit`。材质色与顶点色在线性空间相乘，结果转换一次到现有场景的 sRGB 顶点表示。引用同一网格的节点复用几何。节点支持矩阵或 TRS，导入 ID 为 `gltf-node-<源索引>`。

导入上限为 64 个节点、绘制项和独立图元，192 项缓冲视图和访问器，以及 512 KiB JSON 块。外部 URI、纹理、蒙皮、动画、压缩、稀疏数据、交错属性、单面或混合材质会得到结构化拒绝。应用可用现有带校验的资源提供者取得字节，并通过 AssetManager／Scope 租约持有场景版本。替换失败时，已发布版本可继续使用。入口同步解析传入字节，加载、取消、哈希校验和版本发布由既有资源所有者负责。

运行 `node tools/serve-example.mjs`，打开 `/examples/authored-scene3d/index.html?backend=webgl2`，也可将后端改成 `webgpu`。示例生成自己的小型 GLB，展示相机移动和有父节点的模型编辑。运行 `node tools/verify-authored-scene3d.mjs <playwright-root> <fresh-output>` 复验浏览器参考。Edge 上两个后端对模型顺序反转、前后深度、节点编辑、相机移动、正交视图和 2D HUD 的回读逐字节一致。实体 Android Chrome 以最终相机和解析器产物在两个后端通过同一夹具。每个后端的六次回读均与桌面逐字节一致。这里记录的是功能验证。

## 后续 3D 工作

| 工作包 | 引擎决策与验收 |
| --- | --- |
| 2D 角色进入 3D 世界 | 增加共享不透明场景深度的世界空间纹理卡片，复用现有自有图像租约，只在通过 Alpha 裁剪的像素写入深度。普通 HUD 在其后绘制。两个后端都验证角色经过同一座导入建筑前后时的遮挡、透明边缘与恢复。 |
| 纹理模型、材质与光照 | 扩展导入到显式 UV、法线、图像语义和版本化材质契约。光照在线性空间计算，输出统一转换一次，共用纹理与设备生命周期。验收创作颜色、法线方向、曝光范围和不透明／裁剪／混合规则。 |
| 3D 角色动画与场景特效 | 使用现有游戏时钟驱动片段、姿势和事件。实例状态独立，复用不可变网格和蒙皮数据。在既有绘制顺序和能力预算中接入有界特效。验证模型导入到预览编辑的完整链路、资源替换、设备恢复和声明的帧预算。 |

Three.js 提供资产解析、场景创作、渲染阶段和颜色管理的公开设计参考。白鹭独立实现，采用现有场景身份、后端和生命周期。GLB 与所选材质扩展遵循 Khronos 规范。[Three.js 模型加载](https://threejs.org/docs/pages/GLTFLoader.html) · [Three.js 颜色管理](https://threejs.org/manual/pages/color-management.html) · [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) · [KHR_materials_unlit](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit)
