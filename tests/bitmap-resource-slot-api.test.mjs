// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

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

test('BRS baseline: genuine cropped image, immutable saved frame and external entitlement', async () => {
  const f = await scene();
  try {
    const saved = f.capture();
    assert.equal(saved.images[0], f.image);
    assert.deepEqual(saved.commands[0].sourceRect, CROP);
    assert.deepEqual(saved.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])],
      [255,0,0,255, 255,0,0,255, 255,0,0,255, 255,0,0,255]);
    assert.equal(f.lease.value, f.texture);
    f.bitmap.sourceRect = undefined;
    assert.deepEqual(saved.commands[0].sourceRect, CROP);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});

test('BRS01/BRS20: idle frozen facade borrows initial crop and disposes without clearing it', async () => {
  const f = await scene();
  try {
    assert.equal(typeof f.engine.createBitmapResourceSlot, 'function', 'BITMAP_RESOURCE_SLOT_FACTORY_REQUIRED');
    const saved = f.capture();
    const slot = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
    assert.equal(Object.isFrozen(slot), true);
    assert.equal(slot.state, 'idle');
    assert.deepEqual(Object.keys(slot).sort(), ['cancel', 'dispose', 'replace', 'state']);
    assert.deepEqual(f.capture().commands[0].sourceRect, CROP);
    slot.cancel(); slot.dispose(); slot.dispose();
    assert.equal(slot.state, 'disposed');
    assert.equal(f.bitmap.textureLease, f.lease);
    assert.equal(f.lease.value, f.texture);
    assert.deepEqual(f.capture().commands[0].sourceRect, CROP);
    assert.deepEqual(saved.commands[0].sourceRect, CROP);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
    code(() => slot.replace(f.ref), 'BITMAP_RESOURCE_DISPOSED');
    code(() => slot.cancel(), 'BITMAP_RESOURCE_DISPOSED');
  } finally { await close(f); }
});

test('BRS02: exact target and Scope admission are inert, live claims release on disposal', async () => {
  const f = await scene(), g = await scene();
  try {
    assert.equal(typeof f.engine.createBitmapResourceSlot, 'function', 'BITMAP_RESOURCE_SLOT_FACTORY_REQUIRED');
    for (const scope of [{}, new Proxy(f.scope, {}), g.scope])
      code(() => f.engine.createBitmapResourceSlot(scope, f.bitmap), 'BITMAP_RESOURCE_SCOPE_INVALID');
    const closed = f.engine.createScope(); closed.dispose();
    code(() => f.engine.createBitmapResourceSlot(closed, f.bitmap), 'SCOPE_CLOSED');
    for (const target of [{}, new Proxy(f.bitmap, {}), g.bitmap])
      code(() => f.engine.createBitmapResourceSlot(f.scope, target), 'BITMAP_RESOURCE_TARGET_INVALID');
    const empty = f.resources.use(new egret.Bitmap(f.lease)); empty.textureLease = undefined;
    code(() => f.engine.createBitmapResourceSlot(f.scope, empty), 'BITMAP_RESOURCE_TEXTURE_REQUIRED');
    const dead = new egret.Bitmap(f.lease); dead.dispose();
    code(() => f.engine.createBitmapResourceSlot(f.scope, dead), 'OBJECT_DISPOSED');
    const slot = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
    code(() => f.engine.createBitmapResourceSlot(f.scope, f.bitmap), 'BITMAP_RESOURCE_TARGET_BUSY');
    slot.dispose();
    const next = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
    assert.equal(next.state, 'idle'); next.dispose();
    assert.deepEqual(f.capture().commands[0].sourceRect, CROP);
    assert.equal(f.lease.value, f.texture);
  } finally { await close(g); await close(f); }
});

test('BRS02: 256 live targets are bounded and disposed handles free capacity', async () => {
  const f = await scene();
  try {
    assert.equal(typeof f.engine.createBitmapResourceSlot, 'function', 'BITMAP_RESOURCE_SLOT_FACTORY_REQUIRED');
    const targets = Array.from({ length: 257 }, () => f.resources.use(new egret.Bitmap(f.lease)));
    const slots = targets.slice(0, 256).map(bitmap => f.engine.createBitmapResourceSlot(f.scope, bitmap));
    code(() => f.engine.createBitmapResourceSlot(f.scope, targets[256]), 'BITMAP_RESOURCE_LIMIT');
    assert.equal(targets[256].textureLease, f.lease);
    slots[0].dispose();
    f.engine.createBitmapResourceSlot(f.scope, targets[256]).dispose();
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});

test('BRS32: every facade operation authenticates the exact receiver', async () => {
  const f = await scene();
  try {
    assert.equal(typeof f.engine.createBitmapResourceSlot, 'function', 'BITMAP_RESOURCE_SLOT_FACTORY_REQUIRED');
    const slot = f.engine.createBitmapResourceSlot(f.scope, f.bitmap);
    const getState = Object.getOwnPropertyDescriptor(slot, 'state').get;
    for (const receiver of [undefined, {}, new Proxy(slot, {})]) {
      code(() => Reflect.apply(getState, receiver, []), 'BITMAP_RESOURCE_INVALID');
      for (const method of ['replace', 'cancel', 'dispose'])
        code(() => Reflect.apply(slot[method], receiver, [f.ref]), 'BITMAP_RESOURCE_INVALID');
    }
    assert.equal(slot.state, 'idle'); slot.dispose();
  } finally { await close(f); }
});
