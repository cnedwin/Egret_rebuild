// SPDX-License-Identifier: Apache-2.0
import {EgretError, SequencePlayer} from '@egret/runtime';
import type {Bitmap, Scope, SequenceClip, SequenceSample} from '@egret/runtime';
import type {Engine} from '../Engine.js';
import type {GameClockTick} from '../gameClockTypes.js';
import {requireSequenceControllerEngine} from '../internal/sequenceControllerFactoryState.js';
import type {SequenceControllerEnginePort, SequenceScopePort} from '../internal/sequenceControllerFactoryState.js';
import {assertNotCapturing, captureInput, coordinatorSize, deliver, mustQueue, requireCoordinator} from './sequenceCoordinator.js';
import type {SequenceCoordinator, SequenceDelivery, SequenceDriver} from './sequenceCoordinator.js';
import {admitRate, captureOptions, captureSeek} from './sequenceInput.js';
import type {CapturedOptions, Command} from './sequenceInput.js';
import {locatePosition, planEvents} from './sequenceMath.js';
import type {CapturedSequenceMarker, PlannedSequenceEvent} from './sequenceMath.js';
import type {SequenceController, SequenceControllerEvent, SequenceControllerOptions,
  SequenceControllerState, SequenceControllerStatus, SequenceEventSource, SequenceSeekRequest} from './types.js';

const apply = Reflect.apply;
const playerApply = SequencePlayer.prototype.applyAt;
const playerDispose = SequencePlayer.prototype.dispose;
const playerConstructor = SequencePlayer;
const EMPTY_MARKERS: readonly CapturedSequenceMarker[] = Object.freeze([]);
interface Issue {readonly code: string; readonly clockTickId: number; readonly cause?: unknown;}
interface Pending {readonly tick: number; readonly command: Command;}
interface DeliveryToken {active: boolean;}
interface RecordState {
  port: SequenceControllerEnginePort | undefined;
  scope: SequenceScopePort | undefined;
  coordinator: SequenceCoordinator | undefined;
  driver: SequenceDriver | undefined;
  player: SequencePlayer | undefined;
  target: Bitmap | undefined;
  claimed: boolean;
  readonly claimToken: object;
  abort: (() => void) | undefined;
  readonly duration: number;
  readonly totalPlays: number | 'infinite';
  markers: readonly CapturedSequenceMarker[];
  listener: CapturedOptions['listener'];
  state: SequenceControllerState;
  elapsed: number;
  position: number;
  play: number;
  rate: number;
  baseline: number;
  lastSample: SequenceSample | undefined;
  eventCount: number;
  lastIssue: SequenceControllerStatus['lastIssue'];
  pending: Pending[];
  busy: boolean;
  delivery: DeliveryToken | undefined;
}
interface StagedEvent {readonly event: PlannedSequenceEvent; readonly source: SequenceEventSource;}
interface Candidate {
  state: SequenceControllerState;
  elapsed: number;
  position: number;
  play: number;
  rate: number;
  baseline: number;
  applyTarget: boolean;
  consumed: number;
  terminalCommand: boolean;
  readonly events: StagedEvent[];
}
function terminal(state: SequenceControllerState): boolean {
  return state === 'completed' || state === 'stopped' || state === 'faulted';
}
function codeOf(cause: unknown, fallback: string): string {
  return cause instanceof EgretError ? cause.code : fallback;
}
function remember(record: RecordState, issue: Issue): void {
  record.lastIssue = Object.freeze({code: issue.code, clockTickId: issue.clockTickId});
}
function originalDispose(this: SequencePlayer): void { apply(playerDispose, this, []); }

