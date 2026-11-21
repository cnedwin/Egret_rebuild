// SPDX-License-Identifier: Apache-2.0
// A villager in a chunky, toy-like style, about 1.1 m tall: a big head (a third of the height) reads well from a game
// camera. Parts: a bell-shaped tunic from a cone with rounded rims, a belt from a torus, short legs ending in boot
// eggs, arms as tapered capsules hanging a little away from the body with ball hands, a ball head, hair as a cap of an
// ellipsoid with the face cut away, and a nose. Each limb is joined to the body with a small `smooth`, so the joins are
// soft but the arms do not melt into the sides. Eyes and mouth are their own crisp group. The parts are made once by
// `parts`, so the model and its rig use the same shapes: `rig` gives the bones that move them and a walk and an idle.
export const about = { name: 'Villager', zh: '村民', kind: 'person' };
export const meshOptions = { triangles: 7000, variation: { amount: 0.04 } };

/** The villager's parts, for the model and for the bones of its rig. One leg and one arm: the +x side. */
function parts(W) {
  const skin = 0xf1c7a1,
    tunic = 0x4f8a5b,
    trousers = 0x6b4f3a,
    boots = 0x3b2a20,
    hair = 0x5a3a22;
  const torso = W.sdfUnion(
    [
      W.sdfCone(0.24, 0.15, 0.42, { at: [0, 0.5, 0], color: tunic }),
      W.sdfTorus(0.2, 0.025, { at: [0, 0.38, 0], color: 0x3b2a20 }),
      W.sdfEllipsoid([0.16, 0.06, 0.13], { at: [0, 0.71, 0], color: tunic })
    ],
    { smooth: 0.03 }
  );
  const leg = W.sdfUnion(
    [
      W.sdfCapsule([0.08, 0.3, 0], [0.09, 0.08, 0.01], 0.06, { radiusEnd: 0.05, color: trousers }),
      W.sdfEllipsoid([0.065, 0.05, 0.1], { at: [0.09, 0.05, 0.03], color: boots })
    ],
    { smooth: 0.03 }
  );
  const arm = W.sdfUnion(
    [
      W.sdfCapsule([0.19, 0.68, 0], [0.25, 0.42, 0.03], 0.045, { radiusEnd: 0.038, color: tunic }),
      W.sdfSphere(0.045, { at: [0.26, 0.37, 0.04], color: skin })
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
  const face = W.sdfUnion([
    W.sdfMirror(W.sdfEllipsoid([0.022, 0.03, 0.012], { at: [0.07, 0.95, 0.185], color: 0x1d1410 })),
    W.sdfEllipsoid([0.04, 0.008, 0.012], { at: [0, 0.85, 0.19], color: 0x8a3b30 })
  ]);
  return { torso, leg, arm, head, face };
}

export default function villager(W) {
  const { torso, leg, arm, head, face } = parts(W);
  const body = W.sdfUnion([torso, W.sdfMirror(leg), W.sdfMirror(arm)], { smooth: 0.03 });
  return W.sdfUnion([W.sdfUnion([body, head], { smooth: 0.04 }), face], { smooth: 0.004 });
}

/**
 * The villager's rig: a body bone at the hips carrying a head and a pair each of legs and arms, made with
 * `createSdfRig3D`, and a walk and an idle. `rig.play(rig.clips.walk)`, then `rig.update(seconds)` each frame.
 */
export function rig(W, options = {}) {
  const { torso, leg, arm, head, face } = parts(W);
  const made = W.createSdfRig3D(
    villager(W),
    [
      { name: 'body', at: [0, 0.34, 0], parts: torso },
      { name: 'head', parent: 'body', at: [0, 0.74, 0], parts: [head, face] },
      { name: 'leg', parent: 'body', at: [0.08, 0.3, 0], parts: leg, mirror: 'x' },
      { name: 'arm', parent: 'body', at: [0.19, 0.68, 0], parts: arm, mirror: 'x' }
    ],
    { ...meshOptions, ...options }
  );
  const step = 0.5;
  const walk = made.clip('walk', 0.8, {
    'leg.L': [
      [0, [step, 0, 0]],
      [0.4, [-step, 0, 0]],
      [0.8, [step, 0, 0]]
    ],
    'leg.R': [
      [0, [-step, 0, 0]],
      [0.4, [step, 0, 0]],
      [0.8, [-step, 0, 0]]
    ],
    'arm.L': [
      [0, [-0.45, 0, 0]],
      [0.4, [0.45, 0, 0]],
      [0.8, [-0.45, 0, 0]]
    ],
    'arm.R': [
      [0, [0.45, 0, 0]],
      [0.4, [-0.45, 0, 0]],
      [0.8, [0.45, 0, 0]]
    ],
    body: [
      [0, [0, 0, 0.04], [0, 0, 0]],
      [0.2, [0, 0, 0], [0, 0.025, 0]],
      [0.4, [0, 0, -0.04], [0, 0, 0]],
      [0.6, [0, 0, 0], [0, 0.025, 0]],
      [0.8, [0, 0, 0.04], [0, 0, 0]]
    ]
  });
  const idle = made.clip('idle', 2.4, {
    head: [
      [0, [0, 0, 0]],
      [1.2, [0.06, 0.15, 0]],
      [2.4, [0, 0, 0]]
    ],
    'arm.L': [
      [0, [0, 0, 0.05]],
      [1.2, [0, 0, 0.1]],
      [2.4, [0, 0, 0.05]]
    ],
    'arm.R': [
      [0, [0, 0, -0.05]],
      [1.2, [0, 0, -0.1]],
      [2.4, [0, 0, -0.05]]
    ]
  });
  return Object.assign(made, { clips: { walk, idle } });
}
