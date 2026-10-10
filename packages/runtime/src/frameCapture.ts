import type { Matrix2D, Rectangle2D, RectangleCommand2D, ClipRectangle2D, RenderCommand2D, ImageData2D } from "@egret/contracts";
import type { Stage } from "./Stage.js";
import type { DisplayObject } from "./DisplayObject.js";
import { childrenOf, isStageRoot } from "./displayTreeState.js";
import { visualOf, finite } from "./displayVisualState.js";
import { EgretError } from "./EgretError.js";
import { bitmapCaptureState, readBitmapImage } from "./Bitmap.js";
import { engineOf } from "./ownership.js";
import { CaptureImageBudget } from "./imageFrameBudget.js";
import { composeDisplayTransform } from './displayTransform.js';

export interface CapturedContent2D {
  readonly commands: readonly RenderCommand2D[];
  readonly images?: readonly ImageData2D[];
}

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

/** Both ports share one painter traversal and the unchanged rectangle arithmetic. */
function capture(stage: Stage, mode: "content" | "rectangles"): CapturedContent2D {
  const commands: RenderCommand2D[] = [];
  const budget = mode === "content" ? new CaptureImageBudget() : undefined;
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
    const matrix = checked(composeDisplayTransform(entry.matrix, s));
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
    const bitmap = bitmapCaptureState(entry.node);
    if (bitmap !== undefined) {
      // Cached geometry is checked before effective-alpha suppression or lease
      // resolution. A cleared slot needs neither geometry nor entitlement.
      const rect = geometry(matrix, { x: 0, y: 0, width: bitmap.width, height: bitmap.height });
      if (alpha !== 0) {
        const snapshot = readBitmapImage(bitmap.lease);
        if (mode === "rectangles") throw new EgretError("FRAME_IMAGE_UNSUPPORTED");
        const sourceRect = Object.freeze({ ...bitmap.sourceRect });
        const imageIndex = budget!.register(snapshot.image, sourceRect);
        commands.push(Object.freeze({ kind: "image", matrix, rect, alpha, clips, imageIndex, sourceRect }));
      }
    }
    const children = childrenOf(entry.node);
    for (let i = children.length - 1; i >= 0; i--) {
      pending.push({ node: children[i]!, matrix, alpha, clips });
    }
  }
  const images = budget?.finish();
  return Object.freeze({ commands: Object.freeze(commands), ...(images === undefined ? {} : { images }) });
}

/** New content port authenticates the root and brackets traversal with openness. */
export function collectFrameContent(stage: Stage): CapturedContent2D {
  if (!isStageRoot(stage)) throw new EgretError("FRAME_STAGE_INVALID");
  const engine = engineOf(stage)!;
  engine.assertOpen();
  const content = capture(stage, "content");
  engine.assertOpen();
  return content;
}

/** Legacy input behavior is retained; its mode rejects every emitted image. */
export function collectFrameCommands(stage: Stage): readonly RectangleCommand2D[] {
  // The shared traversal throws before appending an image in rectangles mode.
  return capture(stage, "rectangles").commands as readonly RectangleCommand2D[];
}
