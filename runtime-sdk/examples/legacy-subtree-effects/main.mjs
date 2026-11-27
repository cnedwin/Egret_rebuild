// SPDX-License-Identifier: Apache-2.0
import { installPlayerProject } from '@egret/android-player-project';
import { openLegacyAndroid } from '@egret/legacy/android';

installPlayerProject({
  width: 192,
  height: 128,
  clearColor: 0x102030,
  async create(services) {
    const game = await openLegacyAndroid(services, {
      width: 192,
      height: 128,
      projectId: 'p_subtree_effects',
      entry: 'SubtreeBoard',
      scriptGroup: 'board'
    });
    const board = services.engine.stage.getChildAt(0).getChildAt(0);
    let previous;
    return {
      ...game,
      closedSnapshot: () => services.raster.textPageUsage(),
      update() {
        if (previous === board.mode) return;
        previous = board.mode;
        services.state({mode: board.mode, refusal: board.refusal});
      }
    };
  }
});
