// SPDX-License-Identifier: Apache-2.0
// UNIT: indexed insertion remembers a receiver tree it has walked in full. These cases compare the
// remembering path with one that is made to walk every time, and observe the walk through the private capture.
// The only private import is the built packages/runtime/dist/displayTreeState.js, as AGENTS permits.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { captureChildInsertion, publishUiTree } from '../packages/runtime/dist/displayTreeState.js';
import { host } from './helpers.mjs';

const probe = new egret.DisplayObject();
/** The private capture holds one record per walked node; a remembered receiver contributes only its own. */
const remembered = receiver => captureChildInsertion(receiver, probe).receiverTree.length === 1;
/** Republishing a container's current list is the private UI publication; it retires the record of every tree containing it. */
function forget(nodes) {
  for (const node of nodes) {
    if (!(node instanceof egret.DisplayObjectContainer) || node.isDisposed) continue;
    const children = Array.from({ length: node.numChildren }, (_, index) => node.getChildAt(index));
    publishUiTree([{ parent: node, previous: children, next: children }]);
  }
}
const outcome = action => { try { action(); return 'ok'; } catch (cause) { return cause instanceof egret.EgretError ? cause.code : 'THROWN:' + cause?.message; } };
function random(seed) {
  let state = seed >>> 0;
  return bound => { state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0; return (state >>> 8) % bound; };
}

/** One world of two Engines; `walkAlways` retires every record before each indexed insertion. */
async function world(walkAlways) {
  const ports = [host(), host()];
  const engines = [await egret.createEngine({ host: ports[0].adapter }), await egret.createEngine({ host: ports[1].adapter })];
  const scopes = [engines[0].createScope(), engines[1].createScope()], nodes = [], log = [];
  const record = (name, action) => log.push(name + ':' + outcome(action));
  const structure = () => nodes.map((node, id) => {
    if (node.isDisposed) return id + ':disposed';
    const parent = node.parent, children = node instanceof egret.DisplayObjectContainer
      ? Array.from({ length: node.numChildren }, (_, index) => nodes.indexOf(node.getChildAt(index))).join(',') : '-';
    return id + ':' + (parent === undefined ? 'free' : parent === engines[0].stage ? 'stage0' : parent === engines[1].stage ? 'stage1' : nodes.indexOf(parent)) + '[' + children + ']';
  }).join(' ');
  return {
    log, nodes,
    step(next) {
      const kind = next(100), pick = () => nodes[next(nodes.length)];
      if (nodes.length < 4 || kind < 14) {
        const node = next(3) === 0 ? new egret.DisplayObject() : new egret.DisplayObjectContainer(), owner = next(4);
        nodes.push(node);
        if (owner < 2) record('use' + owner, () => scopes[owner].use(node)); else log.push('free');
      } else if (kind < 44) {
        const parent = pick(), child = pick(), span = parent instanceof egret.DisplayObjectContainer && !parent.isDisposed ? parent.numChildren + 2 : 2;
        const index = next(12) === 0 ? -1 : next(span);
        if (walkAlways) forget(nodes);
        record('at', () => egret.DisplayObjectContainer.prototype.addChildAt.call(parent, child, index));
      } else if (kind < 62) {
        const parent = pick(), child = pick();
        record('add', () => egret.DisplayObjectContainer.prototype.addChild.call(parent, child));
      } else if (kind < 72) {
        const stage = engines[next(2)].stage, child = pick(), indexed = next(2) === 0;
        if (walkAlways) forget(nodes);
        record('stage', () => indexed ? stage.addChildAt(child, 0) : stage.addChild(child));
      } else if (kind < 80) {
        const parent = pick(), child = pick();
        record('remove', () => egret.DisplayObjectContainer.prototype.removeChild.call(parent, child));
      } else if (kind < 87) {
        const parent = pick(), child = pick();
        record('index', () => egret.DisplayObjectContainer.prototype.setChildIndex.call(parent, child, 0));
      } else if (kind < 92) {
        const node = pick(), owner = next(2);
        record('use' + owner, () => scopes[owner].use(node));
      } else if (kind < 96) {
        const parent = pick();
        record('clear', () => egret.DisplayObjectContainer.prototype.removeChildren.call(parent));
      } else record('dispose', () => pick().dispose());
      log.push(structure());
    },
    probe() { return nodes.map(node => outcome(() => scopes[0].use(node)) + '/' + outcome(() => scopes[1].use(node))).join(' '); },
    async close() {
      for (const scope of scopes) scope.dispose();
      for (const engine of engines) await engine.dispose();
      for (const node of nodes) node.dispose();
    },
  };
}

test('ADV01 remembered receiver trees give the same results, order and affinity as walking every time', async () => {
  for (let seed = 1; seed <= 40; seed++) {
    const remembered = await world(false), walked = await world(true);
    try {
      const a = random(seed), b = random(seed);
      for (let step = 0; step < 260; step++) {
        remembered.step(a); walked.step(b);
        assert.equal(remembered.log.at(-2), walked.log.at(-2), 'seed ' + seed + ' step ' + step + ' result');
        assert.equal(remembered.log.at(-1), walked.log.at(-1), 'seed ' + seed + ' step ' + step + ' tree');
      }
      assert.equal(remembered.probe(), walked.probe(), 'seed ' + seed + ' affinity');
      // The comparison is only meaningful when insertions both succeeded and were refused.
      assert.ok(remembered.log.includes('at:ok') && remembered.log.some(entry => entry.startsWith('at:') && entry !== 'at:ok'));
    } finally { await remembered.close(); await walked.close(); }
  }
});

async function fixture(body) {
  const port = host(), engine = await egret.createEngine({ host: port.adapter }), nodes = [];
  const make = (container = true) => { const node = container ? new egret.DisplayObjectContainer() : new egret.DisplayObject(); nodes.push(node); return node; };
  try { await body({ engine, make }); } finally { await engine.dispose(); for (const node of nodes) node.dispose(); }
}

test('ADV02 a bound receiver is remembered after its first indexed insertion and through ordinary edits', async () => fixture(async ({ engine, make }) => {
  const root = make(), branch = make(), a = make(false), b = make(false), c = make(false), d = make(false);
  engine.stage.addChild(root); root.addChild(a);
  assert.equal(remembered(root), false);
  root.addChildAt(c, 0);
  assert.equal(remembered(root), true);
  // Free nodes that enter through either insertion take the receiver's affinity, so nothing is forgotten.
  root.addChild(branch); branch.addChild(b); root.setChildIndex(c, 1); root.removeChild(a); b.dispose();
  assert.equal(remembered(root), true);
  root.addChildAt(d, 0);
  assert.equal(remembered(root), true);
  assert.deepEqual([root.getChildAt(0), root.getChildAt(1), root.getChildAt(2)], [d, c, branch]);
  // The receiver of a nested insertion is remembered on its own.
  assert.equal(remembered(branch), true, 'a receiver without children has nothing below it to walk');
  branch.addChild(make(false));
  assert.equal(remembered(branch), false);
  branch.addChildAt(a, 0);
  assert.equal(remembered(branch), true);
  assert.equal(remembered(root), true);
}));

test('ADV03 a tree without an Engine is never remembered and is walked on every insertion', async () => fixture(async ({ engine, make }) => {
  const root = make(), a = make(false), b = make(false), c = make(false), scope = engine.createScope();
  root.addChild(c); root.addChildAt(a, 0);
  assert.equal(remembered(root), false);
  // A leaf bound later through a Scope is found by the walk and binds the whole receiver tree.
  scope.use(a);
  assert.equal(remembered(root), false);
  root.addChildAt(b, 0);
  assert.equal(remembered(root), true);
  const other = await egret.createEngine({ host: host().adapter });
  try { assert.equal(outcome(() => other.stage.addChild(root)), 'ENGINE_MISMATCH'); assert.equal(outcome(() => other.stage.addChild(c)), 'ENGINE_MISMATCH'); } finally { await other.dispose(); }
  scope.dispose();
}));

test('ADV04 a list replacement that did not come from an insertion retires the memory of every containing tree', async () => fixture(async ({ engine, make }) => {
  const root = make(), branch = make(), inner = make(), a = make(false), b = make(false), c = make(false);
  engine.stage.addChild(root); root.addChild(make(false)); branch.addChild(make(false)); inner.addChild(c);
  root.addChildAt(branch, 0); branch.addChildAt(inner, 0); inner.addChildAt(a, 0);
  for (const node of [root, branch, inner]) assert.equal(remembered(node), true);
  const other = make(); engine.stage.addChild(other); other.addChild(make(false)); other.addChildAt(b, 0);
  // The same private publication the UI commit performs, here re-publishing the current list.
  publishUiTree([{ parent: inner, previous: [a, c], next: [a, c] }]);
  for (const node of [root, branch, inner]) assert.equal(remembered(node), false);
  assert.equal(remembered(other), true);
  // The next insertion walks again and remembers again.
  root.addChildAt(make(false), 0);
  assert.equal(remembered(root), true);
  assert.equal(remembered(inner), false);
  assert.equal(a.parent, inner); assert.equal(inner.numChildren, 2);
}));

test('ADV05 a remembered receiver still refuses in the documented order and leaves the tree as it was', async () => fixture(async ({ engine, make }) => {
  const root = make(), a = make(false), b = make(false), gone = make(false), foreignLeaf = make(false);
  engine.stage.addChild(root); root.addChild(make(false)); root.addChildAt(a, 0);
  assert.equal(remembered(root), true);
  const other = await egret.createEngine({ host: host().adapter }), scope = other.createScope();
  try {
    scope.use(foreignLeaf); gone.dispose();
    assert.equal(outcome(() => root.addChildAt(foreignLeaf, 0)), 'ENGINE_MISMATCH');
    assert.equal(outcome(() => root.addChildAt(gone, 0)), 'OBJECT_DISPOSED');
    assert.equal(outcome(() => root.addChildAt(b, 3)), 'INVALID_INDEX');
    assert.equal(outcome(() => root.addChildAt(engine.stage, 0)), 'STAGE_ROOT_ONLY');
    assert.equal(outcome(() => root.addChildAt(root, 0)), 'DISPLAY_CYCLE');
    assert.equal(root.numChildren, 2); assert.equal(root.getChildAt(0), a); assert.equal(b.parent, undefined);
    // A foreign node nested inside a free incoming tree is found by the walk of that incoming tree.
    const carrier = make(); carrier.addChild(make(false)); scope.use(carrier.getChildAt(0));
    assert.equal(outcome(() => root.addChildAt(carrier, 0)), 'ENGINE_MISMATCH');
    assert.equal(carrier.parent, undefined);
    scope.dispose();
  } finally { await other.dispose(); }
  await engine.dispose();
  assert.equal(outcome(() => root.addChildAt(b, 0)), 'ENGINE_CLOSED');
}));
