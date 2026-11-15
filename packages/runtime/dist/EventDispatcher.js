import { EgretError } from "./EgretError.js";
import { Event, beginDispatch, endDispatch, visitDispatch } from "./Event.js";
import { engineOf } from "./ownership.js";
import { assertLive, isDisplayNode } from "./displayTreeState.js";
// Input dispatch never establishes listener authority through instance fields.
const dispatcherStates = new WeakMap();
function stateOf(dispatcher) {
    const state = dispatcherStates.get(dispatcher);
    if (state === undefined)
        throw new EgretError("INVALID_EVENT_DISPATCHER");
    return state;
}
function candidatesOf(dispatcher, type, capture) {
    return [...stateOf(dispatcher).subscriptions]
        .filter(entry => entry.type === type && entry.capture === capture)
        .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
}
function isCancelled(signal) {
    return signal?.aborted === true;
}
/** Both routes share ordering, active flags and genuine Event dispatch state. */
function executeDispatch(target, event, route, select) {
    const state = beginDispatch(event, target);
    try {
        const ancestors = route();
        const visits = [];
        for (let index = ancestors.length - 1; index >= 0; index--) {
            const node = ancestors[index];
            if (node !== undefined)
                visits.push({ node, phase: "capturing", candidates: select(node, event.type, true) });
        }
        // Target groups share one visit so stopPropagation preserves both groups.
        visits.push({
            node: target,
            phase: "atTarget",
            candidates: [...select(target, event.type, true), ...select(target, event.type, false)]
        });
        if (event.type.bubbles) {
            for (const node of ancestors)
                visits.push({ node, phase: "bubbling", candidates: select(node, event.type, false) });
        }
        for (const visit of visits) {
            visitDispatch(event, visit.node, visit.phase);
            for (const candidate of visit.candidates) {
                if (state.immediate)
                    break;
                if (!candidate.active)
                    continue;
                // Remove once-listeners before invocation to prevent reentrant duplicates.
                if (candidate.once)
                    candidate.unsubscribe();
                const returned = candidate.invoke(event);
                if (returned !== null &&
                    (typeof returned === "object" || typeof returned === "function") &&
                    "then" in returned &&
                    typeof returned.then === "function") {
                    // Invalid asynchronous handlers must not create an unhandled rejection.
                    void Promise.resolve(returned).catch((cause) => {
                        engineOf(target)?.report({
                            code: "ASYNC_EVENT_HANDLER_REJECTED",
                            phase: "engine",
                            severity: "error",
                            cause
                        });
                    });
                    throw new EgretError("ASYNC_EVENT_HANDLER");
                }
            }
            if (state.stopped)
                break;
        }
        return !state.prevented;
    }
    finally {
        endDispatch(event);
    }
}
/** Internal caller has admitted this complete route through private display state. */
export function dispatchDisplayInputEvent(target, event, ancestors) {
    return executeDispatch(target, event, () => ancestors, candidatesOf);
}
/** Synchronous typed listeners with a frozen route and per-dispatch candidates. */
export class EventDispatcher {
    constructor() {
        dispatcherStates.set(this, { subscriptions: new Set(), nextSequence: 0 });
    }
    assertUsable() { }
    eventParent() {
        return undefined;
    }
    /** Async handlers are excluded by types and rejected if returned at runtime. */
    on(type, handler, options = {}) {
        this.assertUsable();
        const priority = options.priority ?? 0;
        if (!Number.isFinite(priority) || !Number.isInteger(priority))
            throw new EgretError("INVALID_PRIORITY");
        const signal = options.signal;
        if (isCancelled(signal))
            return () => { };
        const state = stateOf(this);
        const subscription = {
            type,
            // Descriptor identity is checked before invoking this erased closure.
            invoke: (event) => handler(event),
            capture: options.capture ?? false,
            once: options.once ?? false,
            priority,
            sequence: state.nextSequence++,
            active: true,
            unsubscribe: () => {
                if (!subscription.active)
                    return;
                subscription.active = false;
                state.subscriptions.delete(subscription);
                signal?.removeEventListener("abort", subscription.unsubscribe);
            }
        };
        if (isDisplayNode(this))
            assertLive(this);
        state.subscriptions.add(subscription);
        try {
            signal?.addEventListener("abort", subscription.unsubscribe, { once: true });
            // Covers adapters whose cancellation occurs while registering.
            if (isCancelled(signal))
                subscription.unsubscribe();
            if (isDisplayNode(this))
                assertLive(this);
        }
        catch (cause) {
            // Local rollback has no adapter callbacks: the handler becomes unreachable
            // before attempting a possibly failing physical abort-listener removal.
            subscription.active = false;
            state.subscriptions.delete(subscription);
            const cleanupErrors = [];
            try {
                signal?.removeEventListener("abort", subscription.unsubscribe);
            }
            catch (rollbackCause) {
                cleanupErrors.push(rollbackCause);
            }
            throw new EgretError("EVENT_SUBSCRIPTION_FAILED", { cause, cleanupErrors });
        }
        return subscription.unsubscribe;
    }
    candidates(type, capture) {
        return candidatesOf(this, type, capture);
    }
    /** Ordinary public dispatch retains subclass preflight and route hooks. */
    dispatchEvent(event) {
        this.assertUsable();
        return executeDispatch(this, event, () => {
            const ancestors = [];
            for (let parent = this.eventParent(); parent !== undefined; parent = parent.eventParent())
                ancestors.push(parent);
            return ancestors;
        }, (node, type, capture) => node.candidates(type, capture));
    }
    clearListeners() {
        const failures = [];
        const engine = engineOf(this);
        for (const subscription of [...stateOf(this).subscriptions]) {
            try {
                subscription.unsubscribe();
            }
            catch (cause) {
                if (engine === undefined)
                    failures.push(cause);
                else {
                    engine.captureCleanup(cause);
                    engine.report({ code: "EVENT_LISTENER_CLEANUP_FAILED", phase: "display-tree", severity: "error", cause });
                }
            }
        }
        if (failures.length !== 0)
            throw new EgretError("EVENT_LISTENER_CLEANUP_FAILED", { cause: failures[0], cleanupErrors: failures.slice(1) });
    }
}
//# sourceMappingURL=EventDispatcher.js.map