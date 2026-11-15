import { assertManagedMutable } from './ui/managedState.js';
import { EgretError } from './EgretError.js';
import { assertLive, isDisplayNode } from './displayTreeState.js';
import { finite } from './displayVisualState.js';
import { engineOf } from './ownership.js';
// Interaction authority is independent of rendering content and public hooks.
const states = new WeakMap();
export function registerDisplayHitNode(node) {
    states.set(node, { touchEnabled: false, hitArea: undefined, touchChildren: undefined });
}
export function registerDisplayHitContainer(node) {
    readDisplayHitState(node).touchChildren = true;
}
/** Genuine identity is checked before any receiver property can be consulted. */
export function readDisplayHitState(receiver) {
    if (!isDisplayNode(receiver))
        throw new EgretError('HIT_TEST_RECEIVER_INVALID');
    const state = states.get(receiver);
    if (state === undefined)
        throw new EgretError('HIT_TEST_RECEIVER_INVALID');
    return state;
}
function live(node) {
    assertManagedMutable(node);
    assertLive(node);
    engineOf(node)?.assertOpen();
}
export function writeDisplayTouchEnabled(receiver, value) {
    const state = readDisplayHitState(receiver), node = receiver;
    live(node);
    if (typeof value !== 'boolean')
        throw new EgretError('HIT_TEST_VALUE_INVALID');
    state.touchEnabled = value;
}
export function readDisplayTouchChildren(receiver) {
    const value = readDisplayHitState(receiver).touchChildren;
    if (value === undefined)
        throw new EgretError('HIT_TEST_RECEIVER_INVALID');
    return value;
}
export function writeDisplayTouchChildren(receiver, value) {
    const state = readDisplayHitState(receiver);
    if (state.touchChildren === undefined)
        throw new EgretError('HIT_TEST_RECEIVER_INVALID');
    const node = receiver;
    live(node);
    if (typeof value !== 'boolean')
        throw new EgretError('HIT_TEST_VALUE_INVALID');
    state.touchChildren = value;
}
/** Read caller fields once in fixed order; source faults never become semantics. */
export function writeDisplayHitArea(receiver, source) {
    const state = readDisplayHitState(receiver), node = receiver;
    live(node);
    if (source === undefined) {
        state.hitArea = undefined;
        return;
    }
    if (source === null || typeof source !== 'object')
        throw new EgretError('HIT_TEST_AREA_INVALID');
    let array;
    try {
        array = Array.isArray(source);
    }
    catch (cause) {
        throw new EgretError('HIT_TEST_AREA_INVALID', { cause });
    }
    if (array)
        throw new EgretError('HIT_TEST_AREA_INVALID');
    let x, y, width, height;
    try {
        const area = source;
        x = area.x;
        y = area.y;
        width = area.width;
        height = area.height;
    }
    catch (cause) {
        // Application EgretError and even undefined throws retain their exact cause.
        throw new EgretError('HIT_TEST_AREA_INVALID', { cause });
    }
    // Successful source reads may terminate or rebind the current node. Their
    // completed reentrant effects stand; this outer admission commits only here.
    live(node);
    if (!finite(x) ||
        !finite(y) ||
        !finite(width) ||
        !finite(height) ||
        width < 0 ||
        height < 0 ||
        !finite(x + width) ||
        !finite(y + height)) {
        throw new EgretError('HIT_TEST_AREA_INVALID');
    }
    state.hitArea = Object.freeze({ x, y, width, height });
}
//# sourceMappingURL=displayHitState.js.map