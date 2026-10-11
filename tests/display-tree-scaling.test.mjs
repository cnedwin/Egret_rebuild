import test from 'node:test';
import assert from 'node:assert/strict';
import { DisplayObject, DisplayObjectContainer, Sprite, createEngine } from '@egret/engine';
import { host } from './helpers.mjs';

// Regression: mounting an unrelated child must not reenter old sibling hooks.
test('bound receiver admits a child without rerunning unrelated descendant hooks', async () => {
  const engine = await createEngine({ host: host().adapter });
  let armed = false, calls = 0;
  class Existing extends Sprite {
    assertUsable() { super.assertUsable(); if (armed) { calls++; throw new Error('unrelated sibling'); } }
  }
  try {
    const old = engine.stage.addChild(new Existing());
    const child = new Sprite();
    armed = true;
    assert.equal(engine.stage.addChild(child), child);
    assert.equal(calls, 0);
    assert.equal(engine.stage.getChildAt(0), old);
    assert.equal(engine.stage.getChildAt(1), child);
  } finally { await engine.dispose(); }
});

// Regression: an unbound receiver still needs admission of its complete tree.
test('unbound receiver preflights its old descendants before accepting engine affinity', async () => {
  const engine = await createEngine({ host: host().adapter });
  const root = new DisplayObjectContainer(), failure = new Error('old unbound descendant');
  let armed = false;
  class Existing extends DisplayObject { assertUsable() { super.assertUsable(); if (armed) throw failure; } }
  const old = root.addChild(new Existing());
  const incoming = engine.createScope().use(new DisplayObject());
  engine.stage.addChild(incoming);
  try {
    armed = true;
    assert.throws(() => root.addChild(incoming), error => error === failure);
    assert.equal(root.numChildren, 1); assert.equal(old.parent, root);
    assert.equal(incoming.parent, engine.stage);
  } finally { root.dispose(); await engine.dispose(); }
});

// Regression: subclass reentry must not bypass the final current-tree checks.
test('incoming hook cannot move a foreign-bound tree into a bound receiver', async () => {
  const a = await createEngine({ host: host().adapter }), b = await createEngine({ host: host().adapter });
  const scope = b.createScope(); let calls = 0;
  class Incoming extends DisplayObjectContainer {
    assertUsable() { super.assertUsable(); if (++calls === 2) scope.use(this); }
  }
  const incoming = new Incoming();
  try {
    assert.throws(() => a.stage.addChild(incoming), { code: 'ENGINE_MISMATCH' });
    assert.equal(a.stage.numChildren, 0); assert.equal(incoming.parent, undefined);
    assert.equal(b.stage.addChild(incoming), incoming);
  } finally { await a.dispose(); await b.dispose(); }
});

test('incoming preflight includes descendants added by its usability hook', async () => {
  const a = await createEngine({ host: host().adapter }), b = await createEngine({ host: host().adapter });
  let calls = 0, leaf;
  class Incoming extends DisplayObjectContainer {
    assertUsable() { super.assertUsable(); if (++calls === 2) leaf = this.addChild(new DisplayObject()); }
  }
  const incoming = new Incoming();
  try {
    a.stage.addChild(incoming);
    assert.equal(leaf.parent, incoming);
    assert.throws(() => b.stage.addChild(leaf), { code: 'ENGINE_MISMATCH' });
    assert.equal(leaf.parent, incoming); assert.equal(b.stage.numChildren, 0);
  } finally { await a.dispose(); await b.dispose(); }
});

test('incoming preflight disposal of receiver preserves the previous child parent', async () => {
  const engine = await createEngine({ host: host().adapter });
  const receiver = engine.stage.addChild(new DisplayObjectContainer());
  const previous = engine.stage.addChild(new DisplayObjectContainer()); let calls = 0, armed = false;
  class Incoming extends DisplayObject {
    assertUsable() { super.assertUsable(); if (armed && ++calls === 2) receiver.dispose(); }
  }
  const incoming = new Incoming();
  previous.addChild(incoming); armed = true;
  try {
    assert.throws(() => receiver.addChild(incoming), { code: 'OBJECT_DISPOSED' });
    assert.equal(incoming.parent, previous); assert.equal(previous.numChildren, 1);
    assert.equal(receiver.numChildren, 0);
  } finally { await engine.dispose(); }
});

