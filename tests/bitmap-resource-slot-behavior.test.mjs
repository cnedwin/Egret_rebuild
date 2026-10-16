// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { sdk, scene, visible, commit, observe, rejected, fulfilled, code, causeIncludes, flush, CROP_A, FULL } from './bitmap-resource-slot-fixtures.mjs';

test('BRS03 pending retains the exact cropped initial borrow and live red image', async () => {
  const f = await scene();
  try {
    const pending = f.replace('B');
    assert.equal(f.slot.state, 'pending'); assert.equal(pending.state, 'pending');
    assert.equal(f.bitmap.textureLease, f.initialLease); visible(f);
    assert.equal(f.count(f.values.get('A')), 0);
    f.slot.cancel(); await rejected(pending, 'BITMAP_RESOURCE_CANCELLED'); visible(f);
  } finally { await f.close(); }
});

test('BRS04 load failure retains undefined/object causes and explicit retry can commit', async t => {
  for (const sentinel of [undefined, Object.freeze({ failure: 'original provider rejection' })]) await t.test(String(sentinel), async () => {
    const f = await scene();
    try {
      const pending = f.replace('B'); f.job('B').reject(sentinel);
      const error = await rejected(pending, 'BITMAP_RESOURCE_REPLACE_FAILED');
      causeIncludes(error, sentinel); assert.equal(f.slot.state, 'failed'); visible(f);
      const retried = f.replace('B'); assert.equal(f.slot.state, 'pending'); visible(f);
      f.job('B').resolve(f.values.get('B')); await fulfilled(retried); visible(f, 'B');
      assert.equal(f.initialLease.value, f.values.get('A')); assert.equal(f.count(f.values.get('A')), 0);
    } finally { await f.close(); }
  });
});

test('BRS05 never-settling provider cannot delay logical cancel; idle/ready follow ownership', async () => {
  const f = await scene();
  try {
    const reason = Object.freeze({ cancel: 'caller' }), first = f.replace('B');
    f.slot.cancel(reason);
    assert.equal(f.slot.state, 'idle');
    assert.equal((await rejected(first, 'BITMAP_RESOURCE_CANCELLED')).cause, reason);
    assert.equal(f.job('B').settled, false); assert.equal(f.job('B').context.signal.aborted, true); visible(f);
    const next = f.replace('C'); f.job('C').resolve(f.values.get('C')); await fulfilled(next); visible(f, 'C');
    const afterOwned = f.replace('B'); f.slot.cancel(undefined);
    const error = await rejected(afterOwned, 'BITMAP_RESOURCE_CANCELLED');
    assert.ok(Object.hasOwn(error, 'cause')); assert.equal(error.cause, undefined);
    assert.equal(f.slot.state, 'ready'); visible(f, 'C');
    f.slot.cancel(); assert.equal(f.slot.state, 'ready');
  } finally { await f.close(); }
});

test('BRS15 wrong live type or disposed Texture cannot replace the old exact binding', async t => {
  for (const kind of ['wrong-value', 'disposed-texture']) await t.test(kind, async () => {
    const f = await scene();
    try {
      f.hooks.guard = () => true;
      const invalid = kind === 'wrong-value' ? Object.freeze({ wrong: true }) : f.values.get('B');
      if (kind === 'disposed-texture') invalid.dispose();
      const pending = f.replace('B'); f.job('B').resolve(invalid);
      const error = await rejected(pending, 'BITMAP_RESOURCE_REPLACE_FAILED');
      assert.equal(error.cause.code, kind === 'wrong-value' ? 'BITMAP_TEXTURE_INVALID' : 'TEXTURE_DISPOSED');
      assert.equal(f.count(invalid), 1); assert.equal(f.bitmap.textureLease, f.initialLease); visible(f);
    } finally { await f.close(); }
  });
});

