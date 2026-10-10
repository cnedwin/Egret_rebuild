import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as egret from '@egret/engine';
import { deferred, flush, host as makeHost } from './helpers.mjs';

const PROFILE = 'egret.textured-frame2d/1';
const FRAME_OPTIONS = Object.freeze({ width: 8, height: 8 });
const METHODS = Object.freeze(['captureFrame', 'captureTexturedFrame', 'renderFrame', 'renderTexturedFrame']);

function profileHost(overrides = {}) {
  return makeHost({ texturedFrameProfile: PROFILE, renderTexturedFrame() {}, renderFrame() {}, ...overrides });
}

function expectCode(error, code, cause = undefined) {
  assert.ok(error instanceof egret.EgretError);
  assert.equal(error.code, code);
  assert.equal(error.cause, cause);
  return true;
}

async function closeAll(...engines) {
  const failures = [];
  for (const engine of engines.reverse()) {
    if (engine === undefined) continue;
    try { await engine.dispose(); } catch (cause) { failures.push(cause); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, 'Fixture Engine cleanup failed');
}

function unreadOptions(counter) {
  return new Proxy({}, { get() { counter.reads++; throw new Error('Options must remain unread'); } });
}

function negotiationFixture(values = {}) {
  const log = [];
  const h = profileHost();
  for (const key of ['texturedFrameProfile', 'renderTexturedFrame', 'renderFrame']) {
    const value = Object.hasOwn(values, key) ? values[key] : h.adapter[key];
    Object.defineProperty(h.adapter, key, {
      configurable: true,
      get() { log.push(key); return value; },
    });
  }
  const surface = {};
  Object.defineProperty(h.adapter, 'surface', { configurable: true, get() { log.push('surface'); return surface; } });
  Object.defineProperty(h.adapter, 'start', { configurable: true, get() { log.push('start'); return function () { assert.equal(this, h.adapter); }; } });
  const options = {
    get host() { log.push('host'); return h.adapter; },
    get onDiagnostic() { log.push('onDiagnostic'); return undefined; },
    get shutdownTimeoutMs() { log.push('shutdownTimeoutMs'); return undefined; },
  };
  return { h, log, surface, options };
}

async function acquireTexture(engine, label, dispose = texture => texture.dispose()) {
  const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([21, 34, 55, 255]) });
  const texture = egret.createTexture(image);
  const type = egret.createAssetType(label, egret.isTexture);
  engine.assets.register(type, { async load() { return texture; }, dispose });
  const lease = await engine.assets.acquire(egret.createAssetRef(type, label));
  return { image, texture, lease };
}

function triangle() {
  return egret.createTexturedGeometry2D({
    positions: new Float64Array([0, 0, 2, 0, 0, 2]),
    uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint16Array([0, 1, 2]),
  });
}

