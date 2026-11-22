// SPDX-License-Identifier: Apache-2.0
import { loadGltf3D } from '@egret/engine/world3d';
import { createWebGL2Renderer3D } from '@egret/engine/webgl2/world3d';
import { WIDTH, HEIGHT } from './actors.mjs';
import { controls, openScene } from './profile.mjs';

const stage = document.querySelector('#stage'), canvas = document.querySelector('#scene');
const status = document.querySelector('#loading');
const images = [], controller = new AbortController();
const assets = [];
let hero, renderer, frame, previous;
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
  for (const asset of assets.splice(0)) asset.dispose();
  for (const image of images.splice(0)) image.close();
}
async function glb(file) {
  const asset = await loadGltf3D(await bytes(file), {
    async decodeImage({ bytes, mimeType }) {
      const image = await createImageBitmap(new Blob([bytes], { type: mimeType }),
        { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      if (controller.signal.aborted) { image.close(); controller.signal.throwIfAborted(); }
      images.push(image);
      return image;
    }
  });
  assets.push(asset);
  return asset;
}
async function start() {
  hero = await openScene({ glb, bytes });
  const nav = document.querySelector('nav');
  function label(text, x, y) {
    const item = document.createElement('span');
    item.textContent = text;
    item.style.setProperty('--x', (100 * x / WIDTH) + '%');
    item.style.setProperty('--y', (100 * y / HEIGHT) + '%');
    nav.append(item);
    return item;
  }
  for (const [text, x, y] of controls) label(text, x, y);
  const health = hero.state().encounter ? [label('', 86, 26), label('', 646, 26)] : null;
  const message = hero.messages ? label('Ready', WIDTH / 2, 66) : null;
  let reported = -Infinity;
  renderer = createWebGL2Renderer3D({ canvas, shadows: false, antialias: false, toneMapping: 'aces' });
  renderer.setSize(WIDTH, HEIGHT);
  const selected = new URLSearchParams(location.search).get('checkpoint');
  if (selected && hero.hold) hero.hold(selected);
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
  globalThis.snowTemplePose = { state: () => hero.state() };
  if (hero.hold) globalThis.snowTemplePose.hold = name => hero.hold(name);
  status.textContent = '';
  function draw(now) {
    if (!document.hidden) {
      hero.update(previous === undefined ? 0 : (now - previous) / 1000);
      previous = now;
      renderer.render(hero.scene, hero.camera);
      if (health && now - reported >= 200) {
        const state = hero.state();
        health[0].textContent = 'Lin HP ' + Math.ceil(state.hero.hp);
        health[1].textContent = 'Blade HP ' + Math.ceil(state.enemy.hp);
        if (message) message.textContent = state.encounter.message;
        reported = now;
      }
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
}
addEventListener('pagehide', event => { if (!event.persisted) close(); });
start().catch(error => { close(); status.textContent = error.message; console.error(error); });
