// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

function capability() { assert.equal(typeof egret.DisplayObjectContainer.prototype.addChildAt, 'function', 'DISPLAY_CONTAINER_ADD_CHILD_AT_REQUIRED'); }
function code(action, wanted) { assert.throws(action, cause => cause instanceof egret.EgretError && cause.code === wanted); }
const container = egret.DisplayObjectContainer.prototype;
const count = Object.getOwnPropertyDescriptor(container, 'numChildren').get;
const parent = Object.getOwnPropertyDescriptor(egret.DisplayObject.prototype, 'parent').get;
function order(receiver, expected) {
  assert.equal(count.call(receiver), expected.length);
  expected.forEach((child, index) => {
    assert.equal(container.getChildAt.call(receiver, index), child);
    assert.equal(parent.call(child), receiver);
  });
}
class HookContainer extends egret.DisplayObjectContainer {
  next; calls = 0;
  assertUsable() {
    super.assertUsable(); this.calls++;
    const action = this.next; this.next = undefined; action?.();
  }
}
class HookNode extends egret.DisplayObject {
  next; calls = 0;
  assertUsable() {
    super.assertUsable(); this.calls++;
    const action = this.next; this.next = undefined; action?.();
  }
}
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
  };
  let primaryPresent = false, primary;
  const cleanupErrors = [];
  try { await body(f); } catch (cause) { primaryPresent = true; primary = cause; }
  finally {
    for (const node of nodes) if (node instanceof HookContainer || node instanceof HookNode) node.next = undefined;
    for (const owner of [...engines].reverse()) try { await owner.engine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    for (const node of [...nodes].reverse()) try { node.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    for (const lease of leases) try { lease.release(); } catch (cause) { cleanupErrors.push(cause); }
    for (const texture of textures) try { texture.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    for (const owner of engines) try {
      assert.equal(owner.engine.stage.isDisposed, true); assert.equal(owner.port.timers.size, 0);
      assert.equal(owner.port.trace.filter(value => value === 'stop').length, 1);
      assert.equal(owner.port.trace.filter(value => value === 'close').length, 1);
    } catch (cause) { cleanupErrors.push(cause); }
  }
  if (cleanupErrors.length) throw new AggregateError(primaryPresent ? [primary, ...cleanupErrors] : cleanupErrors, 'Indexed insertion public fixture cleanup failed');
  if (primaryPresent) throw primary;
}

test('ADI01 detached insertion at zero middle n and negative zero returns exact subtypes', async () => withFixture(async f => {
  class Panel extends egret.Sprite { panelTag = 'panel'; }
  const root = f.track(new egret.DisplayObjectContainer()), a = f.track(new egret.DisplayObject());
  const b = f.track(new egret.Sprite()), c = f.track(new Panel()), d = f.track(new egret.DisplayObject());
  assert.equal(root.addChildAt(a, 0), a); order(root, [a]);
  assert.equal(root.addChildAt(b, -0), b); order(root, [b,a]);
  assert.equal(root.addChildAt(c, 1), c); order(root, [b,c,a]); assert.equal(c.panelTag, 'panel');
  assert.equal(root.addChildAt(d, 3), d); order(root, [b,c,a,d]);
  assert.equal(f.engine.stage.addChildAt(root, 0), root); order(f.engine.stage, [root]);
  const nested = f.track(new egret.DisplayObject()); assert.equal(c.addChildAt(nested, 0), nested); order(c, [nested]);
  assert.deepEqual(f.diagnostics, []);
}));

test('ADI02 same-parent indices are final positions and n is an append alias', async () => withFixture(async f => {
  const root = f.track(new egret.DisplayObjectContainer()), a = f.track(new egret.DisplayObject());
  const b = f.track(new egret.DisplayObject()), c = f.track(new egret.DisplayObject());
  root.addChild(a); root.addChild(b); root.addChild(c);
  assert.equal(root.addChildAt(a, 1), a); order(root, [b,a,c]);
  assert.equal(root.addChildAt(a, 3), a); order(root, [b,c,a]);
  assert.equal(root.addChildAt(a, 0), a); order(root, [a,b,c]);
  assert.equal(root.addChildAt(b, 2), b); order(root, [a,c,b]);
  assert.equal(root.addChildAt(c, 1), c); order(root, [a,c,b]);
  assert.equal(root.addChildAt(b, 3), b); order(root, [a,c,b]);
  const only = f.track(new egret.DisplayObjectContainer()), leaf = f.track(new egret.DisplayObject());
  only.addChild(leaf); assert.equal(only.addChildAt(leaf, 1), leaf); order(only, [leaf]);
}));

test('ADI03 same-Engine reparent preserves both sibling lists and the complete subtree', async () => withFixture(async f => {
  const source = f.track(new egret.DisplayObjectContainer()), target = f.track(new egret.DisplayObjectContainer());
  const a = f.track(new egret.DisplayObject()), branch = f.track(new egret.DisplayObjectContainer()), c = f.track(new egret.DisplayObject());
  const x = f.track(new egret.DisplayObject()), y = f.track(new egret.DisplayObject()), leaf = f.track(new egret.DisplayObject());
  branch.addChild(leaf); source.addChild(a); source.addChild(branch); source.addChild(c); target.addChild(x); target.addChild(y);
  f.engine.stage.addChild(source); f.engine.stage.addChild(target);
  assert.equal(target.addChildAt(branch, 1), branch); order(source, [a,c]); order(target, [x,branch,y]); order(branch, [leaf]);
  assert.equal(source.addChildAt(branch, 2), branch); order(source, [a,c,branch]); order(target, [x,y]); order(branch, [leaf]);
  target.addChildAt(branch, 0); order(source, [a,c]); order(target, [branch,x,y]);
  for (const value of [source,target,a,branch,c,x,y,leaf]) assert.equal(value.isDisposed, false);
}));

test('ADI04 fully unbound nested trees gain no affinity before a later chosen Engine', async () => withFixture(async f => {
  const other = await f.foreignEngine();
  for (const chosen of [f.engine, other]) {
    const root = f.track(new egret.DisplayObjectContainer()), existing = f.track(new egret.DisplayObjectContainer());
    const branch = f.track(new egret.DisplayObjectContainer()), oldLeaf = f.track(new egret.DisplayObject()), newLeaf = f.track(new egret.DisplayObject());
    existing.addChild(oldLeaf); branch.addChild(newLeaf); root.addChild(existing);
    root.addChildAt(branch, 0); order(root, [branch,existing]); order(existing, [oldLeaf]); order(branch, [newLeaf]);
    chosen.stage.addChild(root); order(root, [branch,existing]);
    chosen.stage.removeChild(root); root.removeChild(branch);
    const conflicting = chosen === f.engine ? other : f.engine;
    code(() => conflicting.stage.addChildAt(branch, 0), 'ENGINE_MISMATCH');
    assert.equal(branch.parent, undefined); order(branch, [newLeaf]); order(root, [existing]);
    chosen.stage.addChildAt(branch, chosen.stage.numChildren);
  }
}));

test('ADI05 invalid indices do not coerce invoke hooks move edges or bind a free child', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), existing = f.track(new egret.DisplayObject()), incoming = f.track(new HookNode());
  root.addChild(existing); f.engine.stage.addChild(root);
  const source = f.track(new egret.DisplayObjectContainer()); source.addChild(incoming);
  let coercions = 0;
  const boxed = new Number(0), coercible = { valueOf() { coercions++; return 0; }, toString() { coercions++; return '0'; } };
  const indices = [-1, 2, 0.5, NaN, Infinity, -Infinity, '0', boxed, coercible, null, undefined, 0n, Symbol('index')];
  const rootCalls = root.calls, childCalls = incoming.calls;
  for (const index of indices) {
    code(() => root.addChildAt(incoming, index), 'INVALID_INDEX'); order(root, [existing]); order(source, [incoming]);
    assert.equal(root.calls, rootCalls); assert.equal(incoming.calls, childCalls); assert.equal(incoming.isDisposed, false);
  }
  assert.equal(coercions, 0);
  const other = await f.foreignEngine(); assert.equal(other.stage.addChildAt(source, 0), source); order(source, [incoming]);
}));

