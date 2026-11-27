import type { Matrix2D, Point2D, Rectangle2D } from '@egret/contracts';
import type { DisplayObject } from './DisplayObject.js';
import type { Stage } from './Stage.js';
import { EgretError } from './EgretError.js';
import { invertCoordinatePoint } from './coordinateInverse.js';
import { readDisplayHitState } from './displayHitState.js';
import { composeDisplayTransform } from './displayTransform.js';
import { assertLive, childAtOf, childCountOf, isDisplayNode, isStageRoot, parentOf } from './displayTreeState.js';
import { finite, visualOf } from './displayVisualState.js';
import { engineOf } from './ownership.js';
import type { EngineContext } from './ownership.js';
import { readBitmapState } from './bitmapDisplayState.js';
import { resolveShape } from './graphicsShape.js';

/** Receiver-inclusive whole-tree admission precedes all hit arithmetic. */
export interface HitTestOptions {
  readonly maxNodes?: number;
}

function live(node: DisplayObject, engine: EngineContext): void {
  assertLive(node);
  engine.assertOpen();
}

function budgetOf(root: Stage, engine: EngineContext, source: unknown): number {
  let requested: unknown;
  if (source !== undefined) {
    if (source === null || typeof source !== 'object') throw new EgretError('HIT_TEST_INPUT_INVALID');
    let array: boolean;
    try {
      array = Array.isArray(source);
    } catch (cause) {
      throw new EgretError('HIT_TEST_INPUT_INVALID', { cause });
    }
    if (array) throw new EgretError('HIT_TEST_INPUT_INVALID');
    try {
      requested = (source as HitTestOptions).maxNodes;
    } catch (cause) {
      throw new EgretError('HIT_TEST_INPUT_INVALID', { cause });
    }
  }
  live(root, engine);
  const maximum = requested === undefined ? 4096 : requested;
  if (!finite(maximum) || !Number.isInteger(maximum) || maximum < 1 || maximum > 65536) {
    throw new EgretError('HIT_TEST_INPUT_INVALID');
  }
  return maximum;
}

interface StructuralCursor {
  readonly node: DisplayObject;
  readonly childCount: number;
  nextChild: number;
}

/** Ascending order fixes integrity failure priority without sibling snapshots. */
function admitStructure(root: Stage, engine: EngineContext, maximum: number): void {
  const seen = new Set<DisplayObject>(),
    stack: StructuralCursor[] = [];
  function enter(node: DisplayObject, parent: DisplayObject | undefined): void {
    if (seen.size >= maximum) throw new EgretError('HIT_TEST_TREE_LIMIT');
    if (!isDisplayNode(node) || seen.has(node) || parentOf(node) !== parent)
      throw new EgretError('DISPLAY_TREE_INVARIANT');
    assertLive(node);
    if (engineOf(node) !== engine) throw new EgretError('ENGINE_MISMATCH');
    seen.add(node);
    stack.push({ node, childCount: childCountOf(node), nextChild: 0 });
  }
  enter(root, undefined);
  while (stack.length !== 0) {
    const cursor = stack[stack.length - 1]!;
    if (cursor.nextChild === cursor.childCount) {
      stack.pop();
      continue;
    }
    // Debit before retrieving a child, including hidden/suppressed descendants.
    if (seen.size >= maximum) throw new EgretError('HIT_TEST_TREE_LIMIT');
    const child = childAtOf(cursor.node, cursor.nextChild++);
    if (child === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
    enter(child, cursor.node);
  }
}

function inversePoint(matrix: Matrix2D, x: number, y: number): Point2D {
  try {
    return invertCoordinatePoint(matrix, x, y);
  } catch (cause) {
    if (cause instanceof EgretError && cause.code === 'COORDINATE_ARITHMETIC_RANGE') {
      throw new EgretError('HIT_TEST_ARITHMETIC_RANGE', { cause });
    }
    throw cause;
  }
}

function nonsingular(matrix: Matrix2D): boolean {
  // This exact-rank probe has zero inverse coordinates when rank is full. It
  // avoids overflowing an irrelevant requested-point inverse on an ancestor.
  try {
    inversePoint(matrix, matrix.tx, matrix.ty);
    return true;
  } catch (cause) {
    if (cause instanceof EgretError && cause.code === 'COORDINATE_TRANSFORM_SINGULAR') return false;
    throw cause;
  }
}

function contains(rectangle: Rectangle2D, point: Point2D): boolean {
  return (
    point.x >= rectangle.x &&
    point.x < rectangle.x + rectangle.width &&
    point.y >= rectangle.y &&
    point.y < rectangle.y + rectangle.height
  );
}

/**
 * Whether a point, in a node's own units, is on what the node itself draws: one of its filled rectangles, a triangle
 * of its shapes, or its bitmap's rectangle. A node that is touch enabled and has no hit area is hit by this.
 */
export function containsOwnPaint(node: DisplayObject, point: Point2D): boolean {
  const visual = visualOf(node),
    x = point.x,
    y = point.y;
  for (const { rect } of visual.primitives) if (rect.width > 0 && rect.height > 0 && contains(rect, point)) return true;
  const bitmap = readBitmapState(node);
  if (bitmap !== undefined && x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height) return true;
  const shape = visual.shape === undefined ? undefined : resolveShape(visual.shape);
  if (shape === undefined) return false;
  const bounds = shape.bounds;
  if (x < bounds.x || y < bounds.y || x > bounds.x + bounds.width || y > bounds.y + bounds.height) return false;
  for (const { geometry } of shape.parts) {
    const positions = geometry.positions,
      indices = geometry.indices;
    for (let i = 0; i < geometry.indexCount; i += 3) {
      const a = 2 * indices[i]!,
        b = 2 * indices[i + 1]!,
        c = 2 * indices[i + 2]!;
      const ax = positions[a]!,
        ay = positions[a + 1]!,
        bx = positions[b]!,
        by = positions[b + 1]!,
        cx = positions[c]!,
        cy = positions[c + 1]!;
      const d1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax),
        d2 = (cx - bx) * (y - by) - (cy - by) * (x - bx),
        d3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
      if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) return true;
    }
  }
  return false;
}

