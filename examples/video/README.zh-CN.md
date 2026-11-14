# 视频

[English](README.md) | 简体中文

用页面自己生成的画面演示 `@egret/engine/web/video`：一个画布每秒变色四次。左侧实时显示它的流；右侧是页面用 `MediaRecorder` 把其中四秒录成的 WebM 文件，以文件形式回放。仓库里没有任何视频文件。

## 运行

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

在服务器打印的主机和端口上打开 `/examples/video/index.html`。加上 `?backend=webgl2` 或 `?backend=webgpu` 选择后端。

## 可以试什么

- 观察左侧视频跟随画布变化。
- 右侧显示首帧后，按“播放”、“暂停”再按“播放”；它会停在结尾。按“循环”再按“播放”：它会循环播放。

## 工作方式

| 部分 | 来自 |
| --- | --- |
| 实时视频 | 用画布的 `captureStream(30)` 调用 `createBrowserVideo({ assets, stream })` |
| 录制的视频 | 用录像的 Blob 地址调用 `createBrowserVideo({ assets, src })`，以及 `onEnded` |
| 每一帧 | 对每个视频调用 `update()`，然后绘制这一帧 |

参见[视频指南](../../knowledge-base/Cns/docs/video.md)。

## 检查

```text
node examples/video/verify.mjs <Playwright index.mjs 的绝对路径> <新的输出目录的绝对路径> [software]
```

检查逐像素读取画布。没有人按过任何东西，也没有使用手机。
