// SPDX-License-Identifier: Apache-2.0
import { EgretError } from "../EgretError.js";
let nextGeneration = 1;
const reasons = Object.freeze([
    "pointercancel",
    "lostcapture",
    "blur",
    "hidden",
    "pagehide",
    "viewport",
    "owner",
    "suspended",
    "dispose",
    "error"
]);
function finite(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function safeNonnegative(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function object(value) {
    return value !== null && typeof value === "object";
}
function checkReason(reason) {
    if (!reasons.includes(reason))
        throw new EgretError("POINTER_INPUT_REASON");
}
/** Copy and validate every scalar before the caller publishes an observation. */
function copyUpdate(input, observedTime) {
    try {
        if (!object(input))
            throw new EgretError("POINTER_INPUT_SAMPLE");
        const { globalX, globalY, buttons, timestamp, pressure, width, height } = input;
        if (!finite(globalX) ||
            !finite(globalY) ||
            !safeNonnegative(buttons) ||
            buttons > 65535 ||
            !finite(timestamp) ||
            timestamp < 0 ||
            timestamp < observedTime ||
            (pressure !== undefined && (!finite(pressure) || pressure < 0 || pressure > 1)) ||
            (width !== undefined && (!finite(width) || width < 0)) ||
            (height !== undefined && (!finite(height) || height < 0)))
            throw new EgretError("POINTER_INPUT_SAMPLE");
        return Object.freeze({
            globalX,
            globalY,
            buttons,
            timestamp,
            ...(pressure === undefined ? {} : { pressure }),
            ...(width === undefined ? {} : { width }),
            ...(height === undefined ? {} : { height })
        });
    }
    catch (cause) {
        if (cause instanceof EgretError && cause.code === "POINTER_INPUT_SAMPLE")
            throw cause;
        throw new EgretError("POINTER_INPUT_SAMPLE", { cause });
    }
}
/** Independent simultaneous contacts, with no host access or retained event history. */
export function createPointerRouter(options) {
    if (!object(options))
        throw new EgretError("POINTER_INPUT_OPTIONS");
    const { capacity = 10, viewportRevision = 0, pick, eligible, dispatch } = options;
    if (!Number.isInteger(capacity) ||
        capacity < 5 ||
        capacity > 32 ||
        !safeNonnegative(viewportRevision) ||
        typeof pick !== "function" ||
        typeof eligible !== "function" ||
        typeof dispatch !== "function") {
        throw new EgretError("POINTER_INPUT_OPTIONS");
    }
    if (!Number.isSafeInteger(nextGeneration))
        throw new EgretError("POINTER_INPUT_EXHAUSTED");
    const generation = nextGeneration++;
    let ports = { pick, eligible, dispatch };
    const entries = new Map();
    const hostIds = new Map();
    const checking = new Set();
    let state = "active";
    let revision = viewportRevision;
    let observedTime = 0;
    let nextId = 1;
    let sequence = 0;
    let operationDepth = 0;
    let cancellingDepth = 0;
    let changingViewport = false;
    let syncing = false;
    let failure;
    function run(action) {
        operationDepth++;
        try {
            return action();
        }
        finally {
            operationDepth--;
            if (operationDepth === 0)
                failure = undefined;
        }
    }
    function sampleOperation(action) {
        if (operationDepth !== 0)
            throw new EgretError("POINTER_INPUT_REENTRANT");
        return run(action);
    }
    function alive(entry) {
        return entries.get(entry.session) === entry;
    }
    function closed() {
        return state === "closed";
    }
    function snapshot(session, update) {
        if (!Number.isSafeInteger(sequence + 1))
            throw new EgretError("POINTER_INPUT_EXHAUSTED");
        return Object.freeze({ ...update, session, sequence: ++sequence, viewportRevision: revision });
    }
    function remove(entry) {
        entries.delete(entry.session);
        hostIds.delete(entry.session.pointerId);
    }
    // Publish closure and remove the complete active set before any cleanup callback.
    // Raw calls here keep the original error separate from later cleanup failures.
    function fail(cause) {
        if (failure !== undefined)
            throw failure;
        state = "closed";
        const pending = [...entries.values()];
        const cleanupEligible = ports?.eligible;
        const cleanupDispatch = ports?.dispatch;
        entries.clear();
        hostIds.clear();
        const cleanupErrors = [];
        for (const entry of pending) {
            let target = entry.captured ? entry.captureTarget : entry.lastTarget;
            const targets = new Set([entry.owner, target]);
            for (const candidate of targets) {
                if (candidate === undefined)
                    continue;
                try {
                    if (!cleanupEligible?.(candidate))
                        target = undefined;
                }
                catch (error) {
                    target = undefined;
                    cleanupErrors.push(error);
                }
            }
            try {
                const contact = snapshot(entry.session, entry.contact);
                cleanupDispatch?.("cancel", contact, target, "error");
            }
            catch (error) {
                cleanupErrors.push(error);
            }
        }
        ports = undefined;
        checking.clear();
        failure = new EgretError("POINTER_INPUT_CALLBACK_FAILED", { cause, cleanupErrors });
        throw failure;
    }
    function invoke(action) {
        try {
            const result = action();
            if (failure !== undefined)
                throw failure;
            return result;
        }
        catch (cause) {
            return fail(cause);
        }
    }
    function isEligible(target) {
        // A nested cancel may consult the same target while its eligibility port runs.
        // Let that terminal operation finish; its exact session check wins afterward.
        if (checking.has(target))
            return true;
        checking.add(target);
        const callback = ports?.eligible;
        try {
            return invoke(() => callback?.(target) ?? false);
        }
        finally {
            checking.delete(target);
        }
    }
    function valid(entry) {
        const targets = new Set([entry.owner, entry.captured ? entry.captureTarget : entry.lastTarget]);
        for (const target of targets) {
            if (target !== undefined && !isEligible(target))
                return false;
            if (!alive(entry))
                return false;
        }
        return alive(entry);
    }
    function deliver(kind, contact, target, reason) {
        const callback = ports?.dispatch;
        invoke(() => callback?.(kind, contact, target, reason));
        synchronize();
    }
    function cancelEntry(entry, reason) {
        if (!alive(entry))
            return false;
        const target = valid(entry) ? (entry.captured ? entry.captureTarget : entry.lastTarget) : undefined;
        if (!alive(entry))
            return false;
        const contact = snapshot(entry.session, entry.contact);
        remove(entry);
        deliver("cancel", contact, target, reason);
        return true;
    }
    function synchronize() {
        if (syncing || state === "closed")
            return;
        syncing = true;
        try {
            // Each restarted pass follows a removal. No new sample is admitted during it.
            let removed;
            do {
                removed = false;
                for (const entry of entries.values()) {
                    if (!valid(entry) && alive(entry)) {
                        cancelEntry(entry, "owner");
                        removed = true;
                        break;
                    }
                }
            } while (removed && !closed());
        }
        finally {
            syncing = false;
        }
    }
    function cancelEvery(reason) {
        cancellingDepth++;
        try {
            for (const entry of [...entries.values()])
                cancelEntry(entry, reason);
        }
        finally {
            cancellingDepth--;
        }
    }
    function route(entry, update) {
        if (entry.captured)
            return entry.captureTarget;
        const callback = ports?.pick;
        const target = invoke(() => callback?.(update.globalX, update.globalY));
        return target === undefined || !isEligible(target) ? undefined : target;
    }
    function updateContact(kind, session, input) {
        return sampleOperation(() => {
            const entry = entries.get(session);
            if (entry === undefined || state !== "active")
                return false;
            const copied = copyUpdate(input, observedTime);
            synchronize();
            if (!alive(entry) || state !== "active")
                return false;
            const target = route(entry, copied);
            if (!alive(entry) || state !== "active")
                return false;
            if (!valid(entry)) {
                cancelEntry(entry, "owner");
                return false;
            }
            const contact = snapshot(session, copied);
            observedTime = copied.timestamp;
            entry.contact = contact;
            entry.lastTarget = target;
            if (kind === "end")
                remove(entry);
            deliver(kind, contact, target);
            return true;
        });
    }
    return Object.freeze({
        get state() {
            return state;
        },
        get contacts() {
            return Object.freeze([...entries.values()].map(entry => entry.contact));
        },
        get viewportRevision() {
            return revision;
        },
        begin(input) {
            return sampleOperation(() => {
                if (state !== "active")
                    return undefined;
                const copied = copyUpdate(input, observedTime);
                let pointerId, pointerType;
                try {
                    ({ pointerId, pointerType } = input);
                }
                catch (cause) {
                    throw new EgretError("POINTER_INPUT_SAMPLE", { cause });
                }
                if (!safeNonnegative(pointerId) || !["mouse", "touch", "pen"].includes(pointerType))
                    throw new EgretError("POINTER_INPUT_SAMPLE");
                if (hostIds.has(pointerId))
                    throw new EgretError("POINTER_INPUT_DUPLICATE");
                if (entries.size >= capacity)
                    throw new EgretError("POINTER_INPUT_CAPACITY");
                if (!Number.isSafeInteger(nextId))
                    throw new EgretError("POINTER_INPUT_EXHAUSTED");
                synchronize();
                if (state !== "active")
                    return undefined;
                const callback = ports?.pick;
                const picked = invoke(() => callback?.(copied.globalX, copied.globalY));
                const owner = picked === undefined || !isEligible(picked) ? undefined : picked;
                if (state !== "active")
                    return undefined;
                const session = Object.freeze({ generation, id: nextId++, pointerId, pointerType });
                const contact = snapshot(session, copied);
                const entry = {
                    session,
                    contact,
                    owner,
                    captured: owner !== undefined,
                    captureTarget: owner,
                    lastTarget: owner
                };
                entries.set(session, entry);
                hostIds.set(pointerId, session);
                observedTime = copied.timestamp;
                deliver("begin", contact, owner);
                return alive(entry) ? session : undefined;
            });
        },
        move(session, update) {
            return updateContact("move", session, update);
        },
        end(session, update) {
            return updateContact("end", session, update);
        },
        cancel(session, reason) {
            return run(() => {
                const entry = entries.get(session);
                if (entry === undefined)
                    return false;
                checkReason(reason);
                return cancelEntry(entry, reason);
            });
        },
        cancelAll(reason) {
            run(() => {
                checkReason(reason);
                cancelEvery(reason);
            });
        },
        capture(session, target) {
            return run(() => {
                const entry = entries.get(session);
                if (entry === undefined || state !== "active")
                    return false;
                if (!object(target))
                    return false;
                if (!isEligible(target)) {
                    synchronize();
                    return false;
                }
                if (!valid(entry)) {
                    cancelEntry(entry, "owner");
                    return false;
                }
                if (!alive(entry) || state !== "active")
                    return false;
                entry.captured = true;
                entry.captureTarget = target;
                entry.lastTarget = target;
                synchronize();
                return alive(entry) && state === "active";
            });
        },
        releaseCapture(session) {
            return run(() => {
                const entry = entries.get(session);
                if (entry === undefined || state !== "active")
                    return false;
                if (!valid(entry)) {
                    cancelEntry(entry, "owner");
                    return false;
                }
                if (!alive(entry) || state !== "active")
                    return false;
                entry.captured = false;
                entry.captureTarget = undefined;
                synchronize();
                return alive(entry) && state === "active";
            });
        },
        sync() {
            run(synchronize);
        },
        setViewportRevision(next) {
            run(() => {
                if (!safeNonnegative(next) || next <= revision)
                    throw new EgretError("POINTER_INPUT_VIEWPORT");
                if (state === "closed")
                    return;
                if (changingViewport)
                    throw new EgretError("POINTER_INPUT_REENTRANT");
                changingViewport = true;
                try {
                    cancelEvery("viewport");
                    if (!closed())
                        revision = next;
                }
                finally {
                    changingViewport = false;
                }
            });
        },
        setInteractive(interactive) {
            run(() => {
                if (typeof interactive !== "boolean")
                    throw new EgretError("POINTER_INPUT_OPTIONS");
                if (state === "closed")
                    return;
                if (interactive) {
                    if (cancellingDepth === 0)
                        state = "active";
                }
                else {
                    state = "suspended";
                    cancelEvery("suspended");
                }
            });
        },
        dispose() {
            run(() => {
                if (state === "closed")
                    return;
                state = "closed";
                try {
                    cancelEvery("dispose");
                }
                finally {
                    ports = undefined;
                    entries.clear();
                    hostIds.clear();
                    checking.clear();
                }
            });
        }
    });
}
//# sourceMappingURL=PointerRouter.js.map