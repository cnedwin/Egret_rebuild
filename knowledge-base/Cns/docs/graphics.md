# Graphics：形状、路径与线条

[English](../../en/docs/graphics.md) | 简体中文

`Sprite` 用它的 `graphics` 绘图：填充的矩形、圆、椭圆和圆角矩形，由直线和曲线组成、可以带孔的路径，圆弧，渐变，图片填充，以及任意宽度的线条：圆头或方头端点、圆角或平切转角、虚线。方法名和参数与白鹭一致。

早期检查使用 Node 和无头 Chromium 软件 WebGL2。后续 Windows 与 Android 真机结果及负载范围见[共享二维真机结果](shared-2d-hardware-results.md)。

## 用法

```js
const g = sprite.graphics;
g.beginFill(0xe05050).drawCircle(60, 60, 40).endFill();
g.beginFill(0x2b3550).lineStyle(4, 0xf0c030).drawRoundRect(240, 30, 120, 60, 24).endFill();
g.lineStyle(4, 0x60d080).moveTo(150, 160).lineTo(220, 160).lineTo(220, 220);
g.beginFill(0x8040c0).moveTo(30, 150).lineTo(120, 150).lineTo(75, 185).endFill();
```

每个调用都返回 graphics 本身，可以链式调用。`clear()` 清除已绘制的全部内容，并结束填充和线条。

## 调用

| 调用 | 绘制 |
| --- | --- |
| `beginFill(color, alpha = 1)` | 设置之后所绘内容的填充 |
| `endFill()` | 结束填充。在该填充下绘制的路径按当前形状填充 |
| `beginLinearGradientFill(x0, y0, x1, y1, stops)` | 颜色从一点渐变到另一点的填充 |
| `beginRadialGradientFill(x, y, radius, stops, radiusY = radius)` | 颜色从圆心向外渐变到圆（或椭圆）的填充 |
| `beginGradientFill(type, colors, alphas, ratios, matrix?)` | 按旧代码的写法给出的渐变填充 |
| `beginBitmapFill(lease, matrix?, repeat = true)` | 用图片填充 |
| `lineStyle(thickness, color = 0, alpha = 1, options?)` | 设置之后所绘内容的线条。不给宽度或给 0 则结束线条。`options` 见下文 |
| `drawRect(x, y, width, height)` | 矩形 |
| `drawCircle(x, y, radius)` | 以某点为圆心的圆 |
| `drawEllipse(x, y, width, height)` | 内切于该角点和尺寸所定矩形的椭圆 |
| `drawRoundRect(x, y, width, height, ellipseWidth, ellipseHeight = ellipseWidth)` | 圆角矩形。最后两个参数是圆角椭圆的完整宽度和高度 |
| `moveTo(x, y)` | 开始路径的一段 |
| `lineTo(x, y)` | 路径的一段直线 |
| `curveTo(controlX, controlY, anchorX, anchorY)` | 通向锚点的曲线，朝一个控制点弯曲 |
| `cubicCurveTo(controlX1, controlY1, controlX2, controlY2, anchorX, anchorY)` | 朝两个控制点弯曲的曲线 |
| `drawArc(x, y, radius, startAngle, endAngle, anticlockwise = false)` | 以弧度表示的圆弧，作为路径的一部分。已开始的路径会连到圆弧的起点 |

形状需要填充或线条：两者都没有时，`drawRect` 等调用抛出 `GRAPHICS_FILL_REQUIRED`。不是有限数字的值或负的尺寸抛出 `GRAPHICS_VALUE_INVALID`。

## 线条的端点、转角和虚线

`lineStyle` 的第四个参数是一个对象，其中每一项都可以省略。

| 选项 | 取值 | 省略时 |
| --- | --- | --- |
| `caps` | `'none'`：开放的线在最后一点处平头结束。`'round'`：以半圆结束。`'square'`：以半个正方形结束 | `'none'` |
| `joints` | `'miter'`：转角外侧是尖角。`'round'`：圆弧。`'bevel'`：平切 | `'miter'` |
| `miterLimit` | 尖角长度超过这么多个半宽时改为平切，与 bevel 相同。不小于 1 | 4 |
| `dash` | 最多 16 个长度，单位与 sprite 相同：实线段、空隙、实线段……奇数个时重复一遍 | 实线 |

```js
sprite.graphics.lineStyle(6, 0xffffff, 1, { caps: 'round', joints: 'round', dash: [16, 12] }).moveTo(20, 20).lineTo(200, 20).lineTo(200, 120);
```

