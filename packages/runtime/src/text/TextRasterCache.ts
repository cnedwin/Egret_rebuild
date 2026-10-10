import { isImageData2D } from '@egret/contracts';
import type { CancellationSignal, ImageData2D } from '@egret/contracts';
import type { AssetManager, AssetLoadContext } from '../AssetManager.js';
import { AssetLease, observeAssetLeaseRetirement, readAssetLeaseValue } from '../AssetLease.js';
import { createAssetRef, createAssetType } from '../AssetRef.js';
import type { AssetRef } from '../AssetRef.js';
import { CancellationController } from '../CancellationController.js';
import { EgretError } from '../EgretError.js';
import { beginTextCacheCreation, commitTextCacheLifetime, requireAssetManagerOwner } from '../assetManagerOwnerState.js';
import { commitBinding } from '../ownership.js';
import { createTexture, isTexture, readTextureSnapshot, Texture } from '../Texture.js';
import { TextBudget, TEXT_BUDGET_DEFAULTS, TEXT_BUDGET_MINIMA } from './budget.js';
import type { TextBudgetLimits } from './budget.js';
import {
  closeTextValueInvocation, createOwnedTextRasterRequest, createTextValueFailure,
  createTextValueInvocation, matchesTextRasterRequestSummary, snapshotTextRasterRequest,
  summarizeTextRasterRequest, takeTextValueFailure,
} from './request.js';
import type { TextRasterRequestSummary } from './request.js';
import { closeTextRasterPlanIssuer, createTextRasterPlanIssuer, readIssuedTextRasterPlan, requireIssuedTextRasterPlan } from './plan.js';
import type {
  PreparedTextRaster, TextRasterAcquireOptions, TextRasterCache, TextRasterCacheOptions,
  TextRasterCacheStatus, TextRasterLimits, TextRasterMetrics, TextRasterPlan,
  TextRasterProvider, TextRasterRequest, TextRasterRequestInput,
} from './types.js';

const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
const WEAK_GET = WeakMap.prototype.get;
const WEAK_SET = WeakMap.prototype.set;
const SAFE_INTEGER = Number.isSafeInteger;
const REGEXP_EXEC = RegExp.prototype.exec;
const PROVIDER_IDENTITY = /^[A-Za-z0-9._-]{1,64}$/;
const LIMIT_KEYS = FREEZE(['maxGenerations', 'maxPendingJobs', 'maxWaiters', 'maxCallerLeases',
  'maxResidentEntries', 'maxMetadataBytes', 'maxLogicalImageBytes', 'maxPendingRasterBytes'] as const);
const ABORT = CancellationController.prototype.abort;
const RELEASE_LEASE = AssetLease.prototype.release;
const DISPOSE_TEXTURE = Texture.prototype.dispose;
const PROFILE = 'canvas-explicit-lines-v1' as const;
const LIMITS: TextRasterLimits = FREEZE({
  maxSourceCodeUnits: 8192, maxLines: 64, maxFontFamilyCodeUnits: 256,
  maxLocaleCodeUnits: 64, maxProviderIdentityCodeUnits: 64, maxSourceEdge: 4096,
  maxSourcePixels: 1048576, maxMetricMagnitude: 1048576, antialiasGuardPixels: 2,
});

type Owner = ReturnType<typeof requireAssetManagerOwner>;
type SignalMethod = (...args: never[]) => unknown;
interface SignalBinding {
  readonly signal: CancellationSignal;
  readonly add: SignalMethod;
  readonly remove: SignalMethod;
}
interface ProviderBinding {
  readonly receiver: TextRasterProvider;
  readonly identity: string;
  readonly measure: TextRasterProvider['measure'];
  readonly rasterize: TextRasterProvider['rasterize'];
  readonly release: TextRasterProvider['release'];
}
interface Slot { readonly ref: AssetRef<Texture>; sequence: number; current: Generation | undefined; }
interface Generation {
  readonly slot: Slot;
  readonly sequence: number;
  readonly request: TextRasterRequest;
  readonly metadata: number;
  readonly controller: CancellationController;
  readonly waiters: Set<Waiter>;
  current: boolean;
  kind: 'loading' | 'ready';
  actors: number;
  jobCharged: boolean;
  workSettled: boolean;
  quarantined: boolean;
  quarantinedPlan: TextRasterPlan | undefined;
  callers: number;
  metrics: TextRasterMetrics | undefined;
  image: ImageData2D | undefined;
  texture: Texture | undefined;
  imageBytes: number;
  reservedBytes: number;
  scratchBytes: number;
  resourceGeneration: number | undefined;
  taskId: number | undefined;
  resident: boolean;
  residentLease: AssetLease<Texture> | undefined;
  residencyPending: boolean;
}
interface Waiter {
  readonly generation: Generation;
  readonly signal: SignalBinding | undefined;
  readonly controller: CancellationController;
  readonly resolve: (value: PreparedTextRaster) => void;
  readonly reject: (error: EgretError) => void;
  readonly listener: () => void;
  pending: boolean;
  installing: boolean;
  listening: boolean;
  error: EgretError | undefined;
}
interface IdleWaiter { readonly resolve: () => void; readonly reject: (error: EgretError) => void; }
interface State {
  readonly owner: Owner;
  readonly provider: ProviderBinding;
  readonly budget: TextBudget;
  readonly slots: readonly Slot[];
  readonly generations: Set<Generation>;
  readonly lru: Generation[];
  readonly residentLru: Generation[];
  readonly staged: Map<AssetRef<Texture>, Generation>;
  readonly textures: WeakMap<Texture, Generation>;
  readonly idle: Set<IdleWaiter>;
  closed: boolean;
  busy: boolean;
  fontGeneration: number;
  actors: number;
  hasCleanupFailure: boolean;
  firstCleanupCause: unknown;
}
const states = new WeakMap<object, State>();

