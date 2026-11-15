import { CancellationController, EgretError, Event, Scope, createEventType } from '@egret/runtime';
import { registerMouseInputEngine, registerMouseInputInstance, registerMouseInputScope, requireMouseInputEngine } from './internal/mouseInputFactoryState.js';
export { createBitmapButton } from './bitmapButton.js';
const APPLY = Reflect.apply;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const SCOPE_USE = Scope.prototype.use;
const tokens = new WeakMap();
const NATIVE_LIFETIME_ENDED = Symbol('egret.nativeInputLifetimeEnded');
/** Internal cleanup-only provenance never escapes the native delivery boundary. */
class NativeCleanupFailure {
    cause;
    constructor(cause) {
        this.cause = cause;
    }
}
/** Signal methods are captured per assembly, permitting transparent pre-assembly observation. */
export function createMouseInputOwner(engine, assembly) {
    const sample = new CancellationController().signal;
    const prototype = Object.getPrototypeOf(sample);
    const aborted = Object.getOwnPropertyDescriptor(prototype, 'aborted').get;
    const add = Object.getOwnPropertyDescriptor(prototype, 'addEventListener')
        .value;
    const remove = Object.getOwnPropertyDescriptor(prototype, 'removeEventListener')
        .value;
    const originalSignals = new WeakMap();
    const records = new Set();
    const shutdown = new Set();
    let started = false;
    const port = Object.freeze({
        surface: assembly.surface,
        operations: assembly.operations,
        assertOpen: assembly.assertOpen,
        report: assembly.report,
        captureCleanup: assembly.captureCleanup,
        assertReady() {
            assembly.assertOpen();
            if (!started)
                throw new EgretError('MOUSE_INPUT_INVALID');
        },
        markStarted() {
            started = true;
        },
        scope(value) {
            assembly.assertOpen();
            const signal = originalSignals.get(value);
            if (signal === undefined)
                throw new EgretError('MOUSE_INPUT_SCOPE_INVALID');
            const scope = value;
            const assertScopeOpen = () => {
                assembly.assertOpen();
                if (APPLY(SCOPE_STATE, scope, []) !== 'open' || APPLY(aborted, signal, []) === true)
                    throw new EgretError('SCOPE_CLOSED');
            };
            assertScopeOpen();
            const once = Object.freeze({ once: true });
            return Object.freeze({
                scope,
                signal,
                assertOpen: assertScopeOpen,
                use(value) {
                    APPLY(SCOPE_USE, scope, [value]);
                },
                add(listener) {
                    APPLY(add, signal, ['abort', listener, once]);
                },
                remove(listener) {
                    APPLY(remove, signal, ['abort', listener]);
                }
            });
        },
        onClose(listener) {
            assembly.assertOpen();
            shutdown.add(listener);
            return () => {
                shutdown.delete(listener);
            };
        },
        addRecord(record) {
            records.add(record);
        },
        removeRecord(record) {
            records.delete(record);
        }
    });
    registerMouseInputEngine(engine, port);
    return Object.freeze({
        registerScope(scope) {
            originalSignals.set(scope, scope.signal);
            registerMouseInputScope(scope, engine);
        },
        close() {
            for (const record of [...records])
                retire(record, 'owner');
            const listeners = [...shutdown];
            shutdown.clear();
            for (const listener of listeners) {
                try {
                    listener();
                }
                catch (cause) {
                    assembly.captureCleanup(cause);
                    assembly.report({ code: 'POINTER_INPUT_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause });
                }
            }
        }
    });
}
/** The registry keeps a closed genuine identity without retaining Engine/Scope ports. */
function buttonInputPort(record) {
    const assertOpen = () => {
        if (record.state === 'closed' || record.phase !== 'ready')
            throw new EgretError('BITMAP_BUTTON_INPUT_CLOSED');
        record.owner.assertReady();
        record.scope.assertOpen();
    };
    return Object.freeze({
        assertOpen,
        add(association) {
            assertOpen();
            if (record.buttons.has(association.target))
                throw new EgretError('BITMAP_BUTTON_SETUP_FAILED');
            record.buttons.set(association.target, association);
        },
        remove(association) {
            if (record.buttons.get(association.target) === association)
                record.buttons.delete(association.target);
        }
    });
}
function live(record) {
    if (record.state === 'closed' || record.owner === undefined || record.scope === undefined)
        return false;
    try {
        record.owner.assertReady();
        record.scope.assertOpen();
        return true;
    }
    catch (cause) {
        if (cause instanceof EgretError && (cause.code === 'ENGINE_CLOSED' || cause.code === 'SCOPE_CLOSED')) {
            retire(record, 'owner');
            return false;
        }
        throw cause;
    }
}
function removePair(record, pair) {
    if (pair.inFlight || pair.removeAttempted)
        return;
    pair.removeAttempted = true;
    try {
        // MI1 control: one exact physical pair removal, independent of logical closure.
        pair.remove(pair.listener);
        pair.removeSucceeded = true;
    }
    catch (cause) {
        record.cleanupErrors.push(cause);
    }
}
function finishRetirement(record) {
    if (record.phase !== 'retiring' || record.pairs.some(pair => pair.inFlight || !pair.removeAttempted))
        return;
    const owner = record.owner;
    record.phase = 'closed';
    record.owner = undefined;
    record.scope = undefined;
    record.native = undefined;
    record.surface = undefined;
    record.pairs = [];
    if (record.retirement === 'owner' &&
        !record.wasAcquiring &&
        record.cleanupErrors.length !== 0 &&
        owner !== undefined) {
        const error = new EgretError('MOUSE_INPUT_CLEANUP_FAILED', {
            cause: record.cleanupErrors[0],
            cleanupErrors: record.cleanupErrors.slice(1)
        });
        owner.captureCleanup(error);
        owner.report({ code: 'MOUSE_INPUT_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause: error });
    }
}
function retire(record, reason) {
    if (record.state === 'closed')
        return;
    record.wasAcquiring = record.phase === 'acquiring';
    record.state = 'closed';
    record.phase = 'retiring';
    record.held = undefined;
    record.retirement = reason;
    record.owner?.removeRecord(record);
    const buttons = [...record.buttons.values()];
    record.buttons.clear();
    for (const button of buttons) {
        try {
            record.cleanupErrors.push(...button.retire());
        }
        catch (cause) {
            record.cleanupErrors.push(cause);
        }
    }
    if (record.surface !== undefined && tokens.get(record.surface) === record.token)
        tokens.delete(record.surface);
    for (let index = record.pairs.length - 1; index >= 0; index--) {
        const pair = record.pairs[index];
        if (pair !== undefined)
            removePair(record, pair);
    }
    finishRetirement(record);
}
function inputEvent(type, payload) {
    return Object.freeze(new Event(type, payload));
}
function payload(id, point) {
    return Object.freeze({ pointerId: id, globalX: point.x, globalY: point.y, pointerType: 'mouse', button: 0 });
}
function cancelPress(record, reason) {
    const held = record.held;
    record.held = undefined;
    record.state = 'idle';
    if (held === undefined || !live(record))
        return;
    const operations = record.owner.operations;
    held.button?.cancel();
    if (!operations.isAttached(held.target, record.maximum))
        return;
    const data = Object.freeze({ ...payload(held.id, held.point), reason });
    operations.dispatch(held.target, inputEvent(record.events.cancel, data), record.maximum);
}
function nativeOperation(record, kind, event) {
    const native = record.native;
    const operations = record.owner.operations;
    if (kind === 'blur' || kind === 'pagehide') {
        if (!native.windowEvent(event, kind) || !live(record))
            return;
        if (kind === 'pagehide') {
            let hasFailure = false, failure;
            try {
                cancelPress(record, 'pagehide');
            }
            catch (cause) {
                hasFailure = true;
                failure = cause;
            }
            finally {
                retire(record, 'native');
            }
            if (hasFailure)
                throw failure;
            if (record.retirement === 'native' && !record.failureEpisode && record.cleanupErrors.length !== 0)
                throw new NativeCleanupFailure(record.cleanupErrors[0]);
        }
        else
            cancelPress(record, 'blur');
        return;
    }
    if ((kind === 'down' && record.held !== undefined) || (kind !== 'down' && record.held === undefined))
        return;
    const id = native.pointer(event, kind, record.held?.id);
    if (id === undefined || !live(record))
        return;
    if (kind === 'cancel') {
        cancelPress(record, 'pointercancel');
        return;
    }
    const point = native.point(event);
    if (!live(record))
        return;
    if (kind === 'down') {
        const target = operations.pick(point.x, point.y, record.maximum);
        if (target === undefined || !live(record))
            return;
        const held = { target, id, point, beginAllowed: false, token: {}, button: record.buttons.get(target) };
        record.held = held;
        record.state = 'pressed';
        held.button?.beforeBegin(held.token);
        // MI1 control: begin dispatch is a distinct genuine input operation.
        const allowed = operations.dispatch(target, inputEvent(record.events.begin, payload(id, point)), record.maximum);
        if (record.held === held && live(record))
            held.beginAllowed = allowed;
        return;
    }
    const held = record.held;
    const first = operations.pick(point.x, point.y, record.maximum);
    record.held = undefined;
    record.state = 'idle';
    try {
        // Reset the private skin before end, even when release is outside/detached.
        held.button?.beforeEnd(held.token);
        if (!live(record) || !operations.isAttached(held.target, record.maximum))
            return;
        // MI1 control: end stays on the held target even when release selects a sibling.
        const endAllowed = operations.dispatch(held.target, inputEvent(record.events.end, payload(id, point)), record.maximum);
        if (!live(record) ||
            first !== held.target ||
            !held.beginAllowed ||
            !endAllowed ||
            !operations.isAttached(held.target, record.maximum))
            return;
        // MI1 control: re-pick the same consumed release point after end callbacks.
        const second = operations.pick(point.x, point.y, record.maximum);
        if (second === held.target && live(record) && operations.isAttached(held.target, record.maximum)) {
            const data = payload(id, point);
            operations.dispatch(held.target, inputEvent(record.events.activate, data), record.maximum);
            // A control's callback is distinct from the unchanged public activate route.
            // Settings/life/token checks precede this final original pick after the route.
            held.button?.afterActivate(held.token, data, () => live(record) &&
                operations.isAttached(held.target, record.maximum) &&
                operations.pick(point.x, point.y, record.maximum) === held.target &&
                live(record) &&
                operations.isAttached(held.target, record.maximum));
        }
    }
    finally {
        held.button?.finish(held.token);
    }
}
function callbackFailure(record, owner, cause, primaryCleanup = false) {
    if (record.failureEpisode &&
        (Object.is(cause, record.failureCause) || (record.failureError !== undefined && cause === record.failureError)))
        return;
    // Publish the episode before teardown callouts so nested native delivery cannot replay it.
    record.failureEpisode = true;
    record.failureCause = cause;
    record.failureError = undefined;
    retire(record, 'native');
    const error = new EgretError('MOUSE_INPUT_CALLBACK_FAILED', {
        cause,
        cleanupErrors: primaryCleanup ? record.cleanupErrors.slice(1) : record.cleanupErrors
    });
    record.failureError = error;
    owner.report({ code: 'MOUSE_INPUT_CALLBACK_FAILED', phase: 'engine', severity: 'error', cause: error });
}
function deliver(record, kind, event) {
    if (record.phase !== 'ready')
        return;
    const owner = record.owner;
    if (record.busy) {
        callbackFailure(record, owner, new EgretError('MOUSE_INPUT_REENTRANT'));
        return;
    }
    record.busy = true;
    try {
        if (live(record)) {
            for (const button of [...record.buttons.values()])
                button.syncTerminal();
            if (record.phase === 'ready')
                nativeOperation(record, kind, event);
        }
    }
    catch (cause) {
        if (cause === NATIVE_LIFETIME_ENDED) {
            retire(record, 'owner');
            return;
        }
        if (cause instanceof NativeCleanupFailure)
            callbackFailure(record, owner, cause.cause, true);
        else
            callbackFailure(record, owner, cause);
    }
    finally {
        record.busy = false;
        record.failureEpisode = false;
        record.failureCause = undefined;
        record.failureError = undefined;
    }
}
function addPair(record, add, remove, listener) {
    const pair = {
        add,
        remove,
        listener,
        inFlight: true,
        addSucceeded: false,
        removeAttempted: false,
        removeSucceeded: false
    };
    record.pairs.push(pair);
    try {
        pair.add(pair.listener);
        pair.addSucceeded = true;
    }
    finally {
        pair.inFlight = false;
        if (record.state === 'closed') {
            removePair(record, pair);
            finishRetirement(record);
        }
    }
}
/** The browser entry admits options before reading any DOM capabilities or installing listeners. */
export function createMouseInputWithNative(options, nativeFactory) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID');
    let array;
    try {
        array = Array.isArray(options);
    }
    catch (cause) {
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause });
    }
    if (array)
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID');
    let engine;
    try {
        engine = options.engine;
    }
    catch (cause) {
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause });
    }
    const owner = requireMouseInputEngine(engine);
    let requestedScope;
    try {
        requestedScope = options.scope;
    }
    catch (cause) {
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause });
    }
    owner.assertReady();
    const scope = owner.scope(requestedScope);
    let width, height, requestedMaximum;
    try {
        width = options.width;
        height = options.height;
        requestedMaximum = options.maxNodes;
    }
    catch (cause) {
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause });
    }
    const assertLive = () => {
        owner.assertReady();
        scope.assertOpen();
    };
    let ready = false;
    const assertNativeLive = () => {
        try {
            assertLive();
        }
        catch (cause) {
            // Only this callback-free authority check may mark successful native continuation closure.
            if (ready && cause instanceof EgretError && (cause.code === 'ENGINE_CLOSED' || cause.code === 'SCOPE_CLOSED'))
                throw NATIVE_LIFETIME_ENDED;
            throw cause;
        }
    };
    assertLive();
    const maximum = requestedMaximum === undefined ? 4096 : requestedMaximum;
    if (typeof width !== 'number' ||
        !Number.isFinite(width) ||
        width <= 0 ||
        typeof height !== 'number' ||
        !Number.isFinite(height) ||
        height <= 0 ||
        typeof maximum !== 'number' ||
        !Number.isInteger(maximum) ||
        maximum < 1 ||
        maximum > 65536)
        throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID');
    const native = nativeFactory(owner.surface, width, height, assertNativeLive);
    assertLive();
    if (tokens.has(owner.surface))
        throw new EgretError('MOUSE_INPUT_IN_USE');
    const events = Object.freeze({
        begin: createEventType('egret.mouse.begin', { bubbles: true, cancelable: true }),
        end: createEventType('egret.mouse.end', { bubbles: true, cancelable: true }),
        activate: createEventType('egret.mouse.activate', { bubbles: true, cancelable: false }),
        cancel: createEventType('egret.mouse.cancel', {
            bubbles: true,
            cancelable: false
        })
    });
    const record = {
        state: 'idle',
        phase: 'acquiring',
        busy: false,
        failureEpisode: false,
        failureCause: undefined,
        failureError: undefined,
        owner,
        scope,
        native,
        held: undefined,
        events,
        buttons: new Map(),
        maximum,
        token: {},
        surface: owner.surface,
        pairs: [],
        cleanupErrors: [],
        retirement: undefined,
        wasAcquiring: false
    };
    const facade = Object.freeze({
        get state() {
            if (this !== facade)
                throw new EgretError('MOUSE_INPUT_INVALID');
            return record.state;
        },
        events,
        dispose() {
            if (this !== facade)
                throw new EgretError('MOUSE_INPUT_INVALID');
            if (record.state === 'closed')
                return;
            retire(record, 'explicit');
            if (record.cleanupErrors.length !== 0)
                throw new EgretError('MOUSE_INPUT_CLEANUP_FAILED', {
                    cause: record.cleanupErrors[0],
                    cleanupErrors: record.cleanupErrors.slice(1)
                });
        }
    });
    registerMouseInputInstance(facade, engine, buttonInputPort(record));
    tokens.set(owner.surface, record.token);
    owner.addRecord(record);
    let hasFailure = false, failure, sourceFailure = false;
    const acquire = (add, remove, listener) => {
        try {
            addPair(record, add, remove, listener);
        }
        catch (cause) {
            sourceFailure = true;
            throw cause;
        }
    };
    try {
        scope.use(facade);
        assertLive();
        acquire(scope.add, scope.remove, () => {
            retire(record, 'owner');
        });
        assertLive();
        for (const pair of native.pairs) {
            // A leaked closed callback retains the scalar kind and record, not the native target/ports.
            const kind = pair.kind;
            acquire(pair.add, pair.remove, (event) => {
                deliver(record, kind, event);
            });
            assertLive();
        }
        assertLive();
        if (record.state === 'closed')
            throw new EgretError('SCOPE_CLOSED');
        record.phase = 'ready';
        ready = true;
        return facade;
    }
    catch (cause) {
        hasFailure = true;
        failure = cause;
    }
    retire(record, 'setup');
    if (hasFailure &&
        !sourceFailure &&
        failure instanceof EgretError &&
        (failure.code === 'ENGINE_CLOSED' || failure.code === 'SCOPE_CLOSED')) {
        throw new EgretError(failure.code, {
            cause: failure.cause,
            cleanupErrors: [...failure.cleanupErrors, ...record.cleanupErrors]
        });
    }
    throw new EgretError('MOUSE_INPUT_SETUP_FAILED', { cause: failure, cleanupErrors: record.cleanupErrors });
}
//# sourceMappingURL=mouseInput.js.map