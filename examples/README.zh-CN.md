# 示例

[English](README.md) | 简体中文

本仓库的 56 个示例，按展示的内容分类。每个示例都有自己的说明页，写明如何运行和可以尝试什么。“已核对”表示示例带有 `verify.mjs`，它在真实浏览器中驱动示例并读取结果；核对的范围见各示例的说明页。

每个示例的说明页都给出了运行它的命令。多数示例在仓库根目录这样启动：

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

然后在服务器打印出的主机和端口上打开 `/examples/<name>/index.html`。

## 从这里开始

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [起步项目](starter/README.zh-CN.md) | `starter` | 是 |
| [Play：三个完整的小游戏](play/README.zh-CN.md) | `play` | 是 |
| [白鹭响应式示例](mobile/README.zh-CN.md) | `mobile` | — |
| [白鹭换装工作室](outfit-studio/README.zh-CN.md) | `outfit-studio` | 是 |
| [Canvas矩形示例](canvas-scene/README.zh-CN.md) | `canvas-scene` | — |

## 显示与渲染

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [混合模式](blend-modes/README.zh-CN.md) | `blend-modes` | 是 |
| [滤镜](filters/README.zh-CN.md) | `filters` | 是 |
| [矢量绘图](graphics/README.zh-CN.md) | `graphics` | 是 |
| [显示拾取示例](hit-test/README.zh-CN.md) | `hit-test` | — |
| [WebGL2 等距地图示例](isometric-map/README.zh-CN.md) | `isometric-map` | — |
| [候选子树示例](prepared-subtree/README.zh-CN.md) | `prepared-subtree` | 是 |
| [Bitmap 资源替换](bitmap-resource-slot/README.zh-CN.md) | `bitmap-resource-slot` | — |

## 2D 世界

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [2D 相机](camera-2d/README.zh-CN.md) | `camera-2d` | 是 |
| [瓦片地图](tilemap/README.zh-CN.md) | `tilemap` | 是 |
| [2D 粒子](particles/README.zh-CN.md) | `particles` | 是 |
| [2D 物理](physics-2d/README.zh-CN.md) | `physics-2d` | 是 |
| [位图字体](bitmap-font/README.zh-CN.md) | `bitmap-font` | 是 |

## 内容与动画

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [从素材到动画](content-build/README.zh-CN.md) | `content-build` | — |
| [可编辑动画与换装参考场景](animation-outfits/README.zh-CN.md) | `animation-outfits` | 是 |
| [显式时间序列样例](sequence-player/README.zh-CN.md) | `sequence-player` | — |
| [序列控制](sequence-controls/README.zh-CN.md) | `sequence-controls` | 是 |
| [序列动画 RESET 示例](sequence-reset/README.zh-CN.md) | `sequence-reset` | 是 |
| [多页图集示例](atlas-pages/README.zh-CN.md) | `atlas-pages` | — |
| [图集导入播放组合](atlas-import-playback/README.zh-CN.md) | `atlas-import-playback` | — |
| [锚点图集播放示例](anchored-atlas-playback/README.zh-CN.md) | `anchored-atlas-playback` | — |
| [裁剪图集帧播放](trimmed-atlas-playback/README.zh-CN.md) | `trimmed-atlas-playback` | — |
| [Spine 资源版本 RESET](spine-reset/README.zh-CN.md) | `spine-reset` | 是 |
| [资源场景](resource-scene/README.zh-CN.md) | `resource-scene` | — |
| [资源组合准备](prepared-resource-groups/README.zh-CN.md) | `prepared-resource-groups` | — |

## 输入

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [主鼠标 Canvas 示例](mouse-input/README.zh-CN.md) | `mouse-input` | — |
| [多指针示例](multi-pointer/README.zh-CN.md) | `multi-pointer` | — |
| [悬停与滚轮](pointer-hover/README.zh-CN.md) | `pointer-hover` | 是 |
| [共享输入的位图按钮](bitmap-button/README.zh-CN.md) | `bitmap-button` | — |
| [画布上的文字输入](text-input/README.zh-CN.md) | `text-input` | 是 |

## 文字

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [显式 Canvas 文字示例](canvas-text/README.zh-CN.md) | `canvas-text` | — |
| [文字几何示例](paragraph-geometry/README.zh-CN.md) | `paragraph-geometry` | — |
| [UI 中的只读段落](paragraph-panel/README.zh-CN.md) | `paragraph-panel` | — |
| [托管 UI 中的原生编辑](text-editing/README.zh-CN.md) | `text-editing` | — |

## UI

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [显式本地线性布局](linear-layout/README.zh-CN.md) | `linear-layout` | — |
| [控件状态](ui-controls/README.zh-CN.md) | `ui-controls` | 是 |
| [设置界面](ui-settings/README.zh-CN.md) | `ui-settings` | 是 |
| [标签页与进度](ui-tabs/README.zh-CN.md) | `ui-tabs` | 是 |
| [按步分配数量](ui-stepper/README.zh-CN.md) | `ui-stepper` | 是 |
| [文本框控件](ui-text-field/README.zh-CN.md) | `ui-text-field` | 是 |
| [列表中的下拉选择](ui-dropdown/README.zh-CN.md) | `ui-dropdown` | 是 |
| [行的菜单](ui-context-menu/README.zh-CN.md) | `ui-context-menu` | 是 |
| [列表多选](ui-multi-select/README.zh-CN.md) | `ui-multi-select` | 是 |
| [行囊](ui-inventory/README.zh-CN.md) | `ui-inventory` | 是 |
| [可排序的名册表格](ui-roster-table/README.zh-CN.md) | `ui-roster-table` | 是 |
| [可展开和收起的树](ui-tree/README.zh-CN.md) | `ui-tree` | 是 |
| [UI 数据面板示例](ui-data-panel/README.zh-CN.md) | `ui-data-panel` | 是 |
| [按 key 定位虚拟列表](ui-key-navigation/README.zh-CN.md) | `ui-key-navigation` | 是 |
| [列表语义](ui-list-semantics/README.zh-CN.md) | `ui-list-semantics` | 是 |

## 声音与视频

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [音乐与音效](audio-mixer/README.zh-CN.md) | `audio-mixer` | 是 |
| [视频](video/README.zh-CN.md) | `video` | 是 |

## 3D

| 示例 | 文件夹 | 已核对 |
| --- | --- | --- |
| [World3D 示例](world3d/README.zh-CN.md) | `world3d` | — |
