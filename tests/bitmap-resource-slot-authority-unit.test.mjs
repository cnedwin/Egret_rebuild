// SPDX-License-Identifier: Apache-2.0
// Narrow authority UNIT using existing public runtime assembly and genuine Engine objects.
// Public behavior acceptance is reported separately; no private imports or module hooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '@egret/engine';
import {
  Bitmap, EgretError, createAssetManager, createAssetRef, createAssetType,
  createScope, createTexture, isTexture,
} from '@egret/runtime';
import { createImageData2D } from '@egret/contracts';

// These exact same refs/type/IDs are deliberately reused across independent contexts.
// Equal public IDs and manager-local lease IDs must never supply context authority.
const textureType = createAssetType('BRS36 authority texture', isTexture);
const initialRef = createAssetRef(textureType, 'brs36:shared-initial');
const candidateRef = createAssetRef(textureType, 'brs36:shared-candidate');
const INITIAL_CROP = Object.freeze({ x: 1, y: 0, width: 1, height: 2 });
const CANDIDATE_REGION = Object.freeze({ x: 0, y: 0, width: 3, height: 1 });

function originalTextures() {
  // Original literal pixels; no production packing, capture or comparison algorithm.
  const initial = createTexture(createImageData2D({ width: 2, height: 2, pixels: new Uint8Array([
    241, 13, 23, 255, 17, 227, 37, 255,
    41, 53, 211, 255, 197, 181, 67, 255,
  ]) }));
  const candidate = createTexture(createImageData2D({ width: 3, height: 1, pixels: new Uint8Array([
    7, 191, 113, 255, 223, 83, 149, 255, 101, 157, 229, 255,
  ]) }));
  return { initial, candidate };
}

function providerFor(textures) {
  const loads = [], disposals = [];
  const provider = {
    async load(ref) {
      loads.push(ref);
      if (ref === initialRef) return textures.initial;
      if (ref === candidateRef) return textures.candidate;
      throw new Error('BRS36 fixture received an unauthored ref');
    },
    dispose(value) { disposals.push(value); value.dispose(); },
  };
  return { provider, loads, disposals };
}

function view(bitmap) {
  return {
    lease: bitmap.textureLease,
    crop: bitmap.sourceRect,
    width: bitmap.naturalWidth,
    height: bitmap.naturalHeight,
  };
}

function unchanged(bitmap, saved, label = 'refusal must preserve the original binding fields') {
  assert.equal(bitmap.textureLease, saved.lease, label);
  assert.deepEqual(bitmap.sourceRect, saved.crop, label);
  assert.equal(bitmap.naturalWidth, saved.width, label);
  assert.equal(bitmap.naturalHeight, saved.height, label);
}

function throwsCode(run, expected) {
  assert.throws(run, error => {
    assert.ok(error instanceof EgretError, 'the genuine runtime error must reach the caller');
    assert.equal(error.code, expected);
    return true;
  });
}

async function customScene() {
  const textures = originalTextures(), counters = providerFor(textures);
  const registrations = new Map(), diagnostics = [], cleanupErrors = [];
  let open = true;
  const context = Object.freeze({
    assertOpen() { if (!open) throw new EgretError('ENGINE_CLOSED'); },
    report(value) { diagnostics.push(value); },
    captureCleanup(cause) { cleanupErrors.push(cause); },
    registerBitmapResourceTarget(bitmap, operations) {
      assert.equal(registrations.has(bitmap), false, 'register only a genuinely new Bitmap');
      registrations.set(bitmap, operations);
    },
  });
  const manager = createAssetManager(context);
  manager.register(textureType, counters.provider);
  const initialLease = await manager.acquire(initialRef);
  const candidateLease = await manager.acquire(candidateRef);
  const bitmap = new Bitmap(initialLease);
  bitmap.sourceRect = INITIAL_CROP;
  const bitmaps = [bitmap];
  const scope = createScope(context, () => {});
  return {
    context, manager, scope, bitmap, initialLease, candidateLease, textures,
    registrations, diagnostics, cleanupErrors, ...counters,
    addBitmap() {
      const next = new Bitmap(initialLease);
      next.sourceRect = INITIAL_CROP;
      bitmaps.push(next);
      return next;
    },
    close() {
      for (const target of bitmaps) target.dispose();
      scope.dispose();
      initialLease.release(); candidateLease.release(); manager.dispose();
      open = false;
      assert.deepEqual(diagnostics, [], 'ordinary unit cleanup must emit no diagnostics');
      assert.deepEqual(cleanupErrors, []);
    },
  };
}

