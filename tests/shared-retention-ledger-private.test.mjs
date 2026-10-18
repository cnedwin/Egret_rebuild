// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetentionLedger } from '../packages/engine/dist/web/sharedRetentionLedger.js';

// Metadata UNIT: inert resource identities establish no native cleanup proof.
const MiB = 1024 * 1024;
const request = (id, byteLength = 4, key = 'vertex:' + byteLength) => ({ request: Object.freeze({ id, byteLength }), key });
const status = (idleBytes = 0, idleEntries = 0, reservedBytes = 0, reservedEntries = 0, unknownBytes = 0, unknownEntries = 0) =>
  ({ idleBytes, idleEntries, reservedBytes, reservedEntries, unknownBytes, unknownEntries });
function fixture() {
  const ledger = createRetentionLedger({});
  const created = (r = request(0)) => ledger.registerCreated(r, Object.freeze({}));
  const ready = (requests) => {
    const leases = requests.map(created);
    ledger.publishReturns(ledger.reserveReturns(leases));
    return leases;
  };
  return { ledger, created, ready };
}

test('UNIT LED01 idle and reserved snapshots are immutable and never count the same lease twice', () => {
  const { ledger: p, created, ready } = fixture();
  const [idle] = ready([request(0, 8)]), pending = created(request(0, 12));
  const initial = p.getStatus();
  assert.deepEqual(initial, status(8, 1));
  assert.ok(Object.isFrozen(initial));
  const reservation = p.reserveReturns([pending]);
  assert.deepEqual(p.getStatus(), status(8, 1, 12, 1));
  assert.deepEqual(initial, status(8, 1), 'a saved snapshot does not change');
  p.publishReturns(reservation);
  assert.deepEqual(p.getStatus(), status(20, 2));
  assert.deepEqual(p.detachIdleForClose(), [idle.handle, pending.handle]);
  assert.deepEqual(p.getStatus(), status());
});

test('UNIT LED02 complete backend keys control exact hits, while lease identity and FIFO remain ledger-owned', () => {
  const { ledger: p, ready } = fixture();
  const [color, vertex, depth] = ready([
    request(0, 8 * MiB, 'color:2048:1024:srgb'), request(1, 8 * MiB, 'vertex:8388608'),
    request(2, 16 * MiB, 'depth:2048:2048:32f'),
  ]);
  const plan = p.plan([request(0, 8 * MiB, 'vertex:8388608'), request(1, 8 * MiB, 'color:1024:2048:srgb')]);
  assert.deepEqual([...plan.matches], [[0, vertex.handle]]);
  assert.deepEqual(plan.victims, [color.handle]);
  assert.equal(p.claim(plan), plan.leases);
  assert.deepEqual(p.getStatus(), status(16 * MiB, 1));
  assert.equal(p.plan([request(0, 16 * MiB, 'depth:2048:2048:32f')]).matches.get(0), depth.handle);
  assert.equal(p.plan([request(0, 16 * MiB, 'depth:1024:4096:32f')]).matches.size, 0);
  assert.equal(Object.hasOwn(vertex.handle, 'key'), false, 'compatibility keys are private node metadata');
  assert.throws(() => p.claim(plan), TypeError);
});

test('UNIT LED03 confirmed context invalidation is distinct, one-shot and cannot erase unknown cleanup', () => {
  const { ledger: p, created, ready } = fixture();
  const [idle] = ready([request(0, 8)]), reserved = created(request(0, 12)), leased = created(request(0, 16));
  const returning = p.reserveReturns([reserved]);
  assert.throws(() => p.settled(idle.handle, 'context-invalidated'), TypeError, 'an active ledger cannot authorize invalidation');
  p.detach(leased.handle);
  p.settled(leased.handle, 'unknown');
  assert.deepEqual(p.getStatus(), status(8, 1, 12, 1, 16, 1));
  p.invalidate();
  p.settled(idle.handle, 'context-invalidated');
  p.settled(reserved.handle, 'context-invalidated');
  assert.deepEqual(p.getStatus(), status(0, 0, 0, 0, 16, 1));
  assert.throws(() => p.settled(leased.handle, 'context-invalidated'), TypeError);
  assert.throws(() => p.settled(leased.handle, 'destroyed'), TypeError);
  assert.throws(() => p.settled(idle.handle, 'destroyed'), TypeError);
  assert.throws(() => p.publishReturns(returning), TypeError);
  assert.deepEqual(p.cancelReturns(returning), []);
  assert.throws(() => p.plan([]), TypeError);
  assert.deepEqual(p.getStatus(), status(0, 0, 0, 0, 16, 1));
});

