import type { Matrix2D } from '@egret/contracts';
import type { VisualState } from './displayVisualState.js';

/** Preserve capture's parent-times-local binary64 expression order exactly. */
export function composeDisplayTransform(p: Matrix2D, s: VisualState): Matrix2D {
  const angle = (s.rotation % 360) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const a = cos * s.scaleX;
  const b = sin * s.scaleX;
  const c = -sin * s.scaleY;
  const d = cos * s.scaleY;
  return {
    a: p.a * a + p.c * b,
    b: p.b * a + p.d * b,
    c: p.a * c + p.c * d,
    d: p.b * c + p.d * d,
    tx: p.a * s.x + p.c * s.y + p.tx,
    ty: p.b * s.x + p.d * s.y + p.ty,
  };
}
