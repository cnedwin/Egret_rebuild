// SPDX-License-Identifier: Apache-2.0
// A pine, about 3.5 m tall. Parts: a straight trunk, and three cones of needles stacked so each overlaps the one below,
// smaller towards the top, with their rims rounded. Displacement breaks the clean cone edges; the tiers are darker at
// their undersides from a gradient on each.
export const about = { name: 'Pine', zh: '松树', kind: 'plant' };
export const meshOptions = { triangles: 5000, variation: { amount: 0.1, frequency: 3 } };

export default function pine(W) {
  const needles = 0x2f6b3e;
  const tier = (radius, height, y) =>
    W.sdfPattern(W.sdfRound(W.sdfCone(radius, 0.02, height, { at: [0, y, 0], color: needles }), 0.04), {
      kind: 'gradient',
      axis: 'y',
      color: 0x1b4026,
      from: y - height * 0.2,
      to: y - height * 0.5,
      amount: 0.8
    });
  const crown = W.sdfDisplace(
    W.sdfUnion([tier(1.0, 1.4, 1.3), tier(0.78, 1.2, 2.05), tier(0.55, 1.0, 2.75)], { smooth: 0.05 }),
    {
      amount: 0.05,
      frequency: 5
    }
  );
  return W.sdfUnion([W.sdfCylinder(0.12, 1.0, { at: [0, 0.5, 0], color: 0x5a3c25 }), crown], { smooth: 0.05 });
}
