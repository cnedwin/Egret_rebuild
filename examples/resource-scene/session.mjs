// SPDX-License-Identifier: Apache-2.0
// Example-local composition of public SDK owners. This module has no DOM ports.
import { Bitmap, Sprite, EgretError, createEngine, createEngineForProfile,
  createAssetType, createAssetRef, isTexture, createSpriteSheet, createSequenceClip,
  TEXTURED_FRAME_PROFILE_2D } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';

const IDS = Object.freeze(['pilot-left', 'pilot-right']);
const OUTFITS = Object.freeze(['A', 'B', 'C', 'D']);
const ATLASES = Object.freeze(['v1', 'v2']);
const FULL = Object.freeze({ x: 0, y: 0, width: 16, height: 16 });
const FRAME = Object.freeze({ width: 192, height: 128, clearColor: 0, clearAlpha: 1 });
const CLIP = createSequenceClip({ atlasWidth: 32, atlasHeight: 16, frames: [
  { ...FULL, durationSeconds: 0.125 }, { ...FULL, x: 16, durationSeconds: 0.125 },
] });
const ASSETS = new URL('./assets/', import.meta.url);

function failure(code, cause) { return new EgretError(code, { cause }); }
function choice(value, values, code) {
  if (!values.includes(value)) throw failure(code);
  return value;
}
function restoreModel(input) {
  const fresh = () => ({ present: true, committedOutfit: 'A', atlasKey: 'v1', paused: false });
  if (input === undefined) return { selectedId: IDS[0], actors: Object.fromEntries(IDS.map(id => [id, fresh()])) };
  const keys = (value, expected) => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
  if (!keys(input, ['version', 'selectedId', 'actors']) || input.version !== 1
      || !IDS.includes(input.selectedId) || !keys(input.actors, IDS)) throw failure('RESOURCE_SCENE_SNAPSHOT_INVALID');
  const actors = {};
  for (const id of IDS) {
    const row = input.actors[id];
    if (!keys(row, ['present', 'committedOutfit', 'atlasKey', 'paused'])
        || typeof row.present !== 'boolean' || typeof row.paused !== 'boolean'
        || !OUTFITS.includes(row.committedOutfit) || !ATLASES.includes(row.atlasKey)) throw failure('RESOURCE_SCENE_SNAPSHOT_INVALID');
    actors[id] = { present: row.present, committedOutfit: row.committedOutfit, atlasKey: row.atlasKey, paused: row.paused };
  }
  return { selectedId: input.selectedId, actors };
}

