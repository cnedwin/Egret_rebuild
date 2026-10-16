// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

const CROP = Object.freeze({ x: 1, y: 0, width: 1, height: 2 });
const FRAME = Object.freeze({ width: 8, height: 8 });
function code(action, expected) {
  assert.throws(action, error => { assert.equal(error.code, expected); return true; });
}
async function scene() {
  const h = host(), engine = await egret.createEngine({ host: h.adapter });
  const resources = engine.createScope(), scope = engine.createScope();
  const image = egret.createImageData2D({ width: 2, height: 2,
    pixels: new Uint8Array([255,0,0,255, 255,0,0,255, 255,0,0,255, 255,0,0,255]) });
  const texture = egret.createTexture(image);
  let loads = 0, disposals = 0;
  const type = egret.createAssetType('bitmap-resource-admission', egret.isTexture);
  engine.assets.register(type, { async load() { loads++; return texture; },
    dispose(value) { disposals++; value.dispose(); } });
  const ref = egret.createAssetRef(type, 'initial');
  const lease = resources.use(await engine.assets.acquire(ref));
  const bitmap = resources.use(new egret.Bitmap(lease));
  bitmap.sourceRect = CROP;
  engine.stage.addChild(bitmap);
  const capture = () => engine.captureFrame(FRAME);
  return { h, engine, resources, scope, image, texture, ref, lease, bitmap, capture,
    counts: () => ({ loads, disposals }) };
}
async function close(f) {
  await f.engine.dispose();
  assert.deepEqual(f.h.trace, ['start', 'stop', 'close']);
  assert.equal(f.h.timers.size, 0);
  assert.deepEqual(f.counts(), { loads: 1, disposals: 1 });
}


function greenTexture() {
  return egret.createTexture(egret.createImageData2D({ width: 3, height: 1,
    pixels: new Uint8Array([0,255,0,255, 0,255,0,255, 0,255,0,255]) }));
}
test('BRS03/BRS28: pending keeps cropped A and commits full B without replacing the target', async () => {
  const f = await scene(), gate = deferred(), green = greenTexture(), retired = [];
  try {
    const type = egret.createAssetType('replacement-green', egret.isTexture);
    f.engine.assets.register(type, { load() { return gate.promise; },
      dispose(value) { retired.push(value); value.dispose(); } });
    const slot = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
    const parent = f.bitmap.parent, saved = f.capture();
    const pending = slot.replace(egret.createAssetRef(type, 'B'));
    assert.ok(pending instanceof Promise); assert.equal(slot.state, 'pending');
    assert.equal(f.bitmap.textureLease, f.lease);
    assert.deepEqual(f.capture().commands[0].sourceRect, CROP);
    gate.resolve(green);
    assert.equal(await pending, undefined);
    assert.equal(slot.state, 'ready'); assert.equal(f.bitmap.parent, parent);
    assert.equal(f.bitmap.textureLease.value, green);
    assert.deepEqual(f.bitmap.sourceRect, { x: 0, y: 0, width: 3, height: 1 });
    assert.deepEqual([f.bitmap.naturalWidth, f.bitmap.naturalHeight], [3, 1]);
    assert.deepEqual(saved.commands[0].sourceRect, CROP);
    assert.equal(f.lease.value, f.texture);
    slot.dispose();
    assert.equal(f.bitmap.textureLease, undefined);
    assert.deepEqual(retired, [green]);
    assert.equal(f.lease.value, f.texture);
  } finally { await close(f); }
});

test('BRS04: genuine load rejection including undefined preserves A and explicit retry succeeds', async () => {
  for (const sentinel of [undefined, Object.freeze({ failed: true })]) {
    const f = await scene(), first = deferred(), second = deferred(), green = greenTexture();
    let loads = 0;
    try {
      const type = egret.createAssetType('replacement-retry', egret.isTexture);
      f.engine.assets.register(type, { load() { return ++loads === 1 ? first.promise : second.promise; },
        dispose(value) { value.dispose(); } });
      const ref = egret.createAssetRef(type, 'retry'), slot = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
      const result = slot.replace(ref).then(() => assert.fail('expected load rejection'), error => error);
      first.reject(sentinel);
      const error = await result;
      assert.equal(error.code, 'BITMAP_RESOURCE_REPLACE_FAILED');
      assert.equal(error.cause.code, 'ASSET_LOAD_FAILED');
      assert.equal(error.cause.cause, sentinel);
      assert.equal(slot.state, 'failed');
      assert.deepEqual(f.capture().commands[0].sourceRect, CROP);
      const retry = slot.replace(ref); assert.equal(slot.state, 'pending');
      second.resolve(green); await retry;
      assert.equal(slot.state, 'ready'); assert.equal(loads, 2);
      assert.equal(f.bitmap.textureLease.value, green);
    } finally { await close(f); }
  }
});

test('BRS05: cancel settles ignored-abort work promptly and late provider value retires once', async () => {
  for (const reason of [undefined, Object.freeze({ cancelled: true })]) {
    const f = await scene(), gate = deferred(), green = greenTexture(), retired = [];
    try {
      const type = egret.createAssetType('replacement-cancel', egret.isTexture);
      f.engine.assets.register(type, { load() { return gate.promise; },
        dispose(value) { retired.push(value); value.dispose(); } });
      const slot = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
      const result = slot.replace(egret.createAssetRef(type, 'late')).then(
        () => assert.fail('expected cancellation'), error => error);
      slot.cancel(reason);
      const error = await result;
      assert.equal(error.code, 'BITMAP_RESOURCE_CANCELLED'); assert.equal(error.cause, reason);
      assert.equal(slot.state, 'idle'); assert.deepEqual(f.capture().commands[0].sourceRect, CROP);
      assert.deepEqual(retired, []);
      gate.resolve(green); await flush();
      assert.deepEqual(retired, [green]); assert.equal(f.lease.value, f.texture);
    } finally { await close(f); }
  }
});
