// SPDX-License-Identifier: Apache-2.0
import { CancellationController, EgretError, Scope } from '@egret/runtime';
const engines = new WeakMap();
const inputs = new WeakMap();
const keyboards = new WeakMap();
const apply = Reflect.apply;
const state = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const use = Scope.prototype.use, dispose = Scope.prototype.dispose;
/** Eager assembly captures authority; optional UI logic and numerical modules stay lazy. */
export function registerUiEngine(engine, assembly) {
    const token = {};
    const scopes = new WeakMap();
    const closers = new Set();
    let closed = false;
    const delivery = { depth: 0 };
    // This function retains only a tiny counter, never a closed Engine or Stage.
    const deliver = (callback) => {
        delivery.depth++;
        try {
            return callback();
        }
        finally {
            delivery.depth--;
        }
    };
    const signalPrototype = Object.getPrototypeOf(new CancellationController().signal);
    const aborted = Object.getOwnPropertyDescriptor(signalPrototype, 'aborted').get;
    const add = Object.getOwnPropertyDescriptor(signalPrototype, 'addEventListener')
        .value;
    const remove = Object.getOwnPropertyDescriptor(signalPrototype, 'removeEventListener')
        .value;
    const port = Object.freeze({
        stage: assembly.stage,
        terminal: () => closed,
        keyboardScope(input, owner) {
            const identity = keyboards.get(input);
            if (identity === undefined || identity.token !== token)
                throw new EgretError('UI_KEYBOARD_INVALID');
            return identity.claim(owner);
        },
        assertOpen: assembly.assertOpen,
        assertIdle() {
            assembly.assertOpen();
            if (assembly.isFrameBusy() || delivery.depth !== 0)
                throw new EgretError('UI_BUSY');
        },
        isEngineScope(value) {
            return scopes.has(value);
        },
        createScope: assembly.createScope,
        scope(value) {
            assembly.assertOpen();
            const signal = scopes.get(value);
            if (signal === undefined)
                throw new EgretError('UI_SCOPE_INVALID');
            const scope = value;
            const assertOpen = () => {
                assembly.assertOpen();
                if (apply(state, scope, []) !== 'open' || apply(aborted, signal, []) === true)
                    throw new EgretError('SCOPE_CLOSED');
            };
            assertOpen();
            return Object.freeze({
                scope,
                signal,
                assertOpen,
                use(value) {
                    apply(use, scope, [value]);
                },
                dispose() {
                    apply(dispose, scope, []);
                },
                add(listener) {
                    apply(add, signal, ['abort', listener, Object.freeze({ once: true })]);
                },
                remove(listener) {
                    apply(remove, signal, ['abort', listener]);
                }
            });
        },
        display(factory) {
            assembly.assertOpen();
            return factory(assembly.stage);
        },
        requireInput(value) {
            assembly.assertOpen();
            const identity = inputs.get(value);
            if (identity === undefined || identity.token !== token)
                throw new EgretError('UI_INPUT_INVALID');
            return identity.port;
        },
        requireKeyboard(value) {
            assembly.assertOpen();
            const identity = keyboards.get(value);
            if (identity === undefined || identity.token !== token || identity.input.getSnapshot().state === 'closed')
                throw new EgretError('UI_KEYBOARD_INVALID');
            return identity.input;
        },
        onClose(callback) {
            assembly.assertOpen();
            closers.add(callback);
            return () => {
                closers.delete(callback);
            };
        }
    });
    engines.set(engine, { token, port, deliver });
    return Object.freeze({
        registerScope(scope) {
            scopes.set(scope, scope.signal);
        },
        deliver,
        close() {
            if (closed)
                return;
            closed = true;
            const callbacks = [...closers];
            closers.clear();
            for (const callback of callbacks)
                try {
                    callback();
                }
                catch (cause) {
                    assembly.captureCleanup(cause);
                    assembly.report({ code: 'UI_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause });
                }
        }
    });
}
/** Genuine Engine and PointerInput facades are admitted by identity, never shape. */
export function requireUiEngine(engine) {
    const identity = engines.get(engine);
    if (identity === undefined)
        throw new EgretError('UI_ENGINE_INVALID');
    identity.port.assertOpen();
    return identity.port;
}
export function captureUiInputDelivery(engine) {
    const identity = engines.get(engine);
    if (identity === undefined)
        throw new EgretError('UI_ENGINE_INVALID');
    return identity.deliver;
}
export function registerUiPointerInput(input, engine, port) {
    const identity = engines.get(engine);
    if (identity === undefined)
        throw new EgretError('UI_ENGINE_INVALID');
    inputs.set(input, { token: identity.token, port });
}
/** Register only an authentic channel assembled against this Engine. */
export function registerUiKeyboardInput(input, engine, claim) {
    const identity = engines.get(engine);
    if (identity === undefined)
        throw new EgretError('UI_ENGINE_INVALID');
    keyboards.set(input, { token: identity.token, input, claim });
}
//# sourceMappingURL=uiFactoryState.js.map