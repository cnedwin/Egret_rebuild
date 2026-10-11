import { verifyPixels, POSITIVE_FRAMES, NEGATIVES } from './oracle.mjs';
import { verifyCompositionPixels, COMPOSITION_BASELINES, COMPOSITION_CONTROL } from './public-composition-oracle.mjs';

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
  const model = (x, y) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
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
function pinNode(node, x = 0, y = 0, scale = 1) {
  Object.assign(node, { x, y, scaleX: scale, scaleY: scale, rotation: 0, alpha: 1, visible: true, clipRect: undefined });
  return node;
}
async function createPublicComposition(api, engine, mode, deadline) {
  const scope = engine.createScope(), stage = pinNode(engine.stage);
  const red = api.createMeshGeometry3D({ positions: [-0.5,0.5,-3, 0.5,0.5,-3, 0.5,-0.5,-3, -0.5,-0.5,-3],
    colors: [1,0,0, 1,0,0, 1,0,0, 1,0,0], indices: [0,1,2, 0,2,3] });
  const blue = api.createMeshGeometry3D({ positions: [-0.75,0.75,-7, 0.75,0.75,-7, 0.75,-0.75,-7, -0.75,-0.75,-7],
    colors: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2, 0,2,3] });
  const scene = api.createSceneFrame3D({ projection, draws: [{ geometry: red, modelView: identity }, { geometry: blue, modelView: identity }] });
  if (!api.isMeshGeometry3D(red) || !api.isMeshGeometry3D(blue) || !api.isSceneFrame3D(scene)) throw Error('PUBLIC_COMPOSITION_AUTHENTICITY_INVALID');
  const white = scope.use(pinNode(new api.Sprite()));
  white.graphics.beginFill(16777215, 1).drawRect(20, 20, 24, 24).endFill(); stage.addChild(white);
  const image = api.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array([255,0,255,255, 255,0,255,255, 255,0,255,255, 255,0,255,255]) });
  const texture = api.createTexture(image, { x: 0, y: 0, width: 2, height: 2 });
  const type = api.createAssetType('S3D1-A1 opaque magenta', api.isTexture);
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  const lease = scope.use(await bounded(observed(engine.assets.acquire(api.createAssetRef(type, 'S3D1-A1-magenta'), { signal: scope.signal })), deadline, 'composition-image-lease'));
  const bitmap = scope.use(pinNode(new api.Bitmap(lease), mode === 'S1' ? 28 : 0, mode === 'S1' ? 28 : 0, 4));
  let parent;
  if (mode === 'S1') stage.addChild(bitmap);
  else {
    parent = scope.use(pinNode(new api.Sprite(), 28, 28));
    // SN1's sole input mutation is omission of this parent's local clip.
    if (mode !== 'SN1') parent.clipRect = { x: 0, y: 0, width: 4, height: 8 };
    parent.addChild(bitmap); stage.addChild(parent);
  }
  const green = scope.use(pinNode(new api.Sprite()));
  green.graphics.beginFill(65280, 1).drawRect(30, 30, 4, 4).endFill(); stage.addChild(green);
  const overlay = engine.captureFrame({ width: 64, height: 64, clearColor: 0, clearAlpha: 1 });
  const nodeState = node => ({ x: node.x, y: node.y, scaleX: node.scaleX, scaleY: node.scaleY, rotation: node.rotation,
    alpha: node.alpha, visible: node.visible, clipRect: node.clipRect ?? null });
  return { scene, overlay, scope, nodes: [stage, white, ...(parent ? [parent] : []), bitmap, green], texture, lease,
    authoring: { stage: nodeState(stage), white: nodeState(white), bitmap: nodeState(bitmap), parent: parent ? nodeState(parent) : null,
      green: nodeState(green), childOrder: mode === 'S1' ? ['white', 'bitmap', 'green'] : ['white', 'parent', 'green'],
      parentChildren: parent ? ['bitmap'] : [], image: { width: 2, height: 2, sourceRect: { x: 0, y: 0, width: 2, height: 2 },
        rgba: [255,0,255,255, 255,0,255,255, 255,0,255,255, 255,0,255,255] },
      rectangles: [{ x: 20, y: 20, width: 24, height: 24, color: 16777215, alpha: 1 }, { x: 30, y: 30, width: 4, height: 4, color: 65280, alpha: 1 }],
      geometryOrder: ['red', 'blue'], projection, modelView: identity,
      geometry: [red, blue].map(value => ({ positions: value.positions, colors: value.colors, indices: value.indices })),
      cpuLogicalBytes: scene.cpuLogicalBytes, sceneBytes: scene.sceneBytes, uniformBytes: scene.uniformBytes },
    captured: { frameId: overlay.frameId, width: overlay.width, height: overlay.height, clearColor: overlay.clearColor,
      clearAlpha: overlay.clearAlpha, commands: overlay.commands, imageCount: overlay.images?.length ?? 0 } };
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
    nativeQueue: { submitAttempts: 0, observerInstalled: false },
    cleanup: { hostClosed: false, hostSafe: false, deviceDestroyed: false, lossSettled: false, failures: [] } };
  let device, acquisition, host, engine, engineAcquisition, composition, canvas, nativeQueue, submitDescriptor, lost, lostInfo, intentionalDestroy = false, uncaptured;
  const fail = error => { if (!report.failure) report.failure = fault(error); };
  const record = (list, value) => { if (list.length >= 128) { report.observationOverflow = true; return; } list.push(value); };
  try {
    const supplemental = [...COMPOSITION_BASELINES, COMPOSITION_CONTROL.id].includes(mode);
    if (!['baseline', ...NEGATIVES.map(value => value.id), ...COMPOSITION_BASELINES, COMPOSITION_CONTROL.id].includes(mode)) throw Error('MODE_INVALID');
    report.stage = supplemental ? 'public-engine-composition' : 'original-b1';
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
    nativeQueue = device.queue; submitDescriptor = Object.getOwnPropertyDescriptor(nativeQueue, 'submit');
    const nativeSubmit = nativeQueue.submit;
    Object.defineProperty(nativeQueue, 'submit', { configurable: true, writable: true,
      value(...arguments_) { report.nativeQueue.submitAttempts++; return Reflect.apply(nativeSubmit, nativeQueue, arguments_); } });
    report.nativeQueue.observerInstalled = true;
    const limits = {}; for (const key of Object.keys(requiredLimits)) limits[key] = device.limits[key] ?? null;
    report.preflight.limits = limits;
    const missing = Object.entries(requiredLimits).filter(([key, minimum]) => !Number.isSafeInteger(limits[key]) || limits[key] < minimum).map(([key, minimum]) => ({ key, minimum, actual: limits[key] }));
    if (missing.length) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'REQUIRED_LIMITS_UNSUPPORTED'; report.preflight.missing = missing; return report; }
    const format = navigator.gpu.getPreferredCanvasFormat(); report.preflight.format = format;
    if (!['rgba8unorm', 'bgra8unorm'].includes(format)) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'PREFERRED_FORMAT_UNSUPPORTED'; return report; }
    canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; document.body.append(canvas);
    if (!canvas.getContext('webgpu')) { report.status = 'UNSUPPORTED'; report.preflight.reason = 'FRESH_CONTEXT_NULL'; return report; }
    const base = NEGATIVES.some(value => value.id === mode) ? `/copy/${mode}` : '';
    const [scene, sceneHost, egret, shader] = await bounded(observed(Promise.all([
      import('@egret/engine/scene3d'), import('@egret/engine/webgpu/scene3d'), import('@egret/engine'),
      // Fixed private diagnostic only: the source-bound mesh shader constructor drives native WGSL/N4 probes.
      import(`${base}/packages/engine/dist/web/webgpuMeshPass.js`),
    ])), deadline, 'modules');
    const api = { ...scene, ...egret };
    const fixtures = supplemental ? null : createFixtures(api);
    report.compilation = await compilationProbe(shader, device, format, deadline);
    const compileNegative = mode === 'N4';
    if (compileNegative) {
      if (report.compilation.synchronous || report.compilation.pipeline?.status !== 'rejected' || report.compilation.pipeline.error.reason !== 'validation'
          || !report.compilation.messages.some(message => message.type === 'error') || report.compilation.moduleCount !== 1
          || report.compilation.scopes.length !== 3 || report.compilation.scopes.some(scope => scope.kind !== 'validation' && scope.error)
          || report.compilation.peerFailures.some(error => error.reason !== 'validation')) throw Error('NATIVE_WGSL_COUNTEREXAMPLE_NOT_REJECTED');
    } else if (report.compilation.synchronous || report.compilation.peerFailures.length || report.compilation.moduleCount !== 1
        || report.compilation.scopes.length !== 3 || report.compilation.pipeline?.status !== 'fulfilled' || report.compilation.messages.some(message => message.type === 'error')
        || report.compilation.scopes.some(scope => scope.error)) throw Error('NATIVE_MESH_COMPILATION_FAILED');
    host = sceneHost.createSceneWebGPUHost({ canvas, device: { kind: 'borrow', device }, pixelRatio: 1, enableReadback: true,
      onDiagnostic: diagnostic => record(report.diagnostics, { code: diagnostic.code, phase: diagnostic.phase, serial: diagnostic.serial }) });
    if (compileNegative) {
      let rejected; try { await bounded(observed(host.start()), deadline, 'host-negative-start'); } catch (error) { rejected = fault(error); }
      const status = host.getStatus(); report.hostStartup = { rejected, status: { state: status.state, firstFailure: status.firstFailure ? { code: status.firstFailure.code, phase: status.firstFailure.phase } : null } };
      if (!rejected || status.firstFailure?.phase !== 'startup' || !['WEBGPU_VALIDATION', 'WEBGPU_START_FAILED'].includes(status.firstFailure.code)
          || rejected.code !== status.firstFailure.code || lostInfo
          || report.diagnostics.some(value => value.phase !== 'startup' || !['WEBGPU_VALIDATION', 'WEBGPU_START_FAILED'].includes(value.code))) throw Error('NATIVE_HOST_COMPILE_FAILURE_NOT_OBSERVED');
      if (report.nativeQueue.submitAttempts !== 0 || status.lastSerial !== 0) throw Error('N4_NATIVE_QUEUE_SUBMISSION_OBSERVED');
      report.status = 'EXPECTED_COMPILATION_FAILURE'; return report;
    }
    if (supplemental) {
      engineAcquisition = observed(api.createEngine({ host }).then(value => { engine = value; return value; }));
      await bounded(engineAcquisition, deadline, 'composition-engine-start');
      composition = await createPublicComposition(api, engine, mode, deadline);
      report.authoring = composition.authoring; report.capturedOverlay = composition.captured;
      report.controlBinding = mode === 'SN1' ? { baseline: 'S2', changedInput: 'parent.clipRect', before: { x: 0, y: 0, width: 4, height: 8 },
        after: null, assertion: COMPOSITION_CONTROL.assertion, x: 33, y: 28, expected: COMPOSITION_CONTROL.expected, actual: COMPOSITION_CONTROL.actual } : null;
    } else await bounded(observed(host.start()), deadline, 'host-start');
    report.hostStarted = true;
    const negative = supplemental ? (mode === 'SN1' ? COMPOSITION_CONTROL : null) : NEGATIVES.find(value => value.id === mode);
    const selected = supplemental ? [mode === 'SN1' ? 'S2' : mode] : negative ? [negative.frame] : POSITIVE_FRAMES;
    for (const name of selected) {
      const fixture = supplemental ? composition : fixtures[name], frame = { name, frameId: fixture.overlay.frameId, rendered: false, readback: null, checks: null, assertion: null };
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
      try { frame.checks = supplemental ? verifyCompositionPixels(readback, name, negative?.assertion ?? null) : verifyPixels(readback, name, negative?.assertion ?? null); }
      catch (error) {
        frame.assertion = fault(error);
        if (!negative || error.name !== (supplemental ? 'CompositionPixelAssertion' : 'PixelAssertion') || error.assertion !== negative.assertion
            || error.actual.length !== 4 || error.actual.some((value, index) => value !== negative.actual[index])) throw error;
        report.status = 'EXPECTED_PIXEL_FAILURE';
      }
      if (negative && report.status !== 'EXPECTED_PIXEL_FAILURE') throw Error('NAMED_NATIVE_COUNTEREXAMPLE_PASSED');
    }
    if (!negative) report.status = 'PASSED';
    if (report.diagnostics.length || report.uncaptured.length || lostInfo) throw Error('UNEXPECTED_NATIVE_DEVICE_ERROR');
    if (supplemental) report.screenshot = await bounded(observed(window.b1CaptureSupplementaryScreenshot(mode)), deadline, 'supplementary-screenshot');
  } catch (error) { fail(error); report.status = error.message?.startsWith('INCOMPLETE:') ? 'INCOMPLETE' : 'FAIL'; }
  finally {
    const cleanupDeadline = Math.min(Date.now() + 10000, deadline + 10000);
    if (acquisition && !device) {
      try { await bounded(acquisition, cleanupDeadline, 'late-device-acquisition'); }
      catch (error) { report.cleanup.failures.push(fault(error)); }
    }
    if (engineAcquisition && !engine) {
      try { await bounded(engineAcquisition, cleanupDeadline, 'late-engine-acquisition'); }
      catch (error) { report.cleanup.failures.push(fault(error)); }
    }
    if (host) {
      try {
        if (engine) {
          await bounded(observed(engine.dispose()), cleanupDeadline, 'composition-engine-dispose');
          let closureCode;
          try { engine.captureFrame({ width: 64, height: 64, clearColor: 0, clearAlpha: 1 }); }
          catch (error) { closureCode = error?.code; }
          report.cleanup.engineClosed = closureCode === 'ENGINE_CLOSED'; report.cleanup.engineClosureCode = closureCode ?? null;
          if (composition) {
            report.cleanup.scopeClosed = composition.scope.state === 'closed';
            report.cleanup.nodesDisposed = composition.nodes.every(node => node.isDisposed);
            report.cleanup.textureDisposed = composition.texture.isDisposed;
            if (!report.cleanup.engineClosed || !report.cleanup.scopeClosed || !report.cleanup.nodesDisposed || !report.cleanup.textureDisposed) throw Error('ENGINE_COMPOSITION_CLEANUP_UNSAFE');
          }
        } else await bounded(observed(host.close()), cleanupDeadline, 'host-close');
        const status = host.getStatus(); report.cleanup.hostClosed = status.state === 'closed'; report.cleanup.hostSafe = status.cleanupOutcome === 'safe';
        const sceneStatus = host.getSceneStatus(); report.cleanup.pending = { scene: sceneStatus.pendingSceneBytes, uniform: sceneStatus.pendingUniformBytes, depth: sceneStatus.pendingDepthBytes, frames: status.pendingFrames, upload: status.pendingUploadBytes, readback: status.pendingReadbackBytes };
        if (!report.cleanup.hostClosed || !report.cleanup.hostSafe || Object.values(report.cleanup.pending).some(value => value !== 0)) throw Error('HOST_CLOSE_OR_LEDGER_UNSAFE');
      } catch (error) { report.cleanup.failures.push(fault(error)); }
    }
    if (device) {
      if (report.nativeQueue.observerInstalled) {
        try {
          if (submitDescriptor) Object.defineProperty(nativeQueue, 'submit', submitDescriptor); else delete nativeQueue.submit;
          report.cleanup.queueObserverRestored = submitDescriptor ? Object.getOwnPropertyDescriptor(nativeQueue, 'submit').value === submitDescriptor.value
            : !Object.hasOwn(nativeQueue, 'submit');
          if (!report.cleanup.queueObserverRestored) throw Error('NATIVE_QUEUE_OBSERVER_NOT_RESTORED');
        } catch (error) { report.cleanup.failures.push(fault(error)); }
      }
      try { intentionalDestroy = true; device.destroy(); report.cleanup.deviceDestroyed = true;
        const loss = await bounded(lost, cleanupDeadline, 'owned-device-loss'); report.cleanup.loss = loss; report.cleanup.lossSettled = true;
        if (loss.reason !== 'destroyed' || !loss.intentionalDestroy) throw Error('DEVICE_LOSS_NOT_INTENTIONAL');
      } catch (error) { report.cleanup.failures.push(fault(error)); }
      if (uncaptured) device.removeEventListener('uncapturederror', uncaptured);
    }
    if (canvas) {
      canvas.width = 0; canvas.height = 0; canvas.remove();
      report.cleanup.canvasRetired = !canvas.isConnected && canvas.width === 0 && canvas.height === 0;
    }
    if (report.status === 'EXPECTED_COMPILATION_FAILURE' && report.diagnostics.some(value => value.phase !== 'startup' || !['WEBGPU_VALIDATION', 'WEBGPU_START_FAILED'].includes(value.code))) {
      report.cleanup.failures.push({ message: 'Unexpected diagnostic in compilation counterexample' });
    }
    if (report.cleanup.failures.length || report.uncaptured.length || report.observationOverflow) report.status = 'INCOMPLETE';
  }
  return report;
}
