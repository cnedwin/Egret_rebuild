// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// A fresh child owns one module cache. Deregistration never pretends to unload it.
const stages = new Set(['baseline', 'mutant', 'restored']);
const cases = new Set(['before-entry', 'after-entry', 'ctor-undefined', 'crop-undefined',
  'crop-dispose', 'reentry', 'sheet-terminal', 'throw-terminal', 'engine-terminal', 'closing-cleanup']);
const [stage, caseId, ...extra] = process.argv.slice(2);
assert.ok(stages.has(stage) && cases.has(caseId) && extra.length === 0, 'SS1_UNIT_ARGUMENTS_INVALID');
const bitmapUrl = new URL('../packages/runtime/dist/Bitmap.js', import.meta.url);
const sheetUrl = new URL('../packages/runtime/dist/spriteSheet.js', import.meta.url);
const historicalPins = [
  [bitmapUrl, 20300, '473606fd7d65c1c41c1d6bb4625cf5f3f5b2c0fc90adf5e94b80dac4f75a8892'],
  [sheetUrl, 11792, 'e7cd446abde11eb22e77881768a685067ea2d83ff2a0d10d62de784fefbcd7fd'],
];
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
const m13Pins = [[bitmapUrl,21049,'b7d91499cb36d73c6b0b0767ec90080b2acaec52a2d0ccf0a785d793b48b6544'],[sheetUrl,11824,'5f15aca4af6961cfd65f0e4c5243f7f81ccac9267056815d2401226b4d8dd00d']];
const pins = historicalPins.every(([url,bytes,sha])=>{const raw=readFileSync(url);return raw.length===bytes&&digest(raw)===sha;})?historicalPins:m13Pins;
function assertDisk() {
  for (const [url, bytes, sha] of pins) {
    const actual = readFileSync(url);
    assert.equal(actual.length, bytes, 'SS1_UNIT_EMISSION_BYTES');
    assert.equal(digest(actual), sha, 'SS1_UNIT_EMISSION_SHA');
  }
}
assertDisk();

const originalPort = `        spriteSheetBitmapOperations = Object.freeze({
            construct: (lease) => new OriginalBitmap(lease),
            setCrop: (bitmap, region) => { apply(setCrop, bitmap, [region]); },
            dispose: (bitmap) => { apply(dispose, bitmap, []); },
        });`;
const auditKey = Symbol.for('egret.test.ss1.originalBitmapUnit');
const audit = {
  armed: false, constructAttempts: 0, cropAttempts: 0, disposeAttempts: 0,
  constructed: [], retired: [], onOperation() {},
};
// One unique in-memory block wraps only original operations and genuine values.
const observedPort = `        const audit = globalThis[Symbol.for('egret.test.ss1.originalBitmapUnit')];
        if (audit === undefined) throw new Error('SS1_UNIT_AUDIT_MISSING');
        spriteSheetBitmapOperations = Object.freeze({
            construct: (lease) => {
                audit.constructAttempts += 1;
                audit.onOperation('construct', lease);
                const bitmap = new OriginalBitmap(lease);
                audit.constructed.push(bitmap);
                return bitmap;
            },
            setCrop: (bitmap, region) => {
                audit.cropAttempts += 1;
                audit.onOperation('crop', bitmap);
                apply(setCrop, bitmap, [region]);
                audit.onOperation('cropped', bitmap);
            },
            dispose: (bitmap) => {
                audit.disposeAttempts += 1;
                apply(dispose, bitmap, []);
                audit.retired.push(bitmap);
                audit.onOperation('disposed', bitmap);
            },
        });`;
let hook;
let transformedLoads = 0;
let originalBitmap;
let descriptors;
let patchedSetterCalls = 0;
let patchedDisposerCalls = 0;
const fixture = {
  engine: undefined, scope: undefined, lease: undefined, texture: undefined,
  oldBitmap: undefined, sheets: [], returned: [], timers: new Set(),
  loads: 0, disposals: 0, starts: 0, stops: 0, closes: 0, diagnostics: [],
  closeOutcome: undefined,
};
const cleanupCause = Object.freeze({ ss1Unit: 'distinct-original-disposer-fault' });
const report = { stage, caseId, status: 'PENDING', assigned: undefined, retry: false };

