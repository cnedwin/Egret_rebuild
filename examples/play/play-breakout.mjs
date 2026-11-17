// SPDX-License-Identifier: Apache-2.0
// A script for tools/verify-player.mjs that plays the breakout of this example to its end, as a person would:
//
//   node tools/verify-player.mjs <absolute Playwright index.mjs> examples/play/index.html <new output directory> examples/play/play-breakout.mjs
//
// It is the pattern for checking any game beyond its first seconds: say what the stage is, give input in the stage's
// own units, and read what the page shows from the colours at places of the stage.
export const stage = { width: 480, height: 320 };

const BUTTON = 0x3b82f6,
  LOWEST_BRICKS = 0x7be069;

export default async function (player) {
  // The ball breaks a brick of the lowest row, with a sound.
  await player.until(
    look => [0, 1, 2, 3, 4, 5, 6, 7].some(c => !player.alike(look(40 + c * 57, 100), LOWEST_BRICKS)),
    'a brick to break'
  );
  player.expect((await player.sounds()) > 0, 'a sound when the brick broke');
  await player.picture('brick-broken');
  // Held down, the pointer carries the paddle. It is kept at the end the ball is not at, so every ball is lost; the
  // ball is the only white thing under the bricks.
  await player.press(240, 200);
  await player.until(
    async look => {
      if (player.alike(look(170, 200), BUTTON)) return true;
      let ball = 240;
      for (let y = 120; y < 285; y += 4)
        for (let x = 4; x < 480; x += 4) if (player.alike(look(x, y), 0xffffff, 6)) ball = x;
      await player.move(ball < 240 ? 440 : 40, 200);
      return false;
    },
    'three balls to be lost',
    90
  );
  await player.release();
  await player.picture('game-over');
  // The button starts the game again, with every brick.
  await player.tap(240, 200);
  await player.wait(0.5);
  const look = await player.look();
  player.expect(!player.alike(look(170, 200), BUTTON), 'the button to be gone');
  player.expect(
    player.alike(look(40, 40), 0xff4d6d) && player.alike(look(439, 100), LOWEST_BRICKS),
    'every brick to be back'
  );
}
