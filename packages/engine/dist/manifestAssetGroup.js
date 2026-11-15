// SPDX-License-Identifier: Apache-2.0
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import { CancellationController, EgretError, Scope } from '@egret/runtime';
import { requireManifestBinding } from './manifestResourceState.js';
const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
const IS_ARRAY = Array.isArray;
const HAS_OWN = Object.prototype.hasOwnProperty;
const THEN = Promise.prototype.then;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const SCOPE_USE = Scope.prototype.use;
const ABORT = CancellationController.prototype.abort;
const MAX_GROUP = 128;
const MAX_QUEUED = 128;
const MAX_ACTIVE = 4;
function assertLifetime(context, scope) {
    context.assertOpen();
    if (!context.isEngineScope(scope))
        throw new EgretError('MANIFEST_GROUP_SCOPE_INVALID');
    if (APPLY(SCOPE_STATE, scope, []) !== 'open')
        throw new EgretError('SCOPE_CLOSED');
}
/** Caller access cannot hide Engine/Scope closure, including a thrown undefined. */
function callerRead(context, scope, code, read) {
    let value;
    let failed = false;
    let cause;
    try {
        value = read();
    }
    catch (error) {
        failed = true;
        cause = error;
    }
    assertLifetime(context, scope);
    if (failed)
        throw new EgretError(code, { cause });
    return value;
}
function snapshotArray(context, scope, input, code) {
    if (!callerRead(context, scope, code, () => IS_ARRAY(input)))
        throw new EgretError(code);
    const source = input;
    const length = callerRead(context, scope, code, () => source.length);
    if (!Number.isInteger(length) || length < 0 || length > MAX_GROUP)
        throw new EgretError(code);
    const values = [];
    for (let index = 0; index < length; index++) {
        if (!callerRead(context, scope, code, () => APPLY(HAS_OWN, source, [index])))
            throw new EgretError(code);
        values.push(callerRead(context, scope, code, () => source[index]));
    }
    return FREEZE(values);
}
function admitPriority(context, scope, options) {
    if (options === undefined)
        return 'interactive';
    if (typeof options !== 'object' ||
        options === null ||
        callerRead(context, scope, 'MANIFEST_GROUP_OPTIONS_INVALID', () => IS_ARRAY(options))) {
        throw new EgretError('MANIFEST_GROUP_OPTIONS_INVALID');
    }
    const priority = callerRead(context, scope, 'MANIFEST_GROUP_OPTIONS_INVALID', () => options.priority);
    if (priority === undefined)
        return 'interactive';
    if (priority !== 'interactive' && priority !== 'background')
        throw new EgretError('MANIFEST_GROUP_OPTIONS_INVALID');
    return priority;
}
/** Select already admitted graph data; do not duplicate manifest validation/hash. */
function selectMembers(manifest, roots, bindings) {
    const entries = new Map();
    for (const entry of manifest.entries)
        entries.set(entry.id, entry);
    const rootIds = new Set();
    for (const id of roots) {
        if (typeof id !== 'string' || rootIds.has(id) || !entries.has(id))
            throw new EgretError('MANIFEST_GROUP_ROOTS_INVALID');
        rootIds.add(id);
    }
    const selected = new Set();
    const ordered = [];
    function visit(id) {
        if (selected.has(id))
            return;
        if (selected.size === MAX_GROUP)
            throw new EgretError('MANIFEST_GROUP_LIMIT');
        selected.add(id);
        const entry = entries.get(id);
        for (const dependency of entry.dependencies)
            visit(dependency);
        ordered.push(entry);
    }
    for (const id of rootIds)
        visit(id);
    if (bindings.length !== selected.size)
        throw new EgretError('MANIFEST_GROUP_BINDINGS_INVALID');
    const byId = new Map();
    for (const binding of bindings) {
        const state = requireManifestBinding(binding);
        if (state.manifest !== manifest || !selected.has(state.entry.id) || byId.has(state.entry.id)) {
            throw new EgretError('MANIFEST_GROUP_BINDINGS_INVALID');
        }
        byId.set(state.entry.id, { binding: binding, state });
    }
    return FREEZE(ordered.map(entry => byId.get(entry.id)));
}
function makeRecord(scope, selected, priority) {
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    void APPLY(THEN, ready, [undefined, () => { }]);
    const group = {
        controller: new CancellationController(),
        priority,
        ready,
        resolveReady,
        rejectReady,
        byBinding: new Map(),
        scope,
        facade: undefined,
        state: 'pending',
        members: [],
        acquired: [],
        completed: 0,
        reserved: false
    };
    const byId = new Map();
    for (const value of selected) {
        const member = {
            group,
            ref: value.state.ref,
            state: 'queued',
            unmet: value.state.entry.dependencies.length,
            dependants: [],
            lease: undefined
        };
        group.members.push(member);
        group.byBinding.set(value.binding, member);
        byId.set(value.state.entry.id, member);
    }
    for (const value of selected) {
        const dependant = byId.get(value.state.entry.id);
        for (const dependency of value.state.entry.dependencies)
            byId.get(dependency).dependants.push(dependant);
    }
    return group;
}
/** One finite acquisition scheduler, using only captured manager lease authority. */
export function createManifestAssetGroupOwner(context, operations) {
    const groups = new Set();
    const interactive = [];
    const background = [];
    let admissionBusy = false;
    let pumping = false;
    let closed = false;
    let queued = 0;
    let active = 0;
    let interactiveRun = 0;
    function assertOpen() {
        context.assertOpen();
        if (closed)
            throw new EgretError('ENGINE_CLOSED');
    }
    function reportCleanup(cause) {
        context.captureCleanup(cause);
        context.report({ code: 'MANIFEST_GROUP_CLEANUP_FAILED', phase: 'assets', severity: 'error', cause });
    }
    function release(lease) {
        try {
            operations.releaseGroupLease(lease);
        }
        catch (cause) {
            reportCleanup(cause);
        }
    }
    function removeReadyRecords(queue, group) {
        // Remove physical records, not tombstones that cancellation loops can grow.
        for (let index = queue.length - 1; index >= 0; index--) {
            if (queue[index].group === group)
                queue.splice(index, 1);
        }
    }
    function commitTerminal(group, state, cause) {
        if (group.state === 'failed' || group.state === 'disposed')
            return undefined;
        const pending = group.state === 'pending';
        group.state = state;
        const error = new EgretError(state === 'failed' ? 'MANIFEST_GROUP_ACQUIRE_FAILED' : 'MANIFEST_GROUP_DISPOSED', {
            cause
        });
        if (pending)
            group.rejectReady(error);
        removeReadyRecords(interactive, group);
        removeReadyRecords(background, group);
        for (const member of group.members) {
            if (member.state === 'queued') {
                if (group.reserved)
                    queued--;
                member.state = 'cancelled';
            }
            member.ref = undefined;
            member.dependants = [];
            member.lease = undefined;
        }
        group.reserved = false;
        group.scope = undefined;
        group.facade = undefined;
        group.byBinding.clear();
        group.members = [];
        groups.delete(group);
        const leases = group.acquired;
        group.acquired = [];
        return { group, error, leases };
    }
    function runCleanup(snapshot) {
        // The group/queue authority is already revoked before either callback path.
        try {
            APPLY(ABORT, snapshot.group.controller, [snapshot.error]);
        }
        catch (cause) {
            reportCleanup(cause);
        }
        for (let index = snapshot.leases.length - 1; index >= 0; index--)
            release(snapshot.leases[index]);
    }
    function terminate(group, state, cause) {
        const snapshot = commitTerminal(group, state, cause);
        if (snapshot !== undefined)
            runCleanup(snapshot);
        pump();
    }
    function requirePending(group) {
        if (group.state !== 'pending')
            return false;
        try {
            assertOpen();
            assertLifetime(context, group.scope);
            return true;
        }
        catch (cause) {
            terminate(group, 'disposed', cause);
            return false;
        }
    }
    function enqueue(member) {
        if (member.state !== 'queued' || member.unmet !== 0 || member.group.state !== 'pending')
            return;
        (member.group.priority === 'interactive' ? interactive : background).push(member);
    }
    function fulfill(member, lease) {
        const group = member.group;
        if (!requirePending(group)) {
            release(lease);
            return;
        }
        try {
            operations.claimGroupLease(lease, group.facade);
        }
        catch (cause) {
            terminate(group, 'failed', cause);
            release(lease);
            return;
        }
        member.lease = lease;
        group.acquired.push(lease);
        group.completed++;
        if (group.completed === group.members.length) {
            group.state = 'ready';
            for (const item of group.members) {
                item.ref = undefined;
                item.dependants = [];
            }
            group.resolveReady();
            return;
        }
        for (const dependant of member.dependants) {
            dependant.unmet--;
            if (dependant.unmet === 0)
                enqueue(dependant);
        }
        member.dependants = [];
    }
    function reject(group, cause) {
        if (requirePending(group))
            terminate(group, 'failed', cause);
    }
    function start(member) {
        const group = member.group;
        const ref = member.ref;
        member.ref = undefined;
        member.state = 'active';
        queued--;
        active++;
        let outstanding = true;
        const retireSlot = () => {
            if (!outstanding)
                return;
            outstanding = false;
            active--;
            member.state = 'settled';
        };
        // This slot is a manager waiter. Its cancellation is not native settlement.
        try {
            const promise = operations.acquire(ref, { signal: group.controller.signal });
            const continuation = APPLY(THEN, promise, [
                (lease) => {
                    retireSlot();
                    try {
                        fulfill(member, lease);
                    }
                    finally {
                        pump();
                    }
                },
                (cause) => {
                    retireSlot();
                    reject(group, cause);
                    pump();
                }
            ]);
            void APPLY(THEN, continuation, [
                undefined,
                (cause) => {
                    retireSlot();
                    reject(group, cause);
                    pump();
                }
            ]);
        }
        catch (cause) {
            retireSlot();
            reject(group, cause);
            pump();
        }
    }
    function next() {
        if (interactive.length !== 0 && background.length !== 0) {
            if (interactiveRun < 4) {
                interactiveRun++;
                return interactive.shift();
            }
            interactiveRun = 0;
            return background.shift();
        }
        interactiveRun = 0;
        return interactive.length !== 0 ? interactive.shift() : background.shift();
    }
    function pump() {
        if (pumping || admissionBusy || closed)
            return;
        pumping = true;
        try {
            while (active < MAX_ACTIVE) {
                const member = next();
                if (member === undefined)
                    return;
                if (member.state !== 'queued' || !requirePending(member.group))
                    continue;
                start(member);
            }
        }
        finally {
            pumping = false;
        }
    }
    function disposalCause(group) {
        try {
            assertOpen();
        }
        catch (cause) {
            return cause;
        }
        if (group.scope !== undefined && APPLY(SCOPE_STATE, group.scope, []) !== 'open')
            return new EgretError('SCOPE_CLOSED');
        return undefined;
    }
    function makeHandle(group) {
        function assertReceiver(receiver) {
            if (receiver !== facade)
                throw new EgretError('MANIFEST_GROUP_INVALID');
        }
        const facade = FREEZE({
            get ready() {
                assertReceiver(this);
                return group.ready;
            },
            get(binding) {
                assertReceiver(this);
                requireManifestBinding(binding);
                const member = group.byBinding.get(binding);
                if (member === undefined)
                    throw new EgretError('MANIFEST_GROUP_BINDING_INVALID');
                if (group.state !== 'ready')
                    throw new EgretError('MANIFEST_GROUP_NOT_READY');
                assertOpen();
                assertLifetime(context, group.scope);
                return member.lease;
            },
            dispose() {
                assertReceiver(this);
                terminate(group, 'disposed', disposalCause(group));
            }
        });
        group.facade = facade;
        return facade;
    }
    return FREEZE({
        create(scope, manifest, roots, bindings, options) {
            assertOpen();
            assertLifetime(context, scope);
            if (admissionBusy)
                throw new EgretError('MANIFEST_GROUP_REENTRANT');
            if (!isAdmittedResourceManifest(manifest))
                throw new EgretError('MANIFEST_GROUP_MANIFEST_INVALID');
            admissionBusy = true;
            let group;
            let facade;
            try {
                const rootSnapshot = snapshotArray(context, scope, roots, 'MANIFEST_GROUP_ROOTS_INVALID');
                const bindingSnapshot = snapshotArray(context, scope, bindings, 'MANIFEST_GROUP_BINDINGS_INVALID');
                const priority = admitPriority(context, scope, options);
                const selected = selectMembers(manifest, rootSnapshot, bindingSnapshot);
                operations.admitGroupRefs(selected.map(value => value.state.ref));
                assertLifetime(context, scope);
                if (selected.length > MAX_QUEUED - queued)
                    throw new EgretError('MANIFEST_GROUP_QUEUE_LIMIT');
                group = makeRecord(scope, selected, priority);
                facade = makeHandle(group);
                // Reserve the whole closure, including blocked nodes, before activation.
                queued += selected.length;
                group.reserved = true;
                groups.add(group);
                try {
                    APPLY(SCOPE_USE, scope, [facade]);
                    assertLifetime(context, scope);
                }
                catch (cause) {
                    terminate(group, 'disposed', cause);
                    throw cause;
                }
            }
            finally {
                admissionBusy = false;
            }
            if (requirePending(group)) {
                if (group.members.length === 0) {
                    group.state = 'ready';
                    group.resolveReady();
                }
                else
                    for (const member of group.members)
                        enqueue(member);
            }
            pump();
            return facade;
        },
        close() {
            if (closed)
                return;
            closed = true;
            const snapshots = [];
            // Every group and queue record becomes terminal before the first callback.
            for (const group of groups) {
                const snapshot = commitTerminal(group, 'disposed', new EgretError('ENGINE_CLOSED'));
                if (snapshot !== undefined)
                    snapshots.push(snapshot);
            }
            for (const snapshot of snapshots)
                runCleanup(snapshot);
        }
    });
}
//# sourceMappingURL=manifestAssetGroup.js.map