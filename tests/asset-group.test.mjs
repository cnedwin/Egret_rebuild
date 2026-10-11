import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetLease, Bitmap, EgretError, Scope, copyImageData2DPixels, createAssetRef, createAssetType, createEngine, createImageData2D, createTexture, isTexture } from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

// Public CPU witnesses use genuine managers, references, leases and Scopes.
// Provider delays are explicit application inputs, never fake manager authority.
function expectError(action, code, cause) {
  const checkCause = arguments.length === 3;
  let caught;
  assert.throws(action, error => {
    caught = error;
    assert.ok(error instanceof EgretError);
    assert.equal(error.code, code);
    if (checkCause) assert.equal(error.cause, cause);
    return true;
  });
  return caught;
}
function observe(group) {
  return group.ready.then(value => ({ value }), error => ({ error }));
}
async function withEngine(run, options = {}) {
  const h = host(), engine = await createEngine({ host: h.adapter, ...options });
  try { await run(engine, h); }
  finally { await engine.dispose(); }
  assert.deepEqual(h.trace, ['start', 'stop', 'close']);
}
function numberProvider(engine, load = async ref => Number(ref.id)) {
  const type = createAssetType('RG1 number', value => typeof value === 'number');
  const loads = [], disposals = [];
  engine.assets.register(type, {
    load(ref, context) { loads.push({ id: ref.id, context }); return load(ref, context); },
    dispose(value) { disposals.push(value); },
  });
  return { type, loads, disposals, ref: id => createAssetRef(type, String(id)) };
}

test('RG01 genuine resource baseline precedes group order and duplicate entitlement', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope();
    const baseline = scope.use(await engine.assets.acquire(p.ref(9)));
    assert.equal(baseline.value, 9);
    assert.equal(typeof engine.createAssetGroup, 'function', 'RG1_MISSING_FACTORY');
    const group = engine.createAssetGroup(scope, [p.ref(2), p.ref(1), p.ref(2)]);
    const members = await group.ready;
    assert.equal(group.state, 'ready');
    assert.equal(Object.isFrozen(group), true);
    assert.equal(Object.isFrozen(members), true);
    assert.deepEqual(members.map(member => member.value), [2, 1, 2]);
    assert.ok(members.every(member => member instanceof AssetLease));
    assert.notEqual(members[0], members[2]);
    assert.deepEqual(p.loads.map(row => row.id), ['9', '2', '1']);
    members[0].release();
    expectError(() => members[0].value, 'ASSET_LEASE_RELEASED');
    assert.equal(members[2].value, 2);
    assert.equal(group.state, 'ready');
    group.dispose(); group.dispose();
    assert.equal(group.state, 'disposed');
    assert.deepEqual(p.disposals, [2, 1]);
    assert.equal(baseline.value, 9);
    scope.dispose();
    assert.deepEqual(p.disposals, [2, 1, 9]);
  });
});

test('RG01 out-of-order completions publish frozen input order only after every member', async () => {
  await withEngine(async engine => {
    const gates = [deferred(), deferred(), deferred()];
    const p = numberProvider(engine, ref => gates[Number(ref.id)].promise);
    const group = engine.createAssetGroup(engine.createScope(), [p.ref(0), p.ref(1), p.ref(2)]);
    const result = observe(group);
    gates[2].resolve(22); await flush(); assert.equal(group.state, 'pending');
    gates[0].resolve(11); await flush(); assert.equal(group.state, 'pending');
    gates[1].resolve(33);
    const members = (await result).value;
    assert.deepEqual(members.map(member => member.value), [11, 33, 22]);
    group.dispose();
    assert.deepEqual(p.disposals, [22, 33, 11]);
  });
});

test('RG02 empty and 128 occurrences are accepted while 129 starts no demand', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope();
    const empty = engine.createAssetGroup(scope, []);
    assert.equal(empty.state, 'ready');
    assert.deepEqual(await empty.ready, []);
    assert.equal(Object.isFrozen(await empty.ready), true);
    const ref = p.ref(7);
    expectError(() => engine.createAssetGroup(scope, Array(129).fill(ref)), 'ASSET_GROUP_REFS_INVALID');
    assert.equal(p.loads.length, 0);
    const group = engine.createAssetGroup(scope, Array(128).fill(ref));
    const members = await group.ready;
    assert.equal(members.length, 128);
    assert.equal(new Set(members).size, 128);
    assert.equal(p.loads.length, 1);
    group.dispose();
    assert.deepEqual(p.disposals, [7]);
  });
});

