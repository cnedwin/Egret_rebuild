// SPDX-License-Identifier: Apache-2.0
// Shapes drawn with a sprite's graphics: a circle, an ellipse, a rounded rectangle with a line, a translucent disc,
// a filled path, lines and curves, a ring of wedges drawn with arcs and drawn again when a button turns them, a
// gradient, a path with a hole, and a dashed line with round ends.
import {
  createAssetRef,
  createAssetType,
  createEngineForProfile,
  createImageData2D,
  createTexture,
  isTexture,
  SHARED_FRAME_PROFILE_2D,
  Sprite
} from '@egret/engine';
import { createExampleHost, chooseBackend } from '../host.mjs';

const WIDTH = 480,
  HEIGHT = 270;
export const COLOURS = {
  clear: 0x1b1f2a,
  circle: 0xe05050,
  ellipse: 0x50b0e0,
  panel: 0x2b3550,
  line: 0xf0c030,
  glass: 0xffffff,
  arrow: 0x8040c0,
  stroke: 0x60d080,
  wedgeA: 0xf08030,
  wedgeB: 0x3080f0,
  from: 0xff0000,
  to: 0x0000ff,
  frame: 0x40c0a0,
  dash: 0xe0e0e0,
  tileA: 0xd0a060,
  tileB: 0x805030
};
const canvas = document.querySelector('#scene'),
  status = document.querySelector('#status'),
  backend = chooseBackend();
const engine = await createEngineForProfile(
  { host: await createExampleHost({ canvas, pixelRatio: 1.5 }, backend) },
  SHARED_FRAME_PROFILE_2D
);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: COLOURS.clear, clearAlpha: 1 });
const sprite = () => engine.stage.addChild(scope.use(new Sprite()));
let failure,
  turns = 0;

// Filled shapes. Each call draws with the fill and the line that are set when it is made.
sprite().graphics.beginFill(COLOURS.circle).drawCircle(60, 60, 40).endFill();
sprite().graphics.beginFill(COLOURS.ellipse).drawEllipse(110, 40, 80, 40).endFill();
// A fill and a line together: the line is centred on the outline and drawn over the fill.
sprite().graphics.beginFill(COLOURS.panel).lineStyle(4, COLOURS.line).drawRoundRect(240, 30, 120, 60, 24).endFill();
// A second sprite over the first: half transparent, so what is under it shows through.
sprite().graphics.beginFill(COLOURS.glass, 0.5).drawCircle(350, 90, 30).endFill();
// A path: moveTo and lineTo, filled as a closed outline. This one has a notch.
sprite()
  .graphics.beginFill(COLOURS.arrow)
  .moveTo(30, 150)
  .lineTo(120, 150)
  .lineTo(120, 220)
  .lineTo(75, 185)
  .lineTo(30, 220)
  .endFill();
// Lines need no fill and no endFill. The corner is a mitre.
sprite().graphics.lineStyle(4, COLOURS.stroke).moveTo(150, 160).lineTo(220, 160).lineTo(220, 220);
// A curve bent towards a control point, on the same line style.
sprite().graphics.lineStyle(4, COLOURS.stroke).moveTo(250, 160).curveTo(300, 240, 350, 160);

// A gradient: the colour runs from one point to another, and stays the end colours beyond them.
sprite()
  .graphics.beginLinearGradientFill(400, 0, 460, 0, [
    { offset: 0, color: COLOURS.from },
    { offset: 1, color: COLOURS.to }
  ])
  .drawRect(390, 10, 80, 40)
  .endFill();
// A hole: the parts of one path are filled together, and a part drawn the other way round inside another is cut out.
sprite()
  .graphics.beginFill(COLOURS.frame)
  .moveTo(390, 60)
  .lineTo(470, 60)
  .lineTo(470, 130)
  .lineTo(390, 130)
  .lineTo(390, 60)
  .moveTo(410, 80)
  .lineTo(410, 110)
  .lineTo(450, 110)
  .lineTo(450, 80)
  .lineTo(410, 80)
  .endFill();
