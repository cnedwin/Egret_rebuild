// SPDX-License-Identifier: Apache-2.0
// One optional CPU RESET slot; Host staging and presentation remain caller-owned.
import { Engine, Scope, DisplayObject, DisplayObjectContainer, EgretError } from '@egret/engine';
import { createSpineInstance } from './instance.js';
import { createSpineDisplay } from './display.js';
import { requireSpineRender } from './renderAuthority.js';
import { authenticateResetDisplay, authenticateResetLoader } from './resetAuthority.js';
const apply = Reflect.apply, freeze = Object.freeze, createScope = Engine.prototype.createScope;
const prepare = Engine.prototype.prepareDisplaySubtree, capture = Engine.prototype.capturePreparedDisplaySharedFrame;
const use = Scope.prototype.use, close = Scope.prototype.dispose;
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const count = Object.getOwnPropertyDescriptor(DisplayObjectContainer.prototype, 'numChildren').get;
const child = DisplayObjectContainer.prototype.getChildAt, parent = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'parent').get;
const claims = new WeakMap();
function fault(code, cause) {
    return new EgretError('SPINE_RESET_' + code, { cause });
}
function label(value, max = 128) {
    return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function record(value, keys, check) {
    if (!value || typeof value !== 'object')
        throw fault('OPTIONS_INVALID');
    const result = Object.create(null);
    const names = Reflect.ownKeys(value);
    check();
    for (const key of names) {
        if (typeof key !== 'string' || !keys.includes(key))
            throw fault('OPTIONS_INVALID');
        const row = Object.getOwnPropertyDescriptor(value, key);
        check();
        if (!row || !Object.hasOwn(row, 'value'))
            throw fault('OPTIONS_INVALID');
        result[key] = row.value;
    }
    return result;
}
/** Borrow an existing sole-child display; replacement groups/players are slot-owned. */
export function createSpineResetSlot(engine, scope, target, initial) {
    // The original Engine factory authenticates engine without any structural facade.
    const validation = apply(createScope, engine, []);
    let initialValue;
    try {
        const row = record(initial, ['version', 'instance', 'display'], () => {
            if (apply(scopeState, scope, []) !== 'open')
                throw fault('SCOPE_CLOSED');
        });
        if (!label(row.version))
            throw fault('OPTIONS_INVALID');
        const value = row;
        authenticateResetDisplay(value.display, value.instance);
        const port = requireSpineRender(value.instance);
        port.asset.authenticate(scope, false);
        port.asset.authenticate(validation, false);
        if (target === engine.stage || apply(count, target, []) !== 1 || apply(child, target, [0]) !== value.display.node)
            throw fault('TARGET_INVALID');
        let ancestor = target;
        for (let depth = 0; ancestor !== engine.stage; depth++) {
            if (!ancestor || depth >= 128)
                throw fault('TARGET_INVALID');
            ancestor = apply(parent, ancestor, []);
        }
        if (claims.has(target))
            throw fault('TARGET_CLAIMED');
        initialValue = freeze({
            version: value.version,
            instance: value.instance,
            display: value.display,
            ownership: 'borrowed'
        });
    }
    finally {
        apply(close, validation, []);
    }
    let disposed = false, busy = false, intent = 0, active = initialValue, activeScope;
    let pending;
    function open() {
        if (disposed || apply(scopeState, scope, []) !== 'open')
            throw fault('DISPOSED');
    }
    function idle() {
        open();
        if (busy)
            throw fault('REENTRANT');
    }
    function intact() {
        open();
        authenticateResetDisplay(active.display, active.instance);
        if (apply(count, target, []) !== 1 || apply(child, target, [0]) !== active.display.node)
            throw fault('TARGET_CHANGED');
    }
    // One admission for both policies. `preserve` carries the active playback into the candidate; `reset`
    // starts the requested animation at time zero.
    function demandReplacement(request, preserve) {
        idle();
        busy = true;
        let candidateScope;
        try {
            intact();
            const row = record(request, preserve
                ? ['version', 'loader', 'assetId', 'onEvent']
                : ['policy', 'version', 'loader', 'assetId', 'animation', 'skins', 'loop', 'plays', 'onEvent'], open);
            if ((!preserve && (row.policy !== 'reset' || !label(row.animation, 1024))) ||
                !label(row.version) ||
                !label(row.assetId, 512) ||
                (row.loop !== undefined && typeof row.loop !== 'boolean') ||
                (row.plays !== undefined &&
                    (!Number.isSafeInteger(row.plays) ||
                        row.plays < 1 ||
                        row.plays > 1024 ||
                        row.loop !== undefined)) ||
                (row.onEvent !== undefined && typeof row.onEvent !== 'function'))
                throw fault('OPTIONS_INVALID');
            let skins;
            if (row.skins !== undefined) {
                if (!Array.isArray(row.skins))
                    throw fault('OPTIONS_INVALID');
                const length = Object.getOwnPropertyDescriptor(row.skins, 'length');
                open();
                const size = length?.value;
                if (!length ||
                    !Object.hasOwn(length, 'value') ||
                    !Number.isSafeInteger(size) ||
                    size < 1 ||
                    size > 32)
                    throw fault('OPTIONS_INVALID');
                const names = [];
                for (let i = 0; i < size; i++) {
                    const item = Object.getOwnPropertyDescriptor(row.skins, String(i));
                    open();
                    if (!item || !Object.hasOwn(item, 'value') || !label(item.value, 1024) || names.includes(item.value))
                        throw fault('OPTIONS_INVALID');
                    names.push(item.value);
                }
                skins = freeze(names);
            }
            candidateScope = apply(createScope, engine, []);
            const owned = candidateScope;
            authenticateResetLoader(row.loader, owned);
            open();
            // Playback that cannot be carried now is refused before the request is accepted.
            if (preserve)
                requireSpineRender(active.instance).exportPlayback();
            // Admission is complete before superseding the previous accepted intent.
            const id = ++intent, prior = pending;
            let state = 'loading', group, next, tree;
            // A preserving candidate has no pose until the final window: the active player may advance while it loads.
            let carrier;
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
            }
            function cancel() {
                if (state === 'committed' || state === 'cancelled' || state === 'failed')
                    return;
                state = 'cancelled';
                tree?.dispose();
                tree = undefined;
                reject(fault('CANCELLED'));
                if (pending === demand)
                    pending = undefined;
                apply(close, owned, []);
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
                    intact();
                    if ((!next && !carrier) || state !== 'ready')
                        throw fault('NOT_READY');
                    busy = true;
                    try {
                        tree?.dispose();
                        tree = undefined;
                        state = 'ready';
                        if (carrier) {
                            // The active playback as it stands now, and nothing that happened to it earlier.
                            const instance = carrier;
                            carrier = undefined;
                            requireSpineRender(instance).initializePreserve(requireSpineRender(active.instance).exportPlayback());
                            next = freeze({
                                version: row.version,
                                instance,
                                display: createSpineDisplay(instance, owned, { colorProfile: 'egret-shared-linear/1' }),
                                ownership: 'owned'
                            });
                        }
                        tree = apply(prepare, engine, [owned, target, next.display.node]);
                        const frame = apply(capture, engine, [tree, options]);
                        current();
                        state = 'prepared';
                        return frame;
                    }
                    catch (cause) {
                        throw fail(cause);
                    }
                    finally {
                        busy = false;
                    }
                },
                commit() {
                    idle();
                    current();
                    intact();
                    if (state !== 'prepared' || !tree || !next)
                        throw fault('NOT_PREPARED');
                    busy = true;
                    try {
                        tree.commit();
                        // Nothing externally callable occurs between tree publication and active/state publication.
                        const previous = activeScope;
                        active = next;
                        activeScope = owned;
                        state = 'committed';
                        tree = undefined;
                        pending = undefined;
                        try {
                            if (previous)
                                apply(close, previous, []);
                        }
                        catch (cause) {
                            throw fault('POSTCOMMIT_FAILED', cause);
                        }
                        return active;
                    }
                    finally {
                        busy = false;
                    }
                },
                dispose() {
                    cancel();
                }
            });
            candidateScope = undefined;
            try {
                prior?.cancel();
                current();
            }
            catch (cause) {
                throw fail(cause);
            }
            try {
                group = row.loader.load(owned, [row.assetId]);
                void group.ready.then(() => {
                    try {
                        current();
                        const asset = group.getSpine(row.assetId);
                        const instance = createSpineInstance(asset, owned, row.onEvent === undefined
                            ? undefined
                            : { onEvent: row.onEvent });
                        if (preserve) {
                            // An asset that cannot continue the playback as it stands now fails here, before the final window.
                            // Playback that is between commands at this moment is judged in that window alone.
                            let playback;
                            try {
                                playback = requireSpineRender(active.instance).exportPlayback();
                            }
                            catch {
                                playback = undefined;
                            }
                            if (playback)
                                requireSpineRender(instance).checkPreserve(playback);
                            current();
                            carrier = instance;
                            state = 'ready';
                            resolve();
                            return;
                        }
                        if (skins)
                            instance.setSkins(skins);
                        instance.setAnimation(0, row.animation, {
                            ...(row.loop === undefined ? {} : { loop: row.loop }),
                            ...(row.plays === undefined ? {} : { plays: row.plays })
                        });
                        requireSpineRender(instance).initializeReset();
                        const display = createSpineDisplay(instance, owned, { colorProfile: 'egret-shared-linear/1' });
                        current();
                        next = freeze({ version: row.version, instance, display, ownership: 'owned' });
                        state = 'ready';
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
            function fail(cause) {
                if (state === 'cancelled' || state === 'failed' || state === 'committed')
                    return cause;
                state = 'failed';
                const errors = [];
                try {
                    tree?.dispose();
                }
                catch (error) {
                    errors.push(error);
                }
                tree = undefined;
                if (pending === demand)
                    pending = undefined;
                try {
                    apply(close, owned, []);
                }
                catch (error) {
                    errors.push(error);
                }
                const failure = errors.length
                    ? new EgretError('SPINE_RESET_CLEANUP_FAILED', { cause, cleanupErrors: errors })
                    : cause;
                // This handler also terminates the asynchronous group chain; cleanup cannot
                // create an unobserved rejected derivative after ready has settled.
                reject(failure);
                return failure;
            }
            return ticket;
        }
        finally {
            if (candidateScope)
                apply(close, candidateScope, []);
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
            const owned = activeScope;
            activeScope = undefined;
            const prior = pending;
            pending = undefined;
            try {
                prior?.cancel();
            }
            finally {
                if (owned)
                    apply(close, owned, []);
            }
        },
        request(request) {
            return demandReplacement(request, false);
        },
        requestPreserving(request) {
            return demandReplacement(request, true);
        }
    });
    claims.set(target, slot);
    try {
        apply(use, scope, [slot]);
        open();
    }
    catch (cause) {
        slot.dispose();
        throw cause;
    }
    return slot;
}
//# sourceMappingURL=resetSlot.js.map