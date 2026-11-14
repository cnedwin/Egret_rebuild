# 帧循环

[English](../../en/docs/frame-loop.md) | 简体中文

`@egret/engine/web/loop` 在页面中驱动游戏：显示器每显示一帧，它就推进 Engine 的时钟、让游戏走一步、绘制一帧。

**验证了什么，没有验证什么。** 帧循环在 Node 中用测试驱动的显示器验证，既用替身，也用真实的 Engine 及其时钟。[起步示例](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.zh-CN.md)运行在它之上，并在无头 Chromium 的软件 WebGL2 中核对。未运行 WebGPU。

## 用法

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

`loop.stop()` 暂停，`loop.start()` 重新开始，`loop.dispose()` 结束。`loop.snapshot()` 给出状态、已走的步数、已绘制的帧数和跳过的帧数。

## 每一帧做什么

1. **推进 Engine 的时钟**，调用 `engine.advanceTime`。缓动和序列帧都跑在这个时钟上：不调用它，它们就不会动。
2. **调用 `update(seconds)`**，参数是距上一步的秒数：第一帧为 0。
3. **绘制**，调用 `engine.renderSharedFrame(frame)`。`frame` 可以是函数，每绘制一帧调用一次。

## 它替你处理的事

手写 `requestAnimationFrame` 循环迟早会遇到三件事，这个循环都处理了。

| 发生了什么 | 手写时 | 用帧循环时 |
| --- | --- | --- |
| 标签页被隐藏了一分钟 | 下一步长达一分钟，`engine.advanceTime` 以 `CLOCK_DELTA_LIMIT` 拒绝 | 这一步的长度是 `maxStepSeconds`，默认 0.1，且不会超过时钟允许的上限 |
| 设备绘制得比显示器刷新慢 | Host 持有两帧未完成的画面，拒绝第三帧；Engine 抛出 `FRAME_RENDER_FAILED`，其 cause 是 `WEBGL2_BACKPRESSURE` 或 `WEBGPU_BACKPRESSURE` | 跳过这一帧并计数。游戏仍然走了这一步 |
| 循环停止后重新开始 | 停止期间的时间作为一步到来 | 重新开始后的第一步为 0 |

为了跳帧，循环读取 `host.getStatus().pendingFrames`，所以要把创建 Engine 时用的 Host 交给它。如果 Host 创建时用了别的 `maxPendingFrames`，也要把同样的数字交给循环。不给 Host 时，循环仍会把因背压被拒绝的帧算作跳过，但此时 Engine 已经把这次拒绝作为诊断上报了。

## 出错时

`update` 或绘制中的失败会停止循环。状态变为 `failed`，`snapshot().failure` 保存错误。`onError` 只被告知一次；没有它时，错误从显示器的回调中抛出，页面的控制台会显示。`start()` 让循环再次运行。

## 选项

| 选项 | 含义 |
| --- | --- |
| `engine` | Engine。必填 |
| `frame` | `renderSharedFrame` 接受的参数，或返回它的函数。必填 |
| `host` | Host，用来在它忙时跳帧 |
| `maxPendingFrames` | Host 接受多少帧未完成的画面。默认 2 |
| `update` | 游戏的一步，参数是距上一步的秒数 |
| `maxStepSeconds` | 最长的一步。默认 0.1 |
| `onError` | 循环被停止的原因，只告知一次 |
| `requestFrame`、`cancelFrame` | 显示器的帧回调及其取消，供测试或其他调度器使用。默认是 `requestAnimationFrame` 和 `cancelAnimationFrame` |

## 限制

显示器每显示一帧，循环就走一步，步长是实际经过的时间。它没有带追帧的固定步长：需要固定步长的物理，自行把得到的秒数切分。页面隐藏时它不会自己暂停；浏览器会停止调用它，之后的第一步是最长步长。
