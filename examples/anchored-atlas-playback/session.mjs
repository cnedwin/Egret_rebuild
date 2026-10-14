// SPDX-License-Identifier: Apache-2.0
import {
  createEngine, createImageData2D, createTexture, createAssetType, createAssetRef,
  isTexture, createSpriteSheet, createSequenceClip, EgretError,
} from '@egret/engine';

const PRESETS = Object.freeze({
  preview: Object.freeze({width: 192, height: 192, x: 96, y: 96, scale: 8}),
  verification: Object.freeze({width: 24, height: 24, x: 12, y: 12, scale: 1}),
});
function failure(code, cause) {
  const error = new Error(code, {cause});
  error.code = code;
  return error;
}
/** Original two-colour art: no external asset, codec or font is required. */
function makeAtlas() {
  const pixels = new Uint8Array(16 * 6 * 4);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
    const at = (y * 16 + x) * 4;
    pixels[at + (x < 8 ? 0 : 2)] = 255;
    pixels[at + 3] = 255;
  }
  return createTexture(createImageData2D({width: 16, height: 6, pixels}));
}

/** Example-local composition. It adds no Engine API or automatic clock driver. */
export function createAnchoredAtlasSession({host, preset = 'preview', prepareAtlas} = {}) {
  const layout = typeof preset === "string" && Object.hasOwn(PRESETS, preset) ? PRESETS[preset] : undefined;
  if (!layout || (prepareAtlas !== undefined && typeof prepareAtlas !== 'function')) {
    throw failure('EXAMPLE_OPTIONS_INVALID');
  }
  const render = host?.renderFrame;
  if (typeof render !== 'function') throw failure('EXAMPLE_RENDER_PORT_REQUIRED');
  const frameOptions = Object.freeze({
    width: layout.width, height: layout.height, clearColor: 0, clearAlpha: 0,
  });
  let state = 'starting', sourceSeconds = 0, loads = 0, disposals = 0;
  let engine, resourceScope, animationScope, lease, sheet, bitmap, playback, savedFrame, texture;
  let liveColor = null, presentedColor = null;
  let primaryOccurred = false, primaryCause, initializationCause;
  let initializationPending = true, initialization, closePromise;
  const cleanupErrors = [], providerTasks = new Set(), originalDisposers = new WeakMap();
  function primary(cause) {
    if (!primaryOccurred) { primaryOccurred = true; primaryCause = cause; }
  }
  function inspect() {
    return Object.freeze({
      state, sourceSeconds, clockElapsedSeconds: engine?.clock.elapsedSeconds ?? 0,
      playbackState: playback?.state ?? 'unavailable',
      frameIndex: playback?.lastSample?.frameIndex ?? null,
      liveColor, presentedColor, loads, disposals,
      pendingTasks: providerTasks.size + Number(initializationPending),
      primaryOccurred, primaryCause, initializationCause,
      cleanupErrors: Object.freeze([...cleanupErrors]),
    });
  }
  // Freeze the view only; these getters return the genuine, unfrozen SDK handles.
  const scene = Object.freeze({
    get engine() { return engine; }, get resourceScope() { return resourceScope; },
    get animationScope() { return animationScope; }, get lease() { return lease; },
    get sheet() { return sheet; }, get bitmap() { return bitmap; },
    get playback() { return playback; }, get savedFrame() { return savedFrame; },
    get texture() { return texture; },
  });
  function stopScopes() {
    for (const scope of [animationScope, resourceScope]) {
      try { scope?.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    }
  }
  async function finishClose() {
    try {
      await initialization.catch(() => {});
      stopScopes();
      // An aborted acquisition can settle before its original provider task.
      // Keep Close pending until every actual preparation task has also settled.
      await Promise.allSettled([...providerTasks]);
      if (engine) {
        try { await engine.dispose(); } catch (cause) { cleanupErrors.push(cause); }
      }
    } finally { state = 'closed'; }
    if (cleanupErrors.length === 1) throw cleanupErrors[0];
    if (cleanupErrors.length > 1) throw new AggregateError([...cleanupErrors], 'Example cleanup failed');
  }
  function close() {
    if (closePromise) return closePromise;
    state = 'closing';
    let resolve, reject;
    // Publish the stable Promise before cancellation/disposal can reenter Close.
    closePromise = new Promise((yes, no) => { resolve = yes; reject = no; });
    void closePromise.catch(() => {});
    stopScopes();
    void finishClose().then(resolve, reject);
    return closePromise;
  }
  function requireReady() {
    if (state !== 'ready') throw failure(state === 'starting' ? 'EXAMPLE_NOT_READY' : 'EXAMPLE_CLOSED');
  }
  function present(frame, color) {
    const result = Reflect.apply(render, host, [frame]);
    if (result !== undefined) {
      // Observe an invalid asynchronous result, but never accept it as rendering.
      void Promise.resolve(result).catch(() => {});
      throw failure('EXAMPLE_RENDER_RETURN_INVALID');
    }
    presentedColor = color;
  }
  function updateLive() { liveColor = bitmap.sourceRect.x === 0 ? 'red' : 'blue'; }
  function showCurrent() {
    updateLive();
    present(engine.captureFrame(frameOptions), liveColor);
    return inspect();
  }
  function perform(operation) {
    requireReady();
    try { return operation(); } catch (cause) { primary(cause); throw cause; }
  }

  async function initialize() {
    engine = await createEngine({
      host,
      onDiagnostic(diagnostic) {
        if (diagnostic.phase === 'scope' && diagnostic.severity === 'error') {
          cleanupErrors.push(diagnostic.cause);
        }
      },
    });
    if (state !== 'starting') throw failure('EXAMPLE_CLOSED');
    resourceScope = engine.createScope();
    animationScope = engine.createScope();
    const type = createAssetType('example-anchored-atlas', isTexture);
    engine.assets.register(type, {
      load(_ref, context) {
        loads++;
        const task = (async () => {
          if (prepareAtlas) await prepareAtlas(context.signal);
          if (context.signal.aborted || state !== 'starting') throw failure('EXAMPLE_CLOSED', context.signal.reason);
          const value = makeAtlas();
          texture = value;
          originalDisposers.set(value, value.dispose);
          return value;
        })();
        providerTasks.add(task);
        // Both branches observe settlement without producing an unhandled rejection.
        void task.then(() => providerTasks.delete(task), () => providerTasks.delete(task));
        return task;
      },
      dispose(value) {
        const original = originalDisposers.get(value);
        if (!original) throw failure('EXAMPLE_TEXTURE_IDENTITY');
        originalDisposers.delete(value);
        disposals++;
        Reflect.apply(original, value, []);
      },
    });
    const obtained = await engine.assets.acquire(createAssetRef(type, 'inline-red-blue'), {
      signal: resourceScope.signal,
    });
    // Scope.use owns late-result retirement too; do not drop an obtained lease.
    lease = resourceScope.use(obtained);
    sheet = resourceScope.use(createSpriteSheet(lease, [
      {name: 'red', x: 0, y: 0, width: 8, height: 6},
      {name: 'blue', x: 8, y: 0, width: 8, height: 6},
    ]));
    bitmap = resourceScope.use(sheet.createBitmap('red'));
    const pivot = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(Object.getPrototypeOf(bitmap)), 'anchorOffsetX',
    );
    // Genuine SDK ancestry, rather than successful arbitrary property assignment.
    if (!pivot?.get || !pivot.set) throw failure('EXAMPLE_ANCHOR_ACCESSOR_REQUIRED');
    Object.assign(bitmap, {
      x: layout.x, y: layout.y, scaleX: layout.scale, scaleY: layout.scale,
      anchorOffsetX: 4, anchorOffsetY: 3,
    });
    engine.stage.addChild(bitmap);
    const red = sheet.getRegion('red'), blue = sheet.getRegion('blue');
    const clip = createSequenceClip({
      atlasWidth: 16, atlasHeight: 6,
      frames: [{...red, durationSeconds: 0.125}, {...blue, durationSeconds: 0.125}],
    });
    engine.advanceTime(0);
    playback = engine.createSequencePlayback(animationScope, bitmap, clip, {mode: 'loop'});
    playback.start();
    savedFrame = engine.captureFrame(frameOptions);
    liveColor = 'red';
    present(savedFrame, 'red');
    if (state !== 'starting') throw failure('EXAMPLE_CLOSED');
    state = 'ready';
  }
  initialization = initialize().finally(() => { initializationPending = false; });
  const ready = initialization.then(inspect, async cause => {
    initializationCause = cause;
    // Failed startup already owns host retirement; retain its secondary errors.
    if (!engine && cause instanceof EgretError && cause.code === "ENGINE_START_FAILED") {
      cleanupErrors.push(...cause.cleanupErrors);
    }
    const intentionallyClosing = state === 'closing';
    if (!intentionallyClosing) primary(cause);
    try { await close(); } catch { /* Cleanup is retained separately from the primary cause. */ }
    throw intentionallyClosing ? failure('EXAMPLE_CLOSED', cause) : cause;
  });
  // Observe only; callers still receive the exact rejecting readiness Promise.
  void ready.catch(() => {});
  return Object.freeze({
    ready, scene, inspect, close,
    step() {
      return perform(() => {
        const next = sourceSeconds + 0.125;
        engine.advanceTime(next);
        sourceSeconds = next;
        return showCurrent();
      });
    },
    pause() { return perform(() => { playback.pause(); return inspect(); }); },
    resume() { return perform(() => { playback.resume(); return inspect(); }); },
    replayBaseline() { return perform(() => { present(savedFrame, 'red'); return inspect(); }); },
    showLive() { return perform(showCurrent); },
  });
}