/** Resource readiness and immutable captures are separate from Host presentation. */
export function createResourceSceneSession(options) {
  const profile = choice(options.profile, ['canvas-2d', 'webgpu-scene-textured'], 'RESOURCE_SCENE_PROFILE_UNSUPPORTED');
  const model = restoreModel(options.restore);
  const families = { ahem: options.fontFamilies?.ahem, cjk: options.fontFamilies?.cjk };
  if (Object.values(families).some(value => typeof value !== 'string' || !value)) throw failure('RESOURCE_SCENE_FONT_REQUIRED');
  const provider = options.textureProvider, load = provider?.load, dispose = provider?.dispose;
  if (typeof load !== 'function' || typeof dispose !== 'function') throw failure('ASSET_PROVIDER_INVALID');
  const textProvider = options.textProvider;
  const actors = new Map(), tasks = new Set(), originalLoads = new Set(), diagnostics = [];
  let state = 'starting', engine, cache, inputScope, decorationScope, textScope;
  let badgeLease, badge, ahemField, cjkField, textReady = Promise.resolve();
  let closePromise, ready;
  const cleanupObservations = [];

  function track(promise) {
    const settled = Promise.resolve(promise).then(() => undefined, () => undefined);
    tasks.add(settled);
    void settled.then(() => { tasks.delete(settled); });
    return promise;
  }
  const observedProvider = {
    load(ref, context) {
      if (originalLoads.size >= 4) throw failure('RESOURCE_SCENE_SOURCE_LIMIT');
      const original = Reflect.apply(load, provider, [ref, context]);
      const settled = Promise.resolve(original).then(() => undefined, () => undefined);
      originalLoads.add(settled);
      void settled.then(() => { originalLoads.delete(settled); });
      // Retain the real provider Promise/receiver; cancellation does not stop it.
      return original;
    },
    dispose(value) { Reflect.apply(dispose, provider, [value]); },
  };
  const type = createAssetType('egret.example.resource-scene.texture', isTexture);
  const outfitRef = key => createAssetRef(type, new URL('outfit-' + key + '.png', ASSETS).href);
  const atlasRef = key => createAssetRef(type, new URL('atlas-' + key + '.png', ASSETS).href);
  const engineOptions = { host: options.host, onDiagnostic(value) {
    // Bounded observations do not replace the SDK's original error channel.
    if (diagnostics.length < 256) diagnostics.push(value);
  } };
  const enginePromise = profile === 'canvas-2d' ? createEngine(engineOptions)
    : createEngineForProfile(engineOptions, TEXTURED_FRAME_PROFILE_2D);

  function assertOpen() {
    if (state !== 'ready') throw failure(state === 'starting' ? 'RESOURCE_SCENE_NOT_READY' : 'RESOURCE_SCENE_CLOSED');
  }
  function assertCurrent(record) {
    if (state === 'closing' || state === 'closed' || !record.live || actors.get(record.id) !== record) {
      throw failure('RESOURCE_SCENE_GENERATION_RETIRED');
    }
  }
  function actorFor(id) {
    choice(id, IDS, 'RESOURCE_SCENE_ACTOR_INVALID');
    const record = actors.get(id);
    if (!record?.live || record.root === undefined) throw failure('RESOURCE_SCENE_ACTOR_ABSENT');
    return record;
  }
  function attempt(run) {
    try { run(); }
    catch (cause) { cleanupObservations.push(cause); }
  }
  function retire(record) {
    if (!record.live) return;
    record.live = false;
    const pendingAtlas = record.pendingAtlas;
    record.pendingAtlas = undefined;
    record.outfitIntent = undefined; record.atlasIntent = undefined;
    if (actors.get(record.id) === record) actors.delete(record.id);
    // Invalidate application authority before any disposer can synchronously reenter.
    if (pendingAtlas !== undefined) {
      attempt(() => pendingAtlas.animation.dispose());
      attempt(() => pendingAtlas.scope.dispose());
    }
    attempt(() => record.animationScope.dispose());
    attempt(() => record.slotScope.dispose());
    attempt(() => { if (record.root?.parent) record.root.parent.removeChild(record.root); });
    attempt(() => record.displayScope.dispose());
    attempt(() => record.atlasScope.dispose());
    attempt(() => record.initialOutfitScope.dispose());
  }
  async function ownedAcquire(scope, ref) {
    const lease = await engine.assets.acquire(ref, { signal: scope.signal });
    // Scope.use retires a late unowned lease if this owner has already closed.
    return scope.use(lease);
  }
  function makeSheet(scope, lease) {
    return scope.use(createSpriteSheet(lease, [{ name: 'zero', ...FULL }, { name: 'one', ...FULL, x: 16 }]));
  }
  function beginActor(id) {
    const record = { id, generation: {}, live: true, root: undefined, body: undefined, outfit: undefined,
      selection: undefined, lease: undefined, playback: undefined, slot: undefined,
      initialLease: undefined, outfitIntent: undefined, atlasIntent: undefined, pendingAtlas: undefined,
      displayScope: engine.createScope(), atlasScope: engine.createScope(), animationScope: engine.createScope(),
      initialOutfitScope: engine.createScope(), slotScope: engine.createScope() };
    const view = {};
    for (const field of ['root', 'body', 'outfit', 'lease', 'playback', 'slot']) {
      Object.defineProperty(view, field, { enumerable: true, get: () => record[field] });
    }
    record.view = Object.freeze(view);
    actors.set(id, record);
    const desired = { ...model.actors[id] };
    record.preparation = track((async () => {
      try {
        const [lease, initialLease] = await Promise.all([
          ownedAcquire(record.atlasScope, atlasRef(desired.atlasKey)),
          ownedAcquire(record.initialOutfitScope, outfitRef(desired.committedOutfit)),
        ]);
        assertCurrent(record);
        record.lease = lease; record.initialLease = initialLease;
        const sheet = makeSheet(record.atlasScope, lease);
        const root = record.displayScope.use(new Sprite()); record.root = root;
        const selection = record.displayScope.use(new Sprite()); record.selection = selection;
        selection.graphics.beginFill(0xffffff).drawRect(-1, -1, 18, 18).endFill();
        selection.visible = model.selectedId === id;
        record.body = record.displayScope.use(sheet.createBitmap('zero'));
        record.outfit = record.displayScope.use(new Bitmap(initialLease));
        root.x = id === IDS[0] ? 56 : 136; root.y = 96; root.scaleX = 3; root.scaleY = 3;
        root.anchorOffsetX = 8; root.anchorOffsetY = 16;
        root.hitArea = FULL; root.touchEnabled = true; root.touchChildren = false;
        root.addChild(selection); root.addChild(record.body); root.addChild(record.outfit);
        engine.stage.addChild(root);
        record.playback = engine.createSequencePlayback(record.animationScope, record.body, CLIP, { mode: 'loop' });
        record.playback.start(); if (desired.paused) record.playback.pause();
        record.slot = engine.createBitmapResourceSlot(record.slotScope, record.outfit);
      } catch (cause) { retire(record); throw cause; }
    })());
    return record.preparation;
  }
  function textRequest(text, family, fontSize, lineHeight, locale) {
    return { text, fontFamily: family, fontSize, lineHeight, fontWeight: 400, fontStyle: 'normal',
      locale, direction: 'ltr', density: 1, fillColor: 0xffffff };
  }
  function prepareSelectionText() {
    cjkField.setRequest(textRequest(model.selectedId === IDS[0] ? '左侧 已选择' : '右侧 已选择', families.cjk, 12, 16, 'zh-CN'));
    textReady = track(cjkField.prepare());
    return textReady;
  }
  function selectionChanged() {
    for (const record of actors.values()) if (record.selection) record.selection.visible = record.id === model.selectedId;
    if (cjkField !== undefined) {
      // Keep the genuine preparation Promise observable by browser composition.
      // A selection callback remains synchronous and never returns that Promise.
      void prepareSelectionText().catch(() => undefined);
    }
  }
  async function initialize() {
    engine = await enginePromise;
    if (state === 'closing' || state === 'closed') throw failure('RESOURCE_SCENE_CLOSED');
    engine.assets.register(type, observedProvider);
    engine.advanceTime(0);
    inputScope = engine.createScope(); decorationScope = engine.createScope(); textScope = engine.createScope();
    cache = createTextRasterCache(engine.assets, { provider: textProvider });
    for (const x of [24, 104]) {
      const card = decorationScope.use(new Sprite());
      card.graphics.beginFill(0x404040).drawRect(x, 40, 64, 64).endFill(); engine.stage.addChild(card);
    }
    ahemField = createTextField(engine, textScope, cache); ahemField.x = 32; ahemField.y = 8;
    ahemField.setRequest(textRequest('X X', families.ahem, 8, 8, 'en'));
    cjkField = createTextField(engine, textScope, cache); cjkField.x = 72; cjkField.y = 8;
    engine.stage.addChild(ahemField); engine.stage.addChild(cjkField);
    const decorations = (async () => {
      badgeLease = await ownedAcquire(decorationScope, createAssetRef(type,
        new URL('../../tools/browser-png/assets/rgb-red-green.png', import.meta.url).href));
      if (state === 'closing' || state === 'closed') throw failure('RESOURCE_SCENE_CLOSED');
      // The GPU composition replaces this ordinary badge with its genuine Mesh2D.
      badge = decorationScope.use(new Bitmap(badgeLease)); badge.x = 8; badge.y = 8; badge.scaleX = 8; badge.scaleY = 8;
      engine.stage.addChild(badge);
    })();
    const firstAhem = track(ahemField.prepare()), firstSelection = prepareSelectionText();
    // A restored pair can need four distinct actor images. Finish the badge
    // source first, keeping the existing four-job admission limit unchanged.
    await track(decorations);
    if (state === 'closing' || state === 'closed') throw failure('RESOURCE_SCENE_CLOSED');
    await Promise.all([firstAhem, firstSelection, ...IDS.filter(id => model.actors[id].present).map(beginActor)]);
    if (state === 'closing' || state === 'closed') throw failure('RESOURCE_SCENE_CLOSED');
    state = 'ready';
  }

  function replaceOutfit(id, key) {
    assertOpen(); choice(key, OUTFITS, 'RESOURCE_SCENE_OUTFIT_INVALID'); const record = actorFor(id);
    const intent = {}; record.outfitIntent = intent;
    let original;
    try { original = record.slot.replace(outfitRef(key)); }
    catch (cause) { if (record.outfitIntent === intent) record.outfitIntent = undefined; throw cause; }
    // Return the original slot Promise. Business reaction has its own generation guard.
    track(original.then(() => {
      if (actors.get(id) !== record || !record.live || record.outfitIntent !== intent || state !== 'ready') return;
      record.outfitIntent = undefined; model.actors[id].committedOutfit = key;
      const initial = record.initialLease; record.initialLease = undefined;
      if (initial !== undefined) initial.release();
    }, () => { if (record.outfitIntent === intent) record.outfitIntent = undefined; }));
    return original;
  }
  function replaceAtlas(id, key) {
    assertOpen(); choice(key, ATLASES, 'RESOURCE_SCENE_ATLAS_INVALID'); const record = actorFor(id);
    if (record.atlasIntent !== undefined) return Promise.reject(failure('RESOURCE_SCENE_BUSY'));
    const intent = {}, nextScope = engine.createScope(), nextAnimation = engine.createScope();
    record.atlasIntent = intent;
    const pending = { intent, scope: nextScope, animation: nextAnimation };
    record.pendingAtlas = pending;
    return track((async () => {
      let stopped = false;
      try {
        const lease = await ownedAcquire(nextScope, atlasRef(key)); assertCurrent(record);
        if (record.atlasIntent !== intent) throw failure('RESOURCE_SCENE_GENERATION_RETIRED');
        const sheet = makeSheet(nextScope, lease); sheet.getRegion('zero');
        const oldAtlas = record.atlasScope, oldAnimation = record.animationScope;
        record.playback.stop(); stopped = true;
        record.body.textureLease = lease;
        const playback = engine.createSequencePlayback(nextAnimation, record.body, CLIP, { mode: 'loop' });
        playback.start(); if (model.actors[id].paused) playback.pause();
        assertCurrent(record);
        record.lease = lease; record.playback = playback; record.atlasScope = nextScope; record.animationScope = nextAnimation;
        record.atlasIntent = undefined; record.pendingAtlas = undefined; model.actors[id].atlasKey = key;
        // Publication precedes old-scope cleanup; callbacks cannot rewrite it.
        attempt(() => oldAnimation.dispose()); attempt(() => oldAtlas.dispose());
      } catch (cause) {
        if (record.atlasIntent === intent) record.atlasIntent = undefined;
        if (record.pendingAtlas === pending) record.pendingAtlas = undefined;
        attempt(() => nextAnimation.dispose()); attempt(() => nextScope.dispose());
        if (stopped && actors.get(id) === record) { model.actors[id].present = false; retire(record); }
        throw cause;
      }
    })());
  }
  function close() {
    if (closePromise !== undefined) return closePromise;
    let resolveClose, rejectClose;
    closePromise = new Promise((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    state = 'closing';
    const failures = [];
    let engineClosing;
    function beginEngineClose() {
      try { engineClosing = engine.dispose(); }
      catch (cause) { failures.push(cause); }
    }
    // Revoke genuine Engine/slot authority before yielding to a warm lease reaction.
    // The original Engine still owns its frame and Host barriers.
    if (engine !== undefined) beginEngineClose();
    // Publish one stable result before any original disposer or Host callback.
    void (async () => {
      const keep = async run => { try { await run(); } catch (cause) { failures.push(cause); } };
      try {
        if (engine === undefined) {
          await keep(async () => { engine = await enginePromise; });
          if (engine !== undefined) beginEngineClose();
        }
        if (engine !== undefined) {
          if (engineClosing !== undefined) await keep(() => engineClosing);
          for (const record of [...actors.values()]) retire(record);
          if (cache !== undefined) await keep(() => cache.dispose());
        }
        // Initialization and logical cancellations must settle, but are not new cleanup failures.
        await Promise.resolve(ready).catch(() => undefined);
        if (cache !== undefined) await keep(() => cache.whenIdle());
        while (originalLoads.size > 0) await Promise.all([...originalLoads]);
        while (tasks.size > 0) await Promise.all([...tasks]);
        failures.push(...cleanupObservations);
      } finally { state = 'closed'; }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new EgretError('RESOURCE_SCENE_CLOSE_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    })().then(resolveClose, rejectClose);
    return closePromise;
  }
  const actorViews = {};
  for (const id of IDS) Object.defineProperty(actorViews, id, { enumerable: true, get: () => actors.get(id)?.view });
  Object.freeze(actorViews);
  const scene = Object.freeze({ get engine() { return engine; }, get inputScope() { return inputScope; }, actors: actorViews,
    get badgeLease() { return badgeLease; }, get badge() { return badge; },
    get ahemField() { return ahemField; }, get cjkField() { return cjkField; }, get textReady() { return textReady; } });
  const facade = Object.freeze({
    get ready() { return ready; }, scene,
    inspect() { return Object.freeze({ state, selectedId: model.selectedId, pendingSources: originalLoads.size,
      pendingTasks: tasks.size, diagnostics: Object.freeze([...diagnostics]), cleanupErrors: Object.freeze([...cleanupObservations]) }); },
    selectTarget(target) {
      if (state !== 'ready') return false;
      const record = [...actors.values()].find(value => value.live && value.root === target && !target.isDisposed && target.parent === engine.stage);
      if (record === undefined) return false;
      if (model.selectedId !== record.id) { model.selectedId = record.id; selectionChanged(); }
      return true;
    },
    advanceTo(sourceSeconds) { assertOpen(); engine.advanceTime(sourceSeconds); return facade.inspect(); },
    pause(id) { assertOpen(); const record = actorFor(id); record.playback.pause(); model.actors[id].paused = true; },
    resume(id) { assertOpen(); const record = actorFor(id); record.playback.resume(); model.actors[id].paused = false; },
    replaceOutfit,
    cancelOutfit(id, reason) { assertOpen(); const record = actorFor(id); record.outfitIntent = undefined; record.slot.cancel(reason); },
    replaceAtlas,
    remove(id) { assertOpen(); choice(id, IDS, 'RESOURCE_SCENE_ACTOR_INVALID'); model.actors[id].present = false; const record = actors.get(id); if (record) retire(record); },
    reenter(id) {
      assertOpen(); choice(id, IDS, 'RESOURCE_SCENE_ACTOR_INVALID'); const current = actors.get(id);
      if (current !== undefined) return current.preparation;
      model.actors[id].present = true; return beginActor(id);
    },
    setView(id, value) {
      assertOpen(); const record = actorFor(id);
      if (typeof value?.clip !== 'boolean' || ![0, 90].includes(value.rotation)) throw failure('RESOURCE_SCENE_VIEW_INVALID');
      record.root.clipRect = value.clip ? { x: 0, y: 0, width: 8, height: 16 } : undefined;
      record.root.rotation = value.rotation;
    },
    capture() { assertOpen(); return profile === 'canvas-2d' ? engine.captureFrame(FRAME) : engine.captureTexturedFrame(FRAME); },
    snapshot() {
      const result = { version: 1, selectedId: model.selectedId, actors: {} };
      for (const id of IDS) result.actors[id] = Object.freeze({ ...model.actors[id] });
      Object.freeze(result.actors); return Object.freeze(result);
    }, close,
  });
  ready = initialize();
  // A failed startup owns cleanup too; callers still observe the original ready rejection.
  void ready.catch(() => { if (state === 'starting') { state = 'failed'; void close().catch(() => undefined); } });
  return facade;
}
