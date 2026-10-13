// SPDX-License-Identifier: Apache-2.0
import { EgretError, Scope, SequencePlayer } from '@egret/runtime';
import type { Bitmap, SequenceClip, SequencePlaybackMode, SequenceSample } from '@egret/runtime';
import type { GameClock, GameClockHandler, GameClockSubscription, GameClockTick } from './gameClockTypes.js';
import type { SequencePlayback, SequencePlaybackState } from './sequencePlaybackTypes.js';

export interface SequencePlaybackContext {
  assertOpen(): void;
  isEngineScope(scope: unknown): scope is Scope;
  readonly clock: GameClock;
  captureCleanup(cause: unknown): void;
}
export interface SequencePlaybackOwner {
  create(scope: unknown, bitmap: Bitmap, clip: SequenceClip, options: unknown): SequencePlayback;
  close(): void;
}

const MAX_PLAYBACKS = 256;
const playerConstructor = SequencePlayer;
const playerApply = SequencePlayer.prototype.applyAt;
const playerDispose = SequencePlayer.prototype.dispose;
const scopeUse = Scope.prototype.use;
const scopeState = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const apply = Reflect.apply;

/** A shared receiver-only bridge retains no individual player or resource borrow. */
function disposeOwnedPlayer(this: SequencePlayer): void {
  apply(playerDispose, this, []);
}

interface PlaybackRecord {
  readonly context: SequencePlaybackContext;
  readonly scope: Scope;
  readonly mode: SequencePlaybackMode;
  readonly durationSeconds: number;
  player: SequencePlayer | undefined;
  target: Bitmap | undefined;
  clip: SequenceClip | undefined;
  owner: Set<PlaybackRecord> | undefined;
  claims: WeakMap<Bitmap, PlaybackRecord> | undefined;
  subscription: GameClockSubscription | undefined;
  state: SequencePlaybackState;
  elapsedSeconds: number;
  lastSample: SequenceSample | undefined;
  runBase: number;
  anchor: number;
  operationBusy: boolean;
}

function isTerminal(state: SequencePlaybackState): boolean {
  return state === 'completed' || state === 'stopped' || state === 'failed';
}

/** Authentic membership and the captured state getter precede payload reads. */
function assertLifetime(context: SequencePlaybackContext, scope: unknown): asserts scope is Scope {
  context.assertOpen();
  if (!context.isEngineScope(scope)) throw new EgretError('SEQ_PLAYBACK_SCOPE_INVALID');
  if (apply(scopeState, scope, []) !== 'open') throw new EgretError('SCOPE_CLOSED');
}

function scopeIsOpen(record: PlaybackRecord): boolean {
  return record.context.isEngineScope(record.scope) && apply(scopeState, record.scope, []) === 'open';
}

