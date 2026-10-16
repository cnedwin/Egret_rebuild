// SPDX-License-Identifier: Apache-2.0
import {DisplayObjectContainer} from '@egret/engine';
import {planLinearLayout} from '@egret/engine/layout';
import {createBitmapButtonSession} from '../bitmap-button/session.mjs';

const FRAME = Object.freeze({width: 24, height: 24, clearColor: 0, clearAlpha: 0});
function failure(code, cause) {
  const error = new Error(code, {cause});
  error.code = code;
  return error;
}

/** Caller-owned layout composition around the original Button lifecycle owner. */
export function createLinearLayoutSession({host, preset = 'preview', onUpdate, waitForStartupIdle} = {}) {
  if (!['preview', 'verification'].includes(preset)
    || (onUpdate !== undefined && typeof onUpdate !== 'function')
    || (waitForStartupIdle !== undefined && typeof waitForStartupIdle !== 'function')) {
    throw failure('EXAMPLE_OPTIONS_INVALID');
  }
  const render = host?.renderFrame;
  if (typeof render !== 'function') throw failure('EXAMPLE_RENDER_PORT_REQUIRED');
  let state = 'starting', axis = 'horizontal', mode = 'horizontal';
  let presentation = 'unavailable', currentPlan, layoutScope, outer, inner, savedHorizontal;
  let order = ['first', 'second'], hiddenFirst = false, closePromise;
  let primaryOccurred = false, primaryCause, lastRejectedCode;
  let startupBarrierFailed = false;
  const cleanupErrors = [];

  function primary(cause) {
    if (!primaryOccurred) { primaryOccurred = true; primaryCause = cause; }
  }
  function notify() {
    try { onUpdate?.(inspect()); }
    catch (cause) {
      primary(cause);
      void close().catch(() => {});
    }
  }
  // Always use the existing helper's 24-logical-pixel preset. CSS magnifies it.
  // Its first presentation is genuine ancillary work, not a layout checkpoint.
  const buttons = createBitmapButtonSession({
    host, preset: 'verification',
    onUpdate() {
      if (state === 'ready' && buttons.inspect().presentation === 'live') presentation = 'live';
      notify();
    },
  });
  function control(name) { return buttons.scene[name]; }
  function positions() {
    return Object.freeze(['first', 'second'].map(name => {
      const display = control(name)?.display;
      return Object.freeze({
        name, x: display?.x ?? null, y: display?.y ?? null,
        visible: display?.visible ?? null, disposed: display?.isDisposed ?? null,
      });
    }));
  }
  function inspect() {
    return Object.freeze({
      state, preset, width: 24, height: 24, axis, mode, presentation,
      order: Object.freeze([...order]), hiddenFirst,
      currentPlan, positions: positions(), lastRejectedCode,
      primaryOccurred, primaryCause, cleanupErrors: Object.freeze([...cleanupErrors]), buttons: buttons.inspect(),
      layoutScopeState: layoutScope?.state ?? 'unavailable',
      outerDisposed: outer?.isDisposed ?? null, innerDisposed: inner?.isDisposed ?? null,
      containerChildren: inner?.numChildren ?? 0,
    });
  }
  const scene = Object.freeze({
    get engine() { return buttons.scene.engine; },
    get input() { return buttons.scene.input; },
    get first() { return buttons.scene.first; }, get second() { return buttons.scene.second; },
    get firstScope() { return buttons.scene.firstScope; }, get secondScope() { return buttons.scene.secondScope; },
    get resourceScope() { return buttons.scene.resourceScope; },
    get inputScope() { return buttons.scene.inputScope; },
    get lease() { return buttons.scene.lease; }, get texture() { return buttons.scene.texture; },
    get layoutScope() { return layoutScope; }, get outer() { return outer; }, get inner() { return inner; },
    get savedHorizontalFrame() { return savedHorizontal; },
  });
  function requireReady() {
    if (state !== 'ready') throw failure(state === 'starting' ? 'EXAMPLE_NOT_READY' : 'EXAMPLE_CLOSED');
  }
  function requireIdleInput() {
    if (buttons.scene.input.state === 'pressed') throw failure('EXAMPLE_GESTURE_ACTIVE');
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
    // Reuse the same genuine Engine capture and original Host submission chain.
    buttons.showLive();
    presentation = 'live';
    return inspect();
  }
  function perform(operation) {
    requireReady();
    try { return operation(); }
    catch (cause) { primary(cause); throw cause; }
  }
  function plannedItems(names, hideFirst) {
    // Filtering and identity mapping are explicit caller policy. The pure planner
    // receives only numeric records and never reads visibility or display bounds.
    return names.filter(name => !(hideFirst && name === 'first'));
  }
  function applyLayout(nextAxis, names, hideFirst, disableFirst, nextMode) {
    const mapping = plannedItems(names, hideFirst);
    const plan = planLinearLayout({
      axis: nextAxis, items: mapping.map(() => ({width: 8, height: 6})),
      gap: 2, padding: 2, crossAlign: 'start',
    });
    // No scene write precedes the complete successful plan. This is caller
    // ordering, not planner mutation, display authority or a rollback facility.
    const first = control('first'), second = control('second');
    first.display.visible = !hideFirst;
    second.display.visible = true;
    first.enabled = !disableFirst;
    for (const name of names) {
      const display = control(name).display;
      inner.addChildAt(display, inner.numChildren);
    }
    for (const placement of plan.placements) {
      const display = control(mapping[placement.index]).display;
      display.x = placement.x;
      display.y = placement.y;
    }
    axis = nextAxis;
    order = [...names];
    hiddenFirst = hideFirst;
    mode = nextMode;
    currentPlan = plan;
    lastRejectedCode = undefined;
  }
  function reflow(nextAxis, names, hideFirst, disableFirst, nextMode) {
    return perform(() => {
      requireIdleInput();
      applyLayout(nextAxis, names, hideFirst, disableFirst, nextMode);
      return showCurrent();
    });
  }
  function close() {
    if (closePromise) return closePromise;
    state = 'closing';
    let resolve, reject;
    closePromise = new Promise((yes, no) => { resolve = yes; reject = no; });
    void closePromise.catch(() => {});
    // The immutable Button helper retires controls/input/resources, then its
    // Engine retires the extra container Scope and performs the sole Host close.
    // Do not close the Host or release its borrowed atlas lease a second time.
    try {
      void Promise.resolve(buttons.close()).then(() => {
        state = 'closed'; notify(); resolve();
      }, cause => { cleanupErrors.push(cause); state = 'closed'; notify(); reject(cause); });
    } catch (cause) { cleanupErrors.push(cause); state = 'closed'; reject(cause); }
    return closePromise;
  }
  const initialization = buttons.ready.then(async () => {
    if (state !== 'starting') throw failure('EXAMPLE_CLOSED');
    // The helper has synchronously submitted its ancillary frame. Verification
    // may await that genuine ticket here; Host.renderFrame stays synchronous.
    if (waitForStartupIdle !== undefined) {
      try { await waitForStartupIdle(); }
      catch (cause) { startupBarrierFailed = true; throw cause; }
    }
    const engine = buttons.scene.engine;
    // Close can finish while the ticket is pending. Recheck real owners before
    // creating any layout Scope/container or issuing the next presentation.
    if (state !== 'starting' || buttons.inspect().state !== 'ready'
      || engine.stage.isDisposed || buttons.scene.input.state === 'closed'
      || [buttons.scene.resourceScope, buttons.scene.inputScope,
        buttons.scene.firstScope, buttons.scene.secondScope].some(scope => scope.state !== 'open')
      || buttons.scene.texture.isDisposed
      || control('first').state === 'disposed' || control('second').state === 'disposed') {
      throw failure('EXAMPLE_CLOSED');
    }
    if (buttons.scene.lease.value !== buttons.scene.texture) throw failure('EXAMPLE_TEXTURE_IDENTITY');
    layoutScope = engine.createScope();
    outer = layoutScope.use(new DisplayObjectContainer());
    inner = layoutScope.use(new DisplayObjectContainer());
    Object.assign(outer, {
      x: 1, y: 1, scaleX: 1, scaleY: 1, rotation: 0,
      anchorOffsetX: 0, anchorOffsetY: 0,
      clipRect: {x: 0, y: 0, width: 20, height: 20},
    });
    Object.assign(inner, {x: 2, y: 2, scaleX: 1, scaleY: 1, rotation: 0, anchorOffsetX: 0, anchorOffsetY: 0});
    outer.addChild(inner);
    engine.stage.addChild(outer);
    for (const name of ['first', 'second']) {
      Object.assign(control(name).display, {
        scaleX: 1, scaleY: 1, rotation: 0, anchorOffsetX: 0, anchorOffsetY: 0,
      });
    }
    applyLayout('horizontal', ['first', 'second'], false, false, 'horizontal');
    savedHorizontal = engine.captureFrame(FRAME);
    present(savedHorizontal, 'saved-horizontal');
    state = 'ready';
    notify();
    return inspect();
  });
  const ready = initialization.catch(async cause => {
    const intentionallyClosing = state === 'closing' || state === 'closed';
    if (!intentionallyClosing || startupBarrierFailed) primary(cause);
    try { await close(); } catch { /* close() retains cleanupErrors; ready keeps the original cause. */ }
    throw cause;
  });
  void ready.catch(() => {});
  return Object.freeze({
    ready, scene, inspect, close,
    horizontal() { return reflow('horizontal', ['first', 'second'], false, false, 'horizontal'); },
    vertical() { return reflow('vertical', ['first', 'second'], false, false, 'vertical'); },
    filterFirst() { return reflow(axis, [...order], true, false, 'filtered-first'); },
    reinsertFirst() { return reflow(axis, ['second', 'first'], false, false, 'reinserted-first'); },
    disableFirst() { return reflow(axis, [...order], false, true, 'disabled-first'); },
    enableFirst() { return reflow(axis, [...order], false, false, 'enabled-first'); },
    showLive() { return perform(showCurrent); },
    replaySavedHorizontal() {
      return perform(() => { present(savedHorizontal, 'saved-horizontal'); return inspect(); });
    },
    rejectInvalidPlan() {
      return perform(() => {
        const mapping = plannedItems(order, hiddenFirst);
        try {
          planLinearLayout({axis, items: mapping.map(() => ({width: 8, height: 6})), gap: -1, padding: 2, crossAlign: 'start'});
        } catch (cause) {
          if (cause?.code !== 'LAYOUT_OPTIONS_INVALID') throw cause;
          lastRejectedCode = cause.code;
          return inspect();
        }
        throw failure('EXAMPLE_EXPECTED_LAYOUT_REFUSAL_MISSING');
      });
    },
  });
}
