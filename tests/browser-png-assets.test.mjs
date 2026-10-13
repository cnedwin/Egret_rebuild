// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createBrowserTextureProvider as createProvider } from '@egret/engine/web/image';
import { host } from './helpers.mjs';
import { controlledFixture, deferred, observe, errorIs, RGBA_PIXELS } from './browser-png-fixture.mjs';

/** Real Engine/manager ownership; only external decode/raster ports are controlled. */
async function runAssets(body) {
  const fixture = controlledFixture(), provider = createProvider(fixture.options), port = host(), diagnostics = [];
  fixture.pendingReads = []; fixture.pendingDecodes = [];
  const engine = await egret.createEngine({ host: port.adapter, onDiagnostic(value) { diagnostics.push(value); } });
  engine.assets.register(fixture.type, provider);
  let primary, cleanup;
  try { await body({ engine, provider, fixture, port, diagnostics }); }
  catch (cause) { primary = { cause }; }
  try {
    const closing = engine.dispose();
    // Deferred test-owned operations are always released, even after an earlier
    // assertion fails. Engine owns demand; provider.close remains caller-owned.
    for (const pending of fixture.pendingReads) pending.resolve(fixture.bytes);
    for (const pending of fixture.pendingDecodes) pending.resolve(fixture.makeBitmap());
    await closing;
    await provider.close();
    assert.deepEqual(port.trace, ['start','stop','close']);
    assert.equal(port.timers.size, 0);
    assert.deepEqual(diagnostics, []);
  } catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'BIP1_ASSETS_AND_TEST_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}
function testAssets(name, body) { test(name, { timeout: 10_000 }, () => runAssets(body)); }
function pendingReader(fixture) {
  fixture.controls.readBytes = () => {
    const task = deferred(); fixture.pendingReads.push(task); return task.promise;
  };
}
testAssets('BIP06 sharing gives independent genuine leases and one provider invocation', async ({ engine, provider, fixture }) => {
  const first = engine.assets.acquire(fixture.ref);
  const second = engine.assets.acquire(egret.createAssetRef(fixture.type, fixture.ref.id));
  const [a,b] = await Promise.all([first,second]), value = a.value;
  assert.notEqual(a.leaseId, b.leaseId); assert.equal(a.resourceGeneration, b.resourceGeneration);
  assert.equal(value, b.value);
  assert.equal(fixture.readerCalls.length, 1); assert.equal(fixture.decodeCalls.length, 1);
  assert.equal(fixture.readerCalls[0].ref, fixture.ref);
  assert.ok(Object.isFrozen(fixture.readerCalls[0].context));
  assert.ok(fixture.readerCalls[0].context.resourceGeneration > 0);
  assert.ok(fixture.readerCalls[0].context.taskId > 0);
  a.release(); a.release();
  assert.throws(() => a.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.equal(b.value, value); assert.equal(value.isDisposed, false);
  b.release(); assert.equal(value.isDisposed, true);
  provider.dispose(value); assert.equal(value.isDisposed, true);
});
testAssets('BIP06 final release evicts this Texture and next acquire starts a fresh generation', async ({ engine, fixture }) => {
  const old = await engine.assets.acquire(fixture.ref), oldValue = old.value;
  old.release();
  const fresh = await engine.assets.acquire(fixture.ref);
  assert.ok(fresh.resourceGeneration > old.resourceGeneration);
  assert.notEqual(fresh.value, oldValue); assert.equal(oldValue.isDisposed, true);
  assert.equal(fixture.readerCalls.length, 2);
  fresh.release();
});
testAssets('BIP06 invalidation preserves old pending demand and independent new generation', async ({ engine, fixture }) => {
  pendingReader(fixture);
  const old = engine.assets.acquire(fixture.ref);
  engine.assets.invalidate(fixture.ref);
  const fresh = engine.assets.acquire(fixture.ref);
  assert.equal(fixture.pendingReads.length, 2);
  const oldContext = fixture.readerCalls[0].context, newContext = fixture.readerCalls[1].context;
  assert.equal(oldContext.signal.aborted, false);
  assert.ok(newContext.resourceGeneration > oldContext.resourceGeneration);
  assert.notEqual(newContext.taskId, oldContext.taskId);
  fixture.pendingReads[1].resolve(fixture.bytes);
  const b = await fresh;
  fixture.pendingReads[0].resolve(fixture.bytes);
  const a = await old, oldValue = a.value, newValue = b.value;
  assert.notEqual(oldValue, newValue);
  a.release();
  const c = await engine.assets.acquire(fixture.ref);
  assert.equal(c.value, newValue); assert.equal(fixture.readerCalls.length, 2);
  assert.equal(oldValue.isDisposed, true); assert.equal(newValue.isDisposed, false);
  b.release(); assert.equal(newValue.isDisposed, false);
  c.release(); assert.equal(newValue.isDisposed, true);
});
testAssets('BIP06 one waiter cancellation preserves another and delivered demand', async ({ engine, fixture }) => {
  pendingReader(fixture);
  const first = new egret.CancellationController(), second = new egret.CancellationController();
  const cancelled = observe(engine.assets.acquire(fixture.ref, { signal: first.signal }));
  const pending = engine.assets.acquire(fixture.ref, { signal: second.signal });
  first.abort('first-only');
  const refusal = await cancelled;
  assert.equal(refusal.fulfilled, false); assert.equal(refusal.cause.code, 'ASSET_ACQUIRE_CANCELLED');
  assert.equal(fixture.readerCalls[0].context.signal.aborted, false);
  fixture.pendingReads[0].resolve(fixture.bytes);
  const lease = await pending;
  second.abort('after delivery');
  assert.ok(egret.isTexture(lease.value)); assert.equal(fixture.readerCalls.length, 1);
  lease.release();
});
testAssets('BIP06 Engine shutdown releases demand without awaiting pending reader or provider close', async ({ engine, provider, fixture, port }) => {
  const ready = await engine.assets.acquire(fixture.ref), readyValue = ready.value;
  pendingReader(fixture);
  const pendingRef = egret.createAssetRef(fixture.type, 'bip1/pending.png');
  const pending = observe(engine.assets.acquire(pendingRef));
  await engine.dispose();
  const refused = await pending;
  assert.equal(refused.fulfilled, false); assert.equal(refused.cause.code, 'ASSET_MANAGER_CLOSED');
  assert.equal(readyValue.isDisposed, true);
  assert.throws(() => ready.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.equal(fixture.readerCalls.at(-1).context.signal.aborted, true);
  assert.deepEqual(port.trace, ['start','stop','close']);
  assert.equal(provider.isClosed, false);
  const closing = provider.close(), state = { settled: false };
  void observe(closing).then(() => { state.settled = true; });
  try { await Promise.resolve(); assert.equal(state.settled, false); }
  finally { fixture.pendingReads[0].resolve(fixture.bytes); }
  await closing;
  assert.equal(fixture.decodeCalls.length, 1, 'no decode after shutdown/close');
});
testAssets('BIP06 provider close preserves issued lease and original disposal after close', async ({ engine, provider, fixture }) => {
  const lease = await engine.assets.acquire(fixture.ref), value = lease.value;
  await provider.close();
  assert.equal(lease.value, value); assert.equal(value.isDisposed, false);
  const scope = engine.createScope(), sheet = scope.use(egret.createSpriteSheet(lease, [
    { name: 'red', x: 0, y: 0, width: 1, height: 1 },
  ]));
  const bitmap = scope.use(sheet.createBitmap('red'));
  assert.equal(bitmap.textureLease, lease);
  engine.assets.invalidate(fixture.ref);
  await assert.rejects(engine.assets.acquire(fixture.ref), error => {
    assert.equal(error.code, 'ASSET_LOAD_FAILED');
    return errorIs('WEB_PNG_PROVIDER_CLOSED')(error.cause);
  });
  assert.equal(lease.value, value); assert.equal(fixture.readerCalls.length, 1);
  scope.dispose(); lease.release();
  assert.equal(value.isDisposed, true);
});
testAssets('BIP06 shared provider serves two genuine Engines without combining ownership', async ({ engine, provider, fixture }) => {
  const otherPort = host(), other = await egret.createEngine({ host: otherPort.adapter });
  let primary, cleanup;
  try {
    other.assets.register(fixture.type, provider);
    const [a,b] = await Promise.all([engine.assets.acquire(fixture.ref), other.assets.acquire(fixture.ref)]);
    assert.notEqual(a.value, b.value);
    assert.equal(fixture.readerCalls.length, 2);
    assert.deepEqual(fixture.readerCalls.map(call => [call.context.resourceGeneration,call.context.taskId]), [[1,1],[1,1]]);
    assert.throws(() => engine.createScope().use(b), { code: 'ENGINE_MISMATCH' });
    assert.ok(egret.isTexture(b.value));
    a.release(); assert.equal(b.value.isDisposed, false);
    b.release();
  } catch (cause) { primary = { cause }; }
  try { await other.dispose(); assert.deepEqual(otherPort.trace, ['start','stop','close']); assert.equal(otherPort.timers.size, 0); }
  catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause,cleanup.cause], 'BIP1_OTHER_ENGINE_AND_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
});
testAssets('BIP06 captured Texture disposer ignores later public prototype replacement', async ({ engine, fixture }) => {
  const lease = await engine.assets.acquire(fixture.ref), value = lease.value;
  const descriptor = Object.getOwnPropertyDescriptor(egret.Texture.prototype, 'dispose');
  let patchedCalls = 0;
  try {
    Object.defineProperty(egret.Texture.prototype, 'dispose', { ...descriptor, value() { patchedCalls++; throw new Error('late public disposer'); } });
    lease.release(); lease.release();
    assert.equal(patchedCalls, 0); assert.equal(value.isDisposed, true);
  } finally {
    // Restore the complete descriptor before ordinary caller/Engine cleanup.
    Object.defineProperty(egret.Texture.prototype, 'dispose', descriptor);
  }
});
testAssets('BIP07 one decoded image drives sheet, Bitmaps, sequence and saved frame lifetime', async ({ engine, fixture }) => {
  const resources = engine.createScope(), animation = engine.createScope();
  const lease = resources.use(await engine.assets.acquire(fixture.ref)), texture = lease.value, image = texture.imageData;
  const sheet = resources.use(egret.createSpriteSheet(lease, [
    { name: 'red', x: 0, y: 0, width: 1, height: 1 },
    { name: '__proto__', x: 1, y: 0, width: 1, height: 1 },
  ]));
  const actor = resources.use(sheet.createBitmap('red')), icon = resources.use(sheet.createBitmap('__proto__'));
  icon.x = 2;
  engine.stage.addChild(actor); engine.stage.addChild(icon);
  const clip = egret.createSequenceClip({ atlasWidth: 2, atlasHeight: 1, frames: [
    { ...sheet.getRegion('red'), durationSeconds: 0.125 },
    { ...sheet.getRegion('__proto__'), durationSeconds: 0.125 },
  ] });
  engine.advanceTime(0);
  const playback = engine.createSequencePlayback(animation, actor, clip, { mode: 'once' });
  playback.start();
  sheet.dispose();
  engine.advanceTime(0.125);
  const saved = engine.captureFrame({ width: 3, height: 1, clearColor: 0, clearAlpha: 0 });
  assert.equal(saved.images.length, 1); assert.equal(saved.images[0], image);
  assert.equal(saved.commands.length, 2);
  assert.deepEqual(saved.commands.map(command => command.sourceRect), [
    { x: 1, y: 0, width: 1, height: 1 }, { x: 1, y: 0, width: 1, height: 1 },
  ]);
  assert.equal(actor.textureLease, lease); assert.equal(icon.textureLease, lease);
  assert.equal(playback.lastSample.frameIndex, 1); assert.equal(fixture.readerCalls.length, 1);
  await engine.dispose();
  assert.equal(texture.isDisposed, true);
  assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])], RGBA_PIXELS);
  assert.equal(actor.isDisposed, true); assert.equal(icon.isDisposed, true); assert.equal(sheet.isDisposed, true);
});
