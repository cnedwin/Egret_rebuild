# Canvas 场景

[English](README.en.md) | 简体中文

在仓库根目录执行 `node tools/build.mjs` 构建，再执行 `node tools/serve-canvas.mjs`，打开输出的本地网址。点击或触摸画布会移动蓝色矩形并提交新帧。示例只演示一个 DOM 指针监听器，并未实现通用输入系统或命中测试。

浏览器通过 import map 使用构建后的 `@egret/engine` 与 `@egret/engine/web` 入口。导入任一入口都不会启动宿主或调度器。根入口保持无 DOM 环境依赖，web 入口独立使用 DOM 类型编译。`createCanvasHost({canvas, pixelRatio:1, maxBackingPixels:16777216})` 的默认逻辑像素比为 1，以传入的画布自身作为固定表面身份。宿主在活动期间独占绘图控制权，不移除借用的元素，也不清理外部拥有的监听器。每帧重置位图、路径、裁剪及绘图状态。无效 DTO 和派生几何在修改画布前拒绝。即使尺寸和预算检查通过，原生分配仍可能失败；支持时会在绘制前后检查上下文丢失。

使用已安装的 Playwright 和品牌浏览器进行真实验收：

```text
node tools/verify-canvas.mjs --playwright <已安装的Playwright目录> --channel msedge --output <证据目录>
```

也可用 `PLAYWRIGHT_MODULE` 提供模块目录，替代 `--playwright`。不需要下载浏览器或增加生产依赖。执行器记录页面、控制台及网络异常、截图、浏览器和自动化版本、实际像素、指针引起的位图变化，以及故意失败的空执行器反例。重叠像素字面期望为 (64,0,128,255)，容差为 2。覆盖父级透明度、变换、旋转裁剪、同级隔离、DPR、清屏、无效提交、终态关闭及面积受限的狭长分配观察。桌面 Canvas 结果不证明手机、GPU 或性能覆盖。
