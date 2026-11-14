# 控件状态

[English](../../en/docs/ui-controls.md) | 简体中文

`@egret/engine/ui` 有八个控件，各自保存玩家操作的一样东西的状态：虚拟摇杆、按钮、悬停、开关、多选一、范围内的一个值、滚动位置，以及文本框。它们属于 M3.4，[#90](https://github.com/cnedwin/Egret_rebuild/issues/90)。

这些控件对看不见它们的人来说是什么，由[语义树](ui-semantics.md)描述，它读取的是同一份状态。

它们只拥有状态。控件不添加页面监听器，不绘制任何东西，也不决定路由：它在显示对象上监听[触点输入](multi-pointer-input.md)或[悬停输入](pointer-hover.md)的事件，并通过回调报告变化。每种状态怎么画由应用决定。`createControlKeys` 把控件的[常用按键](#按键)绑定到指针所到达的同一批方法上。

| 工厂 | 保存的状态 | 驱动方式 |
| --- | --- | --- |
| `createMovementControl` | 长度不超过 1 的方向 | 一个触点从按下处拖动 |
| `createActionControl` | 是否按下，以及激活次数 | 按下后松开 |
| `createHoverControl` | 是否悬停 | 鼠标或手写笔在目标或其后代上 |
| `createToggleControl` | 是否选中 | 一次激活使其翻转 |
| `createSelectionGroup` | 若干键中被选中的一个 | 激活某一项，或在各项之间移动 |
| `createRangeControl` | 范围内的一个值 | 按在轨道上、从那里拖动，或调用 |
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

### 托管列表的行

[托管列表](ui-data-panel.md)中一行的绑定会得到 `context.target`，即这一行的显示对象。控件在它上面监听，与在其他对象上一样：

```js
bind(context) {
  const pointed = createHoverControl({ hover, target: context.target, onHoverChange: repaint });
  const held = createActionControl({ input, target: context.target, onActivate: () => open(context.key), onPressChange: repaint });
  rows.set(context.key + ':' + context.bindingGeneration, { pointed, held });
  return { content, measuredHeight };
},
unbind({ key, bindingGeneration }) {
  const row = rows.get(key + ':' + bindingGeneration);
  row.held.dispose(); row.pointed.dispose(); rows.delete(key + ':' + bindingGeneration);
},
```

应在 `unbind` 中销毁这些控件。行是在根的一次提交中被回收的，它的悬停也在那时结束，所以负责重绘的回调应等到提交结束之后再执行，例如使用 `queueMicrotask`。列表滚动时静止不动的指针不会发出任何事件：提交之后调用 `hover.sync()`，来到指针下面的那一行就成为被指向的行。[下拉示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-dropdown/README.zh-CN.md)包含了以上全部做法。

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

这是单选组、分段控件、一排标签或单选列表框的状态。`items` 为 1 到 256 项，键互不相同，目标互不相同，顺序就是移动的顺序。没有 `selected` 时一开始什么都不选中；选过一次之后始终有一项被选中。

在某一项上完成一次按下会选中它。`select(key)` 按名称做同样的事，`next()`、`previous()`、`first()` 和 `last()` 在可用的项之间移动选择。它们都返回选择是否发生了变化。移动越过任一端时会绕回，除非 `wrap` 为 false。什么都没选中时，`next()` 从第一个可用项开始，`previous()` 从最后一个开始。

被禁用的项会被移动跳过，并拒绝按下和 `select`。禁用已选中的项后它仍保持选中，就像被禁用的已选单选按钮一样。对整个组调用 `setEnabled(false)` 会拒绝一切选择方式。未知的键以 `UI_CONTROL_UNKNOWN_ITEM` 拒绝。

**标签页**就是这个控件，再给每个键配一个面板：显示 `selected` 对应的面板，隐藏其余的。不可见的对象不接受按下也不接受焦点，所以不需要再做什么来让隐藏的面板保持安静。[标签页示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-tabs/README.zh-CN.md)就是这样做的，[语义树](ui-semantics.md#标签页与进度)有相应的角色。

## 范围内的一个值

```js
import { createControlKeys, createRangeControl } from '@egret/engine/ui';

const volume = createRangeControl({
  input, target: track, length: 120, min: 0, max: 100, step: 5, value: settings.volume,
  onChange: value => { settings.volume = value; redraw(); },
  onDragChange: () => redraw(),
});
keyboard.registerTarget({ id: 'volume', target: track });
createControlKeys({ keyboard, target: track, kind: 'range', control: volume, page: 4 });
```

这是滑动条：范围内的一个值，例如音量、比例或数量。`target` 是轨道。按在轨道上，值就移到按下的位置；同一个触点随后拖动它，离开轨道也继续，直到松开。拖动期间第二个触点被拒绝。应用根据 `value` 或 `fraction` 绘制轨道和滑块，`fraction` 是该值在范围中所占的份额，从 0 到 1。

- **轨道**按 `target` 自己的坐标读取，所以轨道被移动或缩放，或者位于被缩放的对象之内，都不需要额外处理。`length` 是轨道的长度，`start` 是它开始的位置，不写时为 0。`axis: 'y'` 是竖直的轨道，值向上增大。
- **取值。**范围从 `min` 到 `max`，不写时为 0 和 100。可取的值是 `min` 以及从它起每隔一个 `step` 的值，`step` 不写时为 1；远端始终是一个可取的值，即使整数步到不了那里。落在两个值之间的数取较近的一个，正好在中间时取较大的一个。
- **`setValue(n)`** 由应用设置值，控件被禁用时也可以设置，并把这个数归到范围内可取的值上。`stepBy(steps)`、`toMin()` 和 `toMax()` 供按键和脚本调用，控件被禁用时不起作用。它们都返回值是否改变，只有改变时才通知 `onChange(value, previous)`。
- **`dragging`** 从按下到松开期间为 true，并通过 `onDragChange` 报告，这样滑块可以画成被按住的样子。禁用或销毁控件会结束拖动。

它的按键与原生滑动条相同，列在[按键](#按键)一节。对看不到它的人来说，它是带有 `range` 的 [`slider`](ui-semantics.md)。

按步改变、没有轨道的数量不需要专门的控件。范围的按键接受任何带有 `enabled`、`stepBy`、`toMin` 和 `toMax` 的对象，所以应用把这些按键绑定到自己的数量上，在两侧各放一个给指针用的按钮，并把这个数量描述为 [`spinbutton`](ui-semantics.md)。[数值调节示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-stepper/README.zh-CN.md)用这种方式把一个固定的总数分给四个数量。

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

控件不监听键盘。[键盘输入](keyboard-focus-input.md)把按键交给获得焦点的显示对象，`createControlKeys` 在那里绑定一个控件的常用按键：

```js
import { createControlKeys } from '@egret/engine/ui';

keyboard.registerTarget({ id: 'apply', target: button });
const keys = createControlKeys({ keyboard, target: button, kind: 'action', control: apply, onPressChange: paint });
```

`keyboard` 是键盘输入。`target` 是获得焦点的显示对象，也可以是它上方的某个对象，因为按键沿显示树向上传递。`kind` 说明这是哪种控件，`control` 是该控件，或任何具有相同方法的对象。

| `kind` | 按键 | 行为 |
| --- | --- | --- |
| `'action'` | 空格、回车 | 松开时：先 `press()` 再 `release()`，一次激活 |
| `'toggle'` | 空格、回车 | 松开时：`toggle()` |
| `'textField'` | 空格、回车 | 松开时：`edit()` |
| `'selection'` | 方向键、Home、End | 按下时，按住期间重复：`next()`、`previous()`、`first()`、`last()` |
| `'range'` | 方向键、Page Up、Page Down、Home、End | 按下时，按住期间重复：`stepBy(1)` 或 `stepBy(-1)`、`stepBy(page)` 或 `stepBy(-page)`、`toMin()`、`toMax()` |
| `'scroll'` | 所在轴的方向键、Page Up、Page Down、Home、End | 按下时，按住期间重复：`line()`、`page()`、`toStart()`、`toEnd()` |
| `'movement'` | 方向键和 W A S D 键位 | 按住期间：按当前按住的键调用 `setDirection(x, y)` |

- **激活等到松开。**因此打开文本框的那个键不会被输入进去，按住时不断重复的键也只激活一次。键按住期间 `keys.pressed` 为 true，并且已通过 `onPressChange` 报告，所以按住的键可以和按下一样绘制：`control.pressed || keys.pressed`。按住期间失去焦点，或页面失去焦点，这次按住就此结束，不产生激活。同一时间只有一个键在激活。
- **多选一**可以用 `orientation: 'horizontal'` 或 `'vertical'`，把与它垂直的方向键留给外面。即使在不回绕的一端，它的键也会被接管，与原生选项组一样，因此页面不会在它下面滚动。
- **范围**用右方向键和上方向键增大，用左方向键和下方向键减小，每次一步。Page Up 和 Page Down 移动 `page` 步，不写时为十步。`orientation` 把与它垂直的方向键留给外面。即使在两端，它的键也会被接管，与原生滑动条一样，因此页面不会在它下面滚动。
- **滚动**只在按键确实移动了它时才接管该键。到头以后，按键继续交给外层视口或页面，与滚轮一致。
- **移动**把按住的键相加。相反的键互相抵消，斜向不会更快。`keys: 'arrows'` 或 `'wasd'` 只绑定其中一组。字母指的是键盘上的位置而不是字符，所以在任何键盘布局上都是同样的四个键。
- **下方已接管的键，上方不再处理。**更靠近焦点的显示对象已经接管的键会被绑定跳过，所以滚动视口里的按钮、视口里的视口都各自得到自己的键。
- **快捷键不属于控件。**与 Alt、Control 或平台键一起按下的键会被忽略。Shift 不算快捷键。
- 被禁用的控件不接管任何键。绑定接管的键会让 `keyboard.keyDown` 返回 `true`，页面据此不再处理该键。
- **被禁用的控件也不应该是停靠点。**绑定并不拥有停靠点，所以由应用来说明：保存 `keyboard.registerTarget` 的返回值，在控件被禁用时调用 `update({ disabled: true })`。持有焦点的停靠点此时会失去焦点，所以要先把焦点移走。禁用控件的可能正是一次按键，而停靠点不能在按键处理过程中修改：应在按键结束之后再做，例如放在微任务里。[数值调节示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-stepper/README.zh-CN.md)就是这样做的。

`dispose()` 结束当前的按住且不激活，停止按键正在操纵的移动，并不再监听。应先销毁绑定，再销毁它的控件。绑定不移动焦点：注册停靠点以及在它们之间移动属于[键盘输入](keyboard-focus-input.md)。

文本框打开期间按键属于平台输入框。编辑结束后，应用用 `keyboard.focus(id)` 把焦点交还给这个文本框。

**一个组是一个停靠点。**把各个选项放在同一个显示对象里，把这个对象注册为停靠点，并只在它上面绑定一次该组的按键。这样选择在组内移动时焦点一直留在组上：Tab 进入和离开该组各一次，按住方向键可以连续经过各个选项，焦点框由应用画在被选中的选项上。该选项的语义节点就是获得焦点的节点。示例都是这样做的。

## 绘制状态

控件报告状态，外观由应用选择。[主题](ui-theme-generations.md)为 `default`、`hover`、`pressed`、`disabled`、`focus`、`checked`、`selected` 和 `expanded` 提供皮肤名称，`selectUiSkin` 给出当前成立的状态所对应的名称：

```js
import { selectUiSkin } from '@egret/engine/ui';

const name = selectUiSkin(theme.skins.button, {
  disabled: !apply.enabled, pressed: apply.pressed || keys.pressed, hover: hovered.hovered, focus: ringed });
```

几种状态同时成立时，按玩家读取控件的顺序取第一个：不可用、按住、已设置（`checked`、`selected`、`expanded`）、获得焦点、被指向。皮肤没有为某个状态命名时，落到下一个成立的状态，最后落到 `default`。第三个参数可以给出另一种顺序，未列入其中的状态永远不会被选中。

皮肤为每个状态提供一个名称，而不是为每种组合提供一个。按住或被指向时仍需保持“已设置”外观的控件，应为它的已设置值使用单独的皮肤，就像示例里的开关那样：`skins.control` 和 `skins.controlOn` 按值选择，各自带有自己的 `hover`。焦点框通常画在皮肤旁边，而不是作为皮肤被选中。

## 已检查的内容

| 检查 | 范围 |
| --- | --- |
| [`tests/ui-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-controls.test.mjs) | 真实 Engine 上的移动与动作 |
| [`tests/ui-state-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-state-controls.test.mjs)，13 项 | 真实 Engine 上的悬停、开关和多选一，严格 TypeScript 消费者，以及导出 |
| [`tests/ui-row-target.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-row-target.test.mjs)，4 项 | 真实 Engine 和真实 UI 根上，在行绑定得到的显示对象上使用悬停控件和动作控件：滚走的行、重新绑定的行，以及严格 TypeScript 消费者 |
| [`tests/ui-scroll-control.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-scroll-control.test.mjs)，13 项 | 真实 Engine 上的滚动位置：范围、滚轮单位、嵌套视口、滑块及其拖动，以及严格 TypeScript 消费者 |
| [`examples/ui-controls/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/verify.mjs)，7 个场景 | 无头 Chromium 软件 WebGL2 的真实页面：鼠标、触摸和按键通过自动化协议注入，其中包括按住一个键、按住期间失去焦点，以及每种状态实际绘制出的颜色。同一文件另有四个场景检查[语义投射](ui-semantics.md) |
| [`examples/pointer-hover/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/pointer-hover/verify.mjs)，9 个场景 | 真实页面中的滚动控件：滚轮、交还给页面、拖动滑块，以及它的按键和按键交还给页面 |
| [`tests/ui-range-control.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-range-control.test.mjs)，11 项 | 真实 Engine 上的范围内的值：按下、拖动及其两端、第二个触点、内缩的、竖直的和被缩放的轨道、远端不在整数步上的范围的取值、步进、被禁用的控件、经键盘输入送达的按键、语义节点，以及严格 TypeScript 消费者 |
| [`tests/ui-control-keys.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-control-keys.test.mjs)，16 项 | 真实 Engine 上的按键绑定，使用键盘输入和六种控件：按住、重复、失去焦点、快捷键、嵌套目标、销毁、出错的监听器，以及严格 TypeScript 使用方 |
| [`tests/ui-skin-states.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-skin-states.test.mjs)，6 项 | 皮肤给出的名称：每个状态单独成立、每两个状态同时成立、缺失的名称、应用自己的顺序、被拒绝的参数，以及严格 TypeScript 使用方 |
| [`tests/ui-text-field.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-text-field.test.mjs)，17 项 | 真实 Engine 上的文本框，使用测试自备的编辑器：会话、草稿、长度上限、共用编辑器、出错的编辑器和监听器、语义节点，以及以平台文字输入为编辑器的严格 TypeScript 使用方 |
| [`examples/ui-text-field/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-text-field/verify.mjs)，6 个场景 | 无头 Chromium 软件 WebGL2 真实页面中的两个文本框：通过浏览器协议驱动的输入法组字、键盘、一个文本框把编辑器交给另一个、无障碍树、禁用，以及手机配置 |
| [`examples/ui-settings/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/verify.mjs)，9 个场景 | 把控件、按键、文本框、两套主题、托管列表、模态层和语义放在一起的[一个界面](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-settings/README.zh-CN.md)，在无头 Chromium 的软件 WebGL2 中：只用键盘、按下、输入法组字、主题在一帧内切换、模态卡片、辅助技术的请求，以及手机配置。其中一个场景针对滑动条：按下、拖过轨道两端、它的每个按键、按住的键、无障碍树得到的数值，以及手指拖动 |

向悬停、开关和多选一的构建产物逐个写入了二十九个错误，单元测试全部发现。向滚动控件写入的三十二个错误中发现了三十个，其余两个不改变调用者能看到的任何行为。向文本框控件写入的 114 个运算符错误中发现了 112 个，其余两个只是省去一次循环的捷径，不改变任何结果。向按键绑定写入的 100 个运算符错误全部被发现，向皮肤名称选择写入的 22 个也全部被发现。向范围控件写入的 95 个运算符错误中发现了 94 个，剩下的一个不改变任何结果，因为正好落在远端的一步无论如何都是远端。向范围按键写入的 15 个错误全部发现。

## 尚未完成

- 没有人操作过示例。所有输入都是注入的。
- 按键绑定是用无头 Chromium 在美式布局下的按键运行的。没有运行其他键盘布局、实体键盘、游戏手柄，也没有运行读屏软件自己的按键命令。
- 绑定按从左到右的阅读方向：右方向键是 `next()`，在滑动条上是增大。从右到左的选项组或滑动条由应用自行绑定。
- 滑动条在获得焦点后通过它的按键移动，读屏软件也是这样移动 ARIA 滑动条的。一些手机辅助技术会发送指定数值的请求，这种请求没有传递。
- 这些控件没有在硬件 GPU、WebGPU、已安装的 Edge、Safari、Firefox 和真实手机上运行。
- [语义投射](ui-semantics.md)为这些控件提供角色、名称和状态，并对照无头 Chromium 的无障碍树做了检查。没有运行任何读屏软件或其他辅助技术。
- 手指不能平移滚动视口：这种手势及其与按下操作的仲裁仍在 #90。
- 文本框没有用真实输入法、真实屏幕键盘和系统剪贴板运行过：组字是通过 Chromium 的协议驱动的。
- 这个文本框不是托管 UI 的编辑器：托管行内的[原生编辑](native-text-editing.md)保持自己的契约。虚拟列表不是用这些控件构建的。
- 在虚拟列表被回收的行上做选择属于列表自身，不属于这个选项组。
