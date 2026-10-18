// SPDX-License-Identifier: Apache-2.0
import type { ClipRectangle2D, Matrix2D, Rectangle2D } from '@egret/contracts';
import type { DisplayObject } from './DisplayObject.js';
import type { Stage } from './Stage.js';
import type { VisualState } from './displayVisualState.js';

/** Collector-owned numeric links; no link refers back to a display node. */
export interface CaptureClipChain {
  readonly previous: CaptureClipChain | undefined;
  readonly clip: ClipRectangle2D;
  readonly depth: number;
}
export type CaptureProfile = 'ordinary' | 'textured';
export interface CaptureDerived {
  readonly matrix: Matrix2D;
  readonly ordinaryClips: readonly ClipRectangle2D[] | undefined;
  readonly texturedClips: CaptureClipChain | undefined;
  readonly commandClips: readonly ClipRectangle2D[] | undefined;
  readonly rectangles: readonly Rectangle2D[];
  readonly bitmapMatrix: Matrix2D | undefined;
  readonly bitmapRect: Rectangle2D | undefined;
  readonly textRect: Rectangle2D | undefined;
  readonly meshChecked: boolean;
}
interface MutableDerived {
  matrix: Matrix2D | undefined;
  ordinaryClips: readonly ClipRectangle2D[] | undefined;
  texturedClips: CaptureClipChain | undefined;
  commandClips: readonly ClipRectangle2D[] | undefined;
  rectangles: Rectangle2D[];
  bitmapMatrix: Matrix2D | undefined;
  bitmapRect: Rectangle2D | undefined;
  textRect: Rectangle2D | undefined;
  meshChecked: boolean;
}
interface CaptureKey {
  structure: number; transform: number; appearance: number;
  content: number; binding: number;
  a: number; b: number; c: number; d: number;
  tx: number; ty: number; alpha: number;
  ordinaryClips: readonly ClipRectangle2D[] | undefined;
  texturedClips: CaptureClipChain | undefined;
}
interface NodeSlots { ordinary: CaptureDraft | undefined; textured: CaptureDraft | undefined; }
interface CacheOwner {
  closed: boolean; entries: number; bytes: number;
  head: CaptureDraft | undefined; tail: CaptureDraft | undefined;
}
export interface CaptureSession {
  readonly owner: CacheOwner; readonly profile: CaptureProfile;
  active: boolean; head: CaptureDraft | undefined; tail: CaptureDraft | undefined;
}
/** A bounded pending entry contains values and weak-index cells, never their key. */
export interface CaptureDraft {
  readonly owner: CacheOwner; readonly slots: NodeSlots; readonly profile: CaptureProfile;
  session: CaptureSession | undefined; key: CaptureKey | undefined; data: MutableDerived | undefined;
  seen: Set<object> | undefined; bytes: number;
  ready: boolean; complete: boolean; linked: boolean; replacedWithoutHit: boolean;
  previous: CaptureDraft | undefined; next: CaptureDraft | undefined;
  pendingPrevious: CaptureDraft | undefined; pendingNext: CaptureDraft | undefined;
}

const MAX_ENTRIES = 65536, MAX_BYTES = 16777216;
// Limits cover ready and pending derived entries. Empty weak-index cells do not
// keep nodes alive, and these logical fees do not claim a physical heap limit.
// The replacement marker adds one explicit eight-byte slot to bookkeeping.
// A no-payload probe retains only bookkeeping and the existing scalar key.
const PROBE_BYTES = 264 + 32 + 14 * 8;
const INITIAL_BYTES = PROBE_BYTES + 32 + 9 * 8 + 24;
const owners = new WeakMap<Stage, CacheOwner>(), nodes = new WeakMap<DisplayObject, NodeSlots>();
const readOwner = owners.get.bind(owners), writeOwner = owners.set.bind(owners);
const readSlots = nodes.get.bind(nodes), writeSlots = nodes.set.bind(nodes);
const SAME = Object.is, FREEZE = Object.freeze, Seen = Set;
const seenHas = Set.prototype.has.call.bind(Set.prototype.has) as (set: Set<object>, value: object) => boolean;
const seenAdd = Set.prototype.add.call.bind(Set.prototype.add) as (set: Set<object>, value: object) => Set<object>;
const appendRect = Array.prototype.push.call.bind(Array.prototype.push) as (array: Rectangle2D[], value: Rectangle2D) => number;

