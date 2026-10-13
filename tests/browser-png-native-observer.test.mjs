// SPDX-License-Identifier: Apache-2.0
// UNIT owners below model forwarding and descriptors; they are not native evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserPngNativeObserver } from '../tools/browser-png/native-observer.mjs';

const observe = promise => Promise.resolve(promise).then(
  value => ({ fulfilled: true, value }), cause => ({ fulfilled: false, cause }));
function attempt(body) {
  try { return { fulfilled: true, value: body() }; }
  catch (cause) { return { fulfilled: false, cause }; }
}
function finish(primary, cleanup) {
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'UNIT_PRIMARY_AND_CLEANUP_FAILED');
  if (primary) throw primary.cause;
  if (cleanup) throw cleanup.cause;
}
function deferred() {
  let resolvePromise, rejectPromise, settled = false;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve(value) { if (!settled) { settled = true; resolvePromise(value); } },
    reject(cause) { if (!settled) { settled = true; rejectPromise(cause); } } };
}
function unitRealm({ inherited = false, defineFault } = {}) {
  const calls = [], actions = new Map(), pending = [], canvases = new WeakMap();
  const bitmap = Object.create(null), pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
  const decoded = deferred(); pending.push(decoded);
  const image = { width: 2, height: 1, data: pixels };
  const bitmapPrototype = {}, canvasPrototype = {}, contextPrototype = {};
  const document = {}, realm = { document };
  function original(operation, fallback) {
    return function (...args) {
      calls.push({ operation, receiver: this, args });
      const action = actions.get(operation);
      return action ? action.call(this, args) : fallback.call(this, args);
    };
  }
  Object.defineProperty(realm, 'createImageBitmap', { configurable: true, enumerable: true, writable: true,
    value: original('decode', () => decoded.promise) });
  Object.defineProperty(bitmapPrototype, 'close', { configurable: true, enumerable: true, writable: true,
    value: original('bitmap-close', function () { this.closed++; }) });
  Object.defineProperty(document, 'createElement', { configurable: true, enumerable: true, writable: true,
    value: original('canvas-create', function (args) {
      assert.equal(this, realm.document);
      if (args[0] !== 'canvas') return { tag: args[0] };
      const canvas = Object.create(realm.HTMLCanvasElement.prototype);
      canvases.set(canvas, { width: 300, height: 150 });
      Object.defineProperty(canvas, 'parentNode', { value: null });
      return canvas;
    }) });
  for (const name of ['width', 'height']) Object.defineProperty(canvasPrototype, name, {
    configurable: true, enumerable: true,
    get() { return canvases.get(this)[name]; },
    set: original('canvas-' + name, function (args) { canvases.get(this)[name] = args[0]; }),
  });
  Object.defineProperty(contextPrototype, 'getImageData', { configurable: true, enumerable: true, writable: true,
    value: original('canvas-readback', () => image) });
  const descriptors = [
    ['decode', realm, 'createImageBitmap'], ['bitmap-close', bitmapPrototype, 'close'],
    ['canvas-create', document, 'createElement'], ['canvas-width', canvasPrototype, 'width'],
    ['canvas-height', canvasPrototype, 'height'], ['canvas-readback', contextPrototype, 'getImageData'],
  ];
  const owners = new Map(), groups = new Map();
  for (const row of descriptors) {
    if (!groups.has(row[1])) groups.set(row[1], []);
    groups.get(row[1]).push(row);
  }
  for (const [target, entries] of groups) {
    let owner = target;
    if (inherited) {
      const parent = {};
      for (const [, , key] of entries) {
        Object.defineProperty(parent, key, Object.getOwnPropertyDescriptor(target, key)); delete target[key];
      }
      Object.setPrototypeOf(target, parent);
    }
    if (defineFault) owner = new Proxy(target, {
      defineProperty(actual, property, descriptor) {
        const result = Reflect.defineProperty(actual, property, descriptor);
        const row = entries.find(([, , key]) => key === property);
        if (row) defineFault({ operation: row[0], key: property, descriptor, target: actual });
        return result;
      },
    });
    for (const [operation] of entries) owners.set(operation, owner);
  }
  function NativeBitmap() {}
  function NativeCanvas() {}
  function NativeContext() {}
  NativeBitmap.prototype = owners.get('bitmap-close');
  NativeCanvas.prototype = owners.get('canvas-width');
  NativeContext.prototype = owners.get('canvas-readback');
  const windowOwner = owners.get('decode');
  windowOwner.document = owners.get('canvas-create');
  windowOwner.ImageBitmap = NativeBitmap;
  windowOwner.HTMLCanvasElement = NativeCanvas;
  windowOwner.CanvasRenderingContext2D = NativeContext;
  Object.setPrototypeOf(bitmap, NativeBitmap.prototype);
  Object.assign(bitmap, { closed: 0, width: 2, height: 1 });
  const bindings = descriptors.map(([operation, , key]) => [operation, owners.get(operation), key]);
  const snapshot = () => bindings.map(([operation, owner, key]) => ({ operation, owner, key,
    descriptor: Object.getOwnPropertyDescriptor(owner, key) }));
  const baseline = snapshot();
  return { realm: windowOwner, bitmap, decoded, pixels, image, calls, actions, bindings, baseline,
    snapshot, pending, context(canvas) { return Object.assign(Object.create(NativeContext.prototype), { canvas }); },
    settleAll() { for (const ticket of pending) ticket.resolve(bitmap); } };
}
async function withObserver(body, { realmOptions, onRecord, maxRecords, expectedClose } = {}) {
  const fixture = unitRealm(realmOptions);
  let observer, primary, cleanup;
  try { observer = installBrowserPngNativeObserver({ realm: fixture.realm, onRecord, maxRecords }); await body(fixture, observer); }
  catch (cause) { primary = { cause }; }
  try {
    fixture.settleAll();
    if (observer) {
      const closed = await observe(observer.close());
      if (expectedClose) expectedClose(closed);
      else if (!closed.fulfilled) throw closed.cause;
    }
    assert.deepEqual(fixture.snapshot(), fixture.baseline, 'Every full own descriptor is restored');
  } catch (cause) { cleanup = { cause }; }
  finish(primary, cleanup);
}
async function sourceObjects(fixture) {
  const promise = fixture.realm.createImageBitmap({ source: 'UNIT Blob' }, { imageOrientation: 'from-image' });
  fixture.decoded.resolve(fixture.bitmap);
  assert.equal(await promise, fixture.bitmap);
  const canvas = fixture.realm.document.createElement('canvas');
  return { canvas, context: fixture.context(canvas) };
}
function invoke(operation, fixture, objects) {
  if (operation === 'decode') return fixture.realm.createImageBitmap({ blob: 'UNIT' }, { option: 'literal' });
  if (operation === 'bitmap-close') return fixture.bitmap.close();
  if (operation === 'canvas-create') return fixture.realm.document.createElement('canvas', { is: undefined });
  if (operation === 'canvas-width') { objects.canvas.width = 0; return undefined; }
  if (operation === 'canvas-height') { objects.canvas.height = 0; return undefined; }
  return objects.context.getImageData(0, 0, 2, 1, { colorSpace: 'srgb' });
}

