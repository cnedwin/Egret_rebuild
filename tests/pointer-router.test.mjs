// SPDX-License-Identifier: Apache-2.0
// DOM-free UNIT: inert target ports qualify routing, not Engine or native input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EgretError } from '@egret/runtime';

const input = await import('@egret/runtime/input').catch(() => ({}));
const { createPointerRouter } = input;
const sample = (pointerId, changes = {}) => ({ pointerId, pointerType: 'touch', globalX: 2, globalY: 3, buttons: 1, timestamp: 0, ...changes });
const update = (changes = {}) => ({ globalX: 4, globalY: 5, buttons: 1, timestamp: 0, ...changes });
const code = expected => error => error instanceof EgretError && error.code === expected;
function fixture(options = {}) {
  const a = { name: 'a', live: true }, b = { name: 'b', live: true }, trace = [], retained = [];
  const router = createPointerRouter({
    pick: x => x < 10 ? a : b,
    eligible: target => target.live,
    dispatch(kind, contact, target, reason) {
      trace.push([kind, contact.session.pointerId, target?.name ?? null, reason ?? null, contact.sequence, contact.viewportRevision]);
      retained.push(contact);
      options.observe?.(kind, contact, target, reason, router);
    },
    ...options,
  });
  return { router, a, b, trace, retained };
}

test('M3 pointer UNIT optional built entry exposes the router factory', () => {
  assert.equal(typeof createPointerRouter, 'function');
});

test('M3 pointer UNIT five contacts stay independent and a sixth cannot replace them', () => {
  const { router, trace } = fixture({ capacity: 5 });
  const sessions = [1, 2, 3, 4, 5].map(id => router.begin(sample(id)));
  assert.equal(router.contacts.length, 5);
  assert.throws(() => router.begin(sample(6)), code('POINTER_INPUT_CAPACITY'));
  assert.equal(router.contacts.length, 5);
  router.move(sessions[1], update());
  router.end(sessions[3], update({ buttons: 0 }));
  router.cancel(sessions[0], 'pointercancel');
  assert.deepEqual(trace, [
    ['begin', 1, 'a', null, 1, 0], ['begin', 2, 'a', null, 2, 0],
    ['begin', 3, 'a', null, 3, 0], ['begin', 4, 'a', null, 4, 0],
    ['begin', 5, 'a', null, 5, 0], ['move', 2, 'a', null, 6, 0],
    ['end', 4, 'a', null, 7, 0], ['cancel', 1, 'a', 'pointercancel', 8, 0],
  ]);
  assert.deepEqual(router.contacts.map(contact => contact.session.pointerId), [2, 3, 5]);
  router.dispose();
});

test('M3 pointer UNIT default and maximum capacity admit their full bounded profile', () => {
  for (const capacity of [undefined, 32]) {
    const { router } = fixture(capacity === undefined ? {} : { capacity });
    const count = capacity ?? 10;
    for (let id = 0; id < count; id++) router.begin(sample(id));
    assert.throws(() => router.begin(sample(count)), code('POINTER_INPUT_CAPACITY'));
    router.dispose();
  }
  for (const capacity of [0, 4, 33, 5.5, NaN, Infinity]) assert.throws(() => fixture({ capacity }), code('POINTER_INPUT_OPTIONS'));
});

test('M3 pointer UNIT duplicate IDs and stale or forged sessions never replace a live session', () => {
  const { router, trace } = fixture();
  const first = router.begin(sample(7));
  assert.throws(() => router.begin(sample(7, { timestamp: 9 })), code('POINTER_INPUT_DUPLICATE'));
  assert.equal(router.end(first, update()), true);
  const second = router.begin(sample(7));
  assert.notEqual(first, second);
  assert.equal(second.id, first.id + 1);
  assert.equal(first.generation, second.generation);
  const other = fixture();
  const foreign = other.router.begin(sample(7));
  assert.notEqual(foreign.generation, second.generation);
  for (const stale of [first, foreign, { ...second }, undefined, null]) {
    assert.equal(router.move(stale, null), false);
    assert.equal(router.end(stale, null), false);
    assert.equal(router.cancel(stale, 'pointercancel'), false);
    assert.equal(router.capture(stale, {}), false);
    assert.equal(router.releaseCapture(stale), false);
  }
  assert.equal(trace.length, 3);
  assert.equal(router.contacts[0].session, second);
  router.dispose(); other.router.dispose();
});

