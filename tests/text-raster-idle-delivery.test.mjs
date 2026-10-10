import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, request, release, signal, keep, fulfilled, rejectedKept } from './text-raster-public-helpers.mjs';

for (const removalFails of [false, true]) {
  test(`ready-hit idle spans listener removal: failure=${removalFails}`, async (t) => {
    const f = await fixture(t, {}, { maxResidentEntries: 0 });
    const warm = await f.cache.acquire(request());
    await f.cache.whenIdle();
    let idle, settledDuringRemoval;
    const cause = Object.freeze({ cleanup: 'ready-hit-removal' });
    const caller = signal({
      add() { idle = keep(f.cache.whenIdle()); },
      remove() { settledDuringRemoval = idle.settled; if (removalFails) throw cause; },
    });
    const pending = keep(f.cache.acquire(request(), { signal: caller.value }));
    if (removalFails) {
      await rejectedKept(pending, 'TEXT_SIGNAL_FAILED', cause);
      const outcome = await idle.observed;
      assert.ok('error' in outcome, 'idle must observe the actual delivery cleanup failure');
      assert.equal(outcome.error.code, 'TEXT_CACHE_CLEANUP_FAILED');
      assert.equal(outcome.error.cause, cause);
    } else {
      const prepared = await fulfilled(pending);
      assert.equal(prepared.lease.value, warm.lease.value);
      assert.equal('error' in await idle.observed, false);
      release(prepared);
    }
    assert.equal(settledDuringRemoval, false, 'idle must not settle before removal finishes');
    release(warm);
  });
}