function stateOf(value: unknown): State {
  const state = APPLY(WEAK_GET, states, [value]) as State | undefined;
  if (state === undefined) throw new EgretError('TEXT_CACHE_INVALID');
  return state;
}
function assertOpen(state: State): void {
  try { state.owner.assertOpen(); }
  catch (cause) { throw new EgretError('TEXT_CACHE_CLOSED', { cause }); }
  if (state.closed) throw new EgretError('TEXT_CACHE_CLOSED');
}
function assertMutable(state: State): void {
  assertOpen(state);
  if (state.busy) throw new EgretError('TEXT_CACHE_REENTRANT');
}
function remove<T>(array: T[], value: T): void {
  const index = array.indexOf(value);
  if (index !== -1) array.splice(index, 1);
}
function touch(state: State, generation: Generation): void {
  remove(state.lru, generation);
  if (generation.current) state.lru.push(generation);
}
function increment(value: number): number {
  if (!SAFE_INTEGER(value + 1)) throw new EgretError('TEXT_COUNTER_EXHAUSTED');
  return value + 1;
}
function recordCleanup(state: State, cause: unknown, code: string, managerOwned = false): void {
  if (!state.hasCleanupFailure) { state.hasCleanupFailure = true; state.firstCleanupCause = cause; }
  const count = state.budget.snapshot().cleanupFailureCount;
  if (count < Number.MAX_SAFE_INTEGER) state.budget.commit({ cleanupFailureCount: 1 });
  if (!managerOwned) {
    state.owner.context.captureCleanup(cause);
    state.owner.context.report({ code, phase: 'assets', severity: 'error', cause });
  }
}
function controller(state: State): CancellationController {
  return new CancellationController(diagnostic => {
    if (!state.hasCleanupFailure) { state.hasCleanupFailure = true; state.firstCleanupCause = diagnostic.cause; }
    if (state.budget.snapshot().cleanupFailureCount < Number.MAX_SAFE_INTEGER) state.budget.commit({ cleanupFailureCount: 1 });
    state.owner.context.captureCleanup(diagnostic.cause);
    state.owner.context.report(diagnostic);
  });
}
function abort(value: CancellationController, reason: unknown): void { APPLY(ABORT, value, [reason]); }
function release(lease: AssetLease<Texture>): void { APPLY(RELEASE_LEASE, lease, []); }
function collect(state: State, generation: Generation): void {
  if (generation.current || generation.actors !== 0 || generation.callers !== 0 || generation.resident ||
      generation.image !== undefined || generation.reservedBytes !== 0 || generation.scratchBytes !== 0 || generation.quarantined) return;
  if (state.generations.delete(generation)) state.budget.commit({ retiredGenerations: -1, metadataBytes: -generation.metadata });
}
function settleIdle(state: State): void {
  if (state.actors !== 0) return;
  for (const waiter of state.idle) {
    state.idle.delete(waiter);
    state.budget.commit({ idleWaiters: -1, metadataBytes: -64 });
    if (state.hasCleanupFailure) waiter.reject(new EgretError('TEXT_CACHE_CLEANUP_FAILED', { cause: state.firstCleanupCause }));
    else waiter.resolve();
  }
}
function beginActor(state: State, generation: Generation): void { state.actors += 1; generation.actors += 1; }
function endActor(state: State, generation: Generation): void {
  generation.actors -= 1; state.actors -= 1;
  if (generation.workSettled && generation.actors === 0 && generation.jobCharged) {
    generation.jobCharged = false;
    state.budget.commit({ pendingJobs: -1 });
  }
  collect(state, generation);
  settleIdle(state);
}
/** Retire routing before any manager invalidation, abort, or disposer callback. */
function retireRoute(state: State, generation: Generation): void {
  if (!generation.current) return;
  generation.current = false;
  if (generation.slot.current === generation) generation.slot.current = undefined;
  remove(state.lru, generation);
  state.budget.commit({ occupiedSlots: -1, currentGenerations: -1, retiredGenerations: 1 });
}
function dropResidency(state: State, generation: Generation): void {
  // A manager revocation refunds counters before its cache-closing hook. Retire
  // the strong bookkeeping references here even when that observer already ran.
  remove(state.residentLru, generation);
  const lease = generation.residentLease;
  generation.residentLease = undefined;
  if (!generation.resident) { collect(state, generation); return; }
  if (lease === undefined) {
    generation.resident = false;
    state.budget.commit({ residentEntries: -1, metadataBytes: -64 });
  } else release(lease); // Its counter-only observer commits retirement before disposal.
  collect(state, generation);
}
function retire(state: State, generation: Generation, invalidate: boolean): void {
  retireRoute(state, generation);
  if (invalidate) state.owner.invalidate(generation.slot.ref);
  dropResidency(state, generation);
  collect(state, generation);
}
function quarantine(state: State, generation: Generation): void {
  retireRoute(state, generation);
  if (generation.quarantined) return;
  generation.quarantined = true;
  state.budget.commit({ quarantinedGenerations: 1,
    quarantinedImageBytes: generation.imageBytes + generation.reservedBytes,
    quarantinedRasterBytes: generation.scratchBytes });
}
function detach(state: State, waiter: Waiter): unknown[] {
  if (waiter.installing || !waiter.listening || waiter.signal === undefined) return [];
  waiter.listening = false;
  try { APPLY(waiter.signal.remove, waiter.signal.signal, ['abort', waiter.listener]); return []; }
  catch (cause) { recordCleanup(state, cause, 'TEXT_SIGNAL_FAILED'); return [cause]; }
}
function associate(error: EgretError, causes: readonly unknown[]): EgretError {
  return causes.length === 0 ? error : new EgretError(error.code, { cause: error.cause, cleanupErrors: [...error.cleanupErrors, ...causes] });
}
function rejectInert(state: State, waiter: Waiter): void {
  if (waiter.installing || waiter.error === undefined) return;
  const error = waiter.error;
  waiter.error = undefined;
  waiter.reject(associate(error, detach(state, waiter)));
}
function makeInert(state: State, waiter: Waiter, error: EgretError): void {
  if (!waiter.pending) return;
  waiter.pending = false;
  waiter.error = error;
  waiter.generation.waiters.delete(waiter);
  state.budget.commit({ pendingWaiters: -1, callerLeaseSlots: -1, metadataBytes: -192 });
}
function failWaiter(state: State, waiter: Waiter, error: EgretError): void {
  if (!waiter.pending) return;
  makeInert(state, waiter, error);
  const generation = waiter.generation;
  if (generation.waiters.size === 0 && (generation.kind === 'loading' ||
      (generation.callers === 0 && !generation.resident && !generation.residencyPending))) {
    retireRoute(state, generation);
    abort(generation.controller, error);
  }
  abort(waiter.controller, error);
  rejectInert(state, waiter);
  collect(state, generation);
}
function failGeneration(state: State, generation: Generation, error: EgretError): void {
  retireRoute(state, generation);
  const waiters = [...generation.waiters];
  for (const waiter of waiters) makeInert(state, waiter, error);
  // Every waiter is inert before the first external detach or cancellation hook.
  abort(generation.controller, error);
  for (const waiter of waiters) { abort(waiter.controller, error); rejectInert(state, waiter); }
  dropResidency(state, generation);
  collect(state, generation);
}
function install(state: State, waiter: Waiter): void {
  const binding = waiter.signal;
  if (binding === undefined) return;
  waiter.installing = true; waiter.listening = true;
  try {
    APPLY(binding.add, binding.signal, ['abort', waiter.listener, FREEZE({ once: true })]);
    if (waiter.pending) {
      const aborted = binding.signal.aborted;
      if (typeof aborted !== 'boolean') throw new TypeError('Boolean cancellation state required');
      if (aborted) waiter.listener();
    }
  } catch (cause) {
    if (waiter.pending) failWaiter(state, waiter, new EgretError('TEXT_SIGNAL_FAILED', { cause }));
    else recordCleanup(state, cause, 'TEXT_SIGNAL_FAILED');
  } finally { waiter.installing = false; }
  if (!waiter.pending) rejectInert(state, waiter);
}
function snapshotSignal(state: State, options: TextRasterAcquireOptions | undefined): SignalBinding | undefined {
  let signal: CancellationSignal | undefined;
  let aborted: boolean | undefined;
  let reason: unknown;
  let add: unknown, removeMethod: unknown;
  try {
    if (options !== undefined && (options === null || typeof options !== 'object')) throw new TypeError('Acquire options must be a record');
    signal = options?.signal;
    if (signal !== undefined) {
      aborted = signal.aborted;
      if (aborted === true) reason = signal.reason;
      else { add = signal.addEventListener; removeMethod = signal.removeEventListener; }
    }
  } catch (cause) { assertOpen(state); throw new EgretError('TEXT_SIGNAL_FAILED', { cause }); }
  assertOpen(state);
  if (signal === undefined) return undefined;
  if (typeof aborted !== 'boolean') throw new EgretError('TEXT_SIGNAL_FAILED', { cause: new TypeError('Boolean cancellation state required') });
  if (aborted) throw new EgretError('TEXT_ACQUIRE_CANCELLED', { cause: reason });
  if (typeof add !== 'function' || typeof removeMethod !== 'function') throw new EgretError('TEXT_SIGNAL_FAILED', { cause: new TypeError('Cancellation methods required') });
  return FREEZE({ signal, add: add as SignalMethod, remove: removeMethod as SignalMethod });
}

