// SPDX-License-Identifier: Apache-2.0
// Shapes drawn with a sprite's graphics: a circle, an ellipse, a rounded rectangle with a line, a translucent disc,
// a filled path, lines and curves, and a ring of wedges drawn with arcs and drawn again when a button turns them.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createExampleHost, chooseBackend } from '../host.mjs';

const WIDTH = 480, HEIGHT = 270;
export const COLOURS = { clear: 0x1b1f2a, circle: 0xe05050, ellipse: 0x50b0e0, panel: 0x2b3550, line: 0xf0c030, glass: 0xffffff, arrow: 0x8040c0, stroke: 0x60d080, wedgeA: 0xf08030, wedgeB: 0x3080f0 };
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), backend = chooseBackend();
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }, backend) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: COLOURS.clear, clearAlpha: 1 });
const sprite = () => engine.stage.addChild(scope.use(new Sprite()));
let failure, turns = 0;

// Filled shapes. Each call draws with the fill and the line that are set when it is made.
sprite().graphics.beginFill(COLOURS.circle).drawCircle(60, 60, 40).endFill();
sprite().graphics.beginFill(COLOURS.ellipse).drawEllipse(110, 40, 80, 40).endFill();
// A fill and a line together: the line is centred on the outline and drawn over the fill.
sprite().graphics.beginFill(COLOURS.panel).lineStyle(4, COLOURS.line).drawRoundRect(240, 30, 120, 60, 24).endFill();
// A second sprite over the first: half transparent, so what is under it shows through.
sprite().graphics.beginFill(COLOURS.glass, 0.5).drawCircle(350, 90, 30).endFill();
// A path: moveTo and lineTo, filled as a closed outline. This one has a notch.
sprite().graphics.beginFill(COLOURS.arrow).moveTo(30, 150).lineTo(120, 150).lineTo(120, 220).lineTo(75, 185).lineTo(30, 220).endFill();
// Lines need no fill and no endFill. The corner is a mitre.
sprite().graphics.lineStyle(4, COLOURS.stroke).moveTo(150, 160).lineTo(220, 160).lineTo(220, 220);
// A curve bent towards a control point, on the same line style.
sprite().graphics.lineStyle(4, COLOURS.stroke).moveTo(250, 160).curveTo(300, 240, 350, 160);

// A ring of four wedges: each is a path of an outer arc one way and an inner arc back.
const ring = sprite();
function drawRing() {
  const g = ring.graphics;
  g.clear();
  for (let i = 0; i < 4; i++) {
    const from = i * Math.PI / 2 + 0.06, to = (i + 1) * Math.PI / 2 - 0.06;
    g.beginFill((i + turns) % 2 === 0 ? COLOURS.wedgeA : COLOURS.wedgeB)
      .moveTo(400 + 45 * Math.cos(from), 190 + 45 * Math.sin(from))
      .drawArc(400, 190, 45, from, to).drawArc(400, 190, 22, to, from, true).endFill();
  }
}
drawRing();
document.querySelector('#spin').addEventListener('click', () => {
  try { turns++; drawRing(); } catch (cause) { failure = String(cause?.code ?? cause); }
  show();
});

function show() {
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Shapes / 形状 8 · turns / 转动 ' + turns + ' · ' + backend;
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
function tick() { try { show(); } catch (cause) { failure = String(cause?.code ?? cause?.message ?? cause); } if (scope.state === 'open') requestAnimationFrame(tick); }
requestAnimationFrame(tick);

globalThis.__egretGraphicsExample = { readSnapshot: () => ({ backend, colours: COLOURS, turns, failure }) };
show();
