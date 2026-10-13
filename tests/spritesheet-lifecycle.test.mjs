// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// The original palette and sample expectations are independent of SS1 and its clock.
const PIXELS = Object.freeze([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0,
]);
const NEXT_PIXELS = Object.freeze([
  255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255,
  255,255,255,255, 255,255,255,255, 255,255,255,255, 0,0,0,0, 0,0,0,0, 0,0,0,0,
]);
const RED = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const GREEN = Object.freeze({ x: 2, y: 0, width: 1, height: 2 });
const BLUE = Object.freeze({ x: 3, y: 0, width: 3, height: 1 });
const FRAME = Object.freeze({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });
const frames = () => [
  { name: 'red', x: 0, y: 0, width: 2, height: 2 },
  { name: 'green', x: 2, y: 0, width: 1, height: 2 },
  { name: 'blue', x: 3, y: 0, width: 3, height: 1 },
  { name: '__proto__', x: 3, y: 0, width: 3, height: 1 },
];

function refusal(action, code) {
  let observed;
  assert.throws(action, error => {
    observed = error; assert.ok(error instanceof egret.EgretError); assert.equal(error.code, code); return true;
  });
  return observed;
}

async function scene() {
  const submissions = [], diagnostics = [];
  const port = host({ renderFrame(frame) { submissions.push(frame); return undefined; } });
  const engine = await egret.createEngine({ host: port.adapter, clock: { maxDeltaSeconds: 0.5 },
    onDiagnostic(value) { diagnostics.push(value); } });
  try {
    const resources = engine.createScope(), scope = engine.createScope();
    const image = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(PIXELS) });
    const nextImage = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(NEXT_PIXELS) });
    let loads = 0, disposals = 0;
    const textures = [];
    const type = egret.createAssetType('ss1-lifecycle-atlas', egret.isTexture);
    engine.assets.register(type, {
      async load() { const source = loads === 0 ? image : nextImage; loads++;
        const texture = egret.createTexture(source); textures.push(texture); return texture; },
      dispose(value) { disposals++; value.dispose(); },
    });
    const ref = egret.createAssetRef(type, 'ss1-lifecycle-image');
    const lease = resources.use(await engine.assets.acquire(ref));
    return { engine, resources, scope, image, nextImage, ref, lease, textures, port, diagnostics, submissions,
      counts: () => ({ loads, disposals }) };
  } catch (cause) { await engine.dispose(); throw cause; }
}

async function close(f) {
  try { f.scope.dispose(); f.resources.dispose(); }
  finally { await f.engine.dispose(); }
  assert.deepEqual(f.port.trace, ['start', 'stop', 'close']); assert.equal(f.port.timers.size, 0);
  const counts = f.counts(); assert.ok(counts.loads >= 1); assert.equal(counts.disposals, counts.loads);
  assert.ok(f.textures.every(texture => texture.isDisposed)); assert.deepEqual(f.diagnostics, []);
}

const makeSheet = f => egret.createSpriteSheet(f.lease, frames());
function metadata(sheet, names, region) {
  assert.equal(sheet.names, names); assert.equal(sheet.getRegion('red'), region);
  assert.deepEqual(sheet.names, ['red', 'green', 'blue', '__proto__']);
  assert.deepEqual([sheet.frameCount, sheet.atlasWidth, sheet.atlasHeight], [4, 6, 2]);
  assert.deepEqual(sheet.getRegion('red'), RED); assert.deepEqual(sheet.getRegion('__proto__'), BLUE);
}

test('SS06 same Scope deduplicates and foreign owners retain precedence over closed Scopes', async () => {
  const f = await scene(), other = await scene();
  try {
    const sheet = makeSheet(f);
    assert.equal(f.scope.use(sheet), sheet); assert.equal(f.scope.use(sheet), sheet);
    const sameEngineOtherScope = f.engine.createScope();
    refusal(() => sameEngineOtherScope.use(sheet), 'OWNERSHIP_CONFLICT');
    other.scope.dispose();
    refusal(() => other.scope.use(sheet), 'OWNERSHIP_CONFLICT');
    assert.equal(sheet.isDisposed, false);
    const unowned = makeSheet(f);
    refusal(() => other.scope.use(unowned), 'ENGINE_MISMATCH');
    assert.equal(unowned.isDisposed, false);
    f.scope.use(unowned);
    sameEngineOtherScope.dispose(); f.scope.dispose();
    assert.equal(sheet.isDisposed, true); assert.equal(unowned.isDisposed, true);
    refusal(() => f.scope.use(sheet), 'SCOPE_CLOSED');
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(other); await close(f); }
});