function commitCaller(state: State, waiter: Waiter, lease: AssetLease<Texture>): void {
  const generation = waiter.generation;
  const value = readAssetLeaseValue(lease);
  if (value !== generation.texture) throw new EgretError('TEXT_RESOURCE_FAILED');
  readTextureSnapshot(value as Texture);
  if (lease.resourceGeneration !== generation.resourceGeneration) throw new EgretError('TEXT_RESOURCE_FAILED');
  if (!observeAssetLeaseRetirement(lease, () => {
    generation.callers -= 1;
    state.budget.commit({ activeCallerLeases: -1, callerLeaseSlots: -1, metadataBytes: -64 });
  })) throw new EgretError('TEXT_RESOURCE_FAILED');
  generation.callers += 1;
  waiter.pending = false;
  generation.waiters.delete(waiter);
  state.budget.commit({ pendingWaiters: -1, activeCallerLeases: 1, metadataBytes: -128 });
}
function reserveResidency(state: State, generation: Generation): boolean {
  if (state.closed || !generation.current || generation.resident || generation.residencyPending || state.budget.limits.maxResidentEntries === 0) return false;
  assertOpen(state);
  if (state.residentLru.length >= state.budget.limits.maxResidentEntries) {
    const oldest = state.residentLru[0];
    if (oldest !== undefined) dropResidency(state, oldest);
  }
  const invocation = createTextValueInvocation();
  try {
    state.budget.check({ residentEntries: 1, metadataBytes: 64 }, (code, cause) => createTextValueFailure(invocation, code, cause));
    state.budget.commit({ residentEntries: 1, metadataBytes: 64 });
  } catch (cause) {
    if (takeTextValueFailure(invocation, cause)?.code === 'TEXT_CACHE_BUDGET') return false;
    throw cause;
  }
  finally { closeTextValueInvocation(invocation); }
  generation.residencyPending = true;
  return true;
}
function pinResidency(state: State, generation: Generation, caller?: AssetLease<Texture>): void {
  try {
    if (state.closed || !generation.current) return;
    if (caller !== undefined) readTextureSnapshot(readAssetLeaseValue(caller) as Texture);
    if (!reserveResidency(state, generation)) return;
    if (generation.texture === undefined) {
      generation.residencyPending = false; generation.resident = true;
      state.residentLru.push(generation); return;
    }
    // Retiring an older residency can run cleanup. Verify this entitlement again.
    try {
      assertOpen(state);
      if (!generation.current) throw new EgretError('TEXT_CACHE_CLOSED');
      readTextureSnapshot(readAssetLeaseValue(caller) as Texture);
    } catch {
      generation.residencyPending = false;
      state.budget.commit({ residentEntries: -1, metadataBytes: -64 });
      return;
    }
    // This intrinsic acquire joins the ready entry while the verified caller is live.
    beginActor(state, generation);
    const promise = state.owner.acquire(generation.slot.ref);
    void Promise.resolve(promise).then(lease => {
      generation.residencyPending = false;
      if (state.closed || !generation.current) {
        state.budget.commit({ residentEntries: -1, metadataBytes: -64 }); release(lease); return;
      }
      if (readAssetLeaseValue(lease) !== generation.texture || lease.resourceGeneration !== generation.resourceGeneration) {
        release(lease); throw new EgretError('TEXT_RESOURCE_FAILED');
      }
      if (!observeAssetLeaseRetirement(lease, () => {
        generation.resident = false;
        state.budget.commit({ residentEntries: -1, residentBytes: -generation.imageBytes, metadataBytes: -64 });
      })) { release(lease); throw new EgretError('TEXT_RESOURCE_FAILED'); }
      generation.resident = true; generation.residentLease = lease;
      state.budget.commit({ residentBytes: generation.imageBytes });
      state.residentLru.push(generation);
    }).catch(cause => {
      generation.residencyPending = false;
      state.budget.commit({ residentEntries: -1, metadataBytes: -64 });
      recordCleanup(state, cause, 'TEXT_RESOURCE_FAILED');
    }).finally(() => { endActor(state, generation); });
  } catch (cause) {
    recordCleanup(state, cause, 'TEXT_RESOURCE_FAILED');
  }
}
function deliverEmpty(state: State, waiter: Waiter): void {
  if (!waiter.pending) return;
  const generation = waiter.generation;
  beginActor(state, generation);
  try {
  waiter.pending = false; generation.waiters.delete(waiter);
  state.budget.commit({ pendingWaiters: -1, callerLeaseSlots: -1, metadataBytes: -192 });
  const failures = detach(state, waiter);
  if (failures.length !== 0) waiter.reject(new EgretError('TEXT_SIGNAL_FAILED', { cause: failures[0] }));
  else if (state.closed) waiter.reject(new EgretError('TEXT_CACHE_CLOSED'));
  else {
    waiter.resolve(FREEZE({ kind: 'empty', request: generation.request, metrics: generation.metrics! }));
    pinResidency(state, generation);
  }
  } finally { endActor(state, generation); }
}
function deliverImage(state: State, waiter: Waiter): void {
  if (!waiter.pending) return;
  const generation = waiter.generation;
  beginActor(state, generation);
  state.staged.set(generation.slot.ref, generation);
  let promise: Promise<AssetLease<Texture>>;
  try { promise = state.owner.acquire(generation.slot.ref, { signal: waiter.controller.signal }); }
  catch (cause) {
    state.staged.delete(generation.slot.ref);
    failWaiter(state, waiter, new EgretError('TEXT_RESOURCE_FAILED', { cause }));
    endActor(state, generation); return;
  }
  state.staged.delete(generation.slot.ref);
  void Promise.resolve(promise).then(lease => {
    if (!waiter.pending) { release(lease); return; }
    try { commitCaller(state, waiter, lease); }
    catch (cause) {
      release(lease);
      failWaiter(state, waiter, new EgretError('TEXT_RESOURCE_FAILED', { cause })); return;
    }
    const failures = detach(state, waiter);
    if (failures.length !== 0) {
      release(lease); waiter.reject(new EgretError('TEXT_SIGNAL_FAILED', { cause: failures[0] })); return;
    }
    try { readTextureSnapshot(readAssetLeaseValue(lease) as Texture); }
    catch (cause) { release(lease); waiter.reject(new EgretError('TEXT_RESOURCE_FAILED', { cause })); return; }
    waiter.resolve(FREEZE({ kind: 'image', request: generation.request, metrics: generation.metrics!, lease }));
    pinResidency(state, generation, lease);
  }).catch(cause => {
    failWaiter(state, waiter, new EgretError('TEXT_RESOURCE_FAILED', { cause }));
  }).finally(() => { endActor(state, generation); });
}
function deliver(state: State, generation: Generation): void {
  for (const waiter of [...generation.waiters]) {
    if (generation.image === undefined) deliverEmpty(state, waiter);
    else deliverImage(state, waiter);
  }
  if (generation.image === undefined && generation.waiters.size === 0 && !generation.resident) retireRoute(state, generation);
}
/** Keep exact generation identity at load entry; never resolve through the latest slot. */
function loadTexture(state: State, ref: AssetRef<Texture>, context: AssetLoadContext): Promise<Texture> {
  const generation = state.staged.get(ref);
  if (generation === undefined || generation.image === undefined || generation.quarantined) return Promise.reject(new EgretError('TEXT_RESOURCE_FAILED'));
  generation.resourceGeneration = context.resourceGeneration; generation.taskId = context.taskId;
  const texture = createTexture(generation.image);
  generation.texture = texture;
  state.textures.set(texture, generation);
  return Promise.resolve(texture);
}
function disposeTexture(state: State, texture: Texture): void {
  const generation = state.textures.get(texture);
  if (generation === undefined) throw new EgretError('TEXT_RESOURCE_FAILED');
  try { APPLY(DISPOSE_TEXTURE, texture, []); }
  catch (cause) { quarantine(state, generation); recordCleanup(state, cause, 'TEXT_RESOURCE_FAILED', true); throw cause; }
  state.textures.delete(texture);
  generation.texture = undefined;
  generation.image = undefined;
  state.budget.commit({ liveImageBytes: -generation.imageBytes });
  generation.imageBytes = 0;
  retireRoute(state, generation);
  collect(state, generation);
}

