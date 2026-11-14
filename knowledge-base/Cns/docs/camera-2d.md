# 2D 相机

[English](../../en/docs/camera-2d.md) | 简体中文

`@egret/engine/camera` 是观察 2D 世界的视图。把世界放进一个容器；相机设置这个容器的位置、缩放、旋转和锚点，让世界从相机看的位置呈现出来。它可以带死区跟随目标、停留在边界之内、缩放、震动、平移到某处，并让世界前后的图层以各自的速度移动。它没有自己的时钟：游戏每帧调用一次 `update(seconds)`。不导入它的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 相机在 Node 中用真实的显示树验证，[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/camera-2d/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，并从画布读取颜色。没有运行硬件 GPU 或手机。见[实际运行了什么](#实际运行了什么)。

## 用法

```js
import { createCamera2D } from '@egret/engine/camera';

const world = engine.stage.addChild(scope.use(new Sprite()));      // 关卡里的一切都放在这里
const camera = scope.use(createCamera2D({ world, width: 480, height: 270, bounds: { x: 0, y: 0, width: 1600, height: 900 } }));
camera.follow(hero, { smoothing: 0.2, deadZone: { width: 80, height: 50 } });

function frame(seconds) {
  moveHero(seconds);
  camera.update(seconds);
  engine.renderSharedFrame(frameOptions);
}
```

| 选项 | 含义 | 默认值 |
| --- | --- | --- |
| `world` | 装着世界的容器。相机存在期间拥有它的位置、缩放、旋转和锚点，销毁时归还 | — |
| `width`、`height` | 显示区域的大小，以舞台单位计 | — |
| `center`、`zoom`、`rotation` | 相机一开始看的位置、远近和旋转（度） | 视图中心、1、0 |
| `minZoom`、`maxZoom` | 允许的缩放范围 | 0.25、4 |
| `bounds` | 相机绝不会显示到其外的世界矩形。比视图小的世界会居中。不考虑旋转 | 无 |
| `shakeOffset`、`shakeRotation`、`shakeDecay`、`shakeFrequency`、`seed` | 震动最多移动（舞台单位）和旋转（度）视图多少，每秒衰减多少创伤值，震动多快，以及哪一种震动 | 16、0、1、15、1 |
| `roundToPixel` | 把世界放在整数舞台单位上，使像素画不闪烁 | false |

## 跟随

`follow(target, { smoothing, deadZone, offset })` 接受世界中任意位置的显示对象（无论嵌套多深、如何变换），或者一个返回世界坐标的函数。`smoothing` 是相机缩短约 63% 距离所需的秒数；无论帧数多少，同样的时间缩短同样的距离。在死区（以视图中心为中心、以世界单位计的矩形）内目标自己移动；超出死区时相机被拉到死区边缘。`stopFollowing()` 停止跟随。`panTo(x, y, seconds)` 平滑移动到某处并停止跟随；`lookAt(x, y)` 立即看向某处。

## 缩放、旋转和尺寸

`setZoom`、`zoomTo(zoom, seconds)`、`setRotation(degrees)` 和 `resize(width, height)` 围绕视图中心改变视图。每次之后都会保持边界。

## 震动

`shake({ trauma })` 增加创伤值，最多到 1。视图沿平滑噪声移动和旋转，幅度为创伤值的平方；创伤值每秒减少 `shakeDecay`，降到零时视图回到原处。同样的种子在同样的时间以同样的方式震动。

## 图层

`addLayer(layer, { factor, zoomFactor })` 让另一个容器——后面的远山、前面的树叶——以自己的速度移动：`factor` 为 0 静止，为 1 与世界同步，为 0.3 时速度是它的十分之三；横向和纵向可以不同（`{ x, y }`）。`zoomFactor` 是它跟随缩放的比例。相机看向视图中心时，图层位于放置它的位置。返回的函数会把图层的位置归还。

## 读取

`worldToScreen` 和 `screenToWorld` 按相机当前放置世界的方式换算，包括震动和旋转；舞台上的点击用 `screenToWorld` 换算。`isVisible(rect)` 判断世界中的某个矩形是否在视图内，用于跳过看不见的内容。`snapshot()` 给出中心、缩放、旋转、创伤值、显示的矩形、是否在跟随，以及累计更新的时间。

## 错误

| 代码 | 何时出现 |
| --- | --- |
| `CAMERA_OPTIONS_INVALID` | 某个选项或参数不在允许范围内 |
| `CAMERA_TARGET_INVALID` | 目标不是显示对象或函数、已被销毁，或没有给出坐标 |
| `CAMERA_LAYER_INVALID` | 图层不是显示对象、是世界本身、已被销毁，或已经是图层 |
| `CAMERA_CLOSED` | 相机已被销毁 |
| `CAMERA_CLEANUP_FAILED` | 归还世界或图层时失败 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 在真实显示树上验证相机：世界和图层的放置、带缩放和旋转的双向坐标换算、边界、不同帧率下的跟随、死区、嵌套目标、平移、缩放、震动、像素对齐、销毁、严格 TypeScript 使用方（含六处被拒绝的误用）以及导出 | Node，[`tests/camera-2d.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/camera-2d.test.mjs) | 17 个用例 |
| 把构建后模块中的每个比较、布尔和逻辑运算符逐个改掉 | Node | 175 处改动，163 处被发现。剩下的 12 处中，9 处位于两侧结果相同的边界上（目标恰好在死区边缘、世界恰好与视图一样大、平移或缩放恰好在时间点结束），1 处改变了噪声通道的编号，2 处是另一项检查会拒绝同一个值的选项检查 |
| 示例：第一帧、每秒六十帧和二十帧的跟随、院墙、按钮和滚轮缩放及图层的比例、视差、震动后复位、看向大门再回来、实时按键，以及手机配置 | 无头 Chromium 153，软件 WebGL2 | 9 个场景 |
| 硬件 GPU、WebGPU、真实手机 | — | 未运行 |

## 不在本次范围内

- 多个相机、分屏，以及绘制到纹理的相机。
- 旋转视图的边界，以及预判移动目标的跟随。