interface NumericalCursor {
  readonly node: DisplayObject;
  readonly matrix: Matrix2D;
  /** The authored hit area; `true` for a touch enabled node without one, which is hit on what it draws. */
  readonly area: Rectangle2D | true | undefined;
  localPoint: Point2D | undefined;
  nextChild: number;
}

/** Private state only; all active arithmetic completes before a borrowed result. */
export function queryDisplayHit(
  receiver: unknown,
  x: unknown,
  y: unknown,
  options: unknown
): DisplayObject | undefined {
  if (!isStageRoot(receiver)) throw new EgretError('HIT_TEST_RECEIVER_INVALID');
  const root = receiver;
  assertLive(root);
  const engine = engineOf(root);
  if (engine === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
  engine.assertOpen();
  if (!finite(x) || !finite(y)) throw new EgretError('HIT_TEST_INPUT_INVALID');
  const globalX = x,
    globalY = y;
  const maximum = budgetOf(root, engine, options);
  admitStructure(root, engine, maximum);
  const identity: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const stack: NumericalCursor[] = [];
  let winner: DisplayObject | undefined;

  function enter(node: DisplayObject, parentMatrix: Matrix2D): void {
    const visual = visualOf(node);
    if (!visual.visible) return;
    const matrix = composeDisplayTransform(parentMatrix, visual);
    if (
      !finite(matrix.a) ||
      !finite(matrix.b) ||
      !finite(matrix.c) ||
      !finite(matrix.d) ||
      !finite(matrix.tx) ||
      !finite(matrix.ty)
    ) {
      throw new EgretError('HIT_TEST_ARITHMETIC_RANGE');
    }
    if (!nonsingular(matrix)) return;
    let localPoint: Point2D | undefined;
    const clip = visual.clipRect;
    if (clip !== undefined) {
      // Existing clip admission allows finite dimensions with infinite sums.
      // Evaluate endpoint validity before empty suppression, only when active.
      if (!finite(clip.x + clip.width) || !finite(clip.y + clip.height))
        throw new EgretError('HIT_TEST_ARITHMETIC_RANGE');
      if (clip.width === 0 || clip.height === 0) return;
      localPoint = inversePoint(matrix, globalX, globalY);
      if (!contains(clip, localPoint)) return;
    }
    const state = readDisplayHitState(node);
    const authored = state.hitArea;
    // An authored area of no size stays what it was: nothing to hit. Without an area, the node's own drawing is the area.
    const area =
      node === root || !state.touchEnabled
        ? undefined
        : authored === undefined
          ? (true as const)
          : authored.width > 0 && authored.height > 0
            ? authored
            : undefined;
    stack.push({
      node,
      matrix,
      area,
      localPoint,
      nextChild: state.touchChildren === false ? -1 : childCountOf(node) - 1
    });
  }

  enter(root, identity);
  while (stack.length !== 0) {
    const cursor = stack[stack.length - 1]!;
    if (cursor.nextChild >= 0) {
      const child = childAtOf(cursor.node, cursor.nextChild--);
      if (child === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
      enter(child, cursor.matrix);
      continue;
    }
    if (cursor.area !== undefined) {
      const localPoint = cursor.localPoint ?? inversePoint(cursor.matrix, globalX, globalY);
      // Keep evaluating every eligible candidate after the first winner so a
      // topmost hit cannot hide another active branch's arithmetic failure.
      if (
        winner === undefined &&
        (cursor.area === true ? containsOwnPaint(cursor.node, localPoint) : contains(cursor.area, localPoint))
      )
        winner = cursor.node;
    }
    stack.pop();
  }
  live(root, engine);
  return winner;
}
