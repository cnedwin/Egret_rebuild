// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// These literal regions, colors and durations are independent of the new owner.
const RED = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const GREEN = Object.freeze({ x: 2, y: 0, width: 1, height: 2 });
const BLUE = Object.freeze({ x: 3, y: 0, width: 3, height: 1 });
const FULL = Object.freeze({ x: 0, y: 0, width: 6, height: 2 });
const PIXELS = Object.freeze([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255,
]);
const FRAME = Object.freeze({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });

function expectCode(action, code, expectedCause) {
  const checkCause = arguments.length === 3;
  let actual;
  assert.throws(action, error => {
    actual = error;
    assert.equal(error.code, code);
    if (checkCause) assert.equal(error.cause, expectedCause);
    return true;
  });
  return actual;
}

async function scene(maxDeltaSeconds = 0.5) {
  const renders = [], diagnostics = [];
  const port = host({ renderFrame(frame) { renders.push(frame); return undefined; } });
  const engine = await egret.createEngine({ host: port.adapter, clock: { maxDeltaSeconds },
    onDiagnostic(diagnostic) { diagnostics.push(diagnostic); } });
  try {
    const resources = engine.createScope(), scope = engine.createScope();
    const pixels = new Uint8Array(PIXELS);
    const image = egret.createImageData2D({ width: 6, height: 2, pixels });
    const texture = egret.createTexture(image);
    let loads = 0, disposals = 0;
    const type = egret.createAssetType('sequence-playback-behavior-atlas', egret.isTexture);
    engine.assets.register(type, { async load() { loads++; return texture; },
      dispose(value) { disposals++; value.dispose(); } });
    const ref = egret.createAssetRef(type, 'sequence-playback-behavior-image');
    const lease = resources.use(await engine.assets.acquire(ref));
    const bitmap = resources.use(new egret.Bitmap(lease));
    engine.stage.addChild(bitmap);
    const input = { atlasWidth: 6, atlasHeight: 2, frames: [
      { ...RED, durationSeconds: 0.125 }, { ...GREEN, durationSeconds: 0.25 },
      { ...BLUE, durationSeconds: 0.125 },
    ] };
    const clip = egret.createSequenceClip(input);
    // A real existing player qualifies the atlas without becoming a historical
    // Scope entry that could interfere with later private-player cleanup controls.
    const manual = new egret.SequencePlayer(bitmap, clip);
    try { assert.deepEqual(manual.applyAt(0), {
      frameIndex: 0, region: RED, positionSeconds: 0, atEnd: false, stopped: false,
    }); } finally { manual.dispose(); }
    const frame = engine.captureFrame(FRAME);
    assert.equal(frame.commands[0].kind, 'image');
    assert.deepEqual(frame.commands[0].sourceRect, RED);
    assert.equal(frame.images[0], image);
    assert.deepEqual([...egret.copyImageData2DPixels(image)], PIXELS);
    assert.equal(port.timers.size, 0);
    assert.equal(typeof engine.createSequencePlayback, 'function', 'SEQUENCE_PLAYBACK_FACTORY_REQUIRED');
    return { port, engine, resources, scope, pixels, image, texture, ref, lease, bitmap,
      input, clip, renders, diagnostics, counts: () => ({ loads, disposals }) };
  } catch (cause) { await engine.dispose(); throw cause; }
}

async function close(f) {
  await f.engine.dispose();
  assert.deepEqual(f.port.trace, ['start', 'stop', 'close']);
  assert.equal(f.port.timers.size, 0);
  assert.deepEqual(f.counts(), { loads: 1, disposals: 1 });
}

function playback(f, options, bitmap = f.bitmap, scope = f.scope) {
  return f.engine.createSequencePlayback(scope, bitmap, f.clip, options);
}
function selected(f, p, elapsed, index, region, position, atEnd = false) {
  assert.equal(p.elapsedSeconds, elapsed);
  assert.deepEqual(p.lastSample, { frameIndex: index, region, positionSeconds: position,
    atEnd, stopped: false });
  assert.ok(Object.isFrozen(p.lastSample) && Object.isFrozen(p.lastSample.region));
  const frame = f.engine.captureFrame(FRAME);
  assert.equal(frame.commands.length, 1);
  assert.equal(frame.commands[0].imageIndex, 0);
  assert.deepEqual(frame.commands[0].sourceRect, region);
  assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: region.width, height: region.height });
  assert.equal(frame.images[0], f.image);
  assert.deepEqual([f.bitmap.naturalWidth, f.bitmap.naturalHeight], [region.width, region.height]);
  return frame;
}

// Idle is an owned handle, not a timer or a visual write. Terminal states stay final.
test('SQP01 idle construction, receiver-owned state and explicit once boundaries', async () => {
  const f = await scene();
  try {
    f.bitmap.sourceRect = BLUE;
    const p = playback(f);
    assert.ok(Object.isFrozen(p));
    assert.equal(p.state, 'idle'); assert.equal(p.isDisposed, false);
    assert.equal(p.elapsedSeconds, 0); assert.equal(p.lastSample, undefined);
    assert.deepEqual(f.bitmap.sourceRect, BLUE);
    expectCode(() => p.pause(), 'SEQ_PLAYBACK_NOT_STARTED');
    expectCode(() => p.resume(), 'SEQ_PLAYBACK_NOT_STARTED');
    p.start(); selected(f, p, 0, 0, RED, 0);
    assert.equal(p.state, 'running');
    expectCode(() => p.start(), 'SEQ_PLAYBACK_ALREADY_STARTED');
    assert.equal(f.engine.advanceTime(10), undefined);
    f.engine.advanceTime(10.125); selected(f, p, 0.125, 1, GREEN, 0.125);
    f.engine.advanceTime(10.375); selected(f, p, 0.375, 2, BLUE, 0.375);
    f.engine.advanceTime(10.5); selected(f, p, 0.5, 2, BLUE, 0.5, true);
    assert.equal(p.state, 'completed'); assert.equal(p.isDisposed, true);
    const final = p.lastSample;
    for (const method of ['start', 'pause', 'resume']) expectCode(() => p[method](), 'SEQ_PLAYBACK_TERMINAL');
    p.stop(); p.dispose(); assert.equal(p.state, 'completed');
    f.engine.advanceTime(11); assert.equal(p.lastSample, final);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
    assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// L08: a legal half-second jump uses an explicitly configured ceiling, not a clamp.
test('SQP02 once and loop select literal endpoint frames on a single legal jump', async t => {
  for (const mode of ['once', 'loop']) await t.test(mode, async () => {
    const f = await scene(0.5);
    try {
      const p = playback(f, { mode }); p.start();
      assert.equal(f.engine.advanceTime(10), undefined);
      f.engine.advanceTime(10.5);
      if (mode === 'once') {
        selected(f, p, 0.5, 2, BLUE, 0.5, true);
        assert.equal(p.state, 'completed'); assert.equal(p.isDisposed, true);
      } else {
        selected(f, p, 0.5, 0, RED, 0);
        assert.equal(p.state, 'running'); assert.equal(p.isDisposed, false);
        f.engine.advanceTime(10.625); selected(f, p, 0.625, 1, GREEN, 0.125);
      }
      assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
      assert.deepEqual(f.diagnostics, []);
    } finally { await close(f); }
  });
});

// No source/equal source and capture/render cannot implicitly advance gameplay.
test('SQP03 repeated source, explicit rendering and default hitch refusal preserve the last sample', async () => {
  const f = await scene(0.25);
  try {
    const p = playback(f, { mode: 'loop' }); p.start();
    const initial = p.lastSample;
    f.engine.captureFrame(FRAME); f.engine.renderFrame(FRAME);
    assert.equal(p.lastSample, initial); assert.equal(f.renders.length, 1);
    assert.equal(f.engine.advanceTime(10), undefined);
    assert.equal(f.engine.advanceTime(10), undefined); assert.equal(p.lastSample, initial);
    f.engine.advanceTime(10.125); const held = p.lastSample;
    assert.equal(f.engine.advanceTime(10.125), undefined); assert.equal(p.lastSample, held);
    expectCode(() => f.engine.advanceTime(11), 'CLOCK_DELTA_LIMIT');
    assert.equal(p.lastSample, held); assert.equal(p.elapsedSeconds, 0.125);
    assert.equal(f.engine.clock.elapsedSeconds, 0.125);
    assert.equal(f.port.timers.size, 0); assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// Local pause freezes committed animation time while the same game clock progresses.
test('SQP04 pause releases time demand and resume excludes the complete local gap', async () => {
  const f = await scene();
  try {
    const p = playback(f); p.start(); f.engine.advanceTime(10);
    f.engine.advanceTime(10.125); selected(f, p, 0.125, 1, GREEN, 0.125);
    p.pause(); p.pause(); const held = p.lastSample;
    f.engine.advanceTime(10.375);
    assert.equal(p.state, 'paused'); assert.equal(p.lastSample, held);
    assert.equal(p.elapsedSeconds, 0.125); assert.equal(f.engine.clock.elapsedSeconds, 0.375);
    f.bitmap.sourceRect = BLUE;
    p.resume(); p.resume(); selected(f, p, 0.125, 1, GREEN, 0.125);
    f.engine.advanceTime(10.625); selected(f, p, 0.375, 2, BLUE, 0.375);
    f.engine.advanceTime(10.75); selected(f, p, 0.5, 2, BLUE, 0.5, true);
    assert.equal(p.state, 'completed'); assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// Global clock recovery supplies a fresh source anchor; the animation adds no wall clock.
test('SQP05 global clock pause and fresh-baseline resume omit the source-time gap', async () => {
  const f = await scene();
  try {
    const p = playback(f, { mode: 'loop' }); p.start(); f.engine.advanceTime(10);
    f.engine.advanceTime(10.125); const held = p.lastSample;
    f.engine.clock.pause(); assert.equal(f.engine.advanceTime(20), undefined);
    assert.equal(p.lastSample, held); assert.equal(p.state, 'running');
    f.engine.clock.resume(); assert.equal(f.engine.advanceTime(30), undefined);
    assert.equal(p.lastSample, held);
    f.engine.advanceTime(30.125); selected(f, p, 0.25, 1, GREEN, 0.25);
    assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// L01: a registration added during dispatch cannot enter that tick's old snapshot.
test('SQP06 creation and start inside an earlier callback apply zero then wait for the next tick', async () => {
  const f = await scene();
  try {
    let p;
    const earlier = f.engine.clock.onTick(f.resources, () => {
      if (p === undefined) { p = playback(f); p.start(); }
      return undefined;
    });
    f.engine.advanceTime(10); f.engine.advanceTime(10.125);
    selected(f, p, 0, 0, RED, 0);
    earlier.dispose(); f.engine.advanceTime(10.25);
    selected(f, p, 0.125, 1, GREEN, 0.125);
    assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// L02: replacing a later registration never lets its old snapshot identity run.
test('SQP07 earlier same-tick pause/resume retires the old candidate and resets the segment', async () => {
  const f = await scene();
  try {
    let p, changed = false;
    const earlier = f.engine.clock.onTick(f.resources, () => {
      if (!changed) { changed = true; p.pause(); p.resume(); }
      return undefined;
    });
    p = playback(f); p.start(); f.engine.advanceTime(10); f.engine.advanceTime(10.125);
    selected(f, p, 0, 0, RED, 0);
    earlier.dispose(); f.engine.advanceTime(10.25);
    selected(f, p, 0.125, 1, GREEN, 0.125);
    assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// Factory qualification and a single mode read have an independent, fixed priority.
test('SQP08 options shape, inherited mode and original player validation priorities', async t => {
  for (const bad of [null, [], 0, 'once']) await t.test(`shape:${String(bad)}`, async () => {
    const f = await scene();
    try { expectCode(() => playback(f, bad), 'SEQ_PLAYBACK_OPTIONS_INVALID'); }
    finally { await close(f); }
  });
  for (const badMode of [null, 0, 'repeat', { valueOf() { throw new Error('must not coerce'); } }]) {
    const f = await scene();
    try {
      expectCode(() => playback(f, { mode: badMode }), 'SEQ_INPUT_INVALID');
      expectCode(() => f.engine.createSequencePlayback(f.scope, {}, f.clip, { mode: badMode }), 'BITMAP_INVALID');
      expectCode(() => f.engine.createSequencePlayback(f.scope, f.bitmap, {}, { mode: badMode }), 'SEQ_INPUT_INVALID');
      expectCode(() => f.engine.createSequencePlayback(f.scope, f.bitmap, {}), 'SEQ_CLIP_INVALID');
      let reads = 0;
      const options = Object.create({ get mode() { reads++; return 'loop'; } });
      Object.defineProperty(options, 'unrelated', { get() { throw new Error('unrelated must stay unread'); } });
      const p = playback(f, options); assert.equal(reads, 1);
      p.start(); f.engine.advanceTime(10); f.engine.advanceTime(10.5);
      selected(f, p, 0.5, 0, RED, 0); assert.equal(p.state, 'running');
    } finally { await close(f); }
  }
});

// Reentry is refused before nested payload reads; an outer successful read may continue.
test('SQP09 mode getter recursive creation is refused and failed reads release the creation guard', async () => {
  const f = await scene();
  try {
    let outerReads = 0, innerReads = 0;
    const p = playback(f, { get mode() {
      outerReads++;
      expectCode(() => playback(f, { get mode() { innerReads++; return 'loop'; } }), 'SEQ_PLAYBACK_CREATION_REENTRANT');
      return 'once';
    } });
    assert.deepEqual([outerReads, innerReads], [1, 0]);
    p.stop();
    expectCode(() => playback(f, { get mode() { throw undefined; } }), 'SEQ_PLAYBACK_OPTIONS_INVALID', undefined);
    const retry = playback(f); assert.equal(retry.state, 'idle'); retry.stop();
    assert.deepEqual(f.bitmap.sourceRect, RED); assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// Successful getter reads recheck lifetime; a getter's own throw retains its cause.
test('SQP10 mode getter close effects and throw-undefined retain the specified first failure', async t => {
  for (const target of ['scope', 'engine']) for (const throws of [false, true]) {
    await t.test(`${target}:${throws ? 'throw' : 'return'}`, async () => {
      const f = await scene(); let closing;
      try {
        let reads = 0;
        const options = { get mode() {
          reads++;
          if (target === 'scope') f.scope.dispose(); else closing = f.engine.dispose();
          if (throws) throw undefined;
          return 'invalid-mode';
        } };
        if (throws) expectCode(() => playback(f, options), 'SEQ_PLAYBACK_OPTIONS_INVALID', undefined);
        else expectCode(() => playback(f, options), target === 'scope' ? 'SCOPE_CLOSED' : 'ENGINE_CLOSED');
        assert.equal(reads, 1);
        if (closing !== undefined) await closing;
        if (target === 'scope') { assert.equal(f.lease.value, f.texture); assert.deepEqual(f.bitmap.sourceRect, RED); }
      } finally { await close(f); }
    });
  }
});

// L07 uses real registrations and targets; no private count is forged or intercepted.
test('SQP11 full clock capacity preserves idle/paused transactions and permits explicit retry', async () => {
  const f = await scene();
  try {
    f.bitmap.sourceRect = BLUE;
    const p = playback(f);
    const slots = Array.from({ length: 256 }, () => f.engine.clock.onTick(f.resources, () => undefined));
    expectCode(() => p.start(), 'CLOCK_CALLBACK_LIMIT');
    assert.equal(p.state, 'idle'); assert.equal(p.lastSample, undefined); assert.deepEqual(f.bitmap.sourceRect, BLUE);
    slots[0].dispose(); p.start(); selected(f, p, 0, 0, RED, 0);
    p.pause(); const held = p.lastSample; f.bitmap.sourceRect = GREEN;
    const replacement = f.engine.clock.onTick(f.resources, () => undefined);
    expectCode(() => p.resume(), 'CLOCK_CALLBACK_LIMIT');
    assert.equal(p.state, 'paused'); assert.equal(p.lastSample, held); assert.equal(p.elapsedSeconds, 0);
    assert.deepEqual(f.bitmap.sourceRect, GREEN);
    replacement.dispose(); p.resume(); selected(f, p, 0, 0, RED, 0);
    p.stop(); assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// The distinct live-handle budget counts authentic Bitmaps, including idle handles.
test('SQP12 256 different real targets exhaust handle capacity before reading options', async () => {
  const f = await scene();
  try {
    const targets = [f.bitmap];
    for (let i = 1; i < 256; i++) targets.push(f.resources.use(new egret.Bitmap(f.lease)));
    assert.equal(new Set(targets).size, 256);
    const handles = targets.map(target => playback(f, undefined, target));
    for (const p of handles) { assert.equal(p.state, 'idle'); assert.equal(p.lastSample, undefined); }
    const extra = f.resources.use(new egret.Bitmap(f.lease)); let reads = 0;
    const options = { get mode() { reads++; return 'loop'; } };
    expectCode(() => playback(f, options, extra), 'SEQ_PLAYBACK_LIMIT');
    assert.equal(reads, 0); assert.deepEqual(extra.sourceRect, FULL);
    handles[0].stop(); const retry = playback(f, options, extra);
    assert.equal(reads, 1); assert.equal(retry.state, 'idle');
    retry.stop(); assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); }
});

// The original player constructor remains the sole full-atlas/resource validator.
test('SQP13 authentic mismatched clips, restricted views and foreign targets retain existing refusals', async () => {
  const f = await scene(), other = await scene(); let restrictedDisposals = 0;
  try {
    const mismatch = egret.createSequenceClip({ atlasWidth: 6, atlasHeight: 3,
      frames: [{ ...RED, durationSeconds: 0.125 }] });
    expectCode(() => f.engine.createSequencePlayback(f.scope, f.bitmap, mismatch), 'SEQ_ATLAS_MISMATCH');
    const restricted = egret.createTexture(f.image, { x: 0, y: 0, width: 3, height: 2 });
    const type = egret.createAssetType('sequence-playback-restricted-view', egret.isTexture);
    f.engine.assets.register(type, { async load() { return restricted; },
      dispose(value) { restrictedDisposals++; value.dispose(); } });
    const lease = f.resources.use(await f.engine.assets.acquire(egret.createAssetRef(type, 'restricted-view')));
    const bitmap = f.resources.use(new egret.Bitmap(lease));
    expectCode(() => playback(f, undefined, bitmap), 'SEQ_ATLAS_MISMATCH');
    expectCode(() => playback(f, undefined, other.bitmap), 'ENGINE_MISMATCH');
    assert.deepEqual(other.bitmap.sourceRect, RED);
    const valid = playback(f); assert.equal(valid.state, 'idle'); valid.stop();
    assert.equal(restrictedDisposals, 0); assert.deepEqual(f.diagnostics, []);
  } finally { await close(f); await close(other); assert.equal(restrictedDisposals, 1); }
});
