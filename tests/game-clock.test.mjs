import test from 'node:test';
import assert from 'node:assert/strict';
import { Sprite, createEngine } from '@egret/engine';
import { host } from './helpers.mjs';

test('GC01 initialized Engine owns an explicitly advanced clock', async () => {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  try {
    const scope = engine.createScope();
    const sprite = scope.use(new Sprite());
    sprite.graphics.beginFill(0x2753a1).drawRect(0, 0, 2, 3);
    engine.stage.addChild(sprite);
    const frame = engine.captureFrame({ width: 8, height: 8 });
    assert.equal(frame.frameId, 1);
    assert.equal(frame.commands.length, 1);
    assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 2, height: 3 });
    assert.equal(scope.state, 'open');
    // The initialized public baseline above must succeed before this feature witness.
    assert.equal(typeof engine.advanceTime, 'function', 'Engine.advanceTime is required');
    assert.equal(engine.clock.state, 'running');
    assert.equal(engine.clock.elapsedSeconds, 0);
    assert.equal(engine.clock.tickId, 0);
    assert.equal(engine.clock.maxDeltaSeconds, 0.25);
    assert.equal(engine.advanceTime(10), undefined);
  } finally {
    await engine.dispose();
  }
  assert.deepEqual(h.trace, ['start', 'stop', 'close']);
});

// Independent public CPU controls derived from the adopted clock contract.
// No callback below obtains expected time/order from clock implementation data.
import {
  Bitmap, EgretError, SequencePlayer, createAssetRef, createAssetType,
  createEngineForProfile, createImageData2D, createSequenceClip, createTexture,
  copyImageData2DPixels, isTexture, TEXTURED_FRAME_PROFILE_2D,
} from '@egret/engine';
import { deferred, flush } from './helpers.mjs';

const CLOCK_FRAME_OPTIONS = Object.freeze({ width: 8, height: 8, clearColor: 0, clearAlpha: 0 });
const CLOCK_FRAME_METHODS = Object.freeze(['captureFrame', 'renderFrame', 'captureTexturedFrame', 'renderTexturedFrame']);

function expectClockError(action, code, cause) {
  const checkCause = arguments.length === 3;
  let caught;
  assert.throws(action, error => {
    caught = error;
    assert.ok(error instanceof EgretError);
    assert.equal(error.code, code);
    if (checkCause) assert.equal(error.cause, cause);
    return true;
  });
  return caught;
}
function clockObservations(clock) {
  return { state: clock.state, elapsedSeconds: clock.elapsedSeconds, tickId: clock.tickId, maxDeltaSeconds: clock.maxDeltaSeconds };
}
function clockProfileHost(overrides = {}) {
  return host({
    texturedFrameProfile: TEXTURED_FRAME_PROFILE_2D,
    renderFrame() {}, renderTexturedFrame() {}, ...overrides,
  });
}
function unreadClockFrameOptions(counter) {
  return {
    get width() { counter.reads++; throw new Error('frame width must stay unread'); },
    get height() { counter.reads++; throw new Error('frame height must stay unread'); },
    get clearColor() { counter.reads++; throw new Error('frame color must stay unread'); },
    get clearAlpha() { counter.reads++; throw new Error('frame alpha must stay unread'); },
  };
}
const CLOCK_FACTORIES = Object.freeze([
  { name: 'ordinary', make: options => createEngine(options), makeHost: () => host() },
  { name: 'profile', make: options => createEngineForProfile(options, TEXTURED_FRAME_PROFILE_2D), makeHost: () => clockProfileHost() },
]);

// GC02: the controlled host boundary records work; its close deadline is separate.
test('GC02 constructing, subscribing and reading performs no implicit tick or render', async () => {
  let callbacks = 0, frames = 0, deadlineCalls = 0;
  const h = clockProfileHost({
    renderFrame() { frames++; }, renderTexturedFrame() { frames++; },
    setTimeout() { deadlineCalls++; return () => {}; },
  });
  const engine = await createEngineForProfile({ host: h.adapter }, TEXTURED_FRAME_PROFILE_2D);
  try {
    const scope = engine.createScope();
    const subscription = engine.clock.onTick(scope, () => { callbacks++; });
    assert.equal(subscription.isDisposed, false);
    assert.deepEqual(clockObservations(engine.clock), { state: 'running', elapsedSeconds: 0, tickId: 0, maxDeltaSeconds: 0.25 });
    await flush();
    assert.deepEqual([callbacks, frames, deadlineCalls, h.timers.size], [0, 0, 0, 0]);
    assert.deepEqual(h.trace, ['start']);
  } finally { await engine.dispose(); }
  assert.equal(callbacks, 0); assert.equal(frames, 0);
  assert.deepEqual(h.trace, ['start', 'stop', 'close']);
});

