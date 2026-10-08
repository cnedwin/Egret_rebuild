import test from "node:test";
import assert from "node:assert/strict";
import { DisplayObject, DisplayObjectContainer, EgretError, Event, createEngine, createEventType } from "@egret/engine";
import { deferred, flush, host } from "./helpers.mjs";

class CheckingNode extends DisplayObject {
  hook;
  assertUsable() {
    super.assertUsable();
    const hook = this.hook;
    this.hook = undefined;
    hook?.();
  }
}

test("R1 Scope blocks same-value ownership reentry before binding commit", async () => {
  const a = await createEngine({ host: host().adapter });
  const b = await createEngine({ host: host().adapter });
  const outerScope = a.createScope();
  const innerScope = b.createScope();
  const node = new CheckingNode();
  let innerError;
  node.hook = () => {
    try { innerScope.use(node); }
    catch (error) { innerError = error; }
  };
  assert.equal(outerScope.use(node), node);
  assert.equal(innerError?.code, "SCOPE_REGISTRATION_ACTIVE");
  assert.throws(() => b.stage.addChild(node), (e) => e.code === "ENGINE_MISMATCH");
  innerScope.dispose();
  assert.equal(node.isDisposed, false);
  a.stage.addChild(node);
  outerScope.dispose();
  assert.equal(node.isDisposed, true);
  await a.dispose();
  await b.dispose();
});

test("R1 Scope closing during callback preflight rejects and cleans its late value", async () => {
  const engine = await createEngine({ host: host().adapter });
  const scope = engine.createScope();
  const node = new CheckingNode();
  node.hook = () => scope.dispose();
  assert.throws(() => scope.use(node), (e) => e.code === "SCOPE_CLOSED");
  assert.equal(scope.state, "closed");
  assert.equal(node.isDisposed, true);
  assert.equal(node.parent, undefined);
  await engine.dispose();
  assert.equal(node.isDisposed, true);
});

test("R2 atomic reparenting uses internal detach without old-parent override callbacks", async () => {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  let overrideCalls = 0;
  class OldParent extends DisplayObjectContainer {
    removeChild(child) {
      overrideCalls++;
      const removed = super.removeChild(child);
      void engine.dispose();
      return removed;
    }
  }
  const oldParent = new OldParent();
  const child = oldParent.addChild(new DisplayObject());
  assert.equal(engine.stage.addChild(child), child);
  assert.equal(overrideCalls, 0);
  assert.equal(engine.stage.isDisposed, false);
  assert.equal(engine.stage.numChildren, 1);
  assert.equal(oldParent.numChildren, 0);
  assert.equal(child.parent, engine.stage);
  assert.equal(child.isDisposed, false);
  await engine.dispose();
  assert.equal(child.isDisposed, true);
  assert.equal(engine.stage.numChildren, 0);
  assert.deepEqual(h.trace, ["start", "stop", "close"]);
});

test("R3 open older Scope still cleans an unowned late value while Engine is closing", async () => {
  const engine = await createEngine({ host: host().adapter });
  const older = engine.createScope();
  const newer = engine.createScope();
  let released = 0;
  let registrationError;
  newer.signal.addEventListener("abort", () => {
    try { older.use({ release() { released++; } }); }
    catch (error) { registrationError = error; }
  });
  await engine.dispose();
  assert.equal(registrationError?.code, "ENGINE_CLOSED");
  assert.equal(released, 1);
  assert.equal(older.state, "closed");
});

test("R4 failed signal registration rolls back unreachable handler and retains adapter errors", () => {
  const target = new DisplayObject();
  const type = createEventType("review-add-failure");
  const addFailure = new Error("adapter add failed");
  const rollbackFailure = new Error("adapter rollback failed");
  let calls = 0;
  let removeCalls = 0;
  const signal = {
    aborted: false,
    reason: undefined,
    addEventListener() { throw addFailure; },
    removeEventListener() { removeCalls++; throw rollbackFailure; },
  };
  assert.throws(() => target.on(type, () => { calls++; }, { signal }), (e) => {
    assert.ok(e instanceof EgretError);
    assert.equal(e.code, "EVENT_SUBSCRIPTION_FAILED");
    assert.equal(e.cause, addFailure);
    assert.deepEqual(e.cleanupErrors, [rollbackFailure]);
    return true;
  });
  target.dispatchEvent(new Event(type, null));
  assert.equal(calls, 0);
  assert.equal(removeCalls, 1);
  target.dispose();
});

