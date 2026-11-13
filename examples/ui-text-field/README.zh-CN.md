# 文本框控件

[English](README.md) | 简体中文

由引擎绘制的表单：名称、宣言和一个按钮。`createTextFieldControl` 保存每个文本框的文字，并在其上方打开平台文字输入，玩家用平台自带的输入法输入。按下、按键和辅助技术的请求开始的是同一次编辑。

## 运行

构建各包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务输出的主机和端口，在那里打开 `/examples/ui-text-field/index.html`。浏览器提供 WebGPU 时页面用它绘制；加上 `?backend=webgl2` 使用 WebGL2。

## 可以尝试

- 点击名称并输入，可以使用输入法。回车提交。最多接受八个字符，一个汉字算一个。
- 点击宣言并输入多行。在这里回车是换行。点击别处提交，或按 Esc 取消。
- 一个文本框打开时点击另一个。打开的那个被提交，另一个随即打开。
- 点一下画布，然后使用键盘。Tab 在名称、宣言和按钮之间移动。回车或空格打开文本框或按下按钮；编辑结束后，焦点回到这个文本框。
- 按下按钮。旁边的一行显示保存的内容。
- 禁用表单。什么都打不开，正在进行的编辑被取消。

## 工作方式

`main.mjs` 为画布创建一个 `createBrowserTextInput`，并把它作为 `editor` 交给两个文本框。每个 `createTextFieldControl` 通过 `field()` 被问到它的框在舞台上的位置，以及平台输入框应有的外观。引擎绘制已提交的文字，并在控件处于 `editing` 时把它隐藏，因为此时文字由平台输入框显示。

按键来自 `@egret/engine/web/keyboard`，交给获得焦点的显示对象。文本框在回车或空格松开时用 `edit()` 打开，这样这个键不会被输入进去。编辑结束时，页面把应用的焦点交还给这个文本框。

`createUiSemantics` 描述这个表单：一个 group、两个带文字的 textbox 和一个 button。文本框在编辑期间，它的节点被隐藏，因为此时平台输入框就是这个文本框自己的元素，同一内容不应被朗读两次。

参见[控件指南](../../knowledge-base/Cns/docs/ui-controls.md#文本框)、[文字输入指南](../../knowledge-base/Cns/docs/text-input.md)和[语义指南](../../knowledge-base/Cns/docs/ui-semantics.md)。

## 检查

```text
node examples/ui-text-field/verify.mjs <Playwright index.mjs 的绝对路径> <新的绝对输出目录> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。六个场景写出 `report.json` 和每个场景的截图：输入法组字、多行以及一个文本框把编辑器交给另一个、键盘、无障碍树、禁用，以及手机配置。它们在无头 Chromium 的软件 WebGL2 上通过。

组字通过 Chromium 的协议驱动：先是未确定的拼音，然后是选定的汉字。真实输入法、真实屏幕键盘、系统剪贴板、硬件 GPU、WebGPU、Edge、Safari、Firefox、真实手机、真人操作和任何读屏软件都没有运行。
