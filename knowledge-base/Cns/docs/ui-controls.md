# 控件状态

[English](../../en/docs/ui-controls.md) | 简体中文

`@egret/engine/ui` 有七个控件，各自保存玩家操作的一样东西的状态：虚拟摇杆、按钮、悬停、开关、多选一、滚动位置，以及文本框。它们属于 M3.4，[#90](https://github.com/cnedwin/Egret_rebuild/issues/90)。

这些控件对看不见它们的人来说是什么，由[语义树](ui-semantics.md)描述，它读取的是同一份状态。

它们只拥有状态。控件不添加页面监听器，不绘制任何东西，也不决定路由：它在显示对象上监听[触点输入](multi-pointer-input.md)或[悬停输入](pointer-hover.md)的事件，并通过回调报告变化。每种状态怎么画由应用决定，按键也由应用绑定到指针所走的同一批方法上。

| 工厂 | 保存的状态 | 驱动方式 |
| --- | --- | --- |
| `createMovementControl` | 长度不超过 1 的方向 | 一个触点从按下处拖动 |
| `createActionControl` | 是否按下，以及激活次数 | 按下后松开 |
| `createHoverControl` | 是否悬停 | 鼠标或手写笔在目标或其后代上 |
| `createToggleControl` | 是否选中 | 一次激活使其翻转 |
| `createSelectionGroup` | 若干键中被选中的一个 | 激活某一项，或在各项之间移动 |
| `createScrollControl` | 视口某一轴的偏移 | 滚轮、拖动滚动条滑块，或直接调用 |
| `createTextFieldControl` | 文本框的文字，以及是否正在编辑 | 一次激活在它上方打开编辑器 |

每个控件都有 `enabled`、`setEnabled` 和 `dispose`。`dispose` 之后它的方法抛出 `UI_CONTROL_CLOSED`，订阅全部解除。不合法的选项以 `UI_CONTROL_OPTIONS` 拒绝。

## 移动与动作

```js
import { createActionControl, createMovementControl } from '@egret/engine/ui';

const stick = createMovementControl({ input, target: pad, radius: 40, onMovement: value => player.steer(value.x, value.y) });
const fire = createActionControl({ input, target: button, onActivate: () => player.fire(), onPressChange: pressed => paint(pressed) });
```

`input` 是触点输入，`target` 是控件接管其触点的显示对象。移动控件只接受一个触点，第二个触点会被拒绝，不会抢走第一个。它的 `value` 是从按下处算起的拖动量除以 `radius`，长度限制为 1，在 `deadZone`（默认为半径的十分之一）内为零。松开、取消、禁用和释放都会回到零。`setDirection(x, y)` 让按键或脚本设置同一个值。

动作控件在触点按下期间处于 `pressed`，触点在其路径上结束时激活。被取消的触点只松开，不激活。`press()` 和 `release()` 是脚本等价物：只有存在未松开的按下时，松开才会激活。禁用会清除按下状态而不激活。`activationCount` 记录激活次数。

## 悬停

```js
import { createHoverControl } from '@egret/engine/ui';

const over = createHoverControl({ hover, target: button, onHoverChange: hovered => paint(hovered) });
```

`hover` 是悬停输入。鼠标或手写笔在 `target` 或其任一后代上时，`hovered` 为 true。指针从一个后代移到另一个后代并没有离开控件，不会报告变化。有两个指针时，直到最后一个离开控件才不再悬停。

被禁用的控件不处于悬停。指针可能仍在它上面，重新启用时控件会发现它仍在那里。目标或某个后代在指针下方离开舞台时，控件仍会得知悬停结束：它除了监听目标上的事件，还跟随 `hover.observe`。

## 开关

```js
import { createToggleControl } from '@egret/engine/ui';

const sound = createToggleControl({ input, target: box, checked: true, onChange: checked => audio.setMuted(!checked) });
```

一次完整的按下会翻转 `checked` 并报告新值。`toggle()` 是来自按键或脚本的一次激活，控件被禁用时不起作用。`setChecked(value)` 不经激活直接设置值，禁用时也可以，只有值不同才报告变化。`pressed`、`press()` 和 `release()` 就是其内部动作控件的那几个。

## 多选一

```js
import { createSelectionGroup } from '@egret/engine/ui';

const level = createSelectionGroup({
  input,
  items: [{ key: 'easy', target: a }, { key: 'normal', target: b }, { key: 'hard', target: c, enabled: false }],
  selected: 'normal',
  onChange: (selected, previous) => apply(selected),
});
```

这是单选组、分段控件或单选列表框的状态。`items` 为 1 到 256 项，键互不相同，目标互不相同，顺序就是移动的顺序。没有 `selected` 时一开始什么都不选中；选过一次之后始终有一项被选中。

在某一项上完成一次按下会选中它。`select(key)` 按名称做同样的事，`next()`、`previous()`、`first()` 和 `last()` 在可用的项之间移动选择。它们都返回选择是否发生了变化。移动越过任一端时会绕回，除非 `wrap` 为 false。什么都没选中时，`next()` 从第一个可用项开始，`previous()` 从最后一个开始。

被禁用的项会被移动跳过，并拒绝按下和 `select`。禁用已选中的项后它仍保持选中，就像被禁用的已选单选按钮一样。对整个组调用 `setEnabled(false)` 会拒绝一切选择方式。未知的键以 `UI_CONTROL_UNKNOWN_ITEM` 拒绝。

## 滚动位置

```js
import { createScrollControl } from '@egret/engine/ui';

const scroll = createScrollControl({
  viewportLength: 140,
  contentLength: rows * rowHeight,
  wheel: { hover, target: viewport, lineLength: rowHeight },
  thumb: { input, target: thumbSprite, trackLength: 140 },
  onScroll: offset => { content.y = -offset; drawThumb(scroll.thumb); },
});
```

控件保存一个轴上的偏移，默认是 `'y'`，`axis` 为 `'x'` 时是横向。`offset` 的范围是零到 `maximum`，即放不下的那部分内容。`scrollTo`、`scrollBy`、`line`、`page`、`toStart` 和 `toEnd` 返回偏移是否发生变化，每次变化 `onScroll` 只被告知一次。布局或内容变化之后调用 `setLengths(viewportLength, contentLength)`，偏移会被限制到新的范围内。内容由应用移动，视口由应用裁剪。

给出 `wheel` 时，视口或其后代上的滚轮按该轴的增量滚动：像素增量原样使用，一行按 `lineLength`（默认 40），一页按视口长度。只有偏移确实移动了，控件才消费滚轮。到达任一端时它不碰滚轮，所以内层视口会把滚轮交给外层视口，最外层再按[滚轮策略](pointer-hover.md#滚轮)交给页面。带缩放修饰键的滚轮不算滚动。

给出 `thumb` 时，滑块上的一个触点沿长度为 `trackLength` 的轨道拖动它，偏移按比例跟随；第二个触点会被拒绝。`scroll.thumb` 给出滑块该画在哪里：轨道上的 `start` 和 `length`。长度是可见内容所占的比例，不短于 `minimumLength`（默认 16），也不超过轨道。`dragging` 和 `onDragChange` 报告拖动状态。取消、禁用、释放以及滑块离开舞台都会结束拖动。

用手指平移内容是一种手势，需要与视口内部的按下操作做仲裁，本控件不识别它。

## 文本框

```js
import { createTextFieldControl } from '@egret/engine/ui';
import { createBrowserTextInput } from '@egret/engine/web/text-input';

const editor = createBrowserTextInput({ canvas, logicalWidth: 480, logicalHeight: 300 });
const name = createTextFieldControl({
  input, target: nameBox, editor, value: sect.name, maxLength: 8, placeholder: '最多 8 个字', label: '名称',
  field: () => ({ x: 40, y: 78, width: 400, height: 40, fontFamily: 'sans-serif', fontSize: 20, color: 0xf3e9d2 }),
  onChange: value => { sect.name = value; redraw(); },
  onEditingChange: () => redraw(),
});
```

这个控件保存应用所绘文本框的文字，它自己不输入任何东西。在 `target` 上完成一次按下，或由按键、[辅助技术](ui-semantics.md)调用 `edit()`，控件就请 `editor` 在 `field()` 指明的位置上方显示一个输入框，此时控件处于 `editing`。[平台文字输入](text-input.md)原样就是这样一个编辑器，因此输入法、手机的屏幕键盘、粘贴和选择都由平台提供。玩家就是这样在自绘的文本框里输入中文的。

- **`field()`** 在每次开始编辑时被调用，返回文本框在舞台上的矩形，以及编辑器请求还接受的其他内容：字体、颜色、对齐。控件补上文字、`multiline`、`password`、`maxLength`、`placeholder` 和 `label`。
- **`value`** 是已提交的文字。输入框打开期间，`draft` 是目前已输入的内容，`composing` 表示输入法是否仍持有未确定的文字，`onInput` 报告这两者。提交编辑时草稿成为值；`onChange(value, previous)` 在 `onEditingChange(false)` 之后调用，并且只在文字确实变化时调用。
- **结束。**编辑由编辑器结束：单行按回车、点击别处、按 Esc。应用可以用 `commit()` 和 `cancel()` 结束它。取消的编辑不改变文字。禁用或销毁控件会取消正在进行的编辑。
- **一个编辑器，多个文本框。**编辑器一次只显示一个输入框。打开第二个文本框时，第一个按编辑器的方式结束，每个控件只听到自己那次会话。
- **`setValue(text)`** 不经编辑直接设置文字，并替换已打开输入框中的文字。`maxLength` 按码点计数，一个汉字或一个表情算一个；超出的部分被截掉。

**文本框处于 `editing` 时不要绘制它的文字。**平台输入框正在显示这些文字，两份文字不可能完全对齐。

应用自己的编辑器需要有 `open(request)`、`commit()`、`cancel()` 和 `setValue(text)`，并且每次会话恰好以请求中的一次 `onCommit(text)` 或 `onCancel()` 结束。控件不会等待一个始终不应答的编辑器：控件自己的 `commit()` 保留草稿，自己的 `cancel()` 丢弃草稿。被要求结束时抛出错误的编辑器，其文字不被采信。

## 按键

控件不监听键盘。[键盘输入](keyboard-focus-input.md)把按键交给获得焦点的显示对象，由应用调用控件：

| 控件 | 常用按键 | 调用 |
| --- | --- | --- |
| 动作 | 空格或回车 | 先 `press()` 再 `release()` |
| 开关 | 空格或回车 | `toggle()` |
| 多选一 | 方向键、Home、End | `next()`、`previous()`、`first()`、`last()` |
| 移动 | 方向键或 WASD | `setDirection(x, y)` |
| 滚动 | 方向键、Page Up、Page Down、Home、End | `line()`、`page()`、`toStart()`、`toEnd()` |
| 文本框 | 回车或空格，松开时 | `edit()` |

文本框在按键松开时打开，这样打开它的那个键不会被输入进去。打开期间按键属于平台输入框；编辑结束后，应用用 `keyboard.focus(id)` 把焦点交还给这个文本框。

示例为它的选项组注册了一个键盘停靠点，并把该停靠点移到被选中的项上，因此 Tab 进入和离开该组各一次。

## 绘制状态

控件报告状态，外观由应用选择。[主题](ui-theme-generations.md)为 `default`、`hover`、`pressed`、`disabled`、`focus`、`checked`、`selected` 和 `expanded` 提供皮肤名称。几种状态同时成立时用哪个名称，由应用决定。示例按玩家读取的顺序判断：不可用、按住、被指向、已设置。

## 已检查的内容

| 检查 | 范围 |
| --- | --- |
| [`tests/ui-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-controls.test.mjs) | 真实 Engine 上的移动与动作 |
| [`tests/ui-state-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-state-controls.test.mjs)，13 项 | 真实 Engine 上的悬停、开关和多选一，严格 TypeScript 消费者，以及导出 |
| [`tests/ui-scroll-control.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-scroll-control.test.mjs)，13 项 | 真实 Engine 上的滚动位置：范围、滚轮单位、嵌套视口、滑块及其拖动，以及严格 TypeScript 消费者 |
| [`examples/ui-controls/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/verify.mjs)，5 个场景 | 无头 Chromium 软件 WebGL2 的真实页面：鼠标、触摸和按键通过自动化协议注入。同一文件另有四个场景检查[语义投射](ui-semantics.md) |
| [`examples/pointer-hover/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/verify.mjs)，8 个场景 | 真实页面中的滚动控件：滚轮、交还给页面，以及拖动滑块 |
| [`tests/ui-text-field.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-text-field.test.mjs)，17 项 | 真实 Engine 上的文本框，使用测试自备的编辑器：会话、草稿、长度上限、共用编辑器、出错的编辑器和监听器、语义节点，以及以平台文字输入为编辑器的严格 TypeScript 使用方 |
| [`examples/ui-text-field/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-text-field/verify.mjs)，6 个场景 | 无头 Chromium 软件 WebGL2 真实页面中的两个文本框：通过浏览器协议驱动的输入法组字、键盘、一个文本框把编辑器交给另一个、无障碍树、禁用，以及手机配置 |

向悬停、开关和多选一的构建产物逐个写入了二十九个错误，单元测试全部发现。向滚动控件写入的三十二个错误中发现了三十个，其余两个不改变调用者能看到的任何行为。向文本框控件写入的 114 个运算符错误中发现了 112 个，其余两个只是省去一次循环的捷径，不改变任何结果。

## 尚未完成

- 没有人操作过示例。所有输入都是注入的。
- 这些控件没有在硬件 GPU、WebGPU、已安装的 Edge、Safari、Firefox 和真实手机上运行。
- [语义投射](ui-semantics.md)为这些控件提供角色、名称和状态，并对照无头 Chromium 的无障碍树做了检查。没有运行任何读屏软件或其他辅助技术。
- 手指不能平移滚动视口：这种手势及其与按下操作的仲裁仍在 #90。
- 文本框没有用真实输入法、真实屏幕键盘和系统剪贴板运行过：组字是通过 Chromium 的协议驱动的。
- 这个文本框不是托管 UI 的编辑器：托管行内的[原生编辑](native-text-editing.md)保持自己的契约。虚拟列表不是用这些控件构建的。
- 在虚拟列表被回收的行上做选择属于列表自身，不属于这个选项组。