test("R4 failed post-registration cancellation check also rolls back the local handler", () => {
  const target = new DisplayObject();
  const type = createEventType("review-post-check-failure");
  const checkFailure = new Error("adapter check failed");
  let checks = 0;
  let removeCalls = 0;
  let calls = 0;
  const signal = {
    get aborted() { checks++; if (checks === 1) return false; throw checkFailure; },
    reason: undefined,
    addEventListener() {},
    removeEventListener() { removeCalls++; },
  };
  assert.throws(() => target.on(type, () => { calls++; }, { signal }), (e) => e.code === "EVENT_SUBSCRIPTION_FAILED" && e.cause === checkFailure);
  target.dispatchEvent(new Event(type, null));
  assert.equal(calls, 0);
  assert.equal(removeCalls, 1);
  target.dispose();
});

test("R5 all listener failures and children finish before host close with aggregated causes", async () => {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  const type = createEventType("review-remove-failure");
  const firstFailure = new Error("first remove failed");
  const secondFailure = new Error("second remove failed");
  const childFailure = new Error("child remove failed");
  const trace = [];
  const badSignal = (label, failure) => ({ aborted: false, reason: undefined, addEventListener() {}, removeEventListener() { trace.push(label); throw failure; } });
  engine.stage.on(type, () => {}, { signal: badSignal("first", firstFailure) });
  engine.stage.on(type, () => {}, { signal: badSignal("second", secondFailure) });
  const child = engine.stage.addChild(new DisplayObject());
  child.on(type, () => {}, { signal: badSignal("child", childFailure) });
  const sibling = engine.stage.addChild(new DisplayObject());
  const closing = engine.dispose();
  await assert.rejects(closing, (e) => {
    assert.ok(e instanceof EgretError);
    assert.equal(e.code, "ENGINE_CLOSE_FAILED");
    assert.equal(e.cause, firstFailure);
    assert.deepEqual(e.cleanupErrors, [secondFailure, childFailure]);
    return true;
  });
  assert.deepEqual(trace, ["first", "second", "child"]);
  assert.deepEqual(h.trace, ["start", "stop", "close"]);
  assert.equal(child.isDisposed, true);
  assert.equal(sibling.isDisposed, true);
  assert.equal(engine.stage.isDisposed, true);
  assert.equal(engine.stage.numChildren, 0);
  assert.equal(engine.dispose(), closing);
  const replacement = await createEngine({ host: host({ surface: h.adapter.surface }).adapter });
  await replacement.dispose();
});

test("R5 listener failure still reaches bounded host close and retains ownership until success", async () => {
  const gate = deferred();
  const h = host({ close() { h.trace.push("close"); return gate.promise; } });
  const engine = await createEngine({ host: h.adapter, shutdownTimeoutMs: 7 });
  const type = createEventType("review-remove-timeout");
  const failure = new Error("remove failed before timeout");
  engine.stage.on(type, () => {}, { signal: { aborted: false, reason: undefined, addEventListener() {}, removeEventListener() { throw failure; } } });
  const child = engine.stage.addChild(new DisplayObject());
  const closing = engine.dispose();
  const outcome = closing.then(() => ({ fulfilled: true }), (error) => ({ error }));
  await flush();
  assert.deepEqual(h.trace, ["start", "stop", "close"]);
  assert.equal(child.isDisposed, true);
  assert.deepEqual([...h.timers].map((timer) => timer.delayMs), [7]);
  h.expire();
  const result = await outcome;
  assert.equal(result.error?.code, "ENGINE_CLOSE_TIMEOUT");
  assert.equal(result.error?.cause, failure);
  await assert.rejects(createEngine({ host: host({ surface: h.adapter.surface }).adapter }), (e) => e.code === "SURFACE_IN_USE");
  gate.resolve();
  await flush();
  const replacement = await createEngine({ host: host({ surface: h.adapter.surface }).adapter });
  await replacement.dispose();
});
