# Egret devtools

English | [简体中文](README.zh-CN.md)

A performance monitor for developing and debugging games on the Egret engine. It is a separate package: the engine does not import it, and a release build that does not import it carries none of its code.

The monitor appears only in debug mode. Outside debug mode `attachPerformanceMonitor` adds nothing to the page and returns an inert monitor, so the calls a game makes on it stay in place and cost one empty function call each.

## Use

```js
import { createBrowserFrameLoop } from '@egret/engine/web/loop';
import { createEngineProbe, createHandleTracker, frameLoopSource } from '@egret/devtools';
import { attachPerformanceMonitor, sharedHostSource } from '@egret/devtools/web';

const { monitor } = attachPerformanceMonitor({ canvas, backend: 'webgl2' });
const probe = createEngineProbe(monitor);
const tracker = createHandleTracker();

const engine = await createEngineForProfile({ host: probe.wrapHost(host) }, 'egret.shared-frame2d/1');
const tracked = tracker.engine(engine);
const scope = tracked.createScope();

// The engine's frame loop, measured: each step is one frame of work.
const loop = createBrowserFrameLoop(probe.frameLoop({ engine, host, frame: frameOptions, update: updateGame }));
monitor.addSource('loop', frameLoopSource(loop));
monitor.addSource('host', sharedHostSource(host));
monitor.addSource('handles', tracker.source());
loop.start();
```

`probe.frameLoop` takes the options of `createBrowserFrameLoop` and returns them with the engine, the update and the display's callback measured; every other option is kept. A game with its own loop calls the monitor itself:

```js
function frame() {
  monitor.beginFrame();
  monitor.measure('logic', () => updateGame());
  probe.advanceTime(engine, elapsedSeconds);
  probe.renderSharedFrame(engine, frameOptions);
  monitor.endFrame();
  requestAnimationFrame(frame);
}
```

`createBrowserGame` makes its Host and its loop itself and offers no place to measure them. With it the monitor shows frame pacing, the loop's counts through `frameLoopSource(game.loop)`, and whatever the game's `update` measures with `monitor.measure`. For the engine's share and the frame counts, make the Host, the Engine and the loop with their own entries, as above; that is what `createBrowserGame` does.

Open the page with `?egretDebug=1` to enter debug mode. The choice is remembered for the site; `?egretDebug=0` leaves it again. Pass `enabled: true` or `enabled: false` to decide in code instead, for example from a build flag.

The badge shows frames per second, mean frame time and the latest frame intervals. Click it for the panel. Drag it to move it. The backquote key, or a touch with three fingers, hides and shows it. Position, state and the open tab are remembered.

## The panel

- **Overview.** Frame intervals as a graph against the budget, percentiles, the sections as one stacked bar, and hints.
- **Render.** Counts of the latest shared frame, the frame loop, host status, WebGL2 host phases and World3D values.
- **Resources.** Live handles by kind, and memory: frame pages, bytes the host holds, and the browser's JS heap estimate where it offers one.
- **Hitches.** Long frames, newest first. Open one to see its sections and the frame it drew.
- **Custom.** Your counters, gauges and other sources.

**Pause** holds what the panel shows so it can be read; the monitor keeps collecting. **Reset** forgets the measurements.

Hints say what the numbers mean. Slow frames are named as bound by the page's own work, with the largest section, or by the GPU and display when that work is small. Other hints cover a recent long frame, regions or page bytes near or at the per-frame limit, runs mostly broken by one cause, many effect groups, a frame loop that stopped or skips a tenth of its frames, a host that failed, stopped or fell behind, and handle counts that keep growing. `evaluateHints(snapshot)` returns the same hints as data, without the panel.

## What it reads

- **Frame pacing.** The interval between animation frames: frames per second, 50th, 95th and 99th percentiles, frames over one and a half budgets, and pauses such as a hidden tab, which are not counted as slow frames.
- **Frame work and sections.** Time between `beginFrame` and `endFrame`, and each named `measure` call.
- **The engine's share, split.** `createEngineProbe` times the engine through calls it already offers: `clock` for `advanceTime` (game clock, tweens, sequences), `capture` for reading the display tree into a frame, and `submit` for the host's preparation and submission. With `probe.frameLoop` the game's own step is the `update` section. `probe.wrapHost(host)` returns a host that times its frame port; give it to the engine and keep the original for its own methods. Without a wrapped host the frame is one `render` section.
- **Shared frame counts.** Read from the frame record that `renderSharedFrame` returns: commands by kind, triangles, effect groups and what they ask for (blur, color matrix, glow, outline, mask), draws that blend other than normally, pages, regions against the per-frame limit of 4,096, and an estimate of draw runs with the reason each run ended. The frame record is immutable, so this needs no hook inside the engine.
- **Frame loop.** `frameLoopSource(loop)` reads the state of a `createBrowserFrameLoop` loop, the steps it took, the frames it drew and the frames it skipped while the host was busy, with the skipped share of the latest second.
- **Host status.** `sharedHostSource(host)` reads the status a shared WebGL2 or WebGPU host already publishes. `sharedWebGL2TimingSource(host)` reads the time inside a WebGL2 host by phase, when the host was created with `measureSharedFrames: true`. `world3DSource(renderer)` reads the counters of a World3D renderer, and `recordWorld3DFrame(monitor, renderer.measureFrame(draw))` records its measured frame, including GPU time once the renderer has resolved it.
- **Handles.** `createHandleTracker` counts scopes, tweens, sequences, asset groups, bitmap slots and tickets created through `tracker.engine(engine)`, and how many are still alive. A count that only rises for twenty seconds is marked as growing. The tracker holds handles weakly.
- **Your own values.** `addCount`, `setGauge` and `addSource`.
- **Hitch log.** A frame longer than the threshold is kept with its sections and frame counts, so it can be read after it has passed.

**Export** saves the session as JSON with the schema name `egret.devtools.performance-session/1`: environment, snapshot, frame history and hitch log. On a phone it opens the share sheet.

`@egret/devtools` is the collector alone. It uses no DOM and runs in Node, for tests and headless measurements.

## Limits

- Run counts are an estimate from neighbouring commands. The renderer decides the real draw calls.
- Page bytes are four bytes per page pixel, not a GPU measurement.
- `submit` is the host's preparation and submission together. Only the WebGL2 host publishes its inner phases; the WebGPU host does not.
- A ticket has no readable state, so it counts as alive until its scope closes, even after it was committed or disposed. Handles created on the engine directly, not through `tracker.engine(engine)`, are not counted.
- A game made with `createBrowserGame` cannot have its engine's share split or its frames counted, because its Host and loop are made inside that call.
- The engine is not changed. Nothing here can time a step the engine does not expose as a call.
- The monitor measures time on the main thread. GPU time appears only where the World3D WebGL2 renderer measured it itself.

## Develop

Use Node.js 26.7.0. Install the repository root first; this package has no dependencies of its own and compiles with the root TypeScript.

    pnpm build
    node devtools/tools/build.mjs
    node --test devtools/tests/*.test.mjs
    node devtools/tools/example.mjs

The last command serves the example at `http://127.0.0.1:4174/devtools/example/index.html?egretDebug=1`.

`node devtools/tools/verify-browser.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` runs the example in a real browser on both shared backends. It checks that the monitor appears only in debug mode and responds to input on that machine. It is not a device or performance acceptance.