function unlinkPending(entry: CaptureDraft): void {
  const session = entry.session;
  if (session === undefined) return;
  if (entry.pendingPrevious === undefined) session.head = entry.pendingNext;
  else entry.pendingPrevious.pendingNext = entry.pendingNext;
  if (entry.pendingNext === undefined) session.tail = entry.pendingPrevious;
  else entry.pendingNext.pendingPrevious = entry.pendingPrevious;
  entry.pendingPrevious = undefined; entry.pendingNext = undefined; entry.session = undefined;
}
function unlink(entry: CaptureDraft): void {
  const owner = entry.owner;
  if (entry.previous === undefined) owner.head = entry.next;
  else entry.previous.next = entry.next;
  if (entry.next === undefined) owner.tail = entry.previous;
  else entry.next.previous = entry.previous;
  entry.previous = undefined; entry.next = undefined;
}
function discard(entry: CaptureDraft): void {
  if (entry.linked) {
    unlink(entry); entry.owner.entries--; entry.owner.bytes -= entry.bytes; entry.linked = false;
  }
  unlinkPending(entry);
  if (entry.slots[entry.profile] === entry) entry.slots[entry.profile] = undefined;
  entry.key = undefined; entry.data = undefined; entry.seen = undefined;
  entry.ready = false; entry.complete = false; entry.replacedWithoutHit = false; entry.bytes = 0;
}
function newest(entry: CaptureDraft): void {
  const owner = entry.owner;
  if (owner.tail === entry) return;
  unlink(entry); entry.previous = owner.tail;
  if (owner.tail === undefined) owner.head = entry;
  else owner.tail.next = entry;
  owner.tail = entry;
}
function room(owner: CacheOwner, bytes: number, entries: number, keep?: CaptureDraft): boolean {
  if (owner.closed || bytes > MAX_BYTES || (keep !== undefined && bytes > MAX_BYTES - keep.bytes)) return false;
  while (entries > MAX_ENTRIES - owner.entries || bytes > MAX_BYTES - owner.bytes) {
    const victim = owner.head === keep ? owner.head?.next : owner.head;
    if (victim === undefined) return false;
    discard(victim);
  }
  return true;
}
function add(entry: CaptureDraft, bytes: number): boolean {
  // Reserve before the measurement set or payload retains another reference.
  if (!room(entry.owner, bytes, 0, entry)) return false;
  entry.owner.bytes += bytes; entry.bytes += bytes; return true;
}
function record(entry: CaptureDraft, value: object, fields: number): boolean {
  const seen = entry.seen!;
  if (seenHas(seen, value)) return true;
  if (!add(entry, 32 + fields * 8)) return false;
  seenAdd(seen, value); return true;
}
function matrixBytes(entry: CaptureDraft, value: Matrix2D): boolean { return record(entry, value, 6); }
function rectBytes(entry: CaptureDraft, value: Rectangle2D): boolean { return record(entry, value, 4); }
function clipBytes(entry: CaptureDraft, value: ClipRectangle2D): boolean {
  return record(entry, value, 2) && matrixBytes(entry, value.matrix) && rectBytes(entry, value.rect);
}
function ordinaryBytes(entry: CaptureDraft, clips: readonly ClipRectangle2D[] | undefined): boolean {
  if (clips === undefined || seenHas(entry.seen!, clips)) return true;
  if (!add(entry, 24 + clips.length * 8)) return false;
  seenAdd(entry.seen!, clips);
  for (let i = 0; i < clips.length; i++) if (!clipBytes(entry, clips[i]!)) return false;
  return true;
}
function texturedBytes(entry: CaptureDraft, clips: CaptureClipChain | undefined): boolean {
  for (let cursor = clips; cursor !== undefined; cursor = cursor.previous) {
    if (seenHas(entry.seen!, cursor)) return true;
    if (!record(entry, cursor, 3) || !clipBytes(entry, cursor.clip)) return false;
  }
  return true;
}
function sameMatrix(left: Matrix2D, right: Matrix2D): boolean {
  return left === right || SAME(left.a, right.a) && SAME(left.b, right.b) && SAME(left.c, right.c)
    && SAME(left.d, right.d) && SAME(left.tx, right.tx) && SAME(left.ty, right.ty);
}
function sameClip(left: ClipRectangle2D, right: ClipRectangle2D): boolean {
  return left === right || sameMatrix(left.matrix, right.matrix)
    && SAME(left.rect.x, right.rect.x) && SAME(left.rect.y, right.rect.y)
    && SAME(left.rect.width, right.rect.width) && SAME(left.rect.height, right.rect.height);
}
function sameOrdinary(left: readonly ClipRectangle2D[] | undefined, right: readonly ClipRectangle2D[] | undefined): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) if (!sameClip(left[i]!, right[i]!)) return false;
  return true;
}
function sameTextured(left: CaptureClipChain | undefined, right: CaptureClipChain | undefined): boolean {
  if (left === right) return true;
  if (left?.depth !== right?.depth) return false;
  while (left !== undefined && right !== undefined) {
    if (left === right) return true;
    if (!sameClip(left.clip, right.clip)) return false;
    left = left.previous; right = right.previous;
  }
  return left === right;
}
function sameRevision(key: CaptureKey, state: VisualState): boolean {
  return key.structure === state.structureRevision && key.transform === state.transformRevision
    && key.appearance === state.appearanceRevision && key.content === state.contentRevision && key.binding === state.bindingRevision;
}

