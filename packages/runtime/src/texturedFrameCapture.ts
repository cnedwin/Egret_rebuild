import type { ClipRectangle2D, ImageData2D, Matrix2D, Rectangle2D, TexturedGeometry2D, TexturedRenderCommand2D } from '@egret/contracts';
import type { Stage } from './Stage.js';
import type { DisplayObject } from './DisplayObject.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { EngineContext } from './ownership.js';
import type { Primitive } from './displayVisualState.js';
import { assertLive, childAtOf, childCountOf, isDisplayNode, isStageRoot, parentOf } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { finite, visualOf } from './displayVisualState.js';
import { composeDisplayTransform } from './displayTransform.js';
import { bitmapCaptureState, readBitmapImage } from './Bitmap.js';
import { readMeshState } from './meshDisplayState.js';
import { readMeshCaptureImage } from './meshCaptureSnapshot.js';
import { assertTextFieldScope, readTextFieldState } from './textDisplayState.js';
import { CaptureImageBudget } from './imageFrameBudget.js';
import { TexturedCaptureBudget } from './texturedFrameBudget.js';
import { EgretError } from './EgretError.js';

export interface CapturedTexturedContent2D {
  readonly commands: readonly TexturedRenderCommand2D[];
  readonly images: readonly ImageData2D[];
  readonly geometries: readonly TexturedGeometry2D[];
}

interface AdmittedNode {
  readonly primitives: readonly Primitive[];
  readonly primitiveCount: number;
  readonly bitmapOccupied: boolean;
  readonly meshGeometry: TexturedGeometry2D | undefined;
  readonly textContentBounds: Rectangle2D | undefined;
}
interface Cursor { readonly node: DisplayObject; readonly children: number; nextChild: number; }
interface ClipChain { readonly previous: ClipChain | undefined; readonly clip: ClipRectangle2D; readonly depth: number; }
interface VisibleCursor extends Cursor { readonly matrix: Matrix2D; readonly alpha: number; readonly clips: ClipChain | undefined; }

function checkNode(node: DisplayObject, parent: DisplayObjectContainer | undefined, engine: EngineContext, seen: Set<DisplayObject>): void {
  if (!isDisplayNode(node) || seen.has(node) || parentOf(node) !== parent) throw new EgretError('DISPLAY_TREE_INVARIANT');
  assertLive(node);
  if (engineOf(node) !== engine) throw new EgretError('ENGINE_MISMATCH');
  seen.add(node);
}

