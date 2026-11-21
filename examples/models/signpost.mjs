// SPDX-License-Identifier: Apache-2.0
// A signpost, about 1.8 m tall. Parts: a post as a rounded box, a pointed cap from a cone, and two arrow boards from
// outlines drawn with `sdfExtrude`, one pointing each way at different heights and turned a little. Boards are planked
// with stripes and lighter at their worn edges.
export const about = { name: 'Signpost', zh: '路牌', kind: 'prop' };
export const meshOptions = { triangles: 3500, edges: { amount: 0.5 } };

export default function signpost(W) {
  const arrow = [
    [-0.4, -0.1],
    [0.25, -0.1],
    [0.4, 0],
    [0.25, 0.1],
    [-0.4, 0.1]
  ];
  const board = (y, turn, flip) =>
    W.sdfExtrude(flip ? arrow.map(([x, yy]) => [-x, yy]) : arrow, 0.05, {
      at: [flip ? -0.2 : 0.2, y, 0.06],
      rotation: [0, turn, 0],
      round: 0.015,
      color: 0xd9b26b
    });
  const boards = W.sdfPattern(W.sdfUnion([board(1.45, 0.15, false), board(1.15, -0.2, true)]), {
    kind: 'stripes',
    axis: 'y',
    color: 0xb08a4a,
    frequency: 12,
    size: 0.12,
    amount: 0.6
  });
  return W.sdfUnion(
    [
      W.sdfBox([0.1, 1.7, 0.1], { at: [0, 0.85, 0], round: 0.02, color: 0x6b4a2b }),
      W.sdfCone(0.08, 0.0, 0.12, { at: [0, 1.75, 0], rotation: [0, Math.PI / 4, 0], color: 0x6b4a2b }),
      boards
    ],
    { smooth: 0.01 }
  );
}
