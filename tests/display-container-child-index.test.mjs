// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

function capability() { assert.equal(typeof egret.DisplayObjectContainer.prototype.getChildIndex, 'function', 'DISPLAY_CONTAINER_GET_CHILD_INDEX_REQUIRED'); }
function code(action, wanted) { assert.throws(action, cause => cause instanceof egret.EgretError && cause.code === wanted); }
async function withFixture(body) {
  capability();
  const port = host(), diagnostics = [], engine = await egret.createEngine({ host: port.adapter, onDiagnostic: value => diagnostics.push(value) });
  const engines = [{ engine, port }], nodes = [], leases = [], textures = [];
  const f = { engine, port, diagnostics,
    track(node) { nodes.push(node); return node; },
    borrow(lease) { leases.push(lease); return lease; },
    texture(value) { textures.push(value); return value; },
    async foreignEngine() {
      const foreignPort = host(), foreign = await egret.createEngine({ host: foreignPort.adapter });
      engines.push({ engine: foreign, port: foreignPort }); return foreign;
    },
    control() {
      const parent = f.track(new egret.DisplayObjectContainer()), child = f.track(new egret.DisplayObjectContainer());
      parent.addChild(child); engine.stage.addChild(parent); assert.equal(parent.getChildIndex(child), 0);
      return { parent, child };
    },
  };
  let primaryPresent = false, primary;
  const cleanupErrors = [];
  try { await body(f); } catch (cause) { primaryPresent = true; primary = cause; }
  finally {
    // A rejected Engine close must not abandon other Engines, nodes or textures.
    for (const owner of [...engines].reverse()) try { await owner.engine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    for (const node of [...nodes].reverse()) try { node.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    for (const lease of leases) try { lease.release(); } catch (cause) { cleanupErrors.push(cause); }
    for (const texture of textures) try { texture.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    for (const owner of engines) try {
      assert.equal(owner.engine.stage.isDisposed, true); assert.equal(owner.port.timers.size, 0);
      assert.equal(owner.port.trace.filter(value => value === 'stop').length, 1); assert.equal(owner.port.trace.filter(value => value === 'close').length, 1);
    } catch (cause) { cleanupErrors.push(cause); }
  }
  if (cleanupErrors.length) throw new AggregateError(primaryPresent ? [primary, ...cleanupErrors] : cleanupErrors, 'Child-index public fixture cleanup failed');
  if (primaryPresent) throw primary;
}

// Catches cached/descendant indices or a query that silently changes sibling order.
test('CGI01 current direct indices follow existing reorder and reparent operations', async () => withFixture(async f => {
  const root = f.track(new egret.DisplayObjectContainer()), a = f.track(new egret.DisplayObject()), b = f.track(new egret.DisplayObject()), c = f.track(new egret.DisplayObjectContainer());
  const nested = f.track(new egret.DisplayObject()); c.addChild(nested);
  code(() => root.getChildIndex(a), 'NOT_A_CHILD'); root.addChild(a); root.addChild(b); root.addChild(c);
  const retained = [root.getChildAt(0), root.getChildAt(1), root.getChildAt(2)];
  assert.equal(root.getChildIndex(a), 0); assert.equal(root.getChildIndex(b), 1); assert.equal(root.getChildIndex(c), 2);
  root.setChildIndex(c, 0); assert.equal(root.getChildIndex(c), 0); assert.equal(root.getChildIndex(a), 1); assert.equal(root.getChildIndex(b), 2);
  assert.deepEqual([root.getChildAt(0), root.getChildAt(1), root.getChildAt(2)], [c,a,b]); assert.deepEqual(retained, [a,b,c]);
  root.removeChild(a); code(() => root.getChildIndex(a), 'NOT_A_CHILD'); assert.equal(root.getChildIndex(b), 1);
  root.addChild(a); assert.equal(root.getChildIndex(a), 2);
  const other = f.track(new egret.DisplayObjectContainer()); other.addChild(a);
  assert.equal(other.getChildIndex(a), 0); code(() => root.getChildIndex(a), 'NOT_A_CHILD');
  root.addChild(a); assert.equal(root.getChildIndex(a), 2); code(() => other.getChildIndex(a), 'NOT_A_CHILD');
  assert.equal(nested.parent, c); assert.equal(c.getChildIndex(nested), 0);
  root.removeChildren(); code(() => root.getChildIndex(c), 'NOT_A_CHILD'); assert.equal(c.getChildIndex(nested), 0);
  root.addChild(b); root.addChild(c); root.addChild(a); assert.equal(root.getChildIndex(c), 1); assert.equal(root.getChildIndex(a), 2);
}));

// Catches property-based brand checks, -1 sentinels and foreign affinity checks.
test('CGI02 exact registered identities and direct membership refuse without public reads', async () => withFixture(async f => {
  const method = egret.DisplayObjectContainer.prototype.getChildIndex;
  let reads = 0;
  const trap = { get() { reads++; throw new Error('FORGED_DISPLAY_READ'); } };
  for (const makeReceiver of [() => null, () => undefined, () => 4, () => ({}), () => Object.create(egret.DisplayObjectContainer.prototype),
    () => f.track(new egret.DisplayObject()), pair => new Proxy(pair.parent, trap)]) {
    const pair = f.control(); code(() => Reflect.apply(method, makeReceiver(pair), [null]), 'INVALID_DISPLAY_CONTAINER');
    assert.equal(pair.parent.getChildIndex(pair.child), 0); assert.equal(pair.child.parent, pair.parent);
  }
  for (const makeChild of [() => null, () => undefined, () => 7, () => 'child', () => ({}),
    () => Object.create(egret.DisplayObject.prototype), pair => new Proxy(pair.child, trap)]) {
    const pair = f.control(); code(() => pair.parent.getChildIndex(makeChild(pair)), 'INVALID_DISPLAY_OBJECT');
    assert.equal(pair.parent.getChildIndex(pair.child), 0); assert.equal(pair.parent.numChildren, 1);
  }
  const missing = f.control(); code(() => Reflect.apply(method, missing.parent, []), 'INVALID_DISPLAY_OBJECT');
  const foreign = await f.foreignEngine(), foreignChild = f.track(new egret.DisplayObject()); foreign.stage.addChild(foreignChild);
  for (const makeNonmember of [pair => pair.parent, () => f.engine.stage, () => foreignChild,
    () => f.track(new egret.DisplayObject()), pair => { const grandchild = f.track(new egret.DisplayObject()); pair.child.addChild(grandchild); return grandchild; }]) {
    const pair = f.control(); code(() => pair.parent.getChildIndex(makeNonmember(pair)), 'NOT_A_CHILD');
    assert.equal(pair.parent.getChildIndex(pair.child), 0); assert.equal(pair.child.parent, pair.parent);
  }
  assert.equal(foreignChild.parent, foreign.stage); assert.equal(foreignChild.isDisposed, false); assert.equal(reads, 0);
}));

// Catches validation priority changes and consulting another Engine's openness.
test('CGI03 receiver Engine and both lifetimes precede membership and child identity', async () => withFixture(async f => {
  const pair = f.control(); pair.child.dispose(); code(() => pair.parent.getChildIndex(pair.child), 'OBJECT_DISPOSED');
  assert.equal(pair.parent.numChildren, 0);
  const disposed = f.control(); disposed.parent.dispose(); code(() => disposed.parent.getChildIndex(null), 'OBJECT_DISPOSED');
  const unbound = f.track(new egret.DisplayObjectContainer()), live = f.track(new egret.DisplayObject()); unbound.addChild(live);
  assert.equal(unbound.getChildIndex(live), 0); unbound.dispose(); code(() => unbound.getChildIndex(live), 'OBJECT_DISPOSED');
  const foreign = await f.foreignEngine(), foreignChild = f.track(new egret.DisplayObject()); foreign.stage.addChild(foreignChild);
  foreign.stage.removeChild(foreignChild); await foreign.dispose(); assert.equal(foreignChild.isDisposed, false);
  const current = f.control(); code(() => current.parent.getChildIndex(foreignChild), 'NOT_A_CHILD'); assert.equal(current.parent.getChildIndex(current.child), 0);
  await f.engine.dispose(); code(() => current.parent.getChildIndex(null), 'ENGINE_CLOSED');
  code(() => disposed.parent.getChildIndex(disposed.child), 'ENGINE_CLOSED'); code(() => f.engine.stage.getChildIndex(foreignChild), 'ENGINE_CLOSED');
}));

// Catches virtual/public dispatch instead of the existing private tree authority.
test('CGI04 genuine subclasses and own getter shadows supply no query callbacks', async () => withFixture(async f => {
  class ProbeContainer extends egret.DisplayObjectContainer {
    armed = false; calls = 0;
    probe() { if (this.armed) { this.calls++; throw new Error('PUBLIC_CONTAINER_CALLBACK'); } }
    get numChildren() { this.probe(); return super.numChildren; }
    getChildAt(index) { this.probe(); return super.getChildAt(index); }
    assertUsable() { this.probe(); return super.assertUsable(); }
    removeChild(child) { this.probe(); return super.removeChild(child); }
    setChildIndex(child, index) { this.probe(); return super.setChildIndex(child, index); }
    dispose() { this.probe(); return super.dispose(); }
  }
  const root = f.track(new ProbeContainer()), child = f.track(new egret.DisplayObject()); root.addChild(child); f.engine.stage.addChild(root);
  let childReads = 0;
  const descriptor = Object.getOwnPropertyDescriptor(child, 'parent');
  Object.defineProperty(child, 'parent', { configurable: true, get() { childReads++; throw new Error('PUBLIC_CHILD_PARENT'); } });
  root.armed = true;
  try {
    assert.equal(root.getChildIndex(child), 0); assert.equal(root.getChildIndex(child), 0);
    const outsider = f.track(new egret.DisplayObject()); code(() => root.getChildIndex(outsider), 'NOT_A_CHILD');
    assert.equal(root.calls, 0); assert.equal(childReads, 0);
  } finally {
    root.armed = false;
    if (descriptor) Object.defineProperty(child, 'parent', descriptor); else delete child.parent;
  }
  assert.equal(root.numChildren, 1); assert.equal(child.parent, root);
  const sprite = f.track(new egret.Sprite()), nested = f.track(new egret.DisplayObject()); sprite.addChild(nested); f.engine.stage.addChild(sprite);
  assert.equal(sprite.getChildIndex(nested), 0); assert.equal(f.engine.stage.getChildIndex(sprite), 1);
}));

// Catches hidden disposal/release/owner/event/geometry changes during a read query.
test('CGI05 query keeps Scope owners leases listeners and owned frame values unchanged', async () => withFixture(async f => {
  const a = f.engine.createScope(), b = f.engine.createScope();
  const root = a.use(f.track(new egret.DisplayObjectContainer())); f.engine.stage.addChild(root);
  const red = a.use(f.track(new egret.Sprite())); red.x = 2; red.graphics.beginFill(0xff0000).drawRect(0,0,2,2).endFill();
  const texture = f.texture(egret.createTexture(egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([0,0,255,255]) })));
  let loads = 0, disposals = 0, calls = 0;
  const type = egret.createAssetType('child-index-owned-blue', egret.isTexture);
  f.engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
  const lease = b.use(f.borrow(await f.engine.assets.acquire(egret.createAssetRef(type, 'blue'))));
  const bitmap = b.use(f.track(new egret.Bitmap(lease))); bitmap.x = 5; root.addChild(red); root.addChild(bitmap);
  const eventType = egret.createEventType('child-index-live-listener'); bitmap.on(eventType, () => calls++);
  const saved = f.engine.captureFrame({ width: 8, height: 4 });
  const expected = [{ kind:'rect', x:2, width:2 }, { kind:'image', x:5, width:1 }];
  const summarize = frame => frame.commands.map(command => ({ kind:command.kind, x:command.matrix.tx, width:command.rect.width }));
  assert.deepEqual(summarize(saved), expected); assert.equal(saved.images.length, 1);
  const oldCommands = saved.commands, oldImages = saved.images, trace = [...f.port.trace], timers = f.port.timers.size;
  assert.equal(root.getChildIndex(red), 0); assert.equal(root.getChildIndex(bitmap), 1); assert.equal(root.getChildIndex(red), 0);
  const outsider = f.track(new egret.DisplayObject()); code(() => root.getChildIndex(outsider), 'NOT_A_CHILD');
  assert.equal(root.getChildAt(0), red); assert.equal(root.getChildAt(1), bitmap); assert.equal(root.numChildren, 2);
  assert.equal(red.parent, root); assert.equal(bitmap.parent, root); assert.equal(root.isDisposed, false); assert.equal(bitmap.isDisposed, false);
  assert.equal(a.state, 'open'); assert.equal(b.state, 'open'); assert.equal(lease.value, texture); assert.equal(loads, 1); assert.equal(disposals, 0); assert.equal(calls, 0);
  assert.deepEqual(f.port.trace, trace); assert.equal(f.port.timers.size, timers);
  code(() => a.use(bitmap), 'OWNERSHIP_CONFLICT'); assert.equal(root.getChildIndex(bitmap), 1);
  bitmap.dispatchEvent(new egret.Event(eventType, null)); assert.equal(calls, 1);
  assert.deepEqual(summarize(f.engine.captureFrame({ width: 8, height: 4 })), expected);
  b.dispose(); assert.equal(disposals, 1); assert.equal(texture.isDisposed, true); code(() => lease.value, 'ASSET_LEASE_RELEASED');
  assert.equal(bitmap.isDisposed, true); assert.equal(root.numChildren, 1); code(() => root.getChildIndex(bitmap), 'OBJECT_DISPOSED');
  assert.equal(saved.commands, oldCommands); assert.equal(saved.images, oldImages); assert.deepEqual(summarize(saved), expected);
  assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])], [0,0,255,255]); assert.equal(Object.isFrozen(saved), true);
  assert.deepEqual(f.diagnostics, []);
}));
