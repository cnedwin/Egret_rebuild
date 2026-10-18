// SPDX-License-Identifier: Apache-2.0
// Browser-only native fixture. All rendering, capture and resources use public SDK entries.
import * as sdk from '@egret/engine';
import * as webgpu from '@egret/engine/webgpu';
import * as scene3d from '@egret/engine/scene3d';
import * as sceneWebgpu from '@egret/engine/webgpu/scene3d';

const PROFILE = 'egret.shared-frame2d/1';
const OPERATION_MS = 60000, TOTAL_MS = 90000, MAX_EVENTS = 128;
const requireValue = (value, reason) => { if (!value) throw new Error(reason); };
const observed = promise => { promise.catch(() => {}); return promise; };
function fault(value, depth = 0) {
  return {name: typeof value?.name === 'string' ? value.name : 'Unknown',
    message: String(value?.message ?? value).slice(0, 8000),
    code: typeof value?.code === 'string' ? value.code : null,
    stack: typeof value?.stack === 'string' ? value.stack.slice(0, 16000) : null,
    cause: depth < 3 && value?.cause !== undefined ? fault(value.cause, depth + 1) : null};
}
function actualLimits(value) {
  const result = {};
  for (let owner = value; owner && owner !== Object.prototype; owner = Object.getPrototypeOf(owner)) {
    for (const key of Object.getOwnPropertyNames(owner)) {
      if (key !== 'constructor' && typeof value[key] === 'number') result[key] = value[key];
    }
  }
  return result;
}
function hostStatus(host) {
  const value = host.getStatus();
  const failure = row => row === null ? null : {
    code: row.code, serial: row.serial, phase: row.phase, cause: fault(row.cause)};
  return {...value, firstFailure: failure(value.firstFailure),
    lastCallbackFailure: failure(value.lastCallbackFailure)};
}
function sharedStatus(host) {
  const value = host.getSharedStatus();
  return {host: hostStatus(host), pendingGeometryBytes: value.pendingGeometryBytes,
    pendingColorBytes: value.pendingColorBytes, pendingCanonicalBytes: value.pendingCanonicalBytes};
}
function sceneStatus(host) {
  const value = host.getSceneStatus();
  return {host: hostStatus(host), pendingSceneBytes: value.pendingSceneBytes,
    pendingUniformBytes: value.pendingUniformBytes, pendingDepthBytes: value.pendingDepthBytes};
}
const byteTuple = value => Array.isArray(value) && value.length === 4
  && value.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255);
function pageBytes(def) {
  requireValue(Number.isInteger(def.width) && def.width > 0 && Number.isInteger(def.height)
    && def.height > 0 && 4 * def.width * def.height <= 4194304, 'PAGE_DIMENSIONS');
  const bytes = new Uint8Array(4 * def.width * def.height), pattern = def.pattern;
  if (pattern.kind === 'pixels') {
    requireValue(Array.isArray(pattern.bytes) && pattern.bytes.length === bytes.length
      && pattern.bytes.every(v => Number.isInteger(v) && v >= 0 && v <= 255), 'PAGE_BYTES');
    bytes.set(pattern.bytes);
  } else {
    requireValue(pattern.kind === 'solid' || pattern.kind === 'rotated-content', 'PAGE_PATTERN');
    const background = pattern.kind === 'solid' ? pattern.color : pattern.background;
    requireValue(byteTuple(background), 'PAGE_BACKGROUND');
    for (let offset = 0; offset < bytes.length; offset += 4) bytes.set(background, offset);
    if (pattern.kind === 'rotated-content') {
      const {contentWidth: width, contentHeight: height, packedX, packedY, quarterTurn: turn} = pattern;
      requireValue([width, height, packedX, packedY, turn].every(Number.isInteger)
        && width > 0 && height > 0 && packedX >= 0 && packedY >= 0 && turn >= 0 && turn <= 3
        && packedX + (turn % 2 ? height : width) <= def.width
        && packedY + (turn % 2 ? width : height) <= def.height, 'PAGE_PACKED_EXTENT');
      requireValue(Array.isArray(pattern.contentBytes) && pattern.contentBytes.length === 4 * width * height
        && pattern.contentBytes.every(v => Number.isInteger(v) && v >= 0 && v <= 255), 'PAGE_CONTENT');
      // This is source-image authoring, not a sampling or color oracle. Rotate discrete source cells.
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let px = x, py = y;
        if (turn === 1) { px = height - 1 - y; py = x; }
        else if (turn === 2) { px = width - 1 - x; py = height - 1 - y; }
        else if (turn === 3) { px = y; py = width - 1 - x; }
        const input = 4 * (y * width + x), output = 4 * ((packedY + py) * def.width + packedX + px);
        for (let channel = 0; channel < 4; channel++) bytes[output + channel] = pattern.contentBytes[input + channel];
      }
    }
  }
  return bytes;
}
async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
}
function uniqueRows(rows, maximum, name) {
  requireValue(Array.isArray(rows) && rows.length <= maximum, name + '_COUNT');
  const result = new Map();
  for (const row of rows) {
    requireValue(typeof row.id === 'string' && row.id.length > 0 && !result.has(row.id), name + '_IDENTITY');
    result.set(row.id, row);
  }
  return result;
}

