// SPDX-License-Identifier: Apache-2.0
// Physics under advance and under seek. A physics constraint makes the pose depend on every step
// that was simulated, so a playback rebuilt by a seek is only right if it simulates the same steps.
// Original numerical fixture; no Editor export and no independent reference renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer } from '@egret/engine';
import { createSpineContentLoader, createSpineDisplay, createSpineInstance, createSpineResetSlot } from '@egret/spine';
import { host } from '../../../tests/helpers.mjs';
import { fixture, ports, atlas } from './fixtures.mjs';
import { physicsSource } from './physicsFixture.mjs';

async function setup(t, skeleton = physicsSource()) {
  const engine = await createEngine({ host: host().adapter }), data = fixture({ skeleton, atlasText: atlas }), p = ports(data);
  const loader = createSpineContentLoader(engine, engine.createScope(), data.manifest, p.factory), group = loader.load(engine.createScope(), ['e_json']);
  await group.ready;
  t.after(async () => { await loader.close(); await engine.dispose(); });
  const asset = group.getSpine('e_json');
  return { engine, asset, loader, make: options => createSpineInstance(asset, engine.createScope(), options) };
}
const stand = ({ state, elapsedSeconds, rate, skin, skins, bones, slots, tracks }) => ({ state, elapsedSeconds, rate, skin, skins, bones, slots, tracks });
const same = (actual, expected, label = 'the stand of the playback') => assert.deepEqual(stand(actual), stand(expected), label);
const tail = snapshot => snapshot.bones.find(bone => bone.name === 'tail');
function close(actual, expected, label, path = '') {
  if (typeof expected === 'number') { assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), label + ' ' + path + ': ' + actual + ' != ' + expected); return; }
  if (expected === null || typeof expected !== 'object') { assert.equal(actual, expected, label + ' ' + path); return; }
  assert.deepEqual(Object.keys(actual), Object.keys(expected), label + ' ' + path);
  for (const key of Object.keys(expected)) close(actual[key], expected[key], label, path + '.' + key);
}
function runner(instance) {
  let tickId = 0;
  return {
    step([issue, delta]) { issue?.(instance); return instance.advance({ tickId: ++tickId, elapsedSeconds: tickId, deltaSeconds: delta }); },
    run(script) { return script.map(step => this.step(step)); },
  };
}
function seekTo(instance, elapsedSeconds, events) {
  const ticket = instance.seek({ elapsedSeconds, ...(events ? { events } : {}) });
  for (let slices = 0; !ticket.step();) if (++slices > 10000) throw new Error('seek does not end');
  return ticket.commit();
}
/** Steps of several lengths, with commands between them, on two tracks. */
const script = [
  [a => a.setAnimation(0, 'swing', { loop: true }), 1 / 60],
  [undefined, 0.05], [undefined, 1 / 30],
  [a => a.setAnimation(1, 'lift', { loop: true }), 0.04],
  [a => a.setRate(0.5), 0.1], [a => a.setRate(1), 0.02],
  [a => a.setTransform(6, -4, 1.5, 1), 4 / 60],
  [a => a.setPaused(true), 0.05], [a => a.setPaused(false), 0.03],
  [a => a.setAnimation(0, 'idle', { mixSeconds: 0.04 }), 0.05], [undefined, 0.06],
];

test('PH01 a physics constraint is simulated: the tail lags, and where it stands depends on what came before', async t => {
  const constrained = await setup(t), free = await setup(t, physicsSource({ constrained: false }));
  const swing = [[a => a.setAnimation(0, 'swing', { loop: true }), 1 / 60], ...Array(11).fill([undefined, 1 / 60])];
  const dragged = runner(constrained.make()).run(swing), rigid = runner(free.make()).run(swing);
  // Without the constraint the tail is carried rigidly; with it the tail is somewhere else at every step after the first.
  for (let index = 1; index < swing.length; index++) assert.notDeepEqual(tail(dragged[index]), tail(rigid[index]), 'step ' + index);
  for (let index = 0; index < swing.length; index++) assert.deepEqual(dragged[index].bones[0], rigid[index].bones[0], 'the root is not what physics moves');
  // One loop of the swing later the root is where it was, and the tail is not: it remembers how it got there.
  const longer = runner(constrained.make()).run([...swing, ...Array(12).fill([undefined, 1 / 60])]), early = longer[8], late = longer[20];
  for (const key of ['x', 'rotation', 'worldX', 'worldY']) assert.ok(Math.abs(early.bones[0][key] - late.bones[0][key]) < 1e-4, 'root ' + key);
  assert.ok(Math.abs(tail(early).worldX - tail(late).worldX) > 1, 'the tail at ' + tail(early).worldX + ' and at ' + tail(late).worldX);
  // A paused instance simulates nothing: the tail hangs where it was and no time passes.
  const instance = constrained.make(), drive = runner(instance); drive.run(swing.slice(0, 6));
  const before = instance.getSnapshot(), held = drive.step([a => a.setPaused(true), 0.1]);
  assert.deepEqual(tail(held), tail(before)); assert.equal(held.elapsedSeconds, before.elapsedSeconds);
});

