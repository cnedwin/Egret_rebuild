import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetManager, AssetLease, Bitmap, DisplayObject, EgretError,
  createAssetType, createAssetRef, copyImageData2DPixels, isTexture } from '@egret/engine';
import { REQUEST, ROW, EMPTY_ROW, OPTION_KEYS, PROVIDER_KEYS, REQUEST_KEYS,
  request, image, issue, literalProvider, entry, engineFixture, fixture,
  errorIs, rejected, keep, fulfilled, rejectedKept, release, assertImage, signal,
  poisonReads, readLog, deferred, flush } from './text-raster-public-helpers.mjs';

test('T03: authentic managers and cache receivers preserve existing Engine affinity', async (t) => {
  const create = await entry(), first = await engineFixture(t), second = await engineFixture(t);
  const literal = literalProvider(), counter = { reads: 0 };
  for (const assets of [{}, Object.create(AssetManager.prototype), new Proxy(first.engine.assets, {})]) {
    assert.throws(() => create(assets, poisonReads(OPTION_KEYS, counter)), errorIs('TEXT_ASSETS_INVALID'));
  }
  assert.equal(counter.reads, 0);
  const cache = create(first.engine.assets, { provider: literal.provider, maxResidentEntries: 0 });
  const other = create(second.engine.assets, { provider: literalProvider().provider, maxResidentEntries: 0 });
  t.after(() => { cache.dispose(); other.dispose(); });
  for (const receiver of [{}, new Proxy(cache, {})]) {
    for (const method of ['getStatus', 'invalidate', 'dispose']) {
      assert.throws(() => Reflect.apply(cache[method], receiver, []), errorIs('TEXT_CACHE_INVALID'));
    }
    await rejected(Reflect.apply(cache.acquire, receiver, [poisonReads(REQUEST_KEYS, counter)]), 'TEXT_CACHE_INVALID');
    await rejected(Reflect.apply(cache.whenIdle, receiver, []), 'TEXT_CACHE_INVALID');
  }
  assert.equal(counter.reads, 0);
  const prepared = await cache.acquire(request()), otherPrepared = await other.acquire(request());
  assert.ok(prepared.lease instanceof AssetLease); assertImage(otherPrepared);
  assert.throws(() => second.engine.createScope().use(cache), errorIs('ENGINE_MISMATCH'));
  assert.throws(() => second.engine.createScope().use(prepared.lease), errorIs('ENGINE_MISMATCH'));
  const bitmap = new Bitmap(prepared.lease);
  assert.throws(() => second.engine.stage.addChild(bitmap), errorIs('ENGINE_MISMATCH'));
  bitmap.dispose(); release(prepared); release(otherPrepared);
});

test('T04: complete ordered snapshots, exact getter causes and captured callbacks', async (t) => {
  const create = await entry(), base = await engineFixture(t), log = [];
  const literal = literalProvider(); let provider;
  for (const method of ['measure', 'rasterize', 'release']) {
    const original = literal.provider[method];
    literal.provider[method] = function (...args) {
      assert.equal(this, provider); return Reflect.apply(original, this, args);
    };
  }
  provider = readLog(literal.provider, PROVIDER_KEYS, log, 'p.');
  const values = { provider, maxResidentEntries: 0 };
  const cache = create(base.engine.assets, readLog(values, OPTION_KEYS, log, 'o.'));
  t.after(() => cache.dispose());
  assert.deepEqual(log, [...OPTION_KEYS.map((key) => 'o.' + key), ...PROVIDER_KEYS.map((key) => 'p.' + key)]);
  for (const method of ['measure', 'rasterize', 'release']) {
    literal.provider[method].call = () => { throw new Error('mutable own call must be ignored'); };
  }
  const prepared = await cache.acquire(request()); release(prepared);
  assert.equal(literal.state.measure, 1); assert.equal(literal.state.raster, 1); assert.equal(literal.state.release, 1);

  const cause = { phase: 'late-option-read' }, a = await engineFixture(t);
  const badOptions = readLog({ provider: literalProvider().provider, maxGenerations: 0 }, OPTION_KEYS, [], '', {
    maxPendingRasterBytes() { throw cause; },
  });
  assert.throws(() => create(a.engine.assets, badOptions), errorIs('TEXT_CACHE_OPTIONS_INVALID', cause));
  const cause2 = { phase: 'late-provider-read' }, b = await engineFixture(t);
  const badProvider = readLog({ ...literalProvider().provider, identity: '' }, PROVIDER_KEYS, [], '', {
    release() { throw cause2; },
  });
  assert.throws(() => create(b.engine.assets, { provider: badProvider, maxGenerations: 0 }), errorIs('TEXT_PROVIDER_INVALID', cause2));
  const c = await engineFixture(t), closeProvider = literalProvider();
  let closing;
  const closeOptions = readLog({ provider: closeProvider.provider }, OPTION_KEYS, [], '', {
    maxPendingRasterBytes() { closing = c.engine.dispose(); },
  });
  assert.throws(() => create(c.engine.assets, closeOptions), (error) => {
    errorIs('TEXT_CACHE_CLOSED')(error); errorIs('ASSET_MANAGER_CLOSED')(error.cause); return true;
  });
  await closing;
  assert.equal(closeProvider.state.measure, 0);

  const readCause = { phase: 'request-read' }, d = await fixture(t);
  const reads = [];
  await rejected(d.cache.acquire(readLog({ ...REQUEST, fontSize: 0 }, REQUEST_KEYS, reads, '', {
    fillColor() { throw readCause; },
  })), 'TEXT_REQUEST_INVALID', readCause);
  assert.deepEqual(reads, REQUEST_KEYS); assert.equal(d.state.measure, 0);
  const reentrantReads = { reads: 0 }, nested = [];
  const outer = readLog(REQUEST, REQUEST_KEYS, [], '', {
    text() {
      nested.push(keep(d.cache.acquire(poisonReads(REQUEST_KEYS, reentrantReads))));
      assert.throws(() => d.cache.invalidate(), errorIs('TEXT_CACHE_REENTRANT'));
    },
  });
  release(await d.cache.acquire(outer));
  await rejectedKept(nested[0], 'TEXT_CACHE_REENTRANT'); assert.equal(reentrantReads.reads, 0);
  const intrinsicBase = await engineFixture(t), intrinsicLiteral = literalProvider();
  const originals = new Map(['register', 'acquire', 'invalidate'].map((key) => [key, AssetManager.prototype[key]]));
  let poisonedCalls = 0, intrinsicCache;
  try {
    for (const key of originals.keys()) {
      AssetManager.prototype[key] = () => { poisonedCalls++; throw new Error('late public prototype replacement'); };
      intrinsicBase.engine.assets[key] = () => { poisonedCalls++; throw new Error('late public own replacement'); };
    }
    intrinsicCache = create(intrinsicBase.engine.assets, { provider: intrinsicLiteral.provider, maxResidentEntries: 0 });
    const genuine = await intrinsicCache.acquire(request()); assertImage(genuine);
    intrinsicCache.invalidate(); release(genuine); await intrinsicCache.whenIdle();
    assert.equal(poisonedCalls, 0);
  } finally {
    for (const [key, original] of originals) {
      AssetManager.prototype[key] = original; delete intrinsicBase.engine.assets[key];
    }
    intrinsicCache?.dispose();
  }
});

test('T05: factory preparation is reentrant-safe and committed lifetime cannot reopen', async (t) => {
  const create = await entry(), base = await engineFixture(t), literal = literalProvider();
  const reads = { reads: 0 };
  const options = readLog({ provider: literal.provider }, OPTION_KEYS, [], '', {
    provider() { assert.throws(() => create(base.engine.assets, poisonReads(OPTION_KEYS, reads)), errorIs('TEXT_CACHE_REENTRANT')); },
  });
  const cache = create(base.engine.assets, options); cache.dispose();
  assert.equal(reads.reads, 0);
  assert.throws(() => create(base.engine.assets, poisonReads(OPTION_KEYS, reads)), errorIs('TEXT_CACHE_ALREADY_CREATED'));
  assert.equal(reads.reads, 0);
  const retry = await engineFixture(t), exact = { retry: true };
  assert.throws(() => create(retry.engine.assets, { get provider() { throw exact; } }), errorIs('TEXT_CACHE_OPTIONS_INVALID', exact));
  const recovered = create(retry.engine.assets, { provider: literalProvider().provider, maxResidentEntries: 0 });
  t.after(() => recovered.dispose()); release(await recovered.acquire(request()));
});

