// SPDX-License-Identifier: Apache-2.0
// Run against the ordinary example page with egret verify --screens --prepare.
// Opening the actual Pause button proves that the scene is prepared, rather
// than verifying a fixed title/field or a substitute HTML page.
export default async function prepare(player, screen) {
  await player.page.waitForFunction(() =>
    globalThis.__egretScreens?.controls?.some(control => control.name === 'Pause')
  );
  const pause = await player.read(() => globalThis.__egretScreens.controls.find(control => control.name === 'Pause'));
  const x = pause.x + pause.width / 2,
    y = pause.y + pause.height / 2;
  if (screen.touch) await player.page.touchscreen.tap(x, y);
  else await player.page.mouse.click(x, y);
  await player.page.waitForFunction(() => {
    const controls = globalThis.__egretScreens?.controls ?? [];
    return controls.length === 2 && ['no', 'yes'].every(name => controls.some(control => control.name === name));
  });
  return 'confirmation';
}
