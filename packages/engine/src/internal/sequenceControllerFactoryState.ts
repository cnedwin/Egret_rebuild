// SPDX-License-Identifier: Apache-2.0
import {CancellationController, EgretError, Scope} from '@egret/runtime';
import type {CancellationSignal, Diagnostic, ScopeValue} from '@egret/contracts';
import type {GameClock} from '../gameClockTypes.js';
import type {SequenceTargetClaims} from '../sequenceTargetClaims.js';

export interface SequenceScopePort {
  readonly scope: Scope;
  assertOpen(): void;
  use(value: ScopeValue): void;
  dispose(): void;
  add(listener: () => void): void;
  remove(listener: () => void): void;
}

export interface SequenceControllerEnginePort {
  assertOpen(): void;
  scope(value: unknown): SequenceScopePort;
  createScope(): SequenceScopePort;
  readonly clock: GameClock;
  isClockBusy(): boolean;
  readonly claims: SequenceTargetClaims;
  onClose(callback: () => void): () => void;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
}

interface SequenceControllerAssembly {
  assertOpen(): void;
  createScope(): Scope;
  readonly clock: GameClock;
  isClockBusy(): boolean;
  readonly claims: SequenceTargetClaims;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
}

export interface SequenceControllerEngineOwner {
  registerScope(scope: Scope): void;
  close(): void;
}

const engines = new WeakMap<object, SequenceControllerEnginePort>();
const apply = Reflect.apply;
const state = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const use = Scope.prototype.use;
const dispose = Scope.prototype.dispose;
const signalPrototype = Object.getPrototypeOf(new CancellationController().signal) as object;
const aborted = Object.getOwnPropertyDescriptor(signalPrototype, 'aborted')!.get!;
const add = Object.getOwnPropertyDescriptor(signalPrototype, 'addEventListener')!.value as CancellationSignal['addEventListener'];
const remove = Object.getOwnPropertyDescriptor(signalPrototype, 'removeEventListener')!.value as CancellationSignal['removeEventListener'];

/** Capture authentic lifecycle and clock authority without loading optional animation logic. */
export function registerSequenceControllerEngine(engine: object, assembly: SequenceControllerAssembly): SequenceControllerEngineOwner {
  const scopes = new WeakMap<Scope, CancellationSignal>();
  const closers = new Set<() => void>();
  let closed = false;
  function scope(value: unknown): SequenceScopePort {
    assembly.assertOpen();
    const signal = scopes.get(value as Scope);
    if (signal === undefined) throw new EgretError('ANIMATION_SCOPE_INVALID');
    const original = value as Scope;
    function assertOpen(): void {
      assembly.assertOpen();
      if (apply(state, original, []) !== 'open' || apply(aborted, signal, [])) throw new EgretError('SCOPE_CLOSED');
    }
    assertOpen();
    return Object.freeze({
      scope: original, assertOpen,
      use(value: ScopeValue): void { apply(use, original, [value]); },
      dispose(): void { apply(dispose, original, []); },
      add(listener: () => void): void { apply(add, signal, ['abort', listener, Object.freeze({once: true})]); },
      remove(listener: () => void): void { apply(remove, signal, ['abort', listener]); },
    });
  }
  const port: SequenceControllerEnginePort = Object.freeze({
    assertOpen: assembly.assertOpen,
    scope,
    createScope(): SequenceScopePort { return scope(assembly.createScope()); },
    clock: assembly.clock,
    isClockBusy: assembly.isClockBusy,
    claims: assembly.claims,
    onClose(callback: () => void): () => void {
      assembly.assertOpen();
      closers.add(callback);
      return (): void => { closers.delete(callback); };
    },
    report: assembly.report,
    captureCleanup: assembly.captureCleanup,
  });
  engines.set(engine, port);
  return Object.freeze({
    registerScope(scope: Scope): void { scopes.set(scope, scope.signal); },
    close(): void {
      if (closed) return;
      closed = true;
      const callbacks = [...closers];
      closers.clear();
      for (const callback of callbacks) {
        try { callback(); }
        catch (cause) {
          assembly.captureCleanup(cause);
          assembly.report({code: 'ANIMATION_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause});
        }
      }
    },
  });
}

/** Public factory arguments grant no authority: only the original Engine identity is admitted. */
export function requireSequenceControllerEngine(engine: unknown): SequenceControllerEnginePort {
  const port = engines.get(engine as object);
  if (port === undefined) throw new EgretError('ANIMATION_ENGINE_INVALID');
  port.assertOpen();
  return port;
}