test('RG02 default four and explicit one/sixteen bound local unsettled waiter slots', async () => {
  for (const [options, first] of [[undefined, 4], [{ concurrency: 1 }, 1], [{ concurrency: 16 }, 16]]) {
    await withEngine(async engine => {
      const gates = Array.from({ length: 20 }, () => deferred());
      const p = numberProvider(engine, ref => gates[Number(ref.id)].promise);
      const group = engine.createAssetGroup(engine.createScope(), Array.from({ length: 20 }, (_, i) => p.ref(i)), options);
      assert.equal(p.loads.length, first);
      gates[0].resolve(0); await flush();
      assert.equal(p.loads.length, first + 1);
      for (let i = 1; i < 20; i++) gates[i].resolve(i);
      const members = await group.ready;
      assert.deepEqual(members.map(member => member.value), Array.from({ length: 20 }, (_, i) => i));
      group.dispose();
    });
  }
});

test('RG02 invalid options and non-array refs reject before providers', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope(), refs = [p.ref(1)];
    for (const options of [null, [], 4, 'x', { concurrency: null }, { concurrency: 0 }, { concurrency: 17 }, { concurrency: 1.5 }, { concurrency: NaN }, { concurrency: Infinity }]) {
      expectError(() => engine.createAssetGroup(scope, refs, options), 'ASSET_GROUP_OPTIONS_INVALID');
    }
    for (const refs of [null, {}, new Set([p.ref(1)]), [undefined], Array(1)]) {
      expectError(() => engine.createAssetGroup(scope, refs), Array.isArray(refs) && refs[0] === undefined && Object.hasOwn(refs, 0) ? 'ASSET_REF_INVALID' : 'ASSET_GROUP_REFS_INVALID');
    }
    assert.equal(p.loads.length, 0);
  });
});

test('RG03 whole-input genuine-reference preflight prevents queued load or identity mutation', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope(), queued = p.ref(11);
    expectError(() => engine.createAssetGroup(scope, [p.ref(1), { type: p.type, id: '2' }], { concurrency: 1 }), 'ASSET_REF_INVALID');
    const absent = createAssetType('RG1 missing', value => typeof value === 'number');
    expectError(() => engine.createAssetGroup(scope, [p.ref(1), createAssetRef(absent, '2')], { concurrency: 1 }), 'ASSET_PROVIDER_MISSING');
    const other = createAssetType('RG1 other', value => typeof value === 'number');
    engine.assets.register(other, { load: async () => 5, dispose() {} });
    expectError(() => engine.createAssetGroup(scope, [queued, createAssetRef(other, '11')], { concurrency: 1 }), 'ASSET_TYPE_MISMATCH');
    assert.equal(p.loads.length, 0);
    const lease = await engine.assets.acquire(createAssetRef(other, '11'));
    assert.equal(lease.resourceGeneration, 1);
    assert.equal(lease.leaseId, 1);
    assert.equal(lease.value, 5); lease.release();
    const group = engine.createAssetGroup(scope, [p.ref(1)]);
    assert.equal((await group.ready)[0].resourceGeneration, 1);
    assert.equal(p.loads[0].context.taskId, 2);
    group.dispose();
  });
});

test('RG03 persistent manager id/type mismatches are admitted without reserving fresh ids', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope();
    const existing = await engine.assets.acquire(p.ref(1)); existing.release();
    const other = createAssetType('RG1 persistent conflict', value => typeof value === 'number');
    engine.assets.register(other, { load: async () => 10, dispose() {} });
    expectError(() => engine.createAssetGroup(scope, [p.ref(2), createAssetRef(other, '1')], { concurrency: 1 }), 'ASSET_TYPE_MISMATCH');
    assert.deepEqual(p.loads.map(row => row.id), ['1']);
  });
});

