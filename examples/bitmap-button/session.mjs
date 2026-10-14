// SPDX-License-Identifier: Apache-2.0
import {
  createEngine, createImageData2D, createTexture, createAssetType, createAssetRef,
  isTexture, EgretError,
} from '@egret/engine';
import {createMouseInput, createBitmapButton} from '@egret/engine/web/input';

const PRESETS = Object.freeze({
  preview: Object.freeze({width: 192, height: 128, scale: 8}),
  verification: Object.freeze({width: 24, height: 24, scale: 1}),
});
const SKINS = Object.freeze({
  up: Object.freeze({x: 0, y: 0, width: 8, height: 6}),
  pressed: Object.freeze({x: 8, y: 0, width: 8, height: 6}),
  disabled: Object.freeze({x: 16, y: 0, width: 8, height: 6}),
});
function failure(code, cause) {
  const error = new Error(code, {cause});
  error.code = code;
  return error;
}
/** Original opaque red, blue and gray pixels; no external art or codec. */
function makeAtlas() {
  const pixels = new Uint8Array(24 * 6 * 4);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 24; x++) {
    const at = (y * 24 + x) * 4;
    if (x < 8) pixels[at] = 255;
    else if (x < 16) pixels[at + 2] = 255;
    else pixels[at] = pixels[at + 1] = pixels[at + 2] = 128;
    pixels[at + 3] = 255;
  }
  return createTexture(createImageData2D({width: 24, height: 6, pixels}));
}

