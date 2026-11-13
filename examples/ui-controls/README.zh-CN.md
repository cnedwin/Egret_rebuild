# 控件状态

[English](README.md) | 简体中文

一个开关、一组三个选项和一个按钮，由引擎按各自的状态绘制。状态由 `@egret/engine/ui` 的控件保存，页面负责绘制并绑定按键，同时向辅助技术描述同一批控件。

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
- 在按钮上按住空格。按钮画成按下的样子，松开之前什么都不发生。再按住一次并按 Tab：按住结束，什么都没有应用。
- 用页面上的按钮禁用第三个选项。按它没有反应，方向键会跳过它。
- 全部禁用。没有控件响应，也没有控件处于悬停。
- 在浏览器开发者工具中打开无障碍树。画布是一个 application，其中有一个 group、一个 switch、含三项的 radiogroup 和一个 button，各带自己的状态，并指明持有焦点的那一个。

## 工作方式

`main.mjs` 在触点输入上创建一个 `createToggleControl`、一个 `createSelectionGroup` 和一个 `createActionControl`，并在悬停输入上为五个表面各创建一个 `createHoverControl`。每个回调都会重绘。一个函数决定状态对应的颜色：先看是否不可用，再看是否按住，然后是已设置或被指向。

按键来自 `@egret/engine/web/keyboard`，交给获得焦点的显示对象，`createControlKeys` 在那里绑定每个控件的常用按键：空格或回车松开时翻转开关、激活按钮，方向键、Home 和 End 在选项组内移动。按住的键让控件像被按下一样绘制，按住期间失去焦点则不激活。选项组是一个键盘停靠点，停靠点跟随被选中的选项。

`createUiSemantics` 描述这五个控件：页面在绘制之后发布，每个节点在发布时读取所绘的控件。`createBrowserSemantics` 在每个控件上方覆盖一个不可见的元素。键盘仍属于画布。

每个控件的说明见[指南](../../knowledge-base/Cns/docs/ui-controls.md)，这份描述见[语义指南](../../knowledge-base/Cns/docs/ui-semantics.md)，两者都列出了已检查的内容。

## 检查

```text
node examples/ui-controls/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。六个场景通过自动化协议驱动鼠标、手指和键盘，另有四个场景读取浏览器计算出的无障碍树并对其中的元素发出请求。它们写出 `report.json` 和每个场景的截图。十个场景都在无头 Chromium 的软件 WebGL2 上通过。硬件 GPU、WebGPU、Edge、Safari、Firefox、真实手机和真人操作都没有运行。
