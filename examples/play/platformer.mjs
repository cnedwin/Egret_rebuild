// SPDX-License-Identifier: Apache-2.0
// A platformer from one call to play: gravity, platforms to stand on, coins, a level wider than the stage, and a
// goal. llms.txt holds this game as it is here.
import { play } from '@egret/engine/play';

const W = 480,
  H = 270,
  LEVEL = 1200,
  GRAVITY = 900;
let hero, blocks, coins, goal, vy, onGround, got, label, won;

await play({
  width: W,
  height: H,
  background: 0x1b2440,
  setup(game) {
    blocks = [];
    coins = [];
    vy = 0;
    onGround = false;
    got = 0;
    won = false;
    // A rect is placed by its middle. The ground, a wall at each end, then four platforms with a coin over each.
    const block = (x, y, w, h) => blocks.push(game.rect(x, y, w, h, 0x4a6fa5));
    block(LEVEL / 2, 255, LEVEL, 30);
    block(-10, H / 2, 20, H);
    block(LEVEL + 10, H / 2, 20, H);
    [260, 420, 600, 760].forEach((x, i) => {
      const y = i % 2 ? 145 : 195;
      block(x, y, 90, 14);
      coins.push(game.circle(x, y - 25, 7, 0xffd23f));
    });
    coins.push(game.circle(1000, 215, 7, 0xffd23f));
    goal = game.rect(1150, 215, 16, 50, 0x7be069);
    hero = game.rect(60, 200, 18, 24, 0xff6b6b);
    // Text is in the ui layer: it stays put while the world scrolls.
    label = game.text('Coins 0/5', { x: 8, y: 6, size: 16 });
  },
  update(dt, game) {
    if (won) return;
    // Keys, or a finger: hold a side of the screen to run, tap the upper half to jump.
    let run = game.keys.axis().x;
    if (game.pointer.down) run = game.pointer.x < W / 2 ? -1 : 1;
    hero.x += run * 170 * dt;
    const jump = game.keys.pressed('space', 'up', 'w') || (game.pointer.pressed && game.pointer.y < H / 2);
    if (onGround && jump) {
      vy = -420;
      game.sfx.play('jump');
    }
    vy += GRAVITY * dt;
    hero.y += vy * dt;
    onGround = false;
    // Pushed up out of a block, it has landed; pushed down, it has hit its head.
    for (const block of blocks) {
      const push = game.pushOut(hero, block);
      if (!push) continue;
      hero.x += push.x;
      hero.y += push.y;
      if (push.y !== 0) vy = 0;
      if (push.y < 0) onGround = true;
    }
    const coin = game.hits(hero, coins);
    if (coin) {
      coins = coins.filter(other => other !== coin);
      game.burst(coin.x, coin.y, { color: 0xffd23f, count: 8 });
      game.remove(coin);
      label.text = 'Coins ' + ++got + '/5';
      game.sfx.play('coin');
    }
    if (game.overlaps(hero, goal)) {
      won = true;
      game.sfx.play('win');
      game.text('You made it!', { x: W / 2, y: 80, size: 28, align: 'center' });
      game.button('Play again', { x: W / 2, y: 150 }, () => game.restart());
    }
    // The camera follows the hero.
    game.view.x = Math.max(0, Math.min(LEVEL - W, hero.x - W / 2));
  }
});
