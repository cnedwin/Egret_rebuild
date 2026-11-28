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
| `catchUpSeconds` | 一帧拉长时，在画一帧之前把多少秒拆成若干个不超过 `maxStepSeconds` 的步。默认 0：只给一步最长长度 |
| `onError` | 循环被停止的原因，只告知一次 |
| `requestFrame`、`cancelFrame` | 显示器的帧回调及其取消，供测试或其他调度器使用。默认是 `requestAnimationFrame` 和 `cancelAnimationFrame` |

## 限制

显示器每显示一帧，循环就走一步，步长是实际经过的时间。设置 `catchUpSeconds` 后，超过 `maxStepSeconds` 的一帧会拆成若干步，所以每秒只画 8 帧的设备仍按正常速度运行，每帧最多补这么多秒；更长的间隔其余部分丢弃。它没有固定步长：需要固定步长的物理，自行把得到的秒数切分。页面隐藏时它不会自己暂停；浏览器会停止调用它，之后的第一步是最长步长。

### 绘制准备与有限失败恢复

可选的 `beforeRender()` 在 `update`、`shouldRender` 以及 Host 待完成帧检查之后、捕获之前进行仅用于画面的准备。静止或因积压而跳过的帧不调用它；Host 仍可能拒绝一次已初步准入的绘制。不得在此推进游戏逻辑、时钟或语义动画事件。

默认错误仍停止循环。使用 `renderRetry: { maxConsecutive: 2, shouldRetry(error, consecutiveFailure) { ... } }` 时，游戏可显式接受特定绘制调用错误并于后续显示帧尝试。上限为 1 至 8 的整数；仅成功绘制调用或显式重新启动重置连续失败次数。时间与更新不会重放；更新、帧构建或绘制准备错误仍是致命错误。返回 false、抛错或达到上限后仍失败会停止循环。配置后快照含 `recoveredRenderFailures`，与 Host 背压的 `skipped` 分开。BrowserGame 和 Play 均转发两个选项；已有 Engine 诊断仍会通知。仅用于已独立确认可恢复的绘制错误。

## 可选的回调计时

给 `createBrowserFrameLoop` 传入 `onFrameTiming(sample)`，每次运行中的浏览器回调会产生一份不可变样本。每个循环的 `id` 单调递增，`rafTimestampMs` 为实际传入的动画帧时间戳，`callbackStartMs` / `callbackEndMs` 使用浏览器 performance 的时间原点。可与同页其他循环对齐，但不能当作显示呈现。

CPU 墙钟阶段 `updateMs`、`decisionMs`、`hostCheckMs`、`prepareMs`、`renderMs` 分别为时钟与更新、是否需要绘制的判断、实际宿主准入检查、呈现准备与绘制调用。未进入阶段为零。仅在既有宿主准入检查读到时才有 `pendingFrames`，保留旧帧不额外检查宿主。结果为 `retained`（保留）、`backpressure`（背压）、`rendered`（绘制调用返回，不是 GPU 完成）、`retry`（重试）、`interrupted`（中断）或 `failed`（失败）。原有步数、帧数和跳帧数不改变。诊断回调在计时完成后执行，应保持简短同步、保留有限历史，不等待 Promise；同步观察者异常不影响循环。未设置观察者时不分配逐回调计时样本。