test('N01 profile factory captures exact ordered ports and receiver', async () => {
  // Genuine resource/display setup precedes the scheduled missing-factory RED.
  const probe = await egret.createEngine({ host: makeHost({ renderFrame() {} }).adapter });
  let lease, mesh, engine, legacy;
  const originals = [], restoredHostFields = [];
  try {
    ({ lease } = await acquireTexture(probe, 'profile-setup'));
    mesh = new egret.Mesh2D(lease, triangle());
    probe.stage.addChild(mesh);
    assert.equal(mesh.textureLease, lease);
    assert.equal(typeof egret.createEngineForProfile, 'function');

    const log = [], calls = [];
    const h = profileHost();
    const oldPort = function (frame) { assert.equal(this, h.adapter); calls.push(['old', frame]); };
    const newPort = function (frame) { assert.equal(this, h.adapter); calls.push(['new', frame]); };
    originals.push(oldPort, newPort);
    for (const [key, value] of [['texturedFrameProfile', PROFILE], ['renderTexturedFrame', newPort], ['renderFrame', oldPort]]) {
      Object.defineProperty(h.adapter, key, { configurable: true, get() { log.push(key); return value; } });
    }
    const surface = {};
    Object.defineProperty(h.adapter, 'surface', { configurable: true, get() { log.push('surface'); return surface; } });
    Object.defineProperty(h.adapter, 'start', { configurable: true, get() {
      log.push('start'); return function () { assert.equal(this, h.adapter); };
    } });
    engine = await egret.createEngineForProfile({
      get host() { log.push('host'); return h.adapter; },
      get onDiagnostic() { log.push('onDiagnostic'); return undefined; },
      get shutdownTimeoutMs() { log.push('shutdownTimeoutMs'); return 13; },
    }, PROFILE);
    assert.deepEqual(log, ['host', 'texturedFrameProfile', 'renderTexturedFrame', 'renderFrame', 'onDiagnostic', 'shutdownTimeoutMs', 'surface', 'start']);
    assert.equal(engine.texturedFrameProfile, PROFILE);
    for (const port of originals) Object.defineProperty(port, 'call', { configurable: true, value() { throw new Error('Poisoned call'); } });
    for (const key of ['texturedFrameProfile', 'renderTexturedFrame', 'renderFrame']) {
      restoredHostFields.push([h.adapter, key, Object.getOwnPropertyDescriptor(h.adapter, key)]);
      Object.defineProperty(h.adapter, key, { configurable: true, get() { throw new Error('Captured host field reread'); } });
    }
    const oldFrame = engine.renderFrame(FRAME_OPTIONS);
    const newFrame = engine.renderTexturedFrame(FRAME_OPTIONS);
    assert.deepEqual(calls.map(([kind, frame]) => [kind, frame.frameId]), [['old', 1], ['new', 2]]);
    assert.equal(calls[0][1], oldFrame); assert.equal(calls[1][1], newFrame);
    assert.equal(oldFrame.profile, undefined); assert.equal(newFrame.profile, PROFILE);
    assert.equal(log.length, 8);

    // Legacy creation reads its old port only, including with own-key traps.
    const base = makeHost({ renderFrame() { assert.equal(this, proxy); } }).adapter;
    const oldReads = [];
    const proxy = new Proxy(base, {
      get(target, key, receiver) {
        if (key === 'texturedFrameProfile' || key === 'renderTexturedFrame') throw new Error('Legacy profile read');
        if (key === 'renderFrame') oldReads.push(key);
        return Reflect.get(target, key, receiver);
      },
      ownKeys() { throw new Error('Legacy own-key trap'); },
      getOwnPropertyDescriptor() { throw new Error('Legacy own-property trap'); },
    });
    legacy = await egret.createEngine({ host: proxy });
    legacy.renderFrame(FRAME_OPTIONS);
    assert.equal(legacy.texturedFrameProfile, undefined);
    assert.deepEqual(oldReads, ['renderFrame']);
  } finally {
    for (const port of originals) delete port.call;
    for (const [adapter, key, descriptor] of restoredHostFields) Object.defineProperty(adapter, key, descriptor);
    mesh?.dispose(); lease?.release();
    await closeAll(probe, engine, legacy);
  }
});

test('N02 unsupported profile rejects before any options read', async () => {
  assert.equal(typeof egret.createEngineForProfile, 'function');
  for (const profile of [undefined, null, '', 'egret.textured-frame2d/2', new String(PROFILE), {}]) {
    const counter = { reads: 0 };
    await assert.rejects(egret.createEngineForProfile(unreadOptions(counter), profile), error => expectCode(error, 'ENGINE_RENDER_PROFILE_UNSUPPORTED'));
    assert.equal(counter.reads, 0);
  }
});

test('N03 negotiation read failures preserve exact causes and late-read priority', async () => {
  const fields = ['texturedFrameProfile', 'renderTexturedFrame', 'renderFrame'];
  for (const field of fields) for (const cause of [new Error(field), 'literal cause', null, undefined]) {
    const f = negotiationFixture();
    Object.defineProperty(f.h.adapter, field, { configurable: true, get() { f.log.push(field); throw cause; } });
    await assert.rejects(egret.createEngineForProfile(f.options, PROFILE), error => expectCode(error, 'INVALID_RENDERER', cause));
    assert.deepEqual(f.log, ['host', ...fields.slice(0, fields.indexOf(field) + 1)]);
    assert.deepEqual(f.h.trace, []); assert.equal(f.h.timers.size, 0);
  }
  const lateCause = Object.freeze({ label: 'late old-port throw' });
  const f = negotiationFixture({ texturedFrameProfile: 'wrong', renderTexturedFrame: 42 });
  Object.defineProperty(f.h.adapter, 'renderFrame', { configurable: true, get() { f.log.push('renderFrame'); throw lateCause; } });
  await assert.rejects(egret.createEngineForProfile(f.options, PROFILE), error => expectCode(error, 'INVALID_RENDERER', lateCause));
  assert.deepEqual(f.log, ['host', 'texturedFrameProfile', 'renderTexturedFrame', 'renderFrame']);
  for (const cause of [new Error('raw host'), null, undefined]) {
    let reads = 0;
    await assert.rejects(egret.createEngineForProfile({ get host() { reads++; throw cause; } }, PROFILE), error => {
      assert.equal(error, cause); return true;
    });
    assert.equal(reads, 1);
  }
  // The legacy semantic wrapper deliberately retains its nested error cause.
  const oldBad = makeHost({ renderFrame: 42 });
  await assert.rejects(egret.createEngine({ host: oldBad.adapter }), error => {
    assert.ok(error instanceof egret.EgretError); assert.equal(error.code, 'INVALID_RENDERER');
    assert.ok(error.cause instanceof egret.EgretError); assert.equal(error.cause.code, 'INVALID_RENDERER');
    assert.equal(error.cause.cause, undefined); return true;
  });
  assert.deepEqual(oldBad.trace, []);
});