- 线条的两段在转角内侧共用一个点，所以半透明的线在转角处不会更深。线条比它所沿曲线的弯曲半径还宽时，各段仍会互相重叠。
- 虚线的样式沿转角连续。每一段实线都是一条独立的线，端点按 `caps` 绘制。长度为零的实线段不会画出来，即使是圆头。
- 闭合的轮廓（例如 `drawRect`，或回到起点的路径）在闭合处是转角，没有端点。

## 渐变

渐变是一种填充。它的颜色用色标给出：`{ offset, color, alpha }`，`offset` 从起点的 0 到终点的 1，`alpha` 省略时为 1。色标 2 到 16 个，按 offset 从小到大排列。

```js
// 从 x = 20 处的红色到 x = 120 处半透明的蓝色。20 左边是红色，120 右边是那种蓝色。
sprite.graphics.beginLinearGradientFill(20, 0, 120, 0, [{ offset: 0, color: 0xff0000 }, { offset: 1, color: 0x0000ff, alpha: 0.5 }]).drawRect(0, 0, 140, 40).endFill();
// 圆心白色，半程绿色，半径 40 的圆上及其外为黑色。
sprite.graphics.beginRadialGradientFill(50, 50, 40, [{ offset: 0, color: 0xffffff }, { offset: 0.5, color: 0x00ff00 }, { offset: 1, color: 0 }]).drawCircle(50, 50, 48).endFill();
```

- 两个色标之间的颜色按 sRGB 数值混合，与 canvas 相同。
- 渐变以三角形顶点的颜色绘制。形状会被切成更小的三角形，直到顶点之间的颜色与渐变相差不超过 2/255，所以颜色对比强烈的大面积渐变需要几百到几千个三角形。一次填充最多 16,384 个；超过后不再细分，渐变会变粗糙。
- 实际数量（未注明时为两种颜色）：200×100 矩形上的线性渐变，沿边方向是 102 个三角形，沿对角线是 184 个，三种颜色是 234 个；200×60 的圆角按钮是 40 个。径向渐变贵得多，因为除了向外还要绕圆周细分：半径 40 的圆是 2,514 个，600×400 的矩形是 3,018 个，半径 200、三种颜色的圆是 15,296 个，在统计用的机器上细分用了十分之一秒。细分只在绘制形状时做一次，不是每帧都做。径向渐变面积大或需要频繁重画时，优先用线性渐变或图片。
- `beginGradientFill` 接受旧代码传入的参数：`'linear'` 或 `'radial'`、颜色、透明度、0 到 255 的比例，以及一个矩阵 `{ a, b, c, d, tx, ty }`。该矩阵把渐变自身的正方形（宽 1638.4 个单位，以原点为中心）放到 sprite 中。对于位于某个角点、给定宽高且不旋转的渐变框，矩阵为 `{ a: width / 1638.4, b: 0, c: 0, d: height / 1638.4, tx: x + width / 2, ty: y + height / 2 }`。
- 线条只有一种颜色，没有线条渐变。

## 图片填充

`beginBitmapFill(lease, matrix, repeat)` 用图片填充。`lease` 是纹理的租约，与 `Bitmap` 接受的相同。

```js
// 图片的每个像素宽两个单位，图片从 (140, 104) 开始，在形状范围内重复。
sprite.graphics.beginBitmapFill(lease, { a: 2, b: 0, c: 0, d: 2, tx: 140, ty: 104 }).drawRoundRect(140, 104, 96, 32, 16).endFill();
```

- `matrix` 决定图片在 sprite 中的位置：图片的像素 (x, y) 画在 `a·x + c·y + tx`、`b·x + d·y + ty`。省略时一个像素是一个单位，图片从 sprite 的原点开始。
- 图片在两个方向上重复。`repeat` 为 false 时，改为把边缘像素向外延伸；图片不会在边缘处被截断。
- 纹理必须是一整张图片。图集中的一部分会以 `GRAPHICS_VALUE_INVALID` 被拒绝，因为重复时它周围的图片内容会露出来。
- 重复的图片最远只画到距起点 8,192 个自身像素处。超出这个范围的形状以 `GRAPHICS_BUDGET` 被拒绝。
- 绘图显示期间要一直持有租约。租约已释放的绘图所在的帧会被拒绝。
- 线条只有一种颜色；图片只能用于填充，不能用于线条。

## 填充、线条和路径怎样配合

