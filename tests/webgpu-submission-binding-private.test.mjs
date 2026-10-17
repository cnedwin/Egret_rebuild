import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebGPUBindingCache} from '../packages/engine/dist/web/webgpuBindingCache.js';
import {createWebGPUBufferPool} from '../packages/engine/dist/web/webgpuBufferPool.js';

// Explicit M1.1 UNIT fixtures consume emitted private helpers. The Host alone
// proves READY eligibility; these units qualify genuine pool handles beforehand.
// They establish lookup/metadata behavior, not GPU execution or physical memory.
function fixture(session = {}, byteLength = 16, nativeBuffer = {}) {
  const pool = createWebGPUBufferPool(session), bytes = new Float32Array(byteLength / 4);
  let callbacks = 0;
  const unexpected = () => { callbacks++; throw new Error('binding cache must not execute resource callbacks'); };
  const resource = {buffer: nativeBuffer, destroy: unexpected, unmap: unexpected,
    map: unexpected, mappedRange: unexpected, mapped: false, cleaned: false};
  const lease = pool.registerCreated({id: 0, role: 'uniform', usage: 72, byteLength}, resource);
  const returned = pool.reserveReturns([lease]);
  assert.deepEqual(pool.publishReturns(returned), [lease.handle]);
  const key = {session, layout: {}, texture: {}, view: {}, sampler: {},
    uniform: lease.handle, offset: 0, size: byteLength};
  return {session, pool, bytes, lease, resource, key, cache: createWebGPUBindingCache(session),
    assertNoCallbacks() { assert.equal(callbacks, 0); assert.equal(resource.cleaned, false); }};
}
function publish(cache, key, binding = {}) {
  cache.publish([{key, binding}]);
  return binding;
}

test('UNIT G01 exact identities reuse a binding through settled leases and changed alpha bytes', () => {
  const f = fixture(), binding = publish(f.cache, f.key);
  f.bytes[0] = 0.25;
  assert.equal(f.cache.lookup({...f.key}), binding);
  const plan = f.pool.plan([{id: 0, role: 'uniform', usage: 72, byteLength: 16}]);
  const [lease] = f.pool.claim(plan);
  assert.equal(lease.handle, f.lease.handle);
  f.bytes[0] = 0.75;
  assert.equal(f.cache.lookup({...f.key, uniform: lease.handle}), binding);
  assert.deepEqual(f.pool.publishReturns(f.pool.reserveReturns([lease])), [lease.handle]);
  assert.equal(f.bytes[0], 0.75);
  assert.equal(f.cache.lookup(f.key), binding);
  f.cache.clear(); f.assertNoCallbacks();
});

test('UNIT G01 scene MVP contents are absent from binding identity', () => {
  const f = fixture({}, 64), key = {...f.key, texture: undefined, view: undefined, sampler: undefined};
  const binding = publish(f.cache, key);
  f.bytes[0] = 1; f.bytes[5] = 1; f.bytes[10] = 1; f.bytes[15] = 1;
  assert.equal(f.cache.lookup({...key}), binding);
  f.bytes[12] = 3;
  assert.equal(f.cache.lookup({...key}), binding);
  assert.equal(f.cache.lookup({...key, texture: {}, view: {}, sampler: {}}), undefined);
  f.cache.clear(); f.assertNoCallbacks();
});

test('UNIT G01 every layout texture view sampler allocation offset and size difference misses', () => {
  const f = fixture(), another = fixture(f.session, 16, f.resource.buffer);
  const binding = publish(f.cache, f.key);
  const variants = [
    ['layout', {...f.key, layout: {}}],
    ['texture', {...f.key, texture: {}}],
    ['view', {...f.key, view: {}}],
    ['sampler', {...f.key, sampler: {}}],
    ['allocation generation on the same native object', {...f.key, uniform: another.lease.handle}],
    ['lookalike allocation identity', {...f.key, uniform: {...f.lease.handle, identity: {}}}],
    ['offset', {...f.key, offset: 256}],
    ['size', {...f.key, size: 64}],
  ];
  for (const [label, key] of variants) assert.equal(f.cache.lookup(key), undefined, label);
  const separate = variants.filter(([label]) => label !== 'offset' && label !== 'lookalike allocation identity');
  for (const [label, key] of separate) {
    const own = publish(f.cache, key);
    assert.equal(f.cache.lookup(key), own, label);
    assert.equal(f.cache.lookup(f.key), binding, label);
  }
  f.cache.clear(); f.assertNoCallbacks(); another.assertNoCallbacks();
});

