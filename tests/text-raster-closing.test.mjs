import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createImageData2D } from '@egret/engine';
import { createTextRasterCache } from '@egret/engine/text';
import { deferred, host } from './helpers.mjs';

const request = Object.freeze({ text: 'A', fontFamily: 'Test', fontSize: 16,
  fontWeight: 400, fontStyle: 'normal', lineHeight: 10, locale: 'und',
  direction: 'ltr', density: 1, fillColor: 0xffffff });

for (const closingDuringFrame of [false, true]) {
  test(`measure settlement revalidates Engine before raster work: closing=${closingDuringFrame}`, async () => {
    const gate = deferred();
    let engine, plan, closing, rasterCalls = 0, releases = 0;
    const adapter = host({ renderFrame() {
      // Queue actual measure settlement before the frame-finally close continuation.
      gate.resolve(plan);
      if (closingDuringFrame) {
        closing = engine.dispose();
        assert.equal(engine.stage.isDisposed, false);
      }
    } }).adapter;
    engine = await createEngine({ host: adapter });
    const cache = createTextRasterCache(engine.assets, { maxResidentEntries: 0, provider: {
      identity: 'closing.t1', profile: 'canvas-explicit-lines-v1',
      measure(_request, context) {
        plan = context.createPlan({ baselineOffset: 5, lines: [{ advance: 8,
          hasInk: true, inkLeft: -1, inkTop: -4, inkRight: 7, inkBottom: 2 }] });
        return gate.promise;
      },
      async rasterize() {
        rasterCalls++;
        return createImageData2D({ width: 12, height: 10, pixels: new Uint8Array(480) });
      },
      release(value) { assert.equal(value, plan); releases++; },
    } });
    const acquired = cache.acquire(request).then(value => ({ value }), error => ({ error }));
    try {
      assert.ok(plan);
      engine.renderFrame({ width: 1, height: 1 });
      const outcome = await acquired;
      if (closingDuringFrame) {
        assert.ok('error' in outcome);
        assert.equal(outcome.error.code, 'TEXT_CACHE_CLOSED');
        assert.equal(rasterCalls, 0, 'Engine closing must prevent a new raster reservation/callback');
        await closing;
      } else {
        assert.ok('value' in outcome);
        assert.equal(outcome.value.kind, 'image');
        assert.equal(outcome.value.lease.value.imageData.width, 12);
        assert.equal(rasterCalls, 1);
        outcome.value.lease.release();
      }
      await cache.whenIdle();
      assert.equal(releases, 1);
      assert.equal(cache.getStatus().reservedImageBytes, 0);
      assert.equal(cache.getStatus().pendingRasterBytes, 0);
    } finally { cache.dispose(); await engine.dispose(); }
  });
}