test('BRS15 still-equal revoked initial/owned lease/Texture blocks publication without healing', async t => {
  for (const baseline of ['initial', 'owned']) for (const revoke of ['lease', 'texture']) await t.test(baseline + '/' + revoke, async () => {
    const f = await scene();
    try {
      if (baseline === 'owned') await commit(f, 'B');
      const held = f.bitmap.textureLease, crop = f.bitmap.sourceRect, currentValue = held.value;
      const next = baseline === 'initial' ? 'B' : 'C', pending = f.replace(next);
      if (revoke === 'lease') held.release(); else currentValue.dispose();
      f.job(next).resolve(f.values.get(next));
      const error = await rejected(pending, 'BITMAP_RESOURCE_REPLACE_FAILED');
      assert.equal(error.cause.code, revoke === 'lease' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED');
      assert.equal(f.bitmap.textureLease, held); assert.deepEqual(f.bitmap.sourceRect, crop);
      assert.equal(f.slot.state, 'failed'); assert.equal(f.count(f.values.get(next)), 1);
    } finally { await f.close(); }
  });
});

test('BRS04 ordinary rejected ref/provider/ID admission preserves an accepted pending request', async () => {
  const f = await scene();
  try {
    const pending = f.replace('B');
    code(() => f.slot.replace({ type: f.type, id: 'C' }), 'ASSET_REF_INVALID');
    const missing = sdk.createAssetType('missing replacement provider', sdk.isTexture);
    code(() => f.slot.replace(sdk.createAssetRef(missing, 'missing')), 'ASSET_PROVIDER_MISSING');
    const foreignType = sdk.createAssetType('other registered descriptor', sdk.isTexture);
    f.engine.assets.register(foreignType, { load: async () => f.values.get('C'), dispose: value => value.dispose() });
    code(() => f.slot.replace(sdk.createAssetRef(foreignType, 'B')), 'ASSET_TYPE_MISMATCH');
    assert.equal(f.slot.state, 'pending'); assert.equal(f.job('B').context.signal.aborted, false); visible(f);
    assert.equal(f.loads.filter(row => row.id === 'B').length, 1);
    f.job('B').resolve(f.values.get('B')); await fulfilled(pending); visible(f, 'B');
  } finally { await f.close(); }
});

test('BRS16 manual crop/reset/same lease/lease ABA all retire pending intent as conflict', async t => {
  for (const mutation of ['crop', 'reset', 'same-lease', 'lease-aba', 'clear']) await t.test(mutation, async () => {
    const f = await scene();
    try {
      let external;
      if (mutation === 'lease-aba') external = f.initialScope.use(await f.engine.assets.acquire(f.ref('A')));
      const pending = f.replace('B');
      if (mutation === 'crop') f.bitmap.sourceRect = { x: 0, y: 0, width: 1, height: 1 };
      if (mutation === 'reset') { f.bitmap.sourceRect = undefined; f.bitmap.sourceRect = CROP_A; }
      if (mutation === 'same-lease') { f.bitmap.textureLease = f.initialLease; f.bitmap.sourceRect = CROP_A; }
      if (mutation === 'lease-aba') { f.bitmap.textureLease = external; f.bitmap.textureLease = f.initialLease; f.bitmap.sourceRect = CROP_A; }
      if (mutation === 'clear') f.bitmap.textureLease = undefined;
      const manualLease = f.bitmap.textureLease, manualCrop = f.bitmap.sourceRect;
      f.job('B').resolve(f.values.get('B'));
      await rejected(pending, 'BITMAP_RESOURCE_BINDING_CHANGED'); assert.equal(f.slot.state, 'conflicted');
      assert.equal(f.bitmap.textureLease, manualLease); assert.deepEqual(f.bitmap.sourceRect, manualCrop);
      code(() => f.slot.replace(f.ref('C')), 'BITMAP_RESOURCE_BINDING_CHANGED');
      assert.equal(f.count(f.values.get('B')), 1); f.slot.dispose();
      assert.equal(f.initialLease.value, f.values.get('A')); assert.equal(f.bitmap.textureLease, manualLease);
    } finally { await f.close(); }
  });
});

test('BRS17 failed manual crop/lease assignment does not create a phantom conflict', async () => {
  const f = await scene();
  try {
    const pending = f.replace('B');
    code(() => { f.bitmap.sourceRect = { x: -1, y: 0, width: 1, height: 1 }; }, 'BITMAP_REGION_INVALID');
    code(() => { f.bitmap.textureLease = {}; }, 'BITMAP_LEASE_INVALID'); visible(f);
    f.job('B').resolve(f.values.get('B')); await fulfilled(pending); visible(f, 'B');
  } finally { await f.close(); }
});

test('BRS16 control discovers conflict before bad ref admission and rejects existing intent directly', async () => {
  const f = await scene();
  try {
    const pending = f.replace('B'); f.bitmap.sourceRect = CROP_A;
    code(() => f.slot.replace({}), 'BITMAP_RESOURCE_BINDING_CHANGED');
    await rejected(pending, 'BITMAP_RESOURCE_BINDING_CHANGED'); assert.equal(f.slot.state, 'conflicted');
    f.job('B').resolve(f.values.get('B')); await flush(); assert.equal(f.count(f.values.get('B')), 1); visible(f);
  } finally { await f.close(); }
});

test('BRS18 manual crop keeps slot-owned entitlement until dispose; fields are not cleared', async () => {
  const f = await scene();
  try {
    await commit(f, 'B'); const owned = f.bitmap.textureLease;
    const manual = { x: 1, y: 0, width: 1, height: 1 }; f.bitmap.sourceRect = manual;
    code(() => f.slot.replace(f.ref('C')), 'BITMAP_RESOURCE_BINDING_CHANGED');
    assert.equal(f.slot.state, 'conflicted'); assert.equal(owned.value, f.values.get('B'));
    f.slot.dispose(); f.slot.dispose();
    assert.equal(f.slot.state, 'disposed'); assert.equal(f.bitmap.textureLease, owned);
    assert.deepEqual(f.bitmap.sourceRect, manual); code(() => owned.value, 'ASSET_LEASE_RELEASED');
    code(() => f.engine.captureFrame({ width: 32, height: 32 }), 'ASSET_LEASE_RELEASED');
    assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.initialLease.value, f.values.get('A'));
  } finally { await f.close(); }
});

