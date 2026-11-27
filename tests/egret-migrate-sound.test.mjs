// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classicSoundResource, androidClassicMusic } from '../tools/egret-migrate/compat/sound.mjs';

class Dispatcher extends EventTarget {
  dispatchEventWith(type) {
    this.dispatchEvent(new Event(type));
  }
}

test('only the active channel reports one natural completion; stopped and retired callbacks are inert', async () => {
  const scope = new AbortController(),
    voices = [],
    changes = [],
    errors = [];
  const output = {
    seconds: 2,
    close() {
      changes.push('close');
    },
    start(offset) {
      const task = Promise.withResolvers();
      voices.push(task);
      return {
        ended: task.promise,
        position: offset,
        setVolume: v => changes.push(v),
        stop: () => changes.push('stop')
      };
    }
  };
  const sound = classicSoundResource(output, Dispatcher, scope, e => errors.push(e)),
    events = [];
  function play(offset = 0) {
    const ch = sound.play(offset, 1);
    ch.addEventListener('soundComplete', e => events.push(e.target));
    return ch;
  }
  const first = play(0.3),
    second = play(0.5);
  assert.equal(first.position, 0);
  assert.equal(second.position, 0.5);
  first.volume = 0.4;
  second.volume = 0.25;
  voices[0].resolve('finished');
  voices[1].resolve('finished');
  await new Promise(r => setImmediate(r));
  assert.deepEqual(events, [second]);
  const third = play();
  third.stop();
  voices[2].reject(Error('stopped'));
  const fourth = play();
  sound.close();
  voices[3].resolve('finished');
  await new Promise(r => setImmediate(r));
  assert.deepEqual(changes, ['stop', 0.25, 'stop', 'stop', 'close']);
  assert.deepEqual(events, [second]);
  assert.deepEqual(errors, []);
  assert.throws(() => sound.play());
  assert.notEqual(fourth, third);
});

test('the trimmed host reads declared media and cancels both playback and its pending position sample', async () => {
  const scope = new AbortController(),
    actions = [],
    completions = [],
    positions = [],
    failures = [];
  const host = {
    async call(name, args, signal) {
      actions.push({ name, args, signal });
      if (name.endsWith('describe')) return { seconds: 2, bytes: 4000 };
      if (name.endsWith('volume')) return true;
      const p = Promise.withResolvers();
      signal.addEventListener('abort', () => p.reject(signal.reason), { once: true });
      (name.endsWith('position') ? positions : completions).push(p);
      return p.promise;
    }
  };
  const port = androidClassicMusic(host, scope, e => failures.push(e));
  const a = await port.load('a.wav'),
    b = await port.load('b.wav');
  const prev = a.start(0),
    next = b.start(0.4);
  assert.equal(await prev.ended, 'stopped');
  positions[1].resolve(0.45);
  await new Promise(r => setImmediate(r));
  port.visibility(true);
  assert.ok(next.position >= 0.45 && next.position < 1);
  next.setVolume(0.1);
  assert.equal(actions.at(-1).args.id, 2);
  completions[1].resolve('finished');
  assert.equal(await next.ended, 'finished');
  assert.equal(next.position, 2);
  a.close();
  b.close();
  assert.deepEqual(failures, []);
});
