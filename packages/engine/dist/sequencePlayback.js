// SPDX-License-Identifier: Apache-2.0
import { EgretError, Scope, SequencePlayer } from '@egret/runtime';
const MAX_PLAYBACKS = 256;
const playerConstructor = SequencePlayer;
const playerApply = SequencePlayer.prototype.applyAt;
const playerDispose = SequencePlayer.prototype.dispose;
const scopeUse = Scope.prototype.use;
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const apply = Reflect.apply;
/** A shared receiver-only bridge retains no individual player or resource borrow. */
function disposeOwnedPlayer() {
    apply(playerDispose, this, []);
}
function isTerminal(state) {
    return state === 'completed' || state === 'stopped' || state === 'failed';
}
/** Authentic membership and the captured state getter precede payload reads. */
function assertLifetime(context, scope) {
    context.assertOpen();
    if (!context.isEngineScope(scope))
        throw new EgretError('SEQ_PLAYBACK_SCOPE_INVALID');
    if (apply(scopeState, scope, []) !== 'open')
        throw new EgretError('SCOPE_CLOSED');
}
function scopeIsOpen(record) {
    return record.context.isEngineScope(record.scope) && apply(scopeState, record.scope, []) === 'open';
}
function admitMode(context, scope, options) {
    if (options === undefined)
        return 'once';
    if (options === null || typeof options !== 'object')
        throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID');
    let array;
    try {
        array = Array.isArray(options);
    }
    catch (cause) {
        throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID', { cause });
    }
    if (array)
        throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID');
    assertLifetime(context, scope);
    let mode;
    try {
        mode = options.mode;
    }
    catch (cause) {
        throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID', { cause });
    }
    // A throwing read preserves its own occurrence, including throw undefined.
    assertLifetime(context, scope);
    // The authentic player owns enum validation after its original resource checks.
    return (mode === undefined ? 'once' : mode);
}
function captureSecondary(context, cause) {
    // Cleanup recording must not prevent the original Engine close barriers.
    try {
        context.captureCleanup(cause);
    }
    catch {
        /* A recording failure cannot replace an already chosen primary cause. */
    }
}
/** Terminal identity is committed before cleanup; every acquired entry is attempted. */
function retire(record, terminal, preservePrimary = false) {
    if (isTerminal(record.state))
        return;
    record.state = terminal;
    const subscription = record.subscription;
    const player = record.player;
    const target = record.target;
    const owner = record.owner;
    const claims = record.claims;
    record.subscription = undefined;
    record.player = undefined;
    record.target = undefined;
    record.clip = undefined;
    record.owner = undefined;
    record.claims = undefined;
    // Scope/context remain only lifecycle authority; this is no physical-GC claim.
    let failed = false;
    let firstFailure;
    function attempt(cleanup) {
        try {
            cleanup();
        }
        catch (cause) {
            if (!failed) {
                failed = true;
                firstFailure = cause;
            }
            captureSecondary(record.context, cause);
        }
    }
    if (target !== undefined && claims !== undefined)
        attempt(() => {
            // An old Scope's historical handle must never remove a newer target claim.
            claims.release(target, record);
        });
    if (owner !== undefined)
        attempt(() => {
            owner.delete(record);
        });
    if (subscription !== undefined)
        attempt(() => {
            subscription.dispose();
        });
    if (player !== undefined)
        attempt(() => {
            apply(playerDispose, player, []);
        });
    if (failed && !preservePrimary)
        throw firstFailure;
}
function assertControl(record) {
    assertLifetime(record.context, record.scope);
    if (record.operationBusy)
        throw new EgretError('SEQ_PLAYBACK_REENTRANT');
    if (isTerminal(record.state))
        throw new EgretError('SEQ_PLAYBACK_TERMINAL');
}
/** A stopped transaction cannot commit observations or reacquire a registration. */
function canCommit(record, expected) {
    if (record.state !== expected || isTerminal(record.state))
        return false;
    record.context.assertOpen();
    if (!scopeIsOpen(record)) {
        retire(record, 'stopped');
        return false;
    }
    return true;
}
function makeTickHandler(record) {
    return (tick) => advancePlayback(record, tick);
}
function activate(record, expected, elapsed) {
    record.operationBusy = true;
    let applying = false;
    let acquired;
    try {
        // A clock-capacity refusal leaves the idle/paused record available for retry.
        acquired = record.context.clock.onTick(record.scope, makeTickHandler(record));
        if (!canCommit(record, expected)) {
            acquired.dispose();
            acquired = undefined;
            return;
        }
        record.subscription = acquired;
        acquired = undefined;
        applying = true;
        const sample = apply(playerApply, record.player, [elapsed]);
        if (!canCommit(record, expected))
            return;
        const anchor = record.context.clock.elapsedSeconds;
        // Crop success and lifetime confirmation precede all handle observations.
        record.lastSample = sample;
        record.elapsedSeconds = elapsed;
        record.runBase = elapsed;
        record.anchor = anchor;
        record.state = 'running';
    }
    catch (cause) {
        if (acquired !== undefined) {
            try {
                acquired.dispose();
            }
            catch (cleanupCause) {
                captureSecondary(record.context, cleanupCause);
            }
        }
        if (applying)
            retire(record, 'failed', true);
        else if (record.subscription !== undefined) {
            const subscription = record.subscription;
            record.subscription = undefined;
            try {
                subscription.dispose();
            }
            catch (cleanupCause) {
                captureSecondary(record.context, cleanupCause);
            }
        }
        throw cause;
    }
    finally {
        record.operationBusy = false;
    }
}
function startPlayback(record) {
    assertControl(record);
    if (record.state !== 'idle')
        throw new EgretError('SEQ_PLAYBACK_ALREADY_STARTED');
    activate(record, 'idle', 0);
}
function pausePlayback(record) {
    assertControl(record);
    if (record.state === 'idle')
        throw new EgretError('SEQ_PLAYBACK_NOT_STARTED');
    if (record.state !== 'running')
        return;
    record.operationBusy = true;
    record.state = 'paused';
    const subscription = record.subscription;
    record.subscription = undefined;
    try {
        subscription?.dispose();
    }
    finally {
        record.operationBusy = false;
    }
}
function resumePlayback(record) {
    assertControl(record);
    if (record.state === 'idle')
        throw new EgretError('SEQ_PLAYBACK_NOT_STARTED');
    if (record.state === 'paused')
        activate(record, 'paused', record.elapsedSeconds);
}
function advancePlayback(record, tick) {
    if (record.state !== 'running')
        return undefined;
    record.operationBusy = true;
    try {
        record.context.assertOpen();
        // Cancellation enters closing before reverse cleanup can reach this handle.
        if (!scopeIsOpen(record)) {
            retire(record, 'stopped');
            return undefined;
        }
        const delta = tick.elapsedSeconds - record.anchor;
        if (delta <= 0)
            return undefined;
        if (!Number.isFinite(delta))
            throw new EgretError('SEQ_PLAYBACK_TIME_RANGE');
        const final = record.mode === 'once' && delta >= record.durationSeconds - record.runBase;
        // Cap once before addition; looping never silently loses a positive interval.
        const elapsed = final ? record.durationSeconds : record.runBase + delta;
        if (!final && (!Number.isFinite(elapsed) || elapsed <= record.elapsedSeconds))
            throw new EgretError('SEQ_PLAYBACK_TIME_RANGE');
        const sample = apply(playerApply, record.player, [elapsed]);
        if (!canCommit(record, 'running'))
            return undefined;
        record.elapsedSeconds = elapsed;
        record.lastSample = sample;
        if (final)
            retire(record, 'completed');
        return undefined;
    }
    catch (cause) {
        retire(record, 'failed', true);
        // The authentic clock alone supplies CLOCK_CALLBACK_FAILED and diagnostics.
        throw cause;
    }
    finally {
        record.operationBusy = false;
    }
}
/** Every operation checks the exact frozen facade, including observation getters. */
function makeHandle(record) {
    function assertReceiver(receiver) {
        if (receiver !== handle)
            throw new EgretError('SEQ_PLAYBACK_INVALID');
    }
    const handle = Object.freeze({
        get state() {
            assertReceiver(this);
            return record.state;
        },
        get isDisposed() {
            assertReceiver(this);
            return isTerminal(record.state);
        },
        get elapsedSeconds() {
            assertReceiver(this);
            return record.elapsedSeconds;
        },
        get lastSample() {
            assertReceiver(this);
            return record.lastSample;
        },
        start() {
            assertReceiver(this);
            startPlayback(record);
        },
        pause() {
            assertReceiver(this);
            pausePlayback(record);
        },
        resume() {
            assertReceiver(this);
            resumePlayback(record);
        },
        stop() {
            assertReceiver(this);
            retire(record, 'stopped');
        },
        dispose() {
            assertReceiver(this);
            retire(record, 'stopped');
        }
    });
    return handle;
}
/** Only private Engine assembly owns inventory and authentic-clock subscriptions. */
export function createSequencePlaybackOwner(context) {
    const records = new Set();
    const claims = context.claims;
    let creating = false;
    return Object.freeze({
        create(scope, bitmap, clip, options) {
            assertLifetime(context, scope);
            if (creating)
                throw new EgretError('SEQ_PLAYBACK_CREATION_REENTRANT');
            if (claims.size >= MAX_PLAYBACKS)
                throw new EgretError('SEQ_PLAYBACK_LIMIT');
            creating = true;
            let player;
            let record;
            try {
                const mode = admitMode(context, scope, options);
                player = new playerConstructor(bitmap, clip, mode);
                // Seal before the first intrinsic Scope adoption, including late cleanup.
                Object.defineProperty(player, 'dispose', {
                    value: disposeOwnedPlayer,
                    enumerable: false,
                    writable: false,
                    configurable: false
                });
                assertLifetime(context, scope);
                // An option getter may have admitted the other profile after the first capacity check.
                if (claims.size >= MAX_PLAYBACKS)
                    throw new EgretError('SEQ_PLAYBACK_LIMIT');
                if (claims.has(bitmap))
                    throw new EgretError('SEQ_PLAYBACK_TARGET_BUSY');
                record = {
                    context,
                    scope,
                    mode,
                    durationSeconds: clip.durationSeconds,
                    player,
                    target: bitmap,
                    clip,
                    owner: undefined,
                    claims: undefined,
                    subscription: undefined,
                    state: 'idle',
                    elapsedSeconds: 0,
                    lastSample: undefined,
                    runBase: 0,
                    anchor: 0,
                    operationBusy: false
                };
                player = undefined; // The mutable record is now the sole cleanup borrow.
                const handle = makeHandle(record);
                apply(scopeUse, scope, [record.player]);
                apply(scopeUse, scope, [handle]);
                assertLifetime(context, scope);
                if (isTerminal(record.state))
                    throw new EgretError('SEQ_PLAYBACK_TERMINAL');
                // Store rollback authority before callback-free claim/inventory publication.
                record.claims = claims;
                record.owner = records;
                claims.acquire(bitmap, record);
                records.add(record);
                return handle;
            }
            catch (cause) {
                if (record !== undefined)
                    retire(record, 'stopped', true);
                else if (player !== undefined) {
                    try {
                        apply(playerDispose, player, []);
                    }
                    catch (cleanupCause) {
                        captureSecondary(context, cleanupCause);
                    }
                }
                throw cause;
            }
            finally {
                creating = false;
            }
        },
        close() {
            // Secondary faults are collected per record; no record can block clock close.
            for (const record of records)
                retire(record, 'stopped', true);
        }
    });
}
//# sourceMappingURL=sequencePlayback.js.map