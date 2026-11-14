# 列表中的下拉选择

[English](README.md) | 简体中文

托管列表中的一份四十人名册，每人有一项职务。激活某一行，职务就作为锚定在这一行上的弹出层打开：它是第二个托管根，由层管理器放在这一行下面，不受名册裁剪的限制。按下、键盘和辅助技术的请求都走同样的两个函数。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-dropdown/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 按下一个成员。职务在这一行末尾的职务框下面打开，并标出该成员现在的职务。按下一项职务：这一行显示新的职务，职务列表关闭。
- 按下靠近底部的成员。下方没有空间，所以职务列表出现在这一行上方。
- 打开职务列表后按在别处。它会关闭，而这次按下不会传到它后面的任何对象。
- 点一下画布，然后只用键盘。Tab 进入名册，方向键、Page Up、Page Down、Home 和 End 在其中移动，回车或空格打开职务列表，焦点落在该成员现在的职务上。方向键、Home 和 End 在职务之间移动，回车选择，Escape 关闭，焦点回到这一行。
- 打开职务列表后转动滚轮。名册滚动，职务列表跟随它所在的行；这一行离开名册后它就关闭。

## 工作方式

| 部分 | 来源 |
| --- | --- |
| 名册 | 带四十条记录虚拟列表的 `createUiRoot`。行作为整体被按下，通过 `onRowPointer` 得到通知 |
| 职务 | 第二个 `createUiRoot`，共五行 |
| 弹出层 | `createUiLayerManager`。每次激活一行时，把职务注册为 `popup`，使用 `anchor: { root, target: { kind: 'row', listId, key }, align: 'end' }`，并把 `initialFocus` 设为该成员现在的职务，然后打开 |
| 职务改变 | 给名册换一个新的数据源，其中这条记录的 `contentVersion` 不同：这一行被重新绑定，并保留焦点 |
| 按键 | 每一行用 `createControlKeys` 处理回车和空格；方向键显示并聚焦下一行。`keyboard.tabStop` 让名册成为一个停靠点 |
| 滚轮 | 使用悬停输入的 `createScrollControl`，由它设置列表的滚动偏移 |
| 语义 | 两次 `createUiListSemantics`：名册是 `list`，职务是带有 `hidden: () => !open` 的 `listbox`，所以只有弹出层打开时它才在树中 |

**层的变更在路由回调之外进行。**按下和按键是在输入自己的分发过程中到达的，层管理器在那里拒绝注册和发布。因此 `openFor` 和 `choose` 排在正在进行的提交之后运行，与发布使用同一条 promise 链。

**职务列表如何关闭。**按在它之外、Escape、做出选择，以及失去锚点：这一行滚出名册后，层管理器在下一次 `sync()` 时撤下弹出层。页面在每次 `sync()` 之后询问层管理器弹出层是否仍然打开，不再打开时就不再记着那一行。

参见[层](../../knowledge-base/Cns/docs/ui-layers.md)、[托管列表](../../knowledge-base/Cns/docs/ui-data-panel.md)、[语义](../../knowledge-base/Cns/docs/ui-semantics.md)和[控件状态](../../knowledge-base/Cns/docs/ui-controls.md)的指南。

## 检查

```text
node examples/ui-dropdown/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。八个场景各写出一张截图和 `report.json`：职务列表关闭时浏览器计算出的树；按下后在职务框下面打开并按下选择，颜色从屏幕读取；弹出层伸到名册裁剪范围之下、出现在靠近底部的行上方、盖住后面的行；按在别处；只用键盘；滚轮滚动时职务列表跟随所在的行并在该行消失后关闭；辅助技术的请求；以及手机配置。它们在无头 Chromium 的软件 WebGL2 上通过。

输入是通过自动化协议注入的。没有运行真人操作、实体鼠标、滚轮、手指或键盘、读屏软件或其他辅助技术、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。手指不能平移名册：平移属于手势，这里没有识别任何手势，所以在手机上不用键盘只能够到当前显示的行。托管列表不报告指针悬停在哪一行上，所以职务列表没有悬停时的颜色。