test('T06: a genuine fixed-slot namespace collision preserves the foreign asset and consumes lifetime', async (t) => {
  const create = await entry(), base = await engineFixture(t), literal = literalProvider();
  const foreignType = createAssetType('t06.foreign', (value) => typeof value === 'string');
  const ref = createAssetRef(foreignType, 'egret.text-raster.t1.slot.00');
  let loads = 0;
  base.engine.assets.register(foreignType, { async load() { loads++; return 'foreign-kept'; }, dispose() {} });
  base.engine.assets.invalidate(ref);
  let failure;
  assert.throws(() => create(base.engine.assets, { provider: literal.provider }), (error) => {
    failure = error; errorIs('TEXT_CACHE_NAMESPACE_FAILED')(error);
    errorIs('ASSET_TYPE_MISMATCH')(error.cause); return true;
  });
  assert.ok(failure.cause instanceof EgretError);
  assert.equal(literal.state.measure, 0); assert.equal(literal.state.raster, 0);
  const reads = { reads: 0 };
  assert.throws(() => create(base.engine.assets, poisonReads(OPTION_KEYS, reads)), errorIs('TEXT_CACHE_ALREADY_CREATED'));
  assert.equal(reads.reads, 0);
  const lease = await base.engine.assets.acquire(ref); assert.equal(lease.value, 'foreign-kept');
  assert.equal(loads, 1); lease.release();
});

test('T07: 1024 genuine request retirements keep observable accounting bounded', async (t) => {
  const f = await fixture(t, {}, { maxResidentEntries: 0 });
  for (let index = 0; index < 1024; index++) {
    const prepared = await f.cache.acquire(request({ text: `churn-${index}` }));
    assertImage(prepared); release(prepared); await f.cache.whenIdle();
    const status = f.cache.getStatus();
    assert.ok(status.occupiedSlots <= 32); assert.equal(status.pendingJobs, 0);
    assert.equal(status.activeCallerLeases, 0); assert.equal(status.callerLeaseSlots, 0);
    assert.equal(status.liveImageBytes, 0); assert.equal(status.metadataBytes, 4096);
  }
  assert.equal(f.state.measure, 1024); assert.equal(f.state.raster, 1024); assert.equal(f.state.release, 1024);
});

test('T08: two live callers share deferred provider work and receive distinct genuine leases', async (t) => {
  const measureGate = deferred(), rasterGate = deferred(), measured = deferred(), rastered = deferred();
  const f = await fixture(t, {
    async measure(value, context) { measured.resolve(); await measureGate.promise; return issue(value, context); },
    async rasterize() { rastered.resolve(); return rasterGate.promise; },
  }, { maxResidentEntries: 0 });
  const a = signal(), b = signal();
  const first = keep(f.cache.acquire(request(), { signal: a.value }));
  const second = keep(f.cache.acquire(request(), { signal: b.value }));
  await measured.promise;
  assert.equal(f.state.measure, 1); assert.equal(f.cache.getStatus().pendingWaiters, 2);
  assert.equal(f.cache.getStatus().residentEntries, 0);
  measureGate.resolve(); await rastered.promise;
  assert.equal(f.state.raster, 1); assert.equal(f.state.release, 0);
  rasterGate.resolve(image());
  const one = await fulfilled(first), two = await fulfilled(second);
  assertImage(one); assertImage(two); assert.ok(one.lease instanceof AssetLease);
  assert.notEqual(one.lease, two.lease); assert.notEqual(one.lease.leaseId, two.lease.leaseId);
  assert.equal(one.lease.value, two.lease.value); assert.equal(one.lease.resourceGeneration, two.lease.resourceGeneration);
  assert.equal(f.state.release, 1); assert.equal(a.counters.remove, 1); assert.equal(b.counters.remove, 1);
  release(one); assert.ok(isTexture(two.lease.value)); release(two); await f.cache.whenIdle();
});

test('T09: all ten request fields and the explicit font generation participate in exact keys', async (t) => {
  const f = await fixture(t, {}, { maxResidentEntries: 0 });
  const values = [request(), request({ text: 'A ' }), request({ fontFamily: 'test' }),
    request({ fontSize: 17 }), request({ fontWeight: 401 }), request({ fontStyle: 'italic' }),
    request({ lineHeight: 11 }), request({ locale: 'en' }), request({ direction: 'rtl' }),
    request({ density: 1.5 }), request({ fillColor: 0 }), request({ text: 'a' })];
  const results = [];
  for (const value of values) results.push(await f.cache.acquire(value));
  assert.equal(f.state.measure, values.length);
  const same = await f.cache.acquire(request()); assert.equal(same.lease.value, results[0].lease.value);
  assert.equal(f.state.measure, values.length);
  const oldGeneration = f.cache.getStatus().fontGeneration; f.cache.invalidate();
  const replacement = await f.cache.acquire(request());
  assert.equal(replacement.request.fontGeneration, oldGeneration + 1);
  assert.notEqual(replacement.lease.value, results[0].lease.value);
  assert.equal(f.state.measure, values.length + 1);
  for (const result of [...results, same, replacement]) release(result);
});

test('T10: source lines preserve exact UTF-16 delimiter triples and trailing spaces', async (t) => {
  const f = await fixture(t, { blank: true }, { maxResidentEntries: 0 });
  const cases = [
    ['', [[0, 0, 0]]], ['A\n', [[0, 1, 2], [2, 2, 2]]],
    ['A\r', [[0, 1, 2], [2, 2, 2]]], ['A\r\n', [[0, 1, 3], [3, 3, 3]]],
    ['A\r\n\rB\n', [[0, 1, 3], [3, 3, 4], [4, 5, 6], [6, 6, 6]]],
    ['A  ', [[0, 3, 3]]],
  ];
  for (const [text, triples] of cases) {
    const result = await f.cache.acquire(request({ text }));
    assert.equal(result.kind, 'empty'); assert.equal(result.request.text, text);
    assert.deepEqual(result.request.sourceLines.map((line) => [line.start, line.end, line.breakEnd]), triples);
    assert.ok(Object.isFrozen(result.request)); assert.ok(Object.isFrozen(result.request.sourceLines));
    for (const line of result.request.sourceLines) assert.ok(Object.isFrozen(line));
  }
});

test('T11: admitted Unicode is preserved and every forbidden control interval is rejected before provider work', async (t) => {
  const f = await fixture(t, { blank: true }, { maxResidentEntries: 0 });
  for (const text of ['汉字', 'e\u0301', 'العربية', 'A\u200dB\u200cC', '\u2764\ufe0f', '\ud83d\ude00']) {
    const result = await f.cache.acquire(request({ text })); assert.equal(result.request.text, text);
  }
  const count = f.state.measure;
  const invalid = ['\ud800', '\udfff', 'A\ud800B', '\ud800\ud800', '\udfff\ud800'];
  for (let code = 0; code <= 0x1f; code++) if (code !== 10 && code !== 13) invalid.push(String.fromCharCode(code));
  for (let code = 0x7f; code <= 0x9f; code++) invalid.push(String.fromCharCode(code));
  for (const [start, end] of [[0x2028, 0x2029], [0x202a, 0x202e], [0x2066, 0x2069]]) {
    for (let code = start; code <= end; code++) invalid.push(String.fromCharCode(code));
  }
  for (const text of invalid) await rejected(f.cache.acquire(request({ text })), 'TEXT_REQUEST_INVALID');
  assert.equal(f.state.measure, count);
});

test('T12: exact public source limits admit endpoints and reject the next reachable value', async (t) => {
  const f = await fixture(t, { blank: true }, { maxResidentEntries: 0 });
  const locale64 = 'en-' + [...Array(6).fill('abcdefgh'), 'abcdefg'].join('-');
  assert.equal(locale64.length, 64);
  for (const changes of [{ text: 'A'.repeat(8192) }, { text: '\n'.repeat(63) },
    { fontFamily: 'F'.repeat(256) }, { locale: locale64 }]) {
    const result = await f.cache.acquire(request(changes)); assert.equal(result.kind, 'empty');
  }
  const count = f.state.measure;
  for (const changes of [{ text: 'A'.repeat(8193) }, { text: '\n'.repeat(64) },
    { fontFamily: 'F'.repeat(257) }, { locale: locale64 + 'h' }]) {
    await rejected(f.cache.acquire(request(changes)), 'TEXT_REQUEST_LIMIT');
  }
  assert.equal(f.state.measure, count);
});

