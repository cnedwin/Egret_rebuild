// SPDX-License-Identifier: Apache-2.0
// A fish, about 0.3 m long, facing +z, its belly at y = 0. Parts: a long, flattened egg, a tail fin from a flat
// extruded fan turned to stand upright, a dorsal fin from a thin extrusion on the back, small side fins as flat eggs,
// and a mouth cut with a dark colour. Blue back, silver belly from a gradient, and spots along the flank.
export const about = { name: 'Fish', zh: '鱼', kind: 'animal' };
export const meshOptions = { triangles: 3500, variation: { amount: 0.04 } };

export default function fish(W) {
  const blue = 0x2f6fae,
    silver = 0xe3e9ee;
  // Outlines are drawn in the xy plane and stood up by turning them a quarter about y, so they lie in the zy plane.
  const tailFin = W.sdfExtrude(
    [
      [0, 0],
      [-0.08, 0.06],
      [-0.07, 0],
      [-0.08, -0.06]
    ],
    0.008,
    { at: [0, 0.06, -0.12], rotation: [0, -Math.PI / 2, 0], round: 0.003, color: blue }
  );
  const back = W.sdfExtrude(
    [
      [-0.05, 0],
      [0.03, 0],
      [-0.03, 0.045]
    ],
    0.006,
    { at: [0, 0.095, -0.01], rotation: [0, -Math.PI / 2, 0], round: 0.002, color: blue }
  );
  const body = W.sdfUnion(
    [
      W.sdfEllipsoid([0.035, 0.05, 0.13], { at: [0, 0.06, 0], color: blue }),
      tailFin,
      back,
      W.sdfMirror(
        W.sdfEllipsoid([0.004, 0.012, 0.025], { at: [0.035, 0.04, 0.04], rotation: [0.6, 0, 0.5], color: blue })
      )
    ],
    { smooth: 0.012 }
  );
  const belly = W.sdfPattern(body, { kind: 'gradient', axis: 'y', color: silver, from: 0.065, to: 0.035 });
  const spots = W.sdfPattern(belly, { kind: 'spots', color: 0x1c3f66, frequency: 30, size: 0.5, seed: 5, amount: 0.8 });
  const mouth = W.sdfSubtract(spots, W.sdfEllipsoid([0.015, 0.006, 0.02], { at: [0, 0.055, 0.13], color: 0x30161a }), {
    smooth: 0.004
  });
  return W.sdfUnion([mouth, W.sdfMirror(W.sdfSphere(0.008, { at: [0.022, 0.07, 0.095], color: 0x0d0d0d }))], {
    smooth: 0.002
  });
}
