import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Bitmap, createImageData2D, copyImageData2DPixels,
} from '@egret/engine';
import {
  fixture, request, image, assertImage, release, rejected, errorIs,
} from './text-raster-public-helpers.mjs';

// The existing literal metrics prescribe 12x10/480 image bytes and 960 scratch
// bytes. These are frozen metadata expectations, never actual font/GPU pixels.
const OPTIONS = Object.freeze({
  maxGenerations: 1, maxPendingJobs: 1, maxCallerLeases: 1,
  maxResidentEntries: 0, maxLogicalImageBytes: 480, maxPendingRasterBytes: 960,
});
const CHANNELS = Object.freeze([17, 83, 149, 255]);
const IMAGE_FIELDS = Object.freeze([
  'width', 'height', 'bytesPerRow', 'byteLength', 'format', 'colorSpace',
  'alphaMode', 'origin', 'pixels', 'buffer', 'byteOffset',
]);

function assertOwnPlanReleasedOnce(f) {
  assert.equal(f.state.measure, 1);
  assert.equal(f.state.raster, 1);
  assert.equal(f.state.release, 1);
  assert.equal(f.state.plans.length, 1);
  assert.equal(f.state.released.length, 1);
  assert.equal(f.state.released[0], f.state.plans[0]);
  assert.equal(f.state.events.at(-1), 'release');
}

async function assertInvalidTerminal(f, baseline, valueRequest = request()) {
  const failure = await rejected(f.cache.acquire(valueRequest), 'TEXT_RASTER_RESULT_INVALID');
  // No fulfilled result is substituted for rejection and no caller lease is
  // exposed. Status observes entitlements; it is not an internal load counter.
  assert.equal('lease' in failure, false);
  assertOwnPlanReleasedOnce(f);
  await f.cache.whenIdle();
  const status = f.cache.getStatus();
  for (const field of [
    'occupiedSlots', 'currentGenerations', 'retiredGenerations',
    'quarantinedGenerations', 'pendingJobs', 'pendingWaiters',
    'callerLeaseSlots', 'activeCallerLeases', 'residentEntries', 'residentBytes',
    'liveImageBytes', 'reservedImageBytes', 'pendingRasterBytes',
    'quarantinedImageBytes', 'quarantinedRasterBytes', 'cleanupFailureCount',
    'lateProviderFailureCount',
  ]) assert.equal(status[field], 0, `${field} must retire without quarantine/refund invention`);
  assert.equal(status.metadataBytes, baseline.metadataBytes);
  assert.equal(status.closed, false);
  assert.equal(f.diagnostics.length, 0);
  return failure;
}

function poisonedImage(kind, genuine) {
  const reads = { fields: [], then: 0 }, cause = { imageMetadata: kind };
  const deny = (key) => { reads.fields.push(key); throw cause; };
  let value;
  if (kind === 'proxy-of-genuine') {
    value = new Proxy(genuine, {
      get(_target, key) {
        // Promise resolution may assimilate values before cache validation.
        // An ordinary nonthenable lookup is explicitly allowed and counted.
        if (key === 'then') { reads.then++; return undefined; }
        return deny(key);
      },
    });
  } else {
    value = kind === 'inherits-genuine' ? Object.create(genuine) : {};
    for (const key of IMAGE_FIELDS) Object.defineProperty(value, key, {
      get() { return deny(key); },
    });
    Object.defineProperty(value, 'then', {
      get() { reads.then++; return undefined; },
    });
  }
  return { value, reads, cause };
}

test('T20: exact authentic raster is retained by identity and independent pixels through genuine lease/Bitmap', async (t) => {
  const source = new Uint8Array(480);
  for (let offset = 0; offset < source.length; offset += 4) source.set(CHANNELS, offset);
  const owned = createImageData2D({ width: 12, height: 10, pixels: source });
  source.fill(0); // The genuine factory already owns its independent literal copy.
  const f = await fixture(t, {
    async rasterize(plan, context) {
      assert.equal(plan.metrics.raster.width, 12);
      assert.equal(plan.metrics.raster.height, 10);
      assert.equal(context.reservedImageBytes, 480);
      assert.equal(context.reservedScratchBytes, 960);
      return owned;
    },
  }, OPTIONS);
  const prepared = await f.cache.acquire(request());
  const texture = assertImage(prepared);
  assertOwnPlanReleasedOnce(f);
  assert.equal(texture.imageData, owned, 'T1 must not recopy the accepted ImageData2D identity');
  assert.equal(f.state.images[0], owned);
  assert.deepEqual({ width: owned.width, height: owned.height,
    bytesPerRow: owned.bytesPerRow, byteLength: owned.byteLength,
    format: owned.format, colorSpace: owned.colorSpace,
    alphaMode: owned.alphaMode, origin: owned.origin }, {
    width: 12, height: 10, bytesPerRow: 48, byteLength: 480,
    format: 'rgba8unorm', colorSpace: 'srgb', alphaMode: 'straight', origin: 'top-left',
  });
  const copied = copyImageData2DPixels(owned);
  assert.equal(copied.length, 480);
  for (let offset = 0; offset < copied.length; offset += 4)
    assert.deepEqual([...copied.subarray(offset, offset + 4)], CHANNELS);
  copied.fill(0);
  assert.deepEqual([...copyImageData2DPixels(owned).subarray(0, 4)], CHANNELS);
  const bitmap = new Bitmap(prepared.lease);
  f.engine.stage.addChild(bitmap);
  const saved = f.engine.captureFrame({ width: 12, height: 10 });
  assert.equal(saved.commands.length, 1);
  assert.equal(saved.commands[0].kind, 'image');
  assert.equal(saved.images[saved.commands[0].imageIndex], owned);
  await f.cache.whenIdle();
  assert.equal(f.cache.getStatus().activeCallerLeases, 1);
  assert.equal(f.cache.getStatus().liveImageBytes, 480);
  release(prepared);
  assert.throws(() => prepared.lease.value, errorIs('ASSET_LEASE_RELEASED'));
  await f.cache.whenIdle();
  assert.equal(f.cache.getStatus().activeCallerLeases, 0);
  assert.equal(f.cache.getStatus().liveImageBytes, 0);
  assert.equal(saved.images[saved.commands[0].imageIndex], owned);
  assert.deepEqual([...copyImageData2DPixels(owned).subarray(0, 4)], CHANNELS);
});

