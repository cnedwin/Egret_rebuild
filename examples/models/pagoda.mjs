// SPDX-License-Identifier: Apache-2.0
// A small pagoda, about 5 m tall: three storeys, each a square room with a wide roof whose eaves turn up at the
// corners. Parts: for each storey, a red room as a rounded box with a door cut in each face, and a roof as a lathe of a
// profile that sweeps up at its rim, made square by intersecting with a box turned 45 degrees. A stone base under all,
// and a spire of stacked balls on top.
export const about = { name: 'Pagoda', zh: '宝塔', kind: 'building' };
export const meshOptions = { triangles: 8000, edges: { amount: 0.3 }, variation: { amount: 0.05, frequency: 1.5 } };

export default function pagoda(W) {
  const red = 0xa8322a,
    tile = 0x3f4f4a,
    hole = 0x1b1612;
  const storey = (width, y) => {
    const room = W.sdfSubtract(W.sdfBox([width, 0.9, width], { at: [0, y + 0.45, 0], round: 0.04, color: red }), [
      W.sdfMirror(W.sdfBox([0.35, 0.6, 0.3], { at: [0, y + 0.3, width / 2], round: 0.05, color: hole }), { axis: 'z' }),
      W.sdfMirror(W.sdfBox([0.3, 0.6, 0.35], { at: [width / 2, y + 0.3, 0], round: 0.05, color: hole }))
    ]);
    const r = width * 0.95;
    const roof = W.sdfIntersect([
      W.sdfLathe(
        [
          [0, y + 0.85],
          [r * 1.05, y + 0.85],
          [r * 1.15, y + 1.0],
          [r * 0.6, y + 1.15],
          [0, y + 1.35]
        ],
        { round: 0.04, color: tile }
      ),
      W.sdfBox([r * 1.5, 2, r * 1.5], { at: [0, y + 1, 0], rotation: [0, Math.PI / 4, 0] })
    ]);
    return W.sdfUnion([room, roof], { smooth: 0.03 });
  };
  return W.sdfUnion(
    [
      W.sdfBox([2.6, 0.3, 2.6], { at: [0, 0.15, 0], round: 0.04, color: 0x9a958a }),
      storey(2.0, 0.3),
      storey(1.6, 1.65),
      storey(1.2, 3.0),
      W.sdfCylinder(0.05, 0.9, { at: [0, 4.7, 0], color: 0xd9b26b }),
      W.sdfSphere(0.12, { at: [0, 4.55, 0], color: 0xd9b26b }),
      W.sdfSphere(0.09, { at: [0, 4.8, 0], color: 0xd9b26b }),
      W.sdfSphere(0.07, { at: [0, 5.05, 0], color: 0xd9b26b })
    ],
    { smooth: 0.02 }
  );
}