test('M3 pointer UNIT each contact owns its capture and release follows current picking', () => {
  const { router, a, b, trace } = fixture();
  const left = router.begin(sample(1));
  const right = router.begin(sample(2, { globalX: 20 }));
  router.move(left, update({ globalX: 20 }));
  assert.equal(router.capture(right, a), true);
  router.move(right, update({ globalX: 20 }));
  assert.equal(router.releaseCapture(left), true);
  router.move(left, update({ globalX: 20 }));
  router.end(right, update({ globalX: 20, buttons: 0 }));
  assert.equal(router.cancel(right, 'lostcapture'), false);
  router.end(left, update({ globalX: 20, buttons: 0 }));
  assert.deepEqual(trace.map(row => row.slice(0, 3)), [
    ['begin', 1, 'a'], ['begin', 2, 'b'], ['move', 1, 'a'],
    ['move', 2, 'a'], ['move', 1, 'b'], ['end', 2, 'a'], ['end', 1, 'b'],
  ]);
  assert.equal(router.capture(left, b), false);
});

test('M3 pointer UNIT empty picks reach global consumers and can later route after moving', () => {
  const target = { live: true };
  const delivered = [];
  const router = createPointerRouter({ pick: x => x > 10 ? target : undefined, eligible: x => x.live,
    dispatch: (kind, contact, picked) => delivered.push([kind, picked]) });
  const session = router.begin(sample(1));
  router.move(session, update({ globalX: 20 }));
  router.end(session, update({ globalX: 0 }));
  assert.deepEqual(delivered, [['begin', undefined], ['move', target], ['end', undefined]]);
});

test('M3 pointer UNIT invalid samples are atomic and do not advance the shared observation clock', () => {
  const { router, trace } = fixture();
  const first = router.begin(sample(1, { timestamp: 5 }));
  const bad = [
    { globalX: NaN }, { globalY: Infinity }, { buttons: -1 }, { buttons: 1.5 },
    { buttons: 65536 }, { timestamp: -1 }, { timestamp: 4 }, { timestamp: NaN },
    { pressure: -0.1 }, { pressure: 1.1 }, { width: -1 }, { height: Infinity },
  ];
  for (const changes of bad) {
    const before = router.contacts;
    assert.throws(() => router.move(first, update({ timestamp: 8, ...changes })), code('POINTER_INPUT_SAMPLE'));
    assert.deepEqual(router.contacts, before);
    assert.equal(trace.length, 1);
  }
  assert.throws(() => router.begin(sample(2, { timestamp: 9, pointerType: 'keyboard' })), code('POINTER_INPUT_SAMPLE'));
  assert.throws(() => router.begin(sample(-1, { timestamp: 9 })), code('POINTER_INPUT_SAMPLE'));
  assert.throws(() => router.begin(sample(1.5, { timestamp: 9 })), code('POINTER_INPUT_SAMPLE'));
  assert.throws(() => router.end(first, update({ timestamp: 9, pressure: NaN })), code('POINTER_INPUT_SAMPLE'));
  assert.equal(router.move(first, update({ timestamp: 5 })), true);
  const second = router.begin(sample(2, { timestamp: 6 }));
  assert.throws(() => router.move(first, update({ timestamp: 5 })), code('POINTER_INPUT_SAMPLE'));
  router.move(first, update({ timestamp: 6 }));
  router.end(second, update({ timestamp: 6 }));
  assert.equal(router.contacts.length, 1);
  router.dispose();
});