test('PH02 physics is stepped in sixtieths: one advance of several equals as many advances of one, and other cuts are other simulations', async t => {
  const s = await setup(t), start = [a => a.setAnimation(0, 'swing', { loop: true }), 1 / 60];
  const fine = runner(s.make()).run([start, ...Array(8).fill([undefined, 1 / 60])]).at(-1);
  for (const [name, steps] of [['two', Array(4).fill([undefined, 2 / 60])], ['four', Array(2).fill([undefined, 4 / 60])], ['eight', [[undefined, 8 / 60]]], ['mixed', [[undefined, 3 / 60], [undefined, 1 / 60], [undefined, 4 / 60]]]])
    close(stand(runner(s.make()).run([start, ...steps]).at(-1)), stand(fine), name + ' sixtieths at a time');
  // A step that is not a whole number of sixtieths ends with a shorter segment, and that is another simulation:
  // the same moment, the same root, another tail. A seek must therefore cut time exactly as the run did.
  const uneven = runner(s.make()).run([start, [undefined, 0.04], [undefined, 0.04], [undefined, 8 / 60 - 0.08]]).at(-1);
  assert.ok(Math.abs(uneven.elapsedSeconds - fine.elapsedSeconds) < 1e-12);
  assert.ok(Math.abs(uneven.bones[0].worldX - fine.bones[0].worldX) < 1e-4);
  assert.ok(Math.abs(tail(uneven).a - tail(fine).a) > 0.1, 'the tail turned to ' + tail(uneven).a + ' and to ' + tail(fine).a);
  // The rule itself: whole sixtieths first and the short remainder last. One advance of 0.04 is exactly the
  // three advances it is cut into, and is not three equal thirds.
  const cut = runner(s.make()).run([start, [undefined, 1 / 60], [undefined, 1 / 60], [undefined, 0.04 - 2 / 60]]).at(-1), whole = runner(s.make()).run([start, [undefined, 0.04]]).at(-1);
  close(stand(whole), stand(cut), 'an advance of 0.04');
  const thirds = runner(s.make()).run([start, ...Array(3).fill([undefined, 0.04 / 3])]).at(-1);
  assert.ok(Math.abs(tail(thirds).a - tail(whole).a) > 1e-3, 'thirds turn the tail to ' + tail(thirds).a + ', sixtieths to ' + tail(whole).a);
  // More than eight sixtieths is more than one advance may simulate.
  assert.throws(() => runner(s.make()).run([start, [undefined, 9 / 60]]), error => error.code === 'SPINE_INSTANCE_STEP_LIMIT');
});

test('PH03 a seek to the end of each step stands where the straight run stood, physics included', async t => {
  const s = await setup(t), moments = runner(s.make()).run(script);
  assert.notDeepEqual(tail(moments.at(-1)), tail(runner((await setup(t, physicsSource({ constrained: false }))).make()).run(script).at(-1)), 'the script moves the tail by physics');
  const instance = s.make(), drive = runner(instance); drive.run(script);
  // Back to every step. A committed seek back lets go of what came after it, so the steps it cut off are
  // applied again: if the physics it rebuilt were off by anything, the run from there would not match.
  // A paused step takes no time, so two steps can end at one moment: a seek to it stands after the last of them.
  const lastAt = index => { let last = index; while (last + 1 < moments.length && moments[last + 1].elapsedSeconds === moments[index].elapsedSeconds) last++; return last; };
  assert.equal(lastAt(6), 7, 'the script has a step that takes no time');
  for (const index of [9, 6, 3, 0, 7, 4, 1, 8, 5, 2, 10]) {
    const last = lastAt(index);
    same(seekTo(instance, moments[index].elapsedSeconds), moments[last], 'back to step ' + index);
    for (let next = last + 1; next < script.length; next++) same(drive.step(script[next]), moments[next], 'from step ' + index + ' on to step ' + next);
  }
});

