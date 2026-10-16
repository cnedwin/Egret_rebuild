// SPDX-License-Identifier: Apache-2.0
// Genuine public SDK CPU composition only. Controlled Host/capture is not Native rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Sprite, createAssetRef, createAssetType, createEngine, createImageData2D,
  createSequenceClip, createSpriteSheet, createTexture, copyImageData2DPixels, isTexture,
} from '@egret/engine';
import { createAtlasImportPlan } from '@egret/project/atlas';
import { host as controlledHost } from './helpers.mjs';
import { createAtlasImportSession } from '../examples/atlas-import-playback/session.mjs';

const PROFILE = 'trim-rotation-v1';
const FRAME = Object.freeze({ width: 24, height: 16, clearColor: 0, clearAlpha: 0 });
const METADATA = "{\n  \"frames\": [\n    {\n      \"filename\": \"A\",\n      \"frame\": {\n        \"x\": 0,\n        \"y\": 0,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"rotated\": false,\n      \"trimmed\": true,\n      \"spriteSourceSize\": {\n        \"x\": 1,\n        \"y\": 1,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"sourceSize\": {\n        \"w\": 4,\n        \"h\": 5\n      },\n      \"duration\": 125\n    },\n    {\n      \"filename\": \"B\",\n      \"frame\": {\n        \"x\": 3,\n        \"y\": 0,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"rotated\": false,\n      \"trimmed\": true,\n      \"spriteSourceSize\": {\n        \"x\": 1,\n        \"y\": 2,\n        \"w\": 2,\n        \"h\": 3\n      },\n      \"sourceSize\": {\n        \"w\": 4,\n        \"h\": 5\n      },\n      \"duration\": 250\n    }\n  ],\n  \"meta\": {\n    \"app\": \"https://www.aseprite.org/\",\n    \"version\": \"1.3.18.6\",\n    \"image\": \"atlas.png\",\n    \"format\": \"RGBA8888\",\n    \"size\": {\n      \"w\": 6,\n      \"h\": 6\n    },\n    \"scale\": \"1\"\n  }\n}\n";
const SOURCE_PROVENANCE = {
  origin: 'Original first-party synthetic atlas metadata fixture',
  license: 'Apache-2.0',
  notice: 'Synthetic metadata for finite public SDK composition; not an exporter output.',
};
const PAGE_PROVENANCE = {
  origin: 'Original first-party P04-TR1 atlas fixture',
  license: 'Apache-2.0',
  notice: 'Original first-party fixture reused as unrotated stored crops; not an exporter output.',
  sha256: '35a3ecea0d79c5684d17a5dbfa56bf0cc5ebf52a34f6e8ceafe740c742a1437f',
};
// These expected values and original UTF-16 spans are independent fixture literals.
// No SDK/planner result or capture is used to construct this expected plan.
const EXPECTED_PLAN = {
  planVersion: 1,
  profile: 'aseprite-json-array-1.3.18.6-v1',
  exportVersion: '1.3.18.6',
  sourceDeclarations: { metadata: {
    id: 'atlas-import-v1-metadata',
    provenance: SOURCE_PROVENANCE,
    utf8Bytes: 934,
    hashVerification: 'declared_unverified',
  } },
  page: {
    pageName: 'atlas.png', assetId: 'egret.atlas-import.original-atlas', width: 6, height: 6,
    provenance: PAGE_PROVENANCE,
  },
  names: ['A', 'B'],
  spriteSheetFrames: [
    { name: 'A', x: 0, y: 0, width: 2, height: 3,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 } },
    { name: 'B', x: 3, y: 0, width: 2, height: 3,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 0 } },
  ],
  sequenceInput: { atlasWidth: 6, atlasHeight: 6, frames: [
    { x: 0, y: 0, width: 2, height: 3, durationSeconds: .125,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 } },
    { x: 3, y: 0, width: 2, height: 3, durationSeconds: .25,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 0 } },
  ] },
  origins: [
  {
    "index": 0,
    "pointer": "/frames/0",
    "name": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 40,
      "length": 3,
      "line": 4,
      "column": 19
    },
    "frame": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 60,
      "length": 72,
      "line": 5,
      "column": 16
    },
    "sourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 301,
      "length": 40,
      "line": 19,
      "column": 21
    },
    "spriteSourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 207,
      "length": 72,
      "line": 13,
      "column": 27
    },
    "duration": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 361,
      "length": 3,
      "line": 23,
      "column": 19
    }
  },
  {
    "index": 1,
    "pointer": "/frames/1",
    "name": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 396,
      "length": 3,
      "line": 26,
      "column": 19
    },
    "frame": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 416,
      "length": 72,
      "line": 27,
      "column": 16
    },
    "sourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 657,
      "length": 40,
      "line": 41,
      "column": 21
    },
    "spriteSourceSize": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 563,
      "length": 72,
      "line": 35,
      "column": 27
    },
    "duration": {
      "source": "metadata",
      "sourceId": "atlas-import-v1-metadata",
      "offset": 717,
      "length": 3,
      "line": 45,
      "column": 19
    }
  }
],
  acceptance: {
    exporterArtifact: 'unverified', assetPixels: 'not_run', runtimeComposition: 'not_run',
    rendering: 'not_run', licenseEntitlement: 'unverified',
  },
};

