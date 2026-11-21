// SPDX-License-Identifier: Apache-2.0
// A paper lantern of the kind hung at a Chinese inn, about 0.5 m tall with its cord. Parts: a body turned from a
// rounded profile with `sdfLathe`, dark caps top and bottom as short cylinders, a tassel of a cone and a cord as a
// capsule. Ribs are stripes across y; the colour is a gradient, lighter at the middle where the light would show. Give
// the mesh a material with `glow` or an emissive colour in a game to make it shine.
export const about = { name: 'Lantern', zh: '灯笼', kind: 'prop' };
export const meshOptions = { triangles: 3500 };

export default function lantern(W) {
  const red = 0xc8282d;
  const body = W.sdfLathe(
    [
      [0, 0.1],
      [0.1, 0.1],
      [0.17, 0.18],
      [0.19, 0.25],
      [0.17, 0.32],
      [0.1, 0.4],
      [0, 0.4]
    ],
    { round: 0.01, color: red }
  );
  const ribs = W.sdfPattern(body, {
    kind: 'stripes',
    axis: 'y',
    color: 0x8a1418,
    frequency: 30,
    size: 0.15,
    amount: 0.7
  });
  return W.sdfUnion(
    [
      ribs,
      W.sdfCylinder(0.09, 0.04, { at: [0, 0.405, 0], round: 0.01, color: 0x2a1c14 }),
      W.sdfCylinder(0.09, 0.04, { at: [0, 0.095, 0], round: 0.01, color: 0x2a1c14 }),
      W.sdfCone(0.035, 0.01, 0.08, { at: [0, 0.035, 0], color: 0xe0b43c }),
      W.sdfCapsule([0, 0.42, 0], [0, 0.5, 0], 0.006, { color: 0x2a1c14 })
    ],
    { smooth: 0.008 }
  );
}
