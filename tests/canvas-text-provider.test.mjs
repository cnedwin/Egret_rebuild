import test from 'node:test';
import assert from 'node:assert/strict';
import { DisplayObject } from '@egret/engine';
import { fixture, request, release, errorIs } from './text-raster-public-helpers.mjs';

// Copy this file to the real repository tests directory before running it.
// The resource/display baseline precedes the new nested-entry import. This is
// a public package construction witness, never a browser or font pixel test.
test('WC01 RED: genuine Engine/cache/TextField setup precedes the Canvas text entry', async (t) => {
  const base = await fixture(t, {}, { maxResidentEntries: 0 });
  const primed = await base.cache.acquire(request());
  assert.equal(primed.kind, 'image');
  release(primed);
  await base.cache.whenIdle();
  assert.equal(base.state.measure, 1);
  assert.equal(base.state.raster, 1);
  assert.equal(base.cache.getStatus().activeCallerLeases, 0);

  const text = await import('@egret/engine/text');
  const scope = base.engine.createScope();
  const field = text.createTextField(base.engine, scope, base.cache);
  assert.ok(field instanceof DisplayObject);
  field.setRequest(request());
  const metrics = await field.prepare();
  base.engine.stage.addChild(field);
  const frame = base.engine.captureFrame({ width: 80, height: 80 });
  assert.equal(frame.commands.length, 1);
  assert.equal(frame.images.length, 1);
  assert.equal(metrics.raster.width, 12);
  assert.equal(metrics.raster.height, 10);
  scope.dispose();
  await base.cache.whenIdle();
  assert.equal(field.isDisposed, true);
  assert.equal(base.cache.getStatus().activeCallerLeases, 0);

  // The selected old package is missing this exact public subpath. An import
  // error here is preserved; it is not replaced with a forged failure.
  const webText = await import('@egret/engine/web/text');
  assert.deepEqual(Object.keys(webText), ['createCanvasTextRasterProvider']);
  assert.equal(typeof webText.createCanvasTextRasterProvider, 'function');
  assert.throws(() => webText.createCanvasTextRasterProvider(), errorIs('WEB_TEXT_UNAVAILABLE'));
});

// Spec-derived deterministic CPU controls. None observes a real browser font.
import { spawnSync } from 'node:child_process';
import * as publicEngine from '@egret/engine';
import { keep, fulfilled, rejected, rejectedKept, signal } from './text-raster-public-helpers.mjs';
import { METRICS, ZERO, realm, factory, setup, wcRequest, holdRaster, enteredOrOutcome } from './canvas-text-provider-double-helpers.mjs';

const CONTENT = Object.freeze({ x: -1, y: 0, width: 9, height: 22 });
const INK = Object.freeze({ x: -1, y: 16, width: 8, height: 6 });
const RASTER1 = Object.freeze({ pixelLeft: -3, pixelTop: 14, width: 12, height: 10,
  byteLength: 480, density: 1, x: -3, y: 14, logicalWidth: 12, logicalHeight: 10 });
const RASTER15 = Object.freeze({ pixelLeft: -4, pixelTop: 22, width: 17, height: 13,
  byteLength: 884, density: 1.5, x: -8 / 3, y: 44 / 3,
  logicalWidth: 34 / 3, logicalHeight: 26 / 3 });

function retired(native) {
  for (const canvas of native.canvases) {
    assert.equal(canvas.width, 0, 'owned transient Canvas width retires');
    assert.equal(canvas.height, 0, 'owned transient Canvas height retires');
  }
}
function geometry(metrics, density = 1) {
  assert.deepEqual(metrics.logicalBounds, { x: 0, y: 0, width: 8, height: 10 });
  assert.deepEqual(metrics.inkBounds, INK);
  assert.deepEqual(metrics.contentBounds, CONTENT);
  assert.deepEqual(metrics.raster, density === 1 ? RASTER1 : RASTER15);
  assert.deepEqual(metrics.lines.map(line => [line.source.start, line.source.end,
    line.source.breakEnd, line.advance, line.baselineY]), [[0, 1, 1, 8, 20]]);
}
function phaseState(state, value) {
  assert.equal(state.textAlign, 'left'); assert.equal(state.textBaseline, 'alphabetic');
  assert.equal(state.direction, value.direction); assert.equal(state.lang, value.locale);
  assert.equal(state.fontKerning, 'auto'); assert.equal(state.fontStretch, 'normal');
  assert.equal(state.fontVariantCaps, 'normal'); assert.equal(state.letterSpacing, '0px');
  assert.equal(state.wordSpacing, '0px'); assert.equal(state.textRendering, 'auto');
  assert.match(state.font, /^italic\s+600\s+20px\s+"Q\\"\\\\Z"$/);
}

test('WC01: new import is DOM-inert and the factory remains isolated from older entries', async () => {
  const script = `for (const key of ['window','document','HTMLCanvasElement','CanvasRenderingContext2D','ImageData'])
    Object.defineProperty(globalThis,key,{get(){throw new Error('import touched '+key)}});
    const roots=await Promise.all(['@egret/engine','@egret/engine/web','@egret/engine/webgpu','@egret/engine/text'].map(value=>import(value)));
    if(roots.some(value=>'createCanvasTextRasterProvider' in value))throw new Error('factory leaked');
    const value=await import('@egret/engine/web/text');
    if(Object.keys(value).join(',')!=='createCanvasTextRasterProvider')throw new Error('unexpected export');`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  assert.equal(child.error, undefined); assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stderr, '');
});

