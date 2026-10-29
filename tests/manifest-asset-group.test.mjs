// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';
import { description, entry, clone, ABC_SHA256 } from './fixtures/resource-manifest.mjs';

// Absence is asserted below after genuine Engine construction. Import failures
// are diagnostic context, never accepted as ownership or behavior evidence.
const resources = await import('@egret/engine/resources').catch(error => ({ missing: error.message }));
const contracts = await import('@egret/contracts/resources').catch(error => ({ missing: error.message }));

function api(engine) {
  assert.equal(typeof engine.createManifestGroup, 'function', 'M15_GROUP_FACTORY_MISSING');
  assert.equal(typeof resources.createManifestAssetBinding, 'function', 'M15_BINDING_FACTORY_MISSING: ' + (resources.missing ?? ''));
  assert.equal(typeof contracts.buildResourceManifest, 'function', 'M15_MANIFEST_BUILD_MISSING: ' + (contracts.missing ?? ''));
}
function refused(action, message = 'invalid manifest operation must refuse') {
  let observed;
  assert.throws(action, error => {
    observed = error;
    assert.ok(error instanceof egret.EgretError, message);
    return true;
  }, message);
  return observed;
}
function observe(group) { return group.ready.then(value => ({ ok: true, value }), error => ({ ok: false, error })); }
function rawGraph(rows) {
  return description(rows.map(row => {
    const [id, dependencies = []] = Array.isArray(row) ? row : [row];
    const value = entry(id, dependencies);
    const suffix = id.slice(2);
    value.source.id = 'f_source_' + suffix; value.source.path = 'sources/' + suffix + '.txt';
    value.artifact.id = 'f_artifact_' + suffix; value.artifact.path = 'assets/' + suffix + '.txt';
    return value;
  }));
}
function build(engine, rows, mutate) {
  api(engine);
  const input = rawGraph(rows); mutate?.(input);
  const result = contracts.buildResourceManifest(input);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.value;
}
function bind(manifest, provider, ids = manifest.entries.map(value => value.id)) {
  return Object.fromEntries(ids.map(id => {
    const binding = resources.createManifestAssetBinding(manifest, id, provider.type);
    provider.labels.set(binding.ref.id, id);
    return [id, binding];
  }));
}
function controlled(engine, inventory, { name = 'M15 controlled value', onLoad, onDispose } = {}) {
  const marker = {}, loads = [], disposals = [], labels = new Map();
  const type = egret.createAssetType(name, value => value !== null && typeof value === 'object' && value.marker === marker);
  const source = {
    type, loads, disposals, labels,
    finish(row) { if (!row.done) { row.done = true; row.pending.resolve(row.value); } },
    fail(row, cause) { if (!row.done) { row.done = true; row.pending.reject(cause); } },
    drain() { for (const row of loads) source.finish(row); },
  };
  engine.assets.register(type, {
    load(ref, context) {
      const pending = deferred();
      const row = { ref, context, pending, done: false, name: labels.get(ref.id) ?? ref.id,
        value: Object.freeze({ marker, serial: loads.length + 1 }) };
      loads.push(row); onLoad?.(row); return pending.promise;
    },
    dispose(value) { disposals.push(value); onDispose?.(value); },
  });
  inventory.push(source);
  return source;
}
async function withEngine(run) {
  const h = host(), engine = await egret.createEngine({ host: h.adapter }), providers = [];
  let primary, cleanup;
  try { await run(engine, options => controlled(engine, providers, options), h); }
  catch (cause) { primary = { cause }; }
  try {
    const closing = engine.dispose();
    for (const provider of providers) provider.drain();
    await closing; await flush();
    assert.deepEqual(h.trace, ['start', 'stop', 'close']);
    assert.equal(h.timers.size, 0);
  } catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'M15_GROUP_BODY_AND_CLEANUP_FAILED');
  if (primary) throw primary.cause;
  if (cleanup) throw cleanup.cause;
}
async function finishCount(provider, count, offset = 0) {
  for (let index = offset; index < offset + count; index++) {
    assert.ok(provider.loads[index], 'expected dependency-ready provider start ' + index);
    provider.finish(provider.loads[index]); await flush();
  }
}