test('ADI06 authenticate fake receivers and children without reading proxy properties', async () => withFixture(async f => {
  const method = container.addChildAt, root = f.track(new egret.DisplayObjectContainer()), child = f.track(new egret.DisplayObject());
  root.addChild(child); let reads = 0;
  const trap = { get() { reads++; throw new Error('UNTRUSTED_DISPLAY_READ'); } };
  for (const receiver of [null, undefined, 0, {}, child, Object.create(container), new Proxy(root, trap)]) {
    code(() => Reflect.apply(method, receiver, [null, -1]), 'INVALID_DISPLAY_CONTAINER'); order(root, [child]);
  }
  for (const value of [null, undefined, 0, 'child', {}, Object.create(egret.DisplayObject.prototype), new Proxy(child, trap)]) {
    code(() => root.addChildAt(value, -1), 'INVALID_DISPLAY_OBJECT'); order(root, [child]);
  }
  code(() => Reflect.apply(method, root, []), 'INVALID_DISPLAY_OBJECT'); assert.equal(reads, 0);
}));

test('ADI07 lifetime Stage cycle and index refusal priorities use genuine current identities', async () => withFixture(async f => {
  const root = f.track(new egret.DisplayObjectContainer()), branch = f.track(new egret.DisplayObjectContainer()), child = f.track(new egret.DisplayObject());
  root.addChild(branch); branch.addChild(child);
  code(() => root.addChildAt(root, -1), 'DISPLAY_CYCLE'); code(() => branch.addChildAt(root, -1), 'DISPLAY_CYCLE');
  code(() => root.addChildAt(f.engine.stage, -1), 'STAGE_ROOT_ONLY'); order(root, [branch]); order(branch, [child]);
  const dead = f.track(new egret.DisplayObject()); dead.dispose(); code(() => root.addChildAt(dead, -1), 'OBJECT_DISPOSED');
  const deadRoot = f.track(new egret.DisplayObjectContainer()); deadRoot.dispose(); code(() => deadRoot.addChildAt(null, -1), 'OBJECT_DISPOSED');
  const other = await f.foreignEngine(); await other.dispose(); code(() => root.addChildAt(other.stage, -1), 'ENGINE_CLOSED');
  f.engine.stage.addChild(root); f.engine.stage.removeChild(root); await f.engine.dispose();
  code(() => root.addChildAt(null, -1), 'ENGINE_CLOSED'); order(root, [branch]); order(branch, [child]);
  root.dispose(); code(() => root.addChildAt(null, -1), 'ENGINE_CLOSED');
  code(() => f.engine.stage.addChildAt(null, -1), 'ENGINE_CLOSED');
}));