test('WC01/WC05: factory is allocation-free, frozen and distinct; wrong receivers fail before reads', async (t) => {
  const native = realm(t), create = await factory(), provider = create(), other = create();
  assert.ok(Object.isFrozen(provider)); assert.notEqual(provider, other);
  assert.equal(provider.identity, 'egret.canvas-text.wc1');
  assert.equal(provider.profile, 'canvas-explicit-lines-v1');
  assert.equal(native.canvases.length, 0); assert.equal(native.checks.length, 0);
  let reads = 0;
  const poison = new Proxy({}, { get() { reads++; throw new Error('receiver must win'); } });
  await rejected(Reflect.apply(provider.measure, other, [poison, poison]), 'WEB_TEXT_PROVIDER_INVALID');
  await rejected(Reflect.apply(provider.rasterize, {}, [poison, poison]), 'WEB_TEXT_PROVIDER_INVALID');
  assert.throws(() => Reflect.apply(provider.release, {}, [poison]), errorIs('WEB_TEXT_PROVIDER_INVALID'));
  assert.equal(reads, 0); assert.equal(native.canvases.length, 0);
});

test('WC01: current browser capability getter cause is wrapped without allocating', async (t) => {
  const native = realm(t), create = await factory(), original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const cause = { documentAccess: true };
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, get() { throw cause; } });
    assert.throws(() => create(), errorIs('WEB_TEXT_UNAVAILABLE', cause));
  } finally { Object.defineProperty(globalThis, 'document', original); }
  assert.equal(native.canvases.length, 0); assert.equal(native.checks.length, 0);
});

test('WC02: complete lines and native state preserve literal family, locale, direction and fill', async (t) => {
  const native = realm(t), provider = (await factory())(), base = await setup(t, provider);
  const value = wcRequest({ text: 'AB\r\nC\n', fontFamily: 'Q"\\Z',
    fontWeight: 600, fontStyle: 'italic', locale: 'ar', direction: 'rtl', fillColor: 0x115395 });
  const result = await base.cache.acquire(value);
  assert.deepEqual(native.measurements.map(call => call.text), ['AB', 'C', '']);
  for (const call of native.measurements) {
    phaseState(call.state, value); assert.deepEqual(call.transform, [1, 0, 0, 1, 0, 0]);
    assert.deepEqual(call.size, [1, 1]);
    assert.equal(call.canvas.width, 0); assert.equal(call.canvas.height, 0);
  }
  assert.deepEqual(native.fills.map(call => call.args), [['AB', 0, 20], ['C', 0, 30], ['', 0, 40]]);
  for (const call of native.fills) {
    phaseState(call.state, value); assert.deepEqual(call.transform, [1, 0, 0, 1, 3, -14]);
    assert.equal(call.state.fillStyle, '#115395'); assert.equal(call.state.globalAlpha, 1);
    assert.equal(call.state.globalCompositeOperation, 'source-over');
    assert.equal(call.state.filter, 'none'); assert.equal(call.state.shadowBlur, 0);
    assert.equal(call.state.shadowOffsetX, 0); assert.equal(call.state.shadowOffsetY, 0);
  }
  assert.equal(native.checks.length, 2);
  assert.deepEqual(native.checks.map(row => row[1]), [value.text, value.text]);
  assert.equal(native.checks[0][0], native.measurements[0].state.font);
  assert.equal(native.checks[1][0], native.fills[0].state.font);
  assert.equal(base.state.inputs.length, 1);
  assert.equal(base.state.returnedPlans[0], base.state.plans[0]);
  assert.equal(base.state.images[0], result.lease.value.imageData);
  release(result); await base.cache.whenIdle(); retired(native);
});

test('WC03/WC04 CPU: em-origin20 density1 and1.5 have independent placements and owned bytes', async (t) => {
  const native = realm(t), provider = (await factory())();
  for (const density of [1, 1.5]) {
    const base = await setup(t, provider), result = await base.cache.acquire(wcRequest({ density }));
    geometry(result.metrics, density);
    assert.equal(base.state.inputs.length, 1); assert.equal(base.state.inputs[0].baselineOffset, 20);
    assert.equal(base.state.returnedPlans[0], base.state.plans[0]);
    assert.equal(base.state.rasterContexts[0].reservedImageBytes, density === 1 ? 480 : 884);
    assert.equal(base.state.rasterContexts[0].reservedScratchBytes, density === 1 ? 960 : 1768);
    const read = native.reads.at(-1), fill = native.fills.at(-1);
    assert.equal(fill.state.direction, 'ltr'); assert.equal(fill.state.lang, 'und');
    assert.deepEqual([read.x, read.y, read.width, read.height], density === 1 ? [0, 0, 12, 10] : [0, 0, 17, 13]);
    assert.deepEqual(fill.transform, density === 1 ? [1, 0, 0, 1, 3, -14] : [1.5, 0, 0, 1.5, 4, -22]);
    const contextEvent = native.events.find(event => event[0] === 'context' && event[1] === read.canvas.id);
    assert.deepEqual(contextEvent[3], { alpha: true, colorSpace: 'srgb', willReadFrequently: true });
    read.pixels.fill(0);
    const bytes = publicEngine.copyImageData2DPixels(result.lease.value.imageData);
    assert.equal(bytes.length, density === 1 ? 480 : 884);
    for (let index = 0; index < bytes.length; index += 4) assert.deepEqual([...bytes.subarray(index, index + 4)], [17, 83, 149, 255]);
    release(result); await base.cache.whenIdle(); retired(native);
  }
});

