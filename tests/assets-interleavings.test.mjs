import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { deferred, host, flush } from './helpers.mjs';

async function setup(validate = value => typeof value === 'number', onDiagnostic) {
  assert.equal(typeof egret.createAssetType, 'function', 'typed asset service must be exported');
  const adapter = host();
  const engine = await egret.createEngine({ host: adapter.adapter, onDiagnostic });
  const type = egret.createAssetType('number', validate);
  return { engine, type, ref: egret.createAssetRef(type, 'number'), trace: adapter.trace };
}

test('asset factories reject blank identities and forged descriptors; valid whitespace is preserved', async () => {
  const { engine, type } = await setup();
  assert.throws(() => egret.createAssetType('   ', x => true), { code: 'ASSET_TYPE_INVALID' });
  assert.throws(() => egret.createAssetRef(type, ''), { code: 'ASSET_REF_INVALID' });
  assert.throws(() => egret.createAssetRef({ name: 'number', is: x => true }, 'forged'), { code: 'ASSET_TYPE_INVALID' });
  const ref = egret.createAssetRef(type, ' spaced ');
  assert.equal(ref.id, ' spaced ');
  assert.ok(Object.isFrozen(ref)); assert.ok(Object.isFrozen(type));
  await engine.dispose();
});

test('provider callback replacement after registration cannot change the registered task', async () => {
  const { engine, type, ref } = await setup();
  const disposed = [];
  const source = { load: async () => 1, dispose: value => disposed.push(value) };
  engine.assets.register(type, source);
  source.load = async () => 2; source.dispose = () => { throw new Error('replaced'); };
  assert.throws(() => engine.assets.register(type, source), { code: 'ASSET_PROVIDER_REGISTERED' });
  const lease = await engine.assets.acquire(ref); assert.equal(lease.value, 1);
  lease.release(); assert.deepEqual(disposed, [1]);
  await engine.dispose();
  assert.throws(() => engine.assets.register(type, source), { code: 'ASSET_MANAGER_CLOSED' });
});

test('captured loader ignores a later own call property while retaining its provider receiver', async () => {
  const { engine, type, ref } = await setup();
  const source = { expected: 13, async load() { return this.expected; }, dispose() {} };
  engine.assets.register(type, source);
  source.load.call = () => Promise.resolve(14);
  const lease = await engine.assets.acquire(ref);
  assert.equal(lease.value, 13);
  lease.release(); await engine.dispose();
});

test('captured disposer ignores a later own call property while retaining its provider receiver', async () => {
  const { engine, type, ref } = await setup(); const disposed = [];
  const source = { label: 'provider', load: async () => 15, dispose(value) { disposed.push([this.label, value]); } };
  engine.assets.register(type, source);
  source.dispose.call = () => {};
  const lease = await engine.assets.acquire(ref);
  lease.release(); assert.deepEqual(disposed, [['provider', 15]]);
  await engine.dispose();
});

test('synchronous loader throw is an EgretError and the next acquisition retries', async () => {
  const { engine, type, ref } = await setup();
  let count = 0;
  engine.assets.register(type, { load: () => { if (++count === 1) throw new Error('sync'); return Promise.resolve(2); }, dispose: () => {} });
  await assert.rejects(engine.assets.acquire(ref), { code: 'ASSET_LOAD_FAILED' });
  const lease = await engine.assets.acquire(ref); assert.equal(lease.value, 2); lease.release();
  await engine.dispose();
});

test('validator cancellation cannot deliver a value after its waiter loses the race', async () => {
  const controller = new egret.CancellationController();
  const { engine, type, ref } = await setup(value => { controller.abort('validator'); return typeof value === 'number'; });
  const disposed = [];
  engine.assets.register(type, { load: async () => 3, dispose: value => disposed.push(value) });
  await assert.rejects(engine.assets.acquire(ref, { signal: controller.signal }), { code: 'ASSET_ACQUIRE_CANCELLED' });
  await flush(); assert.deepEqual(disposed, [3]);
  await engine.dispose();
});

test('validator manager close cleans the received value once and rejects pending demand', async () => {
  let engine;
  const fixture = await setup(value => { engine.assets.dispose(); return typeof value === 'number'; });
  engine = fixture.engine;
  const disposed = [];
  engine.assets.register(fixture.type, { load: async () => 4, dispose: value => disposed.push(value) });
  await assert.rejects(engine.assets.acquire(fixture.ref), { code: 'ASSET_MANAGER_CLOSED' });
  await flush(); assert.deepEqual(disposed, [4]);
  await engine.dispose();
});

test('throwing validator still transfers the returned value into one cleanup attempt', async () => {
  const cause = new Error('validator');
  const { engine, type, ref } = await setup(() => { throw cause; });
  const disposed = [];
  engine.assets.register(type, { load: async () => 5, dispose: value => disposed.push(value) });
  await assert.rejects(engine.assets.acquire(ref), error => error.code === 'ASSET_VALUE_INVALID' && error.cause === cause);
  assert.deepEqual(disposed, [5]); await engine.dispose();
});

