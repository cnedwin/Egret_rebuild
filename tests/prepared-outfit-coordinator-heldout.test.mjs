// SPDX-License-Identifier: Apache-2.0
// Independently selected application interleavings; native PNG decoding is not exercised.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Bitmap, EgretError, createEngine, createAssetType, createAssetRef,
  createImageData2D, createTexture, copyImageData2DPixels, isTexture,
} from '@egret/engine';
import { deferred, flush, host } from './helpers.mjs';

const ART = Object.freeze({
  A: Object.freeze({ bytes: 83, sha256: '376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960', color: [239, 17, 31, 255] }),
  B: Object.freeze({ bytes: 80, sha256: 'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78', color: [19, 223, 47, 255] }),
  C: Object.freeze({ bytes: 81, sha256: 'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66', color: [23, 61, 229, 255] }),
  D: Object.freeze({ bytes: 83, sha256: 'd2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98', color: [241, 211, 29, 255] }),
});
const SETS = Object.freeze({ classic: ['A', 'B'], summer: ['C', 'D'], mix: ['A', 'D'] });

function attempt(operation) {
  try { return { occurred: false, value: operation(), cause: undefined }; }
  catch (cause) { return { occurred: true, value: undefined, cause }; }
}
function succeeded(observation) {
  assert.equal(observation.occurred, false, 'the recorded application call must complete');
  return observation.value;
}
function refused(observation, code) {
  assert.equal(observation.occurred, true, 'an actual refusal must reach the caller');
  assert.ok(observation.cause instanceof EgretError);
  assert.equal(observation.cause.code, code);
  return observation.cause;
}
function track(original) {
  const row = { original, settled: false, occurred: false, value: undefined, cause: undefined };
  // Nested calls can occur inside SDK-caught callbacks; validate this witness outside.
  if (!(original instanceof Promise)) { row.observation = Promise.resolve(); return row; }
  row.observation = original.then(value => {
    row.settled = true; row.value = value;
  }, cause => {
    row.settled = true; row.occurred = true; row.cause = cause;
  });
  return row;
}
async function requestSuccess(row) {
  assert.ok(row, 'a real nested request must have been observed');
  assert.ok(row.original instanceof Promise, 'the accepted request returns its original Promise');
  await row.observation;
  assert.equal(row.occurred, false, 'successful publication must retain its original success');
  assert.equal(row.value, undefined);
}
async function requestFailure(row, code, cause) {
  assert.ok(row, 'a real request must have been observed');
  assert.ok(row.original instanceof Promise, 'the accepted request returns its original Promise');
  await row.observation;
  const error = refused(row, code);
  if (arguments.length === 3) {
    assert.ok(Object.hasOwn(error, 'cause'));
    assert.equal(error.cause, cause);
  }
  return error;
}

