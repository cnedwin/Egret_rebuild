// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer } from '@egret/engine';
import { createKeyboardInput, createPointerInput } from '@egret/engine/input';
import { createUiRoot, createUiLayerManager } from '@egret/engine/ui';
import { deferred, host } from './helpers.mjs';

const code = name => error => error?.code === name;
const viewport = { width: 160, height: 120 };
const leaf = (id, content) => ({ id, kind: 'leaf', explicitWidth: 36, explicitHeight: 20, content });
const tree = (kind, children) => ({ id: 'body', kind, gap: 2, children });
const publish = async root => {
  for (let round = 0; round < 8; round++) {
    const pending = await root.prepare();
    if (pending.status !== 'pending') return root.commit(pending);
  }
  assert.fail('responsive fixture must settle within eight preparation rounds');
};

test('responsive trees keep committed leaves and focus until publication; new leaves attach once in owned scopes', async () => {
  const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
  const keyboard = createKeyboardInput({ engine, scope });
  const prepared = new Map(), attached = [], closed = [];
  let root;
  function source(id) {
    return {
      revision: 0,
      prepare(context) {
        const content = context.scope.use(new DisplayObjectContainer());
        content.touchEnabled = true;
        content.hitArea = { x: 0, y: 0, width: context.width, height: 20 };
        prepared.set(id, { scope: context.scope, content });
        assert.throws(() => keyboard.registerTarget({ id, target: content }));
        context.scope.signal.addEventListener('abort', () => closed.push(id));
        return { content, measuredHeight: 20 };
      },
      onAttach(context) {
        assert.equal(context.content, prepared.get(id).content);
        assert.equal(context.scope, prepared.get(id).scope);
        assert.equal(root.snapshot().committedRevision, context.committedRevision);
        context.scope.use(keyboard.registerTarget({ id, target: context.content }));
        attached.push(id);
      }
    };
  }
  const a = source('a'), b = source('b'), c = source('c');
  const original = tree('column', [leaf('a', a), leaf('b', b)]);
  root = createUiRoot({ engine, scope, id: 'responsive', viewport, density: 1, tree: original });
  try {
    assert.equal(root.commit(await root.prepare()).kind, 'committed');
    assert.deepEqual(attached, ['a', 'b']);
    assert.equal(keyboard.getSnapshot().targetCount, 2);
    const old = prepared.get('a');
    keyboard.focus('a');
    const expanded = tree('row', [leaf('a', a), leaf('b', b), leaf('c', c)]);
    assert.throws(() => root.setTree(expanded), code('UI_TREE_SHAPE'));
    const before = root.snapshot();
    root.setTree(expanded, { responsive: true });
    const candidate = await root.prepare();
    assert.deepEqual(root.snapshot().boxes, before.boxes);
    assert.deepEqual(attached, ['a', 'b']);
    assert.equal(keyboard.getSnapshot().focusedId, 'a');
    assert.deepEqual(root.commit(candidate).postCommitErrors, []);
    assert.deepEqual(attached, ['a', 'b', 'c']);
    assert.equal(prepared.get('a'), old);
    assert.equal(keyboard.getSnapshot().focusedId, 'a');
    assert.equal(keyboard.getSnapshot().targetCount, 3);
    assert.ok(root.snapshot().boxes.find(box => box.id === 'c'));
    // Removed dirty identities cannot poison a new layout; reused leaves stay registered.
    root.invalidate('b', 'paint');
    root.setTree(tree('column', [leaf('c', c), leaf('a', a)]), { responsive: true });
    assert.deepEqual((await publish(root)).postCommitErrors, []);
    assert.deepEqual(closed, ['b']);
    assert.equal(keyboard.getSnapshot().focusedId, 'a');
    assert.equal(keyboard.getSnapshot().targetCount, 2);
    assert.deepEqual(attached, ['a', 'b', 'c']);
    // Same id, new content: old scope/registration retires before replacement attaches.
    a.revision++;
    root.setTree(tree('column', [leaf('c', c), leaf('a', a)]), { responsive: true });
    assert.deepEqual((await publish(root)).postCommitErrors, []);
    assert.equal(old.scope.state, 'closed');
    assert.deepEqual(attached, ['a', 'b', 'c', 'a']);
    assert.equal(keyboard.getSnapshot().targetCount, 2);
    assert.notEqual(prepared.get('a'), old);
    assert.equal((await publish(root)).kind, 'unchanged');
    assert.deepEqual(attached, ['a', 'b', 'c', 'a']);
    root.dispose();
    assert.equal(keyboard.getSnapshot().targetCount, 0);
  } finally {
    await engine.dispose();
  }
});

test('responsive refusal and superseded preparation never attach or remove committed content', async () => {
  const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
  const attach = [], contexts = [], late = deferred(), cause = new Error('post-attachment failure');
  const source = (name, wait = false, throws = false) => ({
    revision: 0,
    prepare(context) {
      contexts.push(context);
      const result = { content: context.scope.use(new DisplayObjectContainer()), measuredHeight: 20 };
      return wait ? late.promise.then(() => result) : result;
    },
    onAttach() {
      attach.push(name);
      if (throws) throw cause;
    }
  });
  const a = source('a'), b = source('b', true), c = source('c', false, true);
  const root = createUiRoot({ engine, scope, id: 'responsive', viewport, density: 1, tree: tree('column', [leaf('a', a)]) });
  try {
    await publish(root);
    const before = root.snapshot();
    assert.throws(() => root.setTree(tree('row', [leaf('a', a), leaf('a', b)]), { responsive: true }), code('UI_DUPLICATE_ID'));
    assert.deepEqual(root.snapshot().boxes, before.boxes);
    assert.throws(() => root.setTree({ id: 'list', kind: 'virtualList', source: { revision: 0, records: [], bind() {}, unbind() {} } }, { responsive: true }), code('UI_TREE_SHAPE'));
    root.setTree(tree('column', [leaf('b', b)]), { responsive: true });
    const pending = root.prepare();
    const refused = assert.rejects(pending, code('UI_STALE'));
    root.setTree(tree('row', [leaf('a', a), leaf('c', c)]), { responsive: true });
    await refused;
    assert.deepEqual(attach, ['a']);
    assert.equal(contexts[0].scope.state, 'open');
    assert.equal(contexts[1].scope.state, 'closed');
    late.resolve();
    const result = await publish(root);
    assert.equal(result.kind, 'committed');
    assert.deepEqual(result.postCommitErrors, [cause]);
    assert.deepEqual(attach, ['a', 'c']);
    assert.ok(root.snapshot().boxes.find(box => box.id === 'c'));
    assert.equal((await publish(root)).kind, 'unchanged');
    assert.deepEqual(attach, ['a', 'c']);
  } finally {
    await engine.dispose();
  }
});

test('responsive changes may move a fixed virtual list, not replace its identity', async () => {
  const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
  const source = { revision: 0, records: [{ key: 'k', contentVersion: 0, estimatedHeight: 20, value: null }], bind(context) { return { content: context.scope.use(new DisplayObjectContainer()), measuredHeight: 20 }; }, unbind() {} };
  const list = { id: 'list', kind: 'virtualList', explicitWidth: 80, explicitHeight: 40, source };
  const spacer = { id: 'spacer', kind: 'leaf', explicitWidth: 36, explicitHeight: 12 };
  const root = createUiRoot({ engine, scope, id: 'responsive-list', viewport, density: 1, tree: tree('column', [list]) });
  try {
    await publish(root);
    const generation = root.snapshot().rows[0].bindingGeneration;
    root.setTree(tree('row', [spacer, list]), { responsive: true });
    await publish(root);
    assert.equal(root.snapshot().rows[0].bindingGeneration, generation);
    assert.ok(root.snapshot().rows[0].box.x > 0);
    assert.throws(() => root.setTree(tree('row', [spacer]), { responsive: true }), code('UI_TREE_SHAPE'));
    assert.throws(() => root.setTree(tree('row', [{ ...list, id: 'other' }]), { responsive: true }), code('UI_TREE_SHAPE'));
    assert.equal(root.list('list').snapshot().rows[0].bindingGeneration, generation);
  } finally {
    await engine.dispose();
  }
});

test('responsive removal retires popup anchors only at committed publication', async () => {
  const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
  const input = createPointerInput({ engine, scope, ...viewport });
  const anchor = { id: 'anchor', kind: 'leaf', explicitWidth: 36, explicitHeight: 20 };
  const spare = { id: 'spare', kind: 'leaf', explicitWidth: 36, explicitHeight: 20 };
  const base = createUiRoot({ engine, scope, input, id: 'base', viewport, density: 1, tree: tree('column', [anchor, spare]) });
  const popup = createUiRoot({ engine, scope, input, id: 'popup', viewport: { width: 40, height: 25 }, density: 1, tree: { id: 'menu', kind: 'leaf', explicitWidth: 40, explicitHeight: 25 } });
  try {
    await publish(base);
    await publish(popup);
    const layers = createUiLayerManager({ engine, scope, input, viewport: { x: 0, y: 0, ...viewport } });
    layers.register({ id: 'base', root: base, kind: 'base' });
    layers.register({ id: 'popup', root: popup, kind: 'popup', anchor: { root: base, target: { kind: 'leaf', id: 'anchor' } } });
    layers.open('popup');
    layers.sync();
    assert.deepEqual(layers.snapshot().openStack, ['popup']);
    base.setTree(tree('column', [spare]), { responsive: true });
    const pending = await base.prepare();
    layers.sync();
    assert.deepEqual(layers.snapshot().openStack, ['popup'], 'pending shape does not erase its old committed anchor');
    // Layer sync may advance its generation, so acquire another ready token if needed.
    const result = base.commit(pending);
    if (result.kind === 'stale') await publish(base);
    assert.ok(!base.snapshot().boxes.some(box => box.id === 'anchor'));
    layers.sync();
    assert.deepEqual(layers.snapshot().openStack, []);
  } finally {
    await engine.dispose();
  }
});

test('post-attachment callbacks observe the committed revision and may close without later registrations', async () => {
  const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
  const attached = [];
  const make = onAttach => ({ revision: 0, prepare(context) { return { content: context.scope.use(new DisplayObjectContainer()), measuredHeight: 20 }; }, onAttach });
  let root;
  const first = make(context => { assert.equal(root.snapshot().committedRevision, context.committedRevision); attached.push('first'); root.dispose(); });
  const second = make(() => { attached.push('second'); });
  root = createUiRoot({ engine, scope, id: 'responsive-close', viewport, density: 1, tree: tree('row', [leaf('first', first), leaf('second', second)]) });
  try {
    const result = await publish(root);
    assert.equal(result.kind, 'committed');
    assert.deepEqual(result.postCommitErrors, []);
    assert.equal(root.state, 'closed');
    assert.deepEqual(attached, ['first']);
  } finally {
    await engine.dispose();
  }
});
