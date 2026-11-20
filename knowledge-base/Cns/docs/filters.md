# 滤镜

[English](../../en/docs/filters.md) | 简体中文

渲染效果现在可以像 Egret 的滤镜一样改变子树的绘制结果：颜色矩阵、发光、投影和内发光，以及描边。它们在现有的效果组中执行——子树先被绘制到自己的目标中——位于模糊之后、遮罩和裁剪之前，两个共享宿主（WebGL2 和 WebGPU）都支持。与模糊一样，宿主需要以 `enableEffects: true` 创建。

早期检查使用 Node 和无头 Chromium 软件 WebGL2。后续 Windows 与 Android 真机结果及负载范围见[共享二维真机结果](shared-2d-hardware-results.md)。

## 用法

```js
const host = createSharedWebGL2Host({ canvas, enableEffects: true });

icon.renderEffect = { colorMatrix: GREY };                                    // Egret 的 ColorMatrixFilter
title.renderEffect = { glow: { color: 0xffc040, blur: 6, strength: 2 } };      // GlowFilter
card.renderEffect = { glow: { color: 0, alpha: 0.7, blur: 3, strength: 1, offsetX: 6, offsetY: 6 } }; // DropShadowFilter
button.renderEffect = { outline: { color: 0xe04040, width: 3 } };
gem.renderEffect = { glow: { color: 0xffffff, blur: 4, inner: true } };
ghost.renderEffect = { glow: { color: 0x40ff80, knockout: true } };
```

| 部分 | 字段 | 默认值与范围 |
| --- | --- | --- |
| `colorMatrix` | 二十个数：红、绿、蓝、alpha 四行，每行四个系数和一个 0 到 255 的偏移，与 Egret 相同 | 作用于未乘 alpha 的所见颜色，因此 Egret 项目中的矩阵得到相同的颜色 |
| `glow` | `color`、`alpha`、`blur`、`strength`、`inner`、`knockout`、`offsetX`、`offsetY` | alpha 1，blur 6（0–16 逻辑像素），strength 2（0–255），偏移 0（±256 逻辑像素）：与 Egret 默认值相同 |
| `outline` | `color`、`width`、`alpha` | width 1–8 逻辑像素；alpha 1 |

一个效果只能有发光或描边之一，不能同时有：需要两者时嵌套两个效果。投影就是带偏移的发光；Egret 的 distance 和 angle 对应 `offsetX = distance·cos(angle)`、`offsetY = distance·sin(angle)`。偏移和扩散以表面像素计，乘以宿主的像素比，不随对象旋转或缩放。

## 形状遮罩

`renderEffect = { shapeMask: sprite }` 用一个形状遮罩节点，与 Egret 的 `mask = displayObject` 相同：节点及其子对象只在该 sprite 的 Graphics 覆盖的地方显示，填充半透明的地方部分透出。

```js
const window = scope.use(new Sprite());
window.graphics.beginFill(0xffffff).drawCircle(80, 80, 60).endFill();
picture.renderEffect = { shapeMask: window };     // 图片从圆里透出
window.x = 40;                                    // 遮罩移动，下一帧就生效
```

- 遮罩的位置按它是被遮罩节点的子对象计算：它的 `x`、`y`、缩放、旋转和斜切都生效，alpha 和可见性不生效。只算它自己的绘制，不算它的子对象。
- 它不必在舞台上。如果在舞台上，它也会被画出来；Egret 中舞台上的遮罩会被隐藏，这里需要把它从舞台上拿下来。
- 它在 CPU 上画成一张 alpha 图，大小是被遮罩节点在屏幕上大小的两倍，每边最多 2048 像素，再像 `alphaMask` 一样遮罩。遮罩的绘制或位置改变、或节点在屏幕上的大小变化超过约五分之一时重新绘制，否则沿用同一张图。每帧重画的遮罩每帧都要生成新图。
- 一个效果只能有 `alphaMask` 或 `shapeMask` 之一，可以与模糊、颜色矩阵、发光或描边共用一个效果。什么都没画的遮罩会遮住一切。
- `createBrowserGame({ effects: true })` 创建开启效果的游戏 host。

## 绘制方式

在线性预乘颜色中，设组的颜色为 `c`，alpha 场为 `A`：

- **扩散。** 一个通道把 `A`（从偏移移来的位置读取）横向扩散到组的临时目标中，发光取平均值，描边取最大值；合成时再以同样方式纵向扩散。发光的半径为 `ceil(blur × 像素比)`，描边为 `round(width × 像素比)`，与模糊一样最多 16 个后备像素。描边在拐角处是方形的。
- **颜色矩阵。** `v = (encode(c.rgb / c.a), c.a)`；输出为 `clamp(M·v + offset/255)`，再解码并重新预乘。
- **发光。** `k = min(1, g·strength)·alpha`（描边为 `k = g·alpha`）；发光 `(colour·k, k)` 绘制在组的下方：`c + glow·(1 − c.a)`，knockout 时为 `glow·(1 − c.a)`。
- **内发光。** 在组内 `k = min(1, (1 − g)·strength)·alpha`：`c.rgb·(1 − k) + colour·k·c.a`，alpha 保持不变；knockout 时只有内发光。

之后组像以前一样应用遮罩和裁剪，并以普通 source-over 绘制到父级上。每组 uniform 从 448 字节增至 576 字节；每帧 8 组、4 层、每层 2 个目标的上限不变，WebGPU 设备每个阶段需要 3 个采样纹理才能使用效果。

## 错误

| 代码 | 触发时机 |
| --- | --- |
| `DISPLAY_EFFECT_INVALID` | 矩阵不是二十个有限数、发光或描边超出范围，或一个效果同时有两者 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 描述符按 Egret 默认值复制并冻结、逐个拒绝每项超限、每种效果在帧中携带的内容、每组 uniform（矩阵行与偏移、以后备像素计的扩散、线性光照中的颜色、取整后的偏移、16 像素上限），以及两个宿主的着色器源码 | Node，[`tests/filters.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/filters.test.mjs) | 4 个用例 |
| 仓库中已有的效果测试，使用更大的 uniform | Node | 323 个用例 |
| 示例：六个方块周围各十六处位置——内部、每一侧、拐角和更远处——与按公式独立算出的值比较，误差不超过 2/255；以及去掉效果后的同样位置 | 无头 Chromium 153，软件 WebGL2 | 2 个场景 |
| 真机 WebGPU 和 WebGL2，包括多组滤镜与原生设备恢复 | Windows 与 Android 证据 | [共享二维真机结果](shared-2d-hardware-results.md) |

## 不在本次范围内

- 自定义着色器滤镜；背景模糊；横向与纵向宽度不同的模糊（Egret 的 `blurX` 和 `blurY` 在这里合为一个 `blur`）；质量等级；随对象旋转的发光。
