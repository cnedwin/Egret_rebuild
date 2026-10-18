// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebGPURetentionPool } from '../packages/engine/dist/web/webgpuRetentionPool.js';

// Explicit metadata UNIT controls for the shared buffer/color/depth retention ledger.
// These owned-resource records are inert ports, not a native GPU or Host proof.
// No helper audit API, implementation copy, prototype patch or loader is used.
const MiB = 1024 * 1024;
function buffer(id, byteLength = 4, usage = 40) {
  return { kind: 'buffer', id, role: usage === 72 ? 'uniform' : usage === 24 ? 'index' : 'vertex', usage, byteLength };
}
function target(kind, id, width = 1, height = 1) {
  return { kind, id, width, height, byteLength: 4 * width * height,
    format: kind === 'color' ? 'rgba8unorm-srgb' : 'depth32float',
    usage: kind === 'color' ? 20 : 16, sampleCount: 1, mipLevelCount: 1, depthOrArrayLayers: 1,
    recipe: kind === 'color' ? 'egret.srgb-pma8-target/1' : 'egret.shared-reverse-depth/1' };
}
function fixture(session = {}) {
  const pool = createWebGPURetentionPool(session), resources = [];
  function created(request) {
    const calls = [];
    const owned = request.kind === 'buffer'
      ? { buffer: {}, destroy() { calls.push('destroy'); }, unmap() { calls.push('unmap'); },
        map() { calls.push('map'); return Promise.resolve(); },
        mappedRange() { calls.push('mappedRange'); return new ArrayBuffer(4); },
        mapped: false, cleaned: false }
      : { texture: {}, destroy() { calls.push('destroy'); }, cleaned: false };
    resources.push({ owned, calls });
    return pool.registerCreated(request, owned);
  }
  function ready(requests) {
    const leases = requests.map(created), reservation = pool.reserveReturns(leases);
    assert.deepEqual(reservation.retained, leases.map(lease => lease.handle));
    assert.deepEqual(reservation.transient, []);
    assert.equal(pool.publishReturns(reservation), reservation.retained);
    return leases;
  }
  function nativeSilent() {
    for (const { owned, calls } of resources) {
      assert.deepEqual(calls, [], 'metadata cannot invoke a captured native method');
      assert.equal(owned.cleaned, false, 'only the external cleanup owner changes this flag');
    }
  }
  return { pool, created, ready, nativeSilent };
}

test('UNIT RET01 all three kinds share 32 MiB and one oldest-unmatched FIFO', () => {
  const f = fixture(), p = f.pool;
  const [color, vertex, depth] = f.ready([
    target('color', 0, 2048, 1024), buffer(1, 8 * MiB), target('depth', 2, 2048, 2048),
  ]);
  // The exact 32 MiB includes both targets and the buffer; another four bytes
  // are allowed to exist, but cannot join retained ownership.
  const extra = f.created(buffer(0));
  const overflow = p.reserveReturns([extra]);
  assert.deepEqual(overflow.retained, []);
  assert.deepEqual(overflow.transient, [extra.handle]);
  p.publishReturns(overflow);

  // Protect the complete exact-hit set before selecting pressure victims.
  // The differently shaped color target costs 8 MiB but cannot reuse color.
  const plan = p.plan([buffer(0, 8 * MiB), target('color', 1, 1024, 2048)]);
  assert.deepEqual([...plan.matches], [[0, vertex.handle]]);
  assert.deepEqual(plan.victims, [color.handle]);
  assert.equal(p.claim(plan), plan.leases);
  assert.equal(p.plan([target('color', 0, 2048, 1024)]).matches.size, 0);
  assert.equal(p.plan([buffer(0, 8 * MiB)]).matches.size, 0);
  assert.equal(p.plan([target('depth', 0, 2048, 2048)]).matches.get(0), depth.handle);
  assert.deepEqual(p.detachIdleForClose(), [depth.handle]);
  assert.deepEqual(plan.victims, [color.handle], 'the victim remains an external cleanup owner');
  f.nativeSilent();
});

test('UNIT RET02 cross-kind byte reservations exclude returns before publication and cancellation frees capacity', () => {
  const f = fixture(), p = f.pool;
  const [idle] = f.ready([buffer(0, 16 * MiB)]);
  const color = f.created(target('color', 0, 2048, 2048));
  const depth = f.created(target('depth', 0));
  const first = p.reserveReturns([color]);
  assert.deepEqual(first.retained, [color.handle]);
  assert.equal(p.plan([target('color', 0, 2048, 2048)]).matches.size, 0, 'reserved is not reusable');
  const overflow = p.reserveReturns([depth]);
  assert.deepEqual(overflow.retained, []);
  assert.deepEqual(overflow.transient, [depth.handle]);
  assert.deepEqual(p.cancelReturns(first), [color.handle]);
  assert.throws(() => p.publishReturns(first), TypeError);
  assert.throws(() => p.cancelReturns(first), TypeError);
  p.publishReturns(overflow);
  const retry = p.reserveReturns([depth]);
  assert.deepEqual(retry.retained, [depth.handle]);
  p.publishReturns(retry);
  assert.equal(p.plan([target('depth', 0)]).matches.get(0), depth.handle);
  assert.deepEqual(p.detachIdleForClose(), [idle.handle, depth.handle]);
  p.destroyed(color.handle, true);
  f.nativeSilent();
});

