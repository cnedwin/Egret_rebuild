// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

function capability() { assert.equal(typeof egret.DisplayObjectContainer.prototype.removeChildren, 'function', 'DISPLAY_CONTAINER_REMOVE_CHILDREN_REQUIRED'); }
function code(action, wanted) { assert.throws(action, value => value instanceof egret.EgretError && value.code === wanted); }
async function fixture() {
  capability();
  const port = host(), diagnostics = [], nodes = [], leases = [];
  const engine = await egret.createEngine({ host: port.adapter, onDiagnostic: value => diagnostics.push(value) });
  return { engine, diagnostics, port,
    track(node) { nodes.push(node); return node; },
    borrow(lease) { leases.push(lease); return lease; },
    async close() {
      const errors = [];
      try { await engine.dispose(); } catch (cause) { errors.push(cause); }
      for (const node of [...nodes].reverse()) try { node.dispose(); } catch (cause) { errors.push(cause); }
      for (const lease of leases) try { lease.release(); } catch (cause) { errors.push(cause); }
      assert.equal(engine.stage.isDisposed, true); assert.equal(port.timers.size, 0);
      assert.equal(port.trace.filter(value => value === 'stop').length, 1);
      assert.equal(port.trace.filter(value => value === 'close').length, 1);
      if (errors.length) throw new AggregateError(errors, 'Batch-detach public fixture cleanup failed');
    },
  };
}

// Actual objects and caller-retained references supply the model, never a children field.
test('DCA01 empty/repeated batch detaches ordered direct children and keeps the nested subtree', async () => {
  const f = await fixture();
  try {
    const scope = f.engine.createScope(), root = scope.use(f.track(new egret.DisplayObjectContainer()));
    f.engine.stage.addChild(root); assert.equal(root.removeChildren(), undefined); assert.equal(root.numChildren, 0);
    const first = scope.use(f.track(new egret.DisplayObject()));
    const nested = scope.use(f.track(new egret.DisplayObjectContainer()));
    const last = scope.use(f.track(new egret.DisplayObject()));
    const grandchild = scope.use(f.track(new egret.DisplayObject()));
    root.addChild(first); root.addChild(nested); root.addChild(last); nested.addChild(grandchild);
    const retained = [root.getChildAt(0), root.getChildAt(1), root.getChildAt(2)];
    assert.equal(root.removeChildren(), undefined); assert.equal(root.removeChildren(), undefined);
    assert.equal(root.numChildren, 0); assert.deepEqual(retained, [first, nested, last]);
    for (const node of retained) { assert.equal(node.parent, undefined); assert.equal(node.isDisposed, false); }
    assert.equal(grandchild.parent, nested); assert.equal(nested.getChildAt(0), grandchild); assert.equal(grandchild.isDisposed, false);
    code(() => root.getChildAt(0), 'INVALID_INDEX');
    for (const node of retained) assert.equal(root.addChild(node), node);
    assert.equal(root.getChildAt(1), nested); assert.equal(root.removeChild(last), last);
    root.setChildIndex(nested, 0); assert.equal(root.getChildAt(0), nested);
    assert.equal(root.removeChildren('ignored'), undefined); assert.equal(root.numChildren, 0);
    assert.deepEqual(f.diagnostics, []);
  } finally { await f.close(); }
});

