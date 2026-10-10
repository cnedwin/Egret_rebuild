import test from 'node:test';
import assert from 'node:assert/strict';
import { Sprite, createEngine } from '@egret/engine';
import { host } from './helpers.mjs';

test('TW01 initialized display and clock precede the scoped scalar Tween witness', async () => {
  const h = host();
  const engine = await createEngine({ host: h.adapter });
  try {
    const scope = engine.createScope();
    const sprite = scope.use(new Sprite());
    sprite.graphics.beginFill(0x2753a1).drawRect(0, 0, 2, 2);
    engine.stage.addChild(sprite);
    const frame = engine.captureFrame({ width: 8, height: 8 });
    assert.equal(frame.frameId, 1);
    assert.equal(frame.commands.length, 1);
    assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 2, height: 2 });
    assert.equal(scope.state, 'open');
    assert.equal(engine.advanceTime(0), undefined);
    const baseline = engine.advanceTime(0.125);
    assert.deepEqual(baseline, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.equal(engine.clock.elapsedSeconds, 0.125);
    // An authentic initialized public baseline must precede the missing capability.
    assert.equal(typeof engine.createTween, 'function', 'Engine.createTween is required');
    const offered = [];
    let completed = 0;
    const tween = engine.createTween(scope, {
      from: 0, to: 100, durationSeconds: 1,
      onUpdate(value) { offered.push(value); sprite.x = value; return undefined; },
      onComplete() { completed++; return undefined; },
    });
    assert.equal(tween.state, 'idle');
    assert.equal(tween.value, 0);
    assert.deepEqual(offered, []);
    tween.start();
    assert.equal(tween.state, 'running');
    assert.deepEqual(offered, []);
    for (const source of [0.375, 0.625, 0.875, 1.125]) engine.advanceTime(source);
    assert.deepEqual(offered, [25, 50, 75, 100]);
    assert.equal(sprite.x, 100);
    assert.equal(tween.state, 'completed');
    assert.equal(tween.isDisposed, true);
    assert.equal(tween.elapsedSeconds, 1);
    assert.equal(tween.progress, 1);
    assert.equal(tween.value, 100);
    assert.equal(completed, 1);
    engine.advanceTime(1.375);
    assert.deepEqual(offered, [25, 50, 75, 100]);
    assert.equal(completed, 1);
  } finally {
    await engine.dispose();
  }
  assert.deepEqual(h.trace, ['start', 'stop', 'close']);
});

// First-party public CPU controls from the adopted scalar Tween contract.
// Expected scalars and callback order are fixed before Tween implementation.
import { EgretError } from '@egret/engine';
import { deferred, flush } from './helpers.mjs';

function tweenError(action, code, cause) {
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
function tweenTickError(action, code, cause) {
  const outer = tweenError(action, 'CLOCK_CALLBACK_FAILED');
  assert.ok(outer.cause instanceof EgretError);
  assert.equal(outer.cause.code, code);
  if (arguments.length === 3) assert.equal(outer.cause.cause, cause);
  return outer;
}
function tweenView(tween) {
  return { state: tween.state, isDisposed: tween.isDisposed, elapsedSeconds: tween.elapsedSeconds, progress: tween.progress, value: tween.value };
}
function scalarOptions(onUpdate = () => undefined, rest = {}) {
  return { from: 0, to: 100, durationSeconds: 1, onUpdate, ...rest };
}
async function withTweenEngine(run, options = {}) {
  const h = host();
  const engine = await createEngine({ host: h.adapter, ...options });
  try { await run(engine, h); }
  finally { await engine.dispose(); }
}

test('TW01 captures and construction never advance or offer a Tween sample', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()), offered = [];
    sprite.graphics.beginFill(0x2753a1).drawRect(0, 0, 2, 2);
    engine.stage.addChild(sprite);
    const tween = engine.createTween(scope, scalarOptions(value => { offered.push(value); sprite.x = value; return undefined; }));
    assert.deepEqual(tweenView(tween), { state: 'idle', isDisposed: false, elapsedSeconds: 0, progress: 0, value: 0 });
    engine.captureFrame({ width: 8, height: 8 }); tween.start();
    engine.captureFrame({ width: 8, height: 8 });
    assert.equal(engine.advanceTime(0), undefined);
    assert.deepEqual(offered, []); assert.equal(engine.clock.elapsedSeconds, 0);
    engine.advanceTime(0.25);
    assert.deepEqual(offered, [25]); assert.equal(sprite.x, 25);
    assert.deepEqual(tweenView(tween), { state: 'running', isDisposed: false, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
    engine.captureFrame({ width: 8, height: 8 });
    assert.deepEqual(offered, [25]); assert.equal(engine.advanceTime(0.25), undefined);
    assert.deepEqual(offered, [25]);
  });
});

test('TW02 four easing and alpha adapters use independent quarter and half literals', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), rows = [];
    for (const [easing, quarter, half, alphaQuarter, alphaHalf] of [
      ['linear', 25, 50, 0.25, 0.5], ['quadIn', 6.25, 25, 0.0625, 0.25],
      ['quadOut', 43.75, 75, 0.4375, 0.75], ['quadInOut', 12.5, 50, 0.125, 0.5],
    ]) {
      const sprite = scope.use(new Sprite()), values = [], alphas = [];
      let completed = 0;
      const movement = engine.createTween(scope, scalarOptions(value => { values.push(value); sprite.x = value; return undefined; }, { easing, onComplete() { completed++; return undefined; } }));
      const fade = engine.createTween(scope, { from: 0, to: 1, durationSeconds: 1, easing, onUpdate(value) { alphas.push(value); sprite.alpha = value; return undefined; } });
      movement.start(); fade.start();
      rows.push({ quarter, half, alphaQuarter, alphaHalf, sprite, values, alphas, movement, fade, completions: () => completed });
    }
    engine.advanceTime(0); engine.advanceTime(0.25);
    for (const row of rows) { assert.deepEqual(row.values, [row.quarter]); assert.deepEqual(row.alphas, [row.alphaQuarter]); assert.equal(row.sprite.alpha, row.alphaQuarter); assert.equal(row.movement.progress, 0.25); }
    engine.advanceTime(0.5);
    for (const row of rows) { assert.deepEqual(row.values, [row.quarter, row.half]); assert.deepEqual(row.alphas, [row.alphaQuarter, row.alphaHalf]); assert.equal(row.movement.progress, 0.5); }
    engine.advanceTime(0.75); engine.advanceTime(1); engine.advanceTime(1.25);
    for (const row of rows) { assert.equal(row.values.length, 4); assert.equal(row.alphas.length, 4); assert.equal(row.values[3], 100); assert.equal(row.alphas[3], 1); assert.equal(row.movement.state, 'completed'); assert.equal(row.fade.state, 'completed'); assert.equal(row.completions(), 1); }
  });
});

test('TW02 equal endpoints retain positive-duration updates and signed zero normalizes', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), values = []; let completions = 0;
    const equal = engine.createTween(scope, { from: 7, to: 7, durationSeconds: 0.5, onUpdate(value) { values.push(value); return undefined; }, onComplete() { completions++; return undefined; } });
    const zero = engine.createTween(scope, { from: -0, to: -0, durationSeconds: Number.MIN_VALUE, onUpdate(value) { assert.equal(Object.is(value, -0), false); return undefined; } });
    assert.equal(Object.is(zero.value, -0), false); equal.start(); zero.start();
    engine.advanceTime(0); assert.deepEqual(values, []);
    engine.advanceTime(0.25); assert.deepEqual(values, [7]); assert.equal(completions, 0);
    assert.deepEqual(tweenView(zero), { state: 'completed', isDisposed: true, elapsedSeconds: Number.MIN_VALUE, progress: 1, value: 0 });
    engine.advanceTime(0.5); engine.advanceTime(0.75);
    assert.deepEqual(values, [7, 7]); assert.equal(completions, 1);
  });
});

test('TW03 pause freezes offered observations and resume discards paused game time', async () => {
  await withTweenEngine(async engine => {
    const values = []; let completed = 0;
    const tween = engine.createTween(engine.createScope(), scalarOptions(value => { values.push(value); return undefined; }, { onComplete() { completed++; return undefined; } }));
    tween.start(); tween.resume(); engine.advanceTime(0); engine.advanceTime(0.25); engine.advanceTime(0.5);
    tween.pause(); tween.pause();
    engine.advanceTime(0.75); engine.advanceTime(1);
    assert.deepEqual(tweenView(tween), { state: 'paused', isDisposed: false, elapsedSeconds: 0.5, progress: 0.5, value: 50 });
    assert.deepEqual(values, [25, 50]);
    tween.resume(); tween.resume(); engine.advanceTime(1.25); engine.advanceTime(1.5);
    assert.deepEqual(values, [25, 50, 75, 100]); assert.equal(completed, 1);
    assert.equal(tween.state, 'completed');
  });
});

test('TW03 a skipped turn samples the next reached game time without replay', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), cause = new Error('prior-listener'), values = [];
    const prior = engine.clock.onTick(scope, () => { throw cause; });
    const tween = engine.createTween(scope, scalarOptions(value => { values.push(value); return undefined; }));
    tween.start(); engine.advanceTime(0);
    tweenError(() => engine.advanceTime(0.25), 'CLOCK_CALLBACK_FAILED', cause);
    assert.deepEqual(values, []); assert.equal(tween.elapsedSeconds, 0);
    assert.equal(engine.advanceTime(0.25), undefined); assert.deepEqual(values, []);
    prior.dispose(); engine.advanceTime(0.5);
    assert.deepEqual(values, [50]); assert.equal(tween.elapsedSeconds, 0.5);
  });
});

test('TW03 prior-listener pause and same-tick resume establish a zero-update anchor', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), values = []; let tween;
    engine.clock.onTick(scope, tick => {
      if (tick.elapsedSeconds === 0.5) tween.pause();
      if (tick.elapsedSeconds === 0.75) tween.resume();
      return undefined;
    });
    tween = engine.createTween(scope, scalarOptions(value => { values.push(value); return undefined; }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25); engine.advanceTime(0.5);
    assert.deepEqual(values, [25]); assert.equal(tween.elapsedSeconds, 0.25);
    engine.advanceTime(0.75); assert.deepEqual(values, [25]);
    engine.advanceTime(1); assert.deepEqual(values, [25, 50]);
  });
});

test('TW03 global pause and a rejected source hitch do not invent Tween writes', async () => {
  await withTweenEngine(async engine => {
    const values = [], tween = engine.createTween(engine.createScope(), scalarOptions(value => { values.push(value); return undefined; }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    engine.clock.pause(); engine.advanceTime(10); assert.deepEqual(values, [25]);
    engine.clock.resume(); assert.equal(engine.advanceTime(10), undefined);
    engine.advanceTime(10.25); assert.deepEqual(values, [25, 50]);
    tweenError(() => engine.advanceTime(11), 'CLOCK_DELTA_LIMIT');
    assert.deepEqual(values, [25, 50]); assert.equal(tween.elapsedSeconds, 0.5);
    tweenError(() => engine.advanceTime(11.25), 'CLOCK_DELTA_LIMIT');
    engine.clock.pause(); engine.clock.resume(); assert.equal(engine.advanceTime(11.25), undefined);
    engine.advanceTime(11.5); assert.deepEqual(values, [25, 50, 75]);
  });
});

test('TW04 ordered snapshots detach caller options and never repeat caller get adapters', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), reads = [], values = []; let gets = 0, completions = 0;
    const get = () => { gets++; return 0; };
    const saved = { from: get(), to: 100, durationSeconds: 1, easing: 'linear', onUpdate(value) { values.push(value); return undefined; }, onComplete() { completions++; return undefined; } };
    const options = {};
    for (const key of ['from', 'to', 'durationSeconds', 'easing', 'onUpdate', 'onComplete']) Object.defineProperty(options, key, { configurable: true, get() { reads.push(key); return saved[key]; } });
    Object.defineProperty(options, 'unrelated', { get() { throw new Error('ignored extra key'); } });
    const tween = engine.createTween(scope, options);
    assert.deepEqual(reads, ['from', 'to', 'durationSeconds', 'easing', 'onUpdate', 'onComplete']); assert.equal(gets, 1);
    for (const key of ['from', 'to', 'durationSeconds', 'easing', 'onUpdate', 'onComplete']) Object.defineProperty(options, key, { value: null });
    tween.start(); engine.advanceTime(0); for (const source of [0.25, 0.5, 0.75, 1]) engine.advanceTime(source);
    assert.deepEqual(values, [25, 50, 75, 100]); assert.equal(completions, 1); assert.equal(gets, 1); assert.equal(reads.length, 6);
    const cause = new Error('caller-get-before-entry'); let invoked = 0;
    const callerGet = () => { invoked++; throw cause; };
    assert.throws(() => engine.createTween(scope, scalarOptions(undefined, { from: callerGet() })), error => error === cause);
    assert.equal(invoked, 1);
  });
});

test('TW04 each throwing option getter retains its exact cause and stops later reads', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), keys = ['from', 'to', 'durationSeconds', 'easing', 'onUpdate', 'onComplete'];
    for (const [index, failedKey] of keys.entries()) {
      const values = scalarOptions(), reads = [], cause = new Error(failedKey), options = {};
      for (const key of keys) Object.defineProperty(options, key, { get() { reads.push(key); if (key === failedKey) throw cause; return values[key]; } });
      tweenError(() => engine.createTween(scope, options), 'TWEEN_OPTIONS_INVALID', cause);
      assert.deepEqual(reads, keys.slice(0, index + 1));
    }
    const listeners = Array.from({ length: 256 }, () => engine.clock.onTick(scope, () => undefined));
    assert.equal(listeners.length, 256); for (const listener of listeners) listener.dispose();
  });
});

test('TW04 successful getter lifetime rechecks prioritize Engine over Scope after every read', async () => {
  const keys = ['from', 'to', 'durationSeconds', 'easing', 'onUpdate', 'onComplete'];
  for (const closeEngine of [false, true]) for (const [index, closedAt] of keys.entries()) {
    await withTweenEngine(async engine => {
      const scope = engine.createScope(), values = scalarOptions(), reads = [], options = {};
      for (const key of keys) Object.defineProperty(options, key, { get() {
        reads.push(key);
        if (key === closedAt) { scope.dispose(); if (closeEngine) engine.dispose(); }
        return values[key];
      } });
      tweenError(() => engine.createTween(scope, options), closeEngine ? 'ENGINE_CLOSED' : 'SCOPE_CLOSED');
      assert.deepEqual(reads, keys.slice(0, index + 1));
    });
  }
});

test('TW04 finite bad option classes and revoked shape are refused without subscription leakage', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope();
    for (const value of [null, undefined, [], 7, true, 'options', () => undefined]) tweenError(() => engine.createTween(scope, value), 'TWEEN_OPTIONS_INVALID');
    for (const patch of [
      { from: NaN }, { from: Infinity }, { from: '0' }, { from: undefined },
      { to: -Infinity }, { to: NaN }, { to: null },
      { durationSeconds: 0 }, { durationSeconds: -0 }, { durationSeconds: -1 }, { durationSeconds: Infinity }, { durationSeconds: NaN }, { durationSeconds: '1' },
      { easing: 'cubic' }, { easing: null }, { easing: () => 0.5 }, { onUpdate: undefined }, { onUpdate: 7 }, { onComplete: null }, { onComplete: 7 },
    ]) tweenError(() => engine.createTween(scope, scalarOptions(undefined, patch)), 'TWEEN_OPTIONS_INVALID');
    tweenError(() => engine.createTween(scope, scalarOptions(undefined, { from: -Number.MAX_VALUE, to: Number.MAX_VALUE })), 'TWEEN_RANGE_INVALID');
    let optionReads = 0;
    const revoked = Proxy.revocable({ get from() { optionReads++; return 0; } }, {}); revoked.revoke();
    const error = tweenError(() => engine.createTween(scope, revoked.proxy), 'TWEEN_OPTIONS_INVALID');
    assert.ok(error.cause instanceof TypeError); assert.equal(optionReads, 0);
    const long = engine.createTween(scope, scalarOptions(undefined, { durationSeconds: Number.MAX_VALUE }));
    assert.equal(long.state, 'idle'); long.dispose();
    const listeners = Array.from({ length: 256 }, () => engine.clock.onTick(scope, () => undefined));
    for (const listener of listeners) listener.dispose();
  });
});

test('TW05 genuine same-Engine Scope guards precede any option reads', async () => {
  const foreignEngine = await createEngine({ host: host().adapter });
  try {
    await withTweenEngine(async engine => {
      let reads = 0; const unread = { get from() { reads++; throw new Error('must not read'); } };
      tweenError(() => engine.createTween({}, unread), 'TWEEN_SCOPE_INVALID');
      tweenError(() => engine.createTween(foreignEngine.createScope(), unread), 'TWEEN_SCOPE_INVALID');
      const closed = engine.createScope(); closed.dispose();
      Object.defineProperty(closed, 'state', { value: 'open' });
      tweenError(() => engine.createTween(closed, unread), 'SCOPE_CLOSED');
      const closing = engine.createScope(); let actualState, refusal;
      closing.signal.addEventListener('abort', () => { actualState = closing.state; try { engine.createTween(closing, unread); } catch (error) { refusal = error; } });
      closing.dispose(); assert.equal(actualState, 'closing'); assert.ok(refusal instanceof EgretError); assert.equal(refusal.code, 'SCOPE_CLOSED');
      assert.equal(reads, 0);
      const shared = engine.dispose(); assert.equal(engine.dispose(), shared);
      tweenError(() => engine.createTween({}, unread), 'ENGINE_CLOSED'); assert.equal(reads, 0);
      await shared;
    });
  } finally { await foreignEngine.dispose(); }
});

test('TW05 intrinsic Scope ownership and private clock survive public field overrides', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), other = engine.createScope(), intrinsicUse = Object.getPrototypeOf(scope).use;
    const authenticClock = engine.clock, offered = []; let overrides = 0;
    Object.defineProperty(scope, 'state', { configurable: true, get() { overrides++; throw new Error('public state'); } });
    Object.defineProperty(scope, 'use', { configurable: true, value() { overrides++; throw new Error('public use'); } });
    Object.defineProperty(engine, 'clock', { value: { onTick() { overrides++; throw new Error('fake clock'); } } });
    const tween = engine.createTween(scope, scalarOptions(value => { offered.push(value); return undefined; }));
    assert.equal(intrinsicUse.call(scope, tween), tween); assert.equal(intrinsicUse.call(scope, tween), tween);
    tweenError(() => other.use(tween), 'OWNERSHIP_CONFLICT'); assert.equal(tween.isDisposed, false);
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(offered, [25]); assert.equal(authenticClock.elapsedSeconds, 0.25); assert.equal(overrides, 0);
    scope.dispose(); assert.equal(tween.state, 'stopped'); assert.equal(tween.isDisposed, true); assert.equal(overrides, 0);
  });
});

test('TW05 frozen handle methods and observations reject forged receivers', async () => {
  await withTweenEngine(async engine => {
    const tween = engine.createTween(engine.createScope(), scalarOptions());
    assert.equal(Object.isFrozen(tween), true);
    for (const key of ['state', 'isDisposed', 'elapsedSeconds', 'progress', 'value']) {
      tweenError(() => Reflect.get(tween, key, {}), 'TWEEN_INVALID');
      assert.equal(Reflect.set(tween, key, 99), false);
    }
    for (const key of ['start', 'pause', 'resume', 'stop', 'dispose']) {
      tweenError(() => Reflect.apply(tween[key], {}, []), 'TWEEN_INVALID');
      assert.equal(Reflect.set(tween, key, () => undefined), false);
    }
    tweenError(() => tween.pause(), 'TWEEN_NOT_STARTED'); tweenError(() => tween.resume(), 'TWEEN_NOT_STARTED');
    tween.start(); tweenError(() => tween.start(), 'TWEEN_ALREADY_STARTED'); tween.pause(); tweenError(() => tween.start(), 'TWEEN_ALREADY_STARTED');
    tween.stop(); for (const key of ['start', 'pause', 'resume']) tweenError(() => tween[key](), 'TWEEN_TERMINAL');
  });
});

test('TW06 stopping idle running and paused handles preserves targets without final callbacks', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()), values = []; let completions = 0;
    sprite.x = 9;
    const options = scalarOptions(value => { values.push(value); sprite.x = value; return undefined; }, { onComplete() { completions++; return undefined; } });
    const idle = engine.createTween(scope, options); idle.stop(); idle.dispose(); idle.stop();
    assert.deepEqual(tweenView(idle), { state: 'stopped', isDisposed: true, elapsedSeconds: 0, progress: 0, value: 0 }); assert.equal(sprite.x, 9);
    const running = engine.createTween(scope, options), paused = engine.createTween(scope, options); running.start(); paused.start();
    engine.advanceTime(0); engine.advanceTime(0.25); paused.pause();
    running.dispose(); running.stop(); paused.stop(); paused.dispose();
    engine.advanceTime(0.5); scope.dispose();
    assert.deepEqual(values, [25, 25]); assert.equal(completions, 0);
    for (const tween of [running, paused]) assert.deepEqual(tweenView(tween), { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
  });
});

test('TW06 Scope reverse cleanup stops a Tween before its genuine borrowed Sprite', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()), values = []; let tween, releaseObservation;
    scope.use({ release() { releaseObservation = [tween.state, tween.isDisposed, sprite.isDisposed]; } });
    tween = engine.createTween(scope, scalarOptions(value => { assert.equal(sprite.isDisposed, false); values.push(value); sprite.x = value; return undefined; }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25); scope.dispose();
    assert.deepEqual(releaseObservation, ['stopped', true, false]);
    assert.equal(sprite.isDisposed, true); assert.equal(tween.state, 'stopped'); engine.advanceTime(0.5); assert.deepEqual(values, [25]);
  });
});

test('TW06 Engine close immediately retires all Tween states but waits for writer-end cleanup', async () => {
  const order = [], h = host({ stop() { order.push('host-stop'); }, async close() { order.push('host-close'); } });
  const engine = await createEngine({ host: h.adapter }); let closing;
  try {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()); let writer, idle, paused, completions = 0, releaseObservation;
    scope.use({ release() { order.push('scope-release'); releaseObservation = [writer.state, sprite.isDisposed]; } });
    writer = engine.createTween(scope, scalarOptions(value => {
      order.push('writer-start'); sprite.x = value; closing = engine.dispose(); assert.equal(engine.dispose(), closing);
      for (const tween of [writer, idle, paused]) { assert.equal(tween.state, 'stopped'); assert.equal(tween.isDisposed, true); }
      assert.equal(scope.state, 'open'); assert.equal(sprite.isDisposed, false); assert.equal(engine.stage.isDisposed, false);
      for (const key of ['start', 'pause', 'resume']) tweenError(() => writer[key](), 'ENGINE_CLOSED');
      writer.stop(); writer.dispose(); assert.deepEqual(order, ['writer-start']); order.push('writer-end'); return undefined;
    }, { onComplete() { completions++; return undefined; } }));
    idle = engine.createTween(scope, scalarOptions()); paused = engine.createTween(scope, scalarOptions());
    writer.start(); paused.start(); paused.pause(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(order, ['writer-start', 'writer-end']); await closing;
    assert.deepEqual(releaseObservation, ['stopped', false]);
    assert.deepEqual(order, ['writer-start', 'writer-end', 'scope-release', 'host-stop', 'host-close']);
    assert.equal(sprite.isDisposed, true); assert.equal(completions, 0);
    assert.deepEqual(tweenView(writer), { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
    for (const tween of [writer, idle, paused]) { tween.stop(); tween.dispose(); for (const key of ['start', 'pause', 'resume']) tweenError(() => tween[key](), 'ENGINE_CLOSED'); }
    assert.equal(engine.dispose(), closing);
  } finally { await engine.dispose(); }
});

test('TW06 own-Scope cleanup is synchronous within a writer and suppresses completion', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()), order = []; let tween, releaseState;
    scope.use({ release() { order.push('scope-release'); releaseState = tween.state; } });
    tween = engine.createTween(scope, scalarOptions(value => {
      order.push('writer-start'); sprite.x = value; scope.dispose();
      assert.equal(sprite.isDisposed, true); assert.equal(scope.state, 'closed');
      order.push('writer-end'); return undefined; // No borrowed Sprite use after dispose.
    }, { durationSeconds: 0.25, onComplete() { order.push('complete'); return undefined; } }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(order, ['writer-start', 'scope-release', 'writer-end']);
    assert.equal(releaseState, 'stopped');
    assert.deepEqual(tweenView(tween), { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 1, value: 100 });
  });
});

test('TW07 writer failure preserves offers side effects exact causes and one diagnostic', async () => {
  const cause = new Error('writer-primary'), observer = new Error('observer-secondary'), diagnostics = [];
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()), later = [];
    const a = engine.createTween(scope, scalarOptions(value => { sprite.x = value; throw cause; }));
    const b = engine.createTween(scope, scalarOptions(value => { later.push(value); return undefined; }));
    a.start(); b.start(); engine.advanceTime(0);
    const error = tweenTickError(() => engine.advanceTime(0.25), 'TWEEN_UPDATE_FAILED', cause);
    assert.deepEqual(tweenView(a), { state: 'failed', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
    assert.equal(sprite.x, 25); assert.deepEqual(later, []); assert.equal(b.value, 0);
    assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].code, 'CLOCK_CALLBACK_FAILED'); assert.equal(diagnostics[0].phase, 'engine'); assert.equal(diagnostics[0].cause, error.cause);
    assert.equal(engine.advanceTime(0.25), undefined); assert.deepEqual(later, []);
    engine.advanceTime(0.5); assert.deepEqual(later, [50]); assert.equal(sprite.x, 25); assert.equal(diagnostics.length, 1);
    a.stop(); a.dispose(); assert.equal(a.state, 'failed');
    for (const key of ['start', 'pause', 'resume']) tweenError(() => a[key](), 'TWEEN_TERMINAL');
  }, { onDiagnostic(envelope) { diagnostics.push(envelope); throw observer; } });
});

test('TW07 stop Scope-close and Engine-close remain terminal when their writer later throws', async () => {
  for (const terminal of ['stop', 'scope', 'engine']) {
    const cause = new Error('throw-after-'+terminal);
    await withTweenEngine(async engine => {
      const scope = engine.createScope(); let tween, closing;
      tween = engine.createTween(scope, scalarOptions(() => {
        if (terminal === 'stop') tween.stop(); else if (terminal === 'scope') scope.dispose(); else closing = engine.dispose();
        throw cause;
      }));
      tween.start(); engine.advanceTime(0);
      tweenTickError(() => engine.advanceTime(0.25), 'TWEEN_UPDATE_FAILED', cause);
      assert.deepEqual(tweenView(tween), { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
      tween.stop(); tween.dispose(); assert.equal(tween.state, 'stopped'); if (closing) await closing;
    });
  }
});

test('TW07 invalid writer returns keep their primary cause and observe rejected async values', async () => {
  const unhandled = [], onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    for (const kind of ['null', 'scalar', 'promise', 'throwing-getter', 'throwing-then', 'rejecting-then']) {
      const cause = new Error(kind), gate = deferred(); let observations = 0;
      const returned = kind === 'null' ? null : kind === 'scalar' ? 7 : kind === 'promise' ? gate.promise : kind === 'throwing-getter'
        ? { get then() { observations++; throw cause; } } : kind === 'throwing-then'
          ? { then() { observations++; throw cause; } } : { then(_resolve, reject) { observations++; reject(cause); } };
      await withTweenEngine(async engine => {
        const scope = engine.createScope(), values = [], tween = engine.createTween(scope, scalarOptions(() => returned));
        const later = engine.createTween(scope, scalarOptions(value => { values.push(value); return undefined; }));
        tween.start(); later.start(); engine.advanceTime(0);
        const error = tweenTickError(() => engine.advanceTime(0.25), 'TWEEN_UPDATE_FAILED');
        const primary = error.cause.cause; assert.ok(primary instanceof EgretError); assert.equal(primary.code, 'TWEEN_CALLBACK_RETURN_INVALID');
        assert.equal(tween.state, 'failed'); assert.equal(tween.value, 25); assert.deepEqual(values, []);
        if (kind === 'promise') gate.reject(cause);
        await flush(); await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(unhandled, []); assert.equal(error.cause.cause, primary);
        if (!['null', 'scalar', 'promise'].includes(kind)) assert.ok(observations > 0);
        assert.equal(engine.advanceTime(0.25), undefined); engine.advanceTime(0.5); assert.deepEqual(values, [50]);
      });
    }
  } finally { process.removeListener('unhandledRejection', onUnhandled); }
});

test('TW07 forbidden pending writer Promise does not extend the Engine idle barrier', { timeout: 2000 }, async () => {
  const pending = deferred(), order = [], h = host({ stop() { order.push('host-stop'); }, async close() { order.push('host-close'); } });
  const engine = await createEngine({ host: h.adapter }); let closing, settled = false;
  pending.promise.then(() => { settled = true; }, () => { settled = true; });
  try {
    const scope = engine.createScope();
    scope.use({ release() { order.push('scope-release'); } });
    const tween = engine.createTween(scope, scalarOptions(() => { order.push('writer'); closing = engine.dispose(); order.push('writer-end'); return pending.promise; }));
    tween.start(); engine.advanceTime(0);
    const error = tweenTickError(() => engine.advanceTime(0.25), 'TWEEN_UPDATE_FAILED');
    assert.equal(error.cause.cause.code, 'TWEEN_CALLBACK_RETURN_INVALID'); assert.equal(tween.state, 'stopped');
    await closing; assert.equal(settled, false);
    assert.deepEqual(order, ['writer', 'writer-end', 'scope-release', 'host-stop', 'host-close']);
  } finally { pending.resolve(); await flush(); await engine.dispose(); }
});

test('TW08 final exact-to write commits completion before callback and defers new subscriptions', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), order = []; let tween, next;
    tween = engine.createTween(scope, scalarOptions(value => { order.push(['writer', value, tween.state]); return undefined; }, {
      durationSeconds: 0.25,
      onComplete() {
        order.push(['complete', tween.state, tween.isDisposed, tween.value]);
        for (const key of ['start', 'pause', 'resume']) tweenError(() => tween[key](), 'TWEEN_REENTRANT');
        tween.stop(); tween.dispose(); assert.equal(tween.state, 'completed');
        next = engine.createTween(scope, scalarOptions(value => { order.push(['next', value]); return undefined; })); next.start(); return undefined;
      },
    }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(order, [['writer', 100, 'running'], ['complete', 'completed', true, 100]]); assert.equal(next.value, 0);
    engine.advanceTime(0.5);
    assert.deepEqual(order, [['writer', 100, 'running'], ['complete', 'completed', true, 100], ['next', 25]]);
    for (const key of ['start', 'pause', 'resume']) tweenError(() => tween[key](), 'TWEEN_TERMINAL');
  });
});

test('TW08 a new Tween started by a writer waits for the next clock snapshot', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), order = []; let next;
    const first = engine.createTween(scope, scalarOptions(value => {
      order.push(['first', value]);
      if (!next) { next = engine.createTween(scope, scalarOptions(nextValue => { order.push(['next', nextValue]); return undefined; })); next.start(); }
      return undefined;
    }));
    first.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(order, [['first', 25]]); assert.equal(next.elapsedSeconds, 0);
    engine.advanceTime(0.5); assert.deepEqual(order, [['first', 25], ['first', 50], ['next', 25]]);
  });
});

test('TW08 completion Engine-close keeps completed result and Engine priority through callback-end', async () => {
  const order = [], h = host({ stop() { order.push('host-stop'); }, async close() { order.push('host-close'); } });
  const engine = await createEngine({ host: h.adapter }); let closing;
  try {
    const scope = engine.createScope(); let completed, idle;
    scope.use({ release() { order.push('scope-release'); } });
    completed = engine.createTween(scope, scalarOptions(value => { order.push(value); return undefined; }, {
      durationSeconds: 0.25,
      onComplete() {
        order.push('complete-start'); closing = engine.dispose(); assert.equal(engine.dispose(), closing);
        assert.equal(completed.state, 'completed'); assert.equal(completed.isDisposed, true);
        assert.equal(idle.state, 'stopped'); assert.equal(scope.state, 'open');
        for (const key of ['start', 'pause', 'resume']) tweenError(() => completed[key](), 'ENGINE_CLOSED');
        completed.stop(); completed.dispose(); order.push('complete-end'); return undefined;
      },
    }));
    idle = engine.createTween(scope, scalarOptions()); completed.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(order, [100, 'complete-start', 'complete-end']); await closing;
    assert.deepEqual(order, [100, 'complete-start', 'complete-end', 'scope-release', 'host-stop', 'host-close']);
    assert.deepEqual(tweenView(completed), { state: 'completed', isDisposed: true, elapsedSeconds: 0.25, progress: 1, value: 100 });
  } finally { await engine.dispose(); }
});

test('TW08 own writer controls refuse reentry but own stop and existing frame guards remain', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), values = []; let tween;
    tween = engine.createTween(scope, scalarOptions(value => {
      values.push(value);
      for (const key of ['start', 'pause', 'resume']) tweenError(() => tween[key](), 'TWEEN_REENTRANT');
      tweenError(() => engine.advanceTime(NaN), 'CLOCK_REENTRANT');
      tweenError(() => engine.captureFrame({ width: 8, height: 8 }), 'CLOCK_REENTRANT');
      tween.stop(); tween.dispose(); return undefined;
    }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25); engine.advanceTime(0.5);
    assert.deepEqual(values, [25]); assert.equal(tween.state, 'stopped');
  });
});

test('TW08 final writer stop Scope-close or Engine-close suppresses completion', async () => {
  for (const terminal of ['stop', 'scope', 'engine']) {
    await withTweenEngine(async engine => {
      const scope = engine.createScope(), order = []; let tween, closing;
      tween = engine.createTween(scope, scalarOptions(value => {
        order.push(value);
        if (terminal === 'stop') tween.stop(); else if (terminal === 'scope') scope.dispose(); else closing = engine.dispose();
        return undefined;
      }, { durationSeconds: 0.25, onComplete() { order.push('complete'); return undefined; } }));
      tween.start(); engine.advanceTime(0); engine.advanceTime(0.25);
      assert.deepEqual(order, [100]); assert.deepEqual(tweenView(tween), { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 1, value: 100 });
      if (closing) await closing;
    });
  }
});

test('TW08 completion throws and invalid Promise returns retain completed state and one diagnostic', async () => {
  const unhandled = [], onUnhandled = reason => unhandled.push(reason); process.on('unhandledRejection', onUnhandled);
  try {
    for (const kind of ['throw', 'promise']) {
      const cause = new Error('completion-'+kind), gate = deferred(), diagnostics = [], order = [];
      await withTweenEngine(async engine => {
        const scope = engine.createScope(), tween = engine.createTween(scope, scalarOptions(value => { order.push(value); return undefined; }, {
          durationSeconds: 0.25, onComplete() { order.push('complete'); if (kind === 'throw') throw cause; return gate.promise; },
        }));
        tween.start(); engine.advanceTime(0);
        const error = tweenTickError(() => engine.advanceTime(0.25), 'TWEEN_COMPLETE_FAILED');
        if (kind === 'throw') assert.equal(error.cause.cause, cause); else { assert.equal(error.cause.cause.code, 'TWEEN_CALLBACK_RETURN_INVALID'); gate.reject(cause); }
        assert.deepEqual(order, [100, 'complete']); assert.deepEqual(tweenView(tween), { state: 'completed', isDisposed: true, elapsedSeconds: 0.25, progress: 1, value: 100 });
        assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].cause, error.cause); assert.equal(diagnostics[0].code, 'CLOCK_CALLBACK_FAILED'); assert.equal(diagnostics[0].phase, 'engine');
        tween.stop(); tween.dispose(); assert.equal(tween.state, 'completed');
        assert.equal(engine.advanceTime(0.25), undefined); engine.advanceTime(0.5); assert.deepEqual(order, [100, 'complete']);
        await flush(); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(unhandled, []);
      }, { onDiagnostic(envelope) { diagnostics.push(envelope); throw new Error('completion-observer'); } });
    }
  } finally { process.removeListener('unhandledRejection', onUnhandled); }
});

test('TW09 mixed capacity refusal is idle retryable and paused completion stop share real slots', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), listeners = Array.from({ length: 256 }, () => engine.clock.onTick(scope, () => undefined)), values = [];
    const tween = engine.createTween(scope, scalarOptions(value => { values.push(value); return undefined; }, { durationSeconds: 0.25 }));
    const idle = engine.createTween(scope, scalarOptions());
    tweenError(() => tween.start(), 'CLOCK_CALLBACK_LIMIT');
    assert.deepEqual(tweenView(tween), { state: 'idle', isDisposed: false, elapsedSeconds: 0, progress: 0, value: 0 }); assert.deepEqual(values, []);
    listeners[0].dispose(); tween.start(); tween.pause();
    tweenError(() => engine.clock.onTick(scope, () => undefined), 'CLOCK_CALLBACK_LIMIT');
    tween.resume(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(values, [100]); assert.equal(tween.state, 'completed');
    idle.start(); tweenError(() => engine.clock.onTick(scope, () => undefined), 'CLOCK_CALLBACK_LIMIT');
    idle.stop(); const reused = engine.clock.onTick(scope, () => undefined); assert.equal(reused.isDisposed, false);
    for (const listener of listeners) listener.dispose(); reused.dispose();
  });
});

test('TW09 competing property writes keep listener order and other Engines stay independent', async () => {
  const other = await createEngine({ host: host().adapter });
  try {
    await withTweenEngine(async engine => {
      const scope = engine.createScope(), sprite = scope.use(new Sprite()), order = [], isolated = [];
      const a = engine.createTween(scope, scalarOptions(value => { order.push(['x', value]); sprite.x = value; return undefined; }));
      a.start();
      engine.clock.onTick(scope, () => { order.push(['ordinary', sprite.x]); return undefined; });
      const b = engine.createTween(scope, { from: 0, to: 20, durationSeconds: 1, onUpdate(value) { order.push(['competing-x', value]); sprite.x = value; return undefined; } });
      const c = other.createTween(other.createScope(), scalarOptions(value => { isolated.push(value); return undefined; }));
      b.start(); c.start(); engine.advanceTime(0); other.advanceTime(0); engine.advanceTime(0.25);
      assert.deepEqual(order, [['x', 25], ['ordinary', 25], ['competing-x', 5]]); assert.equal(sprite.x, 5); assert.deepEqual(isolated, []);
      other.advanceTime(0.25); assert.deepEqual(isolated, [25]); assert.equal(c.elapsedSeconds, 0.25);
    });
  } finally { await other.dispose(); }
});

// TW-CORE-NOTE-001: public Scope abort notification precedes reverse cleanup.
// Isolated observers record facts; their assertions belong outside notification.
test('TW06 external Scope abort tick stops Tween before writer and resource cleanup', async () => {
  await withTweenEngine(async engine => {
    const scope = engine.createScope(), sprite = scope.use(new Sprite()), offered = [], order = [];
    sprite.graphics.beginFill(0x2753a1).drawRect(0, 0, 2, 2);
    engine.stage.addChild(sprite);
    let resourceLive = true, completions = 0, tween, beforeAbort, afterAbort, cleanupFacts, abortError, abortTick;
    // The actual Sprite and its borrow-lifetime probe are acquired before Tween.
    scope.use({ release() {
      order.push('resource-release');
      cleanupFacts = { tween: tweenView(tween), spriteDisposed: sprite.isDisposed, resourceLive };
      resourceLive = false;
    } });
    tween = engine.createTween(scope, scalarOptions(value => {
      offered.push(value); sprite.x = value; return undefined;
    }, { onComplete() { completions++; return undefined; } }));
    tween.start(); engine.advanceTime(0); engine.advanceTime(0.25);
    assert.deepEqual(offered, [25]); assert.equal(sprite.x, 25);
    assert.deepEqual(tweenView(tween), { state: 'running', isDisposed: false, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
    scope.signal.addEventListener('abort', () => {
      order.push('abort-start');
      try {
        beforeAbort = { scopeState: scope.state, resourceLive, spriteDisposed: sprite.isDisposed, clockElapsed: engine.clock.elapsedSeconds, clockTickId: engine.clock.tickId };
        abortTick = engine.advanceTime(0.5);
        afterAbort = { scopeState: scope.state, tween: tweenView(tween), offered: [...offered], completions, resourceLive, spriteDisposed: sprite.isDisposed, spriteX: sprite.x, clockElapsed: engine.clock.elapsedSeconds, clockTickId: engine.clock.tickId };
      } catch (error) { abortError = error; }
      finally { order.push('abort-end'); }
    });
    // External disposal enters closing, not a writer-initiated cleanup route.
    scope.dispose();
    assert.equal(abortError, undefined);
    assert.deepEqual(beforeAbort, { scopeState: 'closing', resourceLive: true, spriteDisposed: false, clockElapsed: 0.25, clockTickId: 1 });
    assert.deepEqual(abortTick, { tickId: 2, elapsedSeconds: 0.5, deltaSeconds: 0.25 });
    assert.deepEqual(afterAbort, {
      scopeState: 'closing', tween: { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 },
      offered: [25], completions: 0, resourceLive: true, spriteDisposed: false, spriteX: 25, clockElapsed: 0.5, clockTickId: 2,
    });
    assert.deepEqual(order, ['abort-start', 'abort-end', 'resource-release']);
    assert.deepEqual(cleanupFacts, { tween: { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 }, spriteDisposed: false, resourceLive: true });
    assert.equal(scope.state, 'closed'); assert.equal(resourceLive, false); assert.equal(sprite.isDisposed, true);
    assert.deepEqual(tweenView(tween), { state: 'stopped', isDisposed: true, elapsedSeconds: 0.25, progress: 0.25, value: 25 });
    engine.advanceTime(0.75); assert.deepEqual(offered, [25]); assert.equal(completions, 0);
  });
});
