// SPDX-License-Identifier: Apache-2.0
import {
  createEngine, Bitmap, DisplayObjectContainer, createImageData2D, createTexture,
  createAssetType, createAssetRef, isTexture,
} from '@egret/engine';
import { createMouseInput, createBitmapButton } from '@egret/engine/web/input';

const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const backend = new URL(location.href).searchParams.get('backend') === 'webgpu' ? 'webgpu' : 'canvas';
const FRAME = Object.freeze({ width: 32, height: 24, clearColor: 0, clearAlpha: 0 });
const errors = [], diagnostics = [], requests = [], providerJobs = [], events = [], buttons = [];
const pendingTickets = new Set(), tickets = [], timers = new Set(), providerDisposals = [];
let engine, host, scope, inputScope, input, target, parent, slot, initialLease, skinLease, manualLease;
let state = 'starting', selected = null, targetActivations = 0, nextRequest = 0, serialPresentation = Promise.resolve();
let savedInitial, lastPixels, closePromise, closeRequested = false, lastLabel = null;

function rgbaTexture(width, height, rgba) {
  const pixels = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(rgba, offset);
  return createTexture(createImageData2D({ width, height, pixels }));
}
const A = rgbaTexture(2, 2, [255, 0, 0, 255]);
const skins = rgbaTexture(24, 4, [128, 128, 128, 255]);
const textureType = createAssetType('bitmap-resource-slot-example', isTexture);
const aRef = createAssetRef(textureType, 'example:A');
const skinRef = createAssetRef(textureType, 'example:button-skins');
function errorView(error) { return { code: error?.code ?? null, message: String(error?.message ?? error) }; }
function replacementAllowed() { return state === 'ready' && ['idle', 'pending', 'ready', 'failed'].includes(slot?.state); }
function refresh() {
  const slotState = slot?.state, canReplace = replacementAllowed();
  for (const button of buttons) if (button.state !== 'disposed') button.enabled = canReplace;
  const pendingJob = providerJobs.find(job => job.id === nextRequest && !job.settled);
  const canSettle = canReplace && slotState === 'pending' && !!pendingJob;
  for (const id of ['finish', 'fail']) document.querySelector('#' + id).disabled = !canSettle;
  document.querySelector('#cancel').disabled = !canReplace || slotState !== 'pending';
  document.querySelector('#dispose').disabled = state !== 'ready' || slotState === 'disposed';
  document.querySelector('#recreate').disabled = state !== 'ready' || !['disposed', 'conflicted'].includes(slotState);
  document.querySelector('#close').disabled = state === 'closing' || state === 'closed';
  status.dataset.state = state; status.textContent = JSON.stringify(inspect(), null, 2);
}
function inspect() {
  return {
    state, backend, slotState: slot?.state ?? null, selected, targetActivations,
    label: lastLabel, crop: target?.sourceRect ?? null,
    dimensions: target ? [target.naturalWidth, target.naturalHeight] : null,
    events: events.map(value => ({ ...value })),
    requests: requests.map(({ id, color, outcome, code }) => ({ id, color, outcome, code })),
    jobs: providerJobs.map(({ id, color, settled, aborted }) => ({ id, color, settled, aborted })),
    buttonStates: buttons.map(button => button.state),
    pendingProviderJobs: providerJobs.filter(job => !job.settled).length,
    pendingReadbacks: pendingTickets.size,
    readbacks: tickets.map(({ status, label }) => ({ status, label })),
    pendingTimers: timers.size, providerDisposals: [...providerDisposals],
    inputState: input?.state ?? null, scopeState: scope?.state ?? null,
    inputScopeState: inputScope?.state ?? null,
    hostStatus: backend === 'webgpu' ? host?.getStatus() ?? null : null,
    errors: errors.map(errorView), diagnostics: diagnostics.map(value => ({ code: value.code, phase: value.phase })),
  };
}

function trackTimerHost(original) {
  return Object.freeze({
    surface: original.surface,
    start: () => original.start(), stop: () => original.stop(), close: () => original.close(),
    renderFrame: frame => original.renderFrame(frame),
    setTimeout(callback, delay) {
      const token = {}, cancel = original.setTimeout(() => { timers.delete(token); callback(); }, delay);
      timers.add(token);
      return () => { timers.delete(token); cancel(); };
    },
  });
}

// Every GPU ticket is armed before renderFrame, including the healthy startup frame.
async function draw(label, frame) {
  let ticket;
  if (backend === 'webgpu') {
    const promise = host.requestReadback();
    ticket = { promise, label, status: 'pending' }; tickets.push(ticket); pendingTickets.add(ticket);
    void promise.then(() => { ticket.status = 'fulfilled'; pendingTickets.delete(ticket); },
      cause => { ticket.status = 'rejected'; pendingTickets.delete(ticket); errors.push(cause); });
  }
  host.renderFrame(frame);
  if (ticket) {
    const result = await ticket.promise;
    lastPixels = { width: result.width, height: result.height, bytes: new Uint8Array(result.bytes) };
    await host.whenIdle();
  } else {
    const result = canvas.getContext('2d').getImageData(0, 0, FRAME.width, FRAME.height);
    lastPixels = { width: result.width, height: result.height, bytes: new Uint8Array(result.data) };
  }
  lastLabel = label;
}
function checkpoint(label, saved = false) {
  const result = serialPresentation.then(async () => {
    if (state === 'closed' || state === 'closing') throw new Error('EXAMPLE_CLOSED');
    await draw(label, saved ? savedInitial : engine.captureFrame(FRAME));
    refresh(); return inspect();
  });
  serialPresentation = result.catch(cause => { errors.push(cause); });
  return result;
}

