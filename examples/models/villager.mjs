// SPDX-License-Identifier: Apache-2.0
// A villager in a chunky, toy-like style, about 1.1 m tall: a big head (a third of the height) reads well from a game
// camera. Parts: a bell-shaped tunic from a cone with rounded rims, a belt from a torus, short legs ending in boot
// eggs, arms as tapered capsules hanging a little away from the body with ball hands, a ball head, hair as a cap of an
// ellipsoid with the face cut away, and a nose. Each limb is joined to the body with a small `smooth`, so the joins are
// soft but the arms do not melt into the sides. Eyes and mouth are their own crisp group.
export const about = { name: 'Villager', zh: '村民', kind: 'person' };
export const meshOptions = { triangles: 7000, variation: { amount: 0.04 } };

export default function villager(W) {
  const skin = 0xf1c7a1,
    tunic = 0x4f8a5b,
    trousers = 0x6b4f3a,
    boots = 0x3b2a20,
    hair = 0x5a3a22;
  const body = W.sdfUnion(
    [
      W.sdfCone(0.24, 0.15, 0.42, { at: [0, 0.5, 0], color: tunic }),
      W.sdfTorus(0.2, 0.025, { at: [0, 0.38, 0], color: 0x3b2a20 }),
      W.sdfEllipsoid([0.16, 0.06, 0.13], { at: [0, 0.71, 0], color: tunic }),
      W.sdfMirror(W.sdfCapsule([0.08, 0.3, 0], [0.09, 0.08, 0.01], 0.06, { radiusEnd: 0.05, color: trousers })),
      W.sdfMirror(W.sdfEllipsoid([0.065, 0.05, 0.1], { at: [0.09, 0.05, 0.03], color: boots })),
      W.sdfMirror(W.sdfCapsule([0.19, 0.68, 0], [0.25, 0.42, 0.03], 0.045, { radiusEnd: 0.038, color: tunic })),
      W.sdfMirror(W.sdfSphere(0.045, { at: [0.26, 0.37, 0.04], color: skin }))
    ],
    { smooth: 0.03 }
  );
  const head = W.sdfUnion(
    [
      W.sdfSphere(0.2, { at: [0, 0.93, 0], color: skin }),
      W.sdfSubtract(
        W.sdfEllipsoid([0.215, 0.18, 0.215], { at: [0, 1.0, -0.01], color: hair }),
        W.sdfBox([0.5, 0.2, 0.3], { at: [0, 0.9, 0.2], rotation: [-0.35, 0, 0] }),
        { smooth: 0.02 }
      ),
      W.sdfSphere(0.03, { at: [0, 0.91, 0.2], color: skin }),
      W.sdfMirror(W.sdfSphere(0.035, { at: [0.2, 0.92, 0], color: skin }))
    ],
    { smooth: 0.02 }
  );
  return W.sdfUnion(
    [
      W.sdfUnion([body, head], { smooth: 0.04 }),
      W.sdfMirror(W.sdfEllipsoid([0.022, 0.03, 0.012], { at: [0.07, 0.95, 0.185], color: 0x1d1410 })),
      W.sdfEllipsoid([0.04, 0.008, 0.012], { at: [0, 0.85, 0.19], color: 0x8a3b30 })
    ],
    { smooth: 0.004 }
  );
}
