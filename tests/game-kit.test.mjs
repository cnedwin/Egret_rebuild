// SPDX-License-Identifier: Apache-2.0
// The DOM-free game kit: named input actions with rebinding, versioned saves
// with migrations, and repeatable random numbers.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInputActions,
  createMemorySaveStorage,
  createRandom,
  createSaveStore,
  describeInputBinding,
  hashSeed
} from '@egret/engine/kit';

const MAP = {
  jump: { bindings: ['Key:Space', 'Pad:a'] },
  fire: { bindings: ['Mouse:0', 'Pad:rightTrigger'] },
  steer: { kind: 'axis', negative: ['Key:KeyA'], positive: ['Key:KeyD', 'Pad:leftStickX+'] },
  move: {
    kind: 'vector',
    up: ['Key:KeyW', 'Key:ArrowUp'],
    down: ['Key:KeyS'],
    left: ['Key:KeyA'],
    right: ['Key:KeyD'],
    sticks: ['Pad:leftStick', 'Touch:stick']
  }
};
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('GK01 buttons are pressed, just pressed and just released by any of their controls', () => {
  const input = createInputActions(MAP);
  const seen = [];
  input.subscribe((action, down) => seen.push(`${action} ${down}`));
  input.press('Key:Space');
  assert.equal(input.pressed('jump'), true);
  assert.equal(input.justPressed('jump'), true);
  input.press('Pad:a');
  input.release('Key:Space');
  assert.equal(input.pressed('jump'), true, 'still held by the pad');
  input.endFrame();
  assert.equal(input.justPressed('jump'), false);
  input.release('Pad:a');
  assert.equal(input.justReleased('jump'), true);
  assert.deepEqual(seen, ['jump true', 'jump false']);
  // A trigger counts as pressed past half way.
  input.press('Pad:rightTrigger', 0.3);
  assert.equal(input.pressed('fire'), false);
  input.press('Pad:rightTrigger', 0.8);
  assert.equal(input.pressed('fire'), true);
  input.releaseAll();
  assert.equal(input.pressed('fire'), false);
});

test('GK02 axes and vectors combine keys and sticks, with the dead zone taken out', () => {
  const input = createInputActions(MAP);
  input.press('Key:KeyD');
  assert.equal(input.value('steer'), 1);
  input.press('Key:KeyA');
  assert.equal(input.value('steer'), 0, 'opposite keys cancel');
  input.releaseAll();
  input.press('Key:KeyW');
  input.press('Key:KeyD');
  const diagonal = input.vector('move');
  assert.ok(close(Math.hypot(diagonal.x, diagonal.y), 1), 'a diagonal is no faster than a straight move');
  assert.ok(diagonal.x > 0 && diagonal.y < 0);
  input.releaseAll();
  input.setStick('Pad:leftStick', 0.1, 0);
  assert.deepEqual(input.vector('move'), { x: 0, y: 0 }, 'inside the dead zone');
  input.setStick('Pad:leftStick', 0.6, 0);
  const half = input.vector('move');
  assert.ok(close(half.x, 0.5) && half.y === 0, 'stretched from the dead zone');
  assert.ok(input.value('steer') > 0, 'a stick half drives an axis');
  input.setStick('Touch:stick', 0, 3);
  assert.ok(close(input.vector('move').y, 1), 'the strongest source wins, clamped to 1');
  assert.equal(input.pressed('move'), true);
});

test('GK03 rebinding moves a control from one action to another and survives a save', () => {
  const input = createInputActions(MAP);
  input.rebind('fire', 'Key:KeyF');
  assert.deepEqual(input.bindingsOf('fire'), ['Key:KeyF', 'Pad:rightTrigger']);
  input.rebind('jump', 'Key:KeyA', { index: 2 });
  assert.deepEqual(input.bindingsOf('jump'), ['Key:Space', 'Pad:a', 'Key:KeyA']);
  assert.deepEqual(input.bindingsOf('steer', 'negative'), [], 'taken off where it was');
  assert.deepEqual(input.bindingsOf('move', 'left'), []);
  const saved = JSON.parse(JSON.stringify(input.saveBindings()));
  assert.deepEqual(Object.keys(saved.actions).sort(), ['fire', 'jump', 'move', 'steer']);
  const again = createInputActions(MAP);
  again.loadBindings(saved);
  assert.deepEqual(again.bindingsOf('fire'), ['Key:KeyF', 'Pad:rightTrigger']);
  assert.deepEqual(again.bindingsOf('move', 'left'), []);
  again.loadBindings({
    version: 1,
    actions: { nothing: {}, jump: { bindings: ['bad binding'] }, fire: { up: ['Key:KeyQ'] } }
  });
  assert.deepEqual(again.bindingsOf('jump'), ['Key:Space', 'Pad:a', 'Key:KeyA'], 'malformed entries are skipped');
  again.loadBindings('not a save');
  again.resetBindings();
  assert.deepEqual(again.bindingsOf('fire'), ['Mouse:0', 'Pad:rightTrigger']);
  assert.deepEqual(again.saveBindings().actions, {});
});

