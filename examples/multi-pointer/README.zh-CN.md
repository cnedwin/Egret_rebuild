# 多指针示例

[English](README.md) | 简体中文

此 Canvas 小示例使用公开的 `@egret/engine`、`@egret/engine/web` 和 `@egret/engine/web/pointer` 入口。两个显式编写的 `Sprite.hitArea` 矩形展示独立的鼠标、触摸和笔触点，包括非主触点。触点移出画布后仍保留按下时的目标。白色标记和触点列表显示当前逻辑坐标；每个终止事件会清理对应触点的状态。

使用固定版本工具构建仓库后，启动示例服务器并打开 `/examples/multi-pointer/index.html`。模块导出 `ready`、`readSnapshot()` 和 `close()`，用于有界的浏览器观察。快照仅包含触点的标量信息。示例不使用外部素材。

## 交互与生命周期

- 用两根手指分别按住两个区域，并独立移动。鼠标和笔使用同一套 Pointer Events 路径。
- 结束一个触点后，另一个触点继续有效。原生取消、捕获丢失、失焦、页面隐藏和 pagehide 会取消对应触点。
- 视口矩形变化、滚动、尺寸变化、方向变化或可视视口变化会先取消活跃触点，再递增视口版本。新坐标映射下只允许重新按下产生触点。
- 暂停按钮取消活跃触点并拒绝新触点；恢复时没有遗留的按住状态。关闭操作通过真实的 Engine/Scope 所有权释放输入。

浏览器适配器要求画布已连接、属于同一 realm，并具有有限且为正的边界尺寸。画布及其普通祖先不得使用 CSS transform、perspective 或单独的 translate/rotate/scale，zoom 必须为 `normal` 或 `1`。画布边框和内边距必须为零，`object-fit` 必须为 `fill`。不支持的布局会被拒绝，不会近似推算。CSS 客户区坐标仅映射一次到配置的逻辑尺寸，渲染像素比不参与输入映射。

适配器在第一个触点出现前，仅为画布设置 `touch-action: none`，保存原始内联值及优先级，并在清理时完整恢复。画布外仍可滚动页面。实现使用原生 Pointer Events 和逐指针原生捕获，不包含 Touch Events 回退或兼容鼠标监听器。同一画布上的第二个活跃多指针适配器会被拒绝。不支持在同一画布上同时使用本适配器与旧的主鼠标适配器。

`webglcontextlost` 事件会暂停输入。`webglcontextrestored` 不会自动恢复输入：应用必须确认渲染器和相关场景资源已就绪，再调用 `input.setInteractive(true)`。通过其他通道报告设备丢失的 Host（包括 WebGPU）必须在丢失时显式调用 `input.setInteractive(false)`，并仅在确认就绪后调用 `input.setInteractive(true)`。此 Canvas 示例不验证 GPU 恢复。

## 范围与验证

此示例展示首批多指针输入基础能力，不代表可复用摇杆、手势识别器、完整 UI 系统、IME 集成或移动设备认证。`tests/browser-pointer.test.mjs` 中的受控浏览器端口测试使用真实的公开 Engine/Scope/显示对象；原生浏览器与实体触摸、笔输入的验收需要单独证据。

参考：[W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/) 定义了指针捕获、隐式释放、主指针语义和 `touch-action` 的生效时机。实现为独立编写，参考规范不是产品依赖。
