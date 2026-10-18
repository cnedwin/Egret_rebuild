// SPDX-License-Identifier: Apache-2.0
// Finite native windows. Exact recipe admission separates local raw evidence from public summaries.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logicalPath, fingerprintFile, samePhysicalPath, ownerRelativePath, canonicalTextBytes } from './lib/file-identity.mjs';
import { collectPublicGraph, chosenMap, captureRegistry, rereadRegistry, directoryChain, freshOutput,
  artifactStore, sha256, REGISTRY } from './textured-webgpu/native-files.mjs';

const CHECKOUT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const HERE = path.join(CHECKOUT, 'tools/incremental-rendering');
const NODE = fs.realpathSync(process.execPath);
const PROFILE_SPEC = 'knowledge-base/en/docs/m1-rendering-resource-plan.md';
const TOOL_MEMBERS = ['tests/incremental-rendering-tool.test.mjs', 'tools/incremental-rendering/observe-windows.ps1',
  'tools/incremental-rendering/workload.mjs', 'tools/verify-incremental-rendering.mjs'];
const OBSERVATION_SECONDS = 30;
const WIDTH = 1024, HEIGHT = 768, RGBA_BYTES = WIDTH * HEIGHT * 4;
const fault = error => ({ name: error?.name ?? 'Unknown', message: String(error?.message ?? error).slice(0, 16000) });
function requireValue(value, reason) { if (!value) throw Error('INCOMPLETE:' + reason); }
function requireObservation(value, reason) {
  if (!value) { const error = Error(reason); error.observationFailure = true; throw error; }
}
function inside(owner, value) { try { ownerRelativePath(owner, value); return true; } catch { return samePhysicalPath(owner, value); } }
function options(argv) {
  requireValue(argv.length === 10, 'CLI_REQUIRES_MODE_REPOSITORY_PLAYWRIGHT_POWERSHELL_OUTPUT');
  const result = Object.create(null);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    requireValue(['--mode', '--repository', '--playwright', '--powershell', '--output'].includes(key) && !Object.hasOwn(result, key)
      && typeof value === 'string' && value.length > 0, 'CLI_OPTIONS'); result[key] = value;
  }
  requireValue(result['--mode'] === 'preflight', 'SINGLE_SDK_FORM_REQUIRES_PREFLIGHT');
  for (const key of ['--repository', '--playwright', '--powershell', '--output']) requireValue(path.isAbsolute(result[key]), 'ABSOLUTE_' + key);
  return result;
}

