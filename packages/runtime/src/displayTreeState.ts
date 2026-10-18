import type { DisplayObject } from "./DisplayObject.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import type { Stage } from "./Stage.js";
import { EgretError } from "./EgretError.js";
import { recordVisualChange, VISUAL_STRUCTURE } from "./displayVisualState.js";
import { invalidateCaptureNode, clearCaptureStage } from "./frameCaptureCache.js";

// Internal state authority: validation/commit never uses overridable getters
// or public removeChild. Public subclass hooks run only during preflight.
const nodes = new WeakSet<object>();
const terminated = new WeakSet<object>();
const roots = new WeakSet<object>();
const parents = new WeakMap<DisplayObject, DisplayObjectContainer>();
const childLists = new WeakMap<DisplayObjectContainer, DisplayObject[]>();
// The batch path uses captured original operations, never caller getters/hooks.
const readChildList = childLists.get.bind(childLists);
const readParent = parents.get.bind(parents);
const deleteParent = parents.delete.bind(parents);
const readStageRoot = roots.has.bind(roots);

export function registerNode(node: DisplayObject): void { nodes.add(node); }
export function registerContainer(node: DisplayObjectContainer): void { childLists.set(node, []); }
/** Authenticate an actual registered container without inspecting its shape. */
export function assertContainer(value: object): void {
  if (readChildList(value as DisplayObjectContainer) === undefined) throw new EgretError("INVALID_DISPLAY_CONTAINER");
}
export function markStageRoot(node: DisplayObject): void { roots.add(node); }
/** Identity-only authentication never reads a forged or proxied Stage. */
export function isStageRoot(value: unknown): value is Stage { return roots.has(value as object); }
export function isDisplayNode(value: object): value is DisplayObject { return nodes.has(value); }
export function isTerminated(node: DisplayObject): boolean { return terminated.has(node); }
export function parentOf(node: DisplayObject): DisplayObjectContainer | undefined { return parents.get(node); }
/** Return a snapshot so callers cannot mutate the authoritative child list. */
export function childrenOf(node: DisplayObject): readonly DisplayObject[] {
  return [...(childLists.get(node as DisplayObjectContainer) ?? [])];
}

/** Callback-free O(1) readers for budgeted traversal; never clone the list. */
export function childCountOf(node: DisplayObject): number { return childLists.get(node as DisplayObjectContainer)?.length ?? 0; }
export function childAtOf(node: DisplayObject, index: number): DisplayObject | undefined { return childLists.get(node as DisplayObjectContainer)?.[index]; }

/** Read the exact direct-child index in O(n), without a snapshot or callbacks. */
export function childIndexOf(parent: DisplayObjectContainer, child: DisplayObject): number {
  const list = readChildList(parent);
  if (list === undefined) throw new EgretError("INVALID_DISPLAY_CONTAINER");
  if (readParent(child) !== parent) throw new EgretError("NOT_A_CHILD");
  // Scan authoritative identity directly; public getters and Array.indexOf are not authority.
  for (let index = 0; index < list.length; index++) {
    if (list[index] === child) return index;
  }
  throw new EgretError("DISPLAY_TREE_INVARIANT");
}

export function assertLive(node: DisplayObject): void {
  if (terminated.has(node)) throw new EgretError("OBJECT_DISPOSED");
}

export function assertAttachable(node: DisplayObject): void {
  assertLive(node);
  if (roots.has(node)) throw new EgretError("STAGE_ROOT_ONLY");
}

export function assertNoCycle(parent: DisplayObjectContainer, child: DisplayObject): void {
  for (let current: DisplayObject | undefined = parent; current !== undefined; current = parentOf(current)) {
    if (current === child) throw new EgretError("DISPLAY_CYCLE");
  }
}

function listOf(parent: DisplayObjectContainer): DisplayObject[] {
  const list = childLists.get(parent);
  if (list === undefined) throw new EgretError("INVALID_DISPLAY_CONTAINER");
  return list;
}

export function detachNode(child: DisplayObject): void {
  const parent = parentOf(child);
  if (parent === undefined) return;
  const list = listOf(parent);
  // Reverse acquisition cleanup commonly removes the tail. Avoid a full
  // search in that case; middle removals retain stable ordering and linear cost.
  const index = list[list.length - 1] === child ? list.length - 1 : list.indexOf(child);
  if (index < 0) throw new EgretError("DISPLAY_TREE_INVARIANT");
  list.splice(index, 1);
  parents.delete(child);
  recordVisualChange(parent, VISUAL_STRUCTURE);
  recordVisualChange(child, VISUAL_STRUCTURE);
}

