// SPDX-License-Identifier: Apache-2.0
// This fixture uses only genuine emitted public Egret and experiment entries.
import * as egret from '@egret/engine';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createCanvasHost } from '@egret/engine/web';
import { createF2CoreResources } from '../dist/index.js';
import { FRAME, TIMES, requireNative } from './oracle.mjs';

const errorData = (cause, seen = new Set()) => {
  if (cause === null || typeof cause !== 'object') return { occurrence: true, value: String(cause), undefined: cause === undefined };
  if (seen.has(cause)) return { cycle: true }; seen.add(cause);
  return { occurrence: true, name: cause.name, code: cause.code, message: cause.message,
    ...('cause' in cause ? { cause: errorData(cause.cause, seen) } : {}),
    ...(Array.isArray(cause.cleanupErrors) ? { cleanupErrors: cause.cleanupErrors.map(value => errorData(value, seen)) } : {}) };
};
const geometryData = geometry => ({ positions: [...geometry.positions], uvs: [...geometry.uvs],
  lightColors: [...geometry.lightColors], indices: [...geometry.indices] });
const equal = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const handled = value => { const promise = Promise.resolve(value); promise.catch(() => undefined); return promise; };

/** Explicit start owns native work; module import creates no host, Engine or resource. */
export function createNativeFixture() {
  let started = false, closing = false, closePromise, deadline, cleanupDeadline;
  let canvas, device, lost, host, engine, provider, resources, instance, resourceScope, instanceScope;
  let savedGeometry, savedGeometryBytes, savedFrame, savedFrameBytes, page;
  let primaryOccurred = false, primary, destroyRequested = false, deviceLoss;
  let submissions = 0, sourceLoads = 0, sourceRef, providerRetirements = 0;
  const packets = [], phaseTimes = [], diagnostics = [], cleanupErrors = [], tickets = [], pending = new Set();
  const stamp = phase => phaseTimes.push({ phase, monotonicMs: performance.now() });
  function fail(cause) { if (!primaryOccurred) { primaryOccurred = true; primary = cause; } }
  function track(value, label, register) {
    const promise = handled(value), row = { id: tickets.length + 1, label, settled: false }; tickets.push(row); pending.add(promise);
    handled(promise.then(result => { row.settled = true; row.fulfilled = true; pending.delete(promise);
      try { register?.(result); } catch (cause) { fail(cause); }
    }, cause => { row.settled = true; row.fulfilled = false; row.error = errorData(cause); pending.delete(promise); }));
    return promise;
  }
  async function bounded(value, label, cleanup = false) {
    const original = handled(value), delay = Math.min(20_000, (cleanup ? cleanupDeadline : deadline) - Date.now());
    requireNative(delay > 0, label + ' deadline expired', 'F2C_NATIVE_DEADLINE'); let timer;
    try { return await Promise.race([original, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(label + ' pending'), { code: 'F2C_NATIVE_TIMEOUT' })), delay);
    })]); } finally { clearTimeout(timer); }
  }
  function snapshot() {
    const status = host?.getStatus();
    return { started, closing, primaryOccurred, primary: primaryOccurred ? errorData(primary) : null,
      cleanupErrors: cleanupErrors.map(value => errorData(value)), pendingTickets: pending.size, tickets,
      phaseTimes, diagnostics, submissions, sourceLoads, providerRetirements,
      resourceDisposed: resources?.isDisposed ?? null, instanceState: instance?.state ?? null,
      resourceScopeState: resourceScope?.state ?? null, instanceScopeState: instanceScope?.state ?? null,
      textureRetired: page?.isDisposed ?? null, deviceLoss, destroyRequested,
      hostStatus: status ? { ...status, firstFailure: status.firstFailure ? errorData(status.firstFailure.cause) : null } : null,
      browser: { isSecureContext, devicePixelRatio, userAgent: navigator.userAgent } };
  }
  async function readJSON(route) {
    const response = await bounded(track(fetch(route, { redirect: 'error' }), 'read ' + route), 'read ' + route);
    requireNative(response.ok && new URL(response.url).origin === location.origin, 'Sealed same-origin input');
    return bounded(track(response.json(), 'JSON ' + route), 'JSON ' + route);
  }
  async function readText(route) {
    const response = await bounded(track(fetch(route, { redirect: 'error' }), 'read ' + route), 'read ' + route);
    requireNative(response.ok && new URL(response.url).origin === location.origin, 'Sealed same-origin text');
    return bounded(track(response.text(), 'text ' + route), 'text ' + route);
  }
  async function start(limits) {
    requireNative(!started && !closing, 'Start exactly once'); started = true;
    deadline = limits.operationDeadline; cleanupDeadline = limits.cleanupDeadline;
    requireNative(Number.isSafeInteger(deadline) && Number.isSafeInteger(cleanupDeadline)
      && deadline > Date.now() && cleanupDeadline > deadline, 'Finite native deadlines');
    try {
      // Qualify the declared fixture-specific host premises before any Core pose.
      const q = 90 * (3.1415927 / 180), delta = 2.4e-8, tau = 2 ** -40;
      const basis = { q, cos0: Math.cos(0), sin0: Math.sin(0), cosq: Math.cos(q), sinq: Math.sin(q) };
      requireNative(Math.abs(basis.cos0 - 1) <= tau && Math.abs(basis.sin0) <= tau
        && Math.abs(basis.cosq) <= delta + tau && Math.abs(basis.sinq - 1) <= delta ** 2 / 2 + tau, 'Predeclared native host premises');
      stamp('host-premise-qualified');
      requireNative(isSecureContext && devicePixelRatio === 1 && navigator.gpu, 'Default WebGPU unavailable', 'F2C_NATIVE_UNAVAILABLE');
      const adapter = await bounded(track(navigator.gpu.requestAdapter(), 'requestAdapter'), 'requestAdapter');
      requireNative(adapter !== null && !closing, 'No default adapter', 'F2C_NATIVE_UNAVAILABLE');
      await bounded(track(adapter.requestDevice(), 'requestDevice', value => {
        device = value; lost = handled(value.lost.then(loss => { deviceLoss = { reason: loss.reason, message: loss.message };
          if (!destroyRequested) fail(Object.assign(new Error('Unexpected native device loss'), { code: 'F2C_NATIVE_DEVICE_LOST' })); return loss; }));
        value.addEventListener('uncapturederror', event => fail(event.error));
      }), 'requestDevice'); requireNative(!closing, 'Late device');
      canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
      canvas.style.cssText = 'display:block;width:64px;height:48px;border:0;padding:0;margin:0;transform:none'; document.body.appendChild(canvas);
      host = createTexturedWebGPUHost({ canvas, pixelRatio: 1, maxBackingPixels: 64 * 48, enableReadback: true,
        device: { kind: 'borrow', device }, onDiagnostic: value => { diagnostics.push(errorData(value.cause)); fail(value.cause); } });
      await bounded(track(egret.createEngineForProfile({ host, shutdownTimeoutMs: 20_000,
        onDiagnostic: value => { diagnostics.push(errorData(value.cause)); fail(value.cause); } }, egret.TEXTURED_FRAME_PROFILE_2D),
      'createEngineForProfile', value => { engine = value; }), 'Engine startup'); requireNative(!closing, 'Late Engine');
      resourceScope = engine.createScope(); instanceScope = engine.createScope();
      const origin = await readJSON('/assets/origin.json');
      const rawResponse = await bounded(track(fetch('/assets/original-f2c-page.rgba', { redirect: 'error' }), 'original raw page response'), 'original raw page response');
      requireNative(rawResponse.ok && new URL(rawResponse.url).origin === location.origin, 'Original same-origin raw page');
      const originalPixels = Array.from(new Uint8Array(await bounded(track(rawResponse.arrayBuffer(), 'original raw page bytes'), 'original raw page bytes')));
      requireNative(originalPixels.length === 1024, 'Original raw page byte count');
      const skeleton = await readText('/assets/original-f2c.spine.json'), atlas = await readText('/assets/original-f2c.atlas');
      const input = Object.freeze({ skeleton: Object.freeze({ id: origin.skeletonId, text: skeleton, provenance: origin.provenance }),
        atlas: Object.freeze({ id: origin.atlasId, text: atlas, provenance: origin.provenance }),
        pages: Object.freeze([Object.freeze({ pageName: origin.pageName, assetId: origin.assetId, provenance: origin.provenance })]) });
      const type = egret.createAssetType('F2-C native original PNG', egret.isTexture);
      sourceRef = egret.createAssetRef(type, origin.assetId);
      const reader = { async readBytes(ref, context) {
        requireNative(this === reader && ref === sourceRef && Object.isFrozen(context) && !closing, 'Authentic native page request');
        sourceLoads++; const response = await bounded(track(fetch('/assets/original-f2c-page.png', { redirect: 'error' }), 'PNG response'), 'PNG response');
        requireNative(response.ok && new URL(response.url).origin === location.origin, 'Sealed original PNG');
        const bytes = new Uint8Array(await bounded(track(response.arrayBuffer(), 'PNG bytes'), 'PNG bytes'));
        requireNative(bytes.length === 108, 'Original encoded page byte count'); stamp('original-page-bytes-ready'); return bytes;
      } };
      provider = createBrowserTextureProvider(reader);
      // Observe original provider retirement while forwarding the genuine value exactly once.
      const registration = { load(ref, context) { return track(provider.load(ref, context), 'genuine PNG provider load', value => {
        page = value; stamp('genuine-page-ready');
      }); }, dispose(texture) {
        providerRetirements++; return provider.dispose(texture);
      } }; engine.assets.register(type, registration);
      stamp('source-admission-start');
      await bounded(track(createF2CoreResources(engine, resourceScope, { input, pageRef: sourceRef }), 'Core resources', value => { resources = value; }), 'Core resources');
      requireNative(!closing && !resources.isDisposed, 'Genuine ready Core resources'); stamp('page-and-core-ready');
      instance = resources.createInstance(instanceScope, 'bend'); stamp('first-core-sample-committed');
      requireNative(instance.display instanceof egret.DisplayObjectContainer && instance.display.numChildren === 1, 'Genuine owned root');
      const mesh = instance.display.getChildAt(0); requireNative(mesh instanceof egret.Mesh2D, 'Genuine Mesh2D');
      page = mesh.textureLease.value;
      requireNative(page instanceof egret.Texture && page.width === 16 && page.height === 16
        && sourceLoads === 1 && equal(Array.from(egret.copyImageData2DPixels(page.imageData)), originalPixels), 'Native decoded exact original 16x16 page');
      instance.display.x = 16; instance.display.y = 24; engine.stage.addChild(instance.display);
      return { basis, setup: snapshot(), pagePixels: Array.from(egret.copyImageData2DPixels(page.imageData)) };
    } catch (cause) { fail(cause); throw cause; }
  }
  async function collect(index) {
    requireNative(started && !closing && index === packets.length && index < TIMES.length, 'Original finite sample order');
    try {
      const timeSeconds = TIMES[index], clock = { elapsedSeconds: engine.clock.elapsedSeconds, tickId: engine.clock.tickId };
      instance.sampleAt(timeSeconds); stamp('sample-' + index + '-committed');
      const mesh = instance.display.getChildAt(0);
      if (index === 0) { savedGeometry = mesh.geometry; savedGeometryBytes = geometryData(savedGeometry); }
      const frame = engine.captureTexturedFrame(FRAME);
      requireNative(frame.geometries[0] === mesh.geometry && frame.images[0] === page.imageData, 'Actual public capture owns exact geometry/image');
      if (index === 0) { savedFrame = frame; savedFrameBytes = JSON.stringify(frame); }
      const readback = track(host.requestReadback(), 'original readback ' + index);
      requireNative(host.renderTexturedFrame(frame) === undefined, 'Synchronous original textured submission'); submissions++; stamp('submission-' + index);
      const idle = track(host.whenIdle(), 'original idle ' + index);
      const [result] = await bounded(Promise.all([readback, idle]), 'confirmed original readback ' + index); stamp('confirmed-readback-' + index);
      requireNative(!primaryOccurred && result.frameId === frame.frameId && result.serial === submissions, 'Original native serial and diagnostic envelope');
      const packet = { timeSeconds, raw: Array.from(result.bytes), metadata: { width: result.width, height: result.height,
        byteLength: result.bytes.byteLength, frameId: result.frameId, serial: result.serial,
        format: result.format, sourceFormat: result.sourceFormat, colorSpace: result.colorSpace, alphaMode: result.alphaMode, origin: 'top-left' },
      frame: { commands: frame.commands.length, geometries: frame.geometries.length, images: frame.images.length },
      geometry: geometryData(mesh.geometry), oldGeometryUnchanged: equal(geometryData(savedGeometry), savedGeometryBytes),
      oldFrameUnchanged: JSON.stringify(savedFrame) === savedFrameBytes,
      clockDidNotTick: engine.clock.elapsedSeconds === clock.elapsedSeconds && engine.clock.tickId === clock.tickId };
      requireNative(packet.oldGeometryUnchanged && packet.oldFrameUnchanged && packet.clockDidNotTick, 'Manual samples retain earlier public frames');
      packets.push(packet); return packet;
    } catch (cause) { fail(cause); throw cause; }
  }
  async function canvasRefusal() {
    requireNative(packets.length === TIMES.length && !closing, 'Canvas refusal follows original WebGPU run');
    const surface = document.createElement('canvas'), canvasHost = createCanvasHost({ canvas: surface, pixelRatio: 1, maxBackingPixels: 64 * 48 });
    let error, created;
    try { created = await bounded(track(egret.createEngineForProfile({ host: canvasHost }, egret.TEXTURED_FRAME_PROFILE_2D), 'Canvas profile attempt'), 'Canvas profile attempt'); }
    catch (cause) { error = cause; }
    finally { if (created) await bounded(track(created.dispose(), 'unexpected Canvas Engine retirement'), 'unexpected Canvas Engine retirement', true);
      else await bounded(track(canvasHost.close(), 'Canvas refused host retirement'), 'Canvas refused host retirement', true); }
    requireNative(error instanceof egret.EgretError && error.code === 'ENGINE_RENDER_PROFILE_UNSUPPORTED' && created === undefined, 'Explicit genuine Canvas textured-profile refusal');
    return { id: 'F2C11_CANVAS_REFUSAL', status: 'PASS_REFUSAL_ONLY', error: errorData(error), engineCreated: false, renderedSubmissions: 0 };
  }
  function close() {
    if (closePromise) return closePromise; closing = true; stamp('retirement-start');
    closePromise = handled((async () => {
      // A watchdog does not settle an original ticket or authorize borrowed-device release.
      try { await bounded(Promise.allSettled([...pending]), 'original ticket retirement', true); requireNative(pending.size === 0, 'Original native tickets unsettled', 'F2C_NATIVE_CLOSE_UNSAFE'); }
      catch (cause) { cleanupErrors.push(cause); }
      for (const [label, operation] of [['instance', () => instance?.dispose()], ['resources', () => resources?.dispose()],
        ['instanceScope', () => instanceScope?.dispose()], ['resourceScope', () => resourceScope?.dispose()]]) {
        try { operation(); stamp(label + '-retired'); } catch (cause) { cleanupErrors.push(cause); }
      }
      try { if (engine) await bounded(track(engine.dispose(), 'Engine retirement'), 'Engine retirement', true);
        else if (host) await bounded(track(host.close(), 'Host without Engine retirement'), 'Host without Engine retirement', true); }
      catch (cause) { cleanupErrors.push(cause); }
      try { if (provider) await bounded(track(provider.close(), 'PNG provider retirement'), 'PNG provider retirement', true); }
      catch (cause) { cleanupErrors.push(cause); }
      const status = host?.getStatus(), safe = !host || status.state === 'closed' && status.cleanupOutcome === 'safe'
        && status.pendingFrames === 0 && status.pendingUploadBytes === 0 && status.pendingReadbackBytes === 0
        && host.getTexturedStatus().pendingGeometryBytes === 0;
      if (device && safe && pending.size === 0 && cleanupErrors.length === 0) {
        try { destroyRequested = true; device.destroy(); await bounded(lost, 'owned device destruction', true);
          requireNative(deviceLoss?.reason === 'destroyed', 'Owned device destruction confirmation'); }
        catch (cause) { cleanupErrors.push(cause); }
      } else if (device) cleanupErrors.push(Object.assign(new Error('Borrowed native device quarantined'), { code: 'F2C_NATIVE_CLOSE_UNSAFE' }));
      stamp('retirement-finished'); return snapshot();
    })()); return closePromise;
  }
  return Object.freeze({ start, collect, canvasRefusal, close, snapshot });
}
