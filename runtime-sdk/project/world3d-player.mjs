// SPDX-License-Identifier: Apache-2.0
import { createPlayerProject } from './player-project.mjs';
import { createProjectGlbLoader } from './world3d-assets.mjs';
import { createWorldProjectEncoder } from './world3d-frame.mjs';

/** Install the optional World3D project path without pulling its capture code into 2D games. */
export function installWorld3DPlayerProject(definition) {
  const player = createPlayerProject(
    definition,
    globalThis.EgretNativePlayer,
    createWorldProjectEncoder(),
    (services, pageInUse) => ({
      ...services,
      loadGlb: createProjectGlbLoader(services, pageInUse)
    })
  );
  globalThis.EgretPlayerProject = player;
  return player;
}
