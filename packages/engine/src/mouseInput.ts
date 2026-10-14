import { CancellationController, EgretError, Event, Scope, createEventType } from '@egret/runtime';
import type { DisplayInputOperations, DisplayObject, EventType } from '@egret/runtime';
import type { CancellationSignal, Diagnostic, ScopeValue } from '@egret/contracts';
import type { MouseInput, MouseInputCancelReason, MouseInputEvents, MouseInputOptions, MouseInputPayload, MouseInputState } from './mouseInputTypes.js';
import { registerMouseInputEngine, registerMouseInputInstance, registerMouseInputScope, requireMouseInputEngine } from './internal/mouseInputFactoryState.js';
import type { BitmapButtonAssociation, BitmapButtonInputPort } from './internal/mouseInputFactoryState.js';
export type { MouseInputOptions, MouseInput, MouseInputState, MouseInputEvents, MouseInputPayload, MouseInputCancelReason } from './mouseInputTypes.js';
export { createBitmapButton } from './bitmapButton.js';
export type { BitmapButton, BitmapButtonOptions, BitmapButtonState } from './bitmapButtonTypes.js';

const APPLY = Reflect.apply;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
const tokens = new WeakMap<object, object>();
const NATIVE_LIFETIME_ENDED = Symbol('egret.nativeInputLifetimeEnded');

/** Internal cleanup-only provenance never escapes the native delivery boundary. */
class NativeCleanupFailure {
  constructor(readonly cause: unknown) {}
}

export type MouseInputNativeKind = 'down' | 'up' | 'cancel' | 'blur' | 'pagehide';
export type MouseInputNativeListener = (event?: unknown) => void;
export interface MouseInputPoint { readonly x: number; readonly y: number; }
export interface MouseInputNativePair {
  readonly kind: MouseInputNativeKind;
  add(listener: MouseInputNativeListener): void;
  remove(listener: MouseInputNativeListener): void;
}
/** DOM-free assembly port; the optional browser adapter supplies genuine native operations. */
export interface MouseInputNativePorts {
  readonly pairs: readonly MouseInputNativePair[];
  pointer(event: unknown, kind: 'down' | 'up' | 'cancel', heldId: number | undefined): number | undefined;
  windowEvent(event: unknown, kind: 'blur' | 'pagehide'): boolean;
  point(event: unknown): MouseInputPoint;
}
export type MouseInputNativeFactory = (surface: object, width: number, height: number, assertLive: () => void) => MouseInputNativePorts;
interface ScopePorts {
  readonly scope: Scope;
  readonly signal: CancellationSignal;
  assertOpen(): void;
  use(value: ScopeValue): void;
  add(listener: MouseInputNativeListener): void;
  remove(listener: MouseInputNativeListener): void;
}
export interface MouseInputEnginePort {
  readonly surface: object;
  readonly operations: DisplayInputOperations;
  assertReady(): void;
  assertOpen(): void;
  markStarted(): void;
  scope(value: unknown): ScopePorts;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
  addRecord(record: InputRecord): void;
  removeRecord(record: InputRecord): void;
}
export interface MouseInputOwner { registerScope(scope: Scope): void; close(): void; }
export interface MouseInputAssembly {
  readonly surface: object;
  readonly operations: DisplayInputOperations;
  assertOpen(): void;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
}

