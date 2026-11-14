# 位图字体

[English](../../en/docs/bitmap-font.md) | 简体中文

`@egret/engine/bitmapfont` 用由图片组成的字体绘制文字——得分数字、游戏自有字形的标题、飘起的伤害数字——而不是使用系统字体。它读取 BMFont 及同类工具（AngelCode 生成器、Hiero、Glyph Designer、Littera，以及它们保存的文本、XML 和 JSON 格式）写出的字体，以及 Egret 自己的纹理合并工具写出的帧格式字体；按字距调整、换行和对齐排版，并按字体的每一页绘制为一个网格。它是可选入口：不导入它的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 字体和排版在 Node 中验证，网格在真实引擎上验证，[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-font/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，并从画布读取颜色。没有运行硬件 GPU 或手机，也没有读取由生成工具本身保存的字体：测试和示例中的字体是按这些工具的格式手写或由页面生成的。见[实际运行了什么](#实际运行了什么)。

## 用法

```js
import { createBitmapText, parseBitmapFont } from '@egret/engine/bitmapfont';

const font = parseBitmapFont(await (await fetch('fonts/score.fnt')).text());
const pages = font.pages.map(file => scope.use(await engine.assets.acquire(createAssetRef(TEXTURE, file))));
const score = scope.use(createBitmapText({ font, pages, text: '0', maxWidth: 120, align: 'right', color: 0xffd34d }));
hud.addChild(score.display);
score.text = String(points);
```

`parseBitmapFont(source)` 接受字符串或已解析的对象。字符串以 `<` 开头时按 XML 读取，以 `{` 开头时按 JSON 读取，否则按 BMFont 的文本格式读取。带 `frames` 的对象是 Egret 的格式：只有一页，名称为 `file`，每一帧以其字符命名，包含它在页面上的 `x`、`y`、`w`、`h`，`offX` 和 `offY`，以及 `sourceW`（前进宽度）和 `sourceH`（最高者即行高）。其他对象按 BMFont 的 JSON 读取：`pages`、`chars`、`common`，以及可选的 `info` 和 `kernings`。字体是冻结的：`face`、`size`、`lineHeight`、`base`、`pages`（文件名）、`glyphs`、`format`、`glyph(codePoint)` 和 `kerning(first, second)`。

| 文字选项 | 含义 | 默认值 |
| --- | --- | --- |
| `font`、`pages` | 由本入口读取的字体，以及按顺序为每一页提供的租用纹理；每个字符都必须位于其页面内 | — |
| `text`、`color` | 显示的内容；页面图像要乘上的着色，`0xRRGGBB`，按所见颜色计：页面中的白色显示为这个颜色 | `''`、白色 |
| `maxWidth` | 换行以适应宽度：在空格之后、表意文字（中文、日文、韩文）之间换行，不在 `，。！？」` 等闭合标点之前、也不在开启标点之后换行；比宽度还宽的单词在字符之间断开 | 无 |
| `align` | 每行在 `maxWidth` 内（或在最宽的行内）`left`、`center` 或 `right` 对齐 | `left` |
| `letterSpacing`、`lineSpacing` | 字符之间、行与行之间额外增加的距离 | 0、0 |
| `kerning` | 是否使用字体的字距调整 | true |
| `fallback` | 字体缺少某个字符时绘制的替代字符；`null` 表示不绘制 | 字体中有 `?` 时为 `?` |

`text`、`color`、`maxWidth`、`align`、`letterSpacing` 和 `lineSpacing` 可以随时设置，文字会重新排版并绘制；被拒绝的值不会改变任何东西。`width`、`height`、`layout`（各行及每个字符的位置）、`meshes` 和 `dispose()` 用于读取和释放。`layoutBitmapText(font, text, options)` 只排版不绘制，用于测量文字或在其旁边摆放其他东西。在 `\n`、`\r\n` 和 `\r` 处换行。没有空格字符的字体仍然有空格，宽度为行高的三分之一，与 Egret 的位图文字一致；字体缺少的字符计入 `layout.missing`。

一页最多绘制一段文字中的 16,384 个字符。页面按原样绘制，使用渲染器的普通混合：带描边或阴影的字体需要把它们画进图片里。

## 错误

| 代码 | 触发时机 |
| --- | --- |
| `BITMAP_FONT_INVALID` | 字体无法读取，或某个字符超出其页面；原因中说明位置 |
| `BITMAP_TEXT_OPTIONS_INVALID` | 某个选项或设置的值不合法 |
| `BITMAP_TEXT_TOO_LONG` | 同一页上的字符超过一个网格能容纳的数量 |
| `BITMAP_TEXT_CLOSED` | 文字已被释放 |
| `BITMAP_TEXT_CLEANUP_FAILED` | 释放网格或显示对象失败 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| BMFont 三种格式读取结果一致、XML 转义、Egret 帧格式、各部分出错时的拒绝、前进宽度与字距调整、偏移、行与行距、在空格后和表意文字之间换行及闭合标点的处理、过宽的单词、对齐、缺字与替代字符、选项、按页生成的网格及其位置、纹理坐标和线性光照下的着色、可在字符间断行的文字范围边界及字体可命名内容的边界、拒绝时不做任何改变的设置器、放不下的页面、一页的字符上限、释放、严格模式 TypeScript 使用方及五种被拒绝的误用，以及导出 | Node，[`tests/bitmap-font.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/bitmap-font.test.mjs) | 15 个用例 |
| 逐一改动两个构建产物模块中的每个比较、布尔、逻辑和算术运算符 | Node | 改动 227 处，捕获 223 处；其余改动不产生可观察的差异 |
| 示例：由页面绘制、从 XML 读取的 BMFont 和 Egret 帧格式字体，白色标题、从右边缘向左增长的金色得分、换行并以三种方式对齐和着色的对话框、显示为 `?` 的缺字、字距调整、手机配置下的点按 | 无头 Chromium 153，软件 WebGL2 | 5 个场景 |
| 由生成工具本身保存的字体、示例中的中文、硬件 GPU、真实手机 | — | 未运行 |

## 不在本次范围内

- 距离场字体；同一段文字内变化的颜色或字号；除画进图片以外的描边和阴影；竖排文字；从右到左的文字。
