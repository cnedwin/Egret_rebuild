# Video

English | [简体中文](../../Cns/docs/video.md)

`@egret/engine/video` shows a video as a display object: each new picture of its source becomes, through the Engine's assets, the texture of one Bitmap, which a game moves, scales, masks and draws over like any other. `@egret/engine/web/video` makes the source from a video element of the page — a file, a stream such as a canvas's or a camera's, or an element the page already has. Both are optional entries: a game that does not import them loads nothing of them.

**What is checked and what is not.** The player is checked in Node with a source the test drives, and the [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/video/README.md) in headless Chromium with software WebGL2, where a live stream and a WebM file the page records are read back from the canvas. No video file made by another tool, no hardware GPU, no phone and no Safari or Firefox was run, and the cost of large videos was not measured. See [What was run](#what-was-run).

## Use

```js
import { createBrowserVideo } from '@egret/engine/web/video';

const intro = scope.use(createBrowserVideo({ assets: engine.assets, src: 'video/intro.webm', maxWidth: 960 }));
stage.addChild(intro.display);
intro.onEnded(() => showTitle());
await intro.play();               // muted by default, so the page lets it play without a press

function frame() { void intro.update(); engine.renderSharedFrame(frameOptions); }
```

| Browser option | Meaning | Default |
| --- | --- | --- |
| `assets` | The Engine's assets | — |
| `src`, `stream`, `element` | One of: a file's address, a `MediaStream`, or a video element of the page's own (left as it was when the video is disposed) | — |
| `loop`, `muted`, `volume` | Passed to the element | false, true, 1 |
| `maxWidth` | Pictures wider than this are scaled down before they become textures | 1280 |
| `crossOrigin` | For a file from another origin that allows it | none |

A video has `state` (`loading`, `ready`, `playing`, `paused`, `ended`, `failed`, `closed`), `display`, `width` and `height` (of its pictures), `duration`, `currentTime`, `loop`, `muted`, `volume`, `play()` (rejects with `VIDEO_PLAY_REFUSED` when the page does not let it, as a browser does with sound before a press), `pause()`, `seek(seconds)`, `update()`, `onEnded(listener)`, `snapshot()` and `dispose()`. The browser video adds `element`.

`update()` shows the newest picture the source has, if it changed: call it once a frame. It resolves true when it shows a new picture. While one picture is still being made a texture, another call returns false at once and counts as skipped, and the next takes whatever is newest then, so a slow frame never queues pictures. The Bitmap is made with the first picture; until then `display` is empty.

`createVideo({ assets, source })` takes any `VideoSource` — `readFrame()` giving the newest `{ image, time }` once, `play`, `pause`, `seek`, `loop`, `muted`, `volume` and `dispose` — for pictures made some other way, or for tests.

## How a picture reaches the screen, and what it costs

The browser source learns of each picture the element presents (with `requestVideoFrameCallback` where the browser has it, otherwise on each change of time), draws it into a canvas of the size it will be shown at, reads it back, and gives it as an `ImageData2D`. The player makes it a texture, leases it under the video's own asset type, gives it to the Bitmap and lets go of the picture before, whose texture is disposed when nothing holds it. The renderer uploads it as a new page.

So each new picture is read back and uploaded whole, on the main thread: about `width × height × 4` bytes twice. A 640 by 360 video at 30 pictures a second moves about 28 MB a second each way. `maxWidth` keeps that in hand; a path that hands the element to the GPU without reading it back is not in this slice.

## Errors

| Code | When |
| --- | --- |
| `VIDEO_OPTIONS_INVALID` | An option or an argument is not what it may be |
| `VIDEO_PLAY_REFUSED` | The page did not let it play; the cause is the browser's |
| `VIDEO_FRAME_INVALID` | A source gave a picture that is not an `ImageData2D` with a time |
| `VIDEO_LISTENER_FAILED` | An end listener threw; the others were told first |
| `VIDEO_CLOSED` | The video was disposed |
| `VIDEO_CLEANUP_FAILED` | Letting go of the Bitmap, the lease or the source failed |
| `VIDEO_UNAVAILABLE` | The page could not make a canvas to read pictures with |

## What was run

| What | Where | Result |
| --- | --- | --- |
| Options, each new picture becoming the Bitmap's texture with the one before let go and its texture disposed, pictures of another size, the same picture not made twice, a picture taken while another is still on its way, play, pause, seek and sound passed on and checked, a refused play, the end told once each time, throwing listeners, bad pictures, disposal with a picture still on its way, and a strict TypeScript consumer of both entries with five refused misuses | Node, [`tests/video.test.mjs`](https://github.com/cnedwin/Egret_rebuild/blob/main/tests/video.test.mjs) | 7 cases |
| The example: a live canvas stream followed through at least three of its colours, read from the canvas; four seconds the page recorded as WebM, shown before it plays, paused and still, played to its end and told once, then looping | Headless Chromium 153, software WebGL2 | 2 scenarios |
| Files from other tools and codecs, Safari and Firefox, a hardware GPU, a phone, the cost of large videos | — | Not run |

## Not in this slice

- A path that uploads the video element straight to the GPU; alpha video; subtitles; picture-in-picture; audio routed through the 2D mixer.
