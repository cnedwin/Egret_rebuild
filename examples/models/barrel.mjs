// SPDX-License-Identifier: Apache-2.0
// A barrel, about 0.9 m tall. Parts: a body turned from a bulging profile with `sdfLathe`, its top hollowed a little by
// subtracting a short cylinder, two iron hoops as tori near each end, and staves as stripes painted round it. Worn
// edges from the mesh option `edges` catch the light on the hoops and the rim.
export const about = { name: 'Barrel', zh: '木桶', kind: 'prop' };
export const meshOptions = { triangles: 4000, edges: { amount: 0.4 } };
export const surface = { surface: 'wood', strength: 0.4 };

export default function barrel(W) {
  const wood = 0x9b6b3e;
  const body = W.sdfLathe(
    [
      [0, 0.015],
      [0.27, 0.015],
      [0.33, 0.2],
      [0.35, 0.45],
      [0.33, 0.7],
      [0.27, 0.9],
      [0, 0.9]
    ],
    { round: 0.015, color: wood }
  );
  const staves = W.sdfPattern(body, {
    kind: 'stripes',
    axis: 'x',
    color: 0x7a5230,
    frequency: 12,
    size: 0.12,
    amount: 0.8
  });
  const top = W.sdfSubtract(staves, W.sdfCylinder(0.24, 0.06, { at: [0, 0.9, 0], color: 0x6e4b2a }), { smooth: 0.01 });
  return W.sdfUnion(
    [
      top,
      W.sdfTorus(0.335, 0.018, { at: [0, 0.2, 0], color: 0x3d3b3a }),
      W.sdfTorus(0.335, 0.018, { at: [0, 0.7, 0], color: 0x3d3b3a })
    ],
    { smooth: 0.005 }
  );
}