test('DCA02 detachment preserves two Scope owners and a genuine Texture lease', async () => {
  const f = await fixture(), foreignEngine = await egret.createEngine({ host: host().adapter });
  let texture, loads = 0, disposals = 0;
  try {
    const a = f.engine.createScope(), b = f.engine.createScope();
    const root = a.use(f.track(new egret.DisplayObjectContainer())); f.engine.stage.addChild(root);
    texture = egret.createTexture(egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([0,0,255,255]) }));
    const type = egret.createAssetType('detach-all-owned-texture', egret.isTexture);
    f.engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
    const lease = f.borrow(await f.engine.assets.acquire(egret.createAssetRef(type, 'blue'))); b.use(lease);
    const child = b.use(f.track(new egret.DisplayObjectContainer())); root.addChild(child);
    const bitmap = b.use(f.track(new egret.Bitmap(lease))); child.addChild(bitmap);
    root.removeChildren(); assert.equal(child.parent, undefined); assert.equal(bitmap.parent, child);
    assert.equal(child.isDisposed, false); assert.equal(bitmap.isDisposed, false); assert.equal(lease.value, texture); assert.equal(disposals, 0);
    a.dispose(); assert.equal(root.isDisposed, true); assert.equal(child.isDisposed, false); assert.equal(lease.value, texture);
    const replacement = f.track(new egret.DisplayObjectContainer()); f.engine.stage.addChild(replacement); replacement.addChild(child);
    code(() => foreignEngine.stage.addChild(child), 'ENGINE_MISMATCH'); assert.equal(child.parent, replacement);
    b.dispose(); assert.equal(child.isDisposed, true); assert.equal(bitmap.isDisposed, true);
    assert.equal(loads, 1); assert.equal(disposals, 1); code(() => lease.value, 'ASSET_LEASE_RELEASED');
    assert.deepEqual(f.diagnostics, []);
  } finally {
    // Attempt every independent owner even if an earlier cleanup rejects.
    const cleanupErrors = [];
    try { await f.close(); } catch (cause) { cleanupErrors.push(cause); }
    try { await foreignEngine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    let managedDisposed;
    try { managedDisposed = texture?.isDisposed; } catch (cause) { cleanupErrors.push(cause); }
    try { texture?.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    try { if (texture) assert.equal(managedDisposed, true); } catch (cause) { cleanupErrors.push(cause); }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'DCA02 owner cleanup failed');
  }
});

test('DCA03 receiver identity/lifetime refuses without changing the existing tree', async () => {
  const f = await fixture();
  try {
    const clear = egret.DisplayObjectContainer.prototype.removeChildren;
    const root = f.track(new egret.DisplayObjectContainer()), child = f.track(new egret.DisplayObject());
    root.addChild(child); assert.equal(root.removeChildren(), undefined); root.addChild(child); // Genuine unbound control.
    let reads = 0;
    const fake = new Proxy({}, { get() { reads++; throw new Error('untrusted public getter'); } });
    for (const receiver of [child, fake, Object.create(egret.DisplayObjectContainer.prototype), new Proxy(root, {})]) {
      code(() => clear.call(receiver), 'INVALID_DISPLAY_CONTAINER');
      assert.equal(root.numChildren, 1); assert.equal(child.parent, root);
    }
    assert.equal(reads, 0);
    const dead = f.track(new egret.DisplayObjectContainer()); dead.dispose(); code(() => dead.removeChildren(), 'OBJECT_DISPOSED');
    f.engine.stage.addChild(root); f.engine.stage.removeChild(root);
    await f.engine.dispose(); // Detached, unowned root/child retain identity but the affiliated Engine is closed.
    code(() => root.removeChildren(), 'ENGINE_CLOSED'); assert.equal(root.numChildren, 1); assert.equal(child.parent, root);
    root.dispose(); code(() => root.removeChildren(), 'ENGINE_CLOSED'); assert.equal(root.numChildren, 0);
    code(() => f.engine.stage.removeChildren(), 'ENGINE_CLOSED');
  } finally { await f.close(); }
});