async function fixture(label, body) {
  const adapter = host(), diagnostics = [], expectedDiagnostics = [];
  const hooks = { load: undefined, abort: undefined, dispose: undefined, diagnostic: undefined };
  const hookCalls = [], expectedHookFaults = [];
  function invoke(kind, ...args) {
    const hook = hooks[kind];
    if (hook === undefined) return;
    const observation = attempt(() => hook(...args));
    hookCalls.push({ kind, assetId: kind === 'diagnostic' ? undefined : args[0].assetId, ...observation });
    if (observation.occurred) throw observation.cause;
    return observation.value;
  }
  const engine = await createEngine({ host: adapter.adapter, onDiagnostic(value) {
    diagnostics.push(value); invoke('diagnostic', value);
  } });
  const sceneScope = engine.createScope(), nodeScope = engine.createScope(), initialScope = engine.createScope();
  const type = createAssetType('P03 independently controlled application Texture source', isTexture);
  const refs = Object.fromEntries(Object.keys(ART).map(id => [id, createAssetRef(type, id)]));
  const assetEvidence = new WeakMap(), sourceLedger = { active: new Set() };
  const loads = [], disposals = [], issued = [], borrowed = [], hold = new Set();
  let coordinator;
  function texture(assetId) {
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(ART[assetId].color, offset);
    const value = createTexture(createImageData2D({ width: 16, height: 16, pixels }));
    // Controlled CPU evidence exercises composition policy, not native source decoding.
    assetEvidence.set(value, Object.freeze({ assetId, bytes: ART[assetId].bytes, sha256: ART[assetId].sha256,
      width: 16, height: 16, contentRevision: 'p02-outfits-r1', layoutRevision: 'two-layer-r1' }));
    issued.push({ assetId, value });
    return value;
  }
  const provider = {
    load(ref, context) {
      const source = deferred();
      const row = { assetId: ref.id, ref, context, original: source.promise, settled: false, value: undefined,
        fulfill() {
          if (this.settled) return;
          this.settled = true; this.value = texture(this.assetId); source.resolve(this.value);
        } };
      loads.push(row); sourceLedger.active.add(row.original);
      // Only settlement of the actual original task releases its source occupancy.
      void row.original.then(() => sourceLedger.active.delete(row.original), () => sourceLedger.active.delete(row.original));
      context.signal.addEventListener('abort', () => invoke('abort', row));
      invoke('load', row);
      if (!hold.has(ref.id)) row.fulfill();
      return row.original;
    },
    dispose(value) {
      const known = issued.find(row => row.value === value);
      const row = { assetId: known?.assetId, value };
      disposals.push(row);
      try { invoke('dispose', row); }
      finally { value.dispose(); }
    },
  };
  engine.assets.register(type, provider);
  try {
    const initialGroup = engine.createAssetGroup(initialScope, [refs.A, refs.B]);
    const initialMembers = await initialGroup.ready;
    const targets = initialMembers.map((member, index) => {
      const bitmap = nodeScope.use(new Bitmap(member));
      bitmap.x = 2 + index * 20; bitmap.y = 3; bitmap.anchorOffsetX = 1; bitmap.anchorOffsetY = 2;
      engine.stage.addChild(bitmap); return bitmap;
    });
    function frame(key) {
      const captured = engine.captureFrame({ width: 40, height: 20 });
      assert.equal(captured.commands.length, 2);
      assert.ok(captured.commands.every(command => command.kind === 'image'));
      assert.deepEqual(captured.images.map(image => Array.from(copyImageData2DPixels(image).subarray(0, 4))),
        SETS[key].map(id => ART[id].color));
      for (let index = 0; index < targets.length; index++) {
        assert.equal(targets[index].naturalWidth, 16); assert.equal(targets[index].naturalHeight, 16);
        assert.deepEqual(targets[index].sourceRect, { x: 0, y: 0, width: 16, height: 16 });
        assert.equal(targets[index].x, 2 + index * 20); assert.equal(targets[index].y, 3);
        assert.equal(targets[index].anchorOffsetX, 1); assert.equal(targets[index].anchorOffsetY, 2);
      }
      return captured;
    }
    assert.equal(initialGroup.state, 'ready'); assert.ok(Object.isFrozen(initialMembers));
    assert.equal(initialMembers.length, 2); assert.notEqual(initialMembers[0], initialMembers[1]);
    refused(attempt(() => sceneScope.use(initialMembers[0])), 'OWNERSHIP_CONFLICT');
    assert.deepEqual(loads.map(row => row.assetId), ['A', 'B']);
    assert.equal(sourceLedger.active.size, 0); assert.deepEqual(disposals, []);
    frame('classic');
    console.log('P03_APPLICATION_HELD_OUT_GENUINE_BASELINE ' + label);
    // Missing application code is reached only after a real public SDK baseline.
    const application = await import('../examples/prepared-resource-groups/coordinator.mjs');
    assert.equal(typeof application.createPreparedOutfitCoordinator, 'function', 'P03_MISSING_APPLICATION_COORDINATOR');
    coordinator = application.createPreparedOutfitCoordinator({ engine, sceneScope, targets,
      initial: { key: 'classic', group: initialGroup, groupScope: initialScope, members: initialMembers },
      refs, assetEvidence, sourceLedger });
    assert.equal(Object.isFrozen(coordinator), true);
    assert.equal(coordinator.selection, 'classic');
    assert.equal(targets[0].textureLease, initialMembers[0]);
    assert.equal(targets[1].textureLease, initialMembers[1]);
    const f = { engine, coordinator, sceneScope, targets, initialMembers, refs, loads, disposals, issued,
      sourceLedger, hooks, hookCalls, expectedDiagnostics, expectedHookFaults, hold, frame,
      request(key) { return track(coordinator.replace(key)); },
      nested(key) {
        const call = attempt(() => coordinator.replace(key));
        return { call, request: call.occurred ? undefined : track(call.value) };
      },
      async borrow(assetId) {
        const lease = await engine.assets.acquire(refs[assetId]); borrowed.push(lease); return lease;
      },
      keep(lease) { borrowed.push(lease); return lease; },
      source(assetId) { return loads.filter(row => row.assetId === assetId); },
      disposalCount(value) { return disposals.filter(row => row.value === value).length; },
      snapshot() {
        const value = coordinator.snapshot();
        assert.ok(Object.isFrozen(value)); assert.ok(Object.isFrozen(value.logical));
        assert.deepEqual(Object.keys(value).sort(), ['logical', 'pendingKey', 'selection', 'sourcePending', 'state']);
        return value;
      },
      current(key) {
        assert.equal(coordinator.selection, key);
        assert.deepEqual(this.snapshot(), { state: 'open', selection: key, pendingKey: null,
          logical: { sets: 1, encodedBytes: SETS[key].reduce((sum, id) => sum + ART[id].bytes, 0), decodedBytes: 2048 },
          sourcePending: sourceLedger.active.size });
        frame(key);
      },
    };
    f.current('classic');
    await body(f);
  } finally {
    // Reentry and fault injection end before ordinary owner cleanup.
    for (const kind of Object.keys(hooks)) hooks[kind] = undefined;
    const disposal = attempt(() => coordinator?.dispose());
    for (const lease of borrowed) lease.release();
    for (const row of loads) if (!row.settled) row.fulfill();
    await flush();
    initialScope.dispose(); sceneScope.dispose(); nodeScope.dispose();
    await engine.dispose();
    succeeded(disposal);
    assert.equal(sourceLedger.active.size, 0, 'all actually created source jobs settle during final cleanup');
    for (const row of issued) assert.equal(disposals.filter(value => value.value === row.value).length, 1,
      'each actual successful provider result gets exactly one disposal attempt');
    assert.deepEqual(diagnostics.map(row => ({ code: row.code, cause: row.cause })), expectedDiagnostics);
    assert.deepEqual(hookCalls.filter(row => row.occurred).map(row => ({ kind: row.kind, assetId: row.assetId, cause: row.cause })),
      expectedHookFaults, 'a swallowed callback fault must remain an independently asserted observation');
    assert.equal(adapter.timers.size, 0);
  }
}

