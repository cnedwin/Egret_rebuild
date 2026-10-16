// SPDX-License-Identifier: Apache-2.0
// Original independent P02 lifecycle witnesses. CPU substitutes prove ownership only.
// Install as tests/resource-scene-session-heldout.test.mjs before running normally.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { deferred, flush, host } from './helpers.mjs';
import { literalProvider, request } from './text-raster-public-helpers.mjs';

const LEFT = 'pilot-left', RIGHT = 'pilot-right';
const AREA = Object.freeze({ x: 0, y: 0, width: 16, height: 16 });
const FRAME = Object.freeze({ width: 192, height: 128, clearColor: 0, clearAlpha: 1 });

function watch(promise) {
  const result = { state: 'pending', value: undefined, error: undefined };
  result.done = promise.then(value => { result.state = 'fulfilled'; result.value = value; },
    error => { result.state = 'rejected'; result.error = error; });
  return result;
}
function hasCause(error, wanted) {
  const todo = [error], seen = new Set();
  while (todo.length) {
    const value = todo.shift();
    if (value === wanted) return true;
    if (value === null || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (Object.hasOwn(value, 'cause')) todo.push(value.cause);
    if (Array.isArray(value.cleanupErrors)) todo.push(...value.cleanupErrors);
  }
  return false;
}
function texture(key) {
  const width = key.startsWith('atlas-') ? 32 : key === 'rgb-red-green' ? 2 : 16;
  const height = key === 'rgb-red-green' ? 1 : 16;
  const rgba = key === 'outfit-B' ? [0, 255, 0, 255] : [87, 31, 143, 255];
  const pixels = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(rgba, offset);
  return sdk.createTexture(sdk.createImageData2D({ width, height, pixels }));
}
function keyOf(ref) { return new URL(ref.id).pathname.split('/').at(-1).replace(/\.png$/, ''); }
function sourceController() {
  const held = new Set(), jobs = [], disposed = [], calls = [];
  let onDispose;
  const provider = {
    load(ref, context) {
      const key = keyOf(ref), gate = deferred();
      const job = { key, ref, context, receiver: this, original: gate.promise, settled: false, value: undefined,
        deliver() {
          if (job.settled) throw new Error('Original source cannot settle twice');
          job.settled = true; job.value = texture(key); gate.resolve(job.value); return job.value;
        } };
      jobs.push(job);
      if (!held.has(key)) job.deliver();
      return job.original;
    },
    dispose(value) {
      calls.push({ receiver: this, value }); disposed.push(value);
      value.dispose();
      if (onDispose) onDispose(value);
    },
  };
  return { provider, jobs, disposed, calls,
    hold(key) { held.add(key); },
    latest(key) { return jobs.filter(job => job.key === key).at(-1); },
    settleAll() { for (const job of jobs) if (!job.settled) job.deliver(); },
    onDispose(callback) { onDispose = callback; } };
}

// A separate fresh genuine SDK baseline precedes every Session fault scenario.
// It uses only built public entries and existing public test adapters.
async function freshPublicBaseline() {
  const port = host(), engine = await sdk.createEngine({ host: port.adapter });
  const type = sdk.createAssetType('p02.heldout.public.baseline', sdk.isTexture);
  const disposed = [], literal = literalProvider();
  engine.assets.register(type, { load(ref) { return Promise.resolve(texture(ref.id)); },
    dispose(value) { disposed.push(value); value.dispose(); } });
  const scope = engine.createScope(), cache = createTextRasterCache(engine.assets, { provider: literal.provider });
  let playback, slot;
  try {
    const ref = sdk.createAssetRef(type, 'atlas-v1');
    const first = scope.use(await engine.assets.acquire(ref)), second = scope.use(await engine.assets.acquire(ref));
    assert.notEqual(first, second); assert.equal(first.value, second.value);
    const sheet = scope.use(sdk.createSpriteSheet(first, [{ name: 'zero', ...AREA }, { name: 'one', ...AREA, x: 16 }]));
    const body = scope.use(sheet.createBitmap('zero')); engine.stage.addChild(body);
    const clip = sdk.createSequenceClip({ atlasWidth: 32, atlasHeight: 16,
      frames: [{ ...AREA, durationSeconds: 0.125 }, { ...AREA, x: 16, durationSeconds: 0.125 }] });
    engine.advanceTime(0); playback = engine.createSequencePlayback(scope, body, clip, { mode: 'loop' }); playback.start();
    engine.advanceTime(0.125); assert.equal(playback.lastSample.frameIndex, 1);
    const outfitLease = scope.use(await engine.assets.acquire(sdk.createAssetRef(type, 'outfit-A')));
    const outfit = scope.use(new sdk.Bitmap(outfitLease)); engine.stage.addChild(outfit);
    slot = engine.createBitmapResourceSlot(scope, outfit); assert.equal(slot.state, 'idle');
    const text = createTextField(engine, scope, cache); text.setRequest(request()); await text.prepare(); engine.stage.addChild(text);
    const frame = engine.captureFrame(FRAME); assert.equal(frame.width, 192);
    assert.ok(frame.images.includes(first.value.imageData));
  } finally { cache.dispose(); await engine.dispose(); await cache.whenIdle(); }
  assert.equal(playback.isDisposed, true); assert.equal(slot.state, 'disposed');
  assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0);
  assert.equal(disposed.length, 2);
  console.log('RESOURCE_SCENE_HELDOUT_FRESH_PUBLIC_BASELINE_COMPLETE');
}

async function healthyScene(t) {
  await freshPublicBaseline();
  const { createResourceSceneSession } = await import('../examples/resource-scene/session.mjs');
  assert.equal(typeof createResourceSceneSession, 'function');
  const sources = sourceController(), port = host(), literal = literalProvider();
  const session = createResourceSceneSession({ host: port.adapter, profile: 'canvas-2d',
    textureProvider: sources.provider, textProvider: literal.provider,
    fontFamilies: { ahem: 'Heldout CPU Ahem substitute', cjk: 'Heldout CPU CJK substitute' } });
  const ready = watch(session.ready);
  const f = { sources, port, literal, session, expectedCloseMarker: undefined };
  t.after(async () => {
    const closing = watch(session.close()); sources.settleAll();
    await closing.done; await ready.done; await flush(); await flush();
    if (f.expectedCloseMarker === undefined) assert.equal(closing.state, 'fulfilled');
    else { assert.equal(closing.state, 'rejected'); assert.ok(hasCause(closing.error, f.expectedCloseMarker)); }
    for (const job of sources.jobs) {
      assert.equal(job.settled, true); assert.equal(job.receiver, sources.provider);
      assert.equal(job.value.isDisposed, true);
      assert.equal(sources.disposed.filter(value => value === job.value).length, 1);
    }
    assert.ok(sources.calls.every(call => call.receiver === sources.provider));
    assert.equal(literal.state.release, literal.state.plans.length);
    assert.equal(port.timers.size, 0);
  });
  await session.ready;
  const left = session.scene.actors[LEFT], right = session.scene.actors[RIGHT];
  assert.ok(left && right); assert.notEqual(left.root, right.root);
  assert.notEqual(left.lease, right.lease); assert.equal(left.lease.value, right.lease.value);
  assert.equal(session.capture().width, 192);
  assert.equal(session.inspect().pendingSources, 0);
  console.log('RESOURCE_SCENE_HELDOUT_FRESH_SESSION_BASELINE_COMPLETE');
  return f;
}

test('P02 heldout close revokes a warm pending slot before yielding', { timeout: 10000 }, async t => {
  const f = await healthyScene(t);
  await f.session.replaceOutfit(RIGHT, 'B');
  const left = f.session.scene.actors[LEFT], right = f.session.scene.actors[RIGHT];
  const warmValue = right.outfit.textureLease.value;
  assert.equal(f.sources.jobs.filter(job => job.key === 'outfit-B').length, 1);
  const pending = watch(f.session.replaceOutfit(LEFT, 'B'));
  const closingPromise = f.session.close(), closing = watch(closingPromise);
  const stateAtCloseReturn = left.slot.state;
  assert.equal(f.session.close(), closingPromise, 'One stable close Promise is public before callbacks');
  await pending.done; await closing.done;
  assert.equal(stateAtCloseReturn, 'disposed', 'Close must synchronously retire genuine slot authority already in hand');
  assert.equal(pending.state, 'rejected', 'A warm delivered continuation cannot commit after the close boundary');
  assert.equal(pending.error?.code, 'BITMAP_RESOURCE_DISPOSED');
  assert.equal(closing.state, 'fulfilled');
  assert.equal(f.session.snapshot().actors[LEFT].committedOutfit, 'A');
  assert.equal(warmValue.isDisposed, true);
});

test('P02 heldout remove cancels pending atlas demand before its original source settles', { timeout: 10000 }, async t => {
  const f = await healthyScene(t), left = f.session.scene.actors[LEFT], right = f.session.scene.actors[RIGHT];
  const survivorRoot = right.root, survivorLease = right.lease, survivorValue = right.lease.value;
  f.sources.hold('atlas-v2');
  const pending = watch(f.session.replaceAtlas(LEFT, 'v2'));
  await flush();
  const original = f.sources.latest('atlas-v2'); assert.ok(original);
  assert.equal(original.settled, false); assert.equal(original.context.signal.aborted, false);
  f.session.remove(LEFT);
  const abortedAtRemoval = original.context.signal.aborted;
  await flush();
  const outcomeBeforeSource = pending.state;
  assert.equal(original.settled, false, 'Original provider ticket remains independently pending');
  assert.equal(f.session.inspect().pendingSources, 1, 'Cancellation does not pretend original completion');
  assert.equal(f.session.scene.actors[LEFT], undefined);
  assert.equal(left.root.isDisposed, true);
  assert.equal(f.session.scene.actors[RIGHT].root, survivorRoot);
  assert.equal(survivorLease.value, survivorValue); assert.equal(survivorValue.isDisposed, false);
  f.session.advanceTo(0.125); assert.equal(right.playback.lastSample.frameIndex, 1);
  assert.equal(abortedAtRemoval, true, 'Retired actor must own and abort its pending atlas Scope');
  assert.equal(outcomeBeforeSource, 'rejected', 'Logical atlas demand must not wait for original source delivery');
  assert.equal(pending.error?.code, 'ASSET_ACQUIRE_CANCELLED');
  original.deliver(); await pending.done; await flush();
  assert.equal(original.value.isDisposed, true);
  await f.session.reenter(LEFT);
  assert.notEqual(f.session.scene.actors[LEFT].root, left.root);
  assert.equal(f.session.snapshot().actors[LEFT].atlasKey, 'v1');
  assert.equal(f.session.scene.actors[RIGHT].root, survivorRoot);
});

test('P02 heldout old atlas provider cleanup failure preserves the committed new set', { timeout: 10000 }, async t => {
  const f = await healthyScene(t), left = f.session.scene.actors[LEFT];
  const root = left.root, oldPlayback = left.playback, oldValue = left.lease.value;
  f.session.remove(RIGHT); // Left remains the last genuine demand for the old atlas.
  const marker = Object.freeze({ kind: 'heldout-old-atlas-cleanup' });
  // Open-state cleanup is a diagnostic; normal close remains fulfilled.
  f.sources.onDispose(value => { if (value === oldValue) throw marker; });
  const replacement = watch(f.session.replaceAtlas(LEFT, 'v2'));
  await replacement.done;
  assert.equal(replacement.state, 'fulfilled', 'A diagnosed provider cleanup failure is not application commit rollback');
  const current = f.session.scene.actors[LEFT];
  assert.equal(current.root, root); assert.equal(root.isDisposed, false);
  assert.notEqual(current.playback, oldPlayback); assert.equal(oldPlayback.isDisposed, true);
  assert.equal(current.playback.lastSample.frameIndex, 0);
  assert.equal(current.body.textureLease, current.lease);
  assert.equal(current.lease.value.isDisposed, false); assert.notEqual(current.lease.value, oldValue);
  assert.equal(f.session.snapshot().actors[LEFT].present, true);
  assert.equal(f.session.snapshot().actors[LEFT].atlasKey, 'v2');
  assert.ok(f.session.inspect().diagnostics.some(value => value.code === 'ASSET_CLEANUP_FAILED' && value.cause === marker));
  assert.ok(f.session.capture().images.includes(current.lease.value.imageData));
});
