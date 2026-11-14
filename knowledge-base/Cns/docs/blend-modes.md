# 混合模式

[English](../../en/docs/blend-modes.md) | 简体中文

`DisplayObject.blendMode` 决定一个对象及其子对象绘制的内容如何与下方已有的内容合成，沿用 Egret 的名称：`normal`、`add`、`multiply`、`screen` 和 `erase`。WebGL2 和 WebGPU 两个共享宿主都能绘制每种模式，无需额外开启。

早期检查使用 Node 和无头 Chromium 软件 WebGL2。后续 Windows 与 Android 真机结果及负载范围见[共享二维真机结果](shared-2d-hardware-results.md)。

## 用法

```js
spark.display.blendMode = 'add';      // 重叠处更亮的粒子
shadow.blendMode = 'multiply';        // 让下方变暗
light.blendMode = 'screen';           // 柔和地提亮
hole.blendMode = 'erase';             // 按自身 alpha 擦除下方内容
```

模式与材质一样作用于对象及其下的所有内容，除非子对象设置了自己的模式。它就是对象 `sharedMaterial` 的混合方式：设置它会保留材质的着色和过滤，只替换混合方式；之后再设置材质，模式读取的就是新材质。对没有材质的对象设置 `normal`，对象仍然没有材质。

| 模式 | 材质混合 | 在线性预乘颜色中的结果，源 `S`（alpha 为 `a`）叠在目标 `C` 上 |
| --- | --- | --- |
| `normal` | `normal` | `S + C(1 − a)` |
| `add` | `add-accumulate` | `S + C`，alpha 也相加 |
| `multiply` | `multiply-factor` | `S·C + C(1 − a)` |
| `screen` | `screen` | `S + C(1 − S)` |
| `erase` | `erase`（新增） | `C(1 − a)`，alpha 同样；不使用源的颜色 |

这些公式来自[共享渲染配置](shared-render-profile-contract.md)，在线性光照中计算，因此与 Egret 旧 WebGL 渲染器在 gamma 空间中的结果不同：两个中间色 `add` 的结果在这里更亮。在舞台上使用 `erase` 也会擦掉背景，页面会透过画布显示；如果只想在一张图里挖洞，请在带渲染效果的容器内擦除，效果组有自己的透明目标。名为 `add-preserve` 的材质读作 `add`。

## 错误

| 代码 | 触发时机 |
| --- | --- |
| `DISPLAY_VALUE_INVALID` | 模式不是这五种之一 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 读取和设置每种模式、保留着色与过滤、重复设置相同模式不产生变化、之后设置的材质、被拒绝的名称、已释放的对象；容器下每次绘制捕获到的模式及子对象自己的模式；材质合同中的 `erase`、每种模式的 WebGL2 混合因子和 WebGPU 混合状态 | Node，[`tests/blend-modes.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/blend-modes.test.mjs) | 3 个用例 |
| 示例：每种模式叠在同一面板上的结果与公式比较（误差不超过 3/255）、面板本身、`add` 容器下一处、两处、三处重叠的火花，以及切换为 `normal` 后同样的火花 | 无头 Chromium 153，软件 WebGL2 | 2 个场景 |
| 真机 WebGPU 和 WebGL2，包括混合继承与擦除 | Windows 与 Android 证据 | [共享二维真机结果](shared-2d-hardware-results.md) |

## 不在本次范围内

- 需要在着色器中读取目标的模式，例如叠加、变暗、变亮或差值。
