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
| `blendMode` | 粒子与下面内容的混合方式：`'normal'`、`'add'`（光晕、火花、火焰）、`'multiply'`、`'screen'` 或 `'erase'`，与 `DisplayObject.blendMode` 相同；等同于设置 `emitter.display.blendMode` | `'normal'` |

`x` 和 `y` 是发射器在其显示对象内的位置；发射器移动时，粒子停留在出生的位置。另有 `start()`、`stop()`（存活的粒子会走完自己的一生）、`burst(count)`、`burstAtMany(sites)`、`clear()`、`alive`、`snapshot()` 和 `particles()`（所有存活的粒子，供检查和工具使用）。

当同一次更新中有多个特效使用同一个发射器时（例如一群角色同时消失），可使用 `burstAtMany([{ x, y, count }, ...])`。对有效的批次，它按数组顺序发射，与逐点设置 `x`、`y` 并调用 `burst(count)` 一致，包括有种子的随机序列、存活粒子上限和被拒绝的数量。它先校验并快照所有发射点，再改变发射器；每个批次最多 16384 个发射点，合计最多请求 1048576 个粒子。坐标必须为有限数，每个数量都必须为非负安全整数。无效批次抛出 `PARTICLE_OPTIONS_INVALID`。活动发射器收到空数组时不执行任何操作；已销毁的发射器收到有效数组时抛出 `PARTICLE_CLOSED`。数量为零的点也会设置发射位置。非空批次成功返回时，最终位置和完整网格已立即就绪：只构建一次网格，不需要等待下一次更新。

粒子的颜色和透明度是其顶点颜色，渲染器把它与纹理相乘。颜色按所见颜色给出，并转换为渲染器使用的线性光照，所以白色纹理显示为所给的颜色。普通混合下，重叠的火焰只与其中最亮的一样亮；给 `blendMode: 'add'` 后，重叠处会叠加变亮，火焰和火花应当如此。

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
| 批量发射：已有粒子且达到上限时的 48 个发射点、同步发布一次且所有几何通道完全一致、后续运动及发射、无效输入和边界；新增两处严格类型拒绝 | Node，`tests/particles.test.mjs` | 新增 3 个用例；本版本粒子测试共 17 个通过 |
| 把构建后模块中的每个比较、布尔和逻辑运算符逐个改掉（早期实现，尚无批量 API） | Node | 122 处改动，全部被发现 |
| 示例：第一帧、同样步进下同样燃烧的火盆、飘落的花瓣、点击处的火花、熄灭后重新点燃的火焰、真实时间、手机配置下的轻触 | 无头 Chromium 153，软件 WebGL2 | 7 个场景 |
| 硬件 GPU、真实手机、每帧数千个粒子的开销 | — | 未运行 |

## 不在本次范围内

- 粒子生命周期内播放精灵表的帧；会碰撞的粒子；沿路径移动的发射器。