async function genuineEngineScene() {
  const textures = originalTextures(), counters = providerFor(textures);
  const timers = new Set(), trace = [];
  const host = {
    surface: {},
    start() { trace.push('start'); },
    stop() { trace.push('stop'); },
    async close() { trace.push('close'); },
    setTimeout(callback, delayMs) {
      const timer = { callback, delayMs }; timers.add(timer);
      return () => { timers.delete(timer); };
    },
  };
  const engine = await createEngine({ host });
  engine.assets.register(textureType, counters.provider);
  const initialLease = await engine.assets.acquire(initialRef);
  const candidateLease = await engine.assets.acquire(candidateRef);
  const bitmap = new Bitmap(initialLease);
  bitmap.sourceRect = INITIAL_CROP;
  engine.stage.addChild(bitmap);
  const capture = () => engine.captureFrame({ width: 8, height: 4 });
  return {
    engine, bitmap, initialLease, candidateLease, textures, capture, ...counters,
    async close() {
      bitmap.dispose(); initialLease.release(); candidateLease.release();
      await engine.dispose();
      assert.equal(timers.size, 0);
      assert.deepEqual(trace, ['start', 'stop', 'close']);
    },
  };
}

function operationsFor(scene, methods = ['capture', 'prepare', 'commit', 'clearIfCurrent', 'claim', 'release']) {
  const operations = scene.registrations.get(scene.bitmap);
  assert.ok(operations, 'BRS36_BITMAP_CONTEXT_REGISTRATION_REQUIRED');
  assert.equal(Object.isFrozen(operations), true, 'the context-bound bridge is immutable');
  for (const name of methods) {
    assert.equal(typeof operations[name], 'function', `BRS36_CONTEXT_OPERATION_REQUIRED:${name}`);
  }
  return operations;
}

test('BRS36 UNIT fixture baseline: existing public runtime assembly and genuine Engine scene', async () => {
  const local = await customScene(), real = await genuineEngineScene();
  try {
    assert.equal(local.initialLease.value, local.textures.initial);
    assert.equal(local.candidateLease.value, local.textures.candidate);
    unchanged(local.bitmap, { lease: local.initialLease, crop: INITIAL_CROP, width: 1, height: 2 });
    assert.equal(local.initialLease.leaseId, real.initialLease.leaseId);
    assert.equal(local.candidateLease.leaseId, real.candidateLease.leaseId);
    assert.deepEqual(local.loads, [initialRef, candidateRef]);
    assert.deepEqual(real.loads, [initialRef, candidateRef]);
    const frame = real.capture();
    assert.equal(frame.commands.length, 1);
    assert.equal(frame.images[0], real.textures.initial.imageData);
    assert.deepEqual(frame.commands[0].sourceRect, INITIAL_CROP);
    assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.deepEqual(local.disposals, []); assert.deepEqual(real.disposals, []);
  } finally { await real.close(); local.close(); }
});