test('PGA04a synchronous loader reentry retires its attached candidate before any stale second member or publication', async () => {
  await fixture('PGA04a', async f => {
    f.hold.add('C');
    let next, before, after;
    f.hooks.load = row => {
      if (row.assetId !== 'C') return;
      before = f.coordinator.snapshot();
      next = f.nested('mix');
      after = f.coordinator.snapshot();
    };
    const superseded = f.request('summer');
    assert.ok(next, 'the genuine first loader synchronously reenters'); succeeded(next.call);
    assert.equal(before.selection, 'classic'); assert.equal(before.pendingKey, 'summer');
    assert.equal(after.pendingKey, 'mix');
    await requestFailure(superseded, 'PREPARED_OUTFIT_SUPERSEDED');
    await requestSuccess(next.request); await flush();
    f.current('mix');
    assert.deepEqual(f.loads.map(row => row.assetId), ['A', 'B', 'C', 'D']);
    const abandoned = f.source('C')[0];
    assert.equal(abandoned.settled, false); assert.equal(abandoned.context.signal.aborted, true);
    assert.ok(f.sourceLedger.active.has(abandoned.original));
    assert.equal(f.snapshot().sourcePending, 1);
    abandoned.fulfill(); await flush();
    assert.equal(f.disposalCount(abandoned.value), 1); f.current('mix');
  });
});

