// First-party public SDK example, with scalar-only collector observations. Apache-2.0.
import { CancellationController, createEngine } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createMouseInput } from '@egret/engine/web/input';
import { createMouseScene } from './scene.mjs';

const canvas = document.querySelector('#scene');
const observer = globalThis.__egretMousePairs;
let engine, scope, input, scene, generation = 0, phase = 'starting', setupFailure, setupFailed = false;
let closePromise, pendingHostTimers = 0, diagnosticOverflow = false;
const diagnostics = [], hostTrace = [];

function diagnostic(value) {
  if (diagnostics.length >= 32) { diagnosticOverflow = true; return; }
  diagnostics.push({ code: value.code, phase: value.phase, severity: value.severity,
    causeCode: value.cause?.code ?? null, nestedCauseCode: value.cause?.cause?.code ?? null });
}
function nextInput() {
  generation++;
  observer?.beginGeneration(generation, scope.signal);
  // Only synchronous adapter acquisition establishes listener ownership.
  try { input = createMouseInput({ engine, scope, width: 160, height: 100, maxNodes: 5 }); }
  finally { observer?.endAcquisition(); }
  scene.bind(input);
}
async function initialize() {
  // Public import precedes prototype discovery; Engine assembly captures these observers.
  observer?.installSignal(CancellationController);
  const nativeHost = createCanvasHost({ canvas, pixelRatio: 1 });
  const host = {
    surface: canvas,
    start() { hostTrace.push('host.start'); return nativeHost.start(); },
    stop() { hostTrace.push('host.stop'); return nativeHost.stop(); },
    close() { hostTrace.push('host.close'); return nativeHost.close(); },
    renderFrame(frame) { return nativeHost.renderFrame(frame); },
    setTimeout(callback, delay) {
      let active = true; pendingHostTimers++;
      let cancel;
      try { cancel = nativeHost.setTimeout(() => { if (active) { active = false; pendingHostTimers--; } callback(); }, delay); }
      catch (cause) { active = false; pendingHostTimers--; throw cause; }
      return () => { if (active) { active = false; pendingHostTimers--; } cancel(); };
    },
  };
  engine = await createEngine({ host, onDiagnostic: diagnostic });
  scope = engine.createScope();
  scene = createMouseScene(engine, scope);
  nextInput(); phase = 'ready';
}

export function readSnapshot() {
  return { phase, generation, state: input?.state ?? null, ...(scene?.snapshot() ?? {}),
    diagnostics: diagnostics.map(row => ({ ...row })), diagnosticOverflow,
    hostTrace: hostTrace.slice(), pendingHostTimers,
    setupFailure: setupFailed ? { present: true, kind: setupFailure === undefined ? 'undefined' : typeof setupFailure, text: String(setupFailure) } : null,
    surface: { connected: canvas.isConnected, width: canvas.width, height: canvas.height } };
}
export const resetLog = () => scene.resetLog();
export const armCover = () => scene.armCover();
export const render = () => scene.render();
export function disposeInput() { input.dispose(); return readSnapshot(); }
export function beginCssProbe() {
  if (input.state !== 'closed') throw new Error('First adapter must be explicitly closed');
  scene.resetCover(); scene.resetLog(); scene.render(); nextInput();
  return readSnapshot();
}
export function setAncestorTransform() { canvas.parentElement.style.transform = 'scale(1)'; }

/** One shared close result; borrowed canvas dimensions and DOM membership remain external. */
export function close() {
  closePromise ??= (async () => {
    const failures = [];
    try { if (engine) await engine.dispose(); } catch (cause) { failures.push(cause); }
    finally {
      phase = 'closed';
      const restoration = observer?.restore();
      if (restoration && !restoration.restored) failures.push(new Error('Observer descriptor restoration failed'));
    }
    if (failures.length) throw new AggregateError(failures, 'Example close failed');
    return readSnapshot();
  })();
  return closePromise;
}
export const ready = initialize().then(() => true, async cause => {
  setupFailed = true; setupFailure = cause;
  try { await close(); } catch { /* Preserve setupFailure; collector also inspects teardown. */ }
  return false;
});
await ready;