test('M15-G01 genuine Engine explicitly reports missing manifest-group capability first', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), ref = egret.createAssetRef(p.type, 'baseline');
    const pending = engine.assets.acquire(ref); p.finish(p.loads[0]);
    const lease = await pending; assert.ok(lease instanceof egret.AssetLease); lease.release();
    assert.equal(typeof engine.createManifestGroup, 'function', 'M15_GROUP_FACTORY_MISSING');
    api(engine);
    assert.deepEqual(Object.keys(resources).sort(), ['createContentLoader', 'createManifestAssetBinding']);
    assert.equal(Object.hasOwn(egret, 'createManifestAssetBinding'), false, 'factory stays in optional entry');
  });
});

test('M15-G02 binding authenticity precedes counterfeit getters and genuine type names do not alias', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a']);
    let reads = 0;
    const fakeManifest = { get entries() { reads++; throw Error('untrusted manifest getter'); } };
    refused(() => resources.createManifestAssetBinding(fakeManifest, 'e_a', p.type));
    const fakeType = { get name() { reads++; throw Error('untrusted type getter'); }, get is() { reads++; throw Error('untrusted predicate getter'); } };
    refused(() => resources.createManifestAssetBinding(manifest, 'e_a', fakeType));
    assert.equal(reads, 0); assert.equal(p.loads.length, 0);
    const a = bind(manifest, p).e_a;
    assert.equal(Object.isFrozen(a), true); assert.equal(Object.isFrozen(a.ref), true);
    refused(() => resources.createManifestAssetBinding(manifest, 'e_absent', p.type));
  });
});

test('M15-G03 complete content and genuine type partition refs while equal identities coalesce', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider({ name: 'same name' }), q = provider({ name: 'same name' });
    const first = build(engine, ['e_a']), equal = build(engine, ['e_a']);
    const changed = build(engine, ['e_a'], input => {
      input.entries[0].artifact.sha256 = ABC_SHA256; input.entries[0].artifact.byteLength = 3;
    });
    assert.equal(first.entries[0].buildKey, changed.entries[0].buildKey);
    assert.notEqual(first.entries[0].runtimeIdentity, changed.entries[0].runtimeIdentity);
    const a = bind(first, p).e_a, b = bind(equal, p).e_a, c = bind(changed, p).e_a, d = bind(first, q).e_a;
    assert.equal(a.ref.id, b.ref.id); assert.notEqual(a.ref.id, c.ref.id); assert.notEqual(a.ref.id, d.ref.id);
    const scope = engine.createScope();
    const ga = engine.createManifestGroup(scope, first, ['e_a'], [a]);
    const gb = engine.createManifestGroup(scope, equal, ['e_a'], [b]);
    const gc = engine.createManifestGroup(scope, changed, ['e_a'], [c]);
    const gd = engine.createManifestGroup(scope, first, ['e_a'], [d]);
    assert.equal(p.loads.length, 2); assert.equal(q.loads.length, 1);
    p.drain(); q.drain(); await Promise.all([ga.ready, gb.ready, gc.ready, gd.ready]);
    const la = ga.get(a), lb = gb.get(b), lc = gc.get(c), ld = gd.get(d);
    assert.notEqual(la, lb); assert.notEqual(la.leaseId, lb.leaseId);
    assert.equal(la.value, lb.value); assert.equal(la.resourceGeneration, lb.resourceGeneration);
    assert.notEqual(la.value, lc.value); assert.notEqual(la.value, ld.value);
    ga.dispose(); assert.equal(lb.value, p.loads[0].value); assert.equal(p.disposals.length, 0);
    gb.dispose(); gc.dispose(); gd.dispose();
    assert.equal(p.disposals.length, 2); assert.equal(q.disposals.length, 1);
  });
});