test('DCA04 the private batch calls no public getters, virtual removal or cleanup hooks', async () => {
  const f = await fixture();
  let armed = false, callbacks = 0;
  class GuardedContainer extends egret.DisplayObjectContainer {
    assertUsable() { if (armed) { callbacks++; throw new Error('virtual receiver hook'); } super.assertUsable(); }
  }
  class GuardedChild extends egret.DisplayObject {
    dispose() { if (armed) { callbacks++; throw new Error('child cleanup hook'); } super.dispose(); }
  }
  const restore = [];
  try {
    const root = f.track(new GuardedContainer()), child = f.track(new GuardedChild());
    f.engine.stage.addChild(root); root.addChild(child);
    const eventType = egret.createEventType('detach-all-child-live'); let events = 0; child.on(eventType, () => events++);
    for (const name of ['numChildren', 'getChildAt', 'removeChild']) {
      const prior = Object.getOwnPropertyDescriptor(root, name); restore.push([root, name, prior]);
      Object.defineProperty(root, name, { configurable: true, get() { callbacks++; throw new Error('public path ' + name); } });
    }
    armed = true; root.removeChildren(); armed = false;
    assert.equal(callbacks, 0); assert.equal(child.parent, undefined); assert.equal(child.isDisposed, false);
    assert.equal(Object.getOwnPropertyDescriptor(egret.DisplayObjectContainer.prototype, 'numChildren').get.call(root), 0);
    child.dispatchEvent(new egret.Event(eventType, null)); assert.equal(events, 1);
  } finally {
    armed = false;
    for (const [object, name, prior] of restore.reverse()) {
      if (prior) Object.defineProperty(object, name, prior); else assert.equal(Reflect.deleteProperty(object, name), true);
    }
    await f.close();
  }
});

test('DCA05 new bounds/hit/capture omit detached subtrees while saved values stay owned', async () => {
  const f = await fixture();
  let before;
  try {
    const scope = f.engine.createScope(), layer = scope.use(f.track(new egret.Sprite()));
    layer.x = 2; layer.y = 3; f.engine.stage.addChild(layer);
    const red = scope.use(f.track(new egret.Sprite())); red.graphics.beginFill(0xff0000).drawRect(0,0,4,4);
    red.touchEnabled = true; red.hitArea = { x: 0, y: 0, width: 4, height: 4 }; layer.addChild(red);
    const nested = scope.use(f.track(new egret.DisplayObjectContainer())); nested.x = 6; layer.addChild(nested);
    const blue = scope.use(f.track(new egret.Sprite())); blue.graphics.beginFill(0x0000ff).drawRect(0,0,2,2); nested.addChild(blue);
    before = f.engine.captureFrame({ width: 12, height: 8 });
    assert.deepEqual(before.commands.map(value => value.color), [0xff0000, 0x0000ff]);
    assert.deepEqual(before.commands.map(value => value.matrix), [{ a:1,b:0,c:0,d:1,tx:2,ty:3 }, { a:1,b:0,c:0,d:1,tx:8,ty:3 }]);
    assert.deepEqual(layer.getBounds(), { x:0,y:0,width:8,height:4 }); assert.equal(f.engine.stage.hitTest(3,4), red);
    layer.removeChildren(); assert.equal(red.parent, undefined); assert.equal(nested.parent, undefined); assert.equal(blue.parent, nested);
    assert.deepEqual(layer.getBounds(), { x:0,y:0,width:0,height:0 }); assert.deepEqual(red.getBounds(), { x:0,y:0,width:4,height:4 });
    assert.equal(f.engine.stage.hitTest(3,4), undefined); assert.deepEqual(f.engine.captureFrame({ width:12,height:8 }).commands, []);
    assert.equal(layer.x, 2); assert.equal(layer.y, 3);
    const replacement = scope.use(f.track(new egret.Sprite())); replacement.graphics.beginFill(0x00ff00).drawRect(0,0,1,1);
    layer.addChild(replacement); assert.deepEqual(f.engine.captureFrame({ width:12,height:8 }).commands.map(value => value.color), [0x00ff00]);
    layer.graphics.beginFill(0x123456).drawRect(0,0,1,1);
    layer.removeChildren();
    assert.deepEqual(f.engine.captureFrame({ width:12,height:8 }).commands.map(value => value.color), [0x123456]);
    assert.deepEqual(f.diagnostics, []);
  } finally { await f.close(); }
  assert.deepEqual(before.commands.map(value => value.color), [0xff0000, 0x0000ff]);
  assert.deepEqual(before.commands.map(value => value.matrix), [{ a:1,b:0,c:0,d:1,tx:2,ty:3 }, { a:1,b:0,c:0,d:1,tx:8,ty:3 }]);
});
