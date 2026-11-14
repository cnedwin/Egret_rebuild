# 瓦片地图

[English](README.md) | 简体中文

一个 64×40 格的门派庭院，以 Tiled 保存的 JSON 格式存放，由 `importTiledMap` 读取、`createTileMap` 以每块十六格的区块绘制，并通过 2D 相机观看。两个图块集的图片由页面绘制，所以仓库里没有任何图片。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/tilemap/index.html`。加上 `?backend=webgl2` 使用 WebGL2。

## 可以试什么

- 用方向键或 WASD 行走。水、院墙和树木会挡住弟子，弟子会沿着它们滑动；远处院墙上的大门是开着的。
- 留意画布下方的那一行：36 个区块中只有视野内的被绘制。
- 缩小，看到整个庭院以及河流和桥。
- 点击草地上的一格：那里会长出花，再点一次就拔掉。只有那个区块被重新绘制。
- 隐藏树木：它们是组里单独的一层。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 地图 | `courtyard.tmj`：以数组保存的地面层；一个组，含以 base64 保存的细节层和比格子高的树木层；以及含出生点的对象层 |
| 读取 | `importTiledMap(json)` |
| 图块集图片 | 由页面绘制成纹理，并从引擎的资源中租用 |
| 绘制 | `createTileMap({ map, textures, chunkSize: 16 })`，弟子放在细节层和树木层之间 |
| 哪里可以走 | `tiles.tileAt` 以及图块集给图块的 `solid` 和 `water` 属性 |
| 绘制哪些 | 每帧调用 `tiles.cull(camera.snapshot().view)` |
| 种花 | `camera.screenToWorld`、`tiles.cellAt` 和 `tiles.setTile` |

参见[瓦片地图指南](../../knowledge-base/Cns/docs/tilemap.md)。

## 检查

```text
node examples/tilemap/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

带 `?manual` 时由检查脚本推进游戏；有一个场景使用真实时间和键盘。颜色从画布截图中读取。没有人按过键，也没有使用手机。
