// First-party Apache-2.0 native fixture. Only public SDK routes author and render values.
import * as egret from '@egret/engine';
import { createMatrix4, createMeshGeometry3D, createSceneFrame3D, isMeshGeometry3D, isSceneFrame3D } from '@egret/engine/scene3d';
import { createTexturedSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';
import { FIXTURE } from './oracle.mjs';

const MAX_EVENTS = 128;
const fault = (cause, depth = 0) => ({
  name: typeof cause?.name === 'string' ? cause.name : 'Unknown',
  code: typeof cause?.code === 'string' ? cause.code : null,
  message: String(cause?.message ?? cause).slice(0, 12000),
  cause: depth < 2 && cause?.cause !== undefined ? fault(cause.cause, depth + 1) : null,
});
function invariant(value, name) { if (!value) throw new Error('COMBINED_NATIVE:' + name); }
function limits(value) {
  const names = new Set([...Object.keys(value), ...Object.keys(Object.getPrototypeOf(value))]);
  return Object.fromEntries([...names].filter(name => typeof value[name] === 'number').sort().map(name => [name, value[name]]));
}
function statusOf(host) {
  const status = host.getStatus(), textured = host.getTexturedStatus(), scene = host.getSceneStatus();
  const hostStatus = { ...status, firstFailure: status.firstFailure ? { ...status.firstFailure, cause: fault(status.firstFailure.cause) } : null,
    lastCallbackFailure: status.lastCallbackFailure ? { ...status.lastCallbackFailure, cause: fault(status.lastCallbackFailure.cause) } : null };
  return { host: hostStatus, textured: { pendingGeometryBytes: textured.pendingGeometryBytes },
    scene: { pendingSceneBytes: scene.pendingSceneBytes, pendingUniformBytes: scene.pendingUniformBytes, pendingDepthBytes: scene.pendingDepthBytes } };
}
function idleStatus(status) {
  return status.host.pendingFrames === 0 && status.host.pendingUploadBytes === 0 && status.host.pendingReadbackBytes === 0
    && status.textured.pendingGeometryBytes === 0 && status.scene.pendingSceneBytes === 0
    && status.scene.pendingUniformBytes === 0 && status.scene.pendingDepthBytes === 0 && status.host.firstFailure === null;
}
function pinNode(node, transform) {
  const authored = Object.fromEntries(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha', 'visible'].map(name => [name, transform[name]]));
  Object.assign(node, authored, { clipRect: undefined });
  return node;
}
function nodeState(node) {
  return { x: node.x, y: node.y, scaleX: node.scaleX, scaleY: node.scaleY, rotation: node.rotation,
    alpha: node.alpha, visible: node.visible, clipRect: node.clipRect ?? null, isDisposed: node.isDisposed };
}
let lastReport = null, started = false;
globalThis.lastCombinedNative = () => lastReport;

globalThis.runCombinedNative = async function runCombinedNative() {
  invariant(!started, 'ONE_NATIVE_RUN');
  started = true;
  const began = Date.now(), operationDeadline = began + 90000, cleanupDeadline = began + 150000;
  const pending = new Set(), acquisitions = [];
  const observe = promise => {
    pending.add(promise);
    promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  };
  async function bounded(promise, label, cleanup = false) {
    observe(promise);
    const remaining = Math.min(20000, (cleanup ? cleanupDeadline : operationDeadline) - Date.now());
    if (remaining <= 0) throw new Error('COMBINED_NATIVE_DEADLINE:' + label);
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('COMBINED_NATIVE_TIMEOUT:' + label)), remaining); })]); }
    finally { clearTimeout(timer); }
  }
  function acquire(promise, label, assign) {
    const row = { label, settled: false, promise: null };
    row.promise = observe(promise.then(value => { row.settled = true; assign(value); return value; }, cause => { row.settled = true; throw cause; }));
    acquisitions.push(row);
    return row.promise;
  }
  const report = { kind: 'COMBINED_NATIVE_WINDOW', status: 'INCOMPLETE', startedAtUTC: new Date(began).toISOString(),
    environment: { userAgent: navigator.userAgent, platform: navigator.platform, browserDPR: devicePixelRatio, secureContext: isSecureContext, preferredFormat: null },
    adapter: null, device: null, deviceAcquired: false, devicePolicy: 'borrow', hostCreated: false, engineCreated: false,
    scopeCreated: false, textureCreated: false, providerRegistered: false, leaseAcquired: false, nodesCreatedCount: 0, observations: [], diagnostics: [], uncaptured: [],
    deviceLoss: null, unexpectedDeviceLoss: false, eventOverflow: false, phase: 'setup', failure: null,
    cleanup: { failures: [], scopeState: null, nodesDisposed: null, textureDisposed: null, providerDisposeCalls: 0,
      leaseValueRevoked: null, engineDisposed: false, host: null, hostSafeCloseObserved: false,
      deviceDestroyed: false, deviceLossSettled: false, pendingOperations: null, acquisitionStates: [] },
    claims: { passAndSubmitCounts: 'Separate accepted CPU/source evidence; native fixture does not intercept the device API',
      internalTextureRetirement: 'Source-reviewed obligation; no public pendingTexture counter',
      physicalProcessRetirement: 'UNBOUND', performance: false, phone: false, wholeImageColorOracle: false } };
  lastReport = report;
  let device, deviceLossPromise, destroyRequested = false, host, engine, scope, texture, lease;
  const nodes = [], canvas = document.querySelector('#scene');
  const addDiagnostic = value => {
    if (report.diagnostics.length >= MAX_EVENTS) { report.eventOverflow = true; return; }
    report.diagnostics.push(value);
  };
  const uncaptured = event => {
    if (report.uncaptured.length >= MAX_EVENTS) { report.eventOverflow = true; return; }
    report.uncaptured.push(fault(event.error));
  };
  try {
    invariant(canvas instanceof HTMLCanvasElement, 'ACTUAL_CANVAS');
    if (!navigator.gpu) { report.status = 'UNSUPPORTED'; report.capability = 'navigator.gpu absent'; return report; }
    report.environment.preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    const adapter = await bounded(observe(navigator.gpu.requestAdapter()), 'adapter');
    if (adapter === null) { report.status = 'UNSUPPORTED'; report.capability = 'default adapter unavailable'; return report; }
    const info = adapter.info;
    report.adapter = { info: info ? { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description } : null,
      isFallbackAdapter: adapter.isFallbackAdapter ?? null, features: [...adapter.features], limits: limits(adapter.limits) };
    await bounded(acquire(adapter.requestDevice(), 'device', value => {
      device = value;
      report.deviceAcquired = true;
      report.device = { label: value.label, features: [...value.features], limits: limits(value.limits) };
      value.addEventListener('uncapturederror', uncaptured);
      deviceLossPromise = observe(value.lost.then(loss => {
        report.deviceLoss = { reason: loss.reason, message: loss.message, destroyRequested };
        report.unexpectedDeviceLoss = !destroyRequested;
        return loss;
      }));
    }), 'device');
    host = createTexturedSceneWebGPUHost({ canvas, pixelRatio: FIXTURE.canvas.pixelRatio, enableReadback: true,
      device: { kind: 'borrow', device }, onDiagnostic: event => addDiagnostic({ source: 'host', code: event.code, phase: event.phase, serial: event.serial, cause: fault(event.cause) }) });
    report.hostCreated = true;
    await bounded(acquire(egret.createEngineForProfile({ host, shutdownTimeoutMs: 20000,
      onDiagnostic: event => addDiagnostic({ source: 'engine', ...fault(event) }) }, egret.TEXTURED_FRAME_PROFILE_2D),
    'engine', value => { engine = value; report.engineCreated = true; }), 'engine');
    scope = engine.createScope();
    report.scopeCreated = true;
    pinNode(engine.stage, FIXTURE.overlay.stage);
    const geometries = FIXTURE.scene.geometries.map(value => createMeshGeometry3D({ positions: value.positions, colors: value.colors, indices: value.indices }));
    const modelView = createMatrix4(FIXTURE.scene.modelView);
    const scene = createSceneFrame3D({ projection: FIXTURE.scene.projection, draws: geometries.map(geometry => ({ geometry, modelView })) });
    invariant(geometries.every(isMeshGeometry3D) && isSceneFrame3D(scene), 'GENUINE_SCENE');
    invariant(scene.draws.length === 2 && scene.sceneBytes === 168 && scene.uniformBytes === 128 && scene.cpuLogicalBytes === 336, 'SCENE_LITERAL_COUNTS');
    report.scene = { projection: FIXTURE.scene.projection, modelView: [...modelView], geometryOrder: FIXTURE.scene.drawOrder,
      geometry: geometries.map(value => ({ positions: value.positions, colors: value.colors, indices: value.indices })),
      cpuLogicalBytes: scene.cpuLogicalBytes, sceneBytes: scene.sceneBytes, uniformBytes: scene.uniformBytes,
      mvp: scene.draws.map(value => Array.from(value.mvp)) };
    const image = egret.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array(FIXTURE.resources.image.pixelsRowMajorRGBA) });
    texture = egret.createTexture(image, FIXTURE.resources.texture.sourceRect);
    report.textureCreated = true;
    const type = egret.createAssetType(FIXTURE.resources.acquisition.typeName, egret.isTexture);
    engine.assets.register(type, { async load() { return texture; }, dispose(value) {
      report.cleanup.providerDisposeCalls++;
      value.dispose();
    } });
    report.providerRegistered = true;
    lease = scope.use(await bounded(acquire(engine.assets.acquire(egret.createAssetRef(type, FIXTURE.resources.acquisition.refKey), { signal: scope.signal }),
      'lease', value => { lease = value; report.leaseAcquired = true; }), 'lease'));
    const ownNode = node => { nodes.push(node); report.nodesCreatedCount = nodes.length; return scope.use(node); };
    const white = ownNode(pinNode(new egret.Sprite(), FIXTURE.overlay.whiteRectangle.transform));
    white.graphics.beginFill(0xffffff, 1).drawRect(8, 18, 14, 10).endFill();
    const parent = ownNode(pinNode(new egret.Sprite(), FIXTURE.overlay.meshParent.transform));
    parent.clipRect = FIXTURE.overlay.meshParent.clipRect;
    const sourceGeometry = FIXTURE.overlay.paletteMesh.geometry;
    const meshGeometry = egret.createTexturedGeometry2D({ positions: new Float64Array(sourceGeometry.positions), uvs: new Float64Array(sourceGeometry.uvs),
      lightColors: new Float64Array(sourceGeometry.lightColors), indices: new Uint32Array(sourceGeometry.indices) });
    const mesh = ownNode(pinNode(new egret.Mesh2D(lease, meshGeometry), FIXTURE.overlay.paletteMesh.transform));
    parent.addChild(mesh);
    const bitmap = ownNode(pinNode(new egret.Bitmap(lease), FIXTURE.overlay.croppedImage.transform));
    bitmap.sourceRect = FIXTURE.overlay.croppedImage.sourceRect;
    // The real crop is authored before capture; it yields the literal one-texel yellow view.
    const green = ownNode(pinNode(new egret.Sprite(), FIXTURE.overlay.greenRectangle.transform));
    green.graphics.beginFill(0x00ff00, 1).drawRect(30, 28, 14, 8).endFill();
    for (const node of [white, parent, bitmap, green]) engine.stage.addChild(node);
    const labels = new Map([[white, 'whiteRectangle'], [parent, 'meshParent'], [bitmap, 'croppedImage'], [green, 'greenRectangle']]);
    report.authoring = { nodes: [engine.stage, ...nodes].map(nodeState), image: { width: 2, height: 2, pixelsRGBA: [...FIXTURE.resources.image.pixelsRowMajorRGBA] },
      meshGeometry: { positions: [...sourceGeometry.positions], uvs: [...sourceGeometry.uvs], lightColors: [...sourceGeometry.lightColors], indices: [...sourceGeometry.indices] },
      actualImageCrop: { ...bitmap.sourceRect }, actualParentClip: { ...parent.clipRect }, scopeState: scope.state, leaseValueIsTexture: lease.value === texture };
    for (const expected of FIXTURE.observations) {
      if (expected.id === 'CHN02') engine.stage.setChildIndex(green, 2);
      report.phase = 'capture';
      const overlay = engine.captureTexturedFrame({ width: 64, height: 64, clearColor: 0, clearAlpha: 1 });
      const commandKinds = overlay.commands.map(value => value.kind);
      const stageChildOrder = Array.from({ length: engine.stage.numChildren }, (_, index) => labels.get(engine.stage.getChildAt(index)));
      invariant(overlay.frameId === expected.expectedFrameId && JSON.stringify(commandKinds) === JSON.stringify(expected.expectedCommandKinds)
        && JSON.stringify(stageChildOrder) === JSON.stringify(expected.stageChildOrder), 'CAPTURE_ORDER');
      invariant(Object.isFrozen(overlay) && overlay.images.length === 1 && overlay.geometries.length === 1, 'GENUINE_CAPTURE_COUNTS');
      const before = statusOf(host), ticket = observe(host.requestReadback());
      report.phase = 'render';
      let idle, returned;
      try {
        returned = host.renderSceneTexturedFrame(scene, overlay);
        invariant(returned === undefined, 'SYNCHRONOUS_UNDEFINED');
        idle = observe(host.whenIdle());
        report.phase = 'readback';
        const [readback] = await bounded(observe(Promise.all([ticket, idle])), expected.id + '-readback');
        invariant(readback.frameId === overlay.frameId && readback.serial === expected.expectedReadbackSerial, 'READBACK_IDENTITY');
        const after = statusOf(host);
        invariant(idleStatus(after), 'PUBLIC_LEDGER_RETIRED');
        invariant(canvas.width === 64 && canvas.height === 64 && readback.width === 64 && readback.height === 64, 'ACTUAL_BACKING');
        const observation = { id: expected.id, capture: { frameId: overlay.frameId, width: overlay.width, height: overlay.height,
          clearColor: overlay.clearColor, clearAlpha: overlay.clearAlpha, commandKinds, images: overlay.images.length, geometries: overlay.geometries.length,
          stageChildOrder, scopeState: scope.state },
          renderReturn: 'undefined', before, after, publicCountersRetired: true,
          readback: { serial: readback.serial, frameId: readback.frameId, width: readback.width, height: readback.height,
            format: readback.format, sourceFormat: readback.sourceFormat, colorSpace: readback.colorSpace, alphaMode: readback.alphaMode,
            bytes: Array.from(readback.bytes) } };
        report.observations.push({ ...observation, readback: { ...observation.readback, bytes: undefined, byteLength: readback.bytes.length } });
        invariant(typeof globalThis.__retainCombinedObservation === 'function', 'NODE_RETENTION_BINDING');
        // Node retains the actual full buffer first. Pixel rejection is acknowledged, so cleanup and frame2 still run.
        const acknowledgment = await bounded(observe(globalThis.__retainCombinedObservation(observation)), expected.id + '-retain');
        invariant(acknowledgment?.retained === true, 'RAW_RETENTION_ACKNOWLEDGED');
      } catch (cause) {
        observe(ticket);
        if (idle) observe(idle);
        throw cause;
      }
    }
    invariant(report.diagnostics.length === 0 && report.uncaptured.length === 0 && !report.eventOverflow && !report.unexpectedDeviceLoss, 'NO_NATIVE_DIAGNOSTICS');
    report.status = 'SCENE_COMPLETED';
  } catch (cause) {
    report.failure = { phase: report.phase, ...fault(cause) };
    report.status = report.phase === 'setup' || report.phase === 'capture' ? 'SETUP_FAILED' : report.phase === 'render' ? 'RENDER_FAILED' : 'READBACK_FAILED';
  } finally {
    const cleanupFailure = (label, cause) => report.cleanup.failures.push({ label, ...fault(cause) });
    // Timeouts do not cancel acquisitions. Assign every late handle before attempting its cleanup.
    for (const row of acquisitions) if (!row.settled) {
      try { await bounded(row.promise, 'late-' + row.label, true); } catch (cause) { cleanupFailure('late-' + row.label, cause); }
    }
    if (scope) {
      try { scope.dispose(); } catch (cause) { cleanupFailure('scope', cause); }
      report.cleanup.scopeState = scope.state;
    }
    if (lease) {
      try { lease.release(); } catch (cause) { cleanupFailure('lease', cause); }
      try { void lease.value; report.cleanup.leaseValueRevoked = false; } catch { report.cleanup.leaseValueRevoked = true; }
    }
    if (engine) {
      try { await bounded(observe(engine.dispose()), 'engine-dispose', true); report.cleanup.engineDisposed = true; }
      catch (cause) { cleanupFailure('engine', cause); }
    }
    if (host) {
      try { await bounded(observe(host.close()), 'host-close', true); } catch (cause) { cleanupFailure('host', cause); }
      report.cleanup.host = statusOf(host);
      report.cleanup.hostSafeCloseObserved = report.cleanup.host.host.state === 'closed' && report.cleanup.host.host.cleanupOutcome === 'safe';
    }
    // Host queue/fence ownership must settle before this application destroys its original borrowed device.
    if (device) {
      try { destroyRequested = true; device.destroy(); report.cleanup.deviceDestroyed = true; } catch (cause) { cleanupFailure('device-destroy', cause); }
      if (deviceLossPromise) {
        try { await bounded(deviceLossPromise, 'destroyed-device-loss', true); report.cleanup.deviceLossSettled = true; }
        catch (cause) { cleanupFailure('device-loss', cause); }
      }
      device.removeEventListener('uncapturederror', uncaptured);
    }
    if (texture) {
      if (!texture.isDisposed) { try { texture.dispose(); } catch (cause) { cleanupFailure('texture', cause); } }
      report.cleanup.textureDisposed = texture.isDisposed;
    }
    report.cleanup.nodesDisposed = nodes.length ? nodes.every(node => node.isDisposed) : null;
    // Drain observers that are already started; missing settlement is an incomplete cleanup receipt.
    if (pending.size) {
      try { await bounded(observe(Promise.allSettled([...pending])), 'started-promise-drain', true); } catch (cause) { cleanupFailure('promise-drain', cause); }
    }
    report.cleanup.pendingOperations = pending.size;
    report.cleanup.acquisitionStates = acquisitions.map(row => ({ label: row.label, settled: row.settled }));
    if (report.cleanup.failures.length || pending.size || acquisitions.some(row => !row.settled)
        || report.eventOverflow || report.uncaptured.length || report.unexpectedDeviceLoss
        || (host && !report.cleanup.hostSafeCloseObserved)
        || (device && (!report.cleanup.deviceDestroyed || !report.cleanup.deviceLossSettled))
        || (scope && scope.state !== 'closed') || (nodes.length && !report.cleanup.nodesDisposed)
        || (texture && !report.cleanup.textureDisposed)) report.status = 'CLEANUP_FAILED';
    report.finishedAtUTC = new Date().toISOString();
  }
  return report;
};
globalThis.combinedNativeReady = true;
