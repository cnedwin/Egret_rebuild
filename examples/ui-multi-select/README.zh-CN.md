# 列表多选

[English](README.md) | 简体中文

托管列表中的一份四十人名册，可以从中选出任意多人，然后派出。选择是应用自己保存的一个键的集合；列表只为当前显示的内容生成行。按下、键盘和辅助技术的请求都通过同一个函数切换某一名成员。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-multi-select/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 按下几名成员。每次按下多选一人或取消一人，其他人保持不变。
- 点一下画布，然后只用键盘。Tab 进入名册；方向键、Page Up、Page Down、Home 和 End 移动焦点，不改变选择；空格或回车切换获得焦点的那一行。按住 Shift 再按移动键，会选中从离开的那一行到到达的那一行之间的所有成员；Control+A 选中所有在场的人。Tab 继续移到三个按钮。
- **全选 / All** 选中所有在场的人，**清除 / Clear** 取消全部。没有事情可做的按钮会被禁用。
- **派遣 / Send** 把选中的成员派出去。他们所在的行会注明外出并变暗，不能再被选中。
- 转动滚轮或拖动滚动条的滑块。已选中的成员即使所在的行不在屏幕上，也保持选中。

## 工作方式

| 部分 | 来源 |
| --- | --- |
| 名册 | 带四十条记录虚拟列表的 `createUiRoot` |
| 选择 | 应用中的一个键的 `Set`。行在绑定时以及每次重绘界面时根据它绘制自己 |
| 行上的指针 | 绑定的 `context.target`，加上 `createHoverControl` 和 `createActionControl`。成员外出的行上，这两个控件被禁用 |
| 按键 | 每一行一个 `'action'` 类型的 `createControlKeys`；方向键显示并聚焦下一行。`keyboard.tabStop` 让名册成为一个停靠点。Shift 和 Control+A 由页面自己从行的按键事件中读取 |
| 被派出的成员 | 换一个新的数据源，其中这条记录的 `contentVersion` 不同：这一行带着新的文字重新绑定 |
| 语义 | `createUiListSemantics`，使用 `role: 'listbox'` 和 `multiple: true`；每一行说明 `selected` 和 `disabled`。人数是一个 `text` 节点，另有一个 `scrollbar` 指明名册 |

**外出成员所在的行仍然接管按键。**控件被禁用的绑定不接管任何键，而留给页面的空格会让页面滚动。所以这一行保留它的绑定，只是激活时什么都不做。

**获得焦点的按钮被禁用时会把焦点交出去。**派遣之后没有人被选中，刚按过的按钮就没有事情可做了；页面把焦点移到一个还能操作的按钮上。

参见[托管列表](../../knowledge-base/Cns/docs/ui-data-panel.md)、[控件状态](../../knowledge-base/Cns/docs/ui-controls.md)和[语义](../../knowledge-base/Cns/docs/ui-semantics.md)的指南。

## 检查

```text
node examples/ui-multi-select/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。六个场景各写出一张截图和 `report.json`：浏览器计算出的列表框，带有 `aria-multiselectable`；按下选中多名成员并取消其中一人、派遣，以及三个按钮，颜色从屏幕读取；只用键盘；用 Shift 选中一段、用 Control+A 选中所有人；辅助技术的请求；以及手机配置，其中手指拖动滚动条以到达更多成员。它们在无头 Chromium 的软件 WebGL2 上通过。

输入是通过自动化协议注入的。没有运行真人操作、实体鼠标、手指或键盘、读屏软件或其他辅助技术、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。用 Shift 选中一段时只会增加成员：没有锚点，也不会取消任何人；按住 Shift 的按下与普通按下相同。手指不能平移各行。
