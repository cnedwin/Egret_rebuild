# The frame loop

English | [简体中文](../../Cns/docs/frame-loop.md)

`@egret/engine/web/loop` runs a game in a page: on each frame the display shows, it moves the Engine's clock, steps the game and draws one frame.

**What is checked and what is not.** The loop is checked in Node with a display the test drives, with stand-ins and with a real Engine and its clock. The [starter example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.md) runs on it and is checked in headless Chromium with software WebGL2. WebGPU was not run.

## Use

```js
import { createBrowserFrameLoop } from '@egret/engine/web/loop';

const loop = createBrowserFrameLoop({
  engine, host,
  frame: { width: 480, height: 270, clearColor: 0x1b1f2a, clearAlpha: 1 },
  update(seconds) { hero.x += 120 * seconds; },
  onError(error) { console.error(error.code, error.cause); },
});
loop.start();
```

`loop.stop()` pauses it and `loop.start()` starts it again. `loop.dispose()` ends it. `loop.snapshot()` gives its state, the steps taken, the frames drawn and the frames skipped.

## What it does on each frame

1. **It moves the Engine's clock** with `engine.advanceTime`. Tweens and frame sequences run on that clock: without this call they stand still.
2. **It calls `update(seconds)`** with the seconds since the step before: 0 on the first frame.
3. **It draws** with `engine.renderSharedFrame(frame)`. `frame` may be a function that is called for each frame drawn.

## What it takes care of

A loop written by hand with `requestAnimationFrame` meets three things sooner or later. This one handles them.

| What happens | By hand | With the loop |
| --- | --- | --- |
| The tab was hidden for a minute | The next step is a minute long, and `engine.advanceTime` refuses it with `CLOCK_DELTA_LIMIT` | The step is `maxStepSeconds` long, 0.1 by default, and never more than the clock takes |
| The device draws slower than the display refreshes | The Host holds two unfinished frames and refuses a third; the Engine throws `FRAME_RENDER_FAILED`, whose cause is `WEBGL2_BACKPRESSURE` or `WEBGPU_BACKPRESSURE` | The frame is skipped and counted. The game still took its step |
| The loop was stopped and started again | The time spent stopped arrives as one step | The first step after a start is 0 |

To skip frames the loop reads `host.getStatus().pendingFrames`, so give it the Host the Engine was made with. A Host made with another `maxPendingFrames` needs the same number given to the loop. Without a Host the loop still counts a frame refused for backpressure as skipped, but the Engine has by then reported the refusal as a diagnostic.

## When something fails

A failure in `update` or in drawing stops the loop. Its state becomes `failed` and `snapshot().failure` holds the error. `onError` is told once; without it the error is thrown from the display's callback, where the page's console shows it. `start()` runs the loop again.

## Options

| Option | Meaning |
| --- | --- |
| `engine` | The Engine. Required |
| `frame` | What `renderSharedFrame` takes, or a function that gives it. Required |
| `host` | The Host, read to skip frames while it is busy |
| `maxPendingFrames` | How many unfinished frames the Host takes. Defaults to 2 |
| `update` | One step of the game, with the seconds since the step before |
| `maxStepSeconds` | The longest step. Defaults to 0.1 |
| `catchUpSeconds` | How much of a long frame is played back as several steps of at most `maxStepSeconds` before one draw. Defaults to 0: one step of the longest length |
| `onError` | Told once of what stopped the loop |
| `requestFrame`, `cancelFrame` | The display's frame callback and its cancellation, for a test or another scheduler. `requestAnimationFrame` and `cancelAnimationFrame` by default |

## Limits

The loop takes one step for each frame the display shows, of the length that passed. With `catchUpSeconds` a frame longer than `maxStepSeconds` is given as several steps, so a device that draws at 8 frames a second still plays at full speed, up to that many seconds a frame; the rest of a longer gap is dropped. It has no fixed-rate step: physics that needs one divides the seconds it is given. It does not pause by itself when the page is hidden; the browser stops calling it, and the first step afterwards is the longest length.