test('M15-G04 heterogeneous diamond starts dependencies first and overlapping groups own separate leases', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), q = provider({ name: 'root value' });
    const manifest = build(engine, ['e_shared', ['e_left', ['e_shared']], ['e_right', ['e_shared']], ['e_root', ['e_left', 'e_right']]]);
    const b = { ...bind(manifest, p, ['e_shared', 'e_left', 'e_right']), ...bind(manifest, q, ['e_root']) };
    const scope = engine.createScope();
    const a = engine.createManifestGroup(scope, manifest, ['e_root'], Object.values(b));
    const c = engine.createManifestGroup(scope, manifest, ['e_root', 'e_left'], Object.values(b));
    assert.deepEqual(p.loads.map(row => row.name), ['e_shared']); assert.equal(q.loads.length, 0);
    p.finish(p.loads[0]); await flush();
    assert.deepEqual(p.loads.map(row => row.name), ['e_shared', 'e_left', 'e_right']);
    p.finish(p.loads[1]); await flush(); assert.equal(q.loads.length, 0);
    p.finish(p.loads[2]); await flush(); assert.deepEqual(q.loads.map(row => row.name), ['e_root']);
    q.finish(q.loads[0]); assert.equal(await a.ready, undefined); await c.ready;
    for (const binding of Object.values(b)) {
      const one = a.get(binding), two = c.get(binding);
      assert.ok(one instanceof egret.AssetLease); assert.notEqual(one, two); assert.equal(one.value, two.value);
    }
    a.dispose(); assert.equal(p.disposals.length, 0); assert.equal(q.disposals.length, 0);
    c.dispose(); assert.equal(p.disposals.length, 3); assert.equal(q.disposals.length, 1);
  });
});

test('M15-G05 whole closure admission refuses invalid late bindings before any provider effect', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_dep', ['e_root', ['e_dep']], 'e_extra']);
    const b = bind(manifest, p), scope = engine.createScope();
    const equal = build(engine, ['e_dep', ['e_root', ['e_dep']], 'e_extra']), foreign = bind(equal, p);
    let reads = 0;
    const counterfeit = { get ref() { reads++; throw Error('counterfeit read'); } };
    const cases = [
      () => engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_root]),
      () => engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_dep, b.e_root, b.e_extra]),
      () => engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_dep, b.e_root, b.e_root]),
      () => engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_dep, foreign.e_root]),
      () => engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_dep, counterfeit]),
      () => engine.createManifestGroup(scope, manifest, ['e_missing'], [b.e_dep]),
      () => engine.createManifestGroup(scope, manifest, ['e_root', 'e_root'], [b.e_dep, b.e_root]),
      () => engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_dep, b.e_root], { priority: 'urgent' }),
      () => engine.createManifestGroup(scope, clone(manifest), ['e_root'], [b.e_dep, b.e_root]),
    ];
    for (const run of cases) { refused(run); assert.equal(p.loads.length, 0); }
    const sparse = [b.e_dep, b.e_root]; delete sparse[1];
    refused(() => engine.createManifestGroup(scope, manifest, ['e_root'], sparse));
    assert.equal(reads, 0); assert.equal(p.loads.length, 0);
    const valid = engine.createManifestGroup(scope, manifest, ['e_root'], [b.e_dep, b.e_root]);
    await finishCount(p, 2); await valid.ready; valid.dispose();
  });
});

test('M15-G06 entire closure needs registered providers before any earlier resource begins', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a', 'e_b']), b = bind(manifest, p, ['e_a']);
    const missing = egret.createAssetType('not registered', value => typeof value === 'number');
    const later = resources.createManifestAssetBinding(manifest, 'e_b', missing);
    const scope = engine.createScope();
    refused(() => engine.createManifestGroup(scope, manifest, ['e_a', 'e_b'], [b.e_a, later]));
    assert.equal(p.loads.length, 0);
    const good = engine.createManifestGroup(scope, manifest, ['e_a'], [b.e_a]);
    p.finish(p.loads[0]); await good.ready;
  });
});

test('M15-G07 empty and 128-member closure work; 129-member closure refuses before acquisition', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), ids = Array.from({ length: 129 }, (_, i) => 'e_n' + i), manifest = build(engine, ids), b = bind(manifest, p);
    const scope = engine.createScope(), empty = engine.createManifestGroup(scope, manifest, [], []);
    assert.equal(await empty.ready, undefined); assert.equal(p.loads.length, 0);
    refused(() => engine.createManifestGroup(scope, manifest, ids, Object.values(b)));
    assert.equal(p.loads.length, 0);
    const group = engine.createManifestGroup(scope, manifest, ids.slice(0, 128), ids.slice(0, 128).map(id => b[id]));
    assert.equal(p.loads.length, 4);
    await finishCount(p, 128); await group.ready;
    assert.equal(new Set(ids.slice(0, 128).map(id => group.get(b[id]).leaseId)).size, 128);
  });
});

test('M15-G08 Engine-wide four active excludes exactly 128 queued including dependency-blocked records', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), hold = Array.from({ length: 4 }, (_, i) => 'e_hold' + i);
    const leaves = Array.from({ length: 127 }, (_, i) => 'e_leaf' + i);
    const manifest = build(engine, [...hold, ...leaves, ['e_join', leaves], 'e_excess']), b = bind(manifest, p), scope = engine.createScope();
    const first = engine.createManifestGroup(scope, manifest, hold, hold.map(id => b[id]));
    assert.equal(p.loads.length, 4);
    const selected = [...leaves, 'e_join'];
    const queued = engine.createManifestGroup(scope, manifest, ['e_join'], selected.map(id => b[id]));
    const pending = observe(queued);
    refused(() => engine.createManifestGroup(scope, manifest, ['e_excess'], [b.e_excess]));
    assert.equal(p.loads.length, 4, 'queue overflow starts no provider and performs no over-reservation');
    queued.dispose(); assert.equal((await pending).ok, false);
    const replacement = engine.createManifestGroup(scope, manifest, ['e_join'], selected.map(id => b[id]));
    assert.equal(p.loads.length, 4, 'disposing queued closure returns all 128 reserved records');
    replacement.dispose(); first.dispose(); await flush();
    const recovered = engine.createManifestGroup(scope, manifest, ['e_excess'], [b.e_excess]);
    assert.equal(p.loads.at(-1).name, 'e_excess'); p.finish(p.loads.at(-1)); await recovered.ready;
  });
});

test('M15-G09 eligible FIFO dispatch is four interactive then one background without preemption', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), hold = Array.from({ length: 4 }, (_, i) => 'e_hold' + i);
    const foreground = Array.from({ length: 8 }, (_, i) => 'e_i' + i), background = Array.from({ length: 3 }, (_, i) => 'e_b' + i);
    const manifest = build(engine, [...hold, ...foreground, ...background]), b = bind(manifest, p), scope = engine.createScope();
    engine.createManifestGroup(scope, manifest, hold, hold.map(id => b[id]));
    for (const id of background) engine.createManifestGroup(scope, manifest, [id], [b[id]], { priority: 'background' });
    for (const id of foreground) engine.createManifestGroup(scope, manifest, [id], [b[id]]);
    assert.equal(p.loads.length, 4);
    const expected = ['e_i0', 'e_i1', 'e_i2', 'e_i3', 'e_b0', 'e_i4', 'e_i5', 'e_i6', 'e_i7', 'e_b1', 'e_b2'];
    let active = p.loads[0];
    for (const id of expected) {
      const before = p.loads.length; p.finish(active); await flush();
      assert.equal(p.loads.length, before + 1); active = p.loads.at(-1); assert.equal(active.name, id);
    }
  });
});

test('M15-G10 fair background admission coalesces an already-loading identity without sharing a lease', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), hold = ['e_shared', 'e_hold1', 'e_hold2', 'e_hold3'], interactive = Array.from({ length: 5 }, (_, i) => 'e_i' + i);
    const manifest = build(engine, [...hold, ...interactive]), b = bind(manifest, p), scope = engine.createScope();
    const first = engine.createManifestGroup(scope, manifest, hold, hold.map(id => b[id]));
    const background = engine.createManifestGroup(scope, manifest, ['e_shared'], [b.e_shared], { priority: 'background' });
    for (const id of interactive) engine.createManifestGroup(scope, manifest, [id], [b[id]]);
    let active = p.loads[1];
    for (const id of interactive.slice(0, 4)) {
      p.finish(active); await flush(); active = p.loads.at(-1); assert.equal(active.name, id);
    }
    const before = p.loads.length; p.finish(active); await flush();
    assert.equal(p.loads.length, before, 'fifth fair admission is coalesced background demand, not another provider job');
    assert.equal(p.loads.some(row => row.name === 'e_i4'), false, 'coalesced waiter still occupies one of four acquire slots');
    first.dispose(); await flush();
    assert.equal(p.loads[0].context.signal.aborted, false, 'background acquired its own manager demand before first group disposal');
    assert.equal(p.loads.filter(row => row.name === 'e_shared').length, 1);
    assert.equal(p.loads.at(-1).name, 'e_i4', 'remaining interactive work progresses after legitimate waiter slots settle');
    p.finish(p.loads[0]); await background.ready; assert.equal(background.get(b.e_shared).value, p.loads[0].value);
  });
});

test('M15-G11 disposing one coalesced group withdraws only its own demand and last release disposes once', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a']), b = bind(manifest, p).e_a, scope = engine.createScope();
    const a = engine.createManifestGroup(scope, manifest, ['e_a'], [b]);
    const c = engine.createManifestGroup(scope, manifest, ['e_a'], [b]);
    const cancelled = observe(a); a.dispose();
    assert.equal((await cancelled).ok, false); assert.equal(p.loads.length, 1); assert.equal(p.loads[0].context.signal.aborted, false);
    p.finish(p.loads[0]); await c.ready; const lease = c.get(b); assert.equal(lease.value, p.loads[0].value);
    c.dispose(); c.dispose(); assert.equal(p.disposals.length, 1); refused(() => lease.value);
  });
});

test('M15-G12 cancelled last waiter releases acquire capacity but old late success cannot replace a fresh generation', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a']), b = bind(manifest, p).e_a, scope = engine.createScope();
    const old = engine.createManifestGroup(scope, manifest, ['e_a'], [b]), rejected = observe(old);
    old.dispose(); assert.equal((await rejected).ok, false); assert.equal(p.loads[0].context.signal.aborted, true);
    const fresh = engine.createManifestGroup(scope, manifest, ['e_a'], [b]);
    assert.equal(p.loads.length, 2); assert.ok(p.loads[1].context.resourceGeneration > p.loads[0].context.resourceGeneration);
    p.finish(p.loads[1]); await fresh.ready; const current = fresh.get(b);
    p.finish(p.loads[0]); await flush(); assert.deepEqual(p.disposals, [p.loads[0].value]);
    const next = engine.createManifestGroup(scope, manifest, ['e_a'], [b]); await next.ready;
    assert.equal(p.loads.length, 2); assert.equal(next.get(b).value, current.value);
    fresh.dispose(); assert.equal(p.disposals.length, 1); next.dispose(); assert.equal(p.disposals.length, 2);
  });
});

test('M15-G13 explicit complete-closure invalidation keeps old leases alive and proves each new generation', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a', 'e_b', ['e_root', ['e_a', 'e_b']]]), b = bind(manifest, p), scope = engine.createScope();
    const old = engine.createManifestGroup(scope, manifest, ['e_root'], Object.values(b));
    await finishCount(p, 3); await old.ready;
    const before = new Map(Object.values(b).map(binding => [binding, old.get(binding)]));
    for (const binding of Object.values(b)) engine.assets.invalidate(binding.ref);
    const fresh = engine.createManifestGroup(scope, manifest, ['e_root'], Object.values(b));
    await finishCount(p, 3, 3); await fresh.ready;
    for (const binding of Object.values(b)) {
      const previous = before.get(binding), next = fresh.get(binding);
      assert.ok(next.resourceGeneration > previous.resourceGeneration); assert.notEqual(next.value, previous.value);
    }
    assert.equal(p.loads.length, 6); assert.equal(p.disposals.length, 0, 'old scene leases remain live during replacement');
    old.dispose(); assert.equal(p.disposals.length, 3);
    for (const binding of Object.values(b)) assert.ok(fresh.get(binding).value);
    fresh.dispose(); assert.equal(p.disposals.length, 6);
  });
});

test('M15-G14 get authenticates exact membership/receiver and retains genuine group-owned lease behavior', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a']), b = bind(manifest, p).e_a, equal = bind(manifest, p).e_a;
    const scope = engine.createScope(), group = engine.createManifestGroup(scope, manifest, ['e_a'], [b]);
    refused(() => group.get(b)); p.finish(p.loads[0]); await group.ready;
    let reads = 0; const fake = { get ref() { reads++; throw Error('counterfeit getter'); } };
    refused(() => group.get(fake)); refused(() => group.get(equal)); assert.equal(reads, 0);
    refused(() => Reflect.apply(group.get, {}, [b])); refused(() => Reflect.apply(group.dispose, {}, []));
    const ready = Object.getOwnPropertyDescriptor(group, 'ready');
    if (ready?.get) refused(() => Reflect.apply(ready.get, {}, []));
    const lease = group.get(b), other = engine.createScope();
    assert.equal(Object.isFrozen(group), true); assert.ok(lease instanceof egret.AssetLease);
    const conflict = refused(() => other.use(lease)); assert.equal(conflict.code, 'OWNERSHIP_CONFLICT');
    // Public borrows still expose the original genuine lease. Misuse is never a
    // transfer of ownership, a wrapper entitlement, or permission to reacquire.
    lease.release(); lease.release(); refused(() => lease.value);
    group.dispose(); group.dispose(); assert.equal(p.disposals.length, 1); refused(() => group.get(b));
  });
});

test('M15-G15 genuine Scope affinity and captured manager/Scope operations survive own overrides', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a']), b = bind(manifest, p).e_a, scope = engine.createScope();
    let reads = 0; const counterfeit = { get state() { reads++; throw Error('counterfeit Scope'); } };
    refused(() => engine.createManifestGroup(counterfeit, manifest, ['e_a'], [b])); assert.equal(reads, 0);
    const otherHost = host(), other = await egret.createEngine({ host: otherHost.adapter });
    try { refused(() => engine.createManifestGroup(other.createScope(), manifest, ['e_a'], [b])); }
    finally { await other.dispose(); }
    scope.use = () => { throw Error('replaceable own Scope method'); };
    engine.assets.acquire = () => { throw Error('replaceable own manager method'); };
    try {
      const group = engine.createManifestGroup(scope, manifest, ['e_a'], [b]);
      p.finish(p.loads[0]); await group.ready; assert.equal(group.get(b).value, p.loads[0].value);
    } finally { delete scope.use; delete engine.assets.acquire; }
  });
});

test('M15-G16 Scope closure during the first synchronous loader revokes publication before later work', async () => {
  await withEngine(async (engine, provider) => {
    const scope = engine.createScope();
    const p = provider({ onLoad() { scope.dispose(); } });
    const manifest = build(engine, ['e_a', 'e_b', 'e_c']), b = bind(manifest, p);
    const group = engine.createManifestGroup(scope, manifest, ['e_a', 'e_b', 'e_c'], Object.values(b));
    const result = await observe(group); assert.equal(result.ok, false); assert.equal(p.loads.length, 1);
    assert.equal(p.loads[0].context.signal.aborted, true);
    p.finish(p.loads[0]); await flush(); assert.equal(p.disposals.length, 1);
    refused(() => group.get(b.e_a)); group.dispose(); assert.equal(p.disposals.length, 1);
  });
});

test('M15-G17 failure cancels blocked dependants and retires prior successes without touching another group', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_a', 'e_b', ['e_root', ['e_a', 'e_b']]]), b = bind(manifest, p), scope = engine.createScope();
    const failed = engine.createManifestGroup(scope, manifest, ['e_root'], Object.values(b)), outcome = observe(failed);
    const survivor = engine.createManifestGroup(scope, manifest, ['e_a'], [b.e_a]);
    p.finish(p.loads[0]); await survivor.ready;
    p.fail(p.loads[1], undefined); const result = await outcome;
    assert.equal(result.ok, false); assert.ok(result.error instanceof egret.EgretError);
    assert.equal(p.loads.some(row => row.name === 'e_root'), false);
    assert.equal(survivor.get(b.e_a).value, p.loads[0].value); assert.equal(p.disposals.length, 0);
    survivor.dispose(); assert.deepEqual(p.disposals, [p.loads[0].value]);
  });
});

test('M15-G18 Engine close rejects pending groups and releases ready members before reentrant acquisition', async () => {
  await withEngine(async (engine, provider) => {
    let manifest, bindings, scope, reentries = 0;
    const p = provider({ onDispose() {
      reentries++;
      const error = refused(() => engine.createManifestGroup(scope, manifest, ['e_a'], [bindings.e_a]));
      assert.equal(error.code, 'ENGINE_CLOSED');
    } });
    manifest = build(engine, ['e_a', 'e_b']); bindings = bind(manifest, p); scope = engine.createScope();
    const ready = engine.createManifestGroup(scope, manifest, ['e_a'], [bindings.e_a]);
    p.finish(p.loads[0]); await ready.ready; const lease = ready.get(bindings.e_a);
    const pending = engine.createManifestGroup(scope, manifest, ['e_b'], [bindings.e_b]), outcome = observe(pending);
    const closing = engine.dispose();
    assert.equal((await outcome).ok, false); assert.equal(p.loads[1].context.signal.aborted, true);
    refused(() => lease.value); refused(() => ready.get(bindings.e_a));
    assert.equal(p.loads.length, 2); p.finish(p.loads[1]); await closing; await flush();
    assert.equal(reentries, 2); assert.equal(p.disposals.length, 2);
  });
});

test('M15-G19 blocked interactive parent cannot obstruct an eligible background resource', async () => {
  await withEngine(async (engine, provider) => {
    const p = provider(), manifest = build(engine, ['e_dep', ['e_parent', ['e_dep']], 'e_background']);
    const b = bind(manifest, p), scope = engine.createScope();
    const parent = engine.createManifestGroup(scope, manifest, ['e_parent'], [b.e_dep, b.e_parent]);
    const background = engine.createManifestGroup(scope, manifest, ['e_background'], [b.e_background], { priority: 'background' });
    assert.deepEqual(p.loads.map(row => row.name), ['e_dep', 'e_background']);
    p.finish(p.loads[1]); await background.ready;
    assert.equal(p.loads.some(row => row.name === 'e_parent'), false);
    p.finish(p.loads[0]); await flush(); assert.equal(p.loads.at(-1).name, 'e_parent');
    p.finish(p.loads.at(-1)); await parent.ready;
  });
});
