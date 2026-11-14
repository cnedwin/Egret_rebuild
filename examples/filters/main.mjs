// SPDX-License-Identifier: Apache-2.0
// Filters on render effects: the same tile with Egret's colour matrix, a glow, a drop shadow, an outline, an inner glow
// and a glow alone. One stage unit is one canvas pixel here, so a check can work out each pixel from the equations.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1, enableEffects: true }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x1b1f2a, clearAlpha: 1 });
let failure;

const TILE = 0x3fa7d6, SIZE = 40;
// Egret's grey: the luminance of each channel, the same for red, green and blue.
const GREY = [0.3086, 0.6094, 0.082, 0, 0, 0.3086, 0.6094, 0.082, 0, 0, 0.3086, 0.6094, 0.082, 0, 0, 0, 0, 0, 1, 0];
const EFFECTS = [
  { name: 'colour matrix', effect: { colorMatrix: GREY } },
  { name: 'glow', effect: { glow: { color: 0xffc040, blur: 6, strength: 2 } } },
  { name: 'drop shadow', effect: { glow: { color: 0x000000, alpha: 0.7, blur: 3, strength: 1, offsetX: 6, offsetY: 6 } } },
  { name: 'outline', effect: { outline: { color: 0xe04040, width: 3 } } },
  { name: 'inner glow', effect: { glow: { color: 0xffffff, blur: 4, strength: 2, inner: true } } },
  { name: 'knockout', effect: { glow: { color: 0x40ff80, blur: 6, strength: 3, knockout: true } } },
];
const tiles = EFFECTS.map(({ name, effect }, i) => {
  const holder = engine.stage.addChild(scope.use(new DisplayObjectContainer()));
  const tile = holder.addChild(scope.use(new Sprite()));
  tile.graphics.beginFill(TILE).drawRect(0, 0, SIZE, SIZE).endFill();
  holder.x = 20 + i * 76; holder.y = 60;
  holder.renderEffect = effect;
  return { name, holder, effect };
});

let on = true;
document.querySelector('#toggle').addEventListener('click', () => {
  on = !on;
  try { for (const t of tiles) t.holder.renderEffect = on ? t.effect : undefined; } catch (cause) { failure = String(cause?.code ?? cause); }
});
function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure : (on ? 'Filters on / 滤镜开' : 'Filters off / 滤镜关');
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
function tick() { try { show(); } catch (cause) { failure = String(cause?.code ?? cause?.message ?? cause); } if (scope.state === 'open') requestAnimationFrame(tick); }
requestAnimationFrame(tick);

globalThis.__egretFiltersExample = {
  readSnapshot: () => ({ on, size: SIZE, tile: TILE, tiles: tiles.map(t => ({ name: t.name, x: t.holder.x, y: t.holder.y, effect: t.holder.renderEffect ?? null })), failure }),
};
show();
