// SPDX-License-Identifier: Apache-2.0
const promiseThen = Promise.prototype.then;
const objectLike = value => value !== null && (typeof value === 'object' || typeof value === 'function');
const descriptorKeys = ['value', 'writable', 'get', 'set', 'enumerable', 'configurable'];
function sameDescriptor(a, b) {
  if (a === undefined || b === undefined) return a === b;
  return descriptorKeys.every(key => Object.hasOwn(a, key) === Object.hasOwn(b, key) && Object.is(a[key], b[key]));
}
function descriptorCopy(value) { return value === undefined ? undefined : Object.freeze({ ...value }); }
function effectiveDescriptor(owner, key) {
  const visited = new Set();
  for (let current = owner; current !== null; current = Object.getPrototypeOf(current)) {
    if (visited.has(current) || visited.size === 64) throw new TypeError('BIP_NATIVE_OBSERVER_DESCRIPTOR_CHAIN');
    visited.add(current);
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor !== undefined) return { owner: current, descriptor };
  }
  throw new TypeError('BIP_NATIVE_OBSERVER_OPERATION_UNAVAILABLE');
}
function combine(occurrences) {
  if (occurrences.length === 1) return occurrences[0].cause;
  return new AggregateError(occurrences.map(row => row.cause), 'BIP_NATIVE_OBSERVER_PRIMARY_AND_CLEANUP_FAILED');
}
function traceLimit() {
  const error = new Error('BIP native observation capacity was exceeded.');
  Object.defineProperty(error, 'code', { value: 'BIP_NATIVE_OBSERVER_TRACE_LIMIT', enumerable: true });
  return error;
}

/**
 * Observe the six admitted native operations in one isolated origin window.
 * Omit realm for native admission; a supplied realm belongs only to UNIT controls.
 * No native global is read until this explicit installation call.
 */
