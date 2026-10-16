// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { sdk, scene, visible, commit, observe, rejected, fulfilled, code, captureCall, callbackWitness, assertCallback, flush, FRAME, CROP_A, FULL, PIXELS } from './bitmap-resource-slot-fixtures.mjs';

test('BRS20 dispose clears only the owned exact current binding before abort/release reentry', async () => {
  const f = await scene(); const seen = [], abortSnapshots = [], releaseSnapshots = [];
  try {
    await commit(f, 'B'); const owned = f.bitmap.textureLease;
    const pending = f.replace('C');
    const aborted = callbackWitness(() => {
      seen.push('abort:C');
      abortSnapshots.push({ state: f.slot.state, binding: f.bitmap.textureLease,
        oldLease: captureCall(() => owned.value), replacement: captureCall(() => f.slot.replace(f.ref('D'))) });
    });
    const released = callbackWitness(() => {
      seen.push('release:B');
      releaseSnapshots.push({ state: f.slot.state, binding: f.bitmap.textureLease,
        reentrantDispose: captureCall(() => f.slot.dispose()) });
    });
    f.job('C').context.signal.addEventListener('abort', aborted.callback, { once: true });
    f.hooks.dispose = value => {
      if (value !== f.values.get('B')) return;
      released.callback();
    };
    f.slot.dispose(); f.slot.dispose();
    // These assertions run after the SDK's cancellation/provider catch boundaries.
    assertCallback(aborted); assertCallback(released);
    assert.equal(abortSnapshots.length, 1); assert.equal(releaseSnapshots.length, 1);
    assert.equal(abortSnapshots[0].state, 'disposed'); assert.equal(abortSnapshots[0].binding, undefined);
    assert.equal(abortSnapshots[0].oldLease.threw, false);
    assert.equal(abortSnapshots[0].oldLease.value, f.values.get('B'), 'Clear precedes release; abort callback sees no live display borrow');
    assert.equal(abortSnapshots[0].replacement.threw, true);
    assert.equal(abortSnapshots[0].replacement.cause.code, 'BITMAP_RESOURCE_DISPOSED');
    assert.equal(releaseSnapshots[0].state, 'disposed'); assert.equal(releaseSnapshots[0].binding, undefined);
    assert.equal(releaseSnapshots[0].reentrantDispose.threw, false);
    assert.equal(releaseSnapshots[0].reentrantDispose.value, undefined);
    assert.deepEqual(f.diagnostics, []);
    await rejected(pending, 'BITMAP_RESOURCE_DISPOSED');
    assert.deepEqual(seen, ['abort:C', 'release:B']); code(() => owned.value, 'ASSET_LEASE_RELEASED');
    assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.initialLease.value, f.values.get('A'));
    f.job('C').resolve(f.values.get('C')); await flush(); assert.equal(f.count(f.values.get('C')), 1);
    assert.equal(f.bitmap.textureLease, undefined);
  } finally { await f.close(); }
});

test('BRS20 disposal after ready-route delivery still retires the delivered stale lease', async () => {
  const f = await scene();
  try {
    const take = f.engine.assets.acquire(f.ref('B')); f.job('B').resolve(f.values.get('B')); const external = await take;
    const pending = f.replace('B'); f.slot.dispose(); await rejected(pending, 'BITMAP_RESOURCE_DISPOSED');
    assert.equal(f.bitmap.textureLease, f.initialLease); visible(f); assert.equal(external.value, f.values.get('B'));
    external.release(); assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.count(f.values.get('A')), 0);
  } finally { await f.close(); }
});

test('BRS21 target disposal retires a pending slot through reaction or synchronous control', async t => {
  for (const discovery of ['reaction', 'control']) await t.test(discovery, async () => {
    const f = await scene();
    try {
      const pending = f.replace('B'); f.bitmap.dispose();
      if (discovery === 'control') code(() => f.slot.cancel(), 'OBJECT_DISPOSED');
      f.job('B').resolve(f.values.get('B'));
      const error = await rejected(pending, 'BITMAP_RESOURCE_DISPOSED');
      assert.equal(error.cause.code, 'OBJECT_DISPOSED'); assert.equal(f.slot.state, 'disposed');
      assert.equal(f.bitmap.isDisposed, true); assert.equal(f.bitmap.textureLease, undefined);
      assert.equal(f.initialLease.value, f.values.get('A')); assert.equal(f.count(f.values.get('B')), 1);
    } finally { await f.close(); }
  });
});

