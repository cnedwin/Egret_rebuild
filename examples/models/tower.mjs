// SPDX-License-Identifier: Apache-2.0
// A watchtower, about 6 m tall. Parts: a tapering stone body turned from a profile with `sdfLathe`, a wider top ring
// with battlements made by subtracting eight boxes set round it, a conical roof, a door and two arrow-slit windows cut
// in with a dark colour, and a flag on a pole. At 96 cells along its 6.5 m height a cell is about 7 cm: the pole and
// the flag are made at least 8 cm thick, or they would fall between the cells and vanish. Stone courses are stripes
// across y; the foot is darker from a gradient.
export const about = { name: 'Watchtower', zh: '瞭望塔', kind: 'building' };
export const meshOptions = {
  triangles: 8000,
  resolution: 96,
  edges: { amount: 0.35 },
  variation: { amount: 0.08, frequency: 1.5 }
};
export const surface = { surface: 'stone', strength: 0.35, scale: 1.5 };

export default function tower(W) {
  const stone = 0xb9b2a4,
    hole = 0x1b1612;
  const body = W.sdfLathe(
    [
      [0, 0.04],
      [1.1, 0.04],
      [0.9, 3.6],
      [1.15, 3.8],
      [1.15, 4.5],
      [0, 4.5]
    ],
    { round: 0.04, color: stone }
  );
  const merlons = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    merlons.push(W.sdfBox([0.45, 0.4, 0.8], { at: [Math.sin(a) * 1.1, 4.45, Math.cos(a) * 1.1], rotation: [0, a, 0] }));
  }
  const openings = [
    W.sdfBox([0.6, 1.1, 0.6], { at: [0, 0.55, 1.05], round: 0.08, color: hole }),
    W.sdfBox([0.12, 0.6, 0.6], { at: [0, 2.3, 0.95], round: 0.03, color: hole }),
    W.sdfBox([0.6, 0.6, 0.12], { at: [0.95, 2.8, 0], round: 0.03, color: hole })
  ];
  const walls = W.sdfSubtract(body, [...merlons, W.sdfCylinder(0.85, 0.6, { at: [0, 4.5, 0] }), ...openings], {
    smooth: 0.02
  });
  const courses = W.sdfPattern(walls, {
    kind: 'stripes',
    axis: 'y',
    color: 0x9a9384,
    frequency: 3,
    size: 0.12,
    amount: 0.7
  });
  const grimy = W.sdfPattern(courses, { kind: 'gradient', axis: 'y', color: 0x6f6a5c, from: 0.8, to: 0, amount: 0.6 });
  const flag = W.sdfExtrude(
    [
      [0, 0],
      [0.6, 0.15],
      [0, 0.3]
    ],
    0.08,
    { at: [0.05, 6.1, 0], round: 0.02, color: 0xc8282d }
  );
  return W.sdfUnion(
    [
      grimy,
      W.sdfCone(1.0, 0.03, 1.4, { at: [0, 5.0, 0], color: 0x4f6a8a }),
      W.sdfCylinder(0.05, 1.2, { at: [0, 5.9, 0], color: 0x3b2a20 }),
      flag
    ],
    { smooth: 0.02 }
  );
}