test('ADI08 same-position insertion still executes hooks and final lifetime validation', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), child = f.track(new HookNode()); root.addChild(child); f.engine.stage.addChild(root);
  const beforeRoot = root.calls, beforeChild = child.calls;
  assert.equal(root.addChildAt(child, 0), child); order(root, [child]); assert.ok(root.calls > beforeRoot); assert.ok(child.calls > beforeChild);
  root.next = () => child.dispose();
  code(() => root.addChildAt(child, 0), 'OBJECT_DISPOSED'); order(root, []); assert.equal(child.isDisposed, true); assert.equal(child.parent, undefined);
}));

test('ADI09 callback count shrink preserves its removal and adds no outer binding', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), a = f.track(new egret.DisplayObject()), b = f.track(new egret.DisplayObject());
  const source = f.track(new egret.DisplayObjectContainer()), incoming = f.track(new egret.DisplayObjectContainer()), leaf = f.track(new egret.DisplayObject());
  incoming.addChild(leaf); source.addChild(incoming); root.addChild(a); root.addChild(b); f.engine.stage.addChild(root);
  root.next = () => root.removeChild(b);
  code(() => root.addChildAt(incoming, 2), 'INVALID_INDEX');
  order(root, [a]); order(source, [incoming]); order(incoming, [leaf]); assert.equal(b.parent, undefined); assert.equal(b.isDisposed, false);
  const other = await f.foreignEngine(); other.stage.addChild(source); order(source, [incoming]);
}));

test('ADI10 callback growth and reparent use the current source list and current count', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), oldSource = f.track(new egret.DisplayObjectContainer()), currentSource = f.track(new egret.DisplayObjectContainer());
  const a = f.track(new egret.DisplayObject()), extra = f.track(new egret.DisplayObject()), child = f.track(new egret.DisplayObjectContainer());
  const left = f.track(new egret.DisplayObject()), right = f.track(new egret.DisplayObject()), leaf = f.track(new egret.DisplayObject());
  child.addChild(leaf); root.addChild(a); oldSource.addChild(left); oldSource.addChild(child); oldSource.addChild(right);
  const cLeft = f.track(new egret.DisplayObject()), cRight = f.track(new egret.DisplayObject()); currentSource.addChild(cLeft); currentSource.addChild(cRight);
  f.engine.stage.addChild(root); f.engine.stage.addChild(oldSource); f.engine.stage.addChild(currentSource);
  root.next = () => { root.addChild(extra); currentSource.addChild(child); currentSource.setChildIndex(child, 1); };
  assert.equal(root.addChildAt(child, 1), child);
  order(root, [a,child,extra]); order(oldSource, [left,right]); order(currentSource, [cLeft,cRight]); order(child, [leaf]);
}));

