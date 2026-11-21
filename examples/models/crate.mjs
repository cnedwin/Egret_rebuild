// SPDX-License-Identifier: Apache-2.0
// A wooden crate, 0.8 m on a side. Parts: a rounded box with each face's panel sunk a little by subtracting thin boxes
// mirrored across all three axes, plank lines as stripes, and lighter worn edges from the mesh option `edges`.
export const about = { name: 'Crate', zh: '木箱', kind: 'prop' };
export const meshOptions = { sharp: true, triangles: 3000, edges: { amount: 0.6 } };

export default function crate(W) {
  const box = W.sdfBox([0.8, 0.8, 0.8], { at: [0, 0.4, 0], round: 0.03, color: 0xa8743f });
  const panel = (size, at) => W.sdfBox(size, { at, round: 0.01 });
  const sunk = W.sdfSubtract(
    box,
    [
      W.sdfMirror(panel([0.62, 0.62, 0.06], [0, 0.4, 0.42]), { axis: 'z' }),
      W.sdfMirror(panel([0.06, 0.62, 0.62], [0.42, 0.4, 0])),
      panel([0.62, 0.06, 0.62], [0, 0.82, 0])
    ],
    { smooth: 0.01 }
  );
  return W.sdfPattern(sunk, { kind: 'stripes', axis: 'y', color: 0x7a5230, frequency: 6, size: 0.1, amount: 0.7 });
}
