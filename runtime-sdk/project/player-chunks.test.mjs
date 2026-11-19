// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayerAssets } from './player-text-assets.mjs';

const chunkSize = 64 * 1024;
function bridge() {
  const lifetime = new AbortController();
  const calls = [];
  const values = new Map();
  const native = {
    openChunks(id, path) { calls.push(['open', id, path]); return true; },
    nextChunk(id) { calls.push(['next', id]); return true; },
    readText(id, path) { calls.push(['text', id, path]); return true; },
    readBytes(id, path) { calls.push(['bytes', id, path]); return true; },
    takeTextResult(id) { calls.push(['take', id]); const value = values.get(id); values.delete(id); return value; },
    cancelReadText(id) { calls.push(['cancel', id]); values.delete(id); }
  };
  const { assets, textResult } = createPlayerAssets(native, lifetime.signal);
  function reply(id, bytes) { values.set(id, Buffer.from(bytes).toString('base64')); textResult(id, ''); }
  return { assets, calls, native, lifetime, reply, textResult };
}

test('pulls one owned chunk on demand across the whole-file limit and skips empty EOF', async () => {
  const h = bridge(), stream = h.assets.readChunks('large.bin');
  assert.equal(stream[Symbol.asyncIterator](), stream);
  assert.deepEqual(h.calls, []);
  for (let i = 0; i < 6; i++) {
    const next = stream.next();
    assert.deepEqual(h.calls.at(-1), i ? ['next', 1] : ['open', 1, 'large.bin']);
    const length = i === 5 ? 19 : chunkSize;
    h.reply(1, Buffer.alloc(length, i));
    const { value, done } = await next;
    assert.equal(done, false);
    assert.ok(value instanceof Uint8Array);
    assert.equal(value.length, length);
    assert.equal(value[0], i);
    assert.equal(value.at(-1), i);
    value[0] = 0xff;
    assert.deepEqual(h.calls.at(-1), ['take', 1]);
  }
  const end = stream.next(); h.textResult(1, 'eof');
  assert.equal((await end).done, true);
  assert.equal((await stream.next()).done, true);
  assert.deepEqual(h.calls.at(-1), ['next', 1]);
  const empty = h.assets.readChunks('empty.bin');
  const first = empty.next(); h.textResult(2, 'eof');
  assert.equal((await first).done, true);
  assert.equal(h.calls.filter(([op, id]) => op === 'take' && id === 2).length, 0);
});

test('break and return release parked and pending reads immediately and ignore late delivery', async () => {
  const h = bridge();
  const consume = (async () => {
    for await (const bytes of h.assets.readChunks('large.bin')) { assert.equal(bytes[0], 1); break; }
  })();
  h.reply(1, [1]); await consume;
  assert.deepEqual(h.calls.at(-1), ['cancel', 1]);
  const stream = h.assets.readChunks('large.bin'), first = stream.next();
  await assert.rejects(stream.next(), TypeError);
  assert.equal((await stream.return()).done, true);
  assert.equal((await first).done, true);
  assert.deepEqual(h.calls.at(-1), ['cancel', 2]);
  const size = h.calls.length; h.textResult(2, '');
  await stream.return(); await stream.next();
  assert.equal(h.calls.length, size);
});

test('scope cancellation between chunks and shutdown during a pull release native ownership', async () => {
  const h = bridge(), controller = new AbortController();
  const parked = h.assets.readChunks('large.bin', controller.signal);
  const first = parked.next(); h.reply(1, [5]); await first;
  const reason = new Error('cancel while parked'); controller.abort(reason);
  assert.deepEqual(h.calls.at(-1), ['cancel', 1]);
  await assert.rejects(parked.next(), err => err === reason);
  const stream = h.assets.readChunks('large.bin', h.lifetime.signal);
  const block = stream.next(); h.reply(2, [7]); await block;
  const inFlight = stream.next(); const closing = new Error('close'); h.lifetime.abort(closing);
  await assert.rejects(inFlight, err => err === closing);
  h.textResult(2, '');
  assert.deepEqual(h.calls.at(-1), ['cancel', 2]);
  await assert.rejects(h.assets.readChunks('large.bin').next(), err => err === closing);
});

test('parked streams share eight slots with legacy reads, errors and retries get independent IDs', async () => {
  const h = bridge(), streams = [];
  for (let i = 1; i <= 8; i++) {
    const stream = h.assets.readChunks('large.bin');
    const next = stream.next(); h.reply(i, [i]); await next; streams.push(stream);
  }
  await assert.rejects(h.assets.readBytes('level.bin'), RangeError);
  await assert.rejects(h.assets.readText('level.json'), RangeError);
  await streams[0].return();
  const missing = h.assets.readChunks('missing.bin').next(); h.textResult(9, 'NotFoundError');
  await assert.rejects(missing, { name: 'NotFoundError' });
  const retry = h.assets.readChunks('retry.bin'), next = retry.next();
  h.textResult(9, ''); h.reply(10, [4]); assert.equal((await next).value[0], 4);
  const bad = retry.next(); h.reply(10, Buffer.alloc(chunkSize + 1));
  await assert.rejects(bad, RangeError);
  assert.deepEqual(h.calls.at(-1), ['cancel', 10]);
  const emptyData = h.assets.readChunks('broken.bin').next(); h.reply(11, []);
  await assert.rejects(emptyData); assert.deepEqual(h.calls.at(-1), ['cancel', 11]);
  delete h.native.nextChunk;
  await assert.rejects(h.assets.readChunks('large.bin').next(), { name: 'NotSupportedError' });
  h.lifetime.abort();
});