test('T13: request and configuration numeric endpoints are exact and never silently clamped', async (t) => {
  const f = await fixture(t, { blank: true }, { maxResidentEntries: 0 });
  const valid = { fontSize: [1, 512], fontWeight: [1, 1000], lineHeight: [1, 1024],
    density: [0.5, 4], fillColor: [0, 0xffffff, -0], fontStyle: ['normal', 'italic'],
    direction: ['ltr', 'rtl'], locale: ['und', 'en-US'], fontFamily: ['Test', '汉字'] };
  for (const [key, values] of Object.entries(valid)) for (const value of values) {
    const result = await f.cache.acquire(request({ [key]: value }));
    assert.equal(result.request[key], value === 0 ? 0 : value);
    if (key === 'fillColor' && value === 0) assert.equal(Object.is(result.request.fillColor, -0), false);
  }
  const invalid = { fontSize: [0, 512.01, NaN, Infinity, -Infinity],
    fontWeight: [0, 1001, 1.5, NaN, Infinity], lineHeight: [0, 1024.01, NaN, Infinity],
    density: [0.49, 4.01, NaN, Infinity], fillColor: [-1, 0x1000000, 0.5, NaN, Infinity],
    fontStyle: ['', 'oblique', null], direction: ['', 'auto', null],
    locale: ['', 'e', 'en_', 'en--US', '中文'], fontFamily: ['', 'A\nB', '\ud800'] };
  const count = f.state.measure;
  for (const [key, values] of Object.entries(invalid)) for (const value of values) {
    await rejected(f.cache.acquire(request({ [key]: value })), 'TEXT_REQUEST_INVALID');
  }
  assert.equal(f.state.measure, count);
  const limits = { maxGenerations: [1, 64], maxPendingJobs: [1, 4], maxWaiters: [1, 128],
    maxCallerLeases: [1, 128], maxResidentEntries: [0, 32], maxMetadataBytes: [4096, 2097152],
    maxLogicalImageBytes: [1, 16777216], maxPendingRasterBytes: [1, 8388608] };
  const create = await entry();
  for (const [key, [min, max]] of Object.entries(limits)) {
    for (const value of [undefined, min, max]) {
      const base = await engineFixture(t), literal = literalProvider();
      const cache = create(base.engine.assets, { provider: literal.provider, [key]: value });
      assert.equal(literal.state.measure, 0); cache.dispose();
    }
    for (const value of [null, NaN, Infinity, -Infinity, min - 1, max + 1, min + 0.5]) {
      const base = await engineFixture(t), literal = literalProvider();
      assert.throws(() => create(base.engine.assets, { provider: literal.provider, [key]: value }), errorIs('TEXT_CACHE_OPTIONS_INVALID'));
      assert.equal(literal.state.measure, 0);
    }
  }
  for (const changes of [{ identity: '' }, { identity: 'bad identity' }, { identity: 'x'.repeat(65) },
    { profile: 'different' }, { measure: 1 }, { rasterize: null }, { release: undefined }]) {
    const base = await engineFixture(t);
    assert.throws(() => create(base.engine.assets, { provider: { ...literalProvider().provider, ...changes } }), errorIs('TEXT_PROVIDER_INVALID'));
  }
});

test('T14: literal signed ink geometry has exact density 1 and 1.5 raster placement', async (t) => {
  const f = await fixture(t, {}, { maxResidentEntries: 0 });
  for (const [density, placement, bytes, scratch] of [
    [1, { pixelLeft: -3, pixelTop: -1, width: 12, height: 10, byteLength: 480,
      density: 1, x: -3, y: -1, logicalWidth: 12, logicalHeight: 10 }, 480, 960],
    [1.5, { pixelLeft: -4, pixelTop: -1, width: 17, height: 14, byteLength: 952,
      density: 1.5, x: -8 / 3, y: -2 / 3, logicalWidth: 34 / 3, logicalHeight: 28 / 3 }, 952, 1904],
  ]) {
    const result = await f.cache.acquire(request({ density })); assertImage(result);
    assert.deepEqual(result.metrics.logicalBounds, { x: 0, y: 0, width: 8, height: 10 });
    assert.deepEqual(result.metrics.inkBounds, { x: -1, y: 1, width: 8, height: 6 });
    assert.deepEqual(result.metrics.contentBounds, { x: -1, y: 0, width: 9, height: 10 });
    assert.deepEqual(result.metrics.raster, placement);
    assert.equal(f.state.rasterContexts.at(-1).reservedImageBytes, bytes);
    assert.equal(f.state.rasterContexts.at(-1).reservedScratchBytes, scratch);
    const bitmap = new Bitmap(result.lease); f.engine.stage.addChild(bitmap);
    const frame = f.engine.captureFrame({ width: 32, height: 32 });
    assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].kind, 'image');
    assert.equal(frame.images[frame.commands[0].imageIndex], result.lease.value.imageData);
    f.engine.stage.removeChild(bitmap); bitmap.dispose(); release(result);
  }
});

test('T15: no-ink layout retains whitespace without a lease and enforces raster-result kind', async (t) => {
  const f = await fixture(t, { blank: true }, { maxResidentEntries: 0 });
  const result = await f.cache.acquire(request({ text: '  ' }));
  assert.equal(result.kind, 'empty'); assert.equal('lease' in result, false);
  assert.deepEqual(result.metrics.logicalBounds, { x: 0, y: 0, width: 8, height: 10 });
  assert.deepEqual(result.metrics.contentBounds, result.metrics.logicalBounds);
  assert.equal(result.metrics.inkBounds, undefined); assert.equal(result.metrics.raster, undefined);
  assert.equal(f.state.raster, 1); assert.equal(f.state.release, 1);
  assert.equal(f.state.rasterContexts[0].reservedImageBytes, 0);
  assert.equal(f.state.rasterContexts[0].reservedScratchBytes, 0);
  assert.equal(f.cache.getStatus().activeCallerLeases, 0); assert.equal(f.cache.getStatus().callerLeaseSlots, 0);
  const blankImage = await fixture(t, { blank: true, async rasterize() { return image(); } });
  await rejected(blankImage.cache.acquire(request()), 'TEXT_RASTER_RESULT_INVALID'); assert.equal(blankImage.state.release, 1);
  const inkUndefined = await fixture(t, { async rasterize() { return undefined; } });
  await rejected(inkUndefined.cache.acquire(request()), 'TEXT_RASTER_RESULT_INVALID'); assert.equal(inkUndefined.state.release, 1);
});

test('T16: forged, foreign and replayed plans have no issuer authority or foreign release', async (t) => {
  let poisonReadsCount = 0;
  const forged = { get request() { poisonReadsCount++; throw new Error('forged request read'); },
    get metrics() { poisonReadsCount++; throw new Error('forged metrics read'); } };
  for (const returned of [forged, new Proxy(forged, { get(target, key, receiver) {
    // Promise resolution may inspect then; public plan fields remain poisoned.
    if (key === 'then') return undefined;
    if (key === 'request' || key === 'metrics') { poisonReadsCount++; throw new Error('proxy plan field read'); }
    return Reflect.get(target, key, receiver);
  } })]) {
    const f = await fixture(t, { async measure() { return returned; } });
    await rejected(f.cache.acquire(request()), 'TEXT_PLAN_INVALID');
    assert.equal(f.state.release, 0); assert.equal(f.state.raster, 0);
  }
  assert.equal(poisonReadsCount, 0);
  const a = await fixture(t, {}, { maxResidentEntries: 0 });
  const one = await a.cache.acquire(request()), prior = a.state.plans[0]; release(one);
  const b = await fixture(t, { async measure() { return prior; } });
  await rejected(b.cache.acquire(request()), 'TEXT_PLAN_INVALID'); assert.equal(b.state.release, 0);
  let ownPlan;
  const c = await fixture(t, { async measure(value, context) { ownPlan = issue(value, context); return prior; } });
  await rejected(c.cache.acquire(request()), 'TEXT_PLAN_INVALID');
  assert.deepEqual(c.state.released, [ownPlan]); assert.equal(a.state.release, 1);
  let replay;
  const d = await fixture(t, { async measure(value, context) {
    if (replay) return replay; replay = issue(value, context); return replay;
  } }, { maxResidentEntries: 0 });
  release(await d.cache.acquire(request()));
  await rejected(d.cache.acquire(request({ text: 'B' })), 'TEXT_PLAN_INVALID'); assert.equal(d.state.release, 1);
  const publicFailure = new EgretError('TEXT_PLAN_INVALID');
  const e = await fixture(t, { async measure() { throw publicFailure; } });
  await rejected(e.cache.acquire(request()), 'TEXT_MEASURE_FAILED', publicFailure);
});