test('BRS36 UNIT own-context full bridge baseline: capture, prepare, claim, commit, clear, release', async () => {
  const f = await customScene();
  try {
    const operations = operationsFor(f), second = f.addBitmap();
    assert.equal(f.registrations.get(second), operations, 'one operations object is shared within the exact context');
    const before = operations.capture(f.bitmap), saved = view(f.bitmap);
    const prepared = operations.prepare(f.bitmap, f.candidateLease);
    unchanged(f.bitmap, saved, 'preparation alone must publish nothing');
    operations.claim(f.bitmap, f.candidateLease, Object.freeze({ owner: 'BRS36 original owner' }));
    throwsCode(() => f.scope.use(f.candidateLease), 'OWNERSHIP_CONFLICT');
    assert.equal(operations.commit(f.bitmap, before, prepared), undefined);
    unchanged(f.bitmap, { lease: f.candidateLease, crop: CANDIDATE_REGION, width: 3, height: 1 });
    const committed = operations.capture(f.bitmap);
    assert.notEqual(committed, before);
    assert.equal(operations.clearIfCurrent(f.bitmap, before), false);
    assert.equal(operations.clearIfCurrent(f.bitmap, committed), true);
    unchanged(f.bitmap, { lease: undefined, crop: undefined, width: 0, height: 0 });
    assert.equal(operations.clearIfCurrent(f.bitmap, committed), false);
    assert.equal(f.initialLease.value, f.textures.initial, 'the initial borrow was never retired');
    assert.deepEqual(f.disposals, []);
    operations.release(f.candidateLease);
    throwsCode(() => f.candidateLease.value, 'ASSET_LEASE_RELEASED');
    assert.deepEqual(f.disposals, [f.textures.candidate]);
    operations.release(f.candidateLease);
    assert.deepEqual(f.disposals, [f.textures.candidate], 'repeat release must not dispose twice');
  } finally { f.close(); }
});

test('BRS36 UNIT exact context refuses every foreign real-Engine target/lease operation before mutation or release', async () => {
  const own = await customScene(), foreign = await genuineEngineScene();
  try {
    const ops = operationsFor(own), original = view(own.bitmap), other = view(foreign.bitmap);
    const expected = ops.capture(own.bitmap), prepared = ops.prepare(own.bitmap, own.candidateLease);
    const actions = [
      () => ops.capture(foreign.bitmap),
      () => ops.prepare(foreign.bitmap, own.candidateLease),
      () => ops.prepare(own.bitmap, foreign.candidateLease),
      () => ops.commit(foreign.bitmap, expected, prepared),
      () => ops.clearIfCurrent(foreign.bitmap, expected),
      () => ops.claim(foreign.bitmap, own.candidateLease, {}),
      () => ops.claim(own.bitmap, foreign.candidateLease, {}),
      () => ops.release(foreign.initialLease),
      () => ops.release(foreign.candidateLease),
    ];
    for (const action of actions) {
      throwsCode(action, 'ENGINE_MISMATCH');
      unchanged(own.bitmap, original); unchanged(foreign.bitmap, other);
      assert.equal(own.initialLease.value, own.textures.initial);
      assert.equal(own.candidateLease.value, own.textures.candidate);
      assert.equal(foreign.initialLease.value, foreign.textures.initial);
      assert.equal(foreign.candidateLease.value, foreign.textures.candidate);
      assert.deepEqual(own.disposals, []); assert.deepEqual(foreign.disposals, []);
      assert.deepEqual(foreign.capture().commands[0].sourceRect, INITIAL_CROP);
    }
    ops.commit(own.bitmap, expected, prepared);
    assert.equal(own.bitmap.textureLease, own.candidateLease, 'foreign refusals did not consume the valid own token');
  } finally { await foreign.close(); own.close(); }
});

