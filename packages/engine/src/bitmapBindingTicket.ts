// SPDX-License-Identifier: Apache-2.0
import { EgretError, Scope } from '@egret/runtime';
import type { AssetLease, Bitmap, CapturedSharedContent2D, EngineContext, Stage, Texture } from '@egret/runtime';

/** Publishes borrowed group members once; owns no initial or candidate lease. */
export interface BitmapBindingTicket {
  prepare(members: readonly AssetLease<Texture>[]): void;
  commit(): void;
  dispose(): void;
}
type Operations = Parameters<NonNullable<EngineContext['registerBitmapResourceTarget']>>[1];
export interface BitmapBindingContext {
  assertOpen(): void;
  isEngineScope(scope: unknown): scope is Scope;
}
export interface BitmapBindingOwner {
  capture(scope: unknown, targets: unknown): BitmapBindingTicket;
  readPreparedForCapture(ticket: unknown): Readonly<{
    validate(): void;
    captureContent(stage: Stage): CapturedSharedContent2D;
  }>;
  close(): void;
}
const APPLY = Reflect.apply, FREEZE = Object.freeze, IS_ARRAY = Array.isArray;
const HAS_OWN = Object.prototype.hasOwnProperty;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state')!.get!;
const SCOPE_USE = Scope.prototype.use;
type Phase = 'captured' | 'prepared' | 'committed' | 'terminal';
interface TicketRecord {
  readonly context: BitmapBindingContext;
  readonly scope: Scope;
  readonly operations: Operations;
  readonly inventory: Set<TicketRecord>;
  phase: Phase;
  conflict: boolean;
  reading: boolean;
  captured: object | undefined;
  prepared: object | undefined;
  publication: object | undefined;
  readonly count: number;
}

