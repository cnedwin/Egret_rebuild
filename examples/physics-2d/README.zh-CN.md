# 2D 物理

[English](README.md) | 简体中文

用 `@egret/engine/physics2d` 搭的练功房：由格子网格生成的墙、按键移动并能沿墙滑动的弟子、会下落弹跳滑动的石头、一道斜坡、有石头在其中就会亮起的池塘，以及从弟子向右发出的一条射线。石头和弟子是页面自己绘制的图像，所以仓库里没有任何图片。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/physics-2d/index.html`。加上 `?backend=webgl2` 使用 WebGL2。

## 可以试什么

- 用方向键或 WASD 移动弟子：碰到墙会停下，斜着推向平台时会沿平台滑动。
- 在画布上任意位置按下，或按“投石”按钮：石头落下、弹起，停在平台上，沿斜坡滑下并堆积起来。
- 把石头投进池塘：池中有石头时池塘会亮起。“清空”会移走所有石头。
- 看黄色射线：它停在遇到的第一面墙、斜坡或石头上。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 墙 | 对大厅 32×18 格的网格调用 `addTileColliders`：得到六个静态矩形 |
| 斜坡和池塘 | 旋转 -20 度的静态矩形；一个统计接触数量的静态传感器矩形 |
| 石头 | 带 `restitution` 和 `friction` 的动态圆，各自以图像作为 `display` |
| 弟子 | 每帧用 `moveAndSlide` 移动的运动学矩形；它会推开石头，自己不会被推动 |
| 射线 | 每帧从弟子向右调用 `raycast` |
| 时间 | 页面每帧把时间交给世界的 `step(seconds)`；世界按 1/60 秒的固定步长推进 |

参见[2D 物理指南](../../knowledge-base/Cns/docs/physics-2d.md)。

## 检查

```text
node examples/physics-2d/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

带 `?manual` 时由检查脚本推进世界；有一个场景使用真实时间。颜色从画布截图中读取。没有人按过任何东西，也没有使用手机。
