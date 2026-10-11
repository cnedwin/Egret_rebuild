# 显式 Canvas 文字示例

[English](README.md) | 简体中文

这个小应用将公开的 WC1 Canvas 文字 provider、公开的 TF1 TextField 与现有 CanvasHost 连起来。Ahem 是几何测试字体：`X` 显示为方块，空格留白，可读原文仍以普通 DOM 文字显示。2026-10-11，实际默认桌面 Edge 冒烟检查完成首次渲染、替换、空文本及显式关闭，浏览器错误为零，关闭后不再保留自有字体或 Canvas。这项交互检查不提供独立像素预期、移动端或性能验收。

在仓库根目录先用 `pnpm install --frozen-lockfile --ignore-scripts` 安装已有锁定依赖，再运行 `node tools/build.mjs`。工作副本必须已经采用 WC1 的 `@egret/engine/web/text` 入口；旧构建不能运行此示例。启动现有的 `node tools/serve-canvas.mjs` 服务，保留其输出 URL 的主机与端口，将路径换成 `/examples/canvas-text/index.html`。用 Ctrl+C 停止服务。通过本机回环 HTTP 或 HTTPS 访问，不要直接打开本地 HTML 文件。不引入新依赖、下载安装器、浏览器参数或服务工具。

Import map 解析构建后的公开 engine 入口及其现有包依赖。已有的内部 frame-state 映射用于宿主的包内实现；应用代码只导入公开 engine 入口。文字依赖图是显式启用的。单独打开普通默认 engine 入口不会导入本示例或其字体 provider。

应用读取本地保留的 Ahem 资产，核对准确 SHA-256，以这些字节构造唯一字体族名的 FontFace，等待 `face.load()`，然后仅将该 face 加入 `document.fonts`。随后确认 `document.fonts.load()` 恰好选中自有 face、该 face 已加载并在集合中，并确认 readiness 成立。界面只接受 Ahem 文档覆盖的 `X`、空格和显式换行，最多 12 列、四行。这些是低于现有上限的示例布局选择，允许空文字。Textarea 遵循浏览器通常的换行处理；它不是 native LF/CRLF 完整字节相等测试。

这个选定 face 核对比单独的 `document.fonts.check()` 更强，后者可能在 fallback 下仍成功。但这仍只是针对保留字体与选定字符子集的有限应用选择核对，不是通用的无 fallback、完整字形覆盖或像素准确性保证。Provider 不持有或加载字体。应用在工作未完成时保持该字体环境稳定。若扩展示例以更换字体，应先等待现有工作结束，只改自有 face，调用 `cache.invalidate()`，再显式 prepare。本例没有自动 generation 观察器。

字体选择完成后，应用创建 CanvasHost/Engine、Engine 拥有的 Scope、使用 `createCanvasTextRasterProvider()` 的 cache，以及 `createTextField(engine, scope, cache)`。它设置完整 request，等待 `field.prepare()`，挂入场景，再显式调用 `engine.renderFrame()`。固定样式为 normal 400、size20、lineHeight24、density1、英语 locale、ltr、蓝色填充。Field 位于 320×160 画布的 (24,24)。示例不读取像素，也不合成预期图像。

修改文字并点击 **准备并渲染**，执行一次替换。任意时刻只有一个待完成请求；忙碌时忽略重复点击，不排队、不重试。下一次准备未完成时，保留上次提交的原文和像素。操作失败会关闭会话并报告保留的第一原因。DOM 状态、原文和控件构成教学界面；Canvas 标注为几何图像。

离开前请点击 **关闭并等待清理**。`finally` 路径等待当前操作，释放 field、Scope 与 cache，真实等待 `cache.whenIdle()` 和 `engine.dispose()`，仅删除自有 FontFace，仅移除自有监听器，重置自有 Canvas 并移除元素。每项清理都会尝试；后续错误不替换第一失败，包括原始抛出的 `undefined`。只有等待结束后才显示成功。原生字体加载没有 AbortSignal，在该加载期间关闭会等待其结束。`pagehide` 会请求同一路径，但导航期间无法强迫浏览器等待，因此请使用显式按钮观察完成。重新加载页面可开启新会话。

这是应用示例，不是独立 native oracle 或验收记录。当前 WC1 的 native Canvas/textured-WebGPU 验证由另行准备的 fixture 与 collector 承担。历史 T1/TF1 CPU 结果、旧 Font B3 切片和五路 renderer 回归不能证明这个当前 field/provider 路径。本源码不授予 CJK、手机、性能、物理回收、完整 T2、通用 UI、Spine 或发布结论。

应用代码与说明是独立实现、由 AI 协助编写的白鹭第一方工作，适用仓库 Apache-2.0 许可。字体另行处理：Todd Fahrner 与 Myles C. Maxfield 的 Ahem 声明为公有领域，并保留原始 Creative Commons Zero 后备声明。请随未改动的字体一起保留 [Ahem-COPYING.txt](assets/Ahem-COPYING.txt)、[Ahem-README.txt](assets/Ahem-README.txt) 和 [provenance.json](assets/provenance.json)。本示例未引入新依赖。
