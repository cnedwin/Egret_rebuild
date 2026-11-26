// SPDX-License-Identifier: Apache-2.0
export const stage = { width: 360, height: 600 };

const beacon = [180, 300];
const reset = [180, 490];
const unlitColor = 0x354469;

function state(player) {
  return player.read(() => {
    const game = globalThis.__agentPlaytest;
    if (game === undefined) return null;
    return {
      ready: game.ready,
      revision: game.revision,
      session: game.session,
      lit: game.lit,
      color: game.color,
      diagnostic: game.diagnostic ?? null
    };
  });
}

export default async function playtest(player) {
  await player.page.waitForFunction(() => globalThis.__agentPlaytest?.ready === true);
  const start = await player.until(async look => {
    const current = await state(player);
    return current?.ready && player.alike(look(...beacon), unlitColor) && current;
  }, 'the first unlit round');
  player.expect(start.session === 1 && !start.lit && start.diagnostic === null, 'a clean first round');

  async function light(session, checkpoint) {
    await player.tap(...beacon);
    await player.until(async look => {
      const current = await state(player);
      if (current.diagnostic !== null) {
        const { code, message, details } = current.diagnostic;
        throw Object.assign(new Error(message), { code, details });
      }
      const pixel = look(...beacon);
      return current.lit && !player.alike(pixel, unlitColor) && player.alike(pixel, current.color);
    }, 'a visible light in round ' + session);
    const current = await state(player);
    player.expect(
      current.session === session && current.revision === start.revision,
      'the expected round and project revision'
    );
    await player.picture(checkpoint);
    await player.checkpoint(checkpoint);
  }

  await light(1, 'first-action');
  await player.tap(...reset);
  await player.until(async look => {
    const current = await state(player);
    return current.session === 2 && !current.lit && player.alike(look(...beacon), unlitColor);
  }, 'the unlit beacon after restarting the game');
  const restarted = await state(player);
  player.expect(
    restarted.revision === start.revision && restarted.diagnostic === null,
    'the same project in a clean second round'
  );
  await player.picture('restart');
  await player.checkpoint('restart');
  await light(2, 'first-action-after-restart');
}
