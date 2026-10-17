import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebGPUBufferPool } from '../packages/engine/dist/web/webgpuBufferPool.js';

// Explicit metadata UNIT coverage only. Host proof, native cleanup, public
// admission, rendering and physical allocation acceptance are tested separately.
const MiB = 1024 * 1024;
function request(id, byteLength = 64, usage = 40) {
  return { id, role: usage === 72 ? 'uniform' : usage === 24 ? 'index' : 'vertex', usage, byteLength };
}
function resource() {
  const calls = [];
  return { buffer: {}, destroy() { calls.push('destroy'); }, unmap() { calls.push('unmap'); },
    map() { calls.push('map'); return Promise.resolve(); }, mappedRange() { calls.push('range'); return new ArrayBuffer(4); },
    mapped: false, cleaned: false, calls };
}
function created(pool, row) { return pool.registerCreated(row, resource()); }
function ready(pool, rows) {
  const leases = rows.map(row => created(pool, row));
  const returning = pool.reserveReturns(leases);
  assert.equal(returning.transient.length, 0);
  assert.deepEqual(pool.publishReturns(returning), leases.map(lease => lease.handle));
  return leases;
}

test('UNIT B05 exact usage and size select FIFO matches in request order', () => {
  const pool = createWebGPUBufferPool({});
  const [a, b, c, d] = ready(pool, [request(0), request(1, 64, 24), request(2), request(3, 68)]);
  const plan = pool.plan([request(0), request(1, 64, 24), request(2), request(3, 64, 72), request(4, 68)]);
  assert.deepEqual([...plan.matches], [[0, a.handle], [1, b.handle], [2, c.handle], [4, d.handle]]);
  assert.deepEqual(plan.leases.map(lease => [lease.requestId, lease.offset, lease.size]), [[0, 0, 64], [1, 0, 64], [2, 0, 64], [4, 0, 68]]);
  assert.equal(pool.claim(plan), plan.leases, 'the Host-attached preallocated lease array is the published owner');
  assert.equal(pool.plan([request(0)]).matches.size, 0, 'claimed buffers cannot be leased concurrently');
});

test('UNIT B05 read-only planning and unclaimed plans leave idle ownership intact', () => {
  const pool = createWebGPUBufferPool({});
  const [a] = ready(pool, [request(0)]);
  const first = pool.plan([request(0)]), second = pool.plan([request(0)]);
  assert.equal(first.matches.get(0), a.handle);
  assert.equal(second.matches.get(0), a.handle);
  pool.claim(second);
  assert.throws(() => pool.claim(first), TypeError);
  assert.throws(() => pool.claim(second), TypeError);
});

test('UNIT B05 protect the complete matched set while evicting oldest unmatched pressure victims', () => {
  const pool = createWebGPUBufferPool({});
  const [a, b, c, d] = ready(pool, [request(0, 8 * MiB), request(1, 8 * MiB, 24), request(2, 8 * MiB), request(3, 8 * MiB, 72)]);
  const plan = pool.plan([request(0, 8 * MiB), request(1, 12 * MiB, 24)]);
  assert.equal(plan.matches.get(0), a.handle);
  assert.deepEqual(plan.victims, [b.handle, c.handle]);
  pool.claim(plan);
  assert.deepEqual(pool.detachIdleForClose(), [d.handle]);
  assert.deepEqual(plan.victims, [b.handle, c.handle], 'all detached cleanup owners survive outside the idle directory');
});

test('UNIT B04 inclusive byte cap retains exactly 32 MiB and leaves the next candidate transient', () => {
  const pool = createWebGPUBufferPool({});
  const large = created(pool, request(0, 32 * MiB)), extra = created(pool, request(1, 4));
  const plan = pool.reserveReturns([large, extra]);
  assert.deepEqual(plan.retained, [large.handle]);
  assert.deepEqual(plan.transient, [extra.handle]);
  assert.deepEqual(pool.publishReturns(plan), [large.handle]);
  assert.equal(pool.plan([request(0, 32 * MiB)]).matches.get(0), large.handle);
  assert.equal(pool.plan([request(0, 4)]).matches.size, 0);
});

test('UNIT B04 inclusive entry cap retains 4096 entries without refusing a 4097th allocation', () => {
  const pool = createWebGPUBufferPool({});
  const leases = Array.from({ length: 4097 }, (_, i) => created(pool, request(i, 4)));
  const plan = pool.reserveReturns(leases);
  assert.equal(plan.retained.length, 4096);
  assert.deepEqual(plan.transient, [leases[4096].handle]);
  pool.publishReturns(plan);
  const reuse = pool.plan(Array.from({ length: 4097 }, (_, i) => request(i, 4)));
  assert.equal(reuse.matches.size, 4096);
  assert.equal(reuse.matches.get(0), leases[0].handle);
  assert.equal(reuse.matches.get(4095), leases[4095].handle);
  assert.equal(reuse.matches.has(4096), false);
  assert.deepEqual(reuse.victims, []);
});