/** Revoke first; every acquired borrow is then attempted independently. */
function retire(record: RecordState, state: 'completed' | 'stopped' | 'faulted', keepDelivery = false): Issue | undefined {
  if (!keepDelivery && record.delivery !== undefined) record.delivery.active = false;
  if (terminal(record.state) && record.port === undefined) return undefined;
  record.state = state;
  const port = record.port, scope = record.scope, coordinator = record.coordinator;
  const driver = record.driver, player = record.player, target = record.target, abort = record.abort;
  const claimed = record.claimed;
  record.port = undefined; record.scope = undefined; record.coordinator = undefined;
  record.driver = undefined; record.player = undefined; record.target = undefined;
  record.abort = undefined; record.claimed = false; record.listener = undefined;
  record.markers = EMPTY_MARKERS; record.pending = [];
  let first: Issue | undefined;
  for (const cleanup of [
    (): void => { if (abort !== undefined) scope?.remove(abort); },
    (): void => { if (claimed && target !== undefined) port?.claims.release(target, record.claimToken); },
    (): void => { if (driver !== undefined) coordinator?.remove(driver); },
    (): void => { if (player !== undefined) apply(playerDispose, player, []); },
  ]) {
    try { cleanup(); } catch (cause) {
      first ??= {code: 'ANIMATION_CLEANUP_FAILED', clockTickId: port?.clock.tickId ?? 0, cause};
      try { port?.captureCleanup(cause); } catch { /* Preserve the primary transition outcome. */ }
    }
  }
  if (first !== undefined) remember(record, first);
  return first;
}
function assertControl(record: RecordState): SequenceControllerEnginePort {
  const port = record.port;
  if (port === undefined || terminal(record.state)) throw new EgretError('ANIMATION_TERMINAL');
  assertNotCapturing(port); port.assertOpen(); record.scope!.assertOpen();
  if (record.busy) throw new EgretError('ANIMATION_REENTRANT');
  return port;
}
function snapshot(record: RecordState): SequenceControllerStatus {
  return Object.freeze({state: record.state, isDisposed: terminal(record.state),
    elapsedSeconds: record.elapsed, positionSeconds: record.position, playIndex: record.play,
    rate: record.rate, totalPlays: record.totalPlays, lastSample: record.lastSample,
    pendingCommands: record.pending.length, committedEventCount: record.eventCount, lastIssue: record.lastIssue});
}
function begin(record: RecordState): Candidate {
  return {state: record.state, elapsed: record.elapsed, position: record.position, play: record.play,
    rate: record.rate, baseline: record.baseline, applyTarget: false, consumed: 0,
    terminalCommand: false, events: []};
}
function appendEvents(record: RecordState, candidate: Candidate, to: number, source: SequenceEventSource,
  includeStart = false, includeComplete = true): void {
  const events = planEvents(record.duration, record.totalPlays, record.markers,
    candidate.elapsed, to, {includeStart, includeComplete}, 1024 - candidate.events.length);
  if (!Number.isSafeInteger(record.eventCount + candidate.events.length + events.length)) throw new EgretError('ANIMATION_EVENT_SEQUENCE_LIMIT');
  for (const event of events) candidate.events.push({event, source});
}
function move(record: RecordState, candidate: Candidate, to: number, source: SequenceEventSource, replay: boolean): void {
  const position = locatePosition(record.duration, record.totalPlays, to);
  if (replay) appendEvents(record, candidate, to, source);
  candidate.elapsed = to; candidate.position = position.positionSeconds; candidate.play = position.playIndex;
  candidate.applyTarget = true;
  if (position.complete) candidate.state = 'completed';
}
function settle(record: RecordState, candidate: Candidate, now: number, source: SequenceEventSource): void {
  if (now < candidate.baseline) throw new EgretError('ANIMATION_TIME_LIMIT');
  const delta = now - candidate.baseline;
  candidate.baseline = now;
  if (candidate.state !== 'running' || delta === 0) return;
  const distance = delta * candidate.rate;
  if (!Number.isFinite(distance)) throw new EgretError('ANIMATION_TIME_LIMIT');
  if (distance === 0 && candidate.rate > 0) throw new EgretError('ANIMATION_PRECISION_LIMIT');
  const end = record.totalPlays === 'infinite' ? undefined : record.duration * record.totalPlays;
  const final = end !== undefined && distance >= end - candidate.elapsed;
  const next = final ? end! : candidate.elapsed + distance;
  if (!final && distance > 0 && next <= candidate.elapsed) throw new EgretError('ANIMATION_PRECISION_LIMIT');
  move(record, candidate, next, source, true);
}
function commandCandidate(record: RecordState, candidate: Candidate, command: Command, now: number): void {
  if (terminal(candidate.state)) throw new EgretError('ANIMATION_TERMINAL');
  switch (command.kind) {
    case 'start':
      if (candidate.state !== 'idle') throw new EgretError('ANIMATION_ALREADY_STARTED');
      appendEvents(record, candidate, 0, 'start', true, false);
      candidate.elapsed = 0; candidate.position = 0; candidate.play = 0; candidate.baseline = now;
      candidate.state = candidate.rate === 0 ? 'paused' : 'running'; candidate.applyTarget = true;
      return;
    case 'pause':
      if (candidate.state === 'idle') throw new EgretError('ANIMATION_NOT_STARTED');
      candidate.state = 'paused'; candidate.baseline = now; return;
    case 'resume':
      if (candidate.state === 'idle') throw new EgretError('ANIMATION_NOT_STARTED');
      if (candidate.state === 'running') return;
      if (candidate.rate === 0) throw new EgretError('ANIMATION_RATE_ZERO');
      candidate.state = 'running'; candidate.baseline = now; return;
    case 'rate':
      candidate.rate = command.rate;
      if (candidate.state === 'running' && command.rate === 0) candidate.state = 'paused';
      candidate.baseline = now; return;
    case 'seek':
      if (candidate.state === 'idle') throw new EgretError('ANIMATION_NOT_STARTED');
      if (command.replay && command.time < candidate.elapsed) throw new EgretError('ANIMATION_SEEK_BACKWARDS');
      move(record, candidate, command.time, 'seek', command.replay); candidate.baseline = now; return;
  }
}
function observeRejected(result: unknown): void {
  const ignore = (): void => {};
  try { void apply(Promise.prototype.then, result, [undefined, ignore]); }
  catch {
    try { void Promise.resolve(result).then(undefined, ignore); }
    catch { /* Return observation cannot replace the committed callback outcome. */ }
  }
}

