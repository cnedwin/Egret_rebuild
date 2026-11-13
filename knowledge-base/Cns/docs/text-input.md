# 画布上的文字输入

[English](../../en/docs/text-input.md) | 简体中文

`@egret/engine/web/text-input` 让玩家在画布绘制的游戏里输入文字：中文、日文、韩文，以及平台能输入的任何文字。它不依赖 2D 显示内容，也不依赖 World3D 场景，所以两者之上都能用。

## 为什么只有按键事件不够

`@egret/engine/web/keyboard` 报告的是按键。输入法并不是一个键出一个字：玩家敲拼音，平台在自己的窗口里列出候选，选中的字作为一整段文字到达。输入法占用按键期间，键盘入口不处理这些键，所以游戏无法靠它拼出中文。

编辑期间，本入口把一个平台文本框（`<input>` 或 `<textarea>`）精确地盖在舞台的一个矩形上。输入法、手机的屏幕键盘、粘贴、选区和撤销因此都由平台自己提供。玩家输入完毕后文本框被移除，游戏拿到文字，自己绘制。

## 用法

```js
import { createBrowserTextInput } from '@egret/engine/web/text-input';

const input = createBrowserTextInput({ canvas, logicalWidth: 480, logicalHeight: 300 });

// 在名称框的按下事件处理函数里：
input.open({
  x: 40, y: 94, width: 400, height: 40,      // 输入框的位置，舞台单位
  value: sect.name, maxLength: 8, placeholder: '最多 8 个字',
  fontFamily: 'sans-serif', fontSize: 20, color: 0xf3e9d2,
  onCommit(value) { sect.name = value; redraw(); },
  onCancel() { redraw(); },
});
```

创建输入对象不会向页面添加任何东西。文本框只在 `open` 到会话结束之间存在；一个输入对象同一时间只显示一个文本框，打开另一个会取消正在打开的那个。

[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-input/README.zh-CN.md)绘制了一个面板，含一个单行输入框和一个多行输入框。

## 请求

所有长度都用舞台逻辑单位，与显示树和指针位置的单位相同。所有颜色都是 `0xRRGGBB`。

| 字段 | 含义 | 默认值 |
| --- | --- | --- |
| `x`、`y`、`width`、`height` | 文本框覆盖的矩形 | 必填 |
| `value` | 文本框的初始文字 | 空 |
| `multiline` | 多行（`<textarea>`） | `false` |
| `password` | 隐藏字符；仅限单行 | `false` |
| `maxLength` | 最多字符数，按码点计：一个汉字或一个表情算一个 | 不限 |
| `placeholder`、`placeholderColor` | 文本框为空时显示的提示 | 无；平台颜色 |
| `label` | 无障碍名称 | 无 |
| `locale` | 语言标签，例如 `zh-CN` | 无 |
| `inputMode` | 屏幕键盘的种类：`text`、`numeric`、`decimal`、`tel`、`email`、`url`、`search`、`none` | 由平台决定 |
| `enterKeyHint` | 屏幕键盘回车键上的文字 | 由平台决定 |
| `fontFamily`、`fontSize`、`fontWeight`、`lineHeight` | 文本框的文字 | `sans-serif`、16、normal、由平台决定 |
| `color`、`backgroundColor` | 文字颜色；背景 | 黑色；透明 |
| `textAlign`、`padding` | `left`、`center` 或 `right`；矩形内的留白 | `left`；0 |
| `select` | `all` 选中初始文字，`end` 把光标放在其后 | `end` |
| `blur` | `commit` 或 `cancel`：失去焦点时怎么处理 | `commit` |
| `onChange`、`onCommit`、`onCancel` | 见下文 | 无 |

不指定背景时背景是透明的，游戏自己画的输入框会透出来。**编辑期间游戏不应再绘制这个输入框的文字**：平台文本框已经在显示它，两份文字不可能完全对齐。

## 什么会结束一次会话

| 事件 | 单行 | 多行 |
| --- | --- | --- |
| 回车 | 提交 | 插入换行 |
| Ctrl+回车 或 Command+回车 | 提交 | 提交 |
| Esc | 取消 | 取消 |
| 在文本框以外按下 | 按 `blur` | 按 `blur` |
| 焦点移到别的元素，或用屏幕键盘的“完成”键收起键盘 | 按 `blur` | 按 `blur` |
| `commit()`、`cancel()` | 如其名 | 如其名 |
| `open()` 另一个文本框、`dispose()` | 取消 | 取消 |

- **`onCommit(value)` 和 `onCancel()` 在文本框移除之后调用**，所以两者都可以直接打开下一个文本框。
- **被输入法占用的按键不会结束任何会话。** 选定候选的回车、关闭候选窗口的 Esc 都属于输入法。
- **打开文本框的那一次按下不会把它关掉。** `open` 可以在 `pointerdown`、`pointerup` 或 `click` 里调用。
- **窗口失去焦点时会话保留。** 窗口回来后，文本框重新获得焦点。

## 变化与输入法组字

