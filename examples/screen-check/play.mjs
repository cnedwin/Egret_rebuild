// SPDX-License-Identifier: Apache-2.0
// A real pointer route for every screen of this responsive example. With no exported stage, player.tap and
// player.look take CSS pixels relative to the canvas; the controls reported by the engine are page coordinates.
async function tap(player, name) {
  const place = await player.read(name => {
    const { controls, screen } = globalThis.__egretScreens;
    const control = controls.find(control => control.name === name);
    if (!control) return null;
    return [control.x - screen.canvas.x + control.width / 2, control.y - screen.canvas.y + control.height / 2];
  }, name);
  player.expect(place !== null, 'the ' + name + ' control is shown');
  await player.tap(...place);
}

export async function openQuestion(player) {
  const size = await player.read(() => globalThis.__egretScreens.screen.canvas);
  const look = await player.look();
  player.expect(player.alike(look(size.width / 2, size.height / 2), 0x1d3247), 'the canvas centre is navy');
  await player.checkpoint('table');
  await tap(player, 'Pause');
  await player.page.waitForFunction(() => globalThis.__egretScreens.controls?.some(control => control.name === 'no'));
  await player.checkpoint('question');
  // This raw picture name resembles a checkpoint, but the driver keeps its path distinct.
  await player.picture('checkpoint-1');
}

export default async function (player) {
  await openQuestion(player);
  await tap(player, 'no');
  await player.page.waitForFunction(() =>
    globalThis.__egretScreens.controls?.some(control => control.name === 'Pause')
  );
  await player.checkpoint('back');
  player.expect((await player.sounds()) === 0, 'the silent fixture played no sound');
  player.expect((await player.warnings()).length === 0, 'the engine raised no warnings');
}
