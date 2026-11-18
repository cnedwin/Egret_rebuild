// SPDX-License-Identifier: Apache-2.0
import { CYCLE, PAGE, createScene } from './scene.mjs';
import { base64, encodeFrame } from './commands.mjs';
import { createPumpedHost } from './pumpedHost.mjs';

const clock = globalThis.EgretRuntimeClock;
const now = clock ? () => clock.now() : () => performance.now();
const pumped = clock ? createPumpedHost(now) : undefined;
let scene;
let generationNs = 0;
const ready = createScene(pumped).then(value => {
  scene = value;
  if (!pumped) document.title = 'egret-ready';
}).catch(error => {
  if (!pumped) document.title = 'egret-error:' + error.message;
  throw error;
});

function frameBytes(index) {
  const captured = scene.capture(index);
  return encodeFrame(captured, index % CYCLE, scene.page, PAGE.id);
}

function timedFrame(index) {
  const start = now();
  const bytes = frameBytes(index);
  generationNs = Math.round((now() - start) * 1e6);
  return bytes;
}

globalThis.EgretRuntimeFixture = Object.freeze({
  ready,
  pollTimers() { pumped?.poll(); },
  texture() { return base64(scene.pageBytes()); },
  textureBuffer() { return scene.pageBytes().buffer; },
  frame(index) { return base64(frameBytes(index)); },
  frameBuffer(index) { return timedFrame(index).buffer; },
  get generationNs() { return generationNs; },
  timedBase64(index) {
    const start = now();
    const encoded = base64(timedFrame(index));
    return Math.round((now() - start) * 1e6) + ':' + generationNs + ':' + encoded;
  },
  async close() {
    await ready;
    return scene.close();
  }
});
