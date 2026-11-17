// SPDX-License-Identifier: Apache-2.0
// A breakout from one call to play: a paddle by keys or pointer, bricks, three lives, a win, a loss, and a button
// to play again. llms.txt holds this game as it is here.
import { play } from '@egret/engine/play';

const W = 480,
  H = 320;
let paddle, ball, bricks, score, lives, label, vx, vy, over;

await play({
  width: W,
  height: H,
  background: 0x101828,
  setup(game) {
    bricks = [];
    score = 0;
    lives = 3;
    vx = 150;
    vy = -180;
    over = false;
    paddle = game.rect(W / 2, H - 20, 70, 10, 0x8fa8ff);
    ball = game.circle(W / 2, H - 60, 6, 0xffffff);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        bricks.push(game.rect(40 + c * 57, 40 + r * 20, 50, 14, [0xff4d6d, 0xffa64d, 0xffe14d, 0x7be069][r]));
    label = game.text('Score 0   Lives 3', { x: W / 2, y: 6, size: 18, align: 'center' });
  },
  update(dt, game) {
    if (over) return;
    paddle.x += game.keys.axis().x * 300 * dt;
    if (game.pointer.down) paddle.x = game.pointer.x;
    paddle.x = Math.max(35, Math.min(W - 35, paddle.x));
    ball.x += vx * dt;
    ball.y += vy * dt;
    if ((ball.x < 6 && vx < 0) || (ball.x > W - 6 && vx > 0)) {
      vx = -vx;
      game.sfx.play('bounce');
    }
    if (ball.y < 6 && vy < 0) {
      vy = -vy;
      game.sfx.play('bounce');
    }
    if (vy > 0 && game.overlaps(ball, paddle)) {
      // Where it lands on the paddle steers it.
      vy = -vy;
      vx = (ball.x - paddle.x) * 6;
      game.sfx.play('jump');
    }
    const hit = game.hits(ball, bricks);
    if (hit) {
      bricks = bricks.filter(brick => brick !== hit);
      game.burst(hit.x, hit.y, { color: 0xffe14d });
      game.remove(hit);
      vy = -vy;
      score += 10;
      game.sfx.play('coin');
      game.shake(4, 0.15);
      if (bricks.length === 0) end(game, 'You win!', 'win');
    }
    if (ball.y > H + 10) {
      lives--;
      game.flash(0xff2040);
      game.sfx.play('hurt');
      if (lives === 0) end(game, 'Game over', 'lose');
      else {
        ball.x = paddle.x;
        ball.y = H - 60;
        vx = 150;
        vy = -180;
      }
    }
    label.text = 'Score ' + score + '   Lives ' + lives;
  }
});

function end(game, words, sound) {
  over = true;
  game.sfx.play(sound);
  game.text(words, { x: W / 2, y: 120, size: 32, align: 'center' });
  game.button('Play again', { x: W / 2, y: 200 }, () => game.restart());
}