test('UNIT six permitted operations preserve receiver, arguments, original Promise and values', async () => {
  await withObserver(async (fixture, observer) => {
    const blob = { type: 'image/png', size: 72 }, options = Object.freeze({ imageOrientation: 'from-image' });
    const promise = fixture.realm.createImageBitmap(blob, options);
    assert.equal(promise, fixture.decoded.promise);
    fixture.decoded.resolve(fixture.bitmap);
    assert.equal(await promise, fixture.bitmap);
    const canvas = fixture.realm.document.createElement('canvas'), context = fixture.context(canvas);
    assert.equal(context.getImageData(0, 0, 2, 1), fixture.image);
    assert.equal(fixture.bitmap.close(), undefined);
    canvas.width = 0; canvas.height = 0;
    assert.deepEqual(fixture.calls.map(call => call.operation),
      ['decode', 'canvas-create', 'canvas-readback', 'bitmap-close', 'canvas-width', 'canvas-height']);
    assert.equal(fixture.calls[0].receiver, fixture.realm);
    assert.deepEqual(fixture.calls[0].args, [blob, options]);
    assert.equal(fixture.calls[1].receiver, fixture.realm.document);
    assert.deepEqual(fixture.calls[1].args, ['canvas']);
    assert.equal(fixture.calls[2].receiver, context);
    assert.deepEqual(fixture.calls[2].args, [0, 0, 2, 1]);
    assert.equal(fixture.calls[3].receiver, fixture.bitmap);
    assert.equal(fixture.calls[4].receiver, canvas); assert.deepEqual(fixture.calls[4].args, [0]);
    assert.equal(fixture.calls[5].receiver, canvas); assert.deepEqual(fixture.calls[5].args, [0]);
    const records = observer.snapshot().records;
    assert.equal(records.find(row => row.operation === 'decode' && row.phase === 'returned').value, promise);
    assert.equal(records.find(row => row.operation === 'decode' && row.phase === 'fulfilled').value, fixture.bitmap);
    assert.equal(records.find(row => row.operation === 'canvas-readback').value, fixture.image);
    assert.ok(Object.isFrozen(records)); assert.ok(records.every(Object.isFrozen));
    assert.ok(records.every(row => row.args === undefined || Object.isFrozen(row.args)));
    const close = observer.close(); assert.equal(observer.close(), close);
    assert.equal((await close).restored, true);
    assert.deepEqual(fixture.snapshot(), fixture.baseline);
    const before = observer.snapshot().records.length;
    fixture.realm.document.createElement('canvas');
    assert.equal(observer.snapshot().records.length, before, 'Restored originals do not record');
  });
});