test('N04 negotiation semantics follow complete reads and preserve raw timeout admission', async () => {
  const cases = [
    { values: { texturedFrameProfile: 'wrong', renderTexturedFrame: 42, renderFrame: 42 }, code: 'ENGINE_RENDER_PROFILE_UNSUPPORTED' },
    { values: { texturedFrameProfile: null }, code: 'ENGINE_RENDER_PROFILE_UNSUPPORTED' },
    { values: { renderTexturedFrame: undefined, renderFrame: 42 }, code: 'INVALID_RENDERER' },
    { values: { renderTexturedFrame: 42 }, code: 'INVALID_RENDERER' },
    { values: { renderFrame: null }, code: 'INVALID_RENDERER' },
  ];
  for (const { values, code } of cases) {
    const f = negotiationFixture(values);
    await assert.rejects(egret.createEngineForProfile(f.options, PROFILE), error => expectCode(error, code));
    assert.deepEqual(f.log, ['host', 'texturedFrameProfile', 'renderTexturedFrame', 'renderFrame']);
    assert.deepEqual(f.h.trace, []); assert.equal(f.h.timers.size, 0);
    const replacement = await egret.createEngine({ host: makeHost({ surface: f.surface }).adapter });
    await replacement.dispose();
  }
  for (const field of ['onDiagnostic', 'shutdownTimeoutMs']) for (const cause of [new Error(field), undefined]) {
    const f = negotiationFixture();
    Object.defineProperty(f.options, field, { get() { f.log.push(field); throw cause; } });
    await assert.rejects(egret.createEngineForProfile(f.options, PROFILE), error => { assert.equal(error, cause); return true; });
    assert.deepEqual(f.log, ['host', 'texturedFrameProfile', 'renderTexturedFrame', 'renderFrame', 'onDiagnostic', ...(field === 'shutdownTimeoutMs' ? ['shutdownTimeoutMs'] : [])]);
    assert.deepEqual(f.h.trace, []); assert.equal(f.h.timers.size, 0);
  }
  for (const timeout of [0, -1, .5, NaN, Infinity, '1']) {
    const f = negotiationFixture();
    Object.defineProperty(f.options, 'shutdownTimeoutMs', { get() { f.log.push('shutdownTimeoutMs'); return timeout; } });
    await assert.rejects(egret.createEngineForProfile(f.options, PROFILE), error => expectCode(error, 'INVALID_TIMEOUT'));
    assert.deepEqual(f.log, ['host', 'texturedFrameProfile', 'renderTexturedFrame', 'renderFrame', 'onDiagnostic', 'shutdownTimeoutMs']);
    assert.deepEqual(f.h.trace, []);
  }
  for (const shutdownTimeoutMs of [undefined, null]) {
    const gate = deferred(), h = profileHost({ renderFrame: undefined, close() { return gate.promise; } });
    let engine, closing;
    try {
      engine = await egret.createEngineForProfile({ host: h.adapter, shutdownTimeoutMs }, PROFILE);
      assert.equal(engine.captureFrame(FRAME_OPTIONS).frameId, 1);
      closing = engine.dispose(); await flush();
      assert.deepEqual([...h.timers].map(timer => timer.delayMs), [1000]);
    } finally {
      gate.resolve(); if (closing !== undefined) await closing; else await closeAll(engine);
    }
    assert.equal(h.timers.size, 0);
  }
});

