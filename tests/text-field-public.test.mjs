import test from 'node:test';
import assert from 'node:assert/strict';
import { DisplayObject } from '@egret/engine';
import { request, fixture, release } from './text-raster-public-helpers.mjs';

// Start with genuine built-public-entry resources so a missing API is distinct
// from provider, module-loading, Engine or cache setup failure.
test('TF01: authentic initialized cache creates a scope-owned TextField display leaf', async (t) => {
  const base = await fixture(t, {}, { maxResidentEntries: 0 });
  const prepared = await base.cache.acquire(request());
  assert.equal(prepared.kind, 'image');
  release(prepared);
  await base.cache.whenIdle();
  assert.equal(base.state.measure, 1);
  assert.equal(base.state.raster, 1);
  assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  const scope = base.engine.createScope();
  const text = await import('@egret/engine/text');
  assert.equal(typeof text.createTextField, 'function', 'TF1 factory is not implemented');
  const field = text.createTextField(base.engine, scope, base.cache);
  assert.ok(field instanceof DisplayObject);
  assert.equal(field.getStatus().state, 'unprepared');
  assert.equal(field.getStatus().desiredRevision, 0);
  assert.equal(field.getStatus().pending, false);
  base.engine.stage.addChild(field);
  scope.dispose();
  assert.equal(field.isDisposed, true);
  assert.equal(field.getStatus().state, 'disposed');
  assert.equal(base.cache.getStatus().closed, false);
});
// Additional TF01–TF08 spec-derived CPU controls. First-party Apache-2.0.
// No font, renderer pixel, private implementation or fabricated resource oracle.
import * as publicEngine from '@egret/engine';
import { host } from './helpers.mjs';
import { REQUEST, ROW, REQUEST_KEYS, deferred, flush, image, issue,
  literalProvider, errorIs, rejected, keep, fulfilled,
  rejectedKept, readLog, poisonReads } from './text-raster-public-helpers.mjs';

const FRAME = Object.freeze({ width: 80, height: 80 });
const CONTENT = Object.freeze({ x: -1, y: 0, width: 9, height: 10 });
const LOGICAL = Object.freeze({ x: 0, y: 0, width: 8, height: 10 });
const INK = Object.freeze({ x: -1, y: 1, width: 8, height: 6 });
const RASTER1 = Object.freeze({ pixelLeft: -3, pixelTop: -1, width: 12,
  height: 10, byteLength: 480, density: 1, x: -3, y: -1,
  logicalWidth: 12, logicalHeight: 10 });
const RASTER15 = Object.freeze({ pixelLeft: -4, pixelTop: -1, width: 17,
  height: 14, byteLength: 952, density: 1.5, x: -8 / 3, y: -2 / 3,
  logicalWidth: 34 / 3, logicalHeight: 28 / 3 });

async function createField(base, scope = base.engine.createScope()) {
  const text = await import('@egret/engine/text');
  assert.equal(typeof text.createTextField, 'function');
  const field = text.createTextField(base.engine, scope, base.cache);
  return { field, scope, text };
}
function snapshot(field) {
  const value = field.getStatus();
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value).sort(),
    ['committedRevision', 'desiredRevision', 'metrics', 'pending', 'state']);
  return value;
}
function geometry(metrics, raster = RASTER1) {
  assert.deepEqual(metrics.logicalBounds, LOGICAL);
  assert.deepEqual(metrics.inkBounds, INK);
  assert.deepEqual(metrics.contentBounds, CONTENT);
  assert.deepEqual(metrics.raster, raster);
  assert.deepEqual(metrics.lines.map(line => [line.source.start, line.source.end,
    line.source.breakEnd, line.advance, line.baselineY]), [[0, 1, 1, 8, 5]]);
}
function capture(base, textured = false) {
  return textured ? base.engine.captureTexturedFrame(FRAME)
    : base.engine.captureFrame(FRAME);
}
function assertOldImage(base, saved) {
  const frame = capture(base);
  assert.equal(frame.commands.length, 1);
  assert.equal(frame.images[0], saved);
  return frame;
}
function terminalPromise(value) {
  assert.ok(value instanceof Promise);
  return assert.rejects(value, error => error instanceof publicEngine.EgretError);
}

