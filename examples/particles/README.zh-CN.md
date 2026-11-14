# 2D 粒子

[English](README.md) | 简体中文

`@egret/engine/particles` 的三股粒子流：燃烧的火盆、随风飘落的花瓣，以及在页面被按下处迸出的火花。每一股都是一个发射器，以页面绘制的柔和圆点绘制为一个网格，所以仓库里没有任何图片。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/particles/index.html`。加上 `?backend=webgl2` 使用 WebGL2。

## 可以试什么

- 看火盆：火焰在它的宽度上产生，上升、变小，并在消失时由黄转红。
- 看花瓣随风横向飘移，一边落下一边旋转。
- 在画布上任意位置按下，或按“火花”按钮：八十个火花在那里迸出、落下并熄灭。
- 熄灭火焰：正在燃烧的会燃尽。再点燃它。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 粒子的图像 | 边缘柔和的白色圆点，由页面绘制并从引擎资源中租用；每个粒子给它着色并调节透明度 |
| 火焰 | `rate`、`lifetime`、`speed`、`angle`、向上的 `gravity`、`drag`，从出生到消亡的缩放、颜色和透明度，以及出生所在的矩形 |
| 花瓣 | 视野上方的一个长矩形、表示风的横向重力、`rotation` 和 `spin` |
| 火花 | 一个不运行的发射器，移到按下的位置后调用 `burst(80)` |
| 时间 | 页面每帧把时间交给每个发射器的 `update(seconds)` |

参见[粒子指南](../../knowledge-base/Cns/docs/particles.md)。

## 检查

```text
node examples/particles/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

带 `?manual` 时由检查脚本推进粒子流；有一个场景使用真实时间。颜色从画布截图中读取。没有人按过任何东西，也没有使用手机。
