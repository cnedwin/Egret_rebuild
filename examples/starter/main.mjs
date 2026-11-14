// SPDX-License-Identifier: Apache-2.0
// A starting point for a 2D game: one Engine, one stage, a frame loop, pointer and keyboard input, and a rule.
// Copy this folder, keep the import map of index.html, and replace what is between the two "Game" lines.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';

// The stage is 480 by 270 units whatever the size of the canvas on the page.
const WIDTH = 480, HEIGHT = 270;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');

// 1. A Host draws for the Engine: WebGPU where the browser has it, WebGL2 otherwise. `?backend=` chooses one.
const asked = new URLSearchParams(location.search).get('backend');
const backend = asked ?? (navigator.gpu ? 'webgpu' : 'webgl2');
const host = backend === 'webgpu'
  ? (await import('@egret/engine/webgpu')).createSharedWebGPUHost({ canvas, pixelRatio: 1.5 })
  : (await import('@egret/engine/webgl2')).createSharedWebGL2Host({ canvas, pixelRatio: 1.5 });
const engine = await createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D);
// 2. A scope owns what the game creates; disposing the scope disposes all of it.
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x1b1f2a, clearAlpha: 1 });
let failure;

// ---- Game: state ---------------------------------------------------------------------------------------------
export const HERO = 0x4a7bd0, COIN = 0xf0c030, SPEED = 160, HERO_SIZE = 24, COIN_SIZE = 12;
const PLACES = [[80, 60], [400, 60], [240, 135], [80, 210], [400, 210]];
const world = engine.stage.addChild(scope.use(new DisplayObjectContainer()));
const hero = world.addChild(scope.use(new Sprite()));
// A sprite's graphics are drawn around its own origin; x and y place that origin on the stage.
hero.graphics.beginFill(HERO).drawRect(-HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE).endFill();
let coins = [], score = 0, target, keys = new Set();
function start() {
  for (const coin of coins) coin.sprite.dispose();
  coins = PLACES.map(([x, y]) => {
    const sprite = world.addChildAt(scope.use(new Sprite()), 0);
    sprite.graphics.beginFill(COIN).drawRect(-COIN_SIZE / 2, -COIN_SIZE / 2, COIN_SIZE, COIN_SIZE).endFill();
    sprite.x = x; sprite.y = y;
    return { sprite, x, y };
  });
  hero.x = 40; hero.y = 135; score = 0; target = undefined;
}

// ---- Game: input ---------------------------------------------------------------------------------------------
// A place on the page becomes a place on the stage by the canvas's own rectangle.
canvas.addEventListener('pointerdown', event => {
  const box = canvas.getBoundingClientRect();
  target = { x: (event.clientX - box.left) * WIDTH / box.width, y: (event.clientY - box.top) * HEIGHT / box.height };
  canvas.focus();
});
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
canvas.addEventListener('keydown', event => { if (ARROWS[event.code]) { keys.add(event.code); target = undefined; event.preventDefault(); } });
canvas.addEventListener('keyup', event => keys.delete(event.code));
canvas.addEventListener('blur', () => keys.clear());
document.querySelector('#reset').addEventListener('click', start);

// ---- Game: one step of `seconds` -----------------------------------------------------------------------------
function update(seconds) {
  let dx = 0, dy = 0;
  for (const code of keys) { dx += ARROWS[code][0]; dy += ARROWS[code][1]; }
  if (dx === 0 && dy === 0 && target !== undefined) { dx = target.x - hero.x; dy = target.y - hero.y; }
  const distance = Math.hypot(dx, dy), step = SPEED * seconds;
  if (distance > 0) {
    // Arrive exactly instead of stepping past a place that was tapped.
    const reach = target !== undefined && keys.size === 0 && distance <= step, scale = reach ? 1 : step / distance;
    hero.x = Math.min(WIDTH - HERO_SIZE / 2, Math.max(HERO_SIZE / 2, hero.x + dx * scale));
    hero.y = Math.min(HEIGHT - HERO_SIZE / 2, Math.max(HERO_SIZE / 2, hero.y + dy * scale));
    if (reach) target = undefined;
  }
  for (const coin of coins) {
    if (coin.sprite.isDisposed || Math.abs(coin.x - hero.x) > (HERO_SIZE + COIN_SIZE) / 2 || Math.abs(coin.y - hero.y) > (HERO_SIZE + COIN_SIZE) / 2) continue;
    coin.sprite.dispose(); score++;
  }
}
// ---- Game: end -----------------------------------------------------------------------------------------------

// 3. The loop: one step and one frame for each frame the display shows.
let last, frames = 0;
function tick(now) {
  try {
    // A tab that was hidden comes back with a long gap; a step is at most a tenth of a second.
    update(Math.min(0.1, last === undefined ? 0 : (now - last) / 1000)); last = now;
    status.textContent = failure ? 'Failed / 失败：' + failure : 'Coins / 金币 ' + score + ' / ' + PLACES.length + ' · ' + backend;
    // A Host holds at most two frames it has not finished and refuses a third. On a slow device this frame is
    // skipped: the game still took its step, and the next frame draws where things are by then.
    if (host.getStatus().pendingFrames < 2) { engine.renderSharedFrame(frame); frames++; }
  } catch (cause) { failure = String(cause?.code ?? cause?.message ?? cause); }
  if (scope.state === 'open' && failure === undefined) requestAnimationFrame(tick);
  else status.textContent = 'Failed / 失败：' + failure;
}
start();
requestAnimationFrame(tick);

// What a check reads; a game does not need it.
globalThis.__egretStarterExample = {
  readSnapshot: () => ({ backend, hero: { x: hero.x, y: hero.y }, score, coins: coins.filter(c => !c.sprite.isDisposed).map(c => [c.x, c.y]), frames, failure }),
};
