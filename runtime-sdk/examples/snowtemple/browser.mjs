// SPDX-License-Identifier: Apache-2.0
import { loadGltf3D } from '@egret/engine/world3d';
import { createWebGL2Renderer3D } from '@egret/engine/webgl2/world3d';
import { createHeroScene, WIDTH, HEIGHT } from './hero.mjs';

const stage = document.querySelector('#stage'), canvas = document.querySelector('#scene');
const status = document.querySelector('#loading');
const images = [], controller = new AbortController();
let asset, hero, renderer, frame, previous;
async function bytes(file) {
  const response = await fetch('./' + file, { signal: controller.signal });
  if (!response.ok) throw new Error(file + ' HTTP ' + response.status);
  return new Uint8Array(await response.arrayBuffer());
}
function close() {
  controller.abort();
  cancelAnimationFrame(frame);
  hero?.close(); hero = undefined;
  renderer?.dispose(); renderer = undefined;
  asset?.dispose(); asset = undefined;
  for (const image of images.splice(0)) image.close();
}
async function start() {
  asset = await loadGltf3D(await bytes('hero-low.glb'), {
    async decodeImage({ bytes, mimeType }) {
      const image = await createImageBitmap(new Blob([bytes], { type: mimeType }),
        { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      if (controller.signal.aborted) { image.close(); controller.signal.throwIfAborted(); }
      images.push(image);
      return image;
    }
  });
  const spear = await bytes('spear.bin'), spearEdge = await bytes('spearEdge.bin');
  hero = createHeroScene(asset, { spear, spearEdge });
  renderer = createWebGL2Renderer3D({ canvas, shadows: false, antialias: false, toneMapping: 'aces' });
  renderer.setSize(WIDTH, HEIGHT);
  const selected = new URLSearchParams(location.search).get('checkpoint');
  if (selected) hero.hold(selected);
  const signal = controller.signal;
  for (const type of ['down', 'up', 'cancel']) {
    stage.addEventListener('pointer' + type, event => {
      if (type === 'down') stage.setPointerCapture(event.pointerId);
      const r = stage.getBoundingClientRect();
      hero.input({ type, id: event.pointerId, x: (event.clientX - r.left) * WIDTH / r.width,
        y: (event.clientY - r.top) * HEIGHT / r.height });
    }, { signal });
  }
  const visibility = () => {
    previous = undefined;
    if (document.hidden) hero.pause(); else hero.resume();
  };
  document.addEventListener('visibilitychange', visibility, { signal });
  visibility();
  globalThis.snowTemplePose = { state: () => hero.state(), hold: name => hero.hold(name) };
  status.textContent = '';
  function draw(now) {
    if (!document.hidden) {
      hero.update(previous === undefined ? 0 : (now - previous) / 1000);
      previous = now;
      renderer.render(hero.scene, hero.camera);
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
}
addEventListener('pagehide', event => { if (!event.persisted) close(); });
start().catch(error => { close(); status.textContent = error.message; console.error(error); });