test('N05 profile startup shares reservation reentry cleanup and late-close quarantine', async () => {
  const gate = deferred(), h = profileHost({ start() { return gate.promise; } });
  let first, replacement;
  const pending = egret.createEngineForProfile({ host: h.adapter }, PROFILE);
  try {
    await assert.rejects(egret.createEngineForProfile({ host: h.adapter }, PROFILE), error => expectCode(error, 'SURFACE_IN_USE'));
    gate.resolve(); first = await pending; await first.dispose();
    replacement = await egret.createEngineForProfile({ host: h.adapter }, PROFILE);
  } finally {
    gate.resolve(); if (first === undefined) first = await pending;
    await closeAll(first, replacement);
  }

  // A real inner factory reserves synchronously from the external getter.
  const surface = {}, innerHost = profileHost({ surface }), outerHost = profileHost({ surface });
  let innerPending, inner;
  Object.defineProperty(outerHost.adapter, 'texturedFrameProfile', { get() {
    innerPending = egret.createEngineForProfile({ host: innerHost.adapter }, PROFILE); return PROFILE;
  } });
  try {
    await assert.rejects(egret.createEngineForProfile({ host: outerHost.adapter }, PROFILE), error => expectCode(error, 'SURFACE_IN_USE'));
    inner = await innerPending;
    assert.deepEqual(outerHost.trace, []); assert.deepEqual(innerHost.trace, ['start']);
  } finally { if (inner === undefined && innerPending !== undefined) inner = await innerPending; await closeAll(inner); }

  const startFailure = new Error('profile start'), stopFailure = new Error('profile stop'), closeFailure = new Error('profile close');
  const trace = [], failed = profileHost({
    start() { trace.push('start'); throw startFailure; },
    stop() { trace.push('stop'); throw stopFailure; },
    async close() { trace.push('close'); throw closeFailure; },
  });
  await assert.rejects(egret.createEngineForProfile({ host: failed.adapter }, PROFILE), error => {
    expectCode(error, 'ENGINE_START_FAILED', startFailure);
    assert.deepEqual(error.cleanupErrors, [stopFailure, closeFailure]); return true;
  });
  assert.deepEqual(trace, ['start', 'stop', 'close']);
  await assert.rejects(egret.createEngine({ host: makeHost({ surface: failed.adapter.surface }).adapter }), error => expectCode(error, 'SURFACE_IN_USE'));

  const closeGate = deferred(), delayed = profileHost({ start() { throw startFailure; }, close() { return closeGate.promise; } });
  const outcome = assert.rejects(egret.createEngineForProfile({ host: delayed.adapter, shutdownTimeoutMs: 5 }, PROFILE), error => {
    expectCode(error, 'ENGINE_START_FAILED', startFailure);
    assert.equal(error.cleanupErrors.length, 1); assert.equal(error.cleanupErrors[0].code, 'ENGINE_CLOSE_TIMEOUT'); return true;
  });
  let afterLate;
  try {
    await flush(); assert.deepEqual([...delayed.timers].map(timer => timer.delayMs), [5]); delayed.expire(); await outcome;
    await assert.rejects(egret.createEngineForProfile({ host: profileHost({ surface: delayed.adapter.surface }).adapter }, PROFILE), error => expectCode(error, 'SURFACE_IN_USE'));
    closeGate.resolve(); await flush();
    afterLate = await egret.createEngineForProfile({ host: profileHost({ surface: delayed.adapter.surface }).adapter }, PROFILE);
  } finally { closeGate.resolve(); await outcome; await closeAll(afterLate); }
});

