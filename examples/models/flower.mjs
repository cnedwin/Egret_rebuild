// SPDX-License-Identifier: Apache-2.0
// A flower, about 0.4 m tall. Parts: a thin stem as a capsule with a slight bend, two leaves as flattened eggs turned
// out from the stem, five petals as flattened eggs set round the centre by turning each one a fifth of a circle, and a
// ball for the centre. The petals are each their own shape in a union with a small `smooth`, so they stay separate.
export const about = { name: 'Flower', zh: '花', kind: 'plant' };
export const meshOptions = { triangles: 3000, resolution: 96 };

export default function flower(W) {
  const petal = 0xe85d8a,
    green = 0x4f9a3a;
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    petals.push(
      W.sdfEllipsoid([0.045, 0.012, 0.025], {
        at: [Math.cos(a) * 0.05, 0.37, Math.sin(a) * 0.05],
        rotation: [0, -a, 0.15],
        color: petal
      })
    );
  }
  return W.sdfUnion(
    [
      W.sdfCapsule([0, 0, 0], [0.01, 0.2, 0], 0.008, { color: green }),
      W.sdfCapsule([0.01, 0.2, 0], [0, 0.36, 0], 0.008, { color: green }),
      W.sdfEllipsoid([0.05, 0.008, 0.02], { at: [0.04, 0.12, 0], rotation: [0, 0, 0.5], color: green }),
      W.sdfEllipsoid([0.045, 0.008, 0.018], { at: [-0.035, 0.18, 0], rotation: [0, 0, -0.5], color: green }),
      ...petals,
      W.sdfSphere(0.025, { at: [0, 0.38, 0], color: 0xf2c230 })
    ],
    { smooth: 0.006 }
  );
}
