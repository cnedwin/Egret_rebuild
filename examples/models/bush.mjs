// SPDX-License-Identifier: Apache-2.0
// A bush, about 0.9 m tall and 1.4 m across, with berries. Parts: a cluster of squashed balls joined with a large
// `smooth`, flattened at the bottom by intersecting with a box so it sits on the ground, roughened, and dotted with red
// berries painted as spots.
export const about = { name: 'Bush', zh: '灌木', kind: 'plant' };
export const meshOptions = { triangles: 4000, variation: { amount: 0.1, frequency: 3 } };

export default function bush(W) {
  const mass = W.sdfUnion(
    [
      W.sdfEllipsoid([0.55, 0.45, 0.5], { at: [0, 0.4, 0] }),
      W.sdfEllipsoid([0.4, 0.35, 0.4], { at: [0.45, 0.3, 0.1] }),
      W.sdfEllipsoid([0.4, 0.35, 0.4], { at: [-0.4, 0.32, -0.1] })
    ],
    { smooth: 0.25, color: 0x4d8c3a }
  );
  const sitting = W.sdfIntersect(
    [W.sdfDisplace(mass, { amount: 0.06, frequency: 4 }), W.sdfBox([3, 2, 3], { at: [0, 1, 0] })],
    {
      smooth: 0.05
    }
  );
  const dark = W.sdfPattern(sitting, { kind: 'noise', color: 0x2f5f2a, frequency: 3, amount: 0.6 });
  return W.sdfPattern(dark, { kind: 'spots', color: 0xc8283c, frequency: 8, size: 0.45, seed: 2 });
}
