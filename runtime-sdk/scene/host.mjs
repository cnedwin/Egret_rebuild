// SPDX-License-Identifier: Apache-2.0
import { CYCLE, PAGE, createScene } from './scene.mjs';
import { base64, encodeFrame } from './commands.mjs';

let scene;
const ready = createScene().then(value => {
  scene = value;
  document.title = 'egret-ready';
}).catch(error => {
  document.title = 'egret-error:' + error.message;
  throw error;
});
globalThis.EgretRuntimeFixture = Object.freeze({
  ready,
  texture() { return base64(scene.pageBytes()); },
  frame(index) {
    const captured = scene.capture(index);
    return base64(encodeFrame(captured, index % CYCLE, scene.page, PAGE.id));
  },
  async close() {
    await ready;
    return scene.close();
  }
});
