# 把浏览器游戏做成微信小游戏

[English](../../en/docs/wechat-minigame.md) | 简体中文

用引擎做的浏览器游戏，不改代码就能打包成微信小游戏。`tools/wechat/export-wechat.mjs` 写出微信开发者工具打开、上传到微信平台的目录。`tools/wechat/check-minigame.mjs` 用一个 `wx` 的替身，在无头浏览器里先把这个目录跑一遍，不必一开始就上手机。

## 小游戏缺什么，用什么补

小游戏只运行一个脚本 `game.js`，它的全局只有 `wx`、控制台、计时器和帧回调。没有 window，没有 document，没有 `fetch`，屏幕只有一块画布。导出时把 `tools/wechat/adapter.js` 放在游戏前面。适配器用 `wx` 造出引擎和游戏要用的东西：

| 网页里有 | 适配器给的 |
| --- | --- |
| `document`、元素、`getElementById`、`querySelector` | 按游戏 `index.html` 的元素建出的文档，带网页的类（`Node`、`Element`、`HTMLElement`、`HTMLCanvasElement`、`Document`）。这些类的属性是原型上的访问器，引擎的输入就从原型上读。 |
| 用于 WebGL2 的画布 | 第一块要 WebGL2 的画布得到屏幕。屏幕取舞台的尺寸，`gl.canvas` 就是游戏自己的画布。其余画布各用一块自己的画布画 2D。 |
| 指针、鼠标和键盘事件 | 触摸变成舞台上的 `PointerEvent`，轻点之后还有一个 `click`。`wx.onKeyDown` 变成 `KeyboardEvent`。 |
| `fetch`、`Image`、`new URL(x, import.meta.url)` | 包里的文件从包里读，其他地址走 `wx.request`。每个模块的 `import.meta.url` 指向它在 `https://game.local/` 下的文件。 |
| `Blob`、`createImageBitmap` | 引擎从字节解码 PNG。字节先写成游戏自己在 `wx.env.USER_DATA_PATH` 下的文件，再作为图片载入。 |
| `localStorage` | `wx` 存储，每个键加前缀 `ls:`。 |
| `AudioContext` | `wx.createWebAudioContext()`，`decodeAudioData` 同时返回 Promise。 |
| `visibilitychange` | `wx.onShow` 和 `wx.onHide`。 |
| 透明画布下面的网页 | 见下。 |

**画布下面的场景。** 游戏可以把场景画成画布下面某个元素的 CSS 背景，再把画布清成透明。小游戏的画布下面什么都没有。适配器把舞台之前那些元素的背景画到一块自己的画布上。在每个画进屏幕的帧结束时，它把背景画到游戏所画内容的下面，只混合进透明的像素。然后它把改过的游戏 WebGL 状态全部绑回去。纯色、`linear-gradient`，以及带位置和尺寸（`cover`、`contain`、长度与百分比）的图片会画出来。其他渐变和 `repeat` 不画，适配器在控制台上各提示一次。

网页有、小游戏没有的其他名字（`XMLHttpRequest`、`Worker`、`OffscreenCanvas`、`indexedDB` 等）在游戏里都绑定为空。游戏要用其中一个，在替身里就会失败，和在手机上一样，不会只在手机上才出错。

这些名字包括画布 2D 绘制的类（`CanvasRenderingContext2D`、`TextMetrics`、`CanvasGradient`）、`WebAssembly`、`FontFace`、`CSS` 和网页的文本框。小游戏用 `wx.createCanvas()` 给出 2D 上下文，但没有可以引用的类名，并用 `WXWebAssembly` 代替 `WebAssembly`。所以引擎的标签向画布要 2D 上下文，检查它能否测量和填充文字，而不是查找这个类。

## 文字

