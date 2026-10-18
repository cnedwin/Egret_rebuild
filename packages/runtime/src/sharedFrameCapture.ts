import { createSharedMaterial2D, isSharedGeometry2D, isTexturedGeometry2D } from '@egret/contracts';
import type { ClipRectangle2D, ImageData2D, Matrix2D, Rectangle2D, SharedBarrierCommand2D,
  SharedGeometry2D, SharedMaterial2D, SharedPage2D, SharedRegion2D, SharedRenderCommand2D,
  TexturedGeometry2D, TextureRegion2D, TextureViewRegion2D } from '@egret/contracts';
import type { Stage } from './Stage.js';
import type { DisplayObject } from './DisplayObject.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { EngineContext } from './ownership.js';
import type { Primitive } from './displayVisualState.js';
import type { BitmapCaptureState } from './bitmapDisplayState.js';
import type { MeshCaptureState } from './meshDisplayState.js';
import type { TextFieldDisplayState } from './textDisplayState.js';
import { assertLive, childAtOf, childCountOf, isDisplayNode, isStageRoot, parentOf } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { finite, visualOf } from './displayVisualState.js';
import { composeDisplayTransform } from './displayTransform.js';
import { bitmapCaptureState, readBitmapImage } from './Bitmap.js';
import { readMeshState } from './meshDisplayState.js';
import { readMeshCaptureImage } from './meshCaptureSnapshot.js';
import { assertTextFieldScope, readTextFieldState } from './textDisplayState.js';
import { EgretError } from './EgretError.js';

export interface CapturedSharedContent2D {
  readonly commands: readonly SharedRenderCommand2D[];
  readonly pages: readonly SharedPage2D[];
  readonly regions: readonly SharedRegion2D[];
  readonly materials: readonly SharedMaterial2D[];
  readonly geometries: readonly (TexturedGeometry2D | SharedGeometry2D)[];
}

type Geometry = TexturedGeometry2D | SharedGeometry2D;
interface AdmittedNode {
  readonly primitives: readonly Primitive[];
  readonly primitiveCount: number;
  readonly bitmap: BitmapCaptureState | undefined;
  readonly mesh: MeshCaptureState | undefined;
  readonly text: TextFieldDisplayState | undefined;
}
interface Cursor { readonly node: DisplayObject; readonly children: number; nextChild: number; }
interface ClipChain { readonly previous: ClipChain | undefined; readonly clip: ClipRectangle2D; readonly depth: number; }
interface Boundary { readonly occurrenceId: number; readonly boundaryId: number; }
interface VisibleCursor extends Cursor {
  readonly matrix: Matrix2D; readonly alpha: number; readonly clips: ClipChain | undefined;
  readonly material: SharedMaterial2D; readonly explicit: Boundary | undefined; readonly clip: Boundary | undefined;
}
const freeze = Object.freeze;
const defaultMaterial = createSharedMaterial2D({});
const identity: Matrix2D = freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });

function debit(used: number, count: number, limit: number, code = 'FRAME_BUDGET_EXCEEDED'): number {
  if (!Number.isSafeInteger(count) || count < 0 || count > limit - used) throw new EgretError(code);
  return used + count;
}

/** Call-local logical charges are independent of visibility and actual allocation. */
class CaptureBudget {
  private nodes = 0;
  private units = 0;
  private triangles = 0;
  private geometryBytes = 0;
  private sourceBytes = 0;
  private canonicalBytes = 0;
  private commands = 0;
  private clipReferences = 0;
  // Header plus all five empty table arrays are charged even for a clear-only frame.
  private metadata = 256 + 5 * 24;
  private readonly geometryOwners = new Set<Geometry>();
  private readonly sourceOwners = new Set<ImageData2D>();
  private readonly clipOwners = new Set<ClipRectangle2D>();

