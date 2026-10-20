// SPDX-License-Identifier: Apache-2.0
// Private draft destined for tests/manifest-texture-provider.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { host } from './helpers.mjs';
import { api, selection, context, transportFixture, bytes, egret, controlledFixture, until, pending, refused, observe } from './manifest-browser-fixtures.mjs';

async function controlled(body) {
  api();
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  assert.ok(saved && Object.hasOwn(saved, 'value') && typeof saved.value === 'function');
  const fixture = transportFixture(); let primary, cleanup;
  Object.defineProperty(globalThis, 'fetch', { ...saved, value: fixture.fetch });
  try { await fixture.baseline(); await body(fixture); fixture.route = undefined; await fixture.baseline(); }
  catch (cause) { primary = { cause }; }
  finally {
    try { await fixture.cleanup(); } catch (cause) { cleanup = { cause }; }
    Object.defineProperty(globalThis, 'fetch', saved);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'fetch'), saved);
  }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'MANIFEST_PNG_PRIMARY_AND_CLEANUP');
  if (primary) throw primary.cause;
  if (cleanup) throw cleanup.cause;
}
function check(name, body) { test(name, { timeout: 10000, concurrency: false }, () => controlled(body)); }
async function setup(f, options = {}) {
  const chosen = selection(), source = f.source(chosen, options), png = controlledFixture(), provider = f.provider(source, png);
  const baseline = await f.load(provider, chosen.bindings[0].ref, context().value);
  assert.equal(egret.isTexture(baseline), true); provider.dispose(baseline); assert.equal(baseline.isDisposed, true);
  return { chosen, source, png, provider };
}

check('MTP01 fixed assembly returns the existing provider shape and ordinary PNG stays independent', async f => {
  const { chosen, provider } = await setup(f);
  assert.equal(provider.profile, 'png-rgb-rgba8-browser-normalized-v1');
  const value = await f.load(provider, chosen.bindings[0].ref, context().value);
  assert.equal(egret.isTexture(value), true); provider.dispose(value);
  const original = controlledFixture(), ordinary = f.own(createBrowserTextureProvider(original.options));
  const fetches = f.calls.length;
  const ordinaryValue = await f.load(ordinary, original.ref, original.context);
  assert.equal(f.calls.length, fetches, 'ordinary path never consults manifest transport');
  assert.equal(original.readerCalls.length, 1); assert.equal(original.decodeCalls.length, 1);
  ordinary.dispose(ordinaryValue); await ordinary.close();
});

check('MTP02 integrity failure refuses before decode and never retries the PNG or bytes', async f => {
  const { chosen, provider, png } = await setup(f, { networkRetries: 1 });
  const before = { fetch: f.calls.length, decode: png.decodeCalls.length };
  const corrupt = new Uint8Array(bytes); corrupt[corrupt.length - 1] ^= 1;
  f.route = call => Promise.resolve(f.response(call.url, { payload: corrupt }));
  await refused(f.load(provider, chosen.bindings[0].ref, context().value));
  assert.equal(f.calls.length, before.fetch + 1); assert.equal(png.decodeCalls.length, before.decode);
});

check('MTP03 four deadline-refused loads retain four occupied PNG jobs until original fetch settles', async f => {
  const { chosen, provider, png } = await setup(f, { deadlineMs: 80 });
  const before = { fetch: f.calls.length, decode: png.decodeCalls.length }, transports = [];
  f.route = call => { const held = f.hold(f.response(call.url)); transports.push(held); return held.promise; };
  const loads = Array.from({ length: 4 }, () => f.watch(f.load(provider, chosen.bindings[0].ref, context().value)));
  await until(() => transports.length === 4);
  for (const result of await Promise.all(loads)) { assert.equal(result.fulfilled, false); assert.equal(result.cause?.code, 'WEB_RESOURCE_DEADLINE_EXCEEDED'); }
  await refused(f.load(provider, chosen.bindings[0].ref, context().value), 'WEB_PNG_JOB_LIMIT');
  assert.equal(f.calls.length, before.fetch + 4); assert.equal(png.decodeCalls.length, before.decode);
  const closing = provider.close(); assert.equal(provider.close(), closing);
  await pending(closing, 'public deadline rejection is not original PNG-run settlement');
  for (const held of transports) held.resolve();
  await closing; assert.equal(png.decodeCalls.length, before.decode);
});

