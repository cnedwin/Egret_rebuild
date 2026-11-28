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
| 悬停和鼠标滚轮（如果要求） | `game.hover` | `createBrowserHoverInput`，见[悬停输入](pointer-hover.md)；滚动控件的 `wheel` 用它 |
| 帧循环 | `game.loop` | `createBrowserFrameLoop`，见[帧循环](frame-loop.md) |
| 面板（如果要求） | `game.stats` | `createBrowserStatsPanel`，见下文 |

`await game.loadTexture(url)` 加载图片并给出其纹理的租约，可用于 `new Bitmap(lease)` 或 `graphics.beginBitmapFill(lease)`；租约属于 `game.scope`，同一地址加载两次得到同一张纹理。PNG 使用严格解码器；其他识别为浏览器图片的格式（JPEG、WebP、GIF、AVIF）采用浏览器解码。上述格式之外的源素材请使用[内容构建](content-build-pipeline.md)。`game.host` 是 Host，可读取它的状态。

**有界图片准入。** 单个游戏最多同时接纳四个不同的图片操作（网络读取、编码字节检查、解码及退休）。额外最多 256 个等待操作，按照 FIFO 次序进入，不提前发出网络请求或占用已解码图片额度。所属资源取得操作取消时，尚在等待的操作会被移除；游戏 Scope 释放也取消剩余等待工作。进行中的操作取消后仍保留占用，直到其原始网络/解码工作实际结束，不能因取消提前退还原生工作额度。等待队列已满时，新请求的资源失败原因是 `WEB_PNG_JOB_LIMIT`（指出等待队列上限）。既有单图编码／解码限制、严格资源／manifest provider 的独立准入机制保持不变。普通头像组可直接 `await Promise.all(urls.map(url => game.loadTexture(url)))`，无需应用自己实现四并发节流，但仍受有限队列及资源限制约束。

`tests/browser-game.test.mjs` 中的队列回归通过公开 BrowserGame API 暂时扣住真实回环 HTTP 响应：第五、第六次请求只有在前面的占用释放后进入，等待上限明确，释放游戏时尚未进入的请求不会发出。该受控宿主验证准入和生命周期，不证明原生解码像素或浏览器性能基线。

**代码画出的贴图。** `await game.textureFromCanvas(canvas)` 给出画布此刻内容的纹理租约——开局画好的粒子光点、木屑、位图字体页都可以；`await game.textureFromPixels(width, height, pixels)` 给出 RGBA 字节的纹理租约，行从上到下，alpha 未预乘，与 `ImageData` 相同。每次调用都是一张独立的纹理，租约属于 `game.scope`，租约结束时纹理随之结束。WebGL 画的画布会先复制到一张 2D 画布上再读。单边最多 4,096 像素，总数最多 4,194,304；更大的图请用 [`@egret/engine/web/kit` 的 `textureFromCanvas`](browser-images.md)，它会等比缩小，给出的是纹理本身而不是租约。

**文本。** `const label = await game.createLabel({ text: '金币 0', fontSize: 14, color: 0xf0c030, locale: 'zh' })` 创建一行文本；把 `label.display` 加到舞台上并定位，之后文字变化时设置 `label.text`。新文字准备好后才画出来，在此之前保留旧文字；`await label.ready` 可以等它完成。可以同时创建或修改任意多个 label：它们每次画两个，其余排队；正在绘制时文字又变了的 label，接着画最新的文字。`ready` 之后，`label.display.width` 和 `.height` 就是文字的大小，所以 `label.display.x = centre - label.display.width / 2` 可以让它居中。字体用页面自己的：系统字体族，或页面已加载的字体。label 默认属于 `game.scope`，`scope` 可以指定别的：在 UI 叶子内容的 `prepare` 里写 `game.createLabel({ text: '声音', scope: context.scope })`，得到的 label 就能放进这个叶子，并随那个 scope 一起结束。第一个 label 会加载页面的文本光栅化器，所以 import map 需要 `@egret/engine/text`、`@egret/engine/web/text` 和 `@egret/runtime/text`。