  public node(): void { this.nodes = debit(this.nodes, 1, 65536); }
  public authoring(count: number): void { this.units = debit(this.units, count, 65536); }
  public geometry(value: Geometry): void {
    if (!isTexturedGeometry2D(value) && !isSharedGeometry2D(value)) throw new EgretError('MESH_GEOMETRY_INVALID');
    this.triangles = debit(this.triangles, value.triangleCount, 65536);
    if (this.geometryOwners.has(value)) return;
    debit(this.geometryOwners.size, 1, 128);
    this.geometryBytes = debit(this.geometryBytes, value.logicalByteLength, 16777216);
    this.geometryOwners.add(value);
  }
  public source(value: ImageData2D): void {
    if (this.sourceOwners.has(value)) return;
    debit(this.sourceOwners.size, 1, 64, 'FRAME_IMAGE_BUDGET');
    const source = debit(this.sourceBytes, value.byteLength, 16777216, 'FRAME_IMAGE_BUDGET');
    const canonical = debit(this.canonicalBytes, value.byteLength, 16777216, 'FRAME_IMAGE_BUDGET');
    this.sourceBytes = source; this.canonicalBytes = canonical;
    this.sourceOwners.add(value);
  }
  public metadataBytes(bytes: number): void { this.metadata = debit(this.metadata, bytes, 33554432); }
  public emission(clips: ClipChain | undefined, barrier: boolean): void {
    const count = barrier ? 0 : clips?.depth ?? 0;
    this.commands = debit(this.commands, 1, 65536);
    this.clipReferences = debit(this.clipReferences, count, 262144);
    this.metadataBytes(8 + (barrier ? 64 : 192 + 24 + 8 * count));
    if (!barrier) for (let cursor = clips; cursor !== undefined; cursor = cursor.previous) {
      if (this.clipOwners.has(cursor.clip)) continue;
      this.metadataBytes(80);
      this.clipOwners.add(cursor.clip);
    }
  }
}

function checkNode(node: DisplayObject, parent: DisplayObjectContainer | undefined, engine: EngineContext, seen: Set<DisplayObject>): void {
  if (!isDisplayNode(node) || seen.has(node) || parentOf(node) !== parent) throw new EgretError('DISPLAY_TREE_INVARIANT');
  assertLive(node);
  if (engineOf(node) !== engine) throw new EgretError('ENGINE_MISMATCH');
  seen.add(node);
}