test('failed listener registration rolls back demand and detaches a partially installed listener', async () => {
  const diagnostics = [], listeners = new Set(); let loads = 0;
  const { engine, type, ref } = await setup(undefined, diagnostic => diagnostics.push(diagnostic));
  engine.assets.register(type, { load: async () => { loads++; return 6; }, dispose: () => {} });
  const signal = { aborted: false, reason: undefined, addEventListener: (_type, listener) => { listeners.add(listener); throw new Error('add'); }, removeEventListener: (_type, listener) => listeners.delete(listener) };
  await assert.rejects(engine.assets.acquire(ref, { signal }), { code: 'ASSET_SIGNAL_FAILED' });
  assert.equal(loads, 0); assert.equal(listeners.size, 0);
  assert.ok(diagnostics.some(diagnostic => diagnostic.phase === 'assets' && diagnostic.cause.message === 'add'));
  const lease = await engine.assets.acquire(ref); lease.release(); await engine.dispose();
});

test('an EgretError thrown by a signal getter remains an adapter failure with diagnostics', async () => {
  const diagnostics = []; let loads = 0;
  const cause = new egret.EgretError('APPLICATION_ADAPTER_ERROR');
  const { engine, type, ref } = await setup(undefined, diagnostic => diagnostics.push(diagnostic));
  engine.assets.register(type, { load: async () => { loads++; return 6; }, dispose: () => {} });
  const signal = { get aborted() { throw cause; }, reason: undefined, addEventListener() {}, removeEventListener() {} };
  await assert.rejects(engine.assets.acquire(ref, { signal }), error => error.code === 'ASSET_SIGNAL_FAILED' && error.cause === cause);
  assert.equal(loads, 0);
  assert.ok(diagnostics.some(diagnostic => diagnostic.phase === 'assets' && diagnostic.cause === cause));
  await engine.dispose();
});

test('failed listener removal rejects the pending waiter without leaving demand or duplicate cleanup', async () => {
  const diagnostics = [], disposed = [];
  const { engine, type, ref } = await setup(undefined, diagnostic => diagnostics.push(diagnostic));
  const task = deferred();
  engine.assets.register(type, { load: () => task.promise, dispose: value => disposed.push(value) });
  let listener;
  const signal = { aborted: false, reason: undefined, addEventListener: (_type, callback) => { listener = callback; }, removeEventListener: () => { throw new Error('remove'); } };
  const pending = assert.rejects(engine.assets.acquire(ref, { signal }), { code: 'ASSET_SIGNAL_FAILED' });
  task.resolve(7); await pending;
  listener(); await flush(); assert.deepEqual(disposed, [7]);
  assert.ok(diagnostics.some(diagnostic => diagnostic.phase === 'assets' && diagnostic.cause.message === 'remove'));
  await engine.dispose();
});

test('listener registration reentry closing the manager starts no provider work', async () => {
  const { engine, type, ref } = await setup(); let loads = 0, removals = 0;
  engine.assets.register(type, { load: async () => { loads++; return 8; }, dispose: () => {} });
  const signal = { aborted: false, reason: undefined, addEventListener: () => engine.assets.dispose(), removeEventListener: () => { removals++; } };
  await assert.rejects(engine.assets.acquire(ref, { signal }), { code: 'ASSET_MANAGER_CLOSED' });
  assert.equal(loads, 0); assert.equal(removals, 1);
  await engine.dispose();
});

test('last cancellation commits retirement before provider abort listener reenters', async () => {
  const { engine, type, ref } = await setup(); const tasks = []; let nested;
  engine.assets.register(type, { load: (_ref, context) => {
    const task = deferred(); tasks.push(task);
    context.signal.addEventListener('abort', () => { if (tasks.length === 1) nested = engine.assets.acquire(ref); });
    return task.promise;
  }, dispose: () => {} });
  const controller = new egret.CancellationController();
  const pending = assert.rejects(engine.assets.acquire(ref, { signal: controller.signal }), { code: 'ASSET_ACQUIRE_CANCELLED' });
  controller.abort(); assert.equal(tasks.length, 2);
  tasks[0].reject(new Error('late failure')); tasks[1].resolve(9);
  const lease = await nested; await pending; assert.equal(lease.value, 9);
  lease.release(); await engine.dispose();
});

test('throwing diagnostics observer does not prevent the remaining shutdown cleanup', async () => {
  const { engine, type, ref } = await setup(undefined, () => { throw new Error('observer'); });
  const disposed = [];
  engine.assets.register(type, { load: async ref => ref.id === 'number' ? 10 : 11, dispose: value => { disposed.push(value); if (value === 10) throw new Error('cleanup'); } });
  const one = await engine.assets.acquire(ref);
  const two = await engine.assets.acquire(egret.createAssetRef(type, 'other'));
  await assert.rejects(engine.dispose(), error => [error.cause, ...error.cleanupErrors].some(cause => cause.message === 'cleanup'));
  assert.deepEqual(disposed, [10, 11]);
  assert.throws(() => one.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.throws(() => two.value, { code: 'ASSET_LEASE_RELEASED' });
});

test('late Scope.use after shutdown observes an already revoked lease and cleans idempotently', async () => {
  const { engine, type, ref } = await setup(); const disposed = [];
  engine.assets.register(type, { load: async () => 12, dispose: value => disposed.push(value) });
  const scope = engine.createScope();
  const promise = engine.assets.acquire(ref, { signal: scope.signal });
  await flush(); await engine.dispose();
  const lease = await promise;
  assert.throws(() => scope.use(lease), { code: 'SCOPE_CLOSED' });
  assert.throws(() => lease.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.deepEqual(disposed, [12]);
});