/** One fresh default-adapter device, one genuine captured frame, one retained observation. */
export async function runSharedNativeCase(def, pages, regions) {
  const started = performance.now(), operationDeadline = started + OPERATION_MS, cleanupDeadline = started + TOTAL_MS;
  const report = {caseId: def?.id, status: 'INCOMPLETE', deviceAcquired: false, failure: null,
    adapter: null, device: null, deviceLoss: null, unexpectedDeviceLoss: false, uncaptured: [],
    hostDiagnostics: [], engineDiagnostics: [], overflow: false, observationRetained: false,
    inputs: {pages: [], regions: [], draws: []}, frame: null, beforeObservation: null,
    environment: {userAgent: navigator.userAgent, platform: navigator.platform,
      browserDPR: globalThis.devicePixelRatio, explicitHostPixelRatio: 1, isSecureContext: globalThis.isSecureContext},
    cleanup: {scopeClosed: false, engineClosed: false, hostClosed: false,
      deviceDestroyed: false, lossSettled: false, failures: [], pendingActors: [], textures: []}};
  let closing = false, device, loss, host, engine, scope, deviceDestroyRequested = false;
  let engineClose, hostClose;
  const pending = new Map(), resources = new Map();
  let actorOrdinal = 0;
  const record = (list, row) => {
    if (list.length >= MAX_EVENTS) report.overflow = true;
    else list.push(row);
  };
  const cleanupFailure = (label, cause) => record(report.cleanup.failures, {label, ...fault(cause)});
  function track(label, promise) {
    const id = ++actorOrdinal, value = Promise.resolve(promise);
    pending.set(id, {label, value});
    observed(value.then(() => pending.delete(id), () => pending.delete(id)));
    return observed(value);
  }
  async function bounded(label, promise, deadline = operationDeadline) {
    const value = track(label, promise);
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error('DEADLINE:' + label);
    let timer;
    try {
      return await Promise.race([value, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('DEADLINE:' + label)), remaining);
      })]);
    } finally { clearTimeout(timer); }
  }
  const uncaptured = event => record(report.uncaptured, fault(event.error));
  function destroyDevice() {
    if (!device || deviceDestroyRequested) return;
    deviceDestroyRequested = true;
    try { device.destroy(); report.cleanup.deviceDestroyed = true; }
    catch (cause) { cleanupFailure('device.destroy', cause); }
  }
  function closeEngine() {
    if (!engine || engineClose) return engineClose;
    engineClose = track('engine.dispose', engine.dispose());
    return engineClose;
  }
  function closeHost() {
    if (!host || hostClose) return hostClose;
    hostClose = track('host.close', host.close());
    return hostClose;
  }
  try {
    requireValue(def && def.width === 256 && def.height === 256
      && ['premultiplied', 'opaque'].includes(def.outputAlpha), 'CASE_SURFACE');
    const canvas = document.getElementById('shared');
    requireValue(canvas instanceof HTMLCanvasElement && canvas.width === 256 && canvas.height === 256, 'CANVAS_BACKING');
    const rect = canvas.getBoundingClientRect();
    requireValue(rect.width === 256 && rect.height === 256 && innerWidth === 256 && innerHeight === 256
      && Number.isFinite(devicePixelRatio) && devicePixelRatio > 0, 'CANVAS_CSS');
    report.environment.surface = {width: canvas.width, height: canvas.height,
      cssWidth: rect.width, cssHeight: rect.height, innerWidth, innerHeight};
    requireValue(typeof globalThis.__retainSharedObservation === 'function', 'NATIVE_COLLECTOR_BINDING_MISSING');
    if (!navigator.gpu) { report.status = 'UNSUPPORTED'; report.capability = 'navigator.gpu absent'; return report; }
    report.environment.preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    const adapter = await bounded('requestAdapter', navigator.gpu.requestAdapter());
    if (adapter === null) { report.status = 'UNSUPPORTED'; report.capability = 'default adapter unavailable'; return report; }
    const info = adapter.info;
    report.adapter = {info: info ? {vendor: info.vendor, architecture: info.architecture,
      device: info.device, description: info.description} : null,
      isFallbackAdapter: adapter.isFallbackAdapter ?? null, features: [...adapter.features], limits: actualLimits(adapter.limits)};
    if (adapter.isFallbackAdapter === true) {
      report.status = 'UNSUPPORTED'; report.capability = 'default adapter is fallback'; return report;
    }
    // Install ownership before the deadline wrapper: late acquisition is still destroyed.
    const acquisition = Promise.resolve(adapter.requestDevice()).then(value => {
      device = value; report.deviceAcquired = true;
      report.device = {label: device.label, features: [...device.features], limits: actualLimits(device.limits)};
      device.addEventListener('uncapturederror', uncaptured);
      loss = observed(device.lost.then(value => {
        report.deviceLoss = {reason: value.reason, message: value.message, destroyRequested: deviceDestroyRequested};
        report.unexpectedDeviceLoss = !deviceDestroyRequested || value.reason !== 'destroyed';
        report.cleanup.lossSettled = true;
      }));
      if (closing) destroyDevice();
      return device;
    });
    await bounded('requestDevice', acquisition);
    const factory = def.scene ? sceneWebgpu.createSharedSceneWebGPUHost : webgpu.createSharedWebGPUHost;
    requireValue(typeof factory === 'function', 'SHARED_HOST_FACTORY_MISSING');
    host = factory({canvas, device: {kind: 'borrow', device}, pixelRatio: 1, outputAlpha: def.outputAlpha,
      enableReadback: true, onDiagnostic: value => record(report.hostDiagnostics, {code: value.code, serial: value.serial, phase: value.phase, severity: value.severity, cause: fault(value.cause)})});
    const startup = sdk.createEngineForProfile({host, shutdownTimeoutMs: 20000,
      onDiagnostic: value => record(report.engineDiagnostics, {code: value.code, phase: value.phase, severity: value.severity, cause: fault(value.cause)})}, PROFILE).then(value => {
        engine = value;
        if (closing) observed(closeEngine()).catch(cause => cleanupFailure('late engine.dispose', cause));
        return value;
      });
    await bounded('createEngineForProfile', startup);
    requireValue(engine instanceof sdk.Engine && engine.stage instanceof sdk.Stage, 'GENUINE_ENGINE_STAGE');
    scope = engine.createScope();
    const pageDefs = uniqueRows(pages, 256, 'PAGE'), regionDefs = uniqueRows(regions, 256, 'REGION');
    requireValue(Array.isArray(def.draws) && def.draws.length <= 1024, 'DRAW_COUNT');
    const selectedRegions = new Set(def.draws.map(draw => draw.regionId).filter(id => id !== undefined)), images = new Map();
    const textureType = sdk.createAssetType('shared-native-texture', sdk.isTexture);
    engine.assets.register(textureType, {
      async load(ref) { const row = resources.get(ref.id); requireValue(row, 'RESOURCE_ID'); return row.texture; },
      dispose(texture) {
        const row = [...resources.values()].find(value => value.texture === texture);
        requireValue(row, 'RESOURCE_DISPOSE_ID'); row.disposals++; texture.dispose();
      },
    });
    let totalSourceBytes = 0;
    for (const regionId of selectedRegions) {
      const region = regionDefs.get(regionId);
      requireValue(region, 'REGION_MISSING');
      const page = pageDefs.get(region.pageId);
      requireValue(page, 'PAGE_MISSING');
      if (!images.has(page.id)) {
        const bytes = pageBytes(page);
        totalSourceBytes += bytes.length;
        requireValue(totalSourceBytes <= 16777216 && images.size < 64, 'CASE_SOURCE_BUDGET');
        const digest = await bounded('source.sha256', sha256(bytes));
        requireValue(bytes.length === page.sourceByteLength && digest === page.sourceSha256, 'SOURCE_PIN_MISMATCH');
        images.set(page.id, sdk.createImageData2D({width: page.width, height: page.height, pixels: bytes}));
        report.inputs.pages.push({id: page.id, width: page.width, height: page.height, bytes: bytes.length, sha256: digest});
      }
      const descriptor = {packed: {...region.packed}, logicalWidth: region.logicalWidth,
        logicalHeight: region.logicalHeight, trimX: region.trimX, trimY: region.trimY, quarterTurn: region.quarterTurn};
      const texture = sdk.createTextureView(images.get(page.id), descriptor);
      const row = {texture, lease: undefined, disposals: 0};
      resources.set(regionId, row);
      const acquiring = engine.assets.acquire(sdk.createAssetRef(textureType, regionId), {signal: scope.signal}).then(value => {
        row.lease = value;
        if (closing) value.release();
        return value;
      });
      scope.use(await bounded('asset.acquire:' + regionId, acquiring));
      report.inputs.regions.push({id: regionId, pageId: region.pageId, ...descriptor});
    }
    function attach(node, parent) { scope.use(node); parent.addChild(node); return node; }
    const drawNames = new Set();
    for (const draw of def.draws) {
      requireValue(typeof draw.id === 'string' && !drawNames.has(draw.id), 'DRAW_IDENTITY'); drawNames.add(draw.id);
      let parent = engine.stage;
      if (draw.parentOpacity !== undefined) {
        parent = attach(new sdk.Sprite(), parent); parent.alpha = draw.parentOpacity;
      }
      requireValue(draw.clipChain === undefined || Array.isArray(draw.clipChain) && draw.clipChain.length <= 64, 'CLIP_CHAIN');
      for (const clip of draw.clipChain ?? []) {
        parent = attach(new sdk.Sprite(), parent); parent.clipRect = {...clip.rect};
      }
      const row = resources.get(draw.regionId);
      let node;
      if (draw.kind === 'shared-mesh') {
        requireValue(Array.isArray(draw.positions) && draw.positions.length % 2 === 0
          && draw.positions.length <= 131072 && Array.isArray(draw.uvs) && draw.uvs.length === draw.positions.length
          && Array.isArray(draw.indices) && draw.indices.length <= 196608
          && Array.isArray(draw.light) && draw.light.length === 4
          && Array.isArray(draw.dark) && draw.dark.length === 3, 'MESH_FIELDS');
        const vertices = draw.positions.length / 2, lightColors = new Float64Array(vertices * 4), darkColors = new Float64Array(vertices * 3);
        for (let vertex = 0; vertex < vertices; vertex++) {
          lightColors.set(draw.light, vertex * 4); darkColors.set(draw.dark, vertex * 3);
        }
        const geometry = sdk.createSharedGeometry2D({positions: new Float64Array(draw.positions),
          uvs: new Float64Array(draw.uvs), lightColors, darkColors, indices: new Uint32Array(draw.indices)});
        node = new sdk.Mesh2D(row.lease, geometry);
      } else if (draw.kind === 'nine-slice') {
        node = new sdk.NineSliceBitmap(row.lease, {width: draw.width, height: draw.height, insets: {...draw.insets}});
        node.x = draw.x; node.y = draw.y;
      } else throw new Error('DRAW_KIND');
      node.sharedMaterial = sdk.createSharedMaterial2D(draw.material);
      node.alpha = draw.opacity;
      attach(node, parent);
      report.inputs.draws.push({id: draw.id, kind: draw.kind, regionId: draw.regionId});
    }
    const frameOptions = {width: 256, height: 256, clearColor: def.clearColor,
      clearAlpha: def.clearAlpha, outputAlpha: def.outputAlpha};
    let scene;
    if (def.scene) {
      requireValue(def.outputAlpha === 'opaque', 'SCENE_OUTPUT_ALPHA');
      scene = scene3d.createSceneFrame3D({projection: {...def.scene.projection}, draws: def.scene.draws.map(draw => ({
        geometry: scene3d.createMeshGeometry3D({positions: draw.geometry.positions,
          colors: draw.geometry.colors, indices: draw.geometry.indices}),
        modelView: scene3d.createMatrix4(draw.modelView),
      }))});
    }
    // The public ticket targets the next accepted submission, so reserve before rendering.
    const ticket = observed(host.requestReadback());
    const frame = scene ? engine.captureSharedFrame(frameOptions) : engine.renderSharedFrame(frameOptions);
    if (scene) host.renderSceneSharedFrame(scene, frame);
    report.frame = {frameId: frame.frameId, profile: frame.profile, width: frame.width, height: frame.height,
      outputAlpha: frame.outputAlpha, commands: frame.commands.length, pages: frame.pages.length,
      regions: frame.regions.length, materials: frame.materials.length, geometries: frame.geometries.length};
    const readback = await bounded('requestReadback', ticket);
    await bounded('host.whenIdle', host.whenIdle());
    requireValue(readback.width === 256 && readback.height === 256 && readback.bytes instanceof Uint8Array
      && readback.bytes.length === 262144 && readback.frameId === frame.frameId
      && readback.serial === 1 && readback.format === 'rgba8unorm'
      && ['rgba8unorm', 'bgra8unorm'].includes(readback.sourceFormat)
      && readback.colorSpace === 'srgb' && readback.alphaMode === def.outputAlpha, 'READBACK_METADATA');
    const status = hostStatus(host), shared = sharedStatus(host);
    requireValue(status.state === 'active' && status.pendingFrames === 0 && status.pendingUploadBytes === 0
      && status.pendingReadbackBytes === 0 && status.firstFailure === null && status.callbackFailureCount === 0
      && shared.pendingGeometryBytes === 0 && shared.pendingColorBytes === 0
      && shared.pendingCanonicalBytes === 0, 'HOST_IDLE_UNPROVEN');
    const sceneIdle = scene ? sceneStatus(host) : undefined;
    if (sceneIdle) requireValue(sceneIdle.pendingSceneBytes === 0 && sceneIdle.pendingUniformBytes === 0
      && sceneIdle.pendingDepthBytes === 0, 'SCENE_IDLE_UNPROVEN');
    report.beforeObservation = {hostStatus: status, sharedStatus: shared,
      ...(sceneIdle ? {sceneStatus: sceneIdle} : {})};
    const {width, height, format, sourceFormat, colorSpace, alphaMode, serial, frameId} = readback;
    await bounded('retain observation', globalThis.__retainSharedObservation({caseId: def.id,
      readback: {width, height, format, sourceFormat, colorSpace, alphaMode, serial, frameId,
        bytes: Array.from(readback.bytes)}, hostStatus: status, sharedStatus: shared}));
    report.observationRetained = true;
    report.status = 'COMPLETE';
  } catch (cause) { report.failure = fault(cause); report.status = 'INCOMPLETE'; }
  finally {
    closing = true;
    if (scope) {
      try { scope.dispose(); report.cleanup.scopeClosed = scope.state === 'closed'; }
      catch (cause) { cleanupFailure('scope.dispose', cause); }
    }
    if (engine) {
      try { await bounded('engine.dispose wait', closeEngine(), cleanupDeadline); report.cleanup.engineClosed = true; }
      catch (cause) { cleanupFailure('engine.dispose', cause); }
    }
    if (host) {
      try { await bounded('host.close wait', closeHost(), cleanupDeadline); }
      catch (cause) { cleanupFailure('host.close', cause); }
    }
    // A late Engine/device promise remains observed and owned after an operation deadline.
    try {
      while (pending.size && performance.now() < cleanupDeadline) {
        await bounded('settle prior actors', Promise.allSettled([...pending.values()].map(row => row.value)), cleanupDeadline);
      }
    } catch (cause) { cleanupFailure('settle prior actors', cause); }
    if (host) {
      try {
        report.cleanup.hostStatus = hostStatus(host);
        report.cleanup.sharedStatus = sharedStatus(host);
        if (def.scene) report.cleanup.sceneStatus = sceneStatus(host);
        const s = report.cleanup.hostStatus, shared = report.cleanup.sharedStatus;
        const sceneClosed = report.cleanup.sceneStatus;
        report.cleanup.hostClosed = (!sceneClosed || sceneClosed.pendingSceneBytes === 0
          && sceneClosed.pendingUniformBytes === 0 && sceneClosed.pendingDepthBytes === 0)
          && s.state === 'closed' && s.cleanupOutcome === 'safe'
          && s.pendingFrames === 0 && s.pendingUploadBytes === 0 && s.pendingReadbackBytes === 0
          && shared.pendingGeometryBytes === 0 && shared.pendingColorBytes === 0 && shared.pendingCanonicalBytes === 0;
        if (!report.cleanup.hostClosed) cleanupFailure('host status', new Error('HOST_SAFE_CLOSE_UNPROVEN'));
      } catch (cause) { cleanupFailure('host.getStatus', cause); }
    }
    for (const [id, row] of resources) {
      try {
        if (!row.texture.isDisposed) row.texture.dispose();
        report.cleanup.textures.push({id, providerDisposals: row.disposals, disposed: row.texture.isDisposed});
        if (row.lease && row.disposals !== 1) cleanupFailure('resource:' + id, new Error('RESOURCE_PROVIDER_DISPOSAL_UNPROVEN'));
      } catch (cause) { cleanupFailure('texture.dispose:' + id, cause); }
    }
    destroyDevice();
    if (loss) try { await bounded('device.lost', loss, cleanupDeadline); }
    catch (cause) { cleanupFailure('device.lost', cause); }
    report.cleanup.pendingActors = [...pending.values()].map(row => row.label);
    if (device && report.cleanup.lossSettled) device.removeEventListener('uncapturederror', uncaptured);
    if (report.status === 'COMPLETE' && (!report.observationRetained || !report.cleanup.scopeClosed
      || !report.cleanup.engineClosed || !report.cleanup.hostClosed || !report.cleanup.deviceDestroyed
      || !report.cleanup.lossSettled || report.cleanup.pendingActors.length || report.cleanup.failures.length
      || report.uncaptured.length || report.unexpectedDeviceLoss || report.hostDiagnostics.length
      || report.engineDiagnostics.length || report.overflow)) report.status = 'INCOMPLETE';
    report.elapsedMs = performance.now() - started;
  }
  return report;
}
