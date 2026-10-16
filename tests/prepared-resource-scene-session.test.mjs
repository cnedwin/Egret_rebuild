// SPDX-License-Identifier: Apache-2.0
// Original P03 composition witnesses. CPU literals do not prove PNG/font/native pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { setImmediate as nextTurn } from 'node:timers/promises';
import * as sdk from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { deferred, flush, host } from './helpers.mjs';
import { literalProvider, request } from './text-raster-public-helpers.mjs';

const MODULE = new URL('../examples/prepared-resource-groups/session.mjs', import.meta.url);
const ASSETS = new URL('../examples/resource-scene/assets/', import.meta.url);
const BADGE = new URL('../tools/browser-png/assets/rgb-red-green.png', import.meta.url).href;
const LEFT = 'pilot-left', RIGHT = 'pilot-right';
const FRAME = Object.freeze({ width: 192, height: 128, clearColor: 0, clearAlpha: 1 });
const ZERO = Object.freeze({ x: 0, y: 0, width: 16, height: 16 });
const ONE = Object.freeze({ x: 16, y: 0, width: 16, height: 16 });
const PINS = Object.freeze({
  A: { bytes: 83, sha256: '376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960', width: 16, height: 16, rgba: [255,0,0,255] },
  B: { bytes: 80, sha256: 'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78', width: 16, height: 16, rgba: [0,255,0,255] },
  C: { bytes: 81, sha256: 'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66', width: 16, height: 16, rgba: [0,0,255,255] },
  D: { bytes: 83, sha256: 'd2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98', width: 16, height: 16, rgba: [255,255,0,255] },
  'atlas-v1': { bytes: 130, sha256: '54f5a801227112caf56f4d3bef92d1018d19dddd85ca13b08099300a62532fdd', width: 32, height: 16, revision: 'p02-atlas-v1-r1', rgba: [17,83,149,255] },
  badge: { bytes: 72, sha256: '917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d', width: 2, height: 1, revision: 'p02-badge-r1', rgba: [17,83,149,255] },
});
const URLS = Object.freeze(Object.fromEntries(Object.keys(PINS).map(key => [key,
  key === 'badge' ? BADGE : new URL((key.length === 1 ? 'outfit-' + key : key) + '.png', ASSETS).href])));
