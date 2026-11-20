// SPDX-License-Identifier: Apache-2.0
// Masks of vector shapes and lines of gradients, drawn by the engine and, below it, by the page's own 2D canvas with
// its clip and its gradient strokes. Stripes show through a circle and through a star; a thick line runs from red
// to blue, and a ring from gold at its middle to green at its edge. `?backend=webgl2` or `webgpu` chooses the Host.
// `examples/vector-mask/verify.mjs` reads both canvases.
import { DisplayObjectContainer, Sprite } from '@egret/engine';
import { createBrowserGame } from '@egret/engine/web/game';

const query = new URLSearchParams(location.search);
const report = (window.__vector = { frames: 0, errors: [], points: {} });
const GROUND = 0x1c2433;
const STAR = Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI) / 5,
    radius = i % 2 === 0 ? 70 : 28;
  return [240 + radius * Math.cos(angle), 80 + radius * Math.sin(angle)];
});
/** Stripes of red and blue over a box, as both canvases draw them. */
const STRIPES = (x, y, width, height) =>
  Array.from({ length: Math.ceil(width / 20) }, (_, i) => ({
    x: x + 20 * i,
    y,
    width: 20,
    height,
    color: i % 2 === 0 ? 0xe23b3b : 0x3b6ee2
  }));
const css = color => '#' + color.toString(16).padStart(6, '0');

// The reference: the page's 2D canvas.
const reference = document.querySelector('#reference').getContext('2d');
reference.fillStyle = css(GROUND);
reference.fillRect(0, 0, 480, 160);
const stripes2d = (path, x, y, width, height) => {
  reference.save();
  path();
  reference.clip();
  for (const stripe of STRIPES(x, y, width, height)) {
    reference.fillStyle = css(stripe.color);
    reference.fillRect(stripe.x, stripe.y, stripe.width, stripe.height);
  }
  reference.restore();
};
stripes2d(
  () => {
    reference.beginPath();
    reference.arc(80, 80, 60, 0, 2 * Math.PI);
  },
  10,
  10,
  140,
  140
);
stripes2d(
  () => {
    reference.beginPath();
    STAR.forEach(([x, y], i) => (i === 0 ? reference.moveTo(x, y) : reference.lineTo(x, y)));
    reference.closePath();
  },
  170,
  10,
  140,
  140
);
const along = reference.createLinearGradient(340, 0, 460, 0);
along.addColorStop(0, '#ff2020');
along.addColorStop(1, '#2040ff');
reference.strokeStyle = along;
reference.lineWidth = 16;
reference.beginPath();
reference.moveTo(340, 40);
reference.lineTo(460, 40);
reference.stroke();
const out = reference.createRadialGradient(400, 112, 0, 400, 112, 40);
out.addColorStop(0.6, '#ffd23f');
out.addColorStop(1, '#22c55e');
reference.strokeStyle = out;
reference.lineWidth = 10;
reference.beginPath();
reference.arc(400, 112, 28, 0, 2 * Math.PI);
reference.stroke();

let game;
try {
  game = await createBrowserGame({
    canvas: document.querySelector('#scene'),
    width: 480,
    height: 160,
    pixelRatio: 1,
    clearColor: GROUND,
    blendSpace: 'srgb',
    effects: true,
    backend: query.get('backend') ?? 'auto',
    update() {
      report.frames++;
    },
    onError(cause) {
      report.errors.push(String(cause?.code ?? cause?.message ?? cause));
    }
  });
} catch (cause) {
  report.errors.push(String(cause?.code ?? cause?.message ?? cause));
  throw cause;
}
report.backend = game.backend;
const { engine, scope } = game;
/** Stripes in a holder masked by a shape the function draws; the mask is not on the stage. */
const masked = (draw, x, y, width, height) => {
  const holder = engine.stage.addChild(scope.use(new DisplayObjectContainer()));
  const stripes = holder.addChild(scope.use(new Sprite()));
  for (const stripe of STRIPES(x, y, width, height))
    stripes.graphics.beginFill(stripe.color).drawRect(stripe.x, stripe.y, stripe.width, stripe.height).endFill();
  const mask = scope.use(new Sprite());
  draw(mask.graphics);
  holder.renderEffect = { shapeMask: mask };
  return { holder, mask };
};
masked(g => g.beginFill(0xffffff).drawCircle(80, 80, 60).endFill(), 10, 10, 140, 140);
masked(
  g => {
    g.beginFill(0xffffff);
    STAR.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.lineTo(STAR[0][0], STAR[0][1]).endFill();
  },
  170,
  10,
  140,
  140
);
const lines = engine.stage.addChild(scope.use(new Sprite()));
lines.graphics
  .lineStyle(16, 0xffffff)
  .lineLinearGradientStyle(340, 0, 460, 0, [
    { offset: 0, color: 0xff2020 },
    { offset: 1, color: 0x2040ff }
  ])
  .moveTo(340, 40)
  .lineTo(460, 40)
  .lineStyle(10, 0xffffff)
  .lineRadialGradientStyle(400, 112, 40, [
    { offset: 0.6, color: 0xffd23f },
    { offset: 1, color: 0x22c55e }
  ])
  .drawCircle(400, 112, 28);
// Points to read, each away from an edge: inside a mask the stripe there shows; outside it the ground does.
report.points = {
  circleMiddle: [70, 80],
  circleCorner: [16, 16],
  circleEdgeOutside: [140, 140],
  starMiddle: [240, 80],
  starNotch: [266, 44],
  starPoint: [240, 18],
  starOutside: [175, 145],
  lineStart: [346, 40],
  lineMiddle: [400, 40],
  lineEnd: [454, 40],
  ringInner: [400, 87],
  ringOuter: [431, 112],
  ringMiddle: [400, 112]
};
report.ready = true;
report.hostFailure = () => game.host.getStatus().firstFailure?.code;
