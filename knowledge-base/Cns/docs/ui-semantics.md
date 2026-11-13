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
| `listbox` | 单选列表 | `disabled` | |
| `option` | 列表中的一项 | `selected`（必填）、`disabled`、`position` | `listbox` |
| `list` | 由行组成的列表 | | |
| `listitem` | 一行 | `position` | `list` |
| `scrollbar` | 视口的滚动位置 | `range`（必填）、`orientation`、`controls`、`disabled` | |
| `dialog` | 对话框 | `modal` | |
| `textbox` | 未处于编辑状态的文本框 | `value`、`multiline`、`disabled` | |

每个节点都有 `bounds`，还可以有 `name`、`hidden`、`focused` 和 `order`。除 `group`、`radiogroup`、`listbox`、`list` 和 `listitem` 外，名称必填。`image`、`text`、`button`、`checkbox`、`switch`、`radio`、`option`、`scrollbar` 和 `textbox` 被当作一个整体朗读，内部不能再有节点。

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
- **角色。**`'list'` 发布列表项，列表项内部可以有其他节点；`'listbox'` 发布选项，选项需要由 `describeRow` 提供名称。没有说明的选项视为未选中。
- **id。**列表节点的 id 是 `id`，默认是根的 id、一个斜杠和列表的 id。行在其后再加一个斜杠和自己的键，可用 `rows.rowId(key)` 得到。
- **焦点。**持有根焦点的行就是获得焦点的节点。设置 `focusable: true` 后可以请求某一行获得焦点，这需要根配有键盘。滚走的行同时失去根里的焦点和树里的节点，所以投射永远不会指向一个不存在的元素。
- **行内的节点。**某一行的节点添加之后会调用 `onRowAdded(key, id)`。在其中以 `parent: id` 添加的节点会随该行一起消失，该行再次被实例化时回调会再次被调用。
- **容量。**离开的行先被移除，然后才添加新的行，所以整页换成新行时不需要同时容纳新旧两批。如果树仍然拒绝某一行，`sync()` 抛出这次拒绝，并且不添加任何新行；留在树中的内容与这次提交相符。

`dispose()` 移除列表节点和所有行。这个辅助对象不添加监听器，除了某一行被请求获得的焦点之外，不改变根里的任何东西。应用自己的根只要具有 `SemanticListSource` 形状的 `id`、`snapshot()` 和 `list(id)`，也可以用同样的方式读取。

### 焦点

`focused: true` 标记持有应用键盘焦点的节点。只能有一个节点持有焦点，出现第二个时以 `UI_SEMANTICS_FOCUS` 拒绝。

### 模态对话框

发布了 `modal: true` 的对话框时，快照中对话框之外的每个节点都是 `inert`，对话框所在的各级父节点除外。`inert` 节点拒绝一切动作。同时发布多个模态对话框时，最后读取的那个在最前面。持有焦点的节点如果是 `inert` 会被拒绝，因为焦点应当在对话框内部。

### 关系

`scrollbar` 可以用 `controls` 指明它滚动的节点。被指明的节点必须在同一份快照中发布，否则发布以 `UI_SEMANTICS_RELATION` 被拒绝。

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

- **键盘仍属于画布。**画布获得 `role="application"`、标签，以及指向容器的 `aria-owns`，于是这些节点被读作画布内部的内容。`focused` 的节点由 `aria-activedescendant` 指明。投射中的元素都不是 Tab 停靠点，应用原有的按键照常工作。
- **元素。**`button`、`checkbox`、`switch`、`radio` 和 `option` 是带有相应角色的原生按钮，其余是带角色的普通元素，`text` 则是它的文字。状态写成对应的 ARIA 属性：`aria-checked`、`aria-selected`、`aria-expanded`、`aria-disabled`、`aria-modal`、`aria-multiline`、`aria-valuenow` 及其上下限、`aria-orientation`、`aria-controls`、`aria-posinset` 和 `aria-setsize`。最外层的 `inert` 元素带有 `inert` 属性，页面会让它内部的一切对所有用户都不可达。
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
| 语义树：19 项 | Node | 通过 |
| 投射对照测试自备的页面替身：13 项 | Node | 通过 |
| 两个入口的严格 TypeScript 使用方，含九种被拒绝的误用 | Node | 通过 |
| 示例页面：浏览器计算出的无障碍树、Tab 和方向键下的活动后代、每个元素与其控件重合、对元素发出的请求、手机配置 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，在控件的 6 个场景之外另有 4 个 |
| 托管列表的行：真实 Engine 和真实 UI 根上的 12 项，另有严格 TypeScript 使用方和六种被拒绝的误用 | Node | 通过 |
| [列表示例](https://github.com/cnedwin/Egret_rebuild/tree/main/examples/ui-list-semantics)：浏览器为 50,000 行中的 8 行计算出的列表框、穿过被回收行时的活动后代、跳到第 40,000 行、从焦点处滚走、对选项发出的请求、缩放并滚动后的页面、手机配置 | 无头 Chromium 153，软件 WebGL2，注入输入 | 通过，6 个场景 |

未运行：读屏软件、语音控制、开关控制或任何其他辅助技术；真人操作；已安装的 Edge；Firefox；Safari；真实手机（触摸探索取决于平台的无障碍服务）；硬件 GPU 和 WebGPU。无障碍树通过检查，并不证明界面在读屏软件下可用。

页面检查的运行方式：`node examples/ui-controls/verify.mjs <Playwright index.mjs 的绝对路径> <新的绝对输出目录> software`，`examples/ui-list-semantics/verify.mjs` 的用法相同。不带 `software` 时启动已安装的 Edge（有界面）。

向列表辅助对象的构建产物逐个写入了 61 个运算符错误，这些用例全部发现。

## 本次未包含

- 首批控件集合之外的角色：菜单、标签页、滑块、树、表格、标题和实时区域。
- 描述文字、错误文字，以及用一个节点为另一个节点命名。
- 与层管理器的接线，以及托管 UI 中虚拟列表之外的叶子节点。这些节点由应用添加和移除。虚拟列表的行有[辅助对象](#托管虚拟列表)。
- 可多选的列表，以及按网格排列的行。
- 原生编辑器自身的投射。编辑器本身就是一个元素。
