# 界面栈

[English](../../en/docs/ui-screen-stack.md) | 简体中文

有多个界面的游戏每次都需要同样的规则。商店在地图上面打开，地图在后面等着。对话框提出一个问题，把答案交给提问的一方。返回键关闭前面的界面，但不关游戏开始时的那个界面。两个对话框不会叠在一起出现。`@egret/engine/ui` 的 `createUiScreenStack` 负责这些规则。它不画任何东西：每个界面由它的定义创建，栈通过界面的句柄告诉它什么时候显示、被盖住、露出、到最前面或关闭。

## 层

| 层 | 是什么 | 会不会盖住下面的界面 |
| --- | --- | --- |
| `page` | 一个完整的界面：地图、商店、背包。页面组成一个栈 | `fullScreen`（默认）的页面会盖住它下面的页面 |
| `popup` | 页面上方的面板：菜单、选择器、道具详情 | 从不 |
| `modal` | 必须回答的问题：一次只显示一个，其余的排队 | 从不 |

最前面的界面（`active`）是正在显示的 modal，或者最上面的 popup，或者最上面的页面。只有它应该接收输入。

## 用法

```js
import { createUiScreenStack } from '@egret/engine/ui';

const screens = createUiScreenStack();
const Shop = {
  id: 'shop',
  layer: 'page',
  open(context) {
    const panel = drawShop(context.params.tab);       // 游戏自己画的
    return {
      show: () => (panel.visible = true),
      cover: () => (panel.visible = false),          // 一个全屏页面盖在了它上面
      reveal: () => (panel.visible = true),
      close: () => panel.dispose()
    };
  }
};
const Confirm = {
  id: 'confirm',
  layer: 'modal',
  open(context) {
    const card = drawQuestion(context.params.text, answer => context.close(answer));
    return { close: () => card.dispose() };
  }
};

void screens.open(Shop, { tab: 'gear' });
if (await screens.open(Confirm, { text: '卖掉这把剑？' })) sell();
```

- `open(screen, params)` 在之前要求的操作都完成后打开一个界面。界面关闭时 Promise 兑现：值是传给 `context.close(result)` 或 `close(screen, result)` 的内容；如果是返回键、`popTo`、`replace` 或 `closeAll` 关掉的，值是 undefined。不需要等结果的页面可以不写 `await`。
- 打开一个已经打开或正在创建的界面时，参数相同就得到同一个 Promise，所以连点两下只会打开一份奖励。参数不同就以 `UI_SCREENS_ALREADY_OPEN` 拒绝：这样的界面由游戏自己排队，一个接一个打开。
- `back()` 做返回键做的事：按最前面界面的 `back` 处理，可以是 `'close'`（默认）、`'none'`，或一个要调用的函数。栈里只剩一个页面时，它不会关掉这个页面。结果表示是否做了什么。把 Escape 和安卓返回键绑到它上面。
- `replace(page, params)` 关闭最上面的页面，并在原处打开另一个。`popTo(screen)` 关闭某个界面上面的所有界面。`closeAll(layer?)` 关闭一层，或关闭全部，包括排队中的 modal。
- 界面关闭时 `context.signal` 会被中止：把它交给界面发起的请求。`context.covered` 和 `context.active` 表示界面当前的状态。
- `snapshot()` 给出以下各项的 id：页面、popup、正在显示的 modal、排队的 modal、最前面的界面和被盖住的页面。`onChange(listener)` 在每次变化后收到通知。

## 调用顺序

打开时依次调用：`open`、`show`、被它盖住的页面的 `cover`、原来在最前面的界面的 `deactivate`、新界面的 `activate`。关闭时，如果它在最前面先调用 `deactivate`，然后是 `hide`、`close`，再对关闭后最前面的界面调用 `reveal` 和 `activate`。之后打开下一个排队的 modal。一次调用关闭多个界面时（如 `popTo` 和 `closeAll`），从最上面开始关，全部关完后栈才移动一次最前面的界面。

`open` 抛错或被拒绝的界面不会保留，它的 Promise 以抛出的内容拒绝。句柄的调用抛错不会让栈停下：这次变化照样完成，第一个错误让发起这次变化的调用被拒绝，之后的错误交给 `onError`，没有的话报给页面。

## 上限与拒绝

一个栈最多容纳 32 个打开或排队的界面，可以用 `maxScreens` 改成别的数（最多 256）。定义缺少 id（由字母、数字、`.`、`-` 和 `_` 组成）、层或 `open` 函数时，以 `UI_SCREENS_DEFINITION_INVALID` 拒绝。栈满了以 `UI_SCREENS_FULL` 拒绝，栈已销毁以 `UI_SCREENS_CLOSED` 拒绝。

## 检查了什么

`tests/ui-screen-stack.test.mjs` 在 Node 里检查这个栈：

- 页面被盖住和露出，以及只剩第一个页面时按返回键；
- 关闭时交回结果，以及 signal 被中止；
- modal 排队，以及排队的 modal 没创建就被关掉；
- 参数相同时得到同一个 Promise，参数不同时被拒绝；
- 各种 `back` 设置、`popTo`、`replace` 和 `closeAll`；
- 创建失败的界面，以及抛错的句柄；
- 调用之间互相等待，以及正在创建时就被关闭的界面；
- 各种拒绝。

栈不画任何东西，所以画面和输入要在基于它的界面上检查。

## 设计说明

LumioGames 的 LGUI 有五层、一个栈和一个 modal 队列，关闭时交回结果，重复打开同一个界面时检查参数是否相同。这里的规则参照了它的设计，把它作为参考研究过，没有用它的任何代码。这里的栈与绘制和任何界面格式都分开，所以 `play` 游戏、托管的 UI root 或用数据描述的界面都能使用它。