/** Caller has completed validation; mutation has no subclass callbacks. */
export function attachNode(parent: DisplayObjectContainer, child: DisplayObject): void {
  detachNode(child);
  listOf(parent).push(child);
  parents.set(child, parent);
  recordVisualChange(parent, VISUAL_STRUCTURE);
  recordVisualChange(child, VISUAL_STRUCTURE);
}

export function removeNode(parent: DisplayObjectContainer, child: DisplayObject): void {
  if (parentOf(child) !== parent) throw new EgretError("NOT_A_CHILD");
  detachNode(child);
}

/** Preflight every direct edge, then detach the batch without user callbacks. */
export function detachChildren(parent: DisplayObjectContainer): void {
  const list = readChildList(parent);
  if (list === undefined) throw new EgretError("INVALID_DISPLAY_CONTAINER");
  // No edge changes until the entire private list agrees with parent authority.
  for (let index = 0; index < list.length; index++) {
    const child = list[index];
    if (child === undefined || readParent(child) !== parent) throw new EgretError("DISPLAY_TREE_INVARIANT");
  }
  // Keep descendants, cleanup owners and permanent Engine affinity unchanged.
  for (let index = 0; index < list.length; index++) {
    const child = list[index];
    if (child !== undefined) {
      deleteParent(child);
      recordVisualChange(child, VISUAL_STRUCTURE);
    }
  }
  const changed = list.length !== 0;
  list.length = 0;
  if (changed) recordVisualChange(parent, VISUAL_STRUCTURE);
}

export function setNodeIndex(parent: DisplayObjectContainer, child: DisplayObject, index: number): void {
  const list = listOf(parent);
  if (parentOf(child) !== parent) throw new EgretError("NOT_A_CHILD");
  const previous = list.indexOf(child);
  if (previous < 0) throw new EgretError("DISPLAY_TREE_INVARIANT");
  list.splice(previous, 1);
  list.splice(index, 0, child);
  if (previous !== index) {
    recordVisualChange(parent, VISUAL_STRUCTURE);
    recordVisualChange(child, VISUAL_STRUCTURE);
  }
}

export function terminateNode(node: DisplayObject): void {
  terminated.add(node);
  // Retire derived values before listener cleanup can reenter; no resource cleanup is owned here.
  invalidateCaptureNode(node);
  if (readStageRoot(node)) clearCaptureStage(node as Stage);
  recordVisualChange(node, VISUAL_STRUCTURE);
  detachNode(node);
}


// Indexed insertion has its own captured authority; legacy operations stay unchanged.
const insertionHasNode = nodes.has.bind(nodes);
const insertionIsTerminated = terminated.has.bind(terminated);
const insertionIsRoot = roots.has.bind(roots);
const insertionWriteChildren = childLists.set.bind(childLists);
const insertionWriteParent = parents.set.bind(parents);
const insertionInteger = Number.isInteger;
const InsertionSet = Set;
const insertionSeenHas = Set.prototype.has.call.bind(Set.prototype.has) as (set: Set<unknown>, value: unknown) => boolean;
const insertionSeenAdd = Set.prototype.add.call.bind(Set.prototype.add) as (set: Set<unknown>, value: unknown) => Set<unknown>;

/** Runtime-private records preserve ordered refusals until after Engine selection. */
export interface CapturedInsertionNode {
  readonly node: DisplayObject | undefined;
  readonly actualParent: DisplayObjectContainer | undefined;
  readonly children: readonly DisplayObject[] | undefined;
  readonly genuine: boolean;
  readonly terminated: boolean;
  readonly stageRoot: boolean;
  readonly repeated: boolean;
  readonly edgeAgrees: boolean;
}

export interface CapturedChildInsertion {
  readonly receiver: DisplayObjectContainer;
  readonly child: DisplayObject;
  readonly receiverTree: readonly CapturedInsertionNode[];
  readonly incomingTree: readonly CapturedInsertionNode[];
  readonly receiverAncestors: readonly DisplayObject[];
  readonly repeatedAncestor: boolean;
  readonly targetChildren: readonly DisplayObject[];
  readonly oldParent: DisplayObjectContainer | undefined;
  readonly sourceChildren: readonly DisplayObject[] | undefined;
  readonly sourceEdges: readonly CapturedInsertionNode[];
  readonly sourceContainerGenuine: boolean;
  readonly oldIndex: number;
}

/** The publication port receives fully allocated replacements, never public tokens. */
export interface PreparedInsertionTree {
  readonly capture: CapturedChildInsertion;
  readonly effectiveIndex: number;
  readonly targetReplacement: DisplayObject[] | undefined;
  readonly sourceReplacement: DisplayObject[] | undefined;
  readonly parentChanged: boolean;
}

