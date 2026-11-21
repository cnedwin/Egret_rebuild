// SPDX-License-Identifier: Apache-2.0
// A knight in the same chunky style as the villager, about 1.15 m tall. Parts: a rounded box of a breastplate, a skirt
// of mail from a cone, legs and arms as capsules, shoulder plates as squashed balls, a round helmet with a slit visor
// cut through it and a plume from a curved run of capsules, and a sword held down at the side. A part as thin as a
// blade must be at least two cells of the grid thick (here 0.02 m of a 1.35 m model at 64 cells), or it vanishes. Metal
// parts get worn edges from the mesh option `edges`; the tabard is a red box with a gold band.
export const about = { name: 'Knight', zh: '骑士', kind: 'person' };
export const meshOptions = { triangles: 8000, edges: { amount: 0.3 }, variation: { amount: 0.03 } };

export default function knight(W) {
  const steel = 0x6f7884,
    dark = 0x4a4f57,
    cloth = 0xb23a3a,
    gold = 0xe0b43c;
  // The tabard is two plain boxes, red with a gold band: a pattern this fine on a part this small would blur. It ends
  // above the skirt: where one coloured part sinks into another, the line where it comes out is ragged.
  const tabard = W.sdfUnion([
    W.sdfBox([0.2, 0.22, 0.06], { at: [0, 0.6, 0.125], round: 0.02, color: cloth }),
    W.sdfBox([0.21, 0.04, 0.065], { at: [0, 0.66, 0.128], round: 0.01, color: gold })
  ]);
  const body = W.sdfUnion(
    [
      W.sdfBox([0.34, 0.3, 0.24], { at: [0, 0.62, 0], round: 0.08, color: steel }),
      W.sdfCone(0.22, 0.16, 0.22, { at: [0, 0.4, 0], color: dark }),
      W.sdfMirror(W.sdfCapsule([0.08, 0.32, 0], [0.09, 0.07, 0.01], 0.065, { radiusEnd: 0.055, color: steel })),
      W.sdfMirror(W.sdfEllipsoid([0.07, 0.055, 0.11], { at: [0.09, 0.05, 0.03], color: dark })),
      W.sdfMirror(W.sdfEllipsoid([0.1, 0.07, 0.1], { at: [0.2, 0.74, 0], color: steel })),
      W.sdfMirror(W.sdfCapsule([0.22, 0.7, 0], [0.26, 0.44, 0.03], 0.05, { radiusEnd: 0.045, color: steel })),
      W.sdfMirror(W.sdfSphere(0.05, { at: [0.27, 0.39, 0.04], color: dark }))
    ],
    { smooth: 0.025 }
  );
  const helmet = W.sdfSubtract(
    W.sdfUnion(
      [
        W.sdfSphere(0.2, { at: [0, 0.97, 0], color: steel }),
        W.sdfCylinder(0.19, 0.12, { at: [0, 0.88, 0], round: 0.04, color: steel })
      ],
      { smooth: 0.03 }
    ),
    W.sdfBox([0.22, 0.03, 0.2], { at: [0, 0.96, 0.17], round: 0.01, color: 0x111111 }),
    { smooth: 0.005 }
  );
  const plume = W.sdfUnion(
    [
      W.sdfCapsule([0, 1.16, 0.02], [0, 1.24, -0.06], 0.035, { color: cloth }),
      W.sdfCapsule([0, 1.24, -0.06], [0, 1.2, -0.18], 0.03, { radiusEnd: 0.02, color: cloth })
    ],
    { smooth: 0.02 }
  );
  const sword = W.sdfUnion([
    W.sdfBox([0.045, 0.34, 0.02], { at: [0.3, 0.2, 0.09], round: 0.008, color: 0xd9dee4 }),
    W.sdfBox([0.14, 0.03, 0.04], { at: [0.3, 0.38, 0.09], round: 0.01, color: gold }),
    W.sdfCylinder(0.018, 0.08, { at: [0.3, 0.43, 0.09], color: 0x3b2a20 })
  ]);
  // The tabard and the sword join with a small smooth, so their colours stay their own.
  return W.sdfUnion([W.sdfUnion([body, helmet, plume], { smooth: 0.02 }), tabard, sword], { smooth: 0.005 });
}
