import { CancellationController, EgretError, Scope } from '@egret/runtime';
import type { AssetGroupOperations, AssetLease, AssetRef } from '@egret/runtime';
import type { Diagnostic } from '@egret/contracts';
import type { AssetGroup, AssetGroupState } from './assetGroupTypes.js';

export interface AssetGroupContext {
  assertOpen(): void;
  isEngineScope(scope: unknown): scope is Scope;
  report(diagnostic: Diagnostic): void;
  captureCleanup(cause: unknown): void;
}
export interface AssetGroupOwner {
  create<T>(scope: unknown, refs: unknown, options: unknown): AssetGroup<T>;
  close(): void;
}

const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
const IS_ARRAY = Array.isArray;
const HAS_OWN = Object.prototype.hasOwnProperty;
const PROMISE_THEN = Promise.prototype.then;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
const ABORT = CancellationController.prototype.abort;

interface GroupRecord {
  readonly context: AssetGroupContext;
  readonly operations: AssetGroupOperations;
  readonly controller: CancellationController;
  readonly concurrency: number;
  readonly ready: Promise<readonly AssetLease<unknown>[]>;
  readonly resolveReady: (leases: readonly AssetLease<unknown>[]) => void;
  readonly rejectReady: (cause: unknown) => void;
  scope: Scope | undefined;
  refs: readonly unknown[] | undefined;
  members: (AssetLease<unknown> | undefined)[];
  owner: Set<GroupRecord> | undefined;
  facade: object | undefined;
  state: AssetGroupState;
  nextIndex: number;
  outstanding: number;
  completed: number;
  scheduling: boolean;
}
interface CleanupSnapshot {
  readonly record: GroupRecord;
  readonly error: EgretError;
  readonly members: readonly (AssetLease<unknown> | undefined)[];
}

/** Genuine membership precedes captured state reads, including admission reentry. */
function assertLifetime(context: AssetGroupContext, scope: unknown): asserts scope is Scope {
  context.assertOpen();
  if (!context.isEngineScope(scope)) throw new EgretError('ASSET_GROUP_SCOPE_INVALID');
  if (APPLY(SCOPE_STATE, scope, []) !== 'open') throw new EgretError('SCOPE_CLOSED');
}

/** Both successful reads and thrown undefined recheck Engine then Scope first. */
function callerRead<T>(read: () => T, code: string, context: AssetGroupContext, scope: Scope): T {
  let value!: T;
  let failed = false;
  let cause: unknown;
  try { value = read(); }
  catch (failure) { failed = true; cause = failure; }
  assertLifetime(context, scope);
  if (failed) throw new EgretError(code, { cause });
  return value;
}

function admitRefs(context: AssetGroupContext, scope: Scope, refs: unknown): readonly unknown[] {
  if (!callerRead(() => IS_ARRAY(refs), 'ASSET_GROUP_REFS_INVALID', context, scope)) throw new EgretError('ASSET_GROUP_REFS_INVALID');
  const array = refs as unknown[];
  const length = callerRead(() => array.length, 'ASSET_GROUP_REFS_INVALID', context, scope);
  if (!Number.isInteger(length) || length < 0 || length > 128) throw new EgretError('ASSET_GROUP_REFS_INVALID');
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index++) {
    // Own-position proxy traps are caller reads too; inherited refs fill no hole.
    const own = callerRead(() => APPLY(HAS_OWN, array, [index]) as boolean, 'ASSET_GROUP_REFS_INVALID', context, scope);
    if (!own) throw new EgretError('ASSET_GROUP_REFS_INVALID');
    snapshot.push(callerRead(() => array[index], 'ASSET_GROUP_REFS_INVALID', context, scope));
  }
  return FREEZE(snapshot);
}