文字变化时调用 `onChange({ value, composing })`。输入法还持有未确定的文字时 `composing` 为 `true`，例如选定“你好”之前的 `nihao`；此时 `value` 包含这段未确定的文字。需要校验或过滤的游戏应等到 `composing: false`。

`maxLength` 在组字结束时生效，组字期间从不生效，因为拼音比它变成的字要长。超出上限的部分从刚输入的内容里、在光标处去掉；框里原有的文字保留。

## 游戏的按键

- **输入到文本框里的按键不会冒泡出去。** 监听 document 或 window 的快捷键在玩家打字时不会触发。传 `isolateKeys: false` 可让它们冒泡。使用捕获阶段的监听器无论如何都能看到这些按键。
- `createBrowserKeyboardInput` 只在画布拥有焦点时处理按键，所以文本框打开期间它不会有任何动作。
- **会话结束后焦点回到画布**，前提是画布能接收焦点（带有 `tabindex`，`createBrowserKeyboardInput` 会设置它）。如果是回车或 Esc 结束了会话，焦点在该键松开时才回到画布，这个键的重复和松开不会送到游戏。
- 文本框显示期间，`getSnapshot().state` 为 `'open'`。

## 位置

文本框保持自己的逻辑尺寸，随画布一起缩放，所以无论画布多大，它的文字相对于画面都一样大。

- 矩形通过画布的包围盒映射，与指针输入映射位置的方式相同。画布不能有边框或内边距，并且必须显示整幅画面（`object-fit: fill`，即默认值）。
- 窗口、可视视口或画布尺寸变化时，以及任何内容滚动时，文本框会重新定位。输入框在舞台上移动时调用 `move(rectangle)`；舞台逻辑尺寸变化时调用 `resize(logicalWidth, logicalHeight)`；发生页面无法观察到的变化（例如给祖先元素设置了 CSS transform）之后调用 `sync()`。
- 文本框添加到画布的父元素里，或添加到 `options.parent`。**全屏时请对包含画布的容器请求全屏，不要对画布本身请求**：全屏的画布之外什么都不显示。
- 祖先元素用 CSS transform 平移或缩放画布是允许的。**旋转画布不受支持**：文本框按包围盒定位。

## 手机

- **在按下事件的处理函数里调用 `open`。** 平台只为紧跟触摸的聚焦显示屏幕键盘。
- **`fontSize` 至少用 16。** 文字更小的文本框获得焦点时，iOS 会放大页面。
- 屏幕键盘可能遮住文本框。浏览器会滚动或移动页面来露出获得焦点的文本框；这时文本框跟随画布。

## 错误

参数无效时抛出 `EgretError`，不改变任何状态。

| 代码 | 何时 |
| --- | --- |
| `BROWSER_TEXT_INPUT_OPTIONS` | `createBrowserTextInput` 的某个选项无效 |
| `BROWSER_TEXT_INPUT_SURFACE` | 没有页面、不是本页面的画布，或打开文本框时画布或其父元素不在页面中 |
| `BROWSER_TEXT_INPUT_REQUEST` | 请求的某个字段无效 |
| `BROWSER_TEXT_INPUT_IDLE` | 没有打开的文本框时调用 `setValue` 或 `move` |
| `BROWSER_TEXT_INPUT_VALUE`、`_RECTANGLE`、`_SIZE` | `setValue`、`move`、`resize` 的参数无效 |
| `BROWSER_TEXT_INPUT_REENTRANT` | `open` 替换了一个文本框，而它的 `onCancel` 又打开了另一个 |
| `BROWSER_TEXT_INPUT_DISPOSED` | `dispose` 之后调用 `getSnapshot` 和 `dispose` 以外的任何方法 |

`onChange`、`onCommit` 或 `onCancel` 抛出的错误交给 `options.onError`；没有提供时交给页面的错误报告。会话照常结束。

## 与托管 UI 原生文本编辑的关系

[原生文本编辑](native-text-editing.md)（`@egret/engine/web/editing`）在原位编辑托管 UI 的文本节点，使用引擎的段落排版、光标和字体集。它需要 UI 根和已准入的字体。本入口只需要一块画布和一个矩形：适合自己绘制界面的游戏，无论 2D 还是 3D，用来向玩家要一个名字、一句聊天或一段备注。

## 已检查的内容

- `tests/browser-text-input.test.mjs`：十三个用例，针对页面的替身运行。它们说明向页面添加了什么、何时添加，文本框放在哪里，哪些事件结束会话，以及长度上限、焦点、按键隔离、错误和释放，并确认严格模式的 TypeScript 使用方可以编译。
- `examples/text-input/verify.mjs`：在无头 Chromium 里运行示例，分别用鼠标和模拟的手机。组字过程通过浏览器自己的协议驱动：先是未确定的拼音，然后是选定的字。

**未检查：实体输入法、真实手机、Safari 和 Firefox。** 组字规则依据这些浏览器公开说明的平台事件；代码里考虑到的几种特殊情况（组字结束之后才送达的回车、玩家触摸别处时仍保有焦点的文本框、只以换行形式送达的回车）依据它们公开说明的行为写成，没有在这里观察到。
