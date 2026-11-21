// SPDX-License-Identifier: Apache-2.0
// A cottage, about 3 m wide and 3.2 m to the ridge. Parts: walls from a rounded box with a door and two windows cut in
// (each cut has a dark colour, so the holes read as openings), a thatched roof from a box turned 45 degrees and cut by
// a box below the eaves, a chimney, a door slab set into its opening, and window frames from thin rounded boxes. The
// roof gets stripes for the thatch and the walls a gradient of dirt at the foot.
export const about = { name: 'Cottage', zh: '小屋', kind: 'building' };
export const meshOptions = { triangles: 8000, edges: { amount: 0.35 }, variation: { amount: 0.06, frequency: 2 } };

export default function cottage(W) {
  const plaster = 0xefe3c8,
    timber = 0x6b4a2b,
    thatch = 0xc9a24a,
    hole = 0x1b1612;
  const walls = W.sdfPattern(W.sdfBox([2.6, 1.8, 2.0], { at: [0, 0.9, 0], round: 0.06, color: plaster }), {
    kind: 'gradient',
    axis: 'y',
    color: 0x8a7a5e,
    from: 0.35,
    to: 0,
    amount: 0.6
  });
  const openings = [
    W.sdfBox([0.6, 1.1, 0.3], { at: [0, 0.55, 1.0], round: 0.04, color: hole }),
    W.sdfMirror(W.sdfBox([0.45, 0.45, 0.3], { at: [0.85, 1.05, 1.0], round: 0.04, color: hole }))
  ];
  const cut = W.sdfSubtract(walls, openings, { smooth: 0.02 });
  const roof = W.sdfPattern(
    W.sdfSubtract(
      W.sdfBox([2.2, 2.2, 2.5], { at: [0, 1.8, 0], rotation: [0, 0, Math.PI / 4], round: 0.08, color: thatch }),
      W.sdfBox([4, 2, 3], { at: [0, 0.75, 0] })
    ),
    { kind: 'stripes', axis: 'y', color: 0x9c7a2e, frequency: 6, size: 0.25, amount: 0.7 }
  );
  const details = [
    W.sdfBox([0.3, 0.9, 0.3], { at: [0.75, 2.75, -0.4], round: 0.03, color: 0x8e7f72 }),
    W.sdfBox([0.5, 1.0, 0.06], { at: [0, 0.5, 0.92], round: 0.02, color: timber }),
    W.sdfMirror(W.sdfBox([0.55, 0.06, 0.12], { at: [0.85, 0.8, 1.0], round: 0.02, color: timber })),
    W.sdfMirror(W.sdfBox([0.06, 0.45, 0.06], { at: [0.85, 1.05, 0.96], round: 0.01, color: timber })),
    W.sdfMirror(W.sdfBox([0.12, 1.8, 0.12], { at: [1.27, 0.9, 0.97], round: 0.02, color: timber }))
  ];
  return W.sdfUnion([cut, roof, ...details], { smooth: 0.02 });
}