test('SS06 an unowned late sheet is retired without stealing the caller lease', async () => {
  const f = await scene();
  try {
    const closedScope = f.engine.createScope(); closedScope.dispose();
    const sheet = makeSheet(f), names = sheet.names, region = sheet.getRegion('red');
    refusal(() => closedScope.use(sheet), 'SCOPE_CLOSED');
    assert.equal(sheet.isDisposed, true); metadata(sheet, names, region);
    assert.equal(f.lease.value.isDisposed, false); assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
    const openScope = f.engine.createScope(); assert.equal(openScope.use(sheet), sheet); openScope.dispose();
    metadata(sheet, names, region);
  } finally { await close(f); }
});

test('SS06 cancellation reentry may construct before sheet cleanup; late Scope use cleans the unowned Bitmap', async () => {
  const f = await scene();
  try {
    const sheet = f.scope.use(makeSheet(f));
    let late, observed, callbackRuns = 0;
    f.scope.signal.addEventListener('abort', () => {
      callbackRuns++; assert.equal(f.scope.state, 'closing'); assert.equal(sheet.isDisposed, false);
      late = sheet.createBitmap('green');
      assert.equal(late.textureLease, f.lease); assert.equal(late.isDisposed, false);
      observed = refusal(() => f.scope.use(late), 'SCOPE_CLOSED');
      assert.equal(late.isDisposed, true);
    }, { once: true });
    f.scope.dispose();
    assert.equal(callbackRuns, 1); assert.equal(observed.cleanupErrors.length, 0);
    assert.equal(sheet.isDisposed, true); assert.equal(late.isDisposed, true);
    assert.equal(f.lease.value.isDisposed, false); assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});

test('SS06 invalidate preserves the old lease and never retargets its sheet to a new image generation', async () => {
  const f = await scene();
  try {
    const oldSheet = f.scope.use(makeSheet(f));
    f.engine.assets.invalidate(f.ref);
    const newLease = f.resources.use(await f.engine.assets.acquire(f.ref));
    assert.notEqual(newLease, f.lease); assert.notEqual(newLease.resourceGeneration, f.lease.resourceGeneration);
    assert.notEqual(newLease.value, f.lease.value);
    const newSheet = f.scope.use(egret.createSpriteSheet(newLease, frames()));
    const oldBitmap = f.scope.use(oldSheet.createBitmap('red'));
    const newBitmap = f.scope.use(newSheet.createBitmap('red'));
    oldBitmap.x = 1; newBitmap.x = 4;
    f.engine.stage.addChild(oldBitmap); f.engine.stage.addChild(newBitmap);
    const captured = f.engine.captureFrame(FRAME);
    assert.equal(oldBitmap.textureLease, f.lease); assert.equal(newBitmap.textureLease, newLease);
    assert.equal(captured.images.length, 2);
    assert.equal(captured.images[0], f.image); assert.equal(captured.images[1], f.nextImage);
    assert.deepEqual([...egret.copyImageData2DPixels(captured.images[0])], PIXELS);
    assert.deepEqual([...egret.copyImageData2DPixels(captured.images[1])], NEXT_PIXELS);
    oldBitmap.dispose(); f.lease.release();
    refusal(() => oldSheet.createBitmap('red'), 'ASSET_LEASE_RELEASED');
    const extra = f.scope.use(newSheet.createBitmap('green'));
    assert.equal(extra.textureLease, newLease); assert.deepEqual(extra.sourceRect, GREEN);
    assert.deepEqual(f.counts(), { loads: 2, disposals: 1 });
  } finally { await close(f); }
});

test('SS06 independently acquired same-generation leases retain their separate entitlement', async () => {
  const f = await scene();
  try {
    const second = f.resources.use(await f.engine.assets.acquire(f.ref));
    assert.notEqual(second, f.lease); assert.notEqual(second.leaseId, f.lease.leaseId);
    assert.equal(second.resourceGeneration, f.lease.resourceGeneration); assert.equal(second.value, f.lease.value);
    const firstSheet = f.scope.use(makeSheet(f));
    const secondSheet = f.scope.use(egret.createSpriteSheet(second, frames()));
    f.lease.release();
    assert.equal(firstSheet.isDisposed, false);
    refusal(() => firstSheet.createBitmap('red'), 'ASSET_LEASE_RELEASED');
    const bitmap = f.scope.use(secondSheet.createBitmap('blue')); f.engine.stage.addChild(bitmap);
    assert.equal(bitmap.textureLease, second); assert.equal(f.engine.captureFrame(FRAME).images[0], f.image);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});

test('SS07 disposing the sheet preserves both caller Bitmaps; exact lease release revokes live capture', async () => {
  const f = await scene();
  try {
    const sheet = f.scope.use(makeSheet(f)), names = sheet.names, region = sheet.getRegion('red');
    const red = f.scope.use(sheet.createBitmap('red')), blue = f.scope.use(sheet.createBitmap('blue'));
    f.engine.stage.addChild(red); f.engine.stage.addChild(blue);
    sheet.dispose(); sheet.dispose();
    assert.equal(sheet.isDisposed, true); metadata(sheet, names, region);
    assert.equal(red.isDisposed, false); assert.equal(blue.isDisposed, false);
    assert.equal(red.textureLease, f.lease); assert.equal(blue.textureLease, f.lease);
    assert.equal(f.engine.captureFrame(FRAME).images[0], f.image);
    refusal(() => sheet.createBitmap(''), 'SPRITE_SHEET_DISPOSED');
    f.lease.release();
    refusal(() => f.engine.captureFrame(FRAME), 'ASSET_LEASE_RELEASED');
    assert.equal(red.isDisposed, false); assert.equal(blue.isDisposed, false);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 1 });
  } finally { await close(f); }
});