for (const operation of ['decode', 'bitmap-close', 'canvas-create', 'canvas-width', 'canvas-height', 'canvas-readback']) {
  for (const undefinedCause of [false, true]) test('UNIT ' + operation + ' forwards one original throw' + (undefinedCause ? ' undefined' : ' token'), async () => {
    await withObserver(async (fixture, observer) => {
      const objects = await sourceObjects(fixture);
      const cause = undefinedCause ? undefined : Object.freeze({ nativeFailure: operation });
      fixture.actions.set(operation, () => { throw cause; });
      const count = fixture.calls.filter(call => call.operation === operation).length;
      const result = attempt(() => invoke(operation, fixture, objects));
      assert.equal(result.fulfilled, false); assert.equal(result.cause, cause);
      assert.equal(fixture.calls.filter(call => call.operation === operation).length, count + 1);
      const record = observer.snapshot().records.at(-1);
      assert.equal(record.operation, operation); assert.equal(record.phase, 'threw');
      assert.ok(Object.hasOwn(record, 'cause')); assert.equal(record.cause, cause);
    });
  });
}

test('UNIT unrelated bitmaps, canvases and host readbacks forward without entering the source ledger', async () => {
  await withObserver(async (fixture, observer) => {
    const bitmap = Object.assign(Object.create(fixture.realm.ImageBitmap.prototype), { closed: 0 });
    const foreign = { width: 5, height: 7 };
    const context = fixture.context(foreign), count = observer.snapshot().records.length;
    bitmap.close();
    assert.equal(context.getImageData(0, 0, 1, 1), fixture.image);
    fixture.realm.document.createElement('div');
    assert.equal(bitmap.closed, 1);
    assert.equal(observer.snapshot().records.length, count);
  });
});

test('UNIT inherited operations use removable shadows and restore original inherited lookup', async () => {
  await withObserver(async (fixture, observer) => {
    const originalParents = fixture.bindings.map(([, owner]) => Object.getPrototypeOf(owner));
    assert.ok(fixture.baseline.every(row => row.descriptor === undefined));
    assert.ok(fixture.bindings.every(([, owner, key]) => Object.hasOwn(owner, key)));
    await sourceObjects(fixture);
    await observer.close();
    assert.ok(fixture.bindings.every(([, owner, key]) => !Object.hasOwn(owner, key)));
    assert.deepEqual(fixture.bindings.map(([, owner]) => Object.getPrototypeOf(owner)), originalParents);
  }, { realmOptions: { inherited: true } });
});

