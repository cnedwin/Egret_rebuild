# 标签页与进度

[English](README.md) | 简体中文

由应用绘制的三个标签页，各有自己的面板。这些标签是一个选择组，也是一个键盘停靠点，面板跟随选择切换。其中一个面板里有三条进度条和一个推进它们的按钮。语义树把同一个界面描述为一排标签、一个标签面板和若干进度条。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-tabs/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 按下一个标签。它的面板取代之前的面板。
- 点一下画布，然后只用键盘。Tab 在这排标签上只停一次；左右方向键移动选择，越过任一端会绕回，Home 和 End 到第一个和最后一个。面板随选择切换，不需要再按别的键。
- 在 **修炼 / Training** 上，Tab 继续移到按钮。回车或空格进行修炼：每条进度各自前进一段，到头为止。全部满了以后按钮被禁用，它原来持有的焦点回到标签上。
- 另外两个标签的面板里没有可停靠的对象，所以 Tab 会离开画布。

## 工作方式

| 部分 | 来源 |
| --- | --- |
| 标签 | `@egret/engine/ui` 的 `createSelectionGroup`，指针悬停用 `createHoverControl` |
| 按键 | 各个标签放在同一个显示对象里，这个对象就是键盘停靠点，上面有一个 `'selection'` 类型的 `createControlKeys` 绑定，`orientation: 'horizontal'` |
| 面板 | 每个面板一个容器。被选中标签的面板可见；不可见的对象不接受按下，也不接受焦点 |
| 按钮 | `createActionControl`，加一个 `'action'` 类型的绑定 |
| 语义 | `tablist`、`tab` 和 `tabpanel`；被选中的标签用 `controls` 指明它的面板。每条进度是带 `range` 的 `progressbar` |

**方向键即选择。**选择一到某个标签，它的面板就显示出来，所以获得焦点的标签始终是被选中的那个，辅助技术要求聚焦某个标签时它也会同时被选中。与这排标签垂直的方向键留给页面。

参见[控件状态](../../knowledge-base/Cns/docs/ui-controls.md)和[语义](../../knowledge-base/Cns/docs/ui-semantics.md)的指南。

## 检查

```text
node examples/ui-tabs/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。五个场景各写出一张截图和 `report.json`：浏览器计算出的一排标签和唯一的面板，以及被选中标签到其面板的关系；按下标签和按钮，从屏幕读取颜色和进度条的填充，并读取浏览器给出的数值；只用键盘；辅助技术的请求；以及手机配置。它们在无头 Chromium 的软件 WebGL2 上通过。

输入是通过自动化协议注入的。没有运行真人操作、实体鼠标、手指或键盘、读屏软件或其他辅助技术、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。