test('PGA04b cancellation abort may create and cancel a newer intent without reviving either request', async () => {
  await fixture('PGA04b', async f => {
    f.hold.add('C'); f.hold.add('D');
    const firstReason = Object.freeze({ reason: 'cancel original summer' });
    const latestReason = Object.freeze({ reason: 'cancel reentrant mix' });
    const original = f.request('summer');
    let nested, cancelCall, seen = false;
    f.hooks.abort = row => {
      if (row.assetId !== 'C' || seen) return;
      seen = true; nested = f.nested('mix');
      cancelCall = attempt(() => f.coordinator.cancel(latestReason));
    };
    f.coordinator.cancel(firstReason);
    assert.equal(seen, true); succeeded(nested.call); succeeded(cancelCall);
    await requestFailure(original, 'PREPARED_OUTFIT_CANCELLED', firstReason);
    await requestFailure(nested.request, 'PREPARED_OUTFIT_CANCELLED', latestReason);
    await flush(); f.current('classic');
    assert.equal(f.source('C').length, 1); assert.equal(f.source('D').length, 1);
    const originals = f.loads.filter(row => row.assetId === 'C' || row.assetId === 'D');
    assert.equal(originals.length, 2);
    for (const row of originals) {
      assert.equal(row.settled, false); assert.equal(row.context.signal.aborted, true);
      assert.ok(f.sourceLedger.active.has(row.original)); assert.equal(row.value, undefined);
    }
    assert.equal(f.snapshot().sourcePending, 2, 'logical cancellation cannot return occupied original jobs');
    for (const row of originals) row.fulfill();
    await flush(); f.current('classic');
    for (const row of originals) assert.equal(f.disposalCount(row.value), 1);
  });
});

test('PGA04c supersession abort reentry wins over the already accepted outer replacement', async () => {
  await fixture('PGA04c', async f => {
    f.hold.add('C'); f.hold.add('D');
    const first = f.request('summer');
    let newest, seen = false;
    f.hooks.abort = row => {
      if (row.assetId !== 'C' || seen) return;
      seen = true; newest = f.nested('mix');
    };
    const outer = f.request('classic');
    assert.equal(seen, true); succeeded(newest.call);
    await requestFailure(first, 'PREPARED_OUTFIT_SUPERSEDED');
    await requestFailure(outer, 'PREPARED_OUTFIT_SUPERSEDED');
    assert.equal(f.snapshot().pendingKey, 'mix'); f.frame('classic');
    assert.equal(f.source('D').length, 1, 'the latest request shares the genuine still-occupied D task');
    f.source('D')[0].fulfill();
    await requestSuccess(newest.request); await flush(); f.current('mix');
    const late = f.source('C')[0];
    assert.equal(late.settled, false); late.fulfill(); await flush();
    assert.equal(f.disposalCount(late.value), 1); f.current('mix');
  });
});

test('PGA05 actual warm leases delivered before group reactions retire once while independent demand survives', async () => {
  await fixture('PGA05', async f => {
    const warmC = await f.borrow('C'), warmD = await f.borrow('D');
    const warmLastId = Math.max(warmC.leaseId, warmD.leaseId);
    const cValue = warmC.value, dValue = warmD.value;
    const loadsBefore = f.loads.length;
    const candidate = f.request('summer');
    // These calls occur in one stack, before any group or application Promise reaction.
    const probePromise = f.engine.assets.acquire(f.refs.C);
    const reason = Object.freeze({ reason: 'cancel after genuine warm delivery' });
    f.coordinator.cancel(reason);
    const probe = f.keep(await probePromise);
    assert.equal(probe.leaseId, warmLastId + 3,
      'two real candidate leases were created before the independently retained probe');
    assert.equal(probe.value, cValue);
    assert.equal(f.loads.length, loadsBefore, 'a warm delivery is not a held or newly started source');
    await requestFailure(candidate, 'PREPARED_OUTFIT_CANCELLED', reason);
    await flush(); f.current('classic');
    assert.equal(warmC.value, cValue); assert.equal(warmD.value, dValue);
    assert.equal(f.disposalCount(cValue), 0); assert.equal(f.disposalCount(dValue), 0);
    warmD.release();
    assert.equal(f.disposalCount(dValue), 1, 'the stale delivered D member left no orphan demand');
    warmC.release(); assert.equal(f.disposalCount(cValue), 0);
    probe.release(); assert.equal(f.disposalCount(cValue), 1, 'only the final genuine demand retires shared C');
    f.current('classic');
  });
});

