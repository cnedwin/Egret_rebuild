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

`play` 改变屏幕时，在调用 `arrange` 前重新摆放世界层、特效层和界面层，暂停期间也一样。世界层和特效层保留镜头偏移（`game.view`）和上一帧已显示的震动偏移。如果 `arrange` 改变镜头，重新绘制的帧采用新的偏移。`setup` 结束后的首次排列也能读到设置的镜头偏移，即使游戏在 setup 中就暂停了。重新投影不会推进暂停的游戏模拟、计时器、补间或震动。改变屏幕尺寸无需临时恢复游戏来重新摆放图层。

## 把盒子固定在边上

`pinBox(area, box, pin)` 算出一个盒子要固定在某个区域的边上时应放在哪里：返回它的左上角，单位与两者相同。区域可以是 `plan.safe`，也可以是整个舞台 `{ x: 0, y: 0, width: plan.width, height: plan.height }`：

```js
import { pinBox } from '@egret/engine/web/screen';

game.onScreenChange(plan => {
  const at = pinBox(plan.safe, { x: score.x, y: score.y, width: score.width, height: score.height }, { right: 16, top: 16 });
  score.x = at.x; score.y = at.y;
});
```

横向取 `left`、`right`、`centerX` 之一，纵向取 `top`、`bottom`、`centerY` 之一，表示离那条边或中线的距离。没有给的方向保持盒子原来的位置。`isScreenPin(value)` 判断一个值是不是 pin。同一方向给了两个、名字不认识或数字不是有限数时，以 `UI_SCREEN_OPTIONS_INVALID` 拒绝。[play](play.md#任意形状的屏幕) 的 `game.pin` 就是这样摆放节点的，屏幕或包围盒变化时会再摆一次。

## 一次检查多种屏幕

`node tools/egret.mjs verify <页面> --screens`（在游戏的引擎副本里是 `node vendor/egret.mjs verify --screens`）在无头 Chromium 里用九种屏幕规格打开同一个页面，每种屏幕写一张图片，并写出 `report.json`。这九种屏幕规格是：没有刘海的手机（375 × 667）、有刘海和主屏指示条的手机（393 × 852）、同一部手机横过来（852 × 393）、细长的安卓手机（360 × 800）、横竖两种方向的平板（768 × 1024 和 1024 × 768）、折叠状态外屏的横向浏览器视口（873 × 325，`foldable-cover-wide`）、展开的折叠屏（884 × 1104，`foldable`）和桌面（1920 × 1080）。`--screens=phone-notch,tablet` 只跑其中几种。折叠规格采用 Galaxy Z Fold7 外屏在横向 Chrome（浏览器栏显示时）中实测的有效内容视口（DPR 2.625，触屏）。实测页面没有报告额外的安全区内缩，因而代替值全为零；这不是对刘海形状的测量，也不替代展开的规格。

无头浏览器没有刘海。工具给页面放上 `globalThis.__egretAgent.insets`，引擎把它当作窗口的安全区 insets，并在每张图片里把被遮住的部分染成红色。每种屏幕都检查：

- 页面里的错误；
- 空白的画面；
- 页面会不会滚动；
- 画布占了窗口的多少，不到四分之三时给出警告。

`play` 游戏还会大约每秒四次把接受点击的节点位置和安全区告诉工具。报告据此列出：

- 超出安全区的控件，记为错误；
- 触屏上宽或高不到 44 CSS 像素的控件，记为警告；
- 互相遮挡、又不是一个包含另一个的两个控件，记为警告。

控件用它的 `name`、`onTap` 给的名字、它在视图里的部件名或按钮上的文字来称呼。盖满整块画布的节点（例如模态视图的遮罩，或「点任意处继续」的层）不算控件；它显示时，被它盖住的控件也不检查。只要有一种屏幕出现错误，工具就以 1 退出。这是按每部手机的尺寸和像素比、加上代替的 insets 运行的 Chromium，不是手机：真实刘海的形状、浏览器自己的栏，以及手机把 insets 交给页面的方式都没有检查。

Play 和 World3D 原生控件报告器共用同一套变换后的裁剪几何。安全区和重叠检查取控件可见命中包围矩形；当真正的祖先裁剪缩小控件可见区域时，触控区尺寸按原始命中区检查（见下文）。

### 沿试玩路线检查多个状态

不提供脚本时，工具检查初始页面，通常是标题页。要在同一次运行里检查菜单、对局或结算，可以加上原有 verify 的试玩脚本：

```sh
node vendor/egret.mjs verify --screens --play test/play.mjs --out screen-route
```

脚本的默认异步函数拿到与单窗口验证相同的 player：`tap`、`drag`、`key`、`look`、`until`、`read`、`expect`、`sounds`、`warnings` 和 `picture`。脚本模块加载一次，函数在每种指定屏幕的全新浏览器上下文中各运行一次，不先盲打；一种屏幕产生的存档不会带到下一种。将脚本自身的状态留在函数内部。视口和 insets 由屏幕配置决定，忽略脚本导出的 `viewport`；截图检查时如果视口被改动，就报错。可选的 `stage` 导出与单窗口验证一样，将坐标映射到最大的一块画布；没有该导出时，坐标是相对于该画布的 CSS 像素。对于随屏幕移动的控件，点击前先读实际位置（见 `examples/screen-check/play.mjs`）。即使设备像素比很高，`look` 也按 CSS 像素取色。

在每个稳定的界面状态使用例如 `await player.checkpoint('rules')`。每个检查点写出带红色遮挡区的截图并执行相同的屏幕检查。引擎如果已经提供过控件位置，检查点和终态截图会等待下一次位置报告（最长五秒，游戏模拟暂停时也适用）。未收到新报告时，`controlsFresh` 会报错，不用过时的几何进行检查；从未报告控件的游戏则仍然没有控件位置检查。名称必须是唯一、非空且不含控制字符的字符串。改变界面前应等待这次调用结束。最后仍按原来的方式写出终态截图。`report.json` 中每种屏幕都保留终态检查和 `played` 结果（脚本图片、检查点名称以及失败时的诊断）；有序的 `checkpoints` 各有自己的检查结果和截图路径。`controlReceipt` 说明位置报告是最新的、缺失的还是未经确认的。检查点文件在各自的屏幕子目录内编号，与 `player.picture` 文件分开；重复的图片路径会被拒绝。即使终态通过，只要某个检查点有错误或脚本失败，该屏幕仍然失败，后续屏幕也会继续运行。与普通的 `verify --play` 一样，脚本是受信任的本地 JavaScript，浏览器中的外部请求仍被拒绝。player 的点按与拖动是鼠标输入；专门的触控脚本可在触屏配置上使用 `player.page.touchscreen`。两者都不等同于实体触控或真机测试。

### 检查后续场景

`node vendor/egret.mjs verify --screens --prepare test/prepare-market.mjs --out screen-market` 在每个全新屏幕上打开普通游戏页，再在截图和安全区检查之前运行明确指定的本地模块。模块沿用 `--play` 的玩家辅助方法；它的默认导出函数收到玩家对象和只读的屏幕描述（`name`、CSS 像素的 `width`、`height`、`scale`、`touch`、`insets`）。例如，按 Enter 打开集市的游戏可以这样写：

```js
export default async function prepare(player, screen) {
  await player.page.waitForFunction(() => window.demo?.ready);
  await player.key('Enter');
  await player.page.waitForFunction(() => window.demo?.screen === 'market');
  const actual = await player.read(() => window.demo.screen);
  player.expect(actual === 'market', screen.name + ': market ready');
  return actual;
}
```

确认场景已经就绪后，返回实际进入的非空场景名称。每个屏幕的报告都包含 `prepared`，记录场景或错误。工具等待准备完成后的新原生控件报告；没有报告或原生控件列表为空即判该屏幕失败。异常、异步准备超过 20 秒也判失败，截图及其他检查仍是失败证据。异步时限不能中断阻塞的同步代码：这是操作者明确提供的可信本地 Node 模块，工具不会从页面自动寻找或下载脚本。不加 `--screens` 时，`--play` 仍是单窗口游戏流程检查，含音频。多屏验证不测音频；使用 `--screens` 加 `--play` 检查多个状态的画面与控件位置，或用 `--prepare` 确认后续场景就绪。两种选项同时使用时，先准备场景。准备失败则跳过该屏幕的试玩脚本；准备成功后，在路线检查点之前单独检查并记录 `preparedState`。两者都不能替代游戏流程或音频检查。实际可运行的示例见 `examples/screen-check/prepare.mjs`。

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
- 浏览器屏幕适配用例也在非零镜头偏移和震动期间暂停竖版游戏，转为横版再转回，检查世界层和绘制出的粒子特效是否位于投影后的正确位置。暂停时游戏时间和更新次数都保持不变，`arrange` 回调中已是新投影。恢复游戏后还检查了无震动、保持镜头偏移时的正常屏幕变化。
- SCR08 检查 `pinBox` 贴每条边和中线、不动没给的方向，以及它拒绝的 pin。
- 浏览器屏幕适配用例里，一个 `'expand'`、右侧有刘海的游戏把分数固定在安全区右上角，把横条固定在屏幕底部中间。窗口变宽和旋转后，两者都仍贴着各自的边。分数的包围盒横向放大一倍后，重新摆到离边 8 个单位处；`set` 立即把它改到别处。
- `examples/screen-check/verify.mjs` 用 `verify --screens` 在全部九种屏幕规格上运行一个 `'expand'` 的横版游戏，先带三个错误，再改正。带错误时，固定在屏幕角上的暂停按钮恰好在那个角有 insets 的三部手机上落在刘海下面；24 个单位的帮助按钮在显示不到 44 CSS 像素的每种触屏上都过小；`Jump` 和 `Fire` 两个按钮互相遮挡。引擎采用的安全区就是窗口减去代替的 insets，误差不超过画布的最后一个像素；图片在刘海处是红色，刘海下方不是。加上 `?fixed=1` 后，任何屏幕都没有发现，也没有引擎告警。再打开一个询问（`?ask=1`）在三种屏幕上运行，只报告询问自己的 `no` 和 `yes` 两个按钮：盖满画布的遮罩不算发现，被它盖住的按钮也不和询问的按钮比较。`tests/egret-verify.test.mjs` 在 Node 里检查命令的选项，以及对给定控件的判断。
- 同一示例还用 `--screens --play` 在全部九种屏幕规格上点按暂停和模态询问里的留下按钮：分别检查三个状态，保证暂停期间收到新的控件位置报告，在每个设备像素比取色，并验证检查点图片和普通图片的路径互不覆盖。指定的失败用例确认：之前的状态不安全，即使终态安全，该屏幕也会失败；脚本错误不会跳过后续的屏幕；无效或重复的检查点名称及重复图片路径会被拒绝；改变视口不会被算作原来的屏幕，丢失控件报告也不能悄悄通过。
- `tests/egret-migrate-eui.test.mjs` 把一个 `fixedWidth` 项目的屏幕从 480 × 320 个单位变为 480 × 400：`bottom="0"` 的横条从 280 移到 360，居中的部件随新的中点移动，`RESIZE` 只通知一次。
- 在无头 Chromium 里，把一个迁移来的 750 × 1334 `fixedWidth` 游戏的窗口从 375 × 667 改为 393 × 852：
  - `stage.stageHeight` 从 1334 变为 1625；
  - `RESIZE` 通知一次；
  - 按 `stageHeight` 画的横条贴到窗口最底一行。

  这次运行记录在加入这些模式的 PR 里。

上述原软件渲染测试没有覆盖带刘海的实体手机、Safari 或微信本身。这些运行中页面自己的 insets 始终为 0，刘海是用 `insets` 或 `__egretAgent.insets` 给出的。`wholeScale` 在浏览器里只在一个 CSS 像素对应一个设备像素时检查过，两个设备像素的情况只在 Node 里检查过。

## 设计说明

游戏 UI 框架通常这样应对不同形状的屏幕。比如 LumioGames 的 LGUI 用短边相同的两版设计，加一个由框架移动的安全区节点；这里把它作为参考研究过，没有用它的任何代码。这里的规则作用在舞台上，而不是作用在有名字的组件上；游戏在自己的代码里按 `safe` 摆放贴边的东西。

## 11 月 27 日真机补验

11 月 27 日实测：Windows 硬件 WebGL2 与 Fold7 WebGL2/WebGPU 的 fixed 模式、贴边、高 DPR 整倍数像素及 UI/视图几何专项通过。Fold7 真实视口 873 × 325 CSS 像素、DPR 2.625，指定 insets 和竖屏/平板容器尺寸由脚本提供；实体刘海与折叠转换仍待测。 [真机观测及剩余范围](november-27-claude-hardware.md). 另在独立重建的 #516 上确认双终端双后端关闭视图独立缩放时，覆盖层保持世界坐标及点击。

## 3D 叠加层的独立 UI 缩放与原生屏幕报告

普通适配决定每个逻辑单位对应多少 CSS 像素。覆盖 3D 画布的透明叠加层可以单独限制 UI 大小，避免界面在手机上缩得太小，或者在显示器上无限放大：

```js
const overlay = await createWorld3DOverlay(canvas, {
  width: 800, height: 420, portrait: { width: 380, height: 680 },
  fit: 'expand', uiScale: { min: 1, max: 1.35 }
});
const game = overlay.game;
// 用 game.screen.width、height、safe、scale 布局并投影世界位置。
```

`uiScale` 限制叠加层逻辑单位实际对应的 CSS 像素。两项界限都可省略，给出时必须为有限正数，且下限不得超过上限。它适用于铺满空间的适配模式（`expand` 或 fixed 模式），不可与 `stretch`、`contain`、`cover` 或 `wholeScale` 一起使用。当界限改变了适配的缩放比，舞台逻辑尺寸在**两个**轴上跟随可用空间，居中的设计区域可能被裁切。因此按当前的 `game.screen.safe` 摆放控件，而不是按原设计矩形。`game.onScreenChange`、指针命中检测、语义投影和 `overlay.box` 使用同一个实际逻辑尺寸与缩放比。该选项不改变 3D 画布尺寸。把场景中的点投影到叠加层时，先得到 CSS 坐标，减去叠加层画布的 CSS 原点，再除以实际逻辑缩放比（也可以按 CSS 矩形和舞台逻辑宽高映射）。

`planScreen` 和底层 `createBrowserGame` 在铺满空间的规划适配模式中也接受此选项。它与 `play({ uiScale })` 不同：后者仅缩放声明式视图，不改变游戏舞台。

原生 `verify --screens` 现在也检查 World3D 叠加层的控件，即使它按需绘制或者绘制循环暂停。位置来自可见、可交互的显示对象：将显式 `hitArea` 变换为舞台和 CSS 坐标，并受裁剪矩形约束。隐式命中区或变换后的图形报告其轴对齐包围矩形，不证明逐像素遮挡关系。覆盖整舞台的指针遮罩会排除其后的控件。当当前叠加层画布由真实的 `createBrowserSemantics` 投影持有时，与原生边界匹配的可操作语义节点提供当前名称及模态、禁用状态；尺寸仍取真实命中区，而非绘制的阴影或焦点描边。原生动作、移动、范围及滚动条滑块控件即使没有语义名称也会报告；开关和选择项通过其动作控件报告。检查读取控件当前启用状态，不增加输入通路。交互语义角色（如只有指针拖动、没有激活动作的滑条）可为匹配的目标提供名称。存在语义投影时，无名纯指针阻挡面板不算按钮；没有投影时，保留可见触控目标按名称或位置报告的做法。只有屏幕验证采集器存在时才会启用报告计时器，销毁叠加层时清理计时器。

`tests/ui-screen.test.mjs` 检查缩放界限及无效参数。`tests/world3d-overlay-screen-browser.mjs` 在 Chromium 中验证独立缩放、真实语义名称与命中区边界、触控路由、刘海/触控尺寸/重叠发现、暂停绘制期间转屏和报告清理；这不是设备性能测试。

## 裁切控件与声明的绘制遮挡

Play 与 World3D 原生叠加层使用同一个屏幕报告几何采集器。它检查真实直接安装的动作、范围、移动和滚动控件，以及 Play 自己的点击与手势。原生命中矩形与真实语义节点的边界匹配时，报告使用该节点当前的可访问名称。隐藏、禁用、非活动控件不报告，装饰性结构组也不会仅因有边界就成为按钮。

使用四个角变换控件完整的原生命中范围。先将变换后的祖先裁剪矩形和命中区域的实际凸多边形相交，再计算轴对齐包围矩形，避免在旋转、嵌套裁剪中误报完全不可见的控件或扩大可见范围；该几何计算也用于声明的绘制面和语义边界匹配。全被裁掉的行不报告，部分露出的行按露出范围检查安全区和重叠，但按完整原始尺寸判断是否达到 44 CSS 像素触控目标。滚动列表正常露出一角的行不因此被误报为原本就过小；报告不会把控件截取在安全区或画布边界内来隐藏放错位置的控件，实际落在刘海下且没有被裁切的目标仍然不达标。按真实显示对象的祖先关系判断嵌套，而不只看矩形包含关系；两个没有祖先关系的按钮即使一个完全包含另一个也会报告重叠。没有原生身份数据的旧版第三方报告保留原来的包含关系解释。

后绘制的原生输入面可能在与无关目标重叠的地方实际被命中，此时报告建议性的 `occluded`。这是输入阻挡，不是对像素可见性的推断。对于本身不接收输入、但确实绘制覆盖控件的 HUD 面板，可以标记实际绘制的面：

```js
import { registerScreenOccluder } from '@egret/engine/ui';

const registration = registerScreenOccluder(statusCardSprite, {
  name: '状态卡片',
  rect: () => ({ x: 0, y: 0, width: cardWidth, height: cardHeight })
});
scope.use(registration);
```

本地矩形和名称均可直接给值或给函数。注册仅用于诊断，不改变实际绘制、命中检测、控件或焦点。采集器从真实显示树读取已声明的绘制面及其实际变换、祖先裁切、显隐与绘制顺序。没有祖先关系且后绘制的面与目标重叠时，发出带 `source: 'paint'` 的建议性 `occluded`；不可见、alpha 为零的面和目标本身的祖先或后代装饰不会误报。绘制面退役时销毁返回的句柄。数据描述视图的 `view.get(name)` 返回实际面板 Sprite，使用它自己的本地绘制矩形（不是容器聚合的子节点范围），横竖屏变体重新建立 Sprite 时通过 `built(view)` 更换注册。圆角面宜使用保守的内部矩形。透明容器不要注册，不能仅凭语义组聚合边界推断不透明。

这些发现是几何与输入证据，不是任意遮罩、纹理透明度、滤镜或旋转图形的逐像素可见性证明。没有显式声明的纯视觉图层仍需检查截图。原生报告仅在现有多屏验证采集器存在时运行。

`tests/egret-verify.test.mjs` 验证露出范围和完整尺寸、真实祖先关系及输入/绘制遮挡发现的解释。真实浏览器用例 `tests/screen-control-report-browser.mjs <absolute Playwright index.mjs>` 检查实际 Play 与 World3D 叠加层、原生滚动和直接动作控件、声明的绘制覆盖、真实输入阻挡、无关包含和注册销毁；它不是设备性能验收。
