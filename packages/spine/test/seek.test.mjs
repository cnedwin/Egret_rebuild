// SPDX-License-Identifier: Apache-2.0
// Staged seek: a playback rebuilt from its history must be the playback a straight run produces.
// Original numerical fixtures; none has a physics constraint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer } from '@egret/engine';
import { createSpineContentLoader, createSpineDisplay, createSpineInstance, createSpineResetSlot } from '@egret/spine';
import { host } from '../../../tests/helpers.mjs';
import { fixture, ports, atlas } from './fixtures.mjs';
import { playbackSource } from './playbackFixture.mjs';
import { renderingSource } from './renderingFixture.mjs';

const coded = code => error => error?.code === 'SPINE_INSTANCE_' + code;
async function setup(t, skeleton = playbackSource()) {
  const engine = await createEngine({ host: host().adapter }), data = fixture({ skeleton, atlasText: atlas }), p = ports(data);
  const loader = createSpineContentLoader(engine, engine.createScope(), data.manifest, p.factory), group = loader.load(engine.createScope(), ['e_json']);
  await group.ready;
  t.after(async () => { await loader.close(); await engine.dispose(); });
  const asset = group.getSpine('e_json');
  return { engine, asset, loader, make: options => createSpineInstance(asset, engine.createScope(), options) };
}
/** Everything of a snapshot that says where the playback stands. Revision and clock identity are the instance's own. */
const stand = ({ state, elapsedSeconds, rate, skin, skins, bones, slots, tracks }) => ({ state, elapsedSeconds, rate, skin, skins, bones, slots, tracks });
const same = (actual, expected, label = 'the stand of the playback') => assert.deepEqual(stand(actual), stand(expected), label);
/** The same stand to within rounding: for a moment that two runs reach by different sums. */
function close(actual, expected, label, path = '') {
  if (typeof expected === 'number') { assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), label + ' ' + path + ': ' + actual + ' != ' + expected); return; }
  if (expected === null || typeof expected !== 'object') { assert.equal(actual, expected, label + ' ' + path); return; }
  assert.deepEqual(Object.keys(actual), Object.keys(expected), label + ' ' + path);
  for (const key of Object.keys(expected)) close(actual[key], expected[key], label, path + '.' + key);
}
/** A script is a list of steps: the commands issued before an advance, and its delta. */
function runner(instance) {
  let tickId = 0;
  return {
    step([issue, delta]) { issue?.(instance); return instance.advance({ tickId: ++tickId, elapsedSeconds: tickId, deltaSeconds: delta }); },
    run(script) { return script.map(step => this.step(step)); },
  };
}
function finish(ticket) { let slices = 0; while (!ticket.step()) if (++slices > 10000) throw new Error('seek does not end'); return slices + 1; }
function seekTo(instance, elapsedSeconds, events) { const ticket = instance.seek({ elapsedSeconds, ...(events ? { events } : {}) }); finish(ticket); return ticket.commit(); }
const mixed = [
  [a => { a.setAnimation(0, 'move', { loop: true }); a.setSkin('alternate'); }, 0.05],
  [a => a.setAnimation(1, 'rise', { loop: true }), 0.03],
  [a => a.setTransform(5, -3, 2, 1), 1 / 60],
  [a => a.setRate(0.5), 0.1],
  [a => { a.setAnimation(0, 'hold', { mixSeconds: 0.05 }); a.setRate(1); }, 0.02],
  [undefined, 0.02],
  [a => a.setPaused(true), 0.1],
  [a => { a.setPaused(false); a.addAnimation(0, 'move', { mixSeconds: 0.02, delaySeconds: 0.01 }); }, 0.04],
  [a => a.clearTrack(1), 0.03],
  [a => a.setSkins(['default', 'alternate']), 0.05],
];
const finite = [
  [a => { a.setAnimation(0, 'move', { plays: 2 }); a.addAnimation(0, 'rise', { plays: 1 }); a.addAnimation(0, 'hold', { loop: true, mixSeconds: 0.01 }); }, 0.1],
  [undefined, 0.1], [undefined, 0.08], [undefined, 0.11], [a => a.setAnimation(1, 'rise', { plays: 3 }), 0.13], [undefined, 0.12], [undefined, 0.13],
];