// GC03: genuine factories, successful negotiation, and pre-start refusal controls.
test('GC03 both factories snapshot valid clock options once and preserve admission priority', async () => {
  for (const factory of CLOCK_FACTORIES) {
    for (const [clock, expected] of [[undefined, 0.25], [{}, 0.25], [{ maxDeltaSeconds: undefined }, 0.25], [{ maxDeltaSeconds: 0.125 }, 0.125], [{ maxDeltaSeconds: 1 }, 1]]) {
      const h = factory.makeHost();
      const engine = await factory.make({ host: h.adapter, ...(clock === undefined ? {} : { clock }) });
      try { assert.equal(engine.clock.maxDeltaSeconds, expected, factory.name); }
      finally { await engine.dispose(); }
    }
    const log = [], h = factory.makeHost();
    const input = {
      get maxDeltaSeconds() { log.push('maxDeltaSeconds'); return 0.125; },
      get unrelated() { throw new Error('unrelated option must be ignored'); },
    };
    const engine = await factory.make({ host: h.adapter, get clock() { log.push('clock'); return input; } });
    try {
      assert.deepEqual(log, ['clock', 'maxDeltaSeconds']);
      Object.defineProperty(input, 'maxDeltaSeconds', { value: 1 });
      assert.equal(engine.clock.maxDeltaSeconds, 0.125);
      assert.deepEqual(log, ['clock', 'maxDeltaSeconds']);
    } finally { await engine.dispose(); }
    for (const bad of [0, -0, -1, Infinity, NaN, 1.0001, null, '0.25']) {
      const port = factory.makeHost(); let surfaceReads = 0;
      const surface = port.adapter.surface;
      Object.defineProperty(port.adapter, 'surface', { configurable: true, get() { surfaceReads++; return surface; } });
      await assert.rejects(factory.make({ host: port.adapter, clock: { maxDeltaSeconds: bad } }), error => error instanceof EgretError && error.code === 'CLOCK_OPTIONS_INVALID');
      assert.equal(surfaceReads, 0); assert.deepEqual(port.trace, []);
      const replacement = await factory.make({ host: port.adapter });
      await replacement.dispose();
      assert.ok(surfaceReads > 0); assert.deepEqual(port.trace, ['start', 'stop', 'close']);
    }
    for (const bad of [null, 0, true, 'clock', [], () => undefined]) {
      const port = factory.makeHost(); let surfaceReads = 0;
      const surface = port.adapter.surface;
      Object.defineProperty(port.adapter, 'surface', { configurable: true, get() { surfaceReads++; return surface; } });
      await assert.rejects(factory.make({ host: port.adapter, clock: bad }), error => error instanceof EgretError && error.code === 'CLOCK_OPTIONS_INVALID');
      assert.equal(surfaceReads, 0); assert.deepEqual(port.trace, []);
      const replacement = await factory.make({ host: port.adapter }); await replacement.dispose();
    }
    // A revoked Proxy is an authentic JavaScript input failure, not a fake clock.
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const revokedPort = factory.makeHost(); let revokedSurfaceReads = 0;
    const revokedSurface = revokedPort.adapter.surface;
    Object.defineProperty(revokedPort.adapter, 'surface', { configurable: true, get() { revokedSurfaceReads++; return revokedSurface; } });
    await assert.rejects(factory.make({ host: revokedPort.adapter, clock: revoked.proxy }), error => {
      assert.ok(error instanceof EgretError); assert.equal(error.code, 'CLOCK_OPTIONS_INVALID'); assert.ok(error.cause instanceof TypeError); return true;
    });
    assert.equal(revokedSurfaceReads, 0); assert.deepEqual(revokedPort.trace, []);
    const recovered = await factory.make({ host: revokedPort.adapter }); await recovered.dispose();
    assert.ok(revokedSurfaceReads > 0); assert.deepEqual(revokedPort.trace, ['start', 'stop', 'close']);
    for (const key of ['clock', 'maxDeltaSeconds']) {
      const port = factory.makeHost(), cause = new Error(`${factory.name}-${key}-read`);
      let reads = 0;
      const options = key === 'clock'
        ? { host: port.adapter, get clock() { reads++; throw cause; } }
        : { host: port.adapter, clock: { get maxDeltaSeconds() { reads++; throw cause; } } };
      await assert.rejects(factory.make(options), error => {
        assert.ok(error instanceof EgretError); assert.equal(error.code, 'CLOCK_OPTIONS_INVALID'); assert.equal(error.cause, cause); return true;
      });
      assert.equal(reads, 1); assert.deepEqual(port.trace, []);
      const replacement = await factory.make({ host: port.adapter }); await replacement.dispose();
    }
    for (const priority of ['renderer', 'timeout', 'diagnostic']) {
      const port = factory.makeHost(), cause = new Error('diagnostic option read'); let clockReads = 0;
      if (priority === 'renderer') port.adapter.renderFrame = 7;
      const options = { host: port.adapter, get clock() { clockReads++; throw new Error('late clock option'); } };
      if (priority === 'timeout') options.shutdownTimeoutMs = 0;
      if (priority === 'diagnostic') Object.defineProperty(options, 'onDiagnostic', { get() { throw cause; } });
      await assert.rejects(factory.make(options), error => {
        if (priority === 'diagnostic') assert.equal(error, cause);
        else { assert.ok(error instanceof EgretError); assert.equal(error.code, priority === 'renderer' ? 'INVALID_RENDERER' : 'INVALID_TIMEOUT'); }
        return true;
      });
      assert.equal(clockReads, 0); assert.deepEqual(port.trace, []);
    }
  }
  let reads = 0;
  const options = new Proxy({}, { get() { reads++; throw new Error('unsupported profile options'); } });
  await assert.rejects(createEngineForProfile(options, 'unsupported-clock-profile'), error => error instanceof EgretError && error.code === 'ENGINE_RENDER_PROFILE_UNSUPPORTED');
  assert.equal(reads, 0);
});

test('GC04 dyadic ticks commit exact scalar values and share one immutable payload per dispatch', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const scope = engine.createScope(), a = [], b = [];
    const committedObservations = [[0.125, 1], [0.25, 2], [0.5, 3]];
    engine.clock.onTick(scope, tick => {
      assert.equal(engine.clock.elapsedSeconds, committedObservations[a.length][0]);
      assert.equal(engine.clock.tickId, committedObservations[a.length][1]);
      a.push(tick);
    });
    engine.clock.onTick(scope, tick => {
      assert.equal(engine.clock.elapsedSeconds, committedObservations[b.length][0]);
      assert.equal(engine.clock.tickId, committedObservations[b.length][1]);
      b.push(tick);
    });
    assert.equal(engine.advanceTime(10), undefined); assert.equal(engine.advanceTime(10), undefined);
    assert.deepEqual([a.length, b.length], [0, 0]);
    const one = engine.advanceTime(10.125), two = engine.advanceTime(10.25), three = engine.advanceTime(10.5);
    assert.deepEqual(one, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual(two, { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    assert.deepEqual(three, { tickId: 3, elapsedSeconds: 0.5, deltaSeconds: 0.25 });
    assert.deepEqual(a, [one, two, three]); assert.deepEqual(b, [one, two, three]);
    for (let i = 0; i < 3; i++) { assert.equal(a[i], b[i]); assert.equal(a[i], [one, two, three][i]); assert.ok(Object.isFrozen(a[i])); assert.deepEqual(Reflect.ownKeys(a[i]).sort(), ['deltaSeconds', 'elapsedSeconds', 'tickId']); }
    assert.notEqual(one, two); assert.notEqual(two, three); assert.notEqual(one, three);
    assert.deepEqual(one, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
  } finally { await engine.dispose(); }
});

test('GC05 invalid sources preserve the committed floor, anchor, time and callbacks', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const ticks = []; engine.clock.onTick(engine.createScope(), tick => { ticks.push(tick); });
    engine.advanceTime(10); const first = engine.advanceTime(10.125);
    let coercions = 0; const object = { valueOf() { coercions++; return 10.25; } };
    for (const bad of [undefined, null, '10.25', NaN, Infinity, -Infinity, -1, object]) {
      expectClockError(() => engine.advanceTime(bad), 'CLOCK_SOURCE_INVALID');
      assert.deepEqual(clockObservations(engine.clock), { state: 'running', elapsedSeconds: 0.125, tickId: 1, maxDeltaSeconds: 0.25 });
      assert.deepEqual(ticks, [first]);
    }
    assert.equal(coercions, 0);
    const next = engine.advanceTime(10.25);
    assert.deepEqual(next, { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    assert.deepEqual(ticks, [first, next]);
  } finally { await engine.dispose(); }
  const zeroEngine = await createEngine({ host: host().adapter });
  try {
    assert.equal(zeroEngine.advanceTime(-0), undefined); assert.equal(zeroEngine.advanceTime(0), undefined);
    assert.equal(Object.is(zeroEngine.clock.elapsedSeconds, -0), false);
    assert.deepEqual(zeroEngine.advanceTime(0.125), { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
  } finally { await zeroEngine.dispose(); }
});

test('GC06 backward source refusal survives resume and does not consume a new baseline', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const ticks = []; engine.clock.onTick(engine.createScope(), tick => { ticks.push(tick); });
    engine.advanceTime(10); engine.advanceTime(10.125);
    expectClockError(() => engine.advanceTime(10), 'CLOCK_SOURCE_BACKWARDS');
    assert.deepEqual(engine.advanceTime(10.25), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    engine.clock.pause(); engine.clock.resume();
    expectClockError(() => engine.advanceTime(10.125), 'CLOCK_SOURCE_BACKWARDS');
    assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId, ticks.length], [0.25, 2, 2]);
    assert.equal(engine.advanceTime(20), undefined);
    assert.deepEqual(engine.advanceTime(20.125), { tickId: 3, elapsedSeconds: 0.375, deltaSeconds: 0.125 });
    assert.equal(ticks.length, 3);
  } finally { await engine.dispose(); }
});

test('GC07 rejected hitch samples stay rejected until an explicit pause/resume baseline', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const ticks = []; engine.clock.onTick(engine.createScope(), tick => { ticks.push(tick); });
    engine.advanceTime(10); engine.advanceTime(10.125);
    for (const source of [11, 11.125]) expectClockError(() => engine.advanceTime(source), 'CLOCK_DELTA_LIMIT');
    engine.clock.resume(); expectClockError(() => engine.advanceTime(11.25), 'CLOCK_DELTA_LIMIT');
    assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId, ticks.length], [0.125, 1, 1]);
    engine.clock.pause(); engine.clock.resume(); assert.equal(engine.advanceTime(11), undefined);
    assert.deepEqual(engine.advanceTime(11.125), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    assert.equal(ticks.length, 2);
  } finally { await engine.dispose(); }
  const bounded = await createEngine({ host: host().adapter, clock: { maxDeltaSeconds: 0.125 } });
  try {
    bounded.advanceTime(0); assert.deepEqual(bounded.advanceTime(0.125), { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    expectClockError(() => bounded.advanceTime(0.375), 'CLOCK_DELTA_LIMIT');
    assert.deepEqual(bounded.advanceTime(0.25), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
  } finally { await bounded.dispose(); }
});

test('GC08 paused samples retain the source floor and resume excludes the whole gap', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const ticks = []; engine.clock.onTick(engine.createScope(), tick => { ticks.push(tick); });
    engine.advanceTime(2); engine.advanceTime(2.125); engine.clock.pause(); engine.clock.pause();
    assert.equal(engine.clock.state, 'paused'); assert.equal(engine.advanceTime(100), undefined);
    expectClockError(() => engine.advanceTime(99), 'CLOCK_SOURCE_BACKWARDS');
    assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId, ticks.length], [0.125, 1, 1]);
    engine.clock.resume(); engine.clock.resume(); assert.equal(engine.clock.state, 'running');
    assert.equal(engine.advanceTime(200), undefined);
    assert.deepEqual(engine.advanceTime(200.125), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    assert.equal(ticks.length, 2);
  } finally { await engine.dispose(); }
});

test('GC09 independent registrations reach the live ceiling and reuse one disposed slot once', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const scope = engine.createScope(); let calls = 0;
    for (const bad of [undefined, null, 0, {}, 'handler']) expectClockError(() => engine.clock.onTick(scope, bad), 'CLOCK_HANDLER_INVALID');
    const sameHandler = () => { calls++; }, handles = [];
    for (let i = 0; i < 256; i++) handles.push(engine.clock.onTick(scope, sameHandler));
    assert.equal(new Set(handles).size, 256); assert.ok(handles.every(handle => !handle.isDisposed));
    expectClockError(() => engine.clock.onTick(scope, undefined), 'CLOCK_HANDLER_INVALID');
    expectClockError(() => engine.clock.onTick(scope, sameHandler), 'CLOCK_CALLBACK_LIMIT');
    handles[128].dispose(); handles[128].dispose(); assert.equal(handles[128].isDisposed, true);
    const replacement = engine.clock.onTick(scope, sameHandler); assert.notEqual(replacement, handles[128]);
    assert.equal(engine.advanceTime(0), undefined); engine.advanceTime(0.125); assert.equal(calls, 256);
    engine.advanceTime(0.25); assert.equal(calls, 512);
    scope.dispose(); assert.equal(replacement.isDisposed, true); assert.ok(handles.every(handle => handle.isDisposed));
    engine.advanceTime(0.375); assert.equal(calls, 512); assert.equal(engine.clock.state, 'running');
  } finally { await engine.dispose(); }
});

test('GC10 dispatch snapshots retain registration order across disposal and slot reuse', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const scope = engine.createScope(), order = []; let a, b, d;
    a = engine.clock.onTick(scope, () => { order.push('A'); b.dispose(); a.dispose(); d = engine.clock.onTick(scope, () => { order.push('D'); }); });
    b = engine.clock.onTick(scope, () => { order.push('B'); });
    const c = engine.clock.onTick(scope, () => { order.push('C'); });
    engine.advanceTime(0); engine.advanceTime(0.125);
    assert.deepEqual(order, ['A', 'C']); assert.equal(a.isDisposed, true); assert.equal(b.isDisposed, true); assert.equal(d.isDisposed, false);
    order.length = 0; engine.advanceTime(0.25); assert.deepEqual(order, ['C', 'D']); assert.equal(c.isDisposed, false);
  } finally { await engine.dispose(); }
});

test('GC11 authentic same-Engine Scope admission ignores public overrides and preserves ownership', async () => {
  const engine = await createEngine({ host: host().adapter }), other = await createEngine({ host: host().adapter });
  try {
    const foreign = other.createScope();
    expectClockError(() => engine.clock.onTick({}, undefined), 'CLOCK_SCOPE_INVALID');
    expectClockError(() => engine.clock.onTick(foreign, undefined), 'CLOCK_SCOPE_INVALID');
    const closed = engine.createScope(); closed.dispose();
    expectClockError(() => engine.clock.onTick(closed, undefined), 'SCOPE_CLOSED');
    const closing = engine.createScope(); let abortCalls = 0, closingState, closingError;
    closing.signal.addEventListener('abort', () => {
      abortCalls++; closingState = closing.state;
      try { engine.clock.onTick(closing, undefined); } catch (error) { closingError = error; }
    });
    closing.dispose(); assert.equal(abortCalls, 1); assert.equal(closingState, 'closing');
    // Abort observers isolate their own exceptions; assert the captured outcome outside them.
    assert.ok(closingError instanceof EgretError); assert.equal(closingError.code, 'SCOPE_CLOSED');
    const scope = engine.createScope(), second = engine.createScope();
    const intrinsicUse = Object.getPrototypeOf(scope).use; let overrideReads = 0, ownCalls = 0, secondCalls = 0;
    Object.defineProperty(scope, 'state', { configurable: true, get() { overrideReads++; throw new Error('public state override'); } });
    Object.defineProperty(scope, 'use', { configurable: true, value() { overrideReads++; throw new Error('public use override'); } });
    const handle = engine.clock.onTick(scope, () => { ownCalls++; });
    const secondHandle = engine.clock.onTick(second, () => { secondCalls++; });
    assert.equal(overrideReads, 0); assert.equal(intrinsicUse.call(scope, handle), handle);
    expectClockError(() => second.use(handle), 'OWNERSHIP_CONFLICT'); assert.equal(handle.isDisposed, false);
    engine.advanceTime(0); engine.advanceTime(0.125); assert.deepEqual([ownCalls, secondCalls], [1, 1]);
    scope.dispose(); assert.equal(handle.isDisposed, true); assert.equal(secondHandle.isDisposed, false);
    engine.advanceTime(0.25); assert.deepEqual([ownCalls, secondCalls], [1, 2]); assert.equal(engine.clock.state, 'running');
    assert.equal(overrideReads, 0);
  } finally { await engine.dispose(); await other.dispose(); }
});
// GC12: real resources and their owner order establish the finally barrier.
test('GC12 closing inside a callback retires handles immediately and defers genuine cleanup', async () => {
  const order = []; let engine, closing, texture, bitmap;
  const h = host({
    stop() { assert.equal(engine.stage.isDisposed, true); assert.equal(texture.isDisposed, true); order.push('host-stop'); },
    async close() { order.push('host-close'); },
  });
  engine = await createEngine({ host: h.adapter });
  const image = createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([39, 83, 161, 255]) });
  texture = createTexture(image);
  const type = createAssetType('clock-close-atlas', isTexture);
  engine.assets.register(type, { async load() { return texture; }, dispose(value) {
    assert.equal(value, texture); assert.equal(engine.stage.isDisposed, true); assert.equal(bitmap.isDisposed, true);
    order.push('asset-after-stage'); value.dispose();
  } });
  const lease = await engine.assets.acquire(createAssetRef(type, 'clock-close-atlas'));
  bitmap = new Bitmap(lease); engine.stage.addChild(bitmap);
  const scope = engine.createScope(); scope.use({ dispose() { order.push('scope-cleanup'); assert.equal(engine.stage.isDisposed, false); } });
  let a, b;
  try {
    a = engine.clock.onTick(scope, () => {
      order.push('A-start'); closing = engine.dispose(); assert.equal(engine.dispose(), closing);
      order.push('dispose-returned');
      assert.equal(engine.clock.state, 'closed'); assert.equal(a.isDisposed, true); assert.equal(b.isDisposed, true);
      assert.equal(scope.state, 'open'); assert.equal(engine.stage.isDisposed, false); assert.equal(texture.isDisposed, false);
      expectClockError(() => engine.advanceTime(NaN), 'ENGINE_CLOSED');
      expectClockError(() => engine.clock.onTick({}, undefined), 'ENGINE_CLOSED');
      const counter = { reads: 0 }; expectClockError(() => engine.captureFrame(unreadClockFrameOptions(counter)), 'ENGINE_CLOSED'); assert.equal(counter.reads, 0);
      assert.deepEqual(order, ['A-start', 'dispose-returned']); order.push('A-end');
    });
    b = engine.clock.onTick(scope, () => { order.push('B'); });
    engine.advanceTime(0); const committed = engine.advanceTime(0.125);
    assert.deepEqual(committed, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual(order, ['A-start', 'dispose-returned', 'A-end']);
    await closing;
    assert.deepEqual(order, ['A-start', 'dispose-returned', 'A-end', 'scope-cleanup', 'asset-after-stage', 'host-stop', 'host-close']);
    assert.equal(scope.state, 'closed'); assert.equal(engine.dispose(), closing);
    expectClockError(() => lease.value, 'ASSET_LEASE_RELEASED'); lease.release();
  } finally { await engine.dispose(); }
});

test('GC12 callback failure after close keeps its exact cause and existing cleanup failure separately', async () => {
  const order = [], callbackCause = new Error('clock callback after dispose'), cleanupCause = new Error('clock scoped cleanup');
  let engine, closing;
  const h = host({ stop() { order.push('stop'); }, async close() { order.push('close'); } });
  engine = await createEngine({ host: h.adapter });
  const scope = engine.createScope(); scope.use({ dispose() { order.push('scope'); throw cleanupCause; } });
  engine.clock.onTick(scope, () => { order.push('A'); closing = engine.dispose(); assert.equal(closing, engine.dispose()); order.push('A-end'); throw callbackCause; });
  const b = engine.clock.onTick(scope, () => { order.push('B'); });
  try {
    engine.advanceTime(0); expectClockError(() => engine.advanceTime(0.125), 'CLOCK_CALLBACK_FAILED', callbackCause);
    assert.deepEqual(order, ['A', 'A-end']); assert.equal(b.isDisposed, true); assert.equal(engine.clock.state, 'closed');
    assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId], [0.125, 1]);
    await assert.rejects(closing, error => {
      assert.ok(error instanceof EgretError); assert.equal(error.code, 'ENGINE_CLOSE_FAILED'); assert.equal(error.cause, cleanupCause); return true;
    });
    assert.deepEqual(order, ['A', 'A-end', 'scope', 'stop', 'close']); assert.equal(engine.dispose(), closing);
  } finally { await engine.dispose().catch(() => {}); }
});

// The Node test timeout bounds a broken fixture run; it is not a product latency target.
test('GC12 close does not await a callback return that is a forbidden pending Promise', { timeout: 2000 }, async () => {
  const pending = deferred(), enteredHostClose = deferred(), hostClose = deferred(), order = [];
  let engine, closing;
  const h = host({
    stop() { order.push('stop'); },
    close() { order.push('close-entered'); enteredHostClose.resolve(); return hostClose.promise; },
  });
  engine = await createEngine({ host: h.adapter });
  const scope = engine.createScope(); scope.use({ dispose() { order.push('scope'); } });
  engine.clock.onTick(scope, () => { order.push('A'); closing = engine.dispose(); assert.equal(closing, engine.dispose()); order.push('A-end'); return pending.promise; });
  engine.clock.onTick(scope, () => { order.push('B'); });
  try {
    engine.advanceTime(0); const error = expectClockError(() => engine.advanceTime(0.125), 'CLOCK_CALLBACK_FAILED');
    assert.ok(error.cause instanceof EgretError); assert.equal(error.cause.code, 'CLOCK_CALLBACK_RETURN_INVALID');
    assert.deepEqual(order, ['A', 'A-end']); assert.equal(engine.clock.state, 'closed');
    await enteredHostClose.promise;
    assert.deepEqual(order, ['A', 'A-end', 'scope', 'stop', 'close-entered']);
    // The forbidden callback Promise is still pending when real host retirement is reached.
    hostClose.resolve(); await closing; assert.equal(engine.dispose(), closing);
    assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId], [0.125, 1]);
  } finally { pending.resolve(); hostClose.resolve(); await engine.dispose(); }
});
test('GC13 time/frame phase guards precede payload reads and do not cross Engine instances', async () => {
  let engine, portCalls = 0;
  const h = clockProfileHost({ renderFrame() {
    portCalls++; expectClockError(() => engine.advanceTime(NaN), 'CLOCK_REENTRANT');
    for (const method of CLOCK_FRAME_METHODS) {
      const counter = { reads: 0 }; expectClockError(() => engine[method](unreadClockFrameOptions(counter)), 'FRAME_REENTRANT'); assert.equal(counter.reads, 0);
    }
  } });
  engine = await createEngineForProfile({ host: h.adapter }, TEXTURED_FRAME_PROFILE_2D);
  const other = await createEngine({ host: host().adapter });
  try {
    const otherTicks = []; other.clock.onTick(other.createScope(), tick => { otherTicks.push(tick); }); other.advanceTime(4);
    let calls = 0;
    engine.clock.onTick(engine.createScope(), () => {
      calls++; expectClockError(() => engine.advanceTime(NaN), 'CLOCK_REENTRANT');
      for (const method of CLOCK_FRAME_METHODS) {
        const counter = { reads: 0 }; expectClockError(() => engine[method](unreadClockFrameOptions(counter)), 'CLOCK_REENTRANT'); assert.equal(counter.reads, 0);
      }
      assert.deepEqual(other.advanceTime(4.125), { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    });
    engine.advanceTime(10); assert.deepEqual(engine.advanceTime(10.125), { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual([calls, portCalls, otherTicks.length, engine.clock.tickId, other.clock.tickId], [1, 0, 1, 1, 1]);
    const frame = engine.renderFrame(CLOCK_FRAME_OPTIONS); assert.equal(frame.frameId, 1); assert.equal(portCalls, 1);
    assert.equal(engine.captureFrame(CLOCK_FRAME_OPTIONS).frameId, 2); assert.equal(calls, 1);
    assert.deepEqual(otherTicks[0], { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual([engine.clock.elapsedSeconds, other.clock.elapsedSeconds], [0.125, 0.125]);
  } finally { await engine.dispose(); await other.dispose(); }
});

test('GC14 pause inside dispatch stops later candidates and resume needs an outside fresh baseline', async () => {
  const engine = await createEngine({ host: host().adapter });
  try {
    const scope = engine.createScope(), order = []; let first = true;
    engine.clock.onTick(scope, () => {
      order.push('A'); if (first) {
        first = false;
        assert.equal(engine.clock.state, 'running');
        expectClockError(() => engine.clock.resume(), 'CLOCK_REENTRANT');
        engine.clock.pause(); expectClockError(() => engine.clock.resume(), 'CLOCK_REENTRANT');
      }
    });
    engine.clock.onTick(scope, () => { order.push('B'); });
    engine.advanceTime(0); assert.deepEqual(engine.advanceTime(0.125), { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual(order, ['A']); assert.equal(engine.clock.state, 'paused');
    engine.clock.resume(); assert.equal(engine.advanceTime(10), undefined); assert.deepEqual(order, ['A']);
    assert.deepEqual(engine.advanceTime(10.125), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    assert.deepEqual(order, ['A', 'A', 'B']); assert.equal(engine.clock.state, 'running');
  } finally { await engine.dispose(); }
});

test('GC15 callback and diagnostic failures preserve commit, exact cause and no-replay behavior', async () => {
  const primary = new Error('clock-primary'), observer = new Error('clock-observer'), diagnostics = [], order = [];
  const engine = await createEngine({ host: host().adapter, onDiagnostic(envelope) { diagnostics.push(envelope); throw observer; } });
  try {
    const scope = engine.createScope(); let gameState = 0;
    const a = engine.clock.onTick(scope, () => { order.push('A'); gameState++; throw primary; });
    engine.clock.onTick(scope, () => { order.push('B'); });
    engine.advanceTime(0); expectClockError(() => engine.advanceTime(0.125), 'CLOCK_CALLBACK_FAILED', primary);
    assert.equal(gameState, 1); assert.deepEqual(order, ['A']); assert.equal(a.isDisposed, false);
    assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId], [0.125, 1]);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, 'CLOCK_CALLBACK_FAILED'); assert.equal(diagnostics[0].phase, 'engine'); assert.equal(diagnostics[0].severity, 'error'); assert.equal(diagnostics[0].cause, primary);
    assert.equal(engine.advanceTime(0.125), undefined); assert.deepEqual(order, ['A']); assert.equal(gameState, 1); assert.equal(diagnostics.length, 1);
    a.dispose(); assert.deepEqual(engine.advanceTime(0.25), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 });
    assert.deepEqual(order, ['A', 'B']); assert.equal(diagnostics.length, 1);
    assert.equal(engine.captureFrame(CLOCK_FRAME_OPTIONS).frameId, 1);
  } finally { await engine.dispose(); }
});

test('GC15 pausing and then throwing retains both the pause and the primary failure', async () => {
  const cause = new Error('paused callback failure'), engine = await createEngine({ host: host().adapter });
  try {
    const scope = engine.createScope(); let laterCalls = 0;
    const a = engine.clock.onTick(scope, () => { engine.clock.pause(); throw cause; });
    engine.clock.onTick(scope, () => { laterCalls++; });
    engine.advanceTime(0); expectClockError(() => engine.advanceTime(0.125), 'CLOCK_CALLBACK_FAILED', cause);
    assert.equal(engine.clock.state, 'paused'); assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId, laterCalls], [0.125, 1, 0]);
    a.dispose(); engine.clock.resume(); assert.equal(engine.advanceTime(10), undefined); engine.advanceTime(10.125); assert.equal(laterCalls, 1);
  } finally { await engine.dispose(); }
});

// Native Promise and thenable witnesses are harness-owned; there is no async clock contract.
test('GC16 non-undefined returns refuse dispatch and handle rejected observations without awaiting', async () => {
  const unhandled = [], onUnhandled = reason => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  try {
    for (const kind of ['null', 'scalar', 'promise', 'throwing-then-getter', 'throwing-then-call', 'rejecting-thenable']) {
      const cause = new Error(`returned-${kind}`), gate = deferred(); let thenReads = 0, thenCalls = 0, laterCalls = 0;
      const returned = kind === 'null' ? null : kind === 'scalar' ? 7 : kind === 'promise' ? gate.promise : kind === 'throwing-then-getter'
        ? { get then() { thenReads++; throw cause; } }
        : kind === 'throwing-then-call' ? { then() { thenCalls++; throw cause; } }
        : { then(_resolve, reject) { thenCalls++; reject(cause); } };
      const engine = await createEngine({ host: host().adapter });
      try {
        const scope = engine.createScope(); const bad = engine.clock.onTick(scope, () => returned);
        engine.clock.onTick(scope, () => { laterCalls++; });
        engine.advanceTime(0); const error = expectClockError(() => engine.advanceTime(0.125), 'CLOCK_CALLBACK_FAILED');
        assert.ok(error.cause instanceof EgretError); assert.equal(error.cause.code, 'CLOCK_CALLBACK_RETURN_INVALID');
        assert.deepEqual([engine.clock.elapsedSeconds, engine.clock.tickId, laterCalls], [0.125, 1, 0]);
        assert.equal(bad.isDisposed, false); assert.equal(engine.advanceTime(0.125), undefined); assert.equal(laterCalls, 0);
        if (kind === 'promise') gate.reject(cause);
        await flush();
        // One Node event-loop turn observes actual unhandled-rejection delivery, not game time.
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(unhandled, []);
        if (kind === 'throwing-then-getter') assert.ok(thenReads > 0);
        if (kind === 'throwing-then-call' || kind === 'rejecting-thenable') assert.ok(thenCalls > 0);
        assert.equal(error.cause.code, 'CLOCK_CALLBACK_RETURN_INVALID');
        bad.dispose(); assert.deepEqual(engine.advanceTime(0.25), { tickId: 2, elapsedSeconds: 0.25, deltaSeconds: 0.125 }); assert.equal(laterCalls, 1);
      } finally { await engine.dispose(); }
    }
  } finally { process.removeListener('unhandledRejection', onUnhandled); }
});

// GC17 uses independent literal times, crops and CPU image bytes fixed before execution.
const CLOCK_ATLAS_BYTES = Object.freeze([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255,
]);
const CLOCK_RED = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const CLOCK_GREEN = Object.freeze({ x: 2, y: 0, width: 1, height: 2 });
const CLOCK_BLUE = Object.freeze({ x: 3, y: 0, width: 3, height: 1 });

test('GC17 an explicit clock consumer drives authentic SequencePlayer crops without replacing seek behavior', async () => {
  const h = host(), engine = await createEngine({ host: h.adapter });
  const image = createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(CLOCK_ATLAS_BYTES) }), texture = createTexture(image);
  let loads = 0, disposals = 0;
  const type = createAssetType('clock-sequence-atlas', isTexture);
  engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; assert.equal(value, texture); value.dispose(); } });
  const ref = createAssetRef(type, 'clock-sequence-atlas'), scope = engine.createScope();
  let player, bitmap, lease, peerLease, subscription, savedTick, savedFrame;
  try {
    lease = scope.use(await engine.assets.acquire(ref)); peerLease = scope.use(await engine.assets.acquire(ref));
    assert.notEqual(lease, peerLease); assert.notEqual(lease.leaseId, peerLease.leaseId); assert.equal(lease.resourceGeneration, peerLease.resourceGeneration);
    assert.equal(lease.value, texture); assert.equal(peerLease.value, texture); assert.equal(loads, 1);
    bitmap = scope.use(new Bitmap(lease)); engine.stage.addChild(bitmap);
    const clip = createSequenceClip({ atlasWidth: 6, atlasHeight: 2, frames: [
      { ...CLOCK_RED, durationSeconds: 0.125 }, { ...CLOCK_GREEN, durationSeconds: 0.25 }, { ...CLOCK_BLUE, durationSeconds: 0.125 },
    ] });
    player = scope.use(new SequencePlayer(bitmap, clip));
    const selections = [];
    subscription = engine.clock.onTick(scope, tick => { savedTick = tick; selections.push(player.applyAt(tick.elapsedSeconds)); });
    assert.equal(player.lastSample, undefined); assert.deepEqual(bitmap.sourceRect, { x: 0, y: 0, width: 6, height: 2 });
    assert.equal(engine.advanceTime(0), undefined); assert.equal(selections.length, 0);
    assert.deepEqual(engine.advanceTime(0.125), { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual(selections, [{ frameIndex: 1, region: CLOCK_GREEN, positionSeconds: 0.125, atEnd: false, stopped: false }]);
    assert.deepEqual(bitmap.sourceRect, CLOCK_GREEN); assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [1, 2]);
    savedFrame = engine.captureFrame(CLOCK_FRAME_OPTIONS);
    assert.deepEqual(savedFrame.commands[0].sourceRect, CLOCK_GREEN); assert.deepEqual(savedFrame.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.equal(selections.length, 1); assert.equal(player.lastSample, selections[0]);
    const third = player.applyAt(0.375);
    assert.deepEqual(third, { frameIndex: 2, region: CLOCK_BLUE, positionSeconds: 0.375, atEnd: false, stopped: false });
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [3, 1]);
    assert.deepEqual(engine.captureFrame(CLOCK_FRAME_OPTIONS).commands[0].sourceRect, CLOCK_BLUE);
    const backwards = player.applyAt(0);
    assert.deepEqual(backwards, { frameIndex: 0, region: CLOCK_RED, positionSeconds: 0, atEnd: false, stopped: false });
    const backwardFrame = engine.captureFrame(CLOCK_FRAME_OPTIONS);
    assert.deepEqual(backwardFrame.commands[0].sourceRect, CLOCK_RED); assert.deepEqual(backwardFrame.commands[0].rect, { x: 0, y: 0, width: 2, height: 2 });
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight, engine.clock.elapsedSeconds, engine.clock.tickId, selections.length, loads, disposals], [2, 2, 0.125, 1, 1, 1, 0]);
    assert.equal(bitmap.textureLease, lease); assert.equal(peerLease.value, texture);
    scope.dispose();
    assert.equal(subscription.isDisposed, true); assert.equal(player.isDisposed, true); assert.equal(bitmap.isDisposed, true);
    expectClockError(() => lease.value, 'ASSET_LEASE_RELEASED'); expectClockError(() => peerLease.value, 'ASSET_LEASE_RELEASED');
    assert.deepEqual([loads, disposals], [1, 1]); assert.equal(texture.isDisposed, true);
    engine.advanceTime(0.25); assert.equal(selections.length, 1);
    assert.deepEqual(savedTick, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.deepEqual(savedFrame.commands[0].sourceRect, CLOCK_GREEN); assert.deepEqual(savedFrame.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.deepEqual([...copyImageData2DPixels(savedFrame.images[0])], CLOCK_ATLAS_BYTES);
    assert.deepEqual(player.lastSample, { frameIndex: 0, region: CLOCK_RED, positionSeconds: 0, atEnd: false, stopped: false });
  } finally { await engine.dispose(); }
  assert.deepEqual(h.trace, ['start', 'stop', 'close']); assert.deepEqual([loads, disposals], [1, 1]);
});

test('GC18 immutable authentic facades reject forged receivers and retain terminal scalar observations', async () => {
  const engine = await createEngine({ host: host().adapter });
  const clock = engine.clock, scope = engine.createScope(), handle = clock.onTick(scope, () => {});
  try {
    assert.ok(Object.isFrozen(clock)); assert.ok(Object.isFrozen(handle)); assert.equal('dispose' in clock, false);
    for (const [view, getters, methods, code] of [
      [clock, ['state', 'elapsedSeconds', 'tickId', 'maxDeltaSeconds'], ['onTick', 'pause', 'resume'], 'CLOCK_INVALID'],
      [handle, ['isDisposed'], ['dispose'], 'CLOCK_SUBSCRIPTION_INVALID'],
    ]) {
      for (const name of getters) {
        const descriptor = Object.getOwnPropertyDescriptor(view, name); assert.equal(typeof descriptor.get, 'function'); assert.equal(descriptor.set, undefined);
        for (const receiver of [{}, Object.create(view), new Proxy(view, {}), undefined]) expectClockError(() => descriptor.get.call(receiver), code);
        assert.equal(Reflect.set(view, name, 'forged'), false);
        assert.throws(() => Object.defineProperty(view, name, { value: 'forged' }), TypeError);
      }
      for (const name of methods) {
        const descriptor = Object.getOwnPropertyDescriptor(view, name); assert.equal(typeof descriptor.value, 'function'); assert.equal(descriptor.writable, false);
        for (const receiver of [{}, Object.create(view), new Proxy(view, {}), undefined]) expectClockError(() => descriptor.value.call(receiver, scope, () => {}), code);
        assert.equal(Reflect.set(view, name, () => {}), false);
        assert.throws(() => Object.defineProperty(view, name, { value() {} }), TypeError);
      }
    }
    engine.advanceTime(0); const savedTick = engine.advanceTime(0.125);
    handle.dispose(); handle.dispose(); assert.equal(handle.isDisposed, true);
    const remaining = clock.onTick(scope, () => {});
    const closing = engine.dispose(); assert.equal(engine.dispose(), closing); assert.equal(remaining.isDisposed, true);
    await closing;
    assert.deepEqual(clockObservations(clock), { state: 'closed', elapsedSeconds: 0.125, tickId: 1, maxDeltaSeconds: 0.25 });
    assert.equal(handle.isDisposed, true); assert.equal(remaining.isDisposed, true); handle.dispose(); remaining.dispose();
    expectClockError(() => clock.onTick({}, undefined), 'ENGINE_CLOSED'); expectClockError(() => clock.pause(), 'ENGINE_CLOSED'); expectClockError(() => clock.resume(), 'ENGINE_CLOSED');
    expectClockError(() => engine.advanceTime(NaN), 'ENGINE_CLOSED');
    assert.deepEqual(savedTick, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 }); assert.ok(Object.isFrozen(savedTick));
    assert.deepEqual(Reflect.ownKeys(savedTick).sort(), ['deltaSeconds', 'elapsedSeconds', 'tickId']);
  } finally { await engine.dispose(); }
});