test('M3 pointer UNIT payloads retain copied optional values and cannot alias later updates', () => {
  const { router, retained } = fixture({ viewportRevision: 3 });
  const supplied = sample(1, { pointerType: 'pen', pressure: 0.25, width: 2, height: 4 });
  const session = router.begin(supplied);
  const snapshot = router.contacts;
  supplied.globalX = 99; supplied.pressure = 1;
  const moved = update({ timestamp: 1, pressure: 0.75, width: 5, height: 6 });
  router.move(session, moved);
  moved.globalX = 88; moved.width = 99;
  router.end(session, update({ timestamp: 2, buttons: 0 }));
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(session), true);
  for (const contact of retained) assert.equal(Object.isFrozen(contact), true);
  assert.deepEqual(retained.map(c => [c.globalX, c.pressure, c.width, c.height, c.sequence, c.viewportRevision]),
    [[2, 0.25, 2, 4, 1, 3], [4, 0.75, 5, 6, 2, 3], [4, undefined, undefined, undefined, 3, 3]]);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0], retained[0]);
  assert.equal(session.pointerType, 'pen');
});

test('M3 pointer UNIT terminal state is removed before callbacks and has one terminal outcome', () => {
  let terminalCount = 0;
  const { router } = fixture({ observe(kind, contact, target, reason, current) {
    if (kind !== 'end' && kind !== 'cancel') return;
    terminalCount++;
    assert.equal(current.contacts.some(c => c.session === contact.session), false);
    assert.equal(current.cancel(contact.session, 'lostcapture'), false);
    assert.equal(current.capture(contact.session, target), false);
  } });
  const a = router.begin(sample(1));
  const b = router.begin(sample(2));
  router.end(a, update()); router.cancel(b, 'lostcapture');
  router.cancelAll('blur'); router.dispose();
  assert.equal(terminalCount, 2);
});

test('M3 pointer UNIT synchronous cancellation or disposal prevents begin from returning a dead session', () => {
  for (const action of ['cancel', 'suspend', 'dispose']) {
    const { router, trace } = fixture({ observe(kind, contact, target, reason, current) {
      if (kind === 'begin') {
        if (action === 'cancel') current.cancel(contact.session, 'pointercancel');
        if (action === 'suspend') current.setInteractive(false);
        if (action === 'dispose') current.dispose();
      }
    } });
    assert.equal(router.begin(sample(1)), undefined);
    assert.equal(router.contacts.length, 0);
    assert.deepEqual(trace.map(row => row[0]), ['begin', 'cancel']);
    router.dispose();
  }
});

test('M3 pointer UNIT callback may change capture while sample reentry is refused', () => {
  const refused = [];
  let captureTarget;
  const { router, b, trace } = fixture({ observe(kind, contact, target, reason, current) {
    if (kind !== 'begin') return;
    for (const call of [() => current.begin(sample(9)), () => current.move(contact.session, update()), () => current.end(contact.session, update())]) {
      try { call(); } catch (error) { refused.push(error.code); }
    }
    assert.equal(current.capture(contact.session, captureTarget), true);
  } });
  captureTarget = b;
  const session = router.begin(sample(1));
  router.move(session, update());
  assert.deepEqual(refused, ['POINTER_INPUT_REENTRANT', 'POINTER_INPUT_REENTRANT', 'POINTER_INPUT_REENTRANT']);
  assert.equal(trace[1][2], 'b');
  router.dispose();
});

test('M3 pointer UNIT removed or disabled owners cancel even after capture release', () => {
  const { router, a, trace } = fixture();
  const session = router.begin(sample(1));
  router.releaseCapture(session);
  router.move(session, update({ globalX: 20 }));
  a.live = false;
  router.sync();
  assert.deepEqual(trace.at(-1), ['cancel', 1, null, 'owner', 3, 0]);
  assert.equal(router.contacts.length, 0);
  assert.equal(router.move(session, update()), false);
});