test('PH04 a seek to a moment inside a step simulates the segments a run that stopped there simulates', async t => {
  const s = await setup(t), ends = runner(s.make()).run(script).map(moment => moment.elapsedSeconds);
  let checked = 0;
  for (const [index, [issue, delta]] of script.entries()) {
    // Not a whole number of sixtieths into the step, so the last segment is a short one.
    const expected = runner(s.make()).run(script.slice(0, index).concat([[issue, delta * 0.4]])).at(-1), moment = expected.elapsedSeconds;
    // A step that takes no time has no inside.
    if (!(moment > (ends[index - 1] ?? 0) && moment < ends[index])) continue;
    // The history is whole for each: a committed seek back would have let go of the step that is cut here.
    const whole = s.make(); runner(whole).run(script);
    close(stand(seekTo(whole, moment)), stand(expected), 'inside step ' + index); checked++;
  }
  assert.equal(checked, script.length - 1, 'every step that takes time was cut');
});

test('PH05 a forward seek beyond the present simulates in whole steps, and replays the events it passes', async t => {
  const s = await setup(t), start = [a => a.setAnimation(0, 'swing', { loop: true }), 1 / 60];
  const seen = [], instance = s.make({ onEvent: event => seen.push(event) }), reference = s.make();
  runner(instance).run([start]);
  // Eight sixtieths at a time is the longest an advance may be, and what a forward seek uses.
  const ahead = runner(reference).run([start, [undefined, 8 / 60], [undefined, 8 / 60]]), expected = ahead.at(-1), passed = [...ahead[1].events, ...ahead[2].events];
  seen.length = 0;
  close(stand(seekTo(instance, expected.elapsedSeconds, 'replay')), stand(expected), 'two whole steps ahead');
  assert.deepEqual(seen, passed);
  assert.deepEqual(seen.filter(event => event.kind === 'event').map(event => event.event.name), ['beat', 'beat', 'beat']);
  same(seekTo(instance, 1 / 60), runner(s.make()).run([start]).at(-1), 'and back to where it began');
});

test('PH06 an instance made by a reset seeks through physics back to what the reset published', async t => {
  const engine = await createEngine({ host: host().adapter }), data = fixture({ skeleton: physicsSource(), atlasText: atlas }), p = ports(data);
  const loader = createSpineContentLoader(engine, engine.createScope(), data.manifest, p.factory), group = loader.load(engine.createScope(), ['e_json']);
  await group.ready;
  t.after(async () => { await loader.close(); await engine.dispose(); });
  const scope = engine.createScope(), first = createSpineInstance(group.getSpine('e_json'), engine.createScope());
  const display = createSpineDisplay(first, engine.createScope(), { colorProfile: 'egret-shared-linear/1' }), target = scope.use(new DisplayObjectContainer());
  target.addChild(display.node); engine.stage.addChild(target);
  // The instance that is replaced has swung for a while: the one the reset makes starts from rest.
  runner(first).run([[a => a.setAnimation(0, 'swing', { loop: true }), 4 / 60], [undefined, 4 / 60]]);
  const slot = createSpineResetSlot(engine, scope, target, { version: 'v1', instance: first, display }), frame = { width: 64, height: 64 };
  const reset = slot.request({ policy: 'reset', version: 'v2', loader, assetId: 'e_json', animation: 'swing' });
  await reset.ready; reset.capture(frame);
  const fresh = reset.commit().instance, published = fresh.getSnapshot();
  assert.equal(published.elapsedSeconds, 0); assert.equal(published.tracks[0].animation, 'swing');
  const steps = [[undefined, 2 / 60], [undefined, 0.05], [a => a.setAnimation(1, 'lift', { loop: true }), 3 / 60]], drive = runner(fresh), moments = drive.run(steps);
  // A straight run of an instance that began the ordinary way stands where the reset one stands at each step.
  const ordinary = runner(createSpineInstance(group.getSpine('e_json'), engine.createScope())).run([[a => a.setAnimation(0, 'swing'), 0], ...steps]);
  for (let index = 0; index < steps.length; index++) assert.deepEqual(tail(moments[index]), tail(ordinary[index + 1]), 'step ' + index);
  // Back to the reset, and then the same steps again: the rebuilt playback simulates what the first one did.
  same(seekTo(fresh, 0), published, 'back to the reset');
  for (let index = 0; index < steps.length; index++) same(drive.step(steps[index]), moments[index], 'after the reset, step ' + index);
  same(seekTo(fresh, moments[1].elapsedSeconds), moments[1], 'to step 1');
  same(drive.step(steps[2]), moments[2], 'and on to step 2');
  same(seekTo(fresh, moments[0].elapsedSeconds), moments[0], 'to step 0');
});
