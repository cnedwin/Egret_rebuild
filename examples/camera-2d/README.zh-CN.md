# 2D 相机

[English](README.md) | 简体中文

一个比画面大的庭院，通过 `@egret/engine/camera` 的相机观看。相机带死区跟随一名弟子，在院墙处停下，可以越过远处的院墙看到远山，可以缩放、震动、看向大门再回来，并让远山和近处的树叶以各自的速度移动。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/camera-2d/index.html`。加上 `?backend=webgl2` 使用 WebGL2。

## 可以试什么

- 用方向键或 WASD 行走。弟子先在画面中心周围的一个框内移动，之后相机才跟上，并且是平滑地跟上。
- 走进角落。相机在院墙处停下，弟子继续走到画面边缘。
- 用按钮或滚轮放大缩小。树叶完全跟随缩放，远山只跟随十分之三。
- 震动。画面移动并转动，然后回到原处。
- 看大门：相机停止跟随，平滑移到大门，越过远处的院墙。“跟随”让它回来。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 庭院和弟子 | 一个容器，即交给 `createCamera2D` 的世界 |
| 跟随 | `camera.follow(hero, { smoothing, deadZone })` |
| 院墙 | `bounds`，比庭院略高一些 |
| 远山和树叶 | `camera.addLayer(layer, { factor, zoomFactor })` |
| 缩放、震动、大门 | `zoomTo`、`shake`、`panTo` |
| 时间 | 页面把每一帧的时间交给 `camera.update(seconds)` |

参见[相机指南](../../knowledge-base/Cns/docs/camera-2d.md)。

## 检查

```text
node examples/camera-2d/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

带 `?manual` 时页面不会自己运动，由检查脚本推进游戏；有一个场景使用真实时间和键盘。颜色从画布截图中读取。没有人按过键，也没有使用手机。