test('RG04 fake and foreign Scopes are refused before structural getters', async () => {
  await withEngine(async engine => {
    const foreignHost = host(), foreign = await createEngine({ host: foreignHost.adapter });
    try {
      const p = numberProvider(engine); let reads = 0;
      const fake = { get state() { reads++; throw 1; }, get use() { reads++; throw 2; } };
      expectError(() => engine.createAssetGroup(fake, [p.ref(1)]), 'ASSET_GROUP_SCOPE_INVALID');
      expectError(() => engine.createAssetGroup(foreign.createScope(), [p.ref(1)]), 'ASSET_GROUP_SCOPE_INVALID');
      assert.equal(reads, 0); assert.equal(p.loads.length, 0);
      const closed = engine.createScope(); closed.dispose();
      expectError(() => engine.createAssetGroup(closed, [p.ref(1)]), 'SCOPE_CLOSED');
    } finally { await foreign.dispose(); }
  });
});

test('RG04 captured Scope and manager operations ignore own public overrides', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope();
    Object.defineProperty(scope, 'state', { get() { throw new Error('own state must not be read'); } });
    scope.use = () => { throw new Error('own use must not be called'); };
    engine.assets.acquire = () => { throw new Error('own acquire must not be called'); };
    const group = engine.createAssetGroup(scope, [p.ref(1)]);
    assert.equal((await group.ready)[0].value, 1);
    Scope.prototype.dispose.call(scope);
    assert.equal(group.state, 'disposed'); assert.deepEqual(p.disposals, [1]);
  });
});

test('RG05 own-index snapshot reads once and releases mutable array/options borrows', async () => {
  await withEngine(async engine => {
    const gate = deferred(), p = numberProvider(engine, ref => ref.id === '1' ? gate.promise : Promise.resolve(Number(ref.id)));
    const refs = [p.ref(1), p.ref(2)], reads = []; let concurrencyReads = 0, lengthReads = 0;
    Object.defineProperty(refs, '0', { get() { reads.push(0); return p.ref(1); }, configurable: true });
    Object.defineProperty(refs, '1', { get() { reads.push(1); return p.ref(2); }, configurable: true });
    const options = { get concurrency() { concurrencyReads++; return 1; }, get ignored() { throw 9; } };
    const proxy = new Proxy(refs, { get(target, key, receiver) {
      if (key === 'length') lengthReads++;
      if (key === Symbol.iterator) throw new Error('caller iterator must not be consumed');
      return Reflect.get(target, key, receiver);
    } });
    const group = engine.createAssetGroup(engine.createScope(), proxy, options);
    Object.defineProperty(refs, '1', { value: p.ref(99), configurable: true });
    gate.resolve(1);
    assert.deepEqual((await group.ready).map(member => member.value), [1, 2]);
    assert.deepEqual(reads, [0, 1]); assert.equal(concurrencyReads, 1); assert.equal(lengthReads, 1);
    group.dispose();
    const hole = Array(1); Object.setPrototypeOf(hole, { 0: p.ref(5) });
    expectError(() => engine.createAssetGroup(engine.createScope(), hole), 'ASSET_GROUP_REFS_INVALID');
  });
});

test('RG05 throwing getter and own-position traps retain undefined or prefer changed lifetime', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), open = engine.createScope();
    const throwing = [p.ref(1)]; Object.defineProperty(throwing, '0', { get() { throw undefined; } });
    expectError(() => engine.createAssetGroup(open, throwing), 'ASSET_GROUP_REFS_INVALID', undefined);
    expectError(() => engine.createAssetGroup(open, [p.ref(1)], { get concurrency() { throw undefined; } }), 'ASSET_GROUP_OPTIONS_INVALID', undefined);
    const closing = engine.createScope();
    const proxy = new Proxy([p.ref(1)], { getOwnPropertyDescriptor() { closing.dispose(); throw undefined; } });
    expectError(() => engine.createAssetGroup(closing, proxy), 'SCOPE_CLOSED');
    const other = engine.createScope(), refs = [p.ref(1)];
    Object.defineProperty(refs, '0', { get() { other.dispose(); throw 99; } });
    expectError(() => engine.createAssetGroup(other, refs), 'SCOPE_CLOSED');
    assert.equal(p.loads.length, 0);
  });
});

test('RG05 Engine lifetime outranks a throwing options getter', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine), scope = engine.createScope(); let close;
    expectError(() => engine.createAssetGroup(scope, [p.ref(1)], { get concurrency() { close = engine.dispose(); throw undefined; } }), 'ENGINE_CLOSED');
    assert.equal(p.loads.length, 0); await close;
  });
});