test('GK04 the last control pressed is offered to a rebinding screen; bad input is refused', () => {
  const input = createInputActions(MAP);
  input.press('Key:KeyQ');
  assert.equal(input.lastPressed, 'Key:KeyQ');
  input.endFrame();
  assert.equal(input.lastPressed, undefined);
  assert.equal(describeInputBinding('Key:KeyW'), 'W');
  assert.equal(describeInputBinding('Key:Digit3'), '3');
  assert.equal(describeInputBinding('Key:ShiftLeft'), 'Shift');
  assert.equal(describeInputBinding('Mouse:2'), 'Right button');
  assert.equal(describeInputBinding('Pad:a'), 'Pad a');
  for (const bad of [
    () => createInputActions({}),
    () => createInputActions({ 'bad name': {} }),
    () => createInputActions({ a: { kind: 'twist' } }),
    () => createInputActions({ a: { up: ['Key:KeyW'] } }),
    () => input.press('Space'),
    () => input.pressed('nothing'),
    () => input.press('Key:KeyW', 2)
  ])
    assert.throws(bad, { code: 'INPUT_ACTIONS_INVALID' });
});

test('GK05 a save starts from the defaults, is written, and loads again', () => {
  const storage = createMemorySaveStorage();
  const options = { key: 'game.save', version: 1, defaults: () => ({ tier: 1, best: {} }), storage };
  const store = createSaveStore(options);
  assert.equal(store.loadedVersion, undefined);
  assert.deepEqual(store.data, { tier: 1, best: {} });
  assert.equal(
    store.update(data => void (data.tier = 3)),
    true
  );
  const again = createSaveStore(options);
  assert.equal(again.loadedVersion, 1);
  assert.equal(again.data.tier, 3);
  const exported = again.export();
  again.reset();
  assert.equal(again.data.tier, 1);
  assert.equal(again.import(exported), true);
  assert.equal(again.data.tier, 3);
  assert.equal(again.import('{"broken"'), false);
  again.remove();
  assert.equal(storage.getItem('game.save'), null);
});

test('GK06 older saves are migrated and written back; unusable ones are kept aside', () => {
  const v1 = JSON.stringify({ version: 1, savedAt: 'x', data: { level: 4 } });
  const storage = createMemorySaveStorage({ 'game.save': v1 });
  const problems = [];
  const options = {
    key: 'game.save',
    version: 3,
    defaults: () => ({ stage: 1, keys: {} }),
    migrations: { 1: data => ({ stage: data.level }), 2: data => ({ ...data, keys: {} }) },
    validate: data => typeof data?.stage === 'number',
    storage,
    onProblem: problem => problems.push(problem.kind)
  };
  const store = createSaveStore(options);
  assert.equal(store.loadedVersion, 1);
  assert.deepEqual(store.data, { stage: 4, keys: {} });
  assert.equal(JSON.parse(storage.getItem('game.save')).version, 3, 'written back in the new form');

  for (const [text, kind] of [
    ['not json', 'unreadable'],
    [JSON.stringify({ version: 9, data: {} }), 'too-new'],
    [JSON.stringify({ version: 1, data: { level: 'x' } }), 'invalid']
  ]) {
    storage.setItem('game.save', text);
    const fresh = createSaveStore(options);
    assert.deepEqual(fresh.data, { stage: 1, keys: {} });
    assert.equal(problems.at(-1), kind);
    assert.equal(storage.getItem('game.save.unread'), text);
  }
  const noOld = createSaveStore({
    ...options,
    migrations: { 2: options.migrations[2] },
    storage: createMemorySaveStorage({ 'game.save': v1 })
  });
  assert.equal(noOld.loadedVersion, undefined);
  assert.equal(problems.at(-1), 'too-old');
});

test('GK07 a full storage is reported, never thrown', () => {
  const problems = [];
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {}
  };
  const store = createSaveStore({
    key: 'k',
    version: 1,
    defaults: () => ({ a: 1 }),
    storage: full,
    onProblem: p => problems.push(p.kind)
  });
  assert.equal(store.save(), false);
  assert.deepEqual(problems, ['write-failed']);
  assert.equal(store.data.a, 1);
  assert.throws(() => createSaveStore({ key: '', version: 1, defaults: () => ({}), storage: full }), {
    code: 'SAVE_STORE_OPTIONS_INVALID'
  });
  assert.throws(() => createSaveStore({ key: 'k', version: 0, defaults: () => ({}), storage: full }), {
    code: 'SAVE_STORE_OPTIONS_INVALID'
  });
});

