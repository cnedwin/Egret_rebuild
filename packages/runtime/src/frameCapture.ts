import type { Matrix2D, Rectangle2D, RectangleCommand2D, ClipRectangle2D } from "@egret/contracts";
import type { Stage } from "./Stage.js";
import type { DisplayObject } from "./DisplayObject.js";
import { childrenOf } from "./displayTreeState.js";
import { visualOf, finite } from "./displayVisualState.js";
import { EgretError } from "./EgretError.js";

function checked(matrix: Matrix2D): Matrix2D {
  if (!Object.values(matrix).every(finite)) throw new EgretError("FRAME_TRANSFORM_INVALID");
  return Object.freeze(matrix);
}

function geometry(matrix: Matrix2D, rect: Rectangle2D): Rectangle2D {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  if (!finite(right) || !finite(bottom)) throw new EgretError("FRAME_TRANSFORM_INVALID");
  for (const x of [rect.x, right]) {
    for (const y of [rect.y, bottom]) {
      if (!finite(matrix.a * x + matrix.c * y + matrix.tx)
        || !finite(matrix.b * x + matrix.d * y + matrix.ty)) {
        throw new EgretError("FRAME_TRANSFORM_INVALID");
      }
    }
  }
  return Object.freeze({ ...rect });
}

/** Iterative painter traversal reads only internal authority, never public hooks. */
export function collectFrameCommands(stage: Stage): readonly RectangleCommand2D[] {
  const commands: RectangleCommand2D[] = [];
  const pending: {
    node: DisplayObject;
    matrix: Matrix2D;
    alpha: number;
    clips: readonly ClipRectangle2D[];
  }[] = [{
    node: stage,
    matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    alpha: 1,
    clips: Object.freeze([]),
  }];

  while (pending.length) {
    const entry = pending.pop()!;
    const s = visualOf(entry.node);
    if (!s.visible || s.alpha === 0) continue;
    const angle = (s.rotation % 360) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const p = entry.matrix;
    const a = cos * s.scaleX;
    const b = sin * s.scaleX;
    const c = -sin * s.scaleY;
    const d = cos * s.scaleY;
    const matrix = checked({
      a: p.a * a + p.c * b,
      b: p.b * a + p.d * b,
      c: p.a * c + p.c * d,
      d: p.b * c + p.d * d,
      tx: p.a * s.x + p.c * s.y + p.tx,
      ty: p.b * s.x + p.d * s.y + p.ty,
    });
    const alpha = entry.alpha * s.alpha;
    const clips = s.clipRect === undefined ? entry.clips : Object.freeze([
      ...entry.clips,
      Object.freeze({ matrix, rect: geometry(matrix, s.clipRect) }),
    ]);
    if (clips.some(clip => clip.rect.width === 0 || clip.rect.height === 0)) continue;
    for (const primitive of s.primitives) {
      const rect = geometry(matrix, primitive.rect);
      const effective = alpha * primitive.alpha;
      if (rect.width === 0 || rect.height === 0 || effective === 0) continue;
      commands.push(Object.freeze({
        kind: "rect", matrix, rect, color: primitive.color, alpha: effective, clips,
      }));
    }
    const children = childrenOf(entry.node);
    for (let i = children.length - 1; i >= 0; i--) {
      pending.push({ node: children[i]!, matrix, alpha, clips });
    }
  }
  return Object.freeze(commands);
}