test('M3 pointer UNIT capture removal cancels while eligible reparenting preserves the session', () => {
  const { router, a, b, trace } = fixture();
  const session = router.begin(sample(1));
  a.parent = 'new eligible parent'; router.sync();
  assert.equal(router.contacts.length, 1);
  router.capture(session, b);
  b.live = false;
  router.sync();
  assert.deepEqual(trace.at(-1), ['cancel', 1, null, 'owner', 2, 0]);
});

test('M3 pointer UNIT a callback invalidating another contact cannot strand that contact', () => {
  let other;
  const { router, b, trace } = fixture({ observe(kind) { if (kind === 'move') other.live = false; } });
  other = b;
  const left = router.begin(sample(1));
  router.begin(sample(2, { globalX: 20 }));
  router.move(left, update());
  assert.deepEqual(trace.map(row => row.slice(0, 4)), [
    ['begin', 1, 'a', null], ['begin', 2, 'b', null], ['move', 1, 'a', null], ['cancel', 2, null, 'owner'],
  ]);
  assert.deepEqual(router.contacts.map(c => c.session.pointerId), [1]);
  router.dispose();
});

test('M3 pointer UNIT later cancellation callbacks recheck contacts already inspected by sync', () => {
  let firstTarget;
  const { router, a, b, trace } = fixture({ observe(kind, contact) {
    if (kind === 'cancel' && contact.session.pointerId === 2) firstTarget.live = false;
  } });
  firstTarget = a;
  router.begin(sample(1)); router.begin(sample(2, { globalX: 20 }));
  b.live = false; router.sync();
  assert.deepEqual(trace.map(row => row.slice(0, 4)), [
    ['begin', 1, 'a', null], ['begin', 2, 'b', null], ['cancel', 2, null, 'owner'], ['cancel', 1, null, 'owner'],
  ]);
  assert.equal(router.contacts.length, 0);
});

test('M3 pointer UNIT viewport cancellation uses the old revision before publishing the new one', () => {
  const seen = [];
  const { router, trace } = fixture({ viewportRevision: 2, observe(kind, contact, target, reason, current) {
    if (kind === 'cancel') {
      seen.push([current.viewportRevision, contact.viewportRevision]);
      assert.throws(() => current.begin(sample(99)), code('POINTER_INPUT_REENTRANT'));
    }
  } });
  const first = router.begin(sample(1)); router.begin(sample(2));
  router.setViewportRevision(3);
  assert.deepEqual(seen, [[2, 2], [2, 2]]);
  assert.equal(router.viewportRevision, 3);
  assert.equal(router.move(first, update()), false);
  router.begin(sample(1));
  assert.deepEqual(trace.at(-1), ['begin', 1, 'a', null, 5, 3]);
  for (const revision of [3, 2, -1, 3.5, NaN, Infinity]) assert.throws(() => router.setViewportRevision(revision), code('POINTER_INPUT_VIEWPORT'));
  router.dispose();
});

test('M3 pointer UNIT suspension and closure clear held state and require fresh downs', () => {
  const { router, trace } = fixture();
  const old = router.begin(sample(1));
  router.setInteractive(false);
  assert.equal(router.state, 'suspended');
  assert.equal(router.begin(sample(2)), undefined);
  assert.equal(router.move(old, update()), false);
  router.setInteractive(true);
  const fresh = router.begin(sample(1));
  assert.notEqual(fresh, old);
  router.dispose(); router.dispose(); router.setInteractive(true);
  assert.equal(router.state, 'closed');
  assert.equal(router.begin(sample(3)), undefined);
  assert.deepEqual(trace.map(row => row.slice(0, 4)), [
    ['begin', 1, 'a', null], ['cancel', 1, 'a', 'suspended'], ['begin', 1, 'a', null], ['cancel', 1, 'a', 'dispose'],
  ]);
});