for (const [name, script] of [['mixed commands', mixed], ['finite plays and queues', finite]]) {
  test('SK01 a seek to each moment of ' + name + ' stands where the straight run stood', async t => {
    const s = await setup(t), straight = s.make(), expected = runner(straight).run(script);
    for (let index = 0; index < script.length; index++) {
      const instance = s.make(), all = runner(instance).run(script), before = all.at(-1);
      // Several steps may end at one moment. A seek stands where the last of them stood.
      let last = index; while (last + 1 < script.length && expected[last + 1].elapsedSeconds === expected[index].elapsedSeconds) last++;
      const after = seekTo(instance, expected[index].elapsedSeconds);
      same(after, expected[last], 'step ' + index);
      assert.equal(after.revision, before.revision + 1); assert.equal(after.tickId, before.tickId); assert.deepEqual(after.events, []);
      assert.ok(Object.isFrozen(after) && Object.isFrozen(after.bones));
    }
  });
  test('SK02 after a seek back, the same steps lead to the same end for ' + name, async t => {
    const s = await setup(t), straight = s.make(), expected = runner(straight).run(script);
    for (const cut of [0, 2, 4, script.length - 2]) {
      const instance = s.make(), run = runner(instance); run.run(script);
      let last = cut; while (last + 1 < script.length && expected[last + 1].elapsedSeconds === expected[cut].elapsedSeconds) last++;
      seekTo(instance, expected[cut].elapsedSeconds);
      // What came after that moment is no longer the past of this instance: it is applied again.
      const again = script.slice(last + 1).map(step => run.step(step));
      again.forEach((snapshot, offset) => same(snapshot, expected[last + 1 + offset], 'cut ' + cut + ' step ' + offset));
      // And the history that leads there is whole: a second seek finds the same moments.
      same(seekTo(instance, expected[1].elapsedSeconds), expected[1], 'second seek after cut ' + cut);
    }
  });
  test('SK03 a seek inside a step equals a run whose last advance stopped there, for ' + name, async t => {
    const s = await setup(t);
    for (const [index, share] of [[0, 0.5], [3, 0.25], [4, 0.9], [script.length - 1, 0.01]]) {
      const instance = s.make(); runner(instance).run(script);
      const shortened = s.make(), run = runner(shortened); run.run(script.slice(0, index));
      const expected = run.step([script[index][0], script[index][1] * share]);
      // The seek reaches this moment as a difference of two sums, the short run as a product: equal to within rounding.
      close(stand(seekTo(instance, expected.elapsedSeconds)), stand(expected), 'inside step ' + index);
    }
  });
}

test('SK04 a seek to the present changes nothing but the revision, and the time zero of a plain instance is its setup pose', async t => {
  const s = await setup(t), instance = s.make(), setupPose = instance.getSnapshot(), run = runner(instance), all = run.run(mixed);
  const here = seekTo(instance, all.at(-1).elapsedSeconds);
  same(here, all.at(-1)); assert.equal(here.revision, all.at(-1).revision + 1);
  const zero = seekTo(instance, 0);
  // The first commands were applied by the first advance, after time zero was published.
  same(zero, { ...setupPose, state: 'running' }); assert.deepEqual(zero.tracks, []);
  same(run.step(mixed[0]), all[0]);
});