for (const rejected of [false, true]) test('UNIT close restores immediately and waits the original decode ' + (rejected ? 'rejection undefined' : 'fulfillment'), async () => {
  await withObserver(async (fixture, observer) => {
    const promise = fixture.realm.createImageBitmap({ blob: 'UNIT' });
    const originalOutcome = observe(promise);
    const close = observer.close(); let settled = false;
    const closeOutcome = observe(close).then(value => { settled = true; return value; });
    assert.deepEqual(fixture.snapshot(), fixture.baseline, 'Restoration precedes asynchronous settlement');
    await Promise.resolve(); assert.equal(settled, false);
    assert.equal(observer.snapshot().pendingDecodes, 1);
    if (rejected) fixture.decoded.reject(undefined); else fixture.decoded.resolve(fixture.bitmap);
    const result = await originalOutcome;
    assert.equal(result.fulfilled, !rejected);
    assert.equal(rejected ? result.cause : result.value, rejected ? undefined : fixture.bitmap);
    assert.equal((await closeOutcome).fulfilled, true);
    const completion = observer.snapshot().records.find(row => row.phase === (rejected ? 'rejected' : 'fulfilled'));
    assert.equal(completion.operation, 'decode');
    assert.equal(rejected ? completion.cause : completion.value, rejected ? undefined : fixture.bitmap);
    assert.equal(observer.snapshot().pendingDecodes, 0);
    assert.equal(fixture.bitmap.closed, 0, 'Observation does not take ownership of the returned bitmap');
  });
});

for (const nativeThrows of [false, true]) test('UNIT trace throw undefined preserves the original ' + (nativeThrows ? 'throw token' : 'successful value'), async () => {
  let armed = false;
  await withObserver(async (fixture, observer) => {
    const objects = await sourceObjects(fixture);
    const token = Object.freeze({ originalReadback: true });
    if (nativeThrows) fixture.actions.set('canvas-readback', () => { throw token; });
    armed = true;
    const outcome = attempt(() => invoke('canvas-readback', fixture, objects));
    assert.equal(outcome.fulfilled, !nativeThrows);
    assert.equal(nativeThrows ? outcome.cause : outcome.value, nativeThrows ? token : fixture.image);
    const closed = await observe(observer.close());
    assert.equal(closed.fulfilled, false); assert.equal(closed.cause, undefined);
    assert.deepEqual(observer.snapshot().failures, [undefined]);
    assert.deepEqual(fixture.snapshot(), fixture.baseline);
  }, { onRecord() { if (armed) throw undefined; }, expectedClose(result) { assert.equal(result.fulfilled, false); assert.equal(result.cause, undefined); } });
});

test('UNIT decode completion trace refusal does not change the original fulfilled Promise', async () => {
  await withObserver(async (fixture, observer) => {
    const promise = fixture.realm.createImageBitmap({ blob: 'UNIT' });
    assert.equal(promise, fixture.decoded.promise);
    fixture.decoded.resolve(fixture.bitmap);
    assert.equal(await promise, fixture.bitmap);
    const result = await observe(observer.close());
    assert.equal(result.fulfilled, false); assert.equal(result.cause, undefined);
    assert.equal(observer.snapshot().pendingDecodes, 0);
  }, { onRecord(record) { if (record.phase === 'fulfilled') throw undefined; },
    expectedClose(result) { assert.equal(result.fulfilled, false); assert.equal(result.cause, undefined); } });
});

test('UNIT decode observation uses the Promise intrinsic without reading a replaced then getter', async () => {
  await withObserver(async (fixture, observer) => {
    let reads = 0;
    Object.defineProperty(fixture.decoded.promise, 'then', { get() { reads++; throw undefined; } });
    const promise = fixture.realm.createImageBitmap({ blob: 'UNIT' });
    assert.equal(promise, fixture.decoded.promise);
    const originalOutcome = new Promise(resolve => Reflect.apply(Promise.prototype.then, promise,
      [value => resolve({ fulfilled: true, value }), cause => resolve({ fulfilled: false, cause })]));
    fixture.decoded.resolve(fixture.bitmap);
    const result = await originalOutcome;
    assert.equal(result.fulfilled, true); assert.equal(result.value, fixture.bitmap);
    await observer.close();
    assert.equal(reads, 0);
  });
});