test('UNIT LED04 invalid foreign or duplicate return batches preserve all original ownership', () => {
  const f = fixture(), other = fixture(), p = f.ledger;
  const a = f.created(request(0, 8)), b = f.created(request(1, 12)), foreign = other.created();
  assert.throws(() => p.reserveReturns([a, foreign]), TypeError);
  assert.throws(() => p.reserveReturns([a, a]), TypeError);
  assert.throws(() => p.reserveReturns([a, { ...b }]), TypeError);
  assert.throws(() => p.settled({ ...a.handle }, 'destroyed'), TypeError);
  assert.deepEqual(p.getStatus(), status());
  const returning = p.reserveReturns([a, b]);
  assert.deepEqual(p.getStatus(), status(0, 0, 20, 2));
  p.publishReturns(returning);
  const plan = p.plan([request(0, 8), request(1, 12)]);
  const current = p.claim(plan);
  assert.throws(() => p.reserveReturns([current[0], b]), TypeError);
  assert.deepEqual(p.getStatus(), status());
  p.publishReturns(p.reserveReturns(current));
  assert.deepEqual(p.getStatus(), status(20, 2));
});

test('UNIT LED05 byte and entry reservations are shared across all complete keys', () => {
  const { ledger: p, created, ready } = fixture();
  const [large] = ready([request(0, 32 * MiB, 'one-target')]);
  const extra = created();
  const overflow = p.reserveReturns([extra]);
  assert.deepEqual(overflow.retained, []);
  assert.deepEqual(overflow.transient, [extra.handle]);
  p.publishReturns(overflow);
  p.detach(large.handle); p.settled(large.handle, 'destroyed');
  const rows = Array.from({ length: 4095 }, (_, id) => request(id, 4, 'role:' + (id % 3)));
  ready(rows);
  const reservation = p.reserveReturns([extra]);
  const last = created(request(0, 4, 'other-target'));
  const full = p.reserveReturns([last]);
  assert.deepEqual(full.retained, []);
  assert.deepEqual(p.getStatus(), status(16380, 4095, 4, 1));
  assert.deepEqual(p.cancelReturns(reservation), [extra.handle]);
  p.publishReturns(full);
  p.publishReturns(p.reserveReturns([last]));
  assert.deepEqual(p.getStatus(), status(16384, 4096));
});

test('UNIT LED06 allocation identities cannot be registered in another backend ledger or revived after cleanup', () => {
  const f = fixture(), other = fixture(), lease = f.created();
  assert.throws(() => other.ledger.registerCreated(request(0), lease.handle.resource), TypeError);
  f.ledger.settled(lease.handle, 'destroyed');
  assert.throws(() => f.ledger.settled(lease.handle, 'destroyed'), TypeError);
  assert.throws(() => other.ledger.registerCreated(request(0), lease.handle.resource), TypeError);
  assert.throws(() => f.ledger.settled(lease.handle, 'unknown'), TypeError);
  assert.deepEqual(f.ledger.getStatus(), status());
});

test('UNIT LED07 invalid keyed requests and stale plans refuse before claiming existing idle entries', () => {
  const { ledger: p, created, ready } = fixture();
  const [idle] = ready([request(0, 8)]);
  for (const bad of [request(1), request(0, 3), request(0, 0), request(0, 4, ''), { request: Object.freeze({ id: 0, byteLength: 4 }), key: 3 }])
    assert.throws(() => p.plan([bad]), TypeError);
  const stale = p.plan([request(0, 8)]);
  created(request(0, 4, 'unrelated'));
  assert.throws(() => p.claim(stale), TypeError);
  assert.equal(p.plan([request(0, 8)]).matches.get(0), idle.handle);
  assert.deepEqual(p.getStatus(), status(8, 1));
});

test('UNIT LED08 mutable private requests refuse without consuming idle or reserved ownership', () => {
  const { ledger: p, created, ready } = fixture();
  const [idle] = ready([request(0, 8)]), pending = created(request(0, 12));
  p.reserveReturns([pending]);
  const mutable = { request: { id: 0, byteLength: 8 }, key: 'vertex:8' };
  assert.throws(() => p.plan([mutable]), TypeError);
  assert.throws(() => p.registerCreated(mutable, {}), TypeError);
  assert.deepEqual(p.getStatus(), status(8, 1, 12, 1));
  assert.equal(p.plan([request(0, 8)]).matches.get(0), idle.handle);
});

test('UNIT LED09 clean context loss invalidates leased and detached allocations without native destruction', () => {
  const { ledger: p, created } = fixture();
  const leased = created(request(0, 16)), detached = created(request(0, 20));
  p.detach(detached.handle);
  p.invalidate();
  p.settled(leased.handle, 'context-invalidated');
  p.settled(detached.handle, 'context-invalidated');
  assert.deepEqual(p.getStatus(), status());
  assert.deepEqual(p.detachIdleForClose(), []);
  assert.throws(() => p.settled(leased.handle, 'destroyed'), TypeError);
  assert.throws(() => p.settled(detached.handle, 'unknown'), TypeError);
  assert.throws(() => p.reserveReturns([leased]), TypeError);
  assert.throws(() => p.plan([]), TypeError);
});