/** All-tree metadata and geometry admission precedes any visible resource use. */
function admitTree(stage: Stage, engine: EngineContext, budget: CaptureBudget): Map<DisplayObject, AdmittedNode> {
  const admitted = new Map<DisplayObject, AdmittedNode>(), seen = new Set<DisplayObject>(), stack: Cursor[] = [];
  function enter(node: DisplayObject, parent: DisplayObjectContainer | undefined): void {
    budget.node();
    checkNode(node, parent, engine, seen);
    const primitives = visualOf(node).primitives;
    budget.authoring(primitives.length);
    const bitmap = bitmapCaptureState(node), mesh = readMeshState(node), text = readTextFieldState(node);
    if (bitmap !== undefined) budget.authoring(1);
    if (mesh !== undefined) { budget.authoring(1); budget.geometry(mesh.geometry); }
    if (text?.committed !== undefined) budget.authoring(1);
    admitted.set(node, { primitives, primitiveCount: primitives.length, bitmap, mesh, text });
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
  return admitted;
}

function checkedMatrix(matrix: Matrix2D): Matrix2D {
  if (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty].every(finite)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  return freeze(matrix);
}
function point(matrix: Matrix2D, x: number, y: number): void {
  if (!finite(x) || !finite(y) || !finite(matrix.a * x + matrix.c * y + matrix.tx)
    || !finite(matrix.b * x + matrix.d * y + matrix.ty)) throw new EgretError('FRAME_TRANSFORM_INVALID');
}
function rectangle(matrix: Matrix2D, rect: Rectangle2D): Rectangle2D {
  const right = rect.x + rect.width, bottom = rect.y + rect.height;
  if (!finite(right) || !finite(bottom)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  point(matrix, rect.x, rect.y); point(matrix, right, rect.y);
  point(matrix, right, bottom); point(matrix, rect.x, bottom);
  return freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}
function referencedTuples(matrix: Matrix2D, geometry: Geometry): void {
  const shared = isSharedGeometry2D(geometry);
  for (let offset = 0; offset < geometry.indexCount; offset++) {
    const index = geometry.indices[offset]!;
    point(matrix, geometry.positions[2 * index]!, geometry.positions[2 * index + 1]!);
    const u = geometry.uvs[2 * index]!, v = geometry.uvs[2 * index + 1]!;
    if (!finite(u) || !finite(v)) throw new EgretError('FRAME_TRANSFORM_INVALID');
    for (let component = 0; component < 4; component++) {
      const value = geometry.lightColors[4 * index + component]!;
      if (!finite(value) || value < 0 || value > 1) throw new EgretError('FRAME_TRANSFORM_INVALID');
    }
    if (shared) for (let component = 0; component < 3; component++) {
      const value = geometry.darkColors[3 * index + component]!;
      if (!finite(value) || value < 0 || value > 1) throw new EgretError('FRAME_TRANSFORM_INVALID');
    }
  }
  // GPU page-q and periodic precision admission belongs to Host preparation.
}
function flattenClips(chain: ClipChain | undefined): readonly ClipRectangle2D[] {
  const result = new Array<ClipRectangle2D>(chain?.depth ?? 0);
  for (let cursor = chain; cursor !== undefined; cursor = cursor.previous) result[cursor.depth - 1] = cursor.clip;
  return freeze(result);
}
function materialKey(material: SharedMaterial2D): string {
  const light = material.light, dark = material.dark;
  return light[0] + ',' + light[1] + ',' + light[2] + ',' + light[3] + ';'
    + dark[0] + ',' + dark[1] + ',' + dark[2] + ';' + material.blend + ';' + material.samplingDomain
    + ';' + material.filter + ';' + material.addressU + ';' + material.addressV + ';' + material.regionIsolation
    + ';' + material.mipLevel + ';' + material.minFilter + ';' + material.magFilter + ';' + material.maxAnisotropy;
}
function regionKey(region: TextureViewRegion2D): string {
  const packed = region.packed;
  return packed.x + ',' + packed.y + ',' + packed.width + ',' + packed.height + ',' + region.logicalWidth
    + ',' + region.logicalHeight + ',' + region.trimX + ',' + region.trimY + ',' + region.quarterTurn;
}
function plainRegion(sourceRect: TextureRegion2D): TextureViewRegion2D {
  return { packed: sourceRect, logicalWidth: sourceRect.width, logicalHeight: sourceRect.height, trimX: 0, trimY: 0, quarterTurn: 0 };
}
function bitmapRegion(bitmap: BitmapCaptureState): TextureViewRegion2D {
  if (bitmap.viewRegion !== null) return bitmap.viewRegion;
  const layout = bitmap.layout;
  if (layout === undefined) return plainRegion(bitmap.sourceRect);
  // This is a new-profile representation boundary, after current entitlement.
  // Legacy atlas commits/captures retain their broader safe-integer dimensions.
  if (layout.sourceWidth > 1048576 || layout.sourceHeight > 1048576 || layout.trimX > 1048576 || layout.trimY > 1048576) {
    throw new EgretError('FRAME_PROFILE_METADATA_UNSUPPORTED');
  }
  return { packed: bitmap.sourceRect, logicalWidth: layout.sourceWidth, logicalHeight: layout.sourceHeight,
    trimX: layout.trimX, trimY: layout.trimY, quarterTurn: layout.packedRotation === 0 ? 0 : 1 };
}
function bitmapRect(bitmap: BitmapCaptureState, material: SharedMaterial2D): Rectangle2D {
  if (material.samplingDomain === 'region') return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const view = bitmap.viewRegion, layout = bitmap.layout;
  const turn = view?.quarterTurn ?? (layout?.packedRotation === 90 ? 1 : 0);
  return { x: view?.trimX ?? layout?.trimX ?? 0, y: view?.trimY ?? layout?.trimY ?? 0,
    width: turn === 1 || turn === 3 ? bitmap.sourceRect.height : bitmap.sourceRect.width,
    height: turn === 1 || turn === 3 ? bitmap.sourceRect.width : bitmap.sourceRect.height };
}

/** Cold, iterative capture. All mutable owners stay inside this invocation. */
export function collectSharedFrameContent(stage: Stage): CapturedSharedContent2D {
  if (!isStageRoot(stage)) throw new EgretError('FRAME_STAGE_INVALID');
  const engine = engineOf(stage)!;
  engine.assertOpen();
  const budget = new CaptureBudget(), admitted = admitTree(stage, engine, budget);
  engine.assertOpen();
  const commands: SharedRenderCommand2D[] = [], pages: SharedPage2D[] = [], regions: SharedRegion2D[] = [];
  const materials: SharedMaterial2D[] = [], geometries: Geometry[] = [];
  const pageIndexes = new Map<ImageData2D, number>(), regionIndexes = new Map<ImageData2D, Map<string, number>>();
  const materialIndexes = new Map<string, number>(), geometryIndexes = new Map<Geometry, number>();
  const seen = new Set<DisplayObject>(), stack: VisibleCursor[] = [];
  let nextOccurrence = 0, nextBoundary = 0;

  function materialIndex(material: SharedMaterial2D): number {
    const key = materialKey(material), found = materialIndexes.get(key);
    if (found !== undefined) return found;
    debit(materials.length, 1, 256);
    budget.metadataBytes(192 + 8);
    const index = materials.length;
    materials.push(material); materialIndexes.set(key, index);
    return index;
  }
  function regionIndex(image: ImageData2D, value: TextureViewRegion2D): number {
    const key = regionKey(value), owner = regionIndexes.get(image), found = owner?.get(key);
    if (found !== undefined) return found;
    debit(regions.length, 1, 128, 'FRAME_IMAGE_BUDGET');
    let pageIndex = pageIndexes.get(image);
    if (pageIndex === undefined) {
      budget.metadataBytes(96 + 8);
      pageIndex = pages.length;
      pages.push(freeze({ source: image, sourceRepresentation: 'egret.srgb-straight-rgba8/1',
        canonicalRepresentation: 'egret.alpha8-capped-srgb-pma8/1' }));
      pageIndexes.set(image, pageIndex);
    }
    budget.metadataBytes(128 + 8);
    const packed = freeze({ x: value.packed.x, y: value.packed.y, width: value.packed.width, height: value.packed.height });
    const index = regions.length;
    regions.push(freeze({ pageIndex, packed, logicalWidth: value.logicalWidth, logicalHeight: value.logicalHeight,
      trimX: value.trimX, trimY: value.trimY, quarterTurn: value.quarterTurn }));
    const entries = owner ?? new Map<string, number>();
    entries.set(key, index); if (owner === undefined) regionIndexes.set(image, entries);
    return index;
  }
  function geometryIndex(geometry: Geometry): number {
    const found = geometryIndexes.get(geometry);
    if (found !== undefined) return found;
    budget.metadataBytes(8);
    const index = geometries.length;
    geometries.push(geometry); geometryIndexes.set(geometry, index);
    return index;
  }
  function barrier(reason: SharedBarrierCommand2D['reason'], pair: Boundary): void {
    budget.emission(undefined, true);
    commands.push(freeze({ kind: 'barrier', ordinal: commands.length, occurrenceId: pair.occurrenceId,
      boundaryId: pair.boundaryId, reason }));
  }
  function open(reason: 'explicit-enter' | 'clip-enter'): Boundary {
    const pair = { occurrenceId: nextOccurrence++, boundaryId: nextBoundary++ };
    barrier(reason, pair);
    return pair;
  }
  function close(explicit: Boundary | undefined, clip: Boundary | undefined): void {
    if (clip !== undefined) barrier('clip-exit', clip);
    if (explicit !== undefined) barrier('explicit-exit', explicit);
  }
  function empty(occurrenceId: number): void { barrier('empty', { occurrenceId, boundaryId: nextBoundary++ }); }
  function drawState(occurrenceId: number, material: SharedMaterial2D, matrix: Matrix2D, opacity: number, clips: ClipChain | undefined) {
    budget.emission(clips, false);
    return { ordinal: commands.length, occurrenceId, materialIndex: materialIndex(material), matrix, opacity, clips: flattenClips(clips) };
  }
  function enter(node: DisplayObject, parent: DisplayObjectContainer | undefined, parentMatrix: Matrix2D,
    parentAlpha: number, inheritedClips: ClipChain | undefined, inheritedMaterial: SharedMaterial2D): void {
    checkNode(node, parent, engine, seen);
    const metadata = admitted.get(node), state = visualOf(node);
    if (metadata === undefined || state.primitives !== metadata.primitives || state.primitives.length !== metadata.primitiveCount
      || bitmapCaptureState(node) !== metadata.bitmap || readMeshState(node) !== metadata.mesh || readTextFieldState(node) !== metadata.text) {
      throw new EgretError('DISPLAY_TREE_INVARIANT');
    }
    const explicit = state.renderBoundary === 'isolate' ? open('explicit-enter') : undefined;
    const alpha = parentAlpha * state.alpha;
    if (!state.visible || state.alpha === 0 || alpha === 0) { close(explicit, undefined); return; }
    if (!finite(alpha)) throw new EgretError('FRAME_TRANSFORM_INVALID');
    const material = state.sharedMaterial ?? inheritedMaterial;
    const matrix = checkedMatrix(composeDisplayTransform(parentMatrix, state));
    let clips = inheritedClips, clip: Boundary | undefined;
    if (state.clipRect !== undefined) {
      const rect = rectangle(matrix, state.clipRect);
      clip = open('clip-enter');
      if (rect.width === 0 || rect.height === 0) { close(explicit, clip); return; }
      clips = { previous: clips, clip: freeze({ matrix, rect }), depth: (clips?.depth ?? 0) + 1 };
    }
    for (let index = 0; index < metadata.primitiveCount; index++) {
      const primitive = metadata.primitives[index]!, occurrenceId = nextOccurrence++;
      const rect = rectangle(matrix, primitive.rect), effective = alpha * primitive.alpha;
      if (rect.width === 0 || rect.height === 0 || effective === 0) { empty(occurrenceId); continue; }
      commands.push(freeze({ kind: 'rect', ...drawState(occurrenceId, material, matrix, alpha, clips),
        rect, fillColor: primitive.color, fillAlpha: primitive.alpha }));
    }
    const bitmap = metadata.bitmap;
    if (bitmap !== undefined) {
      const occurrenceId = nextOccurrence++;
      const rect = rectangle(matrix, bitmapRect(bitmap, material));
      const snapshot = readBitmapImage(bitmap.lease);
      const region = bitmapRegion(bitmap);
      budget.source(snapshot.image);
      const sharedRegionIndex = regionIndex(snapshot.image, region);
      commands.push(freeze({ kind: 'image', ...drawState(occurrenceId, material, matrix, alpha, clips), rect, regionIndex: sharedRegionIndex }));
    }
    const mesh = metadata.mesh;
    if (mesh !== undefined) {
      const occurrenceId = nextOccurrence++, snapshot = readMeshCaptureImage(mesh);
      if (mesh.regionOnly && material.samplingDomain !== 'region') throw new EgretError('SHARED_MATERIAL_UNSUPPORTED');
      referencedTuples(matrix, mesh.geometry);
      budget.source(snapshot.image);
      if (mesh.geometry.indexCount === 0) empty(occurrenceId);
      else {
        const sharedRegionIndex = regionIndex(snapshot.image, mesh.viewRegion ?? plainRegion(mesh.sourceRect));
        const sharedGeometryIndex = geometryIndex(mesh.geometry);
        commands.push(freeze({ kind: 'mesh', ...drawState(occurrenceId, material, matrix, alpha, clips),
          regionIndex: sharedRegionIndex, geometryIndex: sharedGeometryIndex }));
      }
    }
    const text = metadata.text;
    if (text !== undefined) {
      assertTextFieldScope(text.scope);
      const committed = text.committed;
      if (committed !== undefined) {
        const occurrenceId = nextOccurrence++;
        if (committed.lease === undefined || committed.raster === undefined || committed.sourceRect === undefined) empty(occurrenceId);
        else {
          const rect = rectangle(matrix, committed.raster), snapshot = readBitmapImage(committed.lease);
          budget.source(snapshot.image);
          if (rect.width === 0 || rect.height === 0) empty(occurrenceId);
          else {
            const sharedRegionIndex = regionIndex(snapshot.image, snapshot.viewRegion ?? plainRegion(committed.sourceRect));
            commands.push(freeze({ kind: 'image', ...drawState(occurrenceId, material, matrix, alpha, clips), rect, regionIndex: sharedRegionIndex }));
          }
        }
      }
    }
    stack.push({ node, children: childCountOf(node), nextChild: 0, matrix, alpha, clips, material, explicit, clip });
  }

  enter(stage, undefined, identity, 1, undefined, defaultMaterial);
  while (stack.length !== 0) {
    const cursor = stack[stack.length - 1]!;
    if (cursor.nextChild === cursor.children) { close(cursor.explicit, cursor.clip); stack.pop(); continue; }
    const child = childAtOf(cursor.node, cursor.nextChild++);
    if (child === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
    enter(child, cursor.node as DisplayObjectContainer, cursor.matrix, cursor.alpha, cursor.clips, cursor.material);
  }
  engine.assertOpen();
  return freeze({ commands: freeze(commands), pages: freeze(pages), regions: freeze(regions),
    materials: freeze(materials), geometries: freeze(geometries) });
}