function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) frozenTree(child);
}
function actualPlan() {
  const input = {
    profile: 'aseprite-json-array-1.3.18.6-v1',
    source: { id: 'atlas-import-v1-metadata', text: METADATA, provenance: { ...SOURCE_PROVENANCE } },
    page: { pageName: 'atlas.png', assetId: 'egret.atlas-import.original-atlas',
      width: 6, height: 6, provenance: { ...PAGE_PROVENANCE } },
  };
  const result = createAtlasImportPlan(input);
  assert.deepEqual(result, { ok: true, value: EXPECTED_PLAN, diagnostics: [] });
  frozenTree(result);
  assert.notEqual(result.value.page, input.page);
  assert.notEqual(result.value.page.provenance, input.page.provenance);
  assert.notEqual(result.value.sourceDeclarations.metadata.provenance, input.source.provenance);
  assert.notEqual(result.value.spriteSheetFrames[0].layout, result.value.sequenceInput.frames[0].layout);
  return result.value;
}
function originalPixels() {
  // Complete original 6x6 stored palette: A=RG/BY/MC, unrotated B=YR/MG/CB.
  const pixels = new Uint8Array(144);
  const R = [255, 0, 0, 255], G = [0, 255, 0, 255], B = [0, 0, 255, 255];
  const Y = [255, 255, 0, 255], M = [255, 0, 255, 255], C = [0, 255, 255, 255];
  for (const [offset, rgba] of [
    [0, R], [4, G], [24, B], [28, Y], [48, M], [52, C],
    [12, Y], [16, R], [36, M], [40, G], [60, C], [64, B],
  ]) pixels.set(rgba, offset);
  return pixels;
}
function originalImage() {
  return createImageData2D({ width: 6, height: 6, pixels: originalPixels() });
}
async function onceFixture() {
  const adapter = controlledHost(), plan = actualPlan();
  const session = await createAtlasImportSession({
    host: adapter.adapter, profile: 'canvas-2d', image: originalImage(),
    sequenceInput: plan.sequenceInput, spriteSheetFrames: plan.spriteSheetFrames,
  });
  return { session, adapter, engine: session.engine, actor: session.actor, plan };
}
function assertPublicSample(engine, actor, frame, elapsed, state, position, atEnd) {
  const crop = frame === 0 ? { x: 0, y: 0, width: 2, height: 3 } : { x: 3, y: 0, width: 2, height: 3 };
  const layout = frame === 0
    ? { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 }
    : { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 0 };
  assert.equal(actor.playback.state, state);
  assert.equal(actor.playback.elapsedSeconds, elapsed);
  assert.equal(actor.playback.isDisposed, state === 'completed');
  assert.deepEqual(actor.playback.lastSample, {
    frameIndex: frame, region: { ...crop, layout }, positionSeconds: position, atEnd, stopped: false,
  });
  frozenTree(actor.playback.lastSample);
  assert.deepEqual(actor.bitmap.sourceRect, crop);
  assert.deepEqual([actor.bitmap.naturalWidth, actor.bitmap.naturalHeight], [4, 5]);
  assert.deepEqual(actor.bitmap.getBounds(), { x: 0, y: 0, width: 4, height: 5 });
  assert.deepEqual(actor.parent.localToGlobal(0, 0), { x: 2, y: 2 });
  assert.deepEqual(actor.bitmap.localToGlobal(0, 0), { x: 2, y: 2 });
  assert.deepEqual(actor.bitmap.localToGlobal(1, 0), { x: 3, y: 2 });
  assert.deepEqual(actor.bitmap.localToGlobal(0, 1), { x: 2, y: 3 });
  assert.equal(actor.parent.rotation, 0);
  assert.equal(actor.parent.scaleX, 1);
  assert.equal(actor.parent.scaleY, 1);
  assert.equal(actor.parent.anchorOffsetX, 0);
  assert.equal(actor.parent.anchorOffsetY, 0);
  assert.equal(actor.parent.clipRect, undefined);
  assert.equal(actor.bitmap.isDisposed, false);
  assert.equal(actor.sheet.isDisposed, false);
  assert.equal(actor.lease.value.isDisposed, false);
  assert.equal(engine.stage.isDisposed, false);
}
function assertCapture(captured, frame) {
  assert.equal(captured.width, 24);
  assert.equal(captured.height, 16);
  assert.equal(captured.commands.length, 1);
  assert.equal(captured.images.length, 1);
  const command = captured.commands[0], image = captured.images[0];
  assert.equal(command.kind, 'image');
  assert.equal(command.alpha, 1);
  assert.equal(command.imageIndex, 0);
  assert.deepEqual(command.rect, { x: 0, y: 0, width: 2, height: 3 });
  assert.deepEqual(command.sourceRect, frame === 0
    ? { x: 0, y: 0, width: 2, height: 3 } : { x: 3, y: 0, width: 2, height: 3 });
  assert.deepEqual(command.matrix, frame === 0
    ? { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 3 }
    : { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 4 });
  assert.deepEqual(command.clips, []);
  assert.deepEqual([image.width, image.height, image.byteLength], [6, 6, 144]);
  assert.deepEqual(copyImageData2DPixels(image), originalPixels());
  frozenTree(captured.commands);
}
function assertOriginalOwnersRetired(owner, resources) {
  assert.equal(owner.actor.playback.isDisposed, true);
  assert.equal(owner.actor.bitmap.isDisposed, true);
  assert.equal(owner.actor.parent.isDisposed, true);
  assert.equal(owner.actor.sheet.isDisposed, true);
  assert.throws(() => owner.actor.lease.value, error => error?.code === 'ASSET_LEASE_RELEASED');
  assert.equal(owner.engine.stage.isDisposed, true);
  assert.equal(owner.engine.clock.state, 'closed');
  assert.equal(resources.leases.length, 1);
  assert.equal(resources.leases[0], owner.actor.lease);
  assert.equal(resources.textures.length, 1);
  assert.equal(resources.textures[0].isDisposed, true);
  assert.equal(resources.providerDisposalAttempts.length, 1);
  assert.equal(resources.providerDisposals.length, 1);
  assert.equal(resources.providerDisposalAttempts[0], resources.textures[0]);
  assert.equal(resources.providerDisposals[0], resources.textures[0]);
  assert.deepEqual(owner.adapter.trace, ['start', 'stop', 'close']);
  assert.equal(owner.adapter.timers.size, 0);
}
async function healthyOnceBaseline() {
  const owner = await onceFixture(), { session, engine, actor } = owner;
  try {
    assert.equal(actor.mode, 'once');
    assert.equal(actor.playback.state, 'idle');
    assert.equal(actor.playback.lastSample, undefined);
    assert.deepEqual([actor.sheet.atlasWidth, actor.sheet.atlasHeight, actor.sheet.frameCount], [6, 6, 2]);
    assert.deepEqual(actor.sheet.names, ['A', 'B']);
    assert.equal(Object.isFrozen(session.clip), true);
    assert.deepEqual([session.clip.atlasWidth, session.clip.atlasHeight, session.clip.frameCount, session.clip.durationSeconds],
      [6, 6, 2, .375]);
    assert.deepEqual(actor.sheet.getRegion('A'), { x: 0, y: 0, width: 2, height: 3,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 } });
    assert.deepEqual(actor.sheet.getRegion('B'), { x: 3, y: 0, width: 2, height: 3,
      layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 0 } });
    frozenTree(actor.sheet.getRegion('A'));
    frozenTree(actor.sheet.getRegion('B'));
    assert.deepEqual(actor.lease.value.sourceRect, { x: 0, y: 0, width: 6, height: 6 });
    assert.deepEqual([actor.lease.value.width, actor.lease.value.height], [6, 6]);
    assert.equal(session.resources().textures[0], actor.lease.value);
    assert.equal(session.advanceTo(0), undefined);
    actor.playback.start();
    assertPublicSample(engine, actor, 0, 0, 'running', 0, false);
    assertCapture(session.capture(), 0);
    assert.deepEqual(session.advanceTo(.125), { tickId: 1, elapsedSeconds: .125, deltaSeconds: .125 });
    assertPublicSample(engine, actor, 1, .125, 'running', .125, false);
    assertCapture(session.capture(), 1);
    assert.deepEqual(session.advanceTo(.375), { tickId: 2, elapsedSeconds: .375, deltaSeconds: .25 });
    assertPublicSample(engine, actor, 1, .375, 'completed', .375, true);
    assertCapture(session.capture(), 1);
    // Completion retired only the controller, not its display/image/lease owners.
    assert.deepEqual(session.resources().providerDisposals, []);
    assert.deepEqual(session.inspect().diagnostics, []);
    const retired = await session.retire();
    assert.equal(retired.state, 'closed');
    assert.deepEqual(retired.scopes, ['closed', 'closed']);
    for (const key of ['controllers', 'bitmaps', 'parents', 'sheets', 'leases', 'textures']) {
      assert.deepEqual(retired[key], [true]);
    }
    assert.deepEqual(retired.provider, {
      loads: 1, disposalAttempts: 1, disposals: 1, exactOriginals: [true],
    });
    assert.equal(retired.cleanupErrors, 0);
    assert.deepEqual(retired.cleanupFailures, []);
    assert.deepEqual(retired.diagnostics, []);
    assertOriginalOwnersRetired(owner, session.resources());
    const closed = session.close();
    assert.equal(session.close(), closed);
    assert.equal(await closed, retired);
    assert.equal(await session.retire(), retired);
    return retired;
  } finally {
    await session.close();
  }
}