/** Complete all-tree metadata admission before any visible payload or resource read. */
function admitTree(stage: Stage, engine: EngineContext, budget: TexturedCaptureBudget): Map<DisplayObject, AdmittedNode> {
  const metadata = new Map<DisplayObject, AdmittedNode>(), seen = new Set<DisplayObject>(), stack: Cursor[] = [];
  function enter(node: DisplayObject, parent: DisplayObjectContainer | undefined): void {
    budget.admitNode();
    checkNode(node, parent, engine, seen);
    const primitives = visualOf(node).primitives;
    budget.admitAuthoringUnits(primitives.length);
    const bitmapOccupied = bitmapCaptureState(node) !== undefined;
    if (bitmapOccupied) budget.admitAuthoringUnits(1);
    const mesh = readMeshState(node);
    const meshGeometry = mesh?.geometry;
    if (meshGeometry !== undefined) {
      budget.admitAuthoringUnits(1);
      budget.admitSourceTriangles(meshGeometry.triangleCount);
      budget.admitGeometry(meshGeometry);
    }
    // Retain geometry identity only; hidden lease/Texture pairs never enter this map.
    const textContentBounds = readTextFieldState(node)?.committed?.contentBounds;
    if (textContentBounds !== undefined) budget.admitAuthoringUnits(1);
    metadata.set(node, { primitives, primitiveCount: primitives.length, bitmapOccupied, meshGeometry, textContentBounds });
    stack.push({ node, children: childCountOf(node), nextChild: 0 });
  }
  enter(stage, undefined);
  while (stack.length !== 0) {
    const cursor = stack[stack.length - 1]!;
    if (cursor.nextChild === cursor.children) { stack.pop(); continue; }
    const child = childAtOf(cursor.node, cursor.nextChild++);
    if (child === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
    enter(child, cursor.node as DisplayObjectContainer);
  }
  return metadata;
}

function checkedMatrix(matrix: Matrix2D): Matrix2D {
  if (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty].every(finite)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  return Object.freeze(matrix);
}
function point(matrix: Matrix2D, x: number, y: number): void {
  if (!finite(x) || !finite(y)
    || !finite(matrix.a * x + matrix.c * y + matrix.tx)
    || !finite(matrix.b * x + matrix.d * y + matrix.ty)) throw new EgretError('FRAME_TRANSFORM_INVALID');
}
function rectangle(matrix: Matrix2D, rect: Rectangle2D): Rectangle2D {
  const right = rect.x + rect.width, bottom = rect.y + rect.height;
  if (!finite(right) || !finite(bottom)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  point(matrix, rect.x, rect.y); point(matrix, right, rect.y);
  point(matrix, right, bottom); point(matrix, rect.x, bottom);
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}
function referencedTuples(matrix: Matrix2D, geometry: TexturedGeometry2D): void {
  // Factory validation already covered all owned components. Per occurrence,
  // evaluate only complete referenced tuples in authored triangle-list order.
  for (let triangle = 0; triangle < geometry.triangleCount; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const index = geometry.indices[3 * triangle + corner]!;
      const x = geometry.positions[2 * index]!, y = geometry.positions[2 * index + 1]!;
      const u = geometry.uvs[2 * index]!, v = geometry.uvs[2 * index + 1]!;
      const red = geometry.lightColors[4 * index]!, green = geometry.lightColors[4 * index + 1]!;
      const blue = geometry.lightColors[4 * index + 2]!, alpha = geometry.lightColors[4 * index + 3]!;
      if (![u, v, red, green, blue, alpha].every(value => finite(value) && value >= 0 && value <= 1)) throw new EgretError('FRAME_TRANSFORM_INVALID');
      point(matrix, x, y);
    }
  }
}
function flattenClips(chain: ClipChain | undefined): readonly ClipRectangle2D[] {
  const clips = new Array<ClipRectangle2D>(chain?.depth ?? 0);
  for (let cursor = chain; cursor !== undefined; cursor = cursor.previous) clips[cursor.depth - 1] = cursor.clip;
  return Object.freeze(clips);
}

/** Two callback-free iterative passes; retained output contains immutable values only. */
export function collectTexturedFrameContent(stage: Stage): CapturedTexturedContent2D {
  if (!isStageRoot(stage)) throw new EgretError('FRAME_STAGE_INVALID');
  const engine = engineOf(stage)!;
  engine.assertOpen();
  const budget = new TexturedCaptureBudget();
  const metadata = admitTree(stage, engine, budget);
  engine.assertOpen();
  const commands: TexturedRenderCommand2D[] = [], geometries: TexturedGeometry2D[] = [];
  const geometryIndexes = new Map<TexturedGeometry2D, number>();
  const images = new CaptureImageBudget(), seen = new Set<DisplayObject>(), stack: VisibleCursor[] = [];

  function enter(node: DisplayObject, parent: DisplayObjectContainer | undefined, parentMatrix: Matrix2D, parentAlpha: number, inheritedClips: ClipChain | undefined): void {
    checkNode(node, parent, engine, seen);
    const admitted = metadata.get(node), state = visualOf(node);
    if (admitted === undefined || state.primitives !== admitted.primitives || state.primitives.length !== admitted.primitiveCount) throw new EgretError('DISPLAY_TREE_INVARIANT');
    if (!state.visible || state.alpha === 0) return;
    const alpha = parentAlpha * state.alpha;
    if (alpha === 0) return;
    if (!finite(alpha)) throw new EgretError('FRAME_TRANSFORM_INVALID');
    const matrix = checkedMatrix(composeDisplayTransform(parentMatrix, state));
    let clips = inheritedClips;
    if (state.clipRect !== undefined) {
      const rect = rectangle(matrix, state.clipRect);
      if (rect.width === 0 || rect.height === 0) return;
      clips = { previous: clips, clip: Object.freeze({ matrix, rect }), depth: (clips?.depth ?? 0) + 1 };
    }
    function commandClips(): readonly ClipRectangle2D[] {
      // Both debits precede output/clip allocation. Every occurrence is charged.
      budget.admitEmission(clips?.depth ?? 0);
      return flattenClips(clips);
    }
    for (let i = 0; i < admitted.primitiveCount; i++) {
      const primitive = admitted.primitives[i]!;
      const rect = rectangle(matrix, primitive.rect), effective = alpha * primitive.alpha;
      if (rect.width === 0 || rect.height === 0 || effective === 0) continue;
      const commandClipRecords = commandClips();
      const command = Object.freeze({ kind: 'rect' as const, matrix, rect, color: primitive.color, alpha: effective, clips: commandClipRecords });
      commands.push(command);
    }
    const bitmap = bitmapCaptureState(node);
    if ((bitmap !== undefined) !== admitted.bitmapOccupied) throw new EgretError('DISPLAY_TREE_INVARIANT');
    if (bitmap !== undefined) {
      const rect = rectangle(matrix, { x: 0, y: 0, width: bitmap.width, height: bitmap.height });
      const snapshot = readBitmapImage(bitmap.lease);
      const imageIndex = images.register(snapshot.image, bitmap.sourceRect);
      const commandClipRecords = commandClips();
      const command = Object.freeze({ kind: 'image' as const, matrix, rect, alpha, clips: commandClipRecords, imageIndex, sourceRect: bitmap.sourceRect });
      commands.push(command);
    }
    const mesh = readMeshState(node);
    if (mesh?.geometry !== admitted.meshGeometry) throw new EgretError('DISPLAY_TREE_INVARIANT');
    if (mesh !== undefined) {
      const snapshot = readMeshCaptureImage(mesh);
      referencedTuples(matrix, mesh.geometry);
      const imageIndex = images.register(snapshot.image, mesh.sourceRect);
      // Geometry table order follows first emission, independently of Pass A.
      let geometryIndex = geometryIndexes.get(mesh.geometry);
      const commandClipRecords = commandClips();
      if (geometryIndex === undefined) {
        geometryIndex = geometries.length;
        geometryIndexes.set(mesh.geometry, geometryIndex);
        geometries.push(mesh.geometry);
      }
      commands.push(Object.freeze({ kind: 'mesh', matrix, alpha, clips: commandClipRecords, imageIndex, sourceRect: mesh.sourceRect, geometryIndex }));
    }
    const text = readTextFieldState(node);
    if (text?.committed?.contentBounds !== admitted.textContentBounds) throw new EgretError('DISPLAY_TREE_INVARIANT');
    if (text !== undefined) {
      assertTextFieldScope(text.scope);
      const committed = text.committed;
      if (committed?.lease !== undefined && committed.raster !== undefined && committed.sourceRect !== undefined) {
        const rect = rectangle(matrix, committed.raster);
        const commandClipRecords = commandClips();
        const snapshot = readBitmapImage(committed.lease);
        const imageIndex = images.register(snapshot.image, committed.sourceRect);
        commands.push(Object.freeze({ kind: 'image', matrix, rect, alpha, clips: commandClipRecords,
          imageIndex, sourceRect: committed.sourceRect }));
      }
    }
    stack.push({ node, matrix, alpha, clips, children: childCountOf(node), nextChild: 0 });
  }
  enter(stage, undefined, { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, 1, undefined);
  while (stack.length !== 0) {
    const cursor = stack[stack.length - 1]!;
    if (cursor.nextChild === cursor.children) { stack.pop(); continue; }
    const child = childAtOf(cursor.node, cursor.nextChild++);
    if (child === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
    enter(child, cursor.node as DisplayObjectContainer, cursor.matrix, cursor.alpha, cursor.clips);
  }
  engine.assertOpen();
  return Object.freeze({ commands: Object.freeze(commands), images: images.finish() ?? Object.freeze([]), geometries: Object.freeze(geometries) });
}