**很多短标签。** `createLabel` 的每个 label 都是一张独立纹理，显示期间还占着文本缓存里的一个位置。缓存最多容纳 64 段不同的文字、128 个 label，而一帧最多从 64 张不同的图片里取图。五十个字签再加一个场景，就会超出这些上限。`await game.createAtlasLabel({ text: '仵作' })` 接受同样的选项，摆放方式也一样：`label.display` 是一个精灵，`label.bounds` 是文字的框（`label.display.x = centre - label.bounds.width / 2`），`text`、`set`、`ready`、`setRasterActive` 和 `dispose` 与上面相同。它的文字由同一个缓存画出，再复制到一张页上，与同时画出的文字共用这张页，缓存里的位置当即归还。2026 年 11 月 26 日在无头 Chromium 里，100 段不同的两字文字全部画出，只用到一张页；换成 `createLabel` 的 label，有 13 段没有画出来，而且没有任何提示。[play](play.md) 的 `game.text` 就用这种方式画字。共用的页达到 16 张时，所有 label 的文字会重新打包到尽量少的页上。等同时画的 label 都交出文字后才做成一张页，最多等四分之一秒。

**限宽标签和明确的候选字体。** `createParagraphLabel` 使用原生 Paragraph，不再由游戏把若干测算出来的短标签拼在一起。传入以舞台单位计量的换行宽度 `width`，以及可选的行高 `lineHeight`、对齐 `textAlign` 和最大行数 `maxLines`。现有 Canvas 段落提供者按实际字体测量和换行，包括中、日、英文的断行规则；限制行数时使用它的固定省略号。等待 `label.ready` 后，`label.metrics` 是已提交的段落度量（包括各行和有行数上限时的 `truncated`），`label.bounds` 是逻辑宽高。新请求准备期间旧图和旧度量一起保留；修改之后重新读取 `ready`，被下一请求取代的 Promise 以 `PARAGRAPH_STALE` 拒绝。用 `set({ maxLines: undefined })` 取消行数限制。标签持有同一个原生 Paragraph 显示对象，使用本游戏的段落缓存，随指定 scope（默认为 game.scope）结束。它支持现有 Canvas 段落提供者的左到右、普通字重样式；其他文字排版或丰富字体样式请配置其他段落提供者。不会增加 HTML 文字控件。

```js
const description = await game.createParagraphLabel({
  text: 'Choose a charm · 选择法宝', width: 180, fontSize: 14,
  fontFamilies: ['Noto Sans SC', 'Arial', 'sans-serif'], locale: 'zh', maxLines: 2
});
game.stage.addChild(description.display);
await description.ready;
description.set({ width: 120 });
await description.ready;
```

每个候选项是一个字体名称，而非 CSS 表达式；使用有顺序的 `fontFamilies` 数组或者单名称 `fontFamily`，不可同时提供两者。原来的 `createLabel`、`createAtlasLabel` 仍将 `fontFamily` 当作字面字体名称，包括其中的逗号。字体选择依赖浏览器实际字体系统；不证明字形覆盖情况，也不代替应用加载字体。采用本方式时浏览器 import map 增加 `@egret/engine/paragraph` 和 `@egret/runtime/paragraph`；首次请求段落标签才加载提供者和缓存。

**变动数字不用重做字体纹理。** 初始化时生成一张固定字宽、可复用的字形图页，然后使用常规[位图字体](bitmap-font.md)。在选中的浏览器字体中测量每个字形，绘制一次白色填充、可选描边，并留透明边距。允许 1～64 个互异的 Unicode 码点、1～128 像素的字号，及可选的 `fontFamilies` 候选名单、`fontWeight`、`italic`、`strokeWidth` 和 `strokeColor`；重复字符或超限图页会被拒绝。独立码点适合数字、计时器和短符号，不用于需要上下文整形的文字。返回的 `font` 与 `pages` 可直接传给 `createBitmapText`。更新文字时只构建原有位图文字的网格几何，不需要重新光栅化字体或创建新的字体纹理；多个计数器共用这一不可变图页。图页归指定 scope（默认 game.scope）所有，先结束全部借用它的位图文字，再通过 `dispose()` 释放字体或结束其 scope。位图文字的颜色也会乘到描边上。像素字号是图页分辨率，可将显示节点缩放到需要的舞台尺寸。