test('SK05 a forward seek equals advancing by ordinary steps, and replays their events only when asked', async t => {
  const s = await setup(t), heard = [], instance = s.make({ onEvent: event => heard.push(event) }), plain = s.make(), collected = [];
  for (const each of [instance, plain]) { each.setAnimation(0, 'move', { loop: true }); each.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.03 }); }
  heard.length = 0;
  // The ordinary step of an instance is eight segments of a sixtieth.
  const target = 0.03 + 0.5; let tickId = 1, remaining = 0.5, reached = 0.03, segments = Math.ceil(0.03 * 60);
  while (remaining > 1e-12) { const delta = Math.min(8 / 60, target - reached); collected.push(...plain.advance({ tickId: ++tickId, elapsedSeconds: tickId, deltaSeconds: delta }).events); segments += Math.ceil(delta * 60); reached += delta; remaining = target - reached; }
  const ticket = instance.seek({ elapsedSeconds: target, events: 'replay' });
  // Three whole steps of eight segments and the remainder.
  assert.equal(ticket.totalSegments, segments); assert.ok(segments === 32 || segments === 33); assert.equal(ticket.targetSeconds, target);
  finish(ticket);
  assert.deepEqual(heard, []);
  const after = ticket.commit();
  same(after, plain.getSnapshot());
  assert.ok(collected.length > 10 && collected.some(event => event.kind === 'event') && collected.some(event => event.kind === 'complete'));
  assert.deepEqual(after.events, collected); assert.deepEqual(heard, collected); assert.ok(Object.isFrozen(after.events));
  // Suppressed by default, forward as well as backward.
  heard.length = 0;
  const silent = seekTo(instance, target + 0.3);
  assert.deepEqual(silent.events, []); assert.deepEqual(heard, []);
  for (let at = target; target + 0.3 - at > 1e-12;) { const delta = Math.min(8 / 60, target + 0.3 - at); plain.advance({ tickId: ++tickId, elapsedSeconds: tickId, deltaSeconds: delta }); at += delta; }
  same(silent, plain.getSnapshot());
  // The next ordinary advance continues from there with its own events.
  assert.deepEqual(instance.advance({ tickId: 2, elapsedSeconds: 2, deltaSeconds: 0.1 }).events, plain.advance({ tickId: ++tickId, elapsedSeconds: tickId, deltaSeconds: 0.1 }).events);
  same(instance.getSnapshot(), plain.getSnapshot());
});

test('SK06 a request is checked before anything is staged', async t => {
  const s = await setup(t), instance = s.make(); runner(instance).run(mixed);
  const before = instance.getSnapshot();
  for (const request of [{ elapsedSeconds: -1 }, { elapsedSeconds: Number.NaN }, { elapsedSeconds: Infinity }, { elapsedSeconds: '1' }, {}, { elapsedSeconds: 0.1, events: 'reverse' }, { elapsedSeconds: 0.1, events: true }])
    assert.throws(() => instance.seek(request), coded('SEEK_INVALID'), JSON.stringify(request));
  for (const request of [null, 5, { elapsedSeconds: 0.1, loop: true }, { get elapsedSeconds() { return 0.1; } }]) assert.throws(() => instance.seek(request), coded('OPTIONS_INVALID'));
  // Events are never played backward.
  assert.throws(() => instance.seek({ elapsedSeconds: 0.1, events: 'replay' }), coded('SEEK_BACKWARD_EVENTS'));
  assert.deepEqual(instance.getSnapshot(), before);
  // Nothing was left staged by a refusal.
  instance.seek({ elapsedSeconds: 0.1 }).cancel();
});

test('SK07 a seek is prepared in slices of bounded work', async t => {
  const s = await setup(t), instance = s.make({ seek: { sliceSegments: 5 } }), run = runner(instance);
  instance.setAnimation(0, 'move', { loop: true });
  for (let index = 0; index < 12; index++) run.step([undefined, 2 / 60]);
  const before = instance.getSnapshot(), ticket = instance.seek({ elapsedSeconds: before.elapsedSeconds });
  assert.equal(ticket.state, 'staged'); assert.equal(ticket.totalSegments, 24); assert.equal(ticket.completedSegments, 0);
  const progress = [];
  while (!ticket.step()) { progress.push(ticket.completedSegments); assert.equal(ticket.state, 'staged'); assert.deepEqual(instance.getSnapshot(), before); }
  // Two-segment steps fill a slice of five with two of them.
  assert.deepEqual(progress, [4, 8, 12, 16, 20]);
  assert.equal(ticket.state, 'ready'); assert.equal(ticket.completedSegments, 24); assert.equal(ticket.step(), true);
  assert.deepEqual(instance.getSnapshot(), before);
  same(ticket.commit(), before); assert.equal(ticket.state, 'committed');
  // A step larger than a slice still moves: one slice takes it whole.
  const wide = s.make({ maxSegments: 30, seek: { sliceSegments: 4 } }); wide.setAnimation(0, 'move', { loop: true });
  wide.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.5 });
  const whole = wide.seek({ elapsedSeconds: 0.5 }); assert.equal(whole.step(), true); assert.equal(whole.completedSegments, 30);
  assert.ok(Object.isFrozen(ticket));
});