/** Example-local composition; all scene, resource and input handles are public SDK values. */
export function createBitmapButtonSession({host, preset = 'preview', onUpdate} = {}) {
  const profile = typeof preset === 'string' && Object.hasOwn(PRESETS, preset) ? PRESETS[preset] : undefined;
  if (!profile || (onUpdate !== undefined && typeof onUpdate !== 'function')) {
    throw failure('EXAMPLE_OPTIONS_INVALID');
  }
  const render = host?.renderFrame;
  if (typeof render !== 'function') throw failure('EXAMPLE_RENDER_PORT_REQUIRED');
  const frameOptions = Object.freeze({
    width: profile.width, height: profile.height, clearColor: 0, clearAlpha: 0,
  });
  let state = 'starting', layout = preset === 'verification' ? 'isolated' : 'two-buttons';
  let engine, resourceScope, inputScope, input, lease, texture, savedUpFrame;
  const slots = [{scope: undefined, button: undefined}, {scope: undefined, button: undefined}];
  const activations = [0, 0], trace = [], cleanupErrors = [], providerTasks = new Set();
  const originalDisposers = new WeakMap();
  let loads = 0, disposals = 0, presentation = 'unavailable', renderQueued = false;
  let primaryOccurred = false, primaryCause, initializationCause;
  let initializationPending = true, initialization, closePromise;

  function primary(cause) {
    if (!primaryOccurred) { primaryOccurred = true; primaryCause = cause; }
  }
  function inspect() {
    return Object.freeze({
      state, preset, layout, presentation, width: profile.width, height: profile.height,
      buttonStates: Object.freeze(slots.map(slot => slot.button?.state ?? 'unavailable')),
      buttonEnabled: Object.freeze(slots.map(slot => slot.button?.enabled ?? null)),
      controlScopeStates: Object.freeze(slots.map(slot => slot.scope?.state ?? 'unavailable')),
      inputState: input?.state ?? 'unavailable',
      activations: Object.freeze([...activations]), totalActivations: activations[0] + activations[1],
      loads, disposals, pendingTasks: providerTasks.size + Number(initializationPending) + Number(renderQueued),
      primaryOccurred, primaryCause, initializationCause,
      cleanupErrors: Object.freeze([...cleanupErrors]), trace: Object.freeze([...trace]),
    });
  }
  // Frozen view, genuine handles: nothing here mutates an SDK private record.
  const scene = Object.freeze({
    get engine() { return engine; }, get resourceScope() { return resourceScope; },
    get inputScope() { return inputScope; }, get input() { return input; },
    get lease() { return lease; }, get texture() { return texture; },
    get first() { return slots[0].button; }, get second() { return slots[1].button; },
    get firstScope() { return slots[0].scope; }, get secondScope() { return slots[1].scope; },
    get savedUpFrame() { return savedUpFrame; },
  });
  function appendTrace(kind, payload, target) {
    trace.push(Object.freeze({
      kind, target: target === slots[0].button?.display ? 0 : target === slots[1].button?.display ? 1 : null,
      globalX: payload.globalX, globalY: payload.globalY, pointerId: payload.pointerId,
      reason: payload.reason ?? null,
      states: Object.freeze(slots.map(slot => slot.button?.state ?? 'unavailable')),
      activations: Object.freeze([...activations]),
    }));
    if (trace.length > 64) trace.shift();
  }
  function notify() {
    try { onUpdate?.(inspect()); }
    catch (cause) {
      primary(cause);
      void close().catch(() => {});
    }
  }
  function stopScopes() {
    // Controls retire first; the shared input and borrowed atlas outlive them.
    for (const scope of [slots[1].scope, slots[0].scope, inputScope, resourceScope]) {
      try { scope?.dispose(); } catch (cause) { cleanupErrors.push(cause); }
    }
  }
  async function finishClose() {
    try {
      await initialization.catch(() => {});
      stopScopes();
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
    // Publish before cancellation/disposal callouts; repeated Close has one identity.
    closePromise = new Promise((yes, no) => { resolve = yes; reject = no; });
    void closePromise.catch(() => {});
    stopScopes();
    void finishClose().then(resolve, reject);
    return closePromise;
  }
  function requireReady() {
    if (state !== 'ready') throw failure(state === 'starting' ? 'EXAMPLE_NOT_READY' : 'EXAMPLE_CLOSED');
  }
  function present(frame, label) {
    const returned = Reflect.apply(render, host, [frame]);
    if (returned !== undefined) {
      void Promise.resolve(returned).catch(() => {});
      throw failure('EXAMPLE_RENDER_RETURN_INVALID');
    }
    presentation = label;
  }
  function showCurrent() {
    present(engine.captureFrame(frameOptions), 'live');
    return inspect();
  }
  function perform(operation) {
    requireReady();
    try { return operation(); }
    catch (cause) { primary(cause); throw cause; }
  }
  function arrange() {
    const centers = preset === 'preview'
      ? layout === 'isolated' ? [[96, 64], [240, 64]] : [[48, 64], [144, 64]]
      : layout === 'isolated' ? [[12, 12], [40, 12]] : [[8, 8], [20, 18]];
    for (let index = 0; index < slots.length; index++) {
      const button = slots[index].button;
      if (!button || button.state === 'disposed') continue;
      Object.assign(button.display, {
        x: centers[index][0], y: centers[index][1],
        scaleX: profile.scale, scaleY: profile.scale,
        anchorOffsetX: 4, anchorOffsetY: 3, rotation: 0,
      });
    }
  }
  function createControl(index) {
    const slot = slots[index];
    slot.scope = engine.createScope();
    slot.button = createBitmapButton({
      engine, scope: slot.scope, input, textureLease: lease, skins: SKINS,
      onActivate(payload) {
        // The control calls this after the complete public activate route.
        activations[index]++;
        appendTrace('callback-' + index, payload, slot.button.display);
      },
    });
    arrange();
    engine.stage.addChild(slot.button.display);
  }
  function queuePresentation() {
    if (state !== 'ready' || renderQueued) return;
    renderQueued = true;
    // One application microtask observes committed control state after routing.
    // It does not add a native input listener, clock tick or SDK render hook.
    queueMicrotask(() => {
      renderQueued = false;
      if (state !== 'ready') return;
      try { showCurrent(); notify(); }
      catch (cause) {
        primary(cause);
        void close().then(notify, notify);
      }
    });
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
    inputScope = engine.createScope();
    const type = createAssetType('example-bitmap-button', isTexture);
    engine.assets.register(type, {
      load(_ref, context) {
        loads++;
        const task = Promise.resolve().then(() => {
          if (context.signal.aborted || state !== 'starting') throw failure('EXAMPLE_CLOSED', context.signal.reason);
          const value = makeAtlas();
          texture = value;
          originalDisposers.set(value, value.dispose);
          return value;
        });
        providerTasks.add(task);
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
    const obtained = await engine.assets.acquire(createAssetRef(type, 'inline-red-blue-gray'), {
      signal: resourceScope.signal,
    });
    // Late acquisition results are also retired by the genuine owner Scope.
    lease = resourceScope.use(obtained);
    input = createMouseInput({
      engine, scope: inputScope, width: profile.width, height: profile.height,
    });
    createControl(0);
    createControl(1);
    for (const kind of ['begin', 'end', 'activate', 'cancel']) {
      engine.stage.on(input.events[kind], event => {
        appendTrace(kind, event.payload, event.target);
        queuePresentation();
      }, {signal: inputScope.signal});
    }
    savedUpFrame = engine.captureFrame(frameOptions);
    present(savedUpFrame, 'saved-up');
    if (state !== 'starting') throw failure('EXAMPLE_CLOSED');
    state = 'ready';
  }
  initialization = initialize().finally(() => { initializationPending = false; });
  const ready = initialization.then(inspect, async cause => {
    initializationCause = cause;
    if (!engine && cause instanceof EgretError && cause.code === 'ENGINE_START_FAILED') {
      cleanupErrors.push(...cause.cleanupErrors);
    }
    const intentionallyClosing = state === 'closing';
    if (!intentionallyClosing) primary(cause);
    try { await close(); } catch { /* Preserve primary and cleanup causes separately. */ }
    throw intentionallyClosing ? failure('EXAMPLE_CLOSED', cause) : cause;
  });
  void ready.catch(() => {});
  return Object.freeze({
    ready, scene, inspect, close,
    showLive() { return perform(showCurrent); },
    replaySavedUp() {
      return perform(() => { present(savedUpFrame, 'saved-up'); return inspect(); });
    },
    toggleEnabled() {
      return perform(() => {
        const first = slots[0].button;
        first.enabled = !first.enabled;
        return showCurrent();
      });
    },
    disposeOrRecreateFirst() {
      return perform(() => {
        const slot = slots[0];
        if (slot.button.state === 'disposed') createControl(0);
        else {
          try { slot.button.dispose(); } finally { slot.scope.dispose(); }
        }
        return showCurrent();
      });
    },
    toggleLayout() {
      return perform(() => {
        if (input.state === 'pressed') throw failure('EXAMPLE_GESTURE_ACTIVE');
        layout = layout === 'isolated' ? 'two-buttons' : 'isolated';
        arrange();
        return showCurrent();
      });
    },
  });
}