async function closeLoopOwners(owner) {
  const failures = [];
  for (const [name, operation] of [
    ['animation Scope', () => owner.animationScope.dispose()],
    ['display and lease Scope', () => owner.scope.dispose()],
    ['Engine and original Host', () => owner.engine.dispose()],
  ]) {
    try { await operation(); } catch (cause) { failures.push({ name, cause }); }
  }
  if (failures.length || owner.diagnostics.length) {
    const causes = [...failures.map(row => row.cause), ...owner.diagnostics.map(row => row.cause)];
    const error = new AggregateError(causes, 'Genuine loop owner cleanup failed', { cause: causes[0] });
    error.cleanupFailures = Object.freeze([...failures]);
    error.diagnostics = Object.freeze([...owner.diagnostics]);
    throw error;
  }
}
// This constructor uses the genuine public SDK independently of the once-only example.
async function loopFixture(plan) {
  const adapter = controlledHost(), diagnostics = [], textures = [], attempts = [], disposed = [];
  const engine = await createEngine({ host: adapter.adapter, onDiagnostic: row => diagnostics.push(row) });
  const scope = engine.createScope(), animationScope = engine.createScope();
  const type = createAssetType('egret.test.atlas-import.loop', isTexture);
  const ref = createAssetRef(type, 'egret.atlas-import.original-atlas');
  try {
    engine.assets.register(type, {
      load() { const value = createTexture(originalImage()); textures.push(value); return Promise.resolve(value); },
      dispose(value) { attempts.push(value); value.dispose(); disposed.push(value); },
    });
    const lease = scope.use(await engine.assets.acquire(ref, { signal: scope.signal }));
    const sheet = scope.use(createSpriteSheet(lease, plan.spriteSheetFrames, PROFILE));
    const clip = createSequenceClip(plan.sequenceInput, PROFILE);
    const parent = scope.use(new Sprite()), bitmap = scope.use(sheet.createBitmap(sheet.names[0]));
    parent.x = 2; parent.y = 2; parent.addChild(bitmap); engine.stage.addChild(parent);
    engine.advanceTime(0);
    const playback = engine.createSequencePlayback(animationScope, bitmap, clip, { mode: 'loop' });
    const actor = { parent, bitmap, sheet, lease, playback };
    return { adapter, engine, actor, clip, scope, animationScope, diagnostics,
      resources: () => ({ leases: [lease], textures: [...textures],
        providerDisposalAttempts: [...attempts], providerDisposals: [...disposed] }) };
  } catch (cause) {
    try { await closeLoopOwners({ engine, scope, animationScope, diagnostics }); }
    catch (cleanup) {
      throw new AggregateError([cause, cleanup], 'Loop fixture setup and cleanup failed', { cause });
    }
    throw cause;
  }
}