test('PGA13a old provider disposal requests a successor after the complete successful business publication', async () => {
  await fixture('PGA13a', async f => {
    const oldB = f.initialMembers[1].value;
    let successor, before, after, seen = false;
    f.hooks.dispose = row => {
      if (row.value !== oldB || seen) return;
      seen = true; before = f.coordinator.snapshot();
      successor = f.nested('classic'); after = f.coordinator.snapshot();
    };
    const published = f.request('summer');
    await requestSuccess(published);
    assert.equal(seen, true); succeeded(successor.call);
    assert.equal(before.selection, 'summer'); assert.equal(before.pendingKey, null);
    assert.equal(before.logical.sets, 2, 'old current remains charged through its real owner cleanup');
    assert.equal(after.selection, 'summer'); assert.equal(after.pendingKey, 'classic');
    assert.equal(after.logical.sets, 3, 'the bounded third reservation covers cleanup reentry');
    await requestSuccess(successor.request); await flush(); f.current('classic');
    assert.equal(f.disposalCount(oldB), 1);
    for (const lease of f.initialMembers) refused(attempt(() => lease.value), 'ASSET_LEASE_RELEASED');
    assert.notEqual(f.targets[0].textureLease, f.initialMembers[0]);
    assert.notEqual(f.targets[1].textureLease, f.initialMembers[1]);
    await requestSuccess(published);
  });
});

test('PGA13b old cleanup closes the coordinator without relabeling committed success or closing Engine', async () => {
  await fixture('PGA13b', async f => {
    const oldB = f.initialMembers[1].value;
    let closing, before, seen = false;
    f.hooks.dispose = row => {
      if (row.value !== oldB || seen) return;
      seen = true; before = f.coordinator.snapshot();
      closing = attempt(() => f.coordinator.dispose());
    };
    const published = f.request('summer');
    await requestSuccess(published); await flush();
    assert.equal(seen, true); succeeded(closing);
    assert.equal(before.selection, 'summer'); assert.equal(before.pendingKey, null);
    assert.deepEqual(f.snapshot(), { state: 'disposed', selection: 'summer', pendingKey: null,
      logical: { sets: 0, encodedBytes: 0, decodedBytes: 0 }, sourcePending: 0 });
    for (const target of f.targets) {
      assert.equal(target.textureLease, undefined); assert.equal(target.sourceRect, undefined);
      assert.equal(target.naturalWidth, 0); assert.equal(target.naturalHeight, 0);
    }
    assert.equal(f.engine.captureFrame({ width: 40, height: 20 }).commands.length, 0);
    const stillOpen = f.engine.createScope(); stillOpen.dispose();
    refused(attempt(() => f.coordinator.replace('classic')), 'PREPARED_OUTFIT_DISPOSED');
    await requestSuccess(published);
  });
});

test('PGA13c undefined cleanup and diagnostic faults keep the exact original success and newer intent', async () => {
  await fixture('PGA13c', async f => {
    const oldB = f.initialMembers[1].value;
    let successor, before, seenDisposer = false, seenDiagnostic = false;
    f.expectedDiagnostics.push({ code: 'ASSET_CLEANUP_FAILED', cause: undefined });
    f.expectedHookFaults.push({ kind: 'dispose', assetId: 'B', cause: undefined },
      { kind: 'diagnostic', assetId: undefined, cause: undefined });
    f.hooks.dispose = row => {
      if (row.value !== oldB || seenDisposer) return;
      seenDisposer = true; throw undefined;
    };
    f.hooks.diagnostic = diagnostic => {
      if (diagnostic.code !== 'ASSET_CLEANUP_FAILED' || seenDiagnostic) return;
      seenDiagnostic = true;
      before = { snapshot: f.coordinator.snapshot(), hasCause: Object.hasOwn(diagnostic, 'cause'), cause: diagnostic.cause };
      successor = f.nested('classic');
      throw undefined;
    };
    const published = f.request('summer');
    await requestSuccess(published);
    assert.equal(seenDisposer, true); assert.equal(seenDiagnostic, true); succeeded(successor.call);
    assert.equal(before.hasCause, true); assert.equal(before.cause, undefined);
    assert.equal(before.snapshot.selection, 'summer'); assert.equal(before.snapshot.pendingKey, null);
    await requestSuccess(successor.request); await flush(); f.current('classic');
    assert.equal(f.disposalCount(oldB), 1);
    await requestSuccess(published);
  });
});