test('T17: plan capabilities issue once, close on measure settlement and survive logical cancellation until terminal', async (t) => {
  let createPlan;
  const a = await fixture(t, { async measure(value, context) {
    createPlan = context.createPlan; const plan = issue(value, context);
    assert.throws(() => issue(value, context), errorIs('TEXT_PLAN_ALREADY_CREATED')); return plan;
  } }, { maxResidentEntries: 0 });
  release(await a.cache.acquire(request()));
  assert.throws(() => createPlan({ baselineOffset: 5, lines: [{ ...ROW }] }), errorIs('TEXT_PLAN_SCOPE_CLOSED'));
  const gate = deferred(), entered = deferred(), cancellation = signal(); let latePlan;
  const b = await fixture(t, { async measure(value, context) {
    entered.resolve(); await gate.promise; latePlan = issue(value, context); return latePlan;
  } }, { maxResidentEntries: 0 });
  const reason = { cancel: 'late-own-plan' }, pending = keep(b.cache.acquire(request(), { signal: cancellation.value }));
  await entered.promise; cancellation.abort(reason); await rejectedKept(pending, 'TEXT_ACQUIRE_CANCELLED', reason);
  assert.equal(b.state.release, 0); assert.equal(b.cache.getStatus().pendingJobs, 1);
  gate.resolve(); await b.cache.whenIdle();
  assert.deepEqual(b.state.released, [latePlan]); assert.equal(b.state.raster, 0);
});

test('T21: demand, reservations, raster settlement, plan release and genuine delivery have ordered terminals', async (t) => {
  const measureGate = deferred(), rasterGate = deferred(), entered = deferred(), rastered = deferred();
  let cache, rasterContext;
  const f = await fixture(t, {
    async measure(value, context, state) {
      const status = cache.getStatus();
      assert.equal(status.pendingJobs, 1); assert.equal(status.pendingWaiters, 1);
      assert.equal(status.callerLeaseSlots, 1); assert.equal(status.activeCallerLeases, 0);
      assert.equal(status.residentEntries, 0); assert.equal(status.metadataBytes, 4964);
      entered.resolve(); await measureGate.promise;
      state.events.push('measure-terminal'); return issue(value, context);
    },
    async rasterize(plan, context, state) {
      rasterContext = context;
      assert.equal(context.reservedImageBytes, 480); assert.equal(context.reservedScratchBytes, 960);
      const status = cache.getStatus(); assert.equal(status.reservedImageBytes, 480);
      assert.equal(status.pendingRasterBytes, 960); assert.equal(status.activeCallerLeases, 0);
      assert.equal(status.residentEntries, 0); rastered.resolve();
      const output = await rasterGate.promise; state.events.push('raster-terminal'); return output;
    },
    release(plan, state) { assert.equal(state.events.at(-2), 'raster-terminal'); },
  }, { maxResidentEntries: 1 });
  cache = f.cache;
  const pending = keep(cache.acquire(request())); await entered.promise;
  assert.equal(pending.settled, false); measureGate.resolve(); await rastered.promise;
  assert.equal(f.state.release, 0); assert.equal(pending.settled, false);
  assert.ok(Object.isFrozen(rasterContext)); rasterGate.resolve(image());
  const prepared = await fulfilled(pending);
  f.state.events.push('public-delivery'); assertImage(prepared);
  assert.deepEqual(f.state.events, ['measure', 'measure-terminal', 'raster', 'raster-terminal', 'release', 'public-delivery']);
  assert.equal(prepared.lease.value.imageData, f.state.images[0]); await cache.whenIdle();
  const ready = cache.getStatus(); assert.equal(ready.pendingJobs, 0); assert.equal(ready.pendingRasterBytes, 0);
  assert.equal(ready.reservedImageBytes, 0); assert.equal(ready.liveImageBytes, 480);
  assert.equal(ready.activeCallerLeases, 1); assert.equal(ready.residentEntries, 1); release(prepared);
});

test('T22: measure failures release only the own issued plan, once, after settlement and through terminal reentry', async (t) => {
  for (const mode of ['throw', 'reject', 'wrong-return']) {
    const cause = { measure: mode }, wrong = {}, gate = deferred(), entered = deferred();
    let own, cache, nested;
    const f = await fixture(t, {
      async measure(value, context, state) {
        own = issue(value, context); entered.resolve(); await gate.promise; state.events.push('measure-terminal');
        if (mode === 'wrong-return') return wrong;
        if (mode === 'reject') return Promise.reject(cause);
        throw cause;
      },
      release(plan, state) {
        assert.equal(plan, own); assert.equal(state.events.at(-2), 'measure-terminal');
        cache.dispose(); cache.dispose();
        assert.throws(() => cache.invalidate(), errorIs('TEXT_CACHE_CLOSED'));
        nested = keep(cache.acquire(request({ text: 'reentry' })));
      },
    }, { maxResidentEntries: 0 });
    cache = f.cache; const pending = keep(cache.acquire(request())); await entered.promise;
    assert.equal(f.state.release, 0); gate.resolve();
    if (mode === 'wrong-return') await rejectedKept(pending, 'TEXT_PLAN_INVALID');
    else await rejectedKept(pending, 'TEXT_MEASURE_FAILED', cause);
    await rejectedKept(nested, 'TEXT_CACHE_CLOSED'); await cache.whenIdle();
    assert.deepEqual(f.state.released, [own]); assert.equal(f.state.raster, 0);
    assert.equal(cache.getStatus().closed, true);
  }
});

test('T23: release failure preserves the primary cause, quarantines unproved charges and rejects idle', async (t) => {
  for (const rasterFails of [false, true]) {
    const rasterCause = { raster: 'primary' }, releaseCause = { release: 'cleanup' };
    const f = await fixture(t, {
      async rasterize() { if (rasterFails) throw rasterCause; return image(); },
      release() { throw releaseCause; },
    }, { maxGenerations: 1, maxResidentEntries: 0 });
    const failure = await rejected(f.cache.acquire(request()),
      rasterFails ? 'TEXT_RASTER_FAILED' : 'TEXT_PLAN_RELEASE_FAILED', rasterFails ? rasterCause : releaseCause);
    if (rasterFails) assert.ok(failure.cleanupErrors.includes(releaseCause));
    assert.equal(f.state.release, 1);
    await rejected(f.cache.whenIdle(), 'TEXT_CACHE_CLEANUP_FAILED', releaseCause);
    const status = f.cache.getStatus();
    assert.equal(status.pendingJobs, 0); assert.equal(status.quarantinedGenerations, 1);
    assert.equal(status.retiredGenerations, 1); assert.equal(status.cleanupFailureCount, 1);
    assert.equal(status.quarantinedImageBytes, 480); assert.equal(status.quarantinedRasterBytes, 960);
    assert.equal(status.liveImageBytes + status.reservedImageBytes, 480);
    assert.equal(status.pendingRasterBytes, 960); assert.equal(status.metadataBytes, 4772);
    await rejected(f.cache.acquire(request({ text: 'B' })), 'TEXT_CACHE_BUDGET');
    assert.equal(f.state.measure, 1); f.cache.dispose();
    assert.equal(f.cache.getStatus().quarantinedGenerations, 1); assert.equal(f.state.release, 1);
    const owned = f.diagnostics.filter((item) => item.cause === releaseCause);
    assert.equal(owned.length, 1); assert.equal(owned[0].phase, 'assets');
  }
});

