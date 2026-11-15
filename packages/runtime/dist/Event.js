import { EgretError } from "./EgretError.js";
/** Matching uses descriptor object identity; equal key strings do not alias types. */
export function createEventType(key, options = {}) {
    return Object.freeze({ key, bubbles: options.bubbles ?? false, cancelable: options.cancelable ?? false });
}
const states = new WeakMap();
function stateOf(event) {
    const state = states.get(event);
    if (state === undefined)
        throw new EgretError("INVALID_EVENT");
    return state;
}
/** One typed payload with synchronous dispatch state; concurrent reuse is rejected. */
export class Event {
    type;
    payload;
    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
        states.set(this, {
            active: false,
            stopped: false,
            immediate: false,
            prevented: false,
            target: undefined,
            currentTarget: undefined,
            phase: undefined
        });
    }
    get target() {
        return stateOf(this).target;
    }
    get currentTarget() {
        return stateOf(this).currentTarget;
    }
    get eventPhase() {
        return stateOf(this).phase;
    }
    get defaultPrevented() {
        return stateOf(this).prevented;
    }
    stopPropagation() {
        const state = stateOf(this);
        if (state.active)
            state.stopped = true;
    }
    stopImmediatePropagation() {
        const state = stateOf(this);
        if (!state.active)
            return;
        state.stopped = true;
        state.immediate = true;
    }
    preventDefault() {
        const state = stateOf(this);
        if (state.active && this.type.cancelable)
            state.prevented = true;
    }
}
/** Package-internal state operations, omitted from @egret/engine exports. */
export function beginDispatch(event, target) {
    const state = stateOf(event);
    if (state.active)
        throw new EgretError("EVENT_ACTIVE");
    state.active = true;
    state.stopped = false;
    state.immediate = false;
    state.prevented = false;
    state.target = target;
    return state;
}
export function visitDispatch(event, current, phase) {
    const state = stateOf(event);
    state.currentTarget = current;
    state.phase = phase;
}
/** Keep target/defaultPrevented for inspection; clear transient dispatch pointers. */
export function endDispatch(event) {
    const state = stateOf(event);
    state.active = false;
    state.currentTarget = undefined;
    state.phase = undefined;
}
//# sourceMappingURL=Event.js.map