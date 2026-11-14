# 混合模式

[English](README.md) | 简体中文

按 Egret 名称使用 `DisplayObject.blendMode`：同一个 alpha 为 0.6 的琥珀色方块，分别以 `normal`、`add`、`multiply`、`screen` 和 `erase` 叠在同一块蓝色面板上；下方是混合模式为 `add` 的容器中的三个火花。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/blend-modes/index.html`。加上 `?backend=webgl2` 或 `?backend=webgpu` 选择后端。

## 可以试什么

- 比较五个方块：同样的颜色，五种合成方式。被擦除的方块处会透出页面。
- 按下按钮：火花从 `add`（重叠处更亮）切换为 `normal`（颜色一致）。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 方块 | 每个都是一个 `Sprite`，与其面板同级，有自己的 `blendMode` |
| 火花 | `blendMode` 为 `add` 的 `DisplayObjectContainer` 中的三个方块；子对象继承容器的模式 |

参见[混合模式指南](../../knowledge-base/Cns/docs/blend-modes.md)。

## 检查

```text
node examples/blend-modes/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

每个像素都与按混合公式算出的值比较。带 `software` 时只检查 WebGL2；在 Edge 中检查两个后端。没有人按过任何东西。
