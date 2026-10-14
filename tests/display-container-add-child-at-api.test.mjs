// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// A genuine old-API/resource/cleanup baseline finishes before the named member check.
test('ADI00 genuine add reorder remove resource and cleanup precede missing-member RED', async () => {
  const port = host(), engine = await egret.createEngine({ host: port.adapter });
  let scope, root, first, bitmap, texture, lease, loads = 0, disposals = 0;
  let primaryPresent = false, primary;
  const cleanupErrors = [];
  try {
    scope = engine.createScope();
    root = scope.use(new egret.DisplayObjectContainer()); engine.stage.addChild(root);
    first = scope.use(new egret.DisplayObject()); root.addChild(first);
    texture = egret.createTexture(egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([0,0,255,255]) }));
    const type = egret.createAssetType('add-child-at-old-api-blue', egret.isTexture);
    engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
    lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'blue')));
    bitmap = scope.use(new egret.Bitmap(lease));
    assert.equal(root.addChild(bitmap), bitmap); root.setChildIndex(bitmap, 0);
    assert.equal(root.getChildAt(0), bitmap); assert.equal(root.getChildIndex(first), 1);
    assert.equal(root.removeChild(first), first); assert.equal(first.parent, undefined); assert.equal(first.isDisposed, false);
    assert.equal(root.addChild(first), first); assert.equal(root.numChildren, 2);
    assert.deepEqual(engine.captureFrame({ width: 2, height: 2 }).commands.map(value => value.kind), ['image']);
    root.removeChildren(); assert.equal(root.numChildren, 0); assert.equal(bitmap.parent, undefined);
    assert.equal(bitmap.textureLease, lease); assert.equal(lease.value, texture); assert.equal(disposals, 0);
    root.addChild(first); root.addChild(bitmap);
  } catch (cause) { primaryPresent = true; primary = cause; }
  finally {
    for (const action of [() => scope?.dispose(), () => bitmap?.dispose(), () => first?.dispose(), () => lease?.release(), () => root?.dispose()]) {
      try { action(); } catch (cause) { cleanupErrors.push(cause); }
    }
    try { await engine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    const managedDisposed = texture?.isDisposed;
    try { texture?.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    if (!primaryPresent) {
      try {
        assert.equal(loads, 1); assert.equal(disposals, 1); assert.equal(managedDisposed, true);
        assert.equal(scope.state, 'closed'); assert.equal(first.isDisposed, true); assert.equal(bitmap.isDisposed, true);
        assert.equal(engine.stage.isDisposed, true); assert.equal(port.timers.size, 0);
        assert.equal(port.trace.filter(value => value === 'stop').length, 1); assert.equal(port.trace.filter(value => value === 'close').length, 1);
      } catch (cause) { cleanupErrors.push(cause); }
    }
  }
  if (cleanupErrors.length) throw new AggregateError(primaryPresent ? [primary, ...cleanupErrors] : cleanupErrors, 'ADI00 old baseline cleanup failed');
  if (primaryPresent) throw primary;
  assert.equal(typeof egret.DisplayObjectContainer.prototype.addChildAt, 'function', 'DISPLAY_CONTAINER_ADD_CHILD_AT_REQUIRED');
  assert.equal('addChildAt' in egret, false, 'indexed insertion is an inherited existing-class member');
});