test('RG05 recursive admission refuses while separate provider-created groups activate', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope(); let nested, recur;
    const p = numberProvider(engine, async ref => {
      if (ref.id === '1') nested = engine.createAssetGroup(scope, [p.ref(2)]);
      return Number(ref.id);
    });
    const refs = [p.ref(1)];
    Object.defineProperty(refs, '0', { get() { recur = expectError(() => engine.createAssetGroup(scope, []), 'ASSET_GROUP_REENTRANT'); throw recur; } });
    const error = expectError(() => engine.createAssetGroup(scope, refs), 'ASSET_GROUP_REFS_INVALID');
    assert.equal(error.cause, recur); assert.equal(p.loads.length, 0);
    const group = engine.createAssetGroup(scope, [p.ref(1)]);
    assert.equal((await group.ready)[0].value, 1);
    assert.equal((await nested.ready)[0].value, 2);
    group.dispose(); nested.dispose();
  });
});

test('RG06 first observed failure stops queued work and retires prior successes promptly', async () => {
  await withEngine(async engine => {
    const gates = [deferred(), deferred(), deferred(), deferred()], failure = { why: 'provider failed' };
    const p = numberProvider(engine, ref => gates[Number(ref.id)].promise);
    const group = engine.createAssetGroup(engine.createScope(), [p.ref(0), p.ref(1), p.ref(2), p.ref(3)], { concurrency: 2 });
    const result = observe(group);
    gates[0].resolve(0); await flush(); assert.equal(p.loads.length, 3);
    gates[1].reject(failure);
    const error = (await result).error;
    assert.equal(group.state, 'failed'); assert.equal(error.code, 'ASSET_GROUP_ACQUIRE_FAILED');
    assert.equal(error.cause.code, 'ASSET_LOAD_FAILED'); assert.equal(error.cause.cause, failure);
    assert.deepEqual(p.loads.map(row => row.id), ['0', '1', '2']);
    assert.deepEqual(p.disposals, [0]);
    group.dispose(); assert.equal(group.state, 'failed');
    gates[2].resolve(2); await flush(); assert.deepEqual(p.disposals, [0, 2]);
    assert.equal((await observe(group)).error, error);
  });
});

test('RG06 provider undefined rejection stays an explicit nested cause', async () => {
  await withEngine(async engine => {
    const p = numberProvider(engine, async () => { throw undefined; });
    const group = engine.createAssetGroup(engine.createScope(), [p.ref(1)]);
    const error = (await observe(group)).error;
    assert.equal(error.code, 'ASSET_GROUP_ACQUIRE_FAILED');
    assert.equal(error.cause.code, 'ASSET_LOAD_FAILED'); assert.equal(error.cause.cause, undefined);
    assert.equal(group.state, 'failed');
  });
});

test('RG07 Scope disposal during a synchronous first loader owns and stops the inert group', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope(), gate = deferred();
    const p = numberProvider(engine, () => { scope.dispose(); return gate.promise; });
    const group = engine.createAssetGroup(scope, [p.ref(1), p.ref(2)], { concurrency: 1 });
    const error = (await observe(group)).error;
    assert.equal(group.state, 'disposed'); assert.equal(error.code, 'ASSET_GROUP_DISPOSED');
    assert.equal(error.cause.code, 'SCOPE_CLOSED'); assert.equal(p.loads.length, 1);
    gate.resolve(1); await flush(); assert.deepEqual(p.disposals, [1]);
  });
});

test('RG07 manual pending disposal settles readiness without a provider completion', async () => {
  await withEngine(async engine => {
    const gate = deferred(), p = numberProvider(engine, () => gate.promise);
    const group = engine.createAssetGroup(engine.createScope(), [p.ref(1), p.ref(2)], { concurrency: 1 });
    const result = observe(group); group.dispose(); group.dispose();
    const error = (await result).error;
    assert.equal(error.code, 'ASSET_GROUP_DISPOSED'); assert.equal(error.cause, undefined);
    assert.equal(group.state, 'disposed'); assert.equal(p.loads.length, 1);
    gate.resolve(1); await flush(); assert.deepEqual(p.disposals, [1]);
  });
});