test('final admission rereads an initially unbound receiver bound during incoming preflight', async () => {
  const a = await createEngine({ host: host().adapter }), b = await createEngine({ host: host().adapter });
  const root = new DisplayObjectContainer(), old = root.addChild(new DisplayObject());
  const scope = b.createScope(); let armed = false, calls = 0;
  class Incoming extends DisplayObject {
    assertUsable() { super.assertUsable(); if (armed && ++calls === 2) scope.use(root); }
  }
  const incoming = a.createScope().use(new Incoming());
  a.stage.addChild(incoming); armed = true;
  try {
    assert.throws(() => root.addChild(incoming), { code: 'ENGINE_MISMATCH' });
    assert.equal(incoming.parent, a.stage); assert.equal(root.numChildren, 1); assert.equal(old.parent, root);
    b.stage.addChild(root);
  } finally { await a.dispose(); await b.dispose(); }
});

test('final admission rejects a cycle introduced by an incoming hook', async () => {
  const engine = await createEngine({ host: host().adapter });
  const receiver = engine.stage.addChild(new DisplayObjectContainer()); let calls = 0;
  class Incoming extends DisplayObjectContainer {
    assertUsable() { super.assertUsable(); if (++calls === 2) this.addChild(receiver); }
  }
  const incoming = new Incoming();
  try {
    assert.throws(() => receiver.addChild(incoming), { code: 'DISPLAY_CYCLE' });
    // The nested successful move belongs to user reentry, not the failed outer commit.
    assert.equal(receiver.parent, incoming); assert.equal(incoming.parent, undefined); assert.equal(receiver.numChildren, 0);
  } finally { incoming.dispose(); await engine.dispose(); }
});

test('engine closing in an incoming hook precedes receiver bindable callbacks and reparenting', async () => {
  const engine = await createEngine({ host: host().adapter });
  let armed = false, receiverCalls = 0, closing;
  class Receiver extends DisplayObjectContainer {
    assertUsable() { if (armed) receiverCalls++; super.assertUsable(); }
  }
  class Incoming extends DisplayObject {
    assertUsable() { super.assertUsable(); if (armed) closing ??= engine.dispose(); }
  }
  const receiver = engine.stage.addChild(new Receiver());
  const previous = engine.stage.addChild(new DisplayObjectContainer());
  engine.stage.removeChild(previous);
  const incoming = previous.addChild(new Incoming()); armed = true;
  try {
    assert.throws(() => receiver.addChild(incoming), { code: 'ENGINE_CLOSED' });
    assert.equal(receiverCalls, 1); assert.equal(incoming.parent, previous);
    assert.equal(previous.numChildren, 1); assert.equal(incoming.isDisposed, false);
  } finally { previous.dispose(); await (closing ?? engine.dispose()); }
});

test('tail detach and middle reparent preserve painter order and reusable nodes', () => {
  const first = new DisplayObjectContainer(), second = new DisplayObjectContainer();
  const nodes = Array.from({ length: 32 }, () => first.addChild(new DisplayObject()));
  try {
    first.removeChild(nodes[31]); second.addChild(nodes[15]); first.addChild(nodes[31]);
    assert.equal(first.numChildren, 31); assert.equal(second.numChildren, 1);
    assert.deepEqual(Array.from({ length: 31 }, (_, i) => first.getChildAt(i)), nodes.filter(node => node !== nodes[15]));
    for (let i = 31; i >= 0; i--) nodes[i].dispose();
    assert.equal(first.numChildren, 0); assert.equal(second.numChildren, 0);
  } finally { first.dispose(); second.dispose(); }
});