test('GK08 the same seed gives the same numbers; forks and saved states repeat too', () => {
  const a = createRandom(42),
    b = createRandom(42),
    c = createRandom('42');
  const run = random => Array.from({ length: 5 }, () => random.next());
  const first = run(a);
  assert.deepEqual(run(b), first);
  assert.deepEqual(run(c), first, 'a number and its text give the same seed');
  assert.notDeepEqual(run(createRandom(43)), first);
  assert.ok(first.every(value => value >= 0 && value < 1));
  const saved = a.state();
  const next = run(a);
  assert.deepEqual(run(createRandom(saved)), next);
  const forkA = createRandom(7).fork(),
    forkB = createRandom(7).fork();
  assert.deepEqual(run(forkA), run(forkB));
  assert.equal(hashSeed('abc'), hashSeed('abc'));
});

test('GK09 helpers stay in range and are fair enough', () => {
  const random = createRandom(1);
  const counts = [0, 0, 0];
  for (let i = 0; i < 30000; i++) counts[random.int(0, 2)]++;
  assert.ok(
    counts.every(count => count > 9500 && count < 10500),
    String(counts)
  );
  for (let i = 0; i < 1000; i++) {
    const value = random.range(-2, 3);
    assert.ok(value >= -2 && value < 3);
  }
  const heavy = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) heavy[random.weighted(['a', 'b'], [9, 1])]++;
  assert.ok(heavy.a > 8700 && heavy.a < 9300, JSON.stringify(heavy));
  const shuffled = random.shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
  let sum = 0;
  for (let i = 0; i < 20000; i++) sum += random.normal(10, 2);
  assert.ok(Math.abs(sum / 20000 - 10) < 0.1);
  assert.ok(['x', 'y'].includes(random.pick(['x', 'y'])));
  for (const bad of [
    () => random.int(3, 1),
    () => random.pick([]),
    () => random.chance(2),
    () => random.weighted(['a'], [0]),
    () => createRandom(NaN),
    () => createRandom([1, 2])
  ])
    assert.throws(bad, error => /^RANDOM_/.test(error.code));
});

import { createAudioCues, encodeWav } from '@egret/engine/kit';

// A mixer stand-in that records what it is asked to play.
function recordingMixer() {
  const played = [];
  return {
    played,
    play(sound, options) {
      const voice = {
        sound,
        options,
        state: 'playing',
        stop(o) {
          voice.state = 'ended';
          voice.stopped = o;
        }
      };
      played.push(voice);
      return voice;
    }
  };
}

test('GK10 cues never repeat a take back to back, vary pitch, cool down and cap their voices', () => {
  const mixer = recordingMixer();
  let t = 0,
    r = 0;
  const rolls = [0.1, 0.1, 0.1, 0.9, 0.5];
  const cues = createAudioCues(
    mixer,
    { step: { sounds: ['a', 'b', 'c'], rate: [0.9, 1.1], volume: 0.5, cooldown: 0.05, maxVoices: 2, bus: 'effects' } },
    { now: () => t, random: () => rolls[r++ % rolls.length] }
  );
  const takes = [];
  for (let i = 0; i < 6; i++) {
    t += 0.1;
    takes.push(cues.play('step', { pan: 3 })?.sound);
  }
  for (let i = 1; i < takes.length; i++) assert.notEqual(takes[i], takes[i - 1]);
  assert.ok(mixer.played.every(voice => voice.options.rate >= 0.9 && voice.options.rate <= 1.1));
  assert.ok(
    mixer.played.every(
      voice => voice.options.volume === 0.5 && voice.options.pan === 1 && voice.options.bus === 'effects'
    )
  );
  t += 0.01;
  assert.equal(cues.play('step'), undefined, 'inside the cooldown');
  assert.equal(mixer.played.filter(voice => voice.state === 'playing').length, 2, 'the oldest voices gave their place');
  cues.stop('step');
  assert.equal(mixer.played.filter(voice => voice.state === 'playing').length, 0);
  assert.throws(() => cues.play('nothing'), { code: 'AUDIO_CUES_INVALID' });
  assert.throws(() => createAudioCues(mixer, { x: { sounds: [] } }), { code: 'AUDIO_CUES_INVALID' });
  assert.throws(() => createAudioCues(mixer, { x: { sounds: ['a'], rate: [2, 1] } }), { code: 'AUDIO_CUES_INVALID' });
});

test('GK11 synthesised samples become a WAV file a mixer can decode', () => {
  const left = new Float32Array([0, 1, -1, 0.5]),
    right = new Float32Array([0, -1, 2, NaN]);
  const bytes = encodeWav([left, right], 22050);
  const view = new DataView(bytes.buffer);
  const text = (at, n) => String.fromCharCode(...bytes.slice(at, at + n));
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint32(40, true), 16);
  assert.equal(bytes.length, 44 + 16);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => view.getInt16(44 + i * 2, true)),
    [0, 0, 32767, -32768, -32768, 32767, 16384, 0]
  );
  assert.throws(() => encodeWav([left, new Float32Array(3)], 22050), { code: 'AUDIO_WAV_INVALID' });
  assert.throws(() => encodeWav([left], 100), { code: 'AUDIO_WAV_INVALID' });
});