test('RG07 a genuine lease delivered before disposal retires in its later group reaction', async () => {
  await withEngine(async engine => {
    const gate = deferred(), p = numberProvider(engine, () => gate.promise);
    const group = engine.createAssetGroup(engine.createScope(), [p.ref(7), p.ref(8)], { concurrency: 1 });
    const result = observe(group);
    assert.deepEqual(p.loads.map(row => row.id), ['7']);
    // The direct gate schedules manager receive first. This one already-resolved
    // await resumes after its genuine lease delivery, before the group reaction
    // that receive newly queued. No flush or provider wrapper widens that window.
    gate.resolve(7);
    await Promise.resolve();
    assert.equal(group.state, 'pending');
    assert.deepEqual(p.disposals, []);
    group.dispose();
    assert.equal(group.state, 'disposed');
    // Delivery removed the manager waiter; cancellation cannot retire its lease.
    // Its still-live final demand must be released by the later group reaction.
    assert.equal(p.loads[0].context.signal.aborted, false);
    assert.deepEqual(p.disposals, []);
    const error = (await result).error;
    assert.equal(error.code, 'ASSET_GROUP_DISPOSED'); assert.equal(error.cause, undefined);
    assert.equal(group.state, 'disposed');
    assert.deepEqual(p.disposals, [7]);
    assert.equal(p.loads[0].context.signal.aborted, true);
    assert.deepEqual(p.loads.map(row => row.id), ['7']);
    assert.equal((await observe(group)).error, error);
    group.dispose(); await flush();
    assert.deepEqual(p.disposals, [7]);
    assert.deepEqual(p.loads.map(row => row.id), ['7']);
  });
});

test('RG07 facade receiver checks remain readable/idempotent after cleanup', async () => {
  await withEngine(async engine => {
    const group = engine.createAssetGroup(engine.createScope(), []);
    const state = Object.getOwnPropertyDescriptor(group, 'state').get;
    const ready = Object.getOwnPropertyDescriptor(group, 'ready').get;
    expectError(() => state.call({}), 'ASSET_GROUP_INVALID');
    expectError(() => ready.call({}), 'ASSET_GROUP_INVALID');
    expectError(() => group.dispose.call({}), 'ASSET_GROUP_INVALID');
    group.dispose(); assert.equal(group.state, 'disposed'); assert.deepEqual(await group.ready, []);
  });
});

test('RG08 cancellation withdraws only group demand while external waiters and leases survive', async () => {
  await withEngine(async engine => {
    const gate = deferred(), p = numberProvider(engine, () => gate.promise), ref = p.ref(1);
    const external = engine.assets.acquire(ref);
    const group = engine.createAssetGroup(engine.createScope(), [ref, ref]);
    const result = observe(group); group.dispose();
    assert.equal((await result).error.code, 'ASSET_GROUP_DISPOSED');
    assert.equal(p.loads[0].context.signal.aborted, false);
    gate.resolve(1); const lease = await external; await flush();
    assert.equal(lease.value, 1); assert.deepEqual(p.disposals, []);
    const other = engine.createAssetGroup(engine.createScope(), [ref]);
    assert.equal((await other.ready)[0].value, 1); other.dispose();
    assert.equal(lease.value, 1); assert.deepEqual(p.disposals, []);
    lease.release(); assert.deepEqual(p.disposals, [1]);
  });
});

test('RG09 group members refuse Scope re-adoption while genuine Bitmap borrows remain valid', async () => {
  await withEngine(async engine => {
    const type = createAssetType('RG1 texture', isTexture);
    const image = createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([10, 20, 30, 255]) });
    let disposed = 0;
    engine.assets.register(type, { load: async () => createTexture(image), dispose(texture) { disposed++; texture.dispose(); } });
    const scope = engine.createScope(), other = engine.createScope();
    const group = engine.createAssetGroup(scope, [createAssetRef(type, 'pixel')]);
    const member = (await group.ready)[0];
    expectError(() => scope.use(member), 'OWNERSHIP_CONFLICT');
    expectError(() => other.use(member), 'OWNERSHIP_CONFLICT');
    const bitmap = scope.use(new Bitmap(member)); engine.stage.addChild(bitmap);
    const frame = engine.captureFrame({ width: 2, height: 2 });
    assert.equal(frame.commands.length, 1); assert.equal(frame.images.length, 1);
    assert.equal(frame.commands[0].kind, 'image');
    scope.dispose(); assert.equal(group.state, 'disposed'); assert.equal(disposed, 1);
    expectError(() => member.value, 'ASSET_LEASE_RELEASED');
  });
});