test('UNIT readback classification throw undefined keeps the native result and fails the probe separately', async () => {
  await withObserver(async (fixture, observer) => {
    const objects = await sourceObjects(fixture);
    let reads = 0;
    Object.defineProperty(objects.context, 'canvas', { get() { reads++; throw undefined; } });
    assert.equal(objects.context.getImageData(0, 0, 2, 1), fixture.image);
    assert.equal(reads, 1);
    const result = await observe(observer.close());
    assert.equal(result.fulfilled, false); assert.equal(result.cause, undefined);
  }, { expectedClose(result) { assert.equal(result.fulfilled, false); assert.equal(result.cause, undefined); } });
});

test('UNIT an attached created canvas is never admitted as a transient source canvas', async () => {
  await withObserver(async (fixture, observer) => {
    const attached = Object.assign(Object.create(fixture.realm.HTMLCanvasElement.prototype), { parentNode: {} });
    fixture.actions.set('canvas-create', () => attached);
    assert.equal(fixture.realm.document.createElement('canvas'), attached);
    const result = await observe(observer.close());
    assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof TypeError);
    assert.equal(observer.snapshot().records.length, 0);
  }, { expectedClose(result) { assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof TypeError); } });
});

test('UNIT decode admission budget returns both original Promises but cannot report probe success', async () => {
  await withObserver(async (fixture, observer) => {
    const second = deferred(); fixture.pending.push(second);
    let calls = 0;
    fixture.actions.set('decode', () => calls++ === 0 ? fixture.decoded.promise : second.promise);
    const firstPromise = fixture.realm.createImageBitmap({ blob: 'first UNIT' });
    const secondPromise = fixture.realm.createImageBitmap({ blob: 'second UNIT' });
    const firstOutcome = observe(firstPromise), secondOutcome = observe(secondPromise);
    assert.equal(firstPromise, fixture.decoded.promise); assert.equal(secondPromise, second.promise);
    assert.equal(observer.snapshot().tickets.length, 1);
    fixture.decoded.resolve(fixture.bitmap);
    assert.equal((await firstOutcome).value, fixture.bitmap);
    const result = await observe(observer.close());
    assert.equal(result.fulfilled, false); assert.equal(result.cause.code, 'BIP_NATIVE_OBSERVER_TRACE_LIMIT');
    second.resolve(fixture.bitmap); assert.equal((await secondOutcome).value, fixture.bitmap);
  }, { maxRecords: 1, expectedClose(result) {
    assert.equal(result.fulfilled, false); assert.equal(result.cause.code, 'BIP_NATIVE_OBSERVER_TRACE_LIMIT');
  } });
});

for (const position of [0, 1, 2, 3, 4, 5]) test('UNIT installation fault after mutation at slot ' + position + ' restores every attempted descriptor', () => {
  const cause = position % 2 ? undefined : Object.freeze({ installationSlot: position });
  let installed = 0, armed = true;
  const fixture = unitRealm({ defineFault({ descriptor }) {
    if (!armed) return;
    // Installation replaces either a method value or setter with a wrapper.
    if (typeof descriptor.value === 'function' || typeof descriptor.set === 'function') {
      if (installed++ === position) { armed = false; throw cause; }
    }
  } });
  const result = attempt(() => installBrowserPngNativeObserver({ realm: fixture.realm }));
  assert.equal(result.fulfilled, false); assert.equal(result.cause, cause);
  assert.deepEqual(fixture.snapshot(), fixture.baseline);
});

test('UNIT installation primary undefined and cleanup token retain occurrence order', () => {
  const secondary = Object.freeze({ restorationFailure: true });
  let phase = 'install', installation = 0;
  const fixture = unitRealm({ defineFault({ operation }) {
    if (phase === 'install' && ++installation === 3) { phase = 'restore'; throw undefined; }
    if (phase === 'restore' && operation === 'bitmap-close') { phase = 'done'; throw secondary; }
  } });
  const result = attempt(() => installBrowserPngNativeObserver({ realm: fixture.realm }));
  assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof AggregateError);
  assert.deepEqual(result.cause.errors, [undefined, secondary]);
  assert.deepEqual(fixture.snapshot(), fixture.baseline, 'Even a restoring trap failure cannot skip other owners');
});

