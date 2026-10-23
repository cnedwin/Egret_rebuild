import { EgretError } from '../EgretError.js';
import type { DisplayObject } from '../DisplayObject.js';
import { childrenOf, parentOf } from '../displayTreeState.js';

interface ManagedRecord { readonly authority: object; readonly dispose: () => void; }
const records = new WeakMap<object, ManagedRecord>();
const terminal = new WeakSet<object>();

/** Only runtime UI construction installs a captured per-wrapper terminal path. */
export function registerManagedWrapper(node: DisplayObject, authority: object, dispose: () => void): void {
  records.set(node, { authority, dispose });
}
export function isManagedWrapper(node: object): boolean { return records.has(node); }
export function managedBy(node: object, authority: object): boolean { return records.get(node)?.authority === authority; }
export function managedTerminal(node: object): boolean { return terminal.has(node); }
export function assertManagedMutable(node: object | undefined): void {
  if (node !== undefined && records.has(node)) throw new EgretError('UI_MANAGED_GEOMETRY');
}
export function assertManagedEdgeMutable(parent: DisplayObject, child: DisplayObject): void {
  assertManagedMutable(parent); assertManagedMutable(child); assertManagedMutable(parentOf(child));
}
export function assertManagedChildrenMutable(parent: DisplayObject): void {
  assertManagedMutable(parent);
  const children = childrenOf(parent);
  for (let index = 0; index < children.length; index++) assertManagedMutable(children[index]);
}
/** Revoke this exact value before callbacks; never unlock another managed value. */
export function cleanupManagedWrapper(value: object): boolean {
  const record = records.get(value);
  // A tombstone preserves idempotent managed cleanup without retaining its owner or closure.
  if (record === undefined) return terminal.has(value);
  records.delete(value);
  terminal.add(value);
  record.dispose();
  return true;
}
