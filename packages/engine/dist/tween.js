import { EgretError, Scope } from '@egret/runtime';
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const scopeUse = Scope.prototype.use;
/** Engine identity and captured Scope operations outrank public field overrides. */
function assertLifetime(context, scope) {
    context.assertOpen();
    if (!context.isEngineScope(scope))
        throw new EgretError('TWEEN_SCOPE_INVALID');
    if (Reflect.apply(scopeState, scope, []) !== 'open')
        throw new EgretError('SCOPE_CLOSED');
}
function readOption(options, key, context, scope) {
    let value;
    try {
        value = options[key];
    }
    catch (cause) {
        throw new EgretError('TWEEN_OPTIONS_INVALID', { cause });
    }
    // A throwing getter keeps its own cause; only successful reads recheck lives.
    assertLifetime(context, scope);
    return value;
}
/** Admission snapshots six fields once; the caller's object never enters a record. */
function admitOptions(context, scope, options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('TWEEN_OPTIONS_INVALID');
    let isArray;
    try {
        isArray = Array.isArray(options);
    }
    catch (cause) {
        throw new EgretError('TWEEN_OPTIONS_INVALID', { cause });
    }
    if (isArray)
        throw new EgretError('TWEEN_OPTIONS_INVALID');
    const from = readOption(options, 'from', context, scope);
    const to = readOption(options, 'to', context, scope);
    const durationSeconds = readOption(options, 'durationSeconds', context, scope);
    const easingValue = readOption(options, 'easing', context, scope);
    const onUpdate = readOption(options, 'onUpdate', context, scope);
    const onComplete = readOption(options, 'onComplete', context, scope);
    if (typeof from !== 'number' || !Number.isFinite(from) || typeof to !== 'number' || !Number.isFinite(to))
        throw new EgretError('TWEEN_OPTIONS_INVALID');
    const normalizedFrom = from === 0 ? 0 : from;
    const normalizedTo = to === 0 ? 0 : to;
    const difference = normalizedTo - normalizedFrom;
    if (!Number.isFinite(difference))
        throw new EgretError('TWEEN_RANGE_INVALID');
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0)
        throw new EgretError('TWEEN_OPTIONS_INVALID');
    const easing = easingValue === undefined ? 'linear' : easingValue;
    if (easing !== 'linear' && easing !== 'quadIn' && easing !== 'quadOut' && easing !== 'quadInOut')
        throw new EgretError('TWEEN_OPTIONS_INVALID');
    if (typeof onUpdate !== 'function' || (onComplete !== undefined && typeof onComplete !== 'function'))
        throw new EgretError('TWEEN_OPTIONS_INVALID');
    // Frozen scalars contain no callback borrows. The temporary admission object
    // is copied into mutable record fields, never captured by a handle or handler.
    return {
        scalars: Object.freeze({ from: normalizedFrom, to: normalizedTo, difference, durationSeconds, easing }),
        onUpdate: onUpdate,
        onComplete: onComplete
    };
}
function makeRecord(context, scope, admitted) {
    return {
        context,
        scalars: admitted.scalars,
        scope,
        owner: undefined,
        subscription: undefined,
        onUpdate: admitted.onUpdate,
        onComplete: admitted.onComplete,
        state: 'idle',
        elapsedSeconds: 0,
        progress: 0,
        value: admitted.scalars.from,
        anchor: 0,
        runBase: 0,
        callbackBusy: false
    };
}
function isTerminal(state) {
    return state === 'completed' || state === 'stopped' || state === 'failed';
}
/** Retire once; stop/close always wins over a later failure of the active writer. */
function retire(record, terminal) {
    if (isTerminal(record.state))
        return;
    record.state = terminal;
    record.onUpdate = undefined;
    record.onComplete = undefined;
    record.scope = undefined;
    const subscription = record.subscription;
    record.subscription = undefined;
    const owner = record.owner;
    record.owner = undefined;
    owner?.delete(record);
    // Genuine frozen subscriptions release only their own clock registration.
    subscription?.dispose();
}
function scopeIsOpen(record) {
    const scope = record.scope;
    return scope !== undefined && record.context.isEngineScope(scope) && Reflect.apply(scopeState, scope, []) === 'open';
}
/** Forbidden asynchronous results are observed without becoming an idle barrier. */
function observeRejectedResult(result) {
    const ignoreRejection = () => { };
    try {
        void Reflect.apply(Promise.prototype.then, result, [undefined, ignoreRejection]);
    }
    catch {
        try {
            void Promise.resolve(result).then(undefined, ignoreRejection);
        }
        catch {
            /* Observation cannot replace TWEEN_CALLBACK_RETURN_INVALID. */
        }
    }
}
function invokeCallback(callback, args, code) {
    try {
        const result = Reflect.apply(callback, undefined, args);
        if (result !== undefined) {
            // Choose the primary cause before any hostile thenable observation runs.
            const cause = new EgretError('TWEEN_CALLBACK_RETURN_INVALID');
            observeRejectedResult(result);
            throw cause;
        }
    }
    catch (cause) {
        // The existing clock alone adds its diagnostic and CLOCK_CALLBACK_FAILED.
        throw new EgretError(code, { cause });
    }
}
function easedProgress(progress, easing) {
    switch (easing) {
        case 'linear':
            return progress;
        case 'quadIn':
            return progress * progress;
        case 'quadOut':
            return progress * (2 - progress);
        case 'quadInOut':
            return progress < 0.5 ? 2 * progress * progress : 1 - 2 * (1 - progress) * (1 - progress);
    }
}
function advanceTween(record, tick) {
    if (record.state !== 'running')
        return undefined;
    try {
        record.context.assertOpen();
        // Scope cancellation enters closing before reverse cleanup. An abort
        // listener may reach a new tick in that interval; it must not call a writer.
        if (!scopeIsOpen(record)) {
            retire(record, 'stopped');
            return undefined;
        }
        const delta = tick.elapsedSeconds - record.anchor;
        if (delta <= 0)
            return undefined; // A fresh same-tick anchor offers nothing.
        if (!Number.isFinite(delta))
            throw new EgretError('TWEEN_TIME_RANGE');
        const { from, to, difference, durationSeconds, easing } = record.scalars;
        // The run base stays fixed until resume. Add the whole anchored interval,
        // never that interval to a prior offer, and cap before an overflowing sum.
        const remaining = durationSeconds - record.runBase;
        const final = delta >= remaining;
        const elapsed = final ? durationSeconds : record.runBase + delta;
        if (!final && (!Number.isFinite(elapsed) || elapsed <= record.elapsedSeconds))
            throw new EgretError('TWEEN_TIME_RANGE');
        const progress = final ? 1 : elapsed / durationSeconds;
        const value = final ? to : from + difference * easedProgress(progress, easing);
        if (!Number.isFinite(value))
            throw new EgretError('TWEEN_RANGE_INVALID');
        // Offers are observations, not proof of setter success. Failures preserve
        // these committed scalars and any application side effects without replay.
        record.elapsedSeconds = elapsed;
        record.progress = progress;
        record.value = value;
        const writer = record.onUpdate;
        record.callbackBusy = true;
        invokeCallback(writer, [value], 'TWEEN_UPDATE_FAILED');
        if (record.state !== 'running')
            return undefined;
        record.context.assertOpen();
        if (!scopeIsOpen(record)) {
            retire(record, 'stopped');
            return undefined;
        }
        if (final) {
            // Release record-held writer/completion/subscription borrows before the
            // local completion invocation. Its busy flag still refuses own controls.
            const completion = record.onComplete;
            retire(record, 'completed');
            if (completion !== undefined)
                invokeCallback(completion, [], 'TWEEN_COMPLETE_FAILED');
        }
        return undefined;
    }
    catch (cause) {
        retire(record, 'failed');
        throw cause;
    }
    finally {
        record.callbackBusy = false;
    }
}
/** This closure captures only the mutable record, never an admission snapshot. */
function makeTickHandler(record) {
    return (tick) => advanceTween(record, tick);
}
function assertControl(record) {
    record.context.assertOpen();
    if (record.callbackBusy)
        throw new EgretError('TWEEN_REENTRANT');
    if (isTerminal(record.state))
        throw new EgretError('TWEEN_TERMINAL');
}
function startTween(record) {
    assertControl(record);
    if (record.state !== 'idle')
        throw new EgretError('TWEEN_ALREADY_STARTED');
    // Capacity and genuine Scope adoption happen before running/anchor commit.
    // Refusal retains an idle handle, which can retry after a slot is released.
    const subscription = record.context.clock.onTick(record.scope, makeTickHandler(record));
    record.subscription = subscription;
    record.runBase = 0;
    record.anchor = record.context.clock.elapsedSeconds;
    record.state = 'running';
}
function pauseTween(record) {
    assertControl(record);
    if (record.state === 'idle')
        throw new EgretError('TWEEN_NOT_STARTED');
    if (record.state === 'running')
        record.state = 'paused';
}
function resumeTween(record) {
    assertControl(record);
    if (record.state === 'idle')
        throw new EgretError('TWEEN_NOT_STARTED');
    if (record.state === 'paused') {
        record.runBase = record.elapsedSeconds;
        record.anchor = record.context.clock.elapsedSeconds;
        record.state = 'running';
    }
}
/** Frozen own facades keep cached observations and check every receiver. */
function makeHandle(record) {
    function assertReceiver(receiver) {
        if (receiver !== tween)
            throw new EgretError('TWEEN_INVALID');
    }
    const tween = Object.freeze({
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
        get progress() {
            assertReceiver(this);
            return record.progress;
        },
        get value() {
            assertReceiver(this);
            return record.value;
        },
        start() {
            assertReceiver(this);
            startTween(record);
        },
        pause() {
            assertReceiver(this);
            pauseTween(record);
        },
        resume() {
            assertReceiver(this);
            resumeTween(record);
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
    return tween;
}
/** Private Engine assembly; live records alone belong to the owner inventory. */
export function createTweenOwner(context) {
    const records = new Set();
    return Object.freeze({
        create(scope, options) {
            assertLifetime(context, scope);
            const admitted = admitOptions(context, scope, options);
            const record = makeRecord(context, scope, admitted);
            const tween = makeHandle(record);
            try {
                Reflect.apply(scopeUse, scope, [tween]);
            }
            catch (cause) {
                retire(record, 'stopped');
                throw cause;
            }
            // The frozen idle handle is intrinsically owned before owner publication;
            // no callback/subscription or caller work intervenes in this commit.
            record.owner = records;
            records.add(record);
            return tween;
        },
        close() {
            // Engine closing synchronously terminalizes idle, running and paused
            // handles. Its existing clock/frame barriers own later resource cleanup.
            for (const record of records)
                retire(record, 'stopped');
        }
    });
}
//# sourceMappingURL=tween.js.map