// This function is serialized into one reviewed browser module. It imports only
// the two public SDK entries and the separately pinned, public-API workload.
async function runPreflight({ deadline, mode = 'preflight', state = 'preflight', profileVersion = 1 }) {
  const report = { status: 'INCOMPLETE', frames: [], diagnostics: [], uncaptured: [], failure: null, windows: [], pageEvents: [],
    cleanup: { failures: [], workloadClosed: false, hostSafe: false, deviceDestroyCalls: 0, lossSettled: false, canvasRetired: false } };
  globalThis.preflightReport = report;
  const pending = new Set(), acquisitions = [];
  let device, host, workload, canvas, loss, lossInfo, errorListener, retiring = false, destroyRequested = false, stopPhase, nativeCounter;
  let visibilityListener, focusListener, blurListener, dprSamples = 0, sampleState;
  const errorRow = error => ({ name: error?.name ?? 'Unknown', code: error?.code ?? null, message: String(error?.message ?? error).slice(0, 12000) });
  const check = (value, reason) => { if (!value) { const error = Error(reason); error.observationFailure = true; throw error; } };
  const event = (list, value) => { if (list.length < 128) list.push(value); else report.eventOverflow = true; };
  const observe = promise => { pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise)); return promise; };
  async function bounded(promise, label, cleanup = false, cap = 20000) {
    observe(promise); let timer;
    const remaining = Math.min(cap, deadline + (cleanup ? 30000 : 0) - Date.now());
    try {
      if (remaining <= 0) throw Error('INCOMPLETE:' + label + ':deadline');
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('INCOMPLETE:' + label + ':timeout')), remaining); })]);
    } finally { clearTimeout(timer); }
  }
  function acquire(promise, label, assign, dispose) {
    const row = { label, settled: false, late: false };
    row.promise = observe(promise.then(async value => {
      assign(value);
      if (retiring) { row.late = true; await dispose(value); }
      row.settled = true; return value;
    }, error => { row.settled = true; throw error; }));
    acquisitions.push(row); return row.promise;
  }
  function limits(value) {
    const result = {};
    for (let current = value; current && current !== Object.prototype; current = Object.getPrototypeOf(current))
      for (const key of Object.getOwnPropertyNames(current))
        if (key !== 'constructor' && typeof value[key] === 'number') result[key] = value[key];
    return result;
  }
  const info = value => value ? Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter',
    'subgroupMinSize', 'subgroupMaxSize'].filter(key => value[key] !== undefined).map(key => [key, value[key]])) : null;
  function status() {
    const current = host.getStatus();
    return { state: current.state, lastSerial: current.lastSerial, cleanupOutcome: current.cleanupOutcome,
      firstFailure: current.firstFailure ? errorRow(current.firstFailure) : null, callbackFailureCount: current.callbackFailureCount,
      pending: { frames: current.pendingFrames, upload: current.pendingUploadBytes, readback: current.pendingReadbackBytes,
        geometry: host.getTexturedStatus().pendingGeometryBytes } };
  }
  function foreground() {
    const visible = document.visibilityState === 'visible', focused = document.hasFocus();
    if (!visible || !focused) throw Error('INCOMPLETE:PAGE_NOT_FOREGROUND');
    if (profileVersion === 2) {
      if (!Object.is(window.devicePixelRatio, report.surface.devicePixelRatio)) throw Error('INCOMPLETE:WINDOW_DPR_CHANGED');
      dprSamples++;
    }
    if (report.diagnostics.length || report.uncaptured.length || lossInfo || report.eventOverflow || report.counterFailure) throw Error('NATIVE_ASYNC_FAILURE');
    return 3;
  }
  function surfaceBoundary(label) {
    const bounds = canvas.getBoundingClientRect();
    check(canvas.width === 1024 && canvas.height === 768 && bounds.width === 1024 && bounds.height === 768
      && innerWidth === 1024 && innerHeight === 768, 'SURFACE_CHANGED');
    foreground();
    return { label, utcMs: Date.now(), width: canvas.width, height: canvas.height, cssWidth: bounds.width, cssHeight: bounds.height,
      innerWidth, innerHeight, devicePixelRatio: window.devicePixelRatio };
  }
  async function destroyOwnedDevice(value) {
    if (destroyRequested) return;
    destroyRequested = true; report.cleanup.deviceDestroyCalls++; value.destroy();
    try {
      const ended = await bounded(loss, 'owned-device-loss', true);
      check(ended.reason === 'destroyed' && ended.intentional, 'DEVICE_LOSS_REASON'); report.cleanup.lossSettled = true;
    } finally { if (errorListener) value.removeEventListener('uncapturederror', errorListener); }
  }
  function encoded(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }
  async function saveReadback(readback, ordinal, frameId) {
    check(readback.serial === frameId && readback.frameId === frameId && readback.width === 1024 && readback.height === 768
      && readback.format === 'rgba8unorm' && readback.bytes instanceof Uint8Array && readback.bytes.length === 3145728, 'READBACK_IDENTITY');
    const { bytes, ...metadata } = readback;
    const saved = await bounded(observe(globalThis.retainPreflightFrame({ ordinal, frameId, readback: metadata, base64: encoded(bytes) })), 'retain-' + ordinal);
    check(saved?.retained === true, 'READBACK_RETAINED'); return { ...metadata, byteLength: bytes.length };
  }
  async function saveBytes(name, bytes, format, cleanup = false) {
    check(bytes.byteLength <= 4194304, 'ARTIFACT_CHUNK_CAP');
    const saved = await bounded(observe(globalThis.retainWindowArtifact({ name, format, base64: encoded(bytes) })), 'retain-' + name, cleanup);
    check(saved?.retained === true, 'ARTIFACT_RETAINED'); return saved.pin;
  }
  async function retainSamples(cleanup = false) {
    const { samples, captureStart, captureEnd } = sampleState;
    const columns = { ...samples.columns, ...(captureStart ? { captureStart, captureEnd } : {}) }, saved = {};
    for (const [name, values] of Object.entries(columns)) {
      const selected = values.subarray(0, samples.length), format = values instanceof Uint8Array ? 'uint8' : 'float64-le';
      if (samples.length) saved[name] = { format, length: samples.length, raw: await saveBytes('samples-' + name + (format === 'uint8' ? '.u8' : '.f64'),
        new Uint8Array(selected.buffer, selected.byteOffset, selected.byteLength), format, cleanup) };
    }
    report.samples = { length: samples.length, capacity: samples.capacity, byteOrder: 'little-endian', columns: saved,
      firstRaf: report.windows[1]?.firstRaf ?? null, boundaryRaf: report.windows[1]?.boundaryRaf ?? null,
      primarySpan: mode === 'diagnostic' ? 'updateStart through actual Host return; capture and Host separately retained' : 'updateStart through Engine return',
      allActualSamplesRetained: true, droppedSamples: 0, partial: cleanup };
  }
  // Wrappers exist only in the separate counts mode. Every call first reaches the
  // captured real method with its original native receiver; no GPU port is replaced.
  function countNative(value) {
    const ids = new WeakMap(), descriptors = [], objects = [], byKind = {}, lifetime = {};
    let nextId = 0, current, totalCalls = 0, cleanupCalls = 0;
    function id(object, kind = 'native') {
      if (object === null || object === undefined) return null;
      if (!ids.has(object)) {
        check(++nextId <= 8192, 'NATIVE_OBJECT_CAP'); ids.set(object, nextId); objects.push({ id: nextId, kind });
        byKind[kind] = (byKind[kind] ?? 0) + 1;
      }
      return ids.get(object);
    }
    function record(name, args, result) {
      lifetime[name] = (lifetime[name] ?? 0) + 1;
      if (!current) { cleanupCalls++; return; }
      check(++current.calls <= 32768 && ++totalCalls <= 131072, 'NATIVE_CALL_CAP');
      current.counts[name] = (current.counts[name] ?? 0) + 1;
      current.trace.push({ call: name, args, ...(result === undefined ? {} : { result }) });
    }
    function wrap(target, name, describe = args => args, after) {
      const original = target[name], descriptor = Object.getOwnPropertyDescriptor(target, name);
      check(typeof original === 'function' && descriptors.length < 65536, 'NATIVE_METHOD:' + name);
      const wrapped = function (...args) {
        const result = Reflect.apply(original, target, args);
        const retained = after ? after(result, args) : undefined;
        record(name, describe(args), retained);
        return result;
      };
      Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped });
      descriptors.push({ target, name, descriptor, original });
    }
    function pipeline(value) {
      id(value, 'pipeline'); wrap(value, 'getBindGroupLayout', args => args, layout => id(layout, 'bindGroupLayout')); return value;
    }
    function buffer(value) {
      id(value, 'buffer'); wrap(value, 'destroy', () => [id(value)]); wrap(value, 'unmap', () => [id(value)]);
      wrap(value, 'mapAsync', args => [id(value), ...args]); wrap(value, 'getMappedRange', args => [id(value), ...args]); return value;
    }
    function texture(value) {
      id(value, 'texture'); wrap(value, 'destroy', () => [id(value)]);
      wrap(value, 'createView', args => [id(value), args[0] ?? null], view => id(view, 'textureView')); return value;
    }
    function pass(value) {
      id(value, 'pass');
      for (const name of ['setViewport','setScissorRect','draw','drawIndexed','end'])
        wrap(value, name, args => [id(value), ...args]);
      wrap(value, 'setPipeline', args => [id(value), id(args[0])]);
      wrap(value, 'setBindGroup', args => [id(value), args[0], id(args[1]), args[2] ? Array.from(args[2]) : null, args[3] ?? null, args[4] ?? null]);
      wrap(value, 'setVertexBuffer', args => [id(value), args[0], id(args[1]), args[2] ?? 0, args[3] ?? null]);
      return value;
    }
    function encoder(value) {
      id(value, 'encoder');
      wrap(value, 'beginRenderPass', args => [id(value), args[0].colorAttachments.map(x => ({ view: id(x.view), loadOp: x.loadOp,
        storeOp: x.storeOp, clearValue: x.clearValue ?? null }))], result => id(pass(result)));
      wrap(value, 'finish', () => [id(value)], result => id(result, 'commandBuffer')); return value;
    }
    nativeCounter = {
      begin(ordinal) { check(!current, 'COUNTS_ACTIVE'); current = { ordinal, calls: 0, counts: {}, trace: [] }; },
      end() { check(current, 'COUNTS_MISSING'); const result = current; current = undefined; return result; },
      partial() { const result = current; current = undefined; return result; },
      restore() {
        const failures = [];
        for (let index = descriptors.length - 1; index >= 0; index--) {
          const row = descriptors[index];
          try {
          if (row.descriptor) Object.defineProperty(row.target, row.name, row.descriptor); else check(delete row.target[row.name], 'NATIVE_RESTORE_DELETE');
          const actual = Object.getOwnPropertyDescriptor(row.target, row.name);
          check(row.target[row.name] === row.original && (row.descriptor
            ? actual.value === row.descriptor.value && actual.get === row.descriptor.get && actual.set === row.descriptor.set
              && actual.configurable === row.descriptor.configurable && actual.enumerable === row.descriptor.enumerable && actual.writable === row.descriptor.writable
            : actual === undefined), 'NATIVE_DESCRIPTOR_RESTORE');
          } catch (error) { failures.push({ name: row.name, ...errorRow(error) }); }
        }
        if (failures.length) { report.cleanup.descriptorFailures = failures; throw Error('NATIVE_DESCRIPTOR_RESTORE_FAILED'); }
        return { restored: descriptors.length, exactDescriptors: true, totalCalls, nonFrameCalls: cleanupCalls, objects, byKind, lifetime,
          scope: 'Actual forwarded native calls. Internal cache peaks and batch-break causes remain UNKNOWN.' };
      }
    };
    id(value, 'device'); id(value.queue, 'queue');
    wrap(value, 'createBuffer', args => [{ size: args[0].size, usage: args[0].usage, mappedAtCreation: args[0].mappedAtCreation ?? false }], result => id(buffer(result)));
    wrap(value, 'createTexture', args => [{ size: args[0].size, format: args[0].format, usage: args[0].usage }], result => id(texture(result)));
    wrap(value, 'createSampler', args => [args[0] ?? null], result => id(result, 'sampler'));
    wrap(value, 'createShaderModule', args => [{ codeLength: args[0].code.length }], result => id(result, 'shaderModule'));
    wrap(value, 'createRenderPipelineAsync', args => [{ layout: typeof args[0].layout === 'string' ? args[0].layout : id(args[0].layout) }], result => {
      observe(result.then(pipeline).catch(error => { report.counterFailure = errorRow(error); throw error; })); return null;
    });
    wrap(value, 'createBindGroup', args => [{ layout: id(args[0].layout), entries: args[0].entries.map(entry => ({ binding: entry.binding,
      resource: entry.resource.buffer ? { buffer: id(entry.resource.buffer), offset: entry.resource.offset ?? 0, size: entry.resource.size ?? null } : id(entry.resource) })) }],
      result => id(result, 'bindGroup'));
    wrap(value, 'createCommandEncoder', () => [], result => id(encoder(result)));
    wrap(value, 'destroy', () => [id(value)]);
    wrap(value.queue, 'writeBuffer', args => {
      const source = args[2], unit = ArrayBuffer.isView(source) ? (source.BYTES_PER_ELEMENT ?? 1) : 1;
      const offset = args[3] ?? 0, count = args[4] ?? (source.byteLength / unit - offset);
      return [id(args[0]), args[1], { byteLength: source.byteLength, sourceOffset: offset, sourceSize: count, uploadBytes: count * unit }];
    });
    wrap(value.queue, 'writeTexture', args => [{ texture: id(args[0].texture), mipLevel: args[0].mipLevel ?? 0,
      origin: args[0].origin ?? null, aspect: args[0].aspect ?? null }, { byteLength: args[1].byteLength }, args[2], args[3]]);
    wrap(value.queue, 'submit', args => [args[0].map(object => id(object))]);
    return nativeCounter;
  }
  try {
    if (!navigator.gpu) throw Error('INCOMPLETE:WEBGPU_API_ABSENT');
    const adapter = await bounded(observe(navigator.gpu.requestAdapter()), 'adapter');
    if (!adapter) throw Error('INCOMPLETE:ADAPTER_NULL');
    report.adapter = { info: info(adapter.info), features: [...adapter.features].sort(), limits: limits(adapter.limits) };
    if (!report.adapter.info || !['vendor','architecture','device','description'].every(key => typeof report.adapter.info[key] === 'string')
      || !Object.keys(report.adapter.limits).length) throw Error('INCOMPLETE:ADAPTER_INFORMATION_UNAVAILABLE');
    await bounded(acquire(adapter.requestDevice(), 'device', value => {
      device = value;
      loss = observe(value.lost.then(ended => {
        lossInfo = { reason: ended.reason, message: ended.message, intentional: destroyRequested }; return lossInfo;
      }));
      errorListener = eventValue => event(report.uncaptured, errorRow(eventValue.error)); value.addEventListener('uncapturederror', errorListener);
      report.device = { label: value.label, adapterInfo: info(value.adapterInfo), features: [...value.features].sort(), limits: limits(value.limits),
        ownership: 'Fixture-owned actual device; the same object is borrowed by Host.' };
    }, destroyOwnedDevice), 'device');
    const [sdk, gpu, fixture] = await bounded(observe(Promise.all([import('@egret/engine'), import('@egret/engine/webgpu'), import('/workload.mjs')])), 'public-modules');
    canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    canvas.style.width = '1024px'; canvas.style.height = '768px'; document.body.append(canvas);
    report.surface = { width: canvas.width, height: canvas.height, devicePixelRatio: window.devicePixelRatio,
      requestedDeviceScaleFactor: 1, explicitHostPixelRatio: 1, windowDprExactlyRequested: window.devicePixelRatio === 1,
      innerWidth, innerHeight, preferredFormat: navigator.gpu.getPreferredCanvasFormat(),
      ...(profileVersion === 2 ? { cssWidth: canvas.getBoundingClientRect().width, cssHeight: canvas.getBoundingClientRect().height,
        screenWidth: screen.width, screenHeight: screen.height } : {}) };
    check(report.surface.width === 1024 && report.surface.height === 768 && innerWidth === 1024 && innerHeight === 768
      && Number.isFinite(report.surface.devicePixelRatio) && report.surface.devicePixelRatio > 0, 'SURFACE_PROFILE');
    if (profileVersion === 2) {
      const pageEvent = kind => event(report.pageEvents, { kind, utcMs: Date.now(), visible: document.visibilityState === 'visible', focused: document.hasFocus() });
      visibilityListener = () => pageEvent('visibility'); focusListener = () => pageEvent('focus'); blurListener = () => pageEvent('blur');
      document.addEventListener('visibilitychange', visibilityListener); window.addEventListener('focus', focusListener); window.addEventListener('blur', blurListener);
    }
    if (mode === 'counts') nativeCounter = countNative(device);
    host = gpu.createTexturedWebGPUHost({ canvas, device: { kind: 'borrow', device }, pixelRatio: 1, maxPendingFrames: 2,
      enableReadback: mode === 'preflight' || mode === 'correctness',
      onDiagnostic: value => event(report.diagnostics, { code: value.code, phase: value.phase, serial: value.serial }) });
    await bounded(acquire(fixture.createWorkload({ sdk, host, variant: mode === 'preflight' ? 'preflight' : 'scale' }),
      'workload', value => { workload = value; }, value => value.close()), 'workload');
    workload.reset(state);
    const imageIds = new WeakMap(workload.images.map((image, index) => [image, index])), geometryIds = new WeakMap([[workload.geometry, 0]]);
    const exact = globalThis.canonicalPublicValues;
    async function digest(frame) {
      const values = { frameId: frame.frameId, profile: frame.profile, width: frame.width, height: frame.height, clearColor: frame.clearColor,
        clearAlpha: frame.clearAlpha, commands: exact(frame.commands),
        images: frame.images.map(image => {
          check(imageIds.has(image), 'PUBLIC_IMAGE_IDENTITY');
          return { identity: imageIds.get(image), width: image.width, height: image.height, bytesPerRow: image.bytesPerRow,
            byteLength: image.byteLength, format: image.format, colorSpace: image.colorSpace, alphaMode: image.alphaMode, origin: image.origin,
            pixels: [...sdk.copyImageData2DPixels(image)] };
        }), geometries: frame.geometries.map(geometry => {
          check(geometryIds.has(geometry), 'PUBLIC_GEOMETRY_IDENTITY');
          return { identity: geometryIds.get(geometry), positions: exact(geometry.positions), uvs: exact(geometry.uvs), lightColors: exact(geometry.lightColors),
            indices: exact(geometry.indices), logicalByteLength: geometry.logicalByteLength, triangleCount: geometry.triangleCount };
        }) };
      const bytes = new TextEncoder().encode(JSON.stringify(values));
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return { bytes: bytes.length, sha256: Array.from(hash, x => x.toString(16).padStart(2, '0')).join(''),
        scope: 'Canonical public values, exact numbers including signed zero, resource input identity and table order; no preparation oracle.' };
    }
    if (mode === 'preflight' || mode === 'correctness' || mode === 'counts') {
      const checkpoints = mode === 'preflight' ? [4,12] : mode === 'correctness' ? ({ static:[0], sparse:[0,1,99,990], full:[0,1] })[state] : [];
      const first = mode === 'preflight' ? 1 : 0, last = mode === 'preflight' ? 12 : mode === 'counts' ? 3 : checkpoints.at(-1);
      for (let ordinal = first; ordinal <= last; ordinal++) {
        const rafTimestamp = await bounded(observe(new Promise(resolve => requestAnimationFrame(resolve))), 'raf-' + ordinal);
        foreground(); const startedUtcMs = Date.now();
        const writes = mode === 'preflight' || ordinal > 0 ? workload.advance() : 0;
        const ticket = checkpoints.includes(ordinal) ? observe(host.requestReadback()) : null;
        nativeCounter?.begin(ordinal);
        const frame = workload.render(), submitted = status(), idle = observe(host.whenIdle());
        const row = { ordinal, frameId: frame.frameId, writes, rafTimestamp, startedUtcMs, finishedUtcMs: null,
          visible: true, focused: true, inventory: workload.inspect(frame), status: null, pending: submitted.pending, readback: null };
        report.frames.push(row);
        if (mode === 'correctness') row.captureDigest = await bounded(observe(digest(frame)), 'public-digest');
        const [readback] = await bounded(observe(Promise.all([ticket, idle])), 'frame-' + ordinal);
        row.status = status(); const expectedId = mode === 'preflight' ? ordinal : ordinal + 1;
        check(frame.frameId === expectedId && row.status.lastSerial === expectedId && !row.status.firstFailure
          && Object.values(row.status.pending).every(value => value === 0), 'FRAME_IDENTITY_AND_IDLE');
        if (mode === 'preflight') check(writes === (ordinal <= 4 ? 0 : 1) && row.inventory.logicalNodes === 41 && row.inventory.commands === 32
          && row.inventory.rectangles === 8 && row.inventory.images === 16 && row.inventory.meshes === 8, 'PREFLIGHT_RECIPE');
        else check(row.inventory.logicalNodes === 10000 && row.inventory.commands === 991 && row.inventory.clipReferences === 7928
          && row.inventory.sourceTriangles === 4992 && writes === (ordinal === 0 || state === 'static' ? 0 : state === 'sparse' ? 100 : 10000), 'SCALE_RECIPE');
        if (readback) row.readback = await saveReadback(readback, ordinal, frame.frameId);
        if (nativeCounter) {
          const trace = nativeCounter.end(); row.counts = trace.counts; row.nativeCalls = trace.calls;
          row.trace = await saveBytes('counts-' + ordinal + '.json', new TextEncoder().encode(JSON.stringify(trace)), 'json');
        }
        row.finishedUtcMs = Date.now();
      }
    } else {
      const samples = fixture.createSampleStore(), captureStart = mode === 'diagnostic' ? new Float64Array(65536) : null,
        captureEnd = mode === 'diagnostic' ? new Float64Array(65536) : null;
      check(new Uint8Array(new Float64Array([1]).buffer)[7] === 63, 'LITTLE_ENDIAN_REQUIRED');
      sampleState = { samples, captureStart, captureEnd };
      // Timer and empty-call observations are outside both windows and are never subtracted.
      const resolution = new Float64Array(10000), overhead = new Float64Array(10000), empty = () => {};
      for (let i = 0; i < 10000; i++) { const a = performance.now(); const b = performance.now(); resolution[i] = b - a; const c = performance.now(); empty(); overhead[i] = performance.now() - c; }
      report.timerObservation = {
        resolution: await saveBytes('timer-resolution.f64', new Uint8Array(resolution.buffer), 'float64-le'),
        emptyCall: await saveBytes('timer-empty-call.f64', new Uint8Array(overhead.buffer), 'float64-le'), count: 10000, subtracted: false };
      // Fill exactly the existing two-submission capacity before warm-up. The
      // two base-state calls share one synchronous turn; only their joint idle
      // is awaited. This observation is outside all measured sample spans.
      const primeBoundary = surfaceBoundary('priming-before');
      report.priming = { startedUtcMs: primeBoundary.utcMs, finishedUtcMs: null, before: primeBoundary,
        idleStartedUtcMs: null, afterIdle: null, frames: [] };
      for (let ordinal = 0; ordinal < 2; ordinal++) {
        foreground(); if (Date.now() >= deadline) throw Error('INCOMPLETE:PRIMING_DEADLINE');
        const row = { ordinal, frameId: null, stepBefore: workload.step, stepAfter: null, startedUtcMs: Date.now(),
          finishedUtcMs: null, before: status(), after: null };
        report.priming.frames.push(row);
        try {
          let rendered;
          if (mode === 'diagnostic') { rendered = workload.capture(); host.renderTexturedFrame(rendered); }
          else rendered = workload.render();
          row.frameId = rendered.frameId; row.stepAfter = workload.step; row.after = status(); row.finishedUtcMs = Date.now();
        } catch (error) {
          row.failure = errorRow(error); row.finishedUtcMs = Date.now();
          try { row.after = status(); } catch { /* The original failure remains authoritative. */ }
          throw error;
        }
      }
      report.priming.idleStartedUtcMs = Date.now();
      await bounded(observe(host.whenIdle()), 'priming-idle', false, 20000);
      report.priming.afterIdle = status(); report.priming.after = surfaceBoundary('priming-after');
      report.priming.finishedUtcMs = Date.now();
      if (report.priming.frames.some((row, index) => row.frameId !== index + 1 || row.stepBefore !== 0 || row.stepAfter !== 0
        || row.before.lastSerial !== index || row.before.pending.frames !== index || row.before.firstFailure || row.before.callbackFailureCount !== 0
        || row.after.lastSerial !== index + 1 || row.after.pending.frames !== index + 1 || row.after.firstFailure || row.after.callbackFailureCount !== 0)
        || report.priming.afterIdle.lastSerial !== 2 || report.priming.afterIdle.firstFailure || report.priming.afterIdle.callbackFailureCount !== 0
        || Object.values(report.priming.afterIdle.pending).some(value => value !== 0)) throw Error('INCOMPLETE:PRIMING_OBSERVATION');
      async function phase(label, duration, measured) {
        const boundary = surfaceBoundary(label + '-before');
        const windowRow = { label, durationMs: duration, startedUtcMs: null, finishedUtcMs: null, firstRaf: null, boundaryRaf: null, count: 0,
          firstFrameId: null, lastFrameId: null, before: boundary };
        if (!measured) windowRow.observations = [];
        report.windows.push(windowRow);
        const operation = new Promise((resolve, reject) => {
          let request, stopped = false, attempted = -1, attemptedRaf, attemptedUtc;
          const stop = error => { if (stopped) return; stopped = true; cancelAnimationFrame(request); stopPhase = undefined; error ? reject(error) : resolve(); };
          stopPhase = () => stop(Error('INCOMPLETE:PHASE_CANCELLED'));
          const frame = timestamp => {
            if (stopped) return;
            try {
              foreground(); const now = Date.now(); if (now >= deadline) throw Error('INCOMPLETE:PHASE_DEADLINE');
              if (windowRow.firstRaf === null) { windowRow.firstRaf = timestamp; windowRow.startedUtcMs = now; }
              if (timestamp - windowRow.firstRaf >= duration) {
                windowRow.boundaryRaf = timestamp; windowRow.finishedUtcMs = now; stop(); return;
              }
              const index = windowRow.count; attempted = index; attemptedRaf = timestamp; attemptedUtc = now;
              const a = performance.now(); workload.advance(); const b = performance.now();
              let rendered, x, y, c, d;
              if (mode === 'diagnostic') {
                x = performance.now(); rendered = workload.capture(); y = performance.now();
                c = performance.now(); host.renderTexturedFrame(rendered); d = performance.now();
              } else { c = performance.now(); rendered = workload.render(); d = performance.now(); }
              if (measured) {
                samples.append(index, timestamp, a, b, c, d, true, true);
                if (captureStart) { captureStart[index] = x; captureEnd[index] = y; }
              }
              if (windowRow.firstFrameId === null) windowRow.firstFrameId = rendered.frameId;
              windowRow.lastFrameId = rendered.frameId; windowRow.count++; attempted = -1;
              request = requestAnimationFrame(observedFrame);
            } catch (error) {
              if (attempted >= 0) {
                windowRow.failedAttempt = { ordinal: attempted, rafTimestamp: attemptedRaf, startedUtcMs: attemptedUtc, endedAt: performance.now(), failure: errorRow(error) };
                try { windowRow.failedAttempt.status = status(); } catch (statusError) { windowRow.failedAttempt.statusFailure = errorRow(statusError); }
              }
              stop(error);
            }
          };
          // Measurement schedules the original callback directly. Only warm-up
          // uses this bounded status wrapper; no observation enters a successful
          // measured callback or its continuous update-to-render span.
          const observedFrame = measured ? frame : timestamp => {
            let observation;
            try {
              if (!stopped && windowRow.count < 4 && (windowRow.firstRaf === null || timestamp - windowRow.firstRaf < duration)) {
                observation = { ordinal: windowRow.count, rafTimestamp: timestamp, startedUtcMs: Date.now(),
                  finishedUtcMs: null, frameId: null, before: status(), after: null, failure: null };
                windowRow.observations.push(observation);
              }
              frame(timestamp);
              if (observation) {
                observation.frameId = windowRow.lastFrameId; observation.after = status(); observation.finishedUtcMs = Date.now();
                observation.failure = windowRow.failedAttempt?.failure ?? null;
              }
            } catch (error) {
              if (observation) { observation.failure = errorRow(error); observation.finishedUtcMs = Date.now(); }
              stop(error);
            }
          };
          request = requestAnimationFrame(observedFrame);
        });
        await bounded(observe(operation), label, false, duration + 10000);
        windowRow.after = surfaceBoundary(label + '-after');
      }
      await phase('warm', 30000, false);
      await bounded(observe(host.whenIdle()), 'warm-idle');
      const resetStart = Date.now(); workload.reset(state); const resetFrame = workload.render(); await bounded(observe(host.whenIdle()), 'reset-idle');
      const inventory = workload.inspect(resetFrame);
      check(inventory.logicalNodes === 10000 && inventory.commands === 991 && inventory.clipReferences === 7928 && inventory.sourceTriangles === 4992, 'RESET_RECIPE');
      report.reset = { startedUtcMs: resetStart, finishedUtcMs: Date.now(), frameId: resetFrame.frameId, step: workload.step, inventory, status: status() };
      await phase('measure', 60000, true);
      await bounded(observe(host.whenIdle()), 'measurement-idle');
      check(!status().firstFailure && Object.values(status().pending).every(value => value === 0), 'MEASUREMENT_IDLE');
      await retainSamples();
    }
    foreground();
    if (profileVersion === 2) report.finalSurface = surfaceBoundary('final');
    report.environment = { profileVersion, actualWindowDprStable: profileVersion === 2 ? dprSamples > 0 : null, dprSamples,
      pageEvents: report.pageEvents.length, renderPixelRatio: 1 };
    check(!report.diagnostics.length && !report.uncaptured.length && !lossInfo && !report.eventOverflow, 'NATIVE_ERRORS');
    if (profileVersion === 2 && report.pageEvents.some(row => !row.visible || !row.focused)) throw Error('INCOMPLETE:PAGE_STATE_CHANGED');
    report.status = 'COMPLETED';
  } catch (error) {
    report.failure = errorRow(error); report.status = error.observationFailure ? 'FAIL' : 'INCOMPLETE';
  } finally {
    retiring = true; stopPhase?.();
    if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener);
    if (focusListener) window.removeEventListener('focus', focusListener);
    if (blurListener) window.removeEventListener('blur', blurListener);
    const cleanup = async (label, operation) => { try { await operation(); } catch (error) { report.cleanup.failures.push({ label, ...errorRow(error) }); } };
    if (sampleState && !report.samples) await cleanup('partial-samples', () => retainSamples(true));
    if (nativeCounter) {
      const partial = nativeCounter.partial();
      if (partial) await cleanup('partial-counts', async () => { report.partialCounts = await saveBytes('counts-partial.json',
        new TextEncoder().encode(JSON.stringify(partial)), 'json', true); });
    }
    for (const row of acquisitions) if (!row.settled) await cleanup('late-' + row.label, () => bounded(row.promise, 'late-' + row.label, true));
    if (workload) await cleanup('workload', async () => {
      await bounded(observe(workload.close()), 'workload-close', true); report.cleanup.workloadClosed = true;
      report.cleanup.scopeClosed = workload.scope.state === 'closed'; report.cleanup.nodesDisposed = workload.nodes.every(value => value.isDisposed);
      report.cleanup.texturesDisposed = workload.textures.every(value => value.isDisposed);
      check(report.cleanup.scopeClosed && report.cleanup.nodesDisposed && report.cleanup.texturesDisposed, 'WORKLOAD_OWNERS_CLOSED');
    });
    if (host) await cleanup('host', async () => {
      await bounded(observe(host.close()), 'host-close', true); report.cleanup.host = status();
      report.cleanup.hostSafe = report.cleanup.host.state === 'closed' && report.cleanup.host.cleanupOutcome === 'safe'
        && Object.values(report.cleanup.host.pending).every(value => value === 0); check(report.cleanup.hostSafe, 'HOST_SAFE_CLOSE');
    });
    if (device) await cleanup('device', () => destroyOwnedDevice(device));
    if (pending.size) await cleanup('pending', () => bounded(observe(Promise.allSettled([...pending])), 'pending-drain', true));
    if (nativeCounter) await cleanup('native-descriptors', async () => { report.cleanup.nativeCounter = nativeCounter.restore(); });
    if (device && errorListener) device.removeEventListener('uncapturederror', errorListener);
    if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); report.cleanup.canvasRetired = !canvas.isConnected; }
    report.cleanup.pendingOperations = pending.size;
    report.cleanup.acquisitions = acquisitions.map(({ label, settled, late }) => ({ label, settled, late }));
    report.loss = lossInfo ?? null;
    if (report.cleanup.failures.length || pending.size || acquisitions.some(row => !row.settled) || report.uncaptured.length
      || report.eventOverflow || report.counterFailure || lossInfo && !lossInfo.intentional) report.status = 'INCOMPLETE';
  }
  return report;
}