check('MTP04 two original decodes stay charged beyond deadline and late bitmaps retire once', async f => {
  const { chosen, source, provider, png } = await setup(f, { deadlineMs: 150 });
  const before = { decode: png.decodeCalls.length, canvas: png.canvases.length }, held = [], late = [];
  png.controls.decode = () => { const bitmap = png.makeBitmap(), task = f.hold(bitmap); late.push(bitmap); held.push(task); return task.promise; };
  const loads = Array.from({ length: 4 }, () => f.watch(f.load(provider, chosen.bindings[0].ref, context().value)));
  await until(() => held.length === 2);
  for (const result of await Promise.all(loads)) { assert.equal(result.fulfilled, false); assert.equal(result.cause?.code, 'WEB_RESOURCE_DEADLINE_EXCEEDED'); }
  assert.equal(png.decodeCalls.length, before.decode + 2);
  const secondPng = controlledFixture(), second = f.provider(source, secondPng);
  const blocked = f.watch(f.load(second, chosen.bindings[0].ref, context().value));
  const blockedResult = await blocked;
  assert.equal(blockedResult.fulfilled, false); assert.equal(blockedResult.cause?.code, 'WEB_RESOURCE_DEADLINE_EXCEEDED');
  assert.equal(secondPng.decodeCalls.length, 0);
  const closing = provider.close(); await pending(closing, 'original decoder completion owns provider close');
  for (const task of held) task.resolve();
  await closing;
  for (const bitmap of late) assert.equal(bitmap.closed, 1);
  assert.equal(png.canvases.length, before.canvas, 'cancelled late bitmaps never create a canvas');
  const delivered = await f.load(second, chosen.bindings[0].ref, context().value); second.dispose(delivered);
  assert.equal(secondPng.decodeCalls.length, 1); assert.equal(source.isClosed, false);
});

check('MTP05 shared source decode permits apply across two providers while provider close stays local', async f => {
  const { chosen, source, provider: first, png: a } = await setup(f);
  const b = controlledFixture(), second = f.provider(source, b), held = [], bitmaps = [];
  a.controls.decode = () => { const bitmap = a.makeBitmap(), task = f.hold(bitmap); bitmaps.push(bitmap); held.push(task); return task.promise; };
  const aLoads = [f.watch(f.load(first, chosen.bindings[0].ref, context().value)), f.watch(f.load(first, chosen.bindings[0].ref, context().value))];
  await until(() => held.length === 2);
  const bLoad = f.watch(f.load(second, chosen.bindings[0].ref, context().value));
  await pending(bLoad, 'second provider shares source decode capacity'); assert.equal(b.decodeCalls.length, 0);
  const closing = first.close(); await pending(closing, 'local close waits own original decodes');
  assert.equal(source.isClosed, false); assert.equal(second.isClosed, false);
  for (const task of held) task.resolve();
  for (const result of await Promise.all(aLoads)) assert.equal(result.fulfilled, false);
  await closing;
  const result = await bLoad; assert.equal(result.fulfilled, true); second.dispose(result.value);
  for (const bitmap of bitmaps) assert.equal(bitmap.closed, 1);
  const verified = await source.readBytes(chosen.bindings[0].ref, context().value);
  assert.deepEqual([...verified], [...bytes], 'metadata reader remains live after unrelated provider close');
});

check('MTP06 whole-job deadline includes queued fetch time and is not reset at decode admission', async f => {
  const { chosen, provider, png } = await setup(f, { deadlineMs: 220 });
  let originalRead, originalDecode, enteredAt;
  f.route = call => { originalRead = f.hold(f.response(call.url)); return originalRead.promise; };
  png.controls.decode = () => { originalDecode = f.hold(png.makeBitmap()); enteredAt = performance.now(); return originalDecode.promise; };
  const started = performance.now(), loading = f.watch(f.load(provider, chosen.bindings[0].ref, context().value));
  await new Promise(resolve => setTimeout(resolve, 130));
  originalRead.resolve();
  await until(() => enteredAt !== undefined);
  const result = await loading, refusedAt = performance.now();
  assert.equal(result.fulfilled, false); assert.equal(result.cause?.code, 'WEB_RESOURCE_DEADLINE_EXCEEDED');
  assert.ok(refusedAt - started >= 219, 'whole deadline does not fire early');
  assert.ok(refusedAt - enteredAt < 200, 'decode must not receive a new 220 ms budget');
  originalDecode.resolve();
  await provider.close(); assert.equal(png.bitmaps.at(-1).closed, 1);
});

