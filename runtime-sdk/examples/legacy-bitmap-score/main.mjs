// SPDX-License-Identifier: Apache-2.0
import { installPlayerProject } from '@egret/android-player-project';
import { openLegacyAndroid } from '@egret/legacy/android';
import { scoreProfile } from './profile.mjs';
installPlayerProject({
  width: 160,
  height: 90,
  clearColor: 0x183048,
  async create(services) {
    const game = await openLegacyAndroid(services, {
      ...scoreProfile,
      entry: 'ScoreBoard',
      scriptGroup: 'score',
      images: [{ url: 'digits.png', page: 1, width: 6, height: 3 }]
    });
    const root = services.engine.stage.getChildAt(0).getChildAt(0);
    await root.start();
    let previous;
    return {
      ...game,
      closedSnapshot: () => services.raster.textPageUsage(),
      update() {
        if (previous !== globalThis.scoreObservation) {
          previous = globalThis.scoreObservation;
          services.state(previous);
        }
      }
    };
  }
});