for (const reason of ['pointercancel', 'lostcapture', 'blur', 'hidden', 'pagehide', 'viewport', 'owner', 'suspended', 'dispose', 'error']) {
  test(`M3 pointer UNIT ${reason} cancels the bounded active set once`, () => {
    const { router, trace } = fixture(); router.begin(sample(1)); router.begin(sample(2));
    router.cancelAll(reason); router.cancelAll(reason);
    assert.deepEqual(trace.slice(2).map(row => row.slice(0, 4)), [['cancel', 1, 'a', reason], ['cancel', 2, 'a', reason]]);
    assert.equal(router.contacts.length, 0);
    router.dispose();
  });
}

test('M3 pointer UNIT callback failures close all sessions and preserve the first cause and cleanup failures', () => {
  const first = { failure: 'first' }, cleanupA = { failure: 'cancel a' }, cleanupB = { failure: 'cancel b' };
  const seen = [];
  const { router } = fixture({ observe(kind, contact, target, reason, current) {
    if (kind === 'move') throw first;
    if (kind === 'cancel') {
      seen.push([contact.session.pointerId, reason, current.state, current.contacts.length]);
      throw contact.session.pointerId === 1 ? cleanupA : cleanupB;
    }
  } });
  const a = router.begin(sample(1)); router.begin(sample(2));
  assert.throws(() => router.move(a, update()), error => {
    assert.equal(error instanceof EgretError, true);
    assert.equal(error.code, 'POINTER_INPUT_CALLBACK_FAILED');
    assert.equal(error.cause, first);
    assert.deepEqual(error.cleanupErrors, [cleanupA, cleanupB]);
    return true;
  });
  assert.deepEqual(seen, [[1, 'error', 'closed', 0], [2, 'error', 'closed', 0]]);
  assert.equal(router.state, 'closed');
  assert.equal(router.begin(sample(3)), undefined);
});

test('M3 pointer UNIT a thrown undefined cause remains present and never strands other cancellations', () => {
  const { router, trace } = fixture({ observe(kind, contact) {
    if (kind === 'cancel' && contact.session.pointerId === 1) throw undefined;
  } });
  router.begin(sample(1)); router.begin(sample(2));
  assert.throws(() => router.cancelAll('blur'), error => error instanceof EgretError && error.cause === undefined && error.cleanupErrors.length === 0);
  assert.deepEqual(trace.slice(2).map(row => row.slice(0, 4)), [['cancel', 1, 'a', 'blur'], ['cancel', 2, 'a', 'error']]);
  assert.equal(router.state, 'closed');
});

test('M3 pointer UNIT picking and eligibility failures also close active contacts', () => {
  for (const port of ['pick', 'eligible']) {
    let fail = false;
    const cause = { port }, target = {}, seen = [];
    const router = createPointerRouter({
      pick() { if (fail && port === 'pick') throw cause; return target; },
      eligible() { if (fail && port === 'eligible') throw cause; return true; },
      dispatch(kind, contact, picked, reason) { seen.push([kind, reason, picked]); },
    });
    const session = router.begin(sample(1)); router.releaseCapture(session); fail = true;
    assert.throws(() => router.move(session, update()), error => error instanceof EgretError && error.cause === cause);
    assert.equal(router.state, 'closed'); assert.equal(router.contacts.length, 0);
    assert.equal(seen.at(-1)[0], 'cancel'); assert.equal(seen.at(-1)[1], 'error');
  }
});

test('M3 pointer UNIT cancelling from an eligibility callback cannot recurse or duplicate terminals', () => {
  const target = {}, trace = [];
  let cancelDuringEligibility = false, session;
  const router = createPointerRouter({ pick: () => target, eligible() {
    if (cancelDuringEligibility) router.cancel(session, 'pointercancel');
    return true;
  }, dispatch(kind, contact, picked, reason) { trace.push([kind, reason]); } });
  session = router.begin(sample(1)); cancelDuringEligibility = true;
  router.sync();
  assert.deepEqual(trace, [['begin', undefined], ['cancel', 'pointercancel']]);
  assert.equal(router.contacts.length, 0);
});