test('E01 four methods share IDs without renderer fallback or premature option reads', async () => {
  let defaultEngine, opted, newOnly;
  const calls = [];
  try {
    defaultEngine = await egret.createEngine({ host: makeHost({ renderFrame(frame) { calls.push(['default-old', frame.frameId]); } }).adapter });
    assert.equal(defaultEngine.captureFrame(FRAME_OPTIONS).frameId, 1);
    const defaultNew = defaultEngine.captureTexturedFrame(FRAME_OPTIONS);
    assert.equal(defaultNew.frameId, 2); assert.equal(defaultNew.profile, PROFILE);
    const counter = { reads: 0 };
    assert.throws(() => defaultEngine.renderTexturedFrame(unreadOptions(counter)), error => expectCode(error, 'RENDERER_REQUIRED'));
    assert.equal(counter.reads, 0); assert.deepEqual(calls, []);
    assert.equal(defaultEngine.captureFrame(FRAME_OPTIONS).frameId, 3);

    const oldFrames = [], newFrames = [];
    opted = await egret.createEngineForProfile({ host: profileHost({ renderFrame(frame) { oldFrames.push(frame); }, renderTexturedFrame(frame) { newFrames.push(frame); } }).adapter }, PROFILE);
    const a = opted.captureFrame(FRAME_OPTIONS), b = opted.captureTexturedFrame(FRAME_OPTIONS);
    const c = opted.renderFrame(FRAME_OPTIONS), d = opted.renderTexturedFrame(FRAME_OPTIONS);
    assert.deepEqual([a.frameId, b.frameId, c.frameId, d.frameId], [1, 2, 3, 4]);
    assert.equal(a.profile, undefined); assert.equal(c.profile, undefined);
    assert.equal(Object.hasOwn(a, 'images'), false); assert.equal(Object.hasOwn(a, 'geometries'), false);
    for (const frame of [b, d]) {
      assert.equal(frame.profile, PROFILE); assert.deepEqual(frame.images, []); assert.deepEqual(frame.geometries, []);
      assert.ok(Object.isFrozen(frame)); assert.ok(Object.isFrozen(frame.images)); assert.ok(Object.isFrozen(frame.geometries));
    }
    assert.equal(oldFrames.length, 1); assert.equal(oldFrames[0], c); assert.equal(newFrames.length, 1); assert.equal(newFrames[0], d);
    const routed = [];
    newOnly = await egret.createEngineForProfile({ host: profileHost({ renderFrame: undefined, renderTexturedFrame(frame) { routed.push(frame); } }).adapter }, PROFILE);
    assert.equal(newOnly.captureFrame(FRAME_OPTIONS).frameId, 1);
    const oldCounter = { reads: 0 };
    assert.throws(() => newOnly.renderFrame(unreadOptions(oldCounter)), error => expectCode(error, 'RENDERER_REQUIRED'));
    assert.equal(oldCounter.reads, 0); assert.equal(newOnly.renderTexturedFrame(FRAME_OPTIONS).frameId, 2); assert.equal(routed.length, 1);
  } finally { await closeAll(defaultEngine, opted, newOnly); }
});

test('E02 all sixteen cross-method reentries fail before nested reads with open priority', async () => {
  let engine;
  const optionsPairs = [], portPairs = [];
  let outerPort;
  function port() {
    for (const inner of METHODS) {
      const counter = { reads: 0 };
      assert.throws(() => engine[inner](unreadOptions(counter)), error => expectCode(error, 'FRAME_REENTRANT'));
      assert.equal(counter.reads, 0); portPairs.push([outerPort, inner]);
    }
  }
  try {
    engine = await egret.createEngineForProfile({ host: profileHost({ renderFrame: port, renderTexturedFrame: port }).adapter }, PROFILE);
    let nextId = 1;
    for (const outer of METHODS) for (const inner of METHODS) {
      outerPort = outer;
      const frame = engine[outer]({
        get width() {
          const counter = { reads: 0 };
          assert.throws(() => engine[inner](unreadOptions(counter)), error => expectCode(error, 'FRAME_REENTRANT'));
          assert.equal(counter.reads, 0); optionsPairs.push([outer, inner]); return 8;
        }, height: 8,
      });
      assert.equal(frame.frameId, nextId++);
    }
    assert.equal(optionsPairs.length, 16); assert.equal(new Set(optionsPairs.map(pair => pair.join('/'))).size, 16);
    assert.equal(portPairs.length, 32); assert.equal(new Set(portPairs.map(pair => pair.join('/'))).size, 8);
    await engine.dispose();
    for (const method of METHODS) {
      const counter = { reads: 0 };
      assert.throws(() => engine[method](unreadOptions(counter)), error => expectCode(error, 'ENGINE_CLOSED'));
      assert.equal(counter.reads, 0);
    }
  } finally { await closeAll(engine); }
});

