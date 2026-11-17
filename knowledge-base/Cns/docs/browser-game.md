# 一次调用启动页面里的游戏

[English](../../en/docs/browser-game.md) | 简体中文

`@egret/engine/web/game` 用一次调用在页面里启动一个 2D 游戏，并带有一个显示游戏开销的面板。想做一个完整的小游戏，输入、声音、文字和定时器都现成可用，请从 [`play`](play.md) 开始，它建立在这个入口之上。

初版[起步示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.zh-CN.md)在无头 Chromium 中使用软件 WebGL2。Node 检查选项与统计面板，浏览器检查绘制、点击、按键、触摸、图片加载，以及 WebGPU 或其适配器不可用时回退到 WebGL2。

[启动器与绘图真机结果](starter-graphics-hardware.md)记录后续 Windows 与 Android 实测及其范围。

## 用法

```js
import { Sprite } from '@egret/engine';
import { createBrowserGame } from '@egret/engine/web/game';

const game = await createBrowserGame({
  canvas: document.querySelector('canvas'),
  width: 480, height: 270,          // 舞台大小，使用游戏自己的单位
  update(seconds) { hero.x += 60 * seconds; },
});
const hero = game.stage.addChild(game.scope.use(new Sprite()));
hero.graphics.beginFill(0x4a7bd0).drawRect(0, 0, 24, 24).endFill();
```

这就是一个完整的游戏：方块会移动。`await game.dispose()` 结束它。

## 先知道三件事

**调用一返回，循环就开始。** `createBrowserGame` 完成后的下一帧就会调用 `update`，之后每帧都调用，不管调用下面的代码还在等什么。接着去 `await` 文字或声音的游戏，这期间 `update` 已经在运行：写在更下面的 `let` 或 `const` 还不存在（`Cannot access 'state' before initialization`），这个错误会让循环停下。把 `update` 要读的东西都放在后面第一个 `await` 之前创建，或者等准备完成后自己启动循环：

```js
const game = await createBrowserGame({ canvas, width: 480, height: 270, autoStart: false, update });
const score = await game.createLabel({ text: '0' });   // 这时 update 还没有运行
const state = { score: 0 };
game.loop.start();
```

**引擎返回的对象不能再加东西。** `game`、文字标签、输入动作等引擎返回的对象都是冻结的：`label.centre = () => …` 会抛出 `Cannot add property centre, object is not extensible`。自己的数据放在自己的对象里，和它们并排存放，例如 `{ label, anchorX: 0.5 }`。

**错误信息的末尾是它的原因。** 让循环停下的错误会抛到控制台，或交给 `onError`。信息从外向内读：`CLOCK_CALLBACK_FAILED: … Cause: DISPLAY_VALUE_INVALID: … Cause: RangeError: x was given NaN`，最后一段就是最先出错的地方。`error.code` 是最外层的代码，`error.cause` 是里面的下一个错误。

游戏的其余部分：`animate` 以链式写法移动和淡入淡出显示对象（`import { animate } from '@egret/engine'`，然后 `animate(game.engine, game.scope, sprite).to({ x: 100, alpha: 0 }, 0.3, 'quadOut').start()`；见 [API 参考](api-reference.md)），[2D 相机](camera-2d.md)负责跟随、缩放和震屏，[游戏工具包](game-kit.md)有输入动作、音效、随机数和存档，[音频](audio.md)负责播放和混音，[Graphics](graphics.md) 绘制图形，另有[粒子](particles.md)和 [2D 物理](physics-2d.md)。

## 这次调用创建了什么

| 部分 | 在 game 上 | 创建方式 |
| --- | --- | --- |
| 负责绘制的 Host | `game.backend` 为 `'webgpu'` 或 `'webgl2'` | `createSharedWebGPUHost` 或 `createSharedWebGL2Host`，只加载被选中那个的模块 |
| Engine 和它的舞台 | `game.engine`、`game.stage` | `createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D)` |
| 存放游戏所创建对象的作用域 | `game.scope` | `engine.createScope()` |
| 显示对象上的触摸、鼠标和笔 | `game.pointer` | `createBrowserPointerInput`，见[指针输入](multi-pointer-input.md) |
| 键盘 | `game.keyboard` | `createBrowserKeyboardInput`，见[键盘输入](keyboard-focus-input.md) |
| 帧循环 | `game.loop` | `createBrowserFrameLoop`，见[帧循环](frame-loop.md) |
| 面板（如果要求） | `game.stats` | `createBrowserStatsPanel`，见下文 |

`await game.loadTexture(url)` 加载一张 PNG 图片并给出其纹理的租约，可用于 `new Bitmap(lease)` 或 `graphics.beginBitmapFill(lease)`；租约属于 `game.scope`，同一地址加载两次得到同一张纹理。其他格式不能读取，请使用[内容构建](content-build-pipeline.md)。`game.host` 是 Host，可读取它的状态。

