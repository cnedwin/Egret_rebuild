// SPDX-License-Identifier: Apache-2.0
// A cactus in a pot, about 0.6 m tall. Parts: a pot turned from a profile with a rim, hollowed with `sdfShell` and
// filled with a disc of soil; a main stem and two arms from capsules, each arm an elbow of two capsules; ribs from
// stripes painted round the stem; and a pink flower on top as a few small balls.
export const about = { name: 'Cactus', zh: '仙人掌', kind: 'plant' };
export const meshOptions = { triangles: 5000 };

export default function cactus(W) {
  const green = 0x4f9a52;
  const pot = W.sdfUnion([
    W.sdfLathe(
      [
        [0, 0],
        [0.11, 0],
        [0.13, 0.15],
        [0.15, 0.15],
        [0.15, 0.19],
        [0, 0.19]
      ],
      { round: 0.01, color: 0xc0623a }
    ),
    W.sdfCylinder(0.12, 0.02, { at: [0, 0.19, 0], color: 0x4a3324 })
  ]);
  const plant = W.sdfPattern(
    W.sdfUnion(
      [
        W.sdfCapsule([0, 0.18, 0], [0, 0.52, 0], 0.06, { color: green }),
        W.sdfCapsule([0.04, 0.32, 0], [0.12, 0.34, 0], 0.035, { color: green }),
        W.sdfCapsule([0.12, 0.34, 0], [0.13, 0.44, 0], 0.035, { color: green }),
        W.sdfCapsule([-0.04, 0.27, 0], [-0.11, 0.29, 0.02], 0.03, { color: green }),
        W.sdfCapsule([-0.11, 0.29, 0.02], [-0.11, 0.37, 0.02], 0.03, { color: green })
      ],
      { smooth: 0.03 }
    ),
    { kind: 'stripes', axis: 'x', color: 0x2f6b36, frequency: 40, size: 0.25, amount: 0.7 }
  );
  const bloom = W.sdfUnion(
    [0, 1, 2, 3, 4].map(i =>
      W.sdfSphere(0.018, { at: [Math.cos(i * 1.257) * 0.02, 0.585, Math.sin(i * 1.257) * 0.02], color: 0xf06aa0 })
    ),
    { smooth: 0.01 }
  );
  return W.sdfUnion([pot, plant, bloom], { smooth: 0.008 });
}
