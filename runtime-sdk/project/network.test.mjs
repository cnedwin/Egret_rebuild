// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerNetwork } from './network.mjs';

test('binary requests preserve sliced bytes, return owned data, and keep socket handles distinct', async () => {
  const calls = [];
  const network = createPlayerNetwork({ async call(action, value, signal) {
    assert.equal(action, 'network.request');
    calls.push({ value, signal });
    if (value.op === 'http') return { status: 201, body: value.body };
    if (value.op === 'receive') return { done: false, sequence: 12, body: 'AP8=' };
    return null;
  }});
  const raw = Uint8Array.of(44, 0, 255, 44);
  const result = await network.request('https://test.invalid', { method: 'POST', bytes: raw.subarray(1,3) });
  assert.deepEqual(result, { status: 201, bytes: Uint8Array.of(0, 255) });
  assert.equal(calls[0].value.body, 'AP8=');
  const first = await network.connect('wss://test.invalid');
  await first.send(raw.subarray(1,3));
  assert.deepEqual(await first.receive(), {done:false, bytes:Uint8Array.of(0,255)});
  assert.deepEqual(calls.at(-1).value, {op:'ack', id:calls[1].value.id, sequence:12});
  await first.close();
  await network.connect('wss://test.invalid');
  assert.notEqual(calls.at(-1).value.id, calls[1].value.id);
  await assert.rejects(network.request('https://test.invalid', {bytes:new Uint8Array(32769)}), RangeError);
});

test('a canceled handshake sends cleanup only for its own connection', async () => {
  const lifetime = new AbortController(), calls=[];
  const network = createPlayerNetwork({ async call(_, value, signal) {
    calls.push(value);
    if (value.op === 'open') { lifetime.abort(); throw signal.reason; }
  }});
  await assert.rejects(network.connect('wss://test.invalid', lifetime.signal), {name:'AbortError'});
  assert.deepEqual(calls.map(({op,id})=>[op,id]), [['open',calls[0].id],['close',calls[0].id]]);
});