test('TF01: factory affinity, opaque receivers and closed authority use genuine instances', async (t) => {
  const a = await fixture(t), b = await fixture(t);
  const own = await createField(a), foreign = b.engine.createScope();
  assert.equal(Object.hasOwn(publicEngine, 'createTextField'), false);
  assert.equal(Object.hasOwn(own.text, 'TextField'), false);
  assert.equal(Object.hasOwn(own.text, 'TextFieldStatus'), false);
  for (const args of [[a.engine, foreign, a.cache], [a.engine, own.scope, b.cache],
    [{}, own.scope, a.cache], [a.engine, {}, a.cache], [a.engine, own.scope, {}]]) {
    assert.throws(() => own.text.createTextField(...args), errorIs('TEXT_FIELD_INVALID'));
  }
  let reads = 0;
  const receivers = [{}, Object.create(Object.getPrototypeOf(own.field)),
    new Proxy(own.field, { get() { reads++; throw new Error('unread receiver'); } })];
  for (const receiver of receivers) {
    for (const method of ['setRequest', 'getStatus', 'dispose']) {
      assert.throws(() => Reflect.apply(own.field[method], receiver, [request()]),
        errorIs('TEXT_FIELD_INVALID'));
    }
    await rejected(Reflect.apply(own.field.prepare, receiver, []), 'TEXT_FIELD_INVALID');
  }
  assert.equal(reads, 0);
  assert.equal(a.state.measure, 0); assert.equal(b.state.measure, 0);
  assert.deepEqual(snapshot(own.field), { state: 'unprepared', desiredRevision: 0,
    committedRevision: undefined, pending: false, metrics: undefined });
  assert.notEqual(own.field.getStatus(), own.field.getStatus());
  a.engine.stage.addChild(own.field); a.engine.stage.removeChild(own.field);
  assert.equal(own.field.isDisposed, false, 'detachment does not change its Scope owner');
  own.scope.dispose();
  assert.throws(() => own.text.createTextField(a.engine, own.scope, a.cache), errorIs('SCOPE_CLOSED'));
  assert.equal(a.cache.getStatus().closed, false);
  b.cache.dispose();
  assert.throws(() => own.text.createTextField(b.engine, foreign, b.cache), errorIs('TEXT_CACHE_CLOSED'));
  await b.engine.dispose();
  // This combination has three closed authorities; the spec assigns no relative
  // factory error priority. It must still refuse with a genuine structured error.
  assert.throws(() => own.text.createTextField(b.engine, foreign, b.cache),
    error => error instanceof publicEngine.EgretError);
});

test('TF02: explicit immutable admission, short reentry guard and current generation', async (t) => {
  const base = await fixture(t, {}, { maxResidentEntries: 0 });
  const { field } = await createField(base);
  base.engine.stage.addChild(field);
  await rejected(field.prepare(), 'TEXT_FIELD_UNPREPARED');
  const original = request(), reads = [];
  field.setRequest(readLog(original, REQUEST_KEYS, reads));
  assert.deepEqual(reads, REQUEST_KEYS);
  original.text = 'mutated'; original.fontFamily = 'Other'; original.density = 1.5;
  assert.equal(snapshot(field).desiredRevision, 1);
  assert.equal(base.state.measure, 0); assert.equal(base.state.raster, 0);
  geometry(await field.prepare());
  assert.equal(base.state.requests[0].text, 'A');
  assert.equal(base.state.requests[0].fontFamily, 'Test');
  assert.equal(base.state.requests[0].density, 1);
  const initial = capture(base), committed = snapshot(field);
  field.setRequest(request()); assert.equal(snapshot(field).desiredRevision, 2);
  assert.equal(snapshot(field).committedRevision, 1);
  const getterCause = { explicitGetter: true };
  assert.throws(() => field.setRequest({ ...REQUEST, get fillColor() { throw getterCause; } }),
    errorIs('TEXT_REQUEST_INVALID', getterCause));
  assert.throws(() => field.setRequest(request({ fontSize: 0 })), errorIs('TEXT_REQUEST_INVALID'));
  assert.equal(snapshot(field).desiredRevision, 2);
  assert.deepEqual(snapshot(field).metrics, committed.metrics);
  assertOldImage(base, initial.images[0]);
  assert.equal(base.state.measure, 1);

  const other = (await createField(base)).field;
  const nestedReads = { reads: 0 }, caught = [], seen = [], nestedPromises = [];
  field.setRequest(readLog(REQUEST, REQUEST_KEYS, [], '', {
    text() {
      seen.push(snapshot(field));
      try { field.setRequest(poisonReads(REQUEST_KEYS, nestedReads)); } catch (e) { caught.push(e); }
      nestedPromises.push(keep(field.prepare()));
      other.setRequest(request({ text: 'other-field' }));
    },
  }));
  errorIs('TEXT_FIELD_BUSY')(caught[0]);
  await rejectedKept(nestedPromises[0], 'TEXT_FIELD_BUSY');
  assert.equal(nestedReads.reads, 0);
  assert.equal(seen[0].desiredRevision, 2);
  assert.equal(snapshot(field).desiredRevision, 3);
  assert.equal(snapshot(other).desiredRevision, 1);
  assert.equal(base.state.measure, 1, 'admission reentry starts no job');
  let nestedCause;
  assert.throws(() => field.setRequest({ ...REQUEST, get text() {
    try { field.setRequest(poisonReads(REQUEST_KEYS, nestedReads)); }
    catch (e) { nestedCause = e; throw e; }
  } }), error => {
    errorIs('TEXT_FIELD_BUSY')(nestedCause);
    return errorIs('TEXT_REQUEST_INVALID', nestedCause)(error);
  });
  assert.equal(snapshot(field).desiredRevision, 3);
  field.setRequest(request());
  assert.equal(snapshot(field).desiredRevision, 4, 'failed outer reads retire the guard');
  base.cache.invalidate();
  assertOldImage(base, initial.images[0]);
  geometry(await field.prepare());
  assert.equal(base.state.requests.at(-1).fontGeneration, 2);
  assert.equal(base.state.measure, 2);
  assert.equal(snapshot(field).committedRevision, 4);
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);

  const terminal = (await createField(base)).field;
  let terminalNested, terminalCode, terminalReads = 0;
  assert.throws(() => terminal.setRequest({ ...REQUEST, get text() {
    terminal.dispose();
    try { terminal.setRequest({ get text() { terminalReads++; return 'x'; } }); }
    catch (error) { terminalCode = error; }
    terminalNested = keep(terminal.prepare());
    return 'A';
  } }), errorIs('TEXT_FIELD_DISPOSED'));
  errorIs('TEXT_FIELD_DISPOSED')(terminalCode);
  await rejectedKept(terminalNested, 'TEXT_FIELD_DISPOSED');
  assert.equal(terminalReads, 0);
  assert.equal(snapshot(terminal).desiredRevision, 0);
  const disposedThenThrows = (await createField(base)).field, exact = { afterDisposal: true };
  assert.throws(() => disposedThenThrows.setRequest({ ...REQUEST, get text() {
    disposedThenThrows.dispose(); throw exact;
  } }), errorIs('TEXT_REQUEST_INVALID', exact));
});

