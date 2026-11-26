// SPDX-License-Identifier: Apache-2.0
// Actual old/new gameplay, UI layout, animated region pixels and gameplay persistence.
export const stage = { width: 480, height: 720 };
export const viewport = { width: 480, height: 720 };
export const checkpoints = ['first-action', 'round-finished', 'restart', 'first-action-after-restart', 'save-restored'];
const read = player => player.read(() => globalThis.__guardianControl?.());
const hasColor = (player, look, points, color) => points.some(([x, y]) => player.alike(look(x, y), color));
const upper = Array.from({ length: 5 }, (_, i) =>
  Array.from({ length: 5 }, (_, j) => [237 + i * 4, 187 + j * 4])
).flat();
const lower = Array.from({ length: 5 }, (_, i) =>
  Array.from({ length: 5 }, (_, j) => [237 + i * 4, 269 + j * 4])
).flat();
const lamp = 0xffe293;
const body = 0x6babb7;
const meter = 0xf3c55e;
const track = 0x335f67;
const bg = 0x285a70;
const render = (player, look, progress) =>
  player.alike(look(212, 250), body) &&
  player.alike(look(30, 484), bg) &&
  player.alike(look(450, 484), bg) &&
  player.alike(look(120, 410), progress ? meter : track) &&
  player.alike(look(430, 410), progress === 3 ? meter : track);
const matches = (s, progress, round, best, pose) =>
  s?.progress === progress &&
  s.round === round &&
  s.best === best &&
  s.countText === progress + ' / 3' &&
  s.resultText === (progress === 3 ? 'Lantern lit!' : 'Lantern unlit') &&
  s.parts?.[1] === String(best) &&
  s.parts?.[2] === 'STRIKE' &&
  s.pose === pose &&
  Math.abs(s.layout[4] - (404 * progress) / 3) < 0.1;
export default async function trial(player) {
  await player.page.waitForFunction(() => globalThis.__guardianControl?.());
  await player.until(
    async look => matches(await read(player), 0, 1, 0, 'idle') && render(player, look, 0),
    'Nested EUI panels are visible and idle animation runs'
  );
  const capture = async name => {
    await player.picture(name);
    await player.checkpoint(name);
  };

  await player.tap(128, 484);
  await player.until(
    async look =>
      matches(await read(player), 1, 1, 1, 'strike') && hasColor(player, look, upper, lamp) && render(player, look, 1),
    'First move changes the progress UI and the articulated lamp moves upward'
  );
  await capture('first-action');

  await player.tap(350, 484);
  await player.until(
    async look => matches(await read(player), 2, 1, 2, 'guard') && hasColor(player, look, lower, lamp),
    'Guard plays the opposing visible pose'
  );
  await player.tap(128, 484);
  await player.until(async look => {
    const state = await read(player);
    return matches(state, 3, 1, 3, 'strike') && state.finished && state.storedBest === '3' && render(player, look, 3);
  }, 'Three correct moves finish the round, light the lantern and save score 3');
  await capture('round-finished');

  await player.tap(240, 670);
  await player.until(
    async look => matches(await read(player), 0, 2, 3, 'idle') && render(player, look, 0),
    'New round resets progress and idle clip while preserving best score'
  );
  await capture('restart');

  await player.tap(128, 484);
  await player.until(
    async look => matches(await read(player), 1, 2, 3, 'strike') && render(player, look, 1),
    'Restart accepts player action'
  );
  await capture('first-action-after-restart');

  await player.page.reload();
  await player.page.waitForFunction(() => globalThis.__guardianControl?.());
  await player.until(async look => {
    const state = await read(player);
    return matches(state, 0, 1, 3, 'idle') && state.storedBest === '3' && render(player, look, 0);
  }, 'Browser reload reconstructs theme and rig and restores real best score');
  await capture('save-restored');
}