// An image as a fill. This one is made here: eight pixels square, four squares of two colours. A game would load one.
const pixels = new Uint8Array(8 * 8 * 4);
for (let y = 0; y < 8; y++)
  for (let x = 0; x < 8; x++) {
    const colour = x < 4 === y < 4 ? COLOURS.tileA : COLOURS.tileB;
    pixels.set([(colour >> 16) & 255, (colour >> 8) & 255, colour & 255, 255], 4 * (8 * y + x));
  }
const tileType = createAssetType('graphics-example-tile', isTexture),
  tile = createTexture(createImageData2D({ width: 8, height: 8, pixels }));
engine.assets.register(tileType, {
  async load() {
    return tile;
  },
  dispose(value) {
    value.dispose();
  }
});
const tileLease = scope.use(await engine.assets.acquire(createAssetRef(tileType, 'tile'), { signal: scope.signal }));
// The matrix draws each pixel two units wide and starts the image at (140, 104); the image repeats across the shape.
sprite()
  .graphics.beginBitmapFill(tileLease, { a: 2, b: 0, c: 0, d: 2, tx: 140, ty: 104 })
  .drawRoundRect(140, 104, 96, 32, 16)
  .endFill();
// A dashed line: 16 on, 12 off, each dash with round ends.
sprite()
  .graphics.lineStyle(6, COLOURS.dash, 1, { dash: [16, 12], caps: 'round' })
  .moveTo(20, 252)
  .lineTo(460, 252);

// With ?many=300 in the address, that many more discs, each of its own size: every one is a drawing of its own.
const many = Math.min(2000, Math.max(0, Number(new URLSearchParams(location.search).get('many') ?? 0) | 0));
for (let i = 0; i < many; i++)
  sprite()
    .graphics.beginFill(COLOURS.dash)
    .drawCircle(8 + 16 * (i % 30), 8 + 16 * Math.floor(i / 30), 3 + i / many)
    .endFill();

// With ?smooth in the address, two discs over a cleared patch: the first with the stair of pixels at its edge, the
// second with `smoothing`, whose edge fades over that many units.
if (new URLSearchParams(location.search).has('smooth')) {
  const pair = sprite().graphics;
  pair.beginFill(COLOURS.clear).drawRect(150, 85, 200, 100).endFill();
  pair.beginFill(COLOURS.circle).drawCircle(200, 135, 30).endFill();
  pair.smoothing = 4;
  pair.beginFill(COLOURS.circle).drawCircle(290, 135, 30).endFill();
}

// A ring of four wedges: each is a path of an outer arc one way and an inner arc back.
const ring = sprite();
function drawRing() {
  const g = ring.graphics;
  g.clear();
  for (let i = 0; i < 4; i++) {
    const from = (i * Math.PI) / 2 + 0.06,
      to = ((i + 1) * Math.PI) / 2 - 0.06;
    g.beginFill((i + turns) % 2 === 0 ? COLOURS.wedgeA : COLOURS.wedgeB)
      .moveTo(400 + 45 * Math.cos(from), 190 + 45 * Math.sin(from))
      .drawArc(400, 190, 45, from, to)
      .drawArc(400, 190, 22, to, from, true)
      .endFill();
  }
}
drawRing();
document.querySelector('#spin').addEventListener('click', () => {
  try {
    turns++;
    drawRing();
  } catch (cause) {
    failure = String(cause?.code ?? cause);
  }
  show();
});

function show() {
  status.textContent = failure
    ? 'Failed / 失败：' + failure
    : 'Shapes / 形状 12 · turns / 转动 ' + turns + ' · ' + backend;
  if (scope.state === 'open') engine.renderSharedFrame(frame);
}
function tick() {
  try {
    show();
  } catch (cause) {
    failure = String(cause?.code ?? cause?.message ?? cause);
  }
  if (scope.state === 'open') requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

globalThis.__egretGraphicsExample = { readSnapshot: () => ({ backend, colours: COLOURS, turns, failure, many }) };
show();
