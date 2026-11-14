# 从哪个界面示例开始

[English](../../en/docs/ui-examples.md) | 简体中文

这个引擎的界面由应用自己绘制：引擎提供布局、列表、层、控件状态、按键和面向辅助技术的描述，应用负责绘制。下面每个示例都是这样的一个界面，小到可以一次读完，并且在真实浏览器中检查过。本页说明应该从哪一个开始。它们属于 M3.3 和 M3.4，即 [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) 和 [#90](https://github.com/cnedwin/Egret_rebuild/issues/90)。

**检查了什么，没有检查什么。**每个示例都有一份检查，在无头 Chromium 的软件 WebGL2 上用注入的输入驱动它。没有任何示例由真人操作过，也没有用实体鼠标、手指或键盘、读屏软件、硬件 GPU 或真实手机运行过。每个 README 都说明了它自己的检查覆盖了什么。

## 按界面的内容来找

| 界面里有 | 从这里开始 | 它展示了 | 指南 |
| --- | --- | --- | --- |
| 按钮、开关、多选一 | [控件状态](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/README.zh-CN.md) | 控件的每一种状态如何根据主题绘制，以及各自的按键 | [控件状态](ui-controls.md) |
| 玩家输入文字的地方 | [文本框](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-text-field/README.zh-CN.md) | 用平台自己的输入方式编辑名称和宣言，所以任何输入法都能用 | [控件状态](ui-controls.md#文本框) · [文字输入](text-input.md) |
| 设置 | [设置界面](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.zh-CN.md) | 开关、选项、文本框、滑动条、两套主题、存档列表，以及重置前先询问的对话框，都在一个界面里 | [控件状态](ui-controls.md) · [层](ui-layers.md) |
| 几个面板，一次显示一个 | [标签页与进度](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tabs/README.zh-CN.md) | 作为一个键盘停靠点的一排标签、它们的面板，以及进度条 | [语义](ui-semantics.md#标签页与进度) |
| 很长的列表 | [列表语义](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-list-semantics/README.zh-CN.md) | 五万行中只存在八行，单选，以及在模态层里显示的详情 | [托管 UI](ui-data-panel.md) · [语义](ui-semantics.md#托管虚拟列表) |
| 每一行都有一个可选项的列表 | [列表中的下拉选择](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md) | 锚定在滚动列表某一行上的弹出层，以及在指针下变亮的行 | [层](ui-layers.md) · [行](ui-controls.md#托管列表的行) |
| 每一行都有几个动作的列表 | [行的菜单](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-context-menu/README.zh-CN.md) | 用右键、菜单键或按钮打开的菜单，其中有被禁用的动作 | [语义](ui-semantics.md#菜单) |
| 从中选出多个的列表 | [列表多选](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-multi-select/README.zh-CN.md) | 一组被选中的行，用 Shift 选一段，用 Control+A 选所有人，以及对这一组执行操作的按钮 | [语义](ui-semantics.md#托管虚拟列表) |
| 可排序的表格 | [可排序的名册表格](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-roster-table/README.zh-CN.md) | 表头正向和反向排序一个托管列表，被选中的行在换了顺序之后仍被选中 | [语义](ui-semantics.md#托管列表的表格) |
| 部分之下还有部分的东西 | [可展开和收起的树](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tree/README.zh-CN.md) | 可以展开和收起的项目，列表只保存显示出来的部分 | [语义](ui-semantics.md#树) |
| 行囊、仓库、棋盘 | [行囊](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-inventory/README.zh-CN.md) | 按行和列排列的格子，可沿两个方向移动的光标，以及光标所在的物品是什么 | [语义](ui-semantics.md#网格) |
| 从一个总数里分配数量 | [按步分配数量](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-stepper/README.zh-CN.md) | 按步增减的数量、剩余量，以及修改被拒绝时的消息 | [语义](ui-semantics.md#消息) · [控件状态](ui-controls.md#范围内的一个值) |
| 会变亮的按钮、用滚轮滚动的列表 | [悬停与滚轮](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/README.zh-CN.md) | 鼠标或笔的悬停、滚轮和滚动条 | [悬停与滚轮](pointer-hover.md) |

## 它们的共同点

- **每一件可能发生的事对应一个函数。**按下、按键和辅助技术的请求到达应用的同一个函数，所以三者不会不一致。
- **属于应用的状态由应用保存。**哪些行被选中、光标在哪里、哪些项目是展开的：一个集合、一个数字、一个映射。引擎的控件只保存控件本身的状态，例如按下、悬停或选中。
- **行只保存自己显示的内容。**托管列表只为显示出来的部分生成行，并且重复使用它们。行是什么，在行被绑定、绘制或被询问时从应用读取。
- **语义是读出来的，不是抄下来的。**每次发布[语义树](ui-semantics.md)时，每个节点都描述正在绘制的那个控件。

## 界面完成之前

下面每一条都曾是某个示例里的缺陷，靠查看画面或用键盘走一遍发现，现在都已成为检查的一部分。

- **看第一帧。**在任何输入之前，界面显示它该显示的内容，没有别的。从未打开过的弹出层不在画面上。
- **弹出层和模态层从一开始就是层。**在创建它的根时就以关闭状态注册到[层管理器](ui-layers.md)。没有注册为层的根只是一个普通的根：它会绘制在自己所在的位置，它的行也是键盘停靠点。
- **用 Tab 从第一个停靠点一直走过最后一个。**它到达每一个可以操作的控件，跳过每一个不能操作的控件，然后离开画布。
- **被禁用的控件不是停靠点。**在禁用它的那次按键结束之后，对 `keyboard.registerTarget` 的返回值调用 `update({ disabled: true })`；如果控件正持有焦点，先把焦点移走。参见[按键](ui-controls.md#按键)。
- **换了顺序之后，说明列表应该停在哪里。**先 `setSource`，再 `setScrollOffset`：[列表会让它的锚点留在视野内](ui-data-panel.md)，除非另有指示。
- **消息在有内容可说之前就已经在树中。**从一开始就以空内容发布 `status` 或 `alert`，之后改变它的文字。参见[消息](ui-semantics.md#消息)。
- **属于控件的按键，在边缘处也由控件接管。**最后一行上的方向键，或者不能操作的行上的空格，仍然不该交给页面去滚动。

## 它们都没有做的事

- 手指不能平移列表，只能拖动滚动条。长按没有任何效果。没有任何东西可以从一处拖到另一处。手势是 #90 中尚未完成的部分。
- 没有任何示例在真实手机、硬件 GPU、Firefox 或 Safari 上运行过，也没有用读屏软件运行过。这些运行是 #89 和 #90 中尚未完成的部分。
- 覆盖整个根或层的遮罩与模糊不属于这些界面。
