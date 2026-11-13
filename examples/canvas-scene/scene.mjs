import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createExampleHost } from '../host.mjs';
const canvas = document.querySelector('#scene');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas }) }, SHARED_FRAME_PROFILE_2D);
const red = engine.stage.addChild(new Sprite());
red.graphics.beginFill(0xff0000, 0.5).drawRect(20, 20, 100, 100);
const blue = engine.stage.addChild(new Sprite());
blue.graphics.beginFill(0x0000ff, 0.5).drawRect(0, 0, 80, 80);
blue.x = 60; blue.y = 40;
let count = 0;
const render = () => engine.renderSharedFrame({ width: 240, height: 160, clearColor: 0, clearAlpha: 1 });
render();
canvas.addEventListener('pointerdown', event => {
  const bounds = canvas.getBoundingClientRect();
  blue.x = (event.clientX - bounds.left) * 240 / bounds.width;
  blue.y = (event.clientY - bounds.top) * 160 / bounds.height;
  render();
  document.querySelector('#status').textContent = `Rendered ${++count} / 已重绘 ${count}`;
});
