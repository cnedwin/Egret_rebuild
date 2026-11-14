# 行的菜单

[English](README.md) | 简体中文

托管列表中的一份四十人名册，每名成员有一个包含三个动作的菜单：晋升、降级和休息。菜单是第二个托管根，作为弹出层挂在所属行的末端。鼠标右键、菜单键、Shift+F10、一个按钮以及辅助技术的请求，都通过同一个函数打开它。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-context-menu/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 用左键按下一名成员：他被选中。用右键按下一名成员：他被选中，菜单在这一行末端的下方打开；靠近底部时在上方打开。
- 按下一个动作。成员随之改变，所在的行显示新的内容，菜单关闭。外门成员不能降级，真传成员不能晋升：对应的菜单项变暗，按下也没有反应。
- 菜单打开时按下其他任何地方。菜单关闭，这次按下不会触达它后面的任何对象。
- 点一下画布，然后只用键盘。Tab 进入名册，方向键移动焦点；空格或回车选中。菜单键或 Shift 加 F10 打开焦点所在行的菜单，焦点落在第一个可以执行的动作上。方向键在各项之间循环，Home 和 End 到两端，回车或空格执行，Escape 关闭。之后焦点回到这一行。
- 再按 Tab 移到**操作 / Actions**。它打开被选中成员的菜单；如果那一行已经滚出视野，会先把它带回来。手指没有右键，这是手指的入口。
- 菜单打开时转动滚轮，直到所属的行离开列表：菜单关闭。

## 工作方式

| 部分 | 来源 |
| --- | --- |
| 名册 | 带四十条记录虚拟列表的 `createUiRoot`，并用 `keyboard.tabStop` 让它成为一个停靠点 |
| 哪个按键按下了行 | 根的 `onRowPointer`。通知中带有这次接触，`event.payload.buttons & 2` 表示次要按键处于按下状态 |
| 页面自己的菜单 | 画布阻止 `contextmenu` 的默认行为，否则浏览器的菜单会盖住绘制出来的菜单 |
| 菜单 | 第二个 `createUiRoot`，带三条记录的虚拟列表；每次打开时以 `popup` 注册到 `createUiLayerManager`，使用 `anchor: { root, target: { kind: 'row', listId, key }, align: 'end' }`、`closeOnEscape`，以及落在第一个可执行动作上的 `initialFocus` |
| 菜单项 | 每个绑定的 `context.target`，加上 `createHoverControl` 和 `createActionControl`；`'action'` 类型的 `createControlKeys`；方向键调用 `list.focus` |
| 一个动作 | 换一个新的数据源，其中这条记录的 `contentVersion` 不同：这一行带着新的文字重新绑定。然后调用 `layers.close` |
| 菜单键 | 由页面从行的按键事件中读取：`ContextMenu`，或按住 Shift 的 `F10` |
| 语义 | 名册是一个 `listbox`。菜单是 `role: 'menu'` 的 `createUiListSemantics`，在层打开之前保持隐藏；菜单项无事可做时说明自己 `disabled`。按钮在菜单打开期间说明自己 `expanded` |

**层的变更放在输入之外。**按下和按键是在路由回调内部到达的，那里不能注册或打开层。所以打开操作排在正在进行的提交之后执行。

**不能执行的菜单项仍然接管按键。**控件被禁用的绑定不接管任何键，而留给页面的空格会让页面滚动。所以菜单项保留它的绑定，只是激活时什么都不做。

**菜单属于它的行。**它锚定在行上，而不是某个坐标点上，所以它跟随这一行；当这一行离开列表时，由层把它关闭。

参见[语义](../../knowledge-base/Cns/docs/ui-semantics.md#菜单)、[层](../../knowledge-base/Cns/docs/ui-layers.md)、[托管列表](../../knowledge-base/Cns/docs/ui-data-panel.md)和[控件状态](../../knowledge-base/Cns/docs/ui-controls.md)的指南。

## 检查

```text
node examples/ui-context-menu/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。六个场景各写出一张截图和 `report.json`：菜单关闭时浏览器计算出的树；鼠标右键，包括页面自己的菜单被阻止、菜单在所属行下方和上方的位置、变暗并拒绝的菜单项、一个动作，以及按下其他地方；只用键盘，包括菜单键、Shift+F10、各项循环、Escape 和按钮；被选中的行滚走后被带回，以及所属行离开时菜单关闭；辅助技术的请求；以及手机配置，其中手指选中成员并使用按钮。它们在无头 Chromium 的软件 WebGL2 上通过。

输入是通过自动化协议注入的。没有运行真人操作、实体鼠标、手指或键盘、长按、读屏软件或其他辅助技术、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。手指长按不会打开菜单：手指使用按钮。没有子菜单，没有带勾选状态的菜单项，也不能用首字母跳到某一项。