test('RG09 manager-caught disposal faults retain original diagnostics and every release attempt', async () => {
  const diagnostics = [], disposalOrder = [], fault = { disposal: true };
  await withEngine(async engine => {
    const type = createAssetType('RG1 dispose failure', value => typeof value === 'number');
    engine.assets.register(type, { load: async ref => Number(ref.id), dispose(value) { disposalOrder.push(value); throw fault; } });
    const group = engine.createAssetGroup(engine.createScope(), [1, 2, 3].map(id => createAssetRef(type, String(id))));
    const ready = await group.ready; group.dispose();
    assert.equal(group.state, 'disposed'); assert.equal(await group.ready, ready);
    assert.deepEqual(disposalOrder, [3, 2, 1]);
    assert.deepEqual(diagnostics.map(row => row.code), ['ASSET_CLEANUP_FAILED', 'ASSET_CLEANUP_FAILED', 'ASSET_CLEANUP_FAILED']);
    assert.ok(diagnostics.every(row => row.cause === fault));
  }, { onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
});

test('RG10 invalidation between queued starts preserves each actual resource generation', async () => {
  await withEngine(async engine => {
    const gates = [deferred(), deferred()]; let n = 0;
    const p = numberProvider(engine, () => gates[n++].promise), ref = p.ref(4);
    const group = engine.createAssetGroup(engine.createScope(), [ref, ref], { concurrency: 1 });
    engine.assets.invalidate(ref); gates[0].resolve(4); await flush();
    assert.equal(p.loads.length, 2); gates[1].resolve(40);
    const members = await group.ready;
    assert.deepEqual(members.map(member => [member.value, member.resourceGeneration]), [[4, 1], [40, 2]]);
    group.dispose(); assert.deepEqual(p.disposals, [40, 4]);
  });
});

test('RG10 unrelated post-admission id/type race fails through original acquire', async () => {
  await withEngine(async engine => {
    const gate = deferred(), p = numberProvider(engine, () => gate.promise), scope = engine.createScope();
    const other = createAssetType('RG1 identity racer', value => typeof value === 'number');
    engine.assets.register(other, { load: async () => 99, dispose() {} });
    const group = engine.createAssetGroup(scope, [p.ref(1), p.ref(2)], { concurrency: 1 }), result = observe(group);
    const external = await engine.assets.acquire(createAssetRef(other, '2'));
    gate.resolve(1);
    const error = (await result).error;
    assert.equal(error.code, 'ASSET_GROUP_ACQUIRE_FAILED'); assert.equal(error.cause.code, 'ASSET_TYPE_MISMATCH');
    assert.deepEqual(p.loads.map(row => row.id), ['1']); assert.deepEqual(p.disposals, [1]);
    assert.equal(external.value, 99); external.release();
  });
});

test('RG11 Engine close marks every group terminal before provider hooks and waits for no provider', async () => {
  const h = host(), engine = await createEngine({ host: h.adapter });
  const observations = [], never = new Promise(() => {}); let first, second;
  const p = numberProvider(engine, (_ref, context) => {
    context.signal.addEventListener('abort', () => observations.push([first.state, second.state]));
    return never;
  });
  try {
    first = engine.createAssetGroup(engine.createScope(), [p.ref(1)]);
    second = engine.createAssetGroup(engine.createScope(), [p.ref(2)]);
    const outcomes = [observe(first), observe(second)];
    const close = engine.dispose();
    assert.equal(first.state, 'disposed'); assert.equal(second.state, 'disposed');
    assert.deepEqual(observations, [['disposed', 'disposed'], ['disposed', 'disposed']]);
    for (const outcome of await Promise.all(outcomes)) {
      assert.equal(outcome.error.code, 'ASSET_GROUP_DISPOSED'); assert.equal(outcome.error.cause.code, 'ENGINE_CLOSED');
    }
    assert.equal(engine.dispose(), close); await close;
    assert.deepEqual(h.trace, ['start', 'stop', 'close']);
  } finally { await engine.dispose(); }
});

test('RG11 manager provider abort-hook disposal may win before group rejection observation', async () => {
  await withEngine(async engine => {
    const gate = deferred(), scope = engine.createScope(); let group;
    const p = numberProvider(engine, (_ref, context) => {
      context.signal.addEventListener('abort', () => group.dispose()); return gate.promise;
    });
    group = engine.createAssetGroup(scope, [p.ref(1)]);
    const result = observe(group); gate.reject('rejection precedes reaction');
    const error = (await result).error;
    assert.equal(group.state, 'disposed'); assert.equal(error.code, 'ASSET_GROUP_DISPOSED'); assert.equal(error.cause, undefined);
  });
});

test('RG11 Engine close during the first loader prevents the remaining queue', async () => {
  const h = host(), engine = await createEngine({ host: h.adapter });
  const gate = deferred(); let close;
  const p = numberProvider(engine, () => { close = engine.dispose(); return gate.promise; });
  const group = engine.createAssetGroup(engine.createScope(), [p.ref(1), p.ref(2)]);
  const error = (await observe(group)).error;
  assert.equal(group.state, 'disposed'); assert.equal(error.code, 'ASSET_GROUP_DISPOSED');
  assert.equal(error.cause.code, 'ENGINE_CLOSED'); assert.equal(p.loads.length, 1);
  await close; gate.resolve(1); await flush();
  assert.deepEqual(p.disposals, [1]); assert.deepEqual(h.trace, ['start', 'stop', 'close']);
});

test('RG11 Engine retains manager disposal causes while every ready group retires', async () => {
  const h = host(), diagnostics = [], faults = [{ id: 1 }, { id: 2 }], order = [];
  const engine = await createEngine({ host: h.adapter, onDiagnostic: row => diagnostics.push(row) });
  const type = createAssetType('RG1 shutdown disposer', value => typeof value === 'number');
  engine.assets.register(type, { load: async ref => Number(ref.id), dispose(value) { order.push(value); throw faults[value - 1]; } });
  const first = engine.createAssetGroup(engine.createScope(), [createAssetRef(type, '1')]);
  const second = engine.createAssetGroup(engine.createScope(), [createAssetRef(type, '2')]);
  await Promise.all([first.ready, second.ready]);
  let error;
  await assert.rejects(engine.dispose(), failure => { error = failure; return true; });
  assert.equal(first.state, 'disposed'); assert.equal(second.state, 'disposed');
  assert.deepEqual(order, [1, 2]);
  assert.equal(error.code, 'ENGINE_CLOSE_FAILED'); assert.equal(error.cause, faults[0]); assert.deepEqual(error.cleanupErrors, [faults[1]]);
  assert.deepEqual(diagnostics.map(row => row.code), ['ASSET_CLEANUP_FAILED', 'ASSET_CLEANUP_FAILED']);
  assert.deepEqual(h.trace, ['start', 'stop', 'close']);
});

test('RG12 two provider-backed textures capture a real CPU scene and retire with its Scope', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope(), type = createAssetType('RG1 two-texture scene', isTexture), disposals = [];
    engine.assets.register(type, {
      async load(ref) {
        const pixels = ref.id === 'red' ? new Uint8Array([220, 40, 40, 255]) : new Uint8Array([40, 80, 220, 255]);
        return createTexture(createImageData2D({ width: 1, height: 1, pixels }));
      },
      dispose(texture) { disposals.push(Array.from(copyImageData2DPixels(texture.imageData))); texture.dispose(); },
    });
    const group = engine.createAssetGroup(scope, [createAssetRef(type, 'red'), createAssetRef(type, 'blue')]);
    const members = await group.ready, red = scope.use(new Bitmap(members[0])), blue = scope.use(new Bitmap(members[1]));
    blue.x = 1; engine.stage.addChild(red); engine.stage.addChild(blue);
    const frame = engine.captureFrame({ width: 2, height: 1 });
    assert.deepEqual(frame.commands.map(command => [command.kind, command.imageIndex, command.matrix.tx]), [['image', 0, 0], ['image', 1, 1]]);
    assert.deepEqual(frame.images.map(image => Array.from(copyImageData2DPixels(image))), [[220, 40, 40, 255], [40, 80, 220, 255]]);
    scope.dispose();
    assert.equal(group.state, 'disposed'); assert.equal(red.isDisposed, true); assert.equal(blue.isDisposed, true);
    assert.deepEqual(disposals, [[40, 80, 220, 255], [220, 40, 40, 255]]);
    assert.deepEqual(Array.from(copyImageData2DPixels(frame.images[0])), [220, 40, 40, 255]);
  });
});
