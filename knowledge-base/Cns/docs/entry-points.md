# 该引哪个入口

[English](../../en/docs/entry-points.md) | 简体中文

`@egret/engine` 有一个主入口和 39 个较小的入口。本页说明做一件事需要哪一个。[起步示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.zh-CN.md)只用到主入口和 `@egret/engine/web/game`（它会替游戏加载 Host），没有别的。

## 入口是怎么划分的

- **`@egret/engine`** 是核心：Engine、舞台、显示对象、事件、资源和作用域。它不需要页面，在 Node 中也能运行。
- **`@egret/engine/webgpu` 和 `@egret/engine/webgl2`** 是在浏览器中绘制的两个 Host。游戏引入其中一个，或者在运行时选择。
- **一项功能一个入口**，例如 `@egret/engine/particles`。它同样不需要页面。
- **`@egret/engine/web/...` 把功能接到浏览器上。** 需要页面的功能成对出现：`@egret/engine/audio` 负责混音，`@egret/engine/web/audio` 通过页面播放。测试和工具只用前者。

所有工厂函数都以 `create...` 命名，返回的对象都有 `dispose()`。

## 按要做的事查

| 我想 | 引入 | 来自 |
| --- | --- | --- |
| 启动 Engine 并绘制舞台 | `createEngineForProfile`、`SHARED_FRAME_PROFILE_2D`、`Sprite`、`Bitmap`、`DisplayObjectContainer` | `@egret/engine` |
| 用 WebGPU 绘制 | `createSharedWebGPUHost` | `@egret/engine/webgpu` |
| 用 WebGL2 绘制 | `createSharedWebGL2Host` | `@egret/engine/webgl2` |
| 一次调用启动页面里的游戏：Host、Engine、输入和循环 | `createBrowserGame` | `@egret/engine/web/game` |
| ……并查看每秒帧数和一帧的内容 | `createBrowserStatsPanel`，或 `stats: true` | `@egret/engine/web/game` |
| 显示器每显示一帧就驱动一次游戏 | `createBrowserFrameLoop` | `@egret/engine/web/loop` |
| 把图片加载为纹理 | `createBrowserTextureProvider` | `@egret/engine/web/image` |
| 从构建好的清单加载图集、序列帧和字体 | `createContentLoader`、`createFontContentLoader`、`createManifestAssetBinding` | `@egret/engine/resources` |
| ……并在页面中取回它们的字节 | `createManifestByteSource`、`createManifestFontContentLoader` | `@egret/engine/web/resources` |
| 播放序列帧 | `createSequenceController`、`createSequenceResetSlot` | `@egret/engine/animation` |
| 对一个值做缓动 | `engine.createTween(scope, options)` | `@egret/engine` |
| 显示对象上的触摸、鼠标和手写笔 | `createPointerInput` | `@egret/engine/input` |
| ……来自页面的指针事件 | `createBrowserPointerInput` | `@egret/engine/web/pointer` |
| 键盘 | `createKeyboardInput` | `@egret/engine/input` |
| ……来自页面的按键事件 | `createBrowserKeyboardInput` | `@egret/engine/web/keyboard` |
| 鼠标悬停和滚轮 | `createHoverInput` | `@egret/engine/input/hover` |
| ……来自页面 | `createBrowserHoverInput` | `@egret/engine/web/hover` |
| 手柄 | `createGamepadInput`、`bindGamepadKeys` | `@egret/engine/input/gamepad` |
| ……来自浏览器 | `createBrowserGamepadInput` | `@egret/engine/web/gamepad` |
| 位图上只响应鼠标的按钮 | `createMouseInput`、`createBitmapButton` | `@egret/engine/web/input` |
| 能跟随、缩放和震动的相机 | `createCamera2D` | `@egret/engine/camera` |
| 瓦片地图，也可从 Tiled 导入 | `createTileMap`、`importTiledMap` | `@egret/engine/tilemap` |
| 粒子 | `createParticleEmitter` | `@egret/engine/particles` |
| 碰撞和物理 | `createPhysicsWorld` | `@egret/engine/physics2d` |
| 位图字体文本 | `parseBitmapFont`、`createBitmapText` | `@egret/engine/bitmapfont` |
| 单行文本 | `createTextField`、`createTextRasterCache` | `@egret/engine/text` |
| ……由页面的画布栅格化 | `createCanvasTextRasterProvider` | `@egret/engine/web/text` |
| 带样式的多语言段落 | `createParagraph`、`createParagraphCache` | `@egret/engine/paragraph` |
| ……由 CanvasKit 排版 | `createCanvasKitParagraphProvider`、`createCanvasKitFontSetProvider` | `@egret/engine/web/paragraph` |
| 盖在舞台上的平台文本框 | `createBrowserTextInput` | `@egret/engine/web/text-input` |
| 按钮、开关、滑块、列表、滚动、弹层、主题 | `createUiRoot`、`createActionControl`、`createToggleControl`、`createRangeControl`、`createScrollControl`、`createSelectionGroup`、`createUiLayerManager`、`createUiTheme` | `@egret/engine/ui` |
| 行和列布局 | `planLinearLayout` | `@egret/engine/layout` |
| 托管 UI 内的文本编辑 | `createUiTextEditor` | `@egret/engine/ui/editing` |
| ……使用平台的编辑器 | `createBrowserTextEditor`、`createBrowserEditorFontProvider` | `@egret/engine/web/editing` |
| 供辅助技术使用的角色和名称 | `createUiSemantics`、`createUiListSemantics` | `@egret/engine/ui/semantics` |
| ……投射到页面 | `createBrowserSemantics` | `@egret/engine/web/semantics` |
| 声音：音乐、音效、分组、淡入淡出 | `createAudioMixer` | `@egret/engine/audio` |
| ……由 Web Audio 播放 | `createBrowserAudio` | `@egret/engine/web/audio` |
| 显示对象上的视频 | `createVideo` | `@egret/engine/video` |
| ……来自视频元素、文件或流 | `createBrowserVideo` | `@egret/engine/web/video` |
| 混合模式和滤镜 | 显示对象上的 `blendMode` 和 `renderEffect` | `@egret/engine` |
| 读写字节 | `ByteReader`、`ByteWriter` | `@egret/engine` |
| 3D 场景 | 场景、网格、材质、灯光、动画、物理 | `@egret/engine/world3d` |
| ……用 WebGL2 或 WebGPU 绘制 | `createWebGL2Renderer3D`、`createWebGPURenderer3D`、`createWorld3DView` | `@egret/engine/webgl2/world3d`、`@egret/engine/webgpu/world3d` |
| Spine 骨骼，JSON 或二进制 | `createSpineContentLoader`、`createSpineDisplay`、`createSpineInstance` | `@egret/spine`；页面中另从 `@egret/spine/web` 引入 `createManifestSpineContentLoader` |

## 不使用打包工具的页面

示例页面在 import map 里逐行列出它用到的入口，以及每个页面都需要的三个名称：`@egret/runtime`、`@egret/contracts` 和 `robust-predicates`。复制[起步示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/index.html)的 map，每多用一个入口就加一行；入口构建出的文件，就是它在 [`packages/engine/package.json`](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/engine/package.json) 里的 `import` 路径。

使用包管理器和打包工具时不需要 map：见[在干净工程中使用预览版](clean-consumer.md)。
