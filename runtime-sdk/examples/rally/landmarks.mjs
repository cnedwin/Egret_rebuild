// SPDX-License-Identifier: Apache-2.0
import { BALL, BOX, CYLINDER, PYRAMID } from './original/shapes.mjs';
import { trees } from './original/landscape.mjs';

// The pinned original determines tree types, poses, roadside lot selection and
// the grandstand side of the start line. The native low-detail view uses shared
// solid meshes for these silhouettes rather than loading additional model sets.
export function addLandmarks(scene, track, paint, anchor) {
  const forest = trees(track);
  const collections = [
    [forest.pines, 'pine', 2],
    [forest.hillPines, 'pine', 4],
    [forest.blossoms.slice(0, 200), 'blossom', 2],
    [forest.bamboos.slice(0, 260), 'bamboo', 3]
  ];
  for (const [placements, kind, stride] of collections) {
    for (let i = 0; i < placements.length; i += stride) {
      const [x, y, z, heading, size] = placements[i],
        g = anchor({ x, y, z, heading }, 145);
      g.setScale(size);
      if (kind === 'bamboo') {
        for (const offset of [-0.55, 0.55]) {
          paint.part(g, BOX, 0x617c42, [offset, 3.1, 0], [0.18, 6.2, 0.18]);
          paint.part(g, PYRAMID, 0x5e8446, [offset + 0.12, 4.7, 0], [0.95, 2.9, 0.7]);
        }
      } else {
        paint.part(g, BOX, kind === 'pine' ? 0x695242 : 0x745043, [0, 1.7, 0], [0.46, 3.4, 0.47]);
        if (kind === 'pine') {
          paint.part(g, PYRAMID, 0x416a47, [0, 3.9, 0], [2.45, 4.15, 2]);
          paint.part(g, PYRAMID, 0x507653, [0.1, 5.55, 0.04], [1.65, 3.1, 1.55]);
        } else {
          paint.part(g, BALL, 0xe5a2b5, [0.5, 4.4, 0.44], [2.15, 1.75, 2.3]);
          paint.part(g, BALL, 0xf5c4cd, [-0.81, 4.1, -0.52], [2.05, 1.3, 1.8]);
        }
      }
    }
  }
  const stand = anchor(track.sample(0.012 * track.length, -(track.limit[0] + 4.5), {}), 200);
  for (let row = 0; row < 5; row++) {
    const x = 0.12 + row * 1.46,
      h = 1.04 + row * 1.35;
    paint.part(stand, BOX, 0xa39983, [x, h / 2, 0], [1.45, h, 56]);
    paint.part(stand, BOX, 0x713c30, [x, h + 0.18, 0], [0.54, 0.26, 55]);
    for (let seat = 0; seat < 20; seat++) {
      const z = -26 + seat * 2.62;
      if (Math.abs(Math.abs(z) - 9.1) < 1.4) continue;
      paint.part(
        stand,
        BALL,
        [0xbe5750, 0x507d72, 0x476278, 0xd1ac67][(seat + row) % 4],
        [x, h + 0.68, z],
        [0.34, 0.54, 0.36]
      );
    }
  }
  for (const z of [-27.6, -18.35, -9.1, 0, 9.1, 18.35, 27.6]) {
    paint.part(stand, BOX, 0xad4838, [7.24, 4.74, z], [0.3, 7.44, 0.3]);
    paint.part(stand, BOX, 0xad4838, [-0.82, 4.58, z], [0.27, 6.96, 0.27]);
    paint.part(stand, BOX, 0xc79a52, [3.62, 8.28, z], [8.8, 0.21, 0.25]);
  }
  paint.part(stand, BOX, 0x315651, [3.6, 8.75, 0], [9.6, 0.58, 58]);
  paint.part(stand, BOX, 0x2e5954, [3.94, 9.7, 0], [4.1, 0.55, 58]);
  // Use the same two-sided lot search as the original track's pagodas.
  for (const [fraction, lateral, size, tiers] of [
    [0.03, 46, 1.25, 5],
    [0.255, -44, 1.1, 5],
    [0.79, 42, 1, 5],
    [0.45, 34, 0.9, 3],
    [0.9, -40, 1, 3]
  ]) {
    for (const side of [lateral, -lateral]) {
      const p = track.sample(fraction * track.length, side, {});
      const loc = track.locate(p.x, p.z, -1, {});
      if (Math.abs(loc.lateral) <= loc.limit + 9 || track.lakeDistance(p.x, p.z) <= 1.2) continue;
      const g = anchor({ ...p, y: track.terrainHeight(p.x, p.z) - 0.2 }, 215);
      g.setScale(size);
      for (let j = 0; j < tiers; j++) {
        const s = 1 - j * 0.105;
        paint.part(g, BOX, 0xd2ba8b, [0, 1.8 + j * 3.4, 0], [5.6 * s, 3.4, 5.6 * s]);
        paint.part(g, PYRAMID, 0x314d48, [0, 3.45 + j * 3.4, 0], [6.8 * s, 1.85, 6.8 * s], [0, Math.PI / 4, 0]);
      }
      paint.part(g, CYLINDER, 0xc39b41, [0, tiers * 3.4 + 1.1, 0], [0.25, 2.9, 0.25]);
      break;
    }
  }
}
