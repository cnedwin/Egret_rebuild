// First-party Apache-2.0 public lifecycle oracles, independently authored.
// Old TS-private names are explicit JavaScript shadow actors, not test hooks.
// These oracles never read the ownership inventory or expose an internal hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EgretError, Scope, createAssetRef, createAssetType, createEngine } from '@egret/engine';
import { host } from './helpers.mjs';

const APPLY = Reflect.apply;
const USE = Scope.prototype.use;
const DISPOSE = Scope.prototype.dispose;
const use = (scope, value) => APPLY(USE, scope, [value]);
const dispose = scope => APPLY(DISPOSE, scope, []);

function expectCode(action, code) {
  let caught;
  assert.throws(action, error => {
    caught = error;
    assert.ok(error instanceof EgretError);
    assert.equal(error.code, code);
    return true;
  });
  return caught;
}

async function withEngine(run) {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  try { await run(engine, h); }
  finally {
    await engine.dispose();
    assert.deepEqual(h.trace, ['start', 'stop', 'close']);
    assert.equal(h.timers.size, 0);
  }
}

test('SPH01 ordinary registration deduplicates and closes the original public signal', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope();
    const signal = scope.signal;
    let cleanupCalls = 0;
    const value = Object.freeze({ dispose() { cleanupCalls++; } });
    assert.equal(scope.state, 'open');
    assert.equal(scope.use(value), value);
    assert.equal(scope.use(value), value);
    scope.dispose();
    scope.dispose();
    assert.equal(cleanupCalls, 1);
    assert.equal(scope.state, 'closed');
    assert.equal(scope.signal, signal);
    assert.equal(signal.aborted, true);
    assert.ok(signal.reason instanceof EgretError);
    assert.equal(signal.reason.code, 'SCOPE_CLOSED');
  });
});

test('SPH02 shadow validateAcceptance cannot bypass real cleanup registration', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope();
    let shadowCalls = 0;
    let cleanupCalls = 0;
    scope.validateAcceptance = () => { shadowCalls++; return scope; };
    const value = Object.freeze({ dispose() { cleanupCalls++; } });
    try {
      assert.equal(use(scope, value), value);
      assert.equal(use(scope, value), value);
      dispose(scope);
      dispose(scope);
      // The acceptance oracle requires actual cleanup, never the old probe's zero.
      assert.equal(cleanupCalls, 1, 'SPH_HELPER_SHADOW_MUST_NOT_SKIP_OWNERSHIP');
      assert.equal(shadowCalls, 0);
    } finally {
      // Observe the assigned assertion before recovering an unregistered CPU value.
      if (cleanupCalls === 0) value.dispose();
    }
  });
});

test('SPH03 replacing the old values name preserves reverse cleanup after abort', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope();
    const signal = scope.signal;
    const trace = [];
    signal.addEventListener('abort', () => { trace.push('abort'); });
    for (const id of ['alpha', 'beta', 'gamma']) {
      use(scope, Object.freeze({ dispose() {
        trace.push(id + ':' + signal.aborted + ':' + scope.state);
      } }));
    }
    scope.values = [];
    dispose(scope);
    dispose(scope);
    assert.deepEqual(trace, ['abort', 'gamma:true:closing', 'beta:true:closing', 'alpha:true:closing']);
    assert.equal(scope.state, 'closed');
  });
});

test('SPH04 shadow controller cannot replace original cancellation before cleanup', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope();
    const signal = scope.signal;
    const trace = [];
    let shadowAborts = 0;
    signal.addEventListener('abort', () => { trace.push('abort:' + scope.state); });
    use(scope, Object.freeze({ release() {
      trace.push('release:' + signal.aborted + ':' + scope.state);
    } }));
    scope.controller = Object.freeze({ abort() { shadowAborts++; } });
    dispose(scope);
    dispose(scope);
    assert.deepEqual(trace, ['abort:closing', 'release:true:closing']);
    assert.equal(scope.signal, signal);
    assert.equal(signal.aborted, true);
    assert.equal(shadowAborts, 0);
  });
});

test('SPH05 shadow onClosed cannot keep a closed Scope in Engine shutdown tracking', async () => {
  await withEngine(async engine => {
    // Calibrate the public shutdown observer on an ordinarily closed Scope.
    const baseline = engine.createScope();
    let baselineRetries = 0;
    dispose(baseline);
    baseline.dispose = () => { baselineRetries++; };

    const scope = engine.createScope();
    let shadowNotifications = 0;
    let actorRetries = 0;
    let cleanupCalls = 0;
    scope.onClosed = () => { shadowNotifications++; };
    use(scope, Object.freeze({ dispose() { cleanupCalls++; } }));
    dispose(scope);
    assert.equal(cleanupCalls, 1);
    assert.equal(scope.state, 'closed');
    // Instrument a PUBLIC method only after closure; no Engine inventory is read.
    scope.dispose = () => { actorRetries++; };
    await engine.dispose();
    assert.equal(baselineRetries, 0, 'SPH_CLOSED_SCOPE_TRACKING_BASELINE');
    assert.equal(actorRetries, 0, 'SPH_SHADOW_MUST_NOT_RETAIN_CLOSED_SCOPE');
    assert.equal(shadowNotifications, 0);
  });
});

test('SPH06 private validation retains owner and engine priority over late cleanup', async () => {
  const a = host();
  const b = host();
  const engineA = await createEngine({ host: a.adapter });
  let engineB;
  let foreignLease;
  let providerDisposals = 0;
  try {
    engineB = await createEngine({ host: b.adapter });
    const type = createAssetType('SPH genuine foreign lease', value => value === 19);
    engineA.assets.register(type, {
      async load() { return 19; },
      dispose(value) { assert.equal(value, 19); providerDisposals++; },
    });
    foreignLease = await engineA.assets.acquire(createAssetRef(type, 'sph-foreign'));

    const owner = engineB.createScope();
    let ownerCleanup = 0;
    const owned = use(owner, Object.freeze({ dispose() { ownerCleanup++; } }));
    const closed = engineB.createScope();
    let shadowCalls = 0;
    closed.validateAcceptance = () => { shadowCalls++; return closed; };
    dispose(closed);

    expectCode(() => use(closed, owned), 'OWNERSHIP_CONFLICT');
    assert.equal(ownerCleanup, 0, 'SPH_FOREIGN_OWNER_MUST_NOT_BE_CLEANED');
    expectCode(() => use(closed, foreignLease), 'ENGINE_MISMATCH');
    assert.equal(foreignLease.value, 19);
    assert.equal(providerDisposals, 0, 'SPH_FOREIGN_ENGINE_BORROW_MUST_STAY_ACTIVE');

    let lateCleanup = 0;
    const failure = new Error('SPH late cleanup failure');
    const late = Object.freeze({ release() { lateCleanup++; throw failure; } });
    const error = expectCode(() => use(closed, late), 'SCOPE_CLOSED');
    assert.equal(lateCleanup, 1);
    assert.deepEqual(error.cleanupErrors, [failure]);
    assert.equal(shadowCalls, 0);
    dispose(owner);
    assert.equal(ownerCleanup, 1);
    foreignLease.release();
    assert.equal(providerDisposals, 1);
  } finally {
    foreignLease?.release();
    try { if (engineB !== undefined) await engineB.dispose(); }
    finally { await engineA.dispose(); }
    assert.deepEqual(a.trace, ['start', 'stop', 'close']);
    assert.equal(a.timers.size, 0);
    if (engineB !== undefined) {
      assert.deepEqual(b.trace, ['start', 'stop', 'close']);
      assert.equal(b.timers.size, 0);
    }
  }
});
