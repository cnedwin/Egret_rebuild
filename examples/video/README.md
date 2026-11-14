# Video

English | [简体中文](README.zh-CN.md)

`@egret/engine/web/video` with a picture the page makes itself: a canvas changes colour four times a second. Its stream is shown live on the left; on the right, four seconds of it, recorded by the page into a WebM file with `MediaRecorder`, are played back as a file. The repository carries no video file.

## Run

```text
node tools/build.mjs
node tools/serve-canvas.mjs
```

Open `/examples/video/index.html` on the host and port the server prints. Add `?backend=webgl2` or `?backend=webgpu` to choose a backend.

## What to try

- Watch the left video follow the canvas.
- When the right one shows its first picture, press Play, Pause and Play again; it stops at its end. Press Loop and Play: it plays round.

## How it works

| Part | From |
| --- | --- |
| The live video | `createBrowserVideo({ assets, stream })` with the canvas's `captureStream(30)` |
| The recorded video | `createBrowserVideo({ assets, src })` with a Blob address of the recording, and `onEnded` |
| Each frame | `update()` on each video, then the frame is drawn |

See the [video guide](../../knowledge-base/en/docs/video.md).

## Check

```text
node examples/video/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
```

The check reads the canvas pixel by pixel. No person pressed anything and no phone was used.