async function main(args, formal) {
  requireValue(process.platform === 'win32' && process.arch === 'x64' && process.version === 'v26.7.0'
    && samePhysicalPath(process.execPath, fs.realpathSync(NODE)) && process.execArgv.length === 0, 'PINNED_NODE');
  for (const [key, value] of Object.entries(process.env)) requireValue(!/^(NODE_OPTIONS|NODE_PATH)$/i.test(key) || !value, 'NODE_ENVIRONMENT');
  requireValue(path.isAbsolute(args['--powershell']), 'POWERSHELL_ABSOLUTE');
  const PWSH = fs.realpathSync(args['--powershell']);
  requireValue(samePhysicalPath(PWSH, args['--powershell']) && fs.lstatSync(PWSH).isFile(), 'POWERSHELL_EXECUTABLE');
  await directoryChain(path.dirname(PWSH));
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(NODE_OPTIONS|NODE_PATH)$/i.test(key)));
  const repository = fs.realpathSync(args['--repository']), playwrightRoot = fs.realpathSync(args['--playwright']);
  requireValue(samePhysicalPath(repository, args['--repository']) && samePhysicalPath(playwrightRoot, args['--playwright']), 'INPUT_ALIAS');
  await directoryChain(repository); await directoryChain(playwrightRoot);
  const require = createRequire(path.join(playwrightRoot, 'package.json'));
  const coreRoot = path.dirname(fs.realpathSync(require.resolve('playwright-core/package.json')));
  await directoryChain(coreRoot);
  const output = await freshOutput(args['--output'], repository);
  for (const owner of [HERE, CHECKOUT, playwrightRoot, coreRoot, path.dirname(NODE), path.dirname(PWSH)]) requireValue(!inside(owner, output), 'OUTPUT_OWNER');
  if (formal) for (const role of ['baseline','candidate']) requireValue(!inside(formal.loaded.recipe[role].root,output),'OUTPUT_FROZEN_OWNER');
  const inputs = new Map();
  function retain(owner, relative, maximum = 134217728) {
    const pin = fingerprintFile(owner, relative), body = fs.readFileSync(path.join(owner, relative));
    requireValue(pin.bytes <= maximum && pin.bytes === body.length && pin.sha256 === sha256(body), 'INPUT_READ_STABILITY');
    const key = owner + '\0' + relative, before = inputs.get(key);
    requireValue(!before || before.bytes === pin.bytes && before.sha256 === pin.sha256, 'INPUT_RETAIN_STABILITY');
    inputs.set(key, { owner, ...pin }); return { pin, body };
  }
  const manifest = JSON.parse(strictText(retain(repository, 'manifest.json', 16777216).body, 'MANIFEST_UTF8'));
  const baselineRole = manifest.status === 'FROZEN_VERIFIED_RAW_SNAPSHOT'
    && (manifest.role === undefined || manifest.role === 'merged-baseline')
    && [manifest.finalMain, manifest.finalMainTree, manifest.reviewedCandidate].every(value => /^[a-f0-9]{40}$/.test(value));
  const candidateRole = manifest.status === 'FROZEN_WORKING_TREE_SDK_SNAPSHOT' && manifest.role === 'working-tree-candidate'
    && [manifest.baseMain, manifest.baseMainTree].every(value => /^[a-f0-9]{40}$/.test(value))
    && manifest.workingTree?.head === manifest.baseMain && manifest.workingTree.headTree === manifest.baseMainTree
    && manifest.workingTree.branch === 'feat/m1-incremental-rendering' && typeof manifest.workingTree.status === 'string'
    && manifest.workingTree.status.length > 0 && (formal ? /^m1-2-build-[1-9][0-9]*$/.test(manifest.buildReceipt?.name) : manifest.buildReceipt?.name === 'm1-2-build-1') && manifest.buildReceipt.exitCode === 0
    && !['finalMain', 'finalMainTree', 'reviewedCandidate', 'reviewedFiles'].some(key => Object.hasOwn(manifest, key));
  const builtRole = manifest.status === 'FROZEN_BUILT_SDK_SNAPSHOT' && manifest.role === 'built-sdk';
  if (builtRole) verifyBuiltSnapshot(repository, manifest);
  requireValue((baselineRole || candidateRole || builtRole) && manifest.schemaVersion === 1
    && samePhysicalPath(manifest.owner, repository) && Array.isArray(manifest.files) && manifest.files.length > 0
    && manifest.checks?.copyRawBytesVerified === true && manifest.checks.cloneLinkTargetsVerified === true, 'FROZEN_SDK_MANIFEST');
  const frozen = new Map(manifest.files.map(row => [row.target, row]));
  requireValue(frozen.size === manifest.files.length, 'FROZEN_UNIQUE_MEMBERS');
  if (candidateRole) {
    const expected = ['evidence/' + manifest.buildReceipt.name + '.exit', 'evidence/' + manifest.buildReceipt.name + '.log'];
    requireValue(Array.isArray(manifest.buildReceipt.files) && manifest.buildReceipt.files.length === 2
      && manifest.buildReceipt.files.map(row => row.target).sort().every((value, index) => value === expected[index]), 'CANDIDATE_BUILD_MEMBERS');
    for (const row of manifest.buildReceipt.files) {
      const recorded = frozen.get(row.target), value = retain(repository, row.target);
      requireValue(recorded?.bytes === row.bytes && recorded.sha256 === row.sha256
        && value.pin.bytes === row.bytes && value.pin.sha256 === row.sha256, 'CANDIDATE_BUILD_RECEIPT');
      requireValue(row.target.endsWith('.exit') ? value.body.toString('utf8').trim() === '0'
        : /^Project format check PASS \(21 definitions\)\.[\r\n]*$/.test(value.body.toString('utf8')), 'CANDIDATE_BUILD_RESULT');
    }
  }
  if (formal) {
    requireValue(builtRole || formal.trial.role === (baselineRole ? 'baseline' : 'candidate'), 'FORMAL_MANIFEST_ROLE');
    for (const row of manifest.files) {
      const actual = retain(repository, row.target);
      requireValue(actual.pin.bytes === row.bytes && actual.pin.sha256 === row.sha256, 'COMPLETE_FROZEN_MEMBER');
    }
    const links = manifest.links;
    requireValue(Array.isArray(links) && links.length === 3, 'SDK_ALIAS_COUNT');
    for (const name of ['contracts', 'runtime', 'engine']) {
      const relative = 'node_modules/@egret/' + name, target = path.join(repository, 'packages', name);
      const row = links.find(value => value.path === relative);
      requireValue(row?.cloneOwned && row.target === 'packages/' + name && samePhysicalPath(row.resolvedTarget, target)
        && samePhysicalPath(fs.realpathSync(path.join(repository, relative)), target), 'SDK_OWNED_ALIAS');
    }
    retain(formal.loaded.owner, formal.loaded.pin.path);
    for (const row of formal.loaded.recipe.tools) retain(CHECKOUT, row.path);
    retain(CHECKOUT, formal.loaded.recipe.profileSpec.path);
  }
  const retainSdk = item => {
    const relative = ownerRelativePath(repository, item.path), recorded = frozen.get(relative);
    requireValue(recorded && recorded.bytes === item.bytes && recorded.sha256 === item.sha256, 'GRAPH_MATCHES_FROZEN_SDK');
    const value = retain(repository, relative);
    requireValue(value.pin.bytes === item.bytes && value.pin.sha256 === item.sha256, 'GRAPH_CAPTURE_STABILITY');
  };
  const graph = await collectPublicGraph(repository, retainSdk), importMap = chosenMap('baseline');
  const registry = await captureRegistry({ repository, graph, map: importMap });
  const dependencyRelative = 'packages/engine/node_modules/robust-predicates/package.json';
  const dependencyFile = retain(repository, dependencyRelative), dependency = JSON.parse(dependencyFile.body);
  requireValue(dependency.name === 'robust-predicates' && dependency.version === '3.0.3', 'FOUNDATIONAL_DEPENDENCY');
  requireValue(frozen.get(dependencyRelative)?.bytes === dependencyFile.pin.bytes
    && frozen.get(dependencyRelative).sha256 === dependencyFile.pin.sha256, 'DEPENDENCY_MANIFEST_FROZEN');
  for (const name of ['contracts', 'runtime', 'engine']) {
    const relative = 'packages/' + name + '/package.json', value = retain(repository, relative), recorded = frozen.get(relative);
    requireValue(recorded?.bytes === value.pin.bytes && recorded.sha256 === value.pin.sha256, 'PACKAGE_MANIFEST_FROZEN');
  }
  for (const relative of ['tools/textured-webgpu/native-files.mjs', 'tools/lib/file-identity.mjs', 'tools/browser-tool-matrix.json']) retain(CHECKOUT, relative);
  const workload = retain(HERE, 'workload.mjs'), self = retain(CHECKOUT, 'tools/verify-incremental-rendering.mjs');
  retain(HERE, 'observe-windows.ps1'); retain(path.dirname(NODE), path.basename(NODE)); retain(path.dirname(PWSH), path.basename(PWSH));
  const matrix = JSON.parse(retain(CHECKOUT, 'tools/browser-tool-matrix.json').body);
  requireValue(matrix.node === '26.7.0' && matrix.playwright === '1.62.1' && matrix.channel === 'msedge', 'TOOL_MATRIX');
  for (const [owner, name] of [[playwrightRoot, 'playwright'], [coreRoot, 'playwright-core']]) {
    const metadata = JSON.parse(retain(owner, 'package.json').body);
    requireValue(metadata.name === name && metadata.version === '1.62.1', 'PLAYWRIGHT_PIN');
    let count = 0, bytes = 0;
    const walk = (relative = '') => {
      for (const entry of fs.readdirSync(path.join(owner, relative), { withFileTypes: true })) {
        const child = relative ? relative + '/' + entry.name : entry.name;
        requireValue(!entry.isSymbolicLink(), 'PLAYWRIGHT_TREE_ALIAS');
        if (entry.isDirectory()) walk(child);
        else { requireValue(entry.isFile() && ++count <= 4096, 'PLAYWRIGHT_TREE_LIMIT'); bytes += retain(owner, child).pin.bytes; requireValue(bytes <= 536870912, 'PLAYWRIGHT_BYTES'); }
      }
    }; walk();
  }
  const version = spawnSync(PWSH, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'],
    { encoding: 'utf8', windowsHide: true, timeout: 10000, env: childEnv });
  requireValue(!version.error && version.status === 0 && /^7\.[0-9]+\.[0-9]+(?:[-+].*)?$/.test(version.stdout.trim()), 'POWERSHELL_7');
  fs.mkdirSync(output); const artifacts = formal ? trialArtifactStore(output) : artifactStore(output), began = Date.now();
  const deadline = formal ? PROCESS_STARTED + 150000 : began + 100000, cleanupDeadline = formal ? PROCESS_STARTED + 180000 : began + 145000;
  const report = { schema: formal ? 'egret.incremental-native-trial-result/3' : 'egret.incremental-rendering-preflight/1', mode: args['--mode'], status: 'INCOMPLETE',
    ...(formal ? { trial: formal.trial, profileVersion: 2, recipe: { owner: formal.loaded.owner, ...formal.loaded.pin } } : {}),
    runtimeExecution: 'INCOMPLETE', environmentQualification: 'INCOMPLETE', startedAtUTC: new Date(began).toISOString(),
    source: { repository, manifest: inputs.get(repository + '\0manifest.json'),
      ...(builtRole ? { role: 'built-sdk', buildReceipt: manifest.buildReceipt, preparationRuntime: manifest.preparationRuntime }
        : baselineRole ? { role: 'merged-baseline', finalMain: manifest.finalMain, finalMainTree: manifest.finalMainTree, reviewedCandidate: manifest.reviewedCandidate }
        : { role: 'working-tree-candidate', baseMain: manifest.baseMain, baseMainTree: manifest.baseMainTree,
          workingTree: manifest.workingTree, buildReceipt: manifest.buildReceipt }),
      graphModules: graph.modules.size, graphBytes: graph.totalBytes },
    launch: { channel: 'msedge', headless: false, callerAddedFlags: [], viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 },
    environment: { node: process.version, playwright: '1.62.1', playwrightCore: '1.62.1', powershell: version.stdout.trim(), driverAssociation: 'UNMEASURED' },
    frames: [], requests: [], browserEvents: [], cleanupFailures: [], failure: null,
    lifecycle: { contextClosed: false, browserClosed: false, serverClosed: false, inputsStable: false, artifactsStable: false, osDescendantRetirement: 'UNBOUND' },
    limits: ['Only 41-node/12-frame execution, two nonempty RGBA readbacks, sampled foreground and cooperative cleanup are assessed.',
      'No full pixel oracle, D60 timing, draw-count reduction, cache acceptance, physical VRAM release, continuous focus or unobstructed scanout is claimed.',
      'Identical hashes at frames 4 and 12 are permitted: subpixel x changes need not alter pixel coverage.',
      'Frozen raw source/emission identity is not a new build or independent source-to-emission equivalence proof.'] };
  if (formal) report.limits = ['Only the fixed recipe and explicit mode are assessed; other mode evidence remains separate.',
    'Actual window DPR is preserved, required stable per frame and exact across pairs; rendering ratio is explicitly one.',
    'No GPU timing, physical VRAM retirement, continuous OS focus, unobstructed scanout or adapter-to-driver association is inferred.',
    'Frozen raw source/emission identity is not a new build or independent source-to-emission equivalence proof.'];
  const pending = new Set(), acquisitions = [], sockets = new Set();
  let server, browser, context, page, cdp, observer, observerDone, observerExited = false, closeRequested = false, retiring = false;
  const observe = promise => { pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise)); return promise; };
  async function bounded(promise, label, until = deadline, cap = 20000) {
    observe(promise); let timer; const remaining = Math.min(cap, until - Date.now());
    try { requireValue(remaining > 0, label + '_DEADLINE');
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('INCOMPLETE:' + label + '_TIMEOUT')), remaining); })]);
    } finally { clearTimeout(timer); }
  }
  function acquire(promise, label, assign, dispose) {
    const row = { label, settled: false, late: false };
    row.promise = observe(promise.then(async value => { assign(value); if (retiring) { row.late = true; await dispose(value); } row.settled = true; return value; },
      error => { row.settled = true; throw error; })); acquisitions.push(row); return row.promise;
  }
  const event = value => { if (report.browserEvents.length < 128) report.browserEvents.push(value); else report.eventOverflow = true; };
  const hardTimer = setTimeout(() => {
    report.status = 'INCOMPLETE'; report.failure ??= { name: 'HardDeadline', message: 'Cooperative cleanup not established before hard deadline.' };
    report.lifecycle.pendingOperations = pending.size;
    try { fs.writeFileSync(path.join(output, 'hard-abort.json'), canonicalTextBytes(JSON.stringify(report)), { flag: 'wx' }); } catch {}
    if (observer && !observerExited) observer.kill();
    process.exit(1);
  }, formal ? Math.max(1, PROCESS_STARTED + 185000 - Date.now()) : 160000);
  const observerPath = path.join(output, 'windows-observation.jsonl'), stopPath = path.join(output, 'observer-stop.json');
  function signalObserver() {
    if (formal && observer && !fs.existsSync(stopPath)) fs.writeFileSync(stopPath,
      canonicalTextBytes(JSON.stringify({ schema: 'egret.observer-stop/1', browserProcessId: report.environment.browserProcessId })), { flag: 'wx' });
  }
  function readObservation(complete) {
    const bytes = fs.readFileSync(observerPath), text = bytes.toString('utf8');
    requireValue(bytes.length <= 1048576, 'OBSERVATION_CAP');
    const lines = text.split('\n'); if (!complete) lines.pop(); else requireValue(lines.pop() === '', 'OBSERVATION_FINAL_NEWLINE');
    return lines.filter(Boolean).map(line => JSON.parse(line));
  }
  async function finishObserver() {
    if (!observerDone || report.observation) return;
    const ended = await bounded(observerDone, 'WINDOWS_OBSERVER', cleanupDeadline, formal ? 15000 : 45000);
    const rows = readObservation(true), start = rows[0], end = rows.at(-1), samples = rows.filter(row => row.kind === 'sample');
    const powers = formal ? rows.filter(row => row.kind === 'power') : samples;
    const pin = fingerprintFile(output, 'windows-observation.jsonl');
    report.observation = { process: ended, raw: pin, start, end, samples: samples.length, powerSamples: powers.length,
      foregroundSamples: samples.filter(row => row.browserForeground).length,
      sampleGapsMs: samples.slice(1).map((row, index) => row.elapsedMs - samples[index].elapsedMs),
      powerGapsMs: powers.slice(1).map((row, index) => row.elapsedMs - powers[index].elapsedMs),
      scope: 'One-second OS foreground samples; formal power samples at five-second cadence, page/DPR checks at each frame.' };
    requireValue(ended.code === 0 && ended.signal === null && start?.kind === 'start' && end?.kind === 'end'
      && start.browserProcessId === report.environment.browserProcessId && typeof start.commandLine === 'string' && start.commandLine.trim().length > 0
      && end.processPresent && end.creationUnchanged && end.executableUnchanged && end.schemeUnchanged && samples.length > 0
      && samples.every(row => Number.isFinite(row.elapsedMs)) && rows.length === samples.length + (formal ? powers.length : 0) + 2, 'WINDOWS_OBSERVATION_COMPLETE');
    if (formal) {
      requireValue(start.formal === true && start.durationSeconds === 150 && end.stopObserved === true && end.stopReason === 'requested'
        && end.inventoryUnchanged === true && sameJson(start.inventory, end.inventory) && powers.length > 0
        && report.observation.sampleGapsMs.every(value => Number.isFinite(value) && value > 0)
        && report.observation.powerGapsMs.every(value => Number.isFinite(value) && value > 0), 'FORMAL_OBSERVATION_COMPLETE');
    } else requireValue(start.durationSeconds === OBSERVATION_SECONDS && end.elapsedMs >= OBSERVATION_SECONDS * 1000
      && samples.length >= OBSERVATION_SECONDS - 1, 'WINDOWS_OBSERVATION_COMPLETE');
    requireValue(samples.every(row => row.browserForeground === true && row.foregroundProcessId === start.browserProcessId), 'OS_FOREGROUND_QUALIFICATION');
    requireValue(powers.every(row => row.powerAvailable === true), 'POWER_OBSERVATION_AVAILABLE');
    const first = powers[0].acLineStatus;
    requireValue((formal ? first === 1 : [0,1].includes(first)) && powers.every(row => row.acLineStatus === first), 'POWER_SOURCE_STABLE');
    report.environment.browserExecutable = { path: start.executable, bytes: start.executableBytes, sha256: start.executableSha256, version: start.fileVersion };
    if (formal) report.environment.driverAssociation = 'UNKNOWN; actual selected adapter fields and complete OS display-driver inventory are retained';
    report.observation.qualified = true;
  }
  try {
    const fixture = canonicalTextBytes('globalThis.canonicalPublicValues = ' + canonicalPublicValues.toString() + ';\n'
      + 'globalThis.runPreflight = ' + runPreflight.toString() + ';\n');
    const html = canonicalTextBytes('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">'
      + '<style>html,body{margin:0;width:1024px;height:768px;overflow:hidden;background:#000}</style>'
      + '<script type="importmap">' + JSON.stringify(importMap) + '</script><script type="module" src="/preflight.mjs"></script>');
    const served = new Map([...graph.modules.values()].map(row => [row.url, { body: row.body, sha256: row.sha256, type: 'text/javascript' }]));
    for (const [url, body, type] of [['/index.html', html, 'text/html'], ['/preflight.mjs', fixture, 'text/javascript'], ['/workload.mjs', workload.body, 'text/javascript']]) {
      served.set(url, { body, sha256: sha256(body), type });
    }
    await artifacts.save('served-preflight.mjs', fixture); await artifacts.save('served-index.html', html);
    await artifacts.json('inputs.json', { inputs: [...inputs.values()], registry, importMap,
      graph: [...graph.modules.values()].map(({ relative, url, bytes, sha256: hash, edges }) => ({ relative, url, bytes, sha256: hash, edges })),
      workload: workload.pin, runner: self.pin });
    server = createServer((request, response) => {
      const value = served.get(request.url), status = request.method === 'GET' && value ? 200 : 404;
      if (report.requests.length >= 512) { report.requestOverflow = true; response.writeHead(429); response.end(); return; }
      report.requests.push({ url: request.url, method: request.method, status, sha256: value?.sha256 ?? null });
      response.writeHead(status, { 'content-type': value?.type ?? 'text/plain', 'cache-control': 'no-store' }); response.end(status === 200 ? value.body : 'Unselected resource');
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    server.on('error', error => { report.serverFailure ??= fault(error); });
    await bounded(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 'SERVER');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const playwright = await bounded(import(pathToFileURL(path.join(playwrightRoot, 'index.mjs')).href), 'PLAYWRIGHT_IMPORT');
    await bounded(acquire(playwright.chromium.launch({ channel: 'msedge', headless: false }), 'browser', value => {
      browser = value; browser.on('disconnected', () => { if (!closeRequested && !retiring) report.unexpectedDisconnect = true; });
    }, value => value.close()), 'BROWSER');
    await bounded(acquire(browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 }), 'context', value => { context = value; }, value => value.close()), 'CONTEXT');
    await bounded(acquire(context.newPage(), 'page', value => { page = value; }, value => value.close()), 'PAGE');
    page.on('pageerror', error => event({ kind: 'pageerror', ...fault(error) }));
    page.on('console', value => { if (value.type() === 'error') event({ kind: 'console', message: value.text().slice(0, 12000) }); });
    page.on('requestfailed', request => event({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
    await bounded(context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && !url.search && !url.hash && served.has(url.pathname)) return route.continue();
      event({ kind: 'unselected-request', url: url.href }); return route.abort('blockedbyclient');
    }), 'NETWORK_ALLOWLIST');
    await bounded(page.exposeBinding('retainPreflightFrame', (source, row) => observe((async () => {
      requireValue(source.page === page && source.frame === page.mainFrame() && row.ordinal === (formal && args['--mode'] === 'correctness'
        ? formal.loaded.recipe.fixed.checkpointOrdinals[formal.trial.state] : [4, 12])[report.frames.length]
        && row.frameId === (formal && args['--mode'] === 'correctness' ? row.ordinal + 1 : row.ordinal)
        && row.readback?.serial === row.frameId && row.readback.frameId === row.frameId
        && row.readback.width === WIDTH && row.readback.height === HEIGHT && row.readback.format === 'rgba8unorm'
        && row.readback.colorSpace === 'srgb' && row.readback.alphaMode === 'premultiplied'
        && ['rgba8unorm', 'bgra8unorm'].includes(row.readback.sourceFormat)
        && typeof row.base64 === 'string' && row.base64.length === RGBA_BYTES / 3 * 4, 'RETAINED_FRAME_IDENTITY');
      const raw = Buffer.from(row.base64, 'base64'); requireValue(raw.length === RGBA_BYTES && raw.toString('base64') === row.base64, 'RGBA_TRANSFER');
      const pin = await artifacts.save('frame-' + row.ordinal + '.rgba', raw);
      let nonBlackPixels = 0;
      for (let offset = 0; offset < raw.length; offset += 4) if (raw[offset] || raw[offset + 1] || raw[offset + 2]) nonBlackPixels++;
      const saved = { ordinal: row.ordinal, frameId: row.frameId, readback: row.readback, raw: pin, nonBlackPixels };
      report.frames.push(saved); await artifacts.json('frame-' + row.ordinal + '.json', saved); return { retained: true };
    })())), 'READBACK_BINDING');
    if (formal) await bounded(page.exposeBinding('retainWindowArtifact', (source, row) => observe((async () => {
      requireValue(source.page === page && source.frame === page.mainFrame() && typeof row.base64 === 'string'
        && row.base64.length <= Math.ceil(4194304 / 3) * 4, 'WINDOW_ARTIFACT_SOURCE');
      const validCounts = args['--mode'] === 'counts' && /^counts-(?:[0-3]|partial)\.json$/.test(row.name) && row.format === 'json';
      const validTimer = ['diagnostic','timing'].includes(args['--mode']) && /^timer-(resolution|empty-call)\.f64$/.test(row.name) && row.format === 'float64-le';
      const validSample = ['diagnostic','timing'].includes(args['--mode']) && /^samples-(ordinal|rafTimestamp|updateStart|updateEnd|renderStart|renderEnd|captureStart|captureEnd)\.f64$/.test(row.name)
        && row.format === 'float64-le' && (args['--mode'] === 'diagnostic' || !/capture/.test(row.name));
      const validFlags = ['diagnostic','timing'].includes(args['--mode']) && row.name === 'samples-flags.u8' && row.format === 'uint8';
      requireValue(validCounts || validTimer || validSample || validFlags, 'WINDOW_ARTIFACT_MEMBER');
      const raw = Buffer.from(row.base64, 'base64');
      requireValue(raw.length > 0 && raw.toString('base64') === row.base64 && (row.format !== 'float64-le' || raw.length % 8 === 0), 'WINDOW_ARTIFACT_TRANSFER');
      const pin = await artifacts.save(row.name, raw); return { retained: true, pin };
    })())), 'WINDOW_ARTIFACT_BINDING');
    await bounded(page.goto(origin + '/index.html', { waitUntil: 'load' }), 'NAVIGATION');
    await bounded(page.waitForFunction(() => typeof globalThis.runPreflight === 'function'), 'FIXTURE_READY');
    await bounded(page.bringToFront(), 'BRING_TO_FRONT');
    await bounded(acquire(browser.newBrowserCDPSession(), 'cdp', value => { cdp = value; }, value => value.detach()), 'CDP');
    const [processes, browserVersion] = await bounded(Promise.all([
      cdp.send('SystemInfo.getProcessInfo'), cdp.send('Browser.getVersion'),
    ]), 'ACTUAL_BROWSER_IDENTITY');
    let commandLine;
    try {
      const result = await bounded(cdp.send('Browser.getBrowserCommandLine'), 'CDP_BROWSER_COMMAND_LINE');
      requireValue(Array.isArray(result.arguments) && result.arguments.length > 0, 'CDP_COMMAND_LINE_RESULT');
      commandLine = { available: true, ...result };
    } catch (error) {
      // Default Edge may refuse this CDP method without --enable-automation.
      // Preserve that refusal; the required OS record binds its real PID command line.
      commandLine = { available: false, failure: fault(error) };
    }
    const browserProcesses = processes.processInfo.filter(row => row.type === 'browser');
    requireValue(browserProcesses.length === 1 && Number.isSafeInteger(browserProcesses[0].id) && browserProcesses[0].id > 0, 'CDP_BROWSER_PID');
    report.environment.browserProcessId = browserProcesses[0].id;
    report.environment.cdp = { processes, browserVersion, commandLine }; report.environment.browserVersion = browser.version();
    let stdout = '', stderr = '';
    observer = spawn(PWSH, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', path.join(HERE, 'observe-windows.ps1'),
      '-BrowserProcessId', String(report.environment.browserProcessId), '-Output', observerPath, '-DurationSeconds', String(formal ? 150 : OBSERVATION_SECONDS),
      ...(formal ? ['-StopPath', stopPath] : [])],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv });
    observerDone = observe(new Promise((resolve, reject) => {
      observer.once('error', reject); observer.once('close', (code, signal) => { observerExited = true; resolve({ code, signal, stdout, stderr }); });
      for (const [stream, append] of [[observer.stdout, text => { stdout += text; }], [observer.stderr, text => { stderr += text; }]]) stream.on('data', chunk => {
        append(chunk.toString('utf8')); if (stdout.length + stderr.length > 65536) { report.observerOutputOverflow = true; observer.kill(); }
      });
    }));
    await bounded((async () => {
      for (;;) {
        if (fs.existsSync(observerPath)) {
          const first = readObservation(false).find(row => row.kind === 'sample');
          if (first) {
            requireValue(first.browserForeground === true && first.foregroundProcessId === report.environment.browserProcessId, 'OBSERVER_FIRST_FOREGROUND');
            return;
          }
        }
        requireValue(!observerExited, 'OBSERVER_EXITED_BEFORE_SAMPLE'); await new Promise(resolve => setTimeout(resolve, 100));
      }
    })(), 'OBSERVER_FIRST_SAMPLE');
    report.native = await bounded(page.evaluate(value => globalThis.runPreflight(value), { deadline: formal ? deadline : Date.now() + 35000,
      ...(formal ? { mode: formal.trial.mode, state: formal.trial.state, profileVersion: 2 } : {}) }), 'NATIVE_WINDOW', formal ? cleanupDeadline : deadline, formal ? 180000 : 70000);
    signalObserver();
    await artifacts.json('native.json', report.native);
    // Browser and page stay alive until the observer has written its end row.
    await finishObserver();
    requireObservation(report.native.status !== 'FAIL', 'NATIVE_OBSERVATION_FAILED');
    const cleanup = report.native.cleanup, mode = args['--mode'];
    const expectedFrameCount = mode === 'preflight' ? 12 : mode === 'counts' ? 4 : mode === 'correctness' ? ({ static:1, sparse:991, full:2 })[formal.trial.state] : 0;
    requireValue(report.native.status === 'COMPLETED' && report.native.frames.length === expectedFrameCount && cleanup.workloadClosed && cleanup.hostSafe
      && cleanup.deviceDestroyCalls === 1 && cleanup.lossSettled && cleanup.canvasRetired && cleanup.pendingOperations === 0
      && cleanup.acquisitions.every(row => row.settled) && cleanup.failures.length === 0, 'NATIVE_WINDOW_AND_CLEANUP');
    const observationStart = Date.parse(report.observation.start.utc), observationEnd = Date.parse(report.observation.end.utc);
    const windows = [...report.native.frames, ...(report.native.priming ? [report.native.priming] : []), ...(report.native.windows ?? []), ...(report.native.reset ? [report.native.reset] : [])];
    requireValue(Number.isFinite(observationStart) && Number.isFinite(observationEnd) && windows.length > 0 && windows.every(row =>
      Number.isSafeInteger(row.startedUtcMs) && Number.isSafeInteger(row.finishedUtcMs) && row.startedUtcMs >= observationStart
      && row.finishedUtcMs >= row.startedUtcMs && row.finishedUtcMs <= observationEnd), 'WINDOW_OUTSIDE_OBSERVED_FOREGROUND');
    report.observation.frameWindowCovered = true;
    const readbackCount = mode === 'preflight' ? 2 : mode === 'correctness' ? formal.loaded.recipe.fixed.checkpointOrdinals[formal.trial.state].length : 0;
    requireValue(report.frames.length === readbackCount, 'EXACT_READBACKS_RETAINED');
    if (readbackCount) {
      requireObservation(report.frames.every(row => row.nonBlackPixels > 0), 'EMPTY_READBACK');
      report.pixelScope = { nonempty: true, fullOracle: formal ? 'Paired raw comparison performed by parent only' : 'NOT_IMPLEMENTED',
        ...(mode === 'preflight' ? { hashesEqual: report.frames[0].raw.sha256 === report.frames[1].raw.sha256 } : {}) };
    }
    if (mode === 'counts') {
      requireValue(cleanup.nativeCounter?.exactDescriptors === true && cleanup.nativeCounter.objects.length <= 8192
        && report.native.frames.every(row => row.nativeCalls <= 32768 && row.trace?.name === 'counts-' + row.ordinal + '.json'), 'NATIVE_COUNTS_RESTORED');
      report.countScope = { actualNativeMethods: true, internalCachePeaks: 'UNKNOWN', batchBreakReasons: 'UNKNOWN' };
    }
    if (mode === 'diagnostic' || mode === 'timing') {
      validatePrimingObservation(report.native);
      const saved = report.native.samples, phases = report.native.windows;
      requireValue(saved?.allActualSamplesRetained && saved.droppedSamples === 0 && phases.length === 2
        && phases[0].label === 'warm' && phases[0].durationMs === 30000 && phases[1].label === 'measure' && phases[1].durationMs === 60000
        && phases.every(row => row.count > 1 && row.boundaryRaf - row.firstRaf >= row.durationMs
          && row.lastFrameId - row.firstFrameId + 1 === row.count)
        && phases[1].count === saved.length && report.native.reset.step === 0
        && report.native.reset.frameId === phases[0].lastFrameId + 1 && phases[1].firstFrameId === report.native.reset.frameId + 1, 'TIMING_WINDOW_STRUCTURE');
      const names = ['ordinal','rafTimestamp','updateStart','updateEnd','renderStart','renderEnd','flags',
        ...(mode === 'diagnostic' ? ['captureStart','captureEnd'] : [])];
      requireValue(sameJson(Object.keys(saved.columns).sort(), names.sort()), 'SAMPLE_MEMBERS');
      const columns = {};
      for (const [name, value] of Object.entries(saved.columns)) {
        const pin = artifacts.records.get(value.raw.name);
        requireValue(pin?.bytes === value.raw.bytes && pin.sha256 === value.raw.sha256 && value.length === saved.length, 'SAMPLE_ARTIFACT_IDENTITY');
        const raw = fs.readFileSync(path.join(output, pin.name)), isByte = name === 'flags';
        requireValue(value.format === (isByte ? 'uint8' : 'float64-le') && raw.length === saved.length * (isByte ? 1 : 8), 'SAMPLE_FORMAT');
        columns[name] = Array.from({ length: saved.length }, (_, index) => isByte ? raw[index] : raw.readDoubleLE(index * 8));
      }
      requireValue(columns.rafTimestamp[0] === saved.firstRaf && saved.boundaryRaf === phases[1].boundaryRaf, 'SAMPLE_WINDOW_LINK');
      report.metrics = summarizeSamples(columns, saved.length, saved.boundaryRaf);
      report.metrics.scope = mode === 'diagnostic' ? 'Separate fresh-capture and actual Host diagnostic window' : 'Actual update plus fresh Engine main window';
    }
    requireValue(report.requests.filter(row => row.url === '/' + REGISTRY && row.status === 200).length === 1, 'ACTUAL_SHARED_REGISTRY_REQUEST');
    requireValue(!report.browserEvents.length && !report.eventOverflow && !report.requestOverflow && !report.observerOutputOverflow, 'BROWSER_EVENTS');
    report.runtimeExecution = 'PASS';
    if (formal) {
      requireValue(report.native.environment?.profileVersion === 2 && report.native.environment.actualWindowDprStable
        && report.native.surface.cssWidth === WIDTH && report.native.surface.cssHeight === HEIGHT, 'PROFILE_TWO_QUALIFICATION');
      report.environmentQualification = 'PASS'; report.environmentReason = null;
      report.status = 'PASS_' + mode.toUpperCase();
    } else {
      report.environmentQualification = report.native.surface.windowDprExactlyRequested ? 'PASS' : 'INCOMPLETE';
      report.environmentReason = report.native.surface.windowDprExactlyRequested ? null : 'ACTUAL_WINDOW_DPR_DIFFERS_FROM_REQUESTED';
      report.status = report.environmentQualification === 'PASS' ? 'PASS_PREFLIGHT' : 'INCOMPLETE_ENVIRONMENT';
    }
  } catch (error) { report.failure = fault(error); report.status = error.observationFailure ? 'FAIL' : 'INCOMPLETE'; }
  finally {
    const cleanup = async (label, operation) => { try { await operation(); } catch (error) { report.cleanupFailures.push({ label, ...fault(error) }); } };
    retiring = true; await cleanup('observer-signal', async () => signalObserver());
    if (observerDone && !report.observation) await cleanup('observer-end-before-browser-close', finishObserver);
    if (observer && !observerExited) await cleanup('observer-stop', async () => { observer.kill(); await bounded(observerDone, 'OBSERVER_STOP', cleanupDeadline); });
    for (const row of acquisitions) if (!row.settled) await cleanup('late-' + row.label, () => bounded(row.promise, 'LATE_' + row.label, cleanupDeadline));
    if (page && !page.isClosed() && !report.native) await cleanup('partial-native', async () => {
      const partial = await bounded(page.evaluate(() => globalThis.preflightReport ?? null), 'PARTIAL_NATIVE', cleanupDeadline);
      if (partial) await artifacts.json('partial-native.json', partial);
    });
    if (cdp) await cleanup('cdp', () => bounded(cdp.detach(), 'CDP_DETACH', cleanupDeadline));
    if (context) await cleanup('context', async () => { await bounded(context.close(), 'CONTEXT_CLOSE', cleanupDeadline); report.lifecycle.contextClosed = true; });
    if (browser) await cleanup('browser', async () => { closeRequested = true; await bounded(browser.close(), 'BROWSER_CLOSE', cleanupDeadline); report.lifecycle.browserClosed = true; });
    if (server) await cleanup('server', async () => {
      for (const socket of sockets) socket.destroy(); server.closeAllConnections();
      await bounded(new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 'SERVER_CLOSE', cleanupDeadline);
      report.lifecycle.serverClosed = sockets.size === 0;
    });
    if (pending.size) await cleanup('pending', () => bounded(Promise.allSettled([...pending]), 'PENDING_DRAIN', cleanupDeadline));
    await cleanup('inputs', async () => {
      for (const before of inputs.values()) {
        const after = fingerprintFile(before.owner, before.path);
        requireValue(after.bytes === before.bytes && after.sha256 === before.sha256, 'INPUT_CHANGED:' + before.path);
      }
      if (formal) {
        loadRecipe(formal.loaded.file);
        for (const name of ['contracts','runtime','engine']) requireValue(samePhysicalPath(fs.realpathSync(path.join(repository, 'node_modules/@egret', name)),
          path.join(repository, 'packages', name)), 'SDK_ALIAS_CHANGED');
      }
      if (builtRole) verifyBuiltSnapshot(repository, manifest);
      report.lifecycle.inputsStable = true;
    });
    await cleanup('registry', async () => { report.registryAfter = await rereadRegistry(registry); requireValue(report.registryAfter.accepted, 'REGISTRY_CHANGED'); });
    await cleanup('artifacts', async () => {
      const reread = await artifacts.reread(); requireValue(reread.accepted, 'ARTIFACT_CHANGED');
      if (report.observation) {
        const after = fingerprintFile(output, report.observation.raw.path);
        requireValue(after.bytes === report.observation.raw.bytes && after.sha256 === report.observation.raw.sha256, 'OBSERVATION_CHANGED');
      }
      report.lifecycle.artifactsStable = true;
    });
    report.lifecycle.pendingOperations = pending.size;
    report.lifecycle.acquisitions = acquisitions.map(({ label, settled, late }) => ({ label, settled, late }));
    report.lifecycle.cooperativeAPIClosure = (!context || report.lifecycle.contextClosed) && (!browser || report.lifecycle.browserClosed)
      && (!server || report.lifecycle.serverClosed) && (!observer || observerExited) && pending.size === 0 && acquisitions.every(row => row.settled);
    if (report.cleanupFailures.length || !report.lifecycle.cooperativeAPIClosure || !report.lifecycle.inputsStable || !report.lifecycle.artifactsStable
      || report.serverFailure || report.unexpectedDisconnect) report.status = 'INCOMPLETE';
    report.finishedAtUTC = new Date().toISOString(); report.artifacts = [...artifacts.records.values()];
    try { await artifacts.json('report.json', report); await artifacts.json('public-summary.json', publicSummary(report)); } finally { clearTimeout(hardTimer); }
  }
  console.log(JSON.stringify({ status: report.status, mode: report.mode, frames: report.native?.frames.length ?? 0, readbacks: report.frames.length, summary: 'public-summary.json' }));
  process.exitCode = report.status === 'PASS_' + args['--mode'].toUpperCase() ? 0 : 1;
}

