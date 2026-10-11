# 程序化 3D 场景与屏幕 UI

[English](README.md) | 简体中文

本实验性 S3D1 示例只从构建后的公共入口 `@egret/engine`、`@egret/engine/scene3d`、`@egret/engine/webgpu/scene3d` 导入。它创建两个不可变的带索引 XYZ/RGB 四边形，由调用者提供相机空间的 model-view 矩阵，通过真实 Engine Stage 捕获普通屏幕 UI，再由一个场景 Host 按场景、UI 的顺序提交。候选准备阶段的原生验证结果为 **PENDING（待执行）**。

沿用仓库已有的 Node.js 24.19.0、pnpm 11.25.0、TypeScript 7.0.2 环境。在仓库根目录执行 `node tools/build.mjs`，然后执行 `node tools/serve-canvas.mjs`。在输出的本机回环地址打开 `/examples/scene3d/index.html`。使用支持 WebGPU 的浏览器，无需启动参数或软件适配器请求。按 Ctrl+C 停止服务器。

目标为 64×64 逻辑像素，pixelRatio 为 1，CSS 仅放大显示以便观察。正交相机 near=1、far=9，采用反向零到一深度；z=-3 的红色四边形遮住 z=-7 的蓝色四边形。不可变场景使用单位 model-view 输入。白色、品红、绿色 UI 按真实显示树的绘制顺序叠加。2×2 品红图像由十六个不透明 RGBA 字节在本地创建，由 ImageData2D 拥有、Texture 包装，再由 Bitmap 通过 Scope 拥有的 AssetManager 租约借用。不加载 URL、解码器或字体。

重绘执行一次 `engine.captureFrame()`、一次 `host.renderSceneFrame(scene, overlay)`，随后等待 `host.whenIdle()`。图像复选框只改变其父 Sprite 的局部 `{x:0,y:0,width:4,height:8}` 裁剪，再显式重绘。没有渲染循环或时钟推进。关闭会移除所拥有的监听器对、等待初始化、调用 `engine.dispose()` 清理 Scope、Stage、资源和 Host，最后将画布清零并移除。Engine 启动失败时直接关闭对应 Host。

这是范围有限的不透明程序化绘制入口，使用严格的精确 normal-f32 数值配置，并不代表可变场景图、相机姿态 API、光照／材质／资源导入、透明场景排序、角色动画、Native SDK 或性能验收。固定的 S1／S2／SN1 原生阶段由 `tools/verify-webgpu-b1.mjs` 执行；其独立字面量像素与原始读回和原有七个 B1 正例、五个控制分别记录。第一方代码与内嵌像素资源采用 Apache-2.0。
