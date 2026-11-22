# 在网页中使用 2D 或 3D 单文件

[English](../../en/docs/single-file.md) | 简体中文

从白鹭引擎 7.0 的[浏览器归档](https://github.com/cnedwin/Egret_rebuild/releases/download/v7.0.2/egret-browser.zip)解压引擎文件、使用指南和许可证。把 `egret2d.js` 放在 HTML 页面旁即可调用 [`play`](play.md)；需要 World3D 时选用 `egret3d.js` 和 [`play3d`](play3d.md)。这两种脚本都可以从本地文件夹打开。使用 ES Module 时，从 HTTP 服务器提供对应的 `.mjs` 文件。[发行说明与 SHA-256](release-archives.md)

打包工具会加载四个浏览器文件，按各入口核对导出名称、`play` 或 `play3d`，并生成一段音效采样。早期单文件验证中，[Play 示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/play/README.zh-CN.md)的三个游戏在无头 Chromium 的软件 WebGL2 上完成了启动、绘制、按键、指针和音源启动检查，覆盖本地文件和 HTTP 两种打开方式。

## 从 npm 选择浏览器包

| 游戏需要 | 安装 | 模块入口 | 可直接部署的脚本 |
| --- | --- | --- | --- |
| 2D 游戏 | `npm install @egret/2d@7.0.2` | `import { play } from '@egret/2d'` | `egret2d.js` |
| World3D 场景与 2D 界面 | `npm install @egret/3d@7.0.2` | `import { play3d } from '@egret/3d'` | `egret3d.js` |

上面的包名导入适用于构建工具。没有构建工具时，将对应的 `.js` 复制到页面旁，用下面的 `<script>` 加载。需要原生 ES 模块时，通过 HTTP 提供对应的 `.mjs` 并按相对路径导入。

一个项目可以为不同页面或独立入口同时安装这两个包及 `@egret/engine`。每个正在运行的游戏只选择一套入口创建对象。3D 包也包含 2D 的 `play`。把精灵、场景、纹理、资源租约和销毁操作都留在创建它们的同一套引擎中。不同入口间交换关卡 JSON、坐标、标识等普通数据。两种传统脚本都会定义全局 `Egret`，同一页面只加载其中一个。

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

`tools/verify-game.mjs` 同时要求空闲和输入阶段的帧循环继续推进。可选游玩脚本执行结束后，才汇总网络与错误检查，因此脚本阶段被拒绝的请求会影响最终结果。`played` 继续单独记录脚本断言。声音记录统计音源启动，实际听感和设备性能需要独立观察。

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

7.0.2 的 `egret2d.js` 导出 86 个名称。`egret3d.js` 增加 `@egret/engine/world3d` 和 `@egret/engine/webgl2/world3d` 的接口（含 `play3d`），共导出 436 个名称。解压浏览器归档中的 `report.json` 可查到各自的入口、导出名称与校验值。需要额外功能时，可以直接导入对应的模块。[公共导入入口](entry-points.md)

## 7.0.2 单文件大小

使用 esbuild 0.28.2 压缩构建。表中单位为 KiB（1,024 字节）。实际下载量取决于服务器发送时采用的压缩方式。

| 文件 | 原始 KiB | gzip KiB | Brotli KiB |
| --- | ---: | ---: | ---: |
| `egret2d.js` | 701.7 | 222.6 | 181.8 |
| `egret2d.mjs` | 701.3 | 222.6 | 181.5 |
| `egret3d.js` | 1371.9 | 448.5 | 359.4 |
| `egret3d.mjs` | 1371.1 | 448.4 | 359.1 |

`report.json` 还按来源列出每个单文件的代码字节数，便于和自己的构建对照。
