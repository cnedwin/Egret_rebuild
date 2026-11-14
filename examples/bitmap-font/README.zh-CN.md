# 位图字体

[English](README.md) | 简体中文

用 `@egret/engine/bitmapfont` 显示文字：标题和对话框使用从 XML 格式读取的 BMFont，得分使用 Egret 自己的帧格式。两种字体都由页面根据一套小型像素字母表绘制，字体文件也由页面按工具保存的格式写出，所以仓库里没有任何图片。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/bitmap-font/index.html`。加上 `?backend=webgl2` 使用 WebGL2。

## 可以试什么

- 按 +100：金色得分向左增长，右边缘保持不动。
- 按“对齐”：对话框的各行先居中，再靠右，然后回到靠左。
- 按“着色”：同样的白色图片以另一种颜色绘制。
- 按“下一段”：含有字体缺少字符的文字会在该位置显示问号；短文字只有一行。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 像素字母表 | 数字、大写字母和几个符号，每个 5×7 点，按每点 2 像素（白色）和每点 3 像素（金色，下面一行更暗）绘制到一张图片中 |
| 标题和对话框 | 页面以 XML 写出的 BMFont，A 与 V、T 与 A、L 与 T 之间有字距调整，由 `parseBitmapFont` 读取 |
| 得分 | Egret 帧格式字体，由同一个函数读取，在宽 100 的框内右对齐绘制 |
| 对话框 | `maxWidth` 为 280、`lineSpacing` 为 4、带着色，`align` 和 `text` 由按钮设置 |

参见[位图字体指南](../../knowledge-base/Cns/docs/bitmap-font.md)。

## 检查

```text
node examples/bitmap-font/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

颜色从画布截图中读取。没有人按过任何东西，也没有使用手机。
