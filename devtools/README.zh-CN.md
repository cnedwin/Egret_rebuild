# 白鹭开发工具

[English](README.md) | 简体中文

用于开发和调试白鹭引擎游戏的性能监控。它是独立的包：引擎不导入它，正式构建只要不导入它，就不包含它的任何代码。

监控只在调试模式显示。非调试模式下，`attachPerformanceMonitor` 不向页面添加任何内容，并返回一个空监控。游戏里对它的调用可以原样保留，每次调用只是一次空函数调用。

## 使用

```js
import { createEngineProbe, createHandleTracker } from '@egret/devtools';
import { attachPerformanceMonitor, sharedHostSource } from '@egret/devtools/web';

const { monitor } = attachPerformanceMonitor({ canvas, backend: 'webgl2' });
const probe = createEngineProbe(monitor);
const tracker = createHandleTracker();

const engine = await createEngineForProfile({ host: probe.wrapHost(host) }, 'egret.shared-frame2d/1');
const tracked = tracker.engine(engine);
monitor.addSource('host', sharedHostSource(host));
monitor.addSource('handles', tracker.source());

const scope = tracked.createScope();

function frame() {
  monitor.beginFrame();
  monitor.measure('logic', () => updateGame());
  probe.advanceTime(engine, elapsedSeconds);
  probe.renderSharedFrame(engine, frameOptions);
  monitor.endFrame();
  requestAnimationFrame(frame);
}
```

在页面地址后加 `?egretDebug=1` 进入调试模式。这个选择会按站点记住，`?egretDebug=0` 退出。也可以传入 `enabled: true` 或 `enabled: false` 由代码决定，例如根据构建开关。

徽标显示每秒帧数、平均帧耗时和最近的帧间隔。点击徽标展开面板，拖动可以移动。按反引号键或三指触摸可隐藏和显示。位置、状态和打开的标签页会被记住。

## 面板

- **概览。** 帧间隔图和预算线、分位数、分段耗时堆叠条，以及提示。
- **渲染。** 最近一帧共享帧的统计、宿主状态、WebGL2 宿主阶段和 World3D 数值。
- **资源。** 各类句柄的存活数，以及内存：帧内页面、宿主持有的字节数，浏览器提供时还有 JS 堆估算。
- **卡顿。** 长帧列表，最新的在前。点开一条可以看它的分段耗时和当时绘制的帧。
- **自定义。** 你登记的计数、仪表和其他数据源。

**暂停**会定住面板显示的内容以便阅读，监控继续采集。**重置**清空测量数据。

提示说明数字的含义。慢帧会被判断为受页面自身工作限制（并指出最大的分段），或在页面工作很少时判断为受 GPU 和显示限制。其他提示包括：最近的长帧、区域接近或达到每帧上限、批次主要被同一原因打断、特效通道过多、宿主失败、停止或积压，以及句柄数量持续增长。`evaluateHints(snapshot)` 以数据形式返回同样的提示，不需要面板。

## 读取的数据

- **帧节奏。** 动画帧之间的间隔：每秒帧数，50、95、99 分位，超过预算 1.5 倍的帧数，以及标签页隐藏之类的暂停。暂停不计为慢帧。
- **帧内工作与分段。** `beginFrame` 到 `endFrame` 之间的时间，以及每个具名 `measure` 调用的时间。
- **引擎耗时拆分。** `createEngineProbe` 通过引擎已有的调用为三个分段计时：`clock` 对应 `advanceTime`（游戏时钟、补间、序列），`capture` 对应把显示树读成一帧，`submit` 对应宿主的准备和提交。`probe.wrapHost(host)` 返回一个为帧端口计时的宿主；把它交给引擎，原宿主留着调用它自己的方法。宿主没有包装时，整帧记为一个 `render` 分段。
- **共享帧统计。** 从 `renderSharedFrame` 返回的帧记录读取：各类命令数、三角形数、特效通道数、页数、区域数及其每帧上限，以及估算的绘制批次和每个批次结束的原因。帧记录不可变，所以不需要在引擎里加钩子。
- **宿主状态。** `sharedHostSource(host)` 读取共享 WebGL2 或 WebGPU 宿主已经公开的状态。`sharedWebGL2TimingSource(host)` 按阶段读取 WebGL2 宿主内部的耗时，前提是宿主创建时传入了 `measureSharedFrames: true`。`world3DSource(renderer)` 读取 World3D 渲染器的计数，`recordWorld3DFrame(monitor, renderer.measureFrame(draw))` 记录它测得的一帧，渲染器解析出 GPU 时间后也会记录。
- **句柄。** `createHandleTracker` 统计通过 `tracker.engine(engine)` 创建的 Scope、补间、序列、资源组、位图槽和票据，以及其中仍然存活的数量。连续二十秒只增不减的计数会被标记为增长。跟踪器只弱引用句柄。
- **自定义数值。** `addCount`、`setGauge` 和 `addSource`。
- **卡顿记录。** 超过阈值的帧会连同它的分段耗时和帧统计一起保留，事后可以查看。

**导出**把会话保存为 JSON，格式名为 `egret.devtools.performance-session/1`，包含环境、快照、帧历史和卡顿记录。在手机上会打开系统分享。

`@egret/devtools` 只包含采集器。它不使用 DOM，可以在 Node 中运行，用于测试和无界面测量。

## 限制

- 批次数是根据相邻命令估算的。实际绘制调用由渲染器决定。
- 页面字节数按每个页面像素四字节计算，不是 GPU 测量值。
- `submit` 是宿主的准备和提交之和。只有 WebGL2 宿主公开内部阶段，WebGPU 宿主没有。
- 票据没有可读的状态，所以在它的 Scope 关闭之前都算存活，即使已经提交或释放。直接在引擎上创建、没有经过 `tracker.engine(engine)` 的句柄不计入。
- 引擎没有改动。引擎没有作为调用公开的步骤，这里无法计时。
- 监控测量主线程上的时间。GPU 时间只有 World3D 的 WebGL2 渲染器自己测得时才会显示。

## 开发

使用 Node.js 26.7.0。先在仓库根目录安装依赖；本包没有自己的依赖，用根目录的 TypeScript 编译。

    pnpm build
    node devtools/tools/build.mjs
    node --test devtools/tests/*.test.mjs
    node devtools/tools/example.mjs

最后一条命令在 `http://127.0.0.1:4174/devtools/example/index.html?egretDebug=1` 提供示例。

`node devtools/tools/verify-browser.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` 在真实浏览器中用两个共享后端运行示例。它检查监控只在调试模式显示，并在那台机器上响应输入。它不是设备或性能验收。