function admitMode(context: SequencePlaybackContext, scope: Scope, options: unknown): SequencePlaybackMode {
  if (options === undefined) return 'once';
  if (options === null || typeof options !== 'object') throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID');
  let array: boolean;
  try { array = Array.isArray(options); }
  catch (cause) { throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID', { cause }); }
  if (array) throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID');
  assertLifetime(context, scope);
  let mode: unknown;
  try { mode = (options as { readonly mode?: unknown }).mode; }
  catch (cause) { throw new EgretError('SEQ_PLAYBACK_OPTIONS_INVALID', { cause }); }
  // A throwing read preserves its own occurrence, including throw undefined.
  assertLifetime(context, scope);
  // The authentic player owns enum validation after its original resource checks.
  return (mode === undefined ? 'once' : mode) as SequencePlaybackMode;
}

function captureSecondary(context: SequencePlaybackContext, cause: unknown): void {
  // Cleanup recording must not prevent the original Engine close barriers.
  try { context.captureCleanup(cause); }
  catch { /* A recording failure cannot replace an already chosen primary cause. */ }
}

/** Terminal identity is committed before cleanup; every acquired entry is attempted. */
function retire(record: PlaybackRecord, terminal: 'completed' | 'stopped' | 'failed', preservePrimary = false): void {
  if (isTerminal(record.state)) return;
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
  let firstFailure: unknown;
  function attempt(cleanup: () => void): void {
    try { cleanup(); }
    catch (cause) {
      if (!failed) { failed = true; firstFailure = cause; }
      captureSecondary(record.context, cause);
    }
  }
  if (target !== undefined && claims !== undefined) attempt((): void => {
    // An old Scope's historical handle must never remove a newer target claim.
    if (claims.get(target) === record) claims.delete(target);
  });
  if (owner !== undefined) attempt((): void => { owner.delete(record); });
  if (subscription !== undefined) attempt((): void => { subscription.dispose(); });
  if (player !== undefined) attempt((): void => { apply(playerDispose, player, []); });
  if (failed && !preservePrimary) throw firstFailure;
}

function assertControl(record: PlaybackRecord): void {
  assertLifetime(record.context, record.scope);
  if (record.operationBusy) throw new EgretError('SEQ_PLAYBACK_REENTRANT');
  if (isTerminal(record.state)) throw new EgretError('SEQ_PLAYBACK_TERMINAL');
}

/** A stopped transaction cannot commit observations or reacquire a registration. */
function canCommit(record: PlaybackRecord, expected: SequencePlaybackState): boolean {
  if (record.state !== expected || isTerminal(record.state)) return false;
  record.context.assertOpen();
  if (!scopeIsOpen(record)) { retire(record, 'stopped'); return false; }
  return true;
}

function makeTickHandler(record: PlaybackRecord): GameClockHandler {
  return (tick: GameClockTick): undefined => advancePlayback(record, tick);
}

function activate(record: PlaybackRecord, expected: 'idle' | 'paused', elapsed: number): void {
  record.operationBusy = true;
  let applying = false;
  let acquired: GameClockSubscription | undefined;
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
    const sample: SequenceSample = apply(playerApply, record.player!, [elapsed]);
    if (!canCommit(record, expected)) return;
    const anchor = record.context.clock.elapsedSeconds;
    // Crop success and lifetime confirmation precede all handle observations.
    record.lastSample = sample;
    record.elapsedSeconds = elapsed;
    record.runBase = elapsed;
    record.anchor = anchor;
    record.state = 'running';
  } catch (cause) {
    if (acquired !== undefined) {
      try { acquired.dispose(); }
      catch (cleanupCause) { captureSecondary(record.context, cleanupCause); }
    }
    if (applying) retire(record, 'failed', true);
    else if (record.subscription !== undefined) {
      const subscription = record.subscription;
      record.subscription = undefined;
      try { subscription.dispose(); }
      catch (cleanupCause) { captureSecondary(record.context, cleanupCause); }
    }
    throw cause;
  } finally {
    record.operationBusy = false;
  }
}

function startPlayback(record: PlaybackRecord): void {
  assertControl(record);
  if (record.state !== 'idle') throw new EgretError('SEQ_PLAYBACK_ALREADY_STARTED');
  activate(record, 'idle', 0);
}

function pausePlayback(record: PlaybackRecord): void {
  assertControl(record);
  if (record.state === 'idle') throw new EgretError('SEQ_PLAYBACK_NOT_STARTED');
  if (record.state !== 'running') return;
  record.operationBusy = true;
  record.state = 'paused';
  const subscription = record.subscription;
  record.subscription = undefined;
  try { subscription?.dispose(); }
  finally { record.operationBusy = false; }
}

function resumePlayback(record: PlaybackRecord): void {
  assertControl(record);
  if (record.state === 'idle') throw new EgretError('SEQ_PLAYBACK_NOT_STARTED');
  if (record.state === 'paused') activate(record, 'paused', record.elapsedSeconds);
}

function advancePlayback(record: PlaybackRecord, tick: GameClockTick): undefined {
  if (record.state !== 'running') return undefined;
  record.operationBusy = true;
  try {
    record.context.assertOpen();
    // Cancellation enters closing before reverse cleanup can reach this handle.
    if (!scopeIsOpen(record)) { retire(record, 'stopped'); return undefined; }
    const delta = tick.elapsedSeconds - record.anchor;
    if (delta <= 0) return undefined;
    if (!Number.isFinite(delta)) throw new EgretError('SEQ_PLAYBACK_TIME_RANGE');
    const final = record.mode === 'once' && delta >= record.durationSeconds - record.runBase;
    // Cap once before addition; looping never silently loses a positive interval.
    const elapsed = final ? record.durationSeconds : record.runBase + delta;
    if (!final && (!Number.isFinite(elapsed) || elapsed <= record.elapsedSeconds)) throw new EgretError('SEQ_PLAYBACK_TIME_RANGE');
    const sample: SequenceSample = apply(playerApply, record.player!, [elapsed]);
    if (!canCommit(record, 'running')) return undefined;
    record.elapsedSeconds = elapsed;
    record.lastSample = sample;
    if (final) retire(record, 'completed');
    return undefined;
  } catch (cause) {
    retire(record, 'failed', true);
    // The authentic clock alone supplies CLOCK_CALLBACK_FAILED and diagnostics.
    throw cause;
  } finally {
    record.operationBusy = false;
  }
}