check('MTP07 late unknown bitmap cleanup remains quarantined with its undefined cause', async f => {
  const { chosen, provider, png } = await setup(f, { deadlineMs: 100 });
  let task, late, closeAttempts = 0;
  png.controls.decode = () => { late = png.makeBitmap(); task = f.hold(late); return task.promise; };
  const loading = f.watch(f.load(provider, chosen.bindings[0].ref, context().value));
  await until(() => png.decodeCalls.length === 2);
  const result = await loading; assert.equal(result.fulfilled, false); assert.equal(result.cause?.code, 'WEB_RESOURCE_DEADLINE_EXCEEDED');
  const closing = provider.close(); await pending(closing, 'unknown late decoder still pending');
  Object.defineProperty(late, 'close', { configurable: true, value() { closeAttempts++; throw undefined; } });
  f.owners.find(item => item.owner === provider).closeCode = 'WEB_PNG_CLOSE_INCOMPLETE';
  task.resolve();
  const closeError = await refused(closing, 'WEB_PNG_CLOSE_INCOMPLETE');
  assert.equal(closeAttempts, 1); assert.equal(closeError.cause, undefined);
  assert.deepEqual(closeError.cleanupErrors, [undefined]);
  assert.equal(provider.close(), closing); await refused(provider.close(), 'WEB_PNG_CLOSE_INCOMPLETE');
  assert.equal(closeAttempts, 1, 'close repeats never retry unknown cleanup');
});

check('MTP08 source close revokes publication yet never destroys an already issued Texture', async f => {
  const { chosen, source, provider, png } = await setup(f);
  const issued = await f.load(provider, chosen.bindings[0].ref, context().value);
  let bitmap, task;
  png.controls.decode = () => { bitmap = png.makeBitmap(); task = f.hold(bitmap); return task.promise; };
  const loading = f.watch(f.load(provider, chosen.bindings[0].ref, context().value));
  await until(() => png.decodeCalls.length === 3);
  const closing = source.close(); assert.equal(source.close(), closing); assert.equal(source.isClosed, true);
  await pending(closing, 'source waits its original decode token');
  assert.equal(issued.isDisposed, false);
  task.resolve(bitmap); assert.equal((await loading).fulfilled, false); await closing;
  assert.equal(bitmap.closed, 1); assert.equal(issued.isDisposed, false);
  await provider.close(); assert.equal(issued.isDisposed, false);
  provider.dispose(issued); assert.equal(issued.isDisposed, true);
});

check('MTP09 same source/provider serves two genuine Engines with equal local task IDs independently', async f => {
  const chosen = selection(), source = f.source(chosen), png = controlledFixture(), provider = f.provider(source, png);
  const healthy = await f.load(provider, chosen.bindings[0].ref, context().value); provider.dispose(healthy);
  const captures = [], tasks = [], images = [], ports = [host(), host()], diagnostics = [];
  png.controls.decode = () => { const image = png.makeBitmap(), task = f.hold(image); images.push(image); tasks.push(task); return task.promise; };
  const engines = await Promise.all(ports.map(port => egret.createEngine({ host: port.adapter, onDiagnostic(value) { diagnostics.push(value); } })));
  for (const engine of engines) { f.own({ close: () => engine.dispose() }); engine.assets.register(chosen.type, {
    load(ref, originalContext) { captures.push(originalContext); return provider.load(ref, originalContext); },
    dispose(value) { provider.dispose(value); },
  }); }
  const first = new egret.CancellationController(), a = f.watch(engines[0].assets.acquire(chosen.bindings[0].ref, { signal: first.signal }));
  const b = f.watch(engines[1].assets.acquire(chosen.bindings[0].ref));
  await until(() => tasks.length === 2);
  assert.notEqual(captures[0], captures[1]);
  assert.deepEqual(captures.map(value => [value.resourceGeneration, value.taskId]), [[1, 1], [1, 1]]);
  first.abort('engine A only'); assert.equal((await a).fulfilled, false);
  assert.equal(captures[0].signal.aborted, true); assert.equal(captures[1].signal.aborted, false);
  tasks[0].resolve(); tasks[1].resolve();
  const second = await b; assert.equal(second.fulfilled, true);
  const texture = second.value.value; assert.equal(texture.isDisposed, false);
  second.value.release(); assert.equal(texture.isDisposed, true);
  await Promise.all(engines.map(engine => engine.dispose())); await provider.close();
  assert.equal(images[0].closed, 1); assert.equal(images[1].closed, 1);
  for (const port of ports) { assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0); }
  assert.deepEqual(diagnostics, []);
});

check('MTP10 decode rejection does not retry fetch and provider close preserves issued manager value', async f => {
  const { chosen, source, provider, png } = await setup(f, { networkRetries: 1 });
  const before = f.calls.length, cause = new TypeError('controlled native decode rejection');
  png.controls.decode = () => Promise.reject(cause);
  const error = await refused(f.load(provider, chosen.bindings[0].ref, context().value), 'WEB_PNG_DECODE_FAILED');
  assert.equal(error.cause, cause); assert.equal(f.calls.length, before + 1);
  png.controls.decode = undefined;
  const port = host(), engine = await egret.createEngine({ host: port.adapter });
  f.own({ close: () => engine.dispose() }); engine.assets.register(chosen.type, provider);
  const lease = await engine.assets.acquire(chosen.bindings[0].ref), texture = lease.value;
  await provider.close(); assert.equal(source.isClosed, false); assert.equal(texture.isDisposed, false);
  lease.release(); assert.equal(texture.isDisposed, true); await engine.dispose();
});

check('MTP11 one shared source bounds total queued operations across many providers at 128', async f => {
  const chosen = selection(), source = f.source(chosen, { deadlineMs: 5000 }), firstPng = controlledFixture();
  const first = f.provider(source, firstPng), held = [], late = [], failures = [];
  const before = f.calls.length;
  firstPng.controls.decode = () => {
    const bitmap = firstPng.makeBitmap(), task = f.hold(bitmap); late.push(bitmap); held.push(task); return task.promise;
  };
  const active = Array.from({ length: 2 }, () => f.watch(f.load(first, chosen.bindings[0].ref, context().value)));
  await until(() => held.length === 2);
  const followers = Array.from({ length: 33 }, () => {
    const png = controlledFixture(); return { png, provider: f.provider(source, png) };
  });
  const queued = Array.from({ length: 130 }, (_, index) => {
    const result = f.watch(f.load(followers[Math.floor(index / 4)].provider, chosen.bindings[0].ref, context().value));
    void result.then(value => { if (!value.fulfilled) failures.push(value.cause); });
    return result;
  });
  await until(() => failures.length === 2, '128 queued decode operations admit no further waiters', 3000);
  assert.deepEqual(failures.map(value => value.code), ['WEB_RESOURCE_QUEUE_LIMIT', 'WEB_RESOURCE_QUEUE_LIMIT']);
  assert.equal(f.calls.length, before + 132);
  assert.equal(followers.reduce((sum, value) => sum + value.png.decodeCalls.length, 0), 0);
  const closing = source.close(); await pending(closing, 'two original decodes still own shared source close');
  for (const task of held) task.resolve();
  await closing;
  for (const result of await Promise.all([...active, ...queued])) assert.equal(result.fulfilled, false);
  for (const bitmap of late) assert.equal(bitmap.closed, 1);
});

check('MTP12 fixed provider reserves its fourth job before context getters can re-enter admission', async f => {
  const chosen = selection(), source = f.source(chosen), png = controlledFixture(), provider = f.provider(source, png);
  const held = [], inner = [], request = context(); let reads = 0;
  f.route = call => { const task = f.hold(f.response(call.url)); held.push(task); return task.promise; };
  const original = f.watch(f.load(provider, chosen.bindings[0].ref, {
    get signal() {
      reads++;
      for (let index = 0; index < 4; index++) inner.push(f.watch(f.load(provider, chosen.bindings[0].ref, context().value)));
      return request.value.signal;
    },
    resourceGeneration: 1, taskId: 1,
  }));
  const overflow = await inner[3];
  assert.equal(overflow.fulfilled, false); assert.equal(overflow.cause.code, 'WEB_PNG_JOB_LIMIT');
  assert.equal(reads, 1);
  await until(() => held.length === 4);
  await pending(original, 'the original admission retained its provider job');
  const closing = provider.close(); await pending(closing, 'four original transports remain owned');
  for (const task of held) task.resolve();
  for (const result of await Promise.all([original, ...inner])) assert.equal(result.fulfilled, false);
  await closing;
});

check('MTP13 close during context capture waits for admission and listener retirement', async f => {
  const chosen = selection(), source = f.source(chosen), png = controlledFixture(), provider = f.provider(source, png);
  const request = context(), originalSignal = request.value.signal;
  let closing, closeSettled = false, retiredAfterClose; const before = f.calls.length;
  const signal = {
    get aborted() { return originalSignal.aborted; },
    get reason() { return originalSignal.reason; },
    addEventListener(...args) { return originalSignal.addEventListener(...args); },
    removeEventListener(...args) { retiredAfterClose = closeSettled; return originalSignal.removeEventListener(...args); },
  };
  const loading = f.watch(f.load(provider, chosen.bindings[0].ref, {
    get signal() {
      closing = provider.close(); void closing.then(() => { closeSettled = true; }); return signal;
    },
    resourceGeneration: 1, taskId: 1,
  }));
  assert.equal((await loading).fulfilled, false); await closing;
  assert.equal(retiredAfterClose, false, 'close cannot resolve before the admitted listener is retired');
  assert.equal(f.calls.length, before); assert.equal(source.isClosed, false);
});
