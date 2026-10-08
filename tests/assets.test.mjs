import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function setup() {
  const trace = [];
  const engine = await egret.createEngine({ host: { surface: {}, close: async () => { trace.push('host.close'); }, stop: () => trace.push('host.stop'), setTimeout: (fn, ms) => { const timer = setTimeout(fn, ms); return () => clearTimeout(timer); } }, onDiagnostic: d => trace.push(d.code) });
  assert.equal(typeof egret.createAssetType, 'function', 'typed asset service must be exported');
  const type = egret.createAssetType('cpu-label', value => typeof value === 'object' && value !== null && typeof value.label === 'string');
  const ref = egret.createAssetRef(type, 'ui/logo');
  return { engine, type, ref, trace };
}
function provider(engine, type) {
  const tasks = [], disposed = [];
  engine.assets.register(type, { load: (ref, context) => { const task = { ...deferred(), ref, context }; tasks.push(task); return task.promise; }, dispose: value => disposed.push(value.label) });
  return { tasks, disposed };
}
const rejects = (promise, code) => assert.rejects(promise, { code });

test('same resource shares loading but gives independently releasable leases', async () => {
  const { engine, type, ref } = await setup();
  const { tasks, disposed } = provider(engine, type);
  const one = engine.assets.acquire(ref), two = engine.assets.acquire(egret.createAssetRef(type, 'ui/logo'));
  assert.equal(tasks.length, 1);
  tasks[0].resolve({ label: 'logo' });
  const [a, b] = await Promise.all([one, two]);
  assert.notEqual(a.leaseId, b.leaseId);
  assert.equal(a.resourceGeneration, b.resourceGeneration);
  assert.equal(a.value, b.value);
  a.release(); a.release();
  assert.throws(() => a.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.equal(b.value.label, 'logo');
  assert.deepEqual(disposed, []);
  b.release();
  assert.deepEqual(disposed, ['logo']);
  await engine.dispose();
});

test('one pending abort preserves another waiter and postdelivery abort preserves lease', async () => {
  const { engine, type, ref } = await setup();
  const { tasks, disposed } = provider(engine, type);
  const first = new egret.CancellationController(), second = new egret.CancellationController();
  const canceled = engine.assets.acquire(ref, { signal: first.signal });
  const observed = rejects(canceled, 'ASSET_ACQUIRE_CANCELLED');
  const pending = engine.assets.acquire(ref, { signal: second.signal });
  first.abort('first-only');
  assert.equal(tasks[0].context.signal.aborted, false);
  tasks[0].resolve({ label: 'live' });
  const lease = await pending;
  await observed;
  second.abort('after-delivery');
  assert.equal(lease.value.label, 'live');
  assert.deepEqual(disposed, []);
  lease.release();
  assert.deepEqual(disposed, ['live']);
  await engine.dispose();
});

test('last waiter cancellation abandons task and cleans ignored-cancel late success', async () => {
  const { engine, type, ref } = await setup();
  const { tasks, disposed } = provider(engine, type);
  const controller = new egret.CancellationController();
  const pending = engine.assets.acquire(ref, { signal: controller.signal });
  const observed = rejects(pending, 'ASSET_ACQUIRE_CANCELLED');
  controller.abort('no-demand');
  assert.equal(tasks[0].context.signal.aborted, true);
  const next = engine.assets.acquire(ref);
  assert.equal(tasks.length, 2);
  assert.ok(tasks[1].context.resourceGeneration > tasks[0].context.resourceGeneration);
  assert.notEqual(tasks[1].context.taskId, tasks[0].context.taskId);
  tasks[0].resolve({ label: 'obsolete' });
  tasks[1].resolve({ label: 'current' });
  const lease = await next; await observed;
  assert.equal(lease.value.label, 'current');
  assert.deepEqual(disposed, ['obsolete']);
  lease.release(); await engine.dispose();
  assert.deepEqual(disposed, ['obsolete', 'current']);
});

test('already canceled request starts no provider work', async () => {
  const { engine, type, ref } = await setup();
  const { tasks } = provider(engine, type);
  const controller = new egret.CancellationController(); controller.abort('before');
  await rejects(engine.assets.acquire(ref, { signal: controller.signal }), 'ASSET_ACQUIRE_CANCELLED');
  assert.equal(tasks.length, 0);
  await engine.dispose();
});

test('invalidate preserves old pending generation without overwriting new values', async () => {
  const { engine, type, ref } = await setup();
  const { tasks, disposed } = provider(engine, type);
  const old = engine.assets.acquire(ref);
  engine.assets.invalidate(ref);
  const fresh = engine.assets.acquire(ref);
  assert.equal(tasks[0].context.signal.aborted, false);
  tasks[1].resolve({ label: 'new' });
  const b = await fresh;
  tasks[0].resolve({ label: 'old' });
  const a = await old;
  assert.equal(a.value.label, 'old'); assert.equal(b.value.label, 'new');
  assert.ok(b.resourceGeneration > a.resourceGeneration);
  a.release();
  const c = await engine.assets.acquire(ref);
  assert.equal(c.value.label, 'new'); assert.equal(tasks.length, 2);
  b.release(); assert.deepEqual(disposed, ['old']);
  c.release(); await engine.dispose();
  assert.deepEqual(disposed, ['old', 'new']);
});

test('last lease release evicts result and next acquire starts a new generation', async () => {
  const { engine, type, ref } = await setup();
  const { tasks, disposed } = provider(engine, type);
  const one = engine.assets.acquire(ref); tasks[0].resolve({ label: 'one' });
  const a = await one; a.release();
  const two = engine.assets.acquire(ref); tasks[1].resolve({ label: 'two' });
  const b = await two;
  assert.ok(b.resourceGeneration > a.resourceGeneration);
  assert.deepEqual(disposed, ['one']);
  b.release(); await engine.dispose();
});

test('provider rejection reaches every waiter and explicit later acquire retries', async () => {
  const { engine, type, ref } = await setup();
  const { tasks } = provider(engine, type);
  const first = rejects(engine.assets.acquire(ref), 'ASSET_LOAD_FAILED');
  const second = rejects(engine.assets.acquire(ref), 'ASSET_LOAD_FAILED');
  tasks[0].reject(new Error('decoder failed'));
  await Promise.all([first, second]);
  const next = engine.assets.acquire(ref); tasks[1].resolve({ label: 'retry' });
  const lease = await next; assert.equal(lease.value.label, 'retry'); lease.release();
  await engine.dispose();
});

test('runtime validation rejects incompatible returned value and disposes it once', async () => {
  const { engine, type, ref } = await setup();
  const disposed = [];
  engine.assets.register(type, { load: async () => ({ wrong: true }), dispose: value => disposed.push(value) });
  await rejects(engine.assets.acquire(ref), 'ASSET_VALUE_INVALID');
  assert.deepEqual(disposed, [{ wrong: true }]);
  await engine.dispose(); assert.equal(disposed.length, 1);
});

test('forged references, missing providers and same ID different types cannot alias', async () => {
  const { engine, type, ref } = await setup();
  await rejects(engine.assets.acquire(ref), 'ASSET_PROVIDER_MISSING');
  provider(engine, type);
  await rejects(engine.assets.acquire({ type, id: 'ui/logo' }), 'ASSET_REF_INVALID');
  const other = egret.createAssetType('cpu-label', value => typeof value === 'number');
  engine.assets.register(other, { load: async () => 42, dispose: () => {} });
  const pending = engine.assets.acquire(ref);
  await rejects(engine.assets.acquire(egret.createAssetRef(other, 'ui/logo')), 'ASSET_TYPE_MISMATCH');
  const observed = rejects(pending, 'ASSET_MANAGER_CLOSED');
  engine.assets.dispose(); await observed;
  await engine.dispose();
});

test('loader reentrant acquire shares the installed task', async () => {
  const { engine, type, ref } = await setup();
  let calls = 0, nested;
  const disposed = [];
  engine.assets.register(type, { load: async () => { calls++; if (calls === 1) nested = engine.assets.acquire(ref); return { label: 'reentrant' }; }, dispose: value => disposed.push(value.label) });
  const a = await engine.assets.acquire(ref), b = await nested;
  assert.equal(calls, 1); assert.equal(a.value, b.value);
  a.release(); b.release(); assert.deepEqual(disposed, ['reentrant']); await engine.dispose();
});

test('provider disposer reentrant acquire cannot be erased by old entry cleanup', async () => {
  const { engine, type, ref } = await setup();
  let calls = 0, nested;
  engine.assets.register(type, { load: async () => ({ label: `value-${++calls}` }), dispose: value => { if (value.label === 'value-1') nested = engine.assets.acquire(ref); } });
  const a = await engine.assets.acquire(ref); a.release();
  const b = await nested, c = await engine.assets.acquire(ref);
  assert.equal(calls, 2); assert.equal(b.value.label, 'value-2'); assert.equal(c.value, b.value);
  b.release(); c.release(); await engine.dispose();
});

test('Scope releases CPU leases and rejects a foreign Engine lease without destroying it', async () => {
  const { engine, type, ref } = await setup();
  const other = (await setup()).engine;
  const { tasks, disposed } = provider(engine, type);
  const pending = engine.assets.acquire(ref); tasks[0].resolve({ label: 'scoped' });
  const lease = await pending;
  assert.throws(() => other.createScope().use(lease), { code: 'ENGINE_MISMATCH' });
  assert.equal(lease.value.label, 'scoped');
  const scope = engine.createScope(); scope.use(lease); scope.dispose();
  assert.deepEqual(disposed, ['scoped']);
  await engine.dispose(); await other.dispose();
});

test('Engine shutdown revokes unscoped leases before host.stop and cleans late results', async () => {
  const { engine, type, ref, trace } = await setup();
  const second = egret.createAssetRef(type, 'ui/pending');
  const tasks = [];
  engine.assets.register(type, { load: () => { const task = deferred(); tasks.push(task); return task.promise; }, dispose: value => trace.push(`dispose:${value.label}`) });
  const acquired = engine.assets.acquire(ref); tasks[0].resolve({ label: 'ready' });
  const lease = await acquired;
  const pending = rejects(engine.assets.acquire(second), 'ASSET_MANAGER_CLOSED');
  await engine.dispose(); await pending;
  assert.throws(() => lease.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.deepEqual(trace, ['dispose:ready', 'host.stop', 'host.close']);
  tasks[1].resolve({ label: 'late' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(trace, ['dispose:ready', 'host.stop', 'host.close', 'dispose:late']);
  await rejects(engine.assets.acquire(ref), 'ASSET_MANAGER_CLOSED');
});

test('asset cleanup failure cannot stop shutdown of other assets', async () => {
  const { engine, type, ref, trace } = await setup();
  engine.assets.register(type, { load: async ref => ({ label: ref.id }), dispose: value => { trace.push(value.label); if (value.label === 'ui/logo') throw new Error('cleanup failed'); } });
  await engine.assets.acquire(ref);
  await engine.assets.acquire(egret.createAssetRef(type, 'ui/other'));
  await assert.rejects(engine.dispose(), error => [error.cause, ...error.cleanupErrors].some(cause => cause?.message === 'cleanup failed'));
  assert.ok(trace.includes('ui/other')); assert.ok(trace.includes('host.close'));
  assert.equal(trace.filter(value => value === 'ui/logo').length, 1);
});
