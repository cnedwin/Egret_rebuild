// SPDX-License-Identifier: Apache-2.0
// Taps on sprites whose drawing is their children's, and a tap with a name in the semantic tree. verify.mjs calls each
// step through globalThis.__taps and clicks where it says.
import { play } from '@egret/engine/play';
import { createUiSemantics } from '@egret/engine/ui/semantics';

const canvas = document.createElement('canvas');
document.body.append(canvas);
const errors = [];
const semantics = createUiSemantics();
const game = await play({
  canvas,
  width: 720,
  height: 1280,
  background: 0x101820,
  audio: false,
  semantics,
  onError: error => errors.push(String(error.code ?? error.message))
});
const frames = async n => {
  for (let i = 0; i < n; i++) await new Promise(resolve => requestAnimationFrame(resolve));
};
/** Where a place of the game is in the page's CSS pixels, for a click. */
const cssOf = (x, y) => {
  const at = game.toStage(x, y),
    box = canvas.getBoundingClientRect();
  return {
    x: box.left + (at.x * box.width) / game.browser.frame.width,
    y: box.top + (at.y * box.height) / game.browser.frame.height
  };
};
let taps = 0,
  named = 0;
let button, face, plain, scroll;

globalThis.__taps = {
  errors,
  taps: () => taps,
  named: () => named,
  /** A sprite that draws nothing itself: its face is a child. And a sprite that draws itself, beside it. */
  async make() {
    button = game.sprite();
    button.x = 200;
    button.y = 300;
    face = game.rect(0, 0, 200, 80, 0x3355aa, button);
    game.onTap(button, () => taps++);
    plain = game.rect(500, 300, 120, 80, 0xaa5533);
    game.onTap(plain, () => taps++);
    await frames(3);
    return { button: cssOf(200, 300), plain: cssOf(500, 300), beside: cssOf(200, 420) };
  },
  /** The face moves right: the area follows at the next step. */
  async moveFace() {
    face.x = 150;
    await frames(3);
    return { moved: cssOf(350, 300), left: cssOf(140, 300) };
  },
  /** The game gives the sprite an area of its own: a corner. */
  async ownArea() {
    button.hitArea = { x: 140, y: -40, width: 20, height: 20 };
    await frames(3);
    return { corner: cssOf(350, 270), middle: cssOf(350, 300) };
  },
  /** A tap with a name: a button of the semantic tree, where the sprite is drawn. */
  async name() {
    scroll = game.sprite();
    scroll.x = 360;
    scroll.y = 700;
    game.rect(0, 0, 240, 60, 0x55aa33, scroll);
    game.onTap(scroll, () => named++, { name: 'Open the scroll' });
    await frames(3);
    const find = () => semantics.snapshot.nodes.find(node => node.role === 'button' && node.name === 'Open the scroll');
    const shown = find();
    semantics.perform(shown.id, 'activate');
    scroll.visible = false;
    await frames(3);
    // A hidden node is left out of what the tree publishes.
    const hidden = find() === undefined;
    scroll.visible = true;
    await frames(3);
    const again = find() !== undefined;
    game.remove(scroll);
    await frames(3);
    return { shown, activated: named, hidden, again, gone: find() === undefined };
  }
};
// A title written top to bottom: two columns of four characters, the comma upright.
globalThis.__taps.vertical = async () => {
  const title = game.text('洗冤笔录，第一案', { x: 640, y: 900, size: 40, vertical: { column: 4 }, align: 'right' });
  for (let i = 0; i < 60 && !(title.numChildren > 0 && title.getChildAt(0).visible); i++) await frames(1);
  await frames(3);
  const box = title.getBounds();
  return { text: title.text, width: box.width, height: box.height, shown: title.getChildAt(0).visible };
};
globalThis.__tapsReady = true;