```js
import { createBitmapText } from '@egret/engine/bitmapfont';
const counters = await game.createGlyphFont({
  characters: '0123456789:/+-', fontFamilies: ['Arial', 'sans-serif'],
  fontSize: 32, fontWeight: 700, strokeWidth: 1, strokeColor: 0x182238
});
const score = game.scope.use(createBitmapText({ ...counters, text: '0/100' }));
score.display.scaleX = score.display.scaleY = 0.5;
game.stage.addChild(score.display);
score.text = '37/100'; // 使用同一张图页
```

使用本能力时 import map 需要 `@egret/engine/bitmapfont`。公共控制测试 `tests/browser-game-text.test.mjs` 验证基于度量的换行与省略、候选名单顺序、归属及请求切换、原有字面字体名称，以及 120 次数字更新没有增加字体光栅化。它验证行为和资源生命周期，不等同于实际字体覆盖或真实设备帧率的验证。

**label 随它的显示对象一起结束。** label 的 `display` 被销毁，或者从某个父节点上取下后那个父节点被销毁，这个 label 会在下一帧结束，归还它在文本缓存里的位置。显示对象与父节点属于不同的 scope 时，父节点销毁只会把它取下，不会销毁它；这里处理的就是这种情况。`game.getLabelStatus()` 会先结束这样的 label 再计数。一个父节点下的 500 个 label 被移除后，缓存里不再有任何 label 的位置，只剩它为复用保留的 31 个光栅。

**一帧的图片。** 一帧最多从 64 张不同的图片里取图，最多 4,096 个矩形，共 64 MiB。`game.getFrameUsage()` 给出上一帧用到的量：`pages`、`regions`、`imageBytes`、`limits`，以及 `refusedFrames`。超出上限的帧不画，循环照常继续：屏幕上保留上一帧，直到有一帧放得下。给了 `onWarning` 时：
- 一帧用到某项上限的五分之四时，告知 `FRAME_IMAGES_NEAR_LIMIT`；
- 有帧没画时，告知 `FRAME_IMAGE_BUDGET`；
- label 占用文本缓存的五分之四时，告知 `LABEL_CACHE_NEAR_LIMIT`；
- 有 label 的文字画不出来时，告知 `LABEL_NOT_DRAWN`；
- `play` 的 `update` 在最近 60 帧里每帧都新建文字、形状或精灵时，告知 `PLAY_MADE_EVERY_FRAME`：这些应当建一次，之后只修改。

每种告警只在开始时告知一次，不会每帧都告知，引擎也不往控制台写任何东西。游戏自己写循环时，可以用 `game.drawFrame(frame)` 按同样的方式画一帧。

**给工具的告警。** 页面的 `globalThis.__egretAgent` 上有 `warning(warning)` 函数时，无论游戏有没有给 `onWarning`，每条告警也会告诉它。`tools/verify-game.mjs` 在游戏启动前放上这个对象，并在报告的 `engineWarnings` 里列出收到的告警，这样智能体能看到接近上限的帧、每帧新建的文字这类游戏自己没有要求告知的问题。这个函数抛出的错误属于工具自己，不会再告知。

**给工具的 insets 和控件。** 页面的 `globalThis.__egretAgent` 上有 `insets`（`{ top, right, bottom, left }`，单位是窗口的 CSS 像素）时，除非游戏自己给了 `insets`，游戏会用它代替页面自己的值作为窗口的安全区 insets。无头浏览器没有刘海，`tools/verify-screens.mjs` 就是这样代替刘海的。`play` 游戏还会大约每秒四次调用这个对象的 `controls(controls, { safe, canvas })`，传入每个正在显示、接受点击的节点：它的名字和它在页面上的矩形，单位是 CSS 像素。盖满整块画布的节点（例如模态视图的遮罩）不传入，被它盖住的节点也不传入。`safe` 和 `canvas` 也是页面上的矩形。这两个函数抛出的错误都属于工具自己。