test('WC03: exact delimiter ranges and terminal lines are not trimmed, wrapped or normalized', async (t) => {
  const native = realm(t), provider = (await factory())(), base = await setup(t, provider);
  const cases = [
    { text: '', pieces: [''], ranges: [[0, 0, 0]], baselines: [20] },
    { text: 'A\np', pieces: ['A', 'p'], ranges: [[0, 1, 2], [2, 3, 3]], baselines: [20, 30] },
    { text: 'A\r\np', pieces: ['A', 'p'], ranges: [[0, 1, 3], [3, 4, 4]], baselines: [20, 30] },
    { text: 'A\rp', pieces: ['A', 'p'], ranges: [[0, 1, 2], [2, 3, 3]], baselines: [20, 30] },
    { text: 'A\n', pieces: ['A', ''], ranges: [[0, 1, 2], [2, 2, 2]], baselines: [20, 30] },
  ];
  for (const row of cases) {
    const before = native.measurements.length, result = await base.cache.acquire(wcRequest({ text: row.text }));
    assert.deepEqual(native.measurements.slice(before).map(call => call.text), row.pieces);
    assert.deepEqual(result.metrics.lines.map(line => [line.source.start, line.source.end, line.source.breakEnd]), row.ranges);
    assert.deepEqual(result.metrics.lines.map(line => line.baselineY), row.baselines);
    assert.equal(result.metrics.logicalBounds.height, row.pieces.length * 10);
    release(result); await base.cache.whenIdle();
  }
  retired(native);
});

test('WC03/WC05: zero-area signed metrics yield blank without raster surfaces or caller leases', async (t) => {
  const native = realm(t, { measure: () => ({ width: 8, actualBoundingBoxLeft: -0,
    actualBoundingBoxRight: 0, actualBoundingBoxAscent: -0, actualBoundingBoxDescent: 0 }) });
  const provider = (await factory())(), base = await setup(t, provider);
  const result = await base.cache.acquire(wcRequest({ text: ' ' }));
  assert.equal(result.kind, 'empty'); assert.equal(result.metrics.raster, undefined);
  assert.equal(result.metrics.inkBounds, undefined);
  assert.deepEqual(result.metrics.contentBounds, { x: 0, y: 0, width: 8, height: 10 });
  assert.deepEqual(base.state.inputs[0].lines, [{ advance: 8, hasInk: false,
    inkLeft: 0, inkTop: 0, inkRight: 0, inkBottom: 0 }]);
  assert.equal(native.canvases.length, 1); assert.equal(native.fills.length, 0); assert.equal(native.reads.length, 0);
  assert.equal(base.state.images[0], undefined); assert.equal(base.state.released.length, 1);
  await base.cache.whenIdle(); assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  assert.equal(base.cache.getStatus().liveImageBytes, 0); retired(native);
});

test('WC02/WC06: invalid native scalars never issue a plan and successful cleanup refunds admission', async (t) => {
  let row = { ...METRICS };
  const native = realm(t, { measure: () => ({ ...row }) }), provider = (await factory())();
  const base = await setup(t, provider);
  const invalid = [
    { ...METRICS, width: NaN },
    { ...METRICS, width: -1 },
    { ...METRICS, actualBoundingBoxLeft: -9, actualBoundingBoxRight: 7 },
    { ...METRICS, actualBoundingBoxAscent: 1048577 },
  ];
  for (let index = 0; index < invalid.length; index++) {
    row = invalid[index];
    await rejected(base.cache.acquire(wcRequest({ text: String(index) })), 'TEXT_MEASURE_FAILED');
    assert.equal(base.state.inputs.length, 0, 'local invalid metadata precedes createPlan');
    assert.equal(native.reads.length, 0); await base.cache.whenIdle(); retired(native);
  }
  row = { ...METRICS };
  const result = await base.cache.acquire(wcRequest({ text: 'valid' }));
  assert.equal(result.kind, 'image'); assert.equal(base.state.plans.length, 1);
  release(result); await base.cache.whenIdle(); retired(native);
});

test('WC05: four held plans across five genuine Engines refuse the fifth before Canvas and refund once', async (t) => {
  const native = realm(t), provider = (await factory())(), holds = [], bases = [], observed = [];
  for (let index = 0; index < 5; index++) {
    const hold = holdRaster(); holds.push(hold);
    bases.push(await setup(t, provider, {}, { beforeRaster: hold.hook }));
  }
  t.after(() => { for (const hold of holds) hold.gate.resolve(); });
  for (let index = 0; index < 4; index++) {
    const pending = bases[index].cache.acquire(wcRequest());
    observed.push(await enteredOrOutcome(holds[index], pending));
  }
  assert.equal(native.canvases.length, 4);
  const failure = await rejected(bases[4].cache.acquire(wcRequest()), 'TEXT_MEASURE_FAILED');
  errorIs('WEB_TEXT_PLAN_LIMIT')(failure.cause);
  assert.equal(native.canvases.length, 4); assert.equal(bases[4].state.inputs.length, 0);
  holds[0].gate.resolve(); const first = await fulfilled(observed[0]); release(first); await bases[0].cache.whenIdle();
  const fifth = bases[4].cache.acquire(wcRequest({ text: 'new-slot' }));
  const fifthHeld = await enteredOrOutcome(holds[4], fifth);
  assert.equal(native.canvases.length, 6, 'first raster plus newly admitted measure');
  for (let index = 1; index < 5; index++) holds[index].gate.resolve();
  for (const held of [...observed.slice(1), fifthHeld]) release(await fulfilled(held));
  for (const base of bases) await base.cache.whenIdle();
  for (const base of [bases[0], bases[1], bases[2], bases[3], bases[4]]) assert.equal(base.state.released.length, 1);
  retired(native);
});

