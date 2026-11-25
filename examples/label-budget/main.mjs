// SPDX-License-Identifier: Apache-2.0
// Many labels on one screen, and many labels gone with their parent. verify.mjs calls each step through
// globalThis.__labels and reads what it reports, with the game's errors and warnings.
import { play } from '@egret/engine/play';
import { Bitmap, Sprite } from '@egret/engine';

const canvas = document.createElement('canvas');
document.body.append(canvas);
const errors = [],
  warnings = [];
const game = await play({
  canvas,
  width: 720,
  height: 1280,
  background: 0x101820,
  audio: false,
  onError: error => errors.push(String(error.code ?? error.message)),
  ...(globalThis.__noWarnings ? {} : { onWarning: warning => warnings.push({ ...warning }) })
});
const settle = async () => {
  for (let i = 0; i < 600; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const status = game.browser.getLabelStatus();
    if (status.drawing === 0 && status.queued === 0 && status.atlasPending === 0) break;
  }
  await new Promise(resolve => setTimeout(resolve, 300));
};
const characters = '仵作验尸河边衣袖勒痕挣扎溺亡渡夫灯笼子时宋提刑洗冤录卷宗现场证物银簪毒药伤痕尸格检验书吏';

globalThis.__labels = {
  errors,
  warnings,
  /** A board of short labels: `count` characters, each a label of its own, all on the screen at once. */
  async board(count) {
    const made = [];
    for (let i = 0; i < count; i++)
      made.push(
        game.text(characters[i % characters.length] + characters[(i * 7 + 3) % characters.length], {
          x: 40 + (i % 10) * 70,
          y: 80 + Math.floor(i / 10) * 70,
          size: 36,
          color: 0xffffff
        })
      );
    await settle();
    return {
      made: made.length,
      // A text shows its words once its display is visible and holds its picture.
      shown: made.filter(
        text => text.numChildren > 0 && text.getChildAt(0).visible && text.getChildAt(0).numChildren > 0
      ).length,
      usage: game.browser.getFrameUsage?.() ?? null,
      errors: errors.slice(),
      warnings: warnings.slice(),
      loop: game.browser.loop.state
    };
  },
  /**
   * `count` pictures of their own on the screen, each a texture of 8 × 8 pixels: more than a frame may hold when
   * `count` is above 64, added eight a frame. Then all but `keep` are removed.
   */
  async images(count, keep) {
    const shown = [];
    const frames = async n => {
      for (let i = 0; i < n; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    };
    for (let i = 0; i < count; i++) {
      const pixels = new Uint8Array(8 * 8 * 4).fill(255);
      pixels[0] = i;
      const picture = game.scope.use(new Bitmap(await game.browser.textureFromPixels(8, 8, pixels)));
      picture.x = 10 + (i % 40) * 12;
      picture.y = 1200 + Math.floor(i / 40) * 12;
      game.ui.addChild(picture);
      shown.push(picture);
      // Eight more on each frame, as a scene that fills up.
      if (i % 8 === 7) await frames(2);
    }
    await frames(10);
    const over = game.browser.getFrameUsage();
    const warned = warnings.map(warning => warning.code);
    for (const picture of shown.slice(keep)) game.remove(picture);
    await frames(10);
    const after = game.browser.getFrameUsage();
    await frames(10);
    const later = game.browser.getFrameUsage();
    for (const picture of shown.slice(0, keep)) game.remove(picture);
    return { over, warned, after, later, errors: errors.slice(), loop: game.browser.loop.state };
  },
  /** Labels made with browser.createLabel under a parent sprite of the game's own, and the parent removed. */
  async gone(count) {
    const parent = game.scope.use(new Sprite());
    game.ui.addChild(parent);
    const labels = [];
    for (let i = 0; i < count; i++) {
      const label = await game.browser.createLabel({ text: 'L' + i, fontSize: 12 });
      label.display.x = (i % 25) * 28;
      label.display.y = 700 + Math.floor(i / 25) * 14;
      parent.addChild(label.display);
      labels.push(label);
    }
    await Promise.all(labels.map(label => label.ready.catch(() => {})));
    await settle();
    const before = game.browser.getLabelStatus();
    game.remove(parent);
    await settle();
    const after = game.browser.getLabelStatus();
    return {
      count,
      before,
      after,
      warned: warnings.map(warning => warning.code),
      errors: errors.slice(),
      loop: game.browser.loop.state
    };
  }
};
globalThis.__game = game;
globalThis.__labelsReady = true;
