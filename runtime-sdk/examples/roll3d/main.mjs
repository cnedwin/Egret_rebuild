// SPDX-License-Identifier: Apache-2.0
import { createRandom } from '@egret/engine/kit';
import { installWorld3DPlayerProject } from '@egret/android-player-world3d';
import { createPlay3DSession } from '@egret/android-play3d-session';
import { runLevel } from './level.mjs';
import { createRollHud } from './hud.mjs';

installWorld3DPlayerProject({
  width: 960,
  height: 540,
  async create(services) {
    const hud = createRollHud(services);
    const pointer = { x: 0, y: 0, down: false, pressed: false };
    const loop = { state: 'starting' };
    let id, tap, config, world, whole, restarting, closed = false, paused = false;
    let elapsed = 0, round = 0, frames = 0, lastObservation = -Infinity, oldLabels, failure;

    // Consume the player's admitted game time. Android pauses and foreground
    // delays follow the same clock as the existing native 2D project player.
    services.engine.clock.onTick(services.scope, tick => { elapsed += tick.deltaSeconds; });
    function release() {
      id = tap = undefined;
      pointer.pressed = pointer.down = false;
    }
    function newRound() {
      if (closed) return Promise.reject(new Error('The game is closed'));
      if (restarting) return restarting;
      restarting = Promise.resolve().then(async () => {
        if (closed) return;
        loop.state = 'starting';
        release();
        hud.reset();
        round++;
        await config.setup(flat);
        await hud.ready();
        if (!closed) loop.state = 'running';
      }).finally(() => { restarting = undefined; });
      return restarting;
    }

    const flat = {
      width: 960, height: 540, scope: services.scope, browser: { loop },
      pointer, keys: { axis: () => ({x: 0, y: 0}), pressed: () => false },
      random: createRandom(Date.now() + ':' + Math.random()),
      get paused() { return paused; },
      text: hud.text, button: hud.button, restart: newRound,
      sfx: { play(name) { services.playSound(name + '.wav'); } },
      dispose() {
        closed = true;
        loop.state = 'closed';
        release();
        hud.clear();
      }
    };

    await runLevel(async options => {
      whole = await createPlay3DSession(options, async hooks => {
        config = hooks;
        await newRound();
        return flat;
      }, () => ({
        show(scene, camera) { world = { scene, camera }; }
      }));
    });

    // Read-only diagnostics for the physical-device input driver. The controlled
    // sphere is the only high-resolution primitive in this version of the level.
    function observe(now) {
      const hudLines = hud.labels();
      const marker = hudLines.join('\n');
      if (marker === oldLabels && now - lastObservation < 250) return;
      oldLabels = marker;
      lastObservation = now;
      const body = world.scene.children.find(node => node.geometry?.vertexCount > 300);
      const position = body?.position;
      const score = /^Stars (\d+)\/(\d+)$/.exec(hudLines[0] ?? '');
      services.state({
        round, frames, hud: hudLines,
        starsRemaining: score && Number(score[2]) - Number(score[1]),
        result: hudLines.find(line => line === 'All four!' || line === 'Fell off') ?? '',
        ball: position ? { x:position[0], y:position[1], z:position[2] } : null
      });
    }
    return {
      world3D: () => world,
      update(now) {
        if (failure) throw failure;
        hud.check();
        const dt = elapsed;
        elapsed = 0;
        if (dt > 0 && loop.state === 'running' && !paused) {
          config.update(dt, flat);
          pointer.pressed = false;
        }
        frames++;
        observe(now);
      },
      input(event) {
        if (paused || closed || loop.state !== 'running') return;
        if (event.type === 'down' && id === undefined) {
          id = event.id;
          tap = hud.hit(event.x, event.y);
          pointer.down = true;
          pointer.pressed = !tap;
        } else if (event.id !== id) return;
        pointer.x = event.x;
        pointer.y = event.y;
        if (event.type === 'cancel') release();
        if (event.type === 'up') {
          const button = tap;
          id = tap = undefined;
          pointer.down = false;
          if (button && hud.hit(event.x, event.y) === button)
            Promise.resolve(button.pressed()).catch(error => { failure = error; });
        }
      },
      pause() { paused = true; elapsed = 0; release(); },
      resume() { paused = false; elapsed = 0; },
      async close() {
        try { await whole.dispose(); } finally { world = undefined; }
      }
    };
  }
});
