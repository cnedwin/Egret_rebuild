// SPDX-License-Identifier: Apache-2.0
// A training hall in 2D physics: walls from a grid of cells, a disciple moved by the keys who slides along
// them, stones that fall, bounce and roll, a slope, a pond that senses what is in it, and a ray.
import { Bitmap, createAssetRef, createAssetType, createEngineForProfile, createImageData2D, createTexture, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createPhysicsWorld } from '@egret/engine/physics2d';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270, CELL = 15, SPEED = 140;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x1e2230, clearAlpha: 1 });
let failure;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };

// The hall as cells: walls, a ledge, a low wall. Thirty-two across, eighteen down.
const HALL = [
  '################################',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#.......########...............#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#.......................#......#',
  '#.......................#......#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '################################',
];
const world = scope.use(createPhysicsWorld({ gravity: { x: 0, y: 600 } }));
const walls = world.addTileColliders({ columns: 32, rows: 18, tileWidth: CELL, tileHeight: CELL, solid: (column, row) => HALL[row][column] === '#', friction: 0.6 });
const hall = engine.stage.addChild(scope.use(new Sprite()));
for (const wall of walls) { const b = wall.bounds(); hall.graphics.beginFill(0x6b4a33).drawRect(b.x, b.y, b.width, b.height).endFill(); }
// A slope, drawn as steps of its own box turned: a turned box has no drawing of its own here, so a strip of squares shows it.
const slope = world.addBody({ kind: 'static', shape: { kind: 'box', width: 160, height: 10 }, x: 330, y: 230, angle: -20, friction: 0.4 });
for (let i = -8; i <= 8; i++) { const a = -20 * Math.PI / 180; hall.graphics.beginFill(0x8a6a4a).drawRect(330 + Math.cos(a) * i * 9.4 - 5, 230 + Math.sin(a) * i * 9.4 - 5, 10, 10).endFill(); }
// The pond: a sensor that tells what enters and leaves it.
const pond = world.addBody({ kind: 'static', shape: { kind: 'box', width: 90, height: 30 }, x: 120, y: 240, sensor: true });
const pondView = engine.stage.addChildAt(scope.use(new Sprite()), 0);
let inPond = 0;
function paintPond() { pondView.graphics.clear(); pondView.graphics.beginFill(inPond > 0 ? 0x4fa3e0 : 0x2a4f7a).drawRect(75, 225, 90, 30).endFill(); }
paintPond();
// Only stones are counted: the pond lies on the floor, and the floor, a static body, touches the sensor too.
world.onContact(contact => {
  const other = contact.a === pond ? contact.b : contact.b === pond ? contact.a : undefined;
  if (other !== undefined && other.kind === 'dynamic') { inPond += contact.type === 'begin' ? 1 : -1; paintPond(); }
});

// Round stones and the disciple are images the page paints.
function painted(name, size, draw) {
  const surface = document.createElement('canvas');
  surface.width = size; surface.height = size;
  const context = surface.getContext('2d', { willReadFrequently: true });
  draw(context);
  const texture = createTexture(createImageData2D({ width: size, height: size, pixels: new Uint8Array(context.getImageData(0, 0, size, size).data) })), type = createAssetType('example-physics-' + name, value => value === texture);
  engine.assets.register(type, { load: async () => texture, dispose: () => texture.dispose() });
  return engine.assets.acquire(createAssetRef(type, name));
}
const stoneImage = scope.use(await painted('stone', 16, context => { context.fillStyle = '#c9c3b8'; context.beginPath(); context.arc(8, 8, 7.5, 0, Math.PI * 2); context.fill(); }));
const heroImage = scope.use(await painted('hero', 16, context => { context.fillStyle = '#f2f2f2'; context.fillRect(0, 0, 16, 16); context.fillStyle = '#1f3a93'; context.fillRect(3, 3, 10, 10); }));

const heroView = engine.stage.addChild(scope.use(new Bitmap(heroImage)));
heroView.anchorOffsetX = 8; heroView.anchorOffsetY = 8;
const hero = world.addBody({ kind: 'kinematic', shape: { kind: 'box', width: 16, height: 16 }, x: 60, y: 200, display: heroView });
const ray = engine.stage.addChild(scope.use(new Sprite()));
const stones = [];
function drop(x, y) {
  const view = engine.stage.addChild(scope.use(new Bitmap(stoneImage)));
  view.anchorOffsetX = 8; view.anchorOffsetY = 8;
  const body = world.addBody({ shape: { kind: 'circle', radius: 7.5 }, x, y, restitution: 0.4, friction: 0.2, display: view, data: view });
  stones.push(body);
  view.x = x; view.y = y;
}
function clearStones() { for (const stone of stones.splice(0)) { world.removeBody(stone); stone.data.dispose(); } }
document.querySelector('#drop').addEventListener('click', () => { for (let i = 0; i < 5; i++) drop(200 + i * 18, 40); });
document.querySelector('#clear').addEventListener('click', clearStones);
canvas.addEventListener('pointerdown', event => {
  const box = canvas.getBoundingClientRect();
  try { drop((event.clientX - box.left) * WIDTH / box.width, (event.clientY - box.top) * HEIGHT / box.height); } catch (cause) { fail(cause); }
});

const held = new Set(), KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
addEventListener('keydown', event => { if (KEYS[event.code]) { held.add(event.code); event.preventDefault(); } });
addEventListener('keyup', event => held.delete(event.code));
addEventListener('blur', () => held.clear());
let lastHit;
function step(seconds) {
  let dx = 0, dy = 0;
  for (const code of held) { dx += KEYS[code][0]; dy += KEYS[code][1]; }
  const length = Math.hypot(dx, dy) || 1;
  world.moveAndSlide(hero, dx / length * SPEED * seconds, dy / length * SPEED * seconds);
  world.step(seconds);
  // The ray goes right from the disciple and stops at the first thing it meets.
  lastHit = world.raycast({ x: hero.x + 9, y: hero.y }, { x: hero.x + 400, y: hero.y });
  ray.graphics.clear();
  ray.graphics.beginFill(0xf2c14e).drawRect(hero.x + 9, hero.y - 0.5, (lastHit ? lastHit.point.x : hero.x + 400) - hero.x - 9, 1).endFill();
}
function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Stones / 石头 ' + stones.length + ' · in the pond / 池中 ' + inPond + ' · ray / 射线 ' + (lastHit ? Math.round(lastHit.point.x) : '—');
  stateView.textContent = JSON.stringify({ hero: { x: Math.round(hero.x), y: Math.round(hero.y) }, ...world.snapshot() }, null, 2);
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
const manual = new URLSearchParams(location.search).has('manual');
let last;
function tick(now) {
  try { if (!manual) step(last === undefined ? 0 : Math.min(0.1, (now - last) / 1000)); last = now; show(); } catch (cause) { fail(cause); }
  if (scope.state === 'open') requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

globalThis.__egretPhysicsExample = {
  run(seconds, keys = [], fps = 60) { for (let t = 0; t < seconds - 1e-9; t += 1 / fps) { held.clear(); for (const key of keys) held.add(key); step(1 / fps); } held.clear(); show(); },
  drop(x, y) { drop(x, y); show(); },
  readSnapshot: () => ({ hero: { x: hero.x, y: hero.y }, stones: stones.map(s => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy })), inPond, ray: lastHit ? { x: lastHit.point.x, y: lastHit.point.y, wall: walls.includes(lastHit.body), slope: lastHit.body === slope } : null,
    walls: walls.length, ...world.snapshot(), failure }),
};
show();
