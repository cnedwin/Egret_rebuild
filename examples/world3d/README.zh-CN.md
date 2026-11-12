# World3D 示例

[English](README.md) | 简体中文

本示例用 `@egret/engine/world3d` 构建保留式 3D 场景，并用 WebGL2 或 WebGPU 渲染器绘制。显式 Engine 时钟通过 `createWorld3DView` 驱动动画和渲染。

## 运行

使用 Node.js 26.7.0 和 pnpm 11.25.0，在仓库根目录运行：

    pnpm setup:dev
    pnpm example:browser

打开 `http://127.0.0.1:4173/examples/world3d/index.html`。添加 `?backend=webgpu` 或使用页眉中的链接切换后端。

## 展示内容

- 平行光、聚光灯和点光源下的标准、Phong、Lambert 和无光照材质，程序化天空同时用作背景和环境。
- 平行光和聚光灯的阴影。
- 400 个带逐实例颜色的实例化立柱。
- 一根绑定四块骨骼并由剪辑驱动的立柱，以及一个带变形目标的球。
- 一个粒子发射器和一个精灵。
- 第二台相机渲染到渲染目标，并显示在场景中的屏幕上。
- 用鼠标或触摸环绕、平移和缩放。点击物体可高亮。

页眉按钮切换阴影、粒子和线框。状态行显示绘制调用数、三角形数和存活粒子数。

## 限制

本示例用于演示，不是验收夹具。已在使用软件 WebGL2 的无头 Chromium 中观察。WebGPU 画布路径需要带真实 GPU 的浏览器。范围和待完成事项见 [World3D 契约](../../knowledge-base/Cns/docs/world3d.md)。
