// SPDX-License-Identifier: Apache-2.0
// A broad-leaved tree, about 3 m tall. Parts: a trunk as a tapered capsule with two branches, and a crown of five
// overlapping balls joined with a large `smooth` and then roughened with `sdfDisplace`, so it reads as one leafy mass
// rather than a cluster of balls. The crown is lighter on top from a gradient and has darker patches from noise; the
// trunk has bark stripes along it.
export const about = { name: 'Tree', zh: '树', kind: 'plant' };
export const meshOptions = { triangles: 6000, variation: { amount: 0.1, frequency: 2 } };

export default function tree(W) {
  const bark = 0x6b4a2b,
    leaf = 0x3f8a3a;
  const trunk = W.sdfPattern(
    W.sdfUnion(
      [
        W.sdfCapsule([0, 0.17, 0], [0.05, 1.7, 0], 0.17, { radiusEnd: 0.1, color: bark }),
        W.sdfCapsule([0.04, 1.2, 0], [0.5, 1.75, 0.1], 0.07, { radiusEnd: 0.04, color: bark }),
        W.sdfCapsule([0.04, 1.3, 0], [-0.45, 1.8, -0.15], 0.07, { radiusEnd: 0.04, color: bark })
      ],
      { smooth: 0.08 }
    ),
    { kind: 'stripes', axis: 'x', color: 0x4a3220, frequency: 14, size: 0.3, amount: 0.6 }
  );
  const crown = W.sdfDisplace(
    W.sdfUnion(
      [
        W.sdfSphere(0.75, { at: [0, 2.2, 0] }),
        W.sdfSphere(0.55, { at: [0.6, 1.95, 0.15] }),
        W.sdfSphere(0.55, { at: [-0.55, 2.0, -0.15] }),
        W.sdfSphere(0.5, { at: [0.1, 2.0, 0.55] }),
        W.sdfSphere(0.5, { at: [-0.1, 2.1, -0.55] })
      ],
      { smooth: 0.3, color: leaf }
    ),
    { amount: 0.08, frequency: 3 }
  );
  const lit = W.sdfPattern(crown, { kind: 'gradient', axis: 'y', color: 0x7cbf4a, from: 2.2, to: 2.9, amount: 0.7 });
  const leaves = W.sdfPattern(lit, { kind: 'noise', color: 0x2a6128, frequency: 2.5, amount: 0.6 });
  return W.sdfUnion([trunk, leaves], { smooth: 0.1 });
}
