import { recordVisualChange, VISUAL_CONTENT, VISUAL_BINDING } from './displayVisualState.js';
// One authoritative slot table, moved from Bitmap without duplicating geometry.
// Resource references remain type-only; revisions retain no resource ownership.
const states = new WeakMap();
const readPublishedState = states.get.bind(states);
/** A registered cleared slot remains different from an unregistered receiver. */
export function hasBitmapState(value) {
    return states.has(value);
}
/** Read cached metadata only; this port grants no live image entitlement. */
export function readBitmapState(node) {
    return states.get(node);
}
/** Bitmap alone writes its slot, preserving existing mutation/lifetime guards. */
export function writeBitmapState(node, value) {
    const changed = readPublishedState(node) !== value;
    states.set(node, value);
    // Single writes, batch commits and conditional rollback share this publication.
    if (changed)
        recordVisualChange(node, VISUAL_CONTENT | VISUAL_BINDING);
}
//# sourceMappingURL=bitmapDisplayState.js.map