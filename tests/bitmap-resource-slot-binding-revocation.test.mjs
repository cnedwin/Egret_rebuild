// SPDX-License-Identifier: Apache-2.0
// Original public-behavior supplement for manual token changes plus revocation.
// Install as tests/bitmap-resource-slot-binding-revocation.test.mjs before running.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

const FRAME = Object.freeze({ width: 16, height: 16 });
const CROP_A = Object.freeze({ x: 1, y: 0, width: 1, height: 2 });
const PIXELS_A = Object.freeze([255,0,0,255, 255,0,0,255, 255,0,0,255, 255,0,0,255]);
const FULL_A = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const FULL_C = Object.freeze({ x: 0, y: 0, width: 1, height: 3 });
function expectCode(run, expected) {
  let error;
  assert.throws(run, observed => { error = observed; assert.equal(observed?.code, expected); return true; });
  return error;
}
function observe(promise) {
  const result = { state: 'pending', value: undefined, error: undefined };
  void promise.then(value => { result.state = 'fulfilled'; result.value = value; }, error => { result.state = 'rejected'; result.error = error; });
  return result;
}
async function expectRejection(result, expected) {
  await flush(); assert.equal(result.state, 'rejected'); assert.equal(result.error?.code, expected);
  return result.error;
}
async function fixture(withSlot = false) {
  const port = host(), diagnostics = [], disposals = [], loads = [], pendingB = deferred();
  const engine = await sdk.createEngine({ host: port.adapter, onDiagnostic: item => { diagnostics.push(item); } });
  try {
    const values = {
      A: sdk.createTexture(sdk.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array(PIXELS_A) })),
      B: sdk.createTexture(sdk.createImageData2D({ width: 3, height: 1, pixels: new Uint8Array([0,255,0,255, 0,255,0,255, 0,255,0,255]) })),
      C: sdk.createTexture(sdk.createImageData2D({ width: 1, height: 3, pixels: new Uint8Array([0,0,255,255, 0,0,255,255, 0,0,255,255]) })),
    };
    const type = sdk.createAssetType('binding-revocation-original-texture', sdk.isTexture), refs = new Map();
    const ref = id => { if (!refs.has(id)) refs.set(id, sdk.createAssetRef(type, id)); return refs.get(id); };
    let providerBContext;
    engine.assets.register(type, {
      load(reference, context) {
        loads.push(reference.id);
        if (reference.id === 'B') { providerBContext = context; return pendingB.promise; }
        if (reference.id === 'A' || reference.id === 'C') return Promise.resolve(values[reference.id]);
        return Promise.reject(new Error('Unexpected provider demand: ' + reference.id));
      },
      dispose(value) { disposals.push(value); if (sdk.isTexture(value)) value.dispose(); },
    });
    const initialScope = engine.createScope(), manualScope = engine.createScope(), slotScope = engine.createScope();
    const initialLease = initialScope.use(await engine.assets.acquire(ref('A'))), bitmap = new sdk.Bitmap(initialLease);
    bitmap.sourceRect = CROP_A; engine.stage.addChild(bitmap);
    const slot = withSlot ? engine.createBitmapResourceSlot(slotScope, bitmap) : undefined;
    return { engine, bitmap, slot, slotScope, initialLease, values, ref, loads, diagnostics,
      count(value) { return disposals.filter(item => item === value).length; },
      async manualLease(kind) { return manualScope.use(await engine.assets.acquire(ref(kind === 'lease' ? 'A' : 'C'))); },
      pending() { const result = observe(slot.replace(ref('B'))); assert.equal(loads.filter(id => id === 'B').length, 1); return result; },
      resolveB() { pendingB.resolve(values.B); }, rejectB(cause) { pendingB.reject(cause); },
      get providerBContext() { return providerBContext; },
      async close() {
        await engine.dispose(); await flush();
        assert.deepEqual(diagnostics, []); assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0);
      },
    };
  } catch (cause) { await engine.dispose(); throw cause; }
}
function redFrame(f) {
  const frame = f.engine.captureFrame(FRAME);
  assert.equal(frame.commands[0]?.kind, 'image');
  assert.deepEqual(frame.commands[0].sourceRect, CROP_A);
  assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
  assert.deepEqual(Array.from(sdk.copyImageData2DPixels(frame.images[frame.commands[0].imageIndex])), PIXELS_A);
  return frame;
}
function revoke(lease, kind) { if (kind === 'lease') lease.release(); else lease.value.dispose(); }

