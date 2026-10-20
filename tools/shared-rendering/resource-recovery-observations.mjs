// SPDX-License-Identifier: Apache-2.0
// M1.5 C only: fixed actual-browser observations in one fresh isolated realm.
// No substitute device, Promise, decoder, clock, scheduler, result, or SDK hook.
const apply = Reflect.apply;
const getOwn = Object.getOwnPropertyDescriptor;
const define = Object.defineProperty;
const nativeThen = Promise.prototype.then;
const nativeNow = performance.now;
const timeReceiver = performance;
const now = () => apply(nativeNow, timeReceiver, []);
const fields = ['value', 'writable', 'get', 'set', 'enumerable', 'configurable'];
const sameDescriptor = (a, b) => a !== undefined && b !== undefined
  && fields.every(key => Object.hasOwn(a, key) === Object.hasOwn(b, key) && Object.is(a[key], b[key]));
const object = value => value !== null && (typeof value === 'object' || typeof value === 'function');
function requireValue(value, code) { if (!value) throw Error(code); }
function method(owner, key) {
  const descriptor = getOwn(owner, key);
  requireValue(descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function', 'C_NATIVE_METHOD_UNAVAILABLE:' + key);
  return { owner, key, original: descriptor.value, descriptor: Object.freeze({ ...descriptor }) };
}
function getter(owner, key) {
  const descriptor = getOwn(owner, key);
  requireValue(descriptor && typeof descriptor.get === 'function', 'C_NATIVE_GETTER_UNAVAILABLE:' + String(key));
  return descriptor.get;
}
function handle(promise, yes, no) {
  const observer = apply(nativeThen, promise, [yes, no]);
  apply(nativeThen, observer, [undefined, () => undefined]);
  return observer;
}

/** Existing PNG ports; every decode returns the exact captured native Promise. */
export function createNativePngObservation() {
  const nativeWindow = window;
  const nativeDocument = document;
  const decode = nativeWindow.createImageBitmap;
  const createElement = nativeDocument.createElement;
  requireValue(typeof decode === 'function' && typeof createElement === 'function', 'C_NATIVE_PNG_UNAVAILABLE');
  const rows = [], pending = new Set(), failures = [];
  let sequence = 0, armed, closed = false, overflow = false, untracked = false;
  function fail(code) { if (failures.length < 16) failures.push(code); else overflow = true; }
  function emit(row) { if (rows.length < 8192) rows.push(Object.freeze(row)); else overflow = true; }
  const ports = Object.freeze({
    decode(blob, options) {
      const id = ++sequence, issuedAt = now();
      let result;
      try { result = apply(decode, nativeWindow, [blob, options]); }
      catch (cause) { emit({ id, phase: 'native-threw', at: now(), issuedAt }); throw cause; }
      emit({ id, phase: 'native-returned', at: now(), issuedAt });
      // Record original actual settlement independently of prompt cancellation.
      if (pending.size >= 4) { overflow = true; untracked = true; fail('C_PNG_PENDING_OVERFLOW'); }
      else try {
        pending.add(result);
        handle(result,
          () => { pending.delete(result); emit({ id, phase: 'native-fulfilled', at: now() }); },
          () => { pending.delete(result); emit({ id, phase: 'native-rejected', at: now() }); });
      } catch { pending.delete(result); untracked = true; fail('C_PNG_PROMISE_OBSERVATION_FAILED'); }
      const cancellation = armed;
      if (cancellation !== undefined) {
        armed = undefined;
        emit({ id, phase: 'cancel-after-native-invocation', at: now(), label: cancellation.label });
        try { apply(cancellation.dispose, cancellation.group, []); }
        catch { fail('C_PNG_CANCEL_FAILED'); }
      }
      // Never replace this with the observation chain or a Promise.resolve result.
      return result;
    },
    createCanvas() { return apply(createElement, nativeDocument, ['canvas']); },
  });
  return Object.freeze({
    ports,
    armAfterDecodeGroup(group, label) {
      requireValue(!closed && armed === undefined && typeof label === 'string' && label.length <= 96, 'C_PNG_ARM_INVALID');
      // Only this fixture's genuine public ManifestAssetGroup is supplied.
      const disposal = getOwn(group, 'dispose');
      requireValue(disposal && typeof disposal.value === 'function', 'C_PNG_GROUP_DISPOSE_UNAVAILABLE');
      armed = { group, dispose: disposal.value, label };
    },
    disarm() { armed = undefined; },
    snapshot() { return { rows: [...rows], issued: sequence, pending: pending.size, untracked, overflow, failures: [...failures] }; },
    async whenIdle() { while (pending.size) await Promise.allSettled([...pending]); requireValue(!untracked, 'C_PNG_UNTRACKED_WORK'); },
    async drain() {
      closed = true; armed = undefined;
      while (pending.size) await Promise.allSettled([...pending]);
      requireValue(!untracked, 'C_PNG_UNTRACKED_WORK');
      return this.snapshot();
    },
  });
}

/** One Host's automatic acquisition only. Install before its first start. */
export function installOwnedRequestDeviceObservation() {
  requireValue(typeof GPUAdapter === 'function' && typeof GPUDevice === 'function', 'C_OWNED_GPU_OBSERVATION_UNAVAILABLE');
  const row = method(GPUAdapter.prototype, 'requestDevice');
  requireValue(row.descriptor.configurable, 'C_REQUEST_DEVICE_NOT_CONFIGURABLE');
  const destroy = method(GPUDevice.prototype, 'destroy').original;
  const lost = getter(GPUDevice.prototype, 'lost');
  const requests = [], devices = [], events = [], pendingRequests = new Set(), pendingLost = new Set(), failures = [], adapters = new WeakMap();
  let expectedRequests = 1, issuedRequests = 0, adapterIds = 0, untracked = false, stopped = false, restored = false, overflow = false;
  function fail(code) { if (failures.length < 32) failures.push(code); else overflow = true; }
  function event(value) { if (events.length < 256) events.push(Object.freeze(value)); else overflow = true; }
  function wrapped(...args) {
    const id = ++issuedRequests, at = now();
    if (id > 16) { overflow = true; untracked = true; fail('C_REQUEST_DEVICE_OVERFLOW'); }
    if (id > expectedRequests) fail('C_UNEXPECTED_GPU_ACQUISITION');
    if (stopped) fail('C_ACQUIRE_AFTER_CLOSE_STARTED');
    let adapterId = null;
    if (object(this)) { adapterId = adapters.get(this) ?? null; if (adapterId === null && adapterIds < 16) { adapterId = ++adapterIds; adapters.set(this, adapterId); } }
    const record = { id, adapterId, requestedAt: at, returned: false, settled: false, fulfilled: false };
    if (requests.length < 16) requests.push(record);
    let result;
    try { result = apply(row.original, this, args); }
    catch (cause) { record.settled = true; record.threw = true; record.settledAt = now(); throw cause; }
    record.returned = true;
    if (id > 16) return result; // Host still owns this exact untracked native promise.
    pendingRequests.add(result);
    try {
      handle(result, device => {
        pendingRequests.delete(result); record.settled = true; record.fulfilled = true; record.settledAt = now();
        if (devices.length >= 16) { overflow = true; fail('C_DEVICE_RETENTION_OVERFLOW'); return; }
        if (devices.some(value => value.device === device)) { fail('C_DEVICE_IDENTITY_REUSED'); return; }
        const acquired = { id, device, acquiredAt: record.settledAt, lossRequestedAt: null, lostAt: null, destroyedForLoss: false };
        devices.push(acquired);
        let promise;
        try { promise = apply(lost, device, []); }
        catch { fail('C_AUTHENTIC_LOST_UNAVAILABLE'); return; }
        acquired.lostPromise = promise; pendingLost.add(promise);
        try {
          handle(promise, () => {
            pendingLost.delete(promise); acquired.lostAt = now();
            event({ kind: 'authentic-lost', deviceId: id, at: acquired.lostAt, lossRequestedAt: acquired.lossRequestedAt });
          }, () => { pendingLost.delete(promise); fail('C_AUTHENTIC_LOST_REJECTED'); });
        } catch { pendingLost.delete(promise); untracked = true; fail('C_LOST_PROMISE_OBSERVATION_FAILED'); }
        event({ kind: 'device-acquired', deviceId: id, at: acquired.acquiredAt });
      }, () => { pendingRequests.delete(result); record.settled = true; record.settledAt = now(); fail('C_REQUEST_DEVICE_REJECTED'); });
    } catch { pendingRequests.delete(result); untracked = true; fail('C_REQUEST_PROMISE_OBSERVATION_FAILED'); }
    return result;
  }
  define(row.owner, row.key, { ...row.descriptor, value: wrapped });
  requireValue(getOwn(row.owner, row.key).value === wrapped, 'C_REQUEST_OBSERVER_INSTALL');
  function snapshot() {
    return { requests: requests.map(value => ({ ...value })), devices: devices.map(({ device, lostPromise, ...value }) => ({ ...value })),
      events: [...events], issuedRequests, adapterIds, selectedAdapterDetails: 'unavailable; no additional native getters observed', untracked, pendingRequests: pendingRequests.size, pendingLost: pendingLost.size, restored, overflow, failures: [...failures] };
  }
  return Object.freeze({
    snapshot,
    destroyArmedGeneration(deviceId) {
      requireValue(!stopped, 'C_LOSS_AFTER_CLOSE');
      const selected = devices.find(value => value.id === deviceId);
      requireValue(selected && !selected.destroyedForLoss && selected.lostAt === null, 'C_LOSS_GENERATION_UNAVAILABLE');
      // The fixed window calls this only after this generation's correct readback.
      selected.destroyedForLoss = true; selected.lossRequestedAt = now(); expectedRequests++;
      event({ kind: 'loss-requested', deviceId, at: selected.lossRequestedAt });
      return apply(destroy, selected.device, []);
    },
    markClosing() { stopped = true; },
    async drainAndRestore() {
      stopped = true;
      // Host remains the disposal owner; the observer never destroys cleanup devices.
      while (pendingRequests.size || pendingLost.size) await Promise.allSettled([...pendingRequests, ...pendingLost]);
      requireValue(!untracked, 'C_REQUEST_UNTRACKED_WORK_REQUIRES_REALM_DISPOSAL');
      requireValue(getOwn(row.owner, row.key).value === wrapped, 'C_REQUEST_OBSERVER_CHANGED');
      define(row.owner, row.key, row.descriptor);
      restored = sameDescriptor(getOwn(row.owner, row.key), row.descriptor);
      requireValue(restored, 'C_REQUEST_OBSERVER_RESTORE');
      const result = snapshot();
      devices.length = 0;
      return result;
    },
  });
}

/** GL pressure observes only two approved real methods, with no binding query. */
export function installGLPressureObservation() {
  requireValue(typeof WebGL2RenderingContext === 'function', 'C_GL_PRESSURE_UNAVAILABLE');
  return pressure('gl', [method(WebGL2RenderingContext.prototype, 'texSubImage2D'), method(WebGL2RenderingContext.prototype, 'deleteTexture')]);
}
/** GPU pressure observes only two approved real methods. */
export function installGPUPressureObservation() {
  requireValue(typeof GPUQueue === 'function' && typeof GPUTexture === 'function', 'C_GPU_PRESSURE_UNAVAILABLE');
  return pressure('gpu', [method(GPUQueue.prototype, 'writeTexture'), method(GPUTexture.prototype, 'destroy')]);
}
// Private implementation shared by exactly the four literal methods above.
// No caller-defined method list, realm, observer callback, or dynamic registration.
function pressure(backend, definitions) {
  const bytePrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const byteTag = getter(bytePrototype, Symbol.toStringTag);
  const byteBuffer = getter(bytePrototype, 'buffer');
  const byteOffset = getter(bytePrototype, 'byteOffset');
  const byteLength = getter(bytePrototype, 'byteLength');
  const bufferLength = getter(ArrayBuffer.prototype, 'byteLength');
  const rows = [], failures = [], ids = new WeakMap();
  let objects = 0, overflow = false, restored = false, active = 0, issued = 0, armedCancellation;
  const abort = AbortController.prototype.abort;
  function fail(code) { if (failures.length < 32) failures.push(code); else overflow = true; }
  function identity(value) {
    if (!object(value)) return null;
    if (ids.has(value)) return ids.get(value);
    if (objects === 4096) { overflow = true; return null; }
    const id = ++objects; ids.set(value, id); return id;
  }
  function bytes(value) {
    // Access only intrinsic typed-array metadata, never arbitrary argument properties.
    try {
      if (apply(byteTag, value, []) !== 'Uint8Array') return null;
      const buffer = apply(byteBuffer, value, []), offset = apply(byteOffset, value, []), length = apply(byteLength, value, []);
      apply(bufferLength, buffer, []);
      const prefix = Array.from(new Uint8Array(buffer, offset, Math.min(length, 4)));
      return { length, prefix };
    } catch { fail('C_PRESSURE_BYTE_OBSERVATION_FAILED'); return null; }
  }
  function ownData(value, key) {
    if (!object(value)) return undefined;
    const descriptor = getOwn(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  }
  for (const row of definitions) requireValue(row.descriptor.configurable, 'C_PRESSURE_NOT_CONFIGURABLE:' + row.key);
  const installed = [];
  try {
    for (const row of definitions) {
      row.wrapped = function (...args) {
        const sequence = ++issued, at = now(), receiverId = identity(this);
        active++;
        let result, threw = false;
        try { result = apply(row.original, this, args); }
        catch (cause) { threw = true; throw cause; }
        finally {
          // Observation failure cannot replace the original return value or exception.
          try {
            let detail;
            if (row.key === 'texSubImage2D') detail = { width: typeof args[4] === 'number' ? args[4] : null,
              height: typeof args[5] === 'number' ? args[5] : null, row: typeof args[3] === 'number' ? args[3] : null, source: bytes(args[8]) };
            else if (row.key === 'deleteTexture') detail = { textureId: identity(args[0]) };
            else if (row.key === 'writeTexture') detail = { textureId: identity(ownData(args[0], 'texture')), source: bytes(args[1]) };
            else detail = { textureId: receiverId };
            if (rows.length < 16384) rows.push(Object.freeze({ sequence, operation: row.key, at, returnedAt: now(), receiverId, threw, ...detail }));
            else overflow = true;
            if (!threw && armedCancellation && (row.key === 'texSubImage2D' || row.key === 'writeTexture')) {
              const cancellation = armedCancellation; armedCancellation = undefined;
              if (rows.length < 16384) rows.push(Object.freeze({ sequence, operation: 'cancel-after-native-upload', at: now(), label: cancellation.label }));
              else overflow = true;
              try { apply(abort, cancellation.controller, [cancellation.reason]); }
              catch { fail('C_PRESSURE_CANCEL_FAILED'); }
            }
          } catch { fail('C_PRESSURE_OBSERVATION_FAILED'); }
          active--;
        }
        return result;
      };
      define(row.owner, row.key, { ...row.descriptor, value: row.wrapped }); installed.push(row);
    }
  } catch (cause) {
    for (const row of installed.reverse()) define(row.owner, row.key, row.descriptor);
    throw cause;
  }
  function snapshot() { return { backend, rows: [...rows], issued, objects, active, restored, overflow, failures: [...failures] }; }
  return Object.freeze({
    snapshot,
    armAfterUpload(controller, reason, label) {
      requireValue(!restored && !armedCancellation && typeof label === 'string' && label.length <= 96, 'C_PRESSURE_ARM_INVALID');
      armedCancellation = { controller, reason, label };
    },
    disarm() { armedCancellation = undefined; },
    restoreAfterDrain() {
      // The fixed caller must first settle all Host records and close the Host.
      requireValue(active === 0, 'C_PRESSURE_CALL_STILL_ACTIVE'); armedCancellation = undefined;
      for (const row of definitions) requireValue(getOwn(row.owner, row.key).value === row.wrapped, 'C_PRESSURE_OBSERVER_CHANGED');
      for (const row of [...definitions].reverse()) define(row.owner, row.key, row.descriptor);
      restored = definitions.every(row => sameDescriptor(getOwn(row.owner, row.key), row.descriptor));
      requireValue(restored, 'C_PRESSURE_OBSERVER_RESTORE'); return snapshot();
    },
  });
}
