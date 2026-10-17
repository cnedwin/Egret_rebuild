// SPDX-License-Identifier: Apache-2.0
// Public emitted SDK control over genuine frames and controlled GPU ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withGpu, frame, view, image, submitSafe, admitted } from './fixtures/gpu-image-residency.mjs';
test('B05 mixed cold and warm buffers return in request order before FIFO pressure eviction', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const one = view(image());
    const seed = await submitSafe(f, h, frame(Array(2048).fill(one)));
    assert.equal(f.buffers.length, 4096);
    const rect = { kind: 'rect', matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      rect: { x: 0, y: 0, width: 1, height: 1 }, color: 0xff0000, alpha: 1, clips: [] };
    const imageFrame = frame([one]), secondStart = f.calls.length;
    const second = f.capture(() => h.renderFrame({ ...imageFrame, commands: [rect, ...imageFrame.commands] })); admitted(second);
    assert.equal(second.buffers.length, 1); const earlyCold = second.buffers[0];
    assert.equal(earlyCold.descriptor.usage, 40); assert.equal(earlyCold.descriptor.size, 144);
    const warmUniform = f.calls.slice(secondStart).find(call => call[0] === 'writeBuffer' && call[1].descriptor.usage === 72)[1];
    assert.equal(warmUniform, seed.buffers[1], 'the later request actually leases the oldest warm uniform');
    await second.finish(); await h.whenIdle();
    const many = frame(Array(2047).fill(one)), thirdStart = f.calls.length;
    const third = f.capture(() => h.renderFrame({ ...many, commands: [rect, rect, ...many.commands] })); admitted(third);
    const destroyed = f.calls.slice(thirdStart).filter(call => call[0] === 'destroyBuffer').map(call => call[1]);
    assert.equal(destroyed.length, 1);
    assert.equal(destroyed[0], earlyCold, 'request-order return makes earlier cold rectangle the oldest unmatched victim');
    assert.equal(warmUniform.destroyed, 0, 'later warm uniform must survive the pressure victim selection');
    assert.equal(third.buffers.length, 1); assert.equal(third.buffers[0].descriptor.size, 288);
    await third.finish(); await h.whenIdle(); await f.close(h);
    assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
    console.log(JSON.stringify({ case: 'mixed-return-order-public-witness', seedEligible: 4096,
      mixedNewBuffers: second.buffers.length, selectedVictimBytes: earlyCold.descriptor.size,
      pressureNewBuffers: third.buffers.length, pressureNewBytes: third.buffers[0].descriptor.size,
      allOnceDestroyed: f.buffers.length }));
  });
});