test('M3 pointer UNIT nested cancellation failure cannot be swallowed to continue routing', () => {
  const cause = { nested: true }, trace = [];
  let other;
  const { router } = fixture({ observe(kind, contact, target, reason, current) {
    trace.push([kind, contact.session.pointerId]);
    if (kind === 'move') {
      try { current.cancel(other, 'pointercancel'); } catch { /* A consumer cannot reopen a failed router. */ }
    }
    if (kind === 'cancel' && contact.session.pointerId === 2) throw cause;
  } });
  const first = router.begin(sample(1)); other = router.begin(sample(2));
  assert.throws(() => router.move(first, update()), error => error instanceof EgretError && error.cause === cause);
  assert.equal(router.state, 'closed');
  assert.equal(router.contacts.length, 0);
  assert.deepEqual(trace, [['begin', 1], ['begin', 2], ['move', 1], ['cancel', 2], ['cancel', 1]]);
});

test('M3 pointer UNIT uncaught sample reentry closes the active router instead of losing the first cause', () => {
  const { router, trace } = fixture({ observe(kind, contact, target, reason, current) {
    if (kind === 'move') current.begin(sample(99));
  } });
  const session = router.begin(sample(1));
  assert.throws(() => router.move(session, update()), error => error.code === 'POINTER_INPUT_CALLBACK_FAILED'
    && error.cause instanceof EgretError && error.cause.code === 'POINTER_INPUT_REENTRANT');
  assert.equal(router.state, 'closed');
  assert.deepEqual(trace.map(row => row.slice(0, 4)), [['begin', 1, 'a', null], ['move', 1, 'a', null], ['cancel', 1, 'a', 'error']]);
});

test('M3 pointer UNIT self-removal in begin cancels global held state before returning', () => {
  const { router, trace } = fixture({ observe(kind, contact, target) { if (kind === 'begin') target.live = false; } });
  assert.equal(router.begin(sample(1)), undefined);
  assert.deepEqual(trace.map(row => row.slice(0, 4)), [['begin', 1, 'a', null], ['cancel', 1, null, 'owner']]);
});

test('M3 pointer UNIT callback errors during end preserve that end and cancel only other live sessions', () => {
  const cause = { ended: true };
  const { router, trace } = fixture({ observe(kind) { if (kind === 'end') throw cause; } });
  const first = router.begin(sample(1)); router.begin(sample(2));
  assert.throws(() => router.end(first, update()), error => error instanceof EgretError && error.cause === cause);
  assert.deepEqual(trace.map(row => row.slice(0, 4)), [
    ['begin', 1, 'a', null], ['begin', 2, 'a', null], ['end', 1, 'a', null], ['cancel', 2, 'a', 'error'],
  ]);
  assert.equal(router.state, 'closed');
});

test('M3 pointer UNIT viewport publication remains old if a cancellation callback closes or fails', () => {
  for (const fail of [false, true]) {
    const cause = { viewport: true };
    const { router } = fixture({ viewportRevision: 4, observe(kind, contact, target, reason, current) {
      if (kind === 'cancel') { if (fail) throw cause; current.dispose(); }
    } });
    router.begin(sample(1));
    if (fail) assert.throws(() => router.setViewportRevision(5), error => error instanceof EgretError && error.cause === cause);
    else router.setViewportRevision(5);
    assert.equal(router.viewportRevision, 4);
    assert.equal(router.state, 'closed');
    assert.equal(router.contacts.length, 0);
  }
});

test('M3 pointer UNIT capture eligibility callbacks must not leave other disabled contacts active', () => {
  const first = { name: 'first', live: true }, second = { name: 'second', live: true }, candidate = { name: 'candidate', live: false };
  let disableOther = false;
  const trace = [];
  const router = createPointerRouter({ pick: x => x < 10 ? first : second,
    eligible(target) { if (disableOther && target === candidate) second.live = false; return target.live; },
    dispatch(kind, contact, target, reason) { trace.push([kind, contact.session.pointerId, target?.name ?? null, reason ?? null]); },
  });
  const a = router.begin(sample(1)); router.begin(sample(2, { globalX: 20 }));
  disableOther = true;
  assert.equal(router.capture(a, candidate), false);
  assert.deepEqual(router.contacts.map(c => c.session.pointerId), [1]);
  assert.deepEqual(trace.at(-1), ['cancel', 2, null, 'owner']);
  router.dispose();
});