function copyInsertionList(list: readonly DisplayObject[]): DisplayObject[] {
  const snapshot: DisplayObject[] = [];
  for (let index = 0; index < list.length; index++) snapshot[index] = list[index]!;
  return snapshot;
}

function captureInsertionNode(
  node: DisplayObject | undefined,
  edgeParent: DisplayObjectContainer | undefined,
  repeated: boolean,
): CapturedInsertionNode {
  const genuine = insertionHasNode(node as object);
  const actualParent = readParent(node as DisplayObject);
  const actualChildren = readChildList(node as DisplayObjectContainer);
  const children = actualChildren === undefined ? undefined : copyInsertionList(actualChildren);
  let edgeAgrees = edgeParent === undefined || actualParent === edgeParent;
  if (edgeParent !== undefined && insertionIsRoot(node as object)) edgeAgrees = false;
  // A captured root's external direct edge must also agree with its real parent list.
  if (edgeParent === undefined && actualParent !== undefined) {
    const parentChildren = readChildList(actualParent);
    let occurrences = 0;
    if (parentChildren !== undefined) {
      for (let index = 0; index < parentChildren.length; index++) if (parentChildren[index] === node) occurrences++;
    }
    edgeAgrees = parentChildren !== undefined && occurrences === 1;
  }
  return {
    node, actualParent, children, genuine,
    terminated: insertionIsTerminated(node as object),
    stageRoot: insertionIsRoot(node as object),
    repeated, edgeAgrees,
  };
}

function captureInsertionTree(root: DisplayObject): CapturedInsertionNode[] {
  const records: CapturedInsertionNode[] = [];
  const pending: { readonly node: DisplayObject | undefined; readonly parent: DisplayObjectContainer | undefined }[] = [
    { node: root, parent: undefined },
  ];
  const seen = new InsertionSet<unknown>();
  while (pending.length !== 0) {
    const current = pending[pending.length - 1]!;
    pending.length--;
    const repeated = insertionSeenHas(seen, current.node);
    insertionSeenAdd(seen, current.node);
    const record = captureInsertionNode(current.node, current.parent, repeated);
    records[records.length] = record;
    // Record bad/repeated edges without throwing or following them indefinitely.
    if (!record.genuine || repeated || record.children === undefined) continue;
    for (let index = 0; index < record.children.length; index++) {
      pending[pending.length] = { node: record.children[index], parent: record.node as DisplayObjectContainer };
    }
  }
  return records;
}

/** Capture the complete posthook authority once, without semantic refusals or hooks. */
export function captureChildInsertion(receiver: DisplayObjectContainer, child: DisplayObject): CapturedChildInsertion {
  const receiverTree = captureInsertionTree(receiver);
  const incomingTree = captureInsertionTree(child);
  const receiverAncestors: DisplayObject[] = [];
  const seenAncestors = new InsertionSet<unknown>();
  let repeatedAncestor = false;
  for (let current: DisplayObject | undefined = receiver; current !== undefined; current = readParent(current)) {
    if (insertionSeenHas(seenAncestors, current)) { repeatedAncestor = true; break; }
    insertionSeenAdd(seenAncestors, current);
    receiverAncestors[receiverAncestors.length] = current;
  }
  const targetChildren = receiverTree[0]!.children ?? [];
  const oldParent = incomingTree[0]!.actualParent;
  const distinctSource = oldParent !== undefined && oldParent !== receiver;
  const actualSource = distinctSource ? readChildList(oldParent) : undefined;
  const sourceChildren = actualSource === undefined ? undefined : copyInsertionList(actualSource);
  const sourceEdges: CapturedInsertionNode[] = [];
  const sourceSeen = new InsertionSet<unknown>();
  if (sourceChildren !== undefined) {
    for (let index = 0; index < sourceChildren.length; index++) {
      const node = sourceChildren[index], repeated = insertionSeenHas(sourceSeen, node);
      insertionSeenAdd(sourceSeen, node);
      sourceEdges[index] = captureInsertionNode(node, oldParent, repeated);
    }
  }
  const previousChildren = oldParent === receiver ? targetChildren : sourceChildren;
  let oldIndex = -1;
  if (previousChildren !== undefined) {
    for (let index = 0; index < previousChildren.length; index++) if (previousChildren[index] === child) { oldIndex = index; break; }
  }
  return {
    receiver, child, receiverTree, incomingTree, receiverAncestors, repeatedAncestor,
    targetChildren, oldParent, sourceChildren, sourceEdges,
    sourceContainerGenuine: !distinctSource || actualSource !== undefined,
    oldIndex,
  };
}

