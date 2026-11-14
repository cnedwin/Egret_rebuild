# 自绘界面的语义

[English](../../en/docs/ui-semantics.md) | 简体中文

对辅助技术来说，画布只是一张图。`@egret/engine/ui/semantics` 保存应用在画布上所绘控件的描述：每个控件是什么、叫什么、处于什么状态。`@egret/engine/web/semantics` 把这份描述投射到页面，读屏软件、语音控制或开关设备在那里找到它。两者都属于 M3.4，[#90](https://github.com/cnedwin/Egret_rebuild/issues/90)。

这份描述不是界面的第二份副本。每次发布语义树时，每个节点都重新读取所绘的控件；节点的动作也就是按下和按键已经触达的那些动作。

**哪些已检查，哪些没有。**语义树和投射在 Node 中以及使用软件 WebGL2 的无头 Chromium 中检查，对照的是该浏览器计算出的无障碍树。没有运行任何读屏软件或其他辅助技术，也没有运行其他浏览器。见[实际运行的检查](#实际运行的检查)。

## 语义树

```js
import { createUiSemantics, semanticBoundsOf } from '@egret/engine/ui/semantics';

const semantics = createUiSemantics();
semantics.add({
  id: 'sound', role: 'switch',
  describe: () => ({ name: '声音', bounds: semanticBoundsOf(soundSprite), checked: sound.checked, disabled: !sound.enabled, focused: keyboard.getSnapshot().focusedId === 'sound' }),
  onActivate: () => sound.toggle(),
  onFocus: () => keyboard.focus('sound', { visible: true }),
});
// 在显示同一状态的那一帧之后：
semantics.publish();
```

`add` 接收 id、角色、所在父节点的 id（如果有）和 `describe`，返回一个句柄，句柄的 `remove()` 会把该节点连同其内部的全部节点一起移除。`publish()` 调用每个 `describe`，检查返回值，并用一份冻结的快照替换 `semantics.snapshot`。添加或移除节点本身不发布任何内容。

失败的发布什么都不发布，之前的快照保持完整。与上一次相同的发布返回同一份快照；没有变化的节点在前后两份快照中是同一个对象，因此读取快照的一方可以按对象身份比较。

`describe` 可以读取任何东西，但不能添加、移除、发布、执行动作或销毁，这些调用都会以 `UI_SEMANTICS_REENTRANT` 被拒绝。

`semanticBoundsOf(displayObject)` 测量舞台上包围某个显示对象及其内容的矩形。范围使用舞台的逻辑坐标，与拾取所用的坐标相同。

### 角色

角色集合就是界面的首批控件集合。未列出的角色会被拒绝。

| 角色 | 用途 | 具有的状态 | 必须位于 |
| --- | --- | --- | --- |
| `group` | 面板 | `disabled` | |
| `image` | 有含义的图片 | | |
| `text` | 标签或段落，`name` 就是文字 | | |
| `button` | 按钮 | `disabled`、`expanded` | |
| `checkbox` | 选中、未选中或 `'mixed'` 的复选框 | `checked`（必填）、`disabled` | |
| `switch` | 开关 | `checked`（必填）、`disabled` | |
| `radiogroup` | 多选一 | `disabled` | |
| `radio` | 其中一个选项 | `checked`（必填）、`disabled`、`position` | `radiogroup` |
| `listbox` | 带选择的列表：选中一项，使用 `multiple` 时可选中多项 | `multiple`、`disabled` | |
| `option` | 列表中的一项 | `selected`（必填）、`disabled`、`position` | `listbox` |
| `list` | 由行组成的列表 | | |
| `listitem` | 一行 | `position` | `list` |
| `scrollbar` | 视口的滚动位置 | `range`（必填）、`orientation`、`controls`、`disabled` | |
| `slider` | 范围内的一个值 | `range`（必填）、`orientation`、`disabled` | |
| `spinbutton` | 按步改变的一个值 | `range`（必填）、`disabled` | |
| `progressbar` | 某项工作进行到哪里 | `range`；没有它表示工作量未知 | |
| `tablist` | 一排标签 | `orientation`、`disabled` | |
| `tab` | 其中一个标签 | `selected`（必填）、`controls`、`position`、`disabled` | `tablist` |
| `tabpanel` | 标签所显示的内容 | | |
| `menu` | 动作菜单 | `orientation`、`disabled` | |
| `menuitem` | 其中一个动作 | `disabled`、`position` | `menu` |
| `grid` | 按行和列排列的单元格 | `extent`、`multiple`、`disabled` | |
| `row` | 网格中的一行 | `position`、`selected`、`disabled` | `grid` |
| `gridcell` | 行中的一个单元格 | `selected`、`disabled`、`position` | `row` |
| `columnheader` | 表头行中某一列的表头 | `sort`、`position`、`disabled` | `row` |
| `dialog` | 对话框 | `modal` | |
| `textbox` | 未处于编辑状态的文本框 | `value`、`multiline`、`disabled` | |
| `status` | 内容改变时朗读的消息，排在正在朗读的内容之后 | | |
| `alert` | 立即朗读的消息 | | |

每个节点都有 `bounds`，还可以有 `name`、`hidden`、`focused` 和 `order`。除 `group`、`radiogroup`、`listbox`、`list`、`listitem`、`tablist`、`menu`、`grid` 和 `row` 外，名称必填；`status` 和 `alert` 的名称就是消息本身，可以为空。`image`、`text`、`button`、`checkbox`、`switch`、`radio`、`option`、`scrollbar`、`slider`、`spinbutton`、`progressbar`、`tab`、`menuitem`、`gridcell`、`columnheader`、`textbox`、`status` 和 `alert` 被当作一个整体朗读，内部不能再有节点。

`slider` 和 `tablist` 默认沿文字方向横放，除非 `orientation` 为 `'vertical'`；`scrollbar` 默认竖立在它滚动的内容旁边，`menu` 的各项默认自上而下排列，除非为 `'horizontal'`。滑动条和数值调节框在获得焦点后由[它们的按键](ui-controls.md#按键)移动，所以它们的节点接受 `onFocus`，不需要激活。

角色不具有的状态会被拒绝，这样错误在写下时就能发现。被拒绝的描述抛出 `UI_SEMANTICS_DESCRIPTION`，其 `cause` 指明节点和字段，例如 `sound: checked`。

### 顺序、隐藏与虚拟行

同一父节点下的节点按 `order` 从小到大朗读，`order` 相同的按添加顺序。隐藏的节点连同内部的全部节点一起被略过，内部节点的 `describe` 不会被调用。

虚拟列表只发布已经实例化的行，不发布尚未实例化的记录。每一行用 `position: { index, size }` 给出它在整个列表中的序号和整个列表的大小，并把 `order` 设为它的序号：

```js
semantics.add({ id: 'row-' + key, role: 'listitem', parent: 'messages',
  describe: () => ({ bounds: semanticBoundsOf(row), order: index, position: { index: index + 1, size: records.length } }) });
```

一棵树默认最多保存 256 个节点，可用 `maxNodes` 调整，上限为 4,096。

### 托管虚拟列表

[托管 UI](ui-data-panel.md) 的行随着根的每一次提交出现和消失。`createUiListSemantics` 让节点与之保持一致：列表一个节点，每个可见行一个节点。

```js
import { createUiListSemantics } from '@egret/engine/ui/semantics';

const rows = createUiListSemantics({
  semantics, root, list: 'messages', role: 'listbox', name: 'Messages', focusable: true,
  describeRow: (key, index) => ({ name: titles[index], selected: key === chosen }),
  onActivateRow: key => choose(key),
});
// 在 root.commit(...) 之后，与显示同一批行的那一帧一起：
semantics.publish(rows.sync());
```

`root` 是 `createUiRoot` 返回的根，`list` 是虚拟列表在其树中的 id。`sync()` 读取根已提交的内容：移除不再可见的行的节点，移动留下的行，添加现在可见的行，并返回已提交的修订号，也就是 `publish` 所接受的参数。仅仅提交不会改变语义树。

- **位置。**行的范围是它在舞台上被列表显示出来的那一部分。它的 `position` 是它在整个列表中的序号和记录总数，`order` 是它的序号。
- **角色。**`'list'` 发布列表项，列表项内部可以有其他节点；`'listbox'` 发布选项，选项需要由 `describeRow` 提供名称。没有说明的选项视为未选中。使用 `multiple: true` 时，列表框表明可以同时选中多个选项；每个选项仍然各自说明是否被选中，被选中的键的集合由应用保存，因为列表只为当前显示的内容生成行。[多选示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-multi-select)就是这样做的。`'menu'` 发布菜单项，菜单项和选项一样需要名称，并且从不处于选中状态。`'grid'` 发布[表格](#托管列表的表格)的行。
- **id。**列表节点的 id 是 `id`，默认是根的 id、一个斜杠和列表的 id。行在其后再加一个斜杠和自己的键，可用 `rows.rowId(key)` 得到。
- **焦点。**持有根焦点的行就是获得焦点的节点。设置 `focusable: true` 后可以请求某一行获得焦点，这需要根配有键盘。滚走的行同时失去根里的焦点和树里的节点，所以投射永远不会指向一个不存在的元素。
- **行内的节点。**某一行的节点添加之后会调用 `onRowAdded(key, id)`。在其中以 `parent: id` 添加的节点会随该行一起消失，该行再次被实例化时回调会再次被调用。
- **容量。**离开的行先被移除，然后才添加新的行，所以整页换成新行时不需要同时容纳新旧两批。如果树仍然拒绝某一行，`sync()` 抛出这次拒绝，并且不添加任何新行；留在树中的内容与这次提交相符。

`dispose()` 移除列表节点和所有行。这个辅助对象不添加监听器，除了某一行被请求获得的焦点之外，不改变根里的任何东西。应用自己的根只要具有 `SemanticListSource` 形状的 `id`、`snapshot()` 和 `list(id)`，也可以用同样的方式读取。

### 托管 UI 的盒与层

`semanticBoxOf(root, id)` 给出根所布局的某个盒在舞台上的矩形：叶子、行、列或列表，用它在根的树中的 id 指定。它在被调用时读取最近一次提交，所以应在 `describe` 里调用。根尚未布局的盒没有大小。

[层管理器](ui-layers.md)的弹出层或模态层是应用自己的一个节点。它读取该层：层关闭时隐藏，层为模态时节点也是模态。

```js
import { semanticBoxOf } from '@egret/engine/ui/semantics';

const layer = () => layers.snapshot().layers.find(found => found.id === 'details');
semantics.add({ id: 'details', role: 'dialog',
  describe: () => ({ name: 'Details', modal: true, hidden: !layer().visible, bounds: semanticBoxOf(card, 'card') }) });
semantics.add({ id: 'details/close', role: 'button', parent: 'details', onActivate: close,
  describe: () => ({ name: 'Close', bounds: semanticBoxOf(card, 'close'), focused: keyboard.getSnapshot().focusedId === 'details-close' }) });
```

这种层里的托管列表在 `createUiListSemantics` 中使用 `hidden`：`hidden: () => !layer().visible`。它这样回答期间，列表连同它的行都不发布，也不会询问各行。[下拉示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-dropdown)中的职务就是这样一个 `listbox`，只有弹出层打开时才在树中。

其余部分不需要额外处理。层管理器在放置层时移动它的根，所以盒随之移动。它把焦点移入该层再移回，节点读取的就是这个焦点。发布了模态对话框时，语义树让[它之外的一切变为 inert](#模态对话框)，这与管理器的屏障对按下所做的一致。应在 `layers.sync()` 之后发布。

### 焦点

`focused: true` 标记持有应用键盘焦点的节点。只能有一个节点持有焦点，出现第二个时以 `UI_SEMANTICS_FOCUS` 拒绝。

### 模态对话框

发布了 `modal: true` 的对话框时，快照中对话框之外的每个节点都是 `inert`，对话框所在的各级父节点除外。`inert` 节点拒绝一切动作。同时发布多个模态对话框时，最后读取的那个在最前面。持有焦点的节点如果是 `inert` 会被拒绝，因为焦点应当在对话框内部。

### 关系

`scrollbar` 可以用 `controls` 指明它滚动的节点，`tab` 可以用它指明自己显示的 `tabpanel`。被指明的节点必须在同一份快照中发布，否则发布以 `UI_SEMANTICS_RELATION` 被拒绝。没有显示的面板通常是隐藏的或根本不存在，所以只有被选中的标签指明面板。

### 标签页与进度

一排标签对应用来说是一个[选择组](ui-controls.md#多选一)，对读屏用户来说是 `tablist`。每个 `tab` 说明自己是否 `selected`，被选中的那个指明它的 `tabpanel`：

```js
semantics.add({ id: 'tabs', role: 'tablist', describe: () => ({ name: 'Sect', bounds: stripBounds }) });
for (const [index, key] of keys.entries()) semantics.add({ id: 'tab-' + key, role: 'tab', parent: 'tabs',
  onActivate: () => { group.select(key); },
  onFocus: () => { group.select(key); keyboard.focus('tabs', { visible: true }); },
  describe: () => ({ name: names[key], bounds: boxes[key], selected: group.selected === key, position: { index: index + 1, size: keys.length },
    focused: keyboard.getSnapshot().focusedId === 'tabs' && group.selected === key,
    ...(group.selected === key ? { controls: 'panel-' + key } : {}) }) });
for (const key of keys) semantics.add({ id: 'panel-' + key, role: 'tabpanel',
  describe: () => ({ name: names[key], hidden: group.selected !== key, bounds: panelBounds }) });
```

这些标签是[一个键盘停靠点](ui-controls.md#按键)，使用选择组的按键：方向键移动选择，面板随之切换，所以被要求获得焦点的标签会同时被选中。面板里的内容加在它的节点之下，并随它一起隐藏。

`progressbar` 只报告，不接受任何动作。有 `range` 时它说明工作进行到哪里；没有时表示工作正在进行，而工作量未知。

### 菜单

针对某个对象的动作菜单是一个 `menu`，其中每个动作是一个 `menuitem`，激活方式与按钮相同。暂时无事可做的菜单项说明自己 `disabled` 并留在菜单里，这样菜单无论在哪里打开，读起来都一样。菜单里没有选中状态。

菜单通常是[层管理器](ui-layers.md)的一个弹出层，里面是一个托管列表，所以它是 `role: 'menu'` 的列表，在它的层打开之前保持[隐藏](#托管-ui-的盒与层)。打开它的按钮在菜单打开期间说明自己 `expanded`：

```js
const items = createUiListSemantics({ semantics, root: menu, list: 'actions', id: 'menu', role: 'menu', name: 'Actions', focusable: true,
  hidden: () => !layers.snapshot().openStack.includes('menu'),
  describeRow: key => ({ name: names[key], disabled: !can(key, member) }), onActivateRow: act });
semantics.add({ id: 'open', role: 'button', onActivate: open,
  describe: () => ({ name: 'Actions', bounds: buttonBounds, expanded: layers.snapshot().openStack.includes('menu') }) });
```

按键和其他地方一样由应用负责：方向键在各项之间移动焦点并首尾相接，回车或空格激活，Escape 通过层关闭菜单，层把焦点交还给原来的位置。[行菜单示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-context-menu)用鼠标右键、菜单键、Shift+F10 和一个按钮打开这样的菜单。子菜单和带勾选状态的菜单项不在本次范围内。

### 网格

`grid` 是按行和列排列、可以沿两个方向到达的内容：行囊的格子、棋盘、日历。它包含 `row` 节点，行包含 `gridcell` 节点。被选中的对象是单元格时（如这里），每个单元格说明自己是否 `selected`；被选中的对象是行时，由每一行来说明，单元格不提这件事：

```js
semantics.add({ id: 'bag', role: 'grid', describe: () => ({ name: 'Bag', bounds: bagBounds, extent: { rows: 4, columns: 6 } }) });
for (let row = 0; row < 4; row++) semantics.add({ id: 'bag/r' + row, role: 'row', parent: 'bag',
  describe: () => ({ bounds: rowBounds(row), position: { index: row + 1, size: 4 } }) });
for (let index = 0; index < 24; index++) semantics.add({ id: 'bag/' + index, role: 'gridcell', parent: 'bag/r' + Math.floor(index / 6),
  onActivate: () => moveTo(index),
  onFocus: () => { keyboard.focus('bag', { visible: true }); moveTo(index); },
  describe: () => ({ name: nameOf(index), bounds: cellBounds(index), selected: cursor === index, position: { index: index % 6 + 1, size: 6 },
    focused: keyboard.getSnapshot().focusedId === 'bag' && cursor === index }) });
```

`extent` 是网格总共有多少行和多少列。行的 `position` 说明它是第几行，单元格的 `position` 说明它在第几列，都从一开始计数。并非所有行都发布时读屏软件需要它们；全部发布时带上它们也没有代价。单元格有名称：空的单元格说明自己是空的。

网格是一个键盘停靠点，带有自己的光标，就像一排标签是一个停靠点并带有自己的选择。方向键沿两个方向移动光标，到边缘为止；Home 和 End 到行的两端，加上 Control 则到网格的两端。光标所在的单元格就是持有焦点的节点，所以被要求获得焦点的单元格得到光标，网格得到焦点。按键由应用负责，[行囊示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-inventory)绑定了这些按键。行的表头和跨多格的单元格不在本次范围内。

### 托管列表的表格

使用 `role: 'grid'` 时，[托管列表](#托管虚拟列表)的行就是网格的行。辅助对象发布带有 `extent` 的网格，并为每一个显示出来的行发布一个 `row`，带有它在所有行中的位置。行里的单元格由应用负责：它们在行被添加时添加，并随行一起移除。列表上方的表头行也由应用负责，作为同一个网格的一个 `row`：

```js
const rows = createUiListSemantics({
  semantics, root, list: 'members', id: 'roster', role: 'grid', name: 'Roster', columns: 4, rowOffset: 1, focusable: true,
  describeRow: key => ({ selected: key === selected }), onActivateRow: select,
  onRowAdded(key, id) {
    for (const [at, column] of columns.entries()) semantics.add({ id: id + '/' + column.key, role: 'gridcell', parent: id, describe: () => {
      const part = rows.rowBounds(key);
      return { name: column.text(key), bounds: { x: part.x + column.x, y: part.y, width: column.width, height: part.height }, position: { index: at + 1, size: 4 }, order: at };
    } });
  },
});
semantics.add({ id: 'roster/head', role: 'row', parent: 'roster', describe: () => ({ bounds: headBounds, position: { index: 1, size: count + 1 }, order: -1 }) });
for (const [at, column] of columns.entries()) semantics.add({ id: 'roster/head/' + column.key, role: 'columnheader', parent: 'roster/head',
  onActivate: () => sortBy(column.key), onFocus: () => keyboard.focus('head-' + column.key, { visible: true }),
  describe: () => ({ name: column.name, bounds: column.headBounds, sort: sorted.column === column.key ? sorted.way : 'none', position: { index: at + 1, size: 4 } }) });
```

- **`columns`** 是网格的列数，网格必须提供。**`rowOffset`** 是应用在列表第一行之上自行发布的行数，默认为 0：有一行表头时，第一条记录是网格的第二行，网格比列表的记录多一行。
- **`rows.rowBounds(key)`** 是某一行在舞台上被列表显示出来的那一部分，以最近一次 `sync()` 为准。单元格据此度量，所以被列表边缘截断的行，它的单元格也以同样的方式被截断。
- **`describeRow` 给出 `selected` 时，被选中的对象是行**：每一行都说明自己是否被选中；使用 `multiple: true` 时网格表明可以选中多行。不给出时，任何行都不提选中这件事。
- **表头**是行中的一个 `columnheader`。`sort` 说明各行是否按这一列排序：`'ascending'`、`'descending'`，或者 `'none'`（可以按这一列排序，但现在没有）。没有给出 `sort` 的表头不能用来排序。它的激活方式与按钮相同。

顺序改变时，用 `setSource` 把按新顺序排列的记录交给列表，然后说明列表应该停在哪里，例如 `setScrollOffset(0)`：数据源更换后，[列表会让它的锚点留在视野内](ui-data-panel.md)，除非另有指示。[表格示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-roster-table)用这种方式按四列对四十名成员排序。

### 消息

`status` 和 `alert` 是给没有在看绘制位置的人的消息：还剩多少、游戏已保存、某次修改为什么被拒绝。它的 `name` 就是消息。读屏软件在它已经知道的节点的文字发生变化时朗读消息，所以这个节点只添加一次并一直保持发布，没有内容可说时名称为空：

```js
semantics.add({ id: 'left', role: 'status', describe: () => ({ name: left + ' left', bounds: lineBounds }) });
semantics.add({ id: 'fault', role: 'alert', describe: () => ({ name: fault, bounds: faultBounds }) });
```

`status` 等读屏软件说完当前内容再朗读；`alert` 会打断它，所以只把不能等的内容放进 alert。再次发布相同的文字不算变化，不会再朗读一遍：消息所说的事情过去之后把它清空，下次出现时就会再次朗读。消息不接受任何动作，内部也不能有节点。[数值调节示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-stepper)在数值调节框旁边同时用到了这两种消息。

### 动作

`semantics.perform(id, 'activate')` 和 `perform(id, 'focus')` 调用节点最近一次发布时的 `onActivate` 和 `onFocus`。节点未发布、发布后已移除、被禁用、为 `inert`，或没有对应的处理函数时，返回 false 且不调用任何东西。一个 id 被移除后再次使用时，要等到再次发布才会被执行。

处理函数抛出的错误不会被捕获，由调用方处理。

### 监听与关闭

`observe(listener)` 在每次内容有变化的发布之后收到 `(snapshot, previous)`。监听器抛出错误不会撤销发布：其他监听器仍会被通知，然后 `publish` 抛出 `UI_SEMANTICS_LISTENER_FAILED`，以第一个失败为 `cause`。监听器可以为下一次发布添加和移除节点，但不能发布。

`dispose()` 放开全部节点并通知 `onClose` 监听器。此后 `add` 和 `publish` 抛出 `UI_SEMANTICS_CLOSED`，`perform` 返回 false。语义树不保存控件的状态，也不属于任何 Scope：请随它所描述的界面一起销毁。

`publish(layoutRevision)` 记录这些范围所属的布局版本，该值不能减小。

## 投射

```js
import { createBrowserSemantics } from '@egret/engine/web/semantics';

const projection = createBrowserSemantics({ semantics, canvas, width: 480, height: 300, label: '换装工作室' });
```

`width` 和 `height` 是范围所用的逻辑尺寸。投射在画布之后放置一个不可见的容器，覆盖在画布上方，每个已发布的节点对应其中一个元素，并跟随每一次发布。它只写入发生变化的内容。

- **键盘仍属于画布。**画布获得 `role="application"`、标签，以及指向容器的 `aria-owns`，于是这些节点被读作画布内部的内容。`focused` 的节点由 `aria-activedescendant` 指明。投射中的元素都不是 Tab 停靠点：原生按钮从创建时起就带有 `tabindex="-1"`，无论它能做什么；普通元素只有在可以应请求获得焦点时才带有它。应用原有的按键照常工作，过了最后一个停靠点，Tab 会离开画布。
- **元素。**`button`、`checkbox`、`switch`、`radio`、`option`、`tab`、`menuitem`、`gridcell` 和 `columnheader` 是带有相应角色的原生按钮，其余是带角色的普通元素，`text`、`status` 和 `alert` 则是它们的文字。状态写成对应的 ARIA 属性：`aria-checked`、`aria-selected`、`aria-expanded`、`aria-disabled`、`aria-modal`、`aria-multiline`、`aria-multiselectable`、`aria-valuenow` 及其上下限、`aria-orientation`、`aria-controls`、`aria-posinset` 和 `aria-setsize`，网格中还有 `aria-rowcount`、`aria-colcount`、`aria-rowindex`、`aria-colindex` 和 `aria-sort`。最外层的 `inert` 元素带有 `inert` 属性，页面会让它内部的一切对所有用户都不可达。
- **几何。**每个元素都覆盖在它所描述的控件上，读屏软件的高亮和触摸探索能在控件绘制的位置找到它。容器内部使用逻辑单位，由一个缩放映射到画布的矩形。它跟随窗口缩放、滚动和可视视口的变化；没有事件的布局变化之后可以调用 `projection.sync()` 重新测量。画布没有尺寸时，投射被隐藏。
- **指针穿透。**容器不接收指针，鼠标和手指仍然落在画布上。
- **请求。**以无障碍接口的方式对元素发出的点击执行 `activate`；请求聚焦某个元素执行 `focus`，随后页面焦点交还给画布。

处理函数抛出的错误会报告给 `onError`，投射继续工作。页面本身的失败会停止投射并被报告，失败所在的那次发布仍然有效。没有 `onError` 时，两者都作为未捕获错误报告给页面。`projection.dispose()` 移除容器和监听器，并把它设置的属性还给画布。语义树关闭时投射随之关闭。

应用可以事先在画布上设置 `role`、`aria-label` 或 `aria-owns`。投射保留前两者，并把自己的容器追加到第三者。

一个画布只能有一个投射，第二个以 `UI_SEMANTICS_SURFACE_BUSY` 被拒绝。画布不在页面中、没有尺寸，或处于变换或缩放之下时，以 `UI_SEMANTICS_SURFACE_INVALID` 被拒绝，条件与其他浏览器适配器相同。

### 文本框

`textbox` 节点描述未处于编辑状态的文本框：它的 `name` 和 `value`。`onActivate` 打开[原生编辑器](native-text-editing.md)。编辑器打开期间，它本身就是这个文本框的节点，因此在编辑器关闭之前请把 `textbox` 描述为 `hidden`，这样同一内容不会被朗读两次。

## 按键

投射不添加任何按键处理。按键仍通过[键盘输入](keyboard-focus-input.md)到达节点所调用的同一批方法：按钮、开关和复选框用空格或回车；单选组或列表框内用方向键、Home 和 End，焦点跟随选择。[`createControlKeys`](ui-controls.md#按键) 完成这些绑定，[示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-controls)使用了它。

## 实际运行的检查

| 检查 | 环境 | 结果 |
| --- | --- | --- |
| 语义树：25 项 | Node | 通过 |
| 投射对照测试自备的页面替身：17 项 | Node | 通过 |
| 两个入口的严格 TypeScript 使用方，含九种被拒绝的误用 | Node | 通过 |
| 示例页面：浏览器计算出的无障碍树、Tab 和方向键下的活动后代、每个元素与其控件重合、对元素发出的请求、手机配置 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，在控件的 7 个场景之外另有 4 个 |
| 托管列表的行、被隐藏的列表、可多选的列表框、作为菜单的列表、位于应用自有行之下并作为网格的列表、根的盒，以及作为对话框的层：真实 Engine、真实 UI 根和真实层管理器上的 19 项，另有严格 TypeScript 使用方和七种被拒绝的误用 | Node | 通过 |
| [列表示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-list-semantics)：浏览器为 50,000 行中的 8 行计算出的列表框、穿过被回收行时的活动后代、跳到第 40,000 行、从焦点处滚走、对选项发出的请求、缩放并滚动后的页面、手机配置 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |
| [标签页示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-tabs)：浏览器计算出的一排标签和唯一的面板、被选中标签到其面板的关系、进度条的数值、被选中标签上的活动后代，以及对标签提出的请求 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，5 个场景 |
| [多选示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-multi-select)：浏览器计算为可多选的列表框、逐个选中和取消的选项、被禁用的选项、用 Shift 选中的一段，以及对它们提出的请求 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |
| [下拉示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-dropdown)：只有弹出层打开时才出现在计算出的树中的列表框，活动后代从行移入职务列表再移回，对行和选项提出的请求，以及指明自己所滚动列表的滚动条 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，9 个场景 |
| [行菜单示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-context-menu)：只有打开时才出现在计算出的树中的菜单及其被禁用的菜单项、说明自己已展开的按钮、活动后代从行移入菜单项再移回，以及对按钮和菜单项提出的请求 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |
| [数值调节示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-stepper)：数值调节框及其数值和上下限、从一开始就是页面元素并在原处改变文字的 status 和 alert、落在某个数量上的活动后代，以及对旁边按钮提出的请求 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |
| [行囊示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-inventory)：四行六列的网格及其行列数和序号、唯一被选中的单元格、沿两个方向跟随光标的活动后代、在原处改变文字的 status，以及对单元格和按钮提出的请求 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |
| [表格示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-roster-table)：共四十一行、其中八行在页面中的网格，带有排序状态的表头，滚动时每一行在整张表中的序号，更换顺序后仍被选中的行，落在表头和行上的活动后代，以及对表头和行提出的请求 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |
| 同一示例加上层管理器的模态层：对话框及其按钮与卡片重合、浏览器计算出的树中不含它后面的列表、Tab 留在对话框内、按下卡片旁边不触达任何对象、Escape，以及焦点回到原来的行 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，2 个场景 |

未运行：读屏软件、语音控制、开关控制或任何其他辅助技术；真人操作；已安装的 Edge；Firefox；Safari；真实手机（触摸探索取决于平台的无障碍服务）；硬件 GPU 和 WebGPU。无障碍树通过检查，并不证明界面在读屏软件下可用；页面中文字发生变化的消息，也没有实际听到被朗读。

页面检查的运行方式：`node examples/ui-controls/verify.mjs <Playwright index.mjs 的绝对路径> <新的绝对输出目录> software`，`examples/ui-list-semantics/verify.mjs` 的用法相同。不带 `software` 时启动已安装的 Edge（有界面）。

向列表辅助对象的构建产物逐个写入了 100 个运算符错误，这些用例全部发现。

## 本次未包含

- 首批控件集合之外的角色：树和标题。滑动条、数值调节框、标签页、进度条、动作菜单、两种消息、单元格网格及其列表头已加入；网格的行表头和跨格单元格、菜单栏、子菜单、带勾选状态的菜单项，以及 `status` 和 `alert` 之外的实时区域没有加入。
- 描述文字、错误文字，以及用一个节点为另一个节点命名。
- 托管 UI 的叶子和层对应的节点由应用自己添加，用 [`semanticBoxOf`](#托管-ui-的盒与层) 度量。虚拟列表的行有[辅助对象](#托管虚拟列表)。
- 一次选中一段连续的行（例如 Shift 加方向键）由应用自行处理，多选示例给出了一种做法。
- 原生编辑器自身的投射。编辑器本身就是一个元素。
