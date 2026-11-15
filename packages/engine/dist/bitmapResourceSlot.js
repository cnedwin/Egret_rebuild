// SPDX-License-Identifier: Apache-2.0
import { CancellationController, EgretError, Scope } from '@egret/runtime';
const APPLY = Reflect.apply, FREEZE = Object.freeze;
const THEN = Promise.prototype.then;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const SCOPE_USE = Scope.prototype.use;
const ABORT = CancellationController.prototype.abort;
const IGNORE = () => { };
function assertLifetime(context, scope) {
    context.assertOpen();
    if (!context.isEngineScope(scope))
        throw new EgretError('BITMAP_RESOURCE_SCOPE_INVALID');
    if (APPLY(SCOPE_STATE, scope, []) !== 'open')
        throw new EgretError('SCOPE_CLOSED');
}
function report(record, cause) {
    record.context.captureCleanup(cause);
    record.context.report({ code: 'BITMAP_RESOURCE_CLEANUP_FAILED', phase: 'assets', severity: 'error', cause });
}
function release(record, lease, errors) {
    try {
        record.operations.release(lease);
    }
    catch (cause) {
        errors?.push(cause);
        report(record, cause);
    }
}
function abort(record, request, reason, errors) {
    try {
        APPLY(ABORT, request.controller, [reason]);
    }
    catch (cause) {
        errors?.push(cause);
        report(record, cause);
    }
}
function closingCause(record) {
    try {
        record.context.assertOpen();
    }
    catch (cause) {
        return cause;
    }
    if (APPLY(SCOPE_STATE, record.scope, []) !== 'open')
        return new EgretError('SCOPE_CLOSED');
    return undefined;
}
/** Retire all logical authority and matching borrows before any cleanup callout. */
function retire(record, cause) {
    if (record.state === 'disposed')
        return undefined;
    const request = record.request, lease = record.owned, expected = record.expected;
    const error = new EgretError('BITMAP_RESOURCE_DISPOSED', { cause });
    record.state = 'disposed';
    record.request = undefined;
    record.owned = undefined;
    record.expected = undefined;
    record.inventory.delete(record);
    record.claims.delete(record.bitmap);
    request?.reject(error);
    const errors = [];
    if (lease !== undefined && expected !== undefined) {
        try {
            record.operations.clearIfCurrent(record.bitmap, expected);
        }
        catch (failure) {
            errors.push(failure);
        }
    }
    return { record, request, lease, cause: error, errors };
}
function cleanup(snapshot) {
    if (snapshot === undefined)
        return;
    const { record, request, lease, cause, errors } = snapshot;
    // Clear faults were collected without callbacks during the Engine-wide first pass.
    for (const failure of errors)
        report(record, failure);
    if (request !== undefined)
        abort(record, request, cause);
    if (lease !== undefined)
        release(record, lease);
}
function conflict(record) {
    const error = new EgretError('BITMAP_RESOURCE_BINDING_CHANGED');
    const request = record.request;
    record.request = undefined;
    record.state = 'conflicted';
    request?.reject(error);
    if (request !== undefined)
        abort(record, request, error);
    return error;
}
/** Detach before abort/release; reentrant later intent must keep its own state. */
function fail(record, request, cause, candidate) {
    if (record.request !== request) {
        if (candidate !== undefined)
            release(record, candidate);
        return;
    }
    record.request = undefined;
    record.state = 'failed';
    const errors = [];
    abort(record, request, cause, errors);
    if (candidate !== undefined)
        release(record, candidate, errors);
    request.reject(new EgretError('BITMAP_RESOURCE_REPLACE_FAILED', { cause, cleanupErrors: errors }));
}
function inspectTarget(record) {
    let token;
    try {
        token = record.operations.capture(record.bitmap, record.expected);
    }
    catch (cause) {
        if (cause instanceof EgretError && cause.code === 'OBJECT_DISPOSED') {
            cleanup(retire(record, cause));
            throw cause;
        }
        if (cause instanceof EgretError &&
            (cause.code === 'BITMAP_RESOURCE_TEXTURE_REQUIRED' || cause.code === 'BITMAP_RESOURCE_BINDING_CHANGED'))
            throw conflict(record);
        const request = record.request;
        if (request !== undefined)
            fail(record, request, cause);
        else
            record.state = 'failed';
        throw cause;
    }
    if (token !== record.expected)
        throw conflict(record);
}
function assertControl(record) {
    assertLifetime(record.context, record.scope);
    if (record.state === 'disposed')
        throw new EgretError('BITMAP_RESOURCE_DISPOSED');
    if (record.state === 'conflicted')
        throw new EgretError('BITMAP_RESOURCE_BINDING_CHANGED');
    inspectTarget(record);
}
function active(record, request) {
    if (record.request !== request)
        return false;
    try {
        assertLifetime(record.context, record.scope);
    }
    catch (cause) {
        cleanup(retire(record, cause));
        return false;
    }
    try {
        inspectTarget(record);
    }
    catch {
        return false;
    }
    return record.request === request;
}
function makeRequest(record) {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    // A discarded returned Promise must not produce an unhandled rejection.
    void APPLY(THEN, promise, [undefined, IGNORE]);
    return {
        promise,
        resolve,
        reject,
        controller: new CancellationController(diagnostic => {
            record.context.captureCleanup(diagnostic.cause);
            record.context.report(diagnostic);
        })
    };
}
function fulfilled(record, request, candidate) {
    let cell = candidate;
    try {
        if (!active(record, request))
            return;
        record.operations.claim(record.bitmap, candidate, record.facade);
        const prepared = record.operations.prepare(record.bitmap, candidate);
        if (!active(record, request))
            return;
        record.operations.commit(record.bitmap, record.expected, prepared);
        const previous = record.owned;
        // No application callback lies between runtime commit and owner publication.
        record.owned = candidate;
        record.expected = prepared;
        record.request = undefined;
        record.state = 'ready';
        cell = undefined;
        request.resolve();
        // Visible success cannot be undone by old-value cleanup or its reentry.
        if (previous !== undefined)
            release(record, previous);
    }
    catch (cause) {
        if (record.request === request) {
            const failed = cell;
            cell = undefined;
            fail(record, request, cause, failed);
        }
    }
    finally {
        // Cancellation may have lost manager delivery before this Promise reaction.
        if (cell !== undefined)
            release(record, cell);
    }
}
function rejected(record, request, cause) {
    if (active(record, request))
        fail(record, request, cause);
}
function replace(record, ref) {
    assertControl(record);
    // Synchronous authentic admission preserves any existing intent on invalid input.
    record.acquisitions.admitGroupRefs([ref]);
    assertControl(record);
    const request = makeRequest(record), previous = record.request;
    record.request = request;
    record.state = 'pending';
    if (previous !== undefined) {
        const error = new EgretError('BITMAP_RESOURCE_SUPERSEDED');
        previous.reject(error);
        abort(record, previous, error);
    }
    if (!active(record, request))
        return request.promise;
    try {
        const acquired = record.acquisitions.acquire(ref, { signal: request.controller.signal });
        // Always observe started work, including synchronous loader supersession.
        const observed = APPLY(THEN, acquired, [
            (lease) => {
                fulfilled(record, request, lease);
            },
            (cause) => {
                rejected(record, request, cause);
            }
        ]);
        void APPLY(THEN, observed, [
            undefined,
            (cause) => {
                rejected(record, request, cause);
            }
        ]);
    }
    catch (cause) {
        rejected(record, request, cause);
    }
    return request.promise;
}
function handleFor(record) {
    const receiver = (value) => {
        if (value !== handle)
            throw new EgretError('BITMAP_RESOURCE_INVALID');
    };
    const handle = FREEZE({
        get state() {
            receiver(this);
            return record.state;
        },
        replace(ref) {
            receiver(this);
            return replace(record, ref);
        },
        cancel(reason) {
            receiver(this);
            assertControl(record);
            const request = record.request;
            if (request === undefined)
                return;
            record.request = undefined;
            record.state = record.owned === undefined ? 'idle' : 'ready';
            const error = new EgretError('BITMAP_RESOURCE_CANCELLED', { cause: reason });
            request.reject(error);
            abort(record, request, error);
        },
        dispose() {
            receiver(this);
            cleanup(retire(record, closingCause(record)));
        }
    });
    record.facade = handle;
    return handle;
}
export function createBitmapResourceSlotOwner(context, acquisitions, targets) {
    const inventory = new Set(), claims = new WeakMap();
    return FREEZE({
        create(scope, target) {
            assertLifetime(context, scope);
            const bitmap = target, operations = targets.get(bitmap);
            if (operations === undefined)
                throw new EgretError('BITMAP_RESOURCE_TARGET_INVALID');
            const expected = operations.capture(bitmap);
            if (claims.has(bitmap))
                throw new EgretError('BITMAP_RESOURCE_TARGET_BUSY');
            if (inventory.size >= 256)
                throw new EgretError('BITMAP_RESOURCE_LIMIT');
            const record = {
                context,
                acquisitions,
                operations,
                scope,
                bitmap,
                inventory,
                claims,
                state: 'idle',
                expected,
                owned: undefined,
                request: undefined,
                facade: undefined
            };
            const handle = handleFor(record);
            claims.set(bitmap, record);
            inventory.add(record);
            try {
                APPLY(SCOPE_USE, scope, [handle]);
            }
            catch (cause) {
                cleanup(retire(record, cause));
                throw cause;
            }
            return handle;
        },
        close() {
            const snapshots = [];
            for (const record of inventory) {
                const snapshot = retire(record, closingCause(record));
                if (snapshot !== undefined)
                    snapshots.push(snapshot);
            }
            // All slots are terminal/cleared before the first abort/disposer/diagnostic.
            for (const snapshot of snapshots)
                cleanup(snapshot);
        }
    });
}
//# sourceMappingURL=bitmapResourceSlot.js.map