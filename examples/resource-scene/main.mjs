// SPDX-License-Identifier: Apache-2.0
import { createAssetRef, EgretError } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createMouseInput } from '@egret/engine/web/input';
import { createResourceSceneSession } from './session.mjs';

const WIDTH = 192, HEIGHT = 128;
const IDS = Object.freeze(['pilot-left', 'pilot-right']);
const profile = new URL(location.href).searchParams.get('profile') ?? 'canvas-2d';
const element = id => document.getElementById(id);
const trace = [], faults = [], epochs = [], replays = [];
const imagePins = new Map([
  ['atlas-v1.png', 130, '54f5a801227112caf56f4d3bef92d1018d19dddd85ca13b08099300a62532fdd'],
  ['atlas-v2.png', 129, '006e69af587d0471da17b1fa5c40949ffc3f2ec21bab0ce4f73d77bd18e8fea2'],
  ['outfit-A.png', 83, '376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960'],
  ['outfit-B.png', 80, 'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78'],
  ['outfit-C.png', 81, 'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66'],
  ['outfit-D.png', 83, 'd2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98'],
].map(([name, bytes, sha256]) => [new URL('./assets/' + name, import.meta.url).href, { name, bytes, sha256 }]));
imagePins.set(new URL('../../tools/browser-png/assets/rgb-red-green.png', import.meta.url).href,
  { name: 'badge', bytes: 72, sha256: '917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d' });
