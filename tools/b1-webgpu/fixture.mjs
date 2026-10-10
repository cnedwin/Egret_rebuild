import { verifyPixels, POSITIVE_FRAMES, NEGATIVES } from './oracle.mjs';

const identity = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const affine = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const noClips = Object.freeze([]);
const projection = Object.freeze({ kind: 'orthographic', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 9 });
const perspective = Object.freeze({ kind: 'perspective', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 5 });
function fault(error) {
  return { name: typeof error?.name === 'string' ? error.name : 'Unknown', code: typeof error?.code === 'string' ? error.code : null,
    message: typeof error?.message === 'string' ? error.message.slice(0, 12000) : 'Non-error rejection',
    reason: typeof error?.reason === 'string' ? error.reason : null,
    assertion: error?.assertion ?? null, x: error?.x ?? null, y: error?.y ?? null, expected: error?.expected ?? null, actual: error?.actual ?? null };
}
// Observe every native Promise immediately, including peers that outlive a failed call.
function observed(promise) { promise.catch(() => {}); return promise; }
async function bounded(promise, deadline, label) {
  observed(promise); const remaining = Math.min(10000, deadline - Date.now());
  if (remaining <= 0) throw Error(`INCOMPLETE:${label}:deadline`);
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`INCOMPLETE:${label}:timeout`)), remaining); })]); }
  finally { clearTimeout(timer); }
}
async function digest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(value => value.toString(16).padStart(2, '0')).join(''); }
function geometry(factory, extent, z, rgb) {
  return factory({ positions: [-extent, extent, z, extent, extent, z, extent, -extent, z, -extent, -extent, z],
    colors: [...rgb, ...rgb, ...rgb, ...rgb], indices: [0, 1, 2, 0, 2, 3] });
}
function rect(x, y, size, color) { return Object.freeze({ kind: 'rect', matrix: affine, rect: Object.freeze({ x, y, width: size, height: size }), color, alpha: 1, clips: noClips }); }
function createFixtures(api) {
  const blue = geometry(api.createMeshGeometry3D, .75, -7, [0, 0, 1]);
  const red = geometry(api.createMeshGeometry3D, .5, -3, [1, 0, 0]);
  const green = geometry(api.createMeshGeometry3D, .25, -3, [0, 1, 0]);
  const behind = geometry(api.createMeshGeometry3D, .5, 2, [1, 0, 0]);
  const model = (x, y) => api.createMatrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1]);
  const draw = (value, modelView = identity) => ({ geometry: value, modelView });
  const scene = (draws, camera = projection) => api.createSceneFrame3D({ projection: camera, draws });
  const nearFirst = scene([draw(red), draw(blue)]);
  const image = api.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array([255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255]) });
  const imageCommand = Object.freeze({ kind: 'image', matrix: affine, rect: Object.freeze({ x: 28, y: 28, width: 8, height: 8 }), alpha: 1, clips: noClips, imageIndex: 0, sourceRect: Object.freeze({ x: 0, y: 0, width: 2, height: 2 }) });
  const white = rect(20, 20, 24, 0xffffff), last = rect(30, 30, 4, 0x00ff00);
  const overlay = (frameId, commands = [], images) => Object.freeze({ frameId, width: 64, height: 64, clearColor: 0, clearAlpha: 1, commands: Object.freeze(commands), ...(images ? { images: Object.freeze(images) } : {}) });
  return Object.freeze({
    F1: { scene: nearFirst, overlay: overlay(1) }, F2: { scene: scene([draw(blue), draw(red)]), overlay: overlay(2) },
    F3: { scene: scene([draw(green, model(-.5, .5)), draw(green, model(.5, -.5))]), overlay: overlay(3) },
    F4: { scene: nearFirst, overlay: overlay(4, [white, imageCommand, last], [image]) },
    F5: { scene: nearFirst, overlay: overlay(5, [imageCommand, white, last], [image]) },
    F6: { scene: scene([]), overlay: overlay(6) }, F7: { scene: scene([draw(behind)], perspective), overlay: overlay(7) },
  });
}
const requiredLimits = Object.freeze({ maxTextureDimension2D: 64, maxBufferSize: 16384, maxVertexBuffers: 1, maxVertexAttributes: 2,
  maxVertexBufferArrayStride: 24, maxColorAttachments: 1, maxColorAttachmentBytesPerSample: 4, maxBindGroups: 1,
  maxBindingsPerBindGroup: 3, maxSampledTexturesPerShaderStage: 1, maxSamplersPerShaderStage: 1,
  maxUniformBuffersPerShaderStage: 1, maxUniformBufferBindingSize: 64, maxBindGroupsPlusVertexBuffers: 2, maxInterStageShaderVariables: 1 });