function request(color) {
  if (!replacementAllowed()) throw new Error('EXAMPLE_REPLACEMENT_UNAVAILABLE');
  const id = nextRequest + 1, ref = createAssetRef(textureType, `example:${color}:${id}`);
  const promise = slot.replace(ref);
  // Admission must return its actual Promise before this application publishes work.
  const record = { id, color, outcome: 'pending', code: null, promise };
  nextRequest = id;
  requests.push(record);
  void promise.then(() => { record.outcome = 'fulfilled'; refresh(); }, cause => {
    record.outcome = 'rejected'; record.code = cause?.code ?? null; refresh();
  });
  refresh(); return id;
}
function settle(id, outcome = 'resolve') {
  const job = providerJobs.find(value => value.id === id);
  if (!job || job.settled) throw new Error('EXAMPLE_PENDING_JOB_REQUIRED');
  job.settled = true;
  if (outcome === 'reject') job.reject(new Error(`Original controlled failure ${id}`));
  else {
    const texture = job.color === 'B' ? rgbaTexture(3, 1, [0, 255, 0, 255]) : rgbaTexture(1, 3, [0, 0, 255, 255]);
    job.resolve(texture);
  }
  refresh();
}
async function settled(id) {
  const record = requests.find(value => value.id === id);
  if (!record) throw new Error('EXAMPLE_REQUEST_REQUIRED');
  try { await record.promise; } catch {}
  // One barrier through the actual returned promise and ordinary queued reactions.
  await Promise.resolve();
  return inspect();
}
function cancel() { slot.cancel('example cancel'); refresh(); }
function disposeSlot() { slot.dispose(); refresh(); }
function recreate() {
  slot.dispose(); target.textureLease = initialLease;
  target.sourceRect = { x: 1, y: 0, width: 1, height: 2 };
  slot = engine.createBitmapResourceSlot(scope, target); refresh();
}
async function providerIdle() { await Promise.allSettled(providerJobs.map(job => job.promise)); await Promise.resolve(); return inspect(); }
async function manualBinding() {
  // A separately acquired live lease belongs to the application, never to the slot.
  manualLease = scope.use(await engine.assets.acquire(aRef));
  target.textureLease = manualLease;
  target.sourceRect = { x: 1, y: 0, width: 1, height: 2 };
  try { slot.cancel(); } catch (cause) {
    if (cause?.code !== 'BITMAP_RESOURCE_BINDING_CHANGED') throw cause;
  }
  refresh();
}
function samples(points) {
  if (!lastPixels) throw new Error('EXAMPLE_PIXEL_CHECKPOINT_REQUIRED');
  return points.map(([x, y]) => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= lastPixels.width || y >= lastPixels.height) throw new Error('EXAMPLE_PIXEL_POINT_INVALID');
    const at = (y * lastPixels.width + x) * 4;
    return { point: [x, y], rgba: Array.from(lastPixels.bytes.slice(at, at + 4)) };
  });
}
function readback() {
  if (!lastPixels) throw new Error('EXAMPLE_PIXEL_CHECKPOINT_REQUIRED');
  return { width: lastPixels.width, height: lastPixels.height, bytes: Array.from(lastPixels.bytes), label: lastLabel };
}