test('WC05: exact issued plan identity, foreign plans and raster replay preserve the admitted use', async (t) => {
  const native = realm(t), provider = (await factory())(), hold = holdRaster();
  const base = await setup(t, provider, {}, { beforeRaster: hold.hook });
  t.after(() => hold.gate.resolve());
  const pending = base.cache.acquire(wcRequest()), held = await enteredOrOutcome(hold, pending);
  const plan = base.state.plans[0], context = base.state.rasterContexts[0], before = native.canvases.length;
  let reads = 0; const poison = new Proxy({}, { get() { reads++; throw new Error('foreign plan read'); } });
  await rejected(provider.rasterize({}, poison), 'WEB_TEXT_PLAN_INVALID');
  const foreignProvider = (await factory())();
  await rejected(foreignProvider.rasterize(plan, poison), 'WEB_TEXT_PLAN_INVALID');
  assert.throws(() => provider.release({ ...plan }), errorIs('WEB_TEXT_PLAN_INVALID'));
  assert.equal(reads, 0); assert.equal(native.canvases.length, before);
  hold.gate.resolve(); const result = await fulfilled(held); release(result); await base.cache.whenIdle();
  await rejected(provider.rasterize(plan, context), 'WEB_TEXT_PLAN_INVALID');
  assert.doesNotThrow(() => provider.release(plan));
  assert.equal(native.reads.length, 1); retired(native);
});

test('WC05/WC06: one quarantined and three active slots together refuse a fifth genuine Engine', async (t) => {
  const operation = { mixed: 'measure' }, cleanup = { mixed: 'width-reset' };
  const native = realm(t, {
    measure(text) { if (text === 'quarantine') throw operation; return { ...METRICS }; },
    dimension(canvas, key, value, owned) {
      if (key === 'width' && value === 0 && owned.measurements.some(call => call.canvas === canvas && call.text === 'quarantine')) throw cleanup;
    },
  });
  const provider = (await factory())(), dead = await setup(t, provider);
  const initial = await rejected(dead.cache.acquire(wcRequest({ text: 'quarantine' })), 'TEXT_MEASURE_FAILED');
  errorIs('WEB_TEXT_CLEANUP_FAILED', operation)(initial.cause);
  assert.deepEqual(initial.cause.cleanupErrors, [cleanup]); await dead.cache.whenIdle();
  const bases = [], holds = [], held = [];
  for (let index = 0; index < 4; index++) {
    const hold = holdRaster(); holds.push(hold);
    bases.push(await setup(t, provider, {}, { beforeRaster: hold.hook }));
  }
  t.after(() => { for (const hold of holds) hold.gate.resolve(); });
  for (let index = 0; index < 3; index++) held.push(await enteredOrOutcome(holds[index], bases[index].cache.acquire(wcRequest())));
  assert.equal(native.canvases.length, 4);
  const fifth = await rejected(bases[3].cache.acquire(wcRequest()), 'TEXT_MEASURE_FAILED');
  errorIs('WEB_TEXT_PLAN_LIMIT')(fifth.cause); assert.equal(native.canvases.length, 4);
  holds[0].gate.resolve(); release(await fulfilled(held[0])); await bases[0].cache.whenIdle();
  const restored = await enteredOrOutcome(holds[3], bases[3].cache.acquire(wcRequest({ text: 'restored' })));
  for (let index = 1; index < 4; index++) holds[index].gate.resolve();
  for (const value of [...held.slice(1), restored]) release(await fulfilled(value));
  for (const base of bases) await base.cache.whenIdle();
  assert.equal(native.canvases[0].height, 0);
  assert.equal(native.events.filter(event => event[0] === 'size' && event[1] === 0 && event[3] === 0).length, 2,
    'quarantined cleanup never retries');
  for (const canvas of native.canvases.slice(1)) { assert.equal(canvas.width, 0); assert.equal(canvas.height, 0); }
});

test('WC06: measure, fill and readback preserve the exact native cause and retire both dimensions', async (t) => {
  for (const site of ['measure', 'fill', 'read']) await t.test(site, async sub => {
    const cause = Object.freeze({ nativeSite: site });
    const native = realm(sub, { [site]: () => { throw cause; } });
    const provider = (await factory())(), base = await setup(sub, provider);
    await rejected(base.cache.acquire(wcRequest()), site === 'measure' ? 'TEXT_MEASURE_FAILED' : 'TEXT_RASTER_FAILED', cause);
    await base.cache.whenIdle(); retired(native);
    assert.equal(base.state.released.length, site === 'measure' ? 0 : 1);
    assert.equal(base.cache.getStatus().pendingRasterBytes, 0);
    assert.equal(base.cache.getStatus().reservedImageBytes, 0);
    assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  });
});

test('WC06: cleanup attempts width and height, keeps first cause and permanently quarantines four slots', async (t) => {
  const operation = { operation: 'measure' }, width = { reset: 'width' }, height = { reset: 'height' };
  const native = realm(t, { measure() { throw operation; }, dimension(canvas, key, value) {
    if (value === 0) throw key === 'width' ? width : height;
  } });
  const provider = (await factory())(), base = await setup(t, provider);
  for (let index = 0; index < 4; index++) {
    const failure = await rejected(base.cache.acquire(wcRequest({ text: String(index) })), 'TEXT_MEASURE_FAILED');
    errorIs('WEB_TEXT_CLEANUP_FAILED', operation)(failure.cause);
    assert.deepEqual(failure.cause.cleanupErrors, [width, height]);
    const canvas = native.canvases[index];
    assert.deepEqual(native.events.filter(event => event[0] === 'size' && event[1] === canvas.id && event[3] === 0)
      .map(event => event[2]), ['width', 'height']);
    assert.equal(base.state.plans.length, 0);
    await base.cache.whenIdle();
  }
  const last = await rejected(base.cache.acquire(wcRequest({ text: 'fifth' })), 'TEXT_MEASURE_FAILED');
  errorIs('WEB_TEXT_PLAN_LIMIT')(last.cause); assert.equal(native.canvases.length, 4);
});