/** Event delivery owns a short-lived borrow independent of the retired controller. */
function makeDelivery(record: RecordState, port: SequenceControllerEnginePort, scope: SequenceScopePort,
  listener: CapturedOptions['listener'], events: readonly SequenceControllerEvent[], token: DeliveryToken,
  initialIssue?: Issue): SequenceDelivery {
  let issue = initialIssue;
  return {
    events(): void {
      if (listener === undefined) return;
      for (const event of events) {
        if (!token.active) break;
        try { port.assertOpen(); scope.assertOpen(); }
        catch { token.active = false; break; }
        try {
          const result: unknown = listener(event);
          if (result !== undefined) {
            observeRejected(result);
            issue ??= {code: 'ANIMATION_CALLBACK_RETURN_INVALID', clockTickId: event.clockTickId};
          }
        } catch (cause) { issue ??= {code: 'ANIMATION_CALLBACK_FAILED', clockTickId: event.clockTickId, cause}; }
      }
    },
    diagnostics(): void {
      try {
        if (issue === undefined) return;
        remember(record, issue);
        // A prior observer can close another controller's lifetime. Keep inert
        // failure evidence, but deliver ordinary profile callbacks only while live.
        // Cleanup failures remain reportable during authoritative teardown.
        if (issue.code !== 'ANIMATION_CLEANUP_FAILED') {
          try { port.assertOpen(); scope.assertOpen(); } catch { return; }
        }
        port.report({code: issue.code, phase: 'engine', severity: 'error', cause: issue.cause});
      } finally {
        if (record.delivery === token) record.delivery = undefined;
      }
    },
  };
}
function refusal(record: RecordState, port: SequenceControllerEnginePort, scope: SequenceScopePort,
  cause: unknown, tick: number, code?: string): SequenceDelivery {
  const issue = {code: code ?? codeOf(cause, 'ANIMATION_COMMAND_INVALID'), clockTickId: tick, cause};
  remember(record, issue);
  return makeDelivery(record, port, scope, undefined, [], {active: false}, issue);
}
function bindingError(cause: unknown): boolean {
  return cause instanceof EgretError && ['SEQ_BINDING_CHANGED','OBJECT_DISPOSED','LEASE_RELEASED',
    'TEXTURE_DISPOSED','ASSET_LEASE_RELEASED','ASSET_DISPOSED','BITMAP_TEXTURE_REQUIRED'].includes(cause.code);
}

