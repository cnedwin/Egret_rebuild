// SPDX-License-Identifier: Apache-2.0
// A treasure chest, about 0.6 m wide. Parts: a box for the body, a lid from half a cylinder lying along x (cut by a
// box), iron bands as thin rounded boxes over both, and a gold lock plate with a keyhole cut in it.
export const about = { name: 'Chest', zh: '宝箱', kind: 'prop' };
export const meshOptions = { triangles: 4000, edges: { amount: 0.5 } };

export default function chest(W) {
  const wood = 0x8a5a32,
    iron = 0x3d3b3a,
    gold = 0xe0b43c;
  const lid = W.sdfIntersect([
    W.sdfCylinder(0.2, 0.6, { at: [0, 0.3, 0], rotation: [0, 0, Math.PI / 2], color: wood }),
    W.sdfBox([0.7, 0.3, 0.5], { at: [0, 0.45, 0] })
  ]);
  const bands = [-0.22, 0.22].map(x =>
    W.sdfIntersect([
      W.sdfUnion([
        W.sdfCylinder(0.215, 0.05, { at: [x, 0.3, 0], rotation: [0, 0, Math.PI / 2], color: iron }),
        W.sdfBox([0.05, 0.31, 0.43], { at: [x, 0.155, 0], color: iron })
      ]),
      W.sdfBox([0.1, 0.6, 0.5], { at: [x, 0.25, 0] })
    ])
  );
  const lock = W.sdfSubtract(
    W.sdfBox([0.1, 0.12, 0.03], { at: [0, 0.3, 0.205], round: 0.01, color: gold }),
    W.sdfCylinder(0.012, 0.1, { at: [0, 0.3, 0.22], rotation: [Math.PI / 2, 0, 0], color: 0x111111 })
  );
  return W.sdfUnion([W.sdfBox([0.6, 0.3, 0.4], { at: [0, 0.15, 0], round: 0.02, color: wood }), lid, ...bands, lock], {
    smooth: 0.005
  });
}