test('TF03: signed logical ink, raster density, direct bounds and painter integration', async (t) => {
  for (const density of [1, 1.5]) {
    const base = await fixture(t, {}, { maxResidentEntries: 0 });
    const { field } = await createField(base);
    field.setRequest(request({ density })); geometry(await field.prepare(), density === 1 ? RASTER1 : RASTER15);
    assert.deepEqual(field.getBounds(), CONTENT, 'bounds exclude raster guard');
    const before = new publicEngine.Sprite(); before.graphics.beginFill(0x112233).drawRect(0, 0, 1, 1);
    const parent = new publicEngine.Sprite(); parent.x = 10; parent.y = 20;
    parent.scaleX = 2; parent.scaleY = 3; parent.alpha = 0.5;
    parent.clipRect = { x: -5, y: -5, width: 30, height: 30 };
    field.x = 3; field.y = 4; field.scaleX = -1; field.scaleY = 2; field.alpha = 0.5;
    field.clipRect = { x: -2, y: 0, width: 8, height: 10 };
    parent.addChild(field); base.engine.stage.addChild(before); base.engine.stage.addChild(parent);
    const bitmapValue = await base.cache.acquire(request({ density }));
    assert.equal(bitmapValue.kind, 'image');
    const bitmapScope = base.engine.createScope(); bitmapScope.use(bitmapValue.lease);
    const bitmap = bitmapScope.use(new publicEngine.Bitmap(bitmapValue.lease));
    bitmap.x = 40; bitmap.y = 2; base.engine.stage.addChild(bitmap);
    assert.deepEqual(field.getBounds(), CONTENT, 'receiver own transform is excluded');
    assert.deepEqual(parent.getBounds(), { x: -5, y: 4, width: 9, height: 20 });
    const placement = density === 1 ? { x: -3, y: -1, width: 12, height: 10 }
      : { x: -8 / 3, y: -2 / 3, width: 34 / 3, height: 28 / 3 };
    let saved;
    for (const textured of [false, true]) {
      const frame = capture(base, textured); saved ??= frame;
      assert.deepEqual(frame.commands.map(command => command.kind), ['rect', 'image', 'image']);
      assert.equal(frame.images.length, 1, 'genuine Bitmap and field share the image table identity');
      const command = frame.commands[1];
      assert.deepEqual(command.matrix, { a: -2, b: -0, c: 0, d: 6, tx: 16, ty: 32 });
      assert.deepEqual(command.rect, placement);
      assert.deepEqual(command.sourceRect, { x: 0, y: 0, width: density === 1 ? 12 : 17, height: density === 1 ? 10 : 14 });
      assert.equal(command.alpha, 0.25); assert.equal(command.imageIndex, 0);
      assert.deepEqual(command.clips, [
        { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 10, ty: 20 }, rect: { x: -5, y: -5, width: 30, height: 30 } },
        { matrix: { a: -2, b: -0, c: 0, d: 6, tx: 16, ty: 32 }, rect: { x: -2, y: 0, width: 8, height: 10 } },
      ]);
      assert.ok(Object.isFrozen(command)); assert.ok(Object.isFrozen(command.rect));
      assert.equal(frame.images[0], bitmapValue.lease.value.imageData);
    }
    field.visible = false;
    assert.equal(capture(base).commands.length, 2);
    assert.equal(capture(base, true).commands.length, 2);
    assert.deepEqual(field.getBounds(), CONTENT);
    field.visible = true; field.alpha = 0;
    assert.equal(capture(base).commands.length, 2); assert.deepEqual(parent.getBounds(), { x: -5, y: 4, width: 9, height: 20 });
    field.alpha = 0.5; field.clipRect = { x: 0, y: 0, width: 0, height: 10 };
    assert.equal(capture(base, true).commands.length, 2); assert.deepEqual(field.getBounds(), CONTENT);
    field.x = 99; assert.deepEqual(saved.commands[1].rect, placement);
    assert.deepEqual(saved.commands[1].matrix, { a: -2, b: -0, c: 0, d: 6, tx: 16, ty: 32 });
    bitmapScope.dispose(); field.dispose(); parent.dispose(); before.dispose();
  }
});