test('SK08 a seek beyond its budget is refused, and events beyond theirs fail it whole', async t => {
  const s = await setup(t), heard = [], instance = s.make({ seek: { maxSegments: 20, maxEvents: 3 }, onEvent: event => heard.push(event) });
  instance.setAnimation(0, 'move', { loop: true }); instance.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.05 });
  const before = instance.getSnapshot(); heard.length = 0;
  assert.throws(() => instance.seek({ elapsedSeconds: 0.05 + 18 / 60 }), coded('SEEK_LIMIT'));
  assert.deepEqual(instance.getSnapshot(), before);
  // Seventeen more segments fit, but pass more than three events.
  const ticket = instance.seek({ elapsedSeconds: 0.05 + 17 / 60, events: 'replay' });
  assert.throws(() => finish(ticket), coded('SEEK_EVENT_LIMIT'));
  assert.equal(ticket.state, 'failed'); assert.deepEqual(heard, []); assert.deepEqual(instance.getSnapshot(), before);
  assert.throws(() => ticket.step(), coded('SEEK_FAILED')); assert.throws(() => ticket.commit(), coded('SEEK_FAILED'));
  // The same move without its events is admitted, and the instance is free for it.
  const silent = seekTo(instance, 0.05 + 17 / 60);
  assert.equal(silent.elapsedSeconds, 0.05 + 17 / 60); assert.deepEqual(heard, []);
});

test('SK09 one seek at a time; a cancelled one leaves the instance as it was', async t => {
  const s = await setup(t), instance = s.make(), all = runner(instance).run(mixed), before = instance.getSnapshot();
  const ticket = instance.seek({ elapsedSeconds: all[2].elapsedSeconds });
  assert.throws(() => instance.seek({ elapsedSeconds: 0 }), coded('SEEK_ACTIVE'));
  assert.throws(() => ticket.commit(), coded('SEEK_NOT_READY')); assert.equal(ticket.state, 'staged');
  finish(ticket); ticket.cancel(); ticket.cancel();
  assert.equal(ticket.state, 'cancelled'); assert.deepEqual(instance.getSnapshot(), before);
  assert.throws(() => ticket.step(), coded('SEEK_CANCELLED')); assert.throws(() => ticket.commit(), coded('SEEK_CANCELLED'));
  const second = instance.seek({ elapsedSeconds: all[2].elapsedSeconds }); finish(second); same(second.commit(), all[2]);
  assert.throws(() => second.step(), coded('SEEK_COMMITTED')); assert.throws(() => second.commit(), coded('SEEK_COMMITTED'));
  second.cancel(); assert.equal(second.state, 'committed');
});

test('SK10 an advance cancels a seek that was planned before it, and disposal cancels one too', async t => {
  const s = await setup(t), instance = s.make(), run = runner(instance); run.run(mixed.slice(0, 4));
  const ticket = instance.seek({ elapsedSeconds: 0.05 }); ticket.step();
  const next = run.step(mixed[4]);
  assert.equal(ticket.state, 'cancelled'); assert.throws(() => ticket.commit(), coded('SEEK_CANCELLED'));
  const straight = s.make(); same(next, runner(straight).run(mixed.slice(0, 5)).at(-1));
  const last = instance.seek({ elapsedSeconds: 0.05 });
  instance.dispose();
  assert.equal(last.state, 'cancelled'); assert.throws(() => last.step(), coded('SEEK_CANCELLED'));
  assert.throws(() => instance.seek({ elapsedSeconds: 0 }), coded('DISPOSED'));
});