test('BRS19 manually installed independent lease survives slot disposal without a late clear', async () => {
  const f = await scene();
  try {
    await commit(f, 'B');
    const take = f.engine.assets.acquire(f.ref('C')); f.job('C').resolve(f.values.get('C'));
    const manual = f.initialScope.use(await take); f.bitmap.textureLease = manual;
    f.slot.dispose();
    assert.equal(f.bitmap.textureLease, manual); assert.equal(manual.value, f.values.get('C')); visible(f, 'C');
    assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.count(f.values.get('C')), 0);
  } finally { await f.close(); }
});

test('BRS25 external shared waiter/lease and group-owned initial member retain their owners', async () => {
  const f = await scene({ groupInitial: true });
  try {
    const externalWaiter = f.engine.assets.acquire(f.ref('B'));
    const pending = f.replace('B'); assert.equal(f.loads.filter(row => row.id === 'B').length, 1);
    f.slot.cancel(); await rejected(pending, 'BITMAP_RESOURCE_CANCELLED');
    assert.equal(f.job('B').context.signal.aborted, false, 'External demand keeps the shared provider requested');
    f.job('B').resolve(f.values.get('B')); const external = f.initialScope.use(await externalWaiter);
    assert.equal(external.value, f.values.get('B'));
    f.slot.dispose(); assert.equal(f.initialGroup.state, 'ready'); assert.equal(f.initialLease.value, f.values.get('A'));
    assert.equal(external.value, f.values.get('B')); visible(f);
    code(() => f.slotScope.use(f.initialLease), 'OWNERSHIP_CONFLICT');
    external.release(); assert.equal(f.count(f.values.get('B')), 1); assert.equal(f.count(f.values.get('A')), 0);
  } finally { await f.close(); }
});

test('BRS26 invalidation generations do not replace latest intent authority', async () => {
  const f = await scene();
  try {
    const externalOld = f.engine.assets.acquire(f.ref('B')), oldJob = f.job('B');
    const old = f.replace('B'); f.engine.assets.invalidate(f.ref('B'));
    const newer = f.replace('B'), newJob = f.job('B');
    await rejected(old, 'BITMAP_RESOURCE_SUPERSEDED');
    assert.ok(newJob.context.resourceGeneration > oldJob.context.resourceGeneration);
    const latestValue = f.makeValue('B-new', 'C'); newJob.resolve(latestValue); await fulfilled(newer);
    assert.equal(f.bitmap.textureLease.value, latestValue); visible(f, 'C');
    oldJob.resolve(f.values.get('B')); const held = await externalOld; await flush();
    assert.equal(held.value, f.values.get('B')); assert.equal(f.bitmap.textureLease.value, latestValue);
    held.release(); assert.equal(f.count(f.values.get('B')), 1);
    f.slot.dispose(); assert.equal(f.count(latestValue), 1);
  } finally { await f.close(); }
});

