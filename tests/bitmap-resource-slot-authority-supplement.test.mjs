// SPDX-License-Identifier: Apache-2.0
// Original source-review counterexamples for the existing custom-context boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Bitmap, Sprite, EgretError, createAssetManager, createAssetRef, createAssetType,
  createScope, createTexture, isTexture,
} from '@egret/runtime';
import { createImageData2D } from '@egret/contracts';

const type = createAssetType('BRS36 supplemental original texture', isTexture);
const initialRef = createAssetRef(type, 'supplement:initial');
const candidateRef = createAssetRef(type, 'supplement:candidate');
const leaseGetter = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'textureLease').get;

function code(run, expected) {
  assert.throws(run, error => {
    assert.ok(error instanceof EgretError);
    assert.equal(error.code, expected);
    return true;
  });
}

async function fixture() {
  const registrations = new Map(), diagnostics = [], disposals = [];
  const context = Object.freeze({
    assertOpen() {}, report(value) { diagnostics.push(value); }, captureCleanup() {},
    registerBitmapResourceTarget(bitmap, operations) { registrations.set(bitmap, operations); },
  });
  const manager = createAssetManager(context), scope = createScope(context, () => {});
  const initial = createTexture(createImageData2D({ width: 1, height: 1,
    pixels: new Uint8Array([233, 19, 31, 255]) }));
  const candidate = createTexture(createImageData2D({ width: 2, height: 1,
    pixels: new Uint8Array([17, 211, 47, 255, 61, 89, 197, 255]) }));
  manager.register(type, {
    async load(ref) { return ref === initialRef ? initial : candidate; },
    dispose(value) { disposals.push(value); value.dispose(); },
  });
  const initialLease = await manager.acquire(initialRef), candidateLease = await manager.acquire(candidateRef);
  const bitmap = new Bitmap(initialLease), nonBitmap = scope.use(new Sprite());
  const operations = registrations.get(bitmap);
  assert.ok(operations, 'genuine constructor registration is required');
  for (const name of ['capture', 'prepare', 'commit', 'clearIfCurrent', 'claim', 'release']) {
    assert.equal(typeof operations[name], 'function', `missing full bridge method ${name}`);
  }
  // This is a genuine same-context display node, authenticated only by existing Scope.use.
  code(() => Reflect.apply(leaseGetter, nonBitmap, []), 'BITMAP_INVALID');
  return {
    bitmap, nonBitmap, scope, operations, initialLease, candidateLease, initial, candidate,
    diagnostics, disposals,
    close() {
      bitmap.dispose(); scope.dispose(); initialLease.release(); candidateLease.release(); manager.dispose();
      assert.deepEqual(diagnostics, []);
    },
  };
}

test('BRS36 supplemental baseline: genuine target commits while same-context Sprite remains non-Bitmap', async () => {
  const f = await fixture();
  try {
    const expected = f.operations.capture(f.bitmap);
    const prepared = f.operations.prepare(f.bitmap, f.candidateLease);
    f.operations.commit(f.bitmap, expected, prepared);
    assert.equal(f.bitmap.textureLease, f.candidateLease);
    assert.deepEqual(f.bitmap.sourceRect, { x: 0, y: 0, width: 2, height: 1 });
    code(() => Reflect.apply(leaseGetter, f.nonBitmap, []), 'BITMAP_INVALID');
    assert.deepEqual(f.disposals, []);
  } finally { f.close(); }
});

test('BRS36 supplemental same-context non-Bitmap target operations preserve the Bitmap brand boundary', async () => {
  for (const name of ['capture', 'prepare', 'clearIfCurrent', 'commit']) {
    const f = await fixture();
    try {
      const expected = f.operations.capture(f.bitmap);
      const prepared = f.operations.prepare(f.bitmap, f.candidateLease);
      const actions = {
        capture: () => f.operations.capture(f.nonBitmap),
        prepare: () => f.operations.prepare(f.nonBitmap, f.candidateLease),
        commit: () => f.operations.commit(f.nonBitmap, undefined, prepared),
        clearIfCurrent: () => f.operations.clearIfCurrent(f.nonBitmap, undefined),
      };
      code(actions[name], 'BITMAP_INVALID');
      code(() => Reflect.apply(leaseGetter, f.nonBitmap, []), 'BITMAP_INVALID');
      assert.equal(f.bitmap.textureLease, f.initialLease);
      assert.deepEqual(f.bitmap.sourceRect, { x: 0, y: 0, width: 1, height: 1 });
      assert.equal(f.initialLease.value, f.initial); assert.equal(f.candidateLease.value, f.candidate);
      assert.deepEqual(f.disposals, []);
      f.operations.commit(f.bitmap, expected, prepared);
      assert.equal(f.bitmap.textureLease, f.candidateLease, 'refusal did not consume the genuine prepared token');
    } finally { f.close(); }
  }
});

test('BRS36 supplemental claim rejects non-Bitmap and disposed genuine targets before taking lease ownership', async () => {
  for (const scenario of ['non-Bitmap', 'disposed Bitmap']) {
    const f = await fixture();
    try {
      const target = scenario === 'non-Bitmap' ? f.nonBitmap : f.bitmap;
      if (scenario === 'disposed Bitmap') f.bitmap.dispose();
      code(() => f.operations.claim(target, f.candidateLease, {}),
        scenario === 'non-Bitmap' ? 'BITMAP_INVALID' : 'OBJECT_DISPOSED');
      code(() => Reflect.apply(leaseGetter, f.nonBitmap, []), 'BITMAP_INVALID');
      assert.equal(f.initialLease.value, f.initial); assert.equal(f.candidateLease.value, f.candidate);
      assert.deepEqual(f.disposals, []);
      assert.equal(f.scope.use(f.candidateLease), f.candidateLease,
        'failed claim must leave the candidate unowned and adoptable by its genuine Scope');
    } finally { f.close(); }
  }
});

test('BRS36 supplemental cleared genuine Bitmap cannot commit through expected undefined or throw TypeError', async () => {
  const f = await fixture();
  try {
    const prepared = f.operations.prepare(f.bitmap, f.candidateLease);
    f.bitmap.textureLease = undefined;
    // Proposed stable empty-binding policy: same code as capture of an empty genuine Bitmap.
    code(() => f.operations.commit(f.bitmap, undefined, prepared), 'BITMAP_RESOURCE_TEXTURE_REQUIRED');
    assert.equal(f.operations.clearIfCurrent(f.bitmap, undefined), false,
      'a genuine empty slot has no current token to conditionally clear');
    assert.equal(f.bitmap.textureLease, undefined);
    assert.equal(f.bitmap.sourceRect, undefined);
    assert.equal(f.bitmap.naturalWidth, 0); assert.equal(f.bitmap.naturalHeight, 0);
    assert.equal(f.initialLease.value, f.initial); assert.equal(f.candidateLease.value, f.candidate);
    assert.deepEqual(f.disposals, []);
  } finally { f.close(); }
});