test('SK11 a history that outgrew its bounds is dropped, and a seek is then refused while playback goes on', async t => {
  const s = await setup(t);
  const byAdvances = s.make({ seek: { historyAdvances: 3 } }), first = runner(byAdvances); byAdvances.setAnimation(0, 'move', { loop: true });
  for (let index = 0; index < 3; index++) first.step([undefined, 0.01]);
  seekTo(byAdvances, 0.01);
  // The seek kept one advance; three more fit, and a fourth does not.
  for (let index = 0; index < 2; index++) first.step([undefined, 0.01]);
  byAdvances.seek({ elapsedSeconds: 0.01 }).cancel();
  first.step([undefined, 0.01]); const full = first.step([undefined, 0.01]);
  assert.throws(() => byAdvances.seek({ elapsedSeconds: 0.01 }), coded('SEEK_HISTORY'));
  assert.equal(first.step([undefined, 0.01]).elapsedSeconds > full.elapsedSeconds, true);
  const byCommands = s.make({ seek: { historyCommands: 2 } }), second = runner(byCommands);
  second.step([a => { a.setAnimation(0, 'move'); a.setRate(2); }, 0.01]); byCommands.seek({ elapsedSeconds: 0 }).cancel();
  second.step([a => a.setRate(1), 0.01]);
  assert.throws(() => byCommands.seek({ elapsedSeconds: 0 }), coded('SEEK_HISTORY'));
  // A seek counts again what it kept: two commands kept and two more are four, one too many for three.
  const recount = s.make({ seek: { historyCommands: 3 } }), third = runner(recount);
  third.step([a => { a.setAnimation(0, 'move'); a.setRate(2); }, 0.01]); third.step([a => a.setRate(1), 0.01]);
  seekTo(recount, 0.02);
  third.step([a => { a.setRate(2); a.setRate(1); }, 0.01]);
  assert.throws(() => recount.seek({ elapsedSeconds: 0 }), coded('SEEK_HISTORY'));
  // A plan longer than the history may hold is refused while the history itself is intact.
  const short = s.make({ maxSegments: 1, seek: { historyAdvances: 4 } }); short.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.01 });
  assert.throws(() => short.seek({ elapsedSeconds: 0.01 + 5 / 60 }), coded('SEEK_LIMIT'));
  short.seek({ elapsedSeconds: 0.01 + 3 / 60 }).cancel();
});

test('SK12 commands not yet applied wait through a seek and are applied by the next advance', async t => {
  const s = await setup(t), instance = s.make(), run = runner(instance), all = run.run(mixed.slice(0, 3));
  instance.setAnimation(1, 'hold'); instance.setRate(3);
  assert.equal(instance.getSnapshot().pendingCommands, 2);
  const after = seekTo(instance, all[0].elapsedSeconds);
  assert.equal(after.pendingCommands, 2); same(after, all[0]);
  const next = run.step([undefined, 0.01]);
  assert.equal(next.rate, 3); assert.equal(next.tracks.find(track => track.index === 1).animation, 'hold'); assert.equal(next.pendingCommands, 0);
});

