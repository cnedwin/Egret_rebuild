// SPDX-License-Identifier: Apache-2.0
// A score that counts up, written two ways. Opened plain, update makes a new text every frame: the mistake that
// play tells as PLAY_MADE_EVERY_FRAME once it has gone on for 60 frames. With ?fixed=1 the text is made once in setup
// and only its words change. tools/verify-game.mjs lists what the engine warned of in its report (engineWarnings).
import { play } from '@egret/engine/play';

const fixed = new URL(import.meta.url).searchParams.has('fixed') || new URLSearchParams(location.search).has('fixed');
let score = 0,
  label;

await play({
  width: 480,
  height: 270,
  background: 0x101820,
  setup(game) {
    game.rect(240, 200, 300, 12, 0x3b82f6);
    if (fixed) label = game.text('Score 0', { x: 240, y: 120, size: 32, align: 'center' });
  },
  update(seconds, game) {
    score += seconds * 10;
    const words = 'Score ' + Math.floor(score);
    if (fixed) label.text = words;
    else {
      // The mistake: a new text each frame, the last one removed.
      if (label) game.remove(label);
      label = game.text(words, { x: 240, y: 120, size: 32, align: 'center' });
    }
    if (game.keys.pressed('space') || game.pointer.pressed) score = 0;
  }
});
