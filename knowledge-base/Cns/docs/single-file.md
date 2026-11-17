# 单文件的 2D 引擎

[English](../../en/docs/single-file.md) | 简体中文

用 [`play`](play.md) 写的游戏只需要一个页面和引擎。`tools/pack-single-file.mjs` 把引擎写成一个文件，页面因此不需要 import map、包管理器和构建步骤，从文件夹直接打开和从服务器打开都可以。[llms.txt](https://github.com/cnedwin/Egret_rebuild/blob/main/llms.txt) 让智能体放在页面旁边的就是这个文件。

**核对了什么，没有核对什么。** 打包工具会加载它写出的两个文件；只有每个文件都给出打包时的全部名称，并且 `play` 和音效可以工作，才算写成。把 `egret2d.js` 放在页面旁边，[play 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.zh-CN.md)的三个游戏在无头 Chromium 的软件 WebGL2 上启动、绘制、接收按键和指针并发出声音，从服务器打开和从文件夹打开都试过。这些文件没有发布到任何地方：没有哪个注册表或 CDN 上有它们。没有在其他浏览器、手机和 WebGPU 上运行。

## 页面

```html
<!doctype html>
<meta charset="utf-8">
<title>Game</title>
<script src="egret2d.js"></script>
<script type="module">
const { play } = Egret;

await play({
  width: 480, height: 270,
  setup(game) { game.circle(240, 135, 30, 0xff6b6b); },
  update(dt, game) { },
});
</script>
```

所有内容都在全局对象 `Egret` 上。第二个脚本写成模块，只是为了能在顶层使用 `await`；它不导入任何东西，所以页面也能从文件夹直接打开。

在通过 HTTP 提供的页面里，`import { play } from './egret2d.mjs'` 加载另一个文件，它是同一个引擎的模块形式。

## 生成文件

```text
node tools/build.mjs
node tools/pack-single-file.mjs --esbuild <已安装的 esbuild 模块> --out <新目录> [--version <版本>]
```

| 文件 | 用途 |
| --- | --- |
| `egret2d.js` | 用于 `<script src>`；定义全局对象 `Egret` |
| `egret2d.mjs` | 用于 `import` |
| `egret3d.js`、`egret3d.mjs` | 同样的两个文件，另外包含 World3D 和 [`play3d`](play3d.md)，用于 3D 游戏。一个页面只加载其中一个文件 |
| `report.json` | 打包器及其版本、各入口、全部名称，以及每个文件写出时的大小、gzip 和 Brotli 之后的大小、SHA-256 和字节的来源 |

打包器是 [esbuild](https://esbuild.github.io/)。它不是本仓库的依赖：由打包的人指定一份已安装的副本，就像浏览器核对脚本指定一份已安装的 Playwright 一样。文件里除了定义导出的几行以外，没有打包器的代码。每个文件的第一行写明引擎的许可证 Apache-2.0，以及渲染器用到的 `robust-predicates`（Unlicense）。

## 里面有什么

四个入口以及它们加载的一切，包括 WebGL2 宿主和 WebGPU 宿主：

| 入口 | 提供 |
| --- | --- |
| `@egret/engine/play` | `play`、音效配方 |
| `@egret/engine` | `Sprite`、`Bitmap`、`Graphics`、纹理、`animate`、Engine |
| `@egret/engine/kit` | 按动作的输入、存档、随机数、声音提示、资源包 |
| `@egret/engine/web/game` | `createBrowserGame`，供超出 `play` 的游戏使用 |

文件里的每个名称与它所在入口里的是同一个东西；两个不同的东西使用同一个名称时，打包工具会拒绝。文本、图像、音频、补间以及中英文的错误说明都在里面，因为这些入口会加载它们。

`egret3d.js` 包含以上全部，以及两个 World3D 入口 `@egret/engine/world3d` 和 `@egret/engine/webgl2/world3d`，其中有 `play3d`：一共 394 个名称。

两个文件都不包含的仍然是各自的入口，以模块方式加载：界面控件、瓦片地图、2D 相机、带纹理的粒子、2D 物理、段落、文本输入、Spine。需要其中之一的游戏使用各个包，见[在干净的项目中使用预览版](clean-consumer.md)。

## 有多大

在包含本次改动的 main 上测得，用 esbuild 0.28.2 打包并压缩代码。

| 文件 | KiB | gzip 后 KiB | Brotli 后 KiB |
| --- | ---: | ---: | ---: |
| `egret2d.js` | 628.4 | 197.7 | 161.2 |
| `egret2d.mjs` | 628.0 | 197.5 | 161.1 |
| `egret3d.js` | 1236.0 | 401.7 | 321.8 |
| `egret3d.mjs` | 1235.3 | 401.6 | 321.7 |

`egret2d.js` 压缩前的字节来自：

| 部分 | KiB |
| --- | ---: |
| 引擎 | 145.6 |
| 运行时 | 117.7 |
| WebGPU 宿主 | 81.2 |
| WebGL2 宿主 | 68.4 |
| 中英文错误说明 | 64.2 |
| 帧的准备 | 55.6 |
| 文本 | 55.1 |
| 声音 | 19.9 |
| Play | 15.4 |
| 第三方（`robust-predicates`） | 3.9 |

去掉 WebGPU 宿主可以让 gzip 后的大小减少约 24 KiB，去掉中文错误说明可以再减少约 8 KiB；文件保留了这两者，这样它在每个浏览器里的行为都与模块一致，并且能用两种语言说明出了什么问题。
