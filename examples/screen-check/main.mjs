// SPDX-License-Identifier: Apache-2.0
// A landscape game of four buttons, written two ways, for `egret verify --screens`. Opened plain it has the three
// mistakes the check finds on a phone: a pause button pinned to the screen's corner, under a notch or a status bar; a
// help button smaller than a finger; and two buttons that cover each other. With ?fixed=1 the pause button is pinned to
// the safe part, every button is at least 64 units square (44 CSS pixels at three quarters of a unit to the pixel, the
// smallest a phone of 360 shows this game at) and the two stand apart. With ?ask=1 a question stands open over it.
// examples/screen-check/verify.mjs runs all three.
import { play } from '@egret/engine/play';

const fixed = new URL(import.meta.url).searchParams.has('fixed') || new URLSearchParams(location.search).has('fixed');
const asks = new URL(import.meta.url).searchParams.has('ask');
const tall = fixed ? 64 : 44;

await play({
  width: 480,
  height: 270,
  fit: 'expand',
  background: 0x13202c,
  setup(game) {
    game.rect(240, 135, 480, 270, 0x1d3247);
    game.circle(120, 110, 36, 0xf59e0b);
    game.text('Screen check', { x: 240, y: 40, size: 28, align: 'center' });
    const ask = async () => {
      game.pause();
      await game.confirm('Leave the match?', { yes: 'Leave', no: 'Stay' });
      game.resume();
    };
    const pause = game.button('Pause', { x: 0, y: 0, width: 120, height: tall }, ask);
    // The mistake: the screen's corner is under the notch; the safe part keeps clear of it.
    game.pin(pause, { right: 8, top: 8 }, { area: fixed ? 'safe' : 'screen' });
    game.button(
      '?',
      fixed ? { x: 440, y: 220, width: 64, height: 64 } : { x: 450, y: 240, width: 24, height: 24 },
      () => {}
    );
    game.button('Jump', { x: fixed ? 150 : 190, y: 210, width: 120, height: tall }, () => {});
    game.button('Fire', { x: fixed ? 300 : 290, y: 210, width: 120, height: tall }, () => {});
    // With ?ask=1 a question stands open over the game: its backdrop takes taps anywhere and is no control.
    if (asks) ask();
  }
});