/** Inclusive index checks never coerce boxed, string or other caller values. */
export function assertChildInsertionIndex(receiver: DisplayObjectContainer, index: number): void {
  if (typeof index !== "number" || !insertionInteger(index) || index < 0 || index > (readChildList(receiver)?.length ?? 0)) {
    throw new EgretError("INVALID_INDEX");
  }
}

/** Engine openness is checked by ownership before these ordered root semantics. */
export function validateCapturedInsertionRoots(capture: CapturedChildInsertion, index: number): void {
  const receiver = capture.receiverTree[0]!, child = capture.incomingTree[0]!;
  if (receiver.terminated) throw new EgretError("OBJECT_DISPOSED");
  if (child.terminated) throw new EgretError("OBJECT_DISPOSED");
  if (child.stageRoot) throw new EgretError("STAGE_ROOT_ONLY");
  for (let position = 0; position < capture.receiverAncestors.length; position++) {
    if (capture.receiverAncestors[position] === capture.child) throw new EgretError("DISPLAY_CYCLE");
  }
  if (typeof index !== "number" || !insertionInteger(index) || index < 0 || index > capture.targetChildren.length) {
    throw new EgretError("INVALID_INDEX");
  }
}

/** Identity, life and edge checks precede the corresponding recorded affinity check. */
export function validateCapturedInsertionNode(record: CapturedInsertionNode): void {
  if (!record.genuine) throw new EgretError("DISPLAY_TREE_INVARIANT");
  if (record.terminated) throw new EgretError("OBJECT_DISPOSED");
  if (record.repeated || !record.edgeAgrees) throw new EgretError("DISPLAY_TREE_INVARIANT");
}

/** Validate every current distinct-source direct edge, including unrelated siblings. */
export function validateCapturedInsertionSource(capture: CapturedChildInsertion): void {
  if (capture.repeatedAncestor || !capture.sourceContainerGenuine) throw new EgretError("DISPLAY_TREE_INVARIANT");
  if (capture.oldParent !== undefined && capture.oldIndex < 0) throw new EgretError("DISPLAY_TREE_INVARIANT");
  for (let index = 0; index < capture.sourceEdges.length; index++) validateCapturedInsertionNode(capture.sourceEdges[index]!);
}

/** Build both replacements solely from the validated capture; no mapping writes occur. */
export function prepareCapturedInsertionTree(capture: CapturedChildInsertion, index: number): PreparedInsertionTree {
  const sameParent = capture.oldParent === capture.receiver;
  const targetCount = capture.targetChildren.length;
  const effectiveIndex = sameParent && index === targetCount ? targetCount - 1 : index === 0 ? 0 : index;
  const targetChanged = !sameParent || capture.oldIndex !== effectiveIndex;
  let targetReplacement: DisplayObject[] | undefined;
  if (targetChanged) {
    targetReplacement = [];
    const nextCount = sameParent ? targetCount : targetCount + 1;
    let readIndex = 0;
    for (let writeIndex = 0; writeIndex < nextCount; writeIndex++) {
      if (writeIndex === effectiveIndex) targetReplacement[writeIndex] = capture.child;
      else {
        if (sameParent && readIndex === capture.oldIndex) readIndex++;
        targetReplacement[writeIndex] = capture.targetChildren[readIndex]!;
        readIndex++;
      }
    }
  }
  let sourceReplacement: DisplayObject[] | undefined;
  if (capture.oldParent !== undefined && !sameParent) {
    sourceReplacement = [];
    const sourceChildren = capture.sourceChildren!;
    for (let readIndex = 0, writeIndex = 0; readIndex < sourceChildren.length; readIndex++) {
      if (readIndex !== capture.oldIndex) sourceReplacement[writeIndex++] = sourceChildren[readIndex]!;
    }
  }
  return { capture, effectiveIndex, targetReplacement, sourceReplacement, parentChanged: !sameParent };
}

/** Publication uses captured native writes only: source, target, then moved parent. */
export function publishCapturedInsertionTree(plan: PreparedInsertionTree): void {
  if (plan.sourceReplacement !== undefined) insertionWriteChildren(plan.capture.oldParent!, plan.sourceReplacement);
  if (plan.targetReplacement !== undefined) insertionWriteChildren(plan.capture.receiver, plan.targetReplacement);
  if (plan.parentChanged) insertionWriteParent(plan.capture.child, plan.capture.receiver);
  // All source/target/edge authority is visible before its allocation-free revisions.
  if (plan.sourceReplacement !== undefined) recordVisualChange(plan.capture.oldParent!, VISUAL_STRUCTURE);
  if (plan.targetReplacement !== undefined) {
    recordVisualChange(plan.capture.receiver, VISUAL_STRUCTURE);
    recordVisualChange(plan.capture.child, VISUAL_STRUCTURE);
  }
}