test('SK13 a faulted instance is brought back by a seek to the time it last published', async t => {
  const s = await setup(t), instance = s.make({ maxEvents: 3 }), twin = s.make();
  for (const each of [instance, twin]) { each.setAnimation(0, 'move', { loop: true }); each.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.01 }); }
  const good = instance.getSnapshot();
  assert.throws(() => instance.advance({ tickId: 2, elapsedSeconds: 2, deltaSeconds: 8 / 60 }), coded('ADVANCE_FAILED'));
  assert.equal(instance.getSnapshot().state, 'faulted');
  assert.throws(() => instance.advance({ tickId: 3, elapsedSeconds: 3, deltaSeconds: 0.01 }), coded('FAULTED'));
  const ticket = instance.seek({ elapsedSeconds: good.elapsedSeconds }); finish(ticket);
  assert.equal(instance.getSnapshot().state, 'faulted');
  const back = ticket.commit();
  assert.equal(back.state, 'running'); same(back, good);
  // It advances again, in step with an instance that never faulted.
  same(instance.advance({ tickId: 3, elapsedSeconds: 3, deltaSeconds: 0.01 }), twin.advance({ tickId: 2, elapsedSeconds: 2, deltaSeconds: 0.01 }));
  // The plays a finite animation had completed are counted again by the replay, fault or no fault.
  const counted = s.make({ maxEvents: 4 }); counted.setAnimation(0, 'move', { plays: 3 });
  const once = counted.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.13 });
  assert.equal(once.tracks[0].completedPlays, 1);
  counted.setAnimation(1, 'move', { loop: true });
  assert.throws(() => counted.advance({ tickId: 2, elapsedSeconds: 2, deltaSeconds: 0.13 }), coded('ADVANCE_FAILED'));
  const recovered = seekTo(counted, once.elapsedSeconds);
  same(recovered, once); assert.equal(recovered.tracks[0].completedPlays, 1);
});

test('SK14 a display follows a committed seek, and a seek from inside a listener is refused', async t => {
  const s = await setup(t, renderingSource()), instance = s.make();
  const view = createSpineDisplay(instance, s.engine.createScope(), { colorProfile: 'egret-shared-linear/1' }); s.engine.stage.addChild(view.node);
  const positions = () => s.engine.captureSharedFrame({ width: 64, height: 64 }).geometries.map(geometry => Array.from(geometry.positions));
  instance.setAnimation(0, 'move'); instance.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.03 });
  const early = positions();
  instance.advance({ tickId: 2, elapsedSeconds: 2, deltaSeconds: 0.03 });
  const late = positions(); assert.notDeepEqual(late, early);
  const ticket = instance.seek({ elapsedSeconds: 0.03 }); finish(ticket);
  assert.deepEqual(positions(), late);
  ticket.commit();
  assert.deepEqual(positions(), early);
  const refused = [], reentrant = (await setup(t)).make({ onEvent() { try { reentrant.seek({ elapsedSeconds: 0 }); } catch (error) { refused.push(error.code); } } });
  reentrant.setAnimation(0, 'move'); reentrant.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.01 });
  assert.ok(refused.length > 0 && refused.every(code => code === 'SPINE_INSTANCE_REENTRANT'));
});

test('SK15 the limits of a seek are positive and bounded', async t => {
  const s = await setup(t);
  for (const seek of [null, 5, { maxSegments: 0 }, { maxSegments: 36001 }, { sliceSegments: 0 }, { sliceSegments: 1.5 }, { maxEvents: 8193 }, { historyAdvances: -1 }, { historyCommands: '8' }, { unknown: 1 }])
    assert.throws(() => s.make({ seek }), coded('OPTIONS_INVALID'), JSON.stringify(seek));
  s.make({ seek: {} }); s.make({ seek: { maxSegments: 36000, sliceSegments: 3600, maxEvents: 8192, historyAdvances: 36000, historyCommands: 8192 } });
});