function patchPrototype(Bitmap) {
  assert.equal(descriptors, undefined, 'one prototype patch per child');
  descriptors = {
    crop: Object.getOwnPropertyDescriptor(Bitmap.prototype, 'sourceRect'),
    dispose: Object.getOwnPropertyDescriptor(Bitmap.prototype, 'dispose'),
  };
  assert.equal(typeof descriptors.crop?.set, 'function');
  assert.equal(typeof descriptors.dispose?.value, 'function');
  Object.defineProperty(Bitmap.prototype, 'sourceRect', {
    ...descriptors.crop, set() { patchedSetterCalls += 1; throw new Error('PATCHED_BITMAP_CROP'); },
  });
  Object.defineProperty(Bitmap.prototype, 'dispose', {
    ...descriptors.dispose, value() { patchedDisposerCalls += 1; throw new Error('PATCHED_BITMAP_DISPOSE'); },
  });
}
function restorePrototype() {
  if (descriptors === undefined) return;
  Object.defineProperty(originalBitmap.prototype, 'sourceRect', descriptors.crop);
  Object.defineProperty(originalBitmap.prototype, 'dispose', descriptors.dispose);
  descriptors = undefined;
}
function resetAudit() {
  audit.constructAttempts = 0; audit.cropAttempts = 0; audit.disposeAttempts = 0;
  audit.constructed.length = 0; audit.retired.length = 0;
}
function counters() {
  return { construct: audit.constructAttempts, crop: audit.cropAttempts,
    dispose: audit.disposeAttempts, returned: audit.constructed.length,
    retired: audit.retired.length };
}
function occurrence(operation) {
  let happened = false, error;
  try { operation(); } catch (cause) { happened = true; error = cause; }
  assert.equal(happened, true, 'SS1_UNIT_EXPECTED_OCCURRENCE');
  return error;
}
function refusal(error, code, cause, cleanupErrors = []) {
  assert.equal(error?.code, code);
  assert.equal(error.message, code);
  assert.equal(Object.hasOwn(error, 'cause'), true);
  assert.equal(error.cause, cause);
  assert.deepEqual(error.cleanupErrors, cleanupErrors);
  assert.equal(Object.isFrozen(error.cleanupErrors), true);
}
function bitmapMatches(bitmap, width, height, region) {
  assert.ok(bitmap instanceof originalBitmap, 'genuine original constructor identity');
  assert.equal(bitmap.textureLease, fixture.lease);
  assert.equal(bitmap.naturalWidth, width);
  assert.equal(bitmap.naturalHeight, height);
  assert.deepEqual(bitmap.sourceRect, region);
  assert.equal(bitmap.isDisposed, false);
}
async function setup(egret) {
  assert.equal(typeof egret.createSpriteSheet, 'function', 'admitted genuine factory baseline');
  fixture.engine = await egret.createEngine({ host: {
    surface: {},
    start() { fixture.starts += 1; },
    stop() { fixture.stops += 1; },
    async close() { fixture.closes += 1; },
    setTimeout(callback, delay) {
      const timer = { callback, delay }; fixture.timers.add(timer);
      return () => fixture.timers.delete(timer);
    },
  }, onDiagnostic(value) {
    fixture.diagnostics.push(value);
    // A failing diagnostic observer must not replace the chosen primary cause.
    if (caseId === 'crop-dispose' && value.cause === cleanupCause) throw new Error('SS1_UNIT_OBSERVER_THROW');
  } });
  fixture.scope = fixture.engine.createScope();
  const image = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array([
    255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
    255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  ]) });
  fixture.texture = egret.createTexture(image);
  const type = egret.createAssetType('SS1 controlled original atlas', egret.isTexture);
  fixture.engine.assets.register(type, {
    async load() { fixture.loads += 1; return fixture.texture; },
    dispose(value) { assert.equal(value, fixture.texture); fixture.disposals += 1; value.dispose(); },
  });
  fixture.lease = fixture.scope.use(await fixture.engine.assets.acquire(egret.createAssetRef(type, 'original')));
  fixture.oldBitmap = fixture.scope.use(new egret.Bitmap(fixture.lease));
  assert.equal(fixture.oldBitmap.naturalWidth, 6);
  assert.equal(fixture.oldBitmap.naturalHeight, 2);
  assert.equal(fixture.lease.value, fixture.texture);
  const frames = [
    { name: 'red', x: 0, y: 0, width: 2, height: 2 },
    { name: 'green', x: 2, y: 0, width: 1, height: 2 },
    { name: 'blue', x: 3, y: 0, width: 3, height: 1 },
  ];
  fixture.sheet = egret.createSpriteSheet(fixture.lease, frames);
  fixture.other = egret.createSpriteSheet(fixture.lease, frames);
  fixture.sheets.push(fixture.sheet, fixture.other);
  const baseline = fixture.scope.use(fixture.sheet.createBitmap('red'));
  fixture.returned.push(baseline);
  bitmapMatches(baseline, 2, 2, { x: 0, y: 0, width: 2, height: 2 });
  assert.deepEqual(fixture.sheet.names, ['red', 'green', 'blue']);
  assert.equal(Object.isFrozen(fixture.sheet.names), true);
  assert.equal(fixture.sheet.getRegion('red'), fixture.sheet.getRegion('red'));
  assert.equal(fixture.loads, 1);
  assert.equal(fixture.disposals, 0);
  if (stage === 'mutant') resetAudit();
}
function retry() {
  audit.armed = false;
  const value = fixture.scope.use(fixture.sheet.createBitmap('blue'));
  fixture.returned.push(value);
  bitmapMatches(value, 3, 1, { x: 3, y: 0, width: 3, height: 1 });
  report.retry = true;
}
function armControl() {
  let triggered = false, cleanupThrown = false;
  audit.onOperation = (phase) => {
    if (!audit.armed) return;
    if (!triggered && phase === 'construct' && caseId === 'ctor-undefined') {
      triggered = true; throw undefined;
    }
    if (!triggered && phase === 'crop' && ['crop-undefined', 'crop-dispose', 'throw-terminal'].includes(caseId)) {
      triggered = true;
      if (caseId === 'throw-terminal') fixture.sheet.dispose();
      throw undefined;
    }
    if (!triggered && phase === 'crop' && caseId === 'reentry') {
      triggered = true;
      refusal(occurrence(() => fixture.sheet.createBitmap(undefined)), 'SPRITE_SHEET_REENTRANT', undefined);
      assert.deepEqual(fixture.sheet.getRegion('red'), { x: 0, y: 0, width: 2, height: 2 });
      const other = fixture.scope.use(fixture.other.createBitmap('blue'));
      fixture.returned.push(other);
      bitmapMatches(other, 3, 1, { x: 3, y: 0, width: 3, height: 1 });
    }
    if (!triggered && phase === 'cropped' && caseId === 'sheet-terminal') {
      triggered = true; fixture.sheet.dispose();
    }
    if (!triggered && phase === 'cropped' && ['engine-terminal', 'closing-cleanup'].includes(caseId)) {
      triggered = true;
      // The sheet is deliberately unowned, so Engine closure is the exact primary.
      fixture.closeOutcome = fixture.engine.dispose().then(() => ({ ok: true }), error => ({ error }));
    }
    if (phase === 'disposed' && triggered && !cleanupThrown && ['crop-dispose', 'closing-cleanup'].includes(caseId)) {
      cleanupThrown = true; throw cleanupCause;
    }
  };
  audit.armed = true;
  return () => ({ triggered, cleanupThrown });
}
function assignedCase() {
  const controlState = armControl();
  if (caseId === 'before-entry' || caseId === 'after-entry' || caseId === 'reentry') {
    const value = fixture.scope.use(fixture.sheet.createBitmap('green'));
    fixture.returned.push(value);
    bitmapMatches(value, 1, 2, { x: 2, y: 0, width: 1, height: 2 });
    if (caseId !== 'reentry') {
      assert.equal(patchedSetterCalls, 0); assert.equal(patchedDisposerCalls, 0);
      fixture.sheet.dispose(); assert.equal(value.isDisposed, false);
      assert.deepEqual(counters(), { construct: 1, crop: 1, dispose: 0, returned: 1, retired: 0 });
    } else {
      assert.equal(controlState().triggered, true);
      assert.deepEqual(counters(), { construct: 2, crop: 2, dispose: 0, returned: 2, retired: 0 });
    }
    report.assigned = { success: true, counters: counters(), patchedSetterCalls, patchedDisposerCalls };
    if (caseId === 'reentry') retry();
    return;
  }
  const error = occurrence(() => fixture.sheet.createBitmap('green'));
  const code = caseId === 'sheet-terminal' ? 'SPRITE_SHEET_DISPOSED'
    : ['engine-terminal', 'closing-cleanup'].includes(caseId) ? 'ENGINE_CLOSED' : 'SPRITE_SHEET_BITMAP_FAILED';
  const cleanup = ['crop-dispose', 'closing-cleanup'].includes(caseId) ? [cleanupCause] : [];
  refusal(error, code, undefined, cleanup);
  assert.equal(controlState().triggered, true);
  assert.equal(controlState().cleanupThrown, cleanup.length === 1);
  const constructed = caseId === 'ctor-undefined' ? 0 : 1;
  assert.deepEqual(counters(), { construct: 1, crop: constructed, dispose: constructed,
    returned: constructed, retired: constructed });
  for (const value of audit.constructed) assert.equal(value.isDisposed, true, 'partial genuine Bitmap retired');
  report.assigned = { code, causeWasUndefined: error.cause === undefined,
    cleanupErrors: cleanup.length, counters: counters() };
  if (['ctor-undefined', 'crop-undefined', 'crop-dispose'].includes(caseId)) {
    assert.equal(fixture.lease.value, fixture.texture, 'failed private Bitmap did not release caller lease');
    assert.equal(fixture.sheet.isDisposed, false); retry();
  }
  if (['sheet-terminal', 'throw-terminal'].includes(caseId)) {
    assert.equal(fixture.sheet.isDisposed, true);
    assert.deepEqual(fixture.sheet.names, ['red', 'green', 'blue']);
    refusal(occurrence(() => fixture.sheet.createBitmap('red')), 'SPRITE_SHEET_DISPOSED', undefined);
    assert.equal(fixture.lease.value, fixture.texture);
  }
  if (['engine-terminal', 'closing-cleanup'].includes(caseId)) {
    assert.equal(fixture.sheet.isDisposed, false);
    assert.deepEqual(fixture.sheet.names, ['red', 'green', 'blue']);
    refusal(occurrence(() => fixture.sheet.createBitmap('red')), 'ENGINE_CLOSED', undefined);
  }
}
async function cleanup() {
  const errors = [];
  const attempt = operation => { try { operation(); } catch (error) { errors.push(error); } };
  audit.armed = false; audit.onOperation = () => {};
  // Restore prototype descriptors before any ordinary caller/Scope/Engine cleanup.
  attempt(restorePrototype);
  for (const sheet of fixture.sheets) attempt(() => sheet.dispose());
  const values = new Set([...fixture.returned, ...audit.constructed]);
  if (fixture.oldBitmap !== undefined) values.add(fixture.oldBitmap);
  for (const value of values) attempt(() => value.dispose());
  if (fixture.scope !== undefined) attempt(() => fixture.scope.dispose());
  if (fixture.lease !== undefined) attempt(() => fixture.lease.release());
  if (fixture.engine !== undefined) {
    const closed = await (fixture.closeOutcome ?? fixture.engine.dispose().then(() => ({ ok: true }), error => ({ error })));
    if (stage === 'mutant' && caseId === 'closing-cleanup') {
      attempt(() => refusal(closed.error, 'ENGINE_CLOSE_FAILED', cleanupCause));
    } else if ('error' in closed) errors.push(closed.error);
  }
  attempt(() => {
    if (fixture.engine === undefined) return;
    assert.equal(fixture.starts, 1); assert.equal(fixture.stops, 1); assert.equal(fixture.closes, 1);
    assert.equal(fixture.timers.size, 0); assert.equal(fixture.loads, 1); assert.equal(fixture.disposals, 1);
    for (const value of values) assert.equal(value.isDisposed, true);
    for (const sheet of fixture.sheets) assert.equal(sheet.isDisposed, true);
    const expected = stage === 'mutant' && ['crop-dispose', 'closing-cleanup'].includes(caseId) ? 1 : 0;
    assert.equal(fixture.diagnostics.length, expected, 'no extra lifecycle/observer errors');
    if (expected === 1) {
      assert.equal(fixture.diagnostics[0].code, 'SPRITE_SHEET_BITMAP_FAILED');
      assert.equal(fixture.diagnostics[0].cause, cleanupCause);
    }
  });
  if (errors.length !== 0) throw new AggregateError(errors, 'SS1_UNIT_CLEANUP_FAILED');
  report.cleanup = { hostStarts: fixture.starts, hostStops: fixture.stops, hostCloses: fixture.closes,
    providerLoads: fixture.loads, providerDisposals: fixture.disposals, timers: fixture.timers.size,
    allCreatedBitmapsDisposed: true, allCreatedSheetsDisposed: true, diagnostics: fixture.diagnostics.length };
}

