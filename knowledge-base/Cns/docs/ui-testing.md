# 按界面上的名字测试 UI

[English](../../en/docs/ui-testing.md) | 简体中文

按坐标点击的检查，按钮一挪位置就失效；失败时也只能说某个像素颜色不对。可选入口 `@egret/engine/ui/testing` 的 `createUiTester` 按名字找到控件，并通过[语义树](ui-semantics.md)驱动它。它用的操作和点击、按键、辅助技术触发的是同一套。这样写的检查在 Node 里运行，不需要浏览器。失败时它会说明界面上实际有什么。

## 用法

```js
import { createUiTester } from '@egret/engine/ui/testing';

let now = 0; // 引擎时钟接收的是时间源的时刻，这里每步最多十分之一秒
const advance = seconds => { for (const end = now + seconds; now < end; ) engine.advanceTime((now = Math.min(end, now + 0.1))); };
const t = createUiTester({ semantics, update: () => frame(), advance, screens });
t.press('Shop / Buy');                 // 名为 Shop 的组里的 Buy 按钮
assert.equal(t.text('text:Gold 40'), 'Gold 40');
assert.equal(t.state('Sound').checked, false);
await t.wait(2);                       // 游戏走两秒
assert.equal(t.screen, 'map');         // 界面栈最前面的界面
```

| 调用 | 作用 |
| --- | --- |
| `find(query)` | 查询指向的那一个节点，即语义树发布的节点 |
| `findAll(query)`、`exists(query)` | 查询指向的所有节点；是否恰好指向一个 |
| `press(query)`、`focus(query)` | 执行 `activate` 或 `focus` |
| `text(query)` | 节点的名字：文字的内容，按钮的标签 |
| `state(query)` | 它的角色、名字、`disabled`、`focused`、`checked`、`selected`、`expanded`、`value`，以及范围控件的 `now` |
| `wait(seconds)` | 调用 `advance`，然后更新语义树 |
| `screen`、`back()` | [界面栈](ui-screen-stack.md)最前面界面的 id，以及它的返回键 |
| `outline()` | 界面上有什么，每行一个节点，按包含关系缩进 |

`update` 在每次读取前更新语义树。游戏是在自己的帧里提交 UI 并发布语义树的，就传入它；不传时调用 `semantics.publish()`。

## 查询

- `'Buy'`：名为 Buy 的节点。
- `'button:Buy'`：名为 Buy 的按钮。只写角色，如 `'dialog'`，指该角色的所有节点。
- `'Shop / Buy'`：在名为 Shop 的东西里面的 Buy。前面的名字从外到内读，不必是直接父节点。
- `'Buy#1'`：按阅读顺序的第二个 Buy，从 0 开始数。

## 失败

查询找不到任何节点时抛出 `UI_TESTER_NOT_FOUND`，找到多个时抛出 `UI_TESTER_AMBIGUOUS`。按下的控件不可用、被模态对话框挡住或没有这个操作时，抛出 `UI_TESTER_REFUSED`。每条消息的末尾附上界面的大纲：

```text
UI_TESTER_NOT_FOUND: Nothing on the screen has that name. … Inventory is not on the screen. It holds:
group "Shop"
  text "Gold 100"
  switch "Sound" [checked]
  group "Sword"
    button "Buy"
```

按下控件调用的函数和点击时一样，但不经过中间的绘制：画错了位置或被挡住的按钮照样能通过。画面要在浏览器里检查，就像每个示例的 `verify.mjs` 那样。测试器不输入文字。文本框通过平台自己的输入法编辑，见[文本输入](text-input.md)。

## 检查了什么

`tests/ui-tester.test.mjs` 手工搭了一个商店：一个组、一段文字、一个开关、一个滑动条、两行 Buy 按钮和一个模态对话框。它检查：

- 按名字、角色、路径和序号查找；
- 按下后调用到商店的函数；
- 每次变化后读到的状态；
- 对不可用的控件、被对话框挡住的控件和缺少的操作的拒绝；
- 失败消息里的大纲；
- 用游戏自己的时钟 `wait`；
- 界面栈的最前面界面和返回键。

## 设计说明

LumioGames 的 LGUI 在 Node 里按控件路径（如 `Bag/BagPanel.list[0]`）测试界面，并配有假时钟。这里改为通过语义树查找控件，语义树本来就是应用为辅助技术发布的。这样测试和读屏软件用到的是同样的名字、同样的操作。这里把它的设计作为参考研究过，没有用它的任何代码。

## 11 月 27 日真机补验

11 月 27 日实测：命名 UI 测试器及屏幕栈 12 个 Node 用例通过，Windows 和 Fold7 验收选定的命名视图语义与操作。完整旧视图辅助测试的失败及焦点状态诊断记录见下方。 [真机观测及剩余范围](november-27-claude-hardware.md).