test('SC04 healthy public Bitmap baseline: manual independent binding and revocation need no slot', async t => {
  for (const kind of ['lease', 'texture']) await t.test(kind, async () => {
    const f = await fixture();
    try {
      const saved = redFrame(f), manual = await f.manualLease(kind);
      assert.notEqual(manual, f.initialLease); f.bitmap.textureLease = manual;
      const expected = kind === 'lease' ? FULL_A : FULL_C;
      assert.deepEqual(f.bitmap.sourceRect, expected); f.engine.captureFrame(FRAME);
      revoke(manual, kind);
      expectCode(() => f.engine.captureFrame(FRAME), kind === 'lease' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED');
      assert.equal(f.bitmap.textureLease, manual); assert.deepEqual(f.bitmap.sourceRect, expected);
      assert.equal(f.initialLease.value, f.values.A); assert.equal(f.count(f.values.A), 0);
      f.bitmap.textureLease = f.initialLease; f.bitmap.sourceRect = CROP_A; redFrame(f);
      assert.deepEqual(Array.from(sdk.copyImageData2DPixels(saved.images[0])), PIXELS_A);
      assert.equal(f.loads.includes('B'), false);
    } finally { await f.close(); }
  });
});

test('SC04 changed token dominates revoked manual entitlement on controls and candidate reactions', async t => {
  for (const kind of ['lease', 'texture']) for (const discovery of ['cancel', 'replace', 'reaction-success', 'reaction-failure']) await t.test(kind + '/' + discovery, async () => {
    const f = await fixture(true);
    try {
      const manual = await f.manualLease(kind), pending = f.pending(); redFrame(f);
      f.bitmap.textureLease = manual;
      const expected = kind === 'lease' ? FULL_A : FULL_C;
      assert.deepEqual(f.bitmap.sourceRect, expected); revoke(manual, kind);
      if (discovery === 'cancel') expectCode(() => f.slot.cancel(), 'BITMAP_RESOURCE_BINDING_CHANGED');
      if (discovery === 'replace') expectCode(() => f.slot.replace(f.ref('D')), 'BITMAP_RESOURCE_BINDING_CHANGED');
      if (discovery === 'reaction-success') f.resolveB();
      if (discovery === 'reaction-failure') f.rejectB(Object.freeze({ original: 'provider rejection after manual revocation' }));
      await expectRejection(pending, 'BITMAP_RESOURCE_BINDING_CHANGED');
      assert.equal(f.slot.state, 'conflicted'); assert.equal(f.bitmap.textureLease, manual);
      assert.deepEqual(f.bitmap.sourceRect, expected); assert.deepEqual([f.bitmap.naturalWidth, f.bitmap.naturalHeight], [expected.width, expected.height]);
      assert.equal(f.loads.includes('D'), false);
      if (discovery === 'cancel' || discovery === 'replace') { assert.equal(f.providerBContext.signal.aborted, true); f.resolveB(); await flush(); }
      assert.equal(f.count(f.values.B), discovery === 'reaction-failure' ? 0 : 1);
      expectCode(() => f.engine.captureFrame(FRAME), kind === 'lease' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED');
      assert.equal(f.initialLease.value, f.values.A); assert.equal(f.count(f.values.A), 0);
      // A later manual restoration cannot silently reopen a conflicted slot claim.
      f.bitmap.textureLease = f.initialLease; f.bitmap.sourceRect = CROP_A; redFrame(f);
      expectCode(() => f.engine.createBitmapResourceSlot(f.slotScope, f.bitmap), 'BITMAP_RESOURCE_TARGET_BUSY');
      expectCode(() => f.slot.cancel(), 'BITMAP_RESOURCE_BINDING_CHANGED');
      f.slot.dispose(); assert.equal(f.slot.state, 'disposed'); assert.equal(f.bitmap.textureLease, f.initialLease); redFrame(f);
      const next = f.engine.createBitmapResourceSlot(f.slotScope, f.bitmap); assert.equal(next.state, 'idle'); next.dispose(); redFrame(f);
      assert.deepEqual(f.diagnostics, []);
    } finally { await f.close(); }
  });
});

test('SC04 unchanged token preserves existing revocation failures instead of becoming a conflict', async t => {
  for (const kind of ['lease', 'texture']) for (const discovery of ['control', 'reaction']) await t.test(kind + '/' + discovery, async () => {
    const f = await fixture(true);
    try {
      const pending = f.pending(), expected = kind === 'lease' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED';
      revoke(f.initialLease, kind);
      if (discovery === 'control') { expectCode(() => f.slot.cancel(), expected); f.resolveB(); }
      else f.resolveB();
      const error = await expectRejection(pending, 'BITMAP_RESOURCE_REPLACE_FAILED');
      assert.equal(error.cause.code, expected); assert.equal(f.slot.state, 'failed');
      assert.equal(f.bitmap.textureLease, f.initialLease); assert.deepEqual(f.bitmap.sourceRect, CROP_A);
      assert.equal(f.count(f.values.B), 1); assert.equal(f.loads.includes('D'), false);
      f.slot.dispose(); assert.equal(f.bitmap.textureLease, f.initialLease); assert.deepEqual(f.bitmap.sourceRect, CROP_A);
      assert.deepEqual(f.diagnostics, []);
    } finally { await f.close(); }
  });
});