async function runJob(state: State, generation: Generation): Promise<void> {
  const invocation = createTextValueInvocation();
  const issuer = createTextRasterPlanIssuer(generation.request, invocation);
  let plan: TextRasterPlan | undefined;
  let primary: EgretError | undefined;
  let releaseFailed = false;
  let failedWaiters: Waiter[] = [];
  let lateProviderRejected = false;
  try {
    let returned: unknown;
    try {
      returned = await Promise.resolve(APPLY(state.provider.measure, state.provider.receiver, [generation.request,
        FREEZE({ signal: generation.controller.signal, fontGeneration: generation.request.fontGeneration, limits: LIMITS, createPlan: issuer.createPlan })]));
    } catch (cause) {
      const own = takeTextValueFailure(invocation, cause);
      lateProviderRejected = own === undefined && (!generation.current || generation.waiters.size === 0);
      primary = own?.error ?? new EgretError('TEXT_MEASURE_FAILED', { cause });
    } finally { closeTextRasterPlanIssuer(issuer); }
    if (primary === undefined) {
      try { plan = requireIssuedTextRasterPlan(issuer, returned, invocation); }
      catch (cause) { primary = takeTextValueFailure(invocation, cause)?.error ?? new EgretError('TEXT_PLAN_INVALID', { cause }); }
    }
    plan ??= readIssuedTextRasterPlan(issuer);
    closeTextValueInvocation(invocation);
    if (primary === undefined && plan !== undefined && generation.current && generation.waiters.size !== 0 && !state.closed) {
      // Engine closing can precede its automatic manager-close hook at a frame barrier.
      try { assertOpen(state); }
      catch (cause) { primary = cause as EgretError; }
      if (primary === undefined) {
      const bytes = plan.metrics.raster?.byteLength ?? 0;
      const reserve = createTextValueInvocation();
      try {
        state.budget.check({ reservedImageBytes: bytes, pendingRasterBytes: 2 * bytes }, (code, cause) => createTextValueFailure(reserve, code, cause));
        state.budget.commit({ reservedImageBytes: bytes, pendingRasterBytes: 2 * bytes });
        generation.reservedBytes = bytes; generation.scratchBytes = 2 * bytes;
      } catch (cause) { primary = takeTextValueFailure(reserve, cause)?.error ?? new EgretError('TEXT_RASTER_FAILED', { cause }); }
      finally { closeTextValueInvocation(reserve); }
      if (primary === undefined) {
        let image: unknown;
        try {
          image = await Promise.resolve(APPLY(state.provider.rasterize, state.provider.receiver, [plan,
            FREEZE({ signal: generation.controller.signal, fontGeneration: generation.request.fontGeneration, limits: LIMITS,
              reservedImageBytes: bytes, reservedScratchBytes: 2 * bytes })]));
        } catch (cause) {
          lateProviderRejected = !generation.current || generation.waiters.size === 0;
          primary = new EgretError('TEXT_RASTER_FAILED', { cause });
        }
        if (primary === undefined) {
          if (plan.metrics.raster === undefined) {
            if (image !== undefined) primary = new EgretError('TEXT_RASTER_RESULT_INVALID');
          } else if (!isImageData2D(image)) primary = new EgretError('TEXT_RASTER_RESULT_INVALID');
          else if (image.width !== plan.metrics.raster.width || image.height !== plan.metrics.raster.height ||
            image.format !== 'rgba8unorm' || image.colorSpace !== 'srgb' || image.alphaMode !== 'straight' || image.origin !== 'top-left') {
            primary = new EgretError('TEXT_RASTER_RESULT_INVALID');
          } else generation.image = image;
        }
      }
      }
    }
    if (primary !== undefined) {
      // Preserve the settled primary before a release callback can close or invalidate.
      // Reply only after release settles so a cleanup fault remains associated.
      failedWaiters = [...generation.waiters];
      retireRoute(state, generation);
      for (const waiter of failedWaiters) makeInert(state, waiter, primary);
    }
    if (plan !== undefined) {
      // One invocation after all measure/raster uses settle, including late cancellation.
      try { await Promise.resolve(APPLY(state.provider.release, state.provider.receiver, [plan])); }
      catch (cause) {
        releaseFailed = true;
        generation.quarantinedPlan = plan;
        recordCleanup(state, cause, 'TEXT_PLAN_RELEASE_FAILED');
        quarantine(state, generation);
        primary = primary === undefined ? new EgretError('TEXT_PLAN_RELEASE_FAILED', { cause }) : associate(primary, [cause]);
      }
    }
    if (primary !== undefined) {
      for (const waiter of failedWaiters) waiter.error = primary;
    }
    if (!releaseFailed) {
      state.budget.commit({ pendingRasterBytes: -generation.scratchBytes });
      generation.scratchBytes = 0;
    }
    if (primary !== undefined) {
      if (lateProviderRejected) {
        if (state.budget.snapshot().lateProviderFailureCount < Number.MAX_SAFE_INTEGER) state.budget.commit({ lateProviderFailureCount: 1 });
      }
      failGeneration(state, generation, primary);
      for (const waiter of failedWaiters) { abort(waiter.controller, primary); rejectInert(state, waiter); }
    } else if (!generation.current || generation.waiters.size === 0 || state.closed) {
      retireRoute(state, generation);
    } else {
      // An observed release thenable may settle before the Engine frame barrier
      // closes its manager. Preserve this trusted owner-close reason directly.
      let ownerClose: EgretError | undefined;
      try { assertOpen(state); } catch (cause) { ownerClose = cause as EgretError; }
      if (ownerClose !== undefined) failGeneration(state, generation, ownerClose);
      else {
      generation.metrics = plan!.metrics;
      generation.kind = 'ready';
      if (generation.image !== undefined) {
        generation.imageBytes = generation.reservedBytes;
        state.budget.commit({ reservedImageBytes: -generation.reservedBytes, liveImageBytes: generation.imageBytes });
        generation.reservedBytes = 0;
      }
      deliver(state, generation);
      }
    }
  } catch (cause) { failGeneration(state, generation, new EgretError('TEXT_RESOURCE_FAILED', { cause })); }
  finally {
    closeTextValueInvocation(invocation);
    if (!generation.quarantined && generation.texture === undefined) {
      generation.image = undefined;
      state.budget.commit({ reservedImageBytes: -generation.reservedBytes, liveImageBytes: -generation.imageBytes, pendingRasterBytes: -generation.scratchBytes });
      generation.reservedBytes = 0; generation.imageBytes = 0; generation.scratchBytes = 0;
    }
    generation.workSettled = true;
    endActor(state, generation);
  }
}