test('T20: authentic wrong width or height rejects exactly and refunds before a real capacity reuse', async (t) => {
  for (const [width, height] of [[13, 10], [12, 11]]) {
    let output = image(width, height);
    // The factory admits these ordinary authentic dimensions with its fixed
    // metadata. No forged "authentic wrong format" object is manufactured.
    assert.equal(output.width, width);
    assert.equal(output.height, height);
    assert.equal(copyImageData2DPixels(output).length, 4 * width * height);
    const f = await fixture(t, { async rasterize() { return output; } }, OPTIONS);
    const baseline = f.cache.getStatus();
    await assertInvalidTerminal(f, baseline);
    assert.equal(f.state.rasterContexts[0].reservedImageBytes, 480);
    assert.equal(f.state.rasterContexts[0].reservedScratchBytes, 960);
    output = image();
    const retry = await f.cache.acquire(request({ text: 'B' }));
    assert.equal(assertImage(retry).imageData, output);
    assert.equal(f.state.measure, 2);
    assert.equal(f.state.raster, 2);
    assert.equal(f.state.release, 2);
    release(retry);
    await f.cache.whenIdle();
    assert.equal(f.cache.getStatus().metadataBytes, baseline.metadataBytes);
  }
});

test('T20: undefined for ink and authentic image for blank refuse without a public lease', async (t) => {
  for (const blank of [false, true]) {
    let output = blank ? image() : undefined;
    const f = await fixture(t, { blank, async rasterize() { return output; } }, OPTIONS);
    const baseline = f.cache.getStatus();
    await assertInvalidTerminal(f, baseline);
    assert.equal(f.state.rasterContexts[0].reservedImageBytes, blank ? 0 : 480);
    assert.equal(f.state.rasterContexts[0].reservedScratchBytes, blank ? 0 : 960);
    output = blank ? undefined : image();
    const retry = await f.cache.acquire(request({ text: 'B' }));
    if (blank) {
      assert.equal(retry.kind, 'empty');
      assert.equal('lease' in retry, false);
    } else {
      assert.equal(assertImage(retry).imageData, output);
      release(retry);
    }
    assert.equal(f.state.measure, 2);
    assert.equal(f.state.raster, 2);
    assert.equal(f.state.release, 2);
    await f.cache.whenIdle();
    assert.equal(f.cache.getStatus().metadataBytes, baseline.metadataBytes);
  }
});

test('T20: structural, genuine-inheriting and genuine-proxy results authenticate before poisoned fields', async (t) => {
  for (const kind of ['structural', 'inherits-genuine', 'proxy-of-genuine']) {
    const authentic = image();
    const poison = poisonedImage(kind, authentic);
    let output = poison.value;
    const f = await fixture(t, { async rasterize() { return output; } }, OPTIONS);
    const baseline = f.cache.getStatus();
    await assertInvalidTerminal(f, baseline);
    assert.deepEqual(poison.reads.fields, [], 'unowned image/pixel metadata must remain unread');
    assert.ok(poison.reads.then > 0, 'ordinary Promise assimilation then reads are allowed, not image reads');
    assert.equal(copyImageData2DPixels(authentic).length, 480);
    output = authentic;
    const retry = await f.cache.acquire(request({ text: 'B' }));
    assert.equal(assertImage(retry).imageData, authentic);
    assert.deepEqual(poison.reads.fields, []);
    assert.equal(f.state.measure, 2);
    assert.equal(f.state.raster, 2);
    assert.equal(f.state.release, 2);
    release(retry);
    await f.cache.whenIdle();
    assert.equal(f.cache.getStatus().metadataBytes, baseline.metadataBytes);
  }
});