test('M3 pointer UNIT release eligibility callbacks revalidate other contacts immediately', () => {
  const first = { name: 'first', live: true }, second = { name: 'second', live: true };
  let disableOther = false;
  const trace = [];
  const router = createPointerRouter({ pick: x => x < 10 ? first : second,
    eligible(target) { if (disableOther && target === first) second.live = false; return target.live; },
    dispatch(kind, contact, target, reason) { trace.push([kind, contact.session.pointerId, target?.name ?? null, reason ?? null]); },
  });
  const a = router.begin(sample(1)); router.begin(sample(2, { globalX: 20 }));
  disableOther = true;
  assert.equal(router.releaseCapture(a), true);
  assert.deepEqual(router.contacts.map(c => c.session.pointerId), [1]);
  assert.deepEqual(trace.at(-1), ['cancel', 2, null, 'owner']);
  router.dispose();
});

test('M3 pointer UNIT disposal retains cleanup ports through every cancellation then stops all port calls', () => {
  const target = {}, trace = [];
  let picks = 0, eligibilityChecks = 0;
  const router = createPointerRouter({ pick() { picks++; return target; }, eligible() { eligibilityChecks++; return true; },
    dispatch(kind, contact, picked, reason) {
      trace.push([kind, contact.session.pointerId, reason ?? null]);
      if (kind === 'cancel') router.dispose();
    },
  });
  const first = router.begin(sample(1)); router.begin(sample(2));
  router.dispose();
  assert.deepEqual(trace, [['begin', 1, null], ['begin', 2, null], ['cancel', 1, 'dispose'], ['cancel', 2, 'dispose']]);
  const stopped = [picks, eligibilityChecks, trace.length];
  router.sync(); router.dispose(); router.setInteractive(true); router.setViewportRevision(1);
  router.cancelAll('blur');
  assert.equal(router.begin(sample(3)), undefined);
  assert.equal(router.move(first, update()), false);
  assert.equal(router.end(first, update()), false);
  assert.equal(router.cancel(first, 'lostcapture'), false);
  assert.equal(router.capture(first, target), false);
  assert.equal(router.releaseCapture(first), false);
  assert.deepEqual([picks, eligibilityChecks, trace.length], stopped);
  assert.equal(router.state, 'closed');
  assert.equal(router.contacts.length, 0);
});

test('M3 pointer UNIT error cleanup finishes every cancellation despite recursive disposal', () => {
  const cause = { callback: true }, trace = [];
  const { router } = fixture({ observe(kind, contact, target, reason, current) {
    trace.push([kind, contact.session.pointerId, reason ?? null]);
    if (kind === 'move') throw cause;
    if (kind === 'cancel') current.dispose();
  } });
  const session = router.begin(sample(1)); router.begin(sample(2));
  assert.throws(() => router.move(session, update()), error => error instanceof EgretError && error.cause === cause);
  assert.deepEqual(trace, [['begin', 1, null], ['begin', 2, null], ['move', 1, null], ['cancel', 1, 'error'], ['cancel', 2, 'error']]);
  assert.equal(router.contacts.length, 0);
});

test('M3 pointer UNIT callback calls do not expose the mutable private port container as a receiver', () => {
  const receivers = [], target = {};
  const router = createPointerRouter({
    pick() { receivers.push(this); return target; },
    eligible() { receivers.push(this); return true; },
    dispatch() { receivers.push(this); },
  });
  router.begin(sample(1)); router.dispose();
  assert.ok(receivers.length > 0);
  assert.equal(receivers.every(receiver => receiver === undefined), true);
});
