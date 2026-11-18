// SPDX-License-Identifier: Apache-2.0
import { play } from '@egret/engine/play';

// Change the distance and reload to try a different movement rule.
const STEP = 32;
let square;

function advance() {
  square.x = square.x + STEP > 296 ? 24 : square.x + STEP;
}

await play({
  canvas: document.querySelector('#stage'),
  width: 320,
  height: 160,
  background: 0x162437,
  setup(game) {
    square = game.rect(24, 80, 28, 28, 0xffbf47);
    game.onTap(square, advance);
  },
  update(_dt, game) {
    if (game.keys.pressed('space')) advance();
  }
});
