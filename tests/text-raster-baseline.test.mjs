import test from 'node:test';
import assert, { AssertionError } from 'node:assert/strict';
import {
  createEngine, createImageData2D, copyImageData2DPixels,
  createTexture, createAssetType, createAssetRef, isTexture, Bitmap,
} from '@egret/engine';
import { host } from './helpers.mjs';

test('T01: genuine image and lease baseline precedes the explicit text cache feature', async () => {
  const adapter = host();
  const engine = await createEngine({ host: adapter.adapter });
  let first, second, prepared;
  try {
    // Literal baseline channels are fixed before execution and independent of T1.
    const image = createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([17, 83, 149, 255]) });
    const texture = createTexture(image);
    const type = createAssetType('t01.baseline.texture', isTexture);
    let loads = 0;
    engine.assets.register(type, {
      async load() { loads++; return texture; },
      dispose(value) { value.dispose(); },
    });
    const ref = createAssetRef(type, 't01.baseline.image');
    [first, second] = await Promise.all([engine.assets.acquire(ref), engine.assets.acquire(ref)]);
    assert.equal(loads, 1);
    assert.notEqual(first, second);
    assert.notEqual(first.leaseId, second.leaseId);
    assert.equal(first.resourceGeneration, second.resourceGeneration);
    assert.equal(first.value, second.value);
    engine.stage.addChild(new Bitmap(second));
    const frame = engine.captureFrame({ width: 1, height: 1 });
    assert.equal(frame.commands.length, 1);
    assert.equal(frame.commands[0].kind, 'image');
    assert.equal(frame.images[frame.commands[0].imageIndex], image);
    first.release();
    assert.equal(second.value, texture);
    assert.deepEqual([...copyImageData2DPixels(image)], [17, 83, 149, 255]);
    process.stdout.write('T01_GENUINE_BASELINE_PASSED\n');

    let entry;
    try { entry = await import('@egret/engine/text'); }
    catch (cause) {
      const failure = new AssertionError({ message: 'T01 requires the public createTextRasterCache feature after the genuine baseline', actual: cause.code, expected: 'loadable @egret/engine/text', operator: 'feature available' });
      Object.defineProperty(failure, 'cause', { value: cause });
      throw failure;
    }
    assert.equal(typeof entry.createTextRasterCache, 'function');
    const cache = entry.createTextRasterCache(engine.assets, {
      provider: {
        identity: 'literal.t1', profile: 'canvas-explicit-lines-v1',
        async measure(request, context) {
          return context.createPlan({ baselineOffset: 5, lines: [{ advance: 8, hasInk: true, inkLeft: -1, inkTop: -4, inkRight: 7, inkBottom: 2 }] });
        },
        async rasterize(plan) {
          assert.equal(plan.metrics.raster.width, 12);
          assert.equal(plan.metrics.raster.height, 10);
          return createImageData2D({ width: 12, height: 10, pixels: new Uint8Array(480) });
        },
        release() {},
      },
    });
    prepared = await cache.acquire({ text: 'A', fontFamily: 'Test', fontSize: 16, fontWeight: 400, fontStyle: 'normal', lineHeight: 10, locale: 'und', direction: 'ltr', density: 1, fillColor: 0xffffff });
    assert.equal(prepared.kind, 'image');
    assert.ok(isTexture(prepared.lease.value));
    assert.equal(prepared.lease.value.imageData.width, 12);
    prepared.lease.release();
    cache.dispose();
    await cache.whenIdle();
  } finally {
    prepared?.lease?.release();
    first?.release();
    second?.release();
    await engine.dispose();
  }
});