**文本。** `const label = await game.createLabel({ text: '金币 0', fontSize: 14, color: 0xf0c030, locale: 'zh' })` 创建一行文本；把 `label.display` 加到舞台上并定位，之后文字变化时设置 `label.text`。新文字准备好后才画出来，在此之前保留旧文字；`await label.ready` 可以等它完成。可以同时创建或修改任意多个 label：它们每次画两个，其余排队；正在绘制时文字又变了的 label，接着画最新的文字。`ready` 之后，`label.display.width` 和 `.height` 就是文字的大小，所以 `label.display.x = centre - label.display.width / 2` 可以让它居中。字体用页面自己的：系统字体族，或页面已加载的字体。第一个 label 会加载页面的文本光栅化器，所以 import map 需要 `@egret/engine/text`、`@egret/engine/web/text` 和 `@egret/runtime/text`。

**画布适配。** 给了 `fit` 之后，游戏会把画布居中放在它的元素里，并在该元素大小变化时重新调整。这个元素需要有自己的大小：高度由画布撑开的元素没有可适配的尺寸。`'cover'` 时画布比元素大，元素应当隐藏溢出的部分。任何模式下舞台都保持自己单位的宽高，指针位置跟随画布。
`game.frame` 是循环绘制的那一帧；`game.toStage(clientX, clientY)` 把页面上的位置（页面的指针事件给出的坐标）换算成舞台上的位置。

## 选项

| 选项 | 含义 | 省略时 |
| --- | --- | --- |
| `canvas` | 用来绘制的画布。它在屏幕上的大小由页面决定 | 必填 |
| `width`、`height` | 舞台大小，使用游戏自己的单位：大于 0 的整数 | 必填 |
| `backend` | `'auto'`、`'webgpu'` 或 `'webgl2'` | `'auto'` |
| `pixelRatio` | 画布自身宽度的每个单位对应多少画布像素 | 设备的像素比，最多 2 |
| `clearColor`、`clearAlpha` | 每帧先清成什么颜色 | `0x000000` 和 1 |
| `update(seconds)` | 游戏的一步，在每帧之前调用 | 没有这一步 |
| `onError(error)` | 循环被什么停下时收到通知；Engine 只能上报的错误也会通知，例如点击的监听函数抛错并因此结束了指针输入 | 失败会抛出或上报给页面，在控制台能看到 |
| `pointer`、`keyboard` | 给 `false` 则不创建该输入 | 两者都创建 |
| `stats` | 给 `true` 则显示面板 | 没有面板 |
| `fit`、`fitTo` | 画布怎样填充一个元素：`'contain'` 完整放入，`'cover'` 盖满，`'stretch'` 拉伸成它的形状。`fitTo` 就是那个元素 | `'none'`，以及画布的父元素 |
| `autoStart` | 给 `false` 则由 `game.loop.start()` 启动循环 | 循环立即启动 |

无效的选项在创建任何东西之前就以 `BROWSER_GAME_OPTIONS_INVALID` 被拒绝。

**`'auto'` 怎样选择。** 浏览器有 `navigator.gpu` 并且给出适配器时用 WebGPU，否则用 WebGL2。先请求适配器，再碰画布，因为一个画布一旦取得某种上下文就不能再换。如果选了 WebGPU 而它的设备随后失败，这次调用以 Host 自己的错误失败，不会回退：那个画布已经不能再交给 WebGL2。

## 面板

```text
webgl2
fps 60.0  longest 17.1 ms
commands 6  triangles 12
geometries 0  pages 0
pending 0  drawn 1204  skipped 3
```

| 行 | 显示 |
| --- | --- |
| `fps`、`longest` | 自上次刷新文字以来，显示器每秒的帧数，以及相邻两帧之间最长的间隔 |
| `commands`、`triangles` | 最近绘制的一帧包含什么：绘制命令数，以及它们画出的三角形数。一个矩形或一张图片是两个三角形 |
| `geometries`、`pages` | 该帧中不同的网格几何体数和不同的图片数 |
| `pending` | Host 持有的尚未完成的帧数 |
| `drawn`、`skipped` | 循环已绘制的帧数，以及因 Host 已持有两帧而跳过的帧数 |

- **命令数不是绘制调用次数。** Host 会把同一图片、同一材质上连续的命令合成一次绘制。面板显示的是 Engine 要求画的内容，而不是 Host 实际发出了多少次绘制。
- 文字每秒刷新两次。面板盖在画布左上角，不接收指针：它下面的内容仍然可以点击。
- `game.stats.snapshot()` 把同样的数字交给程序。

不用 `createBrowserGame` 时，自己创建面板，并在显示器的每一帧告诉它一次：

```js
import { createBrowserStatsPanel } from '@egret/engine/web/game';
const panel = createBrowserStatsPanel({ canvas, label: 'my game' });
// 在游戏的每一步里：
panel.sample({ frame: lastDrawnFrame, pendingFrames: host.getStatus().pendingFrames, ...loop.snapshot() });
```

## 游戏用不下去的时候

这次调用创建的每样东西，都是各个独立入口创建的那一样。需要自定上限的 Host、读回、多个作用域或自己的循环的游戏，按[该引哪个入口](entry-points.md)所列自己创建这些对象，不使用本入口。Engine 的其他部分都不依赖它。

在没有打包工具的页面里，import map 需要 `@egret/engine/web/game` 以及它加载的内容：复制[起步示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/index.html)的 import map。