function acquire(this: TextRasterCache, input: TextRasterRequestInput, options?: TextRasterAcquireOptions): Promise<PreparedTextRaster> {
  return new Promise((resolve, reject) => {
    const invocation = createTextValueInvocation();
    let state: State | undefined;
    let waiter: Waiter | undefined;
    let newJob = false;
    let ownsBusy = false;
    let createdGeneration: Generation | undefined;
    let workActorStarted = false;
    let constructingWaiter = false;
    try {
      state = stateOf(this); assertMutable(state); state.busy = true; ownsBusy = true;
      const binding = snapshotSignal(state, options);
      let snapshot;
      try { snapshot = snapshotTextRasterRequest(input, invocation); }
      finally { assertOpen(state); }
      let summary: TextRasterRequestSummary | undefined = summarizeTextRasterRequest(snapshot, state.provider.identity, state.fontGeneration, invocation);
      // Count refusal precedes any optional route retirement and external cleanup.
      state.budget.check({ pendingWaiters: 1, callerLeaseSlots: 1 }, (code, cause) => createTextValueFailure(invocation, code, cause));
      let generation = state.lru.find(value => matchesTextRasterRequestSummary(value.request, summary!, state!.provider.identity, state!.fontGeneration));
      if (generation?.texture !== undefined) {
        try { readTextureSnapshot(generation.texture); }
        catch { retire(state, generation, true); generation = undefined; }
      }
      let slot: Slot | undefined;
      if (generation === undefined) {
        slot = state.slots.find(value => value.current === undefined);
        if (slot === undefined) {
          const oldest = state.lru.find(value => value.kind === 'ready');
          if (oldest !== undefined) { slot = oldest.slot; retire(state, oldest, true); }
        }
      }
      // Caller limits precede route/generation/job limits for the same proposal.
      if (generation === undefined) {
        if (slot === undefined) throw createTextValueFailure(invocation, 'TEXT_CACHE_BUDGET');
        const sequence = increment(slot.sequence);
        state.budget.check({ pendingWaiters: 1, callerLeaseSlots: 1, occupiedSlots: 1, currentGenerations: 1,
          pendingJobs: 1, metadataBytes: summary.metadataBytes + 192 }, (code, cause) => createTextValueFailure(invocation, code, cause));
        // Owned source-line arrays are covered before their first allocation.
        state.budget.commit({ metadataBytes: summary.metadataBytes });
        try {
          const request = createOwnedTextRasterRequest(summary, invocation);
          generation = { slot, sequence, request, metadata: summary.metadataBytes, controller: controller(state), waiters: new Set(),
            current: true, kind: 'loading', actors: 0, jobCharged: true, workSettled: false, quarantined: false, quarantinedPlan: undefined,
            callers: 0, metrics: undefined, image: undefined, texture: undefined, imageBytes: 0, reservedBytes: 0,
            scratchBytes: 0, resourceGeneration: undefined, taskId: undefined, resident: false, residentLease: undefined, residencyPending: false };
          // A free route may still have real callers from a retired manager generation.
          state.owner.invalidate(slot.ref);
        } catch (cause) {
          state.budget.commit({ metadataBytes: -summary.metadataBytes });
          throw new EgretError('TEXT_REQUEST_INVALID', { cause });
        }
        state.budget.commit({ occupiedSlots: 1, currentGenerations: 1, pendingJobs: 1 });
        slot.sequence = sequence; slot.current = generation;
        state.generations.add(generation); touch(state, generation); newJob = true;
        createdGeneration = generation;
      } else {
        state.budget.check({ pendingWaiters: 1, callerLeaseSlots: 1, metadataBytes: 192 }, (code, cause) => createTextValueFailure(invocation, code, cause));
        touch(state, generation);
      }
      snapshot = undefined; summary = undefined;
      const ownedState = state;
      const ownedGeneration = generation;
      constructingWaiter = true;
      waiter = { generation, signal: binding, controller: controller(state), pending: true, installing: false, listening: false,
        error: undefined, resolve, reject, listener: (): void => {
          if (!waiter!.pending) return;
          let reason: unknown;
          try { reason = binding!.signal.reason; }
          catch (cause) { failWaiter(ownedState, waiter!, new EgretError('TEXT_SIGNAL_FAILED', { cause })); return; }
          failWaiter(ownedState, waiter!, new EgretError('TEXT_ACQUIRE_CANCELLED', { cause: reason }));
        } };
      constructingWaiter = false;
      state.budget.commit({ pendingWaiters: 1, callerLeaseSlots: 1, metadataBytes: 192 });
      generation.waiters.add(waiter);
      if (newJob) { beginActor(state, generation); workActorStarted = true; }
      state.busy = false; closeTextValueInvocation(invocation);
      beginActor(state, generation);
      try {
        install(state, waiter);
        // Hand off while installation is still an actor; an idle observer must
        // never see a gap before actual delivery and external listener removal.
        if (newJob) {
          if (!ownedGeneration.current || ownedGeneration.waiters.size === 0) {
            ownedGeneration.workSettled = true;
            endActor(state, ownedGeneration);
          } else void runJob(state, ownedGeneration);
        } else if (waiter.pending && generation.kind === 'ready') {
          if (generation.image === undefined) deliverEmpty(state, waiter); else deliverImage(state, waiter);
        }
      } finally { endActor(state, generation); }
    } catch (cause) {
      const own = takeTextValueFailure(invocation, cause);
      if (waiter !== undefined && state !== undefined) failWaiter(state, waiter, own?.error ?? new EgretError('TEXT_RESOURCE_FAILED', { cause }));
      else reject(own?.error ?? (constructingWaiter ? new EgretError('TEXT_REQUEST_INVALID', { cause }) : cause));
      if (state !== undefined && createdGeneration !== undefined && !workActorStarted) {
        // No provider/async actor used the record. Undo its undemanded admission.
        retireRoute(state, createdGeneration);
        createdGeneration.workSettled = true;
        if (createdGeneration.jobCharged) {
          createdGeneration.jobCharged = false;
          state.budget.commit({ pendingJobs: -1 });
        }
        collect(state, createdGeneration);
      }
    } finally { if (state !== undefined && ownsBusy) state.busy = false; closeTextValueInvocation(invocation); }
  });
}
function invalidate(this: TextRasterCache): void {
  const state = stateOf(this); assertMutable(state);
  const next = increment(state.fontGeneration);
  state.fontGeneration = next;
  const current = [...state.lru];
  const error = new EgretError('TEXT_ACQUIRE_CANCELLED');
  const waiters = current.flatMap(generation => [...generation.waiters]);
  for (const generation of current) retireRoute(state, generation);
  for (const waiter of waiters) makeInert(state, waiter, error);
  for (const generation of current) state.owner.invalidate(generation.slot.ref);
  for (const generation of current) { abort(generation.controller, error); dropResidency(state, generation); collect(state, generation); }
  for (const waiter of waiters) { abort(waiter.controller, error); rejectInert(state, waiter); }
}
function close(state: State): void {
  if (state.closed) return;
  state.closed = true;
  const error = new EgretError('TEXT_CACHE_CLOSED');
  const generations = [...state.generations];
  const waiters = generations.flatMap(generation => [...generation.waiters]);
  for (const generation of generations) retireRoute(state, generation);
  for (const waiter of waiters) makeInert(state, waiter, error);
  for (const generation of generations) { abort(generation.controller, error); dropResidency(state, generation); collect(state, generation); }
  for (const waiter of waiters) { abort(waiter.controller, error); rejectInert(state, waiter); }
  settleIdle(state);
}
function dispose(this: TextRasterCache): void { close(stateOf(this)); }
function getStatus(this: TextRasterCache): TextRasterCacheStatus {
  const state = stateOf(this);
  return FREEZE({ closed: state.closed, fontGeneration: state.fontGeneration, ...state.budget.snapshot() });
}
function whenIdle(this: TextRasterCache): Promise<void> {
  return new Promise((resolve, reject) => {
    const invocation = createTextValueInvocation();
    try {
      const state = stateOf(this);
      if (state.actors === 0) {
        if (state.hasCleanupFailure) reject(new EgretError('TEXT_CACHE_CLEANUP_FAILED', { cause: state.firstCleanupCause }));
        else resolve();
        return;
      }
      state.budget.check({ idleWaiters: 1, metadataBytes: 64 }, (code, cause) => createTextValueFailure(invocation, code, cause));
      const waiter = { resolve, reject };
      state.budget.commit({ idleWaiters: 1, metadataBytes: 64 }); state.idle.add(waiter);
    } catch (cause) { reject(takeTextValueFailure(invocation, cause)?.error ?? cause); }
    finally { closeTextValueInvocation(invocation); }
  });
}