test('UNIT B05 individually oversized buffers remain transient without evicting idle owners', () => {
  const pool = createWebGPUBufferPool({});
  const [small] = ready(pool, [request(0)]);
  const plan = pool.plan([request(0, 32 * MiB + 4)]);
  assert.deepEqual(plan.victims, []);
  pool.claim(plan);
  const large = created(pool, request(0, 32 * MiB + 4));
  const returning = pool.reserveReturns([large]);
  assert.deepEqual(returning.retained, []);
  assert.deepEqual(returning.transient, [large.handle]);
  pool.publishReturns(returning);
  assert.equal(pool.plan([request(0)]).matches.get(0), small.handle);
});

test('UNIT B07 return reservations consume both caps before reentrant metadata work', () => {
  const pool = createWebGPUBufferPool({});
  const a = created(pool, request(0, 32 * MiB)), b = created(pool, request(0, 4));
  const first = pool.reserveReturns([a]);
  assert.equal(pool.plan([request(0, 32 * MiB)]).matches.size, 0, 'reserved is not READY');
  const second = pool.reserveReturns([b]);
  assert.deepEqual(second.retained, []);
  assert.deepEqual(second.transient, [b.handle]);
  assert.deepEqual(pool.cancelReturns(first), [a.handle]);
  pool.publishReturns(second);
  const retry = pool.reserveReturns([b]);
  assert.deepEqual(retry.retained, [b.handle]);
  pool.publishReturns(retry);
  assert.equal(pool.plan([request(0, 4)]).matches.get(0), b.handle);
});

test('UNIT B07 return reservation publication preserves lease order and single use', () => {
  const pool = createWebGPUBufferPool({});
  const a = created(pool, request(0)), b = created(pool, request(1));
  const plan = pool.reserveReturns([b, a]);
  assert.deepEqual(pool.publishReturns(plan), [b.handle, a.handle]);
  assert.throws(() => pool.publishReturns(plan), TypeError);
  assert.throws(() => pool.cancelReturns(plan), TypeError);
  const reuse = pool.plan([request(0), request(1)]);
  assert.equal(reuse.matches.get(0), b.handle);
  assert.equal(reuse.matches.get(1), a.handle);
});

test('UNIT B08 genuine identities reject lookalikes and another pool sharing the same session', () => {
  const session = {}, pool = createWebGPUBufferPool(session), other = createWebGPUBufferPool(session);
  const lease = created(pool, request(0));
  assert.throws(() => other.reserveReturns([lease]), TypeError);
  assert.throws(() => other.detach(lease.handle), TypeError);
  assert.throws(() => other.destroyed(lease.handle, true), TypeError);
  assert.throws(() => pool.reserveReturns([{ ...lease }]), TypeError);
  assert.throws(() => pool.detach({ ...lease.handle }), TypeError);
  const returning = pool.reserveReturns([lease]);
  assert.throws(() => pool.publishReturns({ ...returning }), TypeError);
  assert.throws(() => other.cancelReturns(returning), TypeError);
  pool.publishReturns(returning);
  const plan = pool.plan([request(0)]);
  assert.throws(() => pool.claim({ ...plan }), TypeError);
  assert.throws(() => other.claim(plan), TypeError);
  assert.equal(pool.claim(plan)[0].handle, lease.handle);
});

test('UNIT B08 duplicate and obsolete leases cannot reserve one allocation twice', () => {
  const pool = createWebGPUBufferPool({}), lease = created(pool, request(0));
  assert.throws(() => pool.reserveReturns([lease, lease]), TypeError);
  const plan = pool.reserveReturns([lease]);
  assert.throws(() => pool.reserveReturns([lease]), TypeError);
  pool.publishReturns(plan);
  const current = pool.claim(pool.plan([request(0)]))[0];
  assert.throws(() => pool.reserveReturns([lease]), TypeError);
  assert.deepEqual(pool.reserveReturns([current]).retained, [lease.handle]);
});

test('UNIT B08 invalidation disables new reuse but preserves cancellation and close ownership', () => {
  const pool = createWebGPUBufferPool({});
  const [idle] = ready(pool, [request(0)]), leased = created(pool, request(0, 68));
  const claim = pool.plan([request(0)]), returns = pool.reserveReturns([leased]);
  pool.invalidate();
  assert.throws(() => pool.plan([]), TypeError);
  assert.throws(() => pool.claim(claim), TypeError);
  assert.throws(() => pool.publishReturns(returns), TypeError);
  assert.deepEqual(pool.cancelReturns(returns), [leased.handle]);
  assert.deepEqual(pool.detachIdleForClose(), [idle.handle]);
  assert.deepEqual(pool.detachIdleForClose(), []);
  pool.detach(leased.handle);
  pool.destroyed(leased.handle, true);
  pool.destroyed(idle.handle, true);
});