test('TF04: literal explicit source lines, blank layout and image-to-empty replacement', async (t) => {
  const base = await fixture(t, { measure(value, context) {
    return context.createPlan({ baselineOffset: 5, lines: value.sourceLines.map(source => {
      const text = value.text.slice(source.start, source.end);
      return text.length === 0 ? { advance: 0, hasInk: false, inkLeft: 0, inkTop: 0, inkRight: 0, inkBottom: 0 }
        : text.trim().length === 0 ? { advance: 8, hasInk: false, inkLeft: 0, inkTop: 0, inkRight: 0, inkBottom: 0 } : { ...ROW };
    }) });
  } }, { maxResidentEntries: 0 });
  const { field } = await createField(base); base.engine.stage.addChild(field);
  field.setRequest(request()); await field.prepare(); const prior = capture(base), priorBytes = publicEngine.copyImageData2DPixels(prior.images[0]);
  const cases = [
    { text: '', ranges: [[0, 0, 0]], advances: [0], height: 10, width: 0, raster: false },
    { text: ' ', ranges: [[0, 1, 1]], advances: [8], height: 10, width: 8, raster: false },
    { text: 'A\np', ranges: [[0, 1, 2], [2, 3, 3]], advances: [8, 8], height: 20, width: 8, raster: true },
    { text: 'A\r\np', ranges: [[0, 1, 3], [3, 4, 4]], advances: [8, 8], height: 20, width: 8, raster: true },
    { text: 'A\rp', ranges: [[0, 1, 2], [2, 3, 3]], advances: [8, 8], height: 20, width: 8, raster: true },
    { text: 'A\n', ranges: [[0, 1, 2], [2, 2, 2]], advances: [8, 0], height: 20, width: 8, raster: true, finalEmpty: true },
  ];
  for (const row of cases) {
    field.setRequest(request({ text: row.text })); const metrics = await field.prepare();
    assert.equal(base.state.requests.at(-1).text, row.text);
    assert.deepEqual(metrics.lines.map(line => [line.source.start, line.source.end, line.source.breakEnd]), row.ranges);
    assert.deepEqual(metrics.lines.map(line => line.advance), row.advances);
    assert.deepEqual(metrics.lines.map(line => line.baselineY), row.advances.length === 1 ? [5] : [5, 15]);
    assert.deepEqual(metrics.logicalBounds, { x: 0, y: 0, width: row.width, height: row.height });
    const bounds = row.raster ? { x: -1, y: 0, width: 9, height: 20 }
      : { x: 0, y: 0, width: row.width, height: row.height };
    assert.deepEqual(metrics.contentBounds, bounds);
    assert.deepEqual(field.getBounds(), row.width === 0 ? { x: 0, y: 0, width: 0, height: 0 } : bounds);
    for (const textured of [false, true]) assert.equal(capture(base, textured).commands.length, row.raster ? 1 : 0);
    assert.equal(base.cache.getStatus().activeCallerLeases, row.raster ? 1 : 0);
    if (!row.raster) { assert.equal(metrics.raster, undefined); assert.equal(metrics.inkBounds, undefined); }
    else {
      assert.deepEqual(metrics.inkBounds, { x: -1, y: 1, width: 8, height: row.finalEmpty ? 6 : 16 });
      assert.deepEqual(metrics.raster, { ...RASTER1, height: row.finalEmpty ? 10 : 20,
        logicalHeight: row.finalEmpty ? 10 : 20, byteLength: row.finalEmpty ? 480 : 960 });
    }
  }
  assert.deepEqual(publicEngine.copyImageData2DPixels(prior.images[0]), priorBytes);
  field.setRequest(request({ text: '' })); await field.prepare();
  const parent = new publicEngine.Sprite(); parent.graphics.beginFill(1).drawRect(3, 4, 1, 1);
  parent.addChild(field);
  assert.throws(() => parent.getBounds({ maxNodes: 2, maxPrimitives: 1 }), errorIs('BOUNDS_CONTENT_LIMIT'));
  assert.deepEqual(parent.getBounds({ maxNodes: 2, maxPrimitives: 2 }), { x: 3, y: 4, width: 1, height: 1 });
  field.setRequest(request()); geometry(await field.prepare());
  assert.equal(snapshot(field).state, 'ready'); assert.equal(capture(base).commands.length, 0, 'detached ownership is not implicit attachment');
  base.engine.stage.addChild(parent); assert.equal(capture(base).commands.length, 2);
  parent.dispose();
});

