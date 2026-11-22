// SPDX-License-Identifier: Apache-2.0
import { installWorld3DPlayerProject } from '@egret/android-player-world3d';
import { createRollHud } from './hud.mjs';
import { WIDTH, HEIGHT } from './actors.mjs';
import { controls, openScene } from './profile.mjs';

installWorld3DPlayerProject({
  width: WIDTH, height: HEIGHT,
  async create(services) {
    const game = await openScene({
      glb: (file, firstPage) => services.loadGlb(file, { firstPage }),
      bytes: file => services.assets.readBytes(file, services.signal)
    });
    services.scope.use({ dispose: game.close });
    const hud = createRollHud(services);
    hud.reset();
    for (const [label, x, y, width] of controls)
      hud.button(label, { x, y, width, height: 36, size: 18, color: 0x223342 }, () => {});
    const counters = [];
    if (game.state().encounter) {
      for (const [name, x] of [['Lin', 30], ['Blade', 580]]) {
        hud.text(name + ' HP', { x, y: 16, size: 17, color: 0xffffff });
        counters.push([0, 1, 2].map(i => hud.text(' ', { x: x + 85 + 12*i, y: 16, size: 17, color: 0xffffff })));
      }
      // Publish the bounded health glyphs before the first 3D frame. A hit
      // changes display references without adding a texture in mid-combat.
      for (const digit of '0123456789') counters[0][0].text = digit;
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