async function compilationProbe(api, device, format, deadline) {
  const result = { shaderText: null, shaderSHA256: null, messages: [], pipeline: null, scopes: [], synchronous: null };
  const started = [], modules = []; let operation;
  for (const kind of ['internal', 'out-of-memory', 'validation']) device.pushErrorScope(kind);
  try {
    operation = api.createWebGPUMeshPipeline(descriptor => {
      result.shaderText = descriptor.code; const module = device.createShaderModule(descriptor); modules.push(module);
      const info = observed(module.getCompilationInfo().then(value => { result.messages = value.messages.map(message => ({ type: message.type, message: message.message.slice(0, 12000), lineNum: message.lineNum, linePos: message.linePos, offset: message.offset, length: message.length })); }));
      started.push(info); return module;
    }, descriptor => { const pipeline = observed(device.createRenderPipelineAsync(descriptor)); started.push(pipeline); return pipeline; }, format);
    observed(operation);
  } catch (error) { result.synchronous = fault(error); }
  finally {
    for (const kind of ['validation', 'out-of-memory', 'internal']) {
      const scope = observed(device.popErrorScope().then(error => { result.scopes.push({ kind, error: error ? fault(error) : null }); })); started.push(scope);
    }
  }
  if (operation) started.push(observed(operation.then(() => { result.pipeline = { status: 'fulfilled' }; }, error => { result.pipeline = { status: 'rejected', error: fault(error) }; })));
  const outcomes = await bounded(observed(Promise.allSettled(started)), deadline, 'compile-drain');
  result.peerFailures = outcomes.filter(value => value.status === 'rejected').map(value => fault(value.reason));
  result.moduleCount = modules.length;
  if (typeof result.shaderText === 'string') result.shaderSHA256 = await digest(result.shaderText);
  return result;
}
export async function runWindow({ mode, deadline }) {
  const report = { mode, status: 'INCOMPLETE', preflight: {}, compilation: null, deviceAcquired: false, hostStarted: false, frames: [], diagnostics: [], uncaptured: [], failure: null,
    cleanup: { hostClosed: false, hostSafe: false, deviceDestroyed: false, lossSettled: false, failures: [] } };
  let device, acquisition, host, lost, lostInfo, intentionalDestroy = false, uncaptured;
  const fail = error => { if (!report.failure) report.failure = fault(error); };
  const record = (list, value) => { if (list.length >= 128) { report.observationOverflow = true; return; } list.push(value); };
  try {
    if (!['baseline', ...NEGATIVES.map(value => value.id)].includes(mode)) throw Error('MODE_INVALID');
    if (!navigator.gpu) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'WEBGPU_API_ABSENT'; return report; }
    const adapter = await bounded(observed(navigator.gpu.requestAdapter()), deadline, 'adapter');
    if (!adapter) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'ADAPTER_NULL'; return report; }
    report.preflight.adapterInfo = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null;
    // Assign ownership in the acquisition continuation, even after a timeout.
    acquisition = observed(adapter.requestDevice().then(value => {
      device = value; report.deviceAcquired = true;
      lost = observed(device.lost.then(info => { lostInfo = { reason: info.reason, message: info.message, intentionalDestroy }; return lostInfo; }));
      uncaptured = event => record(report.uncaptured, fault(event.error)); device.addEventListener('uncapturederror', uncaptured);
      return device;
    }));
    await bounded(acquisition, deadline, 'device');
    const limits = {}; for (const key of Object.keys(requiredLimits)) limits[key] = device.limits[key] ?? null;
    report.preflight.limits = limits;
    const missing = Object.entries(requiredLimits).filter(([key, minimum]) => !Number.isSafeInteger(limits[key]) || limits[key] < minimum).map(([key, minimum]) => ({ key, minimum, actual: limits[key] }));
    if (missing.length) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'REQUIRED_LIMITS_UNSUPPORTED'; report.preflight.missing = missing; return report; }
    const format = navigator.gpu.getPreferredCanvasFormat(); report.preflight.format = format;
    if (!['rgba8unorm', 'bgra8unorm'].includes(format)) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'PREFERRED_FORMAT_UNSUPPORTED'; return report; }
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; document.body.append(canvas);
    if (!canvas.getContext('webgpu')) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'FRESH_CONTEXT_NULL'; return report; }
    const base = mode === 'baseline' ? '' : `/copy/${mode}`;
    const [b1, mesh, matrix, shader, contracts] = await bounded(observed(Promise.all([
      import(`${base}/packages/engine/dist/web/b1.js`), import(`${base}/packages/engine/dist/rendering/meshGeometry3D.js`),
      import(`${base}/packages/engine/dist/rendering/matrix4.js`), import(`${base}/packages/engine/dist/web/webgpuMeshPass.js`),
      import('/packages/contracts/dist/ImageData2D.js'),
    ])), deadline, 'modules');
    const api = { ...mesh, ...matrix, ...shader, ...contracts, createSceneFrame3D: b1.getBuiltinB1Protocol().createSceneFrame3D };
    const fixtures = createFixtures(api);
    report.compilation = await compilationProbe(api, device, format, deadline);
    const compileNegative = mode === 'N4';
    if (compileNegative) {
      if (report.compilation.synchronous || report.compilation.pipeline?.status !== 'rejected' || report.compilation.pipeline.error.reason !== 'validation'
          || !report.compilation.messages.some(message => message.type === 'error') || report.compilation.moduleCount !== 1
          || report.compilation.scopes.length !== 3 || report.compilation.scopes.some(scope => scope.kind !== 'validation' && scope.error)
          || report.compilation.peerFailures.some(error => error.reason !== 'validation')) throw Error('NATIVE_WGSL_COUNTEREXAMPLE_NOT_REJECTED');
    } else if (report.compilation.synchronous || report.compilation.peerFailures.length || report.compilation.moduleCount !== 1
        || report.compilation.scopes.length !== 3 || report.compilation.pipeline?.status !== 'fulfilled' || report.compilation.messages.some(message => message.type === 'error')
        || report.compilation.scopes.some(scope => scope.error)) throw Error('NATIVE_MESH_COMPILATION_FAILED');
    host = b1.createB1WebGPUHost({ canvas, device: { kind: 'borrow', device }, pixelRatio: 1, enableReadback: true,
      onDiagnostic: diagnostic => record(report.diagnostics, { code: diagnostic.code, phase: diagnostic.phase, serial: diagnostic.serial }) });
    if (compileNegative) {
      let rejected; try { await bounded(observed(host.start()), deadline, 'host-negative-start'); } catch (error) { rejected = fault(error); }
      const status = host.getStatus(); report.hostStartup = { rejected, status: { state: status.state, firstFailure: status.firstFailure ? { code: status.firstFailure.code, phase: status.firstFailure.phase } : null } };
      if (!rejected || status.firstFailure?.phase !== 'startup' || !['WEBGPU_VALIDATION', 'WEBGPU_START_FAILED'].includes(status.firstFailure.code)
          || rejected.code !== status.firstFailure.code || lostInfo
          || report.diagnostics.some(value => value.phase !== 'startup' || !['WEBGPU_VALIDATION', 'WEBGPU_START_FAILED'].includes(value.code))) throw Error('NATIVE_HOST_COMPILE_FAILURE_NOT_OBSERVED');
      report.status = 'EXPECTED_COMPILATION_FAILURE'; return report;
    }
    await bounded(observed(host.start()), deadline, 'host-start'); report.hostStarted = true;
    const negative = NEGATIVES.find(value => value.id === mode), selected = negative ? [negative.frame] : POSITIVE_FRAMES;
    for (const name of selected) {
      const fixture = fixtures[name], frame = { name, frameId: fixture.overlay.frameId, rendered: false, readback: null, checks: null, assertion: null };
      report.frames.push(frame);
      const ticket = observed(host.requestReadback());
      const returned = host.renderSceneFrame(fixture.scene, fixture.overlay); frame.rendered = true;
      if (returned !== undefined) throw Error('RENDER_RETURN_INVALID');
      const idle = observed(host.whenIdle());
      const [readback] = await bounded(observed(Promise.all([ticket, idle])), deadline, `frame-${name}`);
      frame.readback = { serial: readback.serial, frameId: readback.frameId, width: readback.width, height: readback.height, format: readback.format,
        sourceFormat: readback.sourceFormat, colorSpace: readback.colorSpace, alphaMode: readback.alphaMode, bytes: Array.from(readback.bytes) };
      if (readback.frameId !== fixture.overlay.frameId || readback.serial !== host.getStatus().lastSerial) throw Error('READBACK_FRAME_IDENTITY_INVALID');
      const sceneStatus = host.getSceneStatus(), status = host.getStatus();
      frame.pending = { scene: sceneStatus.pendingSceneBytes, uniform: sceneStatus.pendingUniformBytes, depth: sceneStatus.pendingDepthBytes,
        frames: status.pendingFrames, upload: status.pendingUploadBytes, readback: status.pendingReadbackBytes };
      if (Object.values(frame.pending).some(value => value !== 0) || status.firstFailure) throw Error('PENDING_LEDGER_NOT_RETIRED');
      try { frame.checks = verifyPixels(readback, name, negative?.assertion ?? null); }
      catch (error) {
        frame.assertion = fault(error);
        if (!negative || error.name !== 'PixelAssertion' || error.assertion !== negative.assertion
            || error.actual.length !== 4 || error.actual.some((value, index) => value !== negative.actual[index])) throw error;
        report.status = 'EXPECTED_PIXEL_FAILURE';
      }
      if (negative && report.status !== 'EXPECTED_PIXEL_FAILURE') throw Error('NAMED_NATIVE_COUNTEREXAMPLE_PASSED');
    }
    if (!negative) report.status = 'PASSED';
    if (report.diagnostics.length || report.uncaptured.length || lostInfo) throw Error('UNEXPECTED_NATIVE_DEVICE_ERROR');
  } catch (error) { fail(error); report.status = error.message?.startsWith('INCOMPLETE:') ? 'INCOMPLETE' : 'FAIL'; }
  finally {
    const cleanupDeadline = Math.min(Date.now() + 10000, deadline + 10000);
    if (acquisition && !device) {
      try { await bounded(acquisition, cleanupDeadline, 'late-device-acquisition'); }
      catch (error) { report.cleanup.failures.push(fault(error)); }
    }
    if (host) {
      try { await bounded(observed(host.close()), cleanupDeadline, 'host-close'); const status = host.getStatus(); report.cleanup.hostClosed = status.state === 'closed'; report.cleanup.hostSafe = status.cleanupOutcome === 'safe';
        const sceneStatus = host.getSceneStatus(); report.cleanup.pending = { scene: sceneStatus.pendingSceneBytes, uniform: sceneStatus.pendingUniformBytes, depth: sceneStatus.pendingDepthBytes, frames: status.pendingFrames, upload: status.pendingUploadBytes, readback: status.pendingReadbackBytes };
        if (!report.cleanup.hostClosed || !report.cleanup.hostSafe || Object.values(report.cleanup.pending).some(value => value !== 0)) throw Error('HOST_CLOSE_OR_LEDGER_UNSAFE');
      } catch (error) { report.cleanup.failures.push(fault(error)); }
    }
    if (device) {
      try { intentionalDestroy = true; device.destroy(); report.cleanup.deviceDestroyed = true;
        const loss = await bounded(lost, cleanupDeadline, 'owned-device-loss'); report.cleanup.loss = loss; report.cleanup.lossSettled = true;
        if (loss.reason !== 'destroyed' || !loss.intentionalDestroy) throw Error('DEVICE_LOSS_NOT_INTENTIONAL');
      } catch (error) { report.cleanup.failures.push(fault(error)); }
      if (uncaptured) device.removeEventListener('uncapturederror', uncaptured);
    }
    if (report.status === 'EXPECTED_COMPILATION_FAILURE' && report.diagnostics.some(value => value.phase !== 'startup' || !['WEBGPU_VALIDATION', 'WEBGPU_START_FAILED'].includes(value.code))) {
      report.cleanup.failures.push({ message: 'Unexpected diagnostic in compilation counterexample' });
    }
    if (report.cleanup.failures.length || report.uncaptured.length || report.observationOverflow) report.status = 'INCOMPLETE';
  }
  return report;
}