const fontPins = Object.freeze([
  { key: 'ahem', path: '../canvas-text/assets/ahem.ttf', bytes: 22572,
    sha256: 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc', size: 8, text: 'X X XX' },
  { key: 'cjk', path: './assets/NotoSansSC-fixed.woff2', bytes: 1796,
    sha256: '9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895', size: 12, text: '左侧 已选择右侧' },
]);
let state = 'starting', current, savedBaseline, retainedModel, lastPixels, closePromise, transition;
let closeRequested = false, nextSource = 0, nextRequest = 0, nextPresentation = 0;

function fault(code, cause) { return new EgretError(code, { cause }); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}
function errorView(cause, depth = 0) {
  const row = { wasUndefined: cause === undefined, code: typeof cause?.code === 'string' ? cause.code : null,
    message: String(cause?.message ?? cause) };
  if (depth < 8 && cause !== null && (typeof cause === 'object' || typeof cause === 'function')
      && Object.hasOwn(cause, 'cause')) row.cause = errorView(cause.cause, depth + 1);
  if (depth < 8 && Array.isArray(cause?.cleanupErrors)) row.cleanupErrors = cause.cleanupErrors.map(value => errorView(value, depth + 1));
  return row;
}
function observe(kind, data = {}) {
  if (trace.length < 256) trace.push({ index: trace.length, kind, ...data });
}
function unexpected(operation, cause) {
  if (faults.length < 256) faults.push({ operation, error: errorView(cause) });
  observe('operation-failed', { operation, error: errorView(cause) }); refresh();
}
function assertAdmitted() {
  if (state !== 'ready' || closeRequested) throw fault('RESOURCE_SCENE_NOT_INTERACTIVE');
  if (trace.length >= 256) throw fault('RESOURCE_SCENE_TRACE_LIMIT');
  return current;
}
function assertStarting(record) {
  if (record.retired || closeRequested) throw fault('RESOURCE_SCENE_CLOSED');
}
function pending(record) {
  const view = record.session?.inspect();
  return !record.interactive || view?.pendingSources > 0 || view?.pendingTasks > 0
    || record.requests.some(row => row.outcome === 'pending')
    || record.loads.some(row => row.outcome === 'pending')
    || record.reads.some(row => row.outcome === 'pending')
    || record.presentations.some(row => row.outcome === 'pending') || record.presentationPending > 0 || record.warmPending > 0;
}
function assertQuiescent() {
  const record = assertAdmitted();
  if (pending(record)) throw fault('RESOURCE_SCENE_BUSY');
  return record;
}
async function verifiedBytes(url, pin) {
  // CancellationSignal belongs to the SDK. Native fetch has its own lifetime.
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw fault('RESOURCE_SCENE_HTTP_FAILED', response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const sha256 = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
  if (bytes.byteLength !== pin.bytes || sha256 !== pin.sha256) throw fault('RESOURCE_SCENE_ASSET_IDENTITY');
  return bytes;
}
function newCanvas() {
  const canvas = document.createElement('canvas'); canvas.id = 'scene'; canvas.width = WIDTH; canvas.height = HEIGHT;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Two animated pilots / 两名动画角色');
  canvas.setAttribute('aria-describedby', 'scene-description');
  const previous = element('scene');
  if (previous) previous.replaceWith(canvas); else element('scene-description').after(canvas);
  return canvas;
}
function allocate(restore) {
  const resources = deferred();
  const record = { epoch: epochs.length + 1, hostId: 'epoch-' + (epochs.length + 1),
    canvas: epochs.length === 0 ? element('scene') : newCanvas(), restore,
    resources, retired: false, interactive: false, resourceReady: false, frameReady: false, sourceSeconds: 0,
    session: undefined, host: undefined, provider: undefined, gpu: undefined, input: undefined,
    families: {}, fonts: [], reads: [], loads: [], requests: [], disposals: [], presentations: [],
    events: [], ticks: [], warm: new Set(), warmPending: 0, warmRequests: [], holdNext: false, assetType: undefined,
    serial: Promise.resolve(), presentationPending: 0, closePromise: undefined, cleanup: [], safeSurface: false };
  epochs.push(record); return record;
}
async function prepareFonts(record) {
  for (const pin of fontPins) {
    assertStarting(record);
    const row = { key: pin.key, family: 'EgretResource_' + pin.key + '_' + crypto.randomUUID().replaceAll('-', ''),
      face: undefined, loaded: false, member: false, exactSelectedFace: false, removed: false };
    record.fonts.push(row); record.families[pin.key] = row.family;
    const bytes = await verifiedBytes(new URL(pin.path, import.meta.url), pin);
    assertStarting(record);
    const face = new FontFace(row.family, bytes.buffer, { weight: '400', style: 'normal' }); row.face = face;
    await face.load(); assertStarting(record);
    if (face.status !== 'loaded' || [...document.fonts].some(value => value.family === row.family)) throw fault('RESOURCE_SCENE_FONT_IDENTITY');
    document.fonts.add(face); row.member = true; row.loaded = true;
    const font = 'normal 400 ' + pin.size + 'px "' + row.family + '"';
    const selected = await document.fonts.load(font, pin.text); assertStarting(record);
    if (selected.length !== 1 || selected[0] !== face || !document.fonts.has(face)
        || [...document.fonts].filter(value => value.family === row.family).length !== 1
        || !document.fonts.check(font, pin.text)) throw fault('RESOURCE_SCENE_FONT_IDENTITY');
    // Exact membership and selection are readiness facts. Finite glyph pixels
    // have a separate no-SDK reference; these checks are not a cmap inspection.
    row.exactSelectedFace = true; observe('font-ready', { epoch: record.epoch, key: pin.key });
  }
}
function readImage(record, ref, context) {
  const pin = imagePins.get(ref.id);
  if (!pin) return Promise.reject(fault('RESOURCE_SCENE_IMAGE_NOT_SELECTED'));
  const held = record.holdNext;
  if (held && record.reads.filter(row => row.gate && !row.gateSettled).length >= 2) return Promise.reject(fault('RESOURCE_SCENE_HELD_LIMIT'));
  record.holdNext = false;
  const row = { id: ++nextSource, name: pin.name, outcome: 'pending', phase: 'fetch',
    signal: context.signal, abortedAtStart: context.signal.aborted, gate: held ? deferred() : undefined,
    gateSettled: false, bytesVerified: false, error: undefined, promise: undefined };
  record.reads.push(row); observe('source-start', { epoch: record.epoch, id: row.id, name: row.name, held });
  const original = (async () => {
    const bytes = await verifiedBytes(ref.id, pin); row.bytesVerified = true;
    row.phase = held ? 'held' : 'delivering'; observe('source-bytes', { id: row.id, name: row.name }); refresh();
    if (row.gate) await row.gate.promise;
    return bytes;
  })();
  row.promise = original;
  void original.then(() => { row.outcome = 'fulfilled'; row.phase = 'settled'; observe('source-settled', { id: row.id, outcome: row.outcome }); refresh(); },
    cause => { row.outcome = 'rejected'; row.phase = 'settled'; row.error = errorView(cause);
      if (row.gate && !row.gateSettled) { row.gateSettled = true; row.gate.resolve(); }
      observe('source-settled', { id: row.id, outcome: row.outcome }); refresh(); });
  return original;
}
function observeProvider(record, provider) {
  const load = provider.load, dispose = provider.dispose;
  return Object.freeze({
    load(ref, context) {
      record.assetType ??= ref.type;
      const row = { name: imagePins.get(ref.id)?.name ?? ref.id, outcome: 'pending', signal: context.signal,
        texture: undefined, error: undefined, promise: undefined };
      const original = Reflect.apply(load, provider, [ref, context]); row.promise = original; record.loads.push(row);
      void original.then(value => { row.outcome = 'fulfilled'; row.texture = value;
        observe('texture-issued', { epoch: record.epoch, name: row.name }); refresh(); },
      cause => { row.outcome = 'rejected'; row.error = errorView(cause); observe('texture-refused', { epoch: record.epoch, name: row.name, error: row.error }); refresh(); });
      return original;
    },
    dispose(value) {
      const source = record.loads.find(row => row.texture === value);
      const row = { name: source?.name ?? null, outcome: 'attempted', error: undefined }; record.disposals.push(row);
      try { Reflect.apply(dispose, provider, [value]); row.outcome = 'fulfilled'; }
      catch (cause) { row.outcome = 'rejected'; row.error = errorView(cause); throw cause; }
      finally { observe('texture-disposed', { epoch: record.epoch, name: row.name, outcome: row.outcome }); }
    },
  });
}
function captureStatus(host) {
  return profile === 'webgpu-scene-textured' ? { host: host?.getStatus() ?? null,
    textured: host?.getTexturedStatus() ?? null, scene: host?.getSceneStatus() ?? null } : null;
}
function makeHost(canvas, gpu) {
  return profile === 'canvas-2d' ? createCanvasHost({ canvas, pixelRatio: 1 })
    : gpu.createTexturedSceneWebGPUHost({ canvas, pixelRatio: 1, enableReadback: true,
      onDiagnostic(value) { observe('host-diagnostic', { code: value.code, phase: value.phase }); } });
}
async function draw(record, label, overlay, scene) {
  const row = { id: ++nextPresentation, epoch: record.epoch ?? null, hostId: record.hostId, label, outcome: 'pending',
    frameId: overlay.frameId, serial: null, readback: 'not-requested', idle: false, error: undefined, promise: undefined };
  record.presentations.push(row); observe('frame-submitted', { epoch: row.epoch, id: row.id, label });
  try {
    if (profile === 'webgpu-scene-textured') {
      const original = record.host.requestReadback(); row.promise = original; row.readback = 'pending';
      // Observe rejection even if the synchronous renderer refuses the frame.
      void original.catch(() => undefined);
      record.host.renderSceneTexturedFrame(scene, overlay);
      const result = await original; row.readback = 'fulfilled'; row.serial = result.serial;
      await record.host.whenIdle(); row.idle = true;
      lastPixels = { label, epoch: row.epoch, hostId: row.hostId, frameId: result.frameId, serial: result.serial,
        width: result.width, height: result.height, bytes: new Uint8Array(result.bytes) };
    } else {
      record.host.renderFrame(overlay);
      const result = record.canvas.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT);
      lastPixels = { label, epoch: row.epoch, hostId: row.hostId, frameId: overlay.frameId, serial: null,
        width: result.width, height: result.height, bytes: new Uint8Array(result.data) };
      row.idle = true;
    }
    row.outcome = 'fulfilled'; observe('frame-ready', { epoch: row.epoch, id: row.id, label });
  } catch (cause) { row.outcome = 'rejected'; row.error = errorView(cause); throw cause; }
}
function checkpoint(label, sceneChoice = 'normal') {
  const record = assertAdmitted();
  if (typeof label !== 'string' || !/^[a-z0-9-]{1,64}$/.test(label)) throw fault('RESOURCE_SCENE_LABEL_INVALID');
  if (!['normal', 'reverse-order', 'wrong-depth'].includes(sceneChoice)
      || (profile === 'canvas-2d' && sceneChoice !== 'normal')) throw fault('RESOURCE_SCENE_PROFILE_UNSUPPORTED');
  record.presentationPending++;
  const original = record.serial.then(async () => {
    if (record.retired) throw fault('RESOURCE_SCENE_CLOSED');
    await record.session.scene.textReady;
    if (record.retired) throw fault('RESOURCE_SCENE_CLOSED');
    const scene = sceneChoice === 'reverse-order' ? record.composition?.sceneWithReversedDrawOrder
      : sceneChoice === 'wrong-depth' ? record.composition?.sceneWithWrongDepth : record.composition?.scene;
    await draw(record, label, record.session.capture(), scene); refresh(); return inspect();
  });
  record.serial = original.then(() => { record.presentationPending--; refresh(); },
    () => { record.presentationPending--; refresh(); });
  refresh(); return original;
}
function recordRequest(record, kind, id, key, original) {
  const row = { id: ++nextRequest, kind, actor: id, key: key ?? null, outcome: 'pending', error: undefined, promise: original };
  record.requests.push(row); observe('request', { id: row.id, kind, actor: id, key: row.key });
  void original.then(() => { row.outcome = 'fulfilled'; observe('request-settled', { id: row.id, outcome: row.outcome }); refresh(); },
    cause => { row.outcome = 'rejected'; row.error = errorView(cause); observe('request-settled', { id: row.id, outcome: row.outcome, error: row.error }); refresh(); });
  refresh(); return original;
}
function control(method, ...args) {
  const record = assertAdmitted();
  const original = Reflect.apply(record.session[method], record.session, args);
  observe(method, { epoch: record.epoch, actor: args[0] ?? null }); refresh(); return original;
}
function select(id) {
  const record = assertAdmitted();
  if (!IDS.includes(id)) throw fault('RESOURCE_SCENE_ACTOR_INVALID');
  const target = record.session.scene.actors[id]?.root;
  const result = target !== undefined && record.session.selectTarget(target);
  observe('selection', { actor: id, accepted: result }); refresh(); return result;
}
function advanceTo(sourceSeconds) {
  const record = assertAdmitted(), result = record.session.advanceTo(sourceSeconds);
  record.sourceSeconds = sourceSeconds; observe('advance', { sourceSeconds }); refresh(); return result;
}
function settleSource(record, id, kind) {
  const row = record.reads.find(value => value.id === id);
  if (!row?.gate || row.gateSettled) throw fault('RESOURCE_SCENE_HELD_SOURCE_REQUIRED');
  if (!['release', 'undefined', 'error'].includes(kind)) throw fault('RESOURCE_SCENE_FAILURE_KIND_INVALID');
  row.gateSettled = true;
  if (kind === 'release') row.gate.resolve();
  else if (kind === 'undefined') row.gate.reject(undefined);
  else if (kind === 'error') row.gate.reject(new Error('Authored image delivery failure ' + id));
  observe('source-delivery', { id, kind }); refresh();
}
function holdNext() {
  const record = assertAdmitted();
  if (record.reads.filter(row => row.gate && !row.gateSettled).length >= 2) throw fault('RESOURCE_SCENE_HELD_LIMIT');
  record.holdNext = true; observe('hold-next', { epoch: record.epoch }); refresh();
}
function warmOutfit(key) {
  const record = assertAdmitted();
  if (!['A', 'B', 'C', 'D'].includes(key) || record.assetType === undefined) throw fault('RESOURCE_SCENE_OUTFIT_INVALID');
  if (record.warmPending + record.warm.size >= 1) throw fault('RESOURCE_SCENE_WARM_LIMIT');
  const original = record.session.scene.engine.assets.acquire(createAssetRef(record.assetType,
    new URL('./assets/outfit-' + key + '.png', import.meta.url).href));
  const row = { key, outcome: 'pending', leaseId: null, error: undefined, promise: original };
  record.warmRequests.push(row); observe('warm-start', { epoch: record.epoch, key });
  record.warmPending++;
  void original.then(lease => {
    record.warmPending--; row.outcome = 'fulfilled'; row.leaseId = lease.leaseId;
    if (record.retired) {
      try { lease.release(); } catch (cause) { record.cleanup.push({ operation: 'late-warm-release', cause }); }
    } else record.warm.add(lease);
    observe('warm-settled', { epoch: record.epoch, key, outcome: row.outcome }); refresh();
  }, cause => {
    record.warmPending--; row.outcome = 'rejected'; row.error = errorView(cause);
    observe('warm-settled', { epoch: record.epoch, key, outcome: row.outcome }); refresh();
  });
  return original;
}
function releaseWarm(lease) {
  const record = assertAdmitted();
  if (!record.warm.delete(lease)) throw fault('RESOURCE_SCENE_WARM_LEASE_REQUIRED');
  lease.release(); observe('warm-release', { epoch: record.epoch }); refresh();
}
async function initialize(record, label) {
  try {
    if (!['canvas-2d', 'webgpu-scene-textured'].includes(profile)) throw fault('RESOURCE_SCENE_PROFILE_UNSUPPORTED');
    await prepareFonts(record); assertStarting(record);
    // Only an explicit GPU profile evaluates its optional scene/Host modules.
    if (profile === 'webgpu-scene-textured') record.gpu = await import('./gpu-scene.mjs');
    assertStarting(record);
    record.host = makeHost(record.canvas, record.gpu);
    record.provider = createBrowserTextureProvider({ readBytes(ref, context) { return readImage(record, ref, context); } });
    record.session = createResourceSceneSession({ host: record.host, profile, restore: record.restore,
      textureProvider: observeProvider(record, record.provider), textProvider: createCanvasTextRasterProvider(), fontFamilies: record.families });
    await record.session.ready; assertStarting(record);
    if (record.gpu) record.composition = record.gpu.createResourceSceneGPU({ session: record.session });
    record.resourceReady = true; record.resources.resolve(); observe('resources-ready', { epoch: record.epoch }); refresh();
    const overlay = record.session.capture(), scene = record.composition?.scene;
    await draw(record, label, overlay, scene); assertStarting(record);
    if (savedBaseline === undefined) savedBaseline = Object.freeze({ overlay, scene });
    record.frameReady = true;
    record.input = createMouseInput({ engine: record.session.scene.engine, scope: record.session.scene.inputScope, width: WIDTH, height: HEIGHT });
    for (const kind of ['begin', 'end', 'activate', 'cancel']) {
      record.session.scene.engine.stage.on(record.input.events[kind], event => {
        if (!record.interactive || record.retired || state !== 'ready' || trace.length >= 256) return;
        const actor = IDS.find(id => record.session.scene.actors[id]?.root === event.target) ?? null;
        record.events.push({ kind, actor, ...event.payload }); observe('input', { kind, actor, x: event.payload.globalX, y: event.payload.globalY });
        if (kind === 'activate' && trace.length < 256 && record.session.selectTarget(event.target)) {
          // Synchronous SDK callback; presentation observes its own Promise.
          void checkpoint('input-selection').catch(cause => unexpected('input presentation', cause));
        }
        refresh();
      }, { signal: record.session.scene.inputScope.signal });
    }
    record.session.scene.engine.clock.onTick(record.session.scene.inputScope, tick => {
      record.ticks.push({ ...tick }); observe('tick', { ...tick });
    });
    record.interactive = true; observe('interactive-ready', { epoch: record.epoch });
  } catch (cause) { record.resources.reject(cause); throw cause; }
}
function retireEpoch(record) {
  if (record.closePromise !== undefined) return record.closePromise;
  const completion = deferred(); record.closePromise = completion.promise;
  record.retired = true; record.interactive = false; record.holdNext = false;
  // Retire logical authority synchronously, before any queued warm-lease reaction.
  let engineClose;
  try { if (record.session) engineClose = record.session.close(); }
  catch (cause) { record.cleanup.push({ operation: 'session-close-call', cause }); }
  if (engineClose !== undefined) void engineClose.catch(() => undefined);
  for (const row of record.reads) if (row.gate && !row.gateSettled) settleSource(record, row.id, 'release');
  for (const lease of record.warm) {
    record.warm.delete(lease);
    try { lease.release(); } catch (cause) { record.cleanup.push({ operation: 'warm-release', cause }); }
  }
  void (async () => {
    const keep = async (operation, work) => { try { return await work(); }
      catch (cause) { record.cleanup.push({ operation, cause }); } };
    await Promise.resolve(record.initialization).catch(() => undefined);
    if (record.session && engineClose === undefined) {
      try { engineClose = record.session.close(); } catch (cause) { record.cleanup.push({ operation: 'session-close-call', cause }); }
    }
    if (engineClose !== undefined) await keep('session-close', () => engineClose);
    await record.serial;
    await Promise.allSettled(record.requests.map(row => row.promise));
    await Promise.allSettled(record.warmRequests.map(row => row.promise));
    await Promise.allSettled(record.loads.map(row => row.promise));
    await Promise.allSettled(record.reads.map(row => row.promise));
    await Promise.allSettled(record.presentations.flatMap(row => row.promise ? [row.promise] : []));
    if (record.provider) await keep('png-provider-close', () => record.provider.close());
    let hostClosed = record.host === undefined;
    if (record.host) await keep('host-close', async () => { await record.host.close(); hostClosed = true; });
    record.safeSurface = hostClosed && (record.host === undefined || profile !== 'webgpu-scene-textured' || record.host.getStatus().cleanupOutcome === 'safe');
    for (const row of record.fonts) await keep('font-remove', () => {
      if (row.face && document.fonts.has(row.face)) document.fonts.delete(row.face);
      row.member = row.face ? document.fonts.has(row.face) : false; row.removed = !row.member;
      if (row.member) throw fault('RESOURCE_SCENE_FONT_CLEANUP_FAILED');
    });
    if (record.safeSurface) await keep('surface-retire', () => { record.canvas.width = 0; record.canvas.height = 0; record.canvas.remove(); });
    else record.cleanup.push({ operation: 'surface-quarantined', cause: fault('RESOURCE_SCENE_HOST_UNSAFE') });
    observe('epoch-closed', { epoch: record.epoch, safeSurface: record.safeSurface, cleanupFailures: record.cleanup.length }); refresh();
    if (record.cleanup.length === 1) throw record.cleanup[0].cause;
    if (record.cleanup.length > 1) throw new EgretError('RESOURCE_SCENE_CLOSE_FAILED', {
      cause: record.cleanup[0].cause, cleanupErrors: record.cleanup.slice(1).map(row => row.cause) });
  })().then(completion.resolve, completion.reject);
  return record.closePromise;
}
function restart() {
  if (state !== 'suspended') assertQuiescent();
  else if (closeRequested || trace.length >= 256) throw fault('RESOURCE_SCENE_NOT_INTERACTIVE');
  const previous = current, model = previous?.session?.snapshot() ?? retainedModel;
  state = 'restarting'; refresh();
  const original = (async () => {
    if (previous) await retireEpoch(previous);
    if (closeRequested) throw fault('RESOURCE_SCENE_CLOSED');
    current = allocate(model); current.initialization = initialize(current, 'reconstructed');
    await current.initialization;
    if (closeRequested) throw fault('RESOURCE_SCENE_CLOSED');
    state = 'ready'; refresh(); return inspect();
  })();
  transition = original; void original.catch(cause => { if (!closeRequested) { state = 'failed'; unexpected('restart', cause); } });
  return original;
}
function replay() {
  const previous = assertQuiescent();
  if (!savedBaseline) throw fault('RESOURCE_SCENE_SAVED_FRAME_REQUIRED');
  retainedModel = previous.session.snapshot(); state = 'replaying'; refresh();
  const original = (async () => {
    await retireEpoch(previous); current = undefined;
    if (closeRequested) throw fault('RESOURCE_SCENE_CLOSED');
    const record = { epoch: null, hostId: 'replay-' + (replays.length + 1),
      canvas: newCanvas(), host: undefined, presentations: [], cleanup: [], safeSurface: false };
    replays.push(record);
    let failed = false, primary;
    try {
      record.host = makeHost(record.canvas, previous.gpu); await record.host.start();
      if (closeRequested) throw fault('RESOURCE_SCENE_CLOSED');
      await draw(record, 'saved-replay', savedBaseline.overlay, savedBaseline.scene);
    } catch (cause) { failed = true; primary = cause; }
    let hostClosed = record.host === undefined;
    try { if (record.host) { record.host.stop(); await record.host.close(); hostClosed = true; } }
    catch (cause) { record.cleanup.push(cause); }
    record.safeSurface = hostClosed && (record.host === undefined || profile !== 'webgpu-scene-textured' || record.host.getStatus().cleanupOutcome === 'safe');
    if (record.safeSurface) {
      try { record.canvas.width = 0; record.canvas.height = 0; record.canvas.remove(); } catch (cause) { record.cleanup.push(cause); }
    } else record.cleanup.push(fault('RESOURCE_SCENE_HOST_UNSAFE'));
    if (failed) {
      if (record.cleanup.length) throw new EgretError('RESOURCE_SCENE_REPLAY_FAILED', { cause: primary, cleanupErrors: record.cleanup });
      throw primary;
    }
    if (record.cleanup.length) throw new EgretError('RESOURCE_SCENE_REPLAY_FAILED', { cause: record.cleanup[0], cleanupErrors: record.cleanup.slice(1) });
    if (!closeRequested) state = 'suspended'; observe('saved-replay-closed', { safeSurface: record.safeSurface }); refresh(); return inspect();
  })();
  transition = original; void original.catch(cause => { if (!closeRequested) { state = 'failed'; unexpected('replay', cause); } });
  return original;
}
function close() {
  if (closePromise !== undefined) return closePromise;
  const completion = deferred(); closePromise = completion.promise;
  closeRequested = true; state = 'closing';
  const failures = []; let retiring;
  try { if (current) retiring = retireEpoch(current); } catch (cause) { failures.push(cause); }
  void (async () => {
    if (retiring) try { await retiring; } catch (cause) { failures.push(cause); }
    if (transition) try { await transition; } catch (cause) {
      if (cause?.code !== 'RESOURCE_SCENE_CLOSED' && !failures.includes(cause)) failures.push(cause);
    }
    // A transition may have allocated its next epoch before close was requested.
    if (current && current.closePromise !== retiring) {
      try { await retireEpoch(current); } catch (cause) { failures.push(cause); }
    }
    state = 'closed'; refresh();
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new EgretError('RESOURCE_SCENE_CLOSE_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    return inspect();
  })().then(completion.resolve, completion.reject);
  void closePromise.catch(cause => unexpected('close', cause)); refresh(); return closePromise;
}
function actorView(record, id) {
  const actor = record.session?.scene.actors[id];
  return actor ? { present: true, slotState: actor.slot?.state, leaseId: actor.lease?.leaseId,
    outfitLeaseId: actor.outfit?.textureLease?.leaseId ?? null, bodyCrop: actor.body?.sourceRect ?? null,
    playbackState: actor.playback?.state, elapsedSeconds: actor.playback?.elapsedSeconds,
    rootDisposed: actor.root?.isDisposed ?? null } : { present: false };
}
function epochView(record) {
  return { epoch: record.epoch, hostId: record.hostId, retired: record.retired, resourceReady: record.resourceReady, frameReady: record.frameReady,
    interactive: record.interactive, session: record.session?.inspect() ?? null, sourceSeconds: record.sourceSeconds,
    pendingPresentations: record.presentationPending,
    actors: Object.fromEntries(IDS.map(id => [id, actorView(record, id)])), events: record.events.map(row => ({ ...row })),
    ticks: record.ticks.map(row => ({ ...row })), warmLeases: record.warm.size, warmPending: record.warmPending,
    warmRequests: record.warmRequests.map(({ promise, ...row }) => ({ ...row })),
    reads: record.reads.map(({ id, name, outcome, phase, signal, abortedAtStart, gate, gateSettled, bytesVerified, error }) =>
      ({ id, name, outcome, phase, abortedAtStart, abortedNow: signal.aborted, held: !!gate, gateSettled, bytesVerified, error })),
    loads: record.loads.map(({ name, outcome, signal, texture, error }) => ({ name, outcome, abortedNow: signal.aborted,
      textureIssued: texture !== undefined, textureDisposed: texture?.isDisposed ?? null, error })),
    requests: record.requests.map(({ promise, ...row }) => ({ ...row })), disposals: record.disposals.map(row => ({ ...row })),
    presentations: record.presentations.map(({ promise, ...row }) => ({ ...row })),
    fonts: record.fonts.map(({ face, ...row }) => ({ ...row })), hostStatus: captureStatus(record.host),
    inputState: record.input?.state ?? null, safeSurface: record.safeSurface,
    canvas: { connected: record.canvas.isConnected, width: record.canvas.width, height: record.canvas.height },
    cleanup: record.cleanup.map(row => ({ operation: row.operation, error: errorView(row.cause) })) };
}
function inspect() {
  return { state, profile, currentEpoch: current?.epoch ?? null, traceExhausted: trace.length >= 256,
    hasSavedBaseline: savedBaseline !== undefined, selectedId: current?.session?.inspect().selectedId ?? retainedModel?.selectedId ?? IDS[0],
    epochs: epochs.map(epochView), replays: replays.map(record => ({ hostId: record.hostId, safeSurface: record.safeSurface, hostStatus: captureStatus(record.host),
      presentations: record.presentations.map(({ promise, ...row }) => ({ ...row })), cleanup: record.cleanup.map(value => errorView(value)) })),
    trace: trace.map(row => ({ ...row })), faults: faults.map(row => ({ ...row })) };
}
function readback() {
  if (!lastPixels) throw fault('RESOURCE_SCENE_READBACK_REQUIRED');
  return { ...lastPixels, bytes: Array.from(lastPixels.bytes) };
}
function refresh() {
  const record = current, open = state === 'ready' && !closeRequested && trace.length < 256;
  const selected = record?.session?.inspect().selectedId ?? retainedModel?.selectedId ?? IDS[0];
  const actor = record?.session?.scene.actors[selected];
  const quiescent = open && !pending(record);
  for (const node of document.querySelectorAll('button,select,input')) node.disabled = !open;
  element('close').disabled = state === 'closed' || state === 'closing';
  element('restart').disabled = !(quiescent || (state === 'suspended' && !closeRequested && trace.length < 256));
  element('replay-saved').disabled = !quiescent;
  for (const id of ['replace-outfit', 'cancel-outfit', 'advance', 'pause', 'resume', 'replace-atlas', 'remove', 'clip', 'rotation']) {
    element(id).disabled = !open || actor?.slot === undefined;
  }
  // A re-entering actor view precedes its prepared slot; controls wait for it.
  element('cancel-outfit').disabled = !open || actor?.slot?.state !== 'pending';
  element('reenter').disabled = !open || !!actor;
  const held = record?.reads.filter(row => row.gate && !row.gateSettled) ?? [];
  const heldSelect = element('held-source'), old = heldSelect.value;
  heldSelect.replaceChildren(...(held.length ? held.map(row => new Option(row.name + ' #' + row.id + ' · ' + row.phase, String(row.id))) : [new Option('None / 暂无', '')]));
  if (held.some(row => String(row.id) === old)) heldSelect.value = old;
  for (const id of ['release-source', 'fail-source', 'held-source']) element(id).disabled = !open || held.length === 0;
  element('hold-next').disabled = !open || held.length >= 2; element('hold-next').checked = record?.holdNext ?? false;
  element('pilot').value = selected;
  element('resource-status').textContent = record?.resourceReady ? 'Ready / 已就绪' : 'Not ready / 尚未就绪';
  element('presentation-status').textContent = record?.frameReady ? 'Completed / 已完成' : 'No active frame / 无活动画面';
  element('interactive-status').textContent = open ? 'Ready / 已就绪' : 'Unavailable / 当前不可用';
  element('selection-status').textContent = (selected === IDS[0] ? 'Left pilot / 左侧角色' : 'Right pilot / 右侧角色') + (actor ? '' : ' · absent / 未在场');
  element('status').dataset.state = state;
  element('status').textContent = ({ starting: 'Starting / 正在启动', ready: 'Ready / 已就绪', restarting: 'Rebuilding / 正在重建',
    replaying: 'Replaying saved frame / 正在回放', suspended: 'Replay complete; rebuild to continue / 回放完成，可重建继续',
    closing: 'Closing / 正在关闭', closed: 'Closed / 已关闭', failed: 'Scene unavailable; see activity / 场景不可用，请查看记录' })[state];
  element('trace').textContent = trace.map(row => JSON.stringify(row)).join('\n');
}

current = allocate();
current.initialization = initialize(current, 'startup');
const initial = current;
void initial.initialization.then(() => { if (!closeRequested) { state = 'ready'; refresh(); } },
  cause => { if (!closeRequested) { state = 'failed'; unexpected('startup', cause); void close().catch(() => undefined); } });
const api = Object.freeze({
  get ready() { return (current ?? initial).resources.promise; },
  get interactiveReady() { return (current ?? initial).initialization; },
  get scene() { return current?.session?.scene; },
  get presentationIdle() { return current?.serial ?? Promise.resolve(); },
  inspect, readback, checkpoint, select, advanceTo, holdNext, warmOutfit, releaseWarm,
  replaceOutfit(id, key) { const record = assertAdmitted(); return recordRequest(record, 'outfit', id, key, record.session.replaceOutfit(id, key)); },
  replaceAtlas(id, key) { const record = assertAdmitted(); return recordRequest(record, 'atlas', id, key, record.session.replaceAtlas(id, key)); },
  reenter(id) { const record = assertAdmitted(); return recordRequest(record, 'reenter', id, undefined, record.session.reenter(id)); },
  cancelOutfit(id) { return control('cancelOutfit', id, 'explicit application cancellation'); },
  pause(id) { return control('pause', id); }, resume(id) { return control('resume', id); },
  remove(id) { return control('remove', id); }, setView(id, value) { return control('setView', id, value); },
  releaseSource(id) { settleSource(assertAdmitted(), id, 'release'); },
  failSource(id, kind) { settleSource(assertAdmitted(), id, kind); },
  sourceIdle() { const record = assertAdmitted(); return Promise.allSettled([...record.loads, ...record.reads].map(row => row.promise)); },
  snapshot() { return assertAdmitted().session.snapshot(); }, replay, restart, close,
});
globalThis.egretResourceScene = api;
function action(operation) {
  try { void Promise.resolve(operation()).catch(cause => unexpected('control', cause)); }
  catch (cause) { unexpected('control', cause); }
}
const selected = () => current?.session?.inspect().selectedId ?? IDS[0];
const expectedRequestCodes = new Set(['BITMAP_RESOURCE_REPLACE_FAILED', 'BITMAP_RESOURCE_CANCELLED',
  'BITMAP_RESOURCE_SUPERSEDED', 'BITMAP_RESOURCE_DISPOSED', 'ASSET_LOAD_FAILED',
  'ASSET_ACQUIRE_CANCELLED', 'RESOURCE_SCENE_GENERATION_RETIRED', 'RESOURCE_SCENE_BUSY']);
function after(original, label) {
  // Only this DOM presentation chain observes expected request refusals. The
  // facade still returns the genuine rejected request Promise without changes.
  const record = current;
  return original.then(() => {
    if (!closeRequested && state === 'ready' && current === record) return checkpoint(label);
  }, cause => {
    const row = record.requests.find(value => value.promise === original);
    const retiringScope = (closeRequested || record.retired) && cause?.code === 'SCOPE_CLOSED';
    if (!row || (!expectedRequestCodes.has(cause?.code) && !retiringScope)) throw cause;
    observe('control-request-outcome', { id: row.id, error: errorView(cause) });
    if (!closeRequested && state === 'ready' && current === record) return checkpoint(label + '-retained');
  });
}
element('pilot').addEventListener('change', () => action(() => { select(element('pilot').value); return checkpoint('select-control'); }));
element('replace-outfit').addEventListener('click', () => action(() => after(api.replaceOutfit(selected(), element('outfit').value), 'outfit-complete')));
element('cancel-outfit').addEventListener('click', () => action(() => { api.cancelOutfit(selected()); return checkpoint('outfit-cancelled'); }));
element('advance').addEventListener('click', () => action(() => { advanceTo(current.sourceSeconds + 0.125); return checkpoint('advanced'); }));
for (const name of ['pause', 'resume', 'remove']) element(name).addEventListener('click', () => action(() => { api[name](selected()); return checkpoint(name); }));
for (const name of ['clip', 'rotation']) element(name).addEventListener('change', () => action(() => {
  api.setView(selected(), { clip: element('clip').checked, rotation: element('rotation').checked ? 90 : 0 }); return checkpoint('view-changed');
}));
element('replace-atlas').addEventListener('click', () => action(() => after(api.replaceAtlas(selected(), element('atlas').value), 'atlas-complete')));
element('reenter').addEventListener('click', () => action(() => after(api.reenter(selected()), 'reentered')));
element('hold-next').addEventListener('change', () => action(() => {
  if (element('hold-next').checked) holdNext(); else { assertAdmitted().holdNext = false; refresh(); }
}));
element('release-source').addEventListener('click', () => action(() => api.releaseSource(Number(element('held-source').value))));
element('fail-source').addEventListener('click', () => action(() => api.failSource(Number(element('held-source').value), element('failure-kind').value)));
element('replay-saved').addEventListener('click', () => action(replay));
element('restart').addEventListener('click', () => action(restart));
element('close').addEventListener('click', () => { void close().catch(() => undefined); });
window.addEventListener('pagehide', () => { void close().catch(() => undefined); }, { once: true });
refresh();
