// SPDX-License-Identifier: Apache-2.0
// Model the native surface shape reported by Safari; the device supplies separate pixel evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { factory, realm, setup, wcRequest } from './canvas-text-provider-double-helpers.mjs';
import { release } from './text-raster-public-helpers.mjs';

function partialSurface(t, { alpha, colorSpace = 'srgb', clearAlpha = 0, owned = true, denyState } = {}) {
  const native = realm(t, {
    attributes() {
      return { colorSpace, ...(alpha === undefined ? {} : { alpha }) };
    },
    read(call) {
      if (call.width === 1 && call.height === 1) call.pixels[3] = clearAlpha;
    },
    denyState
  });
  if (owned) {
    const owner = new WeakMap();
    Object.defineProperty(native.Context.prototype, 'canvas', {
      get() { return owner.get(this); },
      set(canvas) { owner.set(this, canvas); }
    });
  }
  for (const key of ['lang', 'fontKerning', 'fontStretch', 'fontVariantCaps', 'textRendering', 'filter'])
    delete native.Context.prototype[key];
  return native;
}

test('owned Canvas text surfaces preserve the requested language with partially reported native defaults', async t => {
  const native = partialSurface(t);
  const { cache } = await setup(t, (await factory())());
  const lease = await cache.acquire(wcRequest({ text: '白鹭', locale: 'zh-CN' }));
  try {
    assert.equal(lease.kind, 'image');
    assert.deepEqual(native.canvases.map(canvas => canvas.lang), ['zh-CN', 'zh-CN']);
    assert.equal(native.measurements.length, 1);
    assert.equal(native.fills.length, 1);
  } finally {
    release(lease);
  }
  await cache.whenIdle();
  assert.equal(cache.getStatus().activeCallerLeases, 0);
  assert.ok(native.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});

for (const [name, options] of [
  ['explicitly opaque surface', { alpha: false }],
  ['opaque initial pixel', { clearAlpha: 255 }],
  ['unselected color space', { colorSpace: 'display-p3' }],
  ['unverified context with omitted attributes', { owned: false }],
  ['unverified context with missing text state', { owned: false, alpha: true }],
  ['ignored explicit direction', { denyState: 'direction' }]
]) {
  test('Canvas text refuses an ' + name, async t => {
    const native = partialSurface(t, options);
    const { cache } = await setup(t, (await factory())());
    await assert.rejects(cache.acquire(wcRequest({ locale: 'zh-CN' })), error =>
      error.code === 'TEXT_MEASURE_FAILED' && error.cause?.code === 'WEB_TEXT_STATE_UNSUPPORTED');
    assert.equal(native.fills.length, 0);
    assert.ok(native.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  });
}