test('UNIT RET03 one 4096-entry cap includes mixed pending reservations and preserves actual publication order', () => {
  const f = fixture(), p = f.pool;
  const requests = Array.from({ length: 4094 }, (_, id) => id % 3 === 0
    ? buffer(id) : target(id % 3 === 1 ? 'color' : 'depth', id));
  const idle = f.ready(requests);
  const color = f.created(target('color', 0)), depth = f.created(target('depth', 0)), extra = f.created(buffer(0));
  const first = p.reserveReturns([color]), second = p.reserveReturns([depth]);
  assert.deepEqual(first.retained, [color.handle]);
  assert.deepEqual(second.retained, [depth.handle]);
  const overflow = p.reserveReturns([extra]);
  assert.deepEqual(overflow.retained, []);
  assert.deepEqual(overflow.transient, [extra.handle]);
  assert.equal(p.plan(requests).matches.size, 4094, 'neither reservation is a searchable idle entry');
  p.publishReturns(second);
  assert.deepEqual(p.cancelReturns(first), [color.handle]);
  p.publishReturns(overflow);
  const retry = p.reserveReturns([extra]);
  assert.deepEqual(retry.retained, [extra.handle]);
  p.publishReturns(retry);
  const cleanup = p.detachIdleForClose();
  assert.equal(cleanup.length, 4096);
  assert.deepEqual(cleanup, [...idle.map(lease => lease.handle), depth.handle, extra.handle]);
  assert.deepEqual(p.detachIdleForClose(), []);
  p.destroyed(color.handle, true);
  f.nativeSilent();
});

test('UNIT RET04 target keys distinguish shape and kind, while unsupported target descriptors never authorize a hit', () => {
  const f = fixture(), p = f.pool;
  const [landscape, portrait, depth, vertex] = f.ready([
    target('color', 0, 64, 32), target('color', 1, 32, 64),
    target('depth', 2, 64, 32), buffer(3, 8192),
  ]);
  assert.equal(p.plan([target('color', 0, 128, 16)]).matches.size, 0, 'equal bytes do not identify a target shape');
  const original = target('color', 0, 64, 32);
  // These fields have one admitted value per target kind. Refusal, rather than
  // an invented second supported recipe, is the meaningful compatibility test.
  for (const change of [
    { width: 0 }, { height: -1 }, { byteLength: 8196 },
    { format: 'rgba8unorm' }, { usage: 16 }, { sampleCount: 2 },
    { mipLevelCount: 2 }, { depthOrArrayLayers: 2 },
    { recipe: 'egret.shared-reverse-depth/1' }, { kind: 'other' },
  ]) {
    assert.throws(() => p.plan([{ ...original, ...change }]), TypeError);
  }
  const plan = p.plan([
    target('depth', 0, 64, 32), target('color', 1, 32, 64), buffer(2, 8192),
    target('color', 3, 64, 32), target('color', 4, 64, 32),
  ]);
  assert.deepEqual([...plan.matches], [[0, depth.handle], [1, portrait.handle], [2, vertex.handle], [3, landscape.handle]]);
  assert.deepEqual(plan.leases.map(lease => [lease.requestId, lease.offset, lease.size]),
    [[0, 0, 8192], [1, 0, 8192], [2, 0, 8192], [3, 0, 8192]]);
  assert.equal(p.claim(plan), plan.leases);
  assert.equal(p.plan([target('color', 0, 64, 32)]).matches.size, 0, 'one target cannot satisfy two current leases');
  f.nativeSilent();
});

test('UNIT RET05 a stale mixed claim changes neither matches nor victims and invokes no native effects', () => {
  const f = fixture(), p = f.pool;
  const [color, vertex, depth] = f.ready([
    target('color', 0, 2048, 1024), buffer(1, 8 * MiB), target('depth', 2, 2048, 2048),
  ]);
  const stale = p.plan([buffer(0, 8 * MiB), target('color', 1, 1024, 2048)]);
  assert.deepEqual([...stale.matches], [[0, vertex.handle]]);
  assert.deepEqual(stale.victims, [color.handle]);
  f.created(buffer(0, 4, 24)); // A separately recorded owner invalidates the plan.
  assert.throws(() => p.claim(stale), TypeError);
  assert.throws(() => p.claim(stale), TypeError);
  const fresh = p.plan([buffer(0, 8 * MiB), target('color', 1, 2048, 1024), target('depth', 2, 2048, 2048)]);
  assert.deepEqual([...fresh.matches], [[0, vertex.handle], [1, color.handle], [2, depth.handle]]);
  assert.deepEqual(fresh.victims, []);
  assert.deepEqual(p.detachIdleForClose(), [color.handle, vertex.handle, depth.handle]);
  f.nativeSilent();
});