test('T24: preaborted and malformed signals fail before request reads and listener installation', async (t) => {
  const f = await fixture(t), reads = { reads: 0 }, reason = { signal: 'already-aborted' }, order = [];
  const aborted = { get aborted() { order.push('aborted'); return true; },
    get reason() { order.push('reason'); return reason; },
    get addEventListener() { throw new Error('must not read aborted add'); },
    get removeEventListener() { throw new Error('must not read aborted remove'); } };
  await rejected(f.cache.acquire(poisonReads(REQUEST_KEYS, reads), { signal: aborted }), 'TEXT_ACQUIRE_CANCELLED', reason);
  assert.deepEqual(order, ['aborted', 'reason']); assert.equal(reads.reads, 0);
  for (const key of ['addEventListener', 'removeEventListener']) {
    const exact = { signalRead: key }, active = { aborted: false, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(active, key, { get() { throw exact; } });
    await rejected(f.cache.acquire(poisonReads(REQUEST_KEYS, reads), { signal: active }), 'TEXT_SIGNAL_FAILED', exact);
  }
  for (const abortedValue of [0, null, undefined, 'false']) {
    await rejected(f.cache.acquire(poisonReads(REQUEST_KEYS, reads), {
      signal: { aborted: abortedValue, addEventListener() {}, removeEventListener() {} },
    }), 'TEXT_SIGNAL_FAILED');
  }
  assert.equal(reads.reads, 0); assert.equal(f.state.measure, 0);
});

test('T25: cancelling one shared caller preserves the remaining actual demand and lease', async (t) => {
  const gate = deferred(), entered = deferred(), oneSignal = signal(), twoSignal = signal();
  const f = await fixture(t, { async rasterize() { entered.resolve(); return gate.promise; } }, { maxResidentEntries: 0 });
  const one = keep(f.cache.acquire(request(), { signal: oneSignal.value }));
  const two = keep(f.cache.acquire(request(), { signal: twoSignal.value }));
  await entered.promise; const reason = { cancelled: 'one-of-two' }; oneSignal.abort(reason);
  await rejectedKept(one, 'TEXT_ACQUIRE_CANCELLED', reason);
  assert.equal(f.cache.getStatus().pendingWaiters, 1); assert.equal(f.cache.getStatus().callerLeaseSlots, 1);
  assert.equal(f.state.measureContexts[0].signal.aborted, false); assert.equal(f.state.release, 0);
  assert.equal(oneSignal.counters.remove, 1); assert.equal(twoSignal.counters.remove, 0);
  gate.resolve(image()); const result = await fulfilled(two); assertImage(result);
  assert.equal(f.state.measure, 1); assert.equal(f.state.raster, 1); assert.equal(f.state.release, 1);
  release(result); await f.cache.whenIdle();
});

test('T26: last measure cancellation makes local demand inert while the late actor remains charged', async (t) => {
  for (const lateReject of [false, true]) {
    const gate = deferred(), entered = deferred(), caller = signal(), reason = { cancelled: 'last-measure' };
    const lateCause = { late: 'measure-rejection' }, abortSnapshots = []; let cache, own, aborts = 0;
    const f = await fixture(t, { async measure(value, context) {
      context.signal.addEventListener('abort', () => {
        aborts++; abortSnapshots.push(cache.getStatus());
      });
      entered.resolve(); await gate.promise;
      if (lateReject) throw lateCause; own = issue(value, context); return own;
    } }, { maxResidentEntries: 0 });
    cache = f.cache; const pending = keep(cache.acquire(request(), { signal: caller.value }));
    await entered.promise; caller.abort(reason); await rejectedKept(pending, 'TEXT_ACQUIRE_CANCELLED', reason);
    assert.equal(aborts, 1); assert.equal(abortSnapshots[0].pendingWaiters, 0);
    assert.equal(abortSnapshots[0].callerLeaseSlots, 0); assert.equal(abortSnapshots[0].currentGenerations, 0);
    assert.equal(cache.getStatus().pendingJobs, 1);
    assert.equal(cache.getStatus().retiredGenerations, 1);
    const idle = keep(cache.whenIdle()); await flush(); assert.equal(idle.settled, false);
    gate.resolve(); const idleResult = await idle.observed; assert.equal('error' in idleResult, false);
    assert.equal(f.state.raster, 0); assert.equal(f.state.release, lateReject ? 0 : 1);
    if (!lateReject) assert.deepEqual(f.state.released, [own]);
    const status = cache.getStatus(); assert.equal(status.pendingJobs, 0); assert.equal(status.residentEntries, 0);
    assert.equal(status.activeCallerLeases, 0); assert.equal(status.lateProviderFailureCount, lateReject ? 1 : 0);
  }
});

test('T27: late cancelled raster cleanup cannot remove a newer genuine route', async (t) => {
  const oldGate = deferred(), oldEntered = deferred(), caller = signal();
  const f = await fixture(t, { async rasterize(plan) {
    if (plan.request.text === 'A') { oldEntered.resolve(); return oldGate.promise; }
    return image();
  } }, { maxResidentEntries: 0 });
  const reason = { cancelled: 'old-raster' }, old = keep(f.cache.acquire(request(), { signal: caller.value }));
  await oldEntered.promise; caller.abort(reason); await rejectedKept(old, 'TEXT_ACQUIRE_CANCELLED', reason);
  assert.equal(f.state.release, 0); assert.equal(f.cache.getStatus().reservedImageBytes, 480);
  assert.equal(f.cache.getStatus().pendingRasterBytes, 960);
  const replacement = await f.cache.acquire(request({ text: 'B' })); const replacementTexture = assertImage(replacement);
  assert.equal(f.state.release, 1); assert.equal(f.cache.getStatus().activeCallerLeases, 1);
  oldGate.resolve(image()); await f.cache.whenIdle();
  const hit = await f.cache.acquire(request({ text: 'B' }));
  assert.equal(hit.lease.value, replacementTexture); assert.equal(f.state.measure, 2);
  assert.equal(f.state.release, 2); assert.equal(f.cache.getStatus().liveImageBytes, 480);
  assert.equal(f.cache.getStatus().reservedImageBytes, 0); assert.equal(f.cache.getStatus().pendingRasterBytes, 0);
  release(hit); release(replacement);
});

test('T28: synchronous listener reentry defers removal and committed delivery rechecks real entitlement', async (t) => {
  const reason = { cancel: 'inside-add' };
  const synchronous = signal({ add(control) { control.abort(reason); } });
  const a = await fixture(t, {}, { maxResidentEntries: 0 });
  await rejected(a.cache.acquire(request(), { signal: synchronous.value }), 'TEXT_ACQUIRE_CANCELLED', reason);
  assert.deepEqual(synchronous.events, ['add-enter', 'add-exit', 'remove']);
  await a.cache.whenIdle(); assert.equal(a.cache.getStatus().activeCallerLeases, 0);
  const late = signal({ remove(control) { control.abort({ late: 'ordinary' }); } });
  const b = await fixture(t, {}, { maxResidentEntries: 0 });
  const valid = await b.cache.acquire(request(), { signal: late.value }); assertImage(valid); release(valid);
  const c = await fixture(t, {}, { maxResidentEntries: 0 }); let closing;
  const terminal = signal({ remove() { closing = c.engine.dispose(); } });
  const failure = await rejected(c.cache.acquire(request(), { signal: terminal.value }), 'TEXT_RESOURCE_FAILED');
  errorIs('ASSET_LEASE_RELEASED')(failure.cause); await closing;
  assert.equal(c.cache.getStatus().activeCallerLeases, 0);
});

test('T29: detach faults preserve cancellation or fail successful delivery without exposing a real lease', async (t) => {
  const detachCause = { detach: 'exact' }, reason = { cancellation: 'primary' }, gate = deferred(), entered = deferred();
  const f = await fixture(t, { async measure(value, context) {
    entered.resolve(); await gate.promise; return issue(value, context);
  } }, { maxResidentEntries: 0 });
  const cancellation = signal({ remove() { throw detachCause; } });
  const pending = keep(f.cache.acquire(request(), { signal: cancellation.value }));
  await entered.promise; cancellation.abort(reason);
  const failure = await rejectedKept(pending, 'TEXT_ACQUIRE_CANCELLED', reason);
  assert.ok(failure.cleanupErrors.includes(detachCause)); assert.equal(cancellation.counters.remove, 1);
  const idle = keep(f.cache.whenIdle()); await flush(); assert.equal(idle.settled, false);
  gate.resolve(); await rejectedKept(idle, 'TEXT_CACHE_CLEANUP_FAILED', detachCause);
  assert.equal(f.cache.getStatus().pendingWaiters, 0); assert.equal(f.cache.getStatus().callerLeaseSlots, 0);
  const g = await fixture(t, {}, { maxResidentEntries: 0 });
  const removal = signal({ remove() { throw detachCause; } });
  await rejected(g.cache.acquire(request(), { signal: removal.value }), 'TEXT_SIGNAL_FAILED', detachCause);
  await rejected(g.cache.whenIdle(), 'TEXT_CACHE_CLEANUP_FAILED', detachCause);
  assert.equal(removal.counters.remove, 1); assert.equal(g.cache.getStatus().activeCallerLeases, 0);
  assert.equal(g.cache.getStatus().callerLeaseSlots, 0); assert.equal(g.cache.getStatus().liveImageBytes, 0);
});

test('T30: authentic Scope ownership closes cache work while preserving independently owned caller leases', async (t) => {
  const gate = deferred(), entered = deferred();
  const f = await fixture(t, { async measure(value, context) {
    if (value.text === 'pending') { entered.resolve(); await gate.promise; }
    return issue(value, context);
  } }, { maxResidentEntries: 1 });
  const other = await engineFixture(t);
  assert.throws(() => other.engine.createScope().use(f.cache), errorIs('ENGINE_MISMATCH'));
  const prepared = await f.cache.acquire(request()), texture = assertImage(prepared);
  assert.throws(() => other.engine.createScope().use(prepared.lease), errorIs('ENGINE_MISMATCH'));
  const cacheScope = f.engine.createScope(), callerScope = f.engine.createScope();
  cacheScope.use(f.cache); callerScope.use(prepared.lease);
  const pending = keep(f.cache.acquire(request({ text: 'pending' }))); await entered.promise;
  cacheScope.dispose(); await rejectedKept(pending, 'TEXT_CACHE_CLOSED');
  assert.equal(f.cache.getStatus().closed, true); assert.equal(f.cache.getStatus().residentEntries, 0);
  assert.equal(prepared.lease.value, texture); gate.resolve(); await f.cache.whenIdle();
  callerScope.dispose(); assert.throws(() => prepared.lease.value, errorIs('ASSET_LEASE_RELEASED'));
});

test('T31: automatic manager close makes genuine unrelated leases and waiters inert before external cleanup', async (t) => {
  const order = [], textGate = deferred(), textEntered = deferred(), assetGate = deferred(), assetEntered = deferred();
  const closeWitnesses = []; let readyLease, cache, textAbort = 0;
  const observeReadyEntitlement = (phase) => {
    let error; try { readyLease.value; } catch (cause) { error = cause; }
    closeWitnesses.push({ phase, error, pendingWaiters: cache.getStatus().pendingWaiters });
  };
  const f = await fixture(t, { async measure(value, context) {
    context.signal.addEventListener('abort', () => {
      textAbort++; order.push('text-owned-abort');
      observeReadyEntitlement('text-owned-abort'); unrelated.abort({ late: 'manager-waiter' });
    });
    textEntered.resolve(); await textGate.promise; return issue(value, context);
  } }, { maxResidentEntries: 0 }, { hostOverrides: { stop() { order.push('host-stop'); } } });
  cache = f.cache;
  const unrelated = signal({ remove() {
    order.push('asset-detach'); observeReadyEntitlement('asset-detach');
  } });
  const type = createAssetType('t31.unrelated', (value) => typeof value === 'string');
  const readyRef = createAssetRef(type, 't31.ready'), pendingRef = createAssetRef(type, 't31.pending');
  f.engine.assets.register(type, {
    async load(ref) { if (ref.id === pendingRef.id) { assetEntered.resolve(); return assetGate.promise; } return 'ready'; },
    dispose(value) { order.push('asset-dispose:' + value); observeReadyEntitlement('asset-dispose:' + value); },
  });
  readyLease = await f.engine.assets.acquire(readyRef);
  const managerPending = keep(f.engine.assets.acquire(pendingRef, { signal: unrelated.value })); await assetEntered.promise;
  const pendingText = keep(cache.acquire(request())); await textEntered.promise;
  f.engine.createScope().use({ dispose() { order.push('scope'); } });
  class OrderedDisplay extends DisplayObject { dispose() { order.push('stage'); super.dispose(); } }
  f.engine.stage.addChild(new OrderedDisplay());
  const idle = keep(cache.whenIdle()); await f.engine.dispose();
  await rejectedKept(managerPending, 'ASSET_MANAGER_CLOSED'); await rejectedKept(pendingText, 'TEXT_CACHE_CLOSED');
  assert.equal(textAbort, 1); assert.equal(idle.settled, false);
  for (const witness of closeWitnesses) {
    errorIs('ASSET_LEASE_RELEASED')(witness.error); assert.equal(witness.pendingWaiters, 0);
  }
  assert.ok(order.indexOf('scope') < order.indexOf('stage'));
  assert.ok(order.indexOf('stage') < order.indexOf('text-owned-abort'));
  assert.ok(order.indexOf('text-owned-abort') < order.indexOf('asset-detach'));
  assert.ok(order.indexOf('asset-detach') < order.indexOf('host-stop'));
  assert.equal(f.diagnostics.some((item) => item.cause?.code === 'ASSET_MANAGER_CLOSED'), false);
  textGate.resolve(); assetGate.resolve('late');
  assert.equal('error' in await idle.observed, false); await flush();
  assert.equal(f.state.release, 1); assert.equal(f.state.raster, 0);
  assert.equal(order.filter((value) => value === 'asset-dispose:late').length, 1);
});

test('T32: cache close is terminal but preserves genuine caller entitlement and saved owned results', async (t) => {
  const f = await fixture(t, {}, { maxResidentEntries: 1 });
  const result = await f.cache.acquire(request()), texture = assertImage(result), savedImage = texture.imageData;
  const savedMetrics = result.metrics, pixels = copyImageData2DPixels(savedImage);
  const bitmap = new Bitmap(result.lease); f.engine.stage.addChild(bitmap);
  const frame = f.engine.captureFrame({ width: 32, height: 32 }); await f.cache.whenIdle();
  assert.equal(f.cache.getStatus().residentEntries, 1); f.cache.dispose(); f.cache.dispose();
  assert.equal(f.cache.getStatus().closed, true); assert.equal(f.cache.getStatus().residentEntries, 0);
  assert.equal(result.lease.value, texture); assert.equal(result.metrics, savedMetrics);
  assert.equal(frame.images[frame.commands[0].imageIndex], savedImage);
  assert.deepEqual(copyImageData2DPixels(savedImage), pixels);
  await rejected(f.cache.acquire(request()), 'TEXT_CACHE_CLOSED');
  assert.throws(() => f.create(f.engine.assets, { provider: literalProvider().provider }), errorIs('TEXT_CACHE_ALREADY_CREATED'));
  bitmap.dispose(); release(result); assert.throws(() => result.lease.value, errorIs('ASSET_LEASE_RELEASED'));
  assert.deepEqual(copyImageData2DPixels(savedImage), pixels); assert.equal(f.state.measure, 1);
});

test('T33: invalidated old callers retain separately charged images while replacement retirement stays isolated', async (t) => {
  const f = await fixture(t, {}, { maxResidentEntries: 0 });
  const old = await f.cache.acquire(request()), oldTexture = assertImage(old), oldImage = oldTexture.imageData;
  const saved = copyImageData2DPixels(oldImage), fontGeneration = old.request.fontGeneration;
  f.cache.invalidate(); const current = await f.cache.acquire(request({ text: 'B' }));
  const currentTexture = assertImage(current);
  assert.equal(current.request.fontGeneration, fontGeneration + 1);
  assert.notEqual(currentTexture, oldTexture); assert.notEqual(current.lease.resourceGeneration, old.lease.resourceGeneration);
  assert.equal(old.lease.value, oldTexture); assert.equal(oldTexture.imageData, oldImage);
  assert.deepEqual(copyImageData2DPixels(oldImage), saved);
  const status = f.cache.getStatus(); assert.equal(status.currentGenerations, 1); assert.equal(status.retiredGenerations, 1);
  assert.equal(status.liveImageBytes, 960); assert.equal(status.activeCallerLeases, 2); assert.equal(status.metadataBytes, 5576);
  release(old); await f.cache.whenIdle();
  const hit = await f.cache.acquire(request({ text: 'B' })); assert.equal(hit.lease.value, currentTexture);
  assert.equal(f.state.measure, 2); assert.equal(f.cache.getStatus().liveImageBytes, 480);
  release(hit); release(current);
});

test('T34: retained retired callers consume generation capacity until proved real retirement', async (t) => {
  const f = await fixture(t, {}, { maxGenerations: 1, maxResidentEntries: 0 });
  const old = await f.cache.acquire(request()), texture = assertImage(old); f.cache.invalidate();
  await rejected(f.cache.acquire(request({ text: 'B' })), 'TEXT_CACHE_BUDGET');
  assert.equal(f.state.measure, 1); assert.equal(old.lease.value, texture);
  assert.equal(f.cache.getStatus().retiredGenerations, 1); release(old); await f.cache.whenIdle();
  const replacement = await f.cache.acquire(request({ text: 'B' })); assertImage(replacement);
  assert.equal(f.state.measure, 2); release(replacement);
});

test('T35: waiter and actual caller lease caps refuse before new listener or provider work and retire once', async (t) => {
  const gate = deferred(), entered = deferred(), a = signal(), b = signal();
  const f = await fixture(t, { async measure(value, context) {
    entered.resolve(); await gate.promise; return issue(value, context);
  } }, { maxWaiters: 1, maxResidentEntries: 0 });
  const pending = keep(f.cache.acquire(request(), { signal: a.value })); await entered.promise;
  await rejected(f.cache.acquire(request(), { signal: b.value }), 'TEXT_CACHE_BUDGET');
  assert.equal(b.counters.add, 0); assert.equal(f.state.measure, 1);
  const reason = { cancel: 'free-waiter' }; a.abort(reason); await rejectedKept(pending, 'TEXT_ACQUIRE_CANCELLED', reason);
  gate.resolve(); await f.cache.whenIdle();
  release(await f.cache.acquire(request({ text: 'B' }))); assert.equal(f.state.measure, 2);
  const g = await fixture(t, {}, { maxCallerLeases: 1, maxResidentEntries: 0 });
  const first = await g.cache.acquire(request()), c = signal();
  assert.equal(g.cache.getStatus().pendingWaiters, 0); assert.equal(g.cache.getStatus().activeCallerLeases, 1);
  await rejected(g.cache.acquire(request({ text: 'B' }), { signal: c.value }), 'TEXT_CACHE_BUDGET');
  assert.equal(c.counters.add, 0); assert.equal(g.state.measure, 1); release(first); release(first);
  release(await g.cache.acquire(request({ text: 'B' }))); assert.equal(g.state.measure, 2);
  const h = await fixture(t, { blank: true }, { maxCallerLeases: 1, maxResidentEntries: 0 });
  for (const text of ['A', 'B']) {
    assert.equal((await h.cache.acquire(request({ text }))).kind, 'empty');
    assert.equal(h.cache.getStatus().callerLeaseSlots, 0);
  }
});

test('T36: ready LRU residency drops cache leases, preserves old callers and never steals admitted live jobs', async (t) => {
  const zero = await fixture(t, {}, { maxResidentEntries: 0 });
  const zeroValue = await zero.cache.acquire(request()); await zero.cache.whenIdle();
  assert.equal(zero.cache.getStatus().residentEntries, 0); release(zeroValue);
  const one = await fixture(t, {}, { maxResidentEntries: 1 });
  const a = await one.cache.acquire(request()), aTexture = assertImage(a);
  const b = await one.cache.acquire(request({ text: 'B' })); await one.cache.whenIdle();
  assert.equal(one.cache.getStatus().residentEntries, 1); assert.equal(one.cache.getStatus().residentBytes, 480);
  assert.equal(one.cache.getStatus().liveImageBytes, 960); assert.equal(a.lease.value, aTexture);
  release(b); assert.equal(one.cache.getStatus().liveImageBytes, 960);
  release(a); await one.cache.whenIdle(); assert.equal(one.cache.getStatus().liveImageBytes, 480);
  one.cache.dispose(); await one.cache.whenIdle(); assert.equal(one.cache.getStatus().liveImageBytes, 0);
  const full = await fixture(t, {}, { maxResidentEntries: 32 }), callers = [];
  for (let index = 0; index < 33; index++) callers.push(await full.cache.acquire(request({ text: `lru-${index}` })));
  await full.cache.whenIdle(); const status = full.cache.getStatus();
  assert.equal(status.residentEntries, 32); assert.equal(status.residentBytes, 32 * 480);
  assert.ok(status.occupiedSlots <= 32); assert.equal(status.activeCallerLeases, 33);
  assert.equal(status.retiredGenerations, 1);
  for (const value of callers) { assertImage(value); release(value); }
  const gate = deferred(), allEntered = deferred(); let entered = 0;
  const loading = await fixture(t, { async measure(value, context) {
    if (++entered === 4) allEntered.resolve(); await gate.promise; return issue(value, context);
  } }, { maxResidentEntries: 32 });
  const pending = Array.from({ length: 4 }, (_, index) => keep(loading.cache.acquire(request({ text: `live-${index}` }))));
  await allEntered.promise;
  await rejected(loading.cache.acquire(request({ text: 'fifth' })), 'TEXT_CACHE_BUDGET');
  assert.equal(loading.state.measure, 4); assert.equal(loading.cache.getStatus().pendingJobs, 4);
  for (const context of loading.state.measureContexts) assert.equal(context.signal.aborted, false);
  gate.resolve(); for (const value of pending) { const ready = await fulfilled(value); assertImage(ready); release(ready); }
});

test('T37: literal metadata 4964 admits pending work and 4963 refuses without partial state', async (t) => {
  const gate = deferred(), entered = deferred(), caller = signal();
  const yes = await fixture(t, { async measure(value, context) {
    entered.resolve(); await gate.promise; return issue(value, context);
  } }, { maxMetadataBytes: 4964, maxResidentEntries: 0 });
  const pending = keep(yes.cache.acquire(request(), { signal: caller.value })); await entered.promise;
  assert.equal(yes.cache.getStatus().metadataBytes, 4964); assert.equal(caller.counters.add, 1);
  gate.resolve(); const ready = await fulfilled(pending); assertImage(ready); await yes.cache.whenIdle();
  assert.equal(yes.cache.getStatus().metadataBytes, 4836); release(ready);
  const no = await fixture(t, {}, { maxMetadataBytes: 4963, maxResidentEntries: 0 }), listener = signal();
  const before = no.cache.getStatus();
  await rejected(no.cache.acquire(request(), { signal: listener.value }), 'TEXT_CACHE_BUDGET');
  assert.deepEqual(no.cache.getStatus(), before); assert.equal(listener.counters.add, 0);
  assert.equal(no.state.measure, 0); assert.equal(no.state.raster, 0);
});

test('T38: output reservations admit 480, refuse 479 and include live retired generations', async (t) => {
  const exact = await fixture(t, {}, { maxLogicalImageBytes: 480, maxResidentEntries: 0 });
  const value = await exact.cache.acquire(request()); assert.equal(value.metrics.raster.byteLength, 480); release(value);
  const short = await fixture(t, {}, { maxLogicalImageBytes: 479, maxResidentEntries: 0 });
  await rejected(short.cache.acquire(request()), 'TEXT_CACHE_BUDGET');
  assert.equal(short.state.measure, 1); assert.equal(short.state.raster, 0); assert.equal(short.state.release, 1);
  assert.equal(short.cache.getStatus().reservedImageBytes, 0); assert.equal(short.cache.getStatus().pendingRasterBytes, 0);
  const retained = await fixture(t, {}, { maxLogicalImageBytes: 959, maxResidentEntries: 0 });
  const old = await retained.cache.acquire(request()), texture = assertImage(old); retained.cache.invalidate();
  await rejected(retained.cache.acquire(request({ text: 'B' })), 'TEXT_CACHE_BUDGET');
  assert.equal(retained.state.raster, 1); assert.equal(old.lease.value, texture);
  assert.equal(retained.cache.getStatus().liveImageBytes, 480); release(old); await retained.cache.whenIdle();
  release(await retained.cache.acquire(request({ text: 'B' })));
});

test('T39: scratch reservations admit 960, refuse 959 and preserve exact concurrent actor charges', async (t) => {
  const exact = await fixture(t, {}, { maxPendingRasterBytes: 960, maxResidentEntries: 0 });
  release(await exact.cache.acquire(request())); assert.equal(exact.state.rasterContexts[0].reservedScratchBytes, 960);
  for (const options of [{ maxPendingRasterBytes: 959 }, { maxLogicalImageBytes: 479, maxPendingRasterBytes: 959 }]) {
    const f = await fixture(t, {}, { ...options, maxResidentEntries: 0 });
    await rejected(f.cache.acquire(request()), 'TEXT_CACHE_BUDGET');
    assert.equal(f.state.raster, 0); assert.equal(f.state.release, 1);
    assert.equal(f.cache.getStatus().reservedImageBytes, 0); assert.equal(f.cache.getStatus().pendingRasterBytes, 0);
  }
  for (const capacity of [1920, 1919]) {
    const firstGate = deferred(), secondGate = deferred(), firstEntered = deferred(), secondEntered = deferred();
    const f = await fixture(t, { async rasterize(plan) {
      if (plan.request.text === 'A') { firstEntered.resolve(); return firstGate.promise; }
      secondEntered.resolve(); return secondGate.promise;
    } }, { maxPendingRasterBytes: capacity, maxResidentEntries: 0 });
    const first = keep(f.cache.acquire(request())); await firstEntered.promise;
    const second = keep(f.cache.acquire(request({ text: 'B' })));
    if (capacity === 1920) {
      await secondEntered.promise; assert.equal(f.cache.getStatus().pendingRasterBytes, 1920);
      assert.equal(f.cache.getStatus().reservedImageBytes, 960); secondGate.resolve(image());
      const result = await fulfilled(second); assertImage(result); release(result);
      assert.equal(f.cache.getStatus().pendingRasterBytes, 960);
    } else {
      await rejectedKept(second, 'TEXT_CACHE_BUDGET'); assert.equal(f.state.raster, 1);
      assert.equal(f.cache.getStatus().pendingRasterBytes, 960); assert.equal(f.cache.getStatus().reservedImageBytes, 480);
    }
    firstGate.resolve(image()); const result = await fulfilled(first); assertImage(result); release(result); await f.cache.whenIdle();
    assert.equal(f.cache.getStatus().pendingRasterBytes, 0);
  }
});

test('T40: reachable raster edge and pixel endpoints retain exact dimensions without rescaling', async (t) => {
  for (const [width, height, allowed, rasterWidth, rasterHeight] of [
    [4092, 1, true, 4096, 5], [4093, 1, false, 4097, 5],
    [1020, 1020, true, 1024, 1024], [1021, 1020, false, 1025, 1024],
  ]) {
    const f = await fixture(t, { async measure(value, context) {
      return issue(value, context, { advance: 0, hasInk: true,
        inkLeft: 0, inkTop: 0, inkRight: width, inkBottom: height }, 0);
    } }, { maxResidentEntries: 0 });
    if (allowed) {
      const result = await f.cache.acquire(request()); assertImage(result);
      assert.equal(result.metrics.raster.width, rasterWidth); assert.equal(result.metrics.raster.height, rasterHeight);
      assert.equal(result.metrics.raster.byteLength, 4 * rasterWidth * rasterHeight);
      assert.equal(f.state.rasterContexts[0].reservedImageBytes, 4 * rasterWidth * rasterHeight);
      release(result);
    } else {
      await rejected(f.cache.acquire(request()), 'TEXT_REQUEST_LIMIT'); assert.equal(f.state.raster, 0);
      // Invalid dimensions prevent issuance; there is no own plan to release.
      assert.equal(f.state.release, 0);
    }
  }
});

test('T41: eight idle observers wait for retired actors while the ninth refuses and close cannot fabricate settlement', async (t) => {
  for (const cleanupFails of [false, true]) {
    const gate = deferred(), entered = deferred(), reason = { cancel: 'retired-idle' }, releaseCause = { release: 'idle-cleanup' };
    const f = await fixture(t, {
      async measure(value, context) { entered.resolve(); await gate.promise; return issue(value, context); },
      release() { if (cleanupFails) throw releaseCause; },
    }, { maxResidentEntries: 0 });
    const caller = signal(), pending = keep(f.cache.acquire(request(), { signal: caller.value }));
    await entered.promise; caller.abort(reason); await rejectedKept(pending, 'TEXT_ACQUIRE_CANCELLED', reason);
    const idle = Array.from({ length: 8 }, () => keep(f.cache.whenIdle()));
    await rejected(f.cache.whenIdle(), 'TEXT_CACHE_BUDGET'); assert.equal(f.cache.getStatus().idleWaiters, 8);
    f.cache.dispose(); await flush(); for (const value of idle) assert.equal(value.settled, false);
    assert.equal(f.cache.getStatus().pendingJobs, 1); gate.resolve();
    for (const value of idle) {
      if (cleanupFails) await rejectedKept(value, 'TEXT_CACHE_CLEANUP_FAILED', releaseCause);
      else assert.equal('error' in await value.observed, false);
    }
    assert.equal(f.cache.getStatus().idleWaiters, 0); assert.equal(f.cache.getStatus().pendingJobs, 0);
  }
  const ready = await fixture(t, {}, { maxResidentEntries: 1 });
  const prepared = await ready.cache.acquire(request()); await ready.cache.whenIdle();
  assert.equal(ready.cache.getStatus().activeCallerLeases, 1); assert.equal(ready.cache.getStatus().residentEntries, 1);
  release(prepared);
});

test('T42: matching public classes and replayed genuine failures remain exact phase-wrapper causes', async (t) => {
  for (const cause of [new EgretError('TEXT_CACHE_BUDGET'), new EgretError('TEXT_REQUEST_LIMIT'), new TypeError('measure native-like failure')]) {
    const f = await fixture(t, { async measure() { throw cause; } });
    await rejected(f.cache.acquire(request()), 'TEXT_MEASURE_FAILED', cause);
  }
  for (const cause of [new EgretError('TEXT_RASTER_RESULT_INVALID'), new TypeError('raster native-like failure')]) {
    const f = await fixture(t, { async rasterize() { throw cause; } });
    await rejected(f.cache.acquire(request()), 'TEXT_RASTER_FAILED', cause); assert.equal(f.state.release, 1);
  }
  const readCause = new EgretError('TEXT_REQUEST_LIMIT'), read = await fixture(t);
  await rejected(read.cache.acquire({ ...REQUEST, get text() { throw readCause; } }), 'TEXT_REQUEST_INVALID', readCause);
  let previousFailure;
  const replay = await fixture(t, { async measure(value, context) {
    if (previousFailure) throw previousFailure;
    try { issue(value, context, { ...ROW, advance: -1 }); }
    catch (cause) { previousFailure = cause; errorIs('TEXT_PLAN_INVALID')(cause); throw cause; }
    assert.fail('invalid negative advance must not issue a plan');
  } }, { maxResidentEntries: 0 });
  await rejected(replay.cache.acquire(request()), 'TEXT_PLAN_INVALID'); assert.ok(previousFailure instanceof EgretError);
  await rejected(replay.cache.acquire(request({ text: 'B' })), 'TEXT_MEASURE_FAILED', previousFailure);
});

test('T43: immutable owned snapshots and saved image data outlive leases without reviving disposed Texture wrappers', async (t) => {
  const gate = deferred(), entered = deferred();
  const f = await fixture(t, { async measure(value, context) {
    entered.resolve(); await gate.promise; return issue(value, context);
  } }, { maxResidentEntries: 0 });
  const input = request(), pending = keep(f.cache.acquire(input)); await entered.promise;
  input.text = 'mutated'; input.fillColor = 0; input.fontFamily = 'Other';
  for (const method of ['measure', 'rasterize', 'release']) f.provider[method] = () => { throw new Error('late callback replacement'); };
  gate.resolve(); const result = await fulfilled(pending), texture = assertImage(result), savedImage = texture.imageData;
  assert.equal(result.request.text, 'A'); assert.equal(result.request.fillColor, 0xffffff); assert.equal(result.request.fontFamily, 'Test');
  for (const value of [result, result.request, result.request.sourceLines, result.request.sourceLines[0],
    result.metrics, result.metrics.logicalBounds, result.metrics.inkBounds, result.metrics.contentBounds,
    result.metrics.raster, result.metrics.lines, result.metrics.lines[0]]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { result.request.text = 'changed'; }, TypeError);
  assert.throws(() => { result.metrics.raster.width = 1; }, TypeError);
  const savedPixels = copyImageData2DPixels(savedImage); release(result);
  assert.throws(() => result.lease.value, errorIs('ASSET_LEASE_RELEASED'));
  assert.deepEqual(copyImageData2DPixels(savedImage), savedPixels); assert.equal(result.metrics.raster.width, 12);
  const next = await f.cache.acquire(request({ text: 'B' })), borrowed = assertImage(next), borrowedImage = borrowed.imageData;
  borrowed.dispose(); assert.throws(() => borrowed.imageData, errorIs('TEXTURE_DISPOSED'));
  const replacement = await f.cache.acquire(request({ text: 'B' }));
  assert.notEqual(replacement.lease.value, borrowed); assertImage(replacement);
  assert.deepEqual([...copyImageData2DPixels(borrowedImage).subarray(0, 4)], [17, 83, 149, 255]);
  assert.throws(() => borrowed.imageData, errorIs('TEXTURE_DISPOSED')); release(next); release(replacement);
});
