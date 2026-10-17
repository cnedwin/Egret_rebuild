// SPDX-License-Identifier: Apache-2.0
// M1N1/N2/N5 use genuine public SDK frames and controlled GPU ports.
// M1N3/N4 are separately labelled private UNIT searchable-retention witnesses.
// They do not detect an omitted Host invalidation call, native pixels or GC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {withGpu, withAuthored, frame, admitted, tick, code} from './fixtures/gpu-image-residency.mjs';
import {createWebGPUBindingCache} from '../packages/engine/dist/web/webgpuBindingCache.js';
import {createWebGPUBufferPool} from '../packages/engine/dist/web/webgpuBufferPool.js';

test('M1N1 public cold projection materializes the actual texture payload', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.addChild(a.mesh);
    const record = f.capture(() => h.renderTexturedFrame(a.textured()));
    assert.equal(record.threw, false, '[M1N1] cold projection must materialize before submission');
    admitted(record); await record.finish(); await h.whenIdle();
    const writes = f.calls.filter(call => call[0] === 'writeTexture');
    assert.equal(writes.length, 1);
    assert.deepEqual([...writes[0][2]], [255, 64, 0, 255]);
    assert.equal(h.getStatus().lastSerial, 1); await f.close(h);
  }));
});

test('M1N2 public fence alone cannot return selected vertex or uniform buffers', async () => {
  await withGpu(async f => {
    const h = f.host({maxPendingFrames: 3}); await f.ready(h); const input = frame();
    const firstStart = f.calls.length, first = f.capture(() => h.renderFrame(input)); admitted(first);
    const selected = start => ({
      vertex: f.calls.slice(start).find(call => call[0] === 'setVertexBuffer')[2],
      uniform: f.calls.slice(start).find(call => call[0] === 'writeBuffer' && call[1].descriptor.usage === 72)[1],
    });
    const before = selected(firstStart);
    assert.equal(first.fences.length, 1); assert.ok(first.scopes.length > 0);
    first.fences[0].resolve(); await tick();
    const secondStart = f.calls.length, second = f.capture(() => h.renderFrame(input)); admitted(second);
    const after = selected(secondStart);
    assert.equal(after.vertex === before.vertex, false, '[M1N2] unresolved scopes forbid reuse of the selected vertex buffer');
    assert.equal(after.uniform === before.uniform, false, '[M1N2] unresolved scopes forbid reuse of the selected uniform buffer');
    assert.equal(h.getStatus().pendingFrames, 2);
    await second.finish(); await first.finish(); await h.whenIdle(); await f.close(h);
  });
});

function retentionFixture() {
  const session = {}, pool = createWebGPUBufferPool(session), cache = createWebGPUBindingCache(session);
  const forbidden = () => assert.fail('private metadata must not invoke native cleanup');
  const resource = {buffer: {}, destroy: forbidden, unmap: forbidden, map: forbidden,
    mappedRange: forbidden, mapped: false, cleaned: false};
  const lease = pool.registerCreated({id: 0, role: 'uniform', usage: 72, byteLength: 16}, resource);
  assert.deepEqual(pool.publishReturns(pool.reserveReturns([lease])), [lease.handle]);
  const key = {session, layout: {}, texture: {}, view: {}, sampler: {}, uniform: lease.handle, offset: 0, size: 16};
  const binding = {}; cache.publish([{key, binding}]);
  assert.equal(cache.lookup(key), binding, 'a complete genuine handle key is initially searchable');
  return {cache, key, binding};
}

for (const [number, resource] of [[3, 'buffer'], [4, 'texture']]) {
  test('M1N' + number + ' UNIT ' + resource + ' invalidation removes old complete-key lookup', () => {
    const f = retentionFixture();
    try {
      if (resource === 'buffer') f.cache.invalidateBuffer(f.key.uniform.identity);
      else f.cache.invalidateTexture(f.key.texture);
      assert.equal(f.cache.lookup(f.key), undefined,
        '[M1N' + number + '] invalidation must remove the old complete-key searchable reference');
    } finally { f.cache.clear(); }
  });
}

test('M1N5 public retiring upload charge survives cleanup reentry', async () => {
  await withGpu(async f => {
    const h = f.host({enableReadback: true, maxPendingFrames: 3, maxPendingUploadBytes: 112});
    await f.ready(h); const input = frame(), ticket = h.requestReadback(); ticket.catch(() => {});
    let nested, observedCharge, callbacks = 0;
    f.hooks.destroyBuffer = buffer => {
      if (buffer.descriptor.usage !== 9 || callbacks !== 0) return;
      callbacks++; observedCharge = h.getStatus().pendingUploadBytes;
      nested = f.capture(() => h.renderFrame(input));
    };
    const outer = f.capture(() => h.renderFrame(input)); admitted(outer);
    assert.equal(h.getStatus().pendingUploadBytes, 112);
    await outer.finish(); await ticket;
    delete f.hooks.destroyBuffer;
    if (nested && !nested.threw) await nested.finish();
    await h.whenIdle();
    assert.equal(callbacks, 1, 'actual staging destruction supplies one retirement callback');
    assert.equal(observedCharge, 112, '[M1N5] retiring upload charge must remain until cleanup returns');
    assert.ok(nested.threw, '[M1N5] cleanup reentry must not spend the retiring upload charge');
    assert.ok(code('BACKPRESSURE')(nested.error));
    assert.equal(h.getStatus().lastSerial, 1); assert.equal(h.getStatus().pendingUploadBytes, 0);
    await f.close(h);
  });
});