test('BRS22 intrinsic closing Scope refuses earlier abort-listener reentry despite public shadows', async () => {
  const f = await scene(); const seen = [], snapshots = [];
  const signalDescriptor = Object.getOwnPropertyDescriptor(f.slotScope, 'signal');
  try {
    const pending = f.replace('B');
    Object.defineProperty(f.slotScope, 'state', { configurable: true, value: 'open' });
    Object.defineProperty(f.slotScope, 'use', { configurable: true, value() { throw Error('shadowed Scope.use'); } });
    Object.defineProperty(f.slotScope, 'signal', { configurable: true, value: { aborted: false } });
    const aborted = callbackWitness(() => {
      seen.push('provider-abort');
      snapshots.push({ replacement: captureCall(() => f.slot.replace(f.ref('D'))),
        cancellation: captureCall(() => f.slot.cancel()) });
    });
    f.job('B').context.signal.addEventListener('abort', aborted.callback, { once: true });
    // Scope's own controller retains its original signal, regardless of this public shadow.
    const originalSignal = Object.getOwnPropertyDescriptor(sdk.Scope.prototype, 'state');
    assert.equal(typeof originalSignal.get, 'function');
    f.slotScope.dispose();
    assertCallback(aborted); assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].replacement.threw, true); assert.equal(snapshots[0].replacement.cause.code, 'SCOPE_CLOSED');
    assert.equal(snapshots[0].cancellation.threw, true); assert.equal(snapshots[0].cancellation.cause.code, 'SCOPE_CLOSED');
    assert.deepEqual(f.diagnostics, []);
    await rejected(pending, 'BITMAP_RESOURCE_DISPOSED');
    assert.equal(f.slot.state, 'disposed'); assert.deepEqual(seen, ['provider-abort']);
    code(() => f.slot.replace(f.ref('C')), 'SCOPE_CLOSED');
    assert.equal(f.loads.some(row => row.id === 'D' || row.id === 'C'), false); visible(f);
    f.job('B').resolve(f.values.get('B')); await flush(); assert.equal(f.count(f.values.get('B')), 1);
    delete f.slotScope.state; delete f.slotScope.use; Object.defineProperty(f.slotScope, 'signal', signalDescriptor);
    assert.equal(f.slotScope.state, 'closed');
  } finally {
    delete f.slotScope.state; delete f.slotScope.use; Object.defineProperty(f.slotScope, 'signal', signalDescriptor);
    await f.close();
  }
});

test('BRS22 application Scope abort callback cannot publish before reverse handle cleanup', async () => {
  const f = await scene(); const snapshots = [];
  try {
    const aborted = callbackWitness(() => {
      snapshots.push({ state: f.slot.state, replacement: captureCall(() => f.slot.replace(f.ref('D'))),
        cancellation: captureCall(() => f.slot.cancel()) });
    });
    f.slotScope.signal.addEventListener('abort', aborted.callback, { once: true });
    const pending = f.replace('B'); f.slotScope.dispose();
    assertCallback(aborted); assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].replacement.threw, true); assert.equal(snapshots[0].replacement.cause.code, 'SCOPE_CLOSED');
    assert.equal(snapshots[0].cancellation.threw, true); assert.equal(snapshots[0].cancellation.cause.code, 'SCOPE_CLOSED');
    assert.equal(f.loads.some(row => row.id === 'D'), false); assert.deepEqual(f.diagnostics, []);
    await rejected(pending, 'BITMAP_RESOURCE_DISPOSED');
    assert.ok(['pending', 'disposed'].includes(snapshots[0].state), 'Observation does not create eager Scope authority');
    assert.equal(f.slot.state, 'disposed'); assert.equal(f.job('B').settled, false); visible(f);
  } finally { await f.close(); }
});

