# 设置界面

[English](README.md) | 简体中文

把 UI 的各个部件放在一起的一个界面：一个开关、一组三个选项、一个文本框、一个主题开关、一个音量滑动条、一个重置前会询问的按钮，以及一个包含两百个存档的托管列表。每个控件都通过同一份状态响应按下、常用按键和辅助技术的请求，主题切换会在一帧内重绘全部内容。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-settings/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 按下开关、某个选项、某个存档。选中一个存档后，它的设置就成为当前设置；手动改动其中一项后，界面不再显示为该存档。
- 按下名字并输入，可以使用输入法。回车提交。最多接受八个字符，一个汉字算一个。
- 按在音量的轨道上，或者按住并沿着它拖动。音量始终落在五的倍数上，离开轨道后拖动仍然继续。
- 点一下画布，然后只用键盘。Tab 依次访问开关、选项、名字、主题开关、音量和按钮，然后把列表作为一个停靠点。空格或回车激活，方向键在选项内和列表中移动，并把音量移动一步，Page Up 和 Page Down 移动四步，Home 和 End 到两端，再按一次 Tab 离开画布。
- 关闭 **深色**。整个界面同时换色：自绘控件、列表的行、文字，以及没有打开的卡片。
- 按 **重置**。先弹出一张卡片询问。Tab 留在卡片内，按下它后面的任何对象都不起作用，Escape 取消，焦点回到按钮上。

## 工作方式

| 部分 | 来源 |
| --- | --- |
| 开关、选项、按钮、文本框、滑动条 | `@egret/engine/ui` 的 `createToggleControl`、`createSelectionGroup`、`createActionControl`、`createTextFieldControl`、`createRangeControl`，指针悬停用 `createHoverControl` |
| 按键 | 每个控件和每一行各有一个 `createControlKeys`。明确的停靠点序号决定顺序；根的 `keyboard.tabStop` 让列表成为一个停靠点 |
| 颜色 | 两个 `createUiTheme` 代际。`selectUiSkin` 给出皮肤为控件状态提供的名称 |
| 存档 | 带虚拟列表的 `createUiRoot`。每一行自己绘制文字，并通过绑定的 `context.target` 接收指针：`createHoverControl` 和 `createActionControl` 让行在指针下面变亮、按住时变暗，完成一次按下就选中它 |
| 卡片 | 第二个根，由 `createUiLayerManager` 作为模态层显示 |
| 文字 | `@egret/engine/text` 的 `createTextField` 加画布栅格化提供方；名字在 `createBrowserTextInput` 中输入 |
| 语义 | `createUiSemantics`、用于各行的 `createUiListSemantics`、用于卡片的 `semanticBoxOf`，由 `createBrowserSemantics` 投射 |

**主题在一帧内切换。**`root.setTheme` 和 `card.setTheme` 先暂存新的代际。页面用新的墨色准备自绘控件的文字，提交两个根，然后才绘制自己的控件并出图。切换准备期间不绘制任何一帧，所以没有一帧会同时出现两种主题。页面会统计根与自绘内容主题不一致的帧数，检查要求这个数保持为零。

**文字逐行准备。**文字栅格缓存同时最多准备四行，而列表会一起绑定它的各行，所以页面把文字排队准备。

参见[控件状态](../../knowledge-base/Cns/docs/ui-controls.md)、[语义](../../knowledge-base/Cns/docs/ui-semantics.md)、[主题](../../knowledge-base/Cns/docs/ui-theme-generations.md)、[层](../../knowledge-base/Cns/docs/ui-layers.md)和[文字输入](../../knowledge-base/Cns/docs/text-input.md)的指南。

## 检查

```text
node examples/ui-settings/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。九个场景各写出一张截图和 `report.json`：浏览器为整个界面计算出的树；只用键盘走过每个控件、输入名字并选中存档；按下与各状态的颜色；输入法组字；按下、拖动、按键和聚焦请求之下的滑动条；用按下和按键切换主题并从屏幕颜色读取结果；模态卡片；辅助技术的请求；以及手机配置。它们在无头 Chromium 的软件 WebGL2 上通过。

组字是通过 Chromium 的协议驱动的。没有运行真实输入法、真实屏幕键盘、读屏软件或其他辅助技术、真人操作、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。这个界面没有 alpha 遮罩或模糊组，也没有演练设备丢失后的恢复：整合 UI 场景的这些部分在各自的示例中检查。