/** Pure preparation precedes one original player apply and callback-free publication. */
function commit(record: RecordState, candidate: Candidate, tick: number, replaced: boolean): SequenceDelivery {
  const port = record.port!, scope = record.scope!, listener = record.listener;
  scope.assertOpen();
  let sample = record.lastSample;
  if (candidate.applyTarget) {
    try { sample = apply(playerApply, record.player!, [candidate.position]) as SequenceSample; }
    catch (cause) {
      const code = bindingError(cause) ? 'ANIMATION_BINDING_INVALID' : 'ANIMATION_APPLY_FAILED';
      const issue = {code, clockTickId: tick, cause};
      retire(record, 'faulted'); remember(record, issue);
      throw new EgretError(code, {cause});
    }
  }
  scope.assertOpen();
  const events = candidate.events.map(({event, source}, index): SequenceControllerEvent =>
    Object.freeze({...event, source, clockTickId: tick, sequence: record.eventCount + index + 1}));
  const token: DeliveryToken = {active: true};
  record.elapsed = candidate.elapsed; record.position = candidate.position; record.play = candidate.play;
  record.rate = candidate.rate; record.baseline = candidate.baseline; record.state = candidate.state;
  record.lastSample = sample; record.eventCount += events.length;
  if (replaced) record.pending = []; else record.pending.splice(0, candidate.consumed);
  record.delivery = token;
  let issue: Issue | undefined;
  if (candidate.terminalCommand) issue = {code: 'ANIMATION_TERMINAL_COMMAND', clockTickId: tick};
  else if (replaced) issue = {code: 'ANIMATION_COMMANDS_REPLACED', clockTickId: tick};
  if (candidate.state === 'completed') {
    const cleanupIssue = retire(record, 'completed', true);
    issue ??= cleanupIssue;
  }
  return makeDelivery(record, port, scope, listener, events, token, issue);
}
function advance(record: RecordState, tick: GameClockTick): SequenceDelivery | undefined {
  if (record.port === undefined || terminal(record.state)) return undefined;
  const port = record.port, scope = record.scope!;
  record.busy = true;
  try {
    scope.assertOpen();
    const candidate = begin(record);
    settle(record, candidate, tick.elapsedSeconds, 'clock');
    if (candidate.state === 'completed') candidate.terminalCommand = record.pending.length > 0;
    else {
      for (const pending of record.pending) {
        if (pending.tick > tick.tickId) break;
        try { commandCandidate(record, candidate, pending.command, tick.elapsedSeconds); }
        catch (cause) { throw new EgretError('ANIMATION_COMMAND_INVALID', {cause}); }
        candidate.consumed++;
        if (terminal(candidate.state)) {
          candidate.terminalCommand = record.pending.length > candidate.consumed; break;
        }
      }
    }
    return commit(record, candidate, tick.tickId, false);
  } catch (cause) {
    if (codeOf(cause, '') === 'SCOPE_CLOSED' || codeOf(cause, '') === 'ENGINE_CLOSED') {
      retire(record, 'stopped'); return undefined;
    }
    return refusal(record, port, scope, cause, tick.tickId);
  } finally { record.busy = false; }
}
function execute(record: RecordState, command: Command): void {
  const port = assertControl(record), scope = record.scope!;
  const tick = port.clock.tickId;
  if (mustQueue(port)) {
    if (record.pending.length >= 16) throw new EgretError('ANIMATION_COMMAND_LIMIT');
    if (!Number.isSafeInteger(tick + 1)) throw new EgretError('ANIMATION_TIME_LIMIT');
    record.pending.push(Object.freeze({tick: tick + 1, command})); return;
  }
  const replace = command.kind === 'seek' && !command.replay;
  if (record.pending.length !== 0 && !replace) throw new EgretError('ANIMATION_COMMANDS_PENDING');
  const replaced = replace && record.pending.length !== 0;
  record.busy = true;
  let batch: SequenceDelivery | undefined;
  try {
    const candidate = begin(record), now = port.clock.elapsedSeconds;
    if (command.kind === 'pause' || command.kind === 'rate') settle(record, candidate, now, 'control');
    if (candidate.state === 'completed') candidate.terminalCommand = true;
    else commandCandidate(record, candidate, command, now);
    batch = commit(record, candidate, tick, replaced);
  } catch (cause) {
    batch = refusal(record, port, scope, cause, tick);
    record.busy = false; deliver(port, batch); throw cause;
  } finally { record.busy = false; }
  deliver(port, batch);
}
function stop(record: RecordState, ownedCancellation = false): void {
  const port = record.port, scope = record.scope;
  if (port !== undefined && !ownedCancellation) assertNotCapturing(port);
  const issue = retire(record, terminal(record.state) ? record.state as 'completed' | 'stopped' | 'faulted' : 'stopped');
  if (issue !== undefined && port !== undefined && scope !== undefined) deliver(port,
    makeDelivery(record, port, scope, undefined, [], {active: false}, issue));
}
function handleFor(record: RecordState): SequenceController {
  function receiver(value: unknown): void { if (value !== handle) throw new EgretError('ANIMATION_CONTROLLER_INVALID'); }
  const handle = Object.freeze({
    profile: 'egret.sequence-control/1' as const,
    start(): void { receiver(this); execute(record, Object.freeze({kind: 'start'})); },
    pause(): void { receiver(this); execute(record, Object.freeze({kind: 'pause'})); },
    resume(): void { receiver(this); execute(record, Object.freeze({kind: 'resume'})); },
    setRate(rate: number): void {
      receiver(this); const port = assertControl(record);
      execute(record, captureInput(port, (): Command => Object.freeze({kind: 'rate', rate: admitRate(rate)})));
    },
    seek(request: SequenceSeekRequest): void {
      receiver(this); const port = assertControl(record);
      execute(record, captureInput(port, (): Command => captureSeek(request)));
    },
    stop(): void { receiver(this); stop(record); },
    dispose(): void { receiver(this); stop(record); },
    getStatus(): SequenceControllerStatus { receiver(this); return snapshot(record); },
  }) as SequenceController;
  return handle;
}