// This fixed allowlist is a shareable projection. Complete local receipts retain
// paths, process identifiers, command lines and OS inventory outside the checkout.
export function publicSummary(report) {
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const boolean = value => typeof value === 'boolean' ? value : null;
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
  const pin = value => value && hash(value.sha256) ? { name: typeof value.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.name)
    ? value.name : typeof value.path === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value.path) && !value.path.split('/').includes('..')
      ? value.path : null, bytes: number(value.bytes), sha256: hash(value.sha256) } : null;
  const state = value => ['preflight','static','sparse','full'].includes(value) ? value : null;
  const role = value => ['baseline','candidate'].includes(value) ? value : null;
  const status = value => ['PASS_PREFLIGHT','PASS_CORRECTNESS','PASS_COUNTS','PASS_DIAGNOSTIC','PASS_TIMING',
    'FAIL','FAIL_TIMING_TARGET','INCOMPLETE','INCOMPLETE_ENVIRONMENT','PREPARED'].includes(value) ? value : 'INCOMPLETE';
  const version = value => typeof value === 'string' && /^v?[0-9]+(?:\.[0-9]+){1,3}$/.test(value) ? value : null;
  const trial = value => value ? { mode: MODES.includes(value.mode) ? value.mode : null, state: state(value.state),
    role: role(value.role), round: number(value.round) } : null;
  const metrics = value => {
    if (!value) return null;
    const result = {};
    for (const name of ['update','engine','updateThroughRender','intervals','capture','host']) if (value[name])
      result[name] = Object.fromEntries(['count','p50','p95','p99'].map(key => [key, number(value[name][key])]));
    if (value.crossWindowInterval !== undefined) result.crossWindowInterval = number(value.crossWindowInterval);
    return result;
  };
  const result = { schema: 'egret.incremental-native-public-summary/1',
    mode: MODES.includes(report.mode) ? report.mode : null, status: status(report.status), profileVersion: number(report.profileVersion),
    trial: trial(report.trial), sourceManifest: pin(report.source?.manifest), recipe: pin(report.recipe),
    sourceRole: ['merged-baseline','working-tree-candidate','built-sdk'].includes(report.source?.role) ? report.source.role : null,
    runtimeExecution: report.runtimeExecution === 'PASS' ? 'PASS' : 'INCOMPLETE',
    environmentQualification: report.environmentQualification === 'PASS' ? 'PASS' : 'INCOMPLETE',
    versions: { node: version(report.environment?.node), browser: version(report.environment?.browserVersion),
      playwright: version(report.environment?.playwright), powershell: version(report.environment?.powershell) },
    surface: { width: number(report.native?.surface?.width), height: number(report.native?.surface?.height),
      cssWidth: number(report.native?.surface?.cssWidth), cssHeight: number(report.native?.surface?.cssHeight),
      explicitHostPixelRatio: number(report.native?.surface?.explicitHostPixelRatio), actualWindowDpr: number(report.native?.surface?.devicePixelRatio),
      actualWindowDprStable: boolean(report.native?.environment?.actualWindowDprStable) },
    observation: { samples: number(report.observation?.samples), foregroundSamples: number(report.observation?.foregroundSamples),
      powerSamples: number(report.observation?.powerSamples), frameWindowCovered: boolean(report.observation?.frameWindowCovered) },
    cleanup: { cooperativeAPIClosure: boolean(report.lifecycle?.cooperativeAPIClosure), hostSafe: boolean(report.native?.cleanup?.hostSafe),
      failures: report.cleanupFailures?.length ?? null, nativeFailures: report.native?.cleanup?.failures?.length ?? null },
    frameCount: report.native?.frames?.length ?? null, metrics: metrics(report.metrics),
    frames: (report.frames ?? []).map(row => ({ ordinal: number(row.ordinal), raw: pin(row.raw), nonBlackPixels: number(row.nonBlackPixels) })),
    artifacts: (report.artifacts ?? []).map(pin), failurePresent: !!report.failure || !!report.failures?.length,
    limits: ['A fixed public projection of private local evidence; machine paths, command lines, process IDs and raw errors are excluded.',
      'Raw report hashes do not publish their private contents. No GPU timing, physical-memory retirement or continuous focus is inferred.'] };
  if (report.runs) {
    result.runs = report.runs.map(row => ({ trial: trial(row.trial), status: status(row.status), report: pin(row.report), metrics: metrics(row.metrics) }));
    result.comparisons = (report.comparisons ?? []).map(row => ({ round: number(row.round), state: state(row.state),
      environment: row.environment === 'PASS' ? 'PASS' : 'INCOMPLETE',
      pixels: row.pixels?.map(value => ({ ordinal: number(value.ordinal), bytes: number(value.bytes), sha256: hash(value.sha256), byteExact: boolean(value.byteExact) })),
      actualDraws: row.actualDraws?.map(values => values.map(number)) }));
    const expected = MODES.includes(report.mode) ? buildTrialSchedule(report.mode) : [];
    result.environmentQualification = expected.length > 0 && report.runs.length === expected.length
      && sameJson(report.runs.map(row => row.trial), expected) && report.runs.every(row => row.status === 'PASS_' + report.mode.toUpperCase())
      && report.comparisons?.length === expected.length / 2 && report.comparisons.every(row => row.environment === 'PASS') ? 'PASS' : 'INCOMPLETE';
  }
  if (report.timing) {
    const medians = {};
    for (const stateName of STATES) {
      medians[stateName] = {};
      for (const roleName of ['baseline','candidate']) medians[stateName][roleName] = Object.fromEntries(
        ['updateThroughRenderP95','engineP95','intervalP95','intervalP99'].map(key => [key, number(report.timing.medians?.[stateName]?.[roleName]?.[key])]));
    }
    result.timing = { medians, fullDirtyRatio: number(report.timing.fullDirtyRatio),
      fullDirtyRatioAccepted: boolean(report.timing.fullDirtyRatioAccepted), candidateCadenceAccepted: boolean(report.timing.candidateCadenceAccepted),
      candidateEngineAccepted: boolean(report.timing.candidateEngineAccepted), overallD60: 'INCOMPLETE', gpu: 'UNMEASURED' };
  }
  if (report.firstMismatch) result.firstMismatch = { kind: ['raw-rgba','public-values-or-fees'].includes(report.firstMismatch.kind)
    ? report.firstMismatch.kind : null, state: state(report.firstMismatch.state), ordinal: number(report.firstMismatch.ordinal),
    channelOffset: number(report.firstMismatch.channelOffset), baselineByte: number(report.firstMismatch.baselineByte),
    candidateByte: number(report.firstMismatch.candidateByte) };
  return result;
}

