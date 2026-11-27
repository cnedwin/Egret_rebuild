// SPDX-License-Identifier: Apache-2.0
// The engine's 2D interface over a 3D scene, with a stage that follows the canvas: `fit: 'expand'` and a portrait
// size. A pause button is held at the top right of the safe part and a bar along its bottom, placed again whenever
// the screen changes, and a press on an empty part of the interface goes on to the scene. examples/world3d/
// verify-overlay.mjs drives it in a browser; `globalThis.overlayCheck` is what it reads.
import { Sprite } from '@egret/engine';
import {
  Mesh3D,
  Scene3D,
  createBoxGeometry3D,
  createDirectionalLight3D,
  createPerspectiveCamera3D,
  createStandardMaterial3D
} from '@egret/engine/world3d';
import { createWorld3DApp, createWorld3DOverlay } from '@egret/engine/webgl2/world3d';

const canvas = document.querySelector('#scene');
const app = await createWorld3DApp(canvas, { quality: 'low' });
const scene = new Scene3D();
const box = new Mesh3D(
  createBoxGeometry3D({ width: 2, height: 2, depth: 2 }),
  createStandardMaterial3D({ color: 0x3b82f6 })
);
scene.addChild(box);
const light = createDirectionalLight3D({ intensity: 2 });
light.setPosition(3, 5, 4);
scene.addChild(light);
const camera = createPerspectiveCamera3D({ fov: 50 });
camera.setPosition(0, 2, 6);
camera.lookAt(0, 0, 0);
app.show(scene, camera, { onUpdate: seconds => (box.rotationY += seconds) });

const ui = await createWorld3DOverlay(canvas, {
  width: 1280,
  height: 720,
  portrait: { width: 720, height: 1280 },
  fit: 'expand',
  renderMode: 'on-demand',
  webgl2PageBatching: 'single-page'
});
const game = ui.game;
const block = (color, width, height) => {
  const node = new Sprite();
  node.graphics.beginFill(color).drawRect(0, 0, width, height).endFill();
  node.hitArea = { x: 0, y: 0, width, height };
  node.touchEnabled = true;
  game.stage.addChild(node);
  return node;
};
const pause = block(0xf59e0b, 120, 64),
  bar = block(0x22c55e, 400, 40);
const check = { presses: 0, scene: 0, screens: 0 };
pause.on(game.pointer.events.tap, () => check.presses++);
canvas.addEventListener('pointerdown', () => check.scene++);
// The safe part, in stage units: the pause button 16 in from its top right, the bar centred on its bottom.
const arrange = () => {
  const safe = game.screen.safe;
  pause.x = safe.x + safe.width - 16 - 120;
  pause.y = safe.y + 16;
  bar.x = safe.x + (safe.width - 400) / 2;
  bar.y = safe.y + safe.height - 40;
};
arrange();
game.onScreenChange(() => {
  check.screens++;
  arrange();
});
globalThis.overlayCheck = {
  check,
  move: () => { pause.x -= 1; },
  invalidate: () => game.invalidate(),
  timings: () => ui.getStartupTiming(),
  loop: () => game.loop.snapshot(),
  read: () => ({
    screen: {
      width: game.screen.width,
      height: game.screen.height,
      scale: game.screen.scale,
      safe: { ...game.screen.safe }
    },
    box: { ...ui.box },
    canvas: ui.canvas.getBoundingClientRect().toJSON(),
    scene: canvas.getBoundingClientRect().toJSON(),
    pause: { x: pause.x, y: pause.y }
  })
};