let failed = false, primary;
try {
  if (stage === 'mutant') {
    assert.equal(Object.hasOwn(globalThis, auditKey), false, 'private audit slot must be fresh');
    globalThis[auditKey] = audit;
    hook = registerHooks({ load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (url !== bitmapUrl.href) return loaded;
      const source = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8');
      assert.equal(digest(Buffer.from(source)), pins[0][2], 'actual loaded Bitmap bytes must equal pinned disk');
      assert.equal(source.split(originalPort).length - 1, 1, 'unique original port anchor');
      transformedLoads += 1;
      return { ...loaded, source: source.replace(originalPort, observedPort) };
    } });
  }
  if (stage === 'mutant' && caseId === 'before-entry') {
    // This is the sole direct private import, before the public facade loads.
    const original = await import(bitmapUrl.href);
    originalBitmap = original.Bitmap; patchPrototype(originalBitmap);
  }
  const egret = await import('@egret/engine');
  if (originalBitmap === undefined) originalBitmap = egret.Bitmap;
  assert.equal(originalBitmap, egret.Bitmap);
  if (hook !== undefined) { hook.deregister(); hook = undefined; }
  assert.equal(transformedLoads, stage === 'mutant' ? 1 : 0);
  await setup(egret);
  if (stage === 'mutant') {
    if (caseId === 'after-entry') patchPrototype(originalBitmap);
    assignedCase();
  } else {
    const value = fixture.scope.use(fixture.sheet.createBitmap('green'));
    fixture.returned.push(value);
    bitmapMatches(value, 1, 2, { x: 2, y: 0, width: 1, height: 2 });
    fixture.sheet.dispose(); assert.equal(value.isDisposed, false);
    report.assigned = { genuineNoHookBaseline: true };
  }
} catch (error) { failed = true; primary = error; }
finally {
  if (hook !== undefined) { try { hook.deregister(); } catch (error) { failed = true; primary = new AggregateError([primary, error], 'SS1_UNIT_HOOK_RESTORE_FAILED'); } }
  try { await cleanup(); }
  catch (error) { failed = true; primary = new AggregateError([primary, error], 'SS1_UNIT_OR_CLEANUP_FAILED'); }
  delete globalThis[auditKey];
  try { assertDisk(); } catch (error) { failed = true; primary = new AggregateError([primary, error], 'SS1_UNIT_DISK_CHANGED'); }
}
if (failed) throw primary;
report.status = 'SS1_CONTROL_CHILD_COMPLETE';
report.transformedLoads = transformedLoads;
report.diskUnchanged = true;
console.log(`SS1_CONTROL_CHILD_RESULT ${JSON.stringify(report)}`);