/** Opt-in sequence controls share Engine ownership but never create a second timer. */
export function createSequenceController(engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip,
  options: SequenceControllerOptions): SequenceController {
  const port = requireSequenceControllerEngine(engine);
  const owned = port.scope(scope);
  assertNotCapturing(port);
  if (coordinatorSize(port) >= 64) throw new EgretError('ANIMATION_CONTROLLER_LIMIT');
  if (port.claims.size >= 256) throw new EgretError('ANIMATION_LIMIT');
  let player: SequencePlayer | undefined, coordinator: SequenceCoordinator | undefined, record: RecordState | undefined;
  try {
    // Original constructor authenticates Bitmap/clip before reading clip dimensions.
    player = new playerConstructor(bitmap, clip, 'once');
    Object.defineProperty(player, 'dispose', {value: originalDispose, writable: false, configurable: false});
    const admitted = captureInput(port, (): CapturedOptions => captureOptions(options, clip.durationSeconds));
    owned.assertOpen();
    if (port.claims.has(bitmap)) throw new EgretError('ANIMATION_TARGET_BUSY');
    coordinator = requireCoordinator(port);
    record = {port, scope: owned, coordinator, driver: undefined, player, target: bitmap,
      claimed: false, claimToken: {}, abort: undefined, duration: clip.durationSeconds,
      totalPlays: admitted.totalPlays, markers: admitted.markers, listener: admitted.listener,
      state: 'idle', elapsed: 0, position: 0, play: 0, rate: admitted.rate,
      baseline: port.clock.elapsedSeconds, lastSample: undefined, eventCount: 0,
      lastIssue: undefined, pending: [], busy: false, delivery: undefined};
    player = undefined;
    const current = record;
    const handle = handleFor(current);
    const driver: SequenceDriver = {advance: (tick): SequenceDelivery | undefined => advance(current, tick), stop: (): void => stop(current, true)};
    current.driver = driver;
    owned.use(current.player!); owned.use(handle);
    current.abort = (): void => stop(current, true);
    owned.add(current.abort); owned.assertOpen();
    port.claims.acquire(bitmap, current.claimToken); current.claimed = true;
    coordinator.add(driver);
    return handle;
  } catch (cause) {
    if (record !== undefined) retire(record, 'stopped');
    else if (player !== undefined) { try { apply(playerDispose, player, []); } catch (cleanupCause) { port.captureCleanup(cleanupCause); } }
    try { coordinator?.discardIfEmpty(); } catch (cleanupCause) { port.captureCleanup(cleanupCause); }
    throw cause;
  }
}