test('WC06: issued-plan cleanup failure surfaces at release and T1 retains quarantine charges', async (t) => {
  const cleanup = { rasterReset: 'width' };
  const native = realm(t, { dimension(canvas, key, value, owned) {
    if (key === 'width' && value === 0 && owned.reads.some(read => read.canvas === canvas)) throw cleanup;
  } });
  const provider = (await factory())(), base = await setup(t, provider);
  const failure = await rejected(base.cache.acquire(wcRequest()), 'TEXT_PLAN_RELEASE_FAILED', cleanup);
  assert.deepEqual(failure.cleanupErrors, [], 'successful raster retains no operation failure; release alone prevents delivery');
  assert.equal(base.state.plans.length, 1); assert.equal(base.state.released.length, 1);
  await rejected(base.cache.whenIdle(), 'TEXT_CACHE_CLEANUP_FAILED', cleanup);
  const status = base.cache.getStatus();
  assert.equal(status.pendingJobs, 0); assert.equal(status.quarantinedGenerations, 1);
  assert.equal(status.cleanupFailureCount, 1); assert.equal(status.quarantinedImageBytes, 480);
  assert.equal(status.quarantinedRasterBytes, 960); assert.equal(status.activeCallerLeases, 0);
  const raster = native.reads[0].canvas;
  assert.equal(raster.height, 0, 'other dimension retires despite first reset failure');
  const resets = native.events.filter(event => event[0] === 'size' && event[1] === raster.id && event[3] === 0);
  assert.deepEqual(resets.map(event => event[2]), ['width', 'height']);
  assert.doesNotThrow(() => provider.release(base.state.plans[0]));
  assert.equal(native.events.filter(event => event[0] === 'size' && event[1] === raster.id && event[3] === 0).length, 2);
});

test('WC06: unsupported state and readback attributes refuse rather than degrade', async (t) => {
  await t.test('unsupported physical alignment', async sub => {
    const native = realm(sub, { denyState: 'textAlign' }), base = await setup(sub, (await factory())());
    const failure = await rejected(base.cache.acquire(wcRequest()), 'TEXT_MEASURE_FAILED');
    errorIs('WEB_TEXT_STATE_UNSUPPORTED')(failure.cause);
    assert.equal(native.measurements.length, 0); assert.equal(native.reads.length, 0); retired(native);
  });
  await t.test('effective non-sRGB readback', async sub => {
    const native = realm(sub, { attributes: context => ({ alpha: true,
      colorSpace: context.canvas.width === 1 ? 'srgb' : 'display-p3', willReadFrequently: true }) });
    const base = await setup(sub, (await factory())());
    const failure = await rejected(base.cache.acquire(wcRequest()), 'TEXT_RASTER_FAILED');
    errorIs('WEB_TEXT_STATE_UNSUPPORTED')(failure.cause);
    assert.equal(native.reads.length, 0); await base.cache.whenIdle(); retired(native);
  });
});

test('WC07: readiness checks refuse before Canvas in either phase and never load or observe fonts', async (t) => {
  for (const failAt of [1, 2]) await t.test(`check-${failAt}`, async sub => {
    let count = 0;
    const native = realm(sub, { check: () => ++count !== failAt }), base = await setup(sub, (await factory())());
    const failure = await rejected(base.cache.acquire(wcRequest()), failAt === 1 ? 'TEXT_MEASURE_FAILED' : 'TEXT_RASTER_FAILED');
    errorIs('WEB_TEXT_FONT_NOT_READY')(failure.cause);
    assert.equal(native.canvases.length, failAt === 1 ? 0 : 1);
    assert.equal(native.reads.length, 0); await base.cache.whenIdle(); retired(native);
  });
  await t.test('native check throws exact cause', async sub => {
    const cause = { fontCheck: true }, native = realm(sub, { check() { throw cause; } });
    const base = await setup(sub, (await factory())());
    await rejected(base.cache.acquire(wcRequest()), 'TEXT_MEASURE_FAILED', cause);
    assert.equal(native.canvases.length, 0); await base.cache.whenIdle();
  });
});

test('WC07/WC08: explicit cache invalidation leaves committed content until a genuine replacement', async (t) => {
  let advance = 8;
  const native = realm(t, { measure: () => ({ ...METRICS, width: advance }) });
  const base = await setup(t, (await factory())());
  base.engine.stage.addChild(base.field); base.field.setRequest(wcRequest()); await base.field.prepare();
  const old = base.engine.captureFrame({ width: 80, height: 80 }), generation = base.cache.getStatus().fontGeneration;
  advance = 12;
  assert.equal(base.field.getStatus().metrics.logicalBounds.width, 8, 'no hidden font observer');
  base.cache.invalidate(); assert.equal(base.cache.getStatus().fontGeneration, generation + 1);
  assert.equal(base.engine.captureFrame({ width: 80, height: 80 }).images[0], old.images[0]);
  const metrics = await base.field.prepare(); assert.equal(metrics.logicalBounds.width, 12);
  assert.notEqual(base.engine.captureFrame({ width: 80, height: 80 }).images[0], old.images[0]);
  assert.equal(base.state.requests[1].fontGeneration, generation + 1);
  base.scope.dispose(); await base.cache.whenIdle(); retired(native);
});

test('WC08/WC09 CPU: shared fields commit separate leases, failure keeps old image, blank removes it', async (t) => {
  let fail = false, blank = false; const cause = { fill: 'replacement' };
  const native = realm(t, { measure: () => blank ? { ...ZERO } : { ...METRICS },
    fill() { if (fail) throw cause; } });
  const base = await setup(t, (await factory())()), scope2 = base.engine.createScope();
  const field2 = base.text.createTextField(base.engine, scope2, base.cache);
  base.engine.stage.addChild(base.field); base.engine.stage.addChild(field2);
  base.field.setRequest(wcRequest()); field2.setRequest(wcRequest());
  const one = base.field.prepare(), two = field2.prepare(); await Promise.all([one, two]);
  await base.cache.whenIdle(); assert.equal(base.state.plans.length, 1);
  assert.equal(base.cache.getStatus().activeCallerLeases, 2);
  const old = base.engine.captureFrame({ width: 80, height: 80 });
  assert.equal(old.commands.length, 2); assert.equal(old.images.length, 1);
  scope2.dispose(); assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  assert.equal(base.engine.captureFrame({ width: 80, height: 80 }).commands.length, 1);
  fail = true; base.field.setRequest(wcRequest({ text: 'failed' }));
  await rejected(base.field.prepare(), 'TEXT_RASTER_FAILED', cause); await base.cache.whenIdle();
  assert.equal(base.engine.captureFrame({ width: 80, height: 80 }).images[0], old.images[0]);
  fail = false; blank = true; base.field.setRequest(wcRequest({ text: '' })); await base.field.prepare();
  assert.equal(base.engine.captureFrame({ width: 80, height: 80 }).commands.length, 0);
  assert.equal(base.field.getStatus().metrics.logicalBounds.height, 10);
  assert.deepEqual(base.field.getBounds(), { x: 0, y: 0, width: 0, height: 0 });
  assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  assert.equal(publicEngine.copyImageData2DPixels(old.images[0]).length, 480);
  base.scope.dispose(); await base.cache.whenIdle(); retired(native);
});