test('TF05: pending replacement, genuine late settlement and provider failure are atomic', async (t) => {
  const gates = { B: deferred(), C: deferred() }, entered = { B: deferred(), C: deferred() }, done = { B: deferred(), C: deferred() };
  const owned = new Map(), cause = { providerFailure: 'D' };
  const base = await fixture(t, {
    measure(value, context) { if (value.text === 'D') throw cause; return issue(value, context); },
    async rasterize(plan) {
      const text = plan.request.text;
      if (gates[text]) { entered[text].resolve(); await gates[text].promise; }
      const value = image(12, 10); owned.set(text, value); done[text]?.resolve(); return value;
    },
  }, { maxResidentEntries: 0 });
  t.after(() => { gates.B.resolve(); gates.C.resolve(); });
  const { field } = await createField(base); base.engine.stage.addChild(field);
  field.setRequest(request()); await field.prepare(); const a = capture(base), oldMetrics = snapshot(field).metrics;
  field.setRequest(request({ text: 'B' })); const b = keep(field.prepare()); await entered.B.promise;
  assert.equal(snapshot(field).pending, true); assert.equal(snapshot(field).state, 'ready');
  assert.deepEqual(field.getBounds(), CONTENT); assertOldImage(base, a.images[0]);
  await rejected(field.prepare(), 'TEXT_FIELD_BUSY');
  field.setRequest(request({ text: 'C' })); await rejectedKept(b, 'TEXT_FIELD_SUPERSEDED');
  assert.equal(snapshot(field).pending, false); assert.equal(snapshot(field).committedRevision, 1);
  const c = keep(field.prepare()); await entered.C.promise;
  gates.B.resolve(); await done.B.promise; await flush();
  assertOldImage(base, a.images[0]); assert.deepEqual(snapshot(field).metrics, oldMetrics);
  gates.C.resolve(); geometry(await fulfilled(c)); await base.cache.whenIdle();
  assert.equal(capture(base).images[0], owned.get('C'));
  assert.notEqual(capture(base).images[0], owned.get('B'));
  assert.equal(snapshot(field).committedRevision, 3); assert.equal(snapshot(field).pending, false);
  assert.equal(base.state.release, 3); assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  assert.equal(base.cache.getStatus().pendingJobs, 0); assert.equal(base.cache.getStatus().reservedImageBytes, 0);
  assert.equal(base.cache.getStatus().pendingRasterBytes, 0);
  field.setRequest(request({ text: 'D' }));
  await rejected(field.prepare(), 'TEXT_MEASURE_FAILED', cause);
  assert.equal(snapshot(field).desiredRevision, 4); assert.equal(snapshot(field).committedRevision, 3);
  assert.equal(snapshot(field).pending, false); assert.equal(capture(base).images[0], owned.get('C'));
  assert.deepEqual(publicEngine.copyImageData2DPixels(a.images[0]), publicEngine.copyImageData2DPixels(owned.get('A')));
  field.dispose(); await base.cache.whenIdle(); assert.equal(base.cache.getStatus().activeCallerLeases, 0);
});

test('TF06: coalesced fields have independent entitlements and caller-owned cache survives', async (t) => {
  const gate = deferred(), entered = deferred();
  const base = await fixture(t, { async rasterize() { entered.resolve(); await gate.promise; return image(); } }, { maxResidentEntries: 0 });
  t.after(() => gate.resolve());
  const one = await createField(base), two = await createField(base);
  base.engine.stage.addChild(one.field); base.engine.stage.addChild(two.field);
  one.field.setRequest(request()); two.field.setRequest(request());
  const p = keep(one.field.prepare()), q = keep(two.field.prepare()); await entered.promise;
  assert.equal(base.state.measure, 1); assert.equal(base.state.raster, 1);
  one.field.setRequest(request({ text: 'other' })); await rejectedKept(p, 'TEXT_FIELD_SUPERSEDED');
  one.field.dispose(); assert.equal(base.state.rasterContexts[0].signal.aborted, false);
  gate.resolve(); await fulfilled(q); await base.cache.whenIdle();
  assert.equal(base.cache.getStatus().activeCallerLeases, 1); assert.equal(two.field.isDisposed, false);
  const third = await createField(base); third.field.setRequest(request()); await third.field.prepare();
  base.engine.stage.addChild(third.field);
  assert.equal(base.cache.getStatus().activeCallerLeases, 2);
  const frame = capture(base); assert.equal(frame.commands.length, 2); assert.equal(frame.images.length, 1);
  assert.deepEqual(frame.commands.map(command => command.imageIndex), [0, 0]);
  const parent = new publicEngine.Sprite(); base.engine.stage.removeChild(two.field); parent.addChild(two.field); base.engine.stage.addChild(parent);
  const attemptedOwner = base.engine.createScope();
  assert.throws(() => attemptedOwner.use(two.field), errorIs('OWNERSHIP_CONFLICT'));
  two.scope.dispose(); assert.equal(two.field.isDisposed, true);
  assert.equal(third.field.isDisposed, false); assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  assert.equal(base.cache.getStatus().closed, false); assert.equal(capture(base).commands.length, 1);
  const saved = capture(base); base.cache.dispose();
  assert.equal(third.field.isDisposed, false); assert.equal(snapshot(third.field).state, 'ready');
  assert.equal(capture(base).images[0], saved.images[0], 'cache close does not revoke already delivered caller leases');
  await rejected(third.field.prepare(), 'TEXT_CACHE_CLOSED');
  third.field.dispose(); await base.cache.whenIdle();
  assert.equal(base.cache.getStatus().activeCallerLeases, 0); assert.equal(base.cache.getStatus().closed, true);
  assert.equal(base.state.measure, 1); assert.equal(base.state.release, 1);
  assert.deepEqual(publicEngine.copyImageData2DPixels(saved.images[0]), publicEngine.copyImageData2DPixels(frame.images[0]));
  parent.dispose();
});

