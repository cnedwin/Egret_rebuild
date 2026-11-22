// SPDX-License-Identifier: Apache-2.0
import { createHeroScene } from './hero.mjs';

export const controls = [
  ['Idle pose', 128, 26, 140], ['Walk pose', 384, 26, 140], ['Thrust pose', 640, 26, 140],
  ['Hold to walk', 192, 398, 180], ['Thrust', 576, 398, 160]
];

export async function openScene({ glb, bytes }) {
  const lin = await glb('hero-low.glb', 200);
  return createHeroScene(lin, { spear: await bytes('spear.bin'), spearEdge: await bytes('spearEdge.bin') });
}
