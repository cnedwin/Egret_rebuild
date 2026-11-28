# Play：一次调用做出一个完整的小游戏

[English](../../en/docs/play.md) | 简体中文

做游戏从 `@egret/engine/play` 开始。一次调用就创建画布、让它适应页面并运行循环；返回的 game 上有大多数游戏都要自己写一遍的东西：每帧可以直接询问的键盘和指针、用代码合成的音效、重叠判断、定时器、文字、缓动、粒子爆发、震屏、闪屏和顿帧。游戏不需要任何图片、声音或字体文件。

它由公开入口组合而成（[浏览器游戏](browser-game.md)、[音频](audio.md)、[游戏工具包](game-kit.md)、[Graphics](graphics.md)），它没有覆盖的部分，这些入口都还在。

**检查了什么。** 选项、音效配方及其采样在 Node 中检查。在使用软件 WebGL2 的无头 Chromium 中，下面这个游戏能启动、绘制、接收键盘和指针、打掉砖块、播放音效并显示居中的文字。这次最初的完整游戏检查没有覆盖硬件 GPU。

2026 年 11 月 18 日，以 main `ec17a5a2` 为基线的契约修复，在 Windows Edge 157.0.4341.60 / RTX 5090 Laptop 和 Galaxy Z Fold7 / Android 17 / Chrome 157.0.8103.78 / Adreno 830 上通过，均显式使用 WebGPU 和 WebGL2，没有软件回退。采集期间的系统采样均显示 Edge 位于前台，手机保持亮屏解锁。两台实体设备上注入的鼠标／触摸操作，在四组组合中均使中心像素从 RGBA `255,32,64,255` 变为 `32,255,96,255`。 有界的公开 SDK 用例通过了暂停、零倍率、半速／八倍速、顿帧、回调中暂停、循环停止／启动及回调中关闭。循环恢复后待执行定时器保留，关闭后没有继续执行链式回调。这不代表完整游戏、声音听感或性能验收。

## 一个游戏

```js
import { play } from '@egret/engine/play';

const W = 480, H = 320;
let paddle, ball, bricks = [], score = 0, label, vx = 150, vy = -180;

await play({
  width: W, height: H, background: 0x101828,
  setup(game) {
    paddle = game.rect(W / 2, H - 20, 70, 10, 0x8fa8ff);
    ball = game.circle(W / 2, H - 60, 6, 0xffffff);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        bricks.push(game.rect(40 + c * 57, 40 + r * 20, 50, 14, [0xff4d6d, 0xffa64d, 0xffe14d, 0x7be069][r]));
    label = game.text('分数 0', { x: W / 2, y: 6, size: 18, align: 'center' });
  },
  update(dt, game) {
    paddle.x += game.keys.axis().x * 300 * dt;
    if (game.pointer.down) paddle.x = game.pointer.x;
    ball.x += vx * dt;
    ball.y += vy * dt;
    if (ball.x < 6 || ball.x > W - 6) { vx = -vx; game.sfx.play('bounce'); }
    if (ball.y < 6) { vy = -vy; game.sfx.play('bounce'); }
    if (vy > 0 && game.overlaps(ball, paddle)) { vy = -vy; game.sfx.play('jump'); }
    const hit = game.hits(ball, bricks);
    if (hit) {
      bricks = bricks.filter(brick => brick !== hit);
      game.burst(hit.x, hit.y, { color: 0xffe14d });
      game.remove(hit);
      vy = -vy;
      label.text = '分数 ' + (score += 10);
      game.sfx.play('coin');
      game.shake(4, 0.15);
    }
    if (ball.y > H) { ball.y = H - 60; vy = -180; game.flash(0xff2040); game.sfx.play('hurt'); }
  },
});
```

这就是整个游戏。`setup` 负责搭建；`update` 每帧运行一次，参数是距上一帧的秒数。在 `setup` 返回之前（或它返回的 Promise 完成之前）不会调用 `update`，所以 `setup` 创建的东西到时都已就绪。

## 选项

