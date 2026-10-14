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
  // Keep the original zero-pivot expressions, including signed-zero behavior.
  if (s.anchorOffsetX === 0 && s.anchorOffsetY === 0) return {
    a: p.a * a + p.c * b,
    b: p.b * a + p.d * b,
    c: p.a * c + p.c * d,
    d: p.b * c + p.d * d,
    tx: p.a * s.x + p.c * s.y + p.tx,
    ty: p.b * s.x + p.d * s.y + p.ty,
  };
  // Subtract the transformed local pivot before composing with the parent.
  const localX = s.x - a * s.anchorOffsetX - c * s.anchorOffsetY;
  const localY = s.y - b * s.anchorOffsetX - d * s.anchorOffsetY;
  return {
    a: p.a * a + p.c * b,
    b: p.b * a + p.d * b,
    c: p.a * c + p.c * d,
    d: p.b * c + p.d * d,
    tx: p.a * localX + p.c * localY + p.tx,
    ty: p.b * localX + p.d * localY + p.ty,
  };
}
