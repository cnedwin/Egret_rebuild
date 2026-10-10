import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, request, assertImage, release } from './text-raster-public-helpers.mjs';

test('controlled first-waiter construction failure rolls back an undemanded committed job', async (t) => {
  const f = await fixture(t, {}, { maxPendingJobs: 1, maxResidentEntries: 0 });
  const original = globalThis.Map;
  const cause = Object.freeze({ constructorFault: 'first-caller-controller' });
  let constructions = 0, outcome;
  try {
    // Private synchronous construction interception proves rollback. This is
    // neither an actual out-of-memory observation nor a fabricated asset value.
    globalThis.Map = new Proxy(original, { construct(target, args, receiver) {
      if (++constructions === 2) throw cause;
      return Reflect.construct(target, args, receiver);
    } });
    outcome = await f.cache.acquire(request()).then(value => ({ value }), error => ({ error }));
  } finally { globalThis.Map = original; }
  assert.equal(constructions, 2);
  assert.ok('error' in outcome);
  assert.equal(f.state.measure, 0);
  const status = f.cache.getStatus();
  assert.equal(status.pendingJobs, 0, 'no actor started, so the unstarted job charge must roll back');
  assert.equal(status.currentGenerations, 0);
  assert.equal(status.retiredGenerations, 0);
  assert.equal(status.metadataBytes, 4096);
  assert.equal(outcome.error.code, 'TEXT_REQUEST_INVALID');
  assert.equal(outcome.error.cause, cause);
  const retry = await f.cache.acquire(request());
  assertImage(retry); release(retry);
});
