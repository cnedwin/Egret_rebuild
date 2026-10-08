import test from "node:test";
import assert from "node:assert/strict";
import { CancellationController, Event, EventDispatcher, DisplayObject, DisplayObjectContainer, createEventType } from "@egret/engine";

test("tree dispatch snapshots all stages, priority and listener edits before target", () => {
  const type = createEventType("snapshot", { bubbles: true });
  const root = new DisplayObjectContainer();
  const parent = root.addChild(new DisplayObjectContainer());
  const target = parent.addChild(new DisplayObject());
  const trace = [];
  const removeTarget = target.on(type, () => trace.push("removed"));
  root.on(type, () => {
    trace.push("root-capture");
    removeTarget();
    target.on(type, () => trace.push("new"));
    parent.removeChild(target);
  }, { capture: true });
  parent.on(type, () => trace.push("parent-capture"), { capture: true });
  target.on(type, () => trace.push("target-capture"), { capture: true });
  target.on(type, () => trace.push("high"), { priority: 2 });
  target.on(type, () => trace.push("equal-a"));
  target.on(type, () => trace.push("equal-b"));
  parent.on(type, () => trace.push("parent-bubble"));
  root.on(type, () => trace.push("root-bubble"));
  assert.equal(target.dispatchEvent(new Event(type, 7)), true);
  assert.deepEqual(trace, ["root-capture", "parent-capture", "target-capture", "high", "equal-a", "equal-b", "parent-bubble", "root-bubble"]);
  trace.length = 0;
  target.dispatchEvent(new Event(type, 8));
  assert.deepEqual(trace, ["target-capture", "high", "equal-a", "equal-b", "new"]);
});

test("once is removed before nested dispatch of a new event", () => {
  const type = createEventType("nested");
  const target = new EventDispatcher();
  const trace = [];
  target.on(type, () => {
    trace.push("once");
    target.dispatchEvent(new Event(type, null));
  }, { once: true });
  target.on(type, () => trace.push("regular"));
  target.dispatchEvent(new Event(type, null));
  assert.deepEqual(trace, ["once", "regular", "regular"]);
});

test("stopPropagation at target preserves both target groups", () => {
  const type = createEventType("stop", { bubbles: true });
  const root = new DisplayObjectContainer();
  const target = root.addChild(new DisplayObject());
  const trace = [];
  target.on(type, (event) => { trace.push("capture-a"); event.stopPropagation(); }, { capture: true });
  target.on(type, () => trace.push("capture-b"), { capture: true });
  target.on(type, () => trace.push("target"));
  root.on(type, () => trace.push("bubble"));
  target.dispatchEvent(new Event(type, null));
  assert.deepEqual(trace, ["capture-a", "capture-b", "target"]);
});

test("stopPropagation on ancestor completes that node and stopImmediate stops its remainder", () => {
  const type = createEventType("stop-ancestor", { bubbles: true });
  const root = new DisplayObjectContainer();
  const target = root.addChild(new DisplayObject());
  const trace = [];
  root.on(type, (event) => { trace.push("a"); event.stopPropagation(); }, { capture: true });
  root.on(type, () => trace.push("b"), { capture: true });
  target.on(type, () => trace.push("target"));
  target.dispatchEvent(new Event(type, null));
  assert.deepEqual(trace, ["a", "b"]);
  const service = new EventDispatcher();
  service.on(type, (event) => { trace.push("immediate"); event.stopImmediatePropagation(); }, { capture: true });
  service.on(type, () => trace.push("never"));
  service.dispatchEvent(new Event(type, null));
  assert.deepEqual(trace, ["a", "b", "immediate"]);
});

test("bubbles false still captures and preventDefault honors cancelable", () => {
  const plain = createEventType("plain");
  const cancelable = createEventType("cancelable", { cancelable: true });
  const root = new DisplayObjectContainer();
  const target = root.addChild(new DisplayObject());
  const trace = [];
  root.on(plain, () => trace.push("capture"), { capture: true });
  root.on(plain, () => trace.push("bubble"));
  target.on(plain, (event) => { trace.push("target"); event.preventDefault(); });
  target.on(cancelable, (event) => event.preventDefault());
  assert.equal(target.dispatchEvent(new Event(plain, null)), true);
  assert.deepEqual(trace, ["capture", "target"]);
  const event = new Event(cancelable, 42);
  assert.equal(target.dispatchEvent(event), false);
  assert.equal(event.payload, 42);
  assert.equal(event.defaultPrevented, true);
});

test("active Event reentry is rejected and throwing handlers restore state", () => {
  const type = createEventType("error");
  const target = new EventDispatcher();
  const event = new Event(type, "stable");
  const failure = new Error("handler");
  const remove = target.on(type, (current) => {
    assert.throws(() => target.dispatchEvent(current), (e) => e.code === "EVENT_ACTIVE");
    throw failure;
  });
  assert.throws(() => target.dispatchEvent(event), (e) => e === failure);
  assert.equal(event.currentTarget, undefined);
  remove();
  assert.equal(target.dispatchEvent(event), true);
  assert.equal(event.payload, "stable");
});

test("subscription cancellation is independent and already-aborted signal does not subscribe", () => {
  const type = createEventType("cancel");
  const target = new EventDispatcher();
  const controller = new CancellationController();
  let calls = 0;
  const handler = () => calls++;
  const unsubscribe = target.on(type, handler, { signal: controller.signal });
  target.on(type, handler);
  controller.abort();
  unsubscribe();
  unsubscribe();
  target.on(type, handler, { signal: controller.signal });
  target.dispatchEvent(new Event(type, null));
  assert.equal(calls, 1);
});

test("priority rejects nonfinite and fractional inputs before registration", () => {
  const type = createEventType("priority");
  const target = new EventDispatcher();
  for (const priority of [NaN, Infinity, 0.1]) {
    assert.throws(() => target.on(type, () => {}, { priority }), (e) => e.code === "INVALID_PRIORITY");
  }
});

test("runtime rejects a Promise-returning handler and observes its rejection", async () => {
  const type = createEventType("async-invalid");
  const dispatcher = new EventDispatcher();
  dispatcher.on(type, () => Promise.reject(new Error("async handler")));
  assert.throws(() => dispatcher.dispatchEvent(new Event(type, null)), (e) => e.code === "ASYNC_EVENT_HANDLER");
  await Promise.resolve();
});
