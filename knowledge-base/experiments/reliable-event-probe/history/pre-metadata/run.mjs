import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LegacyGraphicsMirror, ReliableEventProbe } from './model.mjs';

const results = [];
function test(name, breakCaught, fn) {
  try { const observations = fn(); results.push({ name, status: 'passed', breakCaught, observations }); }
  catch (error) { results.push({ name, status: 'failed', breakCaught, error: error.message }); }
}
const probe = (options = {}) => new ReliableEventProbe(options);

test('invalid producer inputs cannot create a permanently blocked accepted event', 'accepting non-events or ambiguous identities into the reliable stream', () => {
  for (const capacity of [0, -1, 1.5]) assert.throws(() => probe({ capacity }), RangeError);
  for (const field of ['producerSession', 'streamId', 'consumerSession']) assert.throws(() => probe({ [field]: 'bad/id' }), TypeError);
  const p = probe();
  for (const effect of ['', null, {}, 7]) assert.throws(() => p.append(effect), TypeError);
  assert.equal(p.outbox.length, 0); assert.equal(p.append('sound-A').sequence, 1);
  return { invalidCapacities: 3, invalidIdentities: 3, invalidEffects: 4, firstAcceptedSequence: 1 };
});

test('old graphics snapshot permanently skips a dropped required event', 'treating snapshot sequence as event consumption proof', () => {
  const old = new LegacyGraphicsMirror();
  const dropped = { epoch: 1, sequence: 1, events: ['sound-A'] };
  assert.equal(old.receive({ epoch: 1, sequence: 2, events: ['sound-B'] }), false);
  old.restore({ epoch: 2, next: 3, visual: 'latest-frame' });
  assert.equal(old.receive(dropped), false);
  assert.deepEqual(old.effects, []);
  return { droppedEvent: 'sound-A', effects: old.effects, newGraphicsEpoch: old.epoch, eventRecovered: false };
});

test('dropped delivery stays pending and is recovered by resend', 'removing an event on send before confirmation', () => {
  const p = probe(); p.append('sound-A'); p.pending();
  assert.equal(p.outbox.length, 1);
  const resend = p.pending(); assert.equal(resend.length, 1);
  const reply = p.receive(resend[0]); p.acknowledge(reply.ack);
  assert.deepEqual(p.effects, ['sound-A']); assert.equal(p.outbox.length, 0);
  return { effects: p.effects, outstanding: p.outbox.length };
});

test('lost ACK causes retransmission with one actual side effect', 'executing a duplicate event again', () => {
  const p = probe(); p.append('sound-A'); const [first] = p.pending();
  p.receive(first); const [resent] = p.pending(); assert.ok(resent);
  assert.equal(resent.eventID, first.eventID);
  const reply = p.receive(resent); assert.equal(reply.status, 'duplicate');
  p.acknowledge(reply.ack); assert.deepEqual(p.effects, ['sound-A']);
  return { deliveries: 2, effects: p.effects, outstanding: p.outbox.length };
});

test('missing sequence blocks effects until the gap is filled', 'consuming sequence two before sequence one', () => {
  const p = probe(); p.append('sound-A'); p.append('sound-B'); const [a, b] = p.pending();
  assert.equal(p.receive(b).status, 'gap'); assert.deepEqual(p.effects, []);
  p.receive(a); p.receive(b); assert.deepEqual(p.effects, ['sound-A', 'sound-B']);
  assert.equal(p.watermark, 2); return { effects: p.effects, watermark: p.watermark };
});

test('graphics epoch recovery keeps required outbox and consumer watermark', 'resetting reliable state during visual recovery', () => {
  const p = probe(); p.append('sound-A'); p.append('sound-B'); const [a, b] = p.pending();
  p.receive(a); p.restoreGraphics(2);
  assert.equal(p.watermark, 1); assert.equal(p.outbox.length, 2);
  assert.equal(p.receive(a).status, 'duplicate'); p.receive(b);
  assert.deepEqual(p.effects, ['sound-A', 'sound-B']);
  return { graphicsEpoch: p.graphicsEpoch, watermark: p.watermark, effects: p.effects };
});

test('bounded outbox rejects new events without losing accepted events or a sequence', 'dropping accepted events to make room or advancing sequence on rejection', () => {
  const p = probe({ capacity: 2 }); p.append('sound-A'); p.append('sound-B');
  assert.equal(p.append('sound-C'), null); assert.equal(p.outbox.length, 2);
  const [a, b] = p.pending(); p.receive(a); const reply = p.receive(b); p.acknowledge(reply.ack);
  const c = p.append('sound-C'); assert.equal(c.sequence, 3);
  const [sent] = p.pending(); p.receive(sent); assert.deepEqual(p.effects, ['sound-A', 'sound-B', 'sound-C']);
  return { rejected: 1, effects: p.effects, nextAcceptedSequence: c.sequence };
});

test('ACK identity rejects stale producer stream and consumer sessions', 'letting a foreign ACK evict current events', () => {
  const p = probe(); p.append('sound-A'); const [a] = p.pending(); const { ack } = p.receive(a);
  for (const field of ['producerSession', 'streamId', 'consumerSession']) {
    assert.equal(p.acknowledge({ ...ack, [field]: 'old-session' }), false);
    assert.equal(p.outbox.length, 1);
  }
  assert.equal(p.acknowledge(ack), true); assert.equal(p.outbox.length, 0);
  return { rejectedIdentities: 3, effects: p.effects, outstanding: p.outbox.length };
});

