import { EgretError, Scope } from '@egret/runtime';
const MAX_SUBSCRIPTIONS = 256;
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const scopeUse = Scope.prototype.use;
/** Admission retains only a frozen scalar, never the caller's option object. */
export function admitGameClockOptions(value) {
    let maximum;
    if (value !== undefined) {
        if (value === null || typeof value !== 'object')
            throw new EgretError('CLOCK_OPTIONS_INVALID');
        let isArray;
        try {
            isArray = Array.isArray(value);
        }
        catch (cause) {
            throw new EgretError('CLOCK_OPTIONS_INVALID', { cause });
        }
        if (isArray)
            throw new EgretError('CLOCK_OPTIONS_INVALID');
        try {
            maximum = value.maxDeltaSeconds;
        }
        catch (cause) {
            throw new EgretError('CLOCK_OPTIONS_INVALID', { cause });
        }
    }
    if (maximum === undefined)
        maximum = 0.25;
    if (typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum <= 0 || maximum > 1)
        throw new EgretError('CLOCK_OPTIONS_INVALID');
    return Object.freeze({ maxDeltaSeconds: maximum });
}
/** Invalid asynchronous returns are observed, never awaited or accepted. */
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
            /* Observation cannot replace CLOCK_CALLBACK_RETURN_INVALID. */
        }
    }
}
/** Private owner; public facades supply observation and receiver-checked service. */
export function createGameClockOwner(context, options) {
    let state = 'running';
    let elapsedSeconds = 0;
    let tickId = 0;
    // The monotonic source floor survives pauses; the running anchor excludes gaps.
    let acceptedSource;
    let anchor;
    let nextSequence = 1;
    let liveCount = 0;
    let busy = false;
    let idle;
    let releaseIdle;
    // Slots retain only live registrations. Scope's historical handles remain its own.
    const slots = new Array(MAX_SUBSCRIPTIONS).fill(undefined);
    function retire(record) {
        if (record.disposed)
            return;
        record.disposed = true;
        record.handler = undefined;
        if (slots[record.slot] === record) {
            slots[record.slot] = undefined;
            liveCount--;
        }
    }
    function assertClock(receiver) {
        if (receiver !== clock)
            throw new EgretError('CLOCK_INVALID');
    }
    const clock = Object.freeze({
        get state() {
            assertClock(this);
            return state;
        },
        get elapsedSeconds() {
            assertClock(this);
            return elapsedSeconds;
        },
        get tickId() {
            assertClock(this);
            return tickId;
        },
        get maxDeltaSeconds() {
            assertClock(this);
            return options.maxDeltaSeconds;
        },
        onTick(scope, handler) {
            assertClock(this);
            context.assertOpen();
            if (!context.isEngineScope(scope))
                throw new EgretError('CLOCK_SCOPE_INVALID');
            if (Reflect.apply(scopeState, scope, []) !== 'open')
                throw new EgretError('SCOPE_CLOSED');
            if (typeof handler !== 'function')
                throw new EgretError('CLOCK_HANDLER_INVALID');
            if (liveCount >= MAX_SUBSCRIPTIONS)
                throw new EgretError('CLOCK_CALLBACK_LIMIT');
            if (!Number.isSafeInteger(nextSequence) || nextSequence <= 0)
                throw new EgretError('CLOCK_SUBSCRIPTION_ID_EXHAUSTED');
            const slot = slots.indexOf(undefined);
            const record = { sequence: nextSequence, slot, disposed: false, handler };
            const subscription = Object.freeze({
                get isDisposed() {
                    if (this !== subscription)
                        throw new EgretError('CLOCK_SUBSCRIPTION_INVALID');
                    return record.disposed;
                },
                dispose() {
                    if (this !== subscription)
                        throw new EgretError('CLOCK_SUBSCRIPTION_INVALID');
                    retire(record);
                }
            });
            try {
                Reflect.apply(scopeUse, scope, [subscription]);
            }
            catch (cause) {
                retire(record);
                throw cause;
            }
            // No caller operation runs between intrinsic adoption and slot publication.
            slots[slot] = record;
            liveCount++;
            nextSequence++;
            return subscription;
        },
        pause() {
            assertClock(this);
            context.assertOpen();
            state = 'paused';
        },
        resume() {
            assertClock(this);
            context.assertOpen();
            if (busy)
                throw new EgretError('CLOCK_REENTRANT');
            // Only an actual paused-to-running transition discards the old anchor.
            if (state === 'paused') {
                state = 'running';
                anchor = undefined;
            }
        }
    });
    return Object.freeze({
        clock,
        advance(sourceSeconds) {
            context.assertOpen();
            if (busy || context.isFrameBusy())
                throw new EgretError('CLOCK_REENTRANT');
            if (typeof sourceSeconds !== 'number' || !Number.isFinite(sourceSeconds) || sourceSeconds < 0)
                throw new EgretError('CLOCK_SOURCE_INVALID');
            const source = sourceSeconds === 0 ? 0 : sourceSeconds;
            if (acceptedSource !== undefined && source < acceptedSource)
                throw new EgretError('CLOCK_SOURCE_BACKWARDS');
            // Paused, initial, resumed and equal samples dispatch no gameplay tick.
            if (state === 'paused') {
                acceptedSource = source;
                return undefined;
            }
            if (anchor === undefined) {
                acceptedSource = source;
                anchor = source;
                return undefined;
            }
            if (source === acceptedSource)
                return undefined;
            const deltaSeconds = source - anchor;
            // Refused samples cannot advance the accepted floor, anchor or game time.
            if (deltaSeconds > options.maxDeltaSeconds)
                throw new EgretError('CLOCK_DELTA_LIMIT');
            const nextElapsed = elapsedSeconds + deltaSeconds;
            if (!Number.isFinite(nextElapsed) || nextElapsed <= elapsedSeconds)
                throw new EgretError('CLOCK_TIME_RANGE');
            const nextTickId = tickId + 1;
            if (!Number.isSafeInteger(nextTickId) || nextTickId <= 0)
                throw new EgretError('CLOCK_TICK_ID_EXHAUSTED');
            const tick = Object.freeze({ tickId: nextTickId, elapsedSeconds: nextElapsed, deltaSeconds });
            // Snapshot identities, not slot numbers: reuse cannot substitute a new handler.
            const candidates = slots
                .filter((record) => record !== undefined)
                .sort((a, b) => a.sequence - b.sequence);
            idle = new Promise(resolve => {
                releaseIdle = resolve;
            });
            busy = true;
            // Commit before callbacks: failure never rolls back time or replays candidates.
            acceptedSource = source;
            anchor = source;
            elapsedSeconds = nextElapsed;
            tickId = nextTickId;
            try {
                for (const candidate of candidates) {
                    if (state !== 'running')
                        break;
                    const handler = candidate.handler;
                    if (candidate.disposed || handler === undefined)
                        continue;
                    try {
                        const result = handler(tick);
                        if (result !== undefined) {
                            observeRejectedResult(result);
                            throw new EgretError('CLOCK_CALLBACK_RETURN_INVALID');
                        }
                    }
                    catch (cause) {
                        context.report({ code: 'CLOCK_CALLBACK_FAILED', phase: 'engine', severity: 'error', cause });
                        throw new EgretError('CLOCK_CALLBACK_FAILED', { cause });
                    }
                }
                return tick;
            }
            finally {
                candidates.length = 0;
                busy = false;
                // Engine cleanup waits for this synchronous callback barrier, not its return.
                const release = releaseIdle;
                releaseIdle = undefined;
                idle = undefined;
                release?.();
            }
        },
        close() {
            if (state === 'closed')
                return;
            // Retire callbacks immediately; the Engine owns subsequent Scope/host cleanup.
            state = 'closed';
            for (const record of slots)
                if (record !== undefined)
                    retire(record);
        },
        isBusy() {
            return busy;
        },
        whenIdle() {
            return idle ?? Promise.resolve();
        }
    });
}
//# sourceMappingURL=gameClock.js.map