for (const first of ['texture', 'buffer']) test('UNIT G02 ' + first + ' invalidation removes only dependent bindings in either order', () => {
  const f = fixture(), secondUniform = fixture(f.session), unrelated = fixture(f.session);
  const sameTextureKey = {...f.key, uniform: secondUniform.lease.handle};
  const sameBufferKey = {...f.key, texture: {}, view: {}};
  const bindings = [publish(f.cache, f.key), publish(f.cache, sameTextureKey),
    publish(f.cache, sameBufferKey), publish(f.cache, unrelated.key)];
  if (first === 'texture') {
    f.cache.invalidateTexture(f.key.texture);
    assert.equal(f.cache.lookup(f.key), undefined);
    assert.equal(f.cache.lookup(sameTextureKey), undefined);
    assert.equal(f.cache.lookup(sameBufferKey), bindings[2]);
    f.cache.invalidateBuffer(f.lease.handle.identity);
  } else {
    f.cache.invalidateBuffer(f.lease.handle.identity);
    assert.equal(f.cache.lookup(f.key), undefined);
    assert.equal(f.cache.lookup(sameBufferKey), undefined);
    assert.equal(f.cache.lookup(sameTextureKey), bindings[1]);
    f.cache.invalidateTexture(f.key.texture);
  }
  assert.equal(f.cache.lookup(f.key), undefined);
  assert.equal(f.cache.lookup(sameTextureKey), undefined);
  assert.equal(f.cache.lookup(sameBufferKey), undefined);
  assert.equal(f.cache.lookup(unrelated.key), bindings[3]);
  f.cache.invalidateTexture(f.key.texture); f.cache.invalidateBuffer(f.lease.handle.identity);
  const recreated = {...f.key, texture: {}, view: {}, uniform: secondUniform.lease.handle};
  assert.equal(f.cache.lookup(recreated), undefined);
  const renewed = publish(f.cache, recreated);
  assert.equal(f.cache.lookup(recreated), renewed);
  f.cache.clear(); f.assertNoCallbacks(); secondUniform.assertNoCallbacks(); unrelated.assertNoCallbacks();
});

test('UNIT G03 foreign sessions cannot look up or publish bindings even with borrowed native identities', () => {
  const f = fixture(), other = fixture({}, 16, f.resource.buffer);
  const binding = publish(f.cache, f.key);
  const foreignKey = {...f.key, session: other.session};
  const foreignUniform = {...f.key, uniform: other.lease.handle};
  assert.equal(f.cache.lookup(foreignKey), undefined);
  assert.equal(f.cache.lookup(foreignUniform), undefined);
  f.cache.publish([{key: foreignKey, binding: {}}, {key: foreignUniform, binding: {}}]);
  assert.equal(other.cache.lookup(f.key), undefined);
  assert.equal(f.cache.lookup(f.key), binding);
  assert.equal(f.cache.lookup(foreignKey), undefined);
  assert.equal(f.cache.lookup(foreignUniform), undefined);
  f.cache.clear(); other.cache.clear(); f.assertNoCallbacks(); other.assertNoCallbacks();
});

test('UNIT G03 invalidation disables reuse and publication without executing resource cleanup', () => {
  const f = fixture(), binding = publish(f.cache, f.key);
  assert.equal(f.cache.lookup(f.key), binding);
  f.cache.invalidate();
  assert.equal(f.cache.lookup(f.key), undefined);
  f.cache.publish([{key: f.key, binding: {}}, {key: {...f.key, view: {}}, binding: {}}]);
  assert.equal(f.cache.lookup(f.key), undefined);
  f.cache.invalidateTexture(f.key.texture); f.cache.invalidateBuffer(f.lease.handle.identity);
  f.cache.invalidate(); f.cache.clear(); f.assertNoCallbacks();
});

