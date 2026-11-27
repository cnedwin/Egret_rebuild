// SPDX-License-Identifier: Apache-2.0
import {createScene, FRAME, PAGE} from '../scene/scene.mjs';

// The default game is a customer of the same entry contract as any other bundled EGR2 project.
export async function openGame(host) {
  const scene = await createScene(host);
  return {
    width: FRAME.width,
    height: FRAME.height,
    pages: [{slot: PAGE.id, source: scene.page, width: PAGE.width, height: PAGE.height, pixels: scene.pageBytes}],
    capture: scene.capture,
    close: scene.close
  };
}