/** Signal methods are captured per assembly, permitting transparent pre-assembly observation. */
export function createMouseInputOwner(engine: object, assembly: MouseInputAssembly): MouseInputOwner {
  const sample = new CancellationController().signal;
  const prototype = Object.getPrototypeOf(sample) as object;
  const aborted = Object.getOwnPropertyDescriptor(prototype, 'aborted')!.get!;
  const add = Object.getOwnPropertyDescriptor(prototype, 'addEventListener')!.value as CancellationSignal['addEventListener'];
  const remove = Object.getOwnPropertyDescriptor(prototype, 'removeEventListener')!.value as CancellationSignal['removeEventListener'];
  const originalSignals = new WeakMap<Scope, CancellationSignal>();
  const records = new Set<InputRecord>();
  let started = false;
  const port: MouseInputEnginePort = Object.freeze({
    surface: assembly.surface, operations: assembly.operations,
    assertOpen: assembly.assertOpen, report: assembly.report, captureCleanup: assembly.captureCleanup,
    assertReady(): void {
      assembly.assertOpen();
      if (!started) throw new EgretError('MOUSE_INPUT_INVALID');
    },
    markStarted(): void { started = true; },
    scope(value: unknown): ScopePorts {
      assembly.assertOpen();
      const signal = originalSignals.get(value as Scope);
      if (signal === undefined) throw new EgretError('MOUSE_INPUT_SCOPE_INVALID');
      const scope = value as Scope;
      const assertScopeOpen = (): void => {
        assembly.assertOpen();
        if (APPLY(SCOPE_STATE, scope, []) !== 'open' || APPLY(aborted, signal, []) === true) throw new EgretError('SCOPE_CLOSED');
      };
      assertScopeOpen();
      const once = Object.freeze({ once: true });
      return Object.freeze({
        scope, signal, assertOpen: assertScopeOpen,
        use(value: ScopeValue): void { APPLY(SCOPE_USE, scope, [value]); },
        add(listener: MouseInputNativeListener): void { APPLY(add, signal, ['abort', listener, once]); },
        remove(listener: MouseInputNativeListener): void { APPLY(remove, signal, ['abort', listener]); },
      });
    },
    addRecord(record: InputRecord): void { records.add(record); },
    removeRecord(record: InputRecord): void { records.delete(record); },
  });
  registerMouseInputEngine(engine, port);
  return Object.freeze({
    registerScope(scope: Scope): void {
      originalSignals.set(scope, scope.signal);
      registerMouseInputScope(scope, engine);
    },
    close(): void { for (const record of [...records]) retire(record, 'owner'); },
  });
}

interface HeldPress {
  readonly target: DisplayObject;
  readonly id: number;
  readonly point: MouseInputPoint;
  beginAllowed: boolean;
  readonly token: object;
  readonly button: BitmapButtonAssociation | undefined;
}
interface AttemptedPair {
  readonly listener: MouseInputNativeListener;
  readonly add: (listener: MouseInputNativeListener) => void;
  readonly remove: (listener: MouseInputNativeListener) => void;
  inFlight: boolean;
  addSucceeded: boolean;
  removeAttempted: boolean;
  removeSucceeded: boolean;
}
interface InputRecord {
  state: MouseInputState;
  phase: 'acquiring' | 'ready' | 'retiring' | 'closed';
  busy: boolean;
  failureEpisode: boolean;
  failureCause: unknown;
  failureError: EgretError | undefined;
  owner: MouseInputEnginePort | undefined;
  scope: ScopePorts | undefined;
  native: MouseInputNativePorts | undefined;
  held: HeldPress | undefined;
  readonly events: MouseInputEvents;
  readonly buttons: Map<DisplayObject, BitmapButtonAssociation>;
  readonly maximum: number;
  readonly token: object;
  surface: object | undefined;
  pairs: AttemptedPair[];
  readonly cleanupErrors: unknown[];
  retirement: 'owner' | 'explicit' | 'native' | 'setup' | undefined;
  wasAcquiring: boolean;
}

/** The registry keeps a closed genuine identity without retaining Engine/Scope ports. */
function buttonInputPort(record: InputRecord): BitmapButtonInputPort {
  const assertOpen = (): void => {
    if (record.state === 'closed' || record.phase !== 'ready') throw new EgretError('BITMAP_BUTTON_INPUT_CLOSED');
    record.owner!.assertReady(); record.scope!.assertOpen();
  };
  return Object.freeze({
    assertOpen,
    add(association: BitmapButtonAssociation): void {
      assertOpen();
      if (record.buttons.has(association.target)) throw new EgretError('BITMAP_BUTTON_SETUP_FAILED');
      record.buttons.set(association.target, association);
    },
    remove(association: BitmapButtonAssociation): void {
      if (record.buttons.get(association.target) === association) record.buttons.delete(association.target);
    },
  });
}

