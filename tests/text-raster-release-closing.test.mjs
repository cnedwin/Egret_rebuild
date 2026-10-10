import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createImageData2D } from '@egret/engine';
import { createTextRasterCache } from '@egret/engine/text';
import { deferred, host } from './helpers.mjs';

const request = Object.freeze({ text: 'A', fontFamily: 'Test', fontSize: 16,
  fontWeight: 400, fontStyle: 'normal', lineHeight: 10, locale: 'und',
  direction: 'ltr', density: 1, fillColor: 0xffffff });

for (const closingDuringFrame of [false, true]) {
  test(`release settlement preserves owner-close reason: closing=${closingDuringFrame}`, async () => {
    const gate = deferred(), entered = deferred();
    let engine, closing, releases = 0;
    const adapter = host({ renderFrame() {
      // The cache observes real thenable cleanup settlement before the Engine's
      // frame-idle close continuation. No manager or lease is substituted.
      gate.resolve();
      if (closingDuringFrame) closing = engine.dispose();
    } }).adapter;
    engine = await createEngine({ host: adapter });
    const cache = createTextRasterCache(engine.assets, { maxResidentEntries: 0, provider: {
      identity: 'release.closing.t1', profile: 'canvas-explicit-lines-v1',
      async measure(_request, context) {
        return context.createPlan({ baselineOffset: 5, lines: [{ advance: 8,
          hasInk: true, inkLeft: -1, inkTop: -4, inkRight: 7, inkBottom: 2 }] });
      },
      async rasterize() {
        return createImageData2D({ width: 12, height: 10, pixels: new Uint8Array(480) });
      },
      release() { releases++; entered.resolve(); return gate.promise; },
    } });
    const acquired = cache.acquire(request).then(value => ({ value }), error => ({ error }));
    try {
      await entered.promise;
      engine.renderFrame({ width: 1, height: 1 });
      const outcome = await acquired;
      if (closingDuringFrame) {
        assert.ok('error' in outcome);
        assert.equal(outcome.error.code, 'TEXT_CACHE_CLOSED');
        assert.equal(outcome.error.cause.code, 'ASSET_MANAGER_CLOSED');
        await closing;
      } else {
        assert.ok('value' in outcome); assert.equal(outcome.value.kind, 'image');
        outcome.value.lease.release();
      }
      await cache.whenIdle();
      assert.equal(releases, 1);
      assert.equal(cache.getStatus().reservedImageBytes, 0);
      assert.equal(cache.getStatus().pendingRasterBytes, 0);
    } finally { gate.resolve(); cache.dispose(); await engine.dispose(); }
  });
}
