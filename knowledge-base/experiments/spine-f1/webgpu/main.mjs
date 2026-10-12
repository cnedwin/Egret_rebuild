// SPDX-License-Identifier: Apache-2.0
// Original first-party Clock successor of the private manual F1 harness.
// Source preparation only: execution requires independently accepted full CPU evidence.
import * as egret from '@egret/engine';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createF1ClockSession } from '#f1-manual-bridge';

const canvas = document.querySelector('#scene');
const frameOptions = Object.freeze({ width: 64, height: 48, clearColor: 0, clearAlpha: 0 });
const APPLY = Reflect.apply;
const SCOPE_STATE = Object.getOwnPropertyDescriptor(egret.Scope.prototype, 'state').get;
const SCOPE_DISPOSE = egret.Scope.prototype.dispose;
const ENGINE_ADVANCE = egret.Engine.prototype.advanceTime;
function retainClock(identity) {
  const getters = Object.fromEntries(['state', 'elapsedSeconds', 'tickId', 'maxDeltaSeconds'].map(key =>
    [key, Object.getOwnPropertyDescriptor(identity, key).get]));
  const pause = identity.pause, resume = identity.resume;
  return Object.freeze({
    identity,
    read: () => Object.fromEntries(Object.entries(getters).map(([key, getter]) => [key, APPLY(getter, identity, [])])),
    pause: () => APPLY(pause, identity, []),
    resume: () => APPLY(resume, identity, []),
  });
}
function sameClock(before, after) {
  return ['state', 'elapsedSeconds', 'tickId', 'maxDeltaSeconds'].every(key => before[key] === after[key]);
}
const observe = promise => { promise.catch(() => {}); return promise; };
async function bounded(promise, label) {
  let timer;
  try { return await Promise.race([observe(promise), new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`F1_NATIVE_TIMEOUT:${label}`), { code: 'F1_NATIVE_TIMEOUT' })), 15000);
  })]); } finally { clearTimeout(timer); }
}
let latest;
function insist(value, code, details) {
  if (!value) { const error = new Error(code); Object.assign(error, { code, details }); throw error; }
}
function fault(error, depth = 0) {
  return { name: String(error?.name ?? 'Unknown').slice(0, 16384), code: error?.code ?? null,
    message: String(error?.message ?? error).slice(0, 16384), details: error?.details ?? null,
    cause: depth < 2 && error?.cause !== undefined ? fault(error.cause, depth + 1) : null };
}
function limits(value) {
  const keys = ['maxTextureDimension2D', 'maxBufferSize', 'maxVertexBuffers', 'maxVertexAttributes',
    'maxVertexBufferArrayStride', 'maxColorAttachments', 'maxColorAttachmentBytesPerSample', 'maxBindGroups',
    'maxBindingsPerBindGroup', 'maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage',
    'maxUniformBuffersPerShaderStage', 'maxUniformBufferBindingSize', 'maxBindGroupsPlusVertexBuffers', 'maxInterStageShaderVariables'];
  return Object.fromEntries(keys.map(key => [key, value[key] ?? null]));
}
async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
async function readBound(row, signal) {
  const controller = new AbortController(), onAbort = () => controller.abort(signal.reason);
  if (signal !== undefined) {
    if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const response = await fetch(row.url, { signal: controller.signal, cache: 'no-store' });
    insist(response.ok, 'F1_HTTP_INPUT', { url: row.url, status: response.status });
    const bytes = new Uint8Array(await response.arrayBuffer());
    insist(bytes.length === row.bytes && bytes.length <= row.maxBytes, 'F1_INPUT_BYTES', { url: row.url });
    insist(await digest(bytes) === row.sha256, 'F1_INPUT_SHA', { url: row.url });
    if (signal?.aborted) throw signal.reason;
    return bytes;
  } finally { signal?.removeEventListener('abort', onAbort); }
}
function providers(engine, config) {
  const counts = { headerLoads: 0, headerDisposals: 0, pageLoads: 0, pageDisposals: 0 };
  const textType = egret.createAssetType('F1 browser original text', value => typeof value === 'string');
  const pageType = egret.createAssetType('F1 browser original page', egret.isTexture);
  const refs = Object.freeze({ skeleton: egret.createAssetRef(textType, 'skeleton'),
    atlas: egret.createAssetRef(textType, 'atlas'), page: egret.createAssetRef(pageType, 'page') });
  let page;
  engine.assets.register(textType, {
    async load(ref, context) {
      insist(ref.id === 'skeleton' || ref.id === 'atlas', 'F1_TEXT_REF');
      const bytes = await readBound(config.fixtures[ref.id], context.signal);
      counts.headerLoads++;
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
    dispose() { counts.headerDisposals++; },
  });
  engine.assets.register(pageType, {
    async load(ref, context) {
      insist(ref.id === 'page', 'F1_PAGE_REF');
      const bytes = await readBound(config.fixtures.page, context.signal);
      insist(bytes.length === 1024, 'F1_RGBA_SIZE');
      const pixels = new Uint8Array(1024); pixels.set(bytes);
      page = egret.createTexture(egret.createImageData2D({ width: 16, height: 16, pixels }));
      counts.pageLoads++;
      return page;
    },
    dispose(texture) { counts.pageDisposals++; texture.dispose(); },
  });
  return { refs, counts, page: () => page };
}
function snapshot(instance) {
  const root = instance.display;
  const geometry = [];
  if (!root.isDisposed) for (let index = 0; index < root.numChildren; index++) {
    const mesh = root.getChildAt(index), value = mesh.geometry;
    insist(mesh instanceof egret.Mesh2D && egret.isTexturedGeometry2D(value), 'F1_REAL_BRIDGE_MESH');
    geometry.push({ mesh, value, data: JSON.stringify(value) });
  }
  return { elapsed: instance.elapsedSeconds, displayDisposed: root.isDisposed, childCount: root.numChildren, geometry };
}
function unchanged(instance, before) {
  insist(instance.elapsedSeconds === before.elapsed, 'F1_NATIVE_NO_TIME_ADVANCE');
  insist(instance.display.isDisposed === before.displayDisposed && instance.display.numChildren === before.childCount, 'F1_NATIVE_NO_DISPLAY_MUTATION');
  for (const row of before.geometry) insist(row.mesh.geometry === row.value && JSON.stringify(row.value) === row.data, 'F1_NATIVE_NO_GEOMETRY_MUTATION');
}
function pixels(bytes, oracle, id, time) {
  for (const sample of oracle.frames.find(frame => frame.t === time).pixels) {
    const [x, y] = sample.xy, actual = [...bytes.slice(4 * (64 * y + x), 4 * (64 * y + x) + 4)];
    insist(actual.length === 4 && actual.every((value, channel) => value === sample.RGBA[channel]),
      'F1_PIXEL_MISMATCH', { id, time, x, y, expected: sample.RGBA, actual, tolerance: 0 });
  }
}
function canvasMetadata() {
  const rect = canvas.getBoundingClientRect(), style = getComputedStyle(canvas);
  return { backing: [canvas.width, canvas.height], browserDPR: devicePixelRatio, hostPixelRatio: 1,
    css: { width: rect.width, height: rect.height, opacity: style.opacity, transform: style.transform, filter: style.filter } };
}

async function run(mode) {
  const configResponse = await fetch('/experiment/config.json', { cache: 'no-store' });
  insist(configResponse.ok, 'F1_CONFIG_HTTP');
  const config = await configResponse.json();
  insist(mode === config.mode && ['baseline', 'double-state-step'].includes(mode), 'F1_MODE');
  const oracle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBound(config.fixtures.oracle)));
  insist(oracle.nativeSuccessor.channelTolerance === 0, 'F1_FIXED_PIXEL_TOLERANCE');
  const theta = 90 * (3.1415927 / 180);
  insist(Math.cos(0) === 1 && Math.sin(0) === 0 && Math.abs(Math.cos(theta)) <= 2.4e-8 && Math.abs(Math.sin(theta) - 1) <= 2 ** -48, 'F1_BROWSER_TRIG_PREMISES');
  const report = { schemaVersion: 1, kind: 'F1_CLOCK_DESKTOP_WEBGPU_FINITE_SUCCESSOR', mode, status: 'INCOMPLETE',
    plannedCounts: { positive: 10, separateControl: 1 }, expectedObservations: mode === 'baseline' ? 10 : 1,
    actualObservationCount: 0, environment: { userAgent: navigator.userAgent,
      platform: navigator.platform, browserDPR: devicePixelRatio, isSecureContext, preferredFormat: null },
    adapter: null, device: null, observations: [], sourceClock: [], closingWindow: null,
    createdBindingFacts: { A: null, B: null }, createdHandles: [], createdScopes: [],
    diagnostics: [], uncaptured: [], failure: null,
    cleanup: { host: null, provider: null, clock: null, bindings: { A: null, B: null }, handles: [], scopes: [],
      deviceDestroyed: false, deviceLoss: null, failures: [] } };
  latest = report;
  let device, loss, destroyRequested = false, host, session, engine, clock, resources, p, scope, A, B;
  let scopeA, scopeB, subscriptionA, subscriptionB, lastSourceInput = null;
  const scopes = [], handles = [], primaryBindings = { A: null, B: null };
  const scopeFact = value => {
    const record = scopes.find(row => row.value === value);
    return record ? { id: record.id, role: record.role, state: APPLY(SCOPE_STATE, value, []) } : null;
  };
  const handleFact = record => record ? { id: record.id, instance: record.instance, source: record.source,
    scope: scopeFact(record.scope), isDisposed: APPLY(record.disposed, record.handle, []) } : null;
  const bindingFacts = () => ({ A: handleFact(primaryBindings.A), B: handleFact(primaryBindings.B) });
  const scopeFacts = () => scopes.map(row => scopeFact(row.value));
  function publishFacts() {
    report.createdBindingFacts = bindingFacts();
    report.createdHandles = handles.map(handleFact);
    report.createdScopes = scopeFacts();
  }
  function newScope(role) {
    const value = engine.createScope();
    scopes.push({ id: scopes.length + 1, role, value });
    publishFacts();
    return value;
  }
  function rememberHandle(handle, instance, owner, source, primary) {
    let record = handles.find(row => row.handle === handle);
    if (!record) {
      const disposed = Object.getOwnPropertyDescriptor(handle, 'isDisposed')?.get;
      insist(typeof disposed === 'function' && Object.isFrozen(handle), 'F1_CLOCK_RETURNED_HANDLE');
      record = { id: handles.length + 1, handle, disposed, instance, scope: owner, source };
      handles.push(record);
    }
    if (primary) primaryBindings[instance] = record;
    publishFacts();
    return record;
  }
  function lifetimes() {
    return { resourceScope: scopeFact(scope),
      A: A ? { elapsedSeconds: A.elapsedSeconds, displayDisposed: A.display.isDisposed, scope: scopeFact(scopeA),
        binding: handleFact(primaryBindings.A) } : null,
      B: B ? { elapsedSeconds: B.elapsedSeconds, displayDisposed: B.display.isDisposed, scope: scopeFact(scopeB),
        binding: handleFact(primaryBindings.B) } : null,
      bindings: bindingFacts(), handles: handles.map(handleFact), scopes: scopeFacts() };
  }
  // Inputs and actual public results are recorded, never a private source-floor getter.
  function operation(op, input, action) {
    const row = { sequence: report.sourceClock.length + 1, op, input, status: 'STARTED',
      clockBefore: clock.read(), lifetimeBefore: lifetimes(), returnedTick: null, returnedHandleId: null, failure: null };
    report.sourceClock.push(row);
    try {
      const result = action();
      if (op === 'advanceTime') row.returnedTick = result === undefined ? null :
        { deltaSeconds: result.deltaSeconds, elapsedSeconds: result.elapsedSeconds, tickId: result.tickId };
      if (op.endsWith('.bindClock') && result !== undefined)
        row.returnedHandleId = handles.find(record => record.handle === result)?.id ?? null;
      row.status = 'RETURNED';
      return result;
    } catch (cause) {
      row.status = 'THREW'; row.failure = fault(cause); throw cause;
    } finally {
      row.clockAfter = clock.read(); row.lifetimeAfter = lifetimes();
      publishFacts();
    }
  }
  const advance = source => operation('advanceTime', { sourceSeconds: source }, () => {
    lastSourceInput = source;
    return APPLY(ENGINE_ADVANCE, engine, [source]);
  });
  function requireClock(state, elapsedSeconds, tickId) {
    const actual = clock.read();
    insist(actual.state === state && actual.elapsedSeconds === elapsedSeconds && actual.tickId === tickId &&
      actual.maxDeltaSeconds === 0.25, 'F1_CLOCK_PUBLIC_STATE', { actual, expected: { state, elapsedSeconds, tickId, maxDeltaSeconds: 0.25 } });
    return actual;
  }
  function sample(source, state, elapsedSeconds, tickId, expectedTick, localA, localB) {
    const tick = advance(source);
    insist(expectedTick === null ? tick === undefined :
      tick?.deltaSeconds === 0.25 && tick.elapsedSeconds === elapsedSeconds && tick.tickId === tickId,
      'F1_CLOCK_SOURCE_RESULT', { source, actual: tick ?? null, expected: expectedTick });
    requireClock(state, elapsedSeconds, tickId);
    insist(A.elapsedSeconds === localA && B.elapsedSeconds === localB, 'F1_CLOCK_LOCAL_TIMES');
    return tick;
  }
  function bind(instance, name, owner, source, primary = true) {
    const beforeA = snapshot(A), beforeB = snapshot(B), beforeClock = clock.read();
    const handle = operation(name + '.bindClock', { scopeId: scopeFact(owner).id, source }, () => {
      const returned = instance.bindClock(owner);
      rememberHandle(returned, name, owner, source, primary);
      return returned;
    });
    unchanged(A, beforeA); unchanged(B, beforeB);
    insist(sameClock(beforeClock, clock.read()), 'F1_CLOCK_BIND_INERT');
    return handle;
  }
  const event = value => {
    if (report.uncaptured.length >= 32) { report.eventOverflow = true; return; }
    report.uncaptured.push(fault(value.error));
  };
  try {
    if (!navigator.gpu) { report.status = 'UNSUPPORTED_DEFAULT_ENVIRONMENT'; report.capability = 'navigator.gpu absent'; return report; }
    report.environment.preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    const adapter = await observe(navigator.gpu.requestAdapter());
    if (adapter === null) { report.status = 'UNSUPPORTED_DEFAULT_ENVIRONMENT'; report.capability = 'default adapter null'; return report; }
    const info = adapter.info;
    report.adapter = { info: info ? { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description } : null,
      isFallbackAdapter: adapter.isFallbackAdapter ?? null, features: [...adapter.features], limits: limits(adapter.limits) };
    device = await observe(adapter.requestDevice());
    report.device = { label: device.label, features: [...device.features], limits: limits(device.limits) };
    device.addEventListener('uncapturederror', event);
    loss = observe(device.lost.then(value => {
      const row = { reason: value.reason, message: value.message, destroyRequested };
      report.cleanup.deviceLoss = row;
      if (!destroyRequested) report.unexpectedDeviceLoss = true;
      return row;
    }));
    host = createTexturedWebGPUHost({ canvas, device: { kind: 'borrow', device }, pixelRatio: 1,
      enableReadback: true, maxBackingPixels: 3072, maxPendingFrames: 1, maxReadbackBytes: 24576,
      onDiagnostic(value) { if (report.diagnostics.length >= 32) report.eventOverflow = true;
        else report.diagnostics.push({ code: value.code, serial: value.serial, phase: value.phase }); } });
    session = await createF1ClockSession({ host });
    engine = session.engine;
    // Capture the genuine facade/getters before provider callbacks or resources exist.
    clock = retainClock(engine.clock);
    requireClock('running', 0, 0);
    report.initialClock = clock.read();
    p = providers(engine, config); scope = newScope('resource');
    resources = await session.createResources(scope, p.refs);
    scopeA = newScope('A-instance'); scopeB = newScope('B-instance');
    A = resources.createInstance(scopeA); B = resources.createInstance(scopeB);
    subscriptionA = newScope('A-subscription'); subscriptionB = newScope('B-subscription');
    const originals = [...snapshot(A).geometry, ...snapshot(B).geometry];
    let lastSerial = host.getStatus().lastSerial;
    const reads = new Map();
    // These finite inputs are independent literals; no candidate pose defines an oracle.
    const plans = [
      { id: 'F1G01', instance: 'A', time: 0, source: 0, state: 'running', elapsed: 0, tick: 0, A: 0, B: 0, retiredA: false, retiredB: null, same: [] },
      { id: 'F1G02', instance: 'A', time: 0, source: 0, state: 'running', elapsed: 0, tick: 0, A: 0, B: 0, retiredA: false, retiredB: null, same: ['F1G01'] },
      { id: 'F1G03', instance: 'A', time: 0.5, source: 0.5, state: 'running', elapsed: 0.5, tick: 2, A: 0.5, B: 0, retiredA: false, retiredB: null, same: [] },
      { id: 'F1G04', instance: 'A', time: 0.5, source: 0.75, state: 'paused', elapsed: 0.5, tick: 2, A: 0.5, B: 0, retiredA: false, retiredB: null, same: ['F1G03'] },
      { id: 'F1G05', instance: 'A', time: 1, source: 1.5, state: 'running', elapsed: 1, tick: 4, A: 1, B: 0, retiredA: false, retiredB: null, same: [] },
      { id: 'F1G06', instance: 'A', time: 1, source: 1.5, state: 'running', elapsed: 1, tick: 4, A: 1, B: 0, retiredA: false, retiredB: null, same: ['F1G05'] },
      { id: 'F1G07', instance: 'B', time: 0, source: 1.5, state: 'running', elapsed: 1, tick: 4, A: 1, B: 0, retiredA: false, retiredB: null, same: [] },
      { id: 'F1G08', instance: 'B', time: 0, source: 1.5, state: 'running', elapsed: 1, tick: 4, A: 1, B: 0, retiredA: true, retiredB: null, same: ['F1G07'] },
      { id: 'F1G09', instance: 'B', time: 0.5, source: 2, state: 'running', elapsed: 1.5, tick: 6, A: 1, B: 0.5, retiredA: true, retiredB: false, same: ['F1G03'] },
      { id: 'F1G10', instance: 'B', time: 0.5, source: 2.25, state: 'running', elapsed: 1.75, tick: 7, A: 1, B: 0.5, retiredA: true, retiredB: true, same: ['F1G09', 'F1G03'] },
    ];
    const controlPlan = { id: 'F1D01', instance: 'A', time: 0.5, source: 0.5, state: 'running',
      elapsed: 0.5, tick: 2, A: 0.5, B: 0, retiredA: false, retiredB: null, same: [] };
    async function render(id, instance) {
      const planned = mode === 'baseline' ? plans[report.observations.length] : controlPlan;
      insist(planned && planned.id === id && planned.instance === (instance === A ? 'A' : 'B'), 'F1_CLOCK_READBACK_ORDER');
      insist(instance.elapsedSeconds === planned.time && A.elapsedSeconds === planned.A &&
        B.elapsedSeconds === planned.B && lastSourceInput === planned.source, 'F1_CLOCK_FRAME_TIMES');
      requireClock(planned.state, planned.elapsed, planned.tick);
      const bindings = bindingFacts();
      insist(bindings.A?.isDisposed === planned.retiredA &&
        (bindings.B === null ? planned.retiredB === null : bindings.B.isDisposed === planned.retiredB), 'F1_CLOCK_FRAME_BINDINGS');
      insist(A.display.isDisposed === (planned.retiredA && planned.A === 1) && !B.display.isDisposed, 'F1_CLOCK_FRAME_LIFETIMES');
      insist(APPLY(SCOPE_STATE, subscriptionB, []) === (id === 'F1G10' ? 'closed' : 'open'), 'F1_CLOCK_SUBSCRIPTION_SCOPE');
      insist(p.counts.pageLoads === 1 && p.counts.pageDisposals === 0 && !p.page().isDisposed, 'F1_SHARED_PAGE_LIVE');
      const beforeA = snapshot(A), beforeB = snapshot(B), beforeClock = clock.read(), beforeLifetime = lifetimes();
      const ticket = observe(host.requestReadback());
      let frame;
      try { frame = engine.renderTexturedFrame(frameOptions); }
      catch (cause) { throw cause; } // Close cancels any unbound observed ticket.
      const idle = observe(host.whenIdle());
      const [readback] = await bounded(Promise.all([ticket, idle]), id);
      const status = host.getStatus(), textured = host.getTexturedStatus(), metadata = canvasMetadata();
      insist(readback.frameId === frame.frameId && readback.serial === status.lastSerial && readback.serial === lastSerial + 1, 'F1_READBACK_IDENTITY');
      lastSerial = readback.serial;
      insist(readback.width === 64 && readback.height === 48 && readback.bytes.length === 12288 && readback.format === 'rgba8unorm' &&
        ['rgba8unorm', 'bgra8unorm'].includes(readback.sourceFormat) && readback.colorSpace === 'srgb' && readback.alphaMode === 'premultiplied', 'F1_READBACK_METADATA');
      insist(status.pendingFrames === 0 && status.pendingUploadBytes === 0 && status.pendingReadbackBytes === 0 && textured.pendingGeometryBytes === 0 && status.firstFailure === null, 'F1_GPU_IDLE_LEDGER');
      insist(metadata.backing[0] === 64 && metadata.backing[1] === 48 && metadata.browserDPR === 1 && metadata.css.width === 64 && metadata.css.height === 48 &&
        metadata.css.opacity === '1' && metadata.css.transform === 'none' && metadata.css.filter === 'none', 'F1_CANVAS_METADATA');
      insist(frame.commands.length === 2 && frame.commands.every(command => command.kind === 'mesh') && frame.images.length === 1 && frame.images[0] === p.page().imageData, 'F1_GENUINE_FRAME');
      for (let index = 0; index < 2; index++) {
        const mesh = instance.display.getChildAt(index), command = frame.commands[index];
        insist(mesh instanceof egret.Mesh2D && mesh.textureLease.value === p.page() && frame.geometries[command.geometryIndex] === mesh.geometry, 'F1_GENUINE_FRAME_GEOMETRY');
      }
      unchanged(A, beforeA); unchanged(B, beforeB);
      const afterClock = clock.read(), afterLifetime = lifetimes();
      insist(engine.clock === clock.identity && sameClock(beforeClock, afterClock), 'F1_NATIVE_NO_CLOCK');
      insist(JSON.stringify(beforeLifetime) === JSON.stringify(afterLifetime), 'F1_NATIVE_NO_LIFETIME_MUTATION');
      // Old immutable values remain content-stable even after disposed Mesh slots clear.
      for (const row of originals) insist(JSON.stringify(row.value) === row.data, 'F1_RETAINED_OLD_GEOMETRY');
      for (const sameAs of planned.same) {
        const first = reads.get(sameAs);
        insist(first && first.length === readback.bytes.length && first.every((value, index) => value === readback.bytes[index]), 'F1_REPEAT_COMPLETE_BYTES');
      }
      const bytes = [...readback.bytes]; reads.set(id, bytes);
      const row = { id, time: planned.time, instance: instance === A ? 'A' : 'B', frameId: frame.frameId, serial: readback.serial,
        width: readback.width, height: readback.height, format: readback.format, sourceFormat: readback.sourceFormat,
        colorSpace: readback.colorSpace, alphaMode: readback.alphaMode, status, texturedStatus: textured, canvas: metadata,
        sourceSeconds: lastSourceInput, sourceClockLength: report.sourceClock.length,
        clockBefore: beforeClock, clockAfter: afterClock, lifetimeBefore: beforeLifetime, lifetimeAfter: afterLifetime,
        createdBindingFacts: bindings, equalRawBytesTo: [...planned.same],
        inertia: { elapsedAndGeometryA: true, elapsedAndGeometryB: true, authenticClock: true, lifetimes: true, retainedOldGeometry: true },
        bytes };
      insist(typeof globalThis.__retainF1Readback === 'function', 'F1_RETAIN_BINDING');
      // The wrapper independently retains/classifies every raw byte before a pixel assertion.
      await observe(globalThis.__retainF1Readback(row));
      report.observations.push({ ...row, bytes: undefined });
      report.actualObservationCount = report.observations.length;
      pixels(readback.bytes, oracle, id, planned.time);
    }
    engine.stage.addChild(A.display);
    bind(A, 'A', subscriptionA, 'initial');
    sample(0, 'running', 0, 0, null, 0, 0);
    if (mode === 'double-state-step') {
      sample(0.25, 'running', 0.25, 1, { deltaSeconds: 0.25, elapsedSeconds: 0.25, tickId: 1 }, 0.25, 0);
      sample(0.5, 'running', 0.5, 2, { deltaSeconds: 0.25, elapsedSeconds: 0.5, tickId: 2 }, 0.5, 0);
      await render('F1D01', A);
      throw new Error('F1_DOUBLE_STEP_NOT_DETECTED');
    }
    await render('F1G01', A);
    sample(0, 'running', 0, 0, null, 0, 0);
    await render('F1G02', A);
    sample(0.25, 'running', 0.25, 1, { deltaSeconds: 0.25, elapsedSeconds: 0.25, tickId: 1 }, 0.25, 0);
    sample(0.5, 'running', 0.5, 2, { deltaSeconds: 0.25, elapsedSeconds: 0.5, tickId: 2 }, 0.5, 0);
    await render('F1G03', A);
    operation('clock.pause', {}, () => clock.pause());
    requireClock('paused', 0.5, 2);
    sample(0.75, 'paused', 0.5, 2, null, 0.5, 0);
    await render('F1G04', A);
    operation('clock.resume', {}, () => clock.resume());
    requireClock('running', 0.5, 2);
    sample(1, 'running', 0.5, 2, null, 0.5, 0);
    sample(1.25, 'running', 0.75, 3, { deltaSeconds: 0.25, elapsedSeconds: 0.75, tickId: 3 }, 0.75, 0);
    sample(1.5, 'running', 1, 4, { deltaSeconds: 0.25, elapsedSeconds: 1, tickId: 4 }, 1, 0);
    await render('F1G05', A);
    sample(1.5, 'running', 1, 4, null, 1, 0);
    await render('F1G06', A);
    operation('stage.showB', {}, () => { engine.stage.removeChild(A.display); engine.stage.addChild(B.display); });
    await render('F1G07', B);
    operation('A.dispose', {}, () => A.dispose());
    await render('F1G08', B);
    bind(B, 'B', subscriptionB, 'after-A-close');
    sample(1.75, 'running', 1.25, 5, { deltaSeconds: 0.25, elapsedSeconds: 1.25, tickId: 5 }, 1, 0.25);
    sample(2, 'running', 1.5, 6, { deltaSeconds: 0.25, elapsedSeconds: 1.5, tickId: 6 }, 1, 0.5);
    await render('F1G09', B);

    const retainedB = snapshot(B), probeScope = newScope('closing-bind-probe');
    const witness = { started: false, completed: false, before: null, after: null, refusals: [],
      advanceTick: null, advanceError: null, listenerFailure: null, afterClosed: null, zeroNoop: null };
    report.closingWindow = witness;
    function refusal(phase, op, action) {
      try {
        action();
        witness.refusals.push({ phase, op, returned: true, failure: null });
      } catch (cause) { witness.refusals.push({ phase, op, returned: false, failure: fault(cause) }); }
    }
    subscriptionB.signal.addEventListener('abort', () => {
      // Cancellation isolates listener failures: collect facts here and assert only outside.
      witness.started = true;
      try {
        witness.before = { scope: scopeFact(subscriptionB), binding: handleFact(primaryBindings.B),
          elapsedSeconds: B.elapsedSeconds, clock: clock.read() };
        refusal('before-tick', 'B.step(0)', () => operation('B.step', { deltaSeconds: 0, closingPhase: 'before-tick' }, () => B.step(0)));
        refusal('before-tick', 'B.bindClock(probe)', () => bind(B, 'B', probeScope, 'closing-before-tick-probe', false));
        try {
          const tick = advance(2.25);
          witness.advanceTick = tick === undefined ? null : { deltaSeconds: tick.deltaSeconds, elapsedSeconds: tick.elapsedSeconds, tickId: tick.tickId };
        } catch (cause) { witness.advanceError = fault(cause); }
        witness.after = { scope: scopeFact(subscriptionB), binding: handleFact(primaryBindings.B),
          elapsedSeconds: B.elapsedSeconds, clock: clock.read() };
        refusal('after-tick', 'B.step(0)', () => operation('B.step', { deltaSeconds: 0, closingPhase: 'after-tick' }, () => B.step(0)));
        refusal('after-tick', 'B.bindClock(probe)', () => bind(B, 'B', probeScope, 'closing-after-tick-probe', false));
      } catch (cause) { witness.listenerFailure = fault(cause); }
      finally { witness.completed = true; }
    }, { once: true });
    operation('B.subscriptionScope.dispose', { scopeId: scopeFact(subscriptionB).id }, () => APPLY(SCOPE_DISPOSE, subscriptionB, []));
    witness.afterClosed = { scope: scopeFact(subscriptionB), binding: handleFact(primaryBindings.B),
      elapsedSeconds: B.elapsedSeconds, clock: clock.read(), pageDisposed: p.page().isDisposed, displayDisposed: B.display.isDisposed };
    insist(witness.started && witness.completed && witness.listenerFailure === null && witness.advanceError === null, 'F1_CLOCK_ABORT_LISTENER_COMPLETED');
    insist(witness.before?.scope.state === 'closing' && witness.before.binding.isDisposed === false && witness.before.elapsedSeconds === 0.5 &&
      witness.after?.scope.state === 'closing' && witness.after.binding.isDisposed === true && witness.after.elapsedSeconds === 0.5, 'F1_CLOCK_ABORT_RETIREMENT');
    const expectedRefusals = [['before-tick', 'B.step(0)'], ['before-tick', 'B.bindClock(probe)'], ['after-tick', 'B.step(0)'], ['after-tick', 'B.bindClock(probe)']];
    insist(witness.refusals.length === 4 && witness.refusals.every((row, index) => row.phase === expectedRefusals[index][0] &&
      row.op === expectedRefusals[index][1] && row.returned === false && row.failure?.code === 'F1_CLOCK_SCOPE_CLOSED'), 'F1_CLOCK_ABORT_DIRECT_REFUSALS');
    insist(witness.advanceTick?.deltaSeconds === 0.25 && witness.advanceTick.elapsedSeconds === 1.75 &&
      witness.advanceTick.tickId === 7, 'F1_CLOCK_ABORT_REAL_TICK');
    requireClock('running', 1.75, 7);
    unchanged(B, retainedB);
    insist(witness.afterClosed.scope.state === 'closed' && witness.afterClosed.binding.isDisposed === true &&
      !witness.afterClosed.pageDisposed && !witness.afterClosed.displayDisposed, 'F1_CLOCK_DETACH_ONLY');
    const beforeZero = snapshot(B), clockBeforeZero = clock.read();
    operation('B.step', { deltaSeconds: 0, phase: 'after-closed' }, () => B.step(0));
    unchanged(B, beforeZero);
    const clockAfterZero = clock.read();
    insist(sameClock(clockBeforeZero, clockAfterZero), 'F1_CLOCK_CLOSED_ZERO_INERT');
    witness.zeroNoop = { deltaSeconds: 0, clockBefore: clockBeforeZero, clockAfter: clockAfterZero,
      elapsedBefore: beforeZero.elapsed, elapsedAfter: B.elapsedSeconds, geometryUnchanged: true };
    await render('F1G10', B);
    insist(report.observations.length === 10 && handles.length === 2, 'F1_CLOCK_FINITE_POSITIVE_COUNT');
    APPLY(SCOPE_DISPOSE, scope, []);
    insist(B.display.isDisposed && p.counts.headerDisposals === 2 && p.counts.pageDisposals === 1, 'F1_SHARED_RESOURCE_RETIREMENT');
    report.status = 'SCENE_COMPLETED';
  } catch (cause) {
    report.failure = fault(cause);
    report.status = cause?.code === 'F1_PIXEL_MISMATCH' ? 'PIXEL_FAIL' : 'INCOMPLETE';
  } finally {
    const cleanup = async action => { try { await action(); } catch (cause) { report.cleanup.failures.push(fault(cause)); } };
    await cleanup(async () => { resources?.dispose(); if (scope) APPLY(SCOPE_DISPOSE, scope, []); });
    if (engine) await cleanup(() => engine.dispose()); else if (host) await cleanup(() => host.close());
    await cleanup(async () => {
      report.createdBindingFacts = bindingFacts();
      report.createdHandles = handles.map(handleFact);
      report.createdScopes = scopeFacts();
      report.cleanup.bindings = bindingFacts();
      report.cleanup.handles = handles.map(handleFact);
      report.cleanup.scopes = scopeFacts();
      if (clock) {
        report.cleanup.clock = clock.read();
        insist(report.cleanup.clock.state === 'closed', 'F1_CLOCK_CLOSE_UNPROVEN');
      }
      // Null means no returned registration; only actual handles must be disposed.
      insist(report.cleanup.handles.every(row => row.isDisposed === true), 'F1_CLOCK_HANDLE_RETIREMENT_UNPROVEN');
      insist(report.cleanup.scopes.every(row => row.state === 'closed'), 'F1_CLOCK_SCOPE_RETIREMENT_UNPROVEN');
    });
    if (host) {
      report.cleanup.host = { status: host.getStatus(), texturedStatus: host.getTexturedStatus() };
      const state = report.cleanup.host;
      if (state.status.state !== 'closed' || state.status.cleanupOutcome !== 'safe' || state.status.pendingFrames || state.status.pendingUploadBytes || state.status.pendingReadbackBytes || state.texturedStatus.pendingGeometryBytes)
        report.cleanup.failures.push({ code: 'F1_HOST_CLOSE_UNPROVEN' });
    }
    if (p) report.cleanup.provider = { ...p.counts, pageDisposed: p.page()?.isDisposed ?? null, ADisposed: A?.display.isDisposed ?? null, BDisposed: B?.display.isDisposed ?? null };
    // Host borrowing ends first. Only this actual browser-owned device owner destroys it.
    if (device && (!host || (host.getStatus().state === 'closed' && host.getStatus().cleanupOutcome === 'safe'))) {
      await cleanup(async () => { destroyRequested = true; device.destroy(); report.cleanup.deviceDestroyed = true; });
      if (loss) await cleanup(() => loss);
      device.removeEventListener('uncapturederror', event);
    } else if (device) {
      // An unsafe/missing return cannot authorize an ordinary borrowed lifetime
      // success. Root's bounded browser teardown remains INCOMPLETE evidence.
      report.cleanup.failures.push({ code: 'F1_BORROW_RETURN_UNPROVEN_DEVICE_NOT_DESTROYED' });
    }
    if (report.diagnostics.length || report.uncaptured.length || report.eventOverflow || report.unexpectedDeviceLoss || report.cleanup.failures.length ||
      (device && (!report.cleanup.deviceDestroyed || !report.cleanup.deviceLoss))) report.status = 'INCOMPLETE';
  }
  return report;
}
globalThis.f1GPU = Object.freeze({ run, latest: () => latest });
globalThis.f1GPUReady = true;