test('UNIT G04 4096 searchable entries use hit and duplicate-publication touches before LRU eviction', () => {
  const f = fixture(), keys = Array.from({length: 4097}, () => ({...f.key, layout: {}}));
  const bindings = keys.map(() => ({}));
  f.cache.publish(keys.slice(0, 4096).map((key, index) => ({key, binding: bindings[index]})));
  assert.equal(f.cache.lookup(keys[0]), bindings[0], 'hit protects the oldest entry');
  f.cache.publish([{key: keys[1], binding: bindings[1]}]);
  f.cache.publish([{key: keys[4096], binding: bindings[4096]}]);
  assert.equal(f.cache.lookup(keys[2]), undefined, 'least recently used entry is evicted');
  assert.equal(f.cache.lookup(keys[0]), bindings[0]);
  assert.equal(f.cache.lookup(keys[1]), bindings[1]);
  assert.equal(f.cache.lookup(keys[4096]), bindings[4096]);
  let hits = 0;
  for (const key of keys) if (f.cache.lookup(key) !== undefined) hits++;
  assert.equal(hits, 4096);
  f.cache.invalidateTexture(f.key.texture);
  for (const key of keys) assert.equal(f.cache.lookup(key), undefined);
  f.cache.invalidateBuffer(f.lease.handle.identity);
  const renewed = publish(f.cache, keys[2]);
  assert.equal(f.cache.lookup(keys[2]), renewed);
  f.cache.clear(); f.assertNoCallbacks();
});

test('UNIT G04 close clearing drops lookups and is terminal after repeated reverse invalidation', () => {
  const f = fixture(), other = fixture(f.session);
  publish(f.cache, f.key); publish(f.cache, other.key);
  f.cache.clear(); f.cache.clear();
  assert.equal(f.cache.lookup(f.key), undefined); assert.equal(f.cache.lookup(other.key), undefined);
  f.cache.invalidateTexture(f.key.texture); f.cache.invalidateBuffer(other.lease.handle.identity);
  f.cache.publish([{key: f.key, binding: {}}]);
  assert.equal(f.cache.lookup(f.key), undefined);
  f.assertNoCallbacks(); other.assertNoCallbacks();
});


test('UNIT G03 failed candidate batch clears partial publication and preserves the original cause', () => {
  const f = fixture(), previous = publish(f.cache, f.key), laterKey = {...f.key, layout: {}};
  const cause = Object.freeze({tag: 'candidate-key-fault'});
  const failing = {get key() { throw cause; }, binding: {}};
  assert.equal(f.cache.lookup(f.key), previous);
  assert.throws(() => f.cache.publish([{key: laterKey, binding: {}}, failing]), error => error === cause);
  assert.equal(f.cache.lookup(f.key), undefined);
  assert.equal(f.cache.lookup(laterKey), undefined);
  assert.doesNotThrow(() => {
    f.cache.invalidateTexture(f.key.texture); f.cache.invalidateBuffer(f.lease.handle.identity);
    f.cache.publish([{key: f.key, binding: {}}]);
    f.cache.invalidateTexture(f.key.texture); f.cache.invalidateBuffer(f.lease.handle.identity);
  });
  assert.equal(f.cache.lookup(f.key), undefined);
  f.cache.clear(); f.assertNoCallbacks();
});

test('UNIT G04 captured collection operations prevent runtime prototype callbacks during lookup and cleanup', () => {
  const f = fixture(), binding = publish(f.cache, f.key), extraKey = {...f.key, layout: {}};
  const descriptors = [], observations = [];
  let callbacks = 0, failure;
  const unexpected = () => { callbacks++; throw new Error('overridden collection operation called'); };
  const targets = [[Map.prototype, ['get', 'set', 'delete', 'clear', 'size']],
    [Set.prototype, ['add', 'delete', 'forEach', 'clear', 'size', Symbol.iterator]]];
  try {
    for (const [prototype, names] of targets) for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      descriptors.push([prototype, name, descriptor]);
      Object.defineProperty(prototype, name, 'value' in descriptor
        ? {...descriptor, value: unexpected} : {...descriptor, get: unexpected});
    }
    observations.push(f.cache.lookup(f.key));
    f.cache.publish([{key: extraKey, binding}]);
    observations.push(f.cache.lookup(extraKey));
    f.cache.invalidateTexture(f.key.texture);
    observations.push(f.cache.lookup(f.key), f.cache.lookup(extraKey));
    f.cache.publish([{key: f.key, binding}]);
    f.cache.invalidateBuffer(f.lease.handle.identity);
    observations.push(f.cache.lookup(f.key));
    f.cache.clear();
  } catch (cause) { failure = cause; }
  finally {
    for (const [prototype, name, descriptor] of descriptors) Object.defineProperty(prototype, name, descriptor);
  }
  assert.equal(failure, undefined);
  assert.equal(callbacks, 0);
  assert.deepEqual(observations, [binding, binding, undefined, undefined, undefined]);
  f.assertNoCallbacks();
});