test('BRS26 same ID after ordinary eviction gets fresh entitlement without changing intent order', async () => {
  const f = await scene();
  try {
    await commit(f, 'B'); const first = f.bitmap.textureLease, firstValue = first.value;
    await commit(f, 'C'); code(() => first.value, 'ASSET_LEASE_RELEASED'); assert.equal(f.count(firstValue), 1);
    const pending = f.replace('B'), laterValue = f.makeValue('B', 'B');
    f.job('B').resolve(laterValue); await fulfilled(pending);
    const later = f.bitmap.textureLease; assert.notEqual(later, first); assert.equal(later.value, laterValue);
    assert.ok(later.resourceGeneration > first.resourceGeneration); assert.equal(f.loads.filter(row => row.id === 'B').length, 2);
    visible(f, 'B'); assert.equal(f.count(f.values.get('C')), 1);
  } finally { await f.close(); }
});

test('BRS28 changed dimensions retain authored parent/order/transform/hit/listener state', async () => {
  const f = await scene();
  try {
    const parent = new sdk.Sprite(); parent.x = 5; parent.y = 6; parent.scaleX = 2; parent.scaleY = 2;
    parent.clipRect = { x: 0, y: 0, width: 20, height: 20 }; f.engine.stage.addChild(parent); parent.addChild(f.bitmap);
    Object.assign(f.bitmap, { x: 3, y: 4, anchorOffsetX: 1, anchorOffsetY: 1, alpha: 0.5,
      touchEnabled: true, hitArea: { x: 0, y: 0, width: 8, height: 8 } });
    const type = sdk.createEventType('retained-resource-listener'); let events = 0;
    f.bitmap.on(type, () => { events++; });
    const before = visible(f), hit = f.bitmap.hitArea, clip = parent.clipRect;
    await commit(f, 'B');
    const after = visible(f, 'B');
    assert.equal(f.bitmap.parent, parent); assert.equal(parent.getChildAt(0), f.bitmap);
    assert.deepEqual(after.commands[0].matrix, before.commands[0].matrix);
    assert.deepEqual(after.commands[0].clips, before.commands[0].clips);
    assert.equal(f.bitmap.hitArea, hit); assert.equal(parent.clipRect, clip);
    assert.deepEqual([f.bitmap.x, f.bitmap.y, f.bitmap.anchorOffsetX, f.bitmap.anchorOffsetY, f.bitmap.alpha], [3, 4, 1, 1, 0.5]);
    assert.equal(f.engine.stage.hitTest(11, 14), f.bitmap);
    f.bitmap.dispatchEvent(new sdk.Event(type, undefined)); assert.equal(events, 1);
    assert.deepEqual(f.bitmap.sourceRect, FULL.B);
  } finally { await f.close(); }
});

test('BRS33 repeated independent cycles retire old requests/leases without adopting lease history', async () => {
  const f = await scene();
  try {
    let previous;
    for (let index = 0; index < 18; index++) {
      const id = 'cycle-' + index, value = f.makeValue(id, index % 2 === 0 ? 'B' : 'C');
      const pending = f.replace(id); f.job(id).resolve(value); await fulfilled(pending);
      const current = f.bitmap.textureLease; assert.equal(current.value, value);
      code(() => f.slotScope.use(current), 'OWNERSHIP_CONFLICT');
      if (previous !== undefined) code(() => previous.value, 'ASSET_LEASE_RELEASED');
      previous = current;
    }
    f.slot.dispose();
    for (let index = 0; index < 18; index++) assert.equal(f.count(f.values.get('cycle-' + index)), 1);
    assert.equal(f.initialLease.value, f.values.get('A')); assert.equal(f.count(f.values.get('A')), 0);
    assert.equal(f.bitmap.textureLease, undefined);
  } finally { await f.close(); }
});