async function initialize() {
  const entry = backend === 'webgpu' ? await import('@egret/engine/webgpu') : await import('@egret/engine/web');
  if (closeRequested) throw new Error('EXAMPLE_CLOSED');
  host = backend === 'webgpu'
    ? entry.createWebGPUHost({ canvas, pixelRatio: 1, enableReadback: true })
    : entry.createCanvasHost({ canvas, pixelRatio: 1 });
  engine = await createEngine({ host: trackTimerHost(host), onDiagnostic: value => { diagnostics.push(value); } });
  if (closeRequested) throw new Error('EXAMPLE_CLOSED');
  scope = engine.createScope(); inputScope = engine.createScope();
  engine.assets.register(textureType, {
    load(ref, context) {
      if (ref === aRef) return Promise.resolve(A);
      if (ref === skinRef) return Promise.resolve(skins);
      const match = /^example:([BC]):([1-9][0-9]*)$/.exec(ref.id);
      if (!match) return Promise.reject(new Error('EXAMPLE_REF_INVALID'));
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const job = { id: Number(match[2]), color: match[1], settled: false, aborted: false, resolve, reject, promise };
      providerJobs.push(job);
      // Intentionally ignored cancellation enables a real late-result cleanup case.
      context.signal.addEventListener('abort', () => { job.aborted = true; }, { once: true });
      refresh();
      return promise;
    },
    dispose(value) {
      providerDisposals.push(value === A ? 'A' : value === skins ? 'skins' : `${value.width}x${value.height}`);
      value.dispose();
    },
  });
  initialLease = scope.use(await engine.assets.acquire(aRef));
  skinLease = scope.use(await engine.assets.acquire(skinRef));
  parent = scope.use(new DisplayObjectContainer());
  Object.assign(parent, { x: 8, y: 4, scaleX: 2, scaleY: 2 });
  parent.clipRect = { x: 0, y: 0, width: 3, height: 2 };
  target = new Bitmap(initialLease); target.x = 1;
  target.sourceRect = { x: 1, y: 0, width: 1, height: 2 };
  target.touchEnabled = true; target.hitArea = { x: 0, y: 0, width: 3, height: 3 };
  parent.addChild(target); engine.stage.addChild(parent);
  slot = engine.createBitmapResourceSlot(scope, target);
  input = createMouseInput({ engine, scope: inputScope, width: FRAME.width, height: FRAME.height });
  target.on(input.events.activate, event => {
    targetActivations++; selected = 'outfit-target';
    events.push({ kind: 'target', sameTarget: event.target === target, x: event.payload.globalX, y: event.payload.globalY });
    refresh();
  }, { signal: inputScope.signal });
  for (const [index, color] of ['B', 'C'].entries()) {
    const button = createBitmapButton({ engine, scope: inputScope, input, textureLease: skinLease,
      skins: { up: { x: 0, y: 0, width: 8, height: 4 }, pressed: { x: 8, y: 0, width: 8, height: 4 }, disabled: { x: 16, y: 0, width: 8, height: 4 } },
      onActivate() { events.push({ kind: 'button-callback', color }); request(color); },
    });
    button.display.x = index === 0 ? 2 : 14; button.display.y = 16;
    engine.stage.addChild(button.display); buttons.push(button);
  }
  engine.stage.on(input.events.activate, event => {
    const index = buttons.findIndex(button => event.target === button.display);
    if (index >= 0) events.push({ kind: 'button-route', color: index === 0 ? 'B' : 'C', sameTarget: event.target === buttons[index].display });
  }, { signal: inputScope.signal });
  savedInitial = engine.captureFrame(FRAME);
  await draw('healthy-startup', savedInitial);
  if (backend === 'webgpu') {
    if (tickets.length !== 1 || tickets[0].status !== 'fulfilled') throw new Error('EXAMPLE_HEALTHY_STARTUP_READBACK_REQUIRED');
    await host.whenIdle();
  }
  state = 'ready'; refresh(); return inspect();
}

function close() {
  if (closePromise) return closePromise;
  closeRequested = true; state = 'closing';
  closePromise = (async () => {
    await ready.catch(() => {});
    await serialPresentation;
    // Retire logical requests first, then settle every authored ignored-cancel job.
    slot?.dispose();
    for (const job of providerJobs) if (!job.settled) settle(job.id, 'resolve');
    await providerIdle();
    await Promise.allSettled(requests.map(record => record.promise));
    await Promise.resolve(); await Promise.resolve();
    inputScope?.dispose(); scope?.dispose();
    if (backend === 'webgpu') await host?.whenIdle();
    await engine?.dispose();
    await Promise.allSettled(tickets.map(ticket => ticket.promise));
    state = 'closed'; refresh();
    return inspect();
  })();
  void closePromise.catch(cause => { errors.push(cause); refresh(); });
  refresh(); return closePromise;
}

const ready = initialize().catch(cause => { errors.push(cause); state = 'failed'; refresh(); throw cause; });
void ready.catch(() => {});
const api = Object.freeze({ ready, inspect, checkpoint, request, settle, settled, providerIdle, cancel, disposeSlot, recreate, manualBinding, samples, readback, close });
// Example-local controls are ordinary application code, not product diagnostics.
window.bitmapResourceExample = api;
const uiFailure = cause => { errors.push(cause); refresh(); };
document.querySelector('#finish').addEventListener('click', () => { try { settle(nextRequest); void settled(nextRequest).then(() => checkpoint('complete')).catch(uiFailure); } catch (cause) { uiFailure(cause); } });
document.querySelector('#fail').addEventListener('click', () => { try { settle(nextRequest, 'reject'); void settled(nextRequest).then(() => checkpoint('failed')).catch(uiFailure); } catch (cause) { uiFailure(cause); } });
document.querySelector('#cancel').addEventListener('click', () => { try { cancel(); void checkpoint('cancelled').catch(uiFailure); } catch (cause) { uiFailure(cause); } });
document.querySelector('#dispose').addEventListener('click', () => { try { disposeSlot(); void checkpoint('disposed').catch(uiFailure); } catch (cause) { uiFailure(cause); } });
document.querySelector('#recreate').addEventListener('click', () => { try { recreate(); void checkpoint('recreated').catch(uiFailure); } catch (cause) { uiFailure(cause); } });
document.querySelector('#close').addEventListener('click', () => { void close().catch(() => {}); });
window.addEventListener('pagehide', () => { void close().catch(() => {}); }, { once: true });