function assertLifetime(context: BitmapBindingContext, scope: unknown): asserts scope is Scope {
  context.assertOpen();
  if (!context.isEngineScope(scope)) throw new EgretError('BITMAP_BINDING_SCOPE_INVALID');
  if (APPLY(SCOPE_STATE, scope, []) !== 'open') throw new EgretError('SCOPE_CLOSED');
}
function assertAvailable(record: TicketRecord): void {
  assertLifetime(record.context, record.scope);
  if (record.phase === 'terminal') {
    throw new EgretError(record.conflict ? 'BITMAP_RESOURCE_BINDING_CHANGED' : 'BITMAP_BINDING_DISPOSED');
  }
}
function assertOperation(record: TicketRecord, phase: 'captured' | 'prepared'): void {
  assertAvailable(record);
  if (record.reading) throw new EgretError('BITMAP_BINDING_REENTRANT');
  if (record.phase !== phase) throw new EgretError('BITMAP_BINDING_STATE_INVALID');
}
/** This pass revokes authority only; clearing is a separate callback-free pass. */
function markTerminal(record: TicketRecord, conflict = false): void {
  record.conflict = record.conflict || conflict;
  record.phase = 'terminal';
  record.captured = undefined; record.prepared = undefined;
  record.inventory.delete(record);
}
function clearPublication(record: TicketRecord): void {
  const publication = record.publication;
  record.publication = undefined;
  if (publication !== undefined) record.operations.clearBatchIfCurrent(publication);
}
function dispose(record: TicketRecord): void {
  markTerminal(record);
  clearPublication(record);
}
function observeRefusal(record: TicketRecord, cause: unknown): void {
  if (cause instanceof EgretError && cause.code === 'BITMAP_RESOURCE_BINDING_CHANGED') markTerminal(record, true);
  else if (cause instanceof EgretError && cause.code === 'OBJECT_DISPOSED') markTerminal(record);
}
/** Revalidate even thrown undefined before selecting a caller-read error. */
function callerRead<T>(read: () => T, code: string, revalidate: () => void): T {
  let value!: T, failed = false;
  let cause: unknown;
  try { value = read(); } catch (failure) { failed = true; cause = failure; }
  revalidate();
  if (failed) throw new EgretError(code, { cause });
  return value;
}
function snapshotArray(input: unknown, code: string, expected: number | undefined, revalidate: () => void): readonly unknown[] {
  if (!callerRead(() => IS_ARRAY(input), code, revalidate)) throw new EgretError(code);
  const array = input as readonly unknown[];
  const length = callerRead(() => array.length, code, revalidate);
  if (!Number.isInteger(length) || length < 1 || length > 128
    || (expected !== undefined && length !== expected)) throw new EgretError(code);
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index++) {
    if (!callerRead(() => APPLY(HAS_OWN, array, [index]) as boolean, code, revalidate)) throw new EgretError(code);
    snapshot.push(callerRead(() => array[index], code, revalidate));
  }
  return FREEZE(snapshot);
}
function prepare(record: TicketRecord, members: unknown): void {
  assertOperation(record, 'captured');
  let snapshot: readonly unknown[];
  record.reading = true;
  try {
    snapshot = snapshotArray(members, 'BITMAP_BINDING_MEMBERS_INVALID', record.count, () => assertAvailable(record));
  } finally { record.reading = false; }
  try {
    const prepared = record.operations.prepareBatch(record.captured!, snapshot as readonly AssetLease<Texture>[]);
    record.prepared = prepared; record.phase = 'prepared';
  } catch (cause) { observeRefusal(record, cause); throw cause; }
}
function commit(record: TicketRecord): void {
  assertOperation(record, 'prepared');
  try {
    const publication = record.operations.commitBatch(record.captured!, record.prepared!);
    // Runtime returns an already allocated publication; these writes call nobody.
    record.publication = publication;
    record.prepared = undefined; record.captured = undefined; record.phase = 'committed';
  } catch (cause) { observeRefusal(record, cause); throw cause; }
}
function handleFor(record: TicketRecord, handles: WeakMap<object, TicketRecord>): BitmapBindingTicket {
  const receiver = (value: unknown): void => {
    if (value !== handle) throw new EgretError('BITMAP_BINDING_INVALID');
  };
  const handle: BitmapBindingTicket = FREEZE({
    prepare(members: readonly AssetLease<Texture>[]): void { receiver(this); prepare(record, members); },
    commit(): void { receiver(this); commit(record); },
    dispose(): void { receiver(this); dispose(record); },
  });
  handles.set(handle, record);
  return handle;
}
export function createBitmapBindingOwner(context: BitmapBindingContext, targets: WeakMap<Bitmap, Operations>): BitmapBindingOwner {
  const inventory = new Set<TicketRecord>();
  // Exact handles point back to the sole existing record, including terminal records.
  const handles = new WeakMap<object, TicketRecord>();
  return FREEZE({
    capture(scope: unknown, input: unknown): BitmapBindingTicket {
      assertLifetime(context, scope);
      const snapshot = snapshotArray(input, 'BITMAP_BINDING_TARGETS_INVALID', undefined, () => assertLifetime(context, scope));
      const seen = new Set<unknown>();
      let operations: Operations | undefined;
      // All caller reads finished before authenticating final current targets.
      for (const target of snapshot) {
        const current = targets.get(target as Bitmap);
        if (current === undefined || seen.has(target) || (operations !== undefined && operations !== current)) {
          throw new EgretError('BITMAP_BINDING_TARGETS_INVALID');
        }
        seen.add(target); operations = current;
      }
      const captured = operations!.captureBatch(snapshot as readonly Bitmap[]);
      const record: TicketRecord = { context, scope, operations: operations!, inventory,
        phase: 'captured', conflict: false, reading: false, captured, prepared: undefined, publication: undefined, count: snapshot.length };
      const handle = handleFor(record, handles);
      inventory.add(record);
      try { APPLY(SCOPE_USE, scope, [handle]); }
      catch (cause) { dispose(record); throw cause; }
      return handle;
    },
    readPreparedForCapture(ticket: unknown) {
      context.assertOpen();
      const record = handles.get(ticket as object);
      if (record === undefined) throw new EgretError('BITMAP_BINDING_INVALID');
      assertOperation(record, 'prepared');
      return FREEZE({
        validate(): void { assertOperation(record, 'prepared'); },
        captureContent(stage: Stage): CapturedSharedContent2D {
          assertOperation(record, 'prepared');
          try { return record.operations.capturePreparedSharedContent(stage, record.captured!, record.prepared!); }
          catch (cause) { observeRefusal(record, cause); throw cause; }
        },
      });
    },
    close(): void {
      const records = [...inventory];
      // Every ticket is terminal before any matching publication is cleared.
      for (const record of records) markTerminal(record);
      for (const record of records) clearPublication(record);
    },
  });
}