test('BRS36 UNIT same refs and equal manager IDs in another custom context do not transfer authority', async () => {
  const own = await customScene(), foreign = await customScene();
  try {
    const ops = operationsFor(own), foreignOps = operationsFor(foreign);
    assert.notEqual(ops, foreignOps, 'operations are cached per exact context, never globally unbound');
    assert.equal(own.initialLease.leaseId, foreign.initialLease.leaseId);
    assert.equal(own.candidateLease.leaseId, foreign.candidateLease.leaseId);
    const original = view(own.bitmap), other = view(foreign.bitmap);
    for (const run of [
      () => ops.capture(foreign.bitmap),
      () => ops.clearIfCurrent(foreign.bitmap, foreignOps.capture(foreign.bitmap)),
      () => ops.prepare(own.bitmap, foreign.candidateLease),
      () => ops.claim(own.bitmap, foreign.candidateLease, {}),
      () => ops.release(foreign.candidateLease),
    ]) {
      throwsCode(run, 'ENGINE_MISMATCH');
      unchanged(own.bitmap, original); unchanged(foreign.bitmap, other);
      assert.equal(foreign.candidateLease.value, foreign.textures.candidate);
      assert.deepEqual(own.disposals, []); assert.deepEqual(foreign.disposals, []);
    }
  } finally { foreign.close(); own.close(); }
});

test('BRS36 UNIT Proxy targets fail context admission without reading target traps or changing genuine targets', async () => {
  const f = await customScene();
  try {
    const ops = operationsFor(f), saved = view(f.bitmap), expected = ops.capture(f.bitmap);
    const prepared = ops.prepare(f.bitmap, f.candidateLease), reads = [];
    const proxy = new Proxy(f.bitmap, {
      get(_target, key) { reads.push(['get', key]); throw new Error('target trap must not run'); },
      getPrototypeOf() { reads.push(['prototype']); throw new Error('target trap must not run'); },
    });
    for (const run of [
      () => ops.capture(proxy), () => ops.prepare(proxy, f.candidateLease),
      () => ops.commit(proxy, expected, prepared), () => ops.clearIfCurrent(proxy, expected),
      () => ops.claim(proxy, f.candidateLease, {}),
    ]) {
      throwsCode(run, 'ENGINE_MISMATCH'); unchanged(f.bitmap, saved);
      assert.deepEqual(reads, []); assert.deepEqual(f.disposals, []);
      assert.equal(f.candidateLease.value, f.textures.candidate);
    }
    ops.commit(f.bitmap, expected, prepared);
    assert.equal(f.bitmap.textureLease, f.candidateLease);
  } finally { f.close(); }
});

test('BRS36 UNIT fabricated and copied prepared tokens are refused without token-field reads', async () => {
  const f = await customScene();
  try {
    const ops = operationsFor(f), expected = ops.capture(f.bitmap), saved = view(f.bitmap);
    const prepared = ops.prepare(f.bitmap, f.candidateLease), tokenReads = [];
    const fields = {};
    for (const key of ['target', 'candidateLease', 'state', 'lease', 'sourceRect', 'width', 'height']) {
      Object.defineProperty(fields, key, { enumerable: true, get() {
        tokenReads.push(key); throw new Error('fabricated token fields must not be read');
      } });
    }
    const proxyToken = new Proxy({}, {
      get(_target, key) { tokenReads.push(['get', key]); throw new Error('token trap must not run'); },
      has(_target, key) { tokenReads.push(['has', key]); throw new Error('token trap must not run'); },
      ownKeys() { tokenReads.push(['keys']); throw new Error('token trap must not run'); },
      getOwnPropertyDescriptor() { tokenReads.push(['descriptor']); throw new Error('token trap must not run'); },
      getPrototypeOf() { tokenReads.push(['prototype']); throw new Error('token trap must not run'); },
    });
    const copied = Object.create(Object.getPrototypeOf(prepared), Object.getOwnPropertyDescriptors(prepared));
    for (const invalid of [{}, fields, proxyToken, copied]) {
      throwsCode(() => ops.commit(f.bitmap, expected, invalid), 'BITMAP_RESOURCE_PREPARED_INVALID');
      unchanged(f.bitmap, saved); assert.deepEqual(tokenReads, []);
      assert.equal(f.candidateLease.value, f.textures.candidate); assert.deepEqual(f.disposals, []);
    }
    ops.commit(f.bitmap, expected, prepared);
    assert.equal(f.bitmap.textureLease, f.candidateLease);
  } finally { f.close(); }
});

