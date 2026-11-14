# 可排序的名册表格

[English](README.md) | 简体中文

四十名成员，四列的表格：姓名、品阶、职务和修为。这些行是一个托管列表，所以只有显示出来的部分才有对应的行。按表头按该列排序，再按一次反转顺序；按下一行选中这名成员。对辅助技术来说，它是一个四十一行的网格，其中第一行是表头。

## 运行

构建各个包，以仓库根目录提供服务，然后打开页面：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

记下服务器输出的主机和端口，在那里打开 `/examples/ui-roster-table/index.html`。浏览器支持 WebGPU 时页面用 WebGPU 绘制；加上 `?backend=webgl2` 则使用 WebGL2。

## 可以尝试

- 按 **品阶 / Rank**。各行按品阶排序，品阶相同的成员保持编号的顺序。表头的上边缘出现一条横线。再按一次：顺序反转，横线移到下边缘。
- 按下一行。这名成员被选中；表格换一种方式排序后，无论他所在的行到了哪里，他仍然被选中。
- 转动滚轮或拖动滚动条的滑块。排序之后表格重新显示顶部。
- 点一下画布，然后只用键盘。Tab 依次经过四个表头，在表头上用回车或空格排序，然后进入各行。在行中，方向键、Page Up、Page Down、Home 和 End 按当前的顺序在各行之间移动，空格或回车选中。

## 工作方式

| 部分 | 来源 |
| --- | --- |
| 各行 | 带四十条记录虚拟列表的 `createUiRoot`，并用 `keyboard.tabStop` 让这些行成为表头之后的一个停靠点 |
| 新的顺序 | 把相同的记录按另一种顺序作为新的数据源：先 `list.setSource(...)`，再 `list.setScrollOffset(0)`。数据源更换后，列表会让它的锚点留在视野内，除非被告知应该停在哪里 |
| 一行 | 只保存自己显示的内容。成员排在第几位，在按键需要时从顺序中读取，因为只有位置改变时行不会重新绑定 |
| 表头 | 各有一个 `createHoverControl`、一个 `createActionControl` 和 `'action'` 类型的 `createControlKeys`，并各是一个键盘停靠点 |
| 语义 | `createUiListSemantics`，使用 `role: 'grid'`、`columns: 4` 和 `rowOffset: 1`；`describeRow` 给出 `selected`。一行的四个单元格在 `onRowAdded` 中添加，并根据 `rows.rowBounds(key)` 度量。表头行是应用自己的一个 `row`，其中四个 `columnheader` 节点说明 `sort`。顺序改变时由一个 `status` 说明，另有一个 `scrollbar` 指明这个网格 |

**被选中的对象是行。**每一行说明自己是否被选中，单元格不提这件事。持有列表焦点的行作为行成为持有焦点的节点。

**网格的第一行是表头。**使用 `rowOffset: 1` 时，第一名成员是第二行，网格共有四十一行。滚动进入视野的行会说明自己是整张表的第几行。

参见[语义](../../knowledge-base/Cns/docs/ui-semantics.md#托管列表的表格)、[托管列表](../../knowledge-base/Cns/docs/ui-data-panel.md)和[控件状态](../../knowledge-base/Cns/docs/ui-controls.md)的指南。

## 检查

```text
node examples/ui-roster-table/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

省略第三个参数时启动已安装的 Edge（有界面）。使用 `software` 时由 Playwright 自带的浏览器以无头方式和软件渲染运行。六个场景各写出一张截图和 `report.json`：开始时浏览器计算出的网格，包括行列数、每个表头说明的排序状态和每一行的序号，以及从屏幕读取的初始状态；按表头正向和反向排序，每种顺序都与页面之外另行算出的顺序比较，被选中的成员在换了顺序之后仍被选中；滚轮，以及显示出来的各行的序号；只用键盘，经过表头进入各行再离开画布，页面没有滚动；辅助技术对表头和行的请求，顺序由 status 元素说明；以及手机配置，其中用注入的触摸拖动滚动条。它们在无头 Chromium 的软件 WebGL2 上通过。

输入是通过自动化协议注入的。没有运行真人操作、实体鼠标、手指或键盘、读屏软件或其他辅助技术、硬件 GPU、WebGPU、Edge、Safari、Firefox 和真实手机。焦点落在整行上：没有停在单个单元格上的光标。列不能调整宽度、隐藏或移动，表格一次只按一列排序，手指不能平移各行。
