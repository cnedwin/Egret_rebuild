# 把舞台适配到屏幕

[English](../../en/docs/screen-fit.md) | 简体中文

游戏按一个尺寸设计，却要在各种形状的屏幕上玩：横拿或竖拿的手机、平板、宽屏显示器、微信小游戏。手机屏幕还有一部分被刘海、圆角或底部横条挡住。可选入口 `@egret/engine/web/screen` 的 `planScreen` 算出舞台在这样的屏幕上放在哪里；[`play`](play.md#任意形状的屏幕) 和 [`createBrowserGame`](browser-game.md) 在 `fit: 'expand'` 和 `'contain'` 时用它。

## 规则

1. **设计区域始终完整显示。** 缩放比取能完整放下设计区域的那个：`min(空间宽 / 设计宽, 空间高 / 设计高)`。
2. **`'contain'` 留黑边，`'expand'` 显示更多舞台。** `'contain'` 时舞台就是设计区域，居中，其余空间是黑边。`'expand'` 时缩放比相同，舞台取空间能容纳的整数个单位，且不小于设计区域。更宽的手机就在两侧多显示一些舞台，设计区域位于舞台中间。
3. **高的空间用竖版设计。** 空间高大于宽时，用 `portrait` 尺寸作为设计区域。两版设计短边相同时（1920 × 1080 和 1080 × 1920），无论怎么拿手机，设计里的东西在屏幕上一样大。
4. **安全区。** `insets` 给出刘海、圆角或底部横条从空间各边向内挡住多远。`safe` 是舞台减去被挡住的部分，单位是舞台单位。贴边的东西按它摆放。

## 用法

```js
import { planScreen } from '@egret/engine/web/screen';

const plan = planScreen({
  box: { width: 844, height: 390 },            // 空间，单位是 CSS 像素
  design: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  fit: 'expand',
  insets: { top: 0, right: 47, bottom: 21, left: 47 }
});
// plan.orientation 为 'landscape'，plan.width × plan.height 是舞台，plan.scale 是每单位多少 CSS 像素，
// plan.left 和 plan.top 是舞台左上角在空间里的位置，
// plan.designRect 是设计区域在舞台上的位置，plan.safe 是没被挡住的部分。
```

| 字段 | 含义 |
| --- | --- |
| `orientation` | 空间高大于宽时为 `'portrait'`，否则为 `'landscape'` |
| `design` | 当前使用的设计尺寸 |
| `width`、`height` | 舞台大小，整数单位：等于设计尺寸，`'expand'` 时可能更大 |
| `scale` | 每个舞台单位对应多少空间像素 |
| `left`、`top` | 舞台左上角在空间里的位置；留了黑边时大于 0 |
| `designRect` | 设计区域在舞台上的位置 |
| `safe` | 舞台上显示出来且没被挡住的部分 |

结果是冻结的。空间或 insets 变化时重新计算。空间无效、设计尺寸不是整数或 insets 小于 0 时，以 `UI_SCREEN_OPTIONS_INVALID` 拒绝。

## 在浏览器游戏里

`createBrowserGame({ fit: 'expand', portrait, insets })` 按它所在元素的大小和页面的 `safe-area-inset` 值计算舞台，元素尺寸变化时重新计算：

- `game.screen` 是当前的结果，`game.frame` 是按这个尺寸绘制的帧。
- `game.onScreenChange(listener)` 在舞台尺寸变化或安全区移动后，用新结果调用 `listener`，返回取消订阅的函数。
- 指针和悬停输入按舞台当前的尺寸把页面坐标换算到舞台。舞台尺寸会变时，两者各接收一个 `size` 函数，游戏会传进去。

只有视口 meta 标签写了 `viewport-fit=cover`，页面才会给出 `safe-area-inset` 值：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

页面或宿主更清楚安全区时，用 `insets` 直接给出。在微信小游戏里，`tools/wechat/export-wechat.mjs` 的适配器把微信的 `safeArea` 当作页面的 insets 报告，`'expand'` 铺满屏幕画布而不拉伸。

## 检查了什么

- `tests/ui-screen.test.mjs` 在 Node 里检查计算：`'contain'` 和 `'expand'`、更宽和更高的空间、竖版设计、在黑边以内和超出黑边的 insets，以及拒绝无效输入。
- `examples/play/verify.mjs` 在无头 Chromium 加软件 WebGL2 里检查一个游戏。这个游戏用 `'expand'`、竖版尺寸和 44 CSS 像素的刘海：
  - 960 × 540 时完整显示设计区域；
  - 1200 × 540 时两侧各多显示 80 个单位；
  - 540 × 960 时换成竖版尺寸；
  - 在页面上点击，能点中 `arrange` 摆在安全区里的按钮。
- `tests/wechat-minigame.test.mjs` 检查适配器把微信的安全区作为页面的 insets 报告。

没有在带刘海的手机、Safari 或微信本身上运行过。这些运行中页面自己的 insets 始终为 0，刘海是用 `insets` 给出的。

## 设计说明

游戏 UI 框架通常这样应对不同形状的屏幕。比如 LumioGames 的 LGUI 用短边相同的两版设计，加一个由框架移动的安全区节点；这里把它作为参考研究过，没有用它的任何代码。这里的规则作用在舞台上，而不是作用在有名字的组件上；游戏在自己的代码里按 `safe` 摆放贴边的东西。