- 形状使用绘制它时已设置的填充和线条。线条以轮廓为中心，画在填充之上。
- 路径是从一次 `moveTo` 起，到下一次 `beginFill`、`endFill`、`lineStyle` 或 `draw...` 形状为止的全部内容。它使用开始时已设置的填充和线条。
- 填充的路径在填充时闭合：最后一点连回第一点。它的线条只在两端重合时闭合。
- 同一条路径中由各次 `moveTo` 开始的各部分，按非零规则一起填充，与 canvas 相同。画在另一部分内部且方向相反的部分是一个孔。互相重叠的部分和自相交的轮廓只涂一次。用 `drawRect`、`drawCircle` 等绘制的形状各自单独填充。
- 路径只要点数够了就会画出来。线条不需要 `endFill`。
- 形状按调用顺序绘制，后画的在先画的之上。

## 一帧里携带什么

只画填充矩形的 sprite 仍然保持为矩形，与以前一样。任何其他形状或任何线条，都会把该 sprite 的全部绘图变成一个由带颜色三角形组成的网格，按绘制顺序排列，以一个白色像素作为纹理。图片填充是单独的一个网格，以它的图片为纹理，所以先画颜色、再画图片、再画颜色的 sprite 是按此顺序的三个网格；最多 16 个。它和其他内容一样，跟随 sprite 的位置、缩放、旋转、透明度、裁剪、混合模式和滤镜。

- **曲线由直线段组成**，每段与真实曲线的距离不超过四分之一单位：半径 10 的圆 16 段，半径 40 的圆 32 段，最多 128 段。放大很多倍的圆会露出棱角；应当直接画得更大。
- **不设置 `smoothing` 时边缘呈阶梯状。** 倾斜或弯曲的边缘是像素大小的阶梯。`graphics.smoothing = 1` 让之后绘制的每个形状和线条在边缘 1 个单位内渐隐到透明，见下文。
- **有多个部分或自相交的路径**比简单轮廓需要更多三角形：它在每个顶点和交点处被切成横带。

## 平滑边缘

```js
const g = sprite.graphics;
g.smoothing = 1;
g.beginFill(0xe05050).drawCircle(60, 60, 40).endFill();
```

- `smoothing` 是以 sprite 的单位计的宽度，取值 0 到 8，初始为 0。它对设置之后绘制的内容生效，直到再次设置；`clear()` 不改变它。
- 形状外围会加上一圈这么宽的三角形带，从边缘处形状的颜色渐隐到透明。形状因此大了这么多：它的边界和点击范围都包含这圈带。轮廓的每条边增加两个三角形，所以 64 边的圆多 128 个。
- 1 个单位适合按绘制尺寸显示的形状。放大到三倍的 sprite，这圈带是三个像素宽；这时用三分之一个单位来画。
- 带线条的填充自己没有这圈带，因为它的边缘在线条下面；线条的两侧和端点各有一圈。
- 只画填充矩形的 sprite 仍然是矩形，没有这圈带。图片填充没有这圈带。
- 形状或线条自相交的地方，带会相互重叠，那里会略微更不透明。

## 限制

| 限制 | 数值 | 超出时 |
| --- | --- | --- |
| 一帧中不同的绘图 | 4,096 | 该帧以 `FRAME_BUDGET_EXCEEDED` 被拒绝 |
| 一帧中所有网格的三角形 | 65,536 | 该帧以 `FRAME_BUDGET_EXCEEDED` 被拒绝 |
| 一条正在绘制的路径的点数 | 8,192 | 调用抛出 `GRAPHICS_BUDGET`，sprite 保持原有内容 |
| 线条宽度 | 1,024 | `GRAPHICS_VALUE_INVALID` |
| 一个 sprite 的网格数：每次在图片填充和其他内容之间切换就开始一个 | 16 | 调用抛出 `GRAPHICS_BUDGET`，sprite 保持原有内容 |
| 一条线的虚线段数 | 16,384 | 调用抛出 `GRAPHICS_BUDGET`，sprite 保持原有内容 |
| 一次带孔或自相交的填充的三角形数 | 16,384 | 路径结束时（`endFill`，或下一次填充、线条或形状）抛出 `GRAPHICS_BUDGET`。该路径被丢弃，之前画的内容保留 |

绘图完全相同的 sprite 共用一份绘图，无论有多少个：300 颗画成同一个圆的子弹只算一份。各自画不同内容的 sprite 则各算一份。实际上先用完的是三角形：一帧 65,536 个，大约是 2,000 个半径 40 的圆，或 500 个半径 600 的圆。一份绘图无论被多少个 sprite 显示都只算一份，但它的三角形按显示它的每个 sprite 各算一次。

`getBounds()` 涵盖形状及其线条的宽度。开启 `touchEnabled` 且没有 `hitArea` 的 sprite 按它的绘图命中：点要落在形状的某个三角形内，所以圆不会在其边界矩形的角上被命中，孔也不会被命中。设置了 `hitArea` 时改用那个矩形。