**画布适配。** 给了 `fit` 之后，游戏会把画布居中放在它的元素里，并在该元素大小变化时重新调整。这个元素需要有自己的大小：高度由画布撑开的元素没有可适配的尺寸。`'cover'` 时画布比元素大，元素应当隐藏溢出的部分。`'cover'` 和 `'stretch'` 时舞台保持自己单位的宽高。`'contain'`、`'expand'` 和白鹭 5 的 fixed 模式下，舞台跟随[屏幕适配的结果](screen-fit.md)：`game.screen` 是当前结果，`game.onScreenChange(listener)` 在结果变化时通知，舞台在高窗口时换成竖版尺寸，`'expand'` 和 fixed 模式下铺满元素。`wholeScale: true` 时每个单位是整数个设备像素，适合像素风。任何模式下指针位置都跟随画布。
`game.frame` 是循环绘制的那一帧；`game.toStage(clientX, clientY)` 把页面上的位置（页面的指针事件给出的坐标）换算成舞台上的位置。

**触控区。** 手指大约需要 44 个 CSS 像素。`game.unitsPerCssPixel` 是按画布当前显示大小，一个 CSS 像素等于多少舞台单位；`game.padHitArea(node, cssPixels = 44)` 给节点一个至少这么大的点击区域，以它画出的内容为中心，且不小于画出的内容，所以手机上缩小显示的画布里，一个 20 单位的图标也容易按到。祖先节点缩放、镜像或旋转时，点击区域仍覆盖所需的 CSS 正方形。修改节点或祖先的变换、绘制边界或画布尺寸后，请重新调用。如果变换把图标压成一条线或一个点，屏幕上就没有二维点击区域。

## 选项

| 选项 | 含义 | 省略时 |
| --- | --- | --- |
| `canvas` | 用来绘制的画布。它在屏幕上的大小由页面决定 | 必填 |
| `width`、`height` | 舞台大小，使用游戏自己的单位：大于 0 的整数 | 必填 |
| `backend` | `'auto'`、`'webgpu'` 或 `'webgl2'` | `'auto'` |
| `pixelRatio` | 画布自身宽度的每个单位对应多少画布像素 | 设备的像素比，最多 2；`wholeScale` 时为 1，且不接受其他值 |
| `clearColor`、`clearAlpha` | 每帧先清成什么颜色 | `0x000000` 和 1 |
| `update(seconds)` | 游戏的一步，在每帧之前调用 | 没有这一步 |
| `onWarning(warning)` | 告知接近图片上限的帧、因超限没画的帧、接近文本缓存上限的 label，以及没画出来的文字：`{ code, message, usage?, cause? }` | 不告知 |
| `onError(error)` | 循环被什么停下时收到通知；Engine 只能上报的错误也会通知，例如点击的监听函数抛错并因此结束了指针输入 | 失败会抛出或上报给页面，在控制台能看到 |
| `pointer`、`keyboard` | 给 `false` 则不创建该输入 | 两者都创建 |
| `hover` | 给 `true` 则创建悬停和滚轮输入，即 `game.hover`；只有这时才加载它的模块 | 不创建悬停输入 |
| `stats` | 给 `true` 则显示面板 | 没有面板 |
| `fit`、`fitTo` | 画布怎样填充一个元素：`'contain'` 完整放入，`'cover'` 盖满，`'stretch'` 拉伸成它的形状，`'expand'` 用围绕设计区域延伸的舞台铺满它，或按白鹭 5 的 `'fixedWidth'`、`'fixedHeight'`、`'fixedNarrow'`、`'fixedWide'`。`fitTo` 就是那个元素 | `'none'`，以及画布的父元素 |
| `portrait`、`insets` | 在 `'none'`、`'cover'`、`'stretch'` 以外的模式下：元素高大于宽时的舞台大小，以及挡住边缘的部分（CSS 像素）。见[把舞台适配到屏幕](screen-fit.md) | `width` × `height`，以及页面的 `safe-area-inset` 值 |
| `wholeScale` | 同样的模式下：每个单位是整数个设备像素，画布按每单位一个像素绘制并清晰放大，其余部分是黑边 | `false` |
| `autoStart` | 给 `false` 则由 `game.loop.start()` 启动循环 | 循环立即启动 |