function admitConcurrency(context: AssetGroupContext, scope: Scope, options: unknown): number {
  if (options === undefined) return 4;
  if (typeof options !== 'object' || options === null) throw new EgretError('ASSET_GROUP_OPTIONS_INVALID');
  if (callerRead(() => IS_ARRAY(options), 'ASSET_GROUP_OPTIONS_INVALID', context, scope)) throw new EgretError('ASSET_GROUP_OPTIONS_INVALID');
  const requested = callerRead(() => (options as { readonly concurrency?: unknown }).concurrency, 'ASSET_GROUP_OPTIONS_INVALID', context, scope);
  const concurrency = requested === undefined ? 4 : requested;
  if (typeof concurrency !== 'number' || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new EgretError('ASSET_GROUP_OPTIONS_INVALID');
  return concurrency;
}

/** This is an observation-order choice, never a synthesized acquisition failure. */
function disposalCause(record: GroupRecord): unknown {
  try { record.context.assertOpen(); }
  catch (cause) { return cause; }
  const scope = record.scope;
  if (scope !== undefined && APPLY(SCOPE_STATE, scope, []) !== 'open') return new EgretError('SCOPE_CLOSED');
  return undefined;
}

function reportCleanup(record: GroupRecord, cause: unknown): void {
  record.context.captureCleanup(cause);
  record.context.report({ code: 'ASSET_GROUP_CLEANUP_FAILED', phase: 'assets', severity: 'error', cause });
}

/** Consume routing and member borrows before cancellation/disposal can reenter. */
function commitTerminal(record: GroupRecord, state: 'failed' | 'disposed', cause: unknown): CleanupSnapshot | undefined {
  if (record.state === 'failed' || record.state === 'disposed') return undefined;
  const pending = record.state === 'pending';
  record.state = state;
  const error = new EgretError(state === 'failed' ? 'ASSET_GROUP_ACQUIRE_FAILED' : 'ASSET_GROUP_DISPOSED', { cause });
  if (pending) record.rejectReady(error);
  record.refs = undefined;
  record.scope = undefined;
  record.facade = undefined;
  record.owner?.delete(record);
  record.owner = undefined;
  const members = record.members;
  record.members = [];
  return { record, error, members };
}

function releaseMember(record: GroupRecord, lease: unknown): void {
  try { record.operations.releaseGroupLease(lease); }
  catch (cause) { reportCleanup(record, cause); }
}

/** Manager-caught provider faults keep its ASSET_CLEANUP_FAILED diagnostic. */
function runCleanup(snapshot: CleanupSnapshot): void {
  const { record, error, members } = snapshot;
  try { APPLY(ABORT, record.controller, [error]); }
  catch (cause) { reportCleanup(record, cause); }
  for (let index = members.length - 1; index >= 0; index--) {
    const member = members[index];
    if (member !== undefined) releaseMember(record, member);
  }
}

function terminate(record: GroupRecord, state: 'failed' | 'disposed', cause: unknown): void {
  const snapshot = commitTerminal(record, state, cause);
  if (snapshot !== undefined) runCleanup(snapshot);
}

function requirePendingLifetime(record: GroupRecord): boolean {
  if (record.state !== 'pending') return false;
  try { assertLifetime(record.context, record.scope); return true; }
  catch (cause) { terminate(record, 'disposed', cause); return false; }
}

function fulfillMember(record: GroupRecord, index: number, lease: AssetLease<unknown>): void {
  if (!requirePendingLifetime(record)) { releaseMember(record, lease); return; }
  try { record.operations.claimGroupLease(lease, record.facade!); }
  catch (cause) {
    // Commit failure first, then retire the unpublished lease alongside known members.
    terminate(record, 'failed', cause);
    releaseMember(record, lease);
    return;
  }
  record.members[index] = lease;
  record.completed++;
  if (record.completed === record.members.length) {
    record.state = 'ready';
    record.refs = undefined;
    record.resolveReady(FREEZE(record.members.slice()) as readonly AssetLease<unknown>[]);
    return;
  }
  schedule(record);
}

function rejectMember(record: GroupRecord, cause: unknown): void {
  if (!requirePendingLifetime(record)) return;
  terminate(record, 'failed', cause);
}

/** Reserve before acquire; a synchronous provider may already close this group. */
function startMember(record: GroupRecord, index: number, ref: unknown): void {
  record.outstanding++;
  let active = true;
  const retireSlot = (): void => {
    if (!active) return;
    active = false;
    record.outstanding--;
  };
  try {
    const promise = record.operations.acquire(ref as AssetRef<unknown>, { signal: record.controller.signal });
    const continuation = APPLY(PROMISE_THEN, promise, [
      (lease: AssetLease<unknown>): void => { retireSlot(); fulfillMember(record, index, lease); },
      (cause: unknown): void => { retireSlot(); rejectMember(record, cause); },
    ]) as Promise<void>;
    // Consume even an unexpected internal handler throw without a detached rejection.
    void APPLY(PROMISE_THEN, continuation, [undefined, (cause: unknown): void => { retireSlot(); rejectMember(record, cause); }]);
  } catch (cause) { retireSlot(); rejectMember(record, cause); }
}

/** The window bounds this group's unsettled acquisitions, not provider activity. */
function schedule(record: GroupRecord): void {
  if (record.scheduling || record.state !== 'pending') return;
  record.scheduling = true;
  try {
    while (record.state === 'pending' && record.outstanding < record.concurrency) {
      if (!requirePendingLifetime(record)) return;
      const refs = record.refs!;
      if (record.nextIndex === refs.length) return;
      const index = record.nextIndex++;
      startMember(record, index, refs[index]);
    }
  } finally { record.scheduling = false; }
}

function makeRecord(context: AssetGroupContext, operations: AssetGroupOperations, scope: Scope, refs: readonly unknown[], concurrency: number): GroupRecord {
  let resolveReady!: GroupRecord['resolveReady'];
  let rejectReady!: GroupRecord['rejectReady'];
  const ready = new Promise<readonly AssetLease<unknown>[]>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Own the rejection from creation, including disposal during the first loader.
  void APPLY(PROMISE_THEN, ready, [undefined, (): void => {}]);
  return {
    context, operations, scope, refs, concurrency, ready, resolveReady, rejectReady,
    controller: new CancellationController(), members: Array(refs.length), owner: undefined,
    facade: undefined, state: 'pending', nextIndex: 0, outstanding: 0, completed: 0, scheduling: false,
  };
}

function makeHandle<T>(record: GroupRecord): AssetGroup<T> {
  function assertReceiver(receiver: unknown): void {
    if (receiver !== group) throw new EgretError('ASSET_GROUP_INVALID');
  }
  const group = FREEZE({
    get state(): AssetGroupState { assertReceiver(this); return record.state; },
    get ready(): Promise<readonly AssetLease<unknown>[]> { assertReceiver(this); return record.ready; },
    dispose(): void { assertReceiver(this); terminate(record, 'disposed', disposalCause(record)); },
  });
  record.facade = group;
  return group as unknown as AssetGroup<T>;
}

/** Admission is inert; clear busy before activation can invoke any provider. */
export function createAssetGroupOwner(context: AssetGroupContext, operations: AssetGroupOperations): AssetGroupOwner {
  const records = new Set<GroupRecord>();
  let admissionBusy = false;
  return FREEZE({
    create<T>(scope: unknown, refs: unknown, options: unknown): AssetGroup<T> {
      assertLifetime(context, scope);
      if (admissionBusy) throw new EgretError('ASSET_GROUP_REENTRANT');
      admissionBusy = true;
      let record!: GroupRecord;
      let group!: AssetGroup<T>;
      try {
        const snapshot = admitRefs(context, scope, refs);
        const concurrency = admitConcurrency(context, scope, options);
        operations.admitGroupRefs(snapshot);
        record = makeRecord(context, operations, scope, snapshot, concurrency);
        group = makeHandle<T>(record);
        try { APPLY(SCOPE_USE, scope, [group]); assertLifetime(context, scope); }
        catch (cause) { terminate(record, 'disposed', cause); throw cause; }
        record.owner = records;
        records.add(record);
      } finally { admissionBusy = false; }
      if (record.members.length === 0) {
        if (requirePendingLifetime(record)) {
          record.state = 'ready'; record.refs = undefined;
          record.resolveReady(FREEZE([]));
        }
      } else schedule(record);
      return group;
    },
    close(): void {
      // Every pending/ready group is terminal before the first abort/release hook.
      const snapshots: CleanupSnapshot[] = [];
      for (const record of records) {
        const snapshot = commitTerminal(record, 'disposed', new EgretError('ENGINE_CLOSED'));
        if (snapshot !== undefined) snapshots.push(snapshot);
      }
      for (const snapshot of snapshots) runCleanup(snapshot);
    },
  });
}
