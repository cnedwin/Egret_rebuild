# 列表语义

[English](README.md) | 简体中文

一个由引擎绘制的五万台服务器的列表。托管 UI 只实例化可见的八行，`createUiListSemantics` 为其中每一行保留一个语义节点，因此辅助技术得到的是一个列表框，其中每个选项都说明自己在五万项中的位置。按下、按键和辅助技术的请求到达的是同一个选择。服务器的详情在一个模态层中打开，辅助技术得到的是一个对话框。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-list-semantics/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 按下某一行。它变成绿色：这就是被选中的服务器。
- 点一下画布，然后按 Tab。获得焦点的行有一圈标记。方向键、Page Up、Page Down、Home 和 End 在整个列表中移动，列表在焦点下方滚动。空格或回车在松开时选中该行。
- 在某一行上按右方向键，或按 **所选服务器的详情**。一张带两个按钮的卡片在列表上方打开。Tab 留在卡片内，按下卡片旁边不会触达任何对象，Escape 关闭它。焦点回到原来的行。
- 按 **前往第 40,000 行**。列表跳到那里，焦点落在那一行上。
- 当焦点在很靠后的某一行时按 **滚动到顶部**。那一行离开列表，此时没有任何对象持有焦点。
- 使用读屏软件进入列表。每个选项会连同它在五万项中的序号一起播报。项目没有运行过这一项，见下文。

这些行不带文字。每一行用若干小方块显示自己序号的末位数字，这样在截图里可以区分各行。

## 工作方式

`createUiRoot` 拥有这个列表：它实例化可见的行，回收其余的行，并告诉页面触点落在哪一行上。每次提交之后，页面调用 `rows.sync()`，并用它返回的修订号发布语义树：

```js
const rows = createUiListSemantics({
  semantics, root, list: 'list', role: 'listbox', name: 'Servers', focusable: true,
  describeRow: (key, index) => ({ name: 'Server ' + (index + 1), selected: key === selected }),
  onActivateRow: key => select(key),
});
// 在 root.commit(...) 之后，与显示同一批行的那一帧一起：
semantics.publish(rows.sync());
```

`createBrowserSemantics` 在每个可见行上方覆盖一个不可见的元素。键盘仍属于画布，画布指明持有焦点的那一行对应的元素。已经离开列表的行没有元素，所以画布永远不会指向一个不存在的元素。

列表是键盘的一个停靠点（根的 `keyboard: { input, idPrefix, tabStop }`）：Tab 从上次持有焦点的行进入列表，并从那里离开。每个被实例化的行都有一个 `createControlKeys` 绑定，处理空格和回车。方向键请求根显示下一行，焦点在实例化该行的那次提交之后才交给它。

卡片是第二个根，通过 `createUiLayerManager` 注册为模态层。它的语义节点是页面自己添加的一个对话框：层关闭时隐藏，位置由 `semanticBoxOf(card, 'card')` 给出。它被发布期间，语义树让列表变为 inert，所以浏览器交给辅助技术的只有这个对话框和它的两个按钮，后面的内容都不在其中。

参见[语义指南](../../knowledge-base/Cns/docs/ui-semantics.md#托管虚拟列表)、[层指南](../../knowledge-base/Cns/docs/ui-layers.md)和[托管 UI 指南](../../knowledge-base/Cns/docs/ui-data-panel.md)。

## 检查

```text
node examples/ui-list-semantics/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。八个场景各写出一张截图和 `report.json`：浏览器计算出的列表框、键盘穿过被回收的行、跳到第 40,000 行以及从焦点处滚走、对选项发出的请求、较窄的窗口加滚动后的页面、手机配置、浏览器计算出的树中只有模态卡片，以及键盘进入卡片再回到原来的行。它们在无头 Chromium 的软件 WebGL2 上通过。

没有运行读屏软件或其他辅助技术、真人键盘操作、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。浏览器正确计算出列表框，并不证明这个列表在读屏软件下可用。