test('E03 disposal from reads or captured ports waits for the shared finally barrier', async () => {
  for (const method of METHODS) {
    const trace = [], h = profileHost({
      renderFrame() { trace.push('unexpected-port'); }, renderTexturedFrame() { trace.push('unexpected-port'); },
      stop() { assert.equal(engine.stage.isDisposed, true); trace.push('stop'); }, async close() { trace.push('close'); },
    });
    let engine, closing;
    try {
      engine = await egret.createEngineForProfile({ host: h.adapter }, PROFILE);
      const scope = engine.createScope(); scope.signal.addEventListener('abort', () => trace.push('abort'));
      scope.use({ dispose() { trace.push('scope-resource'); } });
      const acquired = await acquireTexture(engine, `read-close-${method}`, texture => { assert.equal(engine.stage.isDisposed, true); trace.push('asset'); texture.dispose(); });
      engine.stage.addChild(new egret.Bitmap(acquired.lease));
      assert.throws(() => engine[method]({
        get width() { trace.push('width'); closing = engine.dispose(); assert.equal(engine.stage.isDisposed, false); assert.equal(closing, engine.dispose()); return 8; },
        get height() { trace.push('height'); return 8; },
        get clearColor() { trace.push('clearColor'); return 0; },
        get clearAlpha() { trace.push('clearAlpha'); return 0; },
      }), error => expectCode(error, 'ENGINE_CLOSED'));
      assert.deepEqual(trace, ['width', 'height', 'clearColor', 'clearAlpha']);
      await closing;
      assert.deepEqual(trace, ['width', 'height', 'clearColor', 'clearAlpha', 'abort', 'scope-resource', 'asset', 'stop', 'close']);
      assert.equal(engine.stage.isDisposed, true); acquired.lease.release();
    } finally { if (closing !== undefined) await closing; else await closeAll(engine); }
  }
  for (const method of ['renderFrame', 'renderTexturedFrame']) {
    const trace = []; let engine, closing, captured;
    const h = profileHost({ stop() { assert.equal(engine.stage.isDisposed, true); trace.push('stop'); }, async close() { trace.push('close'); } });
    h.adapter[method] = function (frame) {
      assert.equal(this, h.adapter); captured = frame; trace.push('port');
      closing = engine.dispose(); assert.equal(closing, engine.dispose());
      assert.equal(engine.stage.isDisposed, false); assert.deepEqual(trace, ['port']);
      for (const inner of METHODS) {
        const counter = { reads: 0 };
        assert.throws(() => engine[inner](unreadOptions(counter)), error => expectCode(error, 'ENGINE_CLOSED'));
        assert.equal(counter.reads, 0);
      }
    };
    try {
      engine = await egret.createEngineForProfile({ host: h.adapter }, PROFILE);
      const scope = engine.createScope(); scope.signal.addEventListener('abort', () => trace.push('abort'));
      scope.use({ dispose() { trace.push('scope-resource'); } });
      const acquired = await acquireTexture(engine, `port-close-${method}`, texture => { assert.equal(engine.stage.isDisposed, true); trace.push('asset'); texture.dispose(); });
      engine.stage.addChild(new egret.Bitmap(acquired.lease));
      const frame = engine[method](FRAME_OPTIONS); assert.equal(frame, captured); assert.equal(frame.frameId, 1); assert.ok(Object.isFrozen(frame));
      assert.deepEqual(trace, ['port']); await closing;
      assert.deepEqual(trace, ['port', 'abort', 'scope-resource', 'asset', 'stop', 'close']); acquired.lease.release();
    } finally { if (closing !== undefined) await closing; else await closeAll(engine); }
  }
});