test('WC09 CPU: real TF1 frames retain painter order, density placement, clips and shared Bitmap image', async (t) => {
  const native = realm(t), base = await setup(t, (await factory())());
  base.field.setRequest(wcRequest({ density: 1.5 })); await base.field.prepare();
  assert.deepEqual(base.field.getBounds(), CONTENT);
  const before = new publicEngine.Sprite(); before.graphics.beginFill(0x112233).drawRect(0, 0, 1, 1);
  const parent = new publicEngine.Sprite(); parent.x = 10; parent.y = 20;
  parent.scaleX = 2; parent.scaleY = 3; parent.alpha = 0.5;
  parent.clipRect = { x: -5, y: -5, width: 30, height: 40 };
  base.field.x = 3; base.field.y = 4; base.field.scaleX = -1; base.field.scaleY = 2; base.field.alpha = 0.5;
  base.field.clipRect = { x: -2, y: 0, width: 8, height: 22 };
  parent.addChild(base.field); base.engine.stage.addChild(before); base.engine.stage.addChild(parent);
  const lease = await base.cache.acquire(wcRequest({ density: 1.5 })), bitmapScope = base.engine.createScope();
  assert.equal(lease.kind, 'image'); bitmapScope.use(lease.lease);
  const bitmap = bitmapScope.use(new publicEngine.Bitmap(lease.lease)); bitmap.x = 40;
  base.engine.stage.addChild(bitmap);
  const image = lease.lease.value.imageData;
  let saved;
  for (const textured of [false, true]) {
    const frame = textured ? base.engine.captureTexturedFrame({ width: 80, height: 80 })
      : base.engine.captureFrame({ width: 80, height: 80 });
    saved ??= frame;
    assert.deepEqual(frame.commands.map(command => command.kind), ['rect', 'image', 'image']);
    assert.equal(frame.images.length, 1); assert.equal(frame.images[0], image);
    assert.deepEqual(frame.commands[1].rect, { x: -8 / 3, y: 44 / 3, width: 34 / 3, height: 26 / 3 });
    assert.deepEqual(frame.commands[1].sourceRect, { x: 0, y: 0, width: 17, height: 13 });
    assert.deepEqual(frame.commands[1].matrix, { a: -2, b: -0, c: 0, d: 6, tx: 16, ty: 32 });
    assert.equal(frame.commands[1].alpha, 0.25); assert.equal(frame.commands[1].imageIndex, 0);
    assert.deepEqual(frame.commands[1].clips, [
      { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 10, ty: 20 }, rect: { x: -5, y: -5, width: 30, height: 40 } },
      { matrix: { a: -2, b: -0, c: 0, d: 6, tx: 16, ty: 32 }, rect: { x: -2, y: 0, width: 8, height: 22 } },
    ]);
  }
  bitmapScope.dispose(); base.scope.dispose(); parent.dispose(); before.dispose(); await base.cache.whenIdle();
  assert.equal(publicEngine.copyImageData2DPixels(saved.images[0]).length, 884);
  retired(native);
});

test('WC08: held supersession and Scope closing never publish late work or release another demand', async (t) => {
  const native = realm(t), provider = (await factory())(), hold = holdRaster();
  const base = await setup(t, provider, {}, { beforeRaster: hold.hook });
  t.after(() => hold.gate.resolve());
  base.field.setRequest(wcRequest());
  const stale = base.field.prepare(), held = await enteredOrOutcome(hold, stale);
  base.field.setRequest(wcRequest({ text: 'B' }));
  await rejectedKept(held, 'TEXT_FIELD_SUPERSEDED');
  const replacement = keep(base.field.prepare());
  const otherScope = base.engine.createScope(), other = base.text.createTextField(base.engine, otherScope, base.cache);
  other.setRequest(wcRequest({ text: 'B' })); const otherResult = keep(other.prepare());
  let closingRefusal;
  base.scope.signal.addEventListener('abort', () => { closingRefusal = keep(base.field.prepare()); });
  base.scope.dispose(); await rejectedKept(closingRefusal, 'SCOPE_CLOSED');
  const retiredDemand = await replacement.observed;
  assert.ok(retiredDemand.error instanceof publicEngine.EgretError,
    'already pending terminal demand rejects; live closing-call priority is checked separately');
  hold.gate.resolve(); await fulfilled(otherResult); await base.cache.whenIdle();
  assert.equal(base.field.isDisposed, true); assert.equal(other.getStatus().state, 'ready');
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  otherScope.dispose(); assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  retired(native);
});

test('WC05/WC06: cancellation during native measurement preserves exact reason and frees admission', async (t) => {
  const cancellation = signal(), reason = { duringMeasure: true };
  const native = realm(t, { measure(text, call) {
    cancellation.abort(reason); return { ...METRICS };
  } });
  const provider = (await factory())(), base = await setup(t, provider);
  await rejected(base.cache.acquire(wcRequest(), { signal: cancellation.value }), 'TEXT_ACQUIRE_CANCELLED', reason);
  await base.cache.whenIdle(); assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  assert.equal(native.reads.length, 0); retired(native);
});

