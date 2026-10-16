// SPDX-License-Identifier: Apache-2.0
// First-party browser composition. External adapters transfer their close ownership here.
import { EgretError } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createMouseInput } from '@egret/engine/web/input';
import { createPreparedOutfitSource } from './source.mjs';
import { createPreparedSceneDependencies } from './dependencies.mjs';
import { createPreparedResourceSceneSession } from './session.mjs';

const FREEZE = Object.freeze;
const WIDTH = 192, HEIGHT = 128;
const fault = (code, cause) => new EgretError('PREPARED_APPLICATION_' + code, { cause });
function errorView(cause, depth = 0) {
  const view = { wasUndefined: cause === undefined, code: typeof cause?.code === 'string' ? cause.code : null,
    message: String(cause?.message ?? cause) };
  if (depth < 8 && cause !== null && (typeof cause === 'object' || typeof cause === 'function')) {
    if (Object.hasOwn(cause, 'cause')) view.cause = errorView(cause.cause, depth + 1);
    if (Array.isArray(cause.cleanupErrors)) view.cleanupErrors = FREEZE(cause.cleanupErrors.map(value => errorView(value, depth + 1)));
  }
  return FREEZE(view);
}

export function createPreparedResourceApplication(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw fault('OPTIONS_INVALID');
  const { canvas, profile = 'canvas-2d' } = options;
  if (!['canvas-2d', 'webgpu-scene-textured'].includes(profile)) throw fault('PROFILE_UNSUPPORTED');
  if (!canvas || typeof canvas.getContext !== 'function') throw fault('OPTIONS_INVALID');
  let state = 'starting', source, dependencies, host, session, input, composition, ready, closePromise;
  let serial = Promise.resolve(), pendingPresentations = 0, completedPresentations = 0;
  let initialPresentation, lastPresentation;
  let sourceClosing, dependencyClosing, sessionClosing, sessionCloseStarted = false, safeSurface = false;
  const diagnostics = [], cleanupErrors = [];
  function diagnostic(operation, cause) {
    if (diagnostics.length < 64) diagnostics.push(FREEZE({ operation, error: errorView(cause) }));
  }
  function remember(operation, cause) { cleanupErrors.push({ operation, cause }); }
  function open() { if (state !== 'ready') throw fault(state === 'starting' ? 'NOT_READY' : 'CLOSED'); }
  function starting() { if (state !== 'starting') throw fault('CLOSED'); }
  function handled(promise) { void promise.catch(() => undefined); return promise; }
  function closeSession() {
    if (session === undefined || sessionCloseStarted) return;
    sessionCloseStarted = true;
    try { sessionClosing = handled(session.close()); } catch (cause) { remember('session.close call', cause); }
  }
  function closeExternal() {
    if (source && sourceClosing === undefined) {
      try { sourceClosing = handled(Promise.resolve(source.close())); }
      catch (cause) { sourceClosing = handled(Promise.reject(cause)); }
    }
    if (dependencies && dependencyClosing === undefined) {
      try { dependencyClosing = handled(Promise.resolve(dependencies.close())); }
      catch (cause) { dependencyClosing = handled(Promise.reject(cause)); }
    }
  }
  async function draw(label) {
    await session.scene.textReady;
    if (state === 'closing' || state === 'closed') throw fault('CLOSED');
    const frame = session.capture();
    const metadata = { label, frameId: frame.frameId, serial: null, width: WIDTH, height: HEIGHT,
      frameImagesBytes: (frame.images ?? []).reduce((sum, image) => sum + image.byteLength, 0),
      geometryLogicalBytes: (frame.geometries ?? []).reduce((sum, geometry) => sum + geometry.logicalByteLength, 0) };
    let bytes;
    if (profile === 'canvas-2d') {
      host.renderFrame(frame);
      bytes = new Uint8Array(canvas.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT).data);
    } else {
      const original = handled(host.requestReadback());
      host.renderSceneTexturedFrame(composition.scene, frame);
      const readback = await original;
      await host.whenIdle();
      if (readback.frameId !== frame.frameId || readback.width !== WIDTH || readback.height !== HEIGHT) throw fault('READBACK_INVALID');
      metadata.serial = readback.serial;
      bytes = new Uint8Array(readback.bytes);
    }
    if (bytes.byteLength !== WIDTH * HEIGHT * 4) throw fault('READBACK_INVALID');
    lastPresentation = FREEZE({ ...metadata, bytes }); completedPresentations++;
    return lastPresentation;
  }
  function enqueue(label) {
    if (typeof label !== 'string' || !/^[a-z0-9-]{1,64}$/.test(label)) throw fault('LABEL_INVALID');
    pendingPresentations++;
    const original = serial.then(() => draw(label));
    serial = original.then(() => { pendingPresentations--; }, () => { pendingPresentations--; });
    return original;
  }
  async function initialize() {
    source = options.outfitSource ?? createPreparedOutfitSource();
    dependencies = options.dependencyOwner ?? createPreparedSceneDependencies();
    await dependencies.ready; starting();
    // The Canvas path never evaluates the optional GPU module.
    const gpu = profile === 'webgpu-scene-textured' ? await import('../resource-scene/gpu-scene.mjs') : undefined;
    starting();
    host = gpu ? gpu.createTexturedSceneWebGPUHost({ canvas, pixelRatio: 1, enableReadback: true,
      onDiagnostic(value) { diagnostic('host:' + value.code, value.cause); } }) : createCanvasHost({ canvas, pixelRatio: 1 });
    session = createPreparedResourceSceneSession({ host, profile, outfitSource: source, dependencies: dependencies.dependencies });
    await session.ready; starting();
    if (gpu) composition = gpu.createResourceSceneGPU({ session });
    initialPresentation = await enqueue('startup'); starting();
    input = createMouseInput({ engine: session.scene.engine, scope: session.scene.inputScope, width: WIDTH, height: HEIGHT });
    session.scene.engine.stage.on(input.events.activate, event => {
      if (state !== 'ready' || !session.selectTarget(event.target)) return;
      // The native callback stays synchronous; its original presentation has its own barrier.
      void enqueue('native-selection').catch(cause => diagnostic('native selection presentation', cause));
    }, { signal: session.scene.inputScope.signal });
    state = 'ready';
    return initialPresentation;
  }
  async function whenIdle() {
    // Include presentations admitted during the preceding await without retaining history.
    let observed;
    do {
      observed = serial; await observed;
      if (profile === 'webgpu-scene-textured' && host) await host.whenIdle();
    } while (serial !== observed);
    return lastPresentation;
  }
  function close() {
    if (closePromise !== undefined) return closePromise;
    let resolve, reject;
    closePromise = handled(new Promise((yes, no) => { resolve = yes; reject = no; }));
    state = 'closing';
    try { input?.dispose(); } catch (cause) { remember('input.dispose', cause); }
    closeSession();
    // No session can borrow partial dependencies after startup close has won.
    if (session === undefined) closeExternal();
    void (async () => {
      const keep = async (operation, run) => { try { await run(); } catch (cause) { remember(operation, cause); } };
      try {
        await ready.catch(() => undefined);
        closeSession();
        if (sessionClosing !== undefined) await keep('session.close', () => sessionClosing);
        await serial;
        closeExternal();
        if (sourceClosing !== undefined) await keep('source.close', () => sourceClosing);
        if (dependencyClosing !== undefined) await keep('dependencies.close', () => dependencyClosing);
        let idleFailure, hostCloseFailure;
        if (profile === 'webgpu-scene-textured' && host) {
          try { await host.whenIdle(); } catch (cause) { idleFailure = { cause }; }
        }
        let closed = host === undefined;
        if (host) {
          try { await host.close(); closed = true; } catch (cause) { hostCloseFailure = { cause }; }
        }
        const status = profile === 'webgpu-scene-textured' && host ? host.getStatus() : undefined;
        // Safe close can retain a primary Host failure; suppress only its exact idle replay.
        const failure = status?.firstFailure, cause = idleFailure?.cause;
        const primaryReplay = closed && status?.state === 'closed' && status.cleanupOutcome === 'safe'
          && failure !== null && failure !== undefined && ['startup', 'frame', 'readback', 'device'].includes(failure.phase)
          && cause instanceof EgretError && cause.code === failure.code && Object.hasOwn(cause, 'cause')
          && Object.is(cause.cause, failure.cause) && cause.cleanupErrors.length === 0;
        if (idleFailure !== undefined && !primaryReplay) remember('host.whenIdle', idleFailure.cause);
        if (hostCloseFailure !== undefined) remember('host.close', hostCloseFailure.cause);
        safeSurface = closed && (status === undefined || status.cleanupOutcome === 'safe');
        if (safeSurface) await keep('canvas retirement', () => { canvas.width = 0; canvas.height = 0; canvas.remove(); });
        else remember('surface quarantined', fault('HOST_UNSAFE'));
      } finally { state = 'closed'; }
      if (cleanupErrors.length === 1) throw cleanupErrors[0].cause;
      if (cleanupErrors.length > 1) throw new EgretError('PREPARED_APPLICATION_CLOSE_FAILED', {
        cause: cleanupErrors[0].cause, cleanupErrors: cleanupErrors.slice(1).map(value => value.cause) });
    })().then(resolve, reject);
    return closePromise;
  }
  const application = FREEZE({
    get ready() { return ready; }, get session() { return session; }, get source() { return source; },
    get dependencies() { return dependencies; }, get host() { return host; }, get input() { return input; },
    present(label = 'frame') { open(); return enqueue(label); }, whenIdle, close,
    inspect() {
      const { bytes, ...lastFrame } = lastPresentation ?? {};
      // The ready Promise retains its initial result. Count the latest result once when identical.
      const handleHeldRGBABytes = (initialPresentation?.bytes.byteLength ?? 0)
        + (lastPresentation !== initialPresentation ? lastPresentation?.bytes.byteLength ?? 0 : 0);
      return FREEZE({ state, session: session?.inspect() ?? null, source: source?.snapshot() ?? null,
        dependencies: dependencies?.snapshot() ?? null, pendingPresentations, completedPresentations,
        lastFrame: lastPresentation ? FREEZE(lastFrame) : null, handleHeldRGBABytes,
        host: profile === 'webgpu-scene-textured' && host ? FREEZE({ general: host.getStatus(),
          textured: host.getTexturedStatus(), scene: host.getSceneStatus() }) : null,
        diagnostics: FREEZE([...diagnostics]), cleanupErrors: FREEZE(cleanupErrors.map(value =>
          FREEZE({ operation: value.operation, error: errorView(value.cause) }))), safeSurface });
    },
  });
  ready = initialize();
  void ready.catch(() => { if (state === 'starting') void close().catch(() => undefined); });
  return application;
}