test('UNIT B08 failed detached destruction never authorizes reuse or later successful refund', () => {
  const pool = createWebGPUBufferPool({});
  const [a, b] = ready(pool, [request(0, 16 * MiB), request(1, 16 * MiB, 24)]);
  const plan = pool.plan([request(0, 32 * MiB, 72)]);
  pool.claim(plan);
  assert.deepEqual(plan.victims, [a.handle, b.handle]);
  pool.destroyed(a.handle, false);
  assert.throws(() => pool.plan([]), TypeError);
  assert.throws(() => pool.destroyed(a.handle, true), TypeError);
  pool.detach(b.handle);
  pool.detach(b.handle);
  pool.destroyed(b.handle, true);
  assert.deepEqual(pool.detachIdleForClose(), []);
});

test('UNIT B06 metadata operations never invoke native methods or reuse the staging usage', () => {
  const pool = createWebGPUBufferPool({}), owned = resource();
  assert.throws(() => pool.registerCreated({ id: 0, role: 'vertex', usage: 9, byteLength: 256 }, owned), TypeError);
  for (const bytes of [0, 3, -4, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => pool.plan([request(0, bytes)]), TypeError);
  }
  const lease = pool.registerCreated(request(0), owned);
  assert.throws(() => pool.registerCreated(request(1), owned), TypeError);
  const returns = pool.reserveReturns([lease]);
  pool.publishReturns(returns);
  const [claimed] = pool.claim(pool.plan([request(0)]));
  pool.detach(claimed.handle);
  pool.destroyed(claimed.handle, true);
  assert.deepEqual(owned.calls, []);
  assert.equal(owned.cleaned, false, 'only Host native cleanup owns the cleaned flag');
});

test('UNIT B07 count reservations exclude the next return before any publication', () => {
  const pool = createWebGPUBufferPool({});
  const first = Array.from({ length: 4096 }, (_, i) => created(pool, request(i, 4)));
  const reservation = pool.reserveReturns(first), extra = created(pool, request(0, 4));
  const overflow = pool.reserveReturns([extra]);
  assert.deepEqual(overflow.retained, []);
  assert.deepEqual(overflow.transient, [extra.handle]);
  assert.equal(pool.cancelReturns(reservation).length, 4096);
  pool.publishReturns(overflow);
  const retry = pool.reserveReturns([extra]);
  assert.deepEqual(retry.retained, [extra.handle]);
});

test('UNIT B04 retirement never evicts idle and skips an oversized return for a later fitting lease', () => {
  const pool = createWebGPUBufferPool({});
  const [idle] = ready(pool, [request(0, 16 * MiB)]);
  const tooLarge = created(pool, request(0, 20 * MiB, 24));
  const fitting = created(pool, request(1, 16 * MiB, 72));
  const returns = pool.reserveReturns([tooLarge, fitting]);
  assert.deepEqual(returns.retained, [fitting.handle]);
  assert.deepEqual(returns.transient, [tooLarge.handle]);
  pool.publishReturns(returns);
  assert.deepEqual(pool.detachIdleForClose(), [idle.handle, fitting.handle]);
});

test('UNIT B08 claim uses captured metadata methods while detaching all preowned leases and victims', () => {
  const pool = createWebGPUBufferPool({});
  const [a, b] = ready(pool, [request(0, 16 * MiB), request(1, 16 * MiB, 24)]);
  const plan = pool.plan([request(0, 16 * MiB), request(1, 16 * MiB, 72)]);
  assert.deepEqual(plan.victims, [b.handle]);
  const mapDelete = Object.getOwnPropertyDescriptor(Map.prototype, 'delete');
  const weakGet = Object.getOwnPropertyDescriptor(WeakMap.prototype, 'get');
  const assigned = new Error('replaceable metadata method must not run');
  let called = 0, claimed, failure;
  // This bounded UNIT seam lasts only for the synchronous claim. Restore exact
  // descriptors before assertions, any native cleanup or another pool operation.
  try {
    Object.defineProperty(Map.prototype, 'delete', { ...mapDelete, value() { called++; throw assigned; } });
    Object.defineProperty(WeakMap.prototype, 'get', { ...weakGet, value() { called++; throw assigned; } });
    claimed = pool.claim(plan);
  } catch (cause) { failure = cause; }
  finally {
    Object.defineProperty(WeakMap.prototype, 'get', weakGet);
    Object.defineProperty(Map.prototype, 'delete', mapDelete);
  }
  assert.equal(failure, undefined);
  assert.equal(called, 0);
  assert.equal(claimed, plan.leases);
  assert.equal(claimed[0].handle, a.handle);
  assert.deepEqual(pool.detachIdleForClose(), []);
  pool.destroyed(b.handle, true);
  const returns = pool.reserveReturns(claimed);
  assert.deepEqual(pool.publishReturns(returns), [a.handle]);
});