test('ADI11 thrown preflight value propagates unchanged and keeps genuine hook-owned writes', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), source = f.track(new egret.DisplayObjectContainer());
  const child = f.track(new egret.DisplayObject()), sibling = f.track(new egret.DisplayObject()), added = f.track(new egret.DisplayObject());
  root.addChild(sibling); source.addChild(child); f.engine.stage.addChild(root);
  const sentinel = { tag: 'original-hook-thrown-value' };
  root.next = () => { root.addChild(added); throw sentinel; };
  assert.throws(() => root.addChildAt(child, 0), cause => cause === sentinel);
  order(root, [sibling,added]); order(source, [child]); assert.equal(child.isDisposed, false);
  const other = await f.foreignEngine(); other.stage.addChild(source); order(source, [child]);
}));

test('ADI12 callback disposal of current child or receiver remains terminal', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), source = f.track(new egret.DisplayObjectContainer());
  const child = f.track(new HookNode()), left = f.track(new egret.DisplayObject()), right = f.track(new egret.DisplayObject());
  source.addChild(left); source.addChild(child); source.addChild(right); f.engine.stage.addChild(root);
  child.next = () => child.dispose();
  code(() => root.addChildAt(child, 0), 'OBJECT_DISPOSED'); order(root, []); order(source, [left,right]);
  assert.equal(child.parent, undefined); assert.equal(child.isDisposed, true);
  const otherRoot = f.track(new HookContainer()), existing = f.track(new egret.DisplayObject()), free = f.track(new egret.DisplayObject());
  otherRoot.addChild(existing); otherRoot.next = () => otherRoot.dispose();
  code(() => otherRoot.addChildAt(free, 0), 'OBJECT_DISPOSED');
  assert.equal(otherRoot.isDisposed, true); assert.equal(existing.isDisposed, true); assert.equal(free.isDisposed, false); assert.equal(free.parent, undefined);
  const other = await f.foreignEngine(); other.stage.addChildAt(free, 0);
}));

test('ADI13 genuine unbound descendant disposal is removed before final whole-tree capture', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), existing = f.track(new egret.DisplayObjectContainer()), oldLeaf = f.track(new egret.DisplayObject());
  const incoming = f.track(new egret.DisplayObjectContainer()), leaf = f.track(new egret.DisplayObject()), removed = f.track(new egret.DisplayObject());
  root.addChild(existing); existing.addChild(oldLeaf); incoming.addChild(leaf); incoming.addChild(removed);
  root.next = () => { oldLeaf.dispose(); removed.dispose(); };
  assert.equal(root.addChildAt(incoming, 0), incoming);
  order(root, [incoming,existing]); order(existing, []); order(incoming, [leaf]);
  assert.equal(oldLeaf.isDisposed, true); assert.equal(removed.isDisposed, true); assert.equal(oldLeaf.parent, undefined); assert.equal(removed.parent, undefined);
  const other = await f.foreignEngine(); other.stage.addChild(root); order(root, [incoming,existing]);
}));

test('ADI14 a hook-created cycle in a fully unbound tree is retained and refused', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), child = f.track(new egret.DisplayObjectContainer()), existing = f.track(new egret.DisplayObject());
  root.addChild(existing); root.next = () => child.addChild(root);
  code(() => root.addChildAt(child, 0), 'DISPLAY_CYCLE');
  order(child, [root]); order(root, [existing]); assert.equal(child.parent, undefined);
  child.removeChild(root); const other = await f.foreignEngine(); other.stage.addChild(root); other.stage.addChild(child);
}));

