// SPDX-License-Identifier: Apache-2.0
import { CancellationController, EgretError, Scope } from '@egret/runtime';
const engines = new WeakMap();
const apply = Reflect.apply;
const state = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const use = Scope.prototype.use;
const dispose = Scope.prototype.dispose;
const signalPrototype = Object.getPrototypeOf(new CancellationController().signal);
const aborted = Object.getOwnPropertyDescriptor(signalPrototype, 'aborted').get;
const add = Object.getOwnPropertyDescriptor(signalPrototype, 'addEventListener')
    .value;
const remove = Object.getOwnPropertyDescriptor(signalPrototype, 'removeEventListener')
    .value;
/** Capture authentic lifecycle and clock authority without loading optional animation logic. */
export function registerSequenceControllerEngine(engine, assembly) {
    const scopes = new WeakMap();
    const closers = new Set();
    let closed = false;
    function scope(value) {
        assembly.assertOpen();
        const signal = scopes.get(value);
        if (signal === undefined)
            throw new EgretError('ANIMATION_SCOPE_INVALID');
        const original = value;
        function assertOpen() {
            assembly.assertOpen();
            if (apply(state, original, []) !== 'open' || apply(aborted, signal, []))
                throw new EgretError('SCOPE_CLOSED');
        }
        assertOpen();
        return Object.freeze({
            scope: original,
            assertOpen,
            use(value) {
                apply(use, original, [value]);
            },
            dispose() {
                apply(dispose, original, []);
            },
            add(listener) {
                apply(add, signal, ['abort', listener, Object.freeze({ once: true })]);
            },
            remove(listener) {
                apply(remove, signal, ['abort', listener]);
            }
        });
    }
    const port = Object.freeze({
        assertOpen: assembly.assertOpen,
        scope,
        createScope() {
            return scope(assembly.createScope());
        },
        clock: assembly.clock,
        isClockBusy: assembly.isClockBusy,
        claims: assembly.claims,
        onClose(callback) {
            assembly.assertOpen();
            closers.add(callback);
            return () => {
                closers.delete(callback);
            };
        },
        report: assembly.report,
        captureCleanup: assembly.captureCleanup
    });
    engines.set(engine, port);
    return Object.freeze({
        registerScope(scope) {
            scopes.set(scope, scope.signal);
        },
        close() {
            if (closed)
                return;
            closed = true;
            const callbacks = [...closers];
            closers.clear();
            for (const callback of callbacks) {
                try {
                    callback();
                }
                catch (cause) {
                    assembly.captureCleanup(cause);
                    assembly.report({ code: 'ANIMATION_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause });
                }
            }
        }
    });
}
/** Public factory arguments grant no authority: only the original Engine identity is admitted. */
export function requireSequenceControllerEngine(engine) {
    const port = engines.get(engine);
    if (port === undefined)
        throw new EgretError('ANIMATION_ENGINE_INVALID');
    port.assertOpen();
    return port;
}
//# sourceMappingURL=sequenceControllerFactoryState.js.map