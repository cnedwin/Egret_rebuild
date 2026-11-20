# 形状遮罩与线条渐变

[English](README.md) | 简体中文

引擎现在有了白鹭 5 Graphics 的两项功能。用 `renderEffect = { shapeMask: sprite }`，可以用一个 Sprite 的 Graphics 形状遮罩节点，对应以前的 `mask = displayObject`。线条也可以用渐变，对应以前的 `lineGradientStyle`：

```js
const game = await createBrowserGame({ canvas, width, height, effects: true });
const window = scope.use(new Sprite());
window.graphics.beginFill(0xffffff).drawCircle(80, 80, 60).endFill();
picture.renderEffect = { shapeMask: window };

lines.graphics
  .lineStyle(16, 0xffffff)
  .lineLinearGradientStyle(340, 0, 460, 0, [{ offset: 0, color: 0xff2020 }, { offset: 1, color: 0x2040ff }])
  .moveTo(340, 40)
  .lineTo(460, 40);
```

页面上半部分是引擎，下半部分是页面自身的 2D canvas，用它的裁剪和渐变描边画同样的内容：从圆形和星形里透出的条纹、一条从红到蓝的粗线，以及一个内金外绿的圆环。遮罩见[滤镜](../../knowledge-base/Cns/docs/filters.md#形状遮罩)，渐变见[图形](../../knowledge-base/Cns/docs/graphics.md)。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/vector-mask/index.html`，用 `?backend=webgl2` 或 `?backend=webgpu` 选择后端。

## 检查

```text
node examples/vector-mask/verify.mjs <Playwright index.mjs 的绝对路径> [<新的输出目录>] [software]
```

它在两个 Host 上绘制页面，在引擎和 2D canvas 中各读取 13 个远离边缘的点。每个点与 canvas 相差不超过 8。遮罩外和星形的凹口处要显示底色，遮罩内要显示条纹；线条要从红到蓝，圆环要从金到绿。不加 `software` 时，用已安装的 Edge 有界面运行在本机 GPU 上；加上 `software` 时无界面软件渲染运行，此时无法绘制的 WebGPU 适配器只记录、不算失败。在开发容器中 WebGL2 在软件渲染下通过，圆环与 canvas 相差不超过 4；WebGPU 在那里丢失设备（main 上也如此），因此 WebGPU 需要在硬件上运行确认。