test('ADI15 incoming affinity binds the compatible current receiver tree on success', async () => withFixture(async f => {
  const root = f.track(new egret.DisplayObjectContainer()), existing = f.track(new egret.DisplayObjectContainer()), leaf = f.track(new egret.DisplayObject());
  const incoming = f.track(new egret.DisplayObjectContainer()), incomingLeaf = f.track(new egret.DisplayObject());
  existing.addChild(leaf); root.addChild(existing); incoming.addChild(incomingLeaf); f.engine.stage.addChild(incoming); f.engine.stage.removeChild(incoming);
  assert.equal(root.addChildAt(incoming, 0), incoming); order(root, [incoming,existing]); order(existing, [leaf]); order(incoming, [incomingLeaf]);
  root.removeChild(existing); const other = await f.foreignEngine();
  code(() => other.stage.addChildAt(existing, 0), 'ENGINE_MISMATCH'); assert.equal(existing.parent, undefined);
  f.engine.stage.addChildAt(existing, 0); f.engine.stage.addChildAt(root, 1);
}));

test('ADI16 initially unbound callback Scope bindings choose current tree affinity and retain conflicts', async () => withFixture(async f => {
  const other = await f.foreignEngine(), a = f.engine.createScope(), b = other.createScope();
  const root = f.track(new HookContainer()), receiverLeaf = f.track(new egret.DisplayObject());
  const incoming = f.track(new HookContainer()), incomingLeaf = f.track(new egret.DisplayObject());
  root.addChild(receiverLeaf); incoming.addChild(incomingLeaf);
  incoming.next = () => { b.use(receiverLeaf); a.use(incomingLeaf); };
  code(() => root.addChildAt(incoming, 0), 'ENGINE_MISMATCH');
  order(root, [receiverLeaf]); order(incoming, [incomingLeaf]); assert.equal(incoming.parent, undefined);
  code(() => a.use(receiverLeaf), 'OWNERSHIP_CONFLICT'); code(() => b.use(incomingLeaf), 'OWNERSHIP_CONFLICT');
  root.removeChild(receiverLeaf); incoming.removeChild(incomingLeaf);
  // Free roots can still choose the opposite Engines: only the hooks bound their leaves.
  f.engine.stage.addChild(root); other.stage.addChild(incoming);
  a.dispose(); b.dispose(); assert.equal(receiverLeaf.isDisposed, true); assert.equal(incomingLeaf.isDisposed, true);
  assert.equal(root.isDisposed, false); assert.equal(incoming.isDisposed, false);
}));

test('ADI17 same-position publication can bind new compatible affinity without claiming owners', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), child = f.track(new egret.DisplayObject()), sibling = f.track(new egret.DisplayObject());
  root.addChild(child); root.addChild(sibling); const owner = f.engine.createScope();
  root.next = () => owner.use(sibling);
  assert.equal(root.addChildAt(child, 0), child); order(root, [child,sibling]);
  const other = await f.foreignEngine(); root.removeChild(child);
  code(() => other.stage.addChildAt(child, 0), 'ENGINE_MISMATCH'); assert.equal(child.parent, undefined);
  const freeOwner = f.engine.createScope(); assert.equal(freeOwner.use(child), child); freeOwner.dispose(); assert.equal(child.isDisposed, true);
  owner.dispose(); assert.equal(sibling.isDisposed, true); assert.equal(root.isDisposed, false); order(root, []);
}));

test('ADI18 preflight Engine shutdown wins and adds no binding to detached free incoming state', async () => withFixture(async f => {
  const root = f.track(new HookContainer()), existing = f.track(new egret.DisplayObject()), child = f.track(new egret.DisplayObject());
  root.addChild(existing); f.engine.stage.addChild(root); f.engine.stage.removeChild(root);
  let closing;
  root.next = () => { closing = f.engine.dispose(); };
  code(() => root.addChildAt(child, 0), 'ENGINE_CLOSED');
  order(root, [existing]); assert.equal(root.isDisposed, false); assert.equal(child.parent, undefined); assert.equal(child.isDisposed, false);
  const other = await f.foreignEngine(); other.stage.addChildAt(child, 0); await closing;
  code(() => root.addChildAt(child, 0), 'ENGINE_CLOSED'); order(root, [existing]);
}));

