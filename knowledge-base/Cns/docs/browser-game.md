# 一次调用启动页面里的游戏

[English](../../en/docs/browser-game.md) | 简体中文

`@egret/engine/web/game` 用一次调用在页面里启动一个 2D 游戏，并带有一个显示游戏开销的面板。

**核对了什么，没核对什么。** 选项和面板在 Node 中核对。[起步示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.zh-CN.md)运行在 `createBrowserGame` 之上，并在无头 Chromium 中用软件渲染核对，全部使用 WebGL2：能绘制，能响应点击、按键和触摸，能按地址加载图片，加上 `?stats` 能显示面板。自动选择核对了两种情况：浏览器没有 WebGPU，以及浏览器的 WebGPU 不给适配器，两者都得到 WebGL2。选中 WebGPU 的情况没有核对：该浏览器的软件 WebGPU 适配器会丢失设备或永远画不完一帧，用 `?backend=webgpu` 时也一样，所以这里早先写的“绘制了若干帧且没有失败”说得比实际看到的多。没有在硬件 GPU 和手机上运行。

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

`await game.loadTexture(url)` 加载一张 PNG 图片并给出其纹理的租约，可用于 `new Bitmap(lease)` 或 `graphics.beginBitmapFill(lease)`；租约属于 `game.scope`，同一地址加载两次得到同一张纹理。其他格式不能读取，请使用[内容构建](content-build-pipeline.md)。`game.host` 是 Host，可读取它的状态。`game.frame` 是循环绘制的那一帧；`game.toStage(clientX, clientY)` 把页面上的位置（页面的指针事件给出的坐标）换算成舞台上的位置。

## 选项

| 选项 | 含义 | 省略时 |
| --- | --- | --- |
| `canvas` | 用来绘制的画布。它在屏幕上的大小由页面决定 | 必填 |
| `width`、`height` | 舞台大小，使用游戏自己的单位：大于 0 的整数 | 必填 |
| `backend` | `'auto'`、`'webgpu'` 或 `'webgl2'` | `'auto'` |
| `pixelRatio` | 画布自身宽度的每个单位对应多少画布像素 | 设备的像素比，最多 2 |
| `clearColor`、`clearAlpha` | 每帧先清成什么颜色 | `0x000000` 和 1 |
| `update(seconds)` | 游戏的一步，在每帧之前调用 | 没有这一步 |
| `onError(error)` | 循环被什么停下时通知一次 | 失败会抛出到控制台能看到的地方 |
| `pointer`、`keyboard` | 给 `false` 则不创建该输入 | 两者都创建 |
| `stats` | 给 `true` 则显示面板 | 没有面板 |
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