test('E04 options causes capture faults diagnostics and explicit shared ID exhaustion remain exact', async () => {
  let engine;
  const diagnostics = [], calls = [];
  try {
    engine = await egret.createEngineForProfile({ host: profileHost({ renderFrame(frame) { calls.push(frame); }, renderTexturedFrame(frame) { calls.push(frame); } }).adapter, onDiagnostic(d) { diagnostics.push(d); } }, PROFILE);
    let nextId = 1;
    for (const method of METHODS) {
      const log = [];
      const frame = engine[method]({
        get width() { log.push('width'); return 8; }, get height() { log.push('height'); return 9; },
        get clearColor() { log.push('clearColor'); return 0x123456; }, get clearAlpha() { log.push('clearAlpha'); return .25; },
      });
      assert.deepEqual(log, ['width', 'height', 'clearColor', 'clearAlpha']);
      assert.deepEqual([frame.width, frame.height, frame.clearColor, frame.clearAlpha, frame.frameId], [8, 9, 0x123456, .25, nextId++]);
      for (const cause of [Object.freeze({ label: 'late option read' }), undefined]) {
        const reads = [];
        assert.throws(() => engine[method]({
          get width() { reads.push('width'); return NaN; }, get height() { reads.push('height'); return 8; },
          get clearColor() { reads.push('clearColor'); return 0; }, get clearAlpha() { reads.push('clearAlpha'); throw cause; },
        }), error => expectCode(error, 'INVALID_FRAME_OPTIONS', cause));
        assert.deepEqual(reads, ['width', 'height', 'clearColor', 'clearAlpha']);
      }
      for (const key of ['clearColor', 'clearAlpha']) assert.throws(() => engine[method]({ ...FRAME_OPTIONS, [key]: null }), error => expectCode(error, 'INVALID_FRAME_OPTIONS'));
    }
    assert.equal(engine.captureTexturedFrame(FRAME_OPTIONS).frameId, 5); assert.equal(calls.length, 2); assert.deepEqual(diagnostics, []);
    const acquired = await acquireTexture(engine, 'capture-entitlement');
    const bitmap = new egret.Bitmap(acquired.lease); engine.stage.addChild(bitmap); acquired.lease.release();
    for (const method of METHODS) assert.throws(() => engine[method](FRAME_OPTIONS), error => expectCode(error, 'ASSET_LEASE_RELEASED'));
    assert.equal(calls.length, 2); assert.deepEqual(diagnostics, []);
    bitmap.textureLease = undefined; assert.equal(engine.captureFrame(FRAME_OPTIONS).frameId, 6);
  } finally { await closeAll(engine); }

  for (const method of ['renderFrame', 'renderTexturedFrame']) {
    let failing;
    const cause = new Error(`port failure ${method}`), observed = [], h = profileHost();
    h.adapter[method] = function (frame) { assert.equal(this, h.adapter); assert.equal(frame.frameId, 1); assert.ok(Object.isFrozen(frame)); throw cause; };
    try {
      failing = await egret.createEngineForProfile({ host: h.adapter, onDiagnostic(d) { observed.push(d); throw new Error('Isolated diagnostic'); } }, PROFILE);
      assert.throws(() => failing[method](FRAME_OPTIONS), error => expectCode(error, 'FRAME_RENDER_FAILED', cause));
      assert.equal(observed.length, 1); assert.deepEqual([observed[0].code, observed[0].phase, observed[0].severity, observed[0].cause], ['FRAME_RENDER_FAILED', 'graphics', 'error', cause]);
      assert.equal(failing.captureTexturedFrame(FRAME_OPTIONS).frameId, 2);
    } finally { await closeAll(failing); }
  }

  // Deliberate existing JS-private test exception: not a supported counter API.
  for (const method of METHODS) {
    let exhausting;
    try {
      exhausting = await egret.createEngineForProfile({ host: profileHost().adapter }, PROFILE);
      exhausting.nextFrameId = Number.MAX_SAFE_INTEGER;
      assert.equal(exhausting[method](FRAME_OPTIONS).frameId, Number.MAX_SAFE_INTEGER);
      for (const next of METHODS) assert.throws(() => exhausting[next](FRAME_OPTIONS), error => expectCode(error, 'FRAME_ID_EXHAUSTED'));
    } finally { await closeAll(exhausting); }
  }
});

