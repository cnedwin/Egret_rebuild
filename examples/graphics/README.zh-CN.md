# 矢量绘图

[English](README.md) | 简体中文

用 sprite 的 `graphics` 绘制的形状：圆、椭圆、带线条的圆角矩形、叠在它上面的半透明圆、带缺口的填充路径、带转角的线条、曲线，以及用圆弧画出的四个扇形组成的圆环。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印出的主机和端口上打开 `/examples/graphics/index.html`。加上 `?backend=webgl2` 或 `?backend=webgpu` 可以指定后端。

## 可以尝试

- 观察边缘：曲线由直线段组成，边缘没有抗锯齿。
- 按下按钮：圆环被清除并重新绘制，两种颜色互换。

## 实现方式

| 部分 | 来自 |
| --- | --- |
| 圆、椭圆、圆角矩形 | `beginFill` 之后的 `drawCircle`、`drawEllipse`、`drawRoundRect`，最后一个还在 `lineStyle` 之后 |
| 半透明圆 | 第二个 sprite，使用 `beginFill(color, 0.5)` |
| 带缺口的形状 | 在填充下的 `moveTo` 和 `lineTo`，由 `endFill` 闭合 |
| 线条和曲线 | `lineStyle` 之后的 `moveTo`、`lineTo` 和 `curveTo`，没有填充 |
| 扇形 | 在填充下的 `moveTo`、一段向外的 `drawArc` 和一段返回的内侧 `drawArc` |

参见[绘图指南](../../knowledge-base/Cns/docs/graphics.md)。

## 核对

```text
node examples/graphics/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

脚本从画布读取每个轮廓内外的颜色，以及半透明圆叠在面板上和叠在背景上的颜色，逐一与根据颜色算出的值比较。它只运行 WebGL2。没有人工按键，也没有运行 WebGPU。
