// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const coordinators = new WeakMap();
const captures = new WeakSet();
const deliveries = new WeakMap();
/** User getters cannot masquerade as an ordinary callback command boundary. */
export function assertNotCapturing(port) {
    if (captures.has(port))
        throw new EgretError('ANIMATION_REENTRANT');
}
export function captureInput(port, callback) {
    assertNotCapturing(port);
    captures.add(port);
    try {
        return callback();
    }
    finally {
        captures.delete(port);
    }
}
export function mustQueue(port) {
    return port.isClockBusy() || (deliveries.get(port) ?? 0) > 0;
}
export function protectedDelivery(port, callback) {
    const old = deliveries.get(port) ?? 0;
    deliveries.set(port, old + 1);
    try {
        return callback();
    }
    finally {
        if (old === 0)
            deliveries.delete(port);
        else
            deliveries.set(port, old);
    }
}
export function deliver(port, delivery) {
    if (delivery === undefined)
        return;
    protectedDelivery(port, () => {
        delivery.events();
        delivery.diagnostics();
    });
}
export function coordinatorSize(port) {
    return coordinators.get(port)?.size ?? 0;
}
/** One authentic subscription serves all live controllers, never the first caller's Scope. */
export function requireCoordinator(port) {
    const existing = coordinators.get(port);
    if (existing !== undefined)
        return existing;
    const drivers = new Set();
    let scope;
    let subscription;
    let removeClose;
    let closed = false;
    let lastTick = port.clock.tickId;
    function release() {
        if (closed)
            return;
        closed = true;
        if (coordinators.get(port) === coordinator)
            coordinators.delete(port);
        const unsub = subscription, owned = scope, unregister = removeClose;
        subscription = undefined;
        scope = undefined;
        removeClose = undefined;
        let first;
        let failed = false;
        for (const cleanup of [
            () => {
                unregister?.();
            },
            () => {
                unsub?.dispose();
            },
            () => {
                owned?.dispose();
            }
        ]) {
            try {
                cleanup();
            }
            catch (cause) {
                if (!failed) {
                    first = cause;
                    failed = true;
                }
                port.captureCleanup(cause);
            }
        }
        if (failed)
            throw first;
    }
    function tick(value) {
        if (closed)
            return undefined;
        if (value.tickId <= lastTick)
            throw new EgretError('ANIMATION_TICK_INVALID');
        lastTick = value.tickId;
        const batches = [];
        // Snapshot controller identity; newly created controllers start on a later turn.
        for (const driver of [...drivers]) {
            if (!drivers.has(driver))
                continue;
            const batch = driver.advance(value);
            if (batch !== undefined)
                batches.push(batch);
        }
        protectedDelivery(port, () => {
            for (const batch of batches)
                batch.events();
            for (const batch of batches)
                batch.diagnostics();
        });
        return undefined;
    }
    const coordinator = Object.freeze({
        get size() {
            return drivers.size;
        },
        add(driver) {
            if (closed)
                throw new EgretError('ANIMATION_COORDINATOR_CLOSED');
            if (drivers.size >= 256)
                throw new EgretError('ANIMATION_CONTROLLER_LIMIT');
            drivers.add(driver);
        },
        remove(driver) {
            drivers.delete(driver);
            if (drivers.size === 0)
                release();
        },
        discardIfEmpty() {
            if (drivers.size === 0)
                release();
        }
    });
    try {
        scope = port.createScope();
        subscription = port.clock.onTick(scope.scope, tick);
        removeClose = port.onClose(() => {
            for (const driver of [...drivers])
                driver.stop();
            release();
        });
        coordinators.set(port, coordinator);
        return coordinator;
    }
    catch (cause) {
        try {
            release();
        }
        catch (cleanupCause) {
            port.captureCleanup(cleanupCause);
        }
        throw cause;
    }
}
//# sourceMappingURL=sequenceCoordinator.js.map