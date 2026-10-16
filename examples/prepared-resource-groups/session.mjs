// SPDX-License-Identifier: Apache-2.0
// First-party example composition of public SDK owners; no DOM or private SDK ports.
import { AssetLease, Bitmap, EgretError, Sprite, Texture, createAssetRef,
  createAssetType, createEngine, createEngineForProfile, createSequenceClip,
  createSpriteSheet, isTexture, TEXTURED_FRAME_PROFILE_2D } from '@egret/engine';
import { createTextField, createTextRasterCache } from '@egret/engine/text';
import { createPreparedOutfitCoordinator } from './coordinator.mjs';

const FREEZE = Object.freeze, APPLY = Reflect.apply;
const LEASE_VALUE = Object.getOwnPropertyDescriptor(AssetLease.prototype, 'value').get;
const TEXTURE_IMAGE = Object.getOwnPropertyDescriptor(Texture.prototype, 'imageData').get;
const TEXTURE_RECT = Object.getOwnPropertyDescriptor(Texture.prototype, 'sourceRect').get;
const WEAK_GET = WeakMap.prototype.get;
const SET_SIZE = Object.getOwnPropertyDescriptor(Set.prototype, 'size').get;
const IDS = FREEZE(['pilot-left', 'pilot-right']);
const FULL = FREEZE({ x: 0, y: 0, width: 16, height: 16 });
const FRAME = FREEZE({ width: 192, height: 128, clearColor: 0, clearAlpha: 1 });
const ASSETS = new URL('../resource-scene/assets/', import.meta.url);
const CLIP = createSequenceClip({ atlasWidth: 32, atlasHeight: 16, frames: [
  { ...FULL, durationSeconds: 0.125 }, { ...FULL, x: 16, durationSeconds: 0.125 },
] });
const DEPENDENCIES = FREEZE({
  'atlas-v1': FREEZE({ bytes: 130, sha256: '54f5a801227112caf56f4d3bef92d1018d19dddd85ca13b08099300a62532fdd',
    width: 32, height: 16, revision: 'p02-atlas-v1-r1' }),
  badge: FREEZE({ bytes: 72, sha256: '917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d',
    width: 2, height: 1, revision: 'p02-badge-r1' }),
});
const FONTS = FREEZE({
  ahem: FREEZE({ bytes: 22572, sha256: 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc', revision: 'ahem-fixed-r1' }),
  cjk: FREEZE({ bytes: 1796, sha256: '9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895', revision: 'noto-sc-v41-fixed-r1' }),
});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fault(code, cause) { return new EgretError('PREPARED_SCENE_' + code, { cause }); }
function errorView(value, depth = 0) {
  try {
    const view = { wasUndefined: value === undefined, code: typeof value?.code === 'string' ? value.code : null,
      message: String(value?.message ?? value) };
    if (depth < 8 && value !== null && (typeof value === 'object' || typeof value === 'function')
        && Object.hasOwn(value, 'cause')) view.cause = errorView(value.cause, depth + 1);
    return FREEZE(view);
  } catch { return FREEZE({ wasUndefined: value === undefined, unreadable: true }); }
}

/** Borrow source/dependency adapters; own only this Engine and its composed owners. */
export function createPreparedResourceSceneSession(options) {
  if (!record(options)) throw fault('OPTIONS_INVALID');
  const profile = options.profile;
  if (!['canvas-2d', 'webgpu-scene-textured'].includes(profile)) throw fault('PROFILE_UNSUPPORTED');
  const source = options.outfitSource, dependencies = options.dependencies;
  if (!record(source) || !record(dependencies) || !record(source.provider)
      || typeof source.provider.load !== 'function' || typeof source.provider.dispose !== 'function'
      || !record(source.sourceLedger) || !record(dependencies.textureProvider)
      || typeof dependencies.textureProvider.load !== 'function' || typeof dependencies.textureProvider.dispose !== 'function'
      || !record(dependencies.fontFamilies) || !record(dependencies.fontEvidence)
      || !record(dependencies.textProvider)) throw fault('OPTIONS_INVALID');
  const evidence = dependencies.textureEvidence, sourceTasks = source.sourceLedger.active;
  try {
    APPLY(WEAK_GET, evidence, [{}]); APPLY(WEAK_GET, source.assetEvidence, [{}]);
    APPLY(SET_SIZE, sourceTasks, []);
  } catch (cause) { throw fault('OPTIONS_INVALID', cause); }
  const families = FREEZE({ ahem: dependencies.fontFamilies.ahem, cjk: dependencies.fontFamilies.cjk });
  if (Object.values(families).some(value => typeof value !== 'string' || value.length === 0)) throw fault('OPTIONS_INVALID');
  const dependencyProvider = dependencies.textureProvider;
  const dependencyLoad = dependencyProvider.load, dependencyDispose = dependencyProvider.dispose;
  const limits = options.coordinatorLimits;
  const actors = new Map(), tasks = new Set(), dependencyJobs = new Set(), diagnostics = [], cleanup = [];
  const outfitType = createAssetType('egret.example.prepared-resource-groups.outfit', isTexture);
  const dependencyType = createAssetType('egret.example.prepared-resource-groups.dependency', isTexture);
  const outfitRefs = FREEZE(Object.fromEntries(['A','B','C','D'].map(key =>
    [key, createAssetRef(outfitType, new URL('outfit-' + key + '.png', ASSETS).href)])));
  const atlasRef = createAssetRef(dependencyType, new URL('atlas-v1.png', ASSETS).href);
  const badgeRef = createAssetRef(dependencyType, new URL('../../tools/browser-png/assets/rgb-red-green.png', import.meta.url).href);
  let state = 'starting', selectedId = IDS[0], engine, engineTask, cache, inputScope, decorationScope, textScope;
  let badgeLease, badge, ahemField, cjkField, ready, closePromise, engineClosing;
  let textReady = Promise.resolve();

  function track(original) {
    const settled = Promise.resolve(original).then(() => undefined, () => undefined);
    tasks.add(settled); void settled.then(() => tasks.delete(settled)); return original;
  }
  function remember(operation, cause) { cleanup.push({ operation, cause }); }
  function attempt(operation, run) { try { return run(); } catch (cause) { remember(operation, cause); } }
  function starting() { if (state !== 'starting') throw fault('CLOSED'); }
  function open() { if (state !== 'ready') throw fault(state === 'starting' ? 'NOT_READY' : 'CLOSED'); }
  function actorFor(id) {
    if (!IDS.includes(id)) throw fault('ACTOR_INVALID');
    const actor = actors.get(id);
    if (!actor?.live) throw fault('ACTOR_ABSENT');
    return actor;
  }
  function current(actor) {
    if (!actor.live || actors.get(actor.id) !== actor || state === 'closing' || state === 'closed') throw fault('CLOSED');
  }
  const observedDependencies = FREEZE({
    load(ref, context) {
      const original = APPLY(dependencyLoad, dependencyProvider, [ref, context]);
      dependencyJobs.add(original);
      void Promise.resolve(original).then(() => dependencyJobs.delete(original), () => dependencyJobs.delete(original));
      return original;
    },
    dispose(value) { return APPLY(dependencyDispose, dependencyProvider, [value]); },
  });
  async function ownedAcquire(scope, ref) {
    const lease = await engine.assets.acquire(ref, { signal: scope.signal });
    // A closed genuine Scope retires a late unowned lease through its real owner path.
    return scope.use(lease);
  }
  function checkFontPolicy() {
    if (dependencies.revision !== 'p03-scene-deps-r1') throw fault('DEPENDENCY_INVALID');
    for (const key of ['ahem','cjk']) {
      const value = dependencies.fontEvidence[key], pin = FONTS[key];
      if (!record(value) || value.bytes !== pin.bytes || value.sha256 !== pin.sha256 || value.revision !== pin.revision) {
        throw fault('DEPENDENCY_INVALID');
      }
    }
    // Native font loading/membership belongs to the external DOM adapter, not this CPU policy check.
  }
  function checkTexture(lease, key) {
    try {
      const texture = APPLY(LEASE_VALUE, lease, []), pin = DEPENDENCIES[key];
      if (!isTexture(texture)) throw new TypeError('Live dependency Texture required');
      const actual = APPLY(WEAK_GET, evidence, [texture]);
      const image = APPLY(TEXTURE_IMAGE, texture, []), rect = APPLY(TEXTURE_RECT, texture, []);
      if (actual === undefined || actual.key !== key || actual.bytes !== pin.bytes || actual.sha256 !== pin.sha256
          || actual.width !== pin.width || actual.height !== pin.height || actual.revision !== pin.revision
          || image.width !== pin.width || image.height !== pin.height
          || rect.x !== 0 || rect.y !== 0 || rect.width !== pin.width || rect.height !== pin.height) {
        throw new TypeError('Fixed dependency identity or complete view differs');
      }
    } catch (cause) { throw fault('DEPENDENCY_INVALID', cause); }
  }
  function checkLiveDependencies() {
    checkFontPolicy(); checkTexture(badgeLease, 'badge');
    for (const actor of actors.values()) {
      if (actor.live) checkTexture(actor.atlasLease, 'atlas-v1');
    }
    if (ahemField?.isDisposed || cjkField?.isDisposed) throw fault('DEPENDENCY_INVALID');
  }
  function allocateActor(id) {
    const actor = { id, generation: {}, live: true, root: undefined, body: undefined, outer: undefined, trim: undefined,
      atlasLease: undefined, playback: undefined, coordinator: undefined, selection: undefined,
      displayScope: engine.createScope(), atlasScope: engine.createScope(), animationScope: engine.createScope(),
      coordinatorScope: engine.createScope(), initialScope: engine.createScope() };
    const view = {};
    for (const key of ['root','body','outer','trim','atlasLease','playback','coordinator']) {
      Object.defineProperty(view, key, { enumerable: true, get: () => actor[key] });
    }
    actor.view = FREEZE(view); actors.set(id, actor); return actor;
  }
  function retireActor(actor) {
    if (!actor.live) return;
    actor.live = false;
    if (actors.get(actor.id) === actor) actors.delete(actor.id);
    // Application generation and publication authority retire before lease-owning Scopes.
    attempt(actor.id + ':coordinator', () => actor.coordinator?.dispose());
    attempt(actor.id + ':animation', () => actor.animationScope.dispose());
    attempt(actor.id + ':coordinator-scope', () => actor.coordinatorScope.dispose());
    attempt(actor.id + ':detach', () => { if (actor.root?.parent) actor.root.parent.removeChild(actor.root); });
    attempt(actor.id + ':display', () => actor.displayScope.dispose());
    attempt(actor.id + ':initial-group', () => actor.initialScope.dispose());
    attempt(actor.id + ':atlas', () => actor.atlasScope.dispose());
  }
  async function prepareActor(actor) {
    current(actor);
    // Scope and actor records already exist before provider activation/reentry.
    const group = engine.createAssetGroup(actor.initialScope, [outfitRefs.A, outfitRefs.B]);
    const members = await group.ready;
    current(actor);
    const sheet = actor.atlasScope.use(createSpriteSheet(actor.atlasLease,
      [{ name: 'zero', ...FULL }, { name: 'one', ...FULL, x: 16 }]));
    const root = actor.displayScope.use(new Sprite()); actor.root = root;
    const selection = actor.displayScope.use(new Sprite()); actor.selection = selection;
    selection.graphics.beginFill(0xffffff).drawRect(-1, -1, 18, 18).endFill(); selection.visible = selectedId === actor.id;
    actor.body = actor.displayScope.use(sheet.createBitmap('zero'));
    actor.outer = actor.displayScope.use(new Bitmap(members[0]));
    actor.trim = actor.displayScope.use(new Bitmap(members[1])); actor.trim.y = 4;
    root.x = actor.id === IDS[0] ? 56 : 136; root.y = 96; root.scaleX = 3; root.scaleY = 3;
    root.anchorOffsetX = 8; root.anchorOffsetY = 16; root.hitArea = FULL; root.touchEnabled = true; root.touchChildren = false;
    root.addChild(selection); root.addChild(actor.body); root.addChild(actor.outer); root.addChild(actor.trim); engine.stage.addChild(root);
    actor.playback = engine.createSequencePlayback(actor.animationScope, actor.body, CLIP, { mode: 'loop' }); actor.playback.start();
    actor.coordinator = createPreparedOutfitCoordinator({ engine, sceneScope: actor.coordinatorScope,
      targets: [actor.outer,actor.trim], initial: { key: 'classic', group, groupScope: actor.initialScope, members },
      refs: outfitRefs, assetEvidence: source.assetEvidence, sourceLedger: source.sourceLedger, limits });
    current(actor);
  }
  function textRequest(text, family, fontSize, lineHeight, locale) {
    return { text, fontFamily: family, fontSize, lineHeight, fontWeight: 400, fontStyle: 'normal',
      locale, direction: 'ltr', density: 1, fillColor: 0xffffff };
  }
  function prepareSelection() {
    cjkField.setRequest(textRequest(selectedId === IDS[0] ? '左侧 已选择' : '右侧 已选择', families.cjk, 12, 16, 'zh-CN'));
    textReady = track(cjkField.prepare()); return textReady;
  }
  async function initialize() {
    checkFontPolicy();
    const engineOptions = { host: options.host, onDiagnostic(value) { if (diagnostics.length < 256) diagnostics.push(value); } };
    engineTask = profile === 'canvas-2d' ? createEngine(engineOptions) : createEngineForProfile(engineOptions, TEXTURED_FRAME_PROFILE_2D);
    engine = await engineTask; starting();
    engine.assets.register(outfitType, source.provider); engine.assets.register(dependencyType, observedDependencies);
    engine.advanceTime(0); inputScope = engine.createScope(); decorationScope = engine.createScope(); textScope = engine.createScope();
    cache = createTextRasterCache(engine.assets, { provider: dependencies.textProvider });
    const pair = IDS.map(allocateActor);
    await Promise.all([track(ownedAcquire(decorationScope, badgeRef).then(lease => { badgeLease = lease; })),
      ...pair.map(actor => track(ownedAcquire(actor.atlasScope, atlasRef).then(lease => { actor.atlasLease = lease; })))]);
    starting(); checkLiveDependencies();
    // Complete shared dependency verification precedes activation of either outfit group.
    for (const x of [24,104]) {
      const card = decorationScope.use(new Sprite());
      card.graphics.beginFill(0x404040).drawRect(x, 40, 64, 64).endFill(); engine.stage.addChild(card);
    }
    badge = decorationScope.use(new Bitmap(badgeLease)); badge.x = 8; badge.y = 8; badge.scaleX = 8; badge.scaleY = 8;
    engine.stage.addChild(badge);
    ahemField = createTextField(engine, textScope, cache); ahemField.x = 32; ahemField.y = 8;
    ahemField.setRequest(textRequest('X X', families.ahem, 8, 8, 'en'));
    cjkField = createTextField(engine, textScope, cache); cjkField.x = 72; cjkField.y = 8;
    engine.stage.addChild(ahemField); engine.stage.addChild(cjkField);
    await Promise.all([track(ahemField.prepare()), prepareSelection(), ...pair.map(actor => track(prepareActor(actor)))]);
    starting(); checkLiveDependencies(); state = 'ready';
  }
  function beginEngineClose() {
    if (engine === undefined || engineClosing !== undefined) return;
    try { engineClosing = engine.dispose(); }
    catch (cause) { remember('engine.dispose', cause); }
  }
  function close() {
    if (closePromise !== undefined) return closePromise;
    let resolveClose, rejectClose;
    closePromise = new Promise((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    void closePromise.catch(() => undefined);
    state = 'closing';
    // Cache the original result and terminal state before any disposer or abort callback.
    for (const actor of [...actors.values()]) retireActor(actor);
    beginEngineClose();
    void (async () => {
      const keep = async (operation, run) => { try { await run(); } catch (cause) { remember(operation, cause); } };
      try {
        if (engine === undefined && engineTask !== undefined) {
          // Startup failure belongs to ready; it is not a new cleanup failure.
          await Promise.resolve(engineTask).then(value => { engine = value; }, () => undefined);
          beginEngineClose();
        }
        if (engineClosing !== undefined) await keep('engine close barrier', () => engineClosing);
        await Promise.resolve(ready).catch(() => undefined);
        await keep('text cache dispose', () => cache?.dispose());
        await keep('text cache idle', () => cache?.whenIdle());
        while (tasks.size > 0) await Promise.allSettled([...tasks]);
        while (dependencyJobs.size > 0) await Promise.allSettled([...dependencyJobs]);
        while (APPLY(SET_SIZE, sourceTasks, []) > 0) await Promise.allSettled([...sourceTasks]);
      } finally { state = 'closed'; }
      // Array presence, not cause truthiness, preserves a cleanup throw(undefined).
      if (cleanup.length === 1) throw cleanup[0].cause;
      if (cleanup.length > 1) throw new EgretError('PREPARED_SCENE_CLOSE_FAILED',
        { cause: cleanup[0].cause, cleanupErrors: cleanup.slice(1).map(row => row.cause) });
    })().then(resolveClose, rejectClose);
    return closePromise;
  }
  const actorViews = {};
  for (const id of IDS) Object.defineProperty(actorViews, id, { enumerable: true, get: () => actors.get(id)?.view });
  FREEZE(actorViews);
  const scene = FREEZE({
    get engine() { return engine; }, get inputScope() { return inputScope; },
    get badgeLease() { return badgeLease; }, get badge() { return badge; },
    get ahemField() { return ahemField; }, get cjkField() { return cjkField; },
    get textReady() { return textReady; }, outfitRefs, actors: actorViews,
  });
  const facade = FREEZE({
    get ready() { return ready; }, scene,
    inspect() {
      const snapshots = Object.fromEntries(IDS.map(id => [id, actors.get(id)?.coordinator?.snapshot() ?? null]));
      return FREEZE({ state, selectedId, actors: FREEZE(snapshots), pendingTasks: tasks.size,
        diagnostics: FREEZE(diagnostics.map(value => FREEZE({ code: value.code, phase: value.phase, severity: value.severity,
          cause: errorView(value.cause) }))),
        cleanupErrors: FREEZE(cleanup.map(row => FREEZE({ operation: row.operation, error: errorView(row.cause) }))) });
    },
    replaceOutfit(id, key) {
      open(); const actor = actorFor(id); checkLiveDependencies();
      return track(actor.coordinator.replace(key));
    },
    cancelOutfit(id, reason) { open(); actorFor(id).coordinator.cancel(reason); },
    selectTarget(target) {
      if (state !== 'ready') return false;
      const actor = [...actors.values()].find(value => value.live && value.root === target
        && !target.isDisposed && target.parent === engine.stage);
      if (actor === undefined) return false;
      if (selectedId !== actor.id) {
        selectedId = actor.id;
        for (const currentActor of actors.values()) currentActor.selection.visible = currentActor.id === selectedId;
        void prepareSelection().catch(() => undefined);
      }
      return true;
    },
    advanceTo(seconds) { open(); engine.advanceTime(seconds); },
    remove(id) { open(); if (!IDS.includes(id)) throw fault('ACTOR_INVALID'); const actor = actors.get(id); if (actor) retireActor(actor); },
    capture() { open(); return profile === 'canvas-2d' ? engine.captureFrame(FRAME) : engine.captureTexturedFrame(FRAME); },
    close,
  });
  ready = initialize();
  void ready.catch(() => { if (state === 'starting') void close().catch(() => undefined); });
  return facade;
}