test('ADI19 cross-Engine current descendant refuses before moving either tree or claiming owners', async () => withFixture(async f => {
  const other = await f.foreignEngine(), root = f.track(new egret.DisplayObjectContainer()), existing = f.track(new egret.DisplayObject());
  const source = f.track(new egret.DisplayObjectContainer()), child = f.track(new egret.DisplayObjectContainer()), leaf = f.track(new egret.DisplayObject());
  child.addChild(leaf); source.addChild(child); other.stage.addChild(source); other.stage.removeChild(source);
  root.addChild(existing); f.engine.stage.addChild(root);
  code(() => root.addChildAt(child, 0), 'ENGINE_MISMATCH'); order(root, [existing]); order(source, [child]); order(child, [leaf]);
  other.stage.addChildAt(source, 0); assert.equal(child.isDisposed, false);
  const sameEngineOwner = other.createScope(); assert.equal(sameEngineOwner.use(child), child);
  source.removeChild(child); code(() => f.engine.stage.addChildAt(child, 0), 'ENGINE_MISMATCH'); assert.equal(child.parent, undefined);
}));

test('ADI20 public readers mutators old-name shadows and lifecycle hooks are not commit authority', async () => withFixture(async f => {
  let armed = false, publicCalls = 0, cleanupCalls = 0, usableCalls = 0;
  class Guarded extends egret.DisplayObjectContainer {
    assertUsable() { usableCalls++; return super.assertUsable(); }
    get numChildren() { if (armed) { publicCalls++; throw new Error('NUM_CHILDREN_CALLBACK'); } return super.numChildren; }
    getChildAt(index) { if (armed) { publicCalls++; throw new Error('CHILD_AT_CALLBACK'); } return super.getChildAt(index); }
    getChildIndex(child) { if (armed) { publicCalls++; throw new Error('CHILD_INDEX_CALLBACK'); } return super.getChildIndex(child); }
    addChild(child) { if (armed) { publicCalls++; throw new Error('ADD_CALLBACK'); } return super.addChild(child); }
    removeChild(child) { if (armed) { publicCalls++; throw new Error('REMOVE_CALLBACK'); } return super.removeChild(child); }
    setChildIndex(child, index) { if (armed) { publicCalls++; throw new Error('REORDER_CALLBACK'); } return super.setChildIndex(child, index); }
    dispose() { if (armed) { cleanupCalls++; throw new Error('DISPOSE_CALLBACK'); } return super.dispose(); }
  }
  const root = f.track(new Guarded()), source = f.track(new Guarded()), child = f.track(new egret.DisplayObject()), existing = f.track(new egret.DisplayObject());
  root.addChild(existing); source.addChild(child); f.engine.stage.addChild(root); f.engine.stage.addChild(source);
  const restorations = [];
  for (const node of [root,source,child,existing]) {
    for (const name of ['parent','isDisposed']) {
      const prior = Object.getOwnPropertyDescriptor(node, name); restorations.push([node,name,prior]);
      Object.defineProperty(node, name, { configurable: true, get() { publicCalls++; throw new Error('PUBLIC_' + name); } });
    }
    for (const name of ['_children','_parent','_isDisposed']) {
      const prior = Object.getOwnPropertyDescriptor(node, name); restorations.push([node,name,prior]);
      Object.defineProperty(node, name, { configurable: true, value: name === '_children' ? [] : true });
    }
  }
  const beforeHooks = usableCalls;
  try {
    armed = true;
    assert.equal(root.addChildAt(child, 0), child); order(root, [child,existing]); order(source, []);
    assert.equal(root.addChildAt(existing, 0), existing); order(root, [existing,child]);
    assert.equal(publicCalls, 0); assert.equal(cleanupCalls, 0); assert.ok(usableCalls > beforeHooks);
  } finally {
    armed = false;
    for (const [node,name,prior] of restorations.reverse()) {
      if (prior) Object.defineProperty(node,name,prior); else assert.equal(Reflect.deleteProperty(node,name),true);
    }
  }
  assert.equal(child.parent, root); assert.equal(child.isDisposed, false);
}));

