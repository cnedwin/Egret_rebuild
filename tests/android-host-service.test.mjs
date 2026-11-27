// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostServices } from '../runtime-sdk/project/host-services.mjs';

test('native service replies settle once, cancel and close retire outstanding work', async () => {
  const started = [],
    aborted = [];
  const lifetime = new AbortController();
  const values = new Map();
  const bridge = {
    hostStart(id, action, json) {
      started.push({ id, action, json });
      return true;
    },
    hostCancel(id) {
      aborted.push(id);
    },
    hostTake(id) {
      const value = values.get(id);
      values.delete(id);
      return value;
    }
  };
  const { host, hostResult } = createHostServices(bridge, lifetime.signal);
  const success = host.call('channel.status', { mode: 'local' });
  const id = started[0].id;
  assert.equal(started[0].json, '{"mode":"local"}');
  values.set(id, '{"name":"白鹭"}');
  hostResult(id, true);
  hostResult(id, false);
  assert.deepEqual(await success, { name: '白鹭' });
  const controller = new AbortController();
  const canceled = host.call('channel.status', null, controller.signal);
  controller.abort();
  await assert.rejects(canceled, { name: 'AbortError' });
  const pending = host.call('channel.status', null);
  lifetime.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(
    aborted,
    started.slice(1).map(item => item.id)
  );
  await assert.rejects(host.call('channel.status', null), { name: 'AbortError' });
});

test('absent providers, rejected calls and corrupt replies are observable', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(createHostServices({}, signal).host.call('sdk.user', null), { name: 'NotSupportedError' });
  const { host, hostResult } = createHostServices(
    {
      hostStart(id, name) {
        return name === 'sdk.ready';
      },
      hostTake() {
        return 'invalid JSON';
      },
      hostCancel() {}
    },
    signal
  );
  await assert.rejects(host.call('sdk.missing', null));
  await assert.rejects(host.call('sdk.ready', 'x'.repeat(65536)));
  const p = host.call('sdk.ready', 1);
  hostResult(2, true);
  await assert.rejects(p, SyntaxError);
});

test('serializing a request can retire its owner or caller before native admission', async () => {
  for (const target of ['caller', 'owner']) {
    const caller = new AbortController();
    const owner = new AbortController();
    let started = 0;
    const { host } = createHostServices(
      {
        hostStart() {
          started++;
          return true;
        }
      },
      owner.signal
    );
    const value = {
      toJSON() {
        (target === 'owner' ? owner : caller).abort();
        return 7;
      }
    };
    const result = host.call('channel.status', value, caller.signal);
    assert.equal(started, 0);
    await assert.rejects(result, { name: 'AbortError' });
  }
});
