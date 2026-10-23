// SPDX-License-Identifier: Apache-2.0
import {EgretError} from '@egret/runtime';
import type {GameClockSubscription, GameClockTick} from '../gameClockTypes.js';
import type {SequenceControllerEnginePort, SequenceScopePort} from '../internal/sequenceControllerFactoryState.js';

export interface SequenceDelivery { events(): void; diagnostics(): void; }
export interface SequenceDriver { advance(tick: GameClockTick): SequenceDelivery | undefined; stop(): void; }
export interface SequenceCoordinator {
  readonly size: number;
  add(driver: SequenceDriver): void;
  remove(driver: SequenceDriver): void;
  discardIfEmpty(): void;
}
const coordinators = new WeakMap<SequenceControllerEnginePort, SequenceCoordinator>();
const captures = new WeakSet<SequenceControllerEnginePort>();
const deliveries = new WeakMap<SequenceControllerEnginePort, number>();

/** User getters cannot masquerade as an ordinary callback command boundary. */
export function assertNotCapturing(port: SequenceControllerEnginePort): void {
  if (captures.has(port)) throw new EgretError('ANIMATION_REENTRANT');
}
export function captureInput<T>(port: SequenceControllerEnginePort, callback: () => T): T {
  assertNotCapturing(port); captures.add(port);
  try { return callback(); } finally { captures.delete(port); }
}
export function mustQueue(port: SequenceControllerEnginePort): boolean {
  return port.isClockBusy() || (deliveries.get(port) ?? 0) > 0;
}
export function protectedDelivery<T>(port: SequenceControllerEnginePort, callback: () => T): T {
  const old = deliveries.get(port) ?? 0; deliveries.set(port, old + 1);
  try { return callback(); } finally {
    if (old === 0) deliveries.delete(port); else deliveries.set(port, old);
  }
}
export function deliver(port: SequenceControllerEnginePort, delivery: SequenceDelivery | undefined): void {
  if (delivery === undefined) return;
  protectedDelivery(port, (): void => { delivery.events(); delivery.diagnostics(); });
}
export function coordinatorSize(port: SequenceControllerEnginePort): number {
  return coordinators.get(port)?.size ?? 0;
}

/** One authentic subscription serves all live controllers, never the first caller's Scope. */
export function requireCoordinator(port: SequenceControllerEnginePort): SequenceCoordinator {
  const existing = coordinators.get(port);
  if (existing !== undefined) return existing;
  const drivers = new Set<SequenceDriver>();
  let scope: SequenceScopePort | undefined;
  let subscription: GameClockSubscription | undefined;
  let removeClose: (() => void) | undefined;
  let closed = false;
  let lastTick = port.clock.tickId;
  function release(): void {
    if (closed) return;
    closed = true;
    if (coordinators.get(port) === coordinator) coordinators.delete(port);
    const unsub = subscription, owned = scope, unregister = removeClose;
    subscription = undefined; scope = undefined; removeClose = undefined;
    let first: unknown; let failed = false;
    for (const cleanup of [(): void => { unregister?.(); }, (): void => { unsub?.dispose(); }, (): void => { owned?.dispose(); }]) {
      try { cleanup(); } catch (cause) { if (!failed) {first = cause; failed = true;} port.captureCleanup(cause); }
    }
    if (failed) throw first;
  }
  function tick(value: GameClockTick): undefined {
    if (closed) return undefined;
    if (value.tickId <= lastTick) throw new EgretError('ANIMATION_TICK_INVALID');
    lastTick = value.tickId;
    const batches: SequenceDelivery[] = [];
    // Snapshot controller identity; newly created controllers start on a later turn.
    for (const driver of [...drivers]) {
      if (!drivers.has(driver)) continue;
      const batch = driver.advance(value);
      if (batch !== undefined) batches.push(batch);
    }
    protectedDelivery(port, (): void => {
      for (const batch of batches) batch.events();
      for (const batch of batches) batch.diagnostics();
    });
    return undefined;
  }
  const coordinator: SequenceCoordinator = Object.freeze({
    get size(): number { return drivers.size; },
    add(driver: SequenceDriver): void {
      if (closed) throw new EgretError('ANIMATION_COORDINATOR_CLOSED');
      if (drivers.size >= 64) throw new EgretError('ANIMATION_CONTROLLER_LIMIT');
      drivers.add(driver);
    },
    remove(driver: SequenceDriver): void { drivers.delete(driver); if (drivers.size === 0) release(); },
    discardIfEmpty(): void { if (drivers.size === 0) release(); },
  });
  try {
    scope = port.createScope();
    subscription = port.clock.onTick(scope.scope, tick);
    removeClose = port.onClose((): void => {
      for (const driver of [...drivers]) driver.stop();
      release();
    });
    coordinators.set(port, coordinator);
    return coordinator;
  } catch (cause) {
    try { release(); } catch (cleanupCause) { port.captureCleanup(cleanupCause); }
    throw cause;
  }
}
