// SPDX-License-Identifier: Apache-2.0
import { createPlayerProject } from './player-project.mjs';
import { createWorldProjectEncoder } from './world3d-frame.mjs';

/** Install the optional World3D project path without pulling its capture code into 2D games. */
export function installWorld3DPlayerProject(definition) {
  const encode = createWorldProjectEncoder();
  const player = createPlayerProject(definition, globalThis.EgretNativePlayer, (game, hud) =>
    encode(game.world3D(), hud)
  );
  globalThis.EgretPlayerProject = player;
  return player;
}
