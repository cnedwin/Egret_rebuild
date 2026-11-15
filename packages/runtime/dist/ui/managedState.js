import { EgretError } from '../EgretError.js';
import { childrenOf, parentOf } from '../displayTreeState.js';
const records = new WeakMap();
const terminal = new WeakSet();
/** Only runtime UI construction installs a captured per-wrapper terminal path. */
export function registerManagedWrapper(node, authority, dispose) {
    records.set(node, { authority, dispose });
}
export function isManagedWrapper(node) {
    return records.has(node);
}
export function managedBy(node, authority) {
    return records.get(node)?.authority === authority;
}
export function managedTerminal(node) {
    return terminal.has(node);
}
export function assertManagedMutable(node) {
    if (node !== undefined && records.has(node))
        throw new EgretError('UI_MANAGED_GEOMETRY');
}
export function assertManagedEdgeMutable(parent, child) {
    assertManagedMutable(parent);
    assertManagedMutable(child);
    assertManagedMutable(parentOf(child));
}
export function assertManagedChildrenMutable(parent) {
    assertManagedMutable(parent);
    const children = childrenOf(parent);
    for (let index = 0; index < children.length; index++)
        assertManagedMutable(children[index]);
}
/** Revoke this exact value before callbacks; never unlock another managed value. */
export function cleanupManagedWrapper(value) {
    const record = records.get(value);
    // A tombstone preserves idempotent managed cleanup without retaining its owner or closure.
    if (record === undefined)
        return terminal.has(value);
    records.delete(value);
    terminal.add(value);
    record.dispose();
    return true;
}
//# sourceMappingURL=managedState.js.map