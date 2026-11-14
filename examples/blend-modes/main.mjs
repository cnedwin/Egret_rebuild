// SPDX-License-Identifier: Apache-2.0
// Blend modes by Egret's names: the same amber square over the same blue panel, once in each mode, and a column
// of glowing sparks drawn with `add` on a container, which its children take from it.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x1b1f2a, clearAlpha: 1 });
let failure;

export const MODES = ['normal', 'add', 'multiply', 'screen', 'erase'];
export const PANEL = 0x4a7bd0, SQUARE = 0xf0a030, SQUARE_ALPHA = 0.6;
const columns = MODES.map((mode, i) => {
  const x = 20 + i * 92;
  // The panel and the square are siblings: the square's mode decides how it meets the panel under it.
  const panel = engine.stage.addChild(scope.use(new Sprite()));
  panel.graphics.beginFill(PANEL).drawRect(x, 40, 80, 120).endFill();
  const square = engine.stage.addChild(scope.use(new Sprite()));
  square.graphics.beginFill(SQUARE, SQUARE_ALPHA).drawRect(x + 10, 70, 60, 60).endFill();
  square.blendMode = mode;
  return { mode, x, square };
});

// Sparks: overlapping dots in one container whose mode is `add`, so where they overlap they grow brighter.
const sparks = engine.stage.addChild(scope.use(new DisplayObjectContainer()));
sparks.blendMode = 'add';
const dots = [[60, 210], [90, 210], [75, 230]];
for (const [x, y] of dots) {
  const dot = sparks.addChild(scope.use(new Sprite()));
  dot.graphics.beginFill(0x803010).drawRect(x - 20, y - 20, 40, 40).endFill();
}

function show() {
  status.textContent = failure ? "Failed / 失败：" + failure : 'Modes / 混合模式：' + columns.map(c => c.square.blendMode).join(' · ') + ' · sparks / 火花 ' + sparks.blendMode;
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
document.querySelector('#toggle').addEventListener('click', () => {
  try { sparks.blendMode = sparks.blendMode === 'add' ? 'normal' : 'add'; } catch (cause) { failure = String(cause?.code ?? cause); }
  show();
});
function tick() { try { show(); } catch (cause) { failure = String(cause?.code ?? cause?.message ?? cause); } if (scope.state === 'open') requestAnimationFrame(tick); }
requestAnimationFrame(tick);

globalThis.__egretBlendExample = {
  readSnapshot: () => ({ modes: columns.map(c => ({ mode: c.square.blendMode, x: c.x, material: c.square.sharedMaterial?.blend ?? null })), sparks: sparks.blendMode, failure }),
};
show();
