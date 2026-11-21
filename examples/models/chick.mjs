// SPDX-License-Identifier: Apache-2.0
// A chick, about 0.12 m tall. Parts: one egg for the whole body and head (a chick has no neck), small wing eggs on the
// sides, a cone beak, thin legs with three-toed feet from capsules, and a tuft of three tiny capsules on top. Yellow,
// orange beak and feet, black eyes.
export const about = { name: 'Chick', zh: '小鸡', kind: 'animal' };
export const meshOptions = { triangles: 3000, variation: { amount: 0.04 } };

export default function chick(W) {
  const yellow = 0xffd23f,
    orange = 0xf28c28;
  const foot = x =>
    W.sdfUnion([
      W.sdfCapsule([x, 0.03, 0], [x, 0.004, 0.004], 0.004, { color: orange }),
      W.sdfCapsule([x, 0.004, 0.004], [x, 0.004, 0.022], 0.003, { color: orange }),
      W.sdfCapsule([x, 0.004, 0.004], [x + 0.012, 0.004, 0.018], 0.003, { color: orange }),
      W.sdfCapsule([x, 0.004, 0.004], [x - 0.012, 0.004, 0.018], 0.003, { color: orange })
    ]);
  const body = W.sdfUnion(
    [
      W.sdfEllipsoid([0.04, 0.045, 0.042], { at: [0, 0.07, 0], color: yellow }),
      W.sdfMirror(
        W.sdfEllipsoid([0.008, 0.022, 0.026], { at: [0.04, 0.065, -0.005], rotation: [0, 0, 0.3], color: yellow })
      ),
      W.sdfCapsule([0, 0.112, 0], [0, 0.125, 0.008], 0.003, { color: yellow }),
      W.sdfCapsule([0, 0.112, 0], [0.006, 0.122, -0.004], 0.003, { color: yellow })
    ],
    { smooth: 0.01 }
  );
  return W.sdfUnion(
    [
      body,
      W.sdfMirror(foot(0.015)),
      W.sdfCone(0.009, 0.001, 0.018, { at: [0, 0.083, 0.047], rotation: [Math.PI / 2, 0, 0], color: orange }),
      W.sdfMirror(W.sdfSphere(0.006, { at: [0.017, 0.093, 0.036], color: 0x111111 }))
    ],
    { smooth: 0.002 }
  );
}
