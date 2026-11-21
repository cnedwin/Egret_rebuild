// SPDX-License-Identifier: Apache-2.0
// A boulder, about 1.2 m across. Parts: two overlapping squashed balls joined smoothly, cut flat by a tilted box to
// give it one hard face, roughened twice with `sdfDisplace` (large slow bumps, then small fast ones), set into the
// ground a little, and mossy on top from a gradient roughened by noise.
export const about = { name: 'Rock', zh: '石头', kind: 'prop' };
export const meshOptions = { triangles: 3000, variation: { amount: 0.12, frequency: 4 } };

export default function rock(W) {
  const stone = W.sdfSubtract(
    W.sdfUnion(
      [
        W.sdfEllipsoid([0.55, 0.38, 0.45], { at: [0, 0.3, 0] }),
        W.sdfEllipsoid([0.35, 0.3, 0.35], { at: [0.35, 0.22, 0.2] })
      ],
      { smooth: 0.2, color: 0x6f6d66 }
    ),
    W.sdfBox([1.5, 0.6, 1.5], { at: [-0.75, 0.55, 0], rotation: [0, 0, 0.5] }),
    { smooth: 0.05 }
  );
  const rough = W.sdfDisplace(W.sdfDisplace(stone, { amount: 0.08, frequency: 2, seed: 1 }), {
    amount: 0.02,
    frequency: 9,
    seed: 2
  });
  const grounded = W.sdfIntersect([rough, W.sdfBox([3, 2, 3], { at: [0, 1, 0] })], { smooth: 0.02 });
  const moss = W.sdfPattern(grounded, {
    kind: 'gradient',
    axis: 'y',
    color: 0x5a8a3a,
    from: 0.4,
    to: 0.6,
    amount: 0.9
  });
  return W.sdfPattern(moss, { kind: 'noise', color: 0x55534d, frequency: 4, amount: 0.5 });
}