test('SK16 random scripts: every seek stands where a straight run to that moment stands', async t => {
  const s = await setup(t), names = ['move', 'hold', 'rise', 'idle'];
  for (let seed = 1; seed <= 12; seed++) {
    let value = seed * 2654435761 % 4294967296;
    const random = () => (value = (value * 1664525 + 1013904223) % 4294967296) / 4294967296, pick = list => list[Math.floor(random() * list.length)];
    // Every choice is made here, once, so that a script is the same script each time it is run.
    const script = Array.from({ length: 24 }, () => {
      const kind = Math.floor(random() * 9), track = Math.floor(random() * 2), name = pick(names), delta = pick([0, 1 / 60, 0.01, 0.033, 0.05, 4 / 60]);
      const mix = pick([0, 0.02, 0.05]), plays = pick([1, 2, 3]), x = Math.floor(random() * 20) - 10, skin = pick(['default', 'alternate']), rate = pick([0, 0.5, 1, 2]), paused = random() < 0.3;
      const issue = [
        a => a.setAnimation(track, name, { loop: true, mixSeconds: mix }), a => a.setAnimation(track, name, name === 'idle' ? { plays: 1 } : { plays }),
        a => a.addAnimation(track, name, { mixSeconds: mix, delaySeconds: mix }), a => a.clearTrack(track), a => a.setSkin(skin),
        a => a.setTransform(x, -x, 1 + mix, 1), a => a.setRate(rate), a => a.setPaused(paused), undefined,
      ][kind];
      return [issue, delta];
    });
    const moments = runner(s.make({ maxSegments: 16 })).run(script);
    const instance = s.make({ maxSegments: 16 }); runner(instance).run(script);
    for (let trial = 0; trial < 6; trial++) {
      const index = Math.floor(random() * moments.length);
      let last = index; while (last + 1 < moments.length && moments[last + 1].elapsedSeconds === moments[index].elapsedSeconds) last++;
      same(seekTo(instance, moments[index].elapsedSeconds), moments[last], 'seed ' + seed + ' trial ' + trial + ' step ' + index);
      // Back to the end, by applying again what the seek cut off.
      let tickId = 1000 * (trial + 1);
      for (const [issue, delta] of script.slice(last + 1)) { issue?.(instance); instance.advance({ tickId: ++tickId, elapsedSeconds: tickId, deltaSeconds: delta }); }
      same(instance.getSnapshot(), moments.at(-1), 'seed ' + seed + ' trial ' + trial + ' end');
    }
  }
});

test('SK17 an instance made by a reset seeks back to what its reset published; one that kept another playback has no history', async t => {
  const engine = await createEngine({ host: host().adapter }), data = fixture({ skeleton: renderingSource() }), p = ports(data);
  const loader = createSpineContentLoader(engine, engine.createScope(), data.manifest, p.factory), group = loader.load(engine.createScope(), ['e_json']);
  await group.ready;
  t.after(async () => { await loader.close(); await engine.dispose(); });
  const scope = engine.createScope(), instance = createSpineInstance(group.getSpine('e_json'), engine.createScope());
  const display = createSpineDisplay(instance, engine.createScope(), { colorProfile: 'egret-shared-linear/1' }), target = scope.use(new DisplayObjectContainer());
  target.addChild(display.node); engine.stage.addChild(target);
  const slot = createSpineResetSlot(engine, scope, target, { version: 'v1', instance, display }), frame = { width: 64, height: 64 };
  const reset = slot.request({ policy: 'reset', version: 'v2', loader, assetId: 'e_json', animation: 'move' });
  await reset.ready; reset.capture(frame);
  const fresh = reset.commit().instance, published = fresh.getSnapshot();
  // The reset applied its animation at time zero, before any tick.
  assert.equal(published.tracks[0].animation, 'move'); assert.equal(published.elapsedSeconds, 0);
  fresh.advance({ tickId: 1, elapsedSeconds: 1, deltaSeconds: 0.03 }); const later = fresh.advance({ tickId: 2, elapsedSeconds: 2, deltaSeconds: 0.03 });
  same(seekTo(fresh, 0), published);
  same(seekTo(fresh, later.elapsedSeconds), later);
  const kept = slot.requestPreserving({ version: 'v3', loader, assetId: 'e_json' });
  await kept.ready; kept.capture(frame);
  // The slot owned the instance it made and disposes it when the next one takes its place.
  const carried = kept.commit().instance;
  assert.equal(fresh.isDisposed, true); same(carried.getSnapshot(), later);
  assert.throws(() => carried.seek({ elapsedSeconds: 0 }), coded('SEEK_HISTORY'));
  assert.equal(carried.advance({ tickId: 3, elapsedSeconds: 3, deltaSeconds: 0.01 }).state, 'running');
});
