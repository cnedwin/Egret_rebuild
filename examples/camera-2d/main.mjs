// SPDX-License-Identifier: Apache-2.0
// A courtyard larger than the view, seen through a 2D camera: it follows a disciple with a dead zone,
// stops at the walls, zooms, shakes, looks at the gate and comes back, and moves far hills and near
// leaves at their own speed. The page keeps one clock and gives the camera the time of each frame.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createCamera2D } from '@egret/engine/camera';
import { createExampleHost } from '../host.mjs';

// The camera may look over the far wall at the sky and the hills: its bounds reach above the yard.
const WIDTH = 480, HEIGHT = 270, YARD = { x: 0, y: 0, width: 1600, height: 900 }, VIEWABLE = { x: 0, y: -260, width: 1600, height: 1160 }, SPEED = 220;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x9fc4e8, clearAlpha: 1 });
let failure;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };
const layer = () => engine.stage.addChild(scope.use(new Sprite()));

// Back to front: the hills, the yard, the leaves. Only the yard is the world; the others are layers.
const hills = layer(), world = layer(), leaves = layer();
// Hills a little above the far wall, as far as the camera can take them at three tenths of its speed.
for (let i = 0; i < 16; i++) hills.graphics.beginFill(i % 2 ? 0x6f8fa8 : 0x5d7c96).drawRect(i * 120 - 200, 30 - (i % 3) * 30, 140, 200).endFill();
const ground = world.addChild(scope.use(new Sprite()));
ground.graphics.beginFill(0xc9b48a).drawRect(YARD.x, YARD.y, YARD.width, YARD.height).endFill();
// Paving: a stone every hundred units, darker on alternate rows, so that movement can be seen.
for (let y = 0; y < YARD.height; y += 100) for (let x = 0; x < YARD.width; x += 100) ground.graphics.beginFill((x / 100 + y / 100) % 2 ? 0xb9a37a : 0xd4c09a).drawRect(x + 4, y + 4, 92, 92).endFill();
// The walls, and the gate in the middle of the far wall.
ground.graphics.beginFill(0x7b2d26).drawRect(0, 0, YARD.width, 24).drawRect(0, YARD.height - 24, YARD.width, 24).drawRect(0, 0, 24, YARD.height).drawRect(YARD.width - 24, 0, 24, YARD.height).endFill();
const GATE = { x: YARD.width / 2, y: 40 };
ground.graphics.beginFill(0x2b2b2b).drawRect(GATE.x - 60, 0, 120, 60).endFill();
const hero = world.addChild(scope.use(new Sprite()));
hero.graphics.beginFill(0xf2f2f2).drawRect(-14, -14, 28, 28).endFill();
hero.graphics.beginFill(0x1f3a93).drawRect(-8, -8, 16, 16).endFill();
hero.x = 300; hero.y = 450;
// Leaves scattered over all the ground the near layer passes at one and four tenths of the camera's speed.
for (let y = -500; y < 1500; y += 170) for (let x = -400; x < 2400; x += 260) leaves.graphics.beginFill(0x2f6b3a, 0.85).drawRect(x + ((y / 170) % 2) * 120, y, 70, 40).endFill();

const camera = scope.use(createCamera2D({ world, width: WIDTH, height: HEIGHT, center: { x: hero.x, y: hero.y }, bounds: VIEWABLE, shakeOffset: 12, shakeRotation: 1.5, seed: 7 }));
camera.addLayer(hills, { factor: 0.3, zoomFactor: 0.3 });
camera.addLayer(leaves, { factor: 1.4, zoomFactor: 1 });
const FOLLOW = { smoothing: 0.2, deadZone: { width: 80, height: 50 } };
camera.follow(hero, FOLLOW);

const held = new Set(), KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
addEventListener('keydown', event => { if (KEYS[event.code]) { held.add(event.code); event.preventDefault(); } });
addEventListener('keyup', event => { held.delete(event.code); });
addEventListener('blur', () => held.clear());
// Presses count from the zoom asked for, not the one reached, so two quick presses zoom twice.
let zoomGoal = 1;
const zoomBy = factor => { zoomGoal = Math.min(2.5, Math.max(0.5, zoomGoal * factor)); camera.zoomTo(zoomGoal, 0.3); };
document.querySelector('#zoom-in').addEventListener('click', () => zoomBy(1.5));
document.querySelector('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.5));
document.querySelector('#shake').addEventListener('click', () => camera.shake({ trauma: 0.7 }));
document.querySelector('#pan').addEventListener('click', () => camera.panTo(GATE.x, GATE.y, 1.2));
document.querySelector('#follow').addEventListener('click', () => camera.follow(hero, FOLLOW));
canvas.addEventListener('wheel', event => { event.preventDefault(); zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

/** One step of the game: the disciple moves, inside the walls, and the camera is moved after it. */
function step(seconds) {
  let dx = 0, dy = 0;
  for (const code of held) { dx += KEYS[code][0]; dy += KEYS[code][1]; }
  const length = Math.hypot(dx, dy) || 1;
  hero.x = Math.min(YARD.width - 40, Math.max(40, hero.x + dx / length * SPEED * seconds));
  hero.y = Math.min(YARD.height - 40, Math.max(40, hero.y + dy / length * SPEED * seconds));
  camera.update(seconds);
}
function show() {
  const picture = camera.snapshot(), screen = camera.worldToScreen(hero.x, hero.y);
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Zoom / 缩放 ' + picture.zoom.toFixed(2) + ' · ' + (picture.following ? 'following / 跟随中' : 'free / 自由');
  stateView.textContent = JSON.stringify({ hero: { x: Math.round(hero.x), y: Math.round(hero.y) }, onScreen: { x: Math.round(screen.x), y: Math.round(screen.y) }, camera: picture }, null, 2);
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
// `?manual` leaves the time to a check: it steps the game itself and the page only draws.
const manual = new URLSearchParams(location.search).has('manual');
let last;
function tick(now) {
  try {
    if (!manual) step(last === undefined ? 0 : Math.min(0.1, (now - last) / 1000));
    last = now;
    show();
  } catch (cause) { fail(cause); }
  if (scope.state === 'open') requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

globalThis.__egretCameraExample = {
  step(seconds, keys = []) { held.clear(); for (const key of keys) held.add(key); step(seconds); held.clear(); show(); },
  run(seconds, keys = [], fps = 60) { for (let t = 0; t < seconds - 1e-9; t += 1 / fps) this.step(1 / fps, keys); },
  readSnapshot: () => ({ hero: { x: hero.x, y: hero.y }, onScreen: camera.worldToScreen(hero.x, hero.y), camera: camera.snapshot(),
    world: { x: world.x, y: world.y, scale: world.scaleX, rotation: world.rotation, anchorX: world.anchorOffsetX, anchorY: world.anchorOffsetY },
    hills: { anchorX: hills.anchorOffsetX, scale: hills.scaleX }, leaves: { anchorX: leaves.anchorOffsetX, scale: leaves.scaleX },
    gateOnScreen: camera.worldToScreen(GATE.x, GATE.y), failure }),
};
show();
