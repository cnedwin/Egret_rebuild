// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, DisplayObjectContainer, EgretError, Event, createEventType } from '@egret/runtime';
import { createPointerRouter } from '@egret/runtime/input';
import { requireMouseInputEngine } from './internal/mouseInputFactoryState.js';
import { captureUiInputDelivery, registerUiPointerInput } from './internal/uiFactoryState.js';
const getter = (prototype, key) => Object.getOwnPropertyDescriptor(prototype, key).get;
const parent = getter(DisplayObject.prototype, 'parent'), visible = getter(DisplayObject.prototype, 'visible');
const touch = getter(DisplayObject.prototype, 'touchEnabled'), children = getter(DisplayObjectContainer.prototype, 'touchChildren');
const bindings = new WeakMap();
// Keep browser-only references in a separate closure, released with its binding.
function surfaceBinding(surface, report, onClose) {
    return Object.freeze({
        surface,
        onClose,
        report: (cause) => report({ code: 'POINTER_INPUT_HOST_FAILED', phase: 'engine', severity: 'error', cause })
    });
}
/** Private browser assembly authority; never exported by the optional public entry. */
export function bindPointerSurface(input) {
    const binding = bindings.get(input);
    if (binding === undefined || input.state === 'closed')
        throw new EgretError('POINTER_INPUT_CLOSED');
    return binding;
}
/** How far, in stage units, a contact may end from where it began and still be a tap. */
const TAP_SLOP = 12;
export function createPointerInput(options) {
    if (options === null || typeof options !== 'object' || Array.isArray(options))
        throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
    const engine = options.engine;
    let owner = requireMouseInputEngine(engine);
    const deliver = captureUiInputDelivery(engine);
    let scope = owner.scope(options.scope);
    const width = options.width, height = options.height, maxNodes = options.maxNodes ?? 4096;
    let observer = options.onContact;
    // Late subscribers to the same stream; the creation-time observer keeps its single slot.
    const listeners = new Set();
    if (!Number.isFinite(width) ||
        width <= 0 ||
        !Number.isFinite(height) ||
        height <= 0 ||
        !Number.isInteger(maxNodes) ||
        maxNodes < 1 ||
        maxNodes > 65536 ||
        (observer !== undefined && typeof observer !== 'function'))
        throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
    owner.assertReady();
    scope.assertOpen();
    let operations = owner.operations;
    const events = Object.freeze({
        begin: createEventType('egret.pointer.begin', { bubbles: true, cancelable: true }),
        move: createEventType('egret.pointer.move', { bubbles: true, cancelable: true }),
        end: createEventType('egret.pointer.end', { bubbles: true, cancelable: true }),
        cancel: createEventType('egret.pointer.cancel', {
            bubbles: true,
            cancelable: false
        }),
        tap: createEventType('egret.pointer.tap', { bubbles: true, cancelable: false })
    });
    const closers = new Set();
    const activeEvents = new Map();
    let router, input, closed = false;
    let releaseEngine;
    let calls = 0;
    const eligible = (target) => {
        if (owner === undefined || scope === undefined || operations === undefined)
            return false;
        try {
            owner.assertReady();
            scope.assertOpen();
        }
        catch {
            return false;
        }
        if (!operations.isAttached(target, maxNodes) || Reflect.apply(touch, target, []) !== true)
            return false;
        let node = target, count = 0;
        while (node !== undefined) {
            if (++count > maxNodes)
                throw new EgretError('HIT_TEST_TREE_LIMIT');
            if (Reflect.apply(visible, node, []) !== true)
                return false;
            if (node !== target && Reflect.apply(children, node, []) !== true)
                return false;
            node = Reflect.apply(parent, node, []);
        }
        return true;
    };
    function closeNative() {
        if (closed)
            return;
        closed = true;
        releaseEngine?.();
        releaseEngine = undefined;
        scope?.remove(retire);
        bindings.delete(input);
        const callbacks = [...closers];
        closers.clear();
        let first, failed = false;
        const cleanup = [];
        for (const callback of callbacks)
            try {
                callback();
            }
            catch (cause) {
                if (!failed) {
                    first = cause;
                    failed = true;
                }
                else
                    cleanup.push(cause);
            }
        owner = undefined;
        scope = undefined;
        operations = undefined;
        observer = undefined;
        listeners.clear();
        if (failed)
            throw new EgretError('POINTER_INPUT_CLEANUP_FAILED', { cause: first, cleanupErrors: cleanup });
    }
    function invoke(operation) {
        let value, first, failed = false;
        calls++;
        try {
            value = operation();
        }
        catch (cause) {
            failed = true;
            first = cause;
        }
        finally {
            calls--;
        }
        if (calls === 0 && router.state === 'closed')
            try {
                closeNative();
            }
            catch (cause) {
                if (failed)
                    throw new EgretError('POINTER_INPUT_CALLBACK_FAILED', { cause: first, cleanupErrors: [cause] });
                throw cause;
            }
        if (failed)
            throw first;
        return value;
    }
    function retire() {
        invoke(() => router.dispose());
    }
    // Where each contact began and on what, for a tap: an end on the same target within TAP_SLOP units of its begin.
    const begun = new Map();
    router = createPointerRouter({
        ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
        pick: (x, y) => {
            owner.assertReady();
            scope.assertOpen();
            return operations.pick(x, y, maxNodes);
        },
        eligible,
        dispatch: (kind, contact, target, reason) => deliver(() => {
            // Termination during capture/target callbacks must stop the older route.
            if (kind === 'cancel')
                activeEvents.get(contact.session)?.stopImmediatePropagation();
            // Observer receives terminal cleanup even when its display target no longer exists.
            const notification = Object.freeze({ kind, contact, target, ...(reason === undefined ? {} : { reason }) });
            // Presence of a throw is tracked separately from its value: `throw undefined` is still a
            // throw, and swallowing it would leave the channel active and allow an activation.
            let threw = false, thrown;
            try {
                observer?.(notification);
            }
            catch (cause) {
                threw = true;
                thrown = cause;
            }
            // begin/move/cancel keep the original pre-dispatch observation order, including reentry that
            // cancels from inside a listener. Only `end` is reported after its dispatch attempt.
            if (kind !== 'end')
                for (const listener of [...listeners])
                    try {
                        listener(notification);
                    }
                    catch {
                        /* isolated */
                    }
            let delivered = false;
            try {
                if (threw)
                    throw thrown;
                if (target === undefined || !eligible(target))
                    return;
                // A callback may synchronously cancel or close the session before target delivery.
                if ((kind === 'begin' || kind === 'move') &&
                    !router.contacts.some(value => value.session === contact.session))
                    return;
                delivered = true;
                if (kind === 'begin')
                    begun.set(contact.session, { target, x: contact.globalX, y: contact.globalY });
                if (kind === 'cancel')
                    operations.dispatch(target, Object.freeze(new Event(events.cancel, Object.freeze({ ...contact, reason: reason }))), maxNodes);
                else {
                    const event = Object.freeze(new Event(events[kind], contact));
                    if (kind === 'begin' || kind === 'move')
                        activeEvents.set(contact.session, event);
                    try {
                        operations.dispatch(target, event, maxNodes);
                    }
                    finally {
                        if (activeEvents.get(contact.session) === event)
                            activeEvents.delete(contact.session);
                    }
                    // A tap follows the end it completes, on the target both were on, unless a listener closed the input.
                    const start = kind === 'end' ? begun.get(contact.session) : undefined;
                    if (start !== undefined &&
                        start.target === target &&
                        Math.hypot(contact.globalX - start.x, contact.globalY - start.y) <= TAP_SLOP &&
                        router.state !== 'closed' &&
                        eligible(target))
                        operations.dispatch(target, Object.freeze(new Event(events.tap, contact)), maxNodes);
                }
            }
            finally {
                if (kind === 'end' || kind === 'cancel')
                    begun.delete(contact.session);
                // `delivered` records that a target path was attempted, not that a particular control ran.
                if (kind === 'end') {
                    const observed = Object.freeze({ ...notification, delivered });
                    for (const listener of [...listeners])
                        try {
                            listener(observed);
                        }
                        catch {
                            /* isolated */
                        }
                }
            }
        })
    });
    input = Object.freeze({
        get state() {
            return router.state;
        },
        get contacts() {
            return router.contacts;
        },
        get viewportRevision() {
            return router.viewportRevision;
        },
        events,
        begin: (sample) => invoke(() => router.begin(sample)),
        move: (session, sample) => invoke(() => router.move(session, sample)),
        end: (session, sample) => invoke(() => router.end(session, sample)),
        cancel: (session, reason) => invoke(() => router.cancel(session, reason)),
        cancelAll: (reason) => invoke(() => router.cancelAll(reason)),
        capture: (session, target) => invoke(() => router.capture(session, target)),
        releaseCapture: (session) => invoke(() => router.releaseCapture(session)),
        sync: () => invoke(() => router.sync()),
        setViewportRevision: (revision) => invoke(() => router.setViewportRevision(revision)),
        setInteractive: (value) => invoke(() => router.setInteractive(value)),
        dispose: retire,
        observe: (listener) => {
            if (typeof listener !== 'function')
                throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    });
    registerUiPointerInput(input, engine, Object.freeze({ events, state: () => router.state, activeContacts: () => router.contacts.length, sync: input.sync }));
    try {
        releaseEngine = owner.onClose(retire);
        scope.add(retire);
        scope.use(input);
        bindings.set(input, surfaceBinding(owner.surface, owner.report, (callback) => {
            if (closed) {
                callback();
                return () => { };
            }
            closers.add(callback);
            return () => {
                closers.delete(callback);
            };
        }));
        owner.assertReady();
        scope.assertOpen();
        return input;
    }
    catch (cause) {
        try {
            retire();
        }
        catch (cleanup) {
            throw new EgretError('POINTER_INPUT_SETUP_FAILED', { cause, cleanupErrors: [cleanup] });
        }
        throw cause;
    }
}
//# sourceMappingURL=pointerInput.js.map