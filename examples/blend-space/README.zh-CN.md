# 混合空间：半透明颜色如何混合

[English](README.md) | 简体中文

引擎默认在线性光中把半透明绘制与下面的内容混合。2D canvas、白鹭 5 和多数图像工具混合的是存储的颜色编码值，所以浅色的半透明在引擎里比在那里强得多：深色底上 10% 的白，在 canvas 中是淡淡的白，在线性光中却是明显的灰。从白鹭 5 移植的游戏，或在 canvas 中凭眼睛调好的设计，可以让引擎按 canvas 的方式混合：

```js
const game = await createBrowserGame({ canvas, width, height, blendSpace: 'srgb' });
```

之后 Host 和每一帧都使用 `srgb` 空间。每次绘制本身的颜色在两种空间中相同，只是混合方式不同。`play()` 默认使用 `'srgb'`，传入 `blendSpace: 'linear'` 才改用线性。规则见[渲染配置合同](../../knowledge-base/Cns/docs/shared-render-profile-contract.md#混合空间)。

页面上半部分是引擎，下半部分是页面自身的 2D canvas，画同样的方块：淡白、蓝底上一半的红、白底上四分之一的黑、两种淡色叠加，以及不透明的灰。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/blend-space/index.html`。加上 `?space=linear` 或 `?space=srgb`，以及 `&backend=webgl2` 或 `&backend=webgpu`。

## 检查

```text
node examples/blend-space/verify.mjs <Playwright index.mjs 的绝对路径> [<新的输出目录>] [software]
```

它在两个 Host、两种空间下绘制页面并读取每个方块。`srgb` 下每个方块与 2D canvas 相差不超过 3；`linear` 下淡白明显比 canvas 亮，不透明的灰两者相同。不加 `software` 时，用已安装的 Edge 有界面运行在本机 GPU 上；加上 `software` 时无界面软件渲染运行，此时无法绘制的 WebGPU 适配器只记录、不算失败。在开发容器中，WebGL2 检查在软件渲染下通过，`srgb` 每个方块与 canvas 相差不超过 1；WebGPU 在那里丢失设备（main 上也如此），因此 WebGPU 需要在硬件上运行确认。
