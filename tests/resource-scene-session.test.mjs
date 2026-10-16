// SPDX-License-Identifier: Apache-2.0
// Original P02 public-application witnesses. CPU literals are not PNG/font/pixel oracles.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { deferred, flush, host } from './helpers.mjs';
import { literalProvider, request } from './text-raster-public-helpers.mjs';

const scenario = (name, run) => test(name, { timeout: 10000 }, run);
const LEFT = 'pilot-left', RIGHT = 'pilot-right';
const FRAME = Object.freeze({ width: 192, height: 128, clearColor: 0, clearAlpha: 1 });
const FULL = Object.freeze({ x: 0, y: 0, width: 16, height: 16 });
const POSE0 = Object.freeze({ x: 0, y: 0, width: 16, height: 16 });
const POSE1 = Object.freeze({ x: 16, y: 0, width: 16, height: 16 });

function observe(promise) {
  assert.ok(promise instanceof Promise);
  const record = { state: 'pending', value: undefined, error: undefined };
  record.done = promise.then(value => { record.state = 'fulfilled'; record.value = value; },
    error => { record.state = 'rejected'; record.error = error; });
  return record;
}
async function refused(record, code) {
  await flush();
  assert.equal(record.state, 'rejected', 'Logical refusal must not await the original provider');
  assert.equal(record.error?.code, code);
  return record.error;
}
async function accepted(record) {
  await record.done; assert.equal(record.state, 'fulfilled'); assert.equal(record.value, undefined);
}
function code(run, expected) {
  let found;
  assert.throws(run, error => { found = error; assert.equal(error?.code, expected); return true; });
  return found;
}
function captureCall(run) {
  try { return { threw: false, value: run() }; }
  catch (cause) { return { threw: true, cause }; }
}
function errorWithCode(root, wanted) {
  const pending = [root], seen = new Set();
  while (pending.length) {
    const item = pending.shift();
    if (item === null || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item); if (item.code === wanted) return item;
    if (Object.hasOwn(item, 'cause')) pending.push(item.cause);
    if (Array.isArray(item.errors)) pending.push(...item.errors);
    if (Array.isArray(item.cleanupErrors)) pending.push(...item.cleanupErrors);
  }
  assert.fail('Missing original structured error ' + wanted);
}
function literalTexture(key) {
  const width = key.startsWith('atlas-') ? 32 : key === 'rgb-red-green' ? 2 : 16;
  const height = key === 'rgb-red-green' ? 1 : 16;
  const colors = { 'outfit-A': [255, 0, 0, 255], 'outfit-B': [0, 255, 0, 255],
    'outfit-C': [0, 0, 255, 255], 'outfit-D': [255, 255, 0, 255] };
  const pixels = new Uint8Array(width * height * 4);
  const color = colors[key] ?? [17, 83, 149, 255];
  for (let i = 0; i < pixels.length; i += 4) pixels.set(color, i);
  return sdk.createTexture(sdk.createImageData2D({ width, height, pixels }));
}
function basename(id) {
  const key = id.split(/[?#]/, 1)[0].split('/').at(-1).replace(/\.png$/, '');
  if (!['atlas-v1', 'atlas-v2', 'outfit-A', 'outfit-B', 'outfit-C', 'outfit-D', 'rgb-red-green'].includes(key)) {
    throw new Error('Unexpected controlled CPU resource ' + id);
  }
  return key;
}
// Original provider Promises are retained even when the SDK signal has aborted.
// Its callbacks record only; mandatory assertions are made by test bodies.
function controlledTextures() {
  const holds = new Set(), jobs = [], disposals = [], hooks = { dispose: undefined };
  const provider = {
    load(ref, context) {
      const key = basename(ref.id), gate = deferred();
      const job = { key, ref, context, promise: gate.promise, settled: false, value: undefined,
        resolve() {
          if (job.settled) throw new Error('Controlled original job settled twice');
          job.settled = true; job.value = literalTexture(key); gate.resolve(job.value); return job.value;
        },
        reject(cause) {
          if (job.settled) throw new Error('Controlled original job settled twice');
          job.settled = true; gate.reject(cause);
        } };
      jobs.push(job); if (!holds.has(key)) job.resolve(); return gate.promise;
    },
    dispose(value) { disposals.push(value); value.dispose(); hooks.dispose?.(value); },
  };
  return { provider, jobs, disposals, hooks, hold: key => holds.add(key),
    latest(key) { const job = jobs.filter(item => item.key === key).at(-1); assert.ok(job, 'Expected original ' + key + ' job'); return job; },
    loads(key) { return jobs.filter(item => item.key === key).length; },
    disposed(value) { return disposals.filter(item => item === value).length; },
    settleAll() { for (const job of jobs) if (!job.settled) job.resolve(); } };
}

// Every prerequisite is genuine and succeeds before the future module is loaded.
// An absent session therefore gives a named-module RED, not an SDK setup failure.
let baselinePromise;
async function genuineBaseline() {
  const port = host(), engine = await sdk.createEngine({ host: port.adapter });
  const type = sdk.createAssetType('p02.original.cpu.baseline', sdk.isTexture);
  const values = new Map(), releases = [];
  engine.assets.register(type, { async load(ref) { const value = literalTexture(ref.id); values.set(ref.id, value); return value; },
    dispose(value) { releases.push(value); value.dispose(); } });
  const scope = engine.createScope(), literal = literalProvider();
  const cache = createTextRasterCache(engine.assets, { provider: literal.provider });
  let lease, second, bitmap, playback, slot;
  try {
    const ref = sdk.createAssetRef(type, 'atlas-v1');
    lease = scope.use(await engine.assets.acquire(ref)); second = scope.use(await engine.assets.acquire(ref));
    assert.notEqual(lease, second); assert.equal(lease.value, second.value);
    const sheet = scope.use(sdk.createSpriteSheet(lease, [{ name: 'zero', ...POSE0 }, { name: 'one', ...POSE1 }]));
    bitmap = scope.use(sheet.createBitmap('zero')); engine.stage.addChild(bitmap);
    const clip = sdk.createSequenceClip({ atlasWidth: 32, atlasHeight: 16,
      frames: [{ ...POSE0, durationSeconds: 0.125 }, { ...POSE1, durationSeconds: 0.125 }] });
    engine.advanceTime(0); playback = engine.createSequencePlayback(scope, bitmap, clip, { mode: 'loop' }); playback.start();
    assert.equal(playback.lastSample.frameIndex, 0); engine.advanceTime(0.125);
    assert.equal(playback.lastSample.frameIndex, 1); assert.deepEqual(bitmap.sourceRect, POSE1);
    const outfitLease = scope.use(await engine.assets.acquire(sdk.createAssetRef(type, 'outfit-A')));
    const outfit = scope.use(new sdk.Bitmap(outfitLease)); engine.stage.addChild(outfit);
    slot = engine.createBitmapResourceSlot(scope, outfit); assert.equal(slot.state, 'idle');
    const field = createTextField(engine, scope, cache); field.setRequest(request()); await field.prepare(); engine.stage.addChild(field);
    const frame = engine.captureFrame(FRAME); assert.equal(frame.width, 192); assert.equal(frame.height, 128);
    assert.ok(frame.commands.some(command => command.kind === 'image'));
    assert.ok(frame.images.includes(lease.value.imageData)); assert.equal(literal.state.measure, 1);
  } finally { cache.dispose(); await engine.dispose(); await cache.whenIdle(); }
  assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0);
  assert.equal(playback.isDisposed, true); assert.equal(bitmap.isDisposed, true); assert.equal(slot.state, 'disposed');
  code(() => lease.value, 'ASSET_LEASE_RELEASED'); code(() => second.value, 'ASSET_LEASE_RELEASED');
  assert.equal(releases.length, 2); assert.ok([...values.values()].every(value => value.isDisposed));
  console.log('RESOURCE_SCENE_GENUINE_SDK_BASELINE_AND_TEARDOWN_COMPLETE');
}
async function factory() {
  await (baselinePromise ??= genuineBaseline());
  const module = await import('../examples/resource-scene/session.mjs');
  assert.equal(typeof module.createResourceSceneSession, 'function', 'RESOURCE_SCENE_SESSION_FACTORY_REQUIRED');
  return module.createResourceSceneSession;
}
async function starting(t, options = {}) {
  const create = await factory(), textures = controlledTextures(), textGate = deferred(), enteredText = deferred();
  const literal = literalProvider(options.holdText ? { async measure(value, context) {
    enteredText.resolve(); await textGate.promise;
    return context.createPlan({ baselineOffset: 5, lines: value.sourceLines.map(() => ({
      advance: 8, hasInk: true, inkLeft: -1, inkTop: -4, inkRight: 7, inkBottom: 2 })) });
  } } : {});
  const port = host(options.hostOverrides), session = create({ host: port.adapter, profile: options.profile ?? 'canvas-2d',
    textureProvider: textures.provider, textProvider: literal.provider,
    fontFamilies: { ahem: 'P02 CPU Ahem substitute', cjk: 'P02 CPU CJK substitute' },
    ...(options.restore === undefined ? {} : { restore: options.restore }) });
  const ready = observe(session.ready);
  assert.ok(Object.isFrozen(session)); assert.ok(Object.isFrozen(session.scene));
  const f = { session, textures, literal, port, ready, textGate, enteredText, cleanupGates: [],
    actor(id = LEFT) { const value = session.scene.actors[id]; assert.ok(value, 'Current actor view ' + id); return value; },
    snapshot(id = LEFT) { return session.snapshot().actors[id]; } };
  t.after(async () => {
    const closing = observe(session.close());
    for (const release of f.cleanupGates) release();
    textures.settleAll(); textGate.resolve();
    await closing.done; await ready.done;
    if (options.expectedCloseError) options.expectedCloseError(closing);
    else assert.equal(closing.state, 'fulfilled', 'Unexpected cleanup refusal must fail outside SDK callbacks');
    await flush(); await flush();
    for (const job of textures.jobs) if (job.value !== undefined) {
      assert.equal(job.value.isDisposed, true, 'Every original delivered Texture must retire');
      assert.equal(textures.disposed(job.value), 1, 'Every original Texture gets one disposer attempt');
    }
    assert.equal(literal.state.release, literal.state.plans.length);
    assert.equal(new Set(literal.state.released).size, literal.state.released.length);
    assert.equal(port.timers.size, 0);
  });
  return f;
}
async function fixture(t, options) { const f = await starting(t, options); await f.session.ready; return f; }
function bindings(f, id = LEFT) {
  const actor = f.actor(id);
  return { root: actor.root, body: actor.body, outfit: actor.outfit, lease: actor.lease,
    playback: actor.playback, slot: actor.slot, outfitLease: actor.outfit.textureLease };
}
function oldVisible(f, old, id = LEFT) {
  const current = bindings(f, id); assert.equal(current.root, old.root); assert.equal(current.outfit, old.outfit);
  assert.equal(current.outfitLease, old.outfitLease); assert.deepEqual(current.outfit.sourceRect, FULL);
  assert.deepEqual([current.outfit.naturalWidth, current.outfit.naturalHeight], [16, 16]);
  const frame = f.session.capture(); assert.ok(frame.images.includes(old.outfitLease.value.imageData));
}
function survivor(f, old) {
  const current = bindings(f, RIGHT);
  for (const name of ['root', 'body', 'outfit', 'lease', 'playback', 'slot', 'outfitLease']) assert.equal(current[name], old[name]);
  assert.equal(current.root.isDisposed, false); assert.equal(current.lease.value.isDisposed, false);
}
function siblingRef(job, next) {
  const id = job.ref.id.replace(/outfit-A(?=\.png(?:[?#]|$)|[?#]|$)/, next);
  assert.notEqual(id, job.ref.id); return sdk.createAssetRef(job.ref.type, id);
}

scenario('RS00 genuine public SDK baseline succeeds before any session import', async () => {
  await (baselinePromise ??= genuineBaseline());
});

scenario('RS02 two genuine actors independently lease the same atlas; initial slot binding is borrowed', async t => {
  const f = await fixture(t), left = bindings(f), right = bindings(f, RIGHT);
  assert.ok(left.root instanceof sdk.Sprite); assert.ok(left.body instanceof sdk.Bitmap); assert.ok(left.outfit instanceof sdk.Bitmap);
  assert.notEqual(left.root, right.root); assert.notEqual(left.lease, right.lease); assert.equal(left.lease.value, right.lease.value);
  assert.equal(f.textures.loads('atlas-v1'), 1); assert.equal(left.body.textureLease, left.lease);
  assert.equal(right.body.textureLease, right.lease); assert.equal(left.playback.state, 'running'); assert.equal(right.playback.state, 'running');
  assert.deepEqual(left.body.sourceRect, POSE0); assert.deepEqual(right.body.sourceRect, POSE0);
  const frame = f.session.capture(), badgeImage = f.session.scene.badgeLease.value.imageData;
  const badgeCommand = frame.commands.find(command => command.kind === 'image'
    && frame.images[command.imageIndex] === badgeImage);
  assert.ok(badgeCommand, 'The ordinary frame must include the borrowed badge image');
  assert.deepEqual([badgeCommand.matrix.b, badgeCommand.matrix.c], [0, 0]);
  assert.deepEqual([badgeCommand.matrix.tx, badgeCommand.matrix.ty,
    badgeCommand.matrix.a * badgeCommand.rect.width, badgeCommand.matrix.d * badgeCommand.rect.height],
  [8, 8, 16, 8], 'The ordinary badge occupies its authored 16 by 8 logical-pixel extent');
  assert.equal(f.session.inspect().selectedId, LEFT);
  left.slot.dispose(); assert.equal(left.outfit.textureLease, left.outfitLease);
  assert.equal(left.outfitLease.value.isDisposed, false, 'Disposing an untouched slot cannot release its initial borrow');
  oldVisible(f, left); survivor(f, right);
  await f.session.close(); code(() => left.outfitLease.value, 'ASSET_LEASE_RELEASED'); code(() => right.lease.value, 'ASSET_LEASE_RELEASED');
});

scenario('RS04 exact source boundaries and pause affect one actor while the other continues', async t => {
  const f = await fixture(t), left = f.actor(), right = f.actor(RIGHT), ticks = [];
  const observer = f.session.scene.engine.createScope();
  f.session.scene.engine.clock.onTick(observer, value => { ticks.push(value); });
  f.session.advanceTo(0); assert.equal(ticks.length, 0); assert.equal(left.playback.lastSample.frameIndex, 0);
  f.session.advanceTo(0.125 - 2 ** -20); assert.equal(left.playback.lastSample.frameIndex, 0);
  f.session.advanceTo(0.125); assert.equal(left.playback.lastSample.frameIndex, 1); assert.deepEqual(left.body.sourceRect, POSE1);
  f.session.advanceTo(0.25); assert.equal(left.playback.lastSample.frameIndex, 0); assert.deepEqual(left.body.sourceRect, POSE0);
  f.session.pause(LEFT); const frozen = left.playback.lastSample;
  f.session.advanceTo(0.375); assert.equal(left.playback.lastSample, frozen); assert.equal(right.playback.lastSample.frameIndex, 1);
  f.session.resume(LEFT); f.session.advanceTo(0.5); assert.equal(left.playback.lastSample.frameIndex, 1);
  assert.deepEqual(ticks.map(value => value.tickId), [1, 2, 3, 4, 5]);
  assert.deepEqual(ticks.map(value => value.elapsedSeconds), [0.125 - 2 ** -20, 0.125, 0.25, 0.375, 0.5]);
});

scenario('RS06-RS08 supersede and cancel settle before uncooperative original jobs; late values retire once', async t => {
  const f = await fixture(t), old = bindings(f), right = bindings(f, RIGHT), reason = { cancel: 'original' };
  f.textures.hold('outfit-B'); f.textures.hold('outfit-C');
  const b = observe(f.session.replaceOutfit(LEFT, 'B')), bJob = f.textures.latest('outfit-B');
  const c = observe(f.session.replaceOutfit(LEFT, 'C')), cJob = f.textures.latest('outfit-C');
  await refused(b, 'BITMAP_RESOURCE_SUPERSEDED'); assert.equal(bJob.settled, false); oldVisible(f, old);
  f.session.cancelOutfit(LEFT, reason); const cancelled = await refused(c, 'BITMAP_RESOURCE_CANCELLED');
  assert.equal(cancelled.cause, reason); assert.equal(cJob.settled, false);
  assert.equal(bJob.context.signal.aborted, true); assert.equal(cJob.context.signal.aborted, true);
  oldVisible(f, old); survivor(f, right); assert.equal(f.snapshot().committedOutfit, 'A');
  const bValue = bJob.resolve(), cValue = cJob.resolve(); await flush(); await flush();
  assert.equal(f.textures.disposed(bValue), 1); assert.equal(f.textures.disposed(cValue), 1);
  assert.equal(bValue.isDisposed, true); assert.equal(cValue.isDisposed, true);
  oldVisible(f, old); survivor(f, right); assert.equal(f.snapshot().committedOutfit, 'A');
});

for (const markerKind of ['Error', 'undefined']) scenario('RS09-RS10 CPU manager failure preserves exact ' + markerKind + ' cause occurrence', async t => {
  const f = await fixture(t), old = bindings(f), right = bindings(f, RIGHT);
  const marker = markerKind === 'Error' ? new Error('P02 original provider refusal') : undefined;
  f.textures.hold('outfit-B'); const pending = observe(f.session.replaceOutfit(LEFT, 'B'));
  f.textures.latest('outfit-B').reject(marker);
  await pending.done; assert.equal(pending.state, 'rejected'); assert.equal(pending.error.code, 'BITMAP_RESOURCE_REPLACE_FAILED');
  assert.equal(pending.error.cause.code, 'ASSET_LOAD_FAILED');
  assert.ok(Object.hasOwn(pending.error.cause, 'cause')); assert.equal(pending.error.cause.cause, marker);
  // No WEB_PNG_READ_FAILED is invented: these are direct public CPU AssetProviders.
  oldVisible(f, old); survivor(f, right); assert.equal(f.snapshot().committedOutfit, 'A');
  assert.equal(f.session.inspect().selectedId, LEFT);
  await accepted(observe(f.session.replaceOutfit(LEFT, 'D')));
  assert.equal(f.snapshot().committedOutfit, 'D'); survivor(f, right);
});

scenario('RS11 latest D commits, target identity stays, and old owned B is revoked once', async t => {
  const f = await fixture(t), old = bindings(f), right = bindings(f, RIGHT);
  assert.equal(f.session.selectTarget(right.root), true); assert.equal(f.session.selectTarget(right.outfit), false);
  await accepted(observe(f.session.replaceOutfit(LEFT, 'B')));
  const bLease = f.actor().outfit.textureLease, bValue = bLease.value;
  assert.notEqual(bLease, old.outfitLease); assert.equal(f.snapshot().committedOutfit, 'B');
  await accepted(observe(f.session.replaceOutfit(LEFT, 'D')));
  assert.equal(f.actor().root, old.root); assert.equal(f.actor().outfit, old.outfit);
  assert.equal(f.snapshot().committedOutfit, 'D'); assert.equal(f.session.inspect().selectedId, RIGHT);
  assert.deepEqual(f.actor().outfit.sourceRect, FULL); code(() => bLease.value, 'ASSET_LEASE_RELEASED');
  assert.equal(f.textures.disposed(bValue), 1); survivor(f, right);
  assert.ok(f.session.capture().images.includes(f.actor().outfit.textureLease.value.imageData));
});

scenario('RS12 already-delivered stale B lease retires without revoking its independent waiter', async t => {
  const f = await fixture(t), old = bindings(f), engine = f.session.scene.engine;
  const ref = siblingRef(f.textures.latest('outfit-A'), 'outfit-B');
  const external = await engine.assets.acquire(ref), value = external.value;
  try {
    assert.equal(f.textures.loads('outfit-B'), 1); f.textures.hold('outfit-C');
    const b = observe(f.session.replaceOutfit(LEFT, 'B'));
    const c = observe(f.session.replaceOutfit(LEFT, 'C')); // Same turn, before B's continuation.
    f.session.cancelOutfit(LEFT, 'cancel C');
    await refused(b, 'BITMAP_RESOURCE_SUPERSEDED'); await refused(c, 'BITMAP_RESOURCE_CANCELLED');
    await flush(); assert.equal(external.value, value); assert.equal(value.isDisposed, false);
    assert.equal(f.textures.disposed(value), 0); assert.equal(f.textures.loads('outfit-B'), 1); oldVisible(f, old);
    external.release(); assert.equal(f.textures.disposed(value), 1); assert.equal(value.isDisposed, true);
    f.textures.latest('outfit-C').resolve(); await flush();
  } finally { external.release(); }
});

scenario('RS13-RS15 removal retires old generation; re-entry preserves ID, selection and committed D', async t => {
  const f = await fixture(t), right = bindings(f, RIGHT);
  await accepted(observe(f.session.replaceOutfit(LEFT, 'D'))); const old = bindings(f), sharedAtlas = old.lease.value;
  f.textures.hold('outfit-B'); const pending = observe(f.session.replaceOutfit(LEFT, 'B')), job = f.textures.latest('outfit-B');
  f.session.remove(LEFT); await refused(pending, 'BITMAP_RESOURCE_DISPOSED');
  assert.equal(old.root.isDisposed, true); assert.equal(old.root.parent, undefined); assert.equal(old.playback.isDisposed, true);
  code(() => old.lease.value, 'ASSET_LEASE_RELEASED'); assert.equal(f.textures.disposed(sharedAtlas), 0);
  assert.equal(f.snapshot().present, false); assert.equal(f.session.inspect().selectedId, LEFT);
  assert.equal(f.session.selectTarget(old.root), false); survivor(f, right);
  f.session.advanceTo(0); f.session.advanceTo(0.125); assert.equal(right.playback.lastSample.frameIndex, 1);
  const late = job.resolve(); await flush(); assert.equal(f.textures.disposed(late), 1);
  assert.equal(f.snapshot().present, false); assert.equal(f.snapshot().committedOutfit, 'D');
  await accepted(observe(f.session.reenter(LEFT))); const current = bindings(f);
  assert.notEqual(current.root, old.root); assert.notEqual(current.lease, old.lease); assert.notEqual(current.playback, old.playback);
  assert.equal(current.lease.value, sharedAtlas); assert.equal(f.textures.loads('atlas-v1'), 1);
  assert.equal(f.snapshot().present, true); assert.equal(f.snapshot().committedOutfit, 'D');
  assert.equal(f.session.selectTarget(current.root), true); assert.equal(f.session.inspect().selectedId, LEFT);
  assert.equal(current.playback.lastSample.frameIndex, 0); survivor(f, right);
  await f.session.close(); assert.equal(f.textures.disposed(sharedAtlas), 1);
});

scenario('RS15 cleanup reentry creates a new generation before an old successful request continuation', async t => {
  const f = await fixture(t), right = bindings(f, RIGHT);
  await accepted(observe(f.session.replaceOutfit(LEFT, 'B')));
  const old = bindings(f), oldB = old.outfitLease.value, calls = [];
  let armed = true, reentry;
  f.textures.hooks.dispose = value => {
    if (!armed || value !== oldB) return;
    armed = false;
    calls.push(captureCall(() => {
      f.session.remove(LEFT); reentry = observe(f.session.reenter(LEFT));
    }));
  };
  // D commits visibly before the old owned B disposer is called. The disposer
  // retires that entity synchronously; its late successful app reaction is stale.
  const d = observe(f.session.replaceOutfit(LEFT, 'D')); await accepted(d);
  assert.equal(calls.length, 1); assert.equal(calls[0].threw, false, 'Caught SDK callback failure must fail here');
  assert.ok(reentry); await accepted(reentry);
  assert.equal(old.root.isDisposed, true); assert.notEqual(f.actor().root, old.root);
  assert.equal(f.snapshot().present, true); assert.equal(f.snapshot().committedOutfit, 'B');
  assert.equal(f.actor().outfit.textureLease.value, f.textures.latest('outfit-B').value);
  assert.equal(f.textures.disposed(oldB), 1); survivor(f, right);
});

scenario('RS16 explicit atlas replacement stops the old playback and starts the same body at phase zero', async t => {
  const f = await fixture(t), old = bindings(f), right = bindings(f, RIGHT);
  f.session.advanceTo(0); f.session.advanceTo(0.125); const originalAtlas = old.lease.value;
  f.textures.hold('atlas-v2'); const pending = observe(f.session.replaceAtlas(LEFT, 'v2'));
  assert.equal(f.actor().playback, old.playback); assert.equal(old.playback.state, 'running');
  f.session.advanceTo(0.25); assert.equal(old.playback.lastSample.frameIndex, 0);
  f.textures.latest('atlas-v2').resolve(); await accepted(pending); const current = bindings(f);
  assert.equal(current.root, old.root); assert.equal(current.body, old.body); assert.equal(current.outfit, old.outfit);
  assert.notEqual(current.lease, old.lease); assert.notEqual(current.playback, old.playback);
  assert.equal(old.playback.isDisposed, true); assert.equal(current.playback.state, 'running');
  assert.equal(current.playback.lastSample.frameIndex, 0); assert.deepEqual(current.body.sourceRect, POSE0);
  assert.equal(current.body.textureLease, current.lease); assert.equal(f.snapshot().atlasKey, 'v2');
  code(() => old.lease.value, 'ASSET_LEASE_RELEASED'); assert.equal(right.lease.value, originalAtlas);
  assert.equal(f.textures.disposed(originalAtlas), 0); survivor(f, right);
});

scenario('RS17 atlas preparation refusal preserves the exact old binding and animation', async t => {
  const f = await fixture(t), old = bindings(f), marker = new Error('original atlas preparation');
  f.textures.hold('atlas-v2'); const pending = observe(f.session.replaceAtlas(LEFT, 'v2'));
  f.textures.latest('atlas-v2').reject(marker); await pending.done; assert.equal(pending.state, 'rejected');
  assert.equal(errorWithCode(pending.error, 'ASSET_LOAD_FAILED').cause, marker);
  assert.equal(f.actor().body.textureLease, old.lease); assert.equal(f.actor().playback, old.playback);
  assert.equal(old.playback.state, 'running'); assert.equal(f.snapshot().atlasKey, 'v1');
  f.session.advanceTo(0); f.session.advanceTo(0.125); assert.equal(old.playback.lastSample.frameIndex, 1);
});

scenario('RS18 real anchor/clip/rotation and captured painter order preserve separate outfit geometry', async t => {
  const f = await fixture(t), actor = f.actor();
  assert.deepEqual([actor.root.x, actor.root.y, actor.root.scaleX, actor.root.scaleY], [56, 96, 3, 3]);
  assert.deepEqual([actor.root.anchorOffsetX, actor.root.anchorOffsetY], [8, 16]);
  assert.deepEqual(actor.root.hitArea, FULL); assert.equal(actor.root.touchEnabled, true); assert.equal(actor.root.touchChildren, false);
  f.session.setView(LEFT, { clip: true, rotation: 0 }); assert.deepEqual(actor.root.clipRect, { x: 0, y: 0, width: 8, height: 16 });
  let frame = f.session.capture();
  const bodyImage = actor.lease.value.imageData, outfitImage = actor.outfit.textureLease.value.imageData;
  const bodyCommand = frame.commands.findIndex(command => command.kind === 'image' && frame.images[command.imageIndex] === bodyImage);
  const outfitCommand = frame.commands.findIndex(command => command.kind === 'image' && frame.images[command.imageIndex] === outfitImage);
  assert.ok(bodyCommand >= 0 && outfitCommand > bodyCommand); assert.ok(frame.commands[outfitCommand].clips.length > 0);
  f.session.setView(LEFT, { clip: false, rotation: 90 }); assert.equal(actor.root.clipRect, undefined);
  assert.deepEqual(actor.root.localToGlobal(8, 8), { x: 80, y: 96 });
  f.session.setView(LEFT, { clip: false, rotation: 0 });
  assert.deepEqual(actor.root.localToGlobal(8, 8), { x: 56, y: 72 });
  frame = f.session.capture(); assert.equal(frame.width, 192); assert.deepEqual(actor.outfit.sourceRect, FULL);
});

scenario('RS20 closed business snapshot reconstructs new owners at phase zero, retaining pause choice', async t => {
  const first = await fixture(t); await accepted(observe(first.session.replaceOutfit(LEFT, 'D')));
  await accepted(observe(first.session.replaceAtlas(LEFT, 'v2')));
  first.session.selectTarget(first.actor(RIGHT).root); first.session.pause(LEFT);
  first.session.advanceTo(0); first.session.advanceTo(0.125);
  const snapshot = first.session.snapshot(), old = bindings(first), oldEngine = first.session.scene.engine;
  assert.deepEqual(Object.keys(snapshot).sort(), ['actors', 'selectedId', 'version']); assert.equal(snapshot.version, 1);
  assert.deepEqual(Object.keys(snapshot.actors).sort(), [LEFT, RIGHT]);
  for (const id of [LEFT, RIGHT]) assert.deepEqual(Object.keys(snapshot.actors[id]).sort(), ['atlasKey', 'committedOutfit', 'paused', 'present']);
  assert.deepEqual(snapshot.actors[LEFT], { present: true, committedOutfit: 'D', atlasKey: 'v2', paused: true });
  assert.equal(snapshot.selectedId, RIGHT); await first.session.close();
  const next = await fixture(t, { restore: snapshot }), current = bindings(next);
  assert.notEqual(next.session.scene.engine, oldEngine); assert.notEqual(current.root, old.root); assert.notEqual(current.lease, old.lease);
  assert.equal(current.playback.lastSample.frameIndex, 0); assert.equal(current.playback.state, 'paused');
  assert.deepEqual(next.session.snapshot(), snapshot); assert.equal(next.session.inspect().selectedId, RIGHT);
  // Main owns busy-restart/presentation/readback readiness; no new session.restart is invented here.
});

scenario('RS21 stable close waits for the original late provider, retiring requests and both actor owners', async t => {
  const f = await fixture(t), old = bindings(f), right = bindings(f, RIGHT);
  const reentry = []; f.textures.hooks.dispose = () => { reentry.push(captureCall(() => f.session.close())); };
  f.textures.hold('outfit-B'); const pending = observe(f.session.replaceOutfit(LEFT, 'B')), job = f.textures.latest('outfit-B');
  const closingPromise = f.session.close(), closing = observe(closingPromise);
  assert.equal(f.session.close(), closingPromise); assert.equal(f.session.inspect().state, 'closing');
  await pending.done; assert.equal(pending.state, 'rejected'); assert.ok(pending.error instanceof sdk.EgretError);
  await flush(); assert.equal(closing.state, 'pending', 'Original provider task remains unsettled after logical request retirement');
  const late = job.resolve(); await closing.done; assert.equal(closing.state, 'fulfilled');
  assert.equal(f.session.close(), closingPromise); assert.equal(f.session.inspect().state, 'closed');
  assert.equal(old.root.isDisposed, true); assert.equal(right.root.isDisposed, true);
  code(() => old.lease.value, 'ASSET_LEASE_RELEASED'); code(() => right.lease.value, 'ASSET_LEASE_RELEASED');
  assert.equal(f.textures.disposed(late), 1); assert.equal(late.isDisposed, true);
  assert.ok(reentry.length > 0);
  for (const call of reentry) { assert.equal(call.threw, false); assert.equal(call.value, closingPromise); }
  assert.deepEqual(f.port.trace, ['start', 'stop', 'close']);
});

scenario('RS21 close during original text preparation remains stable until genuine cache work settles', async t => {
  const f = await starting(t, { holdText: true }); await f.enteredText.promise;
  const promise = f.session.close(), closing = observe(promise); assert.equal(f.session.close(), promise);
  await flush(); assert.equal(closing.state, 'pending'); assert.equal(f.session.inspect().state, 'closing');
  f.textGate.resolve(); await closing.done; assert.equal(closing.state, 'fulfilled');
  await f.ready.done; assert.equal(f.ready.state, 'rejected'); assert.equal(f.session.inspect().state, 'closed');
  assert.equal(f.literal.state.release, f.literal.state.plans.length);
  assert.equal(f.port.timers.size, 0); assert.deepEqual(f.port.trace, ['start', 'stop', 'close']);
});

scenario('RS21 original Host close barrier delays safe return; source cancellation is not safe retirement', async t => {
  const barrier = deferred(), entered = deferred();
  const f = await fixture(t, { hostOverrides: { async close() { entered.resolve(); await barrier.promise; } } });
  f.cleanupGates.push(() => barrier.resolve());
  const promise = f.session.close(), closing = observe(promise); await entered.promise;
  assert.equal(f.session.close(), promise); await flush(); assert.equal(closing.state, 'pending');
  assert.equal(f.session.inspect().state, 'closing'); barrier.resolve(); await closing.done;
  assert.equal(closing.state, 'fulfilled'); assert.equal(f.session.inspect().state, 'closed');
});

scenario('RS21 thrown undefined remains a primary occurrence beside the original secondary cleanup cause', async t => {
  const secondary = new Error('original Host close secondary');
  function assertClose(record) {
    assert.equal(record.state, 'rejected');
    const structured = errorWithCode(record.error, 'ENGINE_CLOSE_FAILED');
    assert.ok(Object.hasOwn(structured, 'cause')); assert.equal(structured.cause, undefined);
    assert.deepEqual(structured.cleanupErrors, [secondary]);
  }
  const f = await fixture(t, { hostOverrides: { stop() { throw undefined; }, async close() { throw secondary; } }, expectedCloseError: assertClose });
  const promise = f.session.close(), closing = observe(promise); assert.equal(f.session.close(), promise);
  await closing.done; assertClose(closing); assert.equal(f.session.inspect().state, 'closed');
});

scenario('RS22 an ordinary injected Host refuses genuine textured negotiation without starting', async () => {
  await (baselinePromise ??= genuineBaseline());
  const port = host();
  await assert.rejects(sdk.createEngineForProfile({ host: port.adapter }, sdk.TEXTURED_FRAME_PROFILE_2D),
    error => error.code === 'ENGINE_RENDER_PROFILE_UNSUPPORTED');
  assert.deepEqual(port.trace, []); assert.equal(port.timers.size, 0);
  // Real Canvas and application profile refusal are separate browser/main witnesses.
});
