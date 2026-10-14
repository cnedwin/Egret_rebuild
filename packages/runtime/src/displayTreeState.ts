import type { DisplayObject } from "./DisplayObject.js";
import type { DisplayObjectContainer } from "./DisplayObjectContainer.js";
import type { Stage } from "./Stage.js";
import { EgretError } from "./EgretError.js";

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
}

/** Caller has completed validation; mutation has no subclass callbacks. */
export function attachNode(parent: DisplayObjectContainer, child: DisplayObject): void {
  detachNode(child);
  listOf(parent).push(child);
  parents.set(child, parent);
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
    if (child !== undefined) deleteParent(child);
  }
  list.length = 0;
}

export function setNodeIndex(parent: DisplayObjectContainer, child: DisplayObject, index: number): void {
  const list = listOf(parent);
  if (parentOf(child) !== parent) throw new EgretError("NOT_A_CHILD");
  const previous = list.indexOf(child);
  if (previous < 0) throw new EgretError("DISPLAY_TREE_INVARIANT");
  list.splice(previous, 1);
  list.splice(index, 0, child);
}

export function terminateNode(node: DisplayObject): void {
  terminated.add(node);
  detachNode(node);
}
