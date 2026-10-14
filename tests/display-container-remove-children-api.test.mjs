// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// The genuine old single-child API, resource borrow and cleanup precede RED.
test('DCA00 old single detach baseline precedes the named missing batch member', async () => {
  const port = host(), engine = await egret.createEngine({ host: port.adapter });
  let scope, root, child, texture, lease, loads = 0, disposals = 0, calls = 0;
  let primaryPresent = false, primary;
  const cleanupErrors = [];
  try {
    scope = engine.createScope(); root = new egret.DisplayObjectContainer(); scope.use(root); engine.stage.addChild(root);
    texture = egret.createTexture(egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255,0,0,255]) }));
    const type = egret.createAssetType('detach-all-old-texture', egret.isTexture);
    engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
    lease = await engine.assets.acquire(egret.createAssetRef(type, 'red')); scope.use(lease);
    child = new egret.Bitmap(lease); scope.use(child); root.addChild(child);
    const eventType = egret.createEventType('detach-all-old-live'); child.on(eventType, () => calls++);
    assert.equal(root.removeChild(child), child); assert.equal(child.parent, undefined); assert.equal(child.isDisposed, false);
    child.dispatchEvent(new egret.Event(eventType, null)); assert.equal(calls, 1);
    assert.equal(lease.value, texture); assert.equal(root.addChild(child), child);
    assert.equal(root.getChildAt(0), child); assert.equal(root.numChildren, 1);
    assert.deepEqual(engine.captureFrame({ width: 2, height: 2 }).commands.map(value => value.kind), ['image']);
  } catch (cause) { primaryPresent = true; primary = cause; }
  finally {
    for (const action of [() => scope?.dispose(), () => child?.dispose(), () => lease?.release(), () => root?.dispose()]) {
      try { action(); } catch (cause) { cleanupErrors.push(cause); }
    }
    try { await engine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    const managedDisposed = texture?.isDisposed;
    try { texture?.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    if (!primaryPresent) {
      assert.equal(loads, 1); assert.equal(disposals, 1); assert.equal(managedDisposed, true);
      assert.equal(scope.state, 'closed'); assert.equal(child.isDisposed, true); assert.equal(engine.stage.isDisposed, true);
      assert.equal(port.timers.size, 0); assert.equal(port.trace.filter(value => value === 'close').length, 1);
    }
  }
  if (cleanupErrors.length) throw new AggregateError(primaryPresent ? [primary, ...cleanupErrors] : cleanupErrors, 'Old baseline cleanup failed');
  if (primaryPresent) throw primary;
  assert.equal(typeof egret.DisplayObjectContainer.prototype.removeChildren, 'function', 'DISPLAY_CONTAINER_REMOVE_CHILDREN_REQUIRED');
  assert.equal('removeChildren' in egret, false, 'the operation is an existing-class member');
});
