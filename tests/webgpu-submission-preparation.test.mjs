// SPDX-License-Identifier: Apache-2.0
// Controlled allocation-counter UNIT over genuine public frames and GPU ports.
// Count only preparation before the first native error scope, excluding port logs.
// The source copy uses a captured constructor; only the tight crop is observed.
// These counts establish the crop-copy path, not allocation bytes or performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {frame, withGpu, withAuthored, admitted} from './fixtures/gpu-image-residency.mjs';

async function observeCrop(f, render) {
  const Original = globalThis.Uint8Array;
  let copies = 0, record, preparing = true;
  const previousPush = f.hooks.push;
  f.hooks.push = (...args) => { preparing = false; return previousPush?.(...args); };
  try {
    globalThis.Uint8Array = class extends Original {
      constructor(...args) { super(...args); if (preparing && args[0] === 4) copies++; }
    };
    record = f.capture(render);
  } finally {
    globalThis.Uint8Array = Original;
    if (previousPush === undefined) delete f.hooks.push; else f.hooks.push = previousPush;
  }
  admitted(record); await record.finish();
  return copies;
}

test('P02 ordinary covered resident view skips its crop allocation', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame();
    assert.equal(await observeCrop(f, () => h.renderFrame(input)), 1, 'cold tight-crop baseline');
    await h.whenIdle();
    assert.equal(await observeCrop(f, () => h.renderFrame(input)), 0, 'warm qualified view must not materialize crop pixels');
    assert.equal(h.getStatus().lastSerial, 2); await f.close(h);
  });
});

test('P02 genuine textured capture skips its resident crop allocation', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({}, 'textured'); await f.ready(h); a.engine.stage.addChild(a.mesh);
    const input = a.textured();
    assert.equal(await observeCrop(f, () => h.renderTexturedFrame(input)), 1, 'shared cold image/Mesh crop baseline');
    await h.whenIdle();
    assert.equal(await observeCrop(f, () => h.renderTexturedFrame(input)), 0, 'warm genuine capture must not materialize crop pixels');
    assert.equal(h.getTexturedStatus().pendingGeometryBytes, 0); await f.close(h);
  }));
});