test('ACK cannot skip unsent accepted events', 'trusting an impossible future cumulative ACK', () => {
  const p = probe(); const a = p.append('sound-A');
  const forged = { ...a, watermark: 1 };
  assert.equal(p.acknowledge(forged), false); assert.equal(p.outbox.length, 1);
  p.pending(); const { ack } = p.receive(a); assert.equal(p.acknowledge({ ...ack, watermark: 2 }), false);
  assert.equal(p.outbox.length, 1); p.acknowledge(ack);
  return { effects: p.effects, outstanding: p.outbox.length, impossibleACKsRejected: 2 };
});

test('malformed event and ACK are rejected without consumption or eviction', 'changing state before all envelope fields are validated', () => {
  const p = probe(); p.append('sound-A'); const [a] = p.pending();
  for (const malformed of [{ ...a, version: 9 }, { ...a, sequence: 0 }, { ...a, eventID: 'wrong' }, { ...a, effect: '' }, { ...a, consumerSession: 'old' }, { ...a, streamId: 'other' }]) {
    assert.equal(p.receive(malformed).status, 'invalid'); assert.deepEqual(p.effects, []); assert.equal(p.watermark, 0);
  }
  assert.equal(p.acknowledge({ ...a, watermark: Number.NaN }), false); assert.equal(p.outbox.length, 1);
  const { ack } = p.receive(a);
  for (const malformed of [{ ...ack, version: 9 }, { ...ack, eventID: 'wrong' }, { ...ack, watermark: -1 }, { ...ack, watermark: 0.5 }]) {
    assert.equal(p.acknowledge(malformed), false); assert.equal(p.outbox.length, 1);
  }
  return { invalidEvents: 6, invalidACKs: 5, effects: p.effects, outstanding: p.outbox.length };
});

test('caller mutations cannot rewrite accepted or transmitted events', 'sharing mutable envelope objects with the transport', () => {
  const p = probe(); const a = p.append('sound-A'); a.effect = 'tampered';
  const first = p.pending(); first[0].effect = 'tampered';
  const retry = p.pending(); assert.equal(retry.length, 1); p.receive(retry[0]);
  assert.deepEqual(p.effects, ['sound-A']); return { effects: p.effects };
});

test('duplicate cumulative ACK preserves newer unconfirmed events', 'evicting every queued event for an old valid ACK', () => {
  const p = probe(); p.append('sound-A'); const [a] = p.pending(); const { ack } = p.receive(a); p.acknowledge(ack);
  p.append('sound-B'); p.acknowledge(ack); assert.equal(p.outbox.length, 1);
  const [b] = p.pending(); p.receive(b); assert.deepEqual(p.effects, ['sound-A', 'sound-B']);
  return { effects: p.effects, outstanding: p.outbox.length };
});

// Boundary characterization, not a promised recovery feature. Two instances model
// state reset; this does not execute or simulate an OS process crash.
test('consumer memory reset demonstrates duplicate side effects without durable commit', 'mistaking in-memory watermark deduplication for crash-safe exactly-once execution', () => {
  const before = probe(); before.append('sound-A'); const [event] = before.pending();
  before.receive(event); // Effect happened, but ACK and persisted watermark are absent.
  const after = probe(); assert.equal(after.receive(event).status, 'consumed');
  const observedEffects = [...before.effects, ...after.effects];
  assert.deepEqual(observedEffects, ['sound-A', 'sound-A']);
  return { sameEventID: event.eventID, observedEffects, actualSideEffectCountAcrossStateReset: 2, crashSafeExactlyOnce: false, resetMethod: 'new in-memory instance, not OS process crash' };
});

const sources = ['model.mjs', 'run.mjs'].map(name => {
  const path = fileURLToPath(new URL(name, import.meta.url)); const source = readFileSync(path, 'utf8');
  return { path, sha256: createHash('sha256').update(source).digest('hex'), source };
});
const report = {
  schemaVersion: 1, experiment: 'reliable-event-probe', checkedAtUtc: new Date().toISOString(),
  environment: { runtime: process.version, executable: process.execPath, platform: process.platform, architecture: process.arch, scope: 'single-process synchronous in-memory model' },
  counts: { total: results.length, passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status === 'failed').length }, results,
  sourceHashes: sources.map(({ path, sha256 }) => ({ path, sha256 })),
  limitations: ['No network, IPC, WASM, graphics/audio engine or real device execution.', 'No durable transaction coupling between side effects and consumer watermark; process crash may lose accepted events or cause duplicate effects.', 'Delivery is eventual only if transport retries fairly and an active consumer eventually accepts; permanent packet loss is not overcome.', 'Outbox is count-bounded; producer must handle explicit refusal. Consumer intentionally discards out-of-order events and waits for resend.', 'ACK validation is structural and session scoped, without authentication against hostile peers.', 'Graphics epoch differs from event stream lifetime. Consumer process restart and session rebind are not recovery operations modeled here.', 'Consumer side effect is an in-memory array append, assumed synchronous and atomic with watermark advancement. External side effects and exceptions require another contract.'],
};
if (process.argv.includes('--preserve-sources')) report.sourceSnapshots = sources;
const output = process.argv.find(x => x.startsWith('--output='))?.slice(9) ?? fileURLToPath(new URL('../../evidence/reliable-event-probe-results.json', import.meta.url));
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, counts: report.counts, failures: results.filter(x => x.status === 'failed').map(x => ({ name: x.name, error: x.error })) }, null, 2));
if (report.counts.failed) process.exitCode = 1;
