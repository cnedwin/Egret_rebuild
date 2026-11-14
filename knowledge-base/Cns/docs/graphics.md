# Graphics：形状、路径与线条

[English](../../en/docs/graphics.md) | 简体中文

`Sprite` 用它的 `graphics` 绘图：填充的矩形、圆、椭圆和圆角矩形，由直线和曲线组成的路径，圆弧，以及任意宽度的线条。方法名和参数与白鹭一致。

**验证了什么，没有验证什么。** 每个调用生成的三角形在 Node 中验证。[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/graphics/README.zh-CN.md)在无头 Chromium 的软件 WebGL2 中从画布核对：每个形状轮廓内是它的颜色，轮廓外是背景，以及半透明形状叠在另一个形状上的结果。未运行 WebGPU。

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
| `lineStyle(thickness, color = 0, alpha = 1)` | 设置之后所绘内容的线条。不给宽度或给 0 则结束线条 |
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

## 填充、线条和路径怎样配合

- 形状使用绘制它时已设置的填充和线条。线条以轮廓为中心，画在填充之上。
- 路径是从一次 `moveTo` 起，到下一次 `beginFill`、`endFill`、`lineStyle` 或 `draw...` 形状为止的全部内容。它使用开始时已设置的填充和线条。
- 填充的路径在填充时闭合：最后一点连回第一点。它的线条只在两端重合时闭合。
- 路径只要点数够了就会画出来。线条不需要 `endFill`。
- 形状按调用顺序绘制，后画的在先画的之上。

## 一帧里携带什么

只画填充矩形的 sprite 仍然保持为矩形，与以前一样。任何其他形状或任何线条，都会把该 sprite 的全部绘图变成一个由带颜色三角形组成的网格，按绘制顺序排列，以一个白色像素作为纹理。它和其他内容一样，跟随 sprite 的位置、缩放、旋转、透明度、裁剪、混合模式和滤镜。

- **曲线由直线段组成**，每段与真实曲线的距离不超过四分之一单位：半径 10 的圆 16 段，半径 40 的圆 32 段，最多 128 段。放大很多倍的圆会露出棱角；应当直接画得更大。
- **边缘没有抗锯齿。** 倾斜或弯曲的边缘呈像素大小的阶梯。
- **线条是平头端点和尖角转角。** 比四个半宽更长的尖角在该长度处被截断。圆头端点和圆角转角尚未提供。
- **自相交的路径**会被填充，但不保证填充哪些部分。

## 限制

| 限制 | 数值 | 超出时 |
| --- | --- | --- |
| 一帧中不同的绘图 | 128 | 该帧以 `FRAME_BUDGET_EXCEEDED` 被拒绝 |
| 一帧中所有网格的三角形 | 65,536 | 该帧以 `FRAME_BUDGET_EXCEEDED` 被拒绝 |
| 一条正在绘制的路径的点数 | 8,192 | 调用抛出 `GRAPHICS_BUDGET`，sprite 保持原有内容 |
| 线条宽度 | 1,024 | `GRAPHICS_VALUE_INVALID` |

绘图完全相同的 sprite 共用一份绘图，无论有多少个：300 颗画成同一个圆的子弹只算一份。各自画不同内容的 sprite 则各算一份。需要很多不同形状时，把它们画进同一个 sprite，或者使用位图。

`getBounds()` 涵盖形状及其线条的宽度。命中测试不读取绘图：它和以前一样使用 `hitArea`。
