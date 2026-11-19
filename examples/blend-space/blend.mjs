// SPDX-License-Identifier: Apache-2.0
// Translucent colours over a dark ground and over each other, drawn by the engine with the blend space of
// `?space=linear` or `?space=srgb`, and the same drawn by the page's own 2D canvas below it. A 2D canvas mixes the
// stored colour codes; so does the engine's `srgb` space, and a faint white over a dark ground stays faint in both.
// `linear` mixes light: the same white shows stronger. `?backend=webgl2` or `webgpu` chooses the Host.
// `examples/blend-space/verify.mjs` reads both canvases.
import { Sprite } from '@egret/engine';
import { createBrowserGame } from '@egret/engine/web/game';

const query = new URLSearchParams(location.search);
const space = query.get('space') === 'linear' ? 'linear' : 'srgb';
const report = (window.__blend = { frames: 0, errors: [], space, boxes: {} });
const GROUND = 0x1c2433;
/** Each square: where it is, and the colours drawn there in turn, each with its alpha. */
const SQUARES = {
  faintWhite: { x: 10, y: 10, layers: [[0xffffff, 0.1]] },
  halfRedOverBlue: {
    x: 70,
    y: 10,
    layers: [
      [0x0000ff, 1],
      [0xff0000, 0.5]
    ]
  },
  greyOverWhite: {
    x: 130,
    y: 10,
    layers: [
      [0xffffff, 1],
      [0x000000, 0.25]
    ]
  },
  twoFaint: {
    x: 190,
    y: 10,
    layers: [
      [0xffcc00, 0.2],
      [0x33aaff, 0.3]
    ]
  },
  opaque: { x: 250, y: 10, layers: [[0x808080, 1]] }
};
const SIZE = 50;

// The reference: the same squares on the page's 2D canvas.
const reference = document.querySelector('#reference').getContext('2d');
const css = (color, alpha) => `rgba(${color >> 16},${(color >> 8) & 255},${color & 255},${alpha})`;
reference.fillStyle = css(GROUND, 1);
reference.fillRect(0, 0, 320, 120);
for (const square of Object.values(SQUARES))
  for (const [color, alpha] of square.layers) {
    reference.fillStyle = css(color, alpha);
    reference.fillRect(square.x, square.y, SIZE, SIZE);
  }

let game;
try {
  game = await createBrowserGame({
    canvas: document.querySelector('#scene'),
    width: 320,
    height: 120,
    pixelRatio: 1,
    clearColor: GROUND,
    blendSpace: space,
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
for (const [name, square] of Object.entries(SQUARES)) {
  for (const [color, alpha] of square.layers) {
    const sprite = scope.use(new Sprite());
    sprite.graphics.beginFill(color, alpha).drawRect(square.x, square.y, SIZE, SIZE).endFill();
    engine.stage.addChild(sprite);
  }
  report.boxes[name] = { x: square.x, y: square.y, width: SIZE, height: SIZE };
}
report.ready = true;
report.hostFailure = () => game.host.getStatus().firstFailure?.code;