// Complete metadata receipts authorize only this fixed priming schedule. They
// are not an oracle for GPU latency, resource reuse or physical allocation.
export function validatePrimingObservation(native) {
  const prime = native.priming, warm = native.windows?.[0];
  const utc = value => Number.isSafeInteger(value) && value >= 0;
  const active = (value, serial) => value?.state === 'active' && value.lastSerial === serial && value.firstFailure === null
    && value.callbackFailureCount === 0 && value.pending && sameJson(Object.keys(value.pending).sort(), ['frames','geometry','readback','upload'])
    && Object.values(value.pending).every(item => Number.isSafeInteger(item) && item >= 0);
  requireValue(prime && utc(prime.startedUtcMs) && utc(prime.idleStartedUtcMs) && utc(prime.finishedUtcMs)
    && prime.startedUtcMs <= prime.idleStartedUtcMs && prime.idleStartedUtcMs <= prime.finishedUtcMs
    && Array.isArray(prime.frames) && prime.frames.length === 2, 'PRIMING_STRUCTURE');
  for (let index = 0; index < 2; index++) {
    const row = prime.frames[index];
    requireValue(row && row.ordinal === index && row.frameId === index + 1 && row.stepBefore === 0 && row.stepAfter === 0 && !row.failure
      && utc(row.startedUtcMs) && utc(row.finishedUtcMs) && row.startedUtcMs >= (index ? prime.frames[index - 1].finishedUtcMs : prime.startedUtcMs)
      && row.finishedUtcMs >= row.startedUtcMs && row.finishedUtcMs <= prime.idleStartedUtcMs
      && active(row.before, index) && row.before.pending.frames === index
      && active(row.after, index + 1) && row.after.pending.frames === index + 1, 'PRIMING_FRAME');
  }
  requireValue(Object.values(prime.frames[0].before.pending).every(value => value === 0)
    && active(prime.afterIdle, 2) && Object.values(prime.afterIdle.pending).every(value => value === 0), 'PRIMING_DRAIN');
  requireValue(warm?.label === 'warm' && warm.firstFrameId === 3, 'PRIMING_WARM_FRAME');
  requireValue(Number.isSafeInteger(warm.count) && warm.count > 0 && Array.isArray(warm.observations)
    && warm.observations.length === Math.min(4, warm.count), 'WARM_OBSERVATION_COUNT');
  for (let index = 0; index < warm.observations.length; index++) {
    const row = warm.observations[index];
    requireValue(row && row.ordinal === index && row.frameId === index + 3 && row.failure === null
      && Number.isFinite(row.rafTimestamp) && row.rafTimestamp >= 0
      && (index === 0 || row.rafTimestamp > warm.observations[index - 1].rafTimestamp)
      && utc(row.startedUtcMs) && utc(row.finishedUtcMs) && row.startedUtcMs >= (index ? warm.observations[index - 1].finishedUtcMs : prime.finishedUtcMs)
      && row.finishedUtcMs >= row.startedUtcMs && active(row.before, index + 2) && row.before.pending.frames < 2
      && active(row.after, index + 3) && row.after.pending.frames === row.before.pending.frames + 1, 'WARM_OBSERVATION_FRAME');
  }
  return prime;
}

export function canonicalPublicValues(value) {
  if (typeof value === 'number') return Object.is(value, -0) ? { signedZero: -1 } : value;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, canonicalPublicValues);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalPublicValues(value[key])]));
  return value;
}

const PROCESS_STARTED = Date.now();
const STATES = ['static', 'sparse', 'full'];
const MODES = ['preflight', 'correctness', 'counts', 'diagnostic', 'timing'];
const FIXED_RECIPE = Object.freeze({
  profileVersion: 2, width: 1024, height: 768, renderPixelRatio: 1, requestedDeviceScaleFactor: 1,
  maxPendingFrames: 2, primingFrames: 2, warmObservationCapacity: 4, warmMs: 30000, measurementMs: 60000, rounds: 5, sampleCapacity: 65536,
  operationMs: 150000, cleanupMs: 30000, hardMs: 190000, correctnessRawCap: 50331648,
  countsFramesPerState: 4, diagnosticPairsPerState: 1, workload: 'm1-2-fixed-v1',
  logicalNodes: 10000, commands: 991, clipReferences: 7928, sourceTriangles: 4992,
  imageA: [255,64,32,128], imageB: [32,96,255,192], sourceSize: [4,4],
  geometry: {positions:[0,0,128,0,128,24,0,24],uvs:[0,0,1,0,1,1,0,1],lightColors:Array(16).fill(1),indices:[0,1,2,0,2,3]},
  checkpointOrdinals: {static:[0],sparse:[0,1,99,990],full:[0,1]}
});
function sameJson(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function fields(value, expected, reason) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value)
    && sameJson(Object.keys(value).sort(), [...expected].sort()), reason);
}
function validPin(pin) { fields(pin,['path','bytes','sha256'],'RECIPE_PIN');
  requireValue(typeof pin.path==='string' && Number.isSafeInteger(pin.bytes) && pin.bytes>0 && /^[a-f0-9]{64}$/.test(pin.sha256),'RECIPE_PIN'); }
export function validateRecipe(recipe) {
  fields(recipe,['schema','baseline','candidate','fixed','schedules','tools','profileSpec'],'RECIPE_FIELDS');
  requireValue(recipe.schema==='egret.incremental-native-recipe/4' && sameJson(recipe.fixed,FIXED_RECIPE),'RECIPE_FIXED');
  requireValue(sameJson(recipe.schedules,Object.fromEntries(MODES.map(mode=>[mode,buildTrialSchedule(mode)]))),'RECIPE_SCHEDULES');
  for(const role of ['baseline','candidate']) {
    fields(recipe[role],['root','manifest'],'RECIPE_ROLE'); requireValue(path.isAbsolute(recipe[role].root),'RECIPE_ROOT'); validPin(recipe[role].manifest);
    requireValue(recipe[role].manifest.path==='manifest.json','RECIPE_MANIFEST');
  }
  requireValue(!samePhysicalPath(recipe.baseline.root,recipe.candidate.root),'RECIPE_DISTINCT_ROOTS');
  requireValue(Array.isArray(recipe.tools) && recipe.tools.length===4,'RECIPE_TOOLS');
  const expected=TOOL_MEMBERS;
  requireValue(sameJson(recipe.tools.map(x=>x.path).sort(),expected),'RECIPE_TOOL_MEMBERS');
  for(const pin of recipe.tools) validPin(pin);
  validPin(recipe.profileSpec); requireValue(recipe.profileSpec.path===PROFILE_SPEC,'RECIPE_AMENDMENT');
  return recipe;
}
export function createFixedRecipe(baseline, candidate) {
  const recipe = { schema: 'egret.incremental-native-recipe/4', baseline, candidate,
    fixed: structuredClone(FIXED_RECIPE), schedules: Object.fromEntries(MODES.map(mode => [mode, buildTrialSchedule(mode)])),
    tools: TOOL_MEMBERS.map(file => fingerprintFile(CHECKOUT, file)), profileSpec: fingerprintFile(CHECKOUT, PROFILE_SPEC) };
  return validateRecipe(recipe);
}

export function buildTrialSchedule(mode) {
  requireValue(MODES.includes(mode),'MODE');
  const rows=[], states=mode==='preflight'?['preflight']:STATES, rounds=mode==='timing'?5:1;
  for(let round=0;round<rounds;round++) for(let s=0;s<states.length;s++) {
    const state=states[(round+s)%states.length], roles=round%2===0?['baseline','candidate']:['candidate','baseline'];
    for(const role of roles) rows.push({id:mode+'-r'+(round+1)+'-'+state+'-'+role,mode,round:round+1,state,role});
  }
  return rows;
}
export function nearestRank(values, quantile) {
  requireValue(Array.isArray(values) && values.length>0 && values.every(x=>Number.isFinite(x)&&x>=0)
    && quantile>0 && quantile<=1,'SAMPLES');
  const sorted=[...values].sort((a,b)=>a-b); return sorted[Math.ceil(quantile*sorted.length)-1];
}
function quantiles(values) { return {count:values.length,p50:nearestRank(values,.5),p95:nearestRank(values,.95),p99:nearestRank(values,.99)}; }
export function summarizeSamples(columns,length,boundary) {
  requireValue(Number.isSafeInteger(length)&&length>1&&length<=65536,'SAMPLE_LENGTH');
  const names=['ordinal','rafTimestamp','updateStart','updateEnd','renderStart','renderEnd','flags'];
  requireValue(names.every(name=>columns[name]?.length===length),'SAMPLE_COLUMNS');
  const update=[],engine=[],total=[],intervals=[],capture=[];
  for(let i=0;i<length;i++) {
    const [ordinal,raf,a,b,c,d,flags]=names.map(name=>columns[name][i]);
    requireValue(ordinal===i && [raf,a,b,c,d].every(Number.isFinite) && raf>=0 && a>=raf && b>=a && c>=b && d>=c,'SAMPLE_ORDER');
    requireValue(flags===3,'FOREGROUND');
    if(i) { requireValue(raf>columns.rafTimestamp[i-1],'SAMPLE_RAF'); intervals.push(raf-columns.rafTimestamp[i-1]); }
    update.push(b-a);engine.push(d-c);total.push(d-a);
    if(columns.captureStart) {
      const x=columns.captureStart[i],y=columns.captureEnd[i];
      requireValue(Number.isFinite(x)&&Number.isFinite(y)&&x>=b&&y>=x&&c>=y,'SAMPLE_CAPTURE_ORDER');capture.push(y-x);
    }
  }
  requireValue(Number.isFinite(boundary)&&boundary>columns.rafTimestamp[length-1],'SAMPLE_BOUNDARY');
  return {update:quantiles(update),engine:quantiles(engine),updateThroughRender:quantiles(total),intervals:quantiles(intervals),
    crossWindowInterval:boundary-columns.rafTimestamp[length-1],...(capture.length?{capture:quantiles(capture),host:quantiles(engine)}:{})};
}
export function aggregateTiming(results) {
  const expected=buildTrialSchedule('timing');
  requireValue(results.length===30 && new Set(results.map(x=>x.trial.id)).size===30
    && expected.every((trial,i)=>sameJson(results[i].trial,trial)&&results[i].status==='PASS_TIMING'),'COMPLETE_TIMING');
  const medians={};
  for(const state of STATES) {
    medians[state]={};
    for(const role of ['baseline','candidate']) {
      const rows=results.filter(x=>x.trial.state===state&&x.trial.role===role);
      requireValue(rows.length===5,'COMPLETE_TIMING');
      const median=selector=>nearestRank(rows.map(selector),.5);
      medians[state][role]={updateThroughRenderP95:median(x=>x.metrics.updateThroughRender.p95),
        engineP95:median(x=>x.metrics.engine.p95),intervalP95:median(x=>x.metrics.intervals.p95),intervalP99:median(x=>x.metrics.intervals.p99)};
    }
  }
  const denominator=medians.full.baseline.updateThroughRenderP95;
  requireValue(denominator>0,'SAMPLES_BASELINE_ZERO');
  const fullDirtyRatio=medians.full.candidate.updateThroughRenderP95/denominator;
  return {aggregation:'Median of five per-trial nearest-rank quantiles; every trial retained',medians,fullDirtyRatio,
    fullDirtyRatioAccepted:fullDirtyRatio<=1.10,
    candidateCadenceAccepted:STATES.every(state=>medians[state].candidate.intervalP95<=16.7&&medians[state].candidate.intervalP99<=33.4),
    candidateEngineAccepted:STATES.every(state=>medians[state].candidate.engineP95<=8),
    purePreparation:'UNMEASURED_IN_MAIN_WINDOW',gpu:'UNMEASURED',overallD60:'INCOMPLETE'};
}
export function readPinned(owner,pin) {
  const actual=fingerprintFile(owner,pin.path);
  requireValue(actual.bytes===pin.bytes&&actual.sha256===pin.sha256,'PIN_CHANGED:'+pin.path);
  const body=fs.readFileSync(path.join(owner,pin.path));
  requireValue(body.length===pin.bytes&&sha256(body)===pin.sha256,'PIN_READ_CHANGED:'+pin.path);return body;
}
export function loadRecipe(file,baseline,candidate) {
  requireValue(path.isAbsolute(file),'RECIPE_ABSOLUTE'); const owner=path.dirname(file),pin=fingerprintFile(owner,path.basename(file));
  requireValue(pin.bytes<1048576,'RECIPE_SIZE');
  const raw=readPinned(owner,pin),parsed=JSON.parse(raw);
  requireValue(raw.equals(canonicalTextBytes(JSON.stringify(parsed,null,2))),'RECIPE_CANONICAL_RAW');
  const recipe=validateRecipe(parsed);
  for(const role of ['baseline','candidate']) {
    requireValue(samePhysicalPath(recipe[role].root,fs.realpathSync(recipe[role].root)),'RECIPE_ROOT_ALIAS');
    if(role==='baseline'&&baseline) requireValue(samePhysicalPath(baseline,recipe[role].root),'RECIPE_BASELINE_ARGUMENT');
    if(role==='candidate'&&candidate) requireValue(samePhysicalPath(candidate,recipe[role].root),'RECIPE_CANDIDATE_ARGUMENT');
    readPinned(recipe[role].root,recipe[role].manifest);
  }
  for(const tool of recipe.tools)readPinned(CHECKOUT,tool);
  readPinned(CHECKOUT,recipe.profileSpec);
  return {recipe,pin,owner,file};
}
function trialArtifactStore(output) {
  let bytes=0;const records=new Map();
  return {records,async save(name,body){requireValue(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)&&!records.has(name)
      &&body.length<=4194304&&bytes+body.length<=33554432,'TRIAL_ARTIFACT_LIMIT');
    fs.writeFileSync(path.join(output,name),body,{flag:'wx'});bytes+=body.length;const pin={name,path:path.join(output,name),bytes:body.length,sha256:sha256(body)};records.set(name,pin);return pin;},
    async json(name,value){return this.save(name,canonicalTextBytes(JSON.stringify(value)));},
    async reread(){const observations=[...records.values()].map(before=>{const after=fingerprintFile(output,before.name);return{before,after,stable:before.bytes===after.bytes&&before.sha256===after.sha256};});
      return{accepted:observations.every(x=>x.stable),observations};}};
}
function spawnTrial(descriptor,pin,file) {
  return new Promise(resolve=>{
    let settled=false,hard=false,output='',errors='',child,hardTimer,settleTimer;
    const finish=(code,signal,failure=null)=>{if(settled)return;settled=true;clearTimeout(hardTimer);clearTimeout(settleTimer);resolve({code,signal,hard,failure,stdout:output,stderr:errors});};
    child=spawn(NODE,[fileURLToPath(import.meta.url),'--trial',file,'--trial-sha256',pin.sha256],{windowsHide:true,
      cwd:CHECKOUT,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(NODE_OPTIONS|NODE_PATH)$/i.test(key))),stdio:['ignore','pipe','pipe']});
    hardTimer=setTimeout(()=>{hard=true;child.kill();settleTimer=setTimeout(()=>finish(null,null,{message:'HARD_DEADLINE_CHILD_RETIREMENT_UNCONFIRMED'}),5000);},190000);
    child.on('error',error=>finish(null,null,fault(error)));
    child.on('close',(code,signal)=>finish(code,signal));
    for(const [stream,append] of [[child.stdout,v=>{output+=v;}],[child.stderr,v=>{errors+=v;}]]) stream.on('data',value=>{
      append(value.toString('utf8'));if(output.length+errors.length>1048576){hard=true;child.kill();}});
  });
}
function pairEnvironment(report) {
  return {browser:report.environment.browserExecutable,version:report.environment.browserVersion,
    surface:report.native.surface,adapter:report.native.adapter,device:report.native.device,
    inventory:report.observation.start.inventory,power:report.observation.start.activePowerScheme};
}
async function runBatch(args) {
  const loaded=loadRecipe(args['--recipe'],args['--baseline'],args['--candidate']),mode=args['--mode'],schedule=buildTrialSchedule(mode);
  const output=await freshOutput(args['--output'],loaded.recipe.baseline.root);
  for(const root of [loaded.recipe.candidate.root,HERE,CHECKOUT,args['--playwright'],path.dirname(NODE),path.dirname(fs.realpathSync(args['--powershell']))])
    requireValue(!inside(root,output),'OUTPUT_OWNER');
  fs.mkdirSync(output);const result={schema:'egret.incremental-native-batch/3',mode,status:'INCOMPLETE',profileVersion:2,
    recipe:{owner:loaded.owner,...loaded.pin},schedule,runs:[],comparisons:[],failures:[],limits:['No GPU timing, private cache peaks, physical memory or OS descendant retirement is inferred.']};
  fs.writeFileSync(path.join(output,'planned-inputs.json'),canonicalTextBytes(JSON.stringify({recipe:loaded.recipe,schedule},null,2)),{flag:'wx'});
  try {
    for(const trial of schedule) {
      loadRecipe(loaded.file);
      const descriptor={schema:'egret.incremental-native-trial/3',trial,recipe:loaded.file,recipePin:loaded.pin,playwright:args['--playwright'],powershell:args['--powershell'],output:path.join(output,trial.id)};
      const file=path.join(output,trial.id+'.input.json');fs.writeFileSync(file,canonicalTextBytes(JSON.stringify(descriptor)),{flag:'wx'});
      const pin=fingerprintFile(output,path.basename(file)),processResult=await spawnTrial(descriptor,pin,file);
      const row={trial,input:{owner:output,...pin},process:processResult,report:null};result.runs.push(row);
      fs.writeFileSync(path.join(output,trial.id+'.stdout.log'),processResult.stdout,{flag:'wx'});
      fs.writeFileSync(path.join(output,trial.id+'.stderr.log'),processResult.stderr,{flag:'wx'});
      if (fs.existsSync(path.join(descriptor.output,'report.json'))) {
        const partialPin=fingerprintFile(descriptor.output,'report.json');row.report={owner:descriptor.output,...partialPin};
        const partial=JSON.parse(readPinned(descriptor.output,partialPin));row.status=partial.status;row.failure=partial.failure;
      }
      if(processResult.code===1&&processResult.signal===null&&!processResult.hard&&!processResult.failure)
        requireObservation(row.status!=='FAIL','TRIAL_OBSERVATION_FAILED');
      requireValue(processResult.code===0&&!processResult.hard&&!processResult.failure,'TRIAL_PROCESS');
      const reportPin=fingerprintFile(descriptor.output,'report.json');row.report={owner:descriptor.output,...reportPin};
      const report=JSON.parse(readPinned(descriptor.output,reportPin));row.status=report.status;row.metrics=report.metrics;row.details=report;
      requireValue(report.status==='PASS_'+mode.toUpperCase()&&report.environmentQualification==='PASS'&&report.lifecycle.cooperativeAPIClosure,'TRIAL_INCOMPLETE');
      if(result.runs.length%2===0) {
        const pair=result.runs.slice(-2),a=pair.find(x=>x.trial.role==='baseline'),b=pair.find(x=>x.trial.role==='candidate');
        requireValue(sameJson(pairEnvironment(a.details),pairEnvironment(b.details)),'PAIRED_ENVIRONMENT_CHANGED');
        const comparison={round:trial.round,state:trial.state,environment:'PASS'};
        if(mode==='preflight'||mode==='correctness') {
          requireValue(a.details.frames.length===b.details.frames.length,'PIXEL_CHECKPOINT_COUNT');
          comparison.pixels=a.details.frames.map((frame,i)=>{
            const other=b.details.frames[i];requireValue(frame.ordinal===other.ordinal,'PIXEL_ORDINAL');
            const left=readPinned(a.report.owner,{path:frame.raw.name,bytes:frame.raw.bytes,sha256:frame.raw.sha256});
            const right=readPinned(b.report.owner,{path:other.raw.name,bytes:other.raw.bytes,sha256:other.raw.sha256});
            if (!left.equals(right)) {
              let offset=0;while(offset<Math.min(left.length,right.length)&&left[offset]===right[offset])offset++;
              result.firstMismatch={kind:'raw-rgba',state:trial.state,ordinal:frame.ordinal,channelOffset:offset,
                baselineByte:left[offset]??null,candidateByte:right[offset]??null,baseline:frame.raw,candidate:other.raw};
              requireObservation(false,'RAW_RGBA_DIFFERENCE');
            }return{ordinal:frame.ordinal,bytes:left.length,sha256:frame.raw.sha256,byteExact:true};});
          if(mode==='correctness') {
            const project=x=>({ordinal:x.ordinal,digest:x.captureDigest,inventory:x.inventory,pending:x.pending});
            const index=a.details.native.frames.findIndex((frame,i)=>!sameJson(project(frame),project(b.details.native.frames[i])));
            if(index!==-1) {
              result.firstMismatch={kind:'public-values-or-fees',state:trial.state,ordinal:a.details.native.frames[index].ordinal,
                baseline:project(a.details.native.frames[index]),candidate:project(b.details.native.frames[index])};
              requireObservation(false,'PUBLIC_VALUES_OR_FEES_DIFFER');
            }
          }
        }
        if(mode==='counts') {
          requireValue(a.details.native.frames.length===4&&b.details.native.frames.length===4,'COUNTS_FRAMES');
          comparison.actualDraws=[a,b].map(run=>run.details.native.frames.map(frame=>frame.counts.draw??0));
          requireObservation(comparison.actualDraws[0].every(x=>x===991)&&comparison.actualDraws[1].every(x=>x===155),'ACTUAL_DRAW_PREDICTION');
          comparison.internalBreakReasons='UNKNOWN; observable native transitions retained';
        }
        result.comparisons.push(comparison);
      }
    }
    if(mode==='correctness')requireValue(result.comparisons.reduce((sum,x)=>sum+x.pixels.reduce((s,p)=>s+p.bytes*2,0),0)===44040192,'EXACT_14_RGBA');
    if(mode==='timing')result.timing=aggregateTiming(result.runs);
    if(mode==='diagnostic')result.preparationUpperBounds=result.runs.map(row=>({trial:row.trial,hostP95:row.metrics.host.p95,
      status:row.metrics.host.p95<=4?'UPPER_BOUND_SATISFIED_FOR_THIS_DIAGNOSTIC_WINDOW':'PURE_PREPARATION_UNMEASURED'}));
    loadRecipe(loaded.file);
    for (const run of result.runs) {
      readPinned(run.report.owner,run.report);
      for (const artifact of run.details.artifacts) readPinned(run.report.owner,{path:artifact.name,bytes:artifact.bytes,sha256:artifact.sha256});
      readPinned(run.report.owner,run.details.observation.raw);
    }
    result.status='PASS_'+mode.toUpperCase();
    if(mode==='timing'&&(!result.timing.fullDirtyRatioAccepted||!result.timing.candidateCadenceAccepted||!result.timing.candidateEngineAccepted))result.status='FAIL_TIMING_TARGET';
  } catch(error) {result.failures.push(fault(error));result.status=error.observationFailure?'FAIL':'INCOMPLETE';}
  finally {
    for(const row of result.runs)delete row.details;
    fs.writeFileSync(path.join(output,'comparison.json'),canonicalTextBytes(JSON.stringify(result,null,2)),{flag:'wx'});
    fs.writeFileSync(path.join(output,'public-summary.json'),canonicalTextBytes(JSON.stringify(publicSummary(result),null,2)),{flag:'wx'});
  }
  console.log(JSON.stringify({status:result.status,mode,trials:result.runs.length,summary:'public-summary.json'}));process.exitCode=result.status.startsWith('PASS_')?0:1;
}

