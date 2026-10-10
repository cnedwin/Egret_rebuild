import type { Matrix2D, Rectangle2D } from '@egret/contracts';
import type { DisplayObject } from './DisplayObject.js';
import { readBitmapState } from './bitmapDisplayState.js';
import { assertLive, childAtOf, childCountOf, isDisplayNode, parentOf } from './displayTreeState.js';
import { composeDisplayTransform } from './displayTransform.js';
import { finite, visualOf } from './displayVisualState.js';
import { engineOf } from './ownership.js';
import { EgretError } from './EgretError.js';

/** Receiver-inclusive node and content budgets for logical local measurement. */
export interface BoundsQueryOptions {
  readonly maxNodes?: number;
  readonly maxPrimitives?: number;
}

function live(node: DisplayObject): void { assertLive(node); engineOf(node)?.assertOpen(); }

function budgetsOf(node: DisplayObject, options: unknown): { maxNodes: number; maxPrimitives: number } {
  let nodes: unknown, primitives: unknown;
  if (options !== undefined) {
    if (options === null || typeof options !== 'object') throw new EgretError('BOUNDS_INPUT_INVALID');
    let array: boolean;
    // Revoked Proxy admission can throw. Array rejection is a semantic failure
    // outside the source catch, and normal lookup retains inherited getters.
    try { array = Array.isArray(options); }
    catch (cause) { throw new EgretError('BOUNDS_INPUT_INVALID', { cause }); }
    if (array) throw new EgretError('BOUNDS_INPUT_INVALID');
    try {
      nodes = (options as BoundsQueryOptions).maxNodes;
      primitives = (options as BoundsQueryOptions).maxPrimitives;
    } catch (cause) { throw new EgretError('BOUNDS_INPUT_INVALID', { cause }); }
  }
  // Finish both successful source reads before lifetime and numeric semantics.
  // Throwing reads retain exact supplied causes, even after terminal side effects.
  live(node);
  const maxNodes = nodes === undefined ? 4096 : nodes;
  const maxPrimitives = primitives === undefined ? 65536 : primitives;
  if (!finite(maxNodes) || !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 65536) {
    throw new EgretError('BOUNDS_INPUT_INVALID');
  }
  if (!finite(maxPrimitives) || !Number.isInteger(maxPrimitives) || maxPrimitives < 1 || maxPrimitives > 262144) {
    throw new EgretError('BOUNDS_INPUT_INVALID');
  }
  return { maxNodes, maxPrimitives };
}

interface TraversalFrame {
  readonly node: DisplayObject;
  readonly matrix: Matrix2D;
  readonly children: number;
  nextChild: number;
}

/** Private state only: no Bitmap value import, resource lookup or public hook. */
export function queryDisplayBounds(receiver: unknown, options: unknown): Rectangle2D {
  if (!isDisplayNode(receiver as object)) throw new EgretError('BOUNDS_RECEIVER_INVALID');
  const node = receiver as DisplayObject;
  live(node);
  const { maxNodes, maxPrimitives } = budgetsOf(node, options);
  const seen = new Set<DisplayObject>(), visited: DisplayObject[] = [], stack: TraversalFrame[] = [];
  let items = 0, hasContent = false, minX = 0, minY = 0, maxX = 0, maxY = 0;

  function admitItem(): void {
    // Admission precedes indexing the next primitive's geometry or Bitmap size.
    if (items >= maxPrimitives) throw new EgretError('BOUNDS_CONTENT_LIMIT');
    items++;
  }
  function point(matrix: Matrix2D, x: number, y: number): void {
    const px = matrix.a * x + matrix.c * y + matrix.tx;
    const py = matrix.b * x + matrix.d * y + matrix.ty;
    if (!finite(px) || !finite(py)) throw new EgretError('BOUNDS_ARITHMETIC_RANGE');
    if (!hasContent) { minX = maxX = px; minY = maxY = py; hasContent = true; }
    else { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); }
  }
  function rectangle(matrix: Matrix2D, x: number, y: number, width: number, height: number): void {
    // Authored zero extent consumes budget but does not evaluate endpoints.
    // Positive content may still collapse to a point or line through rounding.
    if (width === 0 || height === 0) return;
    const right = x + width, bottom = y + height;
    if (!finite(right) || !finite(bottom)) throw new EgretError('BOUNDS_ARITHMETIC_RANGE');
    point(matrix, x, y); point(matrix, right, y);
    point(matrix, right, bottom); point(matrix, x, bottom);
  }
  function enter(current: DisplayObject, matrix: Matrix2D): void {
    if (!isDisplayNode(current) || seen.has(current)) throw new EgretError('DISPLAY_TREE_INVARIANT');
    live(current); seen.add(current); visited.push(current);
    const primitives = visualOf(current).primitives;
    for (let index = 0; index < primitives.length; index++) {
      admitItem();
      const rect = primitives[index]!.rect;
      rectangle(matrix, rect.x, rect.y, rect.width, rect.height);
    }
    const bitmap = readBitmapState(current);
    if (bitmap !== undefined) {
      admitItem(); rectangle(matrix, 0, 0, bitmap.width, bitmap.height);
    }
    stack.push({ node: current, matrix, children: childCountOf(current), nextChild: 0 });
  }

  // The receiver's frame is identity. Its own and all ancestor transforms are
  // excluded, so no inverse or receiver/ancestor composition is evaluated.
  enter(node, { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  while (stack.length !== 0) {
    const frame = stack[stack.length - 1]!;
    if (frame.nextChild === frame.children) { stack.pop(); continue; }
    // Check before indexed retrieval: no eager child snapshot or sibling stack.
    if (visited.length >= maxNodes) throw new EgretError('BOUNDS_TREE_LIMIT');
    const child = childAtOf(frame.node, frame.nextChild++);
    if (child === undefined || !isDisplayNode(child) || seen.has(child) || parentOf(child) !== frame.node) {
      throw new EgretError('DISPLAY_TREE_INVARIANT');
    }
    live(child);
    const matrix = composeDisplayTransform(frame.matrix, visualOf(child));
    // Completed descendant matrices are checked even for empty/zero-only nodes.
    if (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty].every(finite)) {
      throw new EgretError('BOUNDS_ARITHMETIC_RANGE');
    }
    enter(child, matrix);
  }
  const width = hasContent ? maxX - minX : 0, height = hasContent ? maxY - minY : 0;
  if (!finite(width) || !finite(height)) throw new EgretError('BOUNDS_ARITHMETIC_RANGE');
  for (const current of visited) live(current);
  // Ordinary binary64 subtraction is intentional, not an outward enclosure.
  // Saved output retains no authority, options, primitive or resource reference.
  return Object.freeze({ x: minX === 0 ? 0 : minX, y: minY === 0 ? 0 : minY, width: width === 0 ? 0 : width, height: height === 0 ? 0 : height });
}