test('UNIT trace primary undefined precedes restoration token and every owner is attempted', async () => {
  const secondary = Object.freeze({ restorationFailure: true });
  let restoring = false, fired = false;
  await withObserver(async (fixture, observer) => {
    fixture.realm.document.createElement('canvas');
    restoring = true;
    const result = await observe(observer.close());
    assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof AggregateError);
    assert.deepEqual(result.cause.errors, [undefined, secondary]);
    assert.deepEqual(fixture.snapshot(), fixture.baseline);
  }, { realmOptions: { defineFault({ operation }) {
    if (restoring && !fired && operation === 'bitmap-close') { fired = true; throw secondary; }
  } }, onRecord() { throw undefined; }, expectedClose(result) {
    assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof AggregateError);
    assert.deepEqual(result.cause.errors, [undefined, secondary]);
  } });
});

test('UNIT trace budget preserves a later native setter and refuses probe success', async () => {
  await withObserver(async (fixture, observer) => {
    const canvas = fixture.realm.document.createElement('canvas');
    canvas.width = 0;
    assert.equal(canvas.width, 0);
    assert.equal(fixture.calls.filter(call => call.operation === 'canvas-width').length, 1);
    assert.equal(observer.snapshot().records.length, 1);
    const closed = await observe(observer.close());
    assert.equal(closed.fulfilled, false); assert.equal(closed.cause.code, 'BIP_NATIVE_OBSERVER_TRACE_LIMIT');
  }, { maxRecords: 1, expectedClose(result) {
    assert.equal(result.fulfilled, false); assert.equal(result.cause.code, 'BIP_NATIVE_OBSERVER_TRACE_LIMIT');
  } });
});

test('UNIT writable nonconfigurable method retains every descriptor flag through restoration', async () => {
  const fixture = unitRealm();
  Object.defineProperty(fixture.realm, 'createImageBitmap', { configurable: false });
  const baseline = fixture.snapshot();
  const observer = installBrowserPngNativeObserver({ realm: fixture.realm });
  let primary, cleanup;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(fixture.realm, 'createImageBitmap');
    assert.equal(descriptor.configurable, false); assert.equal(descriptor.writable, true);
  } catch (cause) { primary = { cause }; }
  try { fixture.settleAll(); await observer.close(); assert.deepEqual(fixture.snapshot(), baseline); }
  catch (cause) { cleanup = { cause }; }
  finish(primary, cleanup);
});

for (const fault of ['readonly-method', 'nonconfigurable-setter', 'accessor-method', 'nonextensible-shadow']) {
  test('UNIT preflight ' + fault + ' refuses before changing another operation', () => {
    const fixture = unitRealm({ inherited: fault === 'nonextensible-shadow' });
    let getterReads = 0;
    if (fault === 'readonly-method') Object.defineProperty(fixture.realm, 'createImageBitmap', { configurable: false, writable: false });
    if (fault === 'nonconfigurable-setter') Object.defineProperty(fixture.realm.HTMLCanvasElement.prototype, 'height', { configurable: false });
    if (fault === 'accessor-method') Object.defineProperty(fixture.realm, 'createImageBitmap', { configurable: true,
      get() { getterReads++; return fixture.baseline[0].descriptor.value; } });
    if (fault === 'nonextensible-shadow') Object.preventExtensions(fixture.realm.document);
    const before = fixture.snapshot();
    const result = attempt(() => installBrowserPngNativeObserver({ realm: fixture.realm }));
    assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof TypeError);
    assert.equal(getterReads, 0, 'Preflight inspects descriptors without invoking a method getter');
    assert.deepEqual(fixture.snapshot(), before);
  });
}

test('UNIT invalid recording options refuse before reading any supplied realm capability', () => {
  let reads = 0;
  const realm = new Proxy({}, { get() { reads++; throw new Error('UNEXPECTED_UNIT_REALM_READ'); } });
  for (const maxRecords of [0, -1, 1.5, Infinity, '2', 257]) {
    const result = attempt(() => installBrowserPngNativeObserver({ realm, maxRecords }));
    assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof TypeError);
  }
  const result = attempt(() => installBrowserPngNativeObserver({ realm, onRecord: 3 }));
  assert.equal(result.fulfilled, false); assert.ok(result.cause instanceof TypeError);
  assert.equal(reads, 0);
});