| 选项 | 含义 | 不给时 |
| --- | --- | --- |
| `width`、`height` | 舞台大小，使用游戏自己的单位：大于 0 的整数。画布会缩放以适应页面，并保持这个比例 | 必填 |
| `background` | 每帧清除成的颜色 | 黑色 |
| `transparent` | `true` 时每帧清为透明，页面上位于画布下面的内容会透出来 | 绘制背景色 |
| `audio` | 启用内置音效和音乐。静音游戏或自带混音器的游戏可设为 `false` | `true` |
| `setup(game)` | 搭建游戏；可以是 `async` | 什么都不搭建 |
| `update(seconds, game)` | 游戏的一步 | 没有这一步 |
| `parent` | 放画布的元素。画布占满它的宽度；元素自己没有高度时，按舞台的比例取高度 | 游戏占满窗口 |
| `canvas` | 页面里已有的画布，位置保持不变 | 自动创建一个 |
| `onError(error)` | 游戏被什么停下时得到通知 | 抛到控制台 |
| `onWarning(warning)` | 告知接近图片上限的帧、因超限没画的帧、没画出来的文字，以及 `update` 在最近 60 帧里每帧都新建的文字、形状或精灵（`PLAY_MADE_EVERY_FRAME`）；见[浏览器游戏](browser-game.md) | 不告知 |
| `onFrameTiming(sample)` | 可选的实际 Play 循环 CPU 时序观察器：更新、判定、宿主受理、准备、绘制及 `submitted`、`refused`、`retained`、`backpressure` 等结果；见[浏览器时序](browser-game.md) | 不测量 |
| `seed` | `game.random` 的种子 | 每次都不同 |
| `saveKey` | `game.save` 保存数据时用的名字 | 页面的路径 |
| `semantics` | 来自 `@egret/engine/ui/semantics` 的 `createUiSemantics` 创建的语义树：`game.show` 的视图会把有名字的部件加进去，每帧结束时发布，供 [UI 测试器](ui-testing.md)和辅助技术使用 | 没有语义树 |
| `backend` | `'auto'`、`'webgpu'` 或 `'webgl2'` | `'auto'` |
| `pixelRatio` | 2D 绘制缓冲区的正数倍率。舞台、布局、输入和语义区域始终使用同一套逻辑坐标 | 浏览器设备像素比，上限为 2 |
| `blendSpace` | 半透明颜色的混合方式：`'srgb'` 与 2D canvas 和白鹭 5 一致，深色底上 10% 的白仍是淡淡的白；`'linear'` 按光线混合，同样的白看起来更强 | `'srgb'` |
| `fit` | `'expand'` 铺满窗口：缩放比不变，舞台越过 `width` × `height` 一直延伸到窗口边缘。`'fixedWidth'`、`'fixedHeight'`、`'fixedNarrow'`、`'fixedWide'` 按白鹭 5 的方式铺满窗口。见[任意形状的屏幕](#任意形状的屏幕) | `'contain'`：窗口形状不同时留黑边 |
| `wholeScale` | 像素风用 `true`：每个单位是整数个设备像素，按 `pixelRatio` 1 绘制并清晰放大。只用于 `play` 自己创建的画布 | `false` |
| `uiScale` | `{ min, max }`：`game.show`、`confirm`、`hints` 和 `loading` 的视图每单位保持的 CSS 像素范围，与游戏画面分开。大尺寸设计在小手机上视图变大，手机设计在桌面上视图变小；`game.uiScale` 是当前倍数，描述里写了 `uiScale: false` 的视图保持游戏的缩放。见[视图按自己的尺寸显示](ui-views.md#视图按自己的尺寸显示) | 跟随游戏本身的缩放 |
| `portrait` | `{ width, height }`：窗口高大于宽时的舞台大小 | 两种方向都用 `width` × `height` |
| `insets` | `{ top, right, bottom, left }`，单位是 CSS 像素：刘海、圆角或底部横条挡住的部分 | 页面的 `safe-area-inset` 值 |
| `arrange(game)` | 摆放跟屏幕有关的东西：在 `setup` 之后调用，窗口尺寸变化或旋转时再调用 | 什么都不移动 |

无法做出游戏的选项会以 `PLAY_OPTIONS_INVALID` 被拒绝；错误信息的末尾说明是哪一项。

`onFrameTiming` 在每次实际浏览器回调收到一个冻结的样本，即使保留上帧或拒绝 2D 提交也会告知。观察器不控制循环，内部异常不会改变循环结果。CPU 提交时间并不是 GPU 完成或屏幕呈现时间，请不要在观察器里做昂贵的工作。

## 保留静止的 2D 画面

```js
const game = await play({ width: 1280, height: 800, renderMode: 'on-demand', setup });
game.invalidate();
```

按需绘制会在显示树和画布没有变化时保留上一次提交的画面。鼠标、触摸、键盘输入和画布尺寸变化都会请求重绘。异步图片和文字准备好后会随显示内容的变化重新绘制。显示树之外的数据源有变化时，调用 `game.invalidate()` 请求一帧。时钟、输入和应用的 `update` 保持原有节奏，移动的精灵和补间会随变化继续绘制。`play` 默认连续绘制，`play3d` 继续使用原有帧循环。

本地复跑先构建工作区，再运行 `node examples/play/verify-demand-render.mjs <Playwright index.mjs> <新的 output.json> [webgl2|webgpu] [Chromium 可执行文件] [software|hardware]`。夹具记录帧提交量，并检查输入、尺寸、异步资源、文字和补间的暂停及恢复。

在 Windows Chrome for Testing 157.0.8103.6 上，在 1280 × 800 浏览器视口和 640 × 400 设计尺寸下，夹具测了 30 个闲置帧间隔。连续绘制提交 31 次，按需模式提交 0 次，两组引擎都更新了 31 步。SwiftShader WebGL2 与 NVIDIA Blackwell WebGPU 两条路径都得到这一结果。鼠标、触摸、空格键、尺寸变化、显式重绘、贴图及文字就绪都恢复了绘制。补间暂停时提交为零，恢复后到达目标。自制场景的软件 WebGL2 闲置帧间隔 P95 两组均为 4.2 ms。外部游戏标题场景、手机浏览器及软件 WebGPU 性能仍需单独测量。

## 任意形状的屏幕

手机可以横着拿也可以竖着拿，窗口可以是任何形状，刘海和底部横条还会挡住屏幕的一部分。下面三条规则应对这些情况，所有游戏都一样：

1. **设计区域始终完整显示。** 不管窗口是什么形状，`width` × `height` 都按能完整放下的缩放比显示。加上 `fit: 'expand'`，舞台再一直延伸到窗口边缘：更宽的手机在两侧多显示一些舞台，而不是黑边；`(0, 0)` 仍是设计区域的左上角，所以按设计尺寸摆好的游戏仍在中间。
2. **高窗口用竖版尺寸。** 在 `width: 1920, height: 1080` 旁边写上 `portrait: { width: 1080, height: 1920 }`，窗口高大于宽时舞台就换成竖版尺寸。两者短边相同，所以无论怎么拿手机，按钮在屏幕上一样大。
3. **贴边的东西按安全区摆。** `game.screen` 是窗口显示的区域，`game.safe` 是其中没有被挡住的部分，单位都是游戏自己的单位。要贴边的东西（分数、暂停按钮、摇杆）在 `arrange` 里按 `game.safe` 摆放。`arrange` 在 `setup` 之后调用一次，之后窗口尺寸变化、手机旋转或安全区移动时都会再调用。

```js
const game = await play({
  width: 1920, height: 1080, portrait: { width: 1080, height: 1920 }, fit: 'expand',
  setup(g) {
    score = g.text('0', { size: 48 });
    pause = g.button('II', { x: 0, y: 0, width: 96, height: 96 }, () => g.pause());
  },
  arrange(g) {
    score.x = g.safe.x + 32; score.y = g.safe.y + 24;
    pause.x = g.safe.x + g.safe.width - 64; pause.y = g.safe.y + 64;
  }
});
```

**用 pin 固定位置，不必写 `arrange`。** `game.pin(node, { right: 16, top: 16 })` 把 `ui` 层的节点固定在 `game.safe` 的边上，加 `{ area: 'screen' }` 则固定在 `game.screen` 的边上：

```js
setup(g) {
  g.pin(g.text('0', { size: 48 }), { left: 32, top: 24 });
  g.pin(g.button('II', { x: 0, y: 0, width: 96, height: 96 }, () => g.pause()), { right: 16, top: 16 });
  g.pin(g.rect(0, 0, 600, 12, 0x88ccff, g.ui), { bottom: 0, centerX: 0 }, { area: 'screen' });
}
```

- **每个方向一个。** 横向取 `left`、`right`、`centerX` 之一，纵向取 `top`、`bottom`、`centerY` 之一，表示离那条边或中线的距离。没有给的方向保持不动。
- **按包围盒摆放。** 摆放的是节点的包围盒，包括子节点、缩放和旋转。调用时立即摆放；屏幕变化或包围盒大小变化时（例如分数的文字变长）再摆放。
- **两次摆放之间，游戏可以移动它。** 弹跳或滑动不会被立即拉回，下次变化时才重新摆放。
- **句柄。** `pin.set(edges)` 立即改到别处，`pin.dispose()` 解除固定。节点结束时自动解除。

自己适配舞台的游戏可以用同样的计算：[把舞台适配到屏幕](screen-fit.md#把盒子固定在边上)里的 `pinBox`。

`game.orientation` 是 `'portrait'` 或 `'landscape'`，`game.width` 和 `game.height` 是当前所用的设计尺寸。对话框、菜单、提示和触屏摇杆会自动放在 `game.safe` 里。只有视口 meta 标签写了 `viewport-fit=cover`，页面才会给出 `safe-area-inset` 值；页面或宿主更清楚安全区时，用 `insets` 直接给出。[把舞台适配到屏幕](screen-fit.md)讲了其中的计算，供自己适配舞台的游戏使用。

## 在页面控件旁嵌入游戏

传入 `parent` 或页面自有的 `canvas` 后，游戏按键由画布焦点决定。点击画布或用 Tab 切到画布即可操作游戏。默认 Tab 和 Shift+Tab 可继续在页面中切焦，获得焦点的 HTML 按钮可用空格或回车正常激活。离开画布时会释放仍按住的键，即使稍后在其他元素上松键，回到游戏也不会继续移动。两个选项都省略时，全屏游戏沿用原有的窗口级快捷键，包括 Tab。

游戏可以显式声明只在游戏过程中接管的浏览器快捷键：`const release = game.keys.claim('Tab', () => playing)`。谓词为真且游戏有键盘焦点时，该键进入游戏键盘快照，不用于非模态视图切焦或页面导航。已打开的模态视图或提问优先于声明。谓词为假时，原生视图焦点及普通嵌入页面导航不变。调用返回的函数可注销声明；重新开始或销毁也会清除游戏的声明。

嵌入的画布没有 `tabindex` 时，游戏会在运行期间补上 `0`；已有的值（如 `-1`）会保留。如果舞台只作装饰、交互全部由 HTML 控件负责，可给舞台容器设置 `inert`。`transparent: true` 会让渲染表面和引擎创建的容器都透出页面背景。调用方提供的画布保留自有样式。

固定比例的游戏可以使用 `fit: 'contain'` 留边，再用 `@egret/engine/web/semantics` 的 `createBrowserSemantics({ semantics, canvas: game.canvas, width, height })` 传入舞台逻辑宽高。语义投影按留边区域内的画布实测位置和尺寸换算。祖先支持沿坐标轴的正向 CSS 缩放和平移。如果只改了祖先的 CSS 变换，尺寸未发生变化，请调用 `projection.sync()`。旋转、倾斜、镜像和透视会被拒绝。

运行 `pnpm example:browser --port 4173`，在本地打开 `/examples/play/index.html?game=semantic-letterbox`，可查看固定比例的工坊示例。示例源码位于 `examples/play/semantic-letterbox.mjs`，舞台为 640 × 360，绘制缓冲为 480 × 270。`play3d` 的 `pixelRatio` 控制前景 UI，3D 背景由独立的画质设置控制。

## WebGL2 缓存背景

有静态背景地图块的场景可以显式选择 WebGL2 并传入 `staticLayers: true`，通过 `game.browser.staticLayers` 获取缓存能力。用真实 Engine 透明捕获烘焙一次，移除实时源节点后设置位置，在普通世界和 UI 下方合成保留在 GPU 中的纹理；镜头移动只改位置，不用重建背景。设置放置列表（包括替换烘焙完成后）会唤醒按需绘制。限制、回退及生命周期见[浏览器游戏图层契约](browser-game.md#保留在-gpu-中的背景webgl2显式启用)。WebGPU 和普通 Play 的路径不变。

## 绘制

| 调用 | 得到 |
| --- | --- |
| `game.rect(x, y, width, height, color, layer?)` | 一个填充矩形，**中心**在 (x, y) |
| `game.circle(x, y, radius, color, layer?)` | 一个填充圆，中心在 (x, y) |
| `game.sprite(g => …)` | 一个精灵，内容由函数绘制：`g` 是它的 [Graphics](graphics.md)，例如 `g.beginFill(0xff0000).drawRoundRect(-20, -10, 40, 20, 6).endFill()` |
| `game.text(words, { x, y, size, color, align, bold })` | 一行文字，见下文 |
| `game.button(words, { x, y, width, height, color }, onTap)` | `ui` 层里的一个按钮，中心在 (x, y)，文字居中；用 `button.label.text` 修改文字 |
| `game.remove(sprite)` | 立刻把它连同里面的内容从舞台上拿掉，并在这次更新结束时结束它。重复移除不会出错 |
| `game.toFront(sprite)` | 把它放到同一层其他精灵的前面 |

每个调用都返回一个精灵。可以随时设置它的 `x`、`y`、`rotation`（角度，顺时针）、`scaleX`、`scaleY`、`alpha`（0 到 1）和 `visible`，读取它的 `width` 和 `height`，也可以加上自己的属性（`enemy.hp = 3`）。颜色是一个数字 `0xRRGGBB`。已移除的精灵在移除它的那次更新结束之前仍然可以设置，所以还拿着它的循环不会出错；之后再设置会抛出 `OBJECT_DISPOSED`，此时 `sprite.isDisposed` 为真。

精灵绕自己的原点旋转和缩放：`rect` 和 `circle` 的原点在中心，`game.sprite` 的原点是绘制内容的 (0, 0)。所以把 `scaleX` 缓动到 0 再回来，卡片就绕中心翻转。精灵按创建顺序绘制，后创建的在前面。要改变精灵的样子，就重新画一遍：`sprite.graphics.clear().beginFill(0x00ff00).drawRect(-10, -10, 20, 20).endFill()`。

`game.world` 是这些内容所在的层。`game.ui` 是盖在它上面、保持不动的层；做状态条或面板时把它作为最后一个参数传入，例如 `game.rect(240, 20, 480, 40, 0x000000, game.ui)`。任何精灵都可以当作层：在它里面创建的内容会跟着它一起移动、旋转、淡出和移除。`game.view.x` 和 `game.view.y` 决定看到世界的哪一部分，比舞台宽的关卡用 `game.view.x = hero.x - game.width / 2` 就能卷动。

**文字。** `const score = game.text('分数 0', { x: 240, y: 8, align: 'center' })` 画在 `ui` 层，创建后立刻可用；内容变化时设置 `score.text = '分数 ' + n`（直接给数字也可以）。`align` 说明 `x` 是文字的哪一部分：`'left'`、`'center'` 或 `'right'`。不指定时 `size` 为 24，`color` 为白色；之后可以用 `score.color` 和 `score.size` 修改。`y` 是文字的顶部，加上 `baseline: 'middle'` 则是文字的中线。文字里的 `\n` 会换行。`{ layer: 'world' }` 把文字放进世界层，例如命中后向上飘的数字；`{ layer: tile, align: 'center', baseline: 'middle' }` 把文字放在一个精灵上，位于精灵的原点，并跟着它移动。文字就是一个精灵，可以像精灵一样移动、淡出、缓动和移除。字体用页面自己的，设备上有中文、日文、韩文字体时就能显示。所有文字都画在少数几张共用的页上，所以一屏上百段短文字也不会超出一帧能容纳的图片数。`{ vertical: true }` 把文字从上往下写，各列从右往左排，用于标题或印文。`，。（）《》「」` 这类标点会换成竖排的形式，`\n` 开始新的一列，`{ vertical: { column: 4 } }` 让每列最多四个字。`align` 和 `baseline` 摆放整块文字，`text` 仍是原来给的文字。这是简化版：一个字在另一个字下面，中文和日文的字宽一致，所以列是直的。拉丁字母直立排列，不会旋转；段落还不支持竖排排版，也不给出列的几何。`verticalPlayWords(words, column)` 给出这段文字实际画出的各行。

用 `fontFamily`（一个已安装的字体族）、`fontWeight`（1–1000，优先于 `bold`）和 `italic` 设置短文字字形。`await score.ready` 等待当前文字、颜色、字号版本就绪；更新后重新读取该 Promise。未完成的版本若被替换、隐藏或移除，会以 `AbortError` 拒绝。就绪不表示帧已经呈现。轴对齐 UI 文字的栅格原点对齐实际像素；精灵声明位置和世界文字仍可连续移动。

## 输入

| 询问 | 回答 |
| --- | --- |
| `game.keys.down('left', 'a')` | 这些键里是否有按住的 |
| `game.keys.pressed('space')` | 自上次 update 以来是否按下 |
| `game.keys.released('space')` | 自上次 update 以来是否松开 |
| `game.keys.axis()` | 方向键和 WASD 合成的 `{ x, y }`，各自在 -1 到 1 之间，y 向下，长度最多为 1；手柄的左摇杆也算在内 |
| `game.keys.look()` | 手柄右摇杆的 `{ x, y }`，用于转视角或瞄准；没有手柄时为 0 和 0 |
| `game.pointer.x`、`.y` | 鼠标或手指的位置，用游戏单位（`ui` 层的单位）；不按键时也跟随鼠标 |
| `game.toStage(x, y)`、`game.fromStage(x, y)` | 把游戏单位的位置换成舞台上的位置（与 `localToGlobal`、`globalToLocal` 和悬停事件给出的一致），以及反过来。用 `fit: 'expand'` 时两者相差设计区域在舞台上的位置：在 390 × 844 的手机上，720 × 1280 的设计区域从第 139 个单位开始 |
| `game.pointer.down`、`.pressed`、`.released` | 是否按着、刚按下、刚松开 |
| `game.pointer.buttons`、`.pressedButtons`、`.releasedButtons` | 游戏表面的鼠标按键位掩码：1 主键、2 次键、4 中键，边沿位保留到下一次 update |
| `game.pointer.swipe` | 一次滑动结束后的那次 update 里为 `'left'`、`'right'`、`'up'` 或 `'down'` |
| `game.pointer.over(sprite)` | 指针是否在精灵画出的内容上 |
| `game.pointer.dx`、`.dy` | 自上次更新以来鼠标移动了多少屏幕像素，指针锁定时也照常计数 |
| `game.pointer.wheel` | 自上次更新以来鼠标滚轮转了几格，朝向玩家为正。游戏下面的页面不会跟着滚动 |
| `game.pointer.lock(options?)`、`.unlock()`、`.locked`、`.lockPending` | 在可信用户动作中申请画布指针锁定；`lock` 返回 Promise，其结果为 `status: 'locked' | 'denied' | 'canceled' | 'unavailable'`。`unlock` 取消待定申请并释放锁定；按 Escape 交还鼠标 |
| `game.onTap(sprite, () => …, { name })` | 精灵被点击或轻触时调用函数。精灵重叠时，前面的那个收到点击。有子节点、自己没有 `hitArea` 的精灵，在它的包围盒（含子节点的绘制）内都能点中，并随子节点移动；自己有绘制、没有子节点的精灵，仍按它画出的内容点中。给了 `name` 时，这个精灵同时是 `semantics` 里同名的按钮：位置与它画出的地方一致，它隐藏时从语义树里略去，它结束时随之消失；在语义树里激活它就等于点击它。函数可以是 `async` 的；它立即或稍后抛出的错误会像 `update` 抛出的错误一样让游戏停下 |
| `game.gestures(sprite, { hold, doubleTap, drag, swipe, pinch })` | 精灵上的长按、双击、带每一步位移的拖动、滑动和双指缩放，每个只报告一次，位置用游戏单位；返回停止识别的函数。变成拖动或长按的那一下不算点击。有子节点、没有 `hitArea` 的精灵按包围盒点中，与 `onTap` 相同。阈值见[手势](gestures.md) |
| `game.show(description, { state, bind })` | 用数据描述的界面：由面板、行和列组成，包含文字、按钮、进度条和开关，放在 `game.safe` 里，屏幕变化时重新摆放，竖握手机时可以换用竖屏部件。`bind` 让有名字的部件跟随 `state`（每帧读取），并响应按下。返回视图：`get(name)`、`rect(name)`、`show()`、`hide()`、`close()`。部件和绑定见[用数据描述界面](ui-views.md) |
| `game.confirm(question, { yes, no, title, skin, noColor })`、`game.hints(list)`、`game.loading(tasks)`、`game.badges`、`game.compact(n)`、`game.request(send)`、`game.device` | 可换行、适应安全区且可定主题的是非提问、按玩家设备显示按键的提示栏、计数的加载、累加的红点、数字缩写（12.3K、1.2万），以及按钮不能重复发出的请求。见[大多数界面都需要的部件](ui-views.md#大多数界面都需要的部件) |
| `game.dragAndDrop()` | `.source(sprite, { data, ghost })` 和 `.target(sprite, { drop, accepts, hover })`，各自返回移除函数，以及 `.dragging`。被拖的精灵留在原处，`ghost` 画出的图跟着手指显示在最上层；最里层且接受这份数据的目标接收它 |

点击回调可接受 `PlayTapActivation`，包含指针 `source`、`pointerId`、真实 Stage 坐标、变换可逆时的局部坐标、命中的显示对象 `target` 及当前监听者 `currentTarget`。语义激活没有指针坐标。点击默认仍冒泡；在回调中同步调用 `stopPropagation()` 可阻止继续到达祖先。对应的视图绑定见[声明式视图激活](ui-views.md#绑定)。

键的写法：`'left'`、`'right'`、`'up'`、`'down'`、`'space'`、`'enter'`、`'escape'`、`'shift'`、一个字母、一个数字，或 `KeyboardEvent.code`（如 `'KeyQ'`）。游戏运行时，方向键和空格不会滚动页面。鼠标还没移动时，指针位于舞台中心。按在舞台上、且下面没有按钮和带 `onTap` 的精灵时，`game.pointer.pressed` 为真：按在它们上面的那一下只属于它们，所以“按哪里就在哪里放东西”的游戏不会把东西放到自己的按钮下面。主指针按住期间，`game.pointer.down` 保持为真，包括按在按钮上的情况。鼠标位掩码独立记录多个鼠标键同时按着及分别松开，锁定时也一样。锁定状态变化、指针取消、窗口失焦或页面隐藏会清除鼠标按键快照。这些是输入状态，而不是第二套 UI 激活。

只有玩家明确要求原始位移时，才在可信用户动作中直接调用 `pointer.lock({ unadjustedMovement: true, signal })`；不传选项就沿用浏览器自身策略。被拒绝时不会自动改用另一种策略重试。Promise 只在本画布实际持有指针锁定时返回 `locked`；`unlock()` 或取消首次未完成申请所传的信号会取消该申请。并发调用共享首次申请的 Promise 和策略；其后的选项或信号不会替换首次申请。不让新的申请与已取消的宿主申请重叠：迟到的授予会释放，待宿主返回终态后才可用下一次操作重试。用 `locked` 观察之后的锁定丢失。

在 Play 画布上最先按下的指针负责驱动 `game.pointer`，直到该指针松开或被取消。拖动时，其他手指可点按独立的 UI 控件，拖动坐标、滑动起点和松手状态仍由原指针决定。原指针松开后，已经按住的手指不会自动接管。Galaxy Z Fold7（Android 17、Chrome 157）上的浏览器协议触摸已在 WebGL2 和 WebGPU 验证两种松手顺序、主指滑动、独立点按和取消。

## 声音

游戏自行管理音频时，给 `play` 或 `play3d` 传入 `audio: false`。在本次游戏的整个生命周期内，Play 跳过音频上下文的创建、首次交互解锁音频的监听，以及 14 个预设的合成和解码。后续调用 `sfx.define`、`sfx.play`、`sfx.loop` 或 `music.play` 都不会启动内置音频。循环音效返回已停止的句柄，可以再次安全地调用 `stop()`。自有混音器的暂停、恢复和释放由游戏负责；重开游戏会再次执行 `setup`，应复用同一个混音器。

显式设置 `audio: true` 或省略此项时，Play 会在 `setup` 前准备好预设。运行时临时静音仍可使用 `game.sfx.muted`。

`game.sfx.play('coin')` 播放一个用代码合成的音效。可用的名字有 `jump`、`coin`、`hit`、`hurt`、`explosion`、`shoot`、`powerup`、`bounce`、`pop`、`click`、`hum`、`wind`、`win` 和 `lose`。`game.sfx.play('coin', { volume: 0.5, pitch: 1.2 })` 只改变这一次播放。不存在的名字会以 `PLAY_SFX_UNKNOWN` 被拒绝，错误信息里列出全部名字。

**持续的声音。** `const engine = game.sfx.loop('hum', { volume: 0.5 })` 会一遍又一遍地播放一个音效，直到 `engine.stop()`；停止时默认用十分之一秒淡出，也可以给出秒数。车加速时设置 `engine.pitch = 1 + speed / 20`，播放过程中 `volume` 和 `pan` 也可以随时修改。`hum` 和 `wind` 是专为循环做的；用 `define` 定义的旋律可以循环成音乐，带 `seamless: true` 的音调在长度是整数个波时首尾相接不会有咔哒声。暂停会让所有循环停住，`restart` 和 `dispose` 会停止它们。

玩家按键或点击之前，浏览器不播放任何声音；在那之前请求的音效听不到，游戏照常进行。

`game.sfx.define('zap', { wave: 'saw', from: 1200, to: 200, seconds: 0.15 })` 添加一个音效。一个音有波形 `wave`（`'sine'`、`'square'`、`'saw'`、`'triangle'` 或 `'noise'`）、起始音高 `from` 和可选的结束音高 `to`（单位赫兹）、时长 `seconds`，以及可选的 `volume`（0 到 1）、`decay`（0 为保持，4 像拨弦，10 像一声嘀）和 `noise`（混入的噪声，0 到 1）。一组音依次播放，就是一小段旋律。`game.sfx.volume` 和 `game.sfx.muted` 作用于所有音效。

### Windows 启动实测

在 Windows、Chrome 157 和 RTX 5090 Laptop GPU 上，空白 WebGL2 页面在点击启动后调用 Play，并在 `setup` 中自建混音器。每次使用新的浏览器进程和配置目录，六组交错对照中有五组全程保持前台。开启内置音频时，页面创建两个上下文，解码 14 个预设；传入 `audio: false` 后，仅创建自有的一个上下文，预设解码为零。启动点击到浏览器合成画面首次出现目标颜色的中位数分别为 2726.4 ms 和 2602.7 ms。进入游戏后，第一次点击使像素变色的中位数分别为 9.4 ms 和 9.3 ms。这个用例在两种配置下的首次游戏操作均未触发上下文构造或预设解码。

在同一台电脑上用 WebGPU 运行《哪吒闹海》本地副本第一波，另做了三组对照。导航到标题页可操作的中位数从 830.8 ms 降至 717.7 ms。点击开始到首个包含模拟推进的 GPU 提交调用返回，中位数分别为 72.6 ms 和 72.2 ms。两种配置下，游戏均解码了自有的 23 个声音，其中一部分仍在点击开始后解码。

## 重叠

| 询问 | 回答 |
| --- | --- |
| `game.overlaps(a, b)` | 两个精灵画出的内容是否重叠，按舞台上的正放矩形计算 |
| `game.hits(a, list)` | 列表里第一个与 `a` 重叠的精灵，没有则是 `undefined` |
| `game.hitsAll(a, list)` | 列表里所有与 `a` 重叠的精灵 |
| `game.near(a, b, distance)` | 两者的中心是否在 `distance` 以内：圆形判定，例如半径为 6 和 14 时写 `game.near(bullet, enemy, 6 + 14)` |
| `game.pushOut(a, b)` | 要让 `a` 不再与 `b` 重叠，需要把 `a` 移动多少（走较短的方向）：`{ x, y }`，其中一个为 0；不重叠时是 `undefined` |

`overlaps`、`hits` 和 `hitsAll` 的第三个参数让双方每一边都缩进这么多单位，判定更宽松。用 `visible = false` 隐藏的、已移除的或什么都没画的精灵不与任何东西重叠；`alpha` 为 0 的精灵仍然会重叠。精灵不会和自己碰撞，所以列表里可以包含它自己。

瓦片关卡只需一次调用：`const map = game.tiles(['##########', '#........#', '##########'], { size: 32, x: 0, y: 0, colors: { '#': 0x445566 } })` 把这些行画成一个精灵 `map.sprite`，左上角在 `x`、`y`。除非用 `solid` 指定实心字符，否则 `#` 是实心的；没有指定颜色的字符不画。`map.pushOut(hero)` 给出把精灵移出它重叠的实心瓦片需要的距离，`{ x, y }` 或 `undefined`，先移出重叠最多的那块；`map.solidAt(x, y)` 和 `map.cellAt(x, y)` 读取所在图层上的一点，`map.at(column, row)` 读取一个格子，`map.set(column, row, '.')` 修改一个格子并重画地图。`game.mix(a, b, t)` 是从颜色 `a` 到 `b`（都是 `0xRRGGBB`）走 `t` 那么远的颜色。

角色站在平台上、被墙挡住，用的就是 `pushOut`：

```js
hero.y += vy * dt;
for (const block of blocks) {
  const push = game.pushOut(hero, block);
  if (!push) continue;
  hero.x += push.x;
  hero.y += push.y;
  if (push.y < 0) { vy = 0; onGround = true; }   // 被向上推：落地了
  if (push.y > 0) vy = 0;                         // 被向下推：撞到头了
}
```

## 时间

| 调用 | 作用 |
| --- | --- |
| `game.after(seconds, fn)` | 游戏进行这么久之后调用一次 `fn`。返回一个用来取消它的函数 |
| `game.every(seconds, fn)` | 每隔这么久调用一次 `fn`。返回一个用来结束它的函数 |
| `game.tween(sprite).to({ x: 100, alpha: 0 }, 0.3, 'quadOut')` | 让对象的数值从当前值随时间变化，自动开始。可以接着写 `.to`、`.wait(seconds)`、`.call(fn)`、`.loop(times)` 和 `.onFinish(fn)`。缓动：`linear`、`quadIn`、`quadOut`、`quadInOut`、`cubicOut`、`backOut`、`elasticOut`、`bounceOut`，以及 [`animate`](api-reference.md) 的其余缓动 |
| `await game.tween(sprite).to({ y: 200 }, 0.2).done` | 等一个缓动结束，这样在 `async` 函数里可以一步接一步 |
| `await game.wait(seconds)` | 等游戏进行这么久 |
| `game.time` | 游戏已进行的秒数 |
| `game.timeScale = 0.5` | 慢动作；1 为正常速度 |
| `game.pause()`、`game.resume()`、`game.paused` | 停止和恢复 update 与定时器。暂停时不调用 `update`；按钮的 `onTap` 仍然会调用，暂停的游戏就靠它恢复 |
| `game.restart()` | 移除世界层和 `ui` 层里的所有内容，取消定时器和缓动，然后重新运行 `setup` |

请用这些而不是 `setTimeout`：暂停、顿帧和页面被隐藏时，它们会和游戏一起停下。

## 打击效果

| 调用 | 作用 |
| --- | --- |
| `game.shake(amount = 6, seconds = 0.25)` | 让世界层最多晃动这么多单位；`ui` 层不动。`game.reducedMotion` 开启时不晃动 |
| `game.reducedMotion` | 为要求减少动态效果的玩家减少动态：不晃动，闪光变淡。默认跟随系统的 `prefers-reduced-motion`，可由 `reducedMotion` 选项或设置菜单改变 |
| `game.flash(color = 0xffffff, seconds = 0.15)` | 用一种颜色盖住舞台，然后淡出 |
| `game.hitStop(seconds = 0.06)` | 让游戏停顿一下：没有 update，也没有定时器 |
| `game.burst(x, y, { color, count, speed, life, size, gravity })` | 从世界层的一点向外抛出碎片。不指定时是 12 个白色碎片 |

补间、定时器和 `update` 使用同一份游戏时间。暂停或将 `timeScale` 设为零会保持它们的进度，`hitStop` 会在指定时间内保持进度。画面绘制和输入继续运行，因此界面可以恢复暂停中的游戏。回调中暂停、重开或关闭游戏，会阻止旧更新继续执行。当前循环是 `game.browser.loop`。关闭游戏会停止待执行的补间，多次调用 `dispose()` 会等待同一次清理。

初始化期间多次调用 `game.restart()` 会得到同一个 Promise，`setup` 只执行一次。初始化成功后才恢复游戏更新。如果 `setup` 抛错或返回被拒绝的 Promise，重开会将错误返回给调用方并清理本轮已经创建的场景内容。再次调用 `restart()` 可以重试。当前重开要等 `setup` 返回才能完成，因此应在 `setup` 外等待这次重开。

初次初始化或重开期间，即使应用的加载仍在等待，`game.dispose()` 也能关闭游戏。被中断的启动或重开会以 `SCOPE_CLOSED` 拒绝。之后才完成的加载无法通过已经关闭的 SDK 句柄挂接游戏对象或恢复更新。外部下载由应用负责取消。

## 图片

`await game.image(url, { x, y, width, height, smooth, layer })` 读取图片，以中心放在 `x`、`y`，默认使用 world 层。PNG 沿用严格校验。JPEG、WebP、GIF 和 AVIF 由支持相应格式的浏览器解码。引擎根据文件字节识别格式。每个游戏最多同时读取四张图，每张编码数据上限为 8 MiB。关闭游戏时会取消未完成的网络读取，并释放取消后才返回的解码结果。

只给 `width` 或 `height` 之一会保持比例，都省略时使用原尺寸。默认缩小绘制时使用[多级缩小副本](shared-render-profile-contract.md)。像素风可以使用 `smooth: false`。同一地址的图片在纹理租约有效时共享纹理。

HTTP 状态失败时保留错误链 `ASSET_LOAD_FAILED` → `WEB_PNG_READ_FAILED` → `BROWSER_GAME_IMAGE_FAILED`，可以用原地址重试。在 Chromium 157 软件 WebGL2 验证中，同一个 `.png` 地址第一次返回 404，第二次返回标成 PNG 类型的 WebP 字节，成功生成 48 × 32 的图片。

## 文字、菜单与血条

剧情对白、标题菜单和血条，是大多数游戏都要自己画的部分。Play 现在自带这些，全部由游戏自己 ui 层上的精灵和文字组成，所以重开时会一并清掉，键盘、指针和手指都能操作。

```js
async setup(game) {
  hp = game.bar({ x: 12, y: 12, width: 140, value: 4, max: 4, color: 0xef4444 });
  if ((await game.menu(['开始', '静音开始'], { title: '夜院' })) === 1) game.sfx.muted = true;
  const answer = await game.say('你愿意把灯笼重新点亮吗？', { who: '看守', choices: ['我去。', '凭什么？'] });
},
update(seconds, game) {
  if (game.asking) return; // 对白框或菜单打开时
  // ...
  hp.value -= 1;           // 血条滑下，并留下一段淡色残影
  game.toast('点亮了一盏灯');
}
```

- `game.bar({ x, y, width = 120, height = 12, value, max = 1, color, back, layer })` 是一个精灵，`x`、`y` 为左上角。设置 `value` 后会滑到该值，范围在 0 到 `max` 之间。
- `game.toast(words, { seconds = 2, color })` 仍在顶部显示一条会淡出的提示，多条会叠放。返回的句柄具有 `active`、`bounds`（按舞台单位报告可见卡片）、`close()`。
- 可定位提示始终在安全区内，转屏或视图缩放时跟随锚点。例如：`game.toast('已保存', { color: 0xf3edde, background: 0x284e3d, backgroundAlpha: 1, borderColor: 0x88612f, placement: { anchor: 'top-right', offsetX: 8, offsetY: 64, maxWidth: 240, fontSize: 16, foreground: true } })`。偏移和尺寸默认使用 UI 单位，可显式指定 `units: 'stage'`；上、下分别支持左、中、右，共六种锚点。前景提示位于普通视图之上，而非转场遮罩之上，不改变焦点、不拦截指针。文字在卡片内换行，叠放超出安全区时优先显示最新提示。可定位提示使用 UI 帧时间，即使玩法暂停也能正常消失。`persistent: true` 持续显示，替换状态后关闭对应句柄。队列最多十六条、换行最多十二行，工作量有明确上限。旧版不定位提示的样式和计时保持不变。
- `await game.say(words, { who, choices, color, speed = 40 })` 在底部打开对白框，文字按每秒 `speed` 个字逐字出现，并按框宽换行。空格、回车、Z 或轻触会显示剩余文字，再按一次关闭，返回 `undefined`。带 `choices` 时，文字全部出现后显示选项；方向键或 W、S 以及摇杆移动选择，回车、空格、Z 或轻触确认，返回选项序号。对白框打开期间再请求的对白会排队。超出一个框容量的文字会分到后续的框里，每个框按一次关闭，选项随最后一个框出现。
- `await game.menu(items, { title, x, y, width, color })` 在舞台中间（或 `x`、`y` 处）打开一个列表，以同样方式选择并返回序号。新菜单会关闭正在打开的菜单，被关闭的菜单不返回结果。
- `game.asking` 表示是否有对白框或菜单打开。

游戏暂停时它们仍可操作，`setup` 也可以等待它们：等待期间照常绘制画面，但 `update`、计时器和缓动要等 `setup` 结束后才开始。重开会移除它们，正在等待的结果不再返回。对白文字按行只绘制一次，再逐字揭开遮罩，不会每帧重绘。`examples/play/story.mjs` 用到了以上全部功能。

## 手机、手柄与音乐

为键盘写的游戏，加上屏幕上的控件就能在手机上玩，接手柄则什么都不用改：

```js
game.touchStick();                                            // 计入 game.keys.axis()
game.touchButton('A', { x: 430, y: 230, key: 'space' });      // 手指按住时相当于按住空格
if (game.keys.pressed('space', 'pad:a')) jump();              // 手柄下方的面键
game.music.play('mystery');
game.music.intensity = lanterns / 3;                          // 强度越高，加入的声部越多
```

- `game.touchStick({ x, y, radius = 48, always })` 和 `game.touchButton(words, { x, y, key = 'space', radius = 32, color, always })` 画在 ui 层之上，对白框不会遮住它们；手指第一次触碰舞台后才显示，带 `always` 时立即显示。每根手指在抬起前一直控制它按下时的控件，所以一个拇指按摇杆、另一个按按钮可以同时进行。从别处开始的触摸仍是游戏的指针。
- 第一个标准布局手柄的按钮是名为 `pad:a`、`pad:b`、`pad:x`、`pad:y`、`pad:l1`、`pad:r1`、`pad:l2`、`pad:r2`、`pad:select`、`pad:start` 以及 `pad:up`、`pad:down`、`pad:left`、`pad:right` 的键，`down`、`pressed` 和 `released` 都能用。十字键计入 `keys.axis()`；`pad:a` 和十字键可以操作对白框和菜单。
- `game.music.play(mood)` 用代码写一段乐曲（`'calm'`、`'mystery'`、`'tense'`、`'battle'` 或 `'triumph'`），也可以传 `{ mood, seed, tempo, bars }`。乐曲由等长的四个声部组成：持续和弦、贝斯、鼓和旋律，一起循环播放；正在播放的乐曲会淡出。`game.music.intensity`（0 到 1）依次加入贝斯、鼓和旋律，过渡约一秒半。`volume` 默认 0.6，音效的音量和静音同样作用于音乐。`stop(seconds)` 淡出停止。暂停时保持，重开时停止。需要样本数据的游戏可以直接用导出的 `composeMusic` 和 `musicMix`。

第一次 `setup` 等待的菜单或对白框一打开就会开始绘制画面，所以能被看到并操作；否则画面仍在 `setup` 结束后才开始，与以前相同。

### 浮动触屏摇杆

传入 `floating` 后，玩家在战场区域内按下的位置就是摇杆中心。示例给右上角的暂停按钮保留了正常输入。

```js
game.button('暂停', { x: 444, y: 28, width: 64, height: 48 }, () => game.pause());
game.touchStick({
  radius: 48,
  floating: {
    area: { x: 0, y: 0, width: 480, height: 270 },
    deadZonePx: 8,
    exclude: (x, y) => x >= 412 && y <= 52,
  },
});
```

`area` 和 `exclude(x, y)` 使用与 `game.button()` 相同的游戏坐标。布局会变化时，可以让 `area` 接收一个返回区域的函数。`radius` 以游戏单位指定摇杆行程。`deadZonePx` 默认是 8，以 CSS 像素测量触点距起点的距离。画布缩放和设备像素比变化时，页面上死区的大小保持一致。通过 `game.keys.axis()` 读取方向。

摇杆圆环在有触点控制时显示。第一个符合条件的触点拖出画布后仍可操控，第二个触点可以操作其他控件。抬起控制手指、取消触点或暂停时，摇杆方向立即归零。打开模态界面、对白或菜单时，在下一次输入处理前清除摇杆方向。恢复游戏或关闭模态界面后，需要重新按下才能操控。省略 `floating` 即可继续用 `x`、`y` 和 `always` 设置固定摇杆。

构建工作区后，运行 `node examples/play/verify-floating-stick.mjs <Playwright index.mjs 的绝对路径> <新输出目录的绝对路径> <Chromium 可执行文件的绝对路径> [webgl2|webgpu]`。夹具通过 Chromium 的触摸输入协议验证画布缩放后的 CSS 像素死区、触点归属、画布外捕获、暂停恢复以及打开模态界面或菜单后仍按着的触点退出操控。

## 随机与存档

`game.random` 给出的数字在 `seed` 相同时可以重复：`int(1, 6)`、`range(0, 1)`、`chance(0.25)`、`pick(list)`，以及 `shuffle(list)`，它返回一个新列表，不改动传入的列表。

`game.save('best', score)` 把一个值以 JSON 形式保存在页面的存储里，`game.load('best', 0)` 把它读回来，没有时返回第二个参数。页面没有存储时，值只在这次访问期间保留。

## 页面

```html
<!doctype html>
<meta charset="utf-8">
<script type="importmap">{ "imports": { "@egret/engine/play": "…/web/play.js", … } }</script>
<script type="module">
  import { play } from '@egret/engine/play';
  await play({ width: 480, height: 270, setup(game) { … }, update(dt, game) { … } });
</script>
```

不需要别的东西：`play` 会创建画布并让它占满窗口，保持舞台的比例，窗口比例不同时两侧留边。

页面也可以把引擎作为[一个文件](single-file.md)使用，不需要 import map：`<script src="egret2d.js"></script>`，然后 `const { play } = Egret;`。[play 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.zh-CN.md)里有三个完整的游戏。

## 三维

[`play3d`](play3d.md) 就是下面垫了一个由方块、球和地面组成的世界、带跟随相机和太阳的它：按键、指针、声音、时间、文字和按钮都一样。

## 游戏变大之后

`game.canvas` 是 `play` 绘制用的画布：传入的 `canvas`，或它在 `parent` 或页面里创建的那一个。`game.browser` 是它所基于的[浏览器游戏](browser-game.md)，自身没有画布；`game.engine` 和 `game.scope` 是它的 Engine 和 scope。从这里可以使用所有入口：图片和图集、[2D 相机](camera-2d.md)、[瓦片地图](tilemap.md)、带贴图的[粒子](particles.md)、[2D 物理](physics-2d.md)、[界面控件](ui-controls.md)、[带手柄的按动作输入](game-kit.md)和 [World3D](world3d.md)。它们创建的内容可以和 `play` 创建的一起加进 `game.world` 与 `game.ui`。

## 11 月 27 日真机补验

11 月 27 日实测：Windows 与 Fold7 双后端覆盖 100 个短标签、独立图像预算恢复、500 标签父节点移除、选定视图/输入及竖排中文；具体范围与保留的视图辅助测试断言见记录。 [真机观测及剩余范围](november-27-claude-hardware.md). 另在独立重建的 #516 上确认双终端双后端关闭视图独立缩放时，覆盖层保持世界坐标及点击。
