# 把舞台适配到屏幕

[English](../../en/docs/screen-fit.md) | 简体中文

游戏按一个尺寸设计，却要在各种形状的屏幕上玩：横拿或竖拿的手机、平板、宽屏显示器、微信小游戏。手机屏幕还有一部分被刘海、圆角或底部横条挡住。可选入口 `@egret/engine/web/screen` 的 `planScreen` 算出舞台在这样的屏幕上放在哪里；[`play`](play.md#任意形状的屏幕) 和 [`createBrowserGame`](browser-game.md) 在 `fit: 'expand'`、`'contain'` 和白鹭 5 的舞台缩放模式下用它。

## 规则

1. **设计区域始终完整显示。** 缩放比取能完整放下设计区域的那个：`min(空间宽 / 设计宽, 空间高 / 设计高)`。
2. **`'contain'` 留黑边，`'expand'` 显示更多舞台。** `'contain'` 时舞台就是设计区域，居中，其余空间是黑边。`'expand'` 时缩放比相同，舞台取空间能容纳的整数个单位，且不小于设计区域。更宽的手机就在两侧多显示一些舞台，设计区域位于舞台中间。
3. **高的空间用竖版设计。** 空间高大于宽时，用 `portrait` 尺寸作为设计区域。两版设计短边相同时（1920 × 1080 和 1080 × 1920），无论怎么拿手机，设计里的东西在屏幕上一样大。
4. **安全区。** `insets` 给出刘海、圆角或底部横条从空间各边向内挡住多远。`safe` 是舞台减去被挡住的部分，单位是舞台单位。贴边的东西按它摆放。
5. **白鹭 5 的 fixed 模式铺满空间。** 每种模式按一条边取缩放比，舞台取空间此时能容纳的整数个单位：
   - `'fixedWidth'` 让设计宽度等于空间宽度，舞台高度跟随空间；
   - `'fixedHeight'` 同理，按高度；
   - `'fixedNarrow'` 就是 `'expand'`；
   - `'fixedWide'` 把设计放大到盖满空间，舞台就是空间显示出来的那部分。

   舞台比设计小时，设计居中，边缘显示不全。白鹭 5 把舞台尺寸四舍五入；这里向下取整，舞台不会超出空间。
6. **像素风用整数倍。** `wholeScale: true` 时，每个舞台单位覆盖整数个设备像素：缩放比向下取到整数倍，空间剩下的部分是黑边。`pixelRatio` 表示空间的一个像素是多少设备像素。空间放不下“每单位一个设备像素”的设计时，缩放比按适配模式本来的值。

| 白鹭 5 `scaleMode` | `fit` | 在比设计更高的手机上（竖版设计） |
| --- | --- | --- |
| `showAll` | `'contain'` | 设计区域，上下黑边 |
| `noBorder` | `'cover'`（浏览器游戏） | 设计区域，两侧被裁掉 |
| `exactFit` | `'stretch'`（浏览器游戏） | 设计区域，被拉伸 |
| `fixedWidth` | `'fixedWidth'` | 设计宽度不变，上下多出舞台 |
| `fixedHeight` | `'fixedHeight'` | 设计高度不变，横向显示少一些 |
| `fixedNarrow` | `'fixedNarrow'`、`'expand'` | 同 `fixedWidth`；更宽的屏幕上两侧多出舞台 |
| `fixedWide` | `'fixedWide'` | 同 `fixedHeight` |
| `noScale` | 无 | 不支持 |

750 × 1334 的设计用 `'fixedWidth'`，在 393 × 852 的手机上舞台是 750 × 1625 个单位（缩放比 0.524）。在 768 × 1024 的平板上是 750 × 1000 个单位，设计上下各被裁掉 167 个单位；这时 `'expand'` 会完整保留设计，舞台为 1000 × 1334 个单位。

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
| `width`、`height` | 舞台大小，整数单位：`'contain'` 时等于设计尺寸，`'expand'` 时不小于设计尺寸；`'fixedWide'`，以及屏幕形状相反时的 `'fixedWidth'` 和 `'fixedHeight'`，有一边小于设计尺寸 |
| `scale` | 每个舞台单位对应多少空间像素 |
| `left`、`top` | 舞台左上角在空间里的位置；留了黑边时大于 0 |
| `designRect` | 设计区域在舞台上的位置，居中；舞台更小时会超出舞台边缘 |
| `safe` | 舞台上显示出来且没被挡住的部分 |

结果是冻结的。空间或 insets 变化时重新计算。空间无效、设计尺寸不是整数、insets 小于 0、`fit` 不是这六种之一、`wholeScale` 不是布尔值或 `pixelRatio` 不大于 0 时，以 `UI_SCREEN_OPTIONS_INVALID` 拒绝。

## 在浏览器游戏里

`createBrowserGame({ fit: 'expand', portrait, insets })` 按它所在元素的大小和页面的 `safe-area-inset` 值计算舞台，元素尺寸变化时重新计算：

- `game.screen` 是当前的结果，`game.frame` 是按这个尺寸绘制的帧。
- `game.onScreenChange(listener)` 在舞台尺寸、CSS 缩放比、方向或安全区变化后，用新结果调用 `listener`，返回取消订阅的函数。嵌入式 `'contain'` 画布有时只改变 CSS 缩放比，设计区域和安全区不变；包括 Play 的 `arrange` 在内的监听器也会收到这次通知。相同的结果不会重复通知。
- 指针和悬停输入按舞台当前的尺寸把页面坐标换算到舞台。舞台尺寸会变时，两者各接收一个 `size` 函数，游戏会传进去。

只有视口 meta 标签写了 `viewport-fit=cover`，页面才会给出 `safe-area-inset` 值：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

页面或宿主更清楚安全区时，用 `insets` 直接给出。在微信小游戏里，`tools/wechat/export-wechat.mjs` 的适配器把微信的 `safeArea` 当作页面的 insets 报告，`'expand'` 铺满屏幕画布而不拉伸。

`wholeScale: true` 每次计算舞台时读取页面的设备像素比。画布按每单位一个像素绘制（`pixelRatio` 为 1，不接受其他值），再用 `image-rendering: pixelated` 放大，每个单位都是清晰的方块。它需要一个会计算舞台的适配模式：`'contain'`、`'expand'` 或某个 fixed 模式。

用 [Egret Migrate](旧工程迁移.md) 从白鹭 5 迁移的项目保留它的 `scaleMode`。用 fixed 模式时，`stage.stageWidth` 和 `stage.stageHeight` 跟随窗口，EUI 按新尺寸重新排布各个根节点，舞台派发 `egret.Event.RESIZE`，和白鹭 5 一样。

## 检查了什么

- `tests/ui-screen.test.mjs` 在 Node 里检查计算：`'contain'` 和 `'expand'`、更宽和更高的空间、竖版设计、在黑边以内和超出黑边的 insets，以及拒绝无效输入。
- `examples/play/verify.mjs` 在无头 Chromium 加软件 WebGL2 里检查一个游戏。这个游戏用 `'expand'`、竖版尺寸和 44 CSS 像素的刘海：
  - 960 × 540 时完整显示设计区域；
  - 1200 × 540 时两侧各多显示 80 个单位；
  - 540 × 960 时换成竖版尺寸；
  - 在页面上点击，能点中 `arrange` 摆在安全区里的按钮。
- 同一浏览器屏幕适配用例另将嵌入的 200 × 100 设计区域缩小再放大，CSS 缩放比依次为 2 → 0.9 → 3。`arrange` 保持按钮为 44 CSS 像素，安全区及设计区域不变，两次实际变化分别通知一次，最后的鼠标点击命中按钮。
- `tests/wechat-minigame.test.mjs` 检查适配器把微信的安全区作为页面的 insets 报告。
- SCR06 和 SCR07 对照白鹭 5 的算法检查四种 fixed 模式，覆盖比设计更高和更宽的空间；还检查整数倍缩放，包括一个 CSS 像素对应两个设备像素的页面。
- 浏览器屏幕适配用例还在一个会改变大小的元素里运行 `'fixedWidth'` 和 `'fixedHeight'`：
  - 800 × 800 的元素显示 400 × 300 设计中的 400 × 400 个单位；
  - 改成 1000 × 600 后显示 400 × 240 个单位；
  - 在设计中间点击能点中那里的按钮。

  `wholeScale` 方面，160 × 90 的游戏放在 700 × 400 CSS 像素里，画布按 160 × 90 绘制、显示为 640 × 360。其中 2 × 2 的点在屏幕上是 8 × 8 像素，黑白之间没有任何中间色。
- `tests/egret-migrate.test.mjs` 检查 `inspect` 保留每种 fixed 模式并拒绝 `noScale`。
- `tests/egret-migrate-eui.test.mjs` 把一个 `fixedWidth` 项目的屏幕从 480 × 320 个单位变为 480 × 400：`bottom="0"` 的横条从 280 移到 360，居中的部件随新的中点移动，`RESIZE` 只通知一次。
- 在无头 Chromium 里，把一个迁移来的 750 × 1334 `fixedWidth` 游戏的窗口从 375 × 667 改为 393 × 852：
  - `stage.stageHeight` 从 1334 变为 1625；
  - `RESIZE` 通知一次；
  - 按 `stageHeight` 画的横条贴到窗口最底一行。

  这次运行记录在加入这些模式的 PR 里。

没有在带刘海的手机、Safari 或微信本身上运行过。这些运行中页面自己的 insets 始终为 0，刘海是用 `insets` 给出的。`wholeScale` 在浏览器里只在一个 CSS 像素对应一个设备像素时检查过，两个设备像素的情况只在 Node 里检查过。

## 设计说明

游戏 UI 框架通常这样应对不同形状的屏幕。比如 LumioGames 的 LGUI 用短边相同的两版设计，加一个由框架移动的安全区节点；这里把它作为参考研究过，没有用它的任何代码。这里的规则作用在舞台上，而不是作用在有名字的组件上；游戏在自己的代码里按 `safe` 摆放贴边的东西。