function sameContext(key: CaptureKey, state: VisualState, parent: Matrix2D, alpha: number): boolean {
  return sameRevision(key, state) && SAME(key.a, parent.a) && SAME(key.b, parent.b) && SAME(key.c, parent.c)
    && SAME(key.d, parent.d) && SAME(key.tx, parent.tx) && SAME(key.ty, parent.ty) && SAME(key.alpha, alpha);
}
function linkPending(entry: CaptureDraft, session: CaptureSession): void {
  entry.session = session; entry.pendingPrevious = session.tail;
  if (session.tail === undefined) session.head = entry; else session.tail.pendingNext = entry;
  session.tail = entry;
}
/** Only a successful scalar observation is retained; this state can never be a hit. */
function observeProbe(entry: CaptureDraft, session: CaptureSession, state: VisualState,
  parent: Matrix2D, alpha: number): CaptureDraft {
  const key = entry.key!;
  unlinkPending(entry);
  entry.owner.bytes -= entry.bytes - PROBE_BYTES; entry.bytes = PROBE_BYTES;
  entry.data = undefined; entry.seen = undefined; entry.ready = false; entry.complete = false;
  key.ordinaryClips = undefined; key.texturedClips = undefined;
  key.structure = state.structureRevision; key.transform = state.transformRevision;
  key.appearance = state.appearanceRevision; key.content = state.contentRevision; key.binding = state.bindingRevision;
  key.a = parent.a; key.b = parent.b; key.c = parent.c; key.d = parent.d;
  key.tx = parent.tx; key.ty = parent.ty; key.alpha = alpha;
  newest(entry); linkPending(entry, session); return entry;
}

