// SPDX-License-Identifier: Apache-2.0
import { Bitmap, DisplayObject, DisplayObjectContainer, EgretError } from '@egret/runtime';
import { Engine } from '../Engine.js';
import { authenticateContentLoader, hasMatchingSequenceTimeline, hasSequenceTimeline } from '../internal/contentFactoryState.js';
import { requireSequenceControllerEngine } from '../internal/sequenceControllerFactoryState.js';
import { captureInput, coordinatorSize, mustQueue, assertNotCapturing } from './sequenceCoordinator.js';
import { captureOptions } from './sequenceInput.js';
import { createSequenceController, pauseSequenceForReplacement, requireResetController, requireSequencePreserveSource, stageSequencePreserve } from './sequenceController.js';
const apply = Reflect.apply, freeze = Object.freeze;
const prepare = Engine.prototype.prepareDisplaySubtree, capture = Engine.prototype.capturePreparedDisplaySharedFrame;
const count = Object.getOwnPropertyDescriptor(DisplayObjectContainer.prototype, 'numChildren').get;
const child = DisplayObjectContainer.prototype.getChildAt;
const parent = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'parent').get;
const claims = new WeakMap();
function fault(code, cause) {
    return new EgretError('SEQUENCE_RESET_' + code, { cause });
}
function label(value, max = 128) {
    return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function record(value, keys, check) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw fault('OPTIONS_INVALID');
    const row = Object.create(null);
    const names = Reflect.ownKeys(value);
    check();
    for (const key of names) {
        if (typeof key !== 'string' || !keys.includes(key))
            throw fault('OPTIONS_INVALID');
        const d = Object.getOwnPropertyDescriptor(value, key);
        check();
        if (!d || !Object.hasOwn(d, 'value'))
            throw fault('OPTIONS_INVALID');
        row[key] = d.value;
    }
    return row;
}
/** One ordinary sole-child container; all candidates use existing content and clock ownership. */
export function createSequenceResetSlot(engine, scope, target, initial) {
    const port = requireSequenceControllerEngine(engine), owner = port.scope(scope);
    assertNotCapturing(port);
    if (mustQueue(port))
        throw fault('REENTRANT');
    const row = captureInput(port, () => record(initial, ['version', 'bitmap', 'controller'], owner.assertOpen));
    if (!label(row.version))
        throw fault('OPTIONS_INVALID');
    let active = freeze({
        version: row.version,
        bitmap: row.bitmap,
        controller: row.controller,
        ownership: 'borrowed'
    });
    requireResetController(active.controller, port, active.bitmap);
    function topology() {
        if (apply(count, target, []) !== 1 || apply(child, target, [0]) !== active.bitmap)
            throw fault('TARGET_CHANGED');
        // Bound ancestry proves attachment; the controller already authenticates Engine affinity.
        let node = target;
        for (let depth = 0; node !== engine.stage; depth++) {
            if (!node || depth >= 128)
                throw fault('TARGET_INVALID');
            node = apply(parent, node, []);
        }
        if (target === engine.stage)
            throw fault('TARGET_INVALID');
    }
    topology();
    if (claims.has(target))
        throw fault('TARGET_CLAIMED');
    let disposed = false, busy = false, intent = 0, activeScope;
    let pending;
    function open() {
        if (disposed)
            throw fault('DISPOSED');
        owner.assertOpen();
    }
    function idle() {
        open();
        assertNotCapturing(port);
        if (busy || mustQueue(port))
            throw fault('REENTRANT');
    }
    function cleanup(actions) {
        const errors = [];
        for (const action of actions)
            try {
                action();
            }
            catch (cause) {
                errors.push(cause);
                port.captureCleanup(cause);
            }
        return errors;
    }
    function requestReplacement(request, preserve) {
        idle();
        busy = true;
        let spare;
        try {
            topology();
            requireResetController(active.controller, port, active.bitmap);
            const admitted = captureInput(port, () => {
                const keys = ['version', 'loader', 'imageId', 'sequenceId'];
                const r = record(request, preserve ? keys : [...keys, 'policy', 'playback'], open);
                if ((!preserve && r.policy !== 'reset') ||
                    !label(r.version) ||
                    !label(r.imageId, 512) ||
                    !label(r.sequenceId, 512))
                    throw fault('OPTIONS_INVALID');
                // Validate all caller-owned descriptors before replacing valid intent. Actual
                // clip-dependent duration/marker checks repeat after genuine group readiness.
                const playback = preserve ? undefined : captureOptions(r.playback, 2 ** 32, false);
                open();
                return { r, playback };
            });
            const { r } = admitted;
            if (preserve && !hasSequenceTimeline(requireSequencePreserveSource(active.controller, port, active.bitmap).clip))
                throw fault('PRESERVE_TIMELINE');
            if (coordinatorSize(port) >= 256)
                throw new EgretError('ANIMATION_CONTROLLER_LIMIT');
            if (port.claims.size >= 256)
                throw new EgretError('ANIMATION_LIMIT');
            spare = port.createScope();
            const owned = spare;
            authenticateContentLoader(r.loader, owned.scope, r.imageId, r.sequenceId);
            open();
            const id = ++intent, prior = pending;
            let state = 'loading', next, tree;
            let publishPreserved;
            let paused;
            let resolve, reject;
            const ready = new Promise((yes, no) => {
                resolve = yes;
                reject = no;
            });
            void ready.catch(() => { });
            function current() {
                open();
                if (id !== intent || state === 'cancelled' || state === 'failed' || state === 'committed')
                    throw fault('RETIRED');
                owned.assertOpen();
            }
            function restore() {
                const old = paused;
                paused = undefined;
                // A caller command after our pause owns the next transition. Never overwrite it.
                if (old?.resume && old.revision() === old.at && old.controller.getStatus().state === 'paused') {
                    // The borrowed controller owns its lifetime; the slot Scope may be closing.
                    try {
                        old.controller.resume();
                    }
                    catch (cause) {
                        port.captureCleanup(cause);
                    }
                }
            }
            function release() {
                const captured = tree;
                tree = undefined;
                publishPreserved = undefined;
                return cleanup([() => captured?.dispose(), restore, () => owned.dispose()]);
            }
            function cancel() {
                if (state === 'committed' || state === 'cancelled' || state === 'failed')
                    return;
                state = 'cancelled';
                if (pending === demand)
                    pending = undefined;
                reject(fault('CANCELLED'));
                const errors = release();
                if (errors.length)
                    throw fault('CLEANUP_FAILED', errors);
            }
            function fail(cause) {
                if (state === 'cancelled' || state === 'failed' || state === 'committed')
                    return cause;
                state = 'failed';
                if (pending === demand)
                    pending = undefined;
                const errors = release(), failure = errors.length ? fault('CLEANUP_FAILED', { cause, errors }) : cause;
                reject(failure);
                return failure;
            }
            const demand = { cancel };
            pending = demand;
            const ticket = freeze({
                get ready() {
                    return ready;
                },
                get state() {
                    return state;
                },
                capture(options) {
                    idle();
                    current();
                    if (state !== 'ready' || !next)
                        throw fault('NOT_READY');
                    busy = true;
                    try {
                        topology();
                        const revision = requireResetController(active.controller, port, active.bitmap);
                        if (preserve)
                            requireSequencePreserveSource(active.controller, port, active.bitmap);
                        const running = active.controller.getStatus().state === 'running';
                        const transition = {
                            controller: active.controller,
                            revision,
                            at: running ? {} : revision(),
                            resume: running
                        };
                        try {
                            if (running)
                                pauseSequenceForReplacement(active.controller, port, active.bitmap, transition.at);
                        }
                        finally {
                            paused = transition;
                        }
                        current();
                        if (revision() !== transition.at)
                            throw fault('CONTROLLER_CHANGED');
                        if (preserve)
                            publishPreserved = stageSequencePreserve(port, active.controller, active.bitmap, next.controller, next.bitmap, running);
                        tree = apply(prepare, engine, [owned.scope, target, next.bitmap]);
                        const frame = apply(capture, engine, [tree, options]);
                        current();
                        state = 'prepared';
                        return frame;
                    }
                    catch (cause) {
                        const failure = fail(cause);
                        // Cancellation during pause delivery ran before the slot could record the rollback.
                        restore();
                        throw failure;
                    }
                    finally {
                        busy = false;
                    }
                },
                commit() {
                    idle();
                    current();
                    if (state !== 'prepared' || !tree || !next)
                        throw fault('NOT_PREPARED');
                    busy = true;
                    try {
                        topology();
                        if (paused && paused.revision() !== paused.at)
                            throw fault('CONTROLLER_CHANGED');
                        tree.commit();
                        publishPreserved?.();
                        publishPreserved = undefined;
                        const previous = activeScope;
                        active = next;
                        activeScope = owned;
                        state = 'committed';
                        tree = undefined;
                        pending = undefined;
                        paused = undefined;
                        // CPU publication is final. Reentrant retirement observes the published state.
                        const errors = cleanup([() => previous?.dispose()]);
                        if (errors.length)
                            throw fault('POSTCOMMIT_FAILED', errors);
                        return active;
                    }
                    catch (cause) {
                        throw fail(cause);
                    }
                    finally {
                        busy = false;
                    }
                },
                dispose() {
                    cancel();
                }
            });
            spare = undefined;
            try {
                prior?.cancel();
                current();
                const group = r.loader.load(owned.scope, [r.sequenceId]);
                current();
                void group.ready.then(() => {
                    try {
                        current();
                        const clip = group.getSequence(r.sequenceId);
                        const source = preserve ? requireSequencePreserveSource(active.controller, port, active.bitmap) : undefined;
                        if (source && !hasMatchingSequenceTimeline(source.clip, clip))
                            throw fault('PRESERVE_TIMELINE');
                        const playback = source ?? admitted.playback;
                        const bitmap = new Bitmap(group.getImage(r.imageId));
                        owned.use(bitmap);
                        let visible = false;
                        const controller = createSequenceController(engine, owned.scope, bitmap, clip, {
                            profile: 'egret.sequence-control/1',
                            rate: 0,
                            totalPlays: playback.totalPlays,
                            markers: [...playback.markers]
                                .sort((a, b) => a.markerIndex - b.markerIndex)
                                .map(m => ({ id: m.id, timeSeconds: m.timeSeconds })),
                            onEvent: event => (visible ? admitted.playback?.listener?.(event) : undefined)
                        });
                        if (admitted.playback) {
                            controller.start();
                            controller.setRate(admitted.playback.rate);
                        }
                        current();
                        next = freeze({ version: r.version, bitmap, controller, ownership: 'owned' });
                        state = 'ready';
                        // RESET consumes zero start markers silently. Preserve stays idle until capture.
                        visible = true;
                        resolve();
                    }
                    catch (cause) {
                        fail(cause);
                    }
                }, fail);
            }
            catch (cause) {
                fail(cause);
            }
            return ticket;
        }
        finally {
            spare?.dispose();
            busy = false;
        }
    }
    const slot = freeze({
        get isDisposed() {
            return disposed;
        },
        getActive() {
            open();
            return active;
        },
        dispose() {
            if (disposed)
                return;
            disposed = true;
            intent++;
            claims.delete(target);
            const candidate = pending, owned = activeScope;
            pending = undefined;
            activeScope = undefined;
            const errors = cleanup([() => candidate?.cancel(), () => owned?.dispose()]);
            if (errors.length)
                throw fault('CLEANUP_FAILED', errors);
        },
        request(request) {
            return requestReplacement(request, false);
        },
        requestPreserving(request) {
            return requestReplacement(request, true);
        }
    });
    claims.set(target, slot);
    try {
        owner.use(slot);
        open();
    }
    catch (cause) {
        slot.dispose();
        throw cause;
    }
    return slot;
}
//# sourceMappingURL=sequenceResetSlot.js.map