test('BRS23 Engine closing retires slot state/binding before the active frame-options barrier', async () => {
  const f = await scene(); let closing; const seen = [], abortSnapshots = [], widthSnapshots = [];
  try {
    await commit(f, 'B'); const pending = f.replace('C');
    const aborted = callbackWitness(() => {
      seen.push('slot-abort');
      abortSnapshots.push({ state: f.slot.state, binding: f.bitmap.textureLease,
        initialLease: captureCall(() => f.initialLease.value), replacement: captureCall(() => f.slot.replace(f.ref('D'))) });
    });
    f.job('C').context.signal.addEventListener('abort', aborted.callback, { once: true });
    const widthRead = callbackWitness(() => {
      closing = f.engine.dispose(); seen.push('width-after-dispose');
      widthSnapshots.push({ repeatedClose: f.engine.dispose(), state: f.slot.state, binding: f.bitmap.textureLease });
      return 32;
    });
    Object.defineProperty(f.engine, 'currentState', { configurable: true, value: 'open' });
    Object.defineProperty(f.engine, 'context', { configurable: true, value: { assertOpen() {} } });
    code(() => f.engine.captureFrame({
      get width() { return widthRead.callback(); }, height: 32,
    }), 'ENGINE_CLOSED');
    assertCallback(aborted); assertCallback(widthRead);
    assert.equal(abortSnapshots.length, 1); assert.equal(widthSnapshots.length, 1);
    assert.equal(abortSnapshots[0].state, 'disposed'); assert.equal(abortSnapshots[0].binding, undefined);
    assert.equal(abortSnapshots[0].initialLease.threw, false);
    assert.equal(abortSnapshots[0].initialLease.value, f.values.get('A'), 'Initial Scope cleanup waits behind the active frame');
    assert.equal(abortSnapshots[0].replacement.threw, true); assert.equal(abortSnapshots[0].replacement.cause.code, 'ENGINE_CLOSED');
    assert.equal(widthSnapshots[0].repeatedClose, closing); assert.equal(widthSnapshots[0].state, 'disposed');
    assert.equal(widthSnapshots[0].binding, undefined); assert.deepEqual(f.diagnostics, []);
    assert.deepEqual(seen, ['slot-abort', 'width-after-dispose']);
    await rejected(pending, 'BITMAP_RESOURCE_DISPOSED'); await closing;
    assert.equal(f.slot.state, 'disposed'); assert.equal(f.engine.stage.isDisposed, true);
    assert.equal(f.loads.some(row => row.id === 'D'), false);
  } finally { await f.close(); }
});

test('BRS23 renderer-triggered Engine disposal retains the already captured saved image', async () => {
  let f, closing, saved; const snapshots = [];
  const rendered = callbackWitness(frame => {
    saved = frame; closing = f.engine.dispose();
    snapshots.push({ state: f.slot.state, binding: f.bitmap.textureLease });
  });
  f = await scene({ hostOverrides: { renderFrame: rendered.callback } });
  try {
    await commit(f, 'B'); const pending = f.replace('C');
    assert.equal(f.engine.renderFrame(FRAME), saved);
    assertCallback(rendered); assert.deepEqual(snapshots, [{ state: 'disposed', binding: undefined }]);
    await rejected(pending, 'BITMAP_RESOURCE_DISPOSED'); await closing;
    assert.deepEqual(Array.from(sdk.copyImageData2DPixels(saved.images[0])), PIXELS.B);
    assert.deepEqual(saved.commands[0].sourceRect, FULL.B); assert.equal(f.slot.state, 'disposed');
  } finally { await f.close(); }
});

test('BRS24 every slot is terminal and cleared before the first Engine cleanup callback', async () => {
  const f = await scene(); let secondPending; const seen = [], firstSnapshots = [], secondSnapshots = [];
  try {
    await commit(f, 'B');
    const secondScope = f.engine.createScope(), secondBitmap = new sdk.Bitmap(f.initialLease);
    f.engine.stage.addChild(secondBitmap);
    const second = f.engine.createBitmapResourceSlot(secondScope, secondBitmap);
    const take = observe(second.replace(f.ref('C'))); f.job('C').resolve(f.values.get('C')); await fulfilled(take);
    const firstPending = f.replace('D'); secondPending = observe(second.replace(f.ref('E')));
    const firstAborted = callbackWitness(() => {
      seen.push('first-abort');
      firstSnapshots.push({ firstState: f.slot.state, secondState: second.state,
        firstBinding: f.bitmap.textureLease, secondBinding: secondBitmap.textureLease,
        replacement: captureCall(() => second.replace(f.ref('F'))) });
    });
    const secondAborted = callbackWitness(() => {
      seen.push('second-abort');
      secondSnapshots.push({ firstState: f.slot.state, firstBinding: f.bitmap.textureLease });
    });
    f.job('D').context.signal.addEventListener('abort', firstAborted.callback, { once: true });
    f.job('E').context.signal.addEventListener('abort', secondAborted.callback, { once: true });
    const closing = f.engine.dispose();
    assertCallback(firstAborted); assertCallback(secondAborted);
    assert.equal(firstSnapshots.length, 1); assert.equal(secondSnapshots.length, 1);
    assert.equal(firstSnapshots[0].firstState, 'disposed'); assert.equal(firstSnapshots[0].secondState, 'disposed');
    assert.equal(firstSnapshots[0].firstBinding, undefined); assert.equal(firstSnapshots[0].secondBinding, undefined);
    assert.equal(firstSnapshots[0].replacement.threw, true); assert.equal(firstSnapshots[0].replacement.cause.code, 'ENGINE_CLOSED');
    assert.deepEqual(secondSnapshots, [{ firstState: 'disposed', firstBinding: undefined }]);
    assert.deepEqual(f.diagnostics, []);
    await rejected(firstPending, 'BITMAP_RESOURCE_DISPOSED'); await rejected(secondPending, 'BITMAP_RESOURCE_DISPOSED');
    await closing; assert.deepEqual([...seen].sort(), ['first-abort', 'second-abort']);
    assert.equal(f.loads.some(row => row.id === 'F'), false);
    assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.count(f.values.get('C')), 1);
  } finally { await f.close(); }
});

