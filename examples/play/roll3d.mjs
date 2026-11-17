// SPDX-License-Identifier: Apache-2.0
// A 3D game from one call to play3d: a ball rolled over a ground and a raised platform to collect four stars, with
// a camera that follows, jumping, falling off the edge and playing again. llms.txt holds this game as it is here.
import { play3d } from '@egret/engine/webgl2/world3d';

const SPEED = 6,
  GRAVITY = 20;
let ball, blocks, stars, vy, got, label, done;

await play3d({
  width: 960,
  height: 540,
  background: 0x0b1020,
  setup(game) {
    blocks = [];
    stars = [];
    vy = 0;
    got = 0;
    done = false;
    // The ground is 24 across with its top at height 0; a box is placed by its middle.
    blocks.push(game.ground(24, 0x2d6a4f));
    blocks.push(game.box(4, 1, 4, 0x4d6fa8, { x: 6, y: 0.5, z: -4 }));
    ball = game.sphere(0.5, 0xe8453c, { y: 1 });
    for (const [x, y, z] of [
      [3, 0.9, 0],
      [-4, 0.9, -3],
      [6, 1.9, -4],
      [0, 0.9, 5]
    ])
      stars.push(game.cone(0.4, 0.8, 0xffd23f, { x, y, z }));
    game.follow(ball, { y: 6, z: 9 });
    // Text and buttons are the flat interface over the picture, in the units of width and height.
    label = game.text('Stars 0/4', { x: 16, y: 12, size: 28 });
  },
  update(dt, game) {
    if (done) return;
    // Keys, or a finger held on a side of the screen. On the ground x is right and z is towards the camera.
    const move = game.keys.axis();
    if (game.pointer.down) {
      move.x = game.pointer.x < 320 ? -1 : game.pointer.x > 640 ? 1 : 0;
      move.y = game.pointer.y < 180 ? -1 : game.pointer.y > 360 ? 1 : 0;
    }
    ball.x += move.x * SPEED * dt;
    ball.z += move.y * SPEED * dt;
    ball.rotationZ -= move.x * 300 * dt;
    ball.rotationX += move.y * 300 * dt;
    vy -= GRAVITY * dt;
    ball.y += vy * dt;
    // Pushed up out of a block, it stands on it.
    let onGround = false;
    for (const block of blocks) {
      const push = game.pushOut(ball, block);
      if (!push) continue;
      ball.x += push.x;
      ball.y += push.y;
      ball.z += push.z;
      if (push.y !== 0) vy = 0;
      if (push.y > 0) onGround = true;
    }
    if (onGround && (game.keys.pressed('space') || game.pointer.pressed)) {
      vy = 8;
      game.sfx.play('jump');
    }
    for (const star of stars) star.rotationY += 120 * dt;
    const star = game.hits(ball, stars);
    if (star) {
      stars = stars.filter(other => other !== star);
      game.burst(star.x, star.y, star.z, { color: 0xffd23f });
      game.remove(star);
      label.text = 'Stars ' + ++got + '/4';
      game.sfx.play('coin');
      game.shake(0.2, 0.2);
      if (got === 4) end(game, 'All four!', 'win');
    }
    if (ball.y < -12) end(game, 'Fell off', 'lose');
  }
});

function end(game, words, sound) {
  done = true;
  game.sfx.play(sound);
  game.text(words, { x: 480, y: 200, size: 48, align: 'center' });
  game.button('Play again', { x: 480, y: 300 }, () => game.restart());
}
