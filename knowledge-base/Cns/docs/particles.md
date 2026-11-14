# 2D 粒子

[English](../../en/docs/particles.md) | 简体中文

`@egret/engine/particles` 生成粒子流——火焰、烟雾、火花、飘落的花瓣、尘埃——每一股都在共享渲染器上以一张纹理绘制为一个网格。它没有自己的时钟：游戏每帧调用一次 `update(seconds)`。它是可选入口：不导入它的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 发射器在 Node 中的真实引擎上用租用的纹理验证，[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/particles/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，并从画布读取颜色。没有运行硬件 GPU 或手机，也没有测量帧率。见[实际运行了什么](#实际运行了什么)。

## 用法

```js
import { createParticleEmitter } from '@egret/engine/particles';

const fire = scope.use(createParticleEmitter({
  texture: dotLease, rate: 90, lifetime: [0.6, 1.1], speed: [30, 70], angle: [250, 290],
  gravity: { x: 0, y: -40 }, size: 18, endScale: 0.2, startColor: 0xffd34d, endColor: 0xd23a1e, endAlpha: 0,
  shape: { kind: 'rectangle', width: 44, height: 6 },
}));
world.addChild(fire.display);
fire.x = 140; fire.y = 182;

function frame(seconds) { fire.update(seconds); engine.renderSharedFrame(frameOptions); }
```

范围可以是一个数字，也可以是两个数字，每个粒子在两者之间均匀地取值。

| 选项 | 含义 | 默认值 |
| --- | --- | --- |
| `texture` | 租用的纹理：整张纹理就是每个粒子的图像 | — |
| `maxParticles` | 同时存活的最大数量，最多 16384；超出的计为被拒绝 | 512 |
| `rate`、`running`、`duration` | 运行时每秒产生的粒子数；是否一开始就运行；运行多少秒后自动停止 | 50、true、无 |
| `lifetime`、`speed`、`angle` | 粒子存活的秒数；每秒移动的单位数；出发方向的角度，0 向右、90 向下 | 1、100、0 到 360 |
| `gravity`、`drag` | 每秒增加的速度（单位每秒）；每秒损失的速度比例，与步长无关 | 无、0 |
| `size`、`startScale`、`endScale` | 缩放为 1 时的宽高；出生和消亡时的缩放 | 8、1、1 |
| `startAlpha`、`endAlpha`、`startColor`、`endColor` | 出生和消亡时的透明度和着色 | 1、0、白色、白色 |
| `rotation`、`spin` | 出生时的旋转角度，以及每秒旋转的角度 | 0、0 |
| `shape` | 粒子在发射器周围出生的位置：`point` 点、指定宽高的 `rectangle` 矩形，或指定半径的 `circle` 圆（在面积内或仅在 `edge` 边缘上） | 点 |
| `seed` | 同样的种子在同样的更新下产生同样的粒子 | 1 |

`x` 和 `y` 是发射器在其显示对象内的位置；发射器移动时，粒子停留在出生的位置。另有 `start()`、`stop()`（存活的粒子会走完自己的一生）、`burst(count)`、`clear()`、`alive`、`snapshot()` 和 `particles()`（所有存活的粒子，供检查和工具使用）。

粒子的颜色和透明度是其顶点颜色，渲染器把它与纹理相乘。混合方式是渲染器的普通混合：目前还没有加法混合，所以重叠的火焰只与其中最亮的一样亮，不会更亮。

## 错误

| 代码 | 何时出现 |
| --- | --- |
| `PARTICLE_OPTIONS_INVALID` | 某个选项或参数不在允许范围内 |
| `PARTICLE_CLOSED` | 发射器已被销毁 |
| `PARTICLE_CLEANUP_FAILED` | 释放网格时失败 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 跨多次更新的按速率发射、生命周期、存活上限、任意步长下的重力和阻力运动、粒子出生和消亡时的属性、逐个角点比对的网格、形状、种子、持续时间、销毁、选项边界、严格 TypeScript 使用方（含五处被拒绝的误用）以及导出 | Node，[`tests/particles.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/particles.test.mjs) | 13 个用例 |
| 把构建后模块中的每个比较、布尔和逻辑运算符逐个改掉 | Node | 122 处改动，全部被发现 |
| 示例：第一帧、同样步进下同样燃烧的火盆、飘落的花瓣、点击处的火花、熄灭后重新点燃的火焰、真实时间、手机配置下的轻触 | 无头 Chromium 153，软件 WebGL2 | 7 个场景 |
| 硬件 GPU、真实手机、每帧数千个粒子的开销 | — | 未运行 |

## 不在本次范围内

- 加法及其他混合模式；粒子生命周期内播放精灵表的帧；会碰撞的粒子；沿路径移动的发射器。