/** Optional metadata allocation cannot turn an otherwise valid capture into a refusal. */
export function beginCaptureSession(stage: Stage, profile: CaptureProfile): CaptureSession | undefined {
  try {
    let owner = readOwner(stage);
    if (owner === undefined) {
      owner = { closed: false, entries: 0, bytes: 0, head: undefined, tail: undefined }; writeOwner(stage, owner);
    }
    if (owner.closed) return undefined;
    return { owner, profile, active: true, head: undefined, tail: undefined };
  } catch { return undefined; }
}
export function readCaptureDerived(session: CaptureSession | undefined, node: DisplayObject, state: VisualState,
  parent: Matrix2D, alpha: number, ordinaryClips: readonly ClipRectangle2D[] | undefined,
  texturedClips: CaptureClipChain | undefined): CaptureDerived | undefined {
  if (session === undefined || !session.active || session.owner.closed) return undefined;
  const entry = readSlots(node)?.[session.profile], key = entry?.key;
  if (entry === undefined || key === undefined || !entry.ready || entry.owner !== session.owner || entry.data === undefined) return undefined;
  if (!sameContext(key, state, parent, alpha)
    || !sameOrdinary(key.ordinaryClips, ordinaryClips) || !sameTextured(key.texturedClips, texturedClips)) return undefined;
  entry.replacedWithoutHit = false;
  newest(entry); return entry.data as CaptureDerived;
}

export function beginCaptureNode(session: CaptureSession | undefined, node: DisplayObject, state: VisualState,
  parent: Matrix2D, alpha: number, ordinaryClips: readonly ClipRectangle2D[] | undefined,
  texturedClips: CaptureClipChain | undefined): CaptureDraft | undefined {
  if (session === undefined || !session.active || session.owner.closed) return undefined;
  let entry: CaptureDraft | undefined;
  let reserved = false;
  try {
    let slots = readSlots(node);
    if (slots === undefined) { slots = { ordinary: undefined, textured: undefined }; writeSlots(node, slots); }
    const old = slots[session.profile];
    const replacement = old !== undefined && old.owner === session.owner && old.ready;
    if (replacement && old.key !== undefined
      && (old.data === undefined ? !sameContext(old.key, state, parent, alpha) : old.replacedWithoutHit)) {
      // Two consecutive replacements stop payload churn. A stable probe only
      // permits cold rebuilding below; it never bypasses complete-key matching.
      return observeProbe(old, session, state, parent, alpha);
    }
    const replacedWithoutHit = replacement && old.data !== undefined;
    if (old !== undefined) discard(old);
    if (!room(session.owner, INITIAL_BYTES, 1)) return undefined;
    session.owner.bytes += INITIAL_BYTES; session.owner.entries++; reserved = true;
    const key = { structure: state.structureRevision, transform: state.transformRevision,
      appearance: state.appearanceRevision, content: state.contentRevision, binding: state.bindingRevision,
      a: parent.a, b: parent.b, c: parent.c, d: parent.d, tx: parent.tx, ty: parent.ty, alpha,
      ordinaryClips: undefined as readonly ClipRectangle2D[] | undefined, texturedClips: undefined as CaptureClipChain | undefined };
    const data: MutableDerived = { matrix: undefined, ordinaryClips: undefined, texturedClips: undefined, commandClips: undefined,
      rectangles: [], bitmapMatrix: undefined, bitmapRect: undefined, textRect: undefined, meshChecked: false };
    entry = { owner: session.owner, slots, profile: session.profile, session: undefined, key, data,
      seen: new Seen<object>(), bytes: INITIAL_BYTES, ready: false, complete: false, linked: false, replacedWithoutHit,
      previous: undefined, next: undefined, pendingPrevious: undefined, pendingNext: undefined };
    entry.linked = true; entry.previous = session.owner.tail;
    if (session.owner.tail === undefined) session.owner.head = entry; else session.owner.tail.next = entry;
    session.owner.tail = entry;
    seenAdd(entry.seen!, key); seenAdd(entry.seen!, data); seenAdd(entry.seen!, data.rectangles);
    if (!ordinaryBytes(entry, ordinaryClips) || !texturedBytes(entry, texturedClips)) { discard(entry); return undefined; }
    key.ordinaryClips = ordinaryClips; key.texturedClips = texturedClips; slots[session.profile] = entry;
    linkPending(entry, session); return entry;
  } catch {
    if (entry !== undefined) discard(entry);
    else if (reserved) { session.owner.bytes -= INITIAL_BYTES; session.owner.entries--; }
    return undefined;
  }
}

