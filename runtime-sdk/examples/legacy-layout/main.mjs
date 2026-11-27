// SPDX-License-Identifier: Apache-2.0
import { provideBindings } from './host-bindings.mjs';
import { installPlayerProject } from '@egret/android-player-project';
import { openLegacyAndroid } from '@egret/legacy/android';

installPlayerProject({
  width: 320,
  height: 180,
  clearColor: 0x182132,
  async create(services) {
    const game = await openLegacyAndroid(services, {
      width: 320,
      height: 180,
      projectId: 'p_layout_demo',
      entry: 'LayoutBoard',
      scriptGroup: 'board',
      provideBindings,
      theme: { skins: {}, exmls: [] },
      images: [{ url: 'pin.png', page: 1, width: 2, height: 2 }]
    });
    const root = services.engine.stage.getChildAt(0).getChildAt(0);
    await root.loadResources();
    let previous;
    return {
      ...game,
      closedSnapshot: () => services.raster.textPageUsage(),
      update() {
        if (previous !== globalThis.layoutObservation) {
          previous = globalThis.layoutObservation;
          services.state(previous);
        }
      }
    };
  }
});
