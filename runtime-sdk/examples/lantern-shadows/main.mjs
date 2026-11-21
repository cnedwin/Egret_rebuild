// SPDX-License-Identifier: Apache-2.0
import { installPlayerProject } from '@egret/android-player-project';
import { loadLanternAssets } from './assets.mjs';
import { createLanternOverlay } from './overlay.mjs';
import { runLantern } from './session.mjs';
import { createLanternModel } from './model.mjs';
import { playbill } from './playbill.mjs';

installPlayerProject({
  width: 960,
  height: 540,
  clearColor: 0x2a1208,
  async create(services) {
    const model = createLanternModel(playbill, services.storage);
    const origin = Date.now();
    let advance,
      ready = false;
    // The comparison covers picture, interaction and the original campaign record.
    // Both comparison runs use muted audio; no WebAudio mixing is emulated in V8.
    const sound = () => ({
      muted: true,
      musicMuted: true,
      begin: async () => {},
      score() {},
      play() {},
      dim() {},
      court() {},
      state() {
        return { muted: true, musicMuted: true };
      }
    });
    const host = {
      ...model,
      performance: { now: () => Date.now() - origin },
      query: { has: () => false, get: () => null },
      createSound: sound,
      assets: () => loadLanternAssets(services),
      createBrowserGame: async (config) => {
        advance = config.update;
        return {
          engine: services.engine,
          scope: services.scope,
          backend: 'native-gles3',
          loop: {
            start() {
              ready = true;
            },
            state: 'running'
          }
        };
      }
    };
    await runLantern(host);
    if (!ready || !advance) throw Error('The campaign did not start its game loop');
    const ui = await createLanternOverlay(services, model);
    // Expose observed state sampled after gameplay, never a writable game or
    // alternate path to start an act, attack, complete a battle, or save a rank.
    let next = 0,
      oldResult,
      readSave;
    function update(elapsedMs) {
      advance(0);
      ui.update(elapsedMs);
      const result = model.node('rank').textContent;
      if (elapsedMs >= next || result !== oldResult) {
        oldResult = result;
        next = elapsedMs + 100;
        const route = model.route();
        if (!route.playing || route.act?.result || readSave === undefined)
          readSave = services.storage.getItem('lantern-shadows-records');
        services.state({
          ...route,
          stored: readSave,
          rank: result,
          recordMenu: model.node('show-records').textContent
        });
      }
    }
    return {
      update,
      input(event) {
        ui.input(event);
      },
      pause() {
        ui.cancel?.();
        model.pause();
      },
      close() {
        ui.close();
      }
    };
  }
});