test('E05 invalid textured port results are rejected synchronously and safely observed in an isolated Node child', () => {
  // Root execution starts the real child; preparation only syntax-checks this file.
  const source = `
    import assert from 'node:assert/strict';
    import vm from 'node:vm';
    import * as egret from '@egret/engine';
    import { host } from './tests/helpers.mjs';
    const unhandled = [], rows = [];
    process.on('unhandledRejection', cause => unhandled.push(String(cause)));
    for (const kind of ['native', 'foreign', 'poisoned-native-then', 'thenable', 'throwing-then', 'scalar']) {
      let engine, closing, stopped = false, beforeCleanup, published, thenReads = 0, assimilated = false, result;
      const diagnostics = [];
      const h = host({
        texturedFrameProfile:'egret.textured-frame2d/1', renderFrame() {},
        renderTexturedFrame(frame) {
          assert.equal(this, h.adapter); published = frame;
          if (kind === 'native') result = Promise.reject(new Error('native rejection'));
          if (kind === 'foreign') result = vm.runInNewContext('Promise.reject(new Error("foreign rejection"))');
          if (kind === 'poisoned-native-then') {
            result = Promise.reject(new Error('poisoned rejection'));
            Object.defineProperty(result, 'then', { configurable:true, get() { thenReads++; throw new Error('Must bypass native then'); } });
          }
          if (kind === 'thenable') result = { then(resolve, reject) { assimilated = true; reject(new Error('thenable rejection')); } };
          if (kind === 'throwing-then') result = { get then() { thenReads++; throw new Error('throwing then getter'); } };
          if (kind === 'scalar') result = 42;
          if (kind === 'foreign') {
            closing = engine.dispose(); beforeCleanup = { stopped, disposed:engine.stage.isDisposed };
          }
          return result;
        },
        stop() { stopped = true; },
      });
      try {
        engine = await egret.createEngineForProfile({host:h.adapter,onDiagnostic(d){diagnostics.push(d);throw new Error('isolated observer');}}, 'egret.textured-frame2d/1');
        let thrown;
        assert.throws(() => engine.renderTexturedFrame({width:1,height:1}), error => {thrown=error;return error.code==='FRAME_RENDER_FAILED';});
        assert.ok(thrown.cause instanceof egret.EgretError); assert.equal(thrown.cause.code,'INVALID_RENDERER'); assert.equal(thrown.cause.cause,undefined);
        assert.equal(published.frameId,1); assert.ok(Object.isFrozen(published)); assert.ok(Object.isFrozen(published.images)); assert.ok(Object.isFrozen(published.geometries));
        assert.equal(diagnostics.length,1); assert.equal(diagnostics[0].cause,thrown.cause);
        assert.deepEqual([diagnostics[0].code,diagnostics[0].phase,diagnostics[0].severity],['FRAME_RENDER_FAILED','graphics','error']);
        let nextId = null;
        if (closing !== undefined) { assert.deepEqual(beforeCleanup,{stopped:false,disposed:false}); await closing; }
        else nextId = engine.captureFrame({width:1,height:1}).frameId;
        await new Promise(resolve => setImmediate(resolve));
        if (kind === 'poisoned-native-then') assert.equal(thenReads,0);
        if (kind === 'throwing-then') assert.equal(thenReads,1);
        if (kind === 'thenable') assert.equal(assimilated,true);
        rows.push({kind,code:thrown.code,cause:thrown.cause.code,diagnostic:diagnostics[0].code,phase:diagnostics[0].phase,severity:diagnostics[0].severity,nextId,thenReads,assimilated,beforeCleanup:beforeCleanup??null});
      } finally {
        if (kind === 'poisoned-native-then' && result !== undefined) delete result.then;
        if (engine !== undefined) await engine.dispose();
      }
      assert.equal(stopped,true); assert.equal(h.timers.size,0);
    }
    await new Promise(resolve => setImmediate(resolve));
    console.log(JSON.stringify({rows,unhandled}));
  `;
  const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', '--input-type=module', '--eval', source], {
    encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
  const common = { code: 'FRAME_RENDER_FAILED', cause: 'INVALID_RENDERER', diagnostic: 'FRAME_RENDER_FAILED', phase: 'graphics', severity: 'error' };
  assert.deepEqual(JSON.parse(result.stdout), { rows: [
    { kind: 'native', ...common, nextId: 2, thenReads: 0, assimilated: false, beforeCleanup: null },
    { kind: 'foreign', ...common, nextId: null, thenReads: 0, assimilated: false, beforeCleanup: { stopped: false, disposed: false } },
    { kind: 'poisoned-native-then', ...common, nextId: 2, thenReads: 0, assimilated: false, beforeCleanup: null },
    { kind: 'thenable', ...common, nextId: 2, thenReads: 0, assimilated: true, beforeCleanup: null },
    { kind: 'throwing-then', ...common, nextId: 2, thenReads: 1, assimilated: false, beforeCleanup: null },
    { kind: 'scalar', ...common, nextId: 2, thenReads: 0, assimilated: false, beforeCleanup: null },
  ], unhandled: [] });
});
