// SPDX-License-Identifier: Apache-2.0
// A village well, about 2.2 m tall. Parts: a ring wall from a cylinder hollowed with `sdfShell` (a shell reaches half
// its thickness beyond the shape, so the cylinder is raised by that much to stand on the ground) and cut open at the
// top, stones from spots painted on it, dark water inside as a disc, two posts as rounded boxes, a small gabled roof
// from a turned box cut below its eaves, a windlass beam as a capsule, and a bucket turned with `sdfLathe` hanging from
// a rope. Every part touches the next (the water fills the well up to its surface, so no sealed hollow is left inside,
// the posts the roof, the rope the bucket and the beam): the model preview reports a part that floats loose as a
// separate piece.
export const about = { name: 'Well', zh: '水井', kind: 'building' };
export const meshOptions = {
  triangles: 7000,
  resolution: 96,
  edges: { amount: 0.3 },
  variation: { amount: 0.08, frequency: 3 }
};

export default function well(W) {
  const stone = 0x9a958a,
    wood = 0x6b4a2b;
  const ring = W.sdfSubtract(
    W.sdfShell(W.sdfCylinder(0.6, 0.8, { at: [0, 0.5, 0], round: 0.05 }), 0.2, { color: stone }),
    W.sdfCylinder(0.8, 0.3, { at: [0, 0.92, 0] })
  );
  const stones = W.sdfPattern(ring, { kind: 'spots', color: 0x77736a, frequency: 7, size: 0.8, seed: 3, amount: 0.8 });
  const roof = W.sdfSubtract(
    W.sdfBox([0.9, 0.9, 1.6], { at: [0, 1.85, 0], rotation: [0, 0, Math.PI / 4], round: 0.03, color: 0x8a3b2a }),
    W.sdfBox([2, 1, 2], { at: [0, 1.4, 0] })
  );
  const bucket = W.sdfLathe(
    [
      [0, 0],
      [0.09, 0],
      [0.11, 0.18],
      [0, 0.18]
    ],
    { at: [0.2, 1.05, 0], round: 0.01, color: wood }
  );
  return W.sdfUnion(
    [
      stones,
      W.sdfCylinder(0.55, 0.56, { at: [0, 0.38, 0], color: 0x1f3a4a }),
      W.sdfMirror(W.sdfBox([0.12, 1.7, 0.12], { at: [0.6, 1.2, 0], round: 0.02, color: wood })),
      W.sdfCapsule([-0.6, 1.5, 0], [0.6, 1.5, 0], 0.05, { color: wood }),
      W.sdfCapsule([0.2, 1.5, 0], [0.2, 1.2, 0], 0.03, { color: 0x3b2a20 }),
      bucket,
      roof
    ],
    { smooth: 0.02 }
  );
}
