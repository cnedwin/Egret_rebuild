import test from "node:test";
import assert from "node:assert/strict";
import { DisplayObject, EgretError, Engine, Scope, Stage, createEngine } from "@egret/engine";
import { deferred, flush, host } from "./helpers.mjs";

test("asynchronous startup reserves surface before host.start finishes", async () => {
  const gate = deferred();
  const h = host({ start() { return gate.promise; } });
  const pending = createEngine({ host: h.adapter });
  await assert.rejects(createEngine({ host: h.adapter }), (e) => e.code === "SURFACE_IN_USE");
  gate.resolve();
  const engine = await pending;
  await engine.dispose();
  const second = await createEngine({ host: h.adapter });
  await second.dispose();
});

test("startup failure attempts cleanup and keeps original cause plus cleanup errors", async () => {
  const startFailure = new Error("start");
  const stopFailure = new Error("stop");
  const closeFailure = new Error("close");
  const trace = [];
  const h = host({
    start() { trace.push("start"); throw startFailure; },
    stop() { trace.push("stop"); throw stopFailure; },
    async close() { trace.push("close"); throw closeFailure; },
  });
  await assert.rejects(createEngine({ host: h.adapter }), (e) => {
    assert.ok(e instanceof EgretError);
    assert.equal(e.code, "ENGINE_START_FAILED");
    assert.equal(e.cause, startFailure);
    assert.deepEqual(e.cleanupErrors, [stopFailure, closeFailure]);
    return true;
  });
  assert.deepEqual(trace, ["start", "stop", "close"]);
  await assert.rejects(createEngine({ host: host({ surface: h.adapter.surface }).adapter }), (e) => e.code === "SURFACE_IN_USE");
});

test("dispose caches one Promise before synchronous reentry and rejects new work", async () => {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  const scope = engine.createScope();
  let nested;
  const node = scope.use(new DisplayObject());
  engine.stage.addChild(node);
  scope.signal.addEventListener("abort", () => {
    nested = engine.dispose();
    assert.throws(() => engine.createScope(), (e) => e.code === "ENGINE_CLOSED");
    assert.throws(() => engine.stage.addChild(new DisplayObject()), (e) => e.code === "ENGINE_CLOSED");
  });
  const first = engine.dispose();
  assert.equal(nested, first);
  assert.equal(engine.dispose(), first);
  await first;
  assert.equal(node.isDisposed, true);
  assert.equal(engine.stage.isDisposed, true);
  assert.equal(engine.dispose(), first);
  assert.deepEqual(h.trace, ["start", "stop", "close"]);
});

test("scope and stage cleanup precede stop/close, failed stop does not prevent close", async () => {
  const trace = [];
  const stopFailure = new Error("stop");
  const closeFailure = new Error("close");
  const h = host({
    stop() { trace.push("stop"); throw stopFailure; },
    async close() { trace.push("close"); throw closeFailure; },
  });
  const engine = await createEngine({ host: h.adapter });
  const scope = engine.createScope();
  scope.use({ dispose() { trace.push("resource"); } });
  scope.signal.addEventListener("abort", () => trace.push("abort"));
  const promise = engine.dispose();
  await assert.rejects(promise, (e) => {
    assert.equal(e.code, "ENGINE_CLOSE_FAILED");
    assert.equal(e.cause, stopFailure);
    assert.deepEqual(e.cleanupErrors, [closeFailure]);
    return true;
  });
  assert.deepEqual(trace, ["abort", "resource", "stop", "close"]);
  assert.equal(engine.stage.isDisposed, true);
  assert.equal(engine.dispose(), promise);
});

test("deadline rejects but keeps exclusive surface until late host completion", async () => {
  const closing = deferred();
  let destroyCalls = 0;
  const surface = { destroy() { destroyCalls++; } };
  const h = host({ surface, close() { return closing.promise; } });
  const engine = await createEngine({ host: h.adapter, shutdownTimeoutMs: 17 });
  const promise = engine.dispose();
  await flush();
  assert.deepEqual([...h.timers].map((timer) => timer.delayMs), [17]);
  h.expire();
  await assert.rejects(promise, (e) => e.code === "ENGINE_CLOSE_TIMEOUT");
  await assert.rejects(createEngine({ host: host({ surface }).adapter }), (e) => e.code === "SURFACE_IN_USE");
  assert.equal(destroyCalls, 0);
  closing.resolve();
  await flush();
  const replacement = await createEngine({ host: host({ surface }).adapter });
  await replacement.dispose();
  assert.equal(engine.dispose(), promise);
  assert.equal(destroyCalls, 0);
});