test('public planner returns the complete independent literal owned plan before composition', () => {
  actualPlan();
});
test('public once session preserves crop/layout/capture at 0/.125/.375 and releases original owners', async () => {
  await healthyOnceBaseline();
});
test('independent genuine public loop wraps at .375 while borrowing the same full atlas', async () => {
  const owner = await loopFixture(actualPlan());
  try {
    assert.equal(Object.isFrozen(owner.clip), true);
    owner.actor.playback.start();
    assertPublicSample(owner.engine, owner.actor, 0, 0, 'running', 0, false);
    assertCapture(owner.engine.captureFrame(FRAME), 0);
    owner.engine.advanceTime(.125);
    assertPublicSample(owner.engine, owner.actor, 1, .125, 'running', .125, false);
    assertCapture(owner.engine.captureFrame(FRAME), 1);
    owner.engine.advanceTime(.375);
    assertPublicSample(owner.engine, owner.actor, 0, .375, 'running', 0, false);
    assertCapture(owner.engine.captureFrame(FRAME), 0);
    assert.deepEqual(owner.resources().providerDisposals, []);
  } finally {
    await closeLoopOwners(owner);
    assert.equal(owner.animationScope.state, 'closed');
    assert.equal(owner.scope.state, 'closed');
    assert.deepEqual(owner.diagnostics, []);
    assertOriginalOwnersRetired(owner, owner.resources());
  }
});
for (const kind of ['marker', 'undefined']) {
  test('genuine Scope.use cleanup diagnostic preserves ' + kind + ' cause and cached rejection', async () => {
    await healthyOnceBaseline();
    const owner = await onceFixture(), { session } = owner;
    const cause = kind === 'marker' ? Object.assign(new Error('Original caller-owned cleanup failure'),
      { code: 'ATLAS_IMPORT_TEST_CLEANUP' }) : undefined;
    const scope = session.engine.createScope();
    let disposed = 0, retained;
    try {
      scope.use({ dispose() { disposed++; throw cause; } });
      assert.doesNotThrow(() => scope.dispose());
      scope.dispose();
      assert.equal(disposed, 1);
      assert.equal(scope.state, 'closed');
      assert.equal(session.inspect().diagnostics.length, 1);
      assert.equal(session.inspect().diagnostics[0].code, 'SCOPE_CLEANUP_FAILED');
      const closed = session.close();
      assert.equal(session.close(), closed);
      await assert.rejects(closed, error => {
        retained = error;
        assert.ok(error instanceof AggregateError);
        assert.equal(Object.hasOwn(error, 'cause'), true);
        assert.equal(error.cause, cause);
        assert.equal(error.errors.length, 1);
        assert.equal(error.errors[0], cause);
        assert.equal(error.diagnostics.length, 1);
        const diagnostic = error.diagnostics[0];
        assert.equal(diagnostic.code, 'SCOPE_CLEANUP_FAILED');
        assert.equal(diagnostic.phase, 'scope');
        assert.equal(diagnostic.severity, 'error');
        assert.equal(Object.hasOwn(diagnostic, 'cause'), true);
        assert.equal(diagnostic.cause, cause);
        assert.equal(error.retirement.state, 'closed');
        assert.deepEqual(error.retirement.scopes, ['closed', 'closed']);
        assert.equal(error.retirement.cleanupErrors, 0);
        assert.deepEqual(error.retirement.cleanupFailures, []);
        assert.equal(error.retirement.diagnostics[0].cause.wasUndefined, kind === 'undefined');
        if (kind === 'marker') assert.equal(error.retirement.diagnostics[0].cause.code, 'ATLAS_IMPORT_TEST_CLEANUP');
        return true;
      });
      await assert.rejects(session.close(), error => error === retained);
      await assert.rejects(session.retire(), error => error === retained);
      assertOriginalOwnersRetired(owner, session.resources());
    } finally {
      await session.close().catch(error => {
        if (retained === undefined) throw error;
        assert.equal(error, retained);
      });
      // Each assigned cleanup failure has its own complete fresh healthy follow-up.
      await healthyOnceBaseline();
    }
  });
}
