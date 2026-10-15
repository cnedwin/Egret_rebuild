# 主鼠标 Canvas 示例

[English](README.md) | 简体中文

这个限定示例只使用公开的 `@egret/engine`、`@egret/engine/web` 和 `@egret/engine/web/input`。160 × 100 的逻辑场景以 320 × 200 CSS 像素显示，绿色区域覆盖部分红色区域。输入派发有类型的开始、结束和激活事件；应用仍需显式渲染。

先按仓库正常验证流程构建 SDK，再通过 HTTP 提供仓库根目录，打开 `examples/mouse-input/`。HTML 的 import map 包含三个公开入口和四个精确的 SDK 产物依赖：`@egret/runtime`、`@egret/contracts`、`#egret-textured-frame-state` 与 `#egret-mouse-input`。应用 JavaScript 仍只使用三个公开入口。允许的布局要求普通、已连接的 canvas，边框和内边距为零、object-fit 为 fill，所有祖先均无 CSS 变换。示例拥有 Engine 和 Scope，借用 canvas。

验证器使用默认无头 Edge，视口 900 × 700，deviceScaleFactor 为 2，通过真实 `page.mouse` 输入检查固定 Canvas RGBA。它分别观察五组原生监听器和原始 Scope 上冻结 once 选项的 abort 订阅。显式释放验证和第二个输入适配器隔离 CSS 拒绝场景；证据按适配器代次分组。六个独立反例分别在临时提供的副本中只替换一个源码绑定片段，不修改 SDK 文件。DPR 反例要求只命中红色后层的完整事件路由，将固定输入点 (25,25) 报告为 X=50、Y=25；缺失事件不能作为该反例的证据。准备失败保留原始原因，结果仍为未完成。

```text
node tools/verify-mouse-input-canvas.mjs --repository <已构建仓库的绝对路径> --playwright <已安装Playwright包的绝对路径> --channel msedge --output <仓库外全新绝对目录>
```

通过生成的回执确认实际执行的构建、源码身份及行为结果。这个桌面子集不能证明触摸、手写笔、捕获、完整 UI、手机、Native SDK 或性能。监听器调用成功和关闭后无响应也不能证明浏览器或操作系统已经回收内存。