export function installBrowserPngNativeObserver({ realm, onRecord, maxRecords = 64 } = {}) {
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 256 ||
      (onRecord !== undefined && typeof onRecord !== 'function')) {
    throw new TypeError('BIP_NATIVE_OBSERVER_OPTIONS');
  }
  const nativeWindow = realm === undefined ? globalThis.window : realm;
  if (!objectLike(nativeWindow)) throw new TypeError('BIP_NATIVE_OBSERVER_WINDOW_UNAVAILABLE');
  const document = nativeWindow.document;
  const bitmapPrototype = nativeWindow.ImageBitmap?.prototype;
  const canvasPrototype = nativeWindow.HTMLCanvasElement?.prototype;
  const contextPrototype = nativeWindow.CanvasRenderingContext2D?.prototype;
  const definitions = [
    ['decode', nativeWindow, 'createImageBitmap', 'method'],
    ['bitmap-close', bitmapPrototype, 'close', 'method'],
    ['canvas-create', document, 'createElement', 'method'],
    ['canvas-width', canvasPrototype, 'width', 'setter'],
    ['canvas-height', canvasPrototype, 'height', 'setter'],
    ['canvas-readback', contextPrototype, 'getImageData', 'method'],
  ];
  // Complete preflight precedes every write; accessors are never called to obtain methods.
  const rows = definitions.map(([operation, owner, key, kind]) => {
    if (!objectLike(owner)) throw new TypeError('BIP_NATIVE_OBSERVER_OWNER_UNAVAILABLE');
    const own = Object.getOwnPropertyDescriptor(owner, key), effective = effectiveDescriptor(owner, key);
    const original = kind === 'method' ? effective.descriptor.value : effective.descriptor.set;
    if (typeof original !== 'function' || (kind === 'method' && !Object.hasOwn(effective.descriptor, 'value')) ||
        (kind === 'setter' && Object.hasOwn(effective.descriptor, 'value'))) {
      throw new TypeError('BIP_NATIVE_OBSERVER_DESCRIPTOR_KIND');
    }
    if (own !== undefined && !own.configurable && (kind === 'setter' || !own.writable)) {
      throw new TypeError('BIP_NATIVE_OBSERVER_DESCRIPTOR_READONLY');
    }
    if (own === undefined && !Object.isExtensible(owner)) throw new TypeError('BIP_NATIVE_OBSERVER_SHADOW_UNAVAILABLE');
    return { operation, owner, key, kind, original, own: descriptorCopy(own),
      effectiveOwner: effective.owner, effective: descriptorCopy(effective.descriptor) };
  });
  const bindings = Object.freeze(rows.map(row => Object.freeze({ operation: row.operation, owner: row.owner,
    key: row.key, originalOwnDescriptor: row.own, effectiveOwner: row.effectiveOwner,
    originalEffectiveDescriptor: row.effective })));
  const attempted = [], records = [], tickets = [], probeFailures = [], cleanupFailures = [];
  const bitmaps = new WeakSet(), canvases = new WeakSet();
  let captureDisabled = false, activeCalls = 0, pendingDecodes = 0, closing = false;
  let finalized = false, restored = false, closePromise, resolveClose, rejectClose;
  function failProbe(cause) {
    // Latch one trace refusal, stop new recording, and keep already admitted tickets handled.
    if (!captureDisabled) { captureDisabled = true; probeFailures.push({ cause }); }
  }
  function emit(record) {
    if (captureDisabled) return;
    if (records.length === maxRecords) { failProbe(traceLimit()); return; }
    const frozen = Object.freeze({ sequence: records.length + 1, ...record,
      ...(record.args === undefined ? {} : { args: Object.freeze([...record.args]) }) });
    records.push(frozen);
    if (onRecord !== undefined) {
      try { onRecord(frozen); } catch (cause) { failProbe(cause); }
    }
  }
  function snapshot() {
    return Object.freeze({ state: finalized ? 'closed' : closing ? 'closing' : 'observing', restored,
      pendingDecodes, records: Object.freeze([...records]),
      failures: Object.freeze([...probeFailures, ...cleanupFailures].map(row => row.cause)),
      tickets: Object.freeze(tickets.map(ticket => Object.freeze({ id: ticket.id,
        originalPromise: ticket.originalPromise, observerPromise: ticket.observerPromise,
        settled: ticket.settled, ...(ticket.settled ? ticket.fulfilled ?
          { fulfilled: true, value: ticket.value } : { fulfilled: false, cause: ticket.cause } : {}) }))) });
  }
  function finalizeClose() {
    if (!closing || closePromise === undefined || finalized || activeCalls !== 0 || pendingDecodes !== 0) return;
    finalized = true;
    const failures = [...probeFailures, ...cleanupFailures];
    if (failures.length) rejectClose(combine(failures)); else resolveClose(snapshot());
  }
  function settle(ticket, fulfilled, value) {
    if (ticket.settled) return;
    ticket.settled = true; ticket.fulfilled = fulfilled;
    if (fulfilled) ticket.value = value; else ticket.cause = value;
    try {
      if (fulfilled && objectLike(value)) bitmaps.add(value);
      emit({ operation: 'decode', phase: fulfilled ? 'fulfilled' : 'rejected', decodeId: ticket.id,
        ...(fulfilled ? { value } : { cause: value }) });
    } catch (cause) { failProbe(cause); }
    finally { pendingDecodes--; finalizeClose(); }
  }
  function watchDecode(originalPromise) {
    if (captureDisabled) return undefined;
    if (tickets.length === maxRecords) { failProbe(traceLimit()); return undefined; }
    const ticket = { id: tickets.length + 1, originalPromise, observerPromise: undefined, settled: false };
    tickets.push(ticket); pendingDecodes++;
    try {
      // Do not assimilate, replace, await or return a wrapper for the native Promise.
      ticket.observerPromise = Reflect.apply(promiseThen, originalPromise, [
        value => settle(ticket, true, value), cause => settle(ticket, false, cause),
      ]);
      // Even an unexpected observation-handler rejection gets an immediate handled observer.
      Reflect.apply(promiseThen, ticket.observerPromise, [undefined, cause => {
        failProbe(cause);
        if (!ticket.settled) { ticket.settled = true; pendingDecodes--; }
        finalizeClose();
      }]);
    } catch (cause) {
      failProbe(cause); ticket.settled = true; ticket.fulfilled = false; ticket.cause = cause; pendingDecodes--;
    }
    return ticket.id;
  }
  function observeCall(row, receiver, args, outcome) {
    if (captureDisabled) return;
    let selected = row.operation === 'decode', decodeId;
    if (row.operation === 'bitmap-close') selected = objectLike(receiver) && bitmaps.has(receiver);
    if (row.operation === 'canvas-create') {
      selected = receiver === document && typeof args[0] === 'string' && args[0].toLowerCase() === 'canvas';
      if (selected && outcome.fulfilled) {
        if (!objectLike(outcome.value) || outcome.value.parentNode !== null) {
          throw new TypeError('BIP_NATIVE_OBSERVER_SOURCE_CANVAS_ATTACHED');
        }
        canvases.add(outcome.value);
      }
    }
    if (row.kind === 'setter') selected = objectLike(receiver) && canvases.has(receiver);
    if (row.operation === 'canvas-readback') {
      // Read only the original receiver's canvas metadata, after its operation has completed.
      const canvas = objectLike(receiver) ? receiver.canvas : undefined;
      selected = objectLike(canvas) && canvases.has(canvas);
    }
    if (!selected) return;
    if (row.operation === 'decode' && outcome.fulfilled) decodeId = watchDecode(outcome.value);
    emit({ operation: row.operation, phase: outcome.fulfilled ? 'returned' : 'threw', receiver, args,
      ...(decodeId === undefined ? {} : { decodeId }),
      ...(outcome.fulfilled ? { value: outcome.value } : { cause: outcome.cause }) });
  }
  function wrapper(row) {
    return function (...args) {
      const admitted = !closing;
      if (admitted) activeCalls++;
      let outcome;
      try { outcome = { fulfilled: true, value: Reflect.apply(row.original, this, args) }; }
      catch (cause) { outcome = { fulfilled: false, cause }; }
      if (admitted) {
        // A trace/classification failure cannot replace the native result or throw occurrence.
        try { observeCall(row, this, args, outcome); } catch (cause) { failProbe(cause); }
        finally { activeCalls--; finalizeClose(); }
      }
      if (!outcome.fulfilled) throw outcome.cause;
      return outcome.value;
    };
  }
  function restoreAll() {
    let verified = true;
    for (let index = attempted.length - 1; index >= 0; index--) {
      const row = attempted[index];
      try {
        if (row.own === undefined) {
          if (!Reflect.deleteProperty(row.owner, row.key)) throw new TypeError('BIP_NATIVE_OBSERVER_SHADOW_RESTORE');
        } else Object.defineProperty(row.owner, row.key, row.own);
      } catch (cause) { cleanupFailures.push({ cause }); }
      // Verification is attempted even when a restoring Proxy throws after the actual write.
      try {
        if (!sameDescriptor(Object.getOwnPropertyDescriptor(row.owner, row.key), row.own)) {
          throw new TypeError('BIP_NATIVE_OBSERVER_OWN_DESCRIPTOR_DRIFT');
        }
        const effective = effectiveDescriptor(row.owner, row.key);
        if (effective.owner !== row.effectiveOwner || !sameDescriptor(effective.descriptor, row.effective)) {
          throw new TypeError('BIP_NATIVE_OBSERVER_EFFECTIVE_DESCRIPTOR_DRIFT');
        }
      } catch (cause) { verified = false; cleanupFailures.push({ cause }); }
    }
    restored = verified;
  }
  function close() {
    if (closePromise !== undefined) return closePromise;
    closePromise = new Promise((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    closing = true;
    // Restore synchronously, including when admitted native work is still unsettled.
    restoreAll(); finalizeClose();
    return closePromise;
  }
  try {
    for (const row of rows) {
      const descriptor = { ...row.effective, ...(row.own === undefined ? { configurable: true } : {}) };
      if (row.kind === 'method') descriptor.value = wrapper(row); else descriptor.set = wrapper(row);
      // Register before writing: a failing write can mutate its owner before throwing undefined.
      attempted.push(row);
      Object.defineProperty(row.owner, row.key, descriptor);
    }
  } catch (cause) {
    closing = true; restoreAll();
    const failures = [{ cause }, ...probeFailures, ...cleanupFailures];
    throw combine(failures);
  }
  return Object.freeze({ bindings, snapshot, close });
}
