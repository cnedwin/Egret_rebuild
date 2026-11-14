import { createSharedMaterial2D, isSharedGeometry2D, isTexturedGeometry2D } from '@egret/contracts';
import type { ClipRectangle2D, ImageData2D, Matrix2D, Rectangle2D, SharedBarrierCommand2D, SharedGlow2D,
  SharedGeometry2D, SharedMaterial2D, SharedPage2D, SharedRegion2D, SharedRenderCommand2D,
  TexturedGeometry2D, TextureRegion2D, TextureViewRegion2D } from '@egret/contracts';
import type { Stage } from './Stage.js';
import type { DisplayObject } from './DisplayObject.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { EngineContext } from './ownership.js';
import type { Primitive, VisualState } from './displayVisualState.js';
import type { BitmapCaptureState, BitmapCaptureView } from './bitmapDisplayState.js';
import type { MeshCaptureState } from './meshDisplayState.js';
import type { TextFieldDisplayState } from './textDisplayState.js';
import { assertLive, childAtOf, childCountOf, isDisplayNode, isStageRoot, parentOf } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { finite, visualOf } from './displayVisualState.js';
import { composeDisplayTransform } from './displayTransform.js';
import { bitmapCaptureState, readBitmapImage, readBitmapSource } from './Bitmap.js';
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
/** `charged` is the number of the capture that last charged every clip of the chain. */
interface ClipChain { readonly previous: ClipChain | undefined; readonly clip: ClipRectangle2D; readonly depth: number; flat: readonly ClipRectangle2D[] | undefined; charged: number; }
interface Boundary { readonly occurrenceId: number; readonly boundaryId: number; }
/** One node of the walk. `drawn` is false below a node that is not drawn and after a refusal of visible content. */
interface Cursor {
  readonly node: DisplayObject; readonly children: number; nextChild: number;
  readonly drawn: boolean; readonly matrix: Matrix2D; readonly alpha: number; readonly clips: ClipChain | undefined;
  readonly material: SharedMaterial2D; readonly explicit: Boundary | undefined; readonly clip: Boundary | undefined; readonly effect: Boundary | undefined;
}
/**
 * What the capture keeps of one node between frames: records it derived from values that have not changed
 * since. Each record is kept with the very values it was derived from, and is used again only while they are
 * the same values, so a frame captured with kept records holds what a frame captured without them holds.
 * Nothing kept stands for a check: every node is admitted, charged and read for every frame.
 *
 * A node is at rest when everything its commands were derived from is as it was when it last gave them: no
 * change was recorded for it, what it inherits is the same, its first command has the same place, and the
 * tables hold its material and its region at the same places. A node at rest gives those commands again
 * and nothing is derived for it. It is still counted, checked and charged, and its lease is still read.
 */
