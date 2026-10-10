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

export function registerNode(node: DisplayObject): void { nodes.add(node); }
export function registerContainer(node: DisplayObjectContainer): void { childLists.set(node, []); }
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
  const index = list.indexOf(child);
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