无效的选项在创建任何东西之前就以 `BROWSER_GAME_OPTIONS_INVALID` 被拒绝。

**`'auto'` 怎样选择。** 浏览器有 `navigator.gpu` 并且给出适配器时用 WebGPU，否则用 WebGL2。先请求适配器，再碰画布，因为一个画布一旦取得某种上下文就不能再换。如果选了 WebGPU 而它的设备随后失败，这次调用以 Host 自己的错误失败，不会回退：那个画布已经不能再交给 WebGL2。没有适配器的环境（例如无头浏览器）里，浏览器在被询问时可能自己往控制台写一条 "No available adapters."，这不是页面的错误。凡是"有控制台错误就不过"的验收，请显式给 `backend: 'webgl2'`。

## 面板

```text
webgl2
fps 60.0  longest 17.1 ms
commands 6  draws 2  triangles 12
geometries 0  pages 0
pending 0  drawn 1204  skipped 3
```

| 行 | 显示 |
| --- | --- |
| `fps`、`longest` | 自上次刷新文字以来，显示器每秒的帧数，以及相邻两帧之间最长的间隔 |
| `commands`、`triangles` | 最近绘制的一帧包含什么：绘制命令数，以及它们画出的三角形数。一个矩形或一张图片是两个三角形 |
| `draws` | Host 为最近一帧实际发出的绘制调用次数，来自 `host.getFrameDrawCalls()`：各个合批、每个效果各一遍、再加一次把帧复制到画布。合批会让它小于 `commands` |
| `geometries`、`pages` | 该帧中不同的网格几何体数和不同的图片数 |
| `pending` | Host 持有的尚未完成的帧数 |
| `drawn`、`skipped` | 循环已绘制的帧数，以及因 Host 已持有两帧而跳过的帧数 |

- **命令数不是绘制调用次数。** Host 会把同一图片、同一材质上连续的命令合成一次绘制。`commands` 是 Engine 要求画的内容，`draws` 才是 Host 实际发出的绘制次数。
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

## 保留在 GPU 中的背景（WebGL2，显式启用）