test('TF07: Scope closing refuses reached contribution before cleanup and saved frames survive', async (t) => {
  const base = await fixture(t, {}, { maxResidentEntries: 0 });
  const scope = base.engine.createScope(), cleanup = [];
  let field;
  scope.use({ dispose() { cleanup.push(field.isDisposed); } });
  ({ field } = await createField(base, scope)); field.setRequest(request()); await field.prepare();
  base.engine.stage.addChild(field); const saved = capture(base), bytes = publicEngine.copyImageData2DPixels(saved.images[0]);
  const facts = {}, reads = { reads: 0 };
  scope.signal.addEventListener('abort', () => {
    facts.scopeState = scope.state; facts.fieldDisposedBeforeCleanup = field.isDisposed;
    facts.status = field.getStatus(); facts.prepare = keep(field.prepare());
    for (const [key, run] of [
      ['setter', () => field.setRequest(poisonReads(REQUEST_KEYS, reads))],
      ['bounds', () => field.getBounds()], ['capture', () => capture(base)],
      ['textured', () => capture(base, true)],
    ]) { try { run(); } catch (error) { facts[key] = error; } }
    field.visible = false;
    try { facts.hiddenCommands = capture(base).commands.length; facts.hiddenTexturedCommands = capture(base, true).commands.length; }
    catch (error) { facts.hiddenError = error; }
    field.visible = true;
  });
  scope.dispose();
  assert.equal(facts.scopeState, 'closing'); assert.equal(facts.fieldDisposedBeforeCleanup, false);
  assert.equal(facts.status.state, 'ready'); assert.equal(reads.reads, 0);
  for (const key of ['setter', 'bounds', 'capture', 'textured']) errorIs('SCOPE_CLOSED')(facts[key]);
  await rejectedKept(facts.prepare, 'SCOPE_CLOSED');
  assert.equal(facts.hiddenError, undefined); assert.equal(facts.hiddenCommands, 0); assert.equal(facts.hiddenTexturedCommands, 0);
  assert.deepEqual(cleanup, [true]); assert.equal(field.isDisposed, true);
  assert.equal(snapshot(field).state, 'disposed'); assert.equal(snapshot(field).pending, false);
  assert.equal(base.cache.getStatus().activeCallerLeases, 0); assert.equal(base.cache.getStatus().closed, false);
  assert.deepEqual(publicEngine.copyImageData2DPixels(saved.images[0]), bytes);
});

