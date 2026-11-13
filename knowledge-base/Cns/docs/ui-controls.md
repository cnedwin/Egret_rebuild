# 控件状态

[English](../../en/docs/ui-controls.md) | 简体中文

`@egret/engine/ui` 有五个控件，各自保存玩家操作的一样东西的状态：虚拟摇杆、按钮、悬停、开关，以及多选一。它们属于 M3.4，[#90](https://github.com/cnedwin/Egret_rebuild/issues/90)。

它们只拥有状态。控件不添加页面监听器，不绘制任何东西，也不决定路由：它在显示对象上监听[触点输入](multi-pointer-input.md)或[悬停输入](pointer-hover.md)的事件，并通过回调报告变化。每种状态怎么画由应用决定，按键也由应用绑定到指针所走的同一批方法上。

| 工厂 | 保存的状态 | 驱动方式 |
| --- | --- | --- |
| `createMovementControl` | 长度不超过 1 的方向 | 一个触点从按下处拖动 |
| `createActionControl` | 是否按下，以及激活次数 | 按下后松开 |
| `createHoverControl` | 是否悬停 | 鼠标或手写笔在目标或其后代上 |
| `createToggleControl` | 是否选中 | 一次激活使其翻转 |
| `createSelectionGroup` | 若干键中被选中的一个 | 激活某一项，或在各项之间移动 |

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

## 按键

控件不监听键盘。[键盘输入](keyboard-focus-input.md)把按键交给获得焦点的显示对象，由应用调用控件：

| 控件 | 常用按键 | 调用 |
| --- | --- | --- |
| 动作 | 空格或回车 | 先 `press()` 再 `release()` |
| 开关 | 空格或回车 | `toggle()` |
| 多选一 | 方向键、Home、End | `next()`、`previous()`、`first()`、`last()` |
| 移动 | 方向键或 WASD | `setDirection(x, y)` |

示例为它的选项组注册了一个键盘停靠点，并把该停靠点移到被选中的项上，因此 Tab 进入和离开该组各一次。

## 绘制状态

控件报告状态，外观由应用选择。[主题](ui-theme-generations.md)为 `default`、`hover`、`pressed`、`disabled`、`focus`、`checked`、`selected` 和 `expanded` 提供皮肤名称。几种状态同时成立时用哪个名称，由应用决定。示例按玩家读取的顺序判断：不可用、按住、被指向、已设置。

## 已检查的内容

| 检查 | 范围 |
| --- | --- |
| [`tests/ui-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-controls.test.mjs) | 真实 Engine 上的移动与动作 |
| [`tests/ui-state-controls.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/ui-state-controls.test.mjs)，13 项 | 真实 Engine 上的悬停、开关和多选一，严格 TypeScript 消费者，以及导出 |
| [`examples/ui-controls/verify.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/ui-controls/verify.mjs)，5 个场景 | 无头 Chromium 软件 WebGL2 的真实页面：鼠标、触摸和按键通过自动化协议注入 |

向悬停、开关和多选一的构建产物逐个写入了二十九个错误，单元测试全部发现。

## 尚未完成

- 没有人操作过示例。所有输入都是注入的。
- 这些控件没有在硬件 GPU、WebGPU、已安装的 Edge、Safari、Firefox 和真实手机上运行。
- 不向辅助技术通报任何内容。面向读屏器的角色、名称和状态仍在 #90。
- 滚动视口、拖动滚动条、文本框和虚拟列表不是用这些控件构建的。
- 在虚拟列表被回收的行上做选择属于列表自身，不属于这个选项组。
