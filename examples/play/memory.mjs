// SPDX-License-Identifier: Apache-2.0
// A game of matching pairs from one call to play: taps, cards that turn and wait for one another, and a best score
// kept between visits. llms.txt holds this game as it is here.
import { play } from '@egret/engine/play';

const W = 360,
  H = 520,
  SIZE = 70,
  GAP = 12,
  BACK = 0x3a506b;
const FACES = [0xff6b6b, 0xffd23f, 0x7be069, 0x4dabf7, 0xb197fc, 0xff9f43, 0x63e6be, 0xf783ac];
let open, busy, pairs, moves, label;

await play({
  width: W,
  height: H,
  background: 0x14213d,
  setup(game) {
    open = [];
    busy = false;
    pairs = 0;
    moves = 0;
    label = game.text('Moves 0', { x: W / 2, y: 20, size: 22, align: 'center' });
    game.random.shuffle([...FACES, ...FACES]).forEach((face, i) => {
      const card = game.sprite(g => paint(g, BACK));
      card.x = 57 + (i % 4) * (SIZE + GAP);
      card.y = 115 + Math.floor(i / 4) * (SIZE + GAP);
      // A sprite takes properties of the game's own.
      card.face = face;
      card.up = false;
      game.onTap(card, () => flip(game, card));
    });
  }
});

function paint(g, color) {
  g.clear()
    .beginFill(color)
    .drawRoundRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 16)
    .endFill();
}

// A card turns about its middle: narrow to nothing, change face, widen again.
async function turn(game, card, up) {
  await game.tween(card).to({ scaleX: 0 }, 0.1).done;
  paint(card.graphics, up ? card.face : BACK);
  card.up = up;
  await game.tween(card).to({ scaleX: 1 }, 0.1).done;
}

async function flip(game, card) {
  if (busy || card.up) return;
  busy = true;
  game.sfx.play('click');
  await turn(game, card, true);
  open.push(card);
  if (open.length === 2) {
    const [a, b] = open;
    open = [];
    label.text = 'Moves ' + ++moves;
    if (a.face === b.face) {
      game.sfx.play('coin');
      game.burst(a.x, a.y, { color: a.face });
      game.burst(b.x, b.y, { color: b.face });
      if (++pairs === FACES.length) win(game);
    } else {
      await game.wait(0.5);
      game.sfx.play('hit');
      await Promise.all([turn(game, a, false), turn(game, b, false)]);
    }
  }
  busy = false;
}

function win(game) {
  const best = Math.min(moves, game.load('best', moves));
  game.save('best', best);
  game.sfx.play('win');
  game.text('Done in ' + moves + ' moves\nBest ' + best, { x: W / 2, y: 425, size: 18, align: 'center' });
  game.button('Again', { x: W / 2, y: 492, height: 36 }, () => game.restart());
}
