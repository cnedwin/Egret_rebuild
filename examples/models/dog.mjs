// SPDX-License-Identifier: Apache-2.0
// A Shiba-like dog standing, about 0.4 m tall. Parts: a long egg of a body, a deep chest, a head with a short boxy
// snout, upright cone ears, four legs, and a tail curled up over the back from a torus cut in half, its front end set
// into the body so it is joined, not floating. Tan above, cream below from a gradient painted on the torso alone, cream
// cheeks and snout, and a black nose and eyes in their own group.
export const about = { name: 'Dog', zh: '狗', kind: 'animal' };
export const meshOptions = { triangles: 5000, variation: { amount: 0.04 } };

export default function dog(W) {
  const tan = 0xc9823d,
    cream = 0xf3e4cc;
  const tail = W.sdfIntersect([
    W.sdfTorus(0.05, 0.022, { at: [0, 0.3, -0.14], rotation: [0, Math.PI / 2, Math.PI / 2], color: tan }),
    W.sdfBox([0.2, 0.2, 0.2], { at: [0, 0.4, -0.14] })
  ]);
  const torso = W.sdfUnion(
    [
      W.sdfEllipsoid([0.08, 0.085, 0.17], { at: [0, 0.25, 0], color: tan }),
      W.sdfEllipsoid([0.075, 0.09, 0.07], { at: [0, 0.25, 0.11], color: tan }),
      W.sdfSphere(0.075, { at: [0, 0.37, 0.17], color: tan }),
      W.sdfBox([0.06, 0.05, 0.07], { at: [0, 0.345, 0.25], round: 0.022, color: cream }),
      W.sdfMirror(W.sdfCone(0.03, 0.004, 0.06, { at: [0.042, 0.45, 0.15], rotation: [-0.1, 0, -0.2], color: tan }))
    ],
    { smooth: 0.025 }
  );
  // The cream underside is painted on the torso before the legs join, so the legs keep their tan.
  const under = W.sdfUnion(
    [
      W.sdfPattern(torso, { kind: 'gradient', axis: 'y', color: cream, from: 0.24, to: 0.18, amount: 0.9 }),
      W.sdfMirror(W.sdfCapsule([0.045, 0.2, 0.11], [0.045, 0.02, 0.12], 0.024, { radiusEnd: 0.02, color: tan })),
      W.sdfMirror(W.sdfCapsule([0.045, 0.2, -0.11], [0.045, 0.02, -0.12], 0.026, { radiusEnd: 0.02, color: tan })),
      tail
    ],
    { smooth: 0.025 }
  );
  return W.sdfUnion(
    [
      under,
      W.sdfSphere(0.014, { at: [0, 0.36, 0.285], color: 0x151515 }),
      W.sdfMirror(W.sdfSphere(0.012, { at: [0.035, 0.395, 0.23], color: 0x151515 }))
    ],
    { smooth: 0.004 }
  );
}
