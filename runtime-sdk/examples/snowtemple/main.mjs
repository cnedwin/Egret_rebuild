// SPDX-License-Identifier: Apache-2.0
import { installWorld3DPlayerProject } from '@egret/android-player-world3d';
import { createRollHud } from './hud.mjs';
import { createHeroScene, WIDTH, HEIGHT } from './hero.mjs';

installWorld3DPlayerProject({
  width: WIDTH, height: HEIGHT,
  async create(services) {
    const asset = await services.loadGlb('hero-low.glb', { firstPage: 200 });
    const spear = await services.assets.readBytes('spear.bin', services.signal);
    const spearEdge = await services.assets.readBytes('spearEdge.bin', services.signal);
    const hero = createHeroScene(asset, { spear, spearEdge });
    services.scope.use({ dispose: hero.close });
    const hud = createRollHud(services);
    hud.reset();
    for (const [label, x, y, width] of [
      ['Idle pose', 128, 26, 140], ['Walk pose', 384, 26, 140], ['Thrust pose', 640, 26, 140],
      ['Hold to walk', 192, 398, 180], ['Thrust', 576, 398, 160]
    ]) hud.button(label, { x, y, width, height: 36, size: 18, color: 0x223342 }, () => {});
    await hud.ready();
    let elapsed = 0, lastState = -Infinity;
    services.engine.clock.onTick(services.scope, tick => { elapsed += tick.deltaSeconds; });
    function report() { services.state(hero.state()); }
    report();
    return {
      world3D() { return { scene: hero.scene, camera: hero.camera }; },
      update(now) {
        hud.check();
        hero.update(elapsed);
        elapsed = 0;
        if (now - lastState >= 200) { lastState = now; report(); }
      },
      input(event) { hero.input(event); report(); },
      pause() { elapsed = 0; hero.pause(); report(); },
      resume() { elapsed = 0; hero.resume(); report(); },
      close() { hud.clear(); }
    };
  }
});