test('TF07: Engine terminal reentry, late real raster, first cleanup cause and actual idle', async () => {
  const gate = deferred(), entered = deferred(), hostCause = { hostStop: true }, firstCause = { scopeCleanup: true };
  const diagnostics = [], trace = [], literal = literalProvider({ async rasterize(plan) {
    if (plan.request.text === 'late') { entered.resolve(); await gate.promise; }
    return image();
  } });
  const adapter = host({
    stop() { trace.push('stop'); throw hostCause; },
    async close() { trace.push('close'); },
  });
  const engine = await publicEngine.createEngine({ host: adapter.adapter,
    onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  const text = await import('@egret/engine/text');
  const cache = text.createTextRasterCache(engine.assets, { provider: literal.provider, maxResidentEntries: 0 });
  let field, pending, closing;
  try {
    const scope = engine.createScope(); scope.use({ dispose() { trace.push('scope-cleanup'); assert.equal(field.isDisposed, true); throw firstCause; } });
    field = text.createTextField(engine, scope, cache); engine.stage.addChild(field);
    field.setRequest(request()); await field.prepare(); const saved = engine.captureFrame(FRAME), bytes = publicEngine.copyImageData2DPixels(saved.images[0]);
    field.setRequest(request({ text: 'late' })); pending = keep(field.prepare()); await entered.promise;
    const reentry = {}, unread = { reads: 0 };
    scope.signal.addEventListener('abort', () => {
      reentry.state = scope.state; reentry.prepare = keep(field.prepare());
      try { field.setRequest(poisonReads(REQUEST_KEYS, unread)); } catch (error) { reentry.setter = error; }
      try { engine.captureFrame(FRAME); } catch (error) { reentry.capture = error; }
      reentry.dispose = engine.dispose();
    });
    closing = engine.dispose(); assert.equal(engine.dispose(), closing);
    await assert.rejects(closing, error => {
      errorIs('ENGINE_CLOSE_FAILED', firstCause)(error);
      assert.deepEqual(error.cleanupErrors, [hostCause]); assert.ok(Object.isFrozen(error.cleanupErrors)); return true;
    });
    assert.equal(reentry.dispose, closing); assert.equal(reentry.state, 'closing');
    errorIs('ENGINE_CLOSED')(reentry.setter); errorIs('ENGINE_CLOSED')(reentry.capture);
    await rejectedKept(reentry.prepare, 'ENGINE_CLOSED'); assert.equal(unread.reads, 0);
    await terminalPromise(pending.observed.then(outcome => { if ('error' in outcome) throw outcome.error; return outcome.value; }));
    assert.equal(field.isDisposed, true); assert.equal(snapshot(field).pending, false);
    let settled = false; const idle = cache.whenIdle(); idle.then(() => { settled = true; });
    await flush(); assert.equal(settled, false, 'Engine closure does not settle a real held provider use');
    gate.resolve(); await idle;
    assert.equal(literal.state.release, 2); assert.equal(cache.getStatus().pendingJobs, 0);
    assert.equal(cache.getStatus().reservedImageBytes, 0); assert.equal(cache.getStatus().pendingRasterBytes, 0);
    assert.equal(cache.getStatus().activeCallerLeases, 0); assert.equal(snapshot(field).state, 'disposed');
    assert.deepEqual(trace, ['scope-cleanup', 'stop', 'close']);
    assert.deepEqual(publicEngine.copyImageData2DPixels(saved.images[0]), bytes);
    assert.ok(diagnostics.some(diagnostic => diagnostic.cause === firstCause));
  } finally {
    gate.resolve(); cache.dispose(); await cache.whenIdle();
    try { await engine.dispose(); } catch (error) { errorIs('ENGINE_CLOSE_FAILED', firstCause)(error); }
  }
});

test('TF07: frame-barrier closing defeats an ordinary same-name Engine state shadow', async (t) => {
  let base, field, scope, closing;
  const facts = {};
  base = await fixture(t, {}, { maxResidentEntries: 0 }, { hostOverrides: {
    renderFrame() {
      closing = base.engine.dispose();
      // This caller-owned ordinary property cannot reopen authentic private state.
      base.engine.currentState = 'open';
      facts.scopeState = scope.state; facts.fieldDisposed = field.isDisposed;
      facts.prepare = keep(field.prepare()); facts.nestedDispose = base.engine.dispose();
      try { base.engine.captureFrame(FRAME); } catch (error) { facts.capture = error; }
      try { field.getBounds(); } catch (error) { facts.bounds = error; }
      return undefined;
    },
  } });
  ({ field, scope } = await createField(base)); field.setRequest(request()); await field.prepare();
  base.engine.stage.addChild(field); const frame = base.engine.renderFrame(FRAME);
  assert.equal(facts.scopeState, 'open', 'Scope cleanup still waits behind the live render callback');
  assert.equal(facts.fieldDisposed, false); assert.equal(facts.nestedDispose, closing);
  errorIs('ENGINE_CLOSED')(facts.capture); errorIs('ENGINE_CLOSED')(facts.bounds);
  await rejectedKept(facts.prepare, 'ENGINE_CLOSED'); await closing;
  assert.equal(field.isDisposed, true); assert.equal(snapshot(field).pending, false);
  assert.equal(publicEngine.copyImageData2DPixels(frame.images[0]).length, 480);
  assert.equal(base.cache.getStatus().activeCallerLeases, 0);
});

test('TF08: genuine cache capacity retains superseded physical work without a queue', async (t) => {
  const gate = deferred(), entered = deferred();
  const base = await fixture(t, { async rasterize(plan) {
    if (plan.request.text === 'B') { entered.resolve(); await gate.promise; }
    return image();
  } }, { maxResidentEntries: 0, maxPendingJobs: 1, maxLogicalImageBytes: 960, maxPendingRasterBytes: 960 });
  t.after(() => gate.resolve());
  const { field } = await createField(base); base.engine.stage.addChild(field);
  field.setRequest(request()); await field.prepare(); await base.cache.whenIdle(); const saved = capture(base);
  field.setRequest(request({ text: 'B' })); const b = keep(field.prepare()); await entered.promise;
  assert.deepEqual([base.cache.getStatus().pendingJobs, base.cache.getStatus().reservedImageBytes,
    base.cache.getStatus().pendingRasterBytes], [1, 480, 960]);
  field.setRequest(request({ text: 'C' })); await rejectedKept(b, 'TEXT_FIELD_SUPERSEDED');
  await rejected(field.prepare(), 'TEXT_CACHE_BUDGET');
  assert.equal(snapshot(field).pending, false); assert.equal(snapshot(field).committedRevision, 1);
  assertOldImage(base, saved.images[0]); assert.equal(base.state.measure, 2);
  assert.deepEqual([base.cache.getStatus().pendingJobs, base.cache.getStatus().reservedImageBytes,
    base.cache.getStatus().pendingRasterBytes], [1, 480, 960]);
  gate.resolve(); await base.cache.whenIdle(); geometry(await field.prepare());
  assert.equal(snapshot(field).committedRevision, 3); assert.equal(base.state.measure, 3);
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);
});

test('TF08: field shares the existing 64-image capture ledger with genuine Bitmaps', async (t) => {
  const base = await fixture(t, {}, { maxResidentEntries: 0 });
  const { field } = await createField(base); field.setRequest(request()); await field.prepare(); base.engine.stage.addChild(field);
  const scope = base.engine.createScope(), textures = new Map();
  const type = publicEngine.createAssetType('tf1-image-ledger', publicEngine.isTexture);
  base.engine.assets.register(type, { async load(ref) { return textures.get(ref.id); }, dispose(texture) { texture.dispose(); } });
  const nodes = [];
  for (let index = 0; index < 64; index++) {
    const key = String(index), texture = publicEngine.createTexture(publicEngine.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([index, 2, 3, 255]) }));
    textures.set(key, texture);
    const lease = await base.engine.assets.acquire(publicEngine.createAssetRef(type, key)); scope.use(lease);
    const bitmap = scope.use(new publicEngine.Bitmap(lease)); nodes.push(bitmap);
    if (index < 63) base.engine.stage.addChild(bitmap);
  }
  for (const textured of [false, true]) {
    const valid = capture(base, textured); assert.equal(valid.images.length, 64); assert.equal(valid.commands.length, 64);
    base.engine.stage.addChild(nodes[63]);
    assert.throws(() => capture(base, textured), errorIs('FRAME_IMAGE_BUDGET'));
    base.engine.stage.removeChild(nodes[63]);
    assert.equal(capture(base, textured).frameId, valid.frameId + 1, 'failed capture consumes no frame ID');
  }
  scope.dispose();
});

