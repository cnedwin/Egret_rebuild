// SPDX-License-Identifier: Apache-2.0
// Three streams of particles: a brazier that burns, petals that fall in the wind, and sparks where the
// page is pressed. The image of a particle is a soft dot the page paints, so the repository carries no picture.
import { createAssetRef, createAssetType, createEngineForProfile, createImageData2D, createTexture, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createParticleEmitter } from '@egret/engine/particles';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x14161f, clearAlpha: 1 });
let failure;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };

/** A white dot that fades to its edge: tinted and faded by each particle. */
function dot(size) {
  const surface = document.createElement('canvas');
  surface.width = size; surface.height = size;
  const context = surface.getContext('2d', { willReadFrequently: true }), gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, size, size);
  return createTexture(createImageData2D({ width: size, height: size, pixels: new Uint8Array(context.getImageData(0, 0, size, size).data) }));
}
const image = dot(32), type = createAssetType('example-particle-dot', value => value === image);
engine.assets.register(type, { load: async () => image, dispose: () => image.dispose() });
const texture = scope.use(await engine.assets.acquire(createAssetRef(type, 'dot')));

// The ground and the brazier, drawn plainly.
const ground = engine.stage.addChild(scope.use(new Sprite()));
ground.graphics.beginFill(0x232838).drawRect(0, 200, WIDTH, 70).endFill();
ground.graphics.beginFill(0x5a3a22).drawRect(110, 180, 60, 22).endFill();
ground.graphics.beginFill(0x3b2a1e).drawRect(132, 200, 16, 40).endFill();

const make = options => { const emitter = scope.use(createParticleEmitter({ texture, ...options })); engine.stage.addChild(emitter.display); return emitter; };
const fire = make({ rate: 90, lifetime: [0.6, 1.1], speed: [30, 70], angle: [250, 290], gravity: { x: 0, y: -40 }, drag: 0.6, size: 18, startScale: [0.8, 1.2], endScale: 0.2,
  startColor: 0xffd34d, endColor: 0xd23a1e, startAlpha: 1, endAlpha: 0, shape: { kind: 'rectangle', width: 44, height: 6 }, seed: 11 });
fire.x = 140; fire.y = 182;
const petals = make({ rate: 12, lifetime: [5, 7], speed: [10, 30], angle: [80, 100], gravity: { x: 14, y: 10 }, drag: 0.2, size: { width: 10, height: 6 },
  startColor: 0xf6a5c0, endColor: 0xf6a5c0, startAlpha: 0.95, endAlpha: 0.8, rotation: [0, 360], spin: [-120, 120], shape: { kind: 'rectangle', width: WIDTH + 100, height: 0 }, seed: 23 });
petals.x = WIDTH / 2 - 50; petals.y = -10;
const sparks = make({ running: false, maxParticles: 1200, lifetime: [0.4, 0.9], speed: [80, 220], gravity: { x: 0, y: 300 }, drag: 1, size: 8, startScale: 1, endScale: 0.3,
  startColor: 0xfff2b0, endColor: 0xff7a1a, startAlpha: 1, endAlpha: 0, shape: { kind: 'circle', radius: 4 }, seed: 31 });
const emitters = { fire, petals, sparks };

function toggle(button, emitter) {
  button.addEventListener('click', () => { if (emitter.running) emitter.stop(); else emitter.start(); button.setAttribute('aria-pressed', String(emitter.running)); });
}
toggle(document.querySelector('#fire'), fire);
toggle(document.querySelector('#petals'), petals);
function burst(x, y) { sparks.x = x; sparks.y = y; sparks.burst(80); }
document.querySelector('#burst').addEventListener('click', () => burst(340, 120));
canvas.addEventListener('pointerdown', event => {
  const box = canvas.getBoundingClientRect();
  burst((event.clientX - box.left) * WIDTH / box.width, (event.clientY - box.top) * HEIGHT / box.height);
});

function step(seconds) { for (const emitter of Object.values(emitters)) emitter.update(seconds); }
function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure : Object.entries(emitters).map(([name, emitter]) => name + ' ' + emitter.alive).join(' · ');
  stateView.textContent = JSON.stringify(Object.fromEntries(Object.entries(emitters).map(([name, emitter]) => [name, emitter.snapshot()])), null, 2);
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
const manual = new URLSearchParams(location.search).has('manual');
let last;
function tick(now) {
  try { if (!manual) step(last === undefined ? 0 : Math.min(0.1, (now - last) / 1000)); last = now; show(); } catch (cause) { fail(cause); }
  if (scope.state === 'open') requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

globalThis.__egretParticlesExample = {
  run(seconds, fps = 60) { for (let t = 0; t < seconds - 1e-9; t += 1 / fps) step(1 / fps); show(); },
  readSnapshot: () => ({ ...Object.fromEntries(Object.entries(emitters).map(([name, emitter]) => [name, { ...emitter.snapshot(), running: emitter.running }])),
    petalsLow: petals.particles().filter(p => p.y > 150).length, sparkAt: sparks.particles()[0] ? { x: sparks.particles()[0].x, y: sparks.particles()[0].y } : null, failure }),
};
show();