test('WC06/WC08: native phase cancellation retains WEB_TEXT_CANCELLED through the real provider boundary', async (t) => {
  const cause = { nativeMeasureCancellation: true }, cancellation = signal();
  const native = realm(t, { measure() { cancellation.abort(cause); return { ...METRICS }; } });
  const provider = (await factory())(); let providerFailure;
  // Decorate the published callback before the genuine cache captures it.
  const base = await setup(t, provider, {}, { decorate(wrapper) {
    wrapper.measure = async function(value, context) {
      try { return await provider.measure(value, { ...context, signal: cancellation.value }); }
      catch (error) { providerFailure = error; throw error; }
    };
  } });
  await rejected(base.cache.acquire(wcRequest()), 'TEXT_MEASURE_FAILED');
  errorIs('WEB_TEXT_CANCELLED', cause)(providerFailure);
  await base.cache.whenIdle(); assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  assert.equal(native.reads.length, 0); retired(native);
});

test('WC06/WC08: native raster cancellation preserves reason before delivering a copied image', async (t) => {
  const cause = { nativeFillCancellation: true }, cancellation = signal();
  const native = realm(t, { fill() { cancellation.abort(cause); } });
  const provider = (await factory())(); let providerFailure;
  const base = await setup(t, provider, {}, { decorate(wrapper) {
    wrapper.rasterize = async function(plan, context) {
      try { return await provider.rasterize(plan, { ...context, signal: cancellation.value }); }
      catch (error) { providerFailure = error; throw error; }
    };
  } });
  await rejected(base.cache.acquire(wcRequest()), 'TEXT_RASTER_FAILED');
  errorIs('WEB_TEXT_CANCELLED', cause)(providerFailure);
  await base.cache.whenIdle(); assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  assert.equal(base.state.released.length, 1); retired(native);
});

test('WC06 supplement: issued raster primary survives two cleanup failures and separate release quarantine', async (t) => {
  const operation = Object.freeze({ issuedRasterOperation: true });
  const width = Object.freeze({ issuedRasterCleanup: 'width' });
  const height = Object.freeze({ issuedRasterCleanup: 'height' });
  const native = realm(t, {
    fill() { throw operation; },
    dimension(canvas, key, value, owned) {
      if (value === 0 && owned.fills.some(call => call.canvas === canvas)) throw key === 'width' ? width : height;
    },
  });
  const provider = (await factory())(); let releaseCalls = 0, releaseFailure;
  const base = await setup(t, provider, {}, { decorate(wrapper) {
    const originalRelease = wrapper.release;
    wrapper.release = function(plan) {
      releaseCalls++;
      try { return Reflect.apply(originalRelease, wrapper, [plan]); }
      catch (error) { releaseFailure = error; throw error; }
    };
  } });
  const failure = await rejected(base.cache.acquire(wcRequest()), 'TEXT_RASTER_FAILED', operation);
  assert.deepEqual(failure.cleanupErrors, [width], 'T1 reports the separately thrown release cause without replacing the primary');
  assert.equal(releaseFailure, width); assert.equal(releaseCalls, 1);
  assert.equal(base.state.plans.length, 1); assert.equal(base.state.released[0], base.state.plans[0]);
  const raster = native.fills[0].canvas;
  const retirement = () => native.events.filter(event => event[0] === 'size' && event[1] === raster.id && event[3] === 0);
  assert.deepEqual(retirement().map(event => event[2]), ['width', 'height']);
  assert.equal(native.reads.length, 0, 'fill is the primary failure, before readback');
  await rejected(base.cache.whenIdle(), 'TEXT_CACHE_CLEANUP_FAILED', width);
  const status = base.cache.getStatus();
  assert.equal(status.pendingJobs, 0); assert.equal(status.quarantinedGenerations, 1);
  assert.equal(status.retiredGenerations, 1); assert.equal(status.cleanupFailureCount, 1);
  assert.equal(status.quarantinedImageBytes, 480); assert.equal(status.quarantinedRasterBytes, 960);
  assert.equal(status.liveImageBytes + status.reservedImageBytes, 480);
  assert.equal(status.pendingRasterBytes, 960); assert.equal(status.activeCallerLeases, 0);
  base.cache.dispose();
  assert.equal(base.cache.getStatus().quarantinedGenerations, 1);
  assert.doesNotThrow(() => provider.release(base.state.plans[0]));
  assert.equal(releaseCalls, 1); assert.equal(base.state.released.length, 1);
  assert.deepEqual(retirement().map(event => event[2]), ['width', 'height'], 'cleanup is never retried after retirement');
});

