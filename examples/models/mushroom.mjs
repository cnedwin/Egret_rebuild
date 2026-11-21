// SPDX-License-Identifier: Apache-2.0
// A toadstool, about 0.35 m tall. Parts: a stalk turned from a profile with `sdfLathe` (wider at the foot, a ring
// part-way up), and a cap from an ellipsoid with its underside cut away by a box and the cut rounded, painted with
// white spots. The underside of the cap is cream: the cutting box has a colour, which paints the faces it leaves.
export const about = { name: 'Mushroom', zh: '蘑菇', kind: 'plant' };
export const meshOptions = { triangles: 3500 };

export default function mushroom(W) {
  const stalk = W.sdfLathe(
    [
      [0, 0],
      [0.06, 0],
      [0.045, 0.06],
      [0.04, 0.16],
      [0.055, 0.17],
      [0.04, 0.18],
      [0.035, 0.26],
      [0, 0.26]
    ],
    { round: 0.008, color: 0xf3ead8 }
  );
  const cap = W.sdfPattern(
    W.sdfSubtract(
      W.sdfEllipsoid([0.17, 0.11, 0.17], { at: [0, 0.24, 0], color: 0xd23a2c }),
      W.sdfBox([0.5, 0.2, 0.5], { at: [0, 0.16, 0], color: 0xf0e2c4 }),
      { smooth: 0.02 }
    ),
    { kind: 'spots', color: 0xffffff, frequency: 11, size: 0.6, seed: 1 }
  );
  return W.sdfUnion([stalk, cap], { smooth: 0.015 });
}
