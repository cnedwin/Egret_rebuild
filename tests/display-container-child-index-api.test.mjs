// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Genuine existing reorder/detach/resource operations and cleanup precede RED.
test('CGI00 old ordered-child baseline precedes the named missing index query', async () => {
  const port = host(), engine = await egret.createEngine({ host: port.adapter });
  let scope, root, bitmap, leaf, texture, lease, loads = 0, disposals = 0, calls = 0;
  let primaryPresent = false, primary, managedDisposed;
  const cleanupErrors = [];
  try {
    scope = engine.createScope(); root = scope.use(new egret.DisplayObjectContainer()); engine.stage.addChild(root);
    texture = egret.createTexture(egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([0,0,255,255]) }));
    const type = egret.createAssetType('child-index-old-blue', egret.isTexture);
    engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
    lease = await engine.assets.acquire(egret.createAssetRef(type, 'blue')); scope.use(lease);
    bitmap = scope.use(new egret.Bitmap(lease)); leaf = scope.use(new egret.DisplayObject());
    root.addChild(leaf); root.addChild(bitmap);
    assert.equal(root.numChildren, 2); assert.equal(root.getChildAt(0), leaf); assert.equal(root.getChildAt(1), bitmap);
    root.setChildIndex(bitmap, 0); assert.equal(root.getChildAt(0), bitmap); assert.equal(root.getChildAt(1), leaf);
    const eventType = egret.createEventType('child-index-old-listener'); bitmap.on(eventType, () => calls++);
    assert.equal(root.removeChild(bitmap), bitmap); assert.equal(bitmap.parent, undefined); assert.equal(bitmap.isDisposed, false);
    bitmap.dispatchEvent(new egret.Event(eventType, null)); assert.equal(calls, 1); assert.equal(lease.value, texture);
    root.addChild(bitmap); assert.equal(root.getChildAt(0), leaf); assert.equal(root.getChildAt(1), bitmap);
    const saved = engine.captureFrame({ width: 2, height: 2 });
    assert.deepEqual(saved.commands.map(command => command.kind), ['image']); assert.equal(saved.images.length, 1);
  } catch (cause) { primaryPresent = true; primary = cause; }
  finally {
    // Each independent cleanup attempt runs even if a previous operation rejects.
    for (const action of [() => scope?.dispose(), () => bitmap?.dispose(), () => leaf?.dispose(), () => lease?.release(), () => root?.dispose()]) {
      try { action(); } catch (cause) { cleanupErrors.push(cause); }
    }
    try { await engine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    try { managedDisposed = texture?.isDisposed; } catch (cause) { cleanupErrors.push(cause); }
    try { texture?.dispose(); } catch (cause) { cleanupErrors.push(cause); }
  }
  if (cleanupErrors.length) throw new AggregateError(primaryPresent ? [primary, ...cleanupErrors] : cleanupErrors, 'Old index baseline cleanup failed');
  if (primaryPresent) throw primary;
  assert.equal(loads, 1); assert.equal(disposals, 1); assert.equal(managedDisposed, true);
  assert.equal(scope.state, 'closed'); assert.equal(bitmap.isDisposed, true); assert.equal(leaf.isDisposed, true);
  assert.equal(engine.stage.isDisposed, true); assert.equal(port.timers.size, 0);
  assert.equal(port.trace.filter(value => value === 'stop').length, 1); assert.equal(port.trace.filter(value => value === 'close').length, 1);
  assert.equal(typeof egret.DisplayObjectContainer.prototype.getChildIndex, 'function', 'DISPLAY_CONTAINER_GET_CHILD_INDEX_REQUIRED');
  assert.equal('getChildIndex' in egret, false, 'the query belongs to the existing class');
});
