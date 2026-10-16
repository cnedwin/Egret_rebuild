# 显式本地线性布局

[English](README.md) | 简体中文

本原创应用通过可选的已构建 `@egret/engine/layout` 入口规划两个位图 Button，再使用既有 display API 应用返回的局部坐标。单个真实 Engine、共享 MouseInput、分别所有的 Button Scope 及借用的程序化图集保留既有 bitmap-button 生命周期。

## 运行

在仓库根目录执行 `node tools/build.mjs`，通过普通本地 HTTP 提供仓库根目录，再打开 `/examples/linear-layout/`。默认使用 Canvas。可显式选择 WebGPU，或打开 `/examples/linear-layout/?backend=webgpu`。WebGPU 需要浏览器支持；启动不可用时报告原因，不自动切换 backend。切换渲染器会等待当前 Engine 的关闭链，再导航。

preview 和 verification 均使用 DPR 1 的 24 × 24 逻辑场景，通过 CSS 放大八倍。`?preset=verification&backend=canvas` 和 `?preset=verification&backend=webgpu` 选择验证路径。WebGPU 验证路径在每次原始提交前创建真实 readback；启动时先等待原始辅助 ticket，再创建布局容器。每次呈现的实际读回及启动顺序验证边界见证据记录。

## 使用控件

- 横向及纵向恢复两个已启用控件及其原始顺序。
- 隐藏并过滤第一个会移除第一个数字记录并隐藏控件；重插到第二个之后会将其恢复到第二个控件之后。两者均保留所选方向。
- 禁用第一个及启用第一个保留两个布局记录，只改变第一个控件的可用性。
- 拒绝无效间距会在任何场景写入之前以 `gap: -1` 规划，报告 `LAYOUT_OPTIONS_INVALID` 并保留上一个有效计划及场景。
- 重放保存的横向帧会呈现原始捕获帧，实时树保留当前状态；显示当前状态返回实时控件。
- 关闭会等待原始 Button/MouseInput/资源及 Engine 退役链。应用不会重复关闭 Host 或释放借用图集。

红色表示 up，蓝色表示 pressed，灰色表示 disabled。状态区显示当前计划、顺序、Button 状态、激活计数、呈现、图集加载/释放及预期拒绝。

## 理解位置

调用方提供两个 8 × 6 记录、间距 2、内边距 2 及起点对齐。横向计划为 22 × 10，纵向为 12 × 18。嵌套容器增加 (3,3)，外层裁剪切去横向第二个 Button 的右侧。每个 Button 保留显式局部 hit area。过滤、子节点顺序及坐标应用都是显式调用方操作；规划器不发现 bounds、不检查可见性，也不修改场景。

源文件及第一方程序化图集使用 Apache-2.0。应用复用既有 bitmap-button 示例，不增加依赖、默认 API 或 SDK Host 协议。

## 验证范围

已记录的桌面 Canvas/WebGPU 检查覆盖固定双 Button 流程；环境及边界见证据记录。 验证使用默认无额外 flags 的桌面 Edge 155.0.4283.45、24 × 24、DPR 1；它不证明手机性能、Native SDK、自动 EUI 布局或通用宿主支持。

精确语义及结果边界见[规格](../../knowledge-base/Cns/docs/local-linear-layout-spec.md)及[证据记录](../../knowledge-base/Cns/docs/local-linear-layout-evidence.md)。
