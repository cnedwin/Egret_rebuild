// SPDX-License-Identifier: Apache-2.0
import { createEngine, createAssetType, createAssetRef, isTexture, createSpriteSheet,
  createSequenceClip, copyImageData2DPixels } from '@egret/engine';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { installBrowserPngNativeObserver } from './native-observer.mjs';

const assertion = (condition, message, code = 'BIP_NATIVE_PROTOCOL') => {
  if (!condition) throw Object.assign(new Error(message), { code });
};
const errorData = cause => ({ occurrence: true, undefined: cause === undefined,
  name: typeof cause?.name === 'string' ? cause.name : null,
  code: typeof cause?.code === 'string' ? cause.code : null,
  message: typeof cause?.message === 'string' ? cause.message : String(cause) });
const handled = value => { const promise = Promise.resolve(value); promise.catch(() => undefined); return promise; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The selected host namespace is an actual public import in the sealed entry module. */
export function createBrowserPngFixture({ backend, hostEntry, schedule }) {
  assertion(['canvas', 'webgpu'].includes(backend), 'One fixed backend required');
  const createHost = backend === 'canvas' ? hostEntry.createCanvasHost : hostEntry.createWebGPUHost;
  assertion(typeof createHost === 'function', 'Actual selected public host factory required');
  let operationDeadline, cleanupDeadline, started = false, closing = false, closePromise;
  let provider, observer, origin, replay, savedFrame, nextStep = 0, originRetired = false;
  let newCaptures = 0, savedReplays = 0;
  let rgbLease, rgbaLease, rgbTexture, rgbaTexture, images, actor, icon, pair, playback, clip, originalBorrowers;
  let resourceScope, animationScope, tickScope, observerRestored = false;
  const ports = [], leases = [], ticks = [], readers = [], operationRecords = [], sourceCanvases = [];
  const sourceBitmapDimensions = [], pending = new Set(), ticketRecords = [], diagnostics = [], cleanupErrors = [];
  let primaryOccurred = false, primary;
  const objectIds = new WeakMap(); let objectSerial = 0;
  function id(value) {
    if (value === null || typeof value !== 'object' && typeof value !== 'function') return null;
    if (!objectIds.has(value)) objectIds.set(value, ++objectSerial);
    return objectIds.get(value);
  }
  function first(cause) { if (!primaryOccurred) { primaryOccurred = true; primary = cause; } return cause; }
  function track(value, label, register) {
    const promise = handled(value), row = { id: ticketRecords.length + 1, label, settled: false };
    ticketRecords.push(row); pending.add(promise);
    // Register fulfilled ownership before an awaited assertion can fail or time out.
    handled(promise.then(result => {
      row.settled = true; row.fulfilled = true; pending.delete(promise);
      try { register?.(result); } catch (cause) { first(cause); }
    }, cause => { row.settled = true; row.fulfilled = false; row.error = errorData(cause); pending.delete(promise); }));
    return promise;
  }
  async function bounded(value, label, cleanup = false) {
    const original = handled(value), deadline = cleanup ? cleanupDeadline : operationDeadline;
    const delay = Math.min(20_000, deadline - Date.now());
    assertion(delay > 0, label + ' deadline expired', 'BIP_NATIVE_DEADLINE');
    let timer;
    try { return await Promise.race([original, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(label + ' pending'), { code: 'BIP_NATIVE_TIMEOUT' })), delay);
    })]); } finally { clearTimeout(timer); }
  }
  const clock = () => origin?.engine ? { state: origin.engine.clock.state,
    elapsedSeconds: origin.engine.clock.elapsedSeconds, tickId: origin.engine.clock.tickId } : null;
  function sourceImages() {
    return images?.map(image => ({ width: image.width, height: image.height, format: image.format,
      colorSpace: image.colorSpace, alphaMode: image.alphaMode, origin: image.origin,
      bytes: Array.from(copyImageData2DPixels(image)) })) ?? [];
  }
  function status(port) {
    if (backend !== 'webgpu' || !port?.host) return null;
    const value = port.host.getStatus();
    return { state: value.state, lastSerial: value.lastSerial, pendingFrames: value.pendingFrames,
      pendingUploadBytes: value.pendingUploadBytes, pendingReadbackBytes: value.pendingReadbackBytes,
      firstFailure: value.firstFailure === null ? null : errorData(value.firstFailure.cause),
      callbackFailureCount: value.callbackFailureCount, cleanupOutcome: value.cleanupOutcome };
  }
  function portData(port) {
    return { id: port.id, started: port.started, engineAcquired: !!port.engine, hostAcquired: !!port.host,
      deviceAcquired: !!port.device, engineDisposeFulfilled: port.engineDisposeFulfilled,
      safeHostReturn: port.safeHostReturn, deviceDestroyed: port.deviceDestroyed,
      deviceLoss: port.deviceLoss, adapterInfo: port.adapterInfo, quarantine: port.quarantine,
      renderSubmissions: port.renderSubmissions, close: port.closeState, hostStatus: status(port) };
  }
  function snapshot() {
    const observed = observer?.snapshot();
    return { backend, started, closing, nextStep, newCaptures, savedReplays, originRetired, observerRestored,
      primaryOccurred, primary: primaryOccurred ? errorData(primary) : null,
      cleanupErrors: cleanupErrors.map(errorData), pendingTickets: pending.size,
      tickets: ticketRecords.map(row => ({ ...row })), ports: ports.map(portData),
      clock: clock(), ticks: ticks.map(row => ({ ...row })), readers: readers.map(row => ({ ...row })),
      operations: operationRecords.map(row => ({ ...row })), sourceImages: sourceImages(),
      nativeSourceBitmapDimensions: sourceBitmapDimensions.map(row => ({ ...row })),
      nativeSourceCanvases: sourceCanvases.map(canvas => ({ id: id(canvas), width: canvas.width, height: canvas.height })),
      nativeObserver: observed ? { state: observed.state, restored: observed.restored,
        pendingDecodes: observed.pendingDecodes, failures: observed.failures.map(errorData),
        tickets: observed.tickets.map(ticket => ({ id: ticket.id, settled: ticket.settled,
          originalPromiseId: id(ticket.originalPromise), observationPromiseId: id(ticket.observerPromise),
          ...(ticket.settled ? { fulfilled: ticket.fulfilled, valueId: id(ticket.value),
            causePresent: Object.hasOwn(ticket, 'cause'), cause: Object.hasOwn(ticket, 'cause') ? errorData(ticket.cause) : null } : {}) })) } : null,
      diagnostics: diagnostics.map(row => ({ ...row })),
      browser: { isSecureContext, devicePixelRatio, userAgent: navigator.userAgent } };
  }
  async function openPort() {
    assertion(!closing && ports.length < 2, 'Only origin and fresh replay hosts admitted');
    const port = { id: ports.length, started: false, engineDisposeFulfilled: false, safeHostReturn: false,
      deviceDestroyed: false, deviceLoss: null, adapterInfo: null, quarantine: false,
      renderSubmissions: 0, closeState: 'not-started', native: new Set(), startups: new Set() };
    ports.push(port);
    port.canvas = document.createElement('canvas'); port.canvas.width = 8; port.canvas.height = 4;
    port.canvas.style.cssText = 'display:block;width:8px;height:4px;transform:none;border:0;padding:0;margin:0;background:transparent';
    document.body.appendChild(port.canvas);
    if (backend === 'webgpu') {
      assertion(isSecureContext && navigator.gpu, 'WebGPU unavailable', 'BIP_NATIVE_UNAVAILABLE');
      const adapter = await bounded(track(navigator.gpu.requestAdapter(), 'requestAdapter'), 'requestAdapter');
      assertion(adapter !== null && !closing, 'No adapter or closing origin', 'BIP_NATIVE_UNAVAILABLE');
      const info = adapter.info;
      port.adapterInfo = info ? Object.fromEntries(['vendor', 'architecture', 'device', 'description'].map(key => [key, String(info[key] ?? '')])) : null;
      const acquire = track(adapter.requestDevice(), 'requestDevice', device => {
        port.device = device; port.lost = handled(device.lost);
        handled(port.lost.then(loss => { port.deviceLoss = { reason: loss.reason, message: loss.message };
          if (!port.intentionalDestroy) first(Object.assign(new Error('Unexpected device loss'), { code: 'BIP_NATIVE_DEVICE_LOST' }));
        }, first));
        device.addEventListener('uncapturederror', event => first(event.error));
      });
      port.startups.add(acquire); handled(acquire.finally(() => port.startups.delete(acquire)));
      await bounded(acquire, 'requestDevice'); assertion(!closing, 'Late device after close');
      port.host = createHost({ canvas: port.canvas, device: { kind: 'borrow', device: port.device },
        pixelRatio: 1, maxBackingPixels: 32, enableReadback: true,
        onDiagnostic: value => { diagnostics.push(errorData(value.cause)); first(value.cause); } });
    } else port.host = createHost({ canvas: port.canvas, pixelRatio: 1, maxBackingPixels: 32 });
    const acquire = track(createEngine({ host: port.host, shutdownTimeoutMs: 20_000,
      clock: { maxDeltaSeconds: 0.5 }, onDiagnostic: value => { diagnostics.push(errorData(value.cause)); first(value.cause); } }),
    'createEngine', engine => { port.engine = engine; });
    port.startups.add(acquire); handled(acquire.finally(() => port.startups.delete(acquire)));
    await bounded(acquire, 'createEngine and host startup'); assertion(!closing, 'Late Engine after close');
    port.started = true; return port;
  }
  function retirePort(port) {
    if (port.closePromise) return port.closePromise;
    port.closeState = 'pending';
    port.closePromise = handled((async () => {
      try {
        // A timeout never settles a startup/readback ticket or grants device ownership release.
        await bounded(Promise.allSettled([...port.startups]), 'original startup settlement', true);
        assertion(port.startups.size === 0, 'Startup remains pending', 'BIP_NATIVE_CLOSE_UNSAFE');
        await bounded(Promise.allSettled([...port.native]), 'original native settlement', true);
        assertion(port.native.size === 0, 'Native ticket remains pending', 'BIP_NATIVE_CLOSE_UNSAFE');
        if (port.engine) { await bounded(track(port.engine.dispose(), 'Engine.dispose'), 'Engine/host retirement', true); port.engineDisposeFulfilled = true; }
        else if (port.host) await bounded(track(port.host.close(), 'host.close'), 'host without Engine', true);
        const state = status(port);
        port.safeHostReturn = !port.host || backend === 'canvas' || state.state === 'closed'
          && state.cleanupOutcome === 'safe' && state.pendingFrames === 0
          && state.pendingUploadBytes === 0 && state.pendingReadbackBytes === 0;
        assertion(port.safeHostReturn, 'Host has not safely returned', 'BIP_NATIVE_CLOSE_UNSAFE');
        if (port.device && !port.deviceDestroyed) {
          port.intentionalDestroy = true; port.device.destroy(); port.deviceDestroyed = true;
          await bounded(port.lost, 'owned device lost after destroy', true);
          assertion(port.deviceLoss?.reason === 'destroyed', 'Device loss reason differs', 'BIP_NATIVE_CLOSE_UNSAFE');
        }
        port.closeState = 'fulfilled';
      } catch (cause) { port.quarantine = true; port.closeState = 'rejected'; throw cause; }
    })());
    return port.closePromise;
  }
  function nativeRecord(row) {
    assertion(operationRecords.length < 64, 'Original operation ledger overflow', 'BIP_NATIVE_TRACE_LIMIT');
    const entry = { sequence: row.sequence, operation: row.operation, phase: row.phase,
      receiverId: id(row.receiver), valueId: id(row.value), causePresent: Object.hasOwn(row, 'cause'),
      cause: Object.hasOwn(row, 'cause') ? errorData(row.cause) : null };
    if (row.operation === 'decode' && row.phase === 'returned') {
      const [blob, options] = row.args;
      assertion(blob instanceof Blob && blob.size === 72 && blob.type === 'image/png', 'Original native PNG Blob');
      assertion(Object.isFrozen(options) && same(Object.keys(options), ['imageOrientation', 'premultiplyAlpha', 'colorSpaceConversion'])
        && options.imageOrientation === 'from-image' && options.premultiplyAlpha === 'none' && options.colorSpaceConversion === 'none', 'Captured frozen decode options');
      entry.blob = { id: id(blob), size: blob.size, type: blob.type, bytes: null };
      entry.options = { ...options }; entry.decodeId = row.decodeId;
      const bytes = track(blob.arrayBuffer(), 'original Blob bytes', buffer => { entry.blob.bytes = Array.from(new Uint8Array(buffer)); });
      origin.native.add(bytes); handled(bytes.finally(() => origin.native.delete(bytes)));
    }
    if (row.operation === 'decode' && row.phase === 'fulfilled') {
      sourceBitmapDimensions.push({ id: id(row.value), width: row.value.width, height: row.value.height });
    }
    if (row.operation === 'canvas-create' && row.phase === 'returned') sourceCanvases.push(row.value);
    if (row.operation === 'canvas-width' || row.operation === 'canvas-height') {
      entry.assigned = row.args[0]; entry.width = row.receiver.width; entry.height = row.receiver.height;
    }
    if (row.operation === 'canvas-readback' && row.phase === 'returned') {
      entry.readback = { width: row.value.width, height: row.value.height, colorSpace: row.value.colorSpace,
        bytes: Array.from(row.value.data) };
    }
    operationRecords.push(entry);
  }
  async function start(deadlines) {
    assertion(!started && !closing, 'Fixture start once'); started = true;
    operationDeadline = deadlines.operationDeadline; cleanupDeadline = deadlines.cleanupDeadline;
    assertion(Number.isSafeInteger(operationDeadline) && Number.isSafeInteger(cleanupDeadline)
      && operationDeadline > Date.now() && cleanupDeadline > operationDeadline, 'Finite original deadlines');
    try {
      origin = await openPort();
      // Install only the separately qualified six native forwarders. No realm or ports injected.
      observer = installBrowserPngNativeObserver({ onRecord: nativeRecord, maxRecords: 64 });
      const type = createAssetType('browser-png-native-originals', isTexture);
      const refs = schedule.fixtures.map(row => createAssetRef(type, row.name));
      const readerOptions = { async readBytes(ref, context) {
        assertion(this === readerOptions && refs.includes(ref) && Object.isFrozen(context), 'Original authenticated ref/context/receiver');
        const item = schedule.fixtures[refs.indexOf(ref)];
        const response = await fetch(item.route, { redirect: 'error', credentials: 'same-origin' });
        assertion(response.ok && new URL(response.url).origin === location.origin, 'Exact same-origin original PNG response');
        const bytes = new Uint8Array(await response.arrayBuffer());
        readers.push({ name: ref.id, route: item.route, contextFrozen: Object.isFrozen(context),
          resourceGeneration: context.resourceGeneration, taskId: context.taskId,
          originalReceiver: this === readerOptions, originalRef: refs.includes(ref), bytes: Array.from(bytes) });
        return bytes;
      } };
      provider = createBrowserTextureProvider(readerOptions); origin.engine.assets.register(type, provider);
      const a = track(origin.engine.assets.acquire(refs[0]), 'RGB first lease', value => leases.push(value));
      const b = track(origin.engine.assets.acquire(refs[0]), 'RGB retained lease', value => leases.push(value));
      const [firstLease, retained] = await bounded(Promise.all([a, b]), 'shared RGB leases');
      assertion(firstLease !== retained && firstLease.value === retained.value, 'Distinct leases share original loaded Texture');
      rgbLease = retained; rgbTexture = retained.value; firstLease.release();
      assertion(!rgbTexture.isDisposed && retained.value === rgbTexture, 'One release preserves retained demand');
      rgbaLease = await bounded(track(origin.engine.assets.acquire(refs[1]), 'RGBA retained lease', value => leases.push(value)), 'RGBA lease');
      rgbaTexture = rgbaLease.value; assertion(rgbTexture !== rgbaTexture, 'Two genuine Texture identities');
      images = [rgbTexture.imageData, rgbaTexture.imageData];
      resourceScope = origin.engine.createScope(); animationScope = origin.engine.createScope(); tickScope = origin.engine.createScope();
      resourceScope.use(rgbLease); resourceScope.use(rgbaLease);
      const rgbSheet = resourceScope.use(createSpriteSheet(rgbLease, [
        { name: 'red', x: 0, y: 0, width: 1, height: 1 }, { name: 'green', x: 1, y: 0, width: 1, height: 1 },
      ]));
      const rgbaSheet = resourceScope.use(createSpriteSheet(rgbaLease, [{ name: 'pair', x: 0, y: 0, width: 2, height: 1 }]));
      actor = resourceScope.use(rgbSheet.createBitmap('red')); icon = resourceScope.use(rgbSheet.createBitmap('green'));
      pair = resourceScope.use(rgbaSheet.createBitmap('pair'));
      originalBorrowers = [actor.textureLease, icon.textureLease, pair.textureLease];
      assertion(originalBorrowers[0] === rgbLease && originalBorrowers[1] === rgbLease && originalBorrowers[2] === rgbaLease,
        'Three actual sheet Bitmaps borrow the original retained leases');
      actor.x = 1; actor.y = 1; icon.x = 2; icon.y = 1; pair.x = 4; pair.y = 1;
      origin.engine.stage.addChild(actor); origin.engine.stage.addChild(icon); origin.engine.stage.addChild(pair);
      clip = createSequenceClip({ atlasWidth: 2, atlasHeight: 1, frames: [
        { ...rgbSheet.getRegion('red'), durationSeconds: 0.125 }, { ...rgbSheet.getRegion('green'), durationSeconds: 0.125 },
      ] });
      assertion(origin.engine.advanceTime(0) === undefined, 'Source zero seeds without a tick');
      origin.engine.clock.onTick(tickScope, value => { ticks.push({ ...value }); });
      playback = origin.engine.createSequencePlayback(animationScope, actor, clip, { mode: 'once' }); playback.start();
      assertion(clock().tickId === 0 && playback.lastSample.frameIndex === 0, 'Start samples without advancing time');
      await bounded(track(observer.close(), 'observer descriptor restoration'), 'observer.close'); observerRestored = true;
      await bounded(Promise.allSettled([...origin.native]), 'original Blob metadata settlement');
      const observed = observer.snapshot();
      assertion(observed.restored && observed.pendingDecodes === 0 && observed.failures.length === 0, 'Native operation observer restored without failures');
      assertion(readers.length === 2 && sourceCanvases.length === 2
        && sourceBitmapDimensions.length === 2 && sourceBitmapDimensions.every(row => row.width === 2 && row.height === 1)
        && operationRecords.filter(row => row.operation === 'decode' && row.phase === 'returned').length === 2
        && operationRecords.filter(row => row.operation === 'bitmap-close' && row.phase === 'returned').length === 2
        && operationRecords.filter(row => row.operation === 'canvas-readback' && row.phase === 'returned').length === 2
        && operationRecords.filter(row => ['canvas-width','canvas-height'].includes(row.operation) && row.assigned === 0 && row.phase === 'returned').length === 4
        && sourceCanvases.every(canvas => canvas.width === 0 && canvas.height === 0), 'Two actual native decode/readback/close/reset lifetimes');
      assertion(observed.tickets.every(ticket => ticket.settled && ticket.fulfilled && ticket.originalPromise !== ticket.observerPromise), 'Handled original decode tickets');
      return snapshot();
    } catch (cause) { throw first(cause); }
  }
  async function retireOrigin() {
    await retirePort(origin);
    await bounded(track(provider.close(), 'provider.close'), 'caller-owned provider.close', true);
    assertion(rgbTexture.isDisposed && rgbaTexture.isDisposed, 'Manager demand retires both issued Textures');
    assertion([actor, icon, pair].every(bitmap => bitmap.isDisposed && bitmap.textureLease === undefined)
      && resourceScope.state === 'closed' && animationScope.state === 'closed' && tickScope.state === 'closed',
    'Original caller Scopes and live Bitmap borrows retired');
    for (const lease of [rgbLease, rgbaLease]) {
      let refused = false; try { void lease.value; } catch (cause) { refused = cause?.code === 'ASSET_LEASE_RELEASED'; }
      assertion(refused, 'Retired original lease is unreadable');
    }
    assertion(savedFrame.images[0] === images[0] && savedFrame.images[1] === images[1], 'Saved frame retains exact owned images');
    sourceImages(); originRetired = true;
  }
  async function collectStep(step) {
    assertion(started && observerRestored && !closing && schedule.stepsPerBackend[nextStep]?.id === step, 'Exact literal step order');
    try {
      let port = origin, frame, sample = playback.lastSample;
      if (step === 'N2') {
        const tick = origin.engine.advanceTime(0.125);
        assertion(tick?.deltaSeconds === 0.125 && tick.tickId === 1, 'One literal advancing tick'); sample = playback.lastSample;
      }
      const beforeClock = clock();
      if (step === 'N3') { await retireOrigin(); replay = await openPort(); port = replay; frame = savedFrame; }
      else {
        frame = origin.engine.captureFrame(Object.freeze({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 }));
        newCaptures++;
        if (step === 'N1') savedFrame = frame;
      }
      const captureDidNotTick = clock().elapsedSeconds === beforeClock.elapsedSeconds && clock().tickId === beforeClock.tickId;
      const heldSampleUnchanged = playback.lastSample === sample;
      let raw, metadata;
      if (backend === 'webgpu') {
        const ticket = track(port.host.requestReadback(), 'WebGPU original readback');
        port.native.add(ticket); handled(ticket.finally(() => port.native.delete(ticket)));
        assertion(port.host.renderFrame(frame) === undefined, 'Synchronous public host submission'); port.renderSubmissions++;
        if (step === 'N3') savedReplays++;
        const idle = track(port.host.whenIdle(), 'WebGPU original idle');
        port.native.add(idle); handled(idle.finally(() => port.native.delete(idle)));
        const [result] = await bounded(Promise.all([ticket, idle]), 'native readback/idle');
        raw = Array.from(result.bytes);
        metadata = { width: result.width, height: result.height, byteLength: result.bytes.byteLength,
          frameId: result.frameId, serial: result.serial, format: result.format, sourceFormat: result.sourceFormat,
          colorSpace: result.colorSpace, alphaMode: result.alphaMode, origin: 'top-left', hostStatus: status(port) };
      } else {
        assertion(port.host.renderFrame(frame) === undefined, 'Synchronous public host submission'); port.renderSubmissions++;
        if (step === 'N3') savedReplays++;
        const context = port.canvas.getContext('2d'), result = context.getImageData(0, 0, 8, 4, { colorSpace: 'srgb' });
        raw = Array.from(result.data);
        metadata = { width: result.width, height: result.height, byteLength: result.data.byteLength,
          frameId: frame.frameId, serial: null, format: 'rgba8unorm', sourceFormat: null,
          colorSpace: result.colorSpace, alphaMode: 'straight', origin: 'top-left' };
      }
      const box = port.canvas.getBoundingClientRect(); nextStep++;
      return { backend, step, raw, metadata, css: { width: box.width, height: box.height,
        backingWidth: port.canvas.width, backingHeight: port.canvas.height, devicePixelRatio },
        frame: { frameId: frame.frameId, width: frame.width, height: frame.height, clearColor: frame.clearColor,
          clearAlpha: frame.clearAlpha, commands: frame.commands.length, images: frame.images.length,
          frozen: Object.isFrozen(frame) && Object.isFrozen(frame.commands) && Object.isFrozen(frame.images) },
        frameFullyFrozen: frame.commands.every(command => Object.isFrozen(command) && Object.isFrozen(command.sourceRect)
          && Object.isFrozen(command.rect) && Object.isFrozen(command.matrix) && Object.isFrozen(command.clips))
          && frame.images.every(Object.isFrozen),
        commands: frame.commands.map(command => ({ ...command })), sourceImages: sourceImages(), clock: clock(),
        originalImageIdentities: frame.images[0] === images[0] && frame.images[1] === images[1],
        sameOriginalLeases: step === 'N3' ? originalBorrowers[0] === rgbLease && originalBorrowers[1] === rgbLease && originalBorrowers[2] === rgbaLease
          : actor.textureLease === rgbLease && icon.textureLease === rgbLease && pair.textureLease === rgbaLease,
        captureDidNotTick, renderDidNotTick: clock().elapsedSeconds === beforeClock.elapsedSeconds && clock().tickId === beforeClock.tickId,
        heldSampleUnchanged: heldSampleUnchanged && playback.lastSample === sample,
        exactSavedN1: step === 'N3' ? frame === savedFrame : null,
        freshReplayHost: step === 'N3' ? replay.host !== origin.host : null,
        freshReplayEngine: step === 'N3' ? replay.engine !== origin.engine : null,
        freshReplayDevice: step === 'N3' && backend === 'webgpu' ? replay.device !== origin.device : null,
        originRetired, savedImagesReadable: step === 'N3' ? sourceImages().length === 2 : null,
        savedFrameId: savedFrame.frameId, snapshot: snapshot() };
    } catch (cause) { throw first(cause); }
  }
  function close() {
    if (closePromise) return closePromise;
    closing = true;
    closePromise = handled((async () => {
      // Cleanup attempts are separate occurrences; never erase an undefined primary.
      if (observer && !observerRestored) try { await bounded(observer.close(), 'late observer restoration', true); observerRestored = true; }
      catch (cause) { cleanupErrors.push(cause); }
      for (const port of [...ports].reverse()) try { await retirePort(port); } catch (cause) { cleanupErrors.push(cause); }
      if (provider) try { await bounded(track(provider.close(), 'final provider.close'), 'final caller-owned provider close', true); }
      catch (cause) { cleanupErrors.push(cause); }
      // Late acquisitions are retained tickets, not presumed fulfilled by a raced timeout.
      try { await bounded(Promise.allSettled([...pending]), 'all original admitted tickets', true); }
      catch (cause) { cleanupErrors.push(cause); }
      for (const lease of leases) try { lease.release(); } catch (cause) { cleanupErrors.push(cause); }
      if (pending.size || ports.some(port => port.quarantine)) cleanupErrors.push(Object.assign(new Error('Unsettled/quarantined owner'), { code: 'BIP_NATIVE_CLOSE_UNSAFE' }));
      return snapshot();
    })());
    return closePromise;
  }
  return Object.freeze({ start, collectStep, snapshot, close });
}
