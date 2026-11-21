// SPDX-License-Identifier: Apache-2.0
// A fox, about 0.55 m long. Parts: an egg of a body, a ball of a head set forward and up, a tapered snout, two cone
// ears leaning out, four tapered legs (one front and one back leg mirrored), and a thick tail rising behind. Colour:
// orange fur, a cream belly and chin painted on the torso alone, a cream tail tip, dark socks painted on the legs
// alone, and black eyes and nose in their own group so they stay crisp. `rig` gives it bones and a trot.
export const about = { name: 'Fox', zh: '狐狸', kind: 'animal' };
export const meshOptions = { triangles: 5000, variation: { amount: 0.05 } };

export default function fox(W) {
  const fur = 0xd9772b,
    cream = 0xf6e8d2,
    sock = 0x3a2618;
  const leg = (x, z) =>
    W.sdfPattern(W.sdfCapsule([x, 0.24, z], [x + 0.01, 0.03, z + 0.02], 0.035, { radiusEnd: 0.026, color: fur }), {
      kind: 'gradient',
      color: sock,
      from: 0.14,
      to: 0.1
    });
  // Gradients are painted on the parts they belong to before the parts are joined: a belly gradient painted on the
  // whole fox would turn its legs cream too.
  const torso = W.sdfUnion(
    [
      W.sdfEllipsoid([0.1, 0.1, 0.18], { at: [0, 0.27, 0], color: fur }),
      W.sdfSphere(0.09, { at: [0, 0.37, 0.17], color: fur }),
      W.sdfCapsule([0, 0.35, 0.22], [0, 0.32, 0.32], 0.04, { radiusEnd: 0.015, color: fur }),
      W.sdfMirror(W.sdfCone(0.035, 0.002, 0.09, { at: [0.05, 0.47, 0.15], rotation: [-0.15, 0, -0.35], color: fur }))
    ],
    { smooth: 0.03 }
  );
  const belly = W.sdfPattern(torso, { kind: 'gradient', axis: 'y', color: cream, from: 0.27, to: 0.19, amount: 0.9 });
  const muzzle = W.sdfPattern(belly, { kind: 'gradient', axis: 'z', color: cream, from: 0.24, to: 0.3 });
  const tail = W.sdfPattern(W.sdfCapsule([0, 0.3, -0.16], [0, 0.4, -0.36], 0.05, { radiusEnd: 0.035, color: fur }), {
    kind: 'gradient',
    axis: 'z',
    color: cream,
    from: -0.32,
    to: -0.38
  });
  const body = W.sdfUnion([muzzle, tail, W.sdfMirror(leg(0.05, 0.1)), W.sdfMirror(leg(0.05, -0.1))], { smooth: 0.03 });
  return W.sdfUnion(
    [
      body,
      W.sdfSphere(0.012, { at: [0, 0.325, 0.335], color: 0x111111 }),
      W.sdfMirror(W.sdfSphere(0.014, { at: [0.04, 0.4, 0.245], color: 0x111111 }))
    ],
    { smooth: 0.004 }
  );
}

/**
 * The fox's rig: a body, a head, a tail and two pairs of legs, with a trot and a sit-and-look idle. The parts given to
 * the bones only guide which bone each vertex follows, so they are simple shapes near the real ones, not the model's.
 */
export function rig(W, options = {}) {
  const made = W.createSdfRig3D(
    fox(W),
    [
      { name: 'body', at: [0, 0.27, 0], parts: W.sdfEllipsoid([0.1, 0.1, 0.16], { at: [0, 0.27, 0] }) },
      {
        name: 'head',
        parent: 'body',
        at: [0, 0.33, 0.12],
        parts: [W.sdfSphere(0.09, { at: [0, 0.37, 0.17] }), W.sdfCapsule([0, 0.35, 0.22], [0, 0.32, 0.33], 0.04)]
      },
      {
        name: 'tail',
        parent: 'body',
        at: [0, 0.3, -0.15],
        parts: W.sdfCapsule([0, 0.32, -0.2], [0, 0.4, -0.38], 0.05)
      },
      {
        name: 'frontLeg',
        parent: 'body',
        at: [0.05, 0.22, 0.1],
        parts: W.sdfCapsule([0.05, 0.2, 0.1], [0.06, 0.02, 0.12], 0.035),
        mirror: 'x'
      },
      {
        name: 'backLeg',
        parent: 'body',
        at: [0.05, 0.22, -0.1],
        parts: W.sdfCapsule([0.05, 0.2, -0.1], [0.06, 0.02, -0.08], 0.035),
        mirror: 'x'
      }
    ],
    { ...meshOptions, ...options }
  );
  const swing = 0.55,
    legs = (a, b) => [
      [0, [a, 0, 0]],
      [0.25, [b, 0, 0]],
      [0.5, [a, 0, 0]]
    ];
  const trot = made.clip('trot', 0.5, {
    'frontLeg.L': legs(swing, -swing),
    'backLeg.R': legs(swing, -swing),
    'frontLeg.R': legs(-swing, swing),
    'backLeg.L': legs(-swing, swing),
    tail: [
      [0, [0, 0.25, 0]],
      [0.25, [0, -0.25, 0]],
      [0.5, [0, 0.25, 0]]
    ],
    body: [
      [0, [0, 0, 0], [0, 0, 0]],
      [0.125, [0, 0, 0], [0, 0.015, 0]],
      [0.25, [0, 0, 0], [0, 0, 0]],
      [0.375, [0, 0, 0], [0, 0.015, 0]],
      [0.5, [0, 0, 0], [0, 0, 0]]
    ]
  });
  const idle = made.clip('idle', 3, {
    head: [
      [0, [0, 0, 0]],
      [1, [0, 0.5, 0.1]],
      [2, [0, -0.4, -0.1]],
      [3, [0, 0, 0]]
    ],
    tail: [
      [0, [0.2, 0.3, 0]],
      [1.5, [0.3, -0.3, 0]],
      [3, [0.2, 0.3, 0]]
    ]
  });
  return Object.assign(made, { clips: { trot, idle } });
}
