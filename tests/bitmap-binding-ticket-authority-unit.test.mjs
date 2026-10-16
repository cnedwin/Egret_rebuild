// SPDX-License-Identifier: Apache-2.0
// Bounded authority UNIT through public runtime assembly; execution remains separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '@egret/engine';
import {
  Bitmap, Sprite, EgretError, createAssetManager, createAssetRef, createAssetType,
  createScope, createTexture, isTexture,
} from '@egret/runtime';
import { createImageData2D } from '@egret/contracts';
import { host } from './helpers.mjs';

// Every context deliberately reuses these exact public refs and manager-local IDs.
const type = createAssetType('P03 original authority UNIT Texture', isTexture);
const refs = ['initial-left', 'initial-right', 'candidate-left', 'candidate-right']
  .map(name => createAssetRef(type, 'p03-authority:' + name));
const INITIAL_CROPS = [{ x: 1, y: 0, width: 1, height: 2 }, { x: 0, y: 0, width: 2, height: 1 }];
const CANDIDATE_VIEWS = [{ x: 1, y: 1, width: 1, height: 2 }, { x: 1, y: 0, width: 3, height: 2 }];

function literalTextures() {
  const specs = [
    [2, 2, [241, 13, 23, 255]], [3, 1, [17, 227, 37, 255]],
    [3, 3, [41, 53, 211, 255]], [4, 2, [197, 181, 67, 255]],
  ];
  return specs.map(([width, height, rgba], index) => {
    const pixels = new Uint8Array(width * height * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(rgba, offset);
    return createTexture(createImageData2D({ width, height, pixels }), index < 2 ? undefined : CANDIDATE_VIEWS[index - 2]);
  });
}

function sourceFor(textures) {
  const loads = [], disposals = [];
  const provider = {
    load(ref) {
      loads.push({ ref, receiver: this });
      const index = refs.indexOf(ref);
      if (index === -1) throw new Error('Unauthored P03 authority ref');
      return Promise.resolve(textures[index]);
    },
    dispose(texture) { disposals.push(texture); texture.dispose(); },
  };
  return { provider, loads, disposals };
}

function fields(bitmap) {
  return { lease: bitmap.textureLease, crop: bitmap.sourceRect, width: bitmap.naturalWidth, height: bitmap.naturalHeight };
}
function unchanged(targets, before) {
  for (let index = 0; index < targets.length; index++) {
    assert.equal(targets[index].textureLease, before[index].lease);
    assert.equal(targets[index].sourceRect, before[index].crop);
    assert.equal(targets[index].naturalWidth, before[index].width);
    assert.equal(targets[index].naturalHeight, before[index].height);
  }
}
function empty(targets) {
  for (const bitmap of targets) assert.deepEqual(fields(bitmap), { lease: undefined, crop: undefined, width: 0, height: 0 });
}
function code(run, expected) {
  assert.throws(run, cause => cause instanceof EgretError && cause.code === expected);
}
function opaque(value) { assert.ok(value !== null && typeof value === 'object'); }
function copyHandle(value) { return Object.create(Object.getPrototypeOf(value), Object.getOwnPropertyDescriptors(value)); }
function trapHandle(reads) {
  const value = Object.create(null);
  for (const key of ['targets', 'bitmap', 'members', 'lease', 'captured', 'prepared', 'records']) {
    Object.defineProperty(value, key, { enumerable: true, get() { reads.push(key); return undefined; } });
  }
  return value;
}
function liveBorrows(f) {
  for (let index = 0; index < f.leases.length; index++) assert.equal(f.leases[index].value, f.textures[index]);
  assert.deepEqual(f.disposals, []);
}
function sameOwners(f) {
  for (const lease of f.leases) assert.equal(f.resourceScope.use(lease), lease);
}
function published(f, members = f.candidates) {
  for (let index = 0; index < f.targets.length; index++) {
    assert.equal(f.targets[index].textureLease, members[index]);
    const view = members[index] === f.candidates[0] ? CANDIDATE_VIEWS[0] : CANDIDATE_VIEWS[1];
    assert.deepEqual(f.targets[index].sourceRect, view);
    assert.equal(f.targets[index].naturalWidth, view.width);
    assert.equal(f.targets[index].naturalHeight, view.height);
  }
}

async function customFixture() {
  const textures = literalTextures(), counters = sourceFor(textures);
  const registrations = new Map(), duplicateRegistrations = [], diagnostics = [], cleanupErrors = [];
  let open = true;
  const context = Object.freeze({
    assertOpen() { if (!open) throw new EgretError('ENGINE_CLOSED'); },
    report(value) { diagnostics.push(value); },
    captureCleanup(cause) { cleanupErrors.push(cause); },
    registerBitmapResourceTarget(bitmap, operations) {
      if (registrations.has(bitmap)) duplicateRegistrations.push(bitmap);
      registrations.set(bitmap, operations);
    },
  });
  const manager = createAssetManager(context), resourceScope = createScope(context, () => {});
  manager.register(type, counters.provider);
  const leases = [];
  for (const ref of refs) leases.push(await manager.acquire(ref));
  const pair = () => leases.slice(0, 2).map((lease, index) => {
    const bitmap = new Bitmap(lease); bitmap.sourceRect = INITIAL_CROPS[index]; return bitmap;
  });
  const healthTargets = pair(), targets = pair(), single = new Bitmap(leases[0]);
  const nonBitmap = resourceScope.use(new Sprite());
  const allTargets = [...healthTargets, ...targets, single];
  return {
    context, manager, resourceScope, textures, leases, candidates: leases.slice(2), targets, healthTargets,
    single, nonBitmap, registrations, duplicateRegistrations, diagnostics, cleanupErrors, ...counters,
    closeAdmission() { open = false; },
    close() {
      for (const bitmap of allTargets) bitmap.dispose();
      resourceScope.dispose();
      for (const lease of leases) lease.release();
      manager.dispose(); open = false;
      // These assertions are outside every SDK provider/diagnostic/Scope callback.
      assert.deepEqual(duplicateRegistrations, []); assert.deepEqual(diagnostics, []); assert.deepEqual(cleanupErrors, []);
      assert.equal(counters.disposals.length, 4);
      for (const texture of textures) assert.equal(counters.disposals.filter(value => value === texture).length, 1);
    },
  };
}

function existingBaseline(f) {
  liveBorrows(f);
  assert.deepEqual(f.loads.map(row => row.ref), refs);
  assert.ok(f.loads.every(row => row.receiver === f.provider));
  const operations = f.registrations.get(f.single);
  assert.ok(operations, 'Genuine Bitmap construction must register its context operations');
  assert.equal(Object.isFrozen(operations), true);
  for (const name of ['capture', 'prepare', 'commit', 'clearIfCurrent', 'claim', 'release']) {
    assert.equal(typeof operations[name], 'function', 'Existing operation required: ' + name);
  }
  for (const target of [...f.targets, ...f.healthTargets]) assert.equal(f.registrations.get(target), operations);
  const captured = operations.capture(f.single), prepared = operations.prepare(f.single, f.candidates[0]);
  operations.commit(f.single, captured, prepared);
  assert.equal(f.single.textureLease, f.candidates[0]);
  assert.deepEqual(f.single.sourceRect, CANDIDATE_VIEWS[0]);
  assert.equal(operations.clearIfCurrent(f.single, operations.capture(f.single)), true);
  empty([f.single]); liveBorrows(f);
  return operations;
}

function healthyBatch(f, operations) {
  for (const name of ['captureBatch', 'prepareBatch', 'commitBatch', 'clearBatchIfCurrent']) {
    assert.equal(typeof operations[name], 'function', 'P03_BATCH_OPERATION_REQUIRED:' + name);
  }
  const before = f.healthTargets.map(fields), captured = operations.captureBatch(f.healthTargets);
  opaque(captured);
  const prepared = operations.prepareBatch(captured, f.candidates); opaque(prepared);
  unchanged(f.healthTargets, before);
  const publication = operations.commitBatch(captured, prepared); opaque(publication);
  for (let index = 0; index < 2; index++) {
    assert.equal(f.healthTargets[index].textureLease, f.candidates[index]);
    assert.deepEqual(f.healthTargets[index].sourceRect, CANDIDATE_VIEWS[index]);
    assert.equal(f.healthTargets[index].naturalWidth, CANDIDATE_VIEWS[index].width);
    assert.equal(f.healthTargets[index].naturalHeight, CANDIDATE_VIEWS[index].height);
  }
  assert.equal(operations.clearBatchIfCurrent(publication), undefined);
  assert.equal(operations.clearBatchIfCurrent(publication), undefined);
  empty(f.healthTargets); liveBorrows(f);
  // Unowned borrows remain adoptable; subsequent cases use genuine Scope-owned members.
  sameOwners(f);
  assert.deepEqual(f.targets.map(target => target.sourceRect), INITIAL_CROPS);
  console.log('P03_AUTHORITY_FRESH_OWN_BATCH_BASELINE_COMPLETE');
}
async function withOwn(body) {
  const f = await customFixture();
  try { const operations = existingBaseline(f); healthyBatch(f, operations); await body(f, operations); }
  finally { f.close(); }
}
function plan(f, operations) {
  const captured = operations.captureBatch(f.targets), prepared = operations.prepareBatch(captured, f.candidates);
  opaque(captured); opaque(prepared); return { captured, prepared };
}
function finish(f, operations, ready) {
  const publication = operations.commitBatch(ready.captured, ready.prepared);
  opaque(publication); published(f); liveBorrows(f); sameOwners(f);
  operations.clearBatchIfCurrent(publication); operations.clearBatchIfCurrent(publication);
  empty(f.targets); liveBorrows(f); sameOwners(f);
}

async function realEngineFixture() {
  const h = host(), engine = await createEngine({ host: h.adapter });
  const textures = literalTextures(), counters = sourceFor(textures);
  engine.assets.register(type, counters.provider);
  const leases = [];
  for (const ref of refs) leases.push(await engine.assets.acquire(ref));
  const targets = leases.slice(0, 2).map((lease, index) => {
    const bitmap = new Bitmap(lease); bitmap.sourceRect = INITIAL_CROPS[index]; engine.stage.addChild(bitmap); return bitmap;
  });
  const capture = () => engine.captureFrame({ width: 16, height: 8 });
  return {
    engine, textures, leases, targets, candidates: leases.slice(2), capture, ...counters,
    async close() {
      for (const bitmap of targets) bitmap.dispose();
      for (const lease of leases) lease.release();
      await engine.dispose();
      assert.deepEqual(h.trace, ['start', 'stop', 'close']); assert.equal(h.timers.size, 0);
      assert.equal(counters.disposals.length, 4);
      for (const texture of textures) assert.equal(counters.disposals.filter(value => value === texture).length, 1);
    },
  };
}
function realBaseline(f) {
  liveBorrows(f);
  const frame = f.capture();
  assert.equal(frame.commands.length, 2);
  assert.equal(frame.images[0], f.textures[0].imageData); assert.equal(frame.images[1], f.textures[1].imageData);
  assert.deepEqual(frame.commands.map(command => command.sourceRect), INITIAL_CROPS);
}

test('PGU00 existing public runtime and real Engine remain healthy before the proposed batch bridge', async () => {
  const own = await customFixture(), real = await realEngineFixture();
  try { existingBaseline(own); realBaseline(real); }
  finally { await real.close(); own.close(); }
});

test('PGU01 own batch publishes complete nonzero views, accepts repeated borrowed members and never claims or releases', async () => {
  await withOwn((f, operations) => {
    const captured = operations.captureBatch(f.targets), members = [f.candidates[0], f.candidates[0]];
    const before = f.targets.map(fields), prepared = operations.prepareBatch(captured, members);
    unchanged(f.targets, before);
    const publication = operations.commitBatch(captured, prepared); published(f, members);
    liveBorrows(f); sameOwners(f);
    operations.clearBatchIfCurrent(publication); operations.clearBatchIfCurrent(publication);
    empty(f.targets); liveBorrows(f); sameOwners(f);
  });
});

for (const kind of ['captured', 'prepared', 'publication']) {
  for (const mode of ['fabricated', 'copied']) {
    test('PGU02 ' + mode + ' ' + kind + ' handle refuses without caller-field reads or genuine writes', async () => {
      await withOwn((f, operations) => {
        const ready = plan(f, operations), reads = [];
        let genuine = ready[kind], publication;
        if (kind === 'publication') { publication = operations.commitBatch(ready.captured, ready.prepared); genuine = publication; }
        const invalid = mode === 'copied' ? copyHandle(genuine) : trapHandle(reads);
        const before = f.targets.map(fields);
        if (kind === 'captured') {
          code(() => operations.prepareBatch(invalid, f.candidates), 'BITMAP_RESOURCE_PREPARED_INVALID');
          code(() => operations.commitBatch(invalid, ready.prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
        } else if (kind === 'prepared') {
          code(() => operations.commitBatch(ready.captured, invalid), 'BITMAP_RESOURCE_PREPARED_INVALID');
        } else code(() => operations.clearBatchIfCurrent(invalid), 'BITMAP_RESOURCE_PREPARED_INVALID');
        unchanged(f.targets, before); assert.deepEqual(reads, []); liveBorrows(f); sameOwners(f);
        if (publication !== undefined) { operations.clearBatchIfCurrent(publication); empty(f.targets); }
        else finish(f, operations, ready);
      });
    });
  }
}

for (const kind of ['captured', 'prepared', 'publication']) {
  test('PGU03 foreign-context ' + kind + ' handle has no authority despite equal refs and lease IDs', async () => {
    await withOwn(async (own, operations) => {
      await withOwn((foreign, foreignOperations) => {
        assert.notEqual(own.context, foreign.context); assert.notEqual(operations, foreignOperations);
        assert.deepEqual(own.leases.map(lease => lease.leaseId), foreign.leases.map(lease => lease.leaseId));
        const ready = plan(own, operations), foreignReady = plan(foreign, foreignOperations);
        let foreignPublication;
        if (kind === 'publication') foreignPublication = foreignOperations.commitBatch(foreignReady.captured, foreignReady.prepared);
        const before = own.targets.map(fields), other = foreign.targets.map(fields);
        if (kind === 'captured') {
          code(() => operations.prepareBatch(foreignReady.captured, own.candidates), 'BITMAP_RESOURCE_PREPARED_INVALID');
          code(() => operations.commitBatch(foreignReady.captured, ready.prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
        } else if (kind === 'prepared') {
          code(() => operations.commitBatch(ready.captured, foreignReady.prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
        } else code(() => operations.clearBatchIfCurrent(foreignPublication), 'BITMAP_RESOURCE_PREPARED_INVALID');
        unchanged(own.targets, before); unchanged(foreign.targets, other);
        liveBorrows(own); liveBorrows(foreign); sameOwners(own); sameOwners(foreign);
        finish(own, operations, ready);
        if (foreignPublication !== undefined) { foreignOperations.clearBatchIfCurrent(foreignPublication); empty(foreign.targets); }
        else finish(foreign, foreignOperations, foreignReady);
      });
    });
  });
}

test('PGU04 prepared provenance binds the exact capture even with identical targets and expected records', async () => {
  await withOwn((f, operations) => {
    const ready = plan(f, operations), secondCapture = operations.captureBatch(f.targets), before = f.targets.map(fields);
    code(() => operations.commitBatch(secondCapture, ready.prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
    unchanged(f.targets, before); liveBorrows(f); sameOwners(f);
    finish(f, operations, ready);
  });
});

test('PGU05 successful prepared plan is consumed before any subsequent binding-conflict check', async () => {
  await withOwn((f, operations) => {
    const ready = plan(f, operations), publication = operations.commitBatch(ready.captured, ready.prepared);
    const before = f.targets.map(fields); published(f);
    code(() => operations.commitBatch(ready.captured, ready.prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
    unchanged(f.targets, before); liveBorrows(f); sameOwners(f);
    operations.clearBatchIfCurrent(publication); operations.clearBatchIfCurrent(publication); empty(f.targets);
  });
});

for (const boundary of ['target', 'lease']) {
  test('PGU06 own custom port refuses real Engine foreign ' + boundary + ' before writes or cleanup', async () => {
    await withOwn(async (own, operations) => {
      const foreign = await realEngineFixture();
      try {
        realBaseline(foreign);
        assert.deepEqual(own.leases.map(lease => lease.leaseId), foreign.leases.map(lease => lease.leaseId));
        const before = own.targets.map(fields), other = foreign.targets.map(fields);
        if (boundary === 'target') code(() => operations.captureBatch([own.targets[0], foreign.targets[1]]), 'ENGINE_MISMATCH');
        else {
          const captured = operations.captureBatch(own.targets);
          code(() => operations.prepareBatch(captured, [own.candidates[0], foreign.candidates[1]]), 'ENGINE_MISMATCH');
        }
        unchanged(own.targets, before); unchanged(foreign.targets, other);
        liveBorrows(own); sameOwners(own); realBaseline(foreign);
        finish(own, operations, plan(own, operations));
      } finally { await foreign.close(); }
    });
  });
}

for (const boundary of ['target', 'lease']) {
  test('PGU07 distinct custom contexts with equal manager IDs refuse foreign genuine ' + boundary, async () => {
    await withOwn(async (own, operations) => {
      await withOwn((foreign, foreignOperations) => {
        assert.notEqual(operations, foreignOperations);
        assert.deepEqual(own.leases.map(lease => lease.leaseId), foreign.leases.map(lease => lease.leaseId));
        const before = own.targets.map(fields), other = foreign.targets.map(fields);
        if (boundary === 'target') code(() => operations.captureBatch([own.targets[0], foreign.targets[1]]), 'ENGINE_MISMATCH');
        else {
          const captured = operations.captureBatch(own.targets);
          code(() => operations.prepareBatch(captured, [own.candidates[0], foreign.candidates[1]]), 'ENGINE_MISMATCH');
        }
        unchanged(own.targets, before); unchanged(foreign.targets, other);
        liveBorrows(own); liveBorrows(foreign); sameOwners(own); sameOwners(foreign);
        finish(own, operations, plan(own, operations));
        finish(foreign, foreignOperations, plan(foreign, foreignOperations));
      });
    });
  });
}

test('PGU08 genuine same-context Sprite cannot cross the Bitmap brand boundary', async () => {
  await withOwn((f, operations) => {
    const before = f.targets.map(fields);
    code(() => operations.captureBatch([f.targets[0], f.nonBitmap]), 'BITMAP_INVALID');
    unchanged(f.targets, before); liveBorrows(f); sameOwners(f);
    finish(f, operations, plan(f, operations));
  });
});

test('PGU09 copied public lease IDs and a value getter never authenticate a candidate lease', async () => {
  await withOwn((f, operations) => {
    const reads = [], before = f.targets.map(fields), captured = operations.captureBatch(f.targets);
    const fabricated = {
      leaseId: f.candidates[1].leaseId, resourceGeneration: f.candidates[1].resourceGeneration,
      get value() { reads.push('value'); return f.textures[3]; },
    };
    code(() => operations.prepareBatch(captured, [f.candidates[0], fabricated]), 'BITMAP_LEASE_INVALID');
    unchanged(f.targets, before); assert.deepEqual(reads, []); liveBorrows(f); sameOwners(f);
    const prepared = operations.prepareBatch(captured, f.candidates);
    finish(f, operations, { captured, prepared });
  });
});

test('PGU10 genuine publication clears only matching records after entitlement revocation and context closing', async () => {
  await withOwn((f, operations) => {
    const ready = plan(f, operations), publication = operations.commitBatch(ready.captured, ready.prepared);
    published(f); sameOwners(f);
    f.targets[1].textureLease = f.candidates[1];
    const manual = fields(f.targets[1]);
    f.candidates[0].release();
    assert.deepEqual(f.disposals, [f.textures[2]]);
    f.closeAdmission();
    assert.equal(operations.clearBatchIfCurrent(publication), undefined);
    empty([f.targets[0]]); unchanged([f.targets[1]], [manual]);
    assert.equal(operations.clearBatchIfCurrent(publication), undefined);
    empty([f.targets[0]]); unchanged([f.targets[1]], [manual]);
    code(() => f.candidates[0].value, 'ASSET_LEASE_RELEASED');
    assert.equal(f.leases[0].value, f.textures[0]); assert.equal(f.leases[1].value, f.textures[1]);
    assert.equal(f.candidates[1].value, f.textures[3]);
    assert.deepEqual(f.disposals, [f.textures[2]], 'Conditional clear must never release a borrowed lease');
  });
});
