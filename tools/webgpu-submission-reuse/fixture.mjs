// SPDX-License-Identifier: Apache-2.0
// The observer forwards native calls with their actual receivers and restores exact own descriptors.
export function installNativeObservers(device) {
  const counts = Object.fromEntries(['eligibleCreated', 'eligibleDestroyed', 'stagingCreated', 'stagingDestroyed',
    'stagingUnmapped', 'unknownCreated', 'depthCreated', 'depthDestroyed', 'imageCreated', 'imageDestroyed',
    'imageUploads', 'bindingsCreated', 'bufferWrites', 'submits', 'failedCalls'].map(key => [key, 0]));
  const restores = [], buffers = [], textures = [], writeIds = [], bufferIds = new WeakMap();
  function wrap(target, key, around) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key), original = target[key];
    if (typeof original !== 'function') throw Error('OBSERVER_METHOD:' + key);
    const restore = () => {
      if (descriptor) Object.defineProperty(target, key, descriptor); else if (!delete target[key]) throw Error('OBSERVER_DELETE:' + key);
      const after = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor ? !after || Reflect.ownKeys(descriptor).some(field => descriptor[field] !== after[field])
        || Reflect.ownKeys(descriptor).length !== Reflect.ownKeys(after).length : after !== undefined) throw Error('OBSERVER_RESTORE:' + key);
    };
    // Own the restoration before exposing the wrapper, including partial installation failures.
    restores.push(restore);
    Object.defineProperty(target, key, { configurable: true, writable: true, enumerable: descriptor?.enumerable ?? false,
      value: function (...args) {
        let result;
        try { result = Reflect.apply(original, this, args); } catch (error) { counts.failedCalls++; throw error; }
        around(args, result); return result;
      } });
  }
  function restore() {
    const failures = [];
    for (const undo of restores.reverse()) try { undo(); } catch (error) { failures.push(String(error.message)); }
    restores.length = 0;
    if (failures.length) throw Error(failures.join(';'));
  }
  try {
    wrap(device, 'createBuffer', ([descriptor], buffer) => {
      if (buffers.length >= 5000) throw Error('BUFFER_OBSERVATION_CAP');
      const category = [40, 24, 72].includes(descriptor.usage) ? 'eligible' : descriptor.usage === 9 ? 'staging' : 'unknown';
      const item = { id: buffers.length + 1, usage: descriptor.usage, size: descriptor.size, category, destroys: 0, unmaps: 0 };
      buffers.push(item); bufferIds.set(buffer, item.id); counts[category + 'Created']++;
      wrap(buffer, 'destroy', () => { item.destroys++; if (category !== 'unknown') counts[category + 'Destroyed']++; });
      if (category === 'staging') wrap(buffer, 'unmap', () => { item.unmaps++; counts.stagingUnmapped++; });
    });
    wrap(device, 'createTexture', ([descriptor], texture) => {
      if (textures.length >= 32) throw Error('TEXTURE_OBSERVATION_CAP');
      const category = descriptor.format === 'depth32float' ? 'depth' : descriptor.format === 'rgba8unorm' && descriptor.usage === 6 ? 'image' : 'unknown';
      if (category === 'unknown') throw Error('UNCLASSIFIED_NATIVE_TEXTURE');
      const item = { category, format: descriptor.format, usage: descriptor.usage, destroys: 0 };
      textures.push(item); counts[category + 'Created']++;
      wrap(texture, 'destroy', () => { item.destroys++; counts[category + 'Destroyed']++; });
    });
    wrap(device, 'createBindGroup', () => { counts.bindingsCreated++; });
    wrap(device.queue, 'writeTexture', () => { counts.imageUploads++; });
    wrap(device.queue, 'writeBuffer', ([buffer]) => {
      if (writeIds.length >= 10000) throw Error('WRITE_OBSERVATION_CAP');
      const id = bufferIds.get(buffer); if (id === undefined) throw Error('UNOBSERVED_NATIVE_BUFFER_WRITE');
      counts.bufferWrites++; writeIds.push(id);
    });
    wrap(device.queue, 'submit', () => { counts.submits++; });
  } catch (error) { try { restore(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'OBSERVER_INSTALL'); } throw error; }
  return { snapshot: () => ({ ...counts }), buffers, textures, writeIds, restore };
}
const fail = condition => { if (!condition) throw Error('NATIVE_SUBMISSION_INVARIANT'); };
const fault = error => ({ name: error?.name ?? 'Unknown', code: error?.code ?? null, message: String(error?.message ?? error).slice(0, 12000) });
const affine = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const identity = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function imageCommand(x, y, alpha = 1) {
  return Object.freeze({ kind: 'image', matrix: affine, rect: Object.freeze({ x, y, width: 8, height: 8 }),
    alpha, clips: Object.freeze([]), imageIndex: 0, sourceRect: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }) });
}
function ordinaryFrame(id, commands, image) {
  return Object.freeze({ frameId: id, width: 16, height: 16, clearColor: 0, clearAlpha: 1,
    commands: Object.freeze(commands), images: Object.freeze([image]) });
}
function pin(node, x = 0, y = 0, scale = 1) {
  Object.assign(node, { x, y, scaleX: scale, scaleY: scale, rotation: 0, alpha: 1, visible: true, clipRect: undefined }); return node;
}
function counters(host) {
  const status = host.getStatus(), scene = host.getSceneStatus?.(), textured = host.getTexturedStatus?.();
  const pending = { frames: status.pendingFrames, upload: status.pendingUploadBytes, readback: status.pendingReadbackBytes,
    scene: scene?.pendingSceneBytes ?? 0, uniform: scene?.pendingUniformBytes ?? 0, depth: scene?.pendingDepthBytes ?? 0,
    geometry: textured?.pendingGeometryBytes ?? 0 };
  return { state: status.state, cleanupOutcome: status.cleanupOutcome, lastSerial: status.lastSerial,
    firstFailure: status.firstFailure ? fault(status.firstFailure) : null, pending };
}
export async function runWindow({ id, control = null, deadline }) {
  const report = { id, control, status: 'INCOMPLETE', frames: [], diagnostics: [], uncaptured: [], failure: null,
    cleanup: { failures: [], hostSafe: false, deviceDestroyed: false, lossSettled: false, observersRestored: false } };
  globalThis.lastSubmissionReport = report;
  const pending = new Set(), acquisitions = [], textures = [], leases = [], refs = [], nodes = [];
  let device, host, engine, scope, canvas, observer, loss, lossInfo, destroyRequested = false, eventListener;
  const observe = promise => {
    pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise)); return promise;
  };
  async function bounded(promise, label, cleanup = false) {
    observe(promise); let timer;
    const remaining = Math.min(20000, deadline + (cleanup ? 10000 : 0) - Date.now());
    try { if (remaining <= 0) throw Error('INCOMPLETE:' + label + ':deadline');
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('INCOMPLETE:' + label + ':timeout')), remaining); })]);
    } finally { clearTimeout(timer); }
  }
  function acquire(promise, label, assign) {
    const item = { label, settled: false, promise: null };
    item.promise = observe(promise.then(value => { assign(value); item.settled = true; return value; }, error => { item.settled = true; throw error; }));
    acquisitions.push(item); return item.promise;
  }
  const event = (list, value) => { if (list.length < 128) list.push(value); else report.eventOverflow = true; };
  try {
    fail(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].includes(id) && (control === null || id === 'C1' && ['wrong-alpha', 'wrong-order'].includes(control)));
    if (!navigator.gpu) { report.status = 'UNSUPPORTED'; report.reason = 'WEBGPU_API_ABSENT'; return report; }
    const adapter = await bounded(observe(navigator.gpu.requestAdapter()), 'adapter');
    if (!adapter) { report.status = 'UNSUPPORTED'; report.reason = 'ADAPTER_NULL'; return report; }
    report.adapter = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
      device: adapter.info.device, description: adapter.info.description, isFallbackAdapter: adapter.info.isFallbackAdapter ?? null } : null;
    fail(report.adapter && ['vendor', 'architecture', 'device', 'description'].every(key => typeof report.adapter[key] === 'string'));
    await bounded(acquire(adapter.requestDevice(), 'device', value => {
      device = value;
      loss = observe(device.lost.then(info => { lossInfo = { reason: info.reason, message: info.message, intentional: destroyRequested }; return lossInfo; }));
      eventListener = e => event(report.uncaptured, fault(e.error)); device.addEventListener('uncapturederror', eventListener);
    }), 'device');
    const format = navigator.gpu.getPreferredCanvasFormat(); report.preferredFormat = format;
    if (!['rgba8unorm', 'bgra8unorm'].includes(format)) { report.status = 'UNSUPPORTED'; report.reason = 'FORMAT'; return report; }
    observer = installNativeObservers(device);
    const [api, gpu, sceneApi, sceneGpu] = await bounded(observe(Promise.all([
      import('@egret/engine'), import('@egret/engine/webgpu'), import('@egret/engine/scene3d'), import('@egret/engine/webgpu/scene3d'),
    ])), 'public-modules');
    canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; document.body.append(canvas);
    const options = { canvas, device: { kind: 'borrow', device }, enableReadback: true, pixelRatio: 1,
      onDiagnostic: value => event(report.diagnostics, { code: value.code, phase: value.phase, serial: value.serial }) };
    host = id === 'C4' ? sceneGpu.createTexturedSceneWebGPUHost(options) : id === 'C3' ? sceneGpu.createSceneWebGPUHost(options)
      : id === 'C2' ? gpu.createTexturedWebGPUHost(options) : gpu.createWebGPUHost(options);
    let scene;
    if (id === 'C3' || id === 'C4') {
      const geometry = sceneApi.createMeshGeometry3D({ positions: [-.75, .75, -3, .75, .75, -3, .75, -.75, -3, -.75, -.75, -3],
        colors: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], indices: [0, 1, 2, 0, 2, 3] });
      scene = sceneApi.createSceneFrame3D({ projection: { kind: 'orthographic', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 9 },
        draws: [{ geometry, modelView: identity }] });
    }
    const green = api.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([0, 255, 0, 255]) });
    let original, changed, bitmap, mesh, alternate;
    if (['C2', 'C4', 'C5'].includes(id)) {
      const enginePromise = id === 'C5' ? api.createEngine({ host }) : api.createEngineForProfile({ host }, api.TEXTURED_FRAME_PROFILE_2D);
      await bounded(acquire(enginePromise, 'engine', value => { engine = value; }), 'engine');
      scope = engine.createScope(); pin(engine.stage);
      const type = api.createAssetType('submission-reuse-' + id, api.isTexture);
      const sourceABytes = new Uint8Array([0, 255, 0, 255, 0, 0, 255, 255]);
      const sourceBBytes = new Uint8Array([0, 255, 0, 255, 0, 0, 255, 255]);
      const sourceA = id === 'C5' ? api.createImageData2D({ width: 2, height: 1, pixels: sourceABytes }) : green;
      const sourceB = id === 'C5' ? api.createImageData2D({ width: 2, height: 1, pixels: sourceBBytes }) : null;
      textures.push(api.createTexture(sourceA, { x: 0, y: 0, width: sourceA.width, height: 1 }));
      if (sourceB) textures.push(api.createTexture(sourceB, { x: 0, y: 0, width: 2, height: 1 }));
      let loads = 0;
      engine.assets.register(type, { async load() { return textures[loads++]; }, dispose(value) { value.dispose(); } });
      for (let index = 0; index < textures.length; index++) {
        const ref = api.createAssetRef(type, 'source-' + index); refs.push(ref);
        await bounded(acquire(engine.assets.acquire(ref, { signal: scope.signal }), 'lease-' + index, value => { leases.push(scope.use(value)); }), 'lease-' + index);
      }
      bitmap = scope.use(pin(new api.Bitmap(leases[0]), id === 'C5' ? 4 : 2, id === 'C5' ? 4 : 2, 8));
      nodes.push(bitmap); engine.stage.addChild(bitmap);
      if (id === 'C5') bitmap.sourceRect = { x: 0, y: 0, width: 1, height: 1 };
      else {
        const geometry = api.createTexturedGeometry2D({ positions: new Float64Array([0, 0, 8, 0, 8, 8, 0, 8]),
          uvs: new Float64Array([0, 0, 1, 0, 1, 1, 0, 1]), lightColors: new Float64Array(Array(16).fill(1)), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
        mesh = scope.use(pin(new api.Mesh2D(leases[0], geometry), 6, 6)); nodes.push(mesh); engine.stage.addChild(mesh);
      }
      const capture = () => id === 'C5' ? engine.captureFrame({ width: 16, height: 16, clearColor: 0, clearAlpha: 1 })
        : engine.captureTexturedFrame({ width: 16, height: 16, clearColor: 0, clearAlpha: 1 });
      original = capture();
      if (id === 'C5') {
        bitmap.sourceRect = { x: 1, y: 0, width: 1, height: 1 }; changed = capture();
        bitmap.textureLease = leases[1]; bitmap.sourceRect = { x: 0, y: 0, width: 1, height: 1 }; alternate = capture();
        report.sourceIdentity = { distinctSources: sourceA !== sourceB,
          equalBytes: sourceABytes.length === sourceBBytes.length && sourceABytes.every((value, index) => value === sourceBBytes[index]),
          sourceAInputRGBA: Array.from(sourceABytes), sourceBInputRGBA: Array.from(sourceBBytes),
          originalCrop: 0, secondCrop: 1, alternateCrop: 0 };
        fail(report.sourceIdentity.distinctSources && report.sourceIdentity.equalBytes);
      } else { mesh.x = 4; mesh.y = 4; mesh.alpha = .5; changed = capture(); }
    } else {
      await bounded(observe(host.start()), 'host-start');
      const rect = Object.freeze({ kind: 'rect', matrix: affine, rect: Object.freeze({ x: 2, y: 2, width: 8, height: 8 }), color: 0xff0000, alpha: 1, clips: Object.freeze([]) });
      if (id === 'C6') {
        const one = imageCommand(4, 4); original = ordinaryFrame(1, Array(2049).fill(one), green); changed = ordinaryFrame(2, [one], green);
      } else {
        original = ordinaryFrame(1, [...(id === 'C1' ? [rect] : []), imageCommand(6, 6)], green);
        changed = ordinaryFrame(2, [...(id === 'C1' ? [rect] : []), imageCommand(4, 4, .5)], green);
        if (control === 'wrong-alpha') changed = ordinaryFrame(2, [rect, imageCommand(6, 6, .25)], green);
        if (control === 'wrong-order') changed = ordinaryFrame(2, [imageCommand(6, 6), rect], green);
      }
    }
    const schedule = control ? [original, changed, original] : id === 'C5' ? [original, changed, alternate, original]
      : id === 'C6' ? [original, changed, changed, original] : [original, original, changed, original];
    for (let step = 0; step < schedule.length; step++) {
      if (id === 'C5' && step === 3) {
        for (const lease of leases) lease.release(); for (const ref of refs) engine.assets.invalidate(ref); for (const texture of textures) texture.dispose();
        try { engine.captureFrame({ width: 16, height: 16, clearColor: 0, clearAlpha: 1 }); } catch (error) { report.freshCaptureRefusal = fault(error); }
        fail(report.freshCaptureRefusal?.code && textures.every(value => value.isDisposed));
      }
      const frame = schedule[step], before = observer.snapshot(), writeStart = observer.writeIds.length;
      const ticket = observe(host.requestReadback()); let idle;
      try {
        const returned = id === 'C4' ? host.renderSceneTexturedFrame(scene, frame) : id === 'C3' ? host.renderSceneFrame(scene, frame)
          : id === 'C2' ? host.renderTexturedFrame(frame) : host.renderFrame(frame);
        fail(returned === undefined); idle = observe(host.whenIdle());
        const [readback] = await bounded(observe(Promise.all([ticket, idle])), 'frame-' + step);
        const status = counters(host); fail(readback.frameId === frame.frameId && readback.serial === step + 1 && status.lastSerial === step + 1);
        fail(!status.firstFailure && Object.values(status.pending).every(value => value === 0));
        const row = { id, control, step, frameId: frame.frameId, before, counts: observer.snapshot(),
          writeBufferIds: observer.writeIds.slice(writeStart), status,
          readback: { ...readback, bytes: Array.from(readback.bytes) } };
        report.frames.push({ ...row, readback: { ...row.readback, bytes: undefined, byteLength: readback.bytes.length } });
        // Retain bytes in Node before any oracle result can reject the frame.
        fail((await bounded(observe(globalThis.retainSubmissionFrame(row)), 'retain-' + step))?.retained === true);
      } finally { observe(ticket); if (idle) observe(idle); }
    }
    fail(!report.diagnostics.length && !report.uncaptured.length && !lossInfo && !report.eventOverflow);
    report.status = 'COMPLETED';
  } catch (error) { report.failure = fault(error); report.status = error.message?.startsWith('INCOMPLETE:') ? 'INCOMPLETE' : 'FAIL'; }
  finally {
    const cleanup = async (label, operation) => { try { await operation(); } catch (error) { report.cleanup.failures.push({ label, ...fault(error) }); } };
    for (const item of acquisitions) if (!item.settled) await cleanup('late-' + item.label, () => bounded(item.promise, 'late-' + item.label, true));
    if (scope) await cleanup('scope', async () => scope.dispose());
    if (engine) await cleanup('engine', () => bounded(observe(engine.dispose()), 'engine-dispose', true));
    if (host) await cleanup('host', async () => {
      await bounded(observe(host.close()), 'host-close', true); report.cleanup.host = counters(host);
      report.cleanup.hostSafe = report.cleanup.host.state === 'closed' && report.cleanup.host.cleanupOutcome === 'safe'
        && Object.values(report.cleanup.host.pending).every(value => value === 0); fail(report.cleanup.hostSafe);
    });
    if (observer) {
      report.cleanup.counts = observer.snapshot(); report.buffers = observer.buffers; report.textures = observer.textures;
      await cleanup('all-native-destructions', async () => fail(observer.buffers.every(value => value.destroys === 1)
        && observer.textures.every(value => value.destroys === 1)));
      await cleanup('restore-observers', async () => { observer.restore(); report.cleanup.observersRestored = true; });
    }
    if (device) {
      await cleanup('device', async () => { destroyRequested = true; device.destroy(); report.cleanup.deviceDestroyed = true;
        const info = await bounded(loss, 'device-loss', true); fail(info.reason === 'destroyed' && info.intentional); report.cleanup.lossSettled = true; });
      if (eventListener) device.removeEventListener('uncapturederror', eventListener);
    }
    if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); report.cleanup.canvasRetired = !canvas.isConnected; }
    if (engine) {
      report.cleanup.scopeClosed = scope?.state === 'closed'; report.cleanup.nodesDisposed = nodes.every(value => value.isDisposed);
      report.cleanup.texturesDisposed = textures.every(value => value.isDisposed);
      await cleanup('engine-owned-values', async () => fail(report.cleanup.scopeClosed && report.cleanup.nodesDisposed && report.cleanup.texturesDisposed));
    }
    if (pending.size) await cleanup('pending', () => bounded(observe(Promise.allSettled([...pending])), 'pending-drain', true));
    report.cleanup.pendingOperations = pending.size; report.cleanup.acquisitionsSettled = acquisitions.every(item => item.settled);
    if (report.cleanup.failures.length || pending.size || !report.cleanup.acquisitionsSettled || report.uncaptured.length
      || report.eventOverflow || lossInfo && !lossInfo.intentional) report.status = 'INCOMPLETE';
  }
  return report;
}
