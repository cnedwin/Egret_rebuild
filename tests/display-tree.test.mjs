import test from "node:test";
import assert from "node:assert/strict";
import { DisplayObject, DisplayObjectContainer, Event, createEventType, createEngine } from "@egret/engine";
import { host } from "./helpers.mjs";

test("child sorting/reparenting is stable and detach keeps a reusable live object", () => {
  const a = new DisplayObjectContainer();
  const b = new DisplayObjectContainer();
  const x = a.addChild(new DisplayObject());
  const y = a.addChild(new DisplayObject());
  a.setChildIndex(y, 0);
  assert.equal(a.getChildAt(0), y);
  assert.equal(a.getChildAt(1), x);
  b.addChild(x);
  assert.equal(a.numChildren, 1);
  assert.equal(x.parent, b);
  assert.equal(b.removeChild(x), x);
  assert.equal(x.parent, undefined);
  const type = createEventType("live");
  let calls = 0;
  x.on(type, () => calls++);
  x.dispatchEvent(new Event(type, null));
  assert.equal(calls, 1);
  a.addChild(x);
  assert.equal(a.numChildren, 2);
});

test("cycles and invalid child/index requests leave the existing tree unchanged", () => {
  const root = new DisplayObjectContainer();
  const child = root.addChild(new DisplayObjectContainer());
  const leaf = child.addChild(new DisplayObject());
  assert.throws(() => child.addChild(root), (e) => e.code === "DISPLAY_CYCLE");
  assert.throws(() => root.addChild(root), (e) => e.code === "DISPLAY_CYCLE");
  assert.throws(() => root.removeChild(leaf), (e) => e.code === "NOT_A_CHILD");
  assert.throws(() => root.getChildAt(1), (e) => e.code === "INVALID_INDEX");
  assert.throws(() => root.setChildIndex(child, -1), (e) => e.code === "INVALID_INDEX");
  assert.equal(root.parent, undefined);
  assert.equal(child.parent, root);
  assert.equal(leaf.parent, child);
  assert.equal(root.numChildren, 1);
});

test("cross-Engine mounting and Scope binding preflight entire subtree atomically", async () => {
  const a = await createEngine({ host: host().adapter });
  const b = await createEngine({ host: host().adapter });
  const root = new DisplayObjectContainer();
  const unowned = root.addChild(new DisplayObject());
  const bound = root.addChild(a.createScope().use(new DisplayObject()));
  assert.throws(() => b.stage.addChild(root), (e) => e.code === "ENGINE_MISMATCH");
  assert.equal(root.parent, undefined);
  assert.equal(bound.parent, root);
  assert.equal(unowned.parent, root);
  assert.throws(() => b.createScope().use(root), (e) => e.code === "ENGINE_MISMATCH");
  a.stage.addChild(root);
  a.stage.removeChild(root);
  assert.throws(() => b.stage.addChild(root), (e) => e.code === "ENGINE_MISMATCH");
  assert.equal(root.parent, undefined);
  await a.dispose();
  await b.dispose();
});

test("owner boundary passes through unowned container and detaches foreign subtree", async () => {
  const diagnostics = [];
  const engine = await createEngine({ host: host().adapter, onDiagnostic: (d) => diagnostics.push(d) });
  const a = engine.createScope();
  const b = engine.createScope();
  const root = a.use(new DisplayObjectContainer());
  const middle = root.addChild(new DisplayObjectContainer());
  const own = middle.addChild(a.use(new DisplayObject()));
  const foreign = middle.addChild(b.use(new DisplayObjectContainer()));
  const foreignLeaf = foreign.addChild(new DisplayObject());
  root.dispose();
  assert.equal(root.isDisposed, true);
  assert.equal(middle.isDisposed, true);
  assert.equal(own.isDisposed, true);
  assert.equal(foreign.isDisposed, false);
  assert.equal(foreign.parent, undefined);
  assert.equal(foreignLeaf.parent, foreign);
  assert.equal(foreignLeaf.isDisposed, false);
  assert.ok(diagnostics.some((d) => d.code === "FOREIGN_SUBTREE_DETACHED"));
  a.dispose();
  assert.equal(foreign.isDisposed, false);
  b.dispose();
  assert.equal(foreignLeaf.isDisposed, true);
  await engine.dispose();
});

test("unowned root only cleans unowned descendants and failing child cannot stop siblings", async () => {
  const engine = await createEngine({ host: host().adapter, onDiagnostic() { throw new Error("observer"); } });
  const root = new DisplayObjectContainer();
  class FailingChild extends DisplayObject { dispose() { super.dispose(); throw new Error("child"); } }
  const bad = root.addChild(new FailingChild());
  const good = root.addChild(new DisplayObject());
  const foreign = root.addChild(engine.createScope().use(new DisplayObjectContainer()));
  const leaf = foreign.addChild(new DisplayObject());
  engine.stage.addChild(root);
  assert.doesNotThrow(() => root.dispose());
  assert.equal(root.isDisposed, true);
  assert.equal(bad.isDisposed, true);
  assert.equal(good.isDisposed, true);
  assert.equal(foreign.isDisposed, false);
  assert.equal(leaf.parent, foreign);
  // The diagnostic callback fails; Engine must still finish its own cleanup.
  await engine.dispose();
});

test("disposed nodes cannot be mounted, subscribed or dispatched again", () => {
  const node = new DisplayObject();
  const type = createEventType("disposed");
  node.dispose();
  node.dispose();
  assert.throws(() => new DisplayObjectContainer().addChild(node), (e) => e.code === "OBJECT_DISPOSED");
  assert.throws(() => node.on(type, () => {}), (e) => e.code === "OBJECT_DISPOSED");
  assert.throws(() => node.dispatchEvent(new Event(type, null)), (e) => e.code === "OBJECT_DISPOSED");
});

test("Engine Stage remains a root and cannot become another node's child", async () => {
  const engine = await createEngine({ host: host().adapter });
  const container = new DisplayObjectContainer();
  assert.throws(() => container.addChild(engine.stage), (e) => e.code === "STAGE_ROOT_ONLY");
  assert.equal(engine.stage.parent, undefined);
  assert.equal(container.numChildren, 0);
  await engine.dispose();
});

test("unbound container rejects children from different Engines without partial binding", async () => {
  const a = await createEngine({ host: host().adapter });
  const b = await createEngine({ host: host().adapter });
  const parent = new DisplayObjectContainer();
  const first = parent.addChild(a.createScope().use(new DisplayObject()));
  const incoming = b.createScope().use(new DisplayObject());
  b.stage.addChild(incoming);
  assert.throws(() => parent.addChild(incoming), (e) => e.code === "ENGINE_MISMATCH");
  assert.equal(parent.numChildren, 1);
  assert.equal(first.parent, parent);
  assert.equal(incoming.parent, b.stage);
  assert.equal(b.stage.numChildren, 1);
  a.stage.addChild(parent);
  await a.dispose();
  await b.dispose();
});