test('BRS36 UNIT foreign-context and wrong-target prepared tokens refuse; failed attempts do not consume genuine tokens', async () => {
  const own = await customScene(), foreign = await customScene();
  try {
    const ops = operationsFor(own), foreignOps = operationsFor(foreign), second = own.addBitmap();
    const expected = ops.capture(own.bitmap), secondExpected = ops.capture(second);
    const prepared = ops.prepare(own.bitmap, own.candidateLease);
    const foreignPrepared = foreignOps.prepare(foreign.bitmap, foreign.candidateLease);
    const saved = view(own.bitmap), secondSaved = view(second), foreignSaved = view(foreign.bitmap);
    throwsCode(() => ops.commit(own.bitmap, expected, foreignPrepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
    throwsCode(() => ops.commit(second, secondExpected, prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
    unchanged(own.bitmap, saved); unchanged(second, secondSaved); unchanged(foreign.bitmap, foreignSaved);
    assert.deepEqual(own.disposals, []); assert.deepEqual(foreign.disposals, []);
    assert.equal(foreign.candidateLease.value, foreign.textures.candidate);
    ops.commit(own.bitmap, expected, prepared);
    foreignOps.commit(foreign.bitmap, foreignOps.capture(foreign.bitmap), foreignPrepared);
    assert.equal(own.bitmap.textureLease, own.candidateLease);
    assert.equal(foreign.bitmap.textureLease, foreign.candidateLease);
  } finally { foreign.close(); own.close(); }
});

test('BRS36 UNIT successful prepared token is consumed once even with an otherwise valid current expected binding', async () => {
  const f = await customScene();
  try {
    const ops = operationsFor(f), expected = ops.capture(f.bitmap), prepared = ops.prepare(f.bitmap, f.candidateLease);
    ops.commit(f.bitmap, expected, prepared);
    const saved = view(f.bitmap), current = ops.capture(f.bitmap);
    throwsCode(() => ops.commit(f.bitmap, current, prepared), 'BITMAP_RESOURCE_PREPARED_INVALID');
    unchanged(f.bitmap, saved);
    assert.equal(f.candidateLease.value, f.textures.candidate); assert.deepEqual(f.disposals, []);
  } finally { f.close(); }
});

for (const scenario of [
  { name: 'captured lease released', code: 'ASSET_LEASE_RELEASED', revoke: f => f.initialLease.release(), released: 'initial' },
  { name: 'candidate lease released', code: 'ASSET_LEASE_RELEASED', revoke: f => f.candidateLease.release(), released: 'candidate' },
  { name: 'captured Texture disposed', code: 'TEXTURE_DISPOSED', revoke: f => f.textures.initial.dispose() },
  { name: 'candidate Texture disposed', code: 'TEXTURE_DISPOSED', revoke: f => f.textures.candidate.dispose() },
]) {
  test(`BRS36 UNIT prepare then ${scenario.name}: fresh commit entitlement refuses and preserves old fields`, async () => {
    const f = await customScene();
    try {
      const ops = operationsFor(f), expected = ops.capture(f.bitmap), saved = view(f.bitmap);
      const prepared = ops.prepare(f.bitmap, f.candidateLease);
      scenario.revoke(f);
      const disposalBefore = [...f.disposals];
      throwsCode(() => ops.commit(f.bitmap, expected, prepared), scenario.code);
      unchanged(f.bitmap, saved);
      assert.deepEqual(f.disposals, disposalBefore, 'refused commit must not release any lease');
      // The failed token remains unconsumed, but retry must repeat fresh entitlement checks.
      throwsCode(() => ops.commit(f.bitmap, expected, prepared), scenario.code);
      unchanged(f.bitmap, saved); assert.deepEqual(f.disposals, disposalBefore);
      if (scenario.released !== 'initial') assert.equal(f.initialLease.value, f.textures.initial);
      if (scenario.released !== 'candidate') assert.equal(f.candidateLease.value, f.textures.candidate);
    } finally { f.close(); }
  });
}
