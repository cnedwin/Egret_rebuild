# 视频

[English](../../en/docs/video.md) | 简体中文

`@egret/engine/video` 把视频作为显示对象显示：源的每一帧新画面都通过引擎的资源系统成为一个 Bitmap 的纹理，游戏可以像对待其他对象一样移动、缩放、遮罩它或在其上绘制。`@egret/engine/web/video` 从页面的视频元素创建源——一个文件、一个流（例如画布或摄像头的流），或页面已有的元素。两者都是可选入口：不导入它们的游戏不会加载其中任何代码。

**验证了什么，没有验证什么。** 播放器在 Node 中用测试驱动的源验证，[示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/video/README.zh-CN.md)在无头 Chromium 和软件 WebGL2 中验证，从画布读回实时流和页面录制的 WebM 文件的画面。没有运行其他工具制作的视频文件、硬件 GPU、手机、Safari 或 Firefox，也没有测量大视频的开销。见[实际运行了什么](#实际运行了什么)。

## 用法

```js
import { createBrowserVideo } from '@egret/engine/web/video';

const intro = scope.use(createBrowserVideo({ assets: engine.assets, src: 'video/intro.webm', maxWidth: 960 }));
stage.addChild(intro.display);
intro.onEnded(() => showTitle());
await intro.play();               // 默认静音，所以页面无需点击即可播放

function frame() { void intro.update(); engine.renderSharedFrame(frameOptions); }
```

| 浏览器选项 | 含义 | 默认值 |
| --- | --- | --- |
| `assets` | 引擎的资源系统 | — |
| `src`、`stream`、`element` | 三者之一：文件地址、`MediaStream`，或页面自己的视频元素（视频释放时保持原样） | — |
| `loop`、`muted`、`volume` | 传给元素 | false、true、1 |
| `maxWidth` | 比它宽的画面在成为纹理前缩小到这个宽度 | 1280 |
| `crossOrigin` | 用于允许跨域的其他来源的文件 | 无 |

视频有 `state`（`loading`、`ready`、`playing`、`paused`、`ended`、`failed`、`closed`）、`display`、`width` 和 `height`（画面尺寸）、`duration`、`currentTime`、`loop`、`muted`、`volume`、`play()`（页面不允许播放时以 `VIDEO_PLAY_REFUSED` 拒绝，就像浏览器在点击前不允许播放声音一样）、`pause()`、`seek(seconds)`、`update()`、`onEnded(listener)`、`snapshot()` 和 `dispose()`。浏览器视频另有 `element`。

`update()` 显示源中最新的画面（如果有变化）：每帧调用一次。显示了新画面时解析为 true。当一帧画面仍在转为纹理时，再次调用会立即返回 false 并计为跳过，下一次调用取当时最新的画面，所以慢帧不会堆积画面。Bitmap 在第一帧画面时创建；在此之前 `display` 是空的。

`createVideo({ assets, source })` 接受任何 `VideoSource`——`readFrame()` 一次给出最新的 `{ image, time }`，以及 `play`、`pause`、`seek`、`loop`、`muted`、`volume` 和 `dispose`——用于其他方式产生的画面或测试。

## 画面如何到达屏幕，以及开销

浏览器源会得知元素呈现的每一帧（浏览器支持时用 `requestVideoFrameCallback`，否则在每次时间变化时），把它绘制到显示尺寸的画布中，读回，并作为 `ImageData2D` 给出。播放器把它变为纹理，以视频自己的资源类型租用，交给 Bitmap，并释放上一帧，其纹理在无人持有时被释放。渲染器把它作为新的纹理页上传。

所以每一帧新画面都在主线程上被完整读回并上传：大约 `width × height × 4` 字节，各一次。640×360、每秒 30 帧的视频每秒约有 28 MB 双向传输。`maxWidth` 可以控制这一点；把元素直接交给 GPU、无需读回的路径不在本次范围内。

## 错误

| 代码 | 触发时机 |
| --- | --- |
| `VIDEO_OPTIONS_INVALID` | 某个选项或参数不合法 |
| `VIDEO_PLAY_REFUSED` | 页面不允许播放；原因是浏览器给出的 |
| `VIDEO_FRAME_INVALID` | 源给出的画面不是带时间的 `ImageData2D` |
| `VIDEO_LISTENER_FAILED` | 结束监听器抛出异常；其他监听器会先收到通知 |
| `VIDEO_CLOSED` | 视频已被释放 |
| `VIDEO_CLEANUP_FAILED` | 释放 Bitmap、租约或源失败 |
| `VIDEO_UNAVAILABLE` | 页面无法创建读取画面所用的画布 |

## 实际运行了什么

| 内容 | 环境 | 结果 |
| --- | --- | --- |
| 选项、每帧新画面成为 Bitmap 的纹理并释放上一帧及其纹理、其他尺寸的画面、同一画面不重复处理、上一帧仍在处理时读取画面、播放／暂停／跳转和声音设置的转发与检查、被拒绝的播放、每次结束只通知一次、抛出异常的监听器、错误画面、在画面处理途中释放，以及两个入口的严格模式 TypeScript 使用方及五种被拒绝的误用 | Node，[`tests/video.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/video.test.mjs) | 7 个用例 |
| 示例：从画布读取，确认实时画布流至少跟随了三种颜色；页面录制的四秒 WebM 在播放前显示首帧、暂停后静止、播放到结束只通知一次，然后循环 | 无头 Chromium 153，软件 WebGL2 | 2 个场景 |
| 其他工具和编码的文件、Safari 和 Firefox、硬件 GPU、手机、大视频的开销 | — | 未运行 |

## 不在本次范围内

- 把视频元素直接上传到 GPU 的路径；带透明通道的视频；字幕；画中画；通过 2D 混音器播放的音频。
