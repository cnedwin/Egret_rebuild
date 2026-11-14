# 滤镜

[English](README.md) | 简体中文

同一个方块的六个副本，各带一个渲染效果：Egret 的灰度颜色矩阵、金色发光、投影、红色描边、白色内发光和仅绿色发光。宿主以 `enableEffects: true` 创建，一个舞台单位就是一个画布像素，因此画布按原尺寸显示。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/filters/index.html`。加上 `?backend=webgl2` 或 `?backend=webgpu` 选择后端。

## 可以试什么

- 把六个方块与方块的原色比较。
- 按下按钮：效果被移除再加回，方块随之变回原样再恢复。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 每个方块 | 一个位于 `DisplayObjectContainer` 中的 `Sprite`，容器的 `renderEffect` 带 `colorMatrix`、`glow` 或 `outline` |
| 投影 | alpha 为 0.7、向右 6、向下 6 偏移的黑色 `glow` |

参见[滤镜指南](../../knowledge-base/Cns/docs/filters.md)。

## 检查

```text
node examples/filters/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

验证器使用 GPU 原生回读的整像素与滤镜公式对照。截图另行记录浏览器合成结果。已安装的 Edge 检查两个后端，软件模式检查 WebGL2。