test('UNIT RET06 invalid mixed return batches are atomic and only the current genuine lease can return', () => {
  const session = {}, f = fixture(session), other = fixture(session), p = f.pool;
  const color = f.created(target('color', 0)), vertex = f.created(buffer(1));
  const foreign = other.created(target('depth', 0));
  assert.throws(() => p.reserveReturns([color, foreign]), TypeError);
  assert.throws(() => p.reserveReturns([color, color]), TypeError);
  assert.throws(() => p.reserveReturns([color, { ...vertex }]), TypeError);
  assert.throws(() => other.pool.detach(color.handle), TypeError);
  assert.throws(() => p.detach({ ...color.handle }), TypeError);
  assert.throws(() => other.pool.registerCreated(target('color', 0), color.handle.resource), TypeError);
  const returning = p.reserveReturns([color, vertex]);
  assert.deepEqual(returning.retained, [color.handle, vertex.handle], 'failed batches left both leases available');
  assert.throws(() => p.publishReturns({ ...returning }), TypeError);
  assert.throws(() => other.pool.cancelReturns(returning), TypeError);
  p.publishReturns(returning);
  const plan = p.plan([target('color', 0), buffer(1)]);
  assert.throws(() => p.claim({ ...plan }), TypeError);
  assert.throws(() => other.pool.claim(plan), TypeError);
  const current = p.claim(plan);
  assert.throws(() => p.reserveReturns([current[0], vertex]), TypeError);
  const again = p.reserveReturns(current);
  assert.deepEqual(again.retained, [color.handle, vertex.handle]);
  p.publishReturns(again);
  assert.deepEqual(p.detachIdleForClose(), [color.handle, vertex.handle]);
  f.nativeSilent(); other.nativeSilent();
});

test('UNIT RET07 unknown target destruction cannot be retried or refunded and permanently disables reuse', () => {
  const f = fixture(), p = f.pool;
  const [color, vertex] = f.ready([target('color', 0, 2048, 1024), buffer(1, 8 * MiB)]);
  const depth = f.created(target('depth', 0, 2048, 2048));
  const reserved = p.reserveReturns([depth]);
  assert.deepEqual(reserved.retained, [depth.handle]);
  p.detach(color.handle);
  p.destroyed(color.handle, false);
  assert.throws(() => p.destroyed(color.handle, true), TypeError);
  assert.throws(() => p.destroyed(color.handle, false), TypeError);
  assert.throws(() => p.plan([]), TypeError);
  assert.throws(() => p.publishReturns(reserved), TypeError);
  assert.deepEqual(p.cancelReturns(reserved), [depth.handle]);
  const late = f.created(target('color', 0));
  const lateReturn = p.reserveReturns([late]);
  assert.deepEqual(lateReturn.retained, []);
  assert.deepEqual(lateReturn.transient, [late.handle]);
  assert.deepEqual(p.cancelReturns(lateReturn), [], 'transient cleanup belongs to the external owner already');
  assert.deepEqual(p.detachIdleForClose(), [vertex.handle]);
  for (const handle of [depth.handle, vertex.handle, late.handle]) p.destroyed(handle, true);
  p.detach(color.handle); // Idempotent detachment cannot erase the unknown state.
  assert.throws(() => p.destroyed(color.handle, true), TypeError);
  assert.throws(() => p.plan([]), TypeError, 'successful cleanup of other owners does not reactivate retention');
  assert.deepEqual(p.detachIdleForClose(), []);
  // No numerical ledger audit exists: this tests the observable no-refund,
  // no-retry and terminal-reuse consequences, not a direct unknown-byte reading.
  f.nativeSilent();
});

test('UNIT RET08 invalidation retains separate idle, reserved and leased cleanup ownership', () => {
  const f = fixture(), p = f.pool;
  const [color, vertex] = f.ready([target('color', 0), buffer(1)]);
  const depth = f.created(target('depth', 0)), leased = f.created(buffer(0, 8));
  const returning = p.reserveReturns([depth]);
  const planned = p.plan([target('color', 0), buffer(1)]);
  p.invalidate();
  assert.throws(() => p.plan([]), TypeError);
  assert.throws(() => p.claim(planned), TypeError);
  assert.throws(() => p.publishReturns(returning), TypeError);
  assert.deepEqual(p.cancelReturns(returning), [depth.handle]);
  assert.deepEqual(p.detachIdleForClose(), [color.handle, vertex.handle]);
  assert.deepEqual(p.detachIdleForClose(), []);
  const afterStop = p.reserveReturns([leased]);
  assert.deepEqual(afterStop.retained, []);
  assert.deepEqual(afterStop.transient, [leased.handle]);
  assert.deepEqual(p.cancelReturns(afterStop), []);
  for (const handle of [color.handle, vertex.handle, depth.handle, leased.handle]) p.destroyed(handle, true);
  assert.throws(() => p.claim(planned), TypeError);
  f.nativeSilent();
});
