// SPDX-License-Identifier: Apache-2.0
import { EgretError, Event, createEventType } from '@egret/runtime';
import { captureMouseInputRuntimePrimitives, requireMouseInputEngine } from './internal/mouseInputFactoryState.js';
import { captureUiInputDelivery, registerUiKeyboardInput } from './internal/uiFactoryState.js';
const primitives = captureMouseInputRuntimePrimitives();
const bindings = new WeakMap();
const reasons = new Set([
    'focus',
    'rebind',
    'removed',
    'owner',
    'suspended',
    'dispose',
    'blur',
    'hidden',
    'pagehide',
    'error'
]);
function fail(code) {
    throw new EgretError(code);
}
function idValid(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('\0');
}
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sample(value) {
    if (!object(value))
        fail('KEYBOARD_INPUT_SAMPLE_INVALID');
    const code = value.code, key = value.key;
    if (typeof code !== 'string' ||
        code.length < 1 ||
        code.length > 64 ||
        typeof key !== 'string' ||
        key.length < 1 ||
        key.length > 128)
        fail('KEYBOARD_INPUT_SAMPLE_INVALID');
    const repeat = value.repeat, altKey = value.altKey, ctrlKey = value.ctrlKey, metaKey = value.metaKey, shiftKey = value.shiftKey;
    const result = {
        code,
        key,
        repeat: repeat === undefined ? false : repeat,
        altKey: altKey === undefined ? false : altKey,
        ctrlKey: ctrlKey === undefined ? false : ctrlKey,
        metaKey: metaKey === undefined ? false : metaKey,
        shiftKey: shiftKey === undefined ? false : shiftKey
    };
    if ([result.repeat, result.altKey, result.ctrlKey, result.metaKey, result.shiftKey].some(v => typeof v !== 'boolean'))
        fail('KEYBOARD_INPUT_SAMPLE_INVALID');
    return Object.freeze(result);
}
/** Private browser binding reuses the genuine eager Engine authority. */
export function bindKeyboardSurface(input) {
    return bindings.get(input) ?? fail('KEYBOARD_INPUT_CLOSED');
}
export function createKeyboardInput(options) {
    if (!object(options))
        fail('KEYBOARD_INPUT_OPTIONS_INVALID');
    const engine = options.engine;
    let owner = requireMouseInputEngine(engine);
    let scope = owner.scope(options.scope);
    let operations = owner.operations;
    const deliver = captureUiInputDelivery(engine);
    const requestedTargets = options.maxTargets, requestedKeys = options.maxKeys, requestedNodes = options.maxNodes;
    const maxTargets = requestedTargets === undefined ? 4096 : requestedTargets, maxKeys = requestedKeys === undefined ? 64 : requestedKeys, maxNodes = requestedNodes === undefined ? 4096 : requestedNodes;
    let observer = options.onFocusChange;
    for (const [value, max] of [
        [maxTargets, 65536],
        [maxKeys, 256],
        [maxNodes, 65536]
    ])
        if (!Number.isInteger(value) || value < 1 || value > max)
            fail('KEYBOARD_INPUT_OPTIONS_INVALID');
    if (observer !== undefined && typeof observer !== 'function')
        fail('KEYBOARD_INPUT_OPTIONS_INVALID');
    const events = Object.freeze({
        keyDown: createEventType('egret.keyboard.keyDown', { bubbles: true, cancelable: true }),
        keyUp: createEventType('egret.keyboard.keyUp', { bubbles: true, cancelable: true }),
        cancel: createEventType('egret.keyboard.cancel', { bubbles: true }),
        focusIn: createEventType('egret.keyboard.focusIn', { bubbles: true }),
        focusOut: createEventType('egret.keyboard.focusOut', { bubbles: true })
    });
    const records = new Map(), held = new Map(), closers = new Set();
    const interactive = new Set();
    const activeKeys = new Set();
    const activeFocus = new Set();
    let state = 'active', focused, focusVisible = false, notifying = 0, revision = 0, calls = 0, callbackFailed = false;
    let releaseEngine, input, keyBusy = false;
    const report = owner.report;
    let focusOwner, focusRoots;
    function assertOpen() {
        if (state === 'closed')
            fail('KEYBOARD_INPUT_CLOSED');
        owner.assertReady();
        scope.assertOpen();
    }
    function assertMutation() {
        assertOpen();
        if (notifying !== 0)
            fail('KEYBOARD_INPUT_REENTRANT');
    }
    function eligible(value) {
        if (value.disabled || operations === undefined)
            return false;
        if (primitives.disposed(value.target) === true || !operations.isAttached(value.target, maxNodes))
            return false;
        let node = value.target, count = 0, contained = focusRoots === undefined;
        while (node !== undefined) {
            if (++count > maxNodes)
                fail('HIT_TEST_TREE_LIMIT');
            if (primitives.visible(node) !== true)
                return false;
            if (focusRoots?.includes(node))
                contained = true;
            node = primitives.parent(node);
        }
        return contained;
    }
    function callout(action) {
        try {
            return deliver(action);
        }
        catch (cause) {
            callbackFailed = true;
            throw cause;
        }
    }
    function route(target, type, payload, active) {
        if (operations === undefined || owner === undefined)
            return false;
        try {
            owner.assertReady();
            scope?.assertOpen();
        }
        catch (cause) {
            if (cause instanceof EgretError && (cause.code === 'ENGINE_CLOSED' || cause.code === 'SCOPE_CLOSED'))
                return false;
            throw cause;
        }
        if (!operations.isAttached(target, maxNodes))
            return false;
        const event = Object.freeze(new Event(type, payload));
        active?.add(event);
        try {
            callout(() => operations.dispatch(target, event, maxNodes));
            return event.defaultPrevented;
        }
        finally {
            active?.delete(event);
        }
    }
    function stopKeys() {
        for (const event of activeKeys)
            event.stopImmediatePropagation();
    }
    function drain(reason) {
        const keys = [...held.values()];
        held.clear();
        stopKeys();
        let failure, failed = false;
        for (const value of keys)
            try {
                route(value.focus.target, events.cancel, Object.freeze({ ...value.sample, targetId: value.focus.record.id, reason }));
            }
            catch (cause) {
                if (!failed) {
                    failed = true;
                    failure = cause;
                }
            }
        if (failed)
            throw failure;
    }
    // Focus notification recursion is rejected before mutation. Key handlers may
    // transfer focus or dispose; committed epochs suppress the older continuation.
    function transition(next, nextVisible, reason, cancelReason) {
        const previous = focused;
        if (previous?.record === next?.record && previous?.target === next?.target) {
            focusVisible = next !== undefined && nextVisible;
            return;
        }
        focused = next;
        focusVisible = next !== undefined && nextVisible;
        const epoch = ++revision;
        stopKeys();
        let failure, failed = false;
        const attempt = (action) => {
            try {
                action();
            }
            catch (cause) {
                if (!failed) {
                    failure = cause;
                    failed = true;
                }
            }
        };
        function reconcile() {
            if (state === 'active' &&
                revision === epoch &&
                focused === next &&
                next !== undefined &&
                (records.get(next.record.id) !== next.record || !eligible(next.record)))
                transition(undefined, false, 'owner', 'owner');
        }
        notifying++;
        try {
            attempt(() => drain(cancelReason));
            if (previous !== undefined)
                attempt(() => {
                    route(previous.target, events.focusOut, Object.freeze({ targetId: previous.record.id, relatedId: next?.record.id, reason, focusVisible }), activeFocus);
                });
            attempt(() => reconcile());
            if (!failed &&
                revision === epoch &&
                focused === next &&
                next !== undefined &&
                state === 'active' &&
                records.get(next.record.id) === next.record &&
                eligible(next.record))
                attempt(() => {
                    route(next.target, events.focusIn, Object.freeze({ targetId: next.record.id, relatedId: previous?.record.id, reason, focusVisible }), activeFocus);
                });
            attempt(() => reconcile());
            if (!failed && revision === epoch)
                attempt(() => callout(() => observer?.(Object.freeze({ previousId: previous?.record.id, focusedId: focused?.record.id, reason, focusVisible }))));
            attempt(() => reconcile());
        }
        finally {
            notifying--;
        }
        if (failed)
            throw failure;
    }
    function close(reason) {
        if (state === 'closed')
            return;
        state = 'closed';
        for (const event of activeFocus)
            event.stopImmediatePropagation();
        let failure, failed = false;
        const attempt = (action) => {
            try {
                action();
            }
            catch (cause) {
                if (!failed) {
                    failed = true;
                    failure = cause;
                }
            }
        };
        attempt(() => transition(undefined, false, reason, reason));
        attempt(() => drain(reason));
        records.clear();
        focusRoots = undefined;
        focusOwner = undefined;
        bindings.delete(input);
        attempt(() => releaseEngine?.());
        releaseEngine = undefined;
        attempt(() => scope?.remove(retire));
        const callbacks = [...closers];
        closers.clear();
        for (const callback of callbacks)
            attempt(callback);
        interactive.clear();
        if (calls === 0)
            release();
        if (failed)
            throw failure;
    }
    function release() {
        owner = undefined;
        scope = undefined;
        operations = undefined;
        observer = undefined;
    }
    function invoke(action) {
        calls++;
        try {
            return action();
        }
        catch (cause) {
            if (callbackFailed && state !== 'closed')
                try {
                    close('error');
                }
                catch {
                    /* Original callback failure remains authoritative. */
                }
            throw cause;
        }
        finally {
            if (--calls === 0) {
                callbackFailed = false;
                if (state === 'closed')
                    release();
            }
        }
    }
    function orderedTargets() {
        return [...records.values()]
            .filter(v => v.tabIndex >= 0 && eligible(v))
            .sort((a, b) => {
            if (a.tabIndex === 0)
                return b.tabIndex === 0 ? 0 : 1;
            if (b.tabIndex === 0)
                return -1;
            return a.tabIndex - b.tabIndex;
        });
    }
    function retire() {
        invoke(() => close('owner'));
    }
    function sync() {
        if (state === 'closed')
            return;
        assertMutation();
        if (focused !== undefined && !eligible(focused.record))
            transition(undefined, false, 'owner', 'owner');
    }
    function validateTarget(target) {
        if (operations === undefined || primitives.disposed(target) === true || !operations.isAttached(target, maxNodes))
            fail('KEYBOARD_TARGET_INVALID');
    }
    function settings(target, tabIndex, disabled) {
        if (!Number.isInteger(tabIndex) || tabIndex < -1 || tabIndex > 32767 || typeof disabled !== 'boolean')
            fail('KEYBOARD_TARGET_INVALID');
        validateTarget(target);
    }
    function focus(id, configuration = {}) {
        assertMutation();
        if (!object(configuration))
            fail('KEYBOARD_INPUT_FOCUS_INVALID');
        const requestedVisible = configuration.visible, requestedReason = configuration.reason;
        assertMutation();
        if ((requestedVisible !== undefined && typeof requestedVisible !== 'boolean') ||
            (requestedReason !== undefined && !['programmatic', 'keyboard', 'pointer'].includes(requestedReason)))
            fail('KEYBOARD_INPUT_FOCUS_INVALID');
        if (id !== undefined && !idValid(id))
            fail('KEYBOARD_INPUT_FOCUS_INVALID');
        const record = id === undefined ? undefined : records.get(id);
        if (id !== undefined && (record === undefined || state !== 'active' || !eligible(record)))
            fail('KEYBOARD_TARGET_INELIGIBLE');
        const reason = requestedReason ?? 'programmatic';
        transition(record === undefined ? undefined : { record, target: record.target }, requestedVisible ?? reason === 'keyboard', reason, 'focus');
    }
    function key(kind, raw) {
        if (state !== 'active')
            return false;
        assertOpen();
        if (notifying !== 0 || keyBusy)
            fail('KEYBOARD_INPUT_REENTRANT');
        const copied = sample(raw);
        assertMutation();
        sync();
        const current = focused;
        if (current === undefined)
            return false;
        const previous = held.get(copied.code);
        if (kind === 'keyUp') {
            if (previous === undefined || previous.focus !== current)
                return false;
            held.delete(copied.code);
        }
        else {
            if (previous !== undefined && previous.focus !== current)
                return false;
            if (previous === undefined) {
                if (copied.repeat)
                    return false;
                if (held.size >= maxKeys)
                    fail('KEYBOARD_INPUT_KEY_CAPACITY');
                held.set(copied.code, { focus: current, sample: copied });
            }
        }
        keyBusy = true;
        try {
            const prevented = route(current.target, events[kind], Object.freeze({ ...copied, targetId: current.record.id }), activeKeys);
            if (input.getSnapshot().state !== 'closed')
                sync();
            return prevented;
        }
        finally {
            keyBusy = false;
        }
    }
    input = Object.freeze({
        events,
        registerTarget: (configuration) => invoke(() => {
            assertMutation();
            if (!object(configuration))
                fail('KEYBOARD_TARGET_INVALID');
            const id = configuration.id, target = configuration.target, requestedIndex = configuration.tabIndex, requestedDisabled = configuration.disabled;
            const tabIndex = requestedIndex === undefined ? 0 : requestedIndex, disabled = requestedDisabled === undefined ? false : requestedDisabled;
            assertMutation();
            if (!idValid(id) || records.has(id) || records.size >= maxTargets)
                fail('KEYBOARD_TARGET_INVALID');
            settings(target, tabIndex, disabled);
            assertMutation();
            if (records.has(id) || records.size >= maxTargets)
                fail('KEYBOARD_TARGET_INVALID');
            const record = { id, target, tabIndex, disabled };
            records.set(id, record);
            return Object.freeze({
                update: (update) => invoke(() => {
                    assertMutation();
                    if (records.get(id) !== record)
                        fail('KEYBOARD_REGISTRATION_CLOSED');
                    if (!object(update))
                        fail('KEYBOARD_TARGET_INVALID');
                    const nextTarget = update.target ?? record.target, nextIndex = update.tabIndex ?? record.tabIndex, nextDisabled = update.disabled ?? record.disabled;
                    settings(nextTarget, nextIndex, nextDisabled);
                    assertMutation();
                    if (records.get(id) !== record)
                        fail('KEYBOARD_REGISTRATION_CLOSED');
                    const was = focused?.record === record, rebind = record.target !== nextTarget;
                    record.target = nextTarget;
                    record.tabIndex = nextIndex;
                    record.disabled = nextDisabled;
                    if (was) {
                        if (!eligible(record))
                            transition(undefined, false, 'owner', 'owner');
                        else if (rebind)
                            transition({ record, target: nextTarget }, focusVisible, 'rebind', 'rebind');
                    }
                }),
                dispose: () => invoke(() => {
                    if (records.get(id) !== record)
                        return;
                    // Retirement remains legal during owner shutdown and cancellation callbacks.
                    // Removing identity first makes recursive disposal harmless; no new target is admitted.
                    records.delete(id);
                    if (focused?.record === record) {
                        for (const event of activeFocus)
                            event.stopImmediatePropagation();
                        transition(undefined, false, 'removed', 'removed');
                    }
                })
            });
        }),
        focus: (id, configuration) => invoke(() => focus(id, configuration)),
        moveFocus: (direction, wrap = false) => invoke(() => {
            assertMutation();
            if (!['next', 'previous'].includes(direction) || typeof wrap !== 'boolean')
                fail('KEYBOARD_INPUT_FOCUS_INVALID');
            if (state !== 'active')
                return undefined;
            sync();
            const values = orderedTargets();
            const current = values.findIndex(v => v === focused?.record), delta = direction === 'next' ? 1 : -1;
            let index = current === -1 ? (delta === 1 ? 0 : values.length - 1) : current + delta;
            if ((wrap || focusRoots !== undefined) && values.length > 0)
                index = (index + values.length) % values.length;
            // A scope with no tabbable children retains its Escape sentinel.
            if (focusRoots !== undefined && values.length === 0)
                return focused?.record.id;
            const next = values[index];
            focus(next?.id, { reason: 'keyboard' });
            return focused?.record.id;
        }),
        keyDown: (raw) => invoke(() => key('keyDown', raw)),
        keyUp: (raw) => invoke(() => key('keyUp', raw)),
        cancel: (reason = 'focus') => invoke(() => {
            if (!reasons.has(reason))
                fail('KEYBOARD_INPUT_CANCEL_INVALID');
            if (state === 'closed')
                return;
            assertMutation();
            transition(undefined, false, reason, reason);
            drain(reason);
        }),
        sync: () => invoke(sync),
        setInteractive: (value) => invoke(() => {
            assertMutation();
            if (typeof value !== 'boolean')
                fail('KEYBOARD_INPUT_OPTIONS_INVALID');
            if (value) {
                state = 'active';
                for (const callback of interactive)
                    callout(() => callback(true));
                return;
            }
            state = 'suspended';
            transition(undefined, false, 'suspended', 'suspended');
            drain('suspended');
            for (const callback of interactive)
                callout(() => callback(false));
        }),
        getSnapshot: () => Object.freeze({
            state,
            focusedId: focused?.record.id,
            focusVisible,
            pressedKeys: Object.freeze([...held.keys()]),
            targetCount: records.size
        }),
        dispose: () => invoke(() => close('dispose'))
    });
    try {
        releaseEngine = owner.onClose(retire);
        scope.add(retire);
        scope.use(input);
        bindings.set(input, Object.freeze({
            surface: owner.surface,
            onInteractive: (callback) => {
                interactive.add(callback);
                return () => {
                    interactive.delete(callback);
                };
            },
            report: (cause) => report({ code: 'KEYBOARD_INPUT_HOST_FAILED', phase: 'engine', severity: 'error', cause }),
            onClose: (callback) => {
                if (state === 'closed') {
                    callback();
                    return () => { };
                }
                closers.add(callback);
                return () => {
                    closers.delete(callback);
                };
            }
        }));
        owner.assertReady();
        scope.assertOpen();
        registerUiKeyboardInput(input, engine, (claimant) => {
            assertMutation();
            if (focusOwner !== undefined && focusOwner !== claimant)
                fail('KEYBOARD_FOCUS_SCOPE_ACTIVE');
            focusOwner = claimant;
            let released = false;
            return Object.freeze({
                setRoots: (roots) => invoke(() => {
                    assertMutation();
                    if (released || focusOwner !== claimant)
                        fail('KEYBOARD_FOCUS_SCOPE_CLOSED');
                    if (roots !== undefined) {
                        if (!Array.isArray(roots) || roots.length < 1 || roots.length > 32)
                            fail('KEYBOARD_FOCUS_SCOPE_INVALID');
                        for (const root of roots)
                            validateTarget(root);
                    }
                    focusRoots = roots === undefined ? undefined : Object.freeze([...roots]);
                    sync();
                }),
                focusFirst: () => invoke(() => {
                    assertMutation();
                    if (released || focusOwner !== claimant)
                        fail('KEYBOARD_FOCUS_SCOPE_CLOSED');
                    if (state !== 'active')
                        return;
                    sync();
                    focus(orderedTargets()[0]?.id, { reason: 'programmatic' });
                }),
                release: () => {
                    if (released)
                        return;
                    released = true;
                    if (focusOwner !== claimant)
                        return;
                    focusRoots = undefined;
                    focusOwner = undefined;
                }
            });
        });
        return input;
    }
    catch (cause) {
        try {
            close('error');
        }
        catch {
            /* Preserve setup failure. */
        }
        throw cause;
    }
}
//# sourceMappingURL=keyboardInput.js.map