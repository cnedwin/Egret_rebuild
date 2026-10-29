// SPDX-License-Identifier: Apache-2.0
// Private draft destined for tests/manifest-byte-source.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, selection, context, transportFixture, baseUrl, bytes, egret, until, pending, refused, observe } from './manifest-browser-fixtures.mjs';

// The only interception authorized for this named file is this exact fetch
// descriptor. Native Web Crypto, clock, constructors and prototypes are intact.
async function controlled(body) {
  api();
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  assert.ok(saved && Object.hasOwn(saved, 'value') && typeof saved.value === 'function');
  const fixture = transportFixture();
  let primary, cleanup;
  Object.defineProperty(globalThis, 'fetch', { ...saved, value: fixture.fetch });
  try { await fixture.baseline(); await body(fixture); Object.defineProperty(globalThis, 'fetch', { ...saved, value: fixture.fetch }); fixture.route = undefined; await fixture.baseline(); }
  catch (cause) { primary = { cause }; }
  finally {
    try { await fixture.cleanup(); }
    catch (cause) { cleanup = { cause }; }
    Object.defineProperty(globalThis, 'fetch', saved);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'fetch'), saved);
  }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'MANIFEST_SOURCE_PRIMARY_AND_CLEANUP');
  if (primary) throw primary.cause;
  if (cleanup) throw cleanup.cause;
}
function check(name, body) { test(name, { timeout: 10000, concurrency: false }, () => controlled(body)); }

check('MBS01 exact optional public exports, genuine source profile and independent close', async f => {
  assert.deepEqual(Object.keys(api().browser).sort(), ['createManifestByteSource', 'createManifestContentLoader', 'createManifestTextureProvider']);
  const chosen = selection(), source = f.source(chosen), request = context();
  assert.equal(source.profile, 'manifest-sha256-browser-v1'); assert.equal(source.isClosed, false);
  assert.deepEqual([...await source.readBytes(chosen.bindings[0].ref, request.value)], [...bytes]);
  const closing = source.close(); assert.equal(source.close(), closing); await closing;
  assert.equal(source.isClosed, true);
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_SOURCE_CLOSED');
  assert.equal(Object.hasOwn(egret, 'createManifestByteSource'), false);
});

check('MBS02 counterfeit manifest/source/ref refuse before hostile getters or transport', async f => {
  let reads = 0;
  const hostile = new Proxy({}, { get() { reads++; throw new Error('hostile read'); } });
  const before = f.calls.length, chosen = selection(), source = f.source(chosen);
  assert.throws(() => api().browser.createManifestByteSource(hostile, hostile, hostile), { code: 'WEB_RESOURCE_MANIFEST_INVALID' });
  assert.throws(() => api().browser.createManifestTextureProvider(hostile, hostile), { code: 'WEB_RESOURCE_SOURCE_INVALID' });
  await refused(source.readBytes(hostile, hostile), 'WEB_RESOURCE_REF_INVALID');
  await refused(source.readBytes(egret.createAssetRef(chosen.type, chosen.bindings[0].ref.id), context().value), 'WEB_RESOURCE_REF_INVALID');
  assert.equal(reads, 0); assert.equal(f.calls.length, before);
});

check('MBS03 equal semantic genuine refs may read while duplicate/wrong-manifest bindings refuse', async f => {
  const chosen = selection(), equal = selection({ type: chosen.type }), foreignType = selection();
  const before = f.calls.length;
  assert.throws(() => api().browser.createManifestByteSource(chosen.manifest, [chosen.bindings[0], chosen.bindings[0]], { baseUrl }), { code: 'WEB_RESOURCE_BINDINGS_INVALID' });
  assert.throws(() => api().browser.createManifestByteSource(chosen.manifest, equal.bindings, { baseUrl }), { code: 'WEB_RESOURCE_BINDINGS_INVALID' });
  const source = f.source(chosen);
  await refused(source.readBytes(foreignType.bindings[0].ref, context().value), 'WEB_RESOURCE_REF_INVALID');
  assert.equal(f.calls.length, before);
  assert.deepEqual([...await source.readBytes(equal.bindings[0].ref, context().value)], [...bytes]);
  assert.notEqual(equal.bindings[0].ref, chosen.bindings[0].ref);
  assert.equal(equal.bindings[0].ref.id, chosen.bindings[0].ref.id);
});

for (const [label, options] of [
  ['zero deadline', { deadlineMs: 0 }], ['fractional deadline', { deadlineMs: 1.5 }],
  ['over-max deadline', { deadlineMs: 30001 }], ['infinite deadline', { deadlineMs: Infinity }],
  ['negative retry', { networkRetries: -1 }], ['two retries', { networkRetries: 2 }],
  ['explicit undefined', { deadlineMs: undefined }], ['extra port', { fetch() {} }],
  ['non-http base', { baseUrl: 'file:///project/' }], ['base query', { baseUrl: baseUrl + '?q=1' }],
  ['base credentials', { baseUrl: 'https://user:secret@resources.example.test/project/' }],
  ['base without directory slash', { baseUrl: 'https://resources.example.test/project' }],
  ['base fragment', { baseUrl: baseUrl + '#data' }], ['encoded separator', { baseUrl: 'https://resources.example.test/project%2fother/' }],
]) check('MBS04 finite options refuse ' + label + ' before fetch', async f => {
  const chosen = selection(), before = f.calls.length;
  assert.throws(() => api().browser.createManifestByteSource(chosen.manifest, chosen.bindings, { baseUrl, ...options }));
  assert.equal(f.calls.length, before);
});

check('MBS05 options getters never execute and declared input beyond 8 MiB refuses before fetch', async f => {
  const chosen = selection(); let reads = 0;
  const options = { baseUrl, get deadlineMs() { reads++; return 1000; } };
  const before = f.calls.length;
  assert.throws(() => api().browser.createManifestByteSource(chosen.manifest, chosen.bindings, options), { code: 'WEB_RESOURCE_OPTIONS_INVALID' });
  assert.equal(reads, 0);
  const over = selection({ mutate(input) { input.entries[0].artifact.byteLength = 8388609; } });
  await assert.rejects(async () => { const source = f.source(over); await source.readBytes(over.bindings[0].ref, context().value); }, { code: 'WEB_RESOURCE_INPUT_LIMIT' });
  assert.equal(f.calls.length, before);
});

check('MBS06 actual Web Crypto refuses corrupted bytes; metadata identity alone is insufficient', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), corrupt = new Uint8Array(bytes);
  corrupt[corrupt.length - 1] ^= 1;
  const before = f.calls.length;
  f.route = call => Promise.resolve(f.response(call.url, { payload: corrupt }));
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_INTEGRITY_MISMATCH');
  assert.equal(f.calls.length, before + 1, 'integrity failure never retries');
  f.route = undefined;
  assert.deepEqual([...await source.readBytes(chosen.bindings[0].ref, context().value)], [...bytes]);
});

check('MBS07 short actual stream refuses exact length before publication', async f => {
  const chosen = selection(), source = f.source(chosen), before = f.calls.length;
  f.route = call => Promise.resolve(f.response(call.url, { payload: bytes.subarray(0, bytes.length - 1) }));
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_LENGTH_MISMATCH');
  assert.equal(f.calls.length, before + 1);
});

check('MBS08 oversized chunks retain all four slots until actual cancel settlement', async f => {
  const chosen = selection(), source = f.source(chosen), cancels = [];
  const before = f.calls.length;
  f.route = call => {
    if (f.calls.length > before + 4) return Promise.resolve(f.response(call.url));
    const cancellation = f.hold(); cancels.push(cancellation);
    return Promise.resolve(f.response(call.url, { read: () => Promise.resolve({ done: false, value: new Uint8Array(bytes.length + 1) }), cancel: () => cancellation.promise }));
  };
  const first = Array.from({ length: 4 }, () => f.watch(source.readBytes(chosen.bindings[0].ref, context().value)));
  await until(() => cancels.length === 4 && f.responses.slice(-4).every(row => row.state.cancels === 1));
  const fifth = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  await pending(fifth, 'oversize cancellation still owns transport'); assert.equal(f.calls.length, before + 4);
  cancels[0].resolve(); await until(() => f.calls.length === before + 5);
  for (const cancel of cancels) cancel.resolve();
  for (const result of await Promise.all(first)) assert.equal(result.fulfilled, false);
  assert.equal((await fifth).fulfilled, true);
});

check('MBS09 headers do not free slots and cancel completion cannot refund pending original reads', async f => {
  const chosen = selection(), source = f.source(chosen), reads = [], cancels = [], requests = [];
  const before = f.calls.length;
  f.route = call => {
    if (f.calls.length > before + 4) return Promise.resolve(f.response(call.url));
    const read = f.hold({ done: true, value: undefined }), cancel = f.hold(); reads.push(read); cancels.push(cancel);
    return Promise.resolve(f.response(call.url, { read: () => read.promise, cancel: () => cancel.promise }));
  };
  for (let index = 0; index < 4; index++) { const request = context(); requests.push(request); f.watch(source.readBytes(chosen.bindings[0].ref, request.value)); }
  await until(() => reads.length === 4 && f.responses.slice(-4).every(row => row.state.reads === 1));
  const fifth = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  for (const request of requests) request.controller.abort('stop owned body');
  await until(() => f.responses.slice(-4).every(row => row.state.cancels === 1));
  for (const cancel of cancels) cancel.resolve();
  await pending(fifth, 'original reads still own capacity even after cancel settles'); assert.equal(f.calls.length, before + 4);
  for (const read of reads) read.resolve();
  assert.equal((await fifth).fulfilled, true); assert.equal(f.calls.length, before + 5);
});

check('MBS10 timeout promptly refuses publication but holds original fetch and close', async f => {
  const chosen = selection(), source = f.source(chosen, { deadlineMs: 40 });
  let fetch;
  f.route = call => { fetch = f.hold(f.response(call.url)); return fetch.promise; };
  const reading = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  const result = await reading; assert.equal(result.fulfilled, false); assert.equal(result.cause?.code, 'WEB_RESOURCE_DEADLINE_EXCEEDED');
  const closing = source.close(); assert.equal(source.close(), closing);
  await pending(closing, 'deadline is not original fetch settlement');
  assert.equal(f.calls.at(-1).options.signal.aborted, true);
  fetch.resolve(); await closing;
});

check('MBS11 128 queued operations are finite and cancelled queued work frees only queued capacity', async f => {
  const chosen = selection(), source = f.source(chosen, { deadlineMs: 5000 }), active = [], held = [];
  const before = f.calls.length;
  f.route = call => { if (f.calls.length > before + 4) return Promise.resolve(f.response(call.url)); const task = f.hold(f.response(call.url)); held.push(task); return task.promise; };
  for (let index = 0; index < 4; index++) { const request = context(); active.push(request); f.watch(source.readBytes(chosen.bindings[0].ref, request.value)); }
  await until(() => held.length === 4);
  const queued = Array.from({ length: 128 }, () => { const request = context(); const result = f.watch(source.readBytes(chosen.bindings[0].ref, request.value)); return { request, result }; });
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_QUEUE_LIMIT');
  assert.equal(f.calls.length, before + 4);
  for (const item of queued) item.request.controller.abort('remove queued');
  for (const result of await Promise.all(queued.map(item => item.result))) assert.equal(result.fulfilled, false);
  // Public cancellation precedes actual retirement of each queued async chain.
  // One event-loop turn drains only those CPU continuations; all four original
  // transport promises stay held and must continue to own network capacity.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(held.length, 4); assert.ok(held.every(task => !task.settled));
  assert.equal(f.calls.length, before + 4);
  const replacement = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  await pending(replacement, 'queued cancellation must not refund active original fetch');
  assert.equal(f.calls.length, before + 4); assert.ok(held.every(task => !task.settled));
  for (const request of active) request.controller.abort('cancel active');
  assert.equal(f.calls.length, before + 4);
  for (const task of held) task.resolve();
  assert.equal((await replacement).fulfilled, true); assert.equal(f.calls.length, before + 5);
});

check('MBS12 captured fetch and reader methods retain original receivers across mutation', async f => {
  const chosen = selection(), source = f.source(chosen), entered = f.hold({ done: false, value: new Uint8Array(bytes) });
  let response, steps = 0;
  f.route = call => { response = f.response(call.url, { read: () => steps++ === 0 ? entered.promise : Promise.resolve({ done: true, value: undefined }) }); return Promise.resolve(response); };
  const current = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  Object.defineProperty(globalThis, 'fetch', { ...current, value() { throw new Error('uncaptured fetch invoked'); } });
  try {
    const loading = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
    await until(() => f.responses.at(-1)?.response === response && f.responses.at(-1).state.reads === 1);
    const row = f.responses.at(-1);
    row.reader.read = () => { throw new Error('re-read mutable read method'); };
    row.reader.cancel = () => { throw new Error('re-read mutable cancel method'); };
    row.reader.releaseLock = () => { throw new Error('re-read mutable release method'); };
    entered.resolve();
    const result = await loading; assert.equal(result.fulfilled, true); assert.deepEqual([...result.value], [...bytes]);
    assert.equal(row.state.reads, 2); assert.equal(row.state.releases, 1);
  } finally { Object.defineProperty(globalThis, 'fetch', current); }
});

for (const [label, details] of [['redirected', { redirected: true }], ['outside directory', { finalUrl: 'https://resources.example.test/project-other/a.png' }], ['other origin', { finalUrl: 'https://elsewhere.example.test/project/a.png' }]]) {
  check('MBS13 final response ' + label + ' refuses before body read', async f => {
    const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), before = f.calls.length;
    f.route = call => Promise.resolve(f.response(call.url, details));
    await refused(source.readBytes(chosen.bindings[0].ref, context().value));
    assert.equal(f.calls.length, before + 1); assert.equal(f.responses.at(-1).state.reads, 0);
  });
}

check('MBS14 default retry is zero for actual captured transport rejection', async f => {
  const chosen = selection(), source = f.source(chosen), before = f.calls.length;
  f.route = () => Promise.reject(new TypeError('owned transport rejected'));
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_FETCH_FAILED');
  assert.equal(f.calls.length, before + 1);
});

check('MBS15 explicit one transport retry waits 100 ms and publishes checked bytes once', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), before = f.calls.length;
  f.route = call => f.calls.length === before + 1 ? Promise.reject(new TypeError('owned transient transport')) : Promise.resolve(f.response(call.url));
  assert.deepEqual([...await source.readBytes(chosen.bindings[0].ref, context().value)], [...bytes]);
  assert.equal(f.calls.length, before + 2);
  assert.ok(f.calls[before + 1].at - f.calls[before].at >= 99, '100 ms retry delay, allowing <1 ms timestamp/timer rounding');
});

check('MBS16 HTTP retry waits actual cancellation then delay; a local body TypeError never retries', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), cancel = f.hold();
  const before = f.calls.length;
  f.route = call => Promise.resolve(f.response(call.url, f.calls.length === before + 1 ? { status: 503, cancel: () => cancel.promise } : {}));
  const loading = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  await until(() => f.responses.at(-1)?.state.cancels === 1);
  await pending(loading, 'HTTP body cancellation remains actual work'); assert.equal(f.calls.length, before + 1);
  const cancelledAt = performance.now(); cancel.resolve(); assert.equal((await loading).fulfilled, true);
  assert.ok(f.calls.at(-1).at - cancelledAt >= 99);
  const localBefore = f.calls.length;
  f.route = call => Promise.resolve(f.response(call.url, { read: () => Promise.reject(new TypeError('body failure is not fetch rejection')) }));
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_BODY_FAILED');
  assert.equal(f.calls.length, localBefore + 1);
});

check('MBS17 retry cannot reset the original deadline or start an attempt after it', async f => {
  const chosen = selection(), source = f.source(chosen, { deadlineMs: 40, networkRetries: 1 }), before = f.calls.length;
  f.route = () => Promise.reject(new TypeError('transient but insufficient remaining time'));
  await refused(source.readBytes(chosen.bindings[0].ref, context().value));
  assert.equal(f.calls.length, before + 1);
});

for (const status of [408, 429, 500, 502, 503, 504]) {
  check('MBS18 only the named HTTP retry set includes ' + status, async f => {
    const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), before = f.calls.length;
    f.route = call => Promise.resolve(f.response(call.url, f.calls.length === before + 1 ? { status } : {}));
    assert.deepEqual([...await source.readBytes(chosen.bindings[0].ref, context().value)], [...bytes]);
    assert.equal(f.calls.length, before + 2);
  });
}
for (const status of [204, 301, 400, 404, 501]) {
  check('MBS19 status ' + status + ' never receives the transient retry', async f => {
    const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), before = f.calls.length;
    f.route = call => Promise.resolve(f.response(call.url, { status }));
    await refused(source.readBytes(chosen.bindings[0].ref, context().value));
    assert.equal(f.calls.length, before + 1);
  });
}
check('MBS20 explicit one retry never starts a third attempt', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), before = f.calls.length;
  f.route = () => Promise.reject(new TypeError('both owned attempts reject'));
  await refused(source.readBytes(chosen.bindings[0].ref, context().value));
  assert.equal(f.calls.length, before + 2);
});

check('MBS21 cancellation during retry delay prevents attempt two', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), request = context(), before = f.calls.length;
  f.route = () => Promise.reject(new TypeError('cancel before retry delay expires'));
  const loading = f.watch(source.readBytes(chosen.bindings[0].ref, request.value));
  await until(() => f.calls.length === before + 1);
  request.controller.abort('stop retry');
  assert.equal((await loading).fulfilled, false);
  await source.close();
  assert.equal(f.calls.length, before + 1);
});

check('MBS22 source returns fresh checked bytes without a second value cache', async f => {
  const chosen = selection(), source = f.source(chosen), before = f.calls.length;
  const first = await source.readBytes(chosen.bindings[0].ref, context().value);
  first.fill(0);
  const second = await source.readBytes(chosen.bindings[0].ref, context().value);
  assert.notEqual(second.buffer, first.buffer); assert.deepEqual([...second], [...bytes]);
  assert.equal(f.calls.length, before + 2, 'source does not substitute a retained unchecked/cache value');
});

check('MBS23 reentrant context admission cannot exceed four active plus 128 queued records', async f => {
  const chosen = selection(), source = f.source(chosen, { deadlineMs: 5000 }), inner = [], held = [];
  const before = f.calls.length, outer = context(); let reads = 0;
  f.route = call => { const task = f.hold(f.response(call.url)); held.push(task); return task.promise; };
  const reentrant = {
    get signal() {
      reads++;
      for (let index = 0; index < 132; index++) {
        const request = context(); inner.push(request);
        f.watch(source.readBytes(chosen.bindings[0].ref, request.value));
      }
      return outer.value.signal;
    },
    resourceGeneration: 1,
    taskId: 1,
  };
  await refused(source.readBytes(chosen.bindings[0].ref, reentrant), 'WEB_RESOURCE_QUEUE_LIMIT');
  assert.equal(reads, 1);
  await until(() => held.length === 4);
  assert.equal(f.calls.length, before + 4);
  await refused(source.readBytes(chosen.bindings[0].ref, context().value), 'WEB_RESOURCE_QUEUE_LIMIT');
  for (const request of inner) request.controller.abort('release bounded reentrant fixture');
  for (const task of held) task.resolve();
  await source.close();
  assert.equal(f.calls.length, before + 4, 'no over-capacity original request starts');
});

check('MBS24 binding array length is captured once before its bounded descriptor scan', async f => {
  const chosen = selection(); let lengthReads = 0;
  const bindings = new Proxy(chosen.bindings, {
    get(target, key, receiver) { if (key === 'length') lengthReads++; return Reflect.get(target, key, receiver); },
  });
  const source = f.source({ ...chosen, bindings });
  assert.equal(lengthReads, 1);
  assert.deepEqual([...await source.readBytes(chosen.bindings[0].ref, context().value)], [...bytes]);
  assert.equal(lengthReads, 1, 'async operations use the admitted immutable selection');
});

check('MBS25 portable artifact paths with internal spaces resolve to their encoded URL', async f => {
  const chosen = selection({ mutate(input) { input.entries[0].artifact.path = 'assets/with space.png'; } });
  const source = f.source(chosen), before = f.calls.length;
  assert.deepEqual([...await source.readBytes(chosen.bindings[0].ref, context().value)], [...bytes]);
  assert.equal(f.calls.length, before + 1);
  assert.equal(f.calls.at(-1).url, baseUrl + 'assets/with%20space.png');
});

check('MBS26 retry-status body cancellation claims ownership before synchronous source close', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1 }), cancellation = f.hold();
  const before = f.calls.length; let closing;
  f.route = call => Promise.resolve(f.response(call.url, { status: 503, cancel() {
    closing = source.close(); return cancellation.promise;
  } }));
  const loading = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  await until(() => closing !== undefined);
  assert.equal((await loading).fulfilled, false);
  assert.equal(f.responses.at(-1).state.cancels, 1, 'reentrant close cannot invoke body cancellation twice');
  await pending(closing, 'original cancellation still owns source close');
  cancellation.resolve(); await closing;
  assert.equal(f.calls.length, before + 1, 'close cannot start the status retry');
  assert.equal(f.responses.at(-1).state.cancels, 1);
});

check('MBS27 reader release reentry keeps newly started cancellation charged until settlement', async f => {
  const chosen = selection(), source = f.source(chosen), cancellation = f.hold(); let closing;
  f.route = call => {
    const response = f.response(call.url, { cancel: () => cancellation.promise });
    const row = f.responses.at(-1), release = row.reader.releaseLock;
    row.reader.releaseLock = function () { release.call(this); closing = source.close(); };
    return Promise.resolve(response);
  };
  const loading = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
  await until(() => closing !== undefined);
  assert.equal((await loading).fulfilled, false);
  const row = f.responses.at(-1);
  assert.equal(row.state.cancels, 1); assert.equal(row.state.releases, 1);
  await pending(closing, 'releaseLock reentry cannot detach a pending original cancel');
  cancellation.resolve(); await closing;
  assert.equal(row.state.cancels, 1); assert.equal(row.state.releases, 1);
});

check('MBS28 two maximum input reservations retain the source byte budget past public cancellation', async f => {
  const chosen = selection({ mutate(input) { input.entries[0].artifact.byteLength = 8_388_608; } });
  const source = f.source(chosen), held = [], requests = Array.from({ length: 3 }, () => context());
  const before = f.calls.length;
  f.route = call => { const task = f.hold(f.response(call.url)); held.push(task); return task.promise; };
  const loads = requests.map(request => f.watch(source.readBytes(chosen.bindings[0].ref, request.value)));
  await until(() => held.length === 2);
  await pending(loads[2], '2 x 8 MiB per original job consumes the 32 MiB source reservation');
  assert.equal(f.calls.length, before + 2);
  requests[0].controller.abort('public cancellation leaves original fetch ownership intact');
  assert.equal((await loads[0]).fulfilled, false);
  await pending(loads[2], 'public cancellation cannot refund the retained source reservation');
  assert.equal(held.length, 2);
  held[0].resolve();
  await until(() => held.length === 3);
  for (const request of requests) request.controller.abort('finish controlled reservation fixture');
  for (const task of held) task.resolve();
  for (const result of await Promise.all(loads)) assert.equal(result.fulfilled, false);
  await source.close();
});

check('MBS29 retry delays share the 128 waiting bound with all source queues', async f => {
  const chosen = selection(), source = f.source(chosen, { networkRetries: 1, deadlineMs: 5000 });
  const failures = [], retries = [], before = f.calls.length;
  f.route = call => {
    if (f.calls.length <= before + 132) return Promise.reject(new TypeError('owned first transport rejection'));
    const task = f.hold(f.response(call.url)); retries.push(task); return task.promise;
  };
  const loads = Array.from({ length: 132 }, () => {
    const result = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
    void result.then(value => { if (!value.fulfilled) failures.push(value.cause); });
    return result;
  });
  await until(() => failures.length === 4, '132 original records can retain at most 128 retry-delay waiters');
  assert.deepEqual(failures.map(value => value.code), Array(4).fill('WEB_RESOURCE_QUEUE_LIMIT'));
  const closing = source.close();
  for (const task of retries) task.resolve();
  await closing;
  for (const result of await Promise.all(loads)) assert.equal(result.fulfilled, false);
});

for (const unavailable of ['releaseLock', 'cancel']) {
  check('MBS30 acquired reader lock with throwing ' + unavailable + ' capture remains quarantined', async f => {
    const chosen = selection(), source = f.source(chosen);
    const cancellation = unavailable === 'releaseLock' ? f.hold() : undefined;
    let captures = 0, row;
    f.owners.find(value => value.owner === source).closeCode = 'WEB_RESOURCE_CLOSE_INCOMPLETE';
    f.route = call => {
      const response = f.response(call.url, { cancel: () => cancellation?.promise ?? Promise.resolve() });
      row = f.responses.at(-1);
      Object.defineProperty(row.reader, unavailable, { configurable: true, get() { captures++; throw undefined; } });
      return Promise.resolve(response);
    };
    const loading = f.watch(source.readBytes(chosen.bindings[0].ref, context().value));
    await until(() => captures === 1);
    assert.equal(row.state.reads, 0);
    if (cancellation) {
      assert.equal(row.state.cancels, 1);
      await pending(loading, 'captured cancellation still owns actual transport settlement');
    }
    const closing = source.close();
    if (cancellation) { await pending(closing, 'unknown lock retirement does not detach actual cancellation'); cancellation.resolve(); }
    assert.equal((await loading).fulfilled, false);
    const error = await refused(closing, 'WEB_RESOURCE_CLOSE_INCOMPLETE');
    assert.equal(error.cause, undefined); assert.deepEqual(error.cleanupErrors, [undefined]);
    assert.equal(row.state.releases, unavailable === 'cancel' ? 1 : 0);
    assert.equal(row.state.cancels, unavailable === 'releaseLock' ? 1 : 0);
    await refused(source.close(), 'WEB_RESOURCE_CLOSE_INCOMPLETE');
    assert.equal(captures, 1, 'unknown method capture is never retried');
  });
}

// C5 regression: keep the stream and source-created AbortSignal genuine. Only
// the already-authorized owned fetch supplies this response/underlying source.
async function nativeStreamCancellation(f, rejectCancellation) {
  const previousRoute = f.route, failures = [], events = [], listenerFailures = [];
  const chosen = selection(), request = context(), cancellation = f.hold();
  const intent = Error('cancel pending native-readable body');
  const cleanupFailure = Error('original native-readable cancel rejected');
  let source, stream, streamController, nativeSignal, abortListener, closing;
  let pulls = 0, cancellations = 0, cancellationReason;
  try {
    source = api().browser.createManifestByteSource(chosen.manifest, chosen.bindings, { baseUrl });
    f.route = call => {
      assert.ok(call.options.signal instanceof AbortSignal);
      nativeSignal = call.options.signal;
      stream = new ReadableStream({
        start(controller) { streamController = controller; },
        pull() { pulls++; },
        cancel(reason) {
          cancellations++; cancellationReason = reason; events.push('body-cancel');
          return cancellation.promise;
        },
      }, { highWaterMark: 0 });
      abortListener = () => {
        events.push('native-abort');
        // Fetch abort errors a still-readable response body. The genuine
        // controller ignores error() after genuine stream cancellation closes it.
        try { streamController.error(nativeSignal.reason); }
        catch (cause) { listenerFailures.push(cause); }
      };
      nativeSignal.addEventListener('abort', abortListener, { once: true });
      return Promise.resolve({ url: call.url, status: 200, redirected: false, body: stream });
    };
    const loading = f.watch(source.readBytes(chosen.bindings[0].ref, request.value));
    // HWM zero makes pull observable only after the product reader asks for data.
    await until(() => pulls === 1);
    assert.equal(stream.locked, true);
    request.controller.abort(intent);
    const publication = await loading;
    assert.equal(publication.fulfilled, false);
    assert.equal(publication.cause.code, 'WEB_RESOURCE_CANCELLED');
    assert.equal(publication.cause.cause, intent);
    assert.deepEqual(events, ['body-cancel', 'native-abort'],
      'MBS_NATIVE_BODY_CANCEL_MUST_PRECEDE_FETCH_ABORT');
    assert.equal(nativeSignal.aborted, true);
    assert.equal(nativeSignal.reason, publication.cause);
    assert.equal(cancellations, 1);
    assert.equal(cancellationReason, publication.cause);
    assert.deepEqual(listenerFailures, []);

    closing = source.close();
    void closing.catch(() => undefined);
    assert.equal(source.close(), closing);
    await pending(closing, 'original stream cancellation still owns close');
    assert.equal(stream.locked, true, 'release waits for original cancellation');
    const held = source.getStatus().current;
    assert.equal(held.activeNetwork, 1);
    assert.equal(held.encodedCreditBytes, 2 * bytes.length);
    assert.equal(held.ownedEncodedBytes, bytes.length);
    assert.equal(held.quarantinedJobs, 0);
    if (rejectCancellation) cancellation.reject(cleanupFailure);
    else cancellation.resolve();
    const outcome = await observe(closing);
    assert.equal(stream.locked, false, 'the original native reader lock is released');
    assert.equal(cancellations, 1);
    assert.deepEqual(events, ['body-cancel', 'native-abort']);
    assert.deepEqual(listenerFailures, []);
    const settled = source.getStatus().current;
    if (rejectCancellation) {
      assert.equal(outcome.fulfilled, false);
      assert.equal(outcome.cause.code, 'WEB_RESOURCE_CLOSE_INCOMPLETE');
      assert.equal(outcome.cause.cause, cleanupFailure);
      assert.deepEqual(outcome.cause.cleanupErrors, [cleanupFailure]);
      assert.equal(settled.jobs, 1);
      assert.equal(settled.activeNetwork, 1);
      assert.equal(settled.quarantinedJobs, 1);
      assert.equal(settled.encodedCreditBytes, 2 * bytes.length);
      assert.equal(settled.ownedEncodedBytes, bytes.length);
    } else {
      assert.equal(outcome.fulfilled, true, 'ordinary cancellation must close safely');
      assert.ok(Object.values(settled).every(value => value === 0));
    }
  } catch (cause) { failures.push(cause); }
  finally {
    // Always settle the test-owned operation before waiting for actual source
    // retirement, even when the assigned assertion failed against old behavior.
    try { request.controller.abort(intent); } catch (cause) { failures.push(cause); }
    cancellation.resolve();
    if (source) {
      try {
        closing ??= source.close();
        const outcome = await observe(closing);
        if (!outcome.fulfilled && !(rejectCancellation
          && outcome.cause?.code === 'WEB_RESOURCE_CLOSE_INCOMPLETE'
          && outcome.cause.cause === cleanupFailure
          && outcome.cause.cleanupErrors.length === 1
          && outcome.cause.cleanupErrors[0] === cleanupFailure)) failures.push(outcome.cause);
      } catch (cause) { failures.push(cause); }
    }
    try { if (nativeSignal && abortListener) nativeSignal.removeEventListener('abort', abortListener); }
    catch (cause) { failures.push(cause); }
    f.route = previousRoute;
    // controlled() already ran a genuine before-baseline. This complete restored
    // baseline must also run when the assigned refusal/order assertion failed.
    try { await f.baseline(); } catch (cause) { failures.push(cause); }
  }
  if (failures.length) throw new AggregateError(failures, 'MBS_NATIVE_STREAM_PRIMARY_AND_RESTORATION');
}

check('MBS31 genuine readable cancellation precedes fetch abort and awaits original cancel settlement',
  f => nativeStreamCancellation(f, false));
check('MBS32 genuine readable cancellation rejection remains quarantined with its exact cause',
  f => nativeStreamCancellation(f, true));
