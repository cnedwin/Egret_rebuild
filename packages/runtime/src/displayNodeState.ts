import type { DisplayObject } from './DisplayObject.js';
import type { DisplayObjectContainer } from './DisplayObjectContainer.js';
import type { Stage } from './Stage.js';
import { EgretError } from './EgretError.js';

// The display tree's own records. displayTreeState is the only module that changes them; the
// visual and managed state read them here, so neither needs to import the tree operations back.
export const nodes = new WeakSet<object>();
export const terminated = new WeakSet<object>();
export const roots = new WeakSet<object>();
export const parents = new WeakMap<DisplayObject, DisplayObjectContainer>();
export const childLists = new WeakMap<DisplayObjectContainer, DisplayObject[]>();

/** Identity-only authentication never reads a forged or proxied Stage. */
export function isStageRoot(value: unknown): value is Stage {
  return roots.has(value as object);
}
export function isDisplayNode(value: object): value is DisplayObject {
  return nodes.has(value);
}
export function isTerminated(node: DisplayObject): boolean {
  return terminated.has(node);
}
export function parentOf(node: DisplayObject): DisplayObjectContainer | undefined {
  return parents.get(node);
}
/** Return a snapshot so callers cannot mutate the authoritative child list. */
export function childrenOf(node: DisplayObject): readonly DisplayObject[] {
  return [...(childLists.get(node as DisplayObjectContainer) ?? [])];
}

/** Callback-free O(1) readers for budgeted traversal; never clone the list. */
export function childCountOf(node: DisplayObject): number {
  return childLists.get(node as DisplayObjectContainer)?.length ?? 0;
}
export function childAtOf(node: DisplayObject, index: number): DisplayObject | undefined {
  return childLists.get(node as DisplayObjectContainer)?.[index];
}

export function assertLive(node: DisplayObject): void {
  if (terminated.has(node)) throw new EgretError('OBJECT_DISPOSED');
}
