// SPDX-License-Identifier: Apache-2.0
import { EgretError, Scope } from '@egret/runtime';
const APPLY = Reflect.apply, FREEZE = Object.freeze, IS_ARRAY = Array.isArray;
const HAS_OWN = Object.prototype.hasOwnProperty;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const SCOPE_USE = Scope.prototype.use;
function assertLifetime(context, scope) {
    context.assertOpen();
    if (!context.isEngineScope(scope))
        throw new EgretError('BITMAP_BINDING_SCOPE_INVALID');
    if (APPLY(SCOPE_STATE, scope, []) !== 'open')
        throw new EgretError('SCOPE_CLOSED');
}
function assertAvailable(record) {
    assertLifetime(record.context, record.scope);
    if (record.phase === 'terminal') {
        throw new EgretError(record.conflict ? 'BITMAP_RESOURCE_BINDING_CHANGED' : 'BITMAP_BINDING_DISPOSED');
    }
}
function assertOperation(record, phase) {
    assertAvailable(record);
    if (record.reading)
        throw new EgretError('BITMAP_BINDING_REENTRANT');
    if (record.phase !== phase)
        throw new EgretError('BITMAP_BINDING_STATE_INVALID');
}
/** This pass revokes authority only; clearing is a separate callback-free pass. */
function markTerminal(record, conflict = false) {
    record.conflict = record.conflict || conflict;
    record.phase = 'terminal';
    record.captured = undefined;
    record.prepared = undefined;
    record.inventory.delete(record);
}
function clearPublication(record) {
    const publication = record.publication;
    record.publication = undefined;
    if (publication !== undefined)
        record.operations.clearBatchIfCurrent(publication);
}
function dispose(record) {
    markTerminal(record);
    clearPublication(record);
}
function observeRefusal(record, cause) {
    if (cause instanceof EgretError && cause.code === 'BITMAP_RESOURCE_BINDING_CHANGED')
        markTerminal(record, true);
    else if (cause instanceof EgretError && cause.code === 'OBJECT_DISPOSED')
        markTerminal(record);
}
/** Revalidate even thrown undefined before selecting a caller-read error. */
function callerRead(read, code, revalidate) {
    let value, failed = false;
    let cause;
    try {
        value = read();
    }
    catch (failure) {
        failed = true;
        cause = failure;
    }
    revalidate();
    if (failed)
        throw new EgretError(code, { cause });
    return value;
}
function snapshotArray(input, code, expected, revalidate) {
    if (!callerRead(() => IS_ARRAY(input), code, revalidate))
        throw new EgretError(code);
    const array = input;
    const length = callerRead(() => array.length, code, revalidate);
    if (!Number.isInteger(length) || length < 1 || length > 128 || (expected !== undefined && length !== expected))
        throw new EgretError(code);
    const snapshot = [];
    for (let index = 0; index < length; index++) {
        if (!callerRead(() => APPLY(HAS_OWN, array, [index]), code, revalidate))
            throw new EgretError(code);
        snapshot.push(callerRead(() => array[index], code, revalidate));
    }
    return FREEZE(snapshot);
}
function prepare(record, members) {
    assertOperation(record, 'captured');
    let snapshot;
    record.reading = true;
    try {
        snapshot = snapshotArray(members, 'BITMAP_BINDING_MEMBERS_INVALID', record.count, () => assertAvailable(record));
    }
    finally {
        record.reading = false;
    }
    try {
        const prepared = record.operations.prepareBatch(record.captured, snapshot);
        record.prepared = prepared;
        record.phase = 'prepared';
    }
    catch (cause) {
        observeRefusal(record, cause);
        throw cause;
    }
}
function commit(record) {
    assertOperation(record, 'prepared');
    try {
        const publication = record.operations.commitBatch(record.captured, record.prepared);
        // Runtime returns an already allocated publication; these writes call nobody.
        record.publication = publication;
        record.prepared = undefined;
        record.captured = undefined;
        record.phase = 'committed';
    }
    catch (cause) {
        observeRefusal(record, cause);
        throw cause;
    }
}
function handleFor(record, handles) {
    const receiver = (value) => {
        if (value !== handle)
            throw new EgretError('BITMAP_BINDING_INVALID');
    };
    const handle = FREEZE({
        prepare(members) {
            receiver(this);
            prepare(record, members);
        },
        commit() {
            receiver(this);
            commit(record);
        },
        dispose() {
            receiver(this);
            dispose(record);
        }
    });
    handles.set(handle, record);
    return handle;
}
export function createBitmapBindingOwner(context, targets) {
    const inventory = new Set();
    // Exact handles point back to the sole existing record, including terminal records.
    const handles = new WeakMap();
    return FREEZE({
        capture(scope, input) {
            assertLifetime(context, scope);
            const snapshot = snapshotArray(input, 'BITMAP_BINDING_TARGETS_INVALID', undefined, () => assertLifetime(context, scope));
            const seen = new Set();
            let operations;
            // All caller reads finished before authenticating final current targets.
            for (const target of snapshot) {
                const current = targets.get(target);
                if (current === undefined || seen.has(target) || (operations !== undefined && operations !== current)) {
                    throw new EgretError('BITMAP_BINDING_TARGETS_INVALID');
                }
                seen.add(target);
                operations = current;
            }
            const captured = operations.captureBatch(snapshot);
            const record = {
                context,
                scope,
                operations: operations,
                inventory,
                phase: 'captured',
                conflict: false,
                reading: false,
                captured,
                prepared: undefined,
                publication: undefined,
                count: snapshot.length
            };
            const handle = handleFor(record, handles);
            inventory.add(record);
            try {
                APPLY(SCOPE_USE, scope, [handle]);
            }
            catch (cause) {
                dispose(record);
                throw cause;
            }
            return handle;
        },
        readPreparedForCapture(ticket) {
            context.assertOpen();
            const record = handles.get(ticket);
            if (record === undefined)
                throw new EgretError('BITMAP_BINDING_INVALID');
            assertOperation(record, 'prepared');
            return FREEZE({
                validate() {
                    assertOperation(record, 'prepared');
                },
                captureContent(stage) {
                    assertOperation(record, 'prepared');
                    try {
                        return record.operations.capturePreparedSharedContent(stage, record.captured, record.prepared);
                    }
                    catch (cause) {
                        observeRefusal(record, cause);
                        throw cause;
                    }
                }
            });
        },
        close() {
            const records = [...inventory];
            // Every ticket is terminal before any matching publication is cleared.
            for (const record of records)
                markTerminal(record);
            for (const record of records)
                clearPublication(record);
        }
    });
}
//# sourceMappingURL=bitmapBindingTicket.js.map