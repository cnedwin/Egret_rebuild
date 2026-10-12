// SPDX-License-Identifier: Apache-2.0
// Original F1 harness. All geometry comes from the real manual bridge.
import * as egret from '@egret/engine';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createF1ManualResources } from '#f1-manual-bridge';

const canvas = document.querySelector('#scene');
const frameOptions = Object.freeze({ width: 64, height: 48, clearColor: 0, clearAlpha: 0 });
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
  return { elapsed: instance.elapsedSeconds, geometry };
}
function unchanged(instance, before) {
  insist(instance.elapsedSeconds === before.elapsed, 'F1_NATIVE_NO_TIME_ADVANCE');
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
  const report = { schemaVersion: 1, mode, status: 'INCOMPLETE', environment: { userAgent: navigator.userAgent,
    platform: navigator.platform, browserDPR: devicePixelRatio, isSecureContext, preferredFormat: null },
    adapter: null, device: null, observations: [], diagnostics: [], uncaptured: [], failure: null,
    cleanup: { host: null, provider: null, deviceDestroyed: false, deviceLoss: null, failures: [] } };
  latest = report;
  let device, loss, destroyRequested = false, host, engine, resources, p, scope, A, B;
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
    engine = await egret.createEngineForProfile({ host }, egret.TEXTURED_FRAME_PROFILE_2D);
    p = providers(engine, config); scope = engine.createScope();
    resources = await createF1ManualResources(engine, scope, p.refs);
    A = resources.createInstance(engine.createScope()); B = resources.createInstance(engine.createScope());
    const clock = { identity: engine.clock, elapsed: engine.clock.elapsedSeconds, tick: engine.clock.tickId };
    const originals = snapshot(A).geometry;
    let lastSerial = host.getStatus().lastSerial;
    const reads = new Map();
    async function render(id, instance, time, sameAs) {
      insist(instance.elapsedSeconds === time && B.elapsedSeconds === 0, 'F1_MANUAL_TIMES');
      insist(p.counts.pageLoads === 1 && p.counts.pageDisposals === 0 && !p.page().isDisposed, 'F1_SHARED_PAGE_LIVE');
      const beforeA = snapshot(A), beforeB = snapshot(B);
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
      insist(engine.clock === clock.identity && engine.clock.elapsedSeconds === clock.elapsed && engine.clock.tickId === clock.tick, 'F1_NATIVE_NO_CLOCK');
      for (const row of originals) insist(JSON.stringify(row.value) === row.data, 'F1_RETAINED_OLD_GEOMETRY');
      if (sameAs) { const first = reads.get(sameAs); insist(first && first.every((value, index) => value === readback.bytes[index]), 'F1_REPEAT_COMPLETE_BYTES'); }
      const bytes = [...readback.bytes]; reads.set(id, bytes);
      const row = { id, time, instance: instance === A ? 'A' : 'B', frameId: frame.frameId, serial: readback.serial,
        width: readback.width, height: readback.height, format: readback.format, sourceFormat: readback.sourceFormat,
        colorSpace: readback.colorSpace, alphaMode: readback.alphaMode, status, texturedStatus: textured, canvas: metadata, bytes };
      insist(typeof globalThis.__retainF1Readback === 'function', 'F1_RETAIN_BINDING');
      await observe(globalThis.__retainF1Readback(row));
      report.observations.push({ ...row, bytes: undefined });
      pixels(readback.bytes, oracle, id, time);
    }
    engine.stage.addChild(A.display);
    if (mode === 'double-state-step') {
      A.step(0.25); A.step(0.25); await render('F1D01', A, 0.5);
      throw new Error('F1_DOUBLE_STEP_NOT_DETECTED');
    }
    await render('F1G01', A, 0); await render('F1G02', A, 0, 'F1G01');
    A.step(0.25); A.step(0.25); await render('F1G03', A, 0.5); await render('F1G04', A, 0.5, 'F1G03');
    A.step(0.25); A.step(0.25); await render('F1G05', A, 1); await render('F1G06', A, 1, 'F1G05');
    engine.stage.removeChild(A.display); engine.stage.addChild(B.display);
    await render('F1G07', B, 0); A.dispose(); await render('F1G08', B, 0, 'F1G07');
    scope.dispose();
    insist(B.display.isDisposed && p.counts.headerDisposals === 2 && p.counts.pageDisposals === 1, 'F1_SHARED_RESOURCE_RETIREMENT');
    report.status = 'SCENE_COMPLETED';
  } catch (cause) {
    report.failure = fault(cause);
    report.status = cause?.code === 'F1_PIXEL_MISMATCH' ? 'PIXEL_FAIL' : 'INCOMPLETE';
  } finally {
    const cleanup = async action => { try { await action(); } catch (cause) { report.cleanup.failures.push(fault(cause)); } };
    await cleanup(async () => { resources?.dispose(); scope?.dispose(); });
    if (engine) await cleanup(() => engine.dispose()); else if (host) await cleanup(() => host.close());
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
      // success. Bounded browser teardown remains INCOMPLETE evidence.
      report.cleanup.failures.push({ code: 'F1_BORROW_RETURN_UNPROVEN_DEVICE_NOT_DESTROYED' });
    }
    if (report.diagnostics.length || report.uncaptured.length || report.eventOverflow || report.unexpectedDeviceLoss || report.cleanup.failures.length ||
      (device && (!report.cleanup.deviceDestroyed || !report.cleanup.deviceLoss))) report.status = 'INCOMPLETE';
  }
  return report;
}
globalThis.f1GPU = Object.freeze({ run, latest: () => latest });
globalThis.f1GPUReady = true;