const FONTS = Object.freeze({
  ahem: Object.freeze({ bytes: 22572, sha256: 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc', revision: 'ahem-fixed-r1' }),
  cjk: Object.freeze({ bytes: 1796, sha256: '9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895', revision: 'noto-sc-v41-fixed-r1' }),
});
const scenario = (name, run) => test(name, { timeout: 10000 }, run);
function handled(promise) { assert.ok(promise instanceof Promise); void promise.catch(() => undefined); return promise; }
function watch(promise) {
  handled(promise);
  const row = { state: 'pending', value: undefined, error: undefined };
  row.done = promise.then(value => { row.state = 'fulfilled'; row.value = value; }, error => { row.state = 'rejected'; row.error = error; });
  return row;
}
async function drain() { await flush(); await nextTurn(); await flush(); }
async function rejected(row, wanted) {
  await drain(); assert.equal(row.state, 'rejected', 'Logical result must not wait for an original source job');
  assert.equal(row.error?.code, wanted); return row.error;
}
function throwsCode(run, expected) { assert.throws(run, value => value?.code === expected); }
function originalLoadFailure(error, expected) {
  assert.equal(error?.code, 'ASSET_GROUP_ACQUIRE_FAILED'); assert.equal(Object.hasOwn(error, 'cause'), true);
  const load = error.cause;
  assert.equal(load?.code, 'ASSET_LOAD_FAILED'); assert.equal(Object.hasOwn(load, 'cause'), true);
  assert.equal(load.cause, expected, 'The original provider rejection is the direct load cause');
}
async function cleanupAttempt(observations, operation, run) {
  try { await run(); }
  catch (cause) { observations.push({ operation, cause }); }
}
function finish(primary, secondary, t, label) {
  if (primary.occurred) {
    if (secondary.length > 0) {
      // Diagnostic reporting never replaces the original primary occurrence.
      try { t.diagnostic(label + ' secondary cleanup: ' + JSON.stringify(secondary.map(row => ({
        operation: row.operation, wasUndefined: row.cause === undefined,
        code: row.cause?.code ?? null, message: String(row.cause?.message ?? row.cause),
      })))); } catch { /* The original primary is still thrown unchanged. */ }
    }
    throw primary.cause;
  }
  if (secondary.length === 1) throw secondary[0].cause;
  if (secondary.length > 1) throw new AggregateError(secondary.map(row => row.cause),
    label + ': ' + secondary.map(row => row.operation).join(', '), { cause: secondary[0].cause });
}
function literalTexture(key, dimensions = PINS[key]) {
  const pixels = new Uint8Array(dimensions.width * dimensions.height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(PINS[key].rgba, offset);
  return sdk.createTexture(sdk.createImageData2D({ width: dimensions.width, height: dimensions.height, pixels }));
}
function bank(keys, outfit) {
  const selected = new Map(keys.map(key => [URLS[key], key]));
  const evidence = new WeakMap(), active = new Set(), held = new Set(), jobs = [], disposals = [];
  const overrides = new Map();
  const provider = {
    load(ref, context) {
      const key = selected.get(ref.id); if (key === undefined) throw new Error('Unselected controlled CPU URL');
      const gate = deferred();
      const job = { key, ref, context, original: gate.promise, settled: false, value: undefined,
        resolve() {
          if (job.settled) throw new Error('Original CPU task settled twice');
          job.settled = true;
          const override = overrides.get(key) ?? {}, pin = PINS[key];
          job.value = literalTexture(key, override.dimensions ?? pin);
          evidence.set(job.value, Object.freeze(outfit
            ? { assetId: key, bytes: pin.bytes, sha256: pin.sha256, width: 16, height: 16, contentRevision: 'p02-outfits-r1', layoutRevision: 'two-layer-r1', ...override.evidence }
            : { key, bytes: pin.bytes, sha256: pin.sha256, width: pin.width, height: pin.height, revision: pin.revision, ...override.evidence }));
          gate.resolve(job.value); return job.value;
        },
        reject(cause) { if (job.settled) throw new Error('Original CPU task settled twice'); job.settled = true; gate.reject(cause); },
      };
      // Install original occupancy before any fixture delivery. Abort never settles it.
      jobs.push(job); active.add(gate.promise);
      void gate.promise.then(() => active.delete(gate.promise), () => active.delete(gate.promise));
      if (!held.has(key)) job.resolve();
      return gate.promise;
    },
    dispose(value) { disposals.push(value); value.dispose(); },
  };
  return { provider, evidence, active, jobs, disposals, overrides,
    hold(key) { held.add(key); },
    latest(key) { const found = jobs.filter(row => row.key === key).at(-1); assert.ok(found, 'Expected original ' + key + ' job'); return found; },
    settleAll() { for (const row of jobs) if (!row.settled) row.resolve(); },
    disposed(value) { return disposals.filter(item => item === value).length; },
  };
}

async function genuineBaseline(t) {
  const port = host();
  const literals = bank(['A','B','atlas-v1'], false), text = literalProvider();
  const primary = { occurred: false, cause: undefined }, secondary = [];
  let engine, cache, body, playback, firstMembers, secondMembers;
  try {
    engine = await sdk.createEngine({ host: port.adapter });
    const type = sdk.createAssetType('p03.scene.genuine.prerequisite', sdk.isTexture);
    engine.assets.register(type, literals.provider);
    const scope = engine.createScope(), secondScope = engine.createScope();
    cache = createTextRasterCache(engine.assets, { provider: text.provider });
    const refs = ['A','B'].map(key => sdk.createAssetRef(type, URLS[key]));
    firstMembers = await engine.createAssetGroup(scope, refs).ready;
    secondMembers = await engine.createAssetGroup(secondScope, refs).ready;
    assert.notEqual(firstMembers[0], secondMembers[0]); assert.equal(firstMembers[0].value, secondMembers[0].value);
    const targets = firstMembers.map(member => scope.use(new sdk.Bitmap(member)));
    for (const target of targets) engine.stage.addChild(target);
    const ticket = engine.captureBitmapBindings(scope, targets); ticket.prepare(firstMembers); ticket.commit();
    assert.equal(targets[0].textureLease, firstMembers[0]); assert.equal(targets[1].textureLease, firstMembers[1]);
    const atlas = scope.use(await engine.assets.acquire(sdk.createAssetRef(type, URLS['atlas-v1'])));
    const sheet = scope.use(sdk.createSpriteSheet(atlas, [{ name: 'zero', ...ZERO }, { name: 'one', ...ONE }]));
    body = scope.use(sheet.createBitmap('zero')); engine.stage.addChild(body);
    const clip = sdk.createSequenceClip({ atlasWidth: 32, atlasHeight: 16,
      frames: [{ ...ZERO, durationSeconds: 0.125 }, { ...ONE, durationSeconds: 0.125 }] });
    engine.advanceTime(0); playback = engine.createSequencePlayback(scope, body, clip, { mode: 'loop' }); playback.start();
    engine.advanceTime(0.125); assert.deepEqual(body.sourceRect, ONE); assert.equal(playback.lastSample.frameIndex, 1);
    const field = createTextField(engine, scope, cache); field.setRequest(request()); await field.prepare(); engine.stage.addChild(field);
    const frame = engine.captureFrame(FRAME);
    assert.equal(frame.width, 192); assert.equal(frame.height, 128);
    assert.ok(frame.commands.some(row => row.kind === 'image')); assert.ok(frame.images.includes(atlas.value.imageData));
    assert.equal(text.state.measure, 1);
    secondScope.dispose(); assert.equal(firstMembers[0].value.isDisposed, false);
  } catch (cause) { primary.occurred = true; primary.cause = cause; }
  await cleanupAttempt(secondary, 'baseline cache.dispose', () => cache?.dispose());
  await cleanupAttempt(secondary, 'baseline engine.dispose', () => engine?.dispose());
  await cleanupAttempt(secondary, 'baseline cache.whenIdle', () => cache?.whenIdle());
  await cleanupAttempt(secondary, 'baseline original-source drain', async () => { await Promise.allSettled([...literals.active]); });
  if (body !== undefined) await cleanupAttempt(secondary, 'baseline body retired', () => assert.equal(body.isDisposed, true));
  if (playback !== undefined) await cleanupAttempt(secondary, 'baseline playback retired', () => assert.equal(playback.isDisposed, true));
  if (firstMembers !== undefined) await cleanupAttempt(secondary, 'baseline first lease revoked', () => throwsCode(() => firstMembers[0].value, 'ASSET_LEASE_RELEASED'));
  if (secondMembers !== undefined) await cleanupAttempt(secondary, 'baseline second lease revoked', () => throwsCode(() => secondMembers[0].value, 'ASSET_LEASE_RELEASED'));
  for (const row of literals.jobs) if (row.value !== undefined) {
    await cleanupAttempt(secondary, 'baseline Texture retired ' + row.key, () => assert.equal(row.value.isDisposed, true));
    await cleanupAttempt(secondary, 'baseline one disposer ' + row.key, () => assert.equal(literals.disposed(row.value), 1));
  }
  await cleanupAttempt(secondary, 'baseline text plans released', () => assert.equal(text.state.release, text.state.plans.length));
  if (engine !== undefined) await cleanupAttempt(secondary, 'baseline host closed', () => assert.deepEqual(port.trace, ['start','stop','close']));
  await cleanupAttempt(secondary, 'baseline timers retired', () => assert.equal(port.timers.size, 0));
  finish(primary, secondary, t, 'genuine baseline');
  console.log('P03_SCENE_GENUINE_ENGINE_GROUP_BITMAP_SEQUENCE_TEXT_BASELINE_AND_TEARDOWN_COMPLETE');
}
scenario('P03_SCENE_BASELINE genuine Engine Group Bitmap binding Sequence Text and teardown', async t => { await genuineBaseline(t); });
async function factory(t) {
  await genuineBaseline(t);
  assert.ok(existsSync(MODULE), 'P03_MISSING_PREPARED_SCENE_SESSION');
  const module = await import(MODULE.href);
  assert.equal(typeof module.createPreparedResourceSceneSession, 'function', 'P03_MISSING_PREPARED_SCENE_SESSION_FACTORY');
  return module.createPreparedResourceSceneSession;
}
async function starting(t, options = {}) {
  const create = await factory(t), outfits = bank(['A','B','C','D'], true), deps = bank(['atlas-v1','badge'], false);
  if (options.dependencyOverride) deps.overrides.set('atlas-v1', options.dependencyOverride);
  const text = literalProvider(), port = host();
  const source = Object.freeze({ provider: outfits.provider, assetEvidence: outfits.evidence,
    sourceLedger: Object.freeze({ active: outfits.active }) });
  const dependencies = Object.freeze({ revision: 'p03-scene-deps-r1', textureProvider: deps.provider, textureEvidence: deps.evidence,
    textProvider: text.provider, fontFamilies: Object.freeze({ ahem: 'P03 CPU Ahem substitute', cjk: 'P03 CPU CJK substitute' }), fontEvidence: FONTS });
  const session = create({ host: port.adapter, profile: 'canvas-2d', outfitSource: source, dependencies,
    ...(options.limits === undefined ? {} : { coordinatorLimits: options.limits }) });
  let ready;
  // Register immediately after creation: even a malformed facade/ready owns teardown.
  t.after(async () => {
    const observations = []; let close;
    await cleanupAttempt(observations, 'begin session.close', () => { close = watch(session.close()); });
    for (const store of [outfits,deps]) for (const row of store.jobs) if (!row.settled) {
      await cleanupAttempt(observations, 'settle original ' + row.key, () => row.resolve());
    }
    if (close !== undefined) await cleanupAttempt(observations, 'await session.close', async () => {
      await close.done; if (close.state === 'rejected') throw close.error;
    });
    await cleanupAttempt(observations, 'observe original ready', async () => { ready ??= watch(session.ready); await ready.done; });
    await cleanupAttempt(observations, 'drain reactions', drain);
    await cleanupAttempt(observations, 'session terminal state', () => assert.equal(session.inspect().state, 'closed'));
    await cleanupAttempt(observations, 'outfit source empty', () => assert.equal(outfits.active.size, 0));
    await cleanupAttempt(observations, 'dependency source empty', () => assert.equal(deps.active.size, 0));
    for (const store of [outfits,deps]) for (const row of store.jobs) if (row.value !== undefined) {
      await cleanupAttempt(observations, 'Texture retired ' + row.key, () => assert.equal(row.value.isDisposed, true));
      await cleanupAttempt(observations, 'one disposer ' + row.key, () => assert.equal(store.disposed(row.value), 1));
    }
    await cleanupAttempt(observations, 'text plans released', () => assert.equal(text.state.release, text.state.plans.length));
    await cleanupAttempt(observations, 'text plans released once', () => assert.equal(new Set(text.state.released).size, text.state.released.length));
    await cleanupAttempt(observations, 'timers retired', () => assert.equal(port.timers.size, 0));
    // Node retains a test-body failure separately from this after-hook failure.
    finish({ occurred: false, cause: undefined }, observations, t, 'session teardown');
  });
  ready = watch(session.ready);
  assert.ok(Object.isFrozen(session)); assert.ok(Object.isFrozen(session.scene));
  const f = { session, outfits, deps, text, port, ready,
    actor(id = LEFT) { const actor = session.scene.actors[id]; assert.ok(actor, 'Current actor ' + id); return actor; },
    snapshot(id = LEFT) { return session.inspect().actors[id]; },
  };
  return f;
}
async function fixture(t, options) { const f = await starting(t, options); await f.session.ready; return f; }
function bindings(actor) {
  return { root: actor.root, body: actor.body, outer: actor.outer, trim: actor.trim,
    outerLease: actor.outer.textureLease, trimLease: actor.trim.textureLease,
    outerCrop: actor.outer.sourceRect, trimCrop: actor.trim.sourceRect, playback: actor.playback };
}
function unchanged(actor, old) {
  for (const key of ['root','body','outer','trim','playback']) assert.equal(actor[key], old[key]);
  assert.equal(actor.outer.textureLease, old.outerLease); assert.equal(actor.trim.textureLease, old.trimLease);
  assert.equal(actor.outer.sourceRect, old.outerCrop); assert.equal(actor.trim.sourceRect, old.trimCrop);
}
function colors(actor) {
  return [actor.outer,actor.trim].map(target => Array.from(sdk.copyImageData2DPixels(target.textureLease.value.imageData).subarray(0,4)));
}
function current(f, selection, encoded) {
  const view = f.snapshot(); assert.equal(view.selection, selection); assert.equal(view.pendingKey, null);
  assert.deepEqual(view.logical, { sets: 1, encodedBytes: encoded, decodedBytes: 2048 });
}
async function beginSummer(f) {
  f.outfits.hold('C'); f.outfits.hold('D');
  const outcome = watch(f.session.replaceOutfit(LEFT, 'summer')); await drain();
  return { outcome, c: f.outfits.latest('C'), d: f.outfits.latest('D') };
}

scenario('P03_SCENE_01 two layer targets keep animation ownership and independent shared leases', async t => {
  const f = await fixture(t), left = f.actor(), right = f.actor(RIGHT);
  assert.notEqual(left.root, right.root); assert.notEqual(left.outer, left.trim);
  assert.notEqual(left.body, left.outer); assert.notEqual(left.body, left.trim);
  assert.notEqual(left.outer.textureLease, right.outer.textureLease);
  assert.notEqual(left.trim.textureLease, right.trim.textureLease);
  assert.equal(left.outer.textureLease.value, right.outer.textureLease.value);
  assert.equal(left.trim.textureLease.value, right.trim.textureLease.value);
  assert.equal(left.atlasLease.value, right.atlasLease.value);
  assert.equal(left.outer.y, 0); assert.equal(left.trim.y, 4);
  assert.deepEqual(left.outer.sourceRect, ZERO); assert.deepEqual(left.trim.sourceRect, ZERO);
  assert.deepEqual(colors(left), [[255,0,0,255],[0,255,0,255]]); current(f, 'classic', 163);
  assert.equal(f.session.selectTarget(right.root), true); await f.session.scene.textReady;
  assert.equal(f.session.inspect().selectedId, RIGHT);
  const old = bindings(left), rightOld = bindings(right);
  await f.session.replaceOutfit(LEFT, 'summer'); current(f, 'summer', 164);
  assert.deepEqual(colors(left), [[0,0,255,255],[255,255,0,255]]); unchanged(right, rightOld);
  for (const key of ['root','body','outer','trim','playback']) assert.equal(left[key], old[key]);
  f.session.advanceTo(0.125); assert.deepEqual(left.body.sourceRect, ONE); assert.deepEqual(right.body.sourceRect, ONE);
  assert.deepEqual(left.outer.sourceRect, ZERO); assert.deepEqual(left.trim.sourceRect, ZERO);
  const frame = f.session.capture(); assert.equal(frame.width, 192); assert.equal(frame.height, 128);
  assert.ok(frame.images.includes(left.outer.textureLease.value.imageData));
  assert.ok(frame.images.includes(left.trim.textureLease.value.imageData));
});

for (const [name,cause] of [['Error',new Error('original D failure')],['undefined',undefined]]) {
  scenario('P03_SCENE_02 partial ' + name + ' failure preserves both old layers selection and body', async t => {
    const f = await fixture(t), left = f.actor(), right = f.actor(RIGHT), old = bindings(left), survivor = bindings(right);
    f.session.selectTarget(right.root); await f.session.scene.textReady;
    const { outcome,c,d } = await beginSummer(f); const unused = c.resolve(); await drain();
    unchanged(left, old); d.reject(cause); const error = await rejected(outcome, 'ASSET_GROUP_ACQUIRE_FAILED');
    originalLoadFailure(error, cause);
    unchanged(left, old); unchanged(right, survivor); current(f, 'classic', 163);
    assert.equal(f.session.inspect().selectedId, RIGHT); assert.equal(unused.isDisposed, true);
    assert.equal(f.outfits.disposed(unused), 1);
    f.session.advanceTo(0.125); assert.deepEqual(left.body.sourceRect, ONE);
  });
}

scenario('P03_SCENE_03 cancellation settles before ignored original jobs and retires late values', async t => {
  const f = await fixture(t), left = f.actor(), old = bindings(left), reason = {};
  const { outcome,c,d } = await beginSummer(f);
  f.session.cancelOutfit(LEFT, reason);
  const error = await rejected(outcome, 'PREPARED_OUTFIT_CANCELLED'); assert.equal(error.cause, reason);
  assert.equal(f.outfits.active.size, 2); assert.equal(f.snapshot().sourcePending, 2);
  unchanged(left, old); current(f, 'classic', 163);
  const lateC = c.resolve(), lateD = d.resolve(); await drain();
  assert.equal(lateC.isDisposed, true); assert.equal(lateD.isDisposed, true);
  assert.equal(f.outfits.disposed(lateC), 1); assert.equal(f.outfits.disposed(lateD), 1);
  assert.equal(f.outfits.active.size, 0); unchanged(left, old);
});

scenario('P03_SCENE_04 a superseded set cannot replace the later mix after late delivery', async t => {
  const f = await fixture(t), left = f.actor(), right = f.actor(RIGHT), survivor = bindings(right);
  const first = await beginSummer(f);
  const later = watch(f.session.replaceOutfit(LEFT, 'mix')); await drain();
  await rejected(first.outcome, 'PREPARED_OUTFIT_SUPERSEDED');
  const newD = f.outfits.latest('D'); assert.notEqual(newD, first.d, 'Retired pending generation requires a fresh original D job');
  newD.resolve(); await later.done; assert.equal(later.state, 'fulfilled'); current(f, 'mix', 166);
  assert.deepEqual(colors(left), [[255,0,0,255],[255,255,0,255]]); unchanged(right, survivor);
  const published = bindings(left), staleC = first.c.resolve(), staleD = first.d.resolve(); await drain();
  assert.equal(staleC.isDisposed, true); assert.equal(staleD.isDisposed, true);
  unchanged(left, published); current(f, 'mix', 166);
});

scenario('P03_SCENE_05 retiring one entity preserves the other shared materials and playback', async t => {
  const f = await fixture(t), left = f.actor(), right = f.actor(RIGHT), survivor = bindings(right);
  const a = right.outer.textureLease.value, b = right.trim.textureLease.value, atlas = right.atlasLease.value;
  f.session.remove(LEFT); f.session.remove(LEFT);
  assert.equal(f.session.scene.actors[LEFT], undefined); assert.equal(f.snapshot(), null);
  assert.equal(left.root.isDisposed, true); assert.equal(left.coordinator.snapshot().state, 'disposed');
  unchanged(right, survivor); assert.equal(a.isDisposed, false); assert.equal(b.isDisposed, false); assert.equal(atlas.isDisposed, false);
  assert.equal(f.outfits.disposed(a), 0); assert.equal(f.outfits.disposed(b), 0);
  f.session.advanceTo(0.125); assert.deepEqual(right.body.sourceRect, ONE);
  const frame = f.session.capture(); assert.ok(frame.images.includes(a.imageData)); assert.ok(frame.images.includes(b.imageData));
  throwsCode(() => f.session.replaceOutfit(LEFT, 'summer'), 'PREPARED_SCENE_ACTOR_ABSENT');
});

scenario('P03_SCENE_06 a mismatched pinned dependency refuses before any outfit preparation', async t => {
  const f = await starting(t, { dependencyOverride: { evidence: { sha256: '0'.repeat(64) } } });
  await rejected(f.ready, 'PREPARED_SCENE_DEPENDENCY_INVALID');
  assert.equal(f.outfits.jobs.length, 0, 'No initial outfit group activates before dependency validation');
});

scenario('P03_SCENE_07 precommit set pressure rejects a replacement without activating its sources', async t => {
  const f = await fixture(t, { limits: { sets: 1 } }), left = f.actor(), old = bindings(left);
  const before = f.outfits.jobs.length;
  await rejected(watch(f.session.replaceOutfit(LEFT, 'summer')), 'PREPARED_OUTFIT_BUDGET_EXCEEDED');
  assert.equal(f.outfits.jobs.length, before); unchanged(left, old); current(f, 'classic', 163);
  f.session.advanceTo(0.125); assert.deepEqual(left.body.sourceRect, ONE);
});

scenario('P03_SCENE_08 close has one original Promise and drains late source values without revival', async t => {
  const f = await fixture(t), left = f.actor(), { outcome,c,d } = await beginSummer(f);
  const original = f.session.close(), close = watch(original); assert.equal(f.session.close(), original);
  assert.equal(f.session.inspect().state, 'closing');
  await rejected(outcome, 'PREPARED_OUTFIT_DISPOSED');
  assert.equal(close.state, 'pending'); assert.equal(f.outfits.active.size, 2);
  throwsCode(() => f.session.replaceOutfit(LEFT, 'mix'), 'PREPARED_SCENE_CLOSED');
  const lateC = c.resolve(), lateD = d.resolve(); await close.done;
  assert.equal(close.state, 'fulfilled'); assert.equal(f.session.inspect().state, 'closed');
  assert.equal(left.root.isDisposed, true); assert.equal(left.coordinator.snapshot().state, 'disposed');
  assert.equal(lateC.isDisposed, true); assert.equal(lateD.isDisposed, true);
});