/** Every operation checks the exact frozen facade, including observation getters. */
function makeHandle(record: PlaybackRecord): SequencePlayback {
  function assertReceiver(receiver: unknown): void {
    if (receiver !== handle) throw new EgretError('SEQ_PLAYBACK_INVALID');
  }
  const handle = Object.freeze({
    get state(): SequencePlaybackState { assertReceiver(this); return record.state; },
    get isDisposed(): boolean { assertReceiver(this); return isTerminal(record.state); },
    get elapsedSeconds(): number { assertReceiver(this); return record.elapsedSeconds; },
    get lastSample(): SequenceSample | undefined { assertReceiver(this); return record.lastSample; },
    start(): void { assertReceiver(this); startPlayback(record); },
    pause(): void { assertReceiver(this); pausePlayback(record); },
    resume(): void { assertReceiver(this); resumePlayback(record); },
    stop(): void { assertReceiver(this); retire(record, 'stopped'); },
    dispose(): void { assertReceiver(this); retire(record, 'stopped'); },
  }) as SequencePlayback;
  return handle;
}

/** Only private Engine assembly owns inventory and authentic-clock subscriptions. */
export function createSequencePlaybackOwner(context: SequencePlaybackContext): SequencePlaybackOwner {
  const records = new Set<PlaybackRecord>();
  const claims = new WeakMap<Bitmap, PlaybackRecord>();
  let creating = false;
  return Object.freeze({
    create(scope: unknown, bitmap: Bitmap, clip: SequenceClip, options: unknown): SequencePlayback {
      assertLifetime(context, scope);
      if (creating) throw new EgretError('SEQ_PLAYBACK_CREATION_REENTRANT');
      if (records.size >= MAX_PLAYBACKS) throw new EgretError('SEQ_PLAYBACK_LIMIT');
      creating = true;
      let player: SequencePlayer | undefined;
      let record: PlaybackRecord | undefined;
      try {
        const mode = admitMode(context, scope, options);
        player = new playerConstructor(bitmap, clip, mode);
        // Seal before the first intrinsic Scope adoption, including late cleanup.
        Object.defineProperty(player, 'dispose', {
          value: disposeOwnedPlayer, enumerable: false, writable: false, configurable: false,
        });
        assertLifetime(context, scope);
        if (claims.has(bitmap)) throw new EgretError('SEQ_PLAYBACK_TARGET_BUSY');
        record = {
          context, scope, mode, durationSeconds: clip.durationSeconds,
          player, target: bitmap, clip, owner: undefined, claims: undefined,
          subscription: undefined, state: 'idle', elapsedSeconds: 0, lastSample: undefined,
          runBase: 0, anchor: 0, operationBusy: false,
        };
        player = undefined; // The mutable record is now the sole cleanup borrow.
        const handle = makeHandle(record);
        apply(scopeUse, scope, [record.player!]);
        apply(scopeUse, scope, [handle]);
        assertLifetime(context, scope);
        if (isTerminal(record.state)) throw new EgretError('SEQ_PLAYBACK_TERMINAL');
        // Store rollback authority before callback-free claim/inventory publication.
        record.claims = claims;
        record.owner = records;
        claims.set(bitmap, record);
        records.add(record);
        return handle;
      } catch (cause) {
        if (record !== undefined) retire(record, 'stopped', true);
        else if (player !== undefined) {
          try { apply(playerDispose, player, []); }
          catch (cleanupCause) { captureSecondary(context, cleanupCause); }
        }
        throw cause;
      } finally {
        creating = false;
      }
    },
    close(): void {
      // Secondary faults are collected per record; no record can block clock close.
      for (const record of records) retire(record, 'stopped', true);
    },
  });
}
