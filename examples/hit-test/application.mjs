import { createEngine } from '@egret/engine';
import { createHitTestScene } from './scene.mjs';

/** Application-local DOM ownership; no Engine authority is exported. */
export function createHitTestApplication({ host, canvas, upperButton, gateButton, childrenButton, closeButton, windowTarget, status }) {
  let phase = 'starting', engine, scope, scene, closePromise;
  let hasFailure = false, firstFailure, failureCount = 0, diagnosticCount = 0;
  let domRemovalAttempts = 0;
  const pairs = [];
  const toggles = [upperButton, gateButton, childrenButton];
  let finishAcquisition;
  const acquisition = new Promise(resolve => { finishAcquisition = resolve; });
  function failure(cause) {
    failureCount++;
    // An explicit flag retains a first thrown undefined or other falsey cause.
    if (!hasFailure) { hasFailure = true; firstFailure = cause; }
  }
  function attempt(action) { try { action(); } catch (cause) { failure(cause); } }
  function showSelection() {
    const state = scene.readSnapshot();
    status.textContent = state.status === 'hit'
      ? `Hit: ${state.selectedLabel} / 命中：${state.selectedLabel}`
      : 'Miss / 未命中';
  }
  function pointerdown(event) {
    if (phase !== 'ready' || event.isPrimary !== true || event.button !== 0 || event.pointerType !== 'mouse') return;
    const bounds = canvas.getBoundingClientRect();
    if (![event.clientX, event.clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return;
    const globalX = (event.clientX - bounds.left) * 320 / bounds.width;
    const globalY = (event.clientY - bounds.top) * 200 / bounds.height;
    if (!Number.isFinite(globalX) || !Number.isFinite(globalY)) return;
    try {
      scene.pick({ globalX, globalY, button: 0, pointerType: 'mouse' });
      showSelection();
    } catch (cause) { failure(cause); void close().catch(() => {}); }
  }
  function toggle(action) {
    if (phase !== 'ready') return;
    try { action(); } catch (cause) { failure(cause); void close().catch(() => {}); }
  }
  function requestClose() { void close().catch(() => {}); }
  function listen(target, type, callback) {
    target.addEventListener(type, callback, false);
    pairs.push({ target, type, callback, capture: false });
  }
  for (const button of toggles) button.disabled = true;
  closeButton.disabled = false;
  status.textContent = 'Starting / 正在启动';
  listen(canvas, 'pointerdown', pointerdown);
  listen(upperButton, 'click', () => toggle(() => scene.toggleUpper()));
  listen(gateButton, 'click', () => toggle(() => scene.toggleGateVisibility()));
  listen(childrenButton, 'click', () => toggle(() => scene.toggleTouchChildren()));
  listen(closeButton, 'click', requestClose);
  listen(windowTarget, 'pagehide', requestClose);

  async function start() {
    try {
      engine = await createEngine({ host, onDiagnostic() { diagnosticCount++; } });
      // Close owns any late Engine. Startup never awaits the close task it feeds.
      if (phase !== 'starting') return;
      scope = engine.createScope();
      scene = createHitTestScene(engine, scope);
      // Initial host rendering may reenter pagehide/close before Ready publication.
      if (phase !== 'starting') return;
      phase = 'ready';
      for (const button of toggles) button.disabled = false;
      status.textContent = 'Ready / 就绪';
    } catch (cause) {
      failure(cause);
      void close().catch(() => {});
    } finally { finishAcquisition(); }
  }
  async function finishClose() {
    await acquisition;
    if (scope !== undefined) attempt(() => scope.dispose());
    if (engine !== undefined) {
      try { await engine.dispose(); } catch (cause) { failure(cause); }
    }
    // CanvasHost borrows this surface; application retirement owns DOM removal.
    attempt(() => { canvas.width = 0; });
    attempt(() => { canvas.height = 0; });
    attempt(() => canvas.remove());
    phase = hasFailure ? 'failed' : 'closed';
    attempt(() => { status.textContent = hasFailure ? 'Failed / 失败' : 'Closed / 已关闭'; });
    if (hasFailure) { phase = 'failed'; throw firstFailure; }
  }
  function close() {
    if (closePromise !== undefined) return closePromise;
    let resolveClose, rejectClose;
    // Cache before callback-capable retirement: every reentrant caller shares it.
    closePromise = new Promise((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    phase = 'closing';
    for (const button of [...toggles, closeButton]) attempt(() => { button.disabled = true; });
    for (const pair of pairs) {
      domRemovalAttempts++;
      attempt(() => pair.target.removeEventListener(pair.type, pair.callback, pair.capture));
    }
    pairs.length = 0;
    void finishClose().then(resolveClose, rejectClose);
    return closePromise;
  }
  function readSnapshot() {
    const observed = scene?.readSnapshot() ?? {
      status: 'starting', selectedLabel: undefined, lastPayload: undefined, route: Object.freeze([]),
      pointerCount: 0, dispatchCount: 0, renderCount: 0, lastFrameId: undefined,
      feedbackColor: undefined, typedListenerCount: 0, unsubscribeAttempts: 0,
      scopeState: scope?.state, enabledActors: 0,
      liveNodes: engine !== undefined && !engine.stage.isDisposed ? 1 : 0,
      disposedNodes: engine?.stage.isDisposed === true ? 1 : 0,
    };
    return Object.freeze({ ...observed, phase, failureCount, diagnosticCount, domRegistrationCount: 6, domRemovalAttempts });
  }
  // Module evaluation is immediate. Close waits on this acquisition, never vice versa.
  void start();
  return Object.freeze({ readSnapshot, close });
}