test('WC05/WC06 supplement: four cancelled measures refund the same provider before a fifth real success', async (t) => {
  const cancellations = new Map(), reasons = new Map();
  const native = realm(t, { measure(text) {
    const cancellation = cancellations.get(text);
    if (cancellation) cancellation.abort(reasons.get(text));
    return { ...METRICS };
  } });
  const provider = (await factory())(), base = await setup(t, provider);
  const emptyCharges = () => {
    const status = base.cache.getStatus();
    for (const key of ['pendingJobs', 'pendingWaiters', 'activeCallerLeases', 'residentEntries',
      'residentBytes', 'liveImageBytes', 'reservedImageBytes', 'pendingRasterBytes',
      'quarantinedImageBytes', 'quarantinedRasterBytes', 'cleanupFailureCount']) assert.equal(status[key], 0, key);
  };
  for (let index = 0; index < 4; index++) {
    const text = `cancel-${index}`, cancellation = new AbortController(), reason = Object.freeze({ cancelledMeasure: index });
    cancellations.set(text, cancellation); reasons.set(text, reason);
    await rejected(base.cache.acquire(wcRequest({ text }), { signal: cancellation.signal }), 'TEXT_ACQUIRE_CANCELLED', reason);
    await base.cache.whenIdle();
    assert.deepEqual(native.measurements.map(call => call.text), ['cancel-0', 'cancel-1', 'cancel-2', 'cancel-3'].slice(0, index + 1));
    assert.equal(native.reads.length, 0); emptyCharges(); retired(native);
  }
  const result = await base.cache.acquire(wcRequest({ text: 'noncancelled-fifth' }));
  assert.equal(result.kind, 'image');
  assert.deepEqual(native.measurements.map(call => call.text), ['cancel-0', 'cancel-1', 'cancel-2', 'cancel-3', 'noncancelled-fifth']);
  assert.equal(native.reads.length, 1); assert.equal(native.canvases.length, 6);
  assert.equal(result.lease.value.imageData.width, 12); assert.equal(result.lease.value.imageData.height, 10);
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  release(result); await base.cache.whenIdle(); emptyCharges(); retired(native);
});

test('WC06 supplement: successful issued measurement cleanup still fails its phase and never starts raster', async (t) => {
  const width = Object.freeze({ issuedMeasureCleanup: 'width' });
  const height = Object.freeze({ issuedMeasureCleanup: 'height' });
  const native = realm(t, { dimension(canvas, key, value, owned) {
    if (value === 0 && owned.measurements.some(call => call.canvas === canvas)) throw key === 'width' ? width : height;
  } });
  const provider = (await factory())(), base = await setup(t, provider);
  const failure = await rejected(base.cache.acquire(wcRequest()), 'TEXT_MEASURE_FAILED', width);
  assert.deepEqual(failure.cleanupErrors, [width], 'issued release cleanup remains associated with the failed measurement');
  assert.equal(base.state.plans.length, 1); assert.equal(base.state.returnedPlans.length, 0);
  assert.equal(base.state.released.length, 1); assert.equal(base.state.released[0], base.state.plans[0]);
  assert.equal(native.canvases.length, 1); assert.equal(native.measurements.length, 1);
  assert.equal(native.fills.length, 0); assert.equal(native.reads.length, 0);
  const measured = native.measurements[0].canvas;
  const retirement = () => native.events.filter(event => event[0] === 'size' && event[1] === measured.id && event[3] === 0);
  assert.deepEqual(retirement().map(event => event[2]), ['width', 'height']);
  await rejected(base.cache.whenIdle(), 'TEXT_CACHE_CLEANUP_FAILED', width);
  const status = base.cache.getStatus();
  assert.equal(status.pendingJobs, 0); assert.equal(status.quarantinedGenerations, 1);
  assert.equal(status.cleanupFailureCount, 1); assert.equal(status.activeCallerLeases, 0);
  assert.equal(status.quarantinedImageBytes, 0); assert.equal(status.quarantinedRasterBytes, 0);
  assert.equal(status.reservedImageBytes, 0); assert.equal(status.pendingRasterBytes, 0);
  assert.doesNotThrow(() => provider.release(base.state.plans[0]));
  assert.equal(base.state.released.length, 1);
  assert.deepEqual(retirement().map(event => event[2]), ['width', 'height'], 'no reset retry after quarantined retirement');
});

test('WC06 supplement: thrown undefined is a raster operation failure despite two cleanup faults', async (t) => {
  const width = Object.freeze({ undefinedRasterCleanup: 'width' });
  const height = Object.freeze({ undefinedRasterCleanup: 'height' });
  const native = realm(t, { fill() { throw undefined; }, dimension(canvas, key, value, owned) {
    if (value === 0 && owned.fills.some(call => call.canvas === canvas)) throw key === 'width' ? width : height;
  } });
  const provider = (await factory())(); let releaseCalls = 0, releaseFailure;
  const base = await setup(t, provider, {}, { decorate(wrapper) {
    const originalRelease = wrapper.release;
    wrapper.release = function(plan) {
      releaseCalls++;
      try { return Reflect.apply(originalRelease, wrapper, [plan]); }
      catch (error) { releaseFailure = error; throw error; }
    };
  } });
  const failure = await rejected(base.cache.acquire(wcRequest()), 'TEXT_RASTER_FAILED', undefined);
  assert.deepEqual(failure.cleanupErrors, [width]); assert.equal(releaseFailure, width); assert.equal(releaseCalls, 1);
  assert.equal(base.state.plans.length, 1); assert.equal(base.state.released[0], base.state.plans[0]);
  assert.equal(base.state.images.length, 0); assert.equal(native.reads.length, 0);
  const raster = native.fills[0].canvas;
  const retirement = () => native.events.filter(event => event[0] === 'size' && event[1] === raster.id && event[3] === 0);
  assert.deepEqual(retirement().map(event => event[2]), ['width', 'height']);
  await rejected(base.cache.whenIdle(), 'TEXT_CACHE_CLEANUP_FAILED', width);
  const status = base.cache.getStatus();
  assert.equal(status.pendingJobs, 0); assert.equal(status.quarantinedGenerations, 1);
  assert.equal(status.cleanupFailureCount, 1); assert.equal(status.activeCallerLeases, 0);
  assert.equal(status.quarantinedImageBytes, 480); assert.equal(status.quarantinedRasterBytes, 960);
  assert.equal(status.liveImageBytes + status.reservedImageBytes, 480); assert.equal(status.pendingRasterBytes, 960);
  assert.doesNotThrow(() => provider.release(base.state.plans[0]));
  assert.equal(releaseCalls, 1); assert.equal(base.state.released.length, 1);
  assert.deepEqual(retirement().map(event => event[2]), ['width', 'height'], 'undefined does not enable public success or cleanup retry');
});
