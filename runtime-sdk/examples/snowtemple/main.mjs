// SPDX-License-Identifier: Apache-2.0
import { installWorld3DPlayerProject } from '@egret/android-player-world3d';
import { createRollHud } from './hud.mjs';
import { WIDTH, HEIGHT } from './actors.mjs';
import { controls, openScene } from './profile.mjs';
import equipmentSizes from './equipment-sizes.mjs';

async function readEquipment({ assets, signal }, file) {
  const size = equipmentSizes[file];
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Unknown equipment: ' + file);
  if (size <= 256 * 1024) return assets.readBytes(file, signal);
  // Large equipment uses the same cancellable chunk reader as packaged GLBs.
  const bytes = new Uint8Array(size);
  let offset = 0;
  for await (const chunk of assets.readChunks(file, signal)) {
    if (chunk.length > size - offset) throw new Error('Oversized equipment: ' + file);
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (offset !== size) throw new Error('Incomplete equipment: ' + file);
  return bytes;
}

installWorld3DPlayerProject({
  width: WIDTH, height: HEIGHT,
  async create(services) {
    const game = await openScene({
      glb: (file, firstPage) => services.loadGlb(file, { firstPage }),
      bytes: file => readEquipment(services, file)
    });
    services.scope.use({ dispose: game.close });
    const hud = createRollHud(services);
    hud.reset();
    const buttons = controls.map(([label, x, y, width]) =>
      hud.button(label, { x, y, width, height: 36, size: 18, color: 0x223342 }, () => {}).label);
    // All three choice buttons use the same font and share the HUD's text pages.
    if (game.choiceLabels) for (const name of game.choiceLabels) buttons[1].text = name;
    const counters = [];
    if (game.state().encounter) {
      for (const [name, x] of [['Lin', 30], [game.choiceLabels ? 'Foe' : 'Blade', 580]]) {
        hud.text(name + ' HP', { x, y: 16, size: 17, color: 0xffffff });
        counters.push([0, 1, 2].map(i => hud.text(' ', { x: x + 85 + 12*i, y: 16, size: 17, color: 0xffffff })));
      }
      // Publish the bounded health glyphs before the first 3D frame. A hit
      // changes display references without adding a texture in mid-combat.
      for (const digit of '0123456789') counters[0][0].text = digit;
    }
    let message;
    if (game.messages) {
      message = hud.text('Ready', { x: WIDTH / 2, y: 55, size: 18, color: 0xffffff, align: 'center' });
      for (const words of game.messages) message.text = words;
    }
    let elapsed = 0, lastState = -Infinity;
    function report() {
      const state = game.state();
      if (counters.length) {
        [state.hero.hp, state.enemy.hp].forEach((hp, index) => {
          const digits = String(Math.ceil(hp)).padStart(3);
          counters[index].forEach((field, i) => { field.text = digits[i]; });
        });
      }
      if (game.choiceLabels) {
        for (let i = 1; i < buttons.length; i++) buttons[i].text = state.encounter.choice[i - 1]?.name ?? controls[i][0];
      }
      if (message) message.text = state.encounter.message;
      services.state(state);
    }
    report();
    await hud.ready();
    services.engine.clock.onTick(services.scope, tick => { elapsed += tick.deltaSeconds; });
    return {
      world3D() { return { scene: game.scene, camera: game.camera }; },
      update(now) {
        hud.check();
        game.update(elapsed);
        elapsed = 0;
        if (now - lastState >= 200) { lastState = now; report(); }
      },
      input(event) { game.input(event); report(); },
      pause() { elapsed = 0; game.pause(); report(); },
      resume() { elapsed = 0; game.resume(); report(); },
      close() { hud.clear(); }
    };
  }
});