test('TF08: hidden leaf node admission and field output/clip units retain exact caps', async (t) => {
  await t.test('node boundary includes the hidden authentic TextField', async (t) => {
    const base = await fixture(t, {}, { maxResidentEntries: 0 });
    const { field } = await createField(base); field.setRequest(request()); await field.prepare(); field.visible = false; base.engine.stage.addChild(field);
    const nodes = [];
    try {
      // Assemble a genuine detached binary subtree bottom-up before its single
      // attachment. The earlier flat setup repeatedly revalidated the growing
      // Engine-bound Stage; this preserves all 65534 nodes and capture caps.
      for (let index = 0; index < 65534; index++) nodes.push(new publicEngine.Sprite());
      for (let index = nodes.length - 1; index >= 0; index--) {
        const left = 2 * index + 1, right = left + 1;
        if (left < nodes.length) nodes[index].addChild(nodes[left]);
        if (right < nodes.length) nodes[index].addChild(nodes[right]);
      }
      base.engine.stage.addChild(nodes[0]);
      const valid = capture(base, true); assert.equal(valid.commands.length, 0);
      const extra = new publicEngine.Sprite(); nodes.push(extra); base.engine.stage.addChild(extra);
      assert.throws(() => capture(base, true), errorIs('FRAME_BUDGET_EXCEEDED'));
      extra.dispose(); field.visible = true;
      assert.equal(capture(base, true).frameId, valid.frameId + 1);
    } finally { for (let index = nodes.length - 1; index >= 0; index--) nodes[index].dispose(); }
  });
  await t.test('field shares 65536 authoring/output and 262144 clip-reference units', async (t) => {
    const base = await fixture(t, {}, { maxResidentEntries: 0 });
    const { field } = await createField(base); field.setRequest(request()); await field.prepare();
    const parents = []; let parent = base.engine.stage;
    for (let index = 0; index < 4; index++) { const node = new publicEngine.Sprite(); node.clipRect = { x: 0, y: 0, width: 10, height: 10 }; parents.push(node); parent.addChild(node); parent = node; }
    parent.addChild(field); parent.graphics.beginFill(1);
    for (let index = 0; index < 65535; index++) parent.graphics.drawRect(0, 0, 1, 1);
    const valid = capture(base, true); assert.equal(valid.commands.length, 65536);
    assert.equal(valid.commands[65535].kind, 'image');
    assert.equal(valid.commands.reduce((sum, command) => sum + command.clips.length, 0), 262144);
    field.clipRect = { x: 0, y: 0, width: 10, height: 10 };
    assert.throws(() => capture(base, true), errorIs('FRAME_BUDGET_EXCEEDED'), '65535*4 + field*5 = 262145');
    field.clipRect = undefined; parent.graphics.drawRect(0, 0, 1, 1);
    field.visible = false;
    assert.throws(() => capture(base, true), errorIs('FRAME_BUDGET_EXCEEDED'), 'hidden text still consumes its authoring unit');
    parent.graphics.clear(); assert.equal(capture(base, true).commands.length, 0);
    field.visible = true; assert.equal(capture(base, true).commands.length, 1);
    for (let index = parents.length - 1; index >= 0; index--) parents[index].dispose();
  });
});