// Each guarded block handles only optional cache ownership, never collector arithmetic,
// resource qualification, public output allocation or a capture-budget operation.
export function rememberCaptureBase(entry: CaptureDraft | undefined, matrix: Matrix2D,
  ordinaryClips: readonly ClipRectangle2D[] | undefined, texturedClips: CaptureClipChain | undefined): void {
  if (entry?.data === undefined) return;
  try {
    if (!matrixBytes(entry, matrix) || !ordinaryBytes(entry, ordinaryClips) || !texturedBytes(entry, texturedClips)) { discard(entry); return; }
    entry.data.matrix = matrix; entry.data.ordinaryClips = ordinaryClips; entry.data.texturedClips = texturedClips;
  } catch { discard(entry); }
}
export function rememberCaptureRectangle(entry: CaptureDraft | undefined, rect: Rectangle2D): void {
  if (entry?.data === undefined) return;
  try {
    if (!rectBytes(entry, rect) || !add(entry, 8)) { discard(entry); return; }
    appendRect(entry.data.rectangles, rect);
  } catch { discard(entry); }
}
export function rememberCaptureClips(entry: CaptureDraft | undefined, clips: readonly ClipRectangle2D[]): void {
  if (entry?.data === undefined || entry.data.commandClips !== undefined) return;
  try {
    if (!ordinaryBytes(entry, clips)) { discard(entry); return; }
    entry.data.commandClips = clips;
  } catch { discard(entry); }
}
export function rememberCaptureBitmap(entry: CaptureDraft | undefined, matrix: Matrix2D, rect: Rectangle2D): void {
  if (entry?.data === undefined) return;
  try {
    if (!matrixBytes(entry, matrix) || !rectBytes(entry, rect)) { discard(entry); return; }
    entry.data.bitmapMatrix = matrix; entry.data.bitmapRect = rect;
  } catch { discard(entry); }
}
export function rememberCaptureText(entry: CaptureDraft | undefined, rect: Rectangle2D): void {
  if (entry?.data === undefined) return;
  try {
    if (!rectBytes(entry, rect)) { discard(entry); return; }
    entry.data.textRect = rect;
  } catch { discard(entry); }
}
export function rememberCaptureMesh(entry: CaptureDraft | undefined): void { if (entry?.data !== undefined) entry.data.meshChecked = true; }
export function completeCaptureNode(entry: CaptureDraft | undefined, state: VisualState): void {
  if (entry === undefined || entry.key === undefined) return;
  if (!sameRevision(entry.key, state)) { discard(entry); return; }
  // Collector arithmetic and resource checks still completed before this call.
  // Probe publication records only a successful observation, never derived data.
  if (entry.data === undefined) { entry.complete = true; return; }
  if (entry.data.matrix === undefined) { discard(entry); return; }
  try { FREEZE(entry.data.rectangles); FREEZE(entry.data); entry.seen = undefined; entry.complete = true; }
  catch { discard(entry); }
}
export function publishCaptureSession(session: CaptureSession | undefined): void {
  if (session === undefined || !session.active) return;
  while (session.head !== undefined) {
    const entry = session.head;
    if (entry.complete && !session.owner.closed) { unlinkPending(entry); entry.ready = true; }
    else discard(entry);
  }
  session.active = false;
}
export function abandonCaptureSession(session: CaptureSession | undefined): void {
  if (session === undefined || !session.active) return;
  while (session.head !== undefined) discard(session.head);
  session.active = false;
}

/** Mutation/terminal paths only release numeric derived values; no allocation or callback. */
export function invalidateCaptureNode(node: DisplayObject): void {
  const slots = readSlots(node);
  if (slots?.ordinary !== undefined) discard(slots.ordinary);
  if (slots?.textured !== undefined) discard(slots.textured);
}
export function clearCaptureStage(stage: Stage): void {
  const owner = readOwner(stage);
  if (owner === undefined) return;
  owner.closed = true;
  while (owner.head !== undefined) discard(owner.head);
}
