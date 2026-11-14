# 瓦片地图

[English](../../en/docs/tilemap.md) | 简体中文

`@egret/engine/tilemap` 读取用 [Tiled](https://www.mapeditor.org/) 制作、以 JSON 保存的地图，并用图块集的图片绘制其中的图块层。每个图块层是一个由区块组成的容器，每个区块按它用到的图块集各有一个网格，所以几千个图块的地图只是几十个网格，看不见的区块会被跳过。它是可选入口：不导入它的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 导入器和绘制出的地图在 Node 中、在带有租用纹理的真实引擎上验证；[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/tilemap/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，并从画布读取颜色。示例的地图由脚本按 Tiled 写出的格式生成；没有导入过 Tiled 本身保存的文件。见[实际运行了什么](#实际运行了什么)。

## 用法

```js
import { createTileMap, importTiledMap } from '@egret/engine/tilemap';

const map = importTiledMap(await (await fetch('level1.tmj')).json());
// 每个图块集一个租用的纹理，按名字给出：就是图块集指定的那张图片，用游戏加载图片的方式加载。
const tiles = scope.use(createTileMap({ map, textures: { terrain: terrainLease, trees: treesLease }, chunkSize: 16 }));
world.addChild(tiles.display);

function frame() {
  tiles.cull(camera.snapshot().view);   // 只显示看得见的部分
  engine.renderSharedFrame(frameOptions);
}
```

## 能读取什么

| Tiled | 读取 |
| --- | --- |
| 正交地图，有限和无限 | 是。无限图层被裁剪到其区块所含的格子，并保留起点（`startX`、`startY`） |
| 以数组（CSV）或 base64 保存的图块层 | 是，base64 不能压缩。zlib、gzip 和 zstd 会以 `TILEMAP_COMPRESSION_UNSUPPORTED` 拒绝：请用 CSV 或不压缩的 base64 保存 |
| 地图内的图块集，或单独文件中的图块集 | 是。单独文件中的图块集通过 `importTiledMap(json, { tilesets: { 'trees.tsj': treesJson } })` 提供。由单独图片组成的图块集会被拒绝 |
| 边距、间距、比格子高的图块 | 是。较高的图块立在格子底部，与 Tiled 的画法一致 |
| 翻转和旋转的图块 | 是：水平、垂直和沿对角线 |
| 分组 | 展平：组内图层继承组的偏移、不透明度、可见性和视差，名字为 `组/图层` |
| 对象层 | 作为数据读取：矩形、椭圆、点、多边形、折线、文字和图块对象及其属性。不绘制 |
| 属性 | 地图、图块集、图块、图层和对象的属性，取值为字符串、数字和布尔值。类或对象引用保存为 JSON 文本 |
| 图块动画 | 作为数据读取（`tileset.tiles.get(id).animation`）；绘制出的地图不播放 |
| 等距、交错和六边形地图；图片层；Wang 集 | 拒绝或忽略 |

## 绘制出的地图

`createTileMap({ map, textures, chunkSize })` 接收地图数据，以及每个要绘制的图块集的租用纹理（缺少纹理的图块集会以 `TILEMAP_TEXTURE_MISSING` 指出）。`chunkSize` 是一个区块横向和纵向的格子数，4 到 128，默认 32。

| 读取或修改 | 含义 |
| --- | --- |
| `tiles.display`、`tiles.layer(name).display` | 要放进世界的容器，以及各图块层带有偏移、不透明度和可见性的容器 |
| `tiles.tileAt(layer, column, row)` | 某一格的图块：编号、图块集、翻转和属性 |
| `tiles.setTile(layer, column, row, gid)` | 放置一个带翻转标志的图块，或用 0 去掉。只重新绘制它所在的区块 |
| `tiles.propertiesOf(gid)` | 图块自身的属性，例如是否阻挡 |
| `tiles.cellAt(x, y)`、`tiles.cellOrigin(column, row)` | 地图上某点所在的格子，以及某格的角点 |
| `tiles.cull(view)` | 只显示与地图上某矩形相交的区块（考虑比格子高或宽的图块），并返回显示的数量 |
| `tiles.layer(name).chunks` | 每个区块及其网格、几何数据和绘制的图块数 |

全局编号的最高三位是翻转标志（`TILE_FLIP_MASK`），与 Tiled 写法一致。地图以 `Mesh2D` 节点在共享渲染器上绘制；不会在页面的画布上绘制任何东西。

## 错误

| 代码 | 何时出现 |
| --- | --- |
| `TILEMAP_DATA_INVALID` | JSON 不是可以读取的地图；`cause` 说明位置 |
| `TILEMAP_ORIENTATION_UNSUPPORTED`、`TILEMAP_COMPRESSION_UNSUPPORTED`、`TILEMAP_LAYER_UNSUPPORTED`、`TILEMAP_TILESET_UNSUPPORTED` | 本入口不读取的 Tiled 功能 |
| `TILEMAP_TILESET_MISSING` | 没有提供保存在单独文件中的图块集 |
| `TILEMAP_OPTIONS_INVALID` | 某个选项不在允许范围内 |
| `TILEMAP_TEXTURE_MISSING` | 要绘制的图块集没有纹理 |
| `TILEMAP_LAYER_UNKNOWN`、`TILEMAP_CELL_INVALID`、`TILEMAP_TILE_INVALID` | 没有这个图块层、格子或图块 |
| `TILEMAP_CLOSED`、`TILEMAP_CLEANUP_FAILED`、`TILEMAP_DRAW_FAILED` | 地图已被销毁、释放失败或绘制失败 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 导入器：图块集、图层、分组、对象、base64、无限地图、单独文件中的图块集、每一种拒绝及其边界；绘制出的地图：区块、按图块集划分的网格、跨过边距和间距的图块切分、翻转、较高的图块、读取和修改格子、裁剪、无限图层、严格 TypeScript 使用方（含五处被拒绝的误用）以及导出 | Node，[`tests/tilemap.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/tilemap.test.mjs) | 14 个用例 |
| 把两个构建后模块中的每个比较、布尔和逻辑运算符逐个改掉 | Node | 226 处改动，212 处被发现。剩下的 14 处是多走一步也读不到任何内容的循环边界、没有实际构造的一千六百万格上限、恰好是下一个图块集开头的图块集边界，以及另一项检查会拒绝同一个值的选项检查 |
| 示例：从画布读取第一帧、挡住弟子的院墙和河流、相机跟随到地图边缘并裁剪区块、缩小后看到整个庭院、点击种花和拔花、隐藏树木图层、实时按键、手机配置下的轻触 | 无头 Chromium 153，软件 WebGL2 | 8 个场景 |
| Tiled 本身保存的地图；硬件 GPU；真实手机 | — | 未运行 |

## 不在本次范围内

- 等距和六边形地图；图片层；压缩的图层；播放图块动画；由单独图片组成的图块集。
- 不读取在 Tiled 图块编辑器中绘制的碰撞形状；可以像示例那样用图块属性说明它是否阻挡。