// Offline preparation only snapshots already-built inputs. It never evaluates an
// SDK, compiler, package lifecycle script or browser and makes no merge claim.
const SDK_PACKAGES = ['contracts', 'runtime', 'engine'];
const BUILD_LINE = /^Project format check PASS \(21 definitions\)\.[\r\n]*$/;
const PREPARE_KEYS = ['--baseline', '--candidate', '--baseline-build-log', '--baseline-build-exit',
  '--candidate-build-log', '--candidate-build-exit', '--output'];
export function prepareOptions(argv) {
  requireValue(argv.length === 15 && argv[0] === '--prepare', 'PREPARE_CLI'); const result = {};
  for (let i = 1; i < argv.length; i += 2) {
    requireValue(PREPARE_KEYS.includes(argv[i]) && !Object.hasOwn(result, argv[i]) && typeof argv[i + 1] === 'string', 'PREPARE_CLI');
    requireValue(path.isAbsolute(argv[i + 1]), 'PREPARE_ABSOLUTE'); result[argv[i]] = argv[i + 1];
  }
  return result;
}
function strictText(raw, reason) {
  requireValue(!(raw[0] === 239 && raw[1] === 187 && raw[2] === 191), reason);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch { throw Error('INCOMPLETE:' + reason); }
}
export function validateBuildRecord(log, exit) {
  requireValue(log.length > 0 && log.length <= 4194304 && exit.length > 0 && exit.length <= 64, 'BUILD_RECORD_SIZE');
  requireValue(strictText(exit, 'BUILD_EXIT_UTF8').trim() === '0' && BUILD_LINE.test(strictText(log, 'BUILD_LOG_UTF8')), 'BUILD_RESULT');
  return true;
}
const copiedIdentity = ({ target, category, bytes, sha256 }) => ({ target, category, bytes, sha256 });
function captureMember(owner, relative, target, category, maximum = 134217728) {
  logicalPath(relative); logicalPath(target);
  const stat = fs.lstatSync(path.join(owner, relative));
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maximum, 'SNAPSHOT_FILE_SIZE_OR_TYPE');
  const pin = fingerprintFile(owner, relative), raw = readPinned(owner, pin);
  return { owner, ...pin, target, category, raw };
}
export function collectSnapshotInputs(repository) {
  requireValue(path.isAbsolute(repository) && samePhysicalPath(repository, fs.realpathSync(repository))
    && fs.lstatSync(repository).isDirectory() && !fs.lstatSync(repository).isSymbolicLink(), 'SNAPSHOT_ROOT');
  const members = [], names = new Set(); let bytes = 0, visited = 0;
  function add(owner, relative, target, category) {
    requireValue(members.length < 2048 && !names.has(target), 'SNAPSHOT_MEMBER_CAP_OR_DUPLICATE'); names.add(target);
    const row = captureMember(owner, relative, target, category, 134217728 - bytes);
    bytes += row.bytes; requireValue(bytes <= 134217728, 'SNAPSHOT_BYTE_CAP'); members.push(row);
  }
  function walk(owner, relative, category, prefix = '', emitted = false) {
    logicalPath(relative); requireValue(++visited <= 8192 && relative.split('/').length <= 32, 'SNAPSHOT_TREE_CAP');
    const full = path.join(owner, relative), stat = fs.lstatSync(full);
    requireValue(!stat.isSymbolicLink(), 'SNAPSHOT_MEMBER_ALIAS');
    if (stat.isDirectory()) for (const name of fs.readdirSync(full).sort()) walk(owner, relative + '/' + name, category, prefix, emitted);
    else {
      requireValue(stat.isFile(), 'SNAPSHOT_MEMBER_TYPE');
      if (!emitted || relative.endsWith('.js') || relative.endsWith('.d.ts'))
        add(owner, relative, prefix + relative, emitted ? relative.endsWith('.d.ts') ? 'declaration' : 'javascript' : category);
    }
  }
  for (const relative of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.base.json'])
    add(repository, relative, relative, 'configuration');
  for (const name of SDK_PACKAGES) {
    const base = 'packages/' + name; add(repository, base + '/package.json', base + '/package.json', 'package-manifest');
    const manifest = JSON.parse(strictText(members.at(-1).raw, 'PACKAGE_UTF8'));
    requireValue(manifest.name === '@egret/' + name, 'PACKAGE_NAME');
    if (name === 'engine') requireValue(manifest.dependencies?.['robust-predicates'] === '3.0.3', 'DEPENDENCY_DECLARED');
    for (const file of fs.readdirSync(path.join(repository, base)).sort()) if (/^tsconfig(?:\.[A-Za-z0-9_-]+)?\.json$/.test(file))
      add(repository, base + '/' + file, base + '/' + file, 'configuration');
    requireValue(names.has(base + '/tsconfig.json'), 'PACKAGE_TSCONFIG');
    for (const folder of ['src', ...(name === 'engine' ? ['rendering', 'web'] : [])]) walk(repository, base + '/' + folder, 'source');
    walk(repository, base + '/dist', null, '', true);
    requireValue(names.has(base + '/dist/index.js') && names.has(base + '/dist/index.d.ts'), 'PACKAGE_EMISSION');
  }
  const require = createRequire(path.join(repository, 'packages/engine/package.json'));
  const dependency = fs.realpathSync(path.dirname(require.resolve('robust-predicates')));
  const dep = JSON.parse(strictText(captureMember(dependency, 'package.json', 'package.json', 'dependency-original', 1048576).raw, 'DEPENDENCY_UTF8'));
  requireValue(dep.name === 'robust-predicates' && dep.version === '3.0.3' && dep.exports === './index.js', 'DEPENDENCY_VERSION');
  for (const file of fs.readdirSync(dependency).sort()) walk(dependency, file, 'dependency-original', 'packages/engine/node_modules/robust-predicates/');
  members.sort((a, b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
  return { repository, dependency, members, bytes };
}
function verifyAliases(repository, links) {
  requireValue(Array.isArray(links) && links.length === 3 && new Set(links.map(row => row.path)).size === 3, 'SDK_ALIAS_COUNT');
  for (const name of SDK_PACKAGES) {
    const relative = 'node_modules/@egret/' + name, target = path.join(repository, 'packages', name), row = links.find(value => value.path === relative);
    requireValue(row?.cloneOwned === true && row.target === 'packages/' + name && samePhysicalPath(row.resolvedTarget, target)
      && fs.lstatSync(path.join(repository, relative)).isSymbolicLink()
      && samePhysicalPath(fs.realpathSync(path.join(repository, relative)), target), 'SDK_OWNED_ALIAS');
  }
}
function verifySnapshotMembership(repository, files, generated, links, hasManifest) {
  verifyAliases(repository, links); const actual = [], foundLinks = []; let visited = 0;
  function walk(relative = '') {
    for (const name of fs.readdirSync(path.join(repository, relative)).sort()) {
      const child = relative ? relative + '/' + name : name; logicalPath(child);
      requireValue(++visited <= 8192 && child.split('/').length <= 32, 'SNAPSHOT_TREE_CAP');
      const full = path.join(repository, child), stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) { requireValue(links.some(row => row.path === child), 'UNREGISTERED_ALIAS'); foundLinks.push(child); }
      else if (stat.isDirectory()) walk(child);
      else { requireValue(stat.isFile(), 'SNAPSHOT_MEMBER_TYPE'); actual.push(child); }
    }
  }
  walk(); requireValue(foundLinks.length === 3, 'SNAPSHOT_ALIAS_MEMBERS');
  const expected = [...files.map(row => row.target), ...generated.map(row => row.path), ...(hasManifest ? ['manifest.json'] : [])].sort();
  requireValue(new Set(expected).size === expected.length && sameJson(actual.sort(), expected), 'SNAPSHOT_COMPLETE_MEMBERS');
  for (const row of files) readPinned(repository, { path: row.target, bytes: row.bytes, sha256: row.sha256 });
  for (const row of generated) readPinned(repository, row);
}
function publicEntriesFor(repository) {
  const imports = {}, publicEntries = [];
  const target = (name, value) => {
    requireValue(typeof value === 'string' && value.startsWith('./'), 'PACKAGE_EXPORT_TARGET');
    const relative = logicalPath('packages/' + name + '/' + value.slice(2)); fingerprintFile(repository, relative); return relative;
  };
  for (const name of SDK_PACKAGES) {
    const manifest = JSON.parse(strictText(fs.readFileSync(path.join(repository, 'packages', name, 'package.json')), 'PACKAGE_UTF8'));
    requireValue(manifest.name === '@egret/' + name && manifest.exports && typeof manifest.exports === 'object', 'PACKAGE_EXPORTS');
    for (const [key, value] of Object.entries(manifest.exports)) {
      requireValue(key === '.' || key.startsWith('./'), 'PACKAGE_EXPORT_KEY');
      const specifier = manifest.name + (key === '.' ? '' : key.slice(1)), javascript = target(name, value.import), declaration = target(name, value.types);
      requireValue(javascript.endsWith('.js') && declaration.endsWith('.d.ts'), 'PACKAGE_EXPORT_KIND');
      imports[specifier] = '/' + javascript; publicEntries.push({ specifier, javascript, declaration });
    }
    for (const [specifier, value] of Object.entries(manifest.imports ?? {})) {
      requireValue(['#egret-textured-frame-state', '#egret-mouse-input'].includes(specifier) && !Object.hasOwn(imports, specifier), 'PACKAGE_PRIVATE_ALIAS');
      imports[specifier] = '/' + target(name, value.import); target(name, value.types);
    }
  }
  imports['robust-predicates'] = '/packages/engine/node_modules/robust-predicates/index.js';
  return { imports, publicEntries };
}
function verifyBuiltSnapshot(repository, manifest) {
  fields(manifest, ['schemaVersion','role','status','createdAtUtc','owner','inputRoot','preparationRuntime','buildReceipt',
    'dependency','counts','files','generated','links','publicEntries','graph','checks','limits'], 'BUILT_MANIFEST_FIELDS');
  requireValue(manifest.role === 'built-sdk' && manifest.status === 'FROZEN_BUILT_SDK_SNAPSHOT' && manifest.schemaVersion === 1
    && samePhysicalPath(manifest.owner, repository), 'BUILT_MANIFEST_ROLE');
  const manifestRaw = fs.readFileSync(path.join(repository, 'manifest.json'));
  requireValue(manifestRaw.equals(canonicalTextBytes(JSON.stringify(manifest, null, 2))), 'BUILT_MANIFEST_CANONICAL_RAW');
  const collected = collectSnapshotInputs(repository);
  requireValue(samePhysicalPath(collected.dependency, path.join(repository, 'packages/engine/node_modules/robust-predicates')), 'BUILT_DEPENDENCY_OWNER');
  requireValue(sameJson(collected.members.map(copiedIdentity), manifest.files.filter(row => row.category !== 'build-evidence').map(copiedIdentity)), 'BUILT_COMPLETE_INPUTS');
  const evidence = manifest.files.filter(row => row.category === 'build-evidence');
  requireValue(evidence.length === 2 && sameJson(evidence.map(row => row.target).sort(), ['evidence/provided-build.exit','evidence/provided-build.log']), 'BUILT_BUILD_MEMBERS');
  const log = readPinned(repository, { ...evidence.find(row => row.target.endsWith('.log')), path: 'evidence/provided-build.log' });
  const exit = readPinned(repository, { ...evidence.find(row => row.target.endsWith('.exit')), path: 'evidence/provided-build.exit' }); validateBuildRecord(log, exit);
  requireValue(sameJson(manifest.generated.map(row => row.path).sort(), ['SNAPSHOT.md','browser-import-map.json','evidence/provided-build-receipt.json']), 'BUILT_GENERATED_MEMBERS');
  verifySnapshotMembership(repository, manifest.files, manifest.generated, manifest.links, true);
  const receiptPin = manifest.generated.find(row => row.path === 'evidence/provided-build-receipt.json');
  const receipt = JSON.parse(strictText(readPinned(repository, receiptPin), 'BUILD_RECEIPT_UTF8'));
  requireValue(sameJson(receipt.preparationRuntime, manifest.preparationRuntime) && manifest.preparationRuntime?.node === 'v26.7.0'
    && /^[a-f0-9]{64}$/.test(manifest.preparationRuntime.sha256), 'BUILT_PREPARATION_RUNTIME');
  requireValue(sameJson(receipt, manifest.buildReceipt) && receipt.kind === 'provided-successful-build-record' && receipt.exitCode === 0
    && sameJson(receipt.expectedCommand, ['node','tools/build.mjs']) && receipt.commandObserved === false
    && receipt.independentCompilation === false && sameJson(receipt.files, evidence.map(copiedIdentity)), 'BUILT_BUILD_RECEIPT');
  const entries = publicEntriesFor(repository);
  requireValue(sameJson(entries.publicEntries, manifest.publicEntries)
    && sameJson(JSON.parse(strictText(readPinned(repository, manifest.generated.find(row => row.path === 'browser-import-map.json')), 'MAP_UTF8')), { imports: entries.imports }), 'BUILT_PUBLIC_ENTRIES');
  return collected;
}
async function prepareSnapshots(args) {
  const roots = {};
  for (const role of ['baseline','candidate']) {
    const requested = args['--' + role]; await directoryChain(requested); roots[role] = fs.realpathSync(requested);
    requireValue(samePhysicalPath(requested, roots[role]), 'PREPARE_ROOT_ALIAS');
  }
  requireValue(!inside(roots.baseline, roots.candidate) && !inside(roots.candidate, roots.baseline), 'PREPARE_DISTINCT_ROOTS');
  const output = await freshOutput(args['--output'], roots.baseline);
  for (const owner of [roots.candidate, CHECKOUT, HERE, path.dirname(NODE)]) requireValue(!inside(owner, output), 'PREPARE_OUTPUT_OWNER');
  for (const key of PREPARE_KEYS.filter(key => key.endsWith('-log') || key.endsWith('-exit')))
    requireValue(!inside(output, args[key]), 'PREPARE_RECEIPT_OUTPUT');
  fs.mkdirSync(output);
  const save = (root, name, value) => fs.writeFileSync(path.join(root, name), canonicalTextBytes(JSON.stringify(value, null, 2)), { flag: 'wx' });
  const result = { schema: 'egret.incremental-sdk-preparation/1', status: 'INCOMPLETE_DO_NOT_USE', snapshots: [], failure: null,
    limits: ['Provided build records are bound to raw copies; no independent compilation or merge verification.',
      'No SDK, compiler, install or browser execution. Snapshots are hash-bound, not filesystem-enforced immutable.'] };
  try {
    const runtimePin = fingerprintFile(path.dirname(NODE), path.basename(NODE));
    const preparationRuntime = { node: process.version, executable: NODE, ...runtimePin };
    const tools = [...TOOL_MEMBERS, PROFILE_SPEC, 'tools/lib/file-identity.mjs', 'tools/textured-webgpu/native-files.mjs', 'tools/browser-tool-matrix.json']
      .map(relative => fingerprintFile(CHECKOUT, relative));
    const captured = {}, records = {};
    for (const role of ['baseline','candidate']) {
      records[role] = [];
      for (const extension of ['exit','log']) {
        const file = args['--' + role + '-build-' + extension], owner = path.dirname(file); await directoryChain(owner);
        records[role].push(captureMember(owner, path.basename(file), 'evidence/provided-build.' + extension, 'build-evidence', extension === 'log' ? 4194304 : 64));
      }
      validateBuildRecord(records[role][1].raw, records[role][0].raw);
      captured[role] = collectSnapshotInputs(roots[role]); await directoryChain(captured[role].dependency);
    }
    const depRows = role => captured[role].members.filter(row => row.category === 'dependency-original').map(copiedIdentity);
    requireValue(sameJson(depRows('baseline'), depRows('candidate')), 'PREPARE_DEPENDENCY_RAW_MISMATCH');
    const stableOriginals = () => {
      for (const role of ['baseline','candidate']) {
        const now = collectSnapshotInputs(roots[role]);
        requireValue(samePhysicalPath(now.dependency, captured[role].dependency)
          && sameJson(now.members.map(copiedIdentity), captured[role].members.map(copiedIdentity)), 'PREPARE_ORIGINAL_MEMBERS_OR_BYTES_CHANGED');
        for (const row of records[role]) readPinned(row.owner, row);
      }
      readPinned(path.dirname(NODE), runtimePin); for (const row of tools) readPinned(CHECKOUT, row);
    };
    for (const role of ['baseline','candidate']) {
      const owner = path.join(output, role); fs.mkdirSync(owner);
      const rows = [...captured[role].members, ...records[role]].sort((a,b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
      requireValue(rows.length <= 2048 && rows.reduce((sum,row) => sum + row.bytes, 0) <= 134217728, 'PREPARE_COPY_CAP');
      for (const row of rows) {
        const file = path.join(owner, row.target); ownerRelativePath(owner, file); fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, row.raw, { flag: 'wx' }); readPinned(owner, { path: row.target, bytes: row.bytes, sha256: row.sha256 });
        const original = fs.statSync(path.join(row.owner, row.path)), copied = fs.statSync(file);
        requireValue(original.dev !== copied.dev || original.ino !== copied.ino, 'PREPARE_COPY_ALIAS');
      }
      fs.mkdirSync(path.join(owner, 'node_modules/@egret'), { recursive: true });
      const links = SDK_PACKAGES.map(name => {
        const relative = 'node_modules/@egret/' + name, target = 'packages/' + name;
        fs.symlinkSync(path.join(owner, target), path.join(owner, relative), 'junction');
        return { path: relative, target, resolvedTarget: fs.realpathSync(path.join(owner, relative)), cloneOwned: true };
      });
      const entries = publicEntriesFor(owner); save(owner, 'browser-import-map.json', { imports: entries.imports });
      const buildReceipt = { kind: 'provided-successful-build-record', exitCode: 0, expectedCommand: ['node','tools/build.mjs'], commandObserved: false,
        independentCompilation: false, preparationRuntime, files: rows.filter(row => row.category === 'build-evidence').map(copiedIdentity),
        boundary: 'The supplied raw log and exit record are bound to this copy. Their build runtime and execution were not observed; copying does not compile or prove source-to-emission equivalence.' };
      save(owner, 'evidence/provided-build-receipt.json', buildReceipt);
      fs.writeFileSync(path.join(owner, 'SNAPSHOT.md'), canonicalTextBytes('# Frozen built SDK snapshot\n\nThis independent raw copy binds provided prior successful build records. It does not independently compile sources, verify source-to-emission equivalence, or claim a committed, reviewed or merged state. Baseline and candidate are recipe positions only.\n\nThe snapshot contains the three core SDK packages, their sources, emissions, manifests/configuration and all installed original robust-predicates 3.0.3 files. It is not a full monorepo installation or standalone build recipe. Preserve these bytes; hash binding is not operating-system immutability.\n'), { flag: 'wx' });
      const byTarget = new Map(rows.map(row => [row.target, row]));
      const graph = await collectPublicGraph(owner, item => {
        const row = byTarget.get(ownerRelativePath(owner, item.path));
        requireValue(row?.bytes === item.bytes && row.sha256 === item.sha256, 'PREPARE_GRAPH_MEMBER');
      });
      const registry = await captureRegistry({ repository: owner, graph, map: chosenMap('baseline') });
      requireValue((await rereadRegistry(registry)).accepted, 'PREPARE_REGISTRY_CHANGED');
      const generated = ['SNAPSHOT.md','browser-import-map.json','evidence/provided-build-receipt.json'].map(file => fingerprintFile(owner, file));
      const files = rows.map(({ raw, ...row }) => row);
      verifySnapshotMembership(owner, files, generated, links, false);
      const counts = Object.fromEntries([...new Set(rows.map(row => row.category))].map(category => [category, rows.filter(row => row.category === category).length]));
      const manifest = { schemaVersion: 1, role: 'built-sdk', status: 'FROZEN_BUILT_SDK_SNAPSHOT', createdAtUtc: new Date().toISOString(), owner,
        inputRoot: roots[role], preparationRuntime, buildReceipt,
        dependency: { name: 'robust-predicates', version: '3.0.3', originalOwner: captured[role].dependency, copiedFiles: depRows(role).length, pairedRawMatch: true },
        counts, files, generated, links, publicEntries: entries.publicEntries,
        graph: { modules: graph.modules.size, bytes: graph.totalBytes, registrySourceAndConsumersVerified: true },
        checks: { originalMembershipStable: true, originalRawBytesStable: true, copyRawBytesVerified: true, originalFileAliasesAbsent: true,
          cloneLinkTargetsVerified: true, noExtraCopiedFiles: true }, limits: result.limits };
      stableOriginals(); save(owner, 'manifest.json', manifest); verifyBuiltSnapshot(owner, manifest);
      result.snapshots.push({ role, owner, counts, manifest: fingerprintFile(owner, 'manifest.json') });
    }
    stableOriginals();
    for (const row of result.snapshots) {
      const manifest = JSON.parse(strictText(readPinned(row.owner, row.manifest), 'MANIFEST_UTF8')); verifyBuiltSnapshot(row.owner, manifest);
    }
    const recipe = createFixedRecipe(...result.snapshots.map(row => ({ root: row.owner, manifest: row.manifest })));
    save(output, 'recipe.json', recipe); result.recipe = fingerprintFile(output, 'recipe.json'); loadRecipe(path.join(output, 'recipe.json'));
    stableOriginals();
    for (const row of result.snapshots) verifyBuiltSnapshot(row.owner, JSON.parse(strictText(readPinned(row.owner, row.manifest), 'MANIFEST_UTF8')));
    readPinned(output, result.recipe); result.status = 'PREPARED';
  } catch (error) { result.failure = fault(error); }
  save(output, 'preparation.json', result);
  const summary = { schema: 'egret.incremental-preparation-public-summary/1', status: result.status, snapshots: result.snapshots.map(row => ({
    role: row.role, counts: row.counts, manifest: row.manifest })), recipe: result.recipe ?? null, failurePresent: !!result.failure, limits: result.limits };
  save(output, 'public-summary.json', summary);
  console.log(JSON.stringify({ status: result.status, snapshots: result.snapshots.length, summary: 'public-summary.json' }));
  process.exitCode = result.status === 'PREPARED' ? 0 : 1;
}

async function dispatch(argv) {
  requireValue(process.platform==='win32'&&process.arch==='x64'&&process.version==='v26.7.0'&&samePhysicalPath(process.execPath,fs.realpathSync(NODE))&&process.execArgv.length===0,'PINNED_NODE');
  for(const [key,value] of Object.entries(process.env))requireValue(!/^(NODE_OPTIONS|NODE_PATH)$/i.test(key)||!value,'NODE_ENVIRONMENT');
  if(argv[0]==='--prepare')return prepareSnapshots(prepareOptions(argv));
  if(argv.length===10&&argv.includes('--repository'))return main(options(argv));
  if(argv.length===4&&argv[0]==='--trial'&&argv[2]==='--trial-sha256') {
    const file=argv[1];requireValue(path.isAbsolute(file)&&/^[a-f0-9]{64}$/.test(argv[3]),'TRIAL_INPUT');
    const pin=fingerprintFile(path.dirname(file),path.basename(file));requireValue(pin.sha256===argv[3]&&pin.bytes<1048576,'TRIAL_INPUT_PIN');
    const descriptor=JSON.parse(readPinned(path.dirname(file),pin));fields(descriptor,['schema','trial','recipe','recipePin','playwright','powershell','output'],'TRIAL_FIELDS');
    requireValue(descriptor.schema==='egret.incremental-native-trial/3','TRIAL_SCHEMA');
    const loaded=loadRecipe(descriptor.recipe);requireValue(sameJson(loaded.pin,descriptor.recipePin),'TRIAL_RECIPE_PIN');
    requireValue(buildTrialSchedule(descriptor.trial.mode).some(x=>sameJson(x,descriptor.trial)),'TRIAL_SCHEDULE');
    return main({'--mode':descriptor.trial.mode,'--repository':loaded.recipe[descriptor.trial.role].root,'--playwright':descriptor.playwright,'--powershell':descriptor.powershell,'--output':descriptor.output},{...descriptor,loaded});
  }
  requireValue(argv.length===14,'FORMAL_CLI');const args={};
  for(let i=0;i<argv.length;i+=2){requireValue(['--baseline','--candidate','--recipe','--playwright','--powershell','--mode','--output'].includes(argv[i])&&!Object.hasOwn(args,argv[i]),'FORMAL_CLI');args[argv[i]]=argv[i+1];}
  for(const key of ['--baseline','--candidate','--recipe','--playwright','--powershell','--output'])requireValue(path.isAbsolute(args[key]),'FORMAL_ABSOLUTE');
  requireValue(MODES.includes(args['--mode']),'MODE');return runBatch(args);
}

if (process.argv[1] && samePhysicalPath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) dispatch(process.argv.slice(2)).catch(error => { console.error(JSON.stringify({status:'INCOMPLETE',failurePresent:true,detail:'No completed trial; local receipts, when created, retain details.'})); process.exitCode=1; });