test('SS06 post-close owned metadata does not revive creation or rewrite explicit disposal state', async () => {
  const f = await scene();
  let unowned;
  try {
    const adopted = f.scope.use(makeSheet(f)); unowned = makeSheet(f);
    const names = unowned.names, region = unowned.getRegion('red');
    await f.engine.dispose();
    assert.equal(adopted.isDisposed, true); assert.equal(unowned.isDisposed, false);
    metadata(unowned, names, region);
    refusal(() => unowned.createBitmap(''), 'ENGINE_CLOSED');
    const unread = new Proxy(frames(), { get() { throw new Error('closed Engine must precede payload'); } });
    refusal(() => egret.createSpriteSheet(f.lease, unread), 'ENGINE_CLOSED');
    unowned.dispose(); unowned.dispose();
    assert.equal(unowned.isDisposed, true); metadata(unowned, names, region);
    refusal(() => unowned.createBitmap('red'), 'SPRITE_SHEET_DISPOSED');
  } finally { unowned?.dispose(); await close(f); }
});

test('SS08 saved owned icon capture survives all live resource and Engine retirement', async () => {
  const f = await scene();
  let saved;
  try {
    const sheet = f.scope.use(makeSheet(f));
    const actor = f.scope.use(sheet.createBitmap('red')), icon = f.scope.use(sheet.createBitmap('__proto__'));
    actor.x = 1; actor.y = 1; icon.x = 4; icon.y = 1;
    f.engine.stage.addChild(actor); f.engine.stage.addChild(icon);
    saved = f.engine.renderFrame(FRAME);
    assert.equal(f.submissions[0], saved);
    assert.ok(Object.isFrozen(saved) && Object.isFrozen(saved.commands) && Object.isFrozen(saved.images));
    actor.sourceRect = BLUE; actor.x = 6; icon.dispose(); sheet.dispose();
    await f.engine.dispose();
    assert.equal(actor.isDisposed, true); assert.equal(f.textures[0].isDisposed, true);
    assert.deepEqual(saved.commands.map(command => command.sourceRect), [RED, BLUE]);
    assert.deepEqual(saved.commands.map(command => [command.matrix.tx, command.matrix.ty]), [[1, 1], [4, 1]]);
    assert.equal(saved.images[0], f.image);
    assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])], PIXELS);
  } finally { await close(f); }
  // CPU ownership is the assertion here. Actual distinct-host pixel replay is the native lane.
  assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])], PIXELS);
});