/** Explicit CPU text orchestration; this entry owns no browser font or drawing surface. */
export function createTextRasterCache(assets: AssetManager, options: TextRasterCacheOptions): TextRasterCache {
  const owner = requireAssetManagerOwner(assets);
  let finish: (() => void) | undefined;
  try { finish = beginTextCacheCreation(assets); }
  catch (cause) {
    // The authentic lifetime seam supplies these exact synchronous guard failures.
    if (cause instanceof EgretError && (cause.code === 'TEXT_CACHE_ALREADY_CREATED' || cause.code === 'TEXT_CACHE_REENTRANT')) throw cause;
    throw new EgretError('TEXT_CACHE_CLOSED', { cause });
  }
  try {
    let values: unknown[];
    try {
      if (options === null || typeof options !== 'object') throw new TypeError('Text cache options required');
      values = [options.provider, options.maxGenerations, options.maxPendingJobs, options.maxWaiters, options.maxCallerLeases,
        options.maxResidentEntries, options.maxMetadataBytes, options.maxLogicalImageBytes, options.maxPendingRasterBytes];
    } catch (cause) {
      try { owner.assertOpen(); } catch (closed) { throw new EgretError('TEXT_CACHE_CLOSED', { cause: closed }); }
      throw new EgretError('TEXT_CACHE_OPTIONS_INVALID', { cause });
    }
    let providerValues: unknown[];
    const receiver = values[0] as TextRasterProvider;
    try {
      if (receiver === null || (typeof receiver !== 'object' && typeof receiver !== 'function')) throw new TypeError('Text provider required');
      providerValues = [receiver.identity, receiver.profile, receiver.measure, receiver.rasterize, receiver.release];
    } catch (cause) {
      try { owner.assertOpen(); } catch (closed) { throw new EgretError('TEXT_CACHE_CLOSED', { cause: closed }); }
      throw new EgretError('TEXT_PROVIDER_INVALID', { cause });
    }
    try { owner.assertOpen(); } catch (cause) { throw new EgretError('TEXT_CACHE_CLOSED', { cause }); }
    const [identity, profile, measure, rasterize, releasePlan] = providerValues;
    const match = typeof identity === 'string' ? APPLY(REGEXP_EXEC, PROVIDER_IDENTITY, [identity]) as RegExpExecArray | null : null;
    if (match === null || match[0].length !== (identity as string).length || profile !== PROFILE ||
        typeof measure !== 'function' || typeof rasterize !== 'function' || typeof releasePlan !== 'function') throw new EgretError('TEXT_PROVIDER_INVALID');
    const limits = { ...TEXT_BUDGET_DEFAULTS } as TextBudgetLimits;
    const mutable = limits as { -readonly [K in keyof TextBudgetLimits]: number };
    let index = 1;
    for (const key of LIMIT_KEYS) {
      const supplied = values[index++];
      const value = supplied === undefined ? TEXT_BUDGET_DEFAULTS[key] : supplied;
      if (typeof value !== 'number' || !SAFE_INTEGER(value) || value < TEXT_BUDGET_MINIMA[key] || value > TEXT_BUDGET_DEFAULTS[key]) throw new EgretError('TEXT_CACHE_OPTIONS_INVALID');
      mutable[key] = value === 0 ? 0 : value;
    }
    const type = createAssetType<Texture>('egret.text-raster.t1.texture', isTexture);
    const slots = FREEZE(Array.from({ length: 32 }, (_, index): Slot => ({
      ref: createAssetRef(type, `egret.text-raster.t1.slot.${String(index).padStart(2, '0')}`), sequence: 0, current: undefined,
    })));
    const state: State = { owner, provider: FREEZE({ receiver, identity: identity as string,
      measure: measure as TextRasterProvider['measure'], rasterize: rasterize as TextRasterProvider['rasterize'], release: releasePlan as TextRasterProvider['release'] }),
      budget: new TextBudget(FREEZE(limits)), slots, generations: new Set(), lru: [], residentLru: [], staged: new Map(), textures: new WeakMap(),
      idle: new Set(), closed: false, busy: false, fontGeneration: 1, actors: 0, hasCleanupFailure: false, firstCleanupCause: undefined };
    const cache = FREEZE({ profile: PROFILE, acquire, invalidate, getStatus, whenIdle, dispose }) as TextRasterCache;
    APPLY(WEAK_SET, states, [cache, state]); commitBinding([cache], owner.context);
    commitTextCacheLifetime(assets, () => { close(state); });
    try {
      owner.register(type, { load: (ref, context) => loadTexture(state, ref, context), dispose: texture => { disposeTexture(state, texture); } });
      for (const slot of slots) owner.invalidate(slot.ref);
    } catch (cause) { close(state); throw new EgretError('TEXT_CACHE_NAMESPACE_FAILED', { cause }); }
    return cache;
  } finally { finish(); }
}
