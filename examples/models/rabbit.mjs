// SPDX-License-Identifier: Apache-2.0
// A sitting rabbit, about 0.3 m tall with its ears. Parts: a round body low and wide, a head on top and forward, two
// long flat ears from squashed capsules leaning back, big hind feet as long eggs, small front paws, and a ball of a
// tail. White with grey-brown patches from noise.
export const about = { name: 'Rabbit', zh: '兔子', kind: 'animal' };
export const meshOptions = { triangles: 4000, variation: { amount: 0.04 } };

export default function rabbit(W) {
  const fur = 0xefe9e1;
  // The ears start inside the head, so the smooth join grows them out of it rather than leaving them floating.
  const ear = W.sdfEllipsoid([0.018, 0.07, 0.008], {
    at: [0.026, 0.265, 0.035],
    rotation: [-0.3, 0, -0.15],
    color: fur
  });
  const body = W.sdfUnion(
    [
      W.sdfEllipsoid([0.08, 0.075, 0.09], { at: [0, 0.075, -0.01], color: fur }),
      W.sdfSphere(0.055, { at: [0, 0.17, 0.05], color: fur }),
      W.sdfMirror(ear),
      W.sdfMirror(W.sdfEllipsoid([0.025, 0.018, 0.06], { at: [0.055, 0.018, 0.02], color: fur })),
      W.sdfMirror(W.sdfCapsule([0.025, 0.06, 0.07], [0.025, 0.012, 0.085], 0.012, { color: fur })),
      W.sdfSphere(0.025, { at: [0, 0.07, -0.1], color: 0xffffff })
    ],
    { smooth: 0.02 }
  );
  const patches = W.sdfPattern(body, { kind: 'noise', color: 0x9b8774, frequency: 14, amount: 0.8, seed: 3 });
  return W.sdfUnion(
    [
      patches,
      W.sdfSphere(0.008, { at: [0, 0.17, 0.104], color: 0xd98a99 }),
      W.sdfMirror(W.sdfSphere(0.01, { at: [0.027, 0.188, 0.092], color: 0x1a1a1a }))
    ],
    { smooth: 0.003 }
  );
}