向 `createBrowserGame` 或 `play` 传入 `staticLayers: true`。实际使用 WebGL2 的游戏才会提供 `game.staticLayers`（Play 中是 `game.browser.staticLayers`）。未启用或实际使用 WebGPU 时该能力不存在，可继续使用普通绘制路径。这里使用 WebGL2 宿主实际的[缓存图层目标](webgl2-executor-contract.md#可缓存的-2d-图层)，不是 CPU 画布缓存，也不会在每次放置时重新上传纹理。

使用 Engine 捕获地图块或静态绘制组，透明清屏且不包含动态人物。宿主只接收其契约允许的图层绘制内容。例如在初始 setup 阶段，舞台上只有隔离的背景时：

```js
const cache = game.browser.staticLayers; // Play: backend: 'webgl2', staticLayers: true
if (cache) {
  const layer = cache.createLayer();
  const source = game.engine.captureSharedFrame({
    width: 128, height: 64, clearColor: 0, clearAlpha: 0,
    outputAlpha: 'premultiplied'
  });
  await layer.update(source);
  // 就绪以后才把背景源的显示节点从实时舞台移走。
  game.world.removeChild(backgroundSource);
  cache.setPlacements([{ layer, x: 0, y: 0, width: 128, height: 64 }]);
}
```

合成按数组的绘制顺序进行，**在所有普通舞台绘制之前**，使用舞台坐标。角色、需要交错遮挡的物件、界面和命中区域仍在普通显示树中。缓存图层不是触控对象，不会自动跟随镜头或世界变换。移动镜头时只改放置位置；地图块变化时，用新的真实捕获更新这个块，等待 `layer.update` 完成后重新调用 `setPlacements`（即使位置没变也要调用）。新版本准备好前仍保留原有就绪纹理。设置放置时复制坐标和效果，检查图层属于本缓存且已就绪，并唤醒按需绘制的 Play。效果、颜色混合、裁剪、尺寸、放置数量及内存限制沿用宿主契约；使用效果需要开启游戏的 effects 选项。

释放图层前将其从放置列表清除。原生上下文丢失后，图层变为 stale：清空或替换放置列表，等待 `cache.whenReady()`，再用保留的源配方重新烘焙、放置。游戏结束时关闭宿主并释放其缓存图层。本接入不自动捕获子树，不支持任意前后交错合成、局部帧缓冲重绘或 WebGPU 缓存图层。

公开验证程序 `node tools/verify-play-static-layers.mjs <playwright-root> <chrome> <new-output>` 比较初始画面、移动和局部更新后的直接与缓存像素；受控浏览器游戏测试还比较每帧普通绘制指令与上传字节。这些都是限定范围的验收，不等于手机帧率测试。

## 帧循环与宿主分别观测

`createBrowserGame({ ..., onFrameTiming })` 转发[帧循环 CPU 计时](frame-loop.md)样本，并区分 SDK 已提交的 `submitted` 与超图像预算未绘制的 `refused`；其他结果名称不变。按需保留帧时仿真和时钟仍推进。传入 `measureSharedFrames: true` 可启用已有的有界 WebGL2 宿主阶段计时；将 `game.host` 缩窄为 WebGL2 宿主后读取 `getSharedFrameTiming()`。该报告含原生阶段和提交序号，包括提交、栅栏轮询和退役，不能解释为 GPU 执行耗时。WebGPU 不提供这个 WebGL2 专用报告。诊断选项不改变宿主准入、画质、更新频率或绘制策略。观察者应简短同步、保留有限记录。浏览器合成调度及真实呈现需单独追踪。

**WebKit 保留帧呈现。** WebKit 浏览器上的 WebGL2 按需绘制（含 Play 及透明 World3D 叠加层）请求 `preserveDrawingBuffer: true`。在 Windows Playwright WebKit 样本中，采用原有丢弃缓冲属性时，即使 SDK 接受一次提交、GL 无错误，浏览器也仍显示上一帧。保留缓冲后，首帧及稍后异步图片就绪的变化无需额外绘制即可显示；静止回合仍不提交。连续绘制仍使用原有丢弃缓冲属性；WebGPU 和非 WebKit 浏览器保持不变。保留缓冲可能有额外显存／带宽开销；这项截图回归未测量 iPhone 真机性能。底层宿主仍遵循[显式属性契约](webgl2-executor-contract.md)。

**WebKit 稳定转屏呈现。** 同一浏览器样本中，调整可见 WebGL2 backing 尺寸后，即使后续帧成功提交，画布仍持续空白。WebKit 里的 BrowserGame、Play 和透明 2D 叠加层无论哪种绘制模式，都保留首次准入的可见 backing，而 fit、portrait、输入和工作纹理仍随当前逻辑帧变化。尺寸不同时复用原有 GPU resolve，遵循所选混合空间，不增加绘制通路或 CPU 读回。CSS 根据当前屏幕尺寸缩放；长宽比或尺寸变化很大时，原 backing 可能限制最终清晰度，直至新游戏建立新 backing。按需模式仍仅提交变化帧。底层宿主默认直接缩放，可显式选择稳定缩放但不能同时启用精确尺寸读回。

`createBrowserGame({ ..., afterFrame })` 把同步帧末钩子转发至其自身循环。主画面决定／提交之后（包括保留画面或宿主繁忙时）执行；配置的计时样本带有 `afterFrameMs`。手动 `game.drawFrame()` 不属于浏览器循环回合。

**浏览器标签兼容。** `createLabel` 和 `createAtlasLabel` 使用 Canvas 文字提供者的 `{ compatibility: 'game-labels' }` 模式。浏览器缺少可选 Canvas 状态属性时，新画布采用标准默认状态，画布元素语言取自标签的 locale。仅默认透明 sRGB 画布允许缺省 alpha 或色彩空间报告；显式不兼容的报告仍会被拒绝。保留原生度量和精确 RGBA 字节校验。此模式拥有独立缓存标识，底层默认 `createCanvasTextRasterProvider()` 仍执行严格 WC1 状态验证，字体可用性与字形覆盖仍由调用方负责。