function live(record: InputRecord): boolean {
  if (record.state === 'closed' || record.owner === undefined || record.scope === undefined) return false;
  try { record.owner.assertReady(); record.scope.assertOpen(); return true; }
  catch (cause) {
    if (cause instanceof EgretError && (cause.code === 'ENGINE_CLOSED' || cause.code === 'SCOPE_CLOSED')) { retire(record, 'owner'); return false; }
    throw cause;
  }
}
function removePair(record: InputRecord, pair: AttemptedPair): void {
  if (pair.inFlight || pair.removeAttempted) return;
  pair.removeAttempted = true;
  try {
    // MI1 control: one exact physical pair removal, independent of logical closure.
    pair.remove(pair.listener);
    pair.removeSucceeded = true;
  } catch (cause) { record.cleanupErrors.push(cause); }
}
function finishRetirement(record: InputRecord): void {
  if (record.phase !== 'retiring' || record.pairs.some(pair => pair.inFlight || !pair.removeAttempted)) return;
  const owner = record.owner;
  record.phase = 'closed';
  record.owner = undefined; record.scope = undefined; record.native = undefined; record.surface = undefined; record.pairs = [];
  if (record.retirement === 'owner' && !record.wasAcquiring && record.cleanupErrors.length !== 0 && owner !== undefined) {
    const error = new EgretError('MOUSE_INPUT_CLEANUP_FAILED', { cause: record.cleanupErrors[0], cleanupErrors: record.cleanupErrors.slice(1) });
    owner.captureCleanup(error);
    owner.report({ code: 'MOUSE_INPUT_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause: error });
  }
}
function retire(record: InputRecord, reason: NonNullable<InputRecord['retirement']>): void {
  if (record.state === 'closed') return;
  record.wasAcquiring = record.phase === 'acquiring';
  record.state = 'closed'; record.phase = 'retiring'; record.held = undefined; record.retirement = reason;
  record.owner?.removeRecord(record);
  const buttons = [...record.buttons.values()]; record.buttons.clear();
  for (const button of buttons) {
    try { record.cleanupErrors.push(...button.retire()); }
    catch (cause) { record.cleanupErrors.push(cause); }
  }
  if (record.surface !== undefined && tokens.get(record.surface) === record.token) tokens.delete(record.surface);
  for (let index = record.pairs.length - 1; index >= 0; index--) {
    const pair = record.pairs[index]; if (pair !== undefined) removePair(record, pair);
  }
  finishRetirement(record);
}
function inputEvent<T>(type: EventType<T>, payload: T): Event<T> { return Object.freeze(new Event(type, payload)); }
function payload(id: number, point: MouseInputPoint): MouseInputPayload {
  return Object.freeze({ pointerId: id, globalX: point.x, globalY: point.y, pointerType: 'mouse', button: 0 });
}
function cancelPress(record: InputRecord, reason: MouseInputCancelReason): void {
  const held = record.held;
  record.held = undefined; record.state = 'idle';
  if (held === undefined || !live(record)) return;
  const operations = record.owner!.operations;
  held.button?.cancel();
  if (!operations.isAttached(held.target, record.maximum)) return;
  const data = Object.freeze({ ...payload(held.id, held.point), reason });
  operations.dispatch(held.target, inputEvent(record.events.cancel, data), record.maximum);
}
function nativeOperation(record: InputRecord, kind: MouseInputNativeKind, event: unknown): void {
  const native = record.native!;
  const operations = record.owner!.operations;
  if (kind === 'blur' || kind === 'pagehide') {
    if (!native.windowEvent(event, kind) || !live(record)) return;
    if (kind === 'pagehide') {
      let hasFailure = false, failure: unknown;
      try { cancelPress(record, 'pagehide'); } catch (cause) { hasFailure = true; failure = cause; }
      finally { retire(record, 'native'); }
      if (hasFailure) throw failure;
      if (record.retirement === 'native' && !record.failureEpisode && record.cleanupErrors.length !== 0) throw new NativeCleanupFailure(record.cleanupErrors[0]);
    }
    else cancelPress(record, 'blur');
    return;
  }
  if ((kind === 'down' && record.held !== undefined) || (kind !== 'down' && record.held === undefined)) return;
  const id = native.pointer(event, kind, record.held?.id);
  if (id === undefined || !live(record)) return;
  if (kind === 'cancel') { cancelPress(record, 'pointercancel'); return; }
  const point = native.point(event);
  if (!live(record)) return;
  if (kind === 'down') {
    const target = operations.pick(point.x, point.y, record.maximum);
    if (target === undefined || !live(record)) return;
    const held: HeldPress = { target, id, point, beginAllowed: false, token: {}, button: record.buttons.get(target) };
    record.held = held; record.state = 'pressed';
    held.button?.beforeBegin(held.token);
    // MI1 control: begin dispatch is a distinct genuine input operation.
    const allowed = operations.dispatch(target, inputEvent(record.events.begin, payload(id, point)), record.maximum);
    if (record.held === held && live(record)) held.beginAllowed = allowed;
    return;
  }
  const held = record.held!;
  const first = operations.pick(point.x, point.y, record.maximum);
  record.held = undefined; record.state = 'idle';
  try {
    // Reset the private skin before end, even when release is outside/detached.
    held.button?.beforeEnd(held.token);
    if (!live(record) || !operations.isAttached(held.target, record.maximum)) return;
    // MI1 control: end stays on the held target even when release selects a sibling.
    const endAllowed = operations.dispatch(held.target, inputEvent(record.events.end, payload(id, point)), record.maximum);
    if (!live(record) || first !== held.target || !held.beginAllowed || !endAllowed || !operations.isAttached(held.target, record.maximum)) return;
    // MI1 control: re-pick the same consumed release point after end callbacks.
    const second = operations.pick(point.x, point.y, record.maximum);
    if (second === held.target && live(record) && operations.isAttached(held.target, record.maximum)) {
      const data = payload(id, point);
      operations.dispatch(held.target, inputEvent(record.events.activate, data), record.maximum);
      // A control's callback is distinct from the unchanged public activate route.
      // Settings/life/token checks precede this final original pick after the route.
      held.button?.afterActivate(held.token, data, (): boolean =>
        live(record) && operations.isAttached(held.target, record.maximum)
        && operations.pick(point.x, point.y, record.maximum) === held.target
        && live(record) && operations.isAttached(held.target, record.maximum));
    }
  } finally { held.button?.finish(held.token); }
}
function callbackFailure(record: InputRecord, owner: MouseInputEnginePort, cause: unknown, primaryCleanup = false): void {
  if (record.failureEpisode && (Object.is(cause, record.failureCause) || (record.failureError !== undefined && cause === record.failureError))) return;
  // Publish the episode before teardown callouts so nested native delivery cannot replay it.
  record.failureEpisode = true; record.failureCause = cause; record.failureError = undefined;
  retire(record, 'native');
  const error = new EgretError('MOUSE_INPUT_CALLBACK_FAILED', { cause, cleanupErrors: primaryCleanup ? record.cleanupErrors.slice(1) : record.cleanupErrors });
  record.failureError = error;
  owner.report({ code: 'MOUSE_INPUT_CALLBACK_FAILED', phase: 'engine', severity: 'error', cause: error });
}
function deliver(record: InputRecord, kind: MouseInputNativeKind, event: unknown): void {
  if (record.phase !== 'ready') return;
  const owner = record.owner!;
  if (record.busy) { callbackFailure(record, owner, new EgretError('MOUSE_INPUT_REENTRANT')); return; }
  record.busy = true;
  try {
    if (live(record)) {
      for (const button of [...record.buttons.values()]) button.syncTerminal();
      if (record.phase === 'ready') nativeOperation(record, kind, event);
    }
  }
  catch (cause) {
    if (cause === NATIVE_LIFETIME_ENDED) { retire(record, 'owner'); return; }
    if (cause instanceof NativeCleanupFailure) callbackFailure(record, owner, cause.cause, true);
    else callbackFailure(record, owner, cause);
  } finally {
    record.busy = false;
    record.failureEpisode = false; record.failureCause = undefined; record.failureError = undefined;
  }
}

function addPair(record: InputRecord, add: AttemptedPair['add'], remove: AttemptedPair['remove'], listener: MouseInputNativeListener): void {
  const pair: AttemptedPair = { add, remove, listener, inFlight: true, addSucceeded: false, removeAttempted: false, removeSucceeded: false };
  record.pairs.push(pair);
  try { pair.add(pair.listener); pair.addSucceeded = true; }
  finally {
    pair.inFlight = false;
    if (record.state === 'closed') { removePair(record, pair); finishRetirement(record); }
  }
}

/** The browser entry admits options before reading any DOM capabilities or installing listeners. */
export function createMouseInputWithNative(options: MouseInputOptions, nativeFactory: MouseInputNativeFactory): MouseInput {
  if (options === null || typeof options !== 'object') throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID');
  let array: boolean;
  try { array = Array.isArray(options); }
  catch (cause) { throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause }); }
  if (array) throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID');
  let engine: unknown;
  try { engine = options.engine; } catch (cause) { throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause }); }
  const owner = requireMouseInputEngine(engine);
  let requestedScope: unknown;
  try { requestedScope = options.scope; } catch (cause) { throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause }); }
  owner.assertReady();
  const scope = owner.scope(requestedScope);
  let width: unknown, height: unknown, requestedMaximum: unknown;
  try { width = options.width; height = options.height; requestedMaximum = options.maxNodes; }
  catch (cause) { throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID', { cause }); }
  const assertLive = (): void => { owner.assertReady(); scope.assertOpen(); };
  let ready = false;
  const assertNativeLive = (): void => {
    try { assertLive(); }
    catch (cause) {
      // Only this callback-free authority check may mark successful native continuation closure.
      if (ready && cause instanceof EgretError && (cause.code === 'ENGINE_CLOSED' || cause.code === 'SCOPE_CLOSED')) throw NATIVE_LIFETIME_ENDED;
      throw cause;
    }
  };
  assertLive();
  const maximum = requestedMaximum === undefined ? 4096 : requestedMaximum;
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0 || typeof height !== 'number' || !Number.isFinite(height) || height <= 0
      || typeof maximum !== 'number' || !Number.isInteger(maximum) || maximum < 1 || maximum > 65536) throw new EgretError('MOUSE_INPUT_OPTIONS_INVALID');
  const native = nativeFactory(owner.surface, width, height, assertNativeLive);
  assertLive();
  if (tokens.has(owner.surface)) throw new EgretError('MOUSE_INPUT_IN_USE');
  const events: MouseInputEvents = Object.freeze({
    begin: createEventType<MouseInputPayload>('egret.mouse.begin', { bubbles: true, cancelable: true }),
    end: createEventType<MouseInputPayload>('egret.mouse.end', { bubbles: true, cancelable: true }),
    activate: createEventType<MouseInputPayload>('egret.mouse.activate', { bubbles: true, cancelable: false }),
    cancel: createEventType<MouseInputPayload & { readonly reason: MouseInputCancelReason }>('egret.mouse.cancel', { bubbles: true, cancelable: false }),
  });
  const record: InputRecord = {
    state: 'idle', phase: 'acquiring', busy: false, failureEpisode: false, failureCause: undefined, failureError: undefined, owner, scope, native, held: undefined,
    events, buttons: new Map(), maximum, token: {}, surface: owner.surface, pairs: [], cleanupErrors: [], retirement: undefined, wasAcquiring: false,
  };
  const facade = Object.freeze({
    get state(): MouseInputState { if (this !== facade) throw new EgretError('MOUSE_INPUT_INVALID'); return record.state; },
    events,
    dispose(): void {
      if (this !== facade) throw new EgretError('MOUSE_INPUT_INVALID');
      if (record.state === 'closed') return;
      retire(record, 'explicit');
      if (record.cleanupErrors.length !== 0) throw new EgretError('MOUSE_INPUT_CLEANUP_FAILED', { cause: record.cleanupErrors[0], cleanupErrors: record.cleanupErrors.slice(1) });
    },
  }) as MouseInput;
  registerMouseInputInstance(facade, engine as object, buttonInputPort(record));
  tokens.set(owner.surface, record.token);
  owner.addRecord(record);
  let hasFailure = false, failure: unknown, sourceFailure = false;
  const acquire = (add: AttemptedPair['add'], remove: AttemptedPair['remove'], listener: MouseInputNativeListener): void => {
    try { addPair(record, add, remove, listener); }
    catch (cause) { sourceFailure = true; throw cause; }
  };
  try {
    scope.use(facade);
    assertLive();
    acquire(scope.add, scope.remove, (): void => { retire(record, 'owner'); });
    assertLive();
    for (const pair of native.pairs) {
      // A leaked closed callback retains the scalar kind and record, not the native target/ports.
      const kind = pair.kind;
      acquire(pair.add, pair.remove, (event?: unknown): void => { deliver(record, kind, event); });
      assertLive();
    }
    assertLive();
    if (record.state === 'closed') throw new EgretError('SCOPE_CLOSED');
    record.phase = 'ready';
    ready = true;
    return facade;
  } catch (cause) { hasFailure = true; failure = cause; }
  retire(record, 'setup');
  if (hasFailure && !sourceFailure && failure instanceof EgretError && (failure.code === 'ENGINE_CLOSED' || failure.code === 'SCOPE_CLOSED')) {
    throw new EgretError(failure.code, { cause: failure.cause, cleanupErrors: [...failure.cleanupErrors, ...record.cleanupErrors] });
  }
  throw new EgretError('MOUSE_INPUT_SETUP_FAILED', { cause: failure, cleanupErrors: record.cleanupErrors });
}
