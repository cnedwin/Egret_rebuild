// SPDX-License-Identifier: Apache-2.0
// A sitting cat, about 0.35 m tall. Parts: a pear of a body (a big egg low, a smaller one for the chest), a round head
// a little wider than tall, triangular ears from cones, front legs as straight tapered capsules, haunches as squashed
// balls at the back, and a tail curling round the feet from two capsules. Stripes across y give a tabby; the muzzle is
// a white egg; eyes and nose are their own crisp group.
export const about = { name: 'Cat', zh: '猫', kind: 'animal' };
export const meshOptions = { triangles: 5000, variation: { amount: 0.05 } };

export default function cat(W) {
  const fur = 0xe39a52,
    white = 0xf4f1ea;
  const body = W.sdfUnion(
    [
      W.sdfEllipsoid([0.09, 0.1, 0.1], { at: [0, 0.1, -0.02], color: fur }),
      W.sdfEllipsoid([0.065, 0.08, 0.06], { at: [0, 0.18, 0.04], color: fur }),
      W.sdfEllipsoid([0.075, 0.065, 0.065], { at: [0, 0.28, 0.06], color: fur }),
      W.sdfMirror(W.sdfCone(0.028, 0.002, 0.06, { at: [0.045, 0.34, 0.05], rotation: [0, 0, -0.3], color: fur })),
      W.sdfMirror(W.sdfCapsule([0.03, 0.16, 0.07], [0.032, 0.015, 0.09], 0.018, { radiusEnd: 0.016, color: fur })),
      W.sdfMirror(W.sdfEllipsoid([0.04, 0.05, 0.06], { at: [0.06, 0.06, -0.03], color: fur })),
      W.sdfCapsule([0, 0.03, -0.1], [0.09, 0.02, -0.02], 0.016, { color: fur }),
      W.sdfCapsule([0.09, 0.02, -0.02], [0.1, 0.02, 0.07], 0.015, { radiusEnd: 0.012, color: fur })
    ],
    { smooth: 0.02 }
  );
  const tabby = W.sdfPattern(body, {
    kind: 'stripes',
    axis: 'y',
    color: 0xa85a22,
    frequency: 22,
    size: 0.35,
    amount: 0.8
  });
  return W.sdfUnion(
    [
      tabby,
      W.sdfEllipsoid([0.03, 0.02, 0.02], { at: [0, 0.26, 0.115], color: white }),
      W.sdfSphere(0.007, { at: [0, 0.272, 0.132], color: 0xd98a8a }),
      W.sdfMirror(W.sdfEllipsoid([0.012, 0.014, 0.008], { at: [0.028, 0.29, 0.117], color: 0x6b8f2a }))
    ],
    { smooth: 0.004 }
  );
}
