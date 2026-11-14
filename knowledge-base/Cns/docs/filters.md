# 滤镜

[English](../../en/docs/filters.md) | 简体中文

渲染效果现在可以像 Egret 的滤镜一样改变子树的绘制结果：颜色矩阵、发光、投影和内发光，以及描边。它们在现有的效果组中执行——子树先被绘制到自己的目标中——位于模糊之后、遮罩和裁剪之前，两个共享宿主（WebGL2 和 WebGPU）都支持。与模糊一样，宿主需要以 `enableEffects: true` 创建。

**验证了什么，没有验证什么。** 描述符、帧中携带的内容以及每组 uniform 的内容在 Node 中验证，[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/filters/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，每个被检查的像素都与按下文公式独立算出的值比较。这里没有在浏览器中绘制 WebGPU：无头 Chromium 提供了 SwiftShader 适配器，但在检查帧时会丢失实例，所有示例都是如此。没有运行硬件 GPU 或手机。见[实际运行了什么](#实际运行了什么)。

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
| 浏览器中的 WebGPU、硬件 GPU、手机、每帧大量发光组的开销 | — | 未运行 |

## 不在本次范围内

- 自定义着色器滤镜；背景模糊；横向与纵向宽度不同的模糊（Egret 的 `blurX` 和 `blurY` 在这里合为一个 `blur`）；质量等级；随对象旋转的发光。