test('ADI21 reparent and refusal preserve real Bitmap leases Scope owners listeners and saved frames', async () => withFixture(async f => {
  const a = f.engine.createScope(), b = f.engine.createScope();
  const root = a.use(f.track(new HookContainer())), source = b.use(f.track(new egret.DisplayObjectContainer()));
  root.x = 7; source.x = 3; f.engine.stage.addChild(root); f.engine.stage.addChild(source);
  const red = a.use(f.track(new egret.Sprite())); red.graphics.beginFill(0xff0000).drawRect(0,0,1,1).endFill(); root.addChild(red);
  const texture = f.texture(egret.createTexture(egret.createImageData2D({ width: 2, height: 1, pixels: new Uint8Array([0,0,255,255,0,255,0,255]) })));
  let loads = 0, disposals = 0, calls = 0;
  const type = egret.createAssetType('add-child-at-borrowed-blue', egret.isTexture);
  f.engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
  const lease = b.use(f.borrow(await f.engine.assets.acquire(egret.createAssetRef(type, 'blue'))));
  const bitmap = b.use(f.track(new egret.Bitmap(lease))); bitmap.sourceRect = { x:0,y:0,width:1,height:1 }; bitmap.x = 2; source.addChild(bitmap);
  const crop = bitmap.sourceRect, eventType = egret.createEventType('add-child-at-bitmap-live'); bitmap.on(eventType, () => calls++);
  const saved = f.engine.captureFrame({ width: 16, height: 4 });
  const savedCommands = saved.commands, savedImages = saved.images;
  const summarize = frame => frame.commands.map(command => ({ kind:command.kind, x:command.matrix.tx, width:command.rect.width }));
  assert.deepEqual(summarize(saved), [{ kind:'rect',x:7,width:1 },{ kind:'image',x:5,width:1 }]);
  const trace = [...f.port.trace], timers = f.port.timers.size;
  assert.equal(root.addChildAt(bitmap, 0), bitmap); order(root, [bitmap,red]); order(source, []);
  assert.deepEqual(summarize(f.engine.captureFrame({ width:16,height:4 })), [{ kind:'image',x:9,width:1 },{ kind:'rect',x:7,width:1 }]);
  assert.equal(bitmap.textureLease, lease); assert.equal(bitmap.sourceRect, crop); assert.equal(lease.value, texture);
  assert.equal(loads, 1); assert.equal(disposals, 0); assert.equal(calls, 0); assert.equal(a.state, 'open'); assert.equal(b.state, 'open');
  assert.deepEqual(f.port.trace, trace); assert.equal(f.port.timers.size, timers); code(() => a.use(bitmap), 'OWNERSHIP_CONFLICT');
  bitmap.dispatchEvent(new egret.Event(eventType, null)); assert.equal(calls, 1);
  const sentinel = { tag:'resource-hook-refusal' };
  root.next = () => { bitmap.x = 4; throw sentinel; };
  assert.throws(() => root.addChildAt(bitmap, 2), cause => cause === sentinel);
  order(root, [bitmap,red]); order(source, []); assert.equal(bitmap.x, 4); assert.equal(bitmap.sourceRect, crop);
  assert.equal(bitmap.textureLease, lease); assert.equal(lease.value, texture); assert.equal(disposals, 0);
  assert.deepEqual(summarize(f.engine.captureFrame({ width:16,height:4 })), [{ kind:'image',x:11,width:1 },{ kind:'rect',x:7,width:1 }]);
  const unowned = f.track(new egret.DisplayObject()); root.addChildAt(unowned, 1); assert.equal(b.use(unowned), unowned);
  a.dispose(); assert.equal(root.isDisposed, true); assert.equal(red.isDisposed, true);
  assert.equal(bitmap.isDisposed, false); assert.equal(unowned.isDisposed, false); assert.equal(bitmap.parent, undefined); assert.equal(unowned.parent, undefined);
  assert.equal(lease.value, texture); assert.equal(disposals, 0);
  b.dispose(); assert.equal(bitmap.isDisposed, true); assert.equal(unowned.isDisposed, true); assert.equal(source.isDisposed, true);
  assert.equal(disposals, 1); assert.equal(texture.isDisposed, true); code(() => lease.value, 'ASSET_LEASE_RELEASED');
  assert.equal(saved.commands, savedCommands); assert.equal(saved.images, savedImages); assert.equal(Object.isFrozen(saved), true);
  assert.deepEqual(summarize(saved), [{ kind:'rect',x:7,width:1 },{ kind:'image',x:5,width:1 }]);
  assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])], [0,0,255,255,0,255,0,255]);
  assert.equal(f.diagnostics.filter(value => value.code === 'FOREIGN_SUBTREE_DETACHED').length, 2);
  assert.equal(f.diagnostics.every(value => value.code === 'FOREIGN_SUBTREE_DETACHED'), true);
}));
