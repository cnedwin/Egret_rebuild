// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./v8/project-bootstrap.js', import.meta.url), 'utf8');

test('a pending project factory can finish on a native timer or abort before it fires', async () => {
  const timers = new Map();
  const failures = [];
  const vm = {
    EgretNativePlayer: {
      now: () => 12.5,
      schedule: (id, ms) => timers.set(id, ms),
      cancel: id => timers.delete(id),
      failure: message => failures.push(message)
    }
  };
  runInNewContext(source, vm);
  assert.equal(vm.performance.now(), 12.5);
  const opening = awaitableGame(vm);
  assert.equal(timers.get(opening.timer), 20);
  vm.EgretRuntimeTasks.fire(opening.timer);
  assert.equal(await opening.result, 'ready');
  // A late native callback after clearTimeout must leave the project closed.
  const cancelled = awaitableGame(vm);
  cancelled.controller.abort('closed');
  cancelled.controller.abort('again');
  assert.equal(timers.has(cancelled.timer), false);
  vm.EgretRuntimeTasks.fire(cancelled.timer);
  assert.equal(await cancelled.result, 'closed');
  assert.equal(cancelled.controller.signal.reason, 'closed');
  assert.throws(() => cancelled.controller.signal.throwIfAborted(), e => e === 'closed');
  assert.deepEqual(failures, []);
  assert.equal(vm.document, undefined);
});

function awaitableGame(vm) {
  const controller = new vm.AbortController();
  let timer;
  const result = new Promise(resolve => {
    timer = vm.setTimeout(resolve, 20, 'ready');
    controller.signal.addEventListener('abort', () => {
      vm.clearTimeout(timer);
      resolve(controller.signal.reason);
    }, { once: true });
  });
  return { controller, timer, result };
}

test('abort reaches remaining listeners after cancellation and listener removal', () => {
  const failures = [];
  const vm = { EgretNativePlayer: { failure: message => failures.push(message) } };
  runInNewContext(source, vm);
  const controller = new vm.AbortController();
  const seen = [];
  const skip = () => seen.push('removed');
  controller.signal.addEventListener('abort', () => {
    controller.signal.removeEventListener('abort', skip);
    throw Error('listener failed');
  });
  controller.signal.addEventListener('abort', skip);
  const observer = { handleEvent: event => seen.push(event.target.reason.name) };
  controller.signal.addEventListener('abort', observer);
  controller.signal.onabort = () => seen.push('onabort');
  controller.abort();
  assert.deepEqual(seen, ['AbortError', 'onabort']);
  assert.deepEqual(failures, ['Error: listener failed']);
});