test('SS09 named frames compose once and loop playback using six literal absolute clock samples', async () => {
  const f = await scene();
  try {
    const sheet = f.scope.use(makeSheet(f)), actor = f.scope.use(sheet.createBitmap('red'));
    const icon = f.scope.use(sheet.createBitmap('__proto__'));
    actor.x = 1; actor.y = 1; icon.x = 4; icon.y = 1;
    f.engine.stage.addChild(actor); f.engine.stage.addChild(icon);
    const clip = egret.createSequenceClip({ atlasWidth: sheet.atlasWidth, atlasHeight: sheet.atlasHeight,
      frames: [
        { ...sheet.getRegion('red'), durationSeconds: 0.125 },
        { ...sheet.getRegion('green'), durationSeconds: 0.25 },
        { ...sheet.getRegion('blue'), durationSeconds: 0.125 },
      ] });
    assert.equal(f.engine.advanceTime(0), undefined); assert.equal(f.engine.clock.tickId, 0);
    const captures = [];
    function capture(region) {
      const before = [f.engine.clock.elapsedSeconds, f.engine.clock.tickId];
      const value = f.engine.captureFrame(FRAME); captures.push(value);
      assert.deepEqual(value.commands.map(command => command.sourceRect), [region, BLUE]);
      assert.equal(value.images[0], f.image); assert.equal(actor.textureLease, f.lease); assert.equal(icon.textureLease, f.lease);
      assert.deepEqual([actor.naturalWidth, actor.naturalHeight], [region.width, region.height]);
      assert.deepEqual([f.engine.clock.elapsedSeconds, f.engine.clock.tickId], before);
      return value;
    }
    const original = capture(RED);
    const once = f.engine.createSequencePlayback(f.scope, actor, clip, { mode: 'once' }); once.start();
    f.engine.advanceTime(0.125); capture(GREEN);
    assert.equal(once.elapsedSeconds, 0.125); assert.deepEqual(once.lastSample, {
      frameIndex: 1, region: GREEN, positionSeconds: 0.125, atEnd: false, stopped: false,
    });
    sheet.dispose(); f.engine.advanceTime(0.375); capture(BLUE);
    assert.equal(once.elapsedSeconds, 0.375); assert.equal(once.state, 'running');
    f.engine.advanceTime(0.5); capture(BLUE);
    assert.equal(once.state, 'completed'); assert.equal(once.isDisposed, true);
    assert.deepEqual(once.lastSample, { frameIndex: 2, region: BLUE, positionSeconds: 0.5, atEnd: true, stopped: false });
    const loop = f.engine.createSequencePlayback(f.scope, actor, clip, { mode: 'loop' }); loop.start(); capture(RED);
    const ticksBeforePause = f.engine.clock.tickId;
    loop.pause(); f.engine.advanceTime(1); capture(RED);
    assert.equal(loop.state, 'paused'); assert.equal(loop.elapsedSeconds, 0);
    assert.equal(f.engine.clock.tickId, ticksBeforePause + 1);
    const beforeResume = [f.engine.clock.elapsedSeconds, f.engine.clock.tickId];
    loop.resume(); assert.deepEqual([f.engine.clock.elapsedSeconds, f.engine.clock.tickId], beforeResume);
    assert.deepEqual(loop.lastSample, { frameIndex: 0, region: RED, positionSeconds: 0, atEnd: false, stopped: false });
    f.engine.advanceTime(1.125); capture(GREEN);
    assert.equal(loop.elapsedSeconds, 0.125);
    f.engine.advanceTime(1.5); capture(RED);
    assert.equal(loop.elapsedSeconds, 0.5);
    assert.deepEqual(loop.lastSample, { frameIndex: 0, region: RED, positionSeconds: 0, atEnd: false, stopped: false });
    assert.equal(f.engine.clock.tickId, 6); assert.equal(f.engine.clock.elapsedSeconds, 1.5);
    assert.equal(captures.length, 8); assert.deepEqual(captures.map(value => value.frameId), [1,2,3,4,5,6,7,8]);
    f.scope.dispose(); assert.equal(loop.isDisposed, true); assert.equal(actor.isDisposed, true); assert.equal(icon.isDisposed, true);
    assert.deepEqual(original.commands.map(command => command.sourceRect), [RED, BLUE]);
    assert.deepEqual([...egret.copyImageData2DPixels(original.images[0])], PIXELS);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});