interface NodeCapture {
  // The matrix of the node, from its parent's matrix and its own seven numbers.
  parentMatrix: Matrix2D | undefined; x: number; y: number; scaleX: number; scaleY: number; rotation: number; anchorOffsetX: number; anchorOffsetY: number;
  matrix: Matrix2D | undefined;
  // The clip of the node, from its clip rectangle, its matrix and the clips above it; null for a rectangle without area.
  clipSource: Rectangle2D | undefined; clipMatrix: Matrix2D | undefined; clipAbove: ClipChain | undefined; clipChain: ClipChain | null;
  // The rectangles of its primitives, from the list of primitives, which only grows or is replaced, and its matrix.
  primitives: readonly Primitive[] | undefined; rectsMatrix: Matrix2D | undefined; rects: Rectangle2D[];
  // The rectangle and the region of its bitmap, from the bitmap's state, which is replaced when it changes.
  bitmap: BitmapCaptureState | undefined; bitmapMatrix: Matrix2D | undefined; bitmapDomain: string | undefined; bitmapRect: Rectangle2D | undefined;
  regionOf: BitmapCaptureState | undefined; region: TextureViewRegion2D | undefined; regionHash: number;
  // The commands it last gave, in order. One is given again when every value in it would be the same.
  commands: SharedRenderCommand2D[];
  // The rest of the node: the count of recorded changes at which it last gave `restCount` draws and nothing else,
  // -1 when it has not; what it inherited, with `parentMatrix`; the place of its first command; and what it gave on.
  restChanges: number; restParentAlpha: number; restClips: ClipChain | undefined; restInherited: SharedMaterial2D | undefined;
  restOrdinal: number; restOccurrence: number; restCount: number; restUnits: number; restChildless: boolean;
  restAlpha: number; restMaterial: SharedMaterial2D | undefined;
  // The places of its material and its region in the tables, with the values the tables held there. No image is kept.
  restMaterialIndex: number; restTableMaterial: SharedMaterial2D | undefined;
  restRegionIndex: number; restTableRegion: TextureViewRegion2D | undefined;
}
function nodeCapture(): NodeCapture {
  return { parentMatrix: undefined, x: 0, y: 0, scaleX: 0, scaleY: 0, rotation: 0, anchorOffsetX: 0, anchorOffsetY: 0, matrix: undefined,
    clipSource: undefined, clipMatrix: undefined, clipAbove: undefined, clipChain: null, primitives: undefined, rectsMatrix: undefined, rects: [],
    bitmap: undefined, bitmapMatrix: undefined, bitmapDomain: undefined, bitmapRect: undefined, regionOf: undefined, region: undefined, regionHash: 0, commands: [],
    restChanges: -1, restParentAlpha: 0, restClips: undefined, restInherited: undefined, restOrdinal: 0, restOccurrence: 0, restCount: 0, restUnits: 0, restChildless: false,
    restAlpha: 0, restMaterial: undefined, restMaterialIndex: -1, restTableMaterial: undefined, restRegionIndex: -1, restTableRegion: undefined };
}
const is = Object.is;
const freeze = Object.freeze;
const defaultMaterial = createSharedMaterial2D({});
/** The glow or outline of an effect as the frame carries it: one kind of spread from the alpha of the group. */
type Effect = NonNullable<VisualState['renderEffect']>;
const glows = new WeakMap<Effect, SharedGlow2D | undefined>();
function effectGlow(settings: Effect): SharedGlow2D | undefined {
  if (glows.has(settings)) return glows.get(settings);
  const g = settings.glow, o = settings.outline;
  const value = g !== undefined ? freeze({ kind: 'glow' as const, color: g.color, alpha: g.alpha ?? 1, spread: g.blur ?? 6, strength: g.strength ?? 2, inner: g.inner === true, knockout: g.knockout === true, offsetX: g.offsetX ?? 0, offsetY: g.offsetY ?? 0 })
    : o !== undefined ? freeze({ kind: 'outline' as const, color: o.color, alpha: o.alpha ?? 1, spread: o.width, strength: 1, inner: false, knockout: false, offsetX: 0, offsetY: 0 }) : undefined;
  glows.set(settings, value);
  return value;
}
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
  /** `capture` is the number of the capture this budget is for. */
  public constructor(private readonly capture: number) {}

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
    // 64 MiB of distinct pages in one frame. A Host may be configured to admit less.
    const source = debit(this.sourceBytes, value.byteLength, 67108864, 'FRAME_IMAGE_BUDGET');
    const canonical = debit(this.canonicalBytes, value.byteLength, 67108864, 'FRAME_IMAGE_BUDGET');
    this.sourceBytes = source; this.canonicalBytes = canonical;
    this.sourceOwners.add(value);
  }
  public metadataBytes(bytes: number): void { this.metadata = debit(this.metadata, bytes, 33554432); }
  public emission(clips: ClipChain | undefined, barrier: boolean): void {
    const count = barrier ? 0 : clips?.depth ?? 0;
    this.commands = debit(this.commands, 1, 65536);
    this.clipReferences = debit(this.clipReferences, count, 262144);
    this.metadataBytes(8 + (barrier ? 64 : 192 + 24 + 8 * count));
    if (!barrier && clips !== undefined && clips.charged !== this.capture) {
      for (let cursor: ClipChain | undefined = clips; cursor !== undefined; cursor = cursor.previous) {
        if (this.clipOwners.has(cursor.clip)) continue;
        this.metadataBytes(80);
        this.clipOwners.add(cursor.clip);
      }
      clips.charged = this.capture;
    }
  }
  /**
   * The charges of `count` draws under one clip chain, as `emission` makes them one by one: all of them, or
   * none and false when one would not fit, so that the draws are then charged one by one and refuse where they do.
   */
  public draws(count: number, clips: ClipChain | undefined): boolean {
    const depth = clips?.depth ?? 0;
    let owners = 0;
    if (clips !== undefined && clips.charged !== this.capture) for (let cursor: ClipChain | undefined = clips; cursor !== undefined; cursor = cursor.previous) if (!this.clipOwners.has(cursor.clip)) owners++;
    const references = count * depth, bytes = count * (8 + 192 + 24 + 8 * depth) + 80 * owners;
    if (count > 65536 - this.commands || references > 262144 - this.clipReferences || bytes > 33554432 - this.metadata) return false;
    this.commands += count; this.clipReferences += references; this.metadata += bytes;
    if (clips !== undefined && clips.charged !== this.capture) {
      for (let cursor: ClipChain | undefined = clips; cursor !== undefined; cursor = cursor.previous) this.clipOwners.add(cursor.clip);
      clips.charged = this.capture;
    }
    return true;
  }
}