test("default deadline is 1000ms, late close rejection is observed and quarantines surface", async () => {
  const closing = deferred();
  const diagnostics = [];
  const h = host({ close() { return closing.promise; } });
  const engine = await createEngine({ host: h.adapter, onDiagnostic: (d) => diagnostics.push(d) });
  const promise = engine.dispose();
  await flush();
  assert.deepEqual([...h.timers].map((timer) => timer.delayMs), [1000]);
  h.expire();
  await assert.rejects(promise, (e) => e.code === "ENGINE_CLOSE_TIMEOUT");
  closing.reject(new Error("late"));
  await flush();
  assert.ok(diagnostics.some((d) => d.code === "HOST_CLOSE_LATE_FAILURE"));
  await assert.rejects(createEngine({ host: host({ surface: h.adapter.surface }).adapter }), (e) => e.code === "SURFACE_IN_USE");
});

test("shutdown timeout validates positive finite integers before claiming surface", async () => {
  const h = host();
  for (const shutdownTimeoutMs of [0, -1, 0.5, NaN, Infinity]) {
    await assert.rejects(createEngine({ host: h.adapter, shutdownTimeoutMs }), (e) => e.code === "INVALID_TIMEOUT");
  }
  const valid = await createEngine({ host: h.adapter });
  await valid.dispose();
});

test("onDiagnostic errors cannot interrupt Engine cleanup after scope failures", async () => {
  const h = host();
  const engine = await createEngine({ host: h.adapter, onDiagnostic() { throw new Error("observer"); } });
  const trace = [];
  const scope = engine.createScope();
  scope.use({ dispose() { trace.push("first"); } });
  const failure = new Error("resource");
  scope.use({ dispose() { trace.push("second"); throw failure; } });
  await assert.rejects(engine.dispose(), (e) => {
    assert.equal(e.code, "ENGINE_CLOSE_FAILED");
    assert.equal(e.cause, failure);
    return true;
  });
  assert.deepEqual(trace, ["second", "first"]);
  assert.equal(scope.state, "closed");
  assert.equal(engine.stage.isDisposed, true);
  assert.deepEqual(h.trace, ["start", "stop", "close"]);
});

test("startup failure cleanup has the same deadline and reserves late host work", async () => {
  const closeGate = deferred();
  const startFailure = new Error("start");
  const h = host({ start() { throw startFailure; }, close() { return closeGate.promise; } });
  const pending = createEngine({ host: h.adapter, shutdownTimeoutMs: 5 });
  const outcome = assert.rejects(pending, (e) => {
    assert.equal(e.code, "ENGINE_START_FAILED");
    assert.equal(e.cause, startFailure);
    assert.equal(e.cleanupErrors[0].code, "ENGINE_CLOSE_TIMEOUT");
    return true;
  });
  await flush();
  h.expire();
  await outcome;
  await assert.rejects(createEngine({ host: host({ surface: h.adapter.surface }).adapter }), (e) => e.code === "SURFACE_IN_USE");
  closeGate.resolve();
  await flush();
  const next = await createEngine({ host: host({ surface: h.adapter.surface }).adapter });
  await next.dispose();
});

test("failed host close never proves successful surface return", async () => {
  const failure = new Error("incomplete close");
  const h = host({ async close() { throw failure; } });
  const engine = await createEngine({ host: h.adapter });
  const closing = engine.dispose();
  await assert.rejects(closing, (e) => e.code === "ENGINE_CLOSE_FAILED" && e.cause === failure);
  await assert.rejects(createEngine({ host: host({ surface: h.adapter.surface }).adapter }), (e) => e.code === "SURFACE_IN_USE");
  assert.equal(engine.dispose(), closing);
});

test("diagnostic reentry returns the cached Engine close Promise", async () => {
  const h = host();
  let engine;
  let nested;
  const trace = [];
  engine = await createEngine({ host: h.adapter, onDiagnostic() {
    trace.push("diagnostic");
    nested = engine.dispose();
  } });
  const scope = engine.createScope();
  const failure = new Error("scope cleanup");
  scope.use({ dispose() { trace.push("good"); } });
  scope.use({ dispose() { trace.push("bad"); throw failure; } });
  const closing = engine.dispose();
  await assert.rejects(closing, (e) => e.cause === failure);
  assert.equal(nested, closing);
  assert.deepEqual(trace, ["bad", "diagnostic", "good"]);
  assert.deepEqual(h.trace, ["start", "stop", "close"]);
});

test("JavaScript callers cannot bypass factory-only Engine/Scope/Stage construction", () => {
  const context = { assertOpen() {}, report() {}, captureCleanup() {} };
  assert.throws(() => new Engine({ host: host().adapter }, 1000, () => {}), (e) => e.code === "ENGINE_FACTORY_REQUIRED");
  assert.throws(() => new Scope(context, () => {}), (e) => e.code === "SCOPE_FACTORY_REQUIRED");
  assert.throws(() => new Stage(context), (e) => e.code === "STAGE_FACTORY_REQUIRED");
});