test('BRS27 saved old/new frames retain literal data after every live resource is retired', async () => {
  const f = await scene();
  try {
    const old = visible(f); await commit(f, 'B'); const fresh = visible(f, 'B');
    const owned = f.bitmap.textureLease;
    f.engine.assets.invalidate(f.ref('A')); f.engine.assets.invalidate(f.ref('B'));
    f.slot.dispose(); assert.equal(f.bitmap.textureLease, undefined); code(() => owned.value, 'ASSET_LEASE_RELEASED');
    f.initialScope.dispose(); code(() => f.initialLease.value, 'ASSET_LEASE_RELEASED');
    await f.engine.dispose();
    assert.deepEqual(Array.from(sdk.copyImageData2DPixels(old.images[0])), PIXELS.A);
    assert.deepEqual(Array.from(sdk.copyImageData2DPixels(fresh.images[0])), PIXELS.B);
    assert.deepEqual(old.commands[0].sourceRect, CROP_A); assert.deepEqual(fresh.commands[0].sourceRect, FULL.B);
    assert.deepEqual(old.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.deepEqual(fresh.commands[0].rect, { x: 0, y: 0, width: 3, height: 1 });
    assert.equal(f.count(f.values.get('A')), 1); assert.equal(f.count(f.values.get('B')), 1);
  } finally { await f.close(); }
});

test('BRS29 same-target sequence crop conflicts and old player detects new exact lease', async () => {
  const f = await scene();
  try {
    const clip = sdk.createSequenceClip({ atlasWidth: 2, atlasHeight: 2, frames: [
      { x: 0, y: 0, width: 1, height: 2, durationSeconds: 0.125 },
      { x: 1, y: 0, width: 1, height: 2, durationSeconds: 0.125 },
    ] });
    const moving = new sdk.SequencePlayer(f.bitmap, clip, 'loop'); const pending = f.replace('B');
    moving.applyAt(0); f.job('B').resolve(f.values.get('B'));
    await rejected(pending, 'BITMAP_RESOURCE_BINDING_CHANGED'); assert.equal(f.slot.state, 'conflicted');
    moving.dispose(); f.slot.dispose();
    const scope = f.engine.createScope(), slot = f.engine.createBitmapResourceSlot(scope, f.bitmap);
    const oldPlayer = new sdk.SequencePlayer(f.bitmap, clip, 'loop');
    const next = observe(slot.replace(f.ref('B'))), value = f.makeValue('B', 'B');
    f.job('B').resolve(value); await fulfilled(next); code(() => oldPlayer.applyAt(0), 'SEQ_BINDING_CHANGED');
    assert.equal(slot.state, 'ready'); assert.equal(f.bitmap.textureLease.value, value); oldPlayer.dispose();
    const take = f.engine.assets.acquire(f.ref('C')); f.job('C').resolve(f.values.get('C'));
    const otherLease = f.initialScope.use(await take), other = new sdk.Bitmap(otherLease); other.x = 10; f.engine.stage.addChild(other);
    const independent = f.engine.createSequencePlayback(scope, other, sdk.createSequenceClip({ atlasWidth: 1, atlasHeight: 3, frames: [
      { x: 0, y: 0, width: 1, height: 1, durationSeconds: 0.125 },
      { x: 0, y: 1, width: 1, height: 1, durationSeconds: 0.125 },
    ] }), { mode: 'loop' });
    independent.start(); f.engine.advanceTime(10); f.engine.advanceTime(10.125);
    assert.equal(independent.state, 'running'); assert.equal(independent.lastSample.frameIndex, 1);
    assert.equal(slot.state, 'ready'); assert.equal(f.bitmap.textureLease.value, value);
  } finally { await f.close(); }
});

test('BRS31 renderer failure after binding success does not roll back or reject the commit', async () => {
  const sentinel = Object.freeze({ renderer: 'assigned failure' });
  const f = await scene({ hostOverrides: { renderFrame() { throw sentinel; } } });
  try {
    const accepted = await commit(f, 'B'), owned = f.bitmap.textureLease;
    const error = code(() => f.engine.renderFrame(FRAME), 'FRAME_RENDER_FAILED'); assert.equal(error.cause, sentinel);
    assert.equal(accepted.state, 'fulfilled'); assert.equal(f.slot.state, 'ready'); assert.equal(f.bitmap.textureLease, owned);
    assert.equal(owned.value, f.values.get('B')); visible(f, 'B');
    assert.equal(f.diagnostics.filter(row => row.code === 'FRAME_RENDER_FAILED').length, 1);
  } finally { await f.close(); }
});

test('BRS31 whole-frame view budget refusal does not undo a successful slot binding', async () => {
  const f = await scene();
  try {
    const accepted = await commit(f, 'B'), owned = f.bitmap.textureLease;
    const image = sdk.createImageData2D({ width: 128, height: 1, pixels: new Uint8Array(128 * 4) });
    const atlas = sdk.createTexture(image), take = f.engine.assets.acquire(f.ref('views'));
    f.job('views').resolve(atlas); const lease = f.initialScope.use(await take), parent = new sdk.Sprite();
    f.engine.stage.addChild(parent);
    for (let x = 0; x < 128; x++) {
      const node = new sdk.Bitmap(lease); node.sourceRect = { x, y: 0, width: 1, height: 1 }; parent.addChild(node);
    }
    code(() => f.engine.captureFrame(FRAME), 'FRAME_IMAGE_BUDGET');
    assert.equal(accepted.state, 'fulfilled'); assert.equal(f.slot.state, 'ready'); assert.equal(f.bitmap.textureLease, owned);
    assert.equal(owned.value, f.values.get('B')); parent.visible = false; visible(f, 'B');
  } finally { await f.close(); }
});

test('BRS32 ordinary public authority shadows cannot substitute manager/state/binding access', async () => {
  const f = await scene(); const restorers = [];
  function shadow(object, name, descriptor) {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, ...descriptor });
    restorers.push(() => { if (previous) Object.defineProperty(object, name, previous); else delete object[name]; });
  }
  try {
    shadow(f.engine, 'assets', { value: { acquire() { throw Error('shadow manager'); } } });
    shadow(f.slotScope, 'state', { value: 'open' }); shadow(f.slotScope, 'use', { value() { throw Error('shadow Scope'); } });
    shadow(f.bitmap, 'textureLease', { get() { throw Error('shadow Bitmap lease'); } });
    shadow(f.bitmap, 'sourceRect', { get() { throw Error('shadow Bitmap crop'); } });
    const accepted = f.replace('B'); f.job('B').resolve(f.values.get('B')); await fulfilled(accepted);
    assert.equal(f.slot.state, 'ready'); visible(f, 'B');
  } finally { for (const restore of restorers.reverse()) restore(); await f.close(); }
});
