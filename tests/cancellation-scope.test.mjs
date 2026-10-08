import test from "node:test";
import assert from "node:assert/strict";
import { CancellationController, EgretError, createEngine } from "@egret/engine";
import { host } from "./helpers.mjs";

test("abort snapshots listeners, skips removals/additions and survives throws/reentry", () => {
  const failures = [];
  const controller = new CancellationController((diagnostic) => failures.push(diagnostic));
  const trace = [];
  const removed = () => trace.push("removed");
  controller.signal.addEventListener("abort", () => {
    trace.push("first");
    controller.signal.removeEventListener("abort", removed);
    controller.signal.addEventListener("abort", () => trace.push("late"));
    controller.abort("second reason");
    throw new Error("listener failed");
  });
  controller.signal.addEventListener("abort", removed);
  controller.signal.addEventListener("abort", () => trace.push("last"), { once: true });
  controller.abort("first reason");
  controller.abort("third reason");
  assert.deepEqual(trace, ["first", "last"]);
  assert.equal(controller.signal.aborted, true);
  assert.equal(controller.signal.reason, "first reason");
  assert.equal(failures.length, 1);
});

test("already cancelled signal does not replay and diagnostics cannot break notification", () => {
  const controller = new CancellationController(() => { throw new Error("diagnostic failed"); });
  let calls = 0;
  controller.signal.addEventListener("abort", () => { throw new Error("listener failed"); });
  controller.signal.addEventListener("abort", () => { calls++; });
  assert.doesNotThrow(() => controller.abort());
  controller.signal.addEventListener("abort", () => { calls += 10; });
  assert.equal(calls, 1);
  assert.equal(controller.signal.reason, undefined);
});

test("Scope closes before abort, deduplicates and cleans in reverse despite errors", async () => {
  const h = host();
  const diagnostics = [];
  const engine = await createEngine({ host: h.adapter, onDiagnostic: (d) => diagnostics.push(d) });
  const scope = engine.createScope();
  const trace = [];
  const first = { dispose() { trace.push("first"); } };
  scope.use(first);
  scope.use(first);
  scope.use({ release() { trace.push("second"); throw new Error("release failure"); } });
  scope.signal.addEventListener("abort", () => {
    trace.push(scope.state);
    scope.dispose();
    throw new Error("abort failure");
  });
  scope.dispose();
  scope.dispose();
  assert.deepEqual(trace, ["closing", "second", "first"]);
  assert.equal(scope.state, "closed");
  assert.equal(scope.signal.aborted, true);
  assert.ok(diagnostics.length >= 2);
  await engine.dispose();
});

test("Scope closing use keeps queued order and disposes only new unowned late values", async () => {
  const engine = await createEngine({ host: host().adapter });
  const scope = engine.createScope();
  const foreignScope = engine.createScope();
  const trace = [];
  const first = { dispose() { trace.push("first"); } };
  const foreign = foreignScope.use({ dispose() { trace.push("foreign"); } });
  scope.use(first);
  scope.use({ dispose() {
    trace.push("second");
    assert.throws(() => scope.use(first), (e) => e.code === "SCOPE_CLOSED");
    assert.throws(() => scope.use(foreign), (e) => e.code === "OWNERSHIP_CONFLICT");
    assert.throws(() => scope.use({ release() { trace.push("late"); } }), (e) => e.code === "SCOPE_CLOSED");
  } });
  scope.dispose();
  assert.deepEqual(trace, ["second", "late", "first"]);
  assert.throws(() => scope.use(first), (e) => e.code === "SCOPE_CLOSED");
  foreignScope.dispose();
  assert.deepEqual(trace, ["second", "late", "first", "foreign"]);
  await engine.dispose();
});

test("Scope cannot take another owner and a failing late cleanup remains associated", async () => {
  const engine = await createEngine({ host: host().adapter });
  const a = engine.createScope();
  const b = engine.createScope();
  const value = a.use({ dispose() {} });
  assert.throws(() => b.use(value), (e) => e.code === "OWNERSHIP_CONFLICT");
  b.dispose();
  const failure = new Error("late failure");
  assert.throws(() => b.use({ dispose() { throw failure; } }), (e) => {
    assert.ok(e instanceof EgretError);
    assert.equal(e.code, "SCOPE_CLOSED");
    assert.deepEqual(e.cleanupErrors, [failure]);
    return true;
  });
  await engine.dispose();
});

test("a fulfilled async value after cancellation has a synchronous cleanup exit", async () => {
  const engine = await createEngine({ host: host().adapter });
  const scope = engine.createScope();
  let released = 0;
  const result = Promise.resolve({ release() { released++; } });
  scope.dispose();
  const awaited = await result;
  assert.throws(() => scope.use(awaited), (e) => e.code === "SCOPE_CLOSED");
  assert.equal(released, 1);
  await engine.dispose();
});
