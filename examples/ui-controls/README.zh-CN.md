# 控件状态

[English](README.md) | 简体中文

一个开关、一组三个选项和一个按钮，由引擎按各自的状态绘制。状态由 `@egret/engine/ui` 的控件保存，页面负责绘制并绑定按键。

## 运行

构建各包，以仓库根目录启动服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

使用服务输出的主机和端口打开 `/examples/ui-controls/index.html`。浏览器支持时页面使用 WebGPU 绘制；加上 `?backend=webgl2` 使用 WebGL2。

## 可以尝试

- 把指针移到每个控件上，控件变亮。开关和按钮在按住时变暗。
- 按下开关、某个选项和按钮。画布下方的状态行随之变化。
- 点一下画布，然后使用键盘。Tab 在开关、选项组和按钮之间移动，获得焦点的那个有一圈标记。空格或回车激活。方向键、Home 和 End 在选项组内移动。
- 用页面上的按钮禁用第三个选项。按它没有反应，方向键会跳过它。
- 全部禁用。没有控件响应，也没有控件处于悬停。

## 工作方式

`main.mjs` 在触点输入上创建一个 `createToggleControl`、一个 `createSelectionGroup` 和一个 `createActionControl`，并在悬停输入上为五个表面各创建一个 `createHoverControl`。每个回调都会重绘。一个函数决定状态对应的颜色：先看是否不可用，再看是否按住，然后是已设置或被指向。

按键来自 `@egret/engine/web/keyboard`，交给获得焦点的显示对象。页面调用 `toggle()`、`press()` 加 `release()`，或 `next()`、`previous()`、`first()` 和 `last()`。选项组是一个键盘停靠点，停靠点跟随被选中的选项。

每个控件的说明和已检查的内容见[指南](../../knowledge-base/Cns/docs/ui-controls.md)。

## 检查

```text
node examples/ui-controls/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。五个场景通过自动化协议驱动鼠标、手指和键盘，并写出 `report.json` 和每个场景的截图。它们在无头 Chromium 的软件 WebGL2 上通过。硬件 GPU、WebGPU、Edge、Safari、Firefox、真实手机和真人操作都没有运行。
