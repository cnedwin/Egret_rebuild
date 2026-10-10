import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, request, assertImage, release, rejected } from './text-raster-public-helpers.mjs';

test('private actual-manager exhaustion cannot convert failed ink into a blank ready hit', async (t) => {
  const f = await fixture(t, {}, { maxResidentEntries: 0 });
  // Controlled private fault in the genuine manager, not a substitute asset port.
  // Its existing exhaustion branch supplies the actual complete resource cause.
  const manager = f.engine.assets;
  const previous = manager.taskId;
  try {
    manager.taskId = Number.MAX_SAFE_INTEGER;
    const failure = await rejected(f.cache.acquire(request()), 'TEXT_RESOURCE_FAILED');
    assert.equal(failure.cause.code, 'ASSET_ID_EXHAUSTED');
    await f.cache.whenIdle();
  } finally { manager.taskId = previous; }
  const retried = await f.cache.acquire(request());
  assertImage(retried);
  assert.equal(f.state.measure, 2);
  assert.equal(f.state.raster, 2);
  release(retried);
});