interface TreeView {
  count(node: DisplayObject): number;
  child(node: DisplayObject, index: number): DisplayObject | undefined;
  parent(node: DisplayObject): DisplayObjectContainer | undefined;
}
const liveTree: TreeView = {count:childCountOf,child:childAtOf,parent:parentOf};

// Every capture has a number of its own, which it leaves on each node it visits.
let captures = 0;
/** The checks of one node, and its state. `capture` is the number of this capture: a node it has left that number on was visited before. */
function checkNode(node: DisplayObject, parent: DisplayObjectContainer | undefined, engine: EngineContext, capture: number, tree: TreeView): VisualState {
  if (!isDisplayNode(node)) throw new EgretError('DISPLAY_TREE_INVARIANT');
  const state = visualOf(node);
  if (state.seenBy === capture || tree.parent(node) !== parent) throw new EgretError('DISPLAY_TREE_INVARIANT');
  assertLive(node);
  if (engineOf(node) !== engine) throw new EgretError('ENGINE_MISMATCH');
  state.seenBy = capture;
  return state;
}

function checkedMatrix(matrix: Matrix2D): Matrix2D {
  if (!finite(matrix.a) || !finite(matrix.b) || !finite(matrix.c) || !finite(matrix.d) || !finite(matrix.tx) || !finite(matrix.ty)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  return freeze(matrix);
}
function point(matrix: Matrix2D, x: number, y: number): void {
  if (!finite(x) || !finite(y) || !finite(matrix.a * x + matrix.c * y + matrix.tx)
    || !finite(matrix.b * x + matrix.d * y + matrix.ty)) throw new EgretError('FRAME_TRANSFORM_INVALID');
}
/** The checks of `rectangle`: the four corners of `rect` placed by `matrix` are finite. */
function checkRectangle(matrix: Matrix2D, rect: Rectangle2D): void {
  const right = rect.x + rect.width, bottom = rect.y + rect.height;
  if (!finite(right) || !finite(bottom)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  point(matrix, rect.x, rect.y); point(matrix, right, rect.y);
  point(matrix, right, bottom); point(matrix, rect.x, bottom);
}
function rectangle(matrix: Matrix2D, rect: Rectangle2D): Rectangle2D {
  checkRectangle(matrix, rect);
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
const noClips: readonly ClipRectangle2D[] = freeze([]);
/** Draws under one clip chain share one frozen list; draws under none share the empty one. */
function flattenClips(chain: ClipChain | undefined): readonly ClipRectangle2D[] {
  if (chain === undefined) return noClips;
  if (chain.flat !== undefined) return chain.flat;
  const result = new Array<ClipRectangle2D>(chain.depth);
  for (let cursor: ClipChain | undefined = chain; cursor !== undefined; cursor = cursor.previous) result[cursor.depth - 1] = cursor.clip;
  return chain.flat = freeze(result);
}
function materialKey(material: SharedMaterial2D): string {
  const light = material.light, dark = material.dark;
  return light[0] + ',' + light[1] + ',' + light[2] + ',' + light[3] + ';'
    + dark[0] + ',' + dark[1] + ',' + dark[2] + ';' + material.blend + ';' + material.samplingDomain
    + ';' + material.filter + ';' + material.addressU + ';' + material.addressV + ';' + material.regionIsolation
    + ';' + material.mipLevel + ';' + material.minFilter + ';' + material.magFilter + ';' + material.maxAnisotropy;
}
/** Two numbers that print the same: equal, or both not a number. Either zero prints as "0". */
function sameNumber(a: number, b: number): boolean { return a === b || (a !== a && b !== b); }
/** Regions with the same nine numbers get the same value; the table compares the numbers themselves. */
function regionHash(region: TextureViewRegion2D): number {
  const packed = region.packed;
  let hash = packed.x | 0;
  hash = Math.imul(hash, 31) + (packed.y | 0); hash = Math.imul(hash, 31) + (packed.width | 0); hash = Math.imul(hash, 31) + (packed.height | 0);
  hash = Math.imul(hash, 31) + (region.logicalWidth | 0); hash = Math.imul(hash, 31) + (region.logicalHeight | 0);
  hash = Math.imul(hash, 31) + (region.trimX | 0); hash = Math.imul(hash, 31) + (region.trimY | 0);
  return Math.imul(hash, 31) + (region.quarterTurn | 0) | 0;
}
function sameRegion(recorded: SharedRegion2D, value: TextureViewRegion2D): boolean {
  const a = recorded.packed, b = value.packed;
  return sameNumber(a.x, b.x) && sameNumber(a.y, b.y) && sameNumber(a.width, b.width) && sameNumber(a.height, b.height)
    && sameNumber(recorded.logicalWidth, value.logicalWidth) && sameNumber(recorded.logicalHeight, value.logicalHeight)
    && sameNumber(recorded.trimX, value.trimX) && sameNumber(recorded.trimY, value.trimY) && sameNumber(recorded.quarterTurn, value.quarterTurn);
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

/**
 * Iterative capture. All mutable owners stay inside this invocation, except what each node keeps of its own
 * derived records.
 */
export function collectSharedFrameContent(stage: Stage): CapturedSharedContent2D {
  return captureSharedContent(stage, bitmapCaptureState, liveTree, true);
}

/** The same capture with nothing kept read or written: every record is derived anew. Never forwarded by a package root. */
export function collectFreshSharedFrameContent(stage: Stage): CapturedSharedContent2D {
  return captureSharedContent(stage, bitmapCaptureState);
}

/** Runtime-private fixed Bitmap assembly; never forwarded by a package root. */
export function collectPreparedSharedFrameContent(stage: Stage, view: BitmapCaptureView): CapturedSharedContent2D {
  return captureSharedContent(stage, view.read);
}

/** Private single-edge overlay; ordinary capture always uses the unchanged live readers. */
export function collectSubtreeSharedFrameContent(stage: Stage, target: DisplayObjectContainer, candidate: DisplayObject): CapturedSharedContent2D {
  const tree:TreeView={count:node=>node===target?1:childCountOf(node),
    child:(node,index)=>node===target?(index===0?candidate:undefined):childAtOf(node,index),
    parent:node=>node===candidate?target:parentOf(node)};
  return captureSharedContent(stage,bitmapCaptureState,tree);
}

/**
 * One walk of the whole tree. Each node is first admitted: counted, checked and charged whether or not it is
 * drawn. A node that is drawn then contributes its commands. A refusal of visible content does not end the
 * walk: the rest of the tree is still admitted, because an admission refusal anywhere outranks it, and the
 * first refusal of visible content is reported only once the whole tree has been admitted.
 */
function captureSharedContent(stage: Stage, readBitmap: BitmapCaptureView['read'], tree: TreeView = liveTree, keeping = false): CapturedSharedContent2D {
  if (!isStageRoot(stage)) throw new EgretError('FRAME_STAGE_INVALID');
  const engine = engineOf(stage)!;
  engine.assertOpen();
  // Captures are numbered from one; a node or a clip chain that no capture has reached holds zero.
  const capture = ++captures, budget = new CaptureBudget(capture);
  const commands: SharedRenderCommand2D[] = [], pages: SharedPage2D[] = [], regions: SharedRegion2D[] = [];
  const materials: SharedMaterial2D[] = [], geometries: Geometry[] = [];
  const pageIndexes = new Map<ImageData2D, number>(), regionIndexes = new Map<ImageData2D, Map<number, number[]>>();
  // The value each region of the table was made from: a kept value met again is that region, with no number compared.
  const regionValues: TextureViewRegion2D[] = [];
  const materialIndexes = new Map<string, number>(), materialObjects = new Map<SharedMaterial2D, number>(), geometryIndexes = new Map<Geometry, number>();
  const stack: Cursor[] = [];
  let nextOccurrence = 0, nextBoundary = 0, refused = false, refusal: unknown;

  function materialIndex(material: SharedMaterial2D): number {
    // The same object within one capture has the same complete value, so its key is built once.
    const known = materialObjects.get(material);
    if (known !== undefined) return known;
    const key = materialKey(material), found = materialIndexes.get(key);
    if (found !== undefined) { materialObjects.set(material, found); return found; }
    debit(materials.length, 1, 256);
    budget.metadataBytes(192 + 8);
    const index = materials.length;
    materials.push(material); materialIndexes.set(key, index); materialObjects.set(material, index);
    return index;
  }
  function regionIndex(image: ImageData2D, value: TextureViewRegion2D, hash = regionHash(value)): number {
    const owner = regionIndexes.get(image), bucket = owner?.get(hash);
    if (bucket !== undefined) for (let position = 0; position < bucket.length; position++) {
      const candidate = bucket[position]!;
      if (regionValues[candidate] === value || sameRegion(regions[candidate]!, value)) return candidate;
    }
    // 4,096 distinct regions in one frame. A Host may be configured to admit fewer.
    debit(regions.length, 1, 4096, 'FRAME_IMAGE_BUDGET');
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
    regionValues.push(value);
    const entries = owner ?? new Map<number, number[]>();
    if (bucket === undefined) entries.set(hash, [index]); else bucket.push(index);
    if (owner === undefined) regionIndexes.set(image, entries);
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
  function close(explicit: Boundary | undefined, clip: Boundary | undefined, effect?: Boundary): void {
    if(effect!==undefined)barrier('effect-exit',effect);
    if (clip !== undefined) barrier('clip-exit', clip);
    if (explicit !== undefined) barrier('explicit-exit', explicit);
  }
  function empty(occurrenceId: number): void { barrier('empty', { occurrenceId, boundaryId: nextBoundary++ }); }
  function push(node: DisplayObject, drawn: boolean, matrix: Matrix2D, alpha: number, clips: ClipChain | undefined, material: SharedMaterial2D,
    explicit: Boundary | undefined, clip: Boundary | undefined, effect: Boundary | undefined): void {
    stack.push({ node, children: tree.count(node), nextChild: 0, drawn, matrix, alpha, clips, material, explicit, clip, effect });
  }
  /** The commands of one drawn node. Returns false when the node and everything below it are not drawn. */
  function draw(node: DisplayObject, state: ReturnType<typeof visualOf>, primitives: readonly Primitive[], primitiveCount: number,
    bitmap: BitmapCaptureState | undefined, mesh: MeshCaptureState | undefined, text: TextFieldDisplayState | undefined,
    parentMatrix: Matrix2D, parentAlpha: number, inheritedClips: ClipChain | undefined, inheritedMaterial: SharedMaterial2D): boolean {
    const firstOrdinal = commands.length, firstOccurrence = nextOccurrence;
    const explicit = state.renderBoundary === 'isolate' ? open('explicit-enter') : undefined;
    const alpha = parentAlpha * state.alpha;
    if (!state.visible || state.alpha === 0 || alpha === 0) { close(explicit, undefined); return false; }
    if (!finite(alpha)) throw new EgretError('FRAME_TRANSFORM_INVALID');
    const material = state.sharedMaterial ?? inheritedMaterial;
    let kept = keeping ? state.sharedCapture as NodeCapture | undefined : undefined;
    let matrix: Matrix2D;
    if (kept !== undefined && kept.parentMatrix === parentMatrix && is(kept.x, state.x) && is(kept.y, state.y) && is(kept.scaleX, state.scaleX) && is(kept.scaleY, state.scaleY)
      && is(kept.rotation, state.rotation) && is(kept.anchorOffsetX, state.anchorOffsetX) && is(kept.anchorOffsetY, state.anchorOffsetY)) matrix = kept.matrix!;
    else {
      matrix = checkedMatrix(composeDisplayTransform(parentMatrix, state));
      if (keeping) {
        if (kept === undefined) state.sharedCapture = kept = nodeCapture();
        kept.parentMatrix = parentMatrix; kept.x = state.x; kept.y = state.y; kept.scaleX = state.scaleX; kept.scaleY = state.scaleY;
        kept.rotation = state.rotation; kept.anchorOffsetX = state.anchorOffsetX; kept.anchorOffsetY = state.anchorOffsetY; kept.matrix = matrix;
      }
    }
    let clips = inheritedClips, clip: Boundary | undefined;
    if (state.clipRect !== undefined) {
      let chain: ClipChain | null;
      if (kept !== undefined && kept.clipSource === state.clipRect && kept.clipMatrix === matrix && kept.clipAbove === clips) chain = kept.clipChain;
      else {
        const rect = rectangle(matrix, state.clipRect);
        chain = rect.width === 0 || rect.height === 0 ? null : { previous: clips, clip: freeze({ matrix, rect }), depth: (clips?.depth ?? 0) + 1, flat: undefined, charged: 0 };
        if (kept !== undefined) { kept.clipSource = state.clipRect; kept.clipMatrix = matrix; kept.clipAbove = clips; kept.clipChain = chain; }
      }
      clip = open('clip-enter');
      if (chain === null) { close(explicit, clip); return false; }
      clips = chain;
    }
    let effect:Boundary|undefined;
    if(state.renderEffect!==undefined){
      const settings=state.renderEffect,mask=settings.alphaMask;
      let maskPageIndex:number|undefined;
      if(mask!==undefined){
        assertLive(mask);if(engineOf(mask)!==engine)throw new EgretError('ENGINE_MISMATCH');
        const binding=readBitmap(mask);if(!binding)throw new EgretError('DISPLAY_EFFECT_MASK_INVALID');
        const image=readBitmapImage(binding.lease).image,region=bitmapRegion(binding),packed=region.packed;
        if(packed.x!==0||packed.y!==0||packed.width!==image.width||packed.height!==image.height||region.quarterTurn!==0||region.trimX!==0||region.trimY!==0||region.logicalWidth!==image.width||region.logicalHeight!==image.height)throw new EgretError('DISPLAY_EFFECT_MASK_UNSUPPORTED');
        budget.source(image);maskPageIndex=regions[regionIndex(image,region)]!.pageIndex;
      }
      effect={occurrenceId:nextOccurrence++,boundaryId:nextBoundary++};
      const glow=effectGlow(settings);
      budget.emission(undefined,true);budget.metadataBytes(128+80*(clips?.depth??0));
      commands.push(freeze({kind:'barrier',ordinal:commands.length,...effect,reason:'effect-enter',effect:freeze({blurRadius:settings.blurRadius??0,maskPageIndex,maskRect:settings.maskRect,matrix,clips:flattenClips(clips),
        ...(settings.colorMatrix===undefined?{}:{colorMatrix:settings.colorMatrix}),...(glow===undefined?{}:{glow})})}));
      // Parent clips apply to the composited result, not intermediate blur taps.
      clips=undefined;
    }
    // The place of the next command among those this node gives, and whether it has given draws alone.
    let given = 0, plain = explicit === undefined && clip === undefined && effect === undefined && mesh === undefined && text === undefined;
    // The places in the tables of the material and the region of its draws.
    let usedMaterial = -1, usedRegion = -1;
    let rects: Rectangle2D[] | undefined;
    // A rectangle's value is its primitive's own; only its checks depend on the matrix. The kept values of the same
    // primitives are given again, each checked under a matrix it was not checked under.
    let rectsChecked = true;
    if (kept !== undefined && primitiveCount !== 0) {
      if (kept.primitives !== primitives) { kept.primitives = primitives; kept.rectsMatrix = matrix; kept.rects = []; }
      else if (kept.rectsMatrix !== matrix) rectsChecked = false;
      rects = kept.rects;
    }
    for (let index = 0; index < primitiveCount; index++) {
      const primitive = primitives[index]!, occurrenceId = nextOccurrence++;
      let rect = rects?.[index];
      if (rect === undefined) { rect = rectangle(matrix, primitive.rect); if (rects !== undefined) rects[index] = rect; }
      else if (!rectsChecked) checkRectangle(matrix, rect);
      const effective = alpha * primitive.alpha;
      if (rect.width === 0 || rect.height === 0 || effective === 0) { empty(occurrenceId); plain = false; continue; }
      budget.emission(clips, false);
      const material2 = materialIndex(material), flat = flattenClips(clips), last = kept?.commands[given];
      usedMaterial = material2;
      if (last !== undefined && last.kind === 'rect' && last.ordinal === commands.length && last.occurrenceId === occurrenceId && last.materialIndex === material2
        && last.matrix === matrix && is(last.opacity, alpha) && last.clips === flat && last.rect === rect && last.fillColor === primitive.color && last.fillAlpha === primitive.alpha) commands.push(last);
      else {
        const command = freeze({ kind: 'rect' as const, ordinal: commands.length, occurrenceId, materialIndex: material2, matrix, opacity: alpha,
          clips: flat, rect, fillColor: primitive.color, fillAlpha: primitive.alpha });
        commands.push(command); if (kept !== undefined) kept.commands[given] = command;
      }
      given++;
    }
    // Only once every kept rectangle has been checked under it does the matrix become theirs.
    if (!rectsChecked) kept!.rectsMatrix = matrix;
    if (bitmap !== undefined) {
      const occurrenceId = nextOccurrence++;
      let rect: Rectangle2D;
      if (kept !== undefined && kept.bitmap === bitmap && kept.bitmapMatrix === matrix && kept.bitmapDomain === material.samplingDomain) rect = kept.bitmapRect!;
      else if (kept !== undefined && kept.bitmap === bitmap && kept.bitmapDomain === material.samplingDomain && kept.bitmapRect !== undefined) {
        // The same bitmap in the same domain has the same rectangle; it is checked under the new matrix.
        rect = kept.bitmapRect; checkRectangle(matrix, rect); kept.bitmapMatrix = matrix;
      } else {
        rect = rectangle(matrix, bitmapRect(bitmap, material));
        if (kept !== undefined) { kept.bitmap = bitmap; kept.bitmapMatrix = matrix; kept.bitmapDomain = material.samplingDomain; kept.bitmapRect = rect; }
      }
      const snapshot = readBitmapImage(bitmap.lease);
      let region: TextureViewRegion2D, hash: number;
      if (kept !== undefined && kept.regionOf === bitmap) { region = kept.region!; hash = kept.regionHash; }
      else {
        region = bitmapRegion(bitmap); hash = regionHash(region);
        if (kept !== undefined) { kept.regionOf = bitmap; kept.region = region; kept.regionHash = hash; }
      }
      budget.source(snapshot.image);
      const sharedRegionIndex = regionIndex(snapshot.image, region, hash);
      budget.emission(clips, false);
      const material2 = materialIndex(material), flat = flattenClips(clips), last = kept?.commands[given];
      usedMaterial = material2; usedRegion = sharedRegionIndex;
      if (last !== undefined && last.kind === 'image' && last.ordinal === commands.length && last.occurrenceId === occurrenceId && last.materialIndex === material2
        && last.matrix === matrix && is(last.opacity, alpha) && last.clips === flat && last.rect === rect && last.regionIndex === sharedRegionIndex) commands.push(last);
      else {
        const command = freeze({ kind: 'image' as const, ordinal: commands.length, occurrenceId, materialIndex: material2, matrix, opacity: alpha,
          clips: flat, rect, regionIndex: sharedRegionIndex });
        commands.push(command); if (kept !== undefined) kept.commands[given] = command;
      }
      given++;
    }
    if (mesh !== undefined) {
      const occurrenceId = nextOccurrence++, snapshot = readMeshCaptureImage(mesh);
      if (mesh.regionOnly && material.samplingDomain !== 'region') throw new EgretError('SHARED_MATERIAL_UNSUPPORTED');
      referencedTuples(matrix, mesh.geometry);
      budget.source(snapshot.image);
      if (mesh.geometry.indexCount === 0) empty(occurrenceId);
      else {
        const sharedRegionIndex = regionIndex(snapshot.image, mesh.viewRegion ?? plainRegion(mesh.sourceRect));
        const sharedGeometryIndex = geometryIndex(mesh.geometry);
        budget.emission(clips, false);
        commands.push(freeze({ kind: 'mesh', ordinal: commands.length, occurrenceId, materialIndex: materialIndex(material), matrix, opacity: alpha,
          clips: flattenClips(clips), regionIndex: sharedRegionIndex, geometryIndex: sharedGeometryIndex }));
      }
    }
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
            budget.emission(clips, false);
            commands.push(freeze({ kind: 'image', ordinal: commands.length, occurrenceId, materialIndex: materialIndex(material), matrix, opacity: alpha,
              clips: flattenClips(clips), rect, regionIndex: sharedRegionIndex }));
          }
        }
      }
    }
    // A node that gave draws alone may rest in the next frame: this is everything those draws were derived from.
    if (kept !== undefined) {
      if (plain) {
        kept.restChanges = state.changes; kept.restParentAlpha = parentAlpha; kept.restClips = inheritedClips; kept.restInherited = inheritedMaterial;
        kept.restOrdinal = firstOrdinal; kept.restOccurrence = firstOccurrence; kept.restCount = given; kept.restUnits = primitiveCount + (bitmap === undefined ? 0 : 1);
        kept.restAlpha = alpha; kept.restMaterial = material;
        kept.restMaterialIndex = usedMaterial; kept.restTableMaterial = usedMaterial < 0 ? undefined : materials[usedMaterial];
        kept.restRegionIndex = usedRegion; kept.restTableRegion = usedRegion < 0 ? undefined : regionValues[usedRegion];
      } else kept.restChanges = -1;
    }
    push(node, true, matrix, alpha, clips, material, explicit, clip, effect);
    if (kept !== undefined && plain) kept.restChildless = stack[stack.length - 1]!.children === 0;
    return true;
  }
  /**
   * The commands of a node at rest, given again. False when a table does not hold its material, or the region
   * of the image its lease now names, at their places yet, when its lease cannot be read, or when the charges
   * of its draws do not fit: nothing has then been done, and the node is drawn as if it had not rested.
   */
  function rest(node: DisplayObject, kept: NodeCapture): boolean {
    const count = kept.restCount, clips = kept.restClips;
    if (count !== 0) {
      if (materials[kept.restMaterialIndex] !== kept.restTableMaterial) return false;
      const place = kept.restRegionIndex;
      if (place >= 0) {
        let image: ImageData2D;
        try { image = readBitmapSource(kept.bitmap!.lease); } catch { return false; }
        // The region of the table at that place is the node's region of this image: the command names the place alone.
        const region = regions[place];
        if (region === undefined || pages[region.pageIndex]!.source !== image
          || (regionValues[place] !== kept.restTableRegion && !sameRegion(region, kept.region!))) return false;
      }
      if (!budget.draws(count, clips)) return false;
      const given = kept.commands;
      for (let index = 0; index < count; index++) commands.push(given[index]!);
      nextOccurrence += count;
    }
    if (!kept.restChildless) push(node, true, kept.matrix!, kept.restAlpha, clips, kept.restMaterial!, undefined, undefined, undefined);
    return true;
  }
  function enter(node: DisplayObject, parent: DisplayObjectContainer | undefined, drawn: boolean, parentMatrix: Matrix2D,
    parentAlpha: number, inheritedClips: ClipChain | undefined, inheritedMaterial: SharedMaterial2D): void {
    // Admission: every node, in walk order, independent of visibility.
    budget.node();
    const state = checkNode(node, parent, engine, capture, tree);
    const kept = keeping && drawn && !refused ? state.sharedCapture as NodeCapture | undefined : undefined;
    // At rest, the node is a sprite or a bitmap as it was, with as many primitives: its units are those it had.
    const resting = kept !== undefined && kept.restChanges === state.changes && kept.parentMatrix === parentMatrix && is(kept.restParentAlpha, parentAlpha)
      && kept.restClips === inheritedClips && kept.restInherited === inheritedMaterial && kept.restOrdinal === commands.length && kept.restOccurrence === nextOccurrence;
    if (resting) { budget.authoring(kept.restUnits); if (rest(node, kept)) return; }
    const primitives = state.primitives, primitiveCount = primitives.length;
    const bitmap = readBitmap(node), mesh = resting ? undefined : readMeshState(node), text = resting ? undefined : readTextFieldState(node);
    if (!resting) {
      budget.authoring(primitiveCount);
      if (bitmap !== undefined) budget.authoring(1);
      if (mesh !== undefined) { budget.authoring(1); budget.geometry(mesh.geometry); }
      if (text?.committed !== undefined) budget.authoring(1);
    }
    if (drawn && !refused) {
      try {
        if (draw(node, state, primitives, primitiveCount, bitmap, mesh, text, parentMatrix, parentAlpha, inheritedClips, inheritedMaterial)) return;
      } catch (cause) { refused = true; refusal = cause; }
    }
    push(node, false, identity, 0, undefined, defaultMaterial, undefined, undefined, undefined);
  }

  enter(stage, undefined, true, identity, 1, undefined, defaultMaterial);
  while (stack.length !== 0) {
    const cursor = stack[stack.length - 1]!;
    if (cursor.nextChild === cursor.children) {
      if (cursor.drawn && !refused) {
        try { close(cursor.explicit, cursor.clip, cursor.effect); } catch (cause) { refused = true; refusal = cause; }
      }
      stack.pop(); continue;
    }
    const child = tree.child(cursor.node, cursor.nextChild++);
    if (child === undefined) throw new EgretError('DISPLAY_TREE_INVARIANT');
    enter(child, cursor.node as DisplayObjectContainer, cursor.drawn, cursor.matrix, cursor.alpha, cursor.clips, cursor.material);
  }
  // The whole tree is admitted. This is where the visible pass used to begin.
  engine.assertOpen();
  if (refused) throw refusal;
  engine.assertOpen();
  return freeze({ commands: freeze(commands), pages: freeze(pages), regions: freeze(regions),
    materials: freeze(materials), geometries: freeze(geometries) });
}
