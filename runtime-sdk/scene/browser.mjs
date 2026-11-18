// SPDX-License-Identifier: Apache-2.0
import { createSharedWebGL2Host } from '@egret/engine/webgl2';
import { CYCLE, WIDTH, HEIGHT, createScene } from './scene.mjs';
import { base64 } from './commands.mjs';

const canvas = document.querySelector('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const host = createSharedWebGL2Host({ canvas, pixelRatio: 1, outputAlpha: 'opaque', enableReadback: true });
const sceneStart = performance.now();
const ready = createScene(host);
let busy = false;

function raf() { return new Promise(resolve => requestAnimationFrame(resolve)); }

async function exclusive(body) {
  if (busy) throw new Error('Scene operation already in progress');
  busy = true;
  try { return await body(await ready); } finally { busy = false; }
}

async function draw(scene, index) {
  await host.whenIdle();
  if (document.visibilityState !== 'visible') throw new Error('Measurement requires foreground');
  const callback = await raf();
  if (document.visibilityState !== 'visible') throw new Error('Measurement lost foreground');
  const start = performance.now();
  const captured = scene.capture(index);
  const built = performance.now();
  host.renderSharedFrame(captured);
  const submitted = performance.now();
  return { callback, submitted, captureMs: built - start, submitMs: submitted - built };
}

const first = ready.then(async scene => {
  const { submitted } = await draw(scene, 0);
  await host.whenIdle();
  const completed = performance.now();
  const rect = canvas.getBoundingClientRect();
  // Keep backing resolution separate from the visible, aspect-fitted output.
  // Browser chrome can reduce the available viewport compared with the native Activity.
  return { firstSubmitSinceNavigationMs: submitted, firstSubmitSinceSceneStartMs: submitted - sceneStart,
    firstGpuCompleteSinceNavigationMs: completed, presentation: { backingWidth: canvas.width,
      backingHeight: canvas.height, cssWidth: rect.width, cssHeight: rect.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight, devicePixelRatio } };
});

globalThis.EgretRuntimeBenchmark = Object.freeze({
  ready: first,
  // No readback in a timed run. Callback spacing includes host backpressure.
  run(warmup, count) {
    if (![warmup, count].every(Number.isSafeInteger) || warmup < 0 || count < 1 || warmup + count > 20000)
      throw new RangeError('Invalid sample count');
    return exclusive(async scene => {
      await first;
      const samples = [];
      let previous = (await draw(scene, CYCLE - 1)).callback;
      for (let n = 0; n < warmup + count; n++) {
        const current = await draw(scene, n % CYCLE);
        if (n >= warmup) samples.push({ callbackIntervalMs: current.callback - previous,
          captureMs: current.captureMs, submitMs: current.submitMs });
        previous = current.callback;
      }
      await host.whenIdle();
      return { backend: 'webgl2', width: WIDTH, height: HEIGHT, warmup, samples };
    });
  },
  pixels(index) {
    return exclusive(async scene => {
      await first;
      await host.whenIdle();
      const captured = scene.capture(index);
      const read = host.requestReadback();
      void read.catch(() => {});
      host.renderSharedFrame(captured);
      const result = await read;
      return { width: result.width, height: result.height, rgbaBase64: base64(result.bytes) };
    });
  },
  close() { return exclusive(async scene => {
    await first;
    const result = await scene.close();
    return { ...result, host: host.getStatus() };
  }); }
});
first.then(() => { document.title = 'egret-ready'; }, error => { document.title = 'egret-error:' + error.message; });