标签（`game.text`、`createLabel`）画在 2D 画布上。段落使用不需要 WebAssembly 的画布提供者：在小游戏里，`chooseParagraphProvider` 会选它。CanvasKit 需要 WebAssembly，体积也超过 4 MB 主包，因此不会加载。见[不需要 WebAssembly 的提供者](readonly-paragraph-sdk.md#不需要-webassembly-的提供者)。游戏自带的字体用 `wx.loadFont` 注册，使用它返回的字体族名。不注册时用手机自带的字体。

## 导出

```sh
node tools/wechat/export-wechat.mjs --esbuild <已安装的 esbuild> --game <游戏目录> --out <新目录> \
  [--appid <AppID>] [--orientation portrait|landscape] [--playwright <已安装的 Playwright index.mjs>]
```

- 游戏的 `index.html` 提供导入映射，说明引擎每个模块在哪里。它也提供游戏要查找的元素。入口默认是 `src/main.mjs`，可用 `--entry` 指定别的。
- 游戏和引擎打成一个脚本，降到 ES2017。除非给了 `--no-minify`，脚本会被压缩。
- `game.json` 设定方向、隐藏状态栏，并申请 iOS 高性能模式（`iOSHighPerformance`）。`project.config.json` 把它设为游戏项目，AppID 用给定的值，没给就用 `touristappid`。
- 游戏的其他文件，微信接受的类型会被复制。会被拒绝的文件列出来，不放进包里。
- 部分手机上的微信不能解码 WebP。给了 `--playwright` 时，每个 `.webp` 由无头 Chromium 重新写一遍：像素全部不透明的写成质量 0.9 的 JPEG，否则写成 PNG。适配器会按新名字找到它。不给这个选项时，导出会列出 WebP 文件。
- 报告给出 `game.js` 和整个包的大小，对照微信的上限：主包 4 MB，总共 30 MB。

## 检查

```sh
node tools/wechat/check-minigame.mjs <已安装的 Playwright index.mjs> <小游戏目录> <截图.png> \
  [--size 390x844] [--ratio 2] [--wait 8] [--tap x,y ...] [--then-wait 3]
```

替身只给游戏小游戏所给的东西，不多给。`GameGlobal` 里有 `wx`、控制台、计时器和帧回调。`wx.createCanvas` 先给屏幕，之后给屏幕外的画布。文件从目录里读，存储放在内存里。触摸来自鼠标，`--tap` 点击屏幕。报告包括：

- 游戏是否停止；
- 控制台上的错误；
- 调用过的 `wx` 接口和写入的存储键；
- 截图有多少种颜色；
- 有没有元素绕过适配器进入真正的网页。

`ok` 要求没有失败、没有错误、颜色多于八种，并且没有元素泄漏。

## 上传

上传需要游戏的 AppID 和上传密钥，在微信公众平台（mp.weixin.qq.com）获取。它们属于游戏的所有者，所以这些工具不负责上传。

1. 带上 AppID 导出；游戏有 WebP 图片时加上 `--playwright`。
2. 用微信开发者工具打开该目录。先在模拟器里试，再用预览二维码在手机上试。
3. 在平台上为这个 AppID 开启高性能模式。iOS 上的 WebGL2 需要它。
4. 在开发者工具里填写版本号和说明，点上传。也可以用 `miniprogram-ci`，配合上传密钥和平台上设置的 IP 白名单：

   ```js
   const ci = require('miniprogram-ci');
   const project = new ci.Project({ appid: 'wx…', type: 'miniGame', projectPath: './out', privateKeyPath: './private.wx….key' });
   await ci.upload({ project, version: '1.0.0', desc: '首次上传', robot: 1, setting: { es6: true } });
   ```

5. 在平台上把上传的版本提交审核。游戏还需要填写类目和适龄提示；在中国大陆销售的游戏，还需要平台要求的版号等资质。

## 检查了什么

`tests/wechat-minigame.test.mjs` 在 Node 的上下文里运行适配器。和小游戏的全局一样，这个上下文只有 `wx`、控制台、计时器和帧回调。测试检查：

- 网页的类及其原型访问器；
- 屏幕画布与 2D 画布；
- 触摸变成指针事件，轻点变成点击；
- 存储、包内文件、改名的图片和从字节解码；
- 帧下面画出的背景，以及绑回去的游戏 WebGL 状态；
- 一个小游戏目录的导出，并在这个上下文里运行。

`examples/minigame/verify.mjs` 导出一个探测游戏，并在替身里运行。游戏里上面这些名字都不存在。2026 年 11 月 26 日，探测游戏的标签画出了三行字。段落因为没有 `WebAssembly` 而得到画布提供者，换成三行并画到了屏幕上；在单词 “lantern” 里点一下，找到了对应的字母。

2026 年 11 月 22 日，一个按这种方式导出的移植 2D 游戏在替身里试玩过，环境是无头 Chromium 加软件 WebGL2。游戏的图片共 0.54 MB，场景是 CSS 背景。WebP 改写成 JPEG 后，整个包 1.75 MB。标题画面在画布下显示出了场景；点一下进入选夜界面，再点一下开始第一夜。没有报错，也没有元素泄漏。

**没有检查的。** 没有运行过微信本身：开发者工具、手机和审核都没有。替身是浏览器，它的 JavaScript 引擎、WebGL 和限制都是浏览器的。尤其是安卓微信上的 WebGL2、iOS 高性能模式下的 WebGL2、各种格式能否解码，以及在手机上的速度，都还没有确认。

**限制。**

- 游戏显示在画布上面的 HTML（菜单、文本框、浮层）不会画出来。只画舞台下面的背景。
- 屏幕画布铺满窗口。形状不同的舞台会被拉伸，除非游戏用 `fit: 'expand'` 适配（见[把舞台适配到屏幕](screen-fit.md)），它按设计尺寸的缩放比铺满窗口；适配器把微信的 `safeArea` 当作页面的 insets 报告。两种情况下触摸位置都与画面一致。
- 小游戏没有 WebGPU。必须用 WebGPU 的游戏启动不了。
