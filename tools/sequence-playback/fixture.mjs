// First-party SequencePlayback public browser fixture. Apache-2.0.
// Uses only the supplied root and selected public host entry; no explicit player or sampler.
// Resource and observer Scopes remain separate from playback ownership.
const IDS = ['once-start', 'once-end', 'loop-start', 'loop-cross', 'loop-green',
  'paused-gap', 'resumed-held', 'resumed-blue', 'saved-red'];
const ATLAS = [
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255,
];
const observed = value => { const promise = Promise.resolve(value); promise.catch(() => undefined); return promise; };
const errorRecord = cause => ({ name: String(cause?.name ?? 'Error'), code: typeof cause?.code === 'string' ? cause.code : null, message: String(cause?.message ?? cause) });
const requireValue = (condition, message, code = 'PROBE_PROTOCOL') => { if (!condition) throw Object.assign(new Error(message), { code }); };


export function createFixture({ backend, egret, createHost }) {
  requireValue(['canvas', 'webgpu'].includes(backend), 'Fixed backend required');
  requireValue([createHost, egret?.createSequenceClip, egret?.createEngine,
    egret?.createImageData2D, egret?.copyImageData2DPixels, egret?.createTexture,
    egret?.createAssetType, egret?.createAssetRef, egret?.Bitmap].every(value => typeof value === 'function'),
    'Actual public APIs required');
  let operationDeadlineUTC, closeDeadlineUTC, started = false, closing = false, closingPromise, nextStep = 0;
  let image, imageObservation = null, texture, lease, bitmap, clip, once, loop, savedFrame;
  let resourceScope, playbackScope, observerScope, observerSubscription;
  let construction = null, loopConstruction = null, borrowerProof = null, shutdownProof = null;
  let heldSample, pausedSampleIdentitySame = null, resumedSampleFrozen = null, lastSource = 0;
  const ports = [], events = [], diagnostics = [], ticks = [];
  const resources = { imagesCreated: 0, texturesCreated: 0, leasesAcquired: 0,
    bitmapsCreated: 0, providerLoads: 0, providerDisposals: 0, playbackHandlesCreated: 0 };
  let firstError = null;
  const first = cause => { firstError ??= errorRecord(cause); return cause; };
  const append = (destination, value) => {
    if (destination.length < 128) destination.push(value);
    else first(Object.assign(new Error('Fixture event budget exhausted'), { code: 'PROBE_BUDGET' }));
  };
  const nativeFault = (kind, detail) => { append(events, { kind, ...detail }); first(Object.assign(new Error(kind), { code: 'PROBE_NATIVE_FAULT' })); };
  function track(set, value) {
    const promise = observed(value); set.add(promise);
    promise.then(() => set.delete(promise), () => set.delete(promise)); return promise;
  }
  async function bounded(value, label, deadline = operationDeadlineUTC) {
    const promise = observed(value), remaining = Math.min(20000, deadline - Date.now());
    if (remaining <= 0) throw first(Object.assign(new Error(label + ' deadline expired'), { code: 'PROBE_DEADLINE' }));
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(label + ' did not settle'), { code: 'PROBE_TIMEOUT' })), remaining); })]);
    } catch (cause) { throw first(cause); }
    finally { clearTimeout(timer); }
  }
  function status(port) {
    if (!port.host || backend !== 'webgpu') return null;
    const raw = port.host.getStatus();
    return { state: raw.state, lastSerial: raw.lastSerial, pendingFrames: raw.pendingFrames, pendingUploadBytes: raw.pendingUploadBytes,
      pendingReadbackBytes: raw.pendingReadbackBytes, firstFailure: raw.firstFailure === null ? null : { ...raw.firstFailure, cause: errorRecord(raw.firstFailure.cause) },
      callbackFailureCount: raw.callbackFailureCount, lastCallbackFailure: raw.lastCallbackFailure === null ? null : { ...raw.lastCallbackFailure, cause: errorRecord(raw.lastCallbackFailure.cause) }, cleanupOutcome: raw.cleanupOutcome };
  }
  const portRecord = port => ({ index: port.index, startup: port.startup, close: port.close, renderCalls: port.renderCalls, engineDisposeFulfilled: port.engineDisposeFulfilled,
    safeHostReturn: port.safeHostReturn, noHostLeaseCreated: port.noHostLeaseCreated, deviceAcquiredByCollector: port.deviceAcquiredByCollector,
    deviceDestroyedByCollector: port.deviceDestroyedByCollector, deviceLoss: port.deviceLoss, deviceLossInfo: port.deviceLossInfo,
    adapterInfo: port.adapterInfo, quarantine: port.quarantine, cleanupError: port.cleanupError,
    pendingStartup: port.pendingStartup.size, pendingNative: port.pendingNative.size, hostStatus: status(port) });

  const sampleRecord = sample => sample === undefined ? null : ({
    frameIndex: sample.frameIndex, positionSeconds: sample.positionSeconds,
    atEnd: sample.atEnd, stopped: sample.stopped, region: { ...sample.region },
    frozen: Object.isFrozen(sample) && Object.isFrozen(sample.region) });
  const handleRecord = handle => handle === undefined ? null : ({
    state: handle.state, isDisposed: handle.isDisposed, elapsedSeconds: handle.elapsedSeconds,
    lastSample: sampleRecord(handle.lastSample), frozen: Object.isFrozen(handle) });
  const clockRecord = () => ports[0]?.engine ? ({
    state: ports[0].engine.clock.state, elapsedSeconds: ports[0].engine.clock.elapsedSeconds,
    tickId: ports[0].engine.clock.tickId, maxDeltaSeconds: ports[0].engine.clock.maxDeltaSeconds }) : null;
  const snapshot = () => ({ backend, nextStep, closing, firstError, resources: { ...resources },
    image: imageObservation, construction, loopConstruction, borrowerProof, shutdownProof,
    playback: { once: handleRecord(once), loop: handleRecord(loop), pausedSampleIdentitySame, resumedSampleFrozen },
    clock: clockRecord(), scopes: { resource: resourceScope?.state ?? null,
      playback: playbackScope?.state ?? null, observer: observerScope?.state ?? null },
    observer: { exists: observerSubscription !== undefined, isDisposed: observerSubscription?.isDisposed ?? null,
      ticks: ticks.map(tick => ({ ...tick })), authority: 'public owned observer; not an internal handler count' },
    events: [...events], diagnostics: [...diagnostics], ports: ports.map(portRecord),
    browser: { isSecureContext, devicePixelRatio, userAgent: navigator.userAgent, platform: navigator.platform } });
  function stableClockAndSample(engine, handle, action) {
    const elapsed = engine.clock.elapsedSeconds, tickId = engine.clock.tickId, sample = handle.lastSample;
    const result = action();
    requireValue(engine.clock.elapsedSeconds === elapsed && engine.clock.tickId === tickId
      && handle.lastSample === sample, 'Capture/equal-source operation changed clock or cached sample');
    return result;
  }
  function advance(engine, source) { const tick = engine.advanceTime(source); lastSource = source; return tick; }
  async function openPort() {
    requireValue(!closing && ports.length < 2, 'Only origin and replay port permitted');
    requireValue(Date.now() < operationDeadlineUTC, 'Port creation deadline expired', 'PROBE_DEADLINE');
    const port = { index: ports.length, startup: 'pending', close: 'not-started', closing: false, closingPromise: undefined,
      pendingStartup: new Set(), pendingNative: new Set(), host: undefined, engine: undefined, device: undefined, renderCalls: 0,
      deviceLost: undefined, intentionalDestroy: false, engineDisposeFulfilled: false, safeHostReturn: false, noHostLeaseCreated: false,
      deviceAcquiredByCollector: false, deviceDestroyedByCollector: false, deviceLoss: 'not-acquired', deviceLossInfo: null,
      adapterInfo: null, quarantine: false, cleanupError: null };
    ports.push(port);
    port.canvas = document.createElement('canvas'); port.canvas.width = 8; port.canvas.height = 4;
    port.canvas.style.cssText = 'display:block;width:8px;height:4px;opacity:1;transform:none;border:0;padding:0;margin:0;background:transparent';
    document.body.appendChild(port.canvas);
    try {
      if (backend === 'webgpu') {
        requireValue(isSecureContext && navigator.gpu !== undefined, 'Actual secure WebGPU unavailable', 'PROBE_UNAVAILABLE');
        const adapter = await bounded(track(port.pendingStartup, navigator.gpu.requestAdapter()), 'requestAdapter');
        requireValue(!closing && !port.closing && adapter !== null, 'Adapter unavailable or close began', adapter === null ? 'PROBE_UNAVAILABLE' : 'PROBE_PROTOCOL');
        const info = adapter.info;
        port.adapterInfo = info ? Object.fromEntries(['vendor', 'architecture', 'device', 'description'].map(key => [key, String(info[key] ?? '')])) : null;
        requireValue(Date.now() < operationDeadlineUTC, 'Device acquisition deadline expired', 'PROBE_DEADLINE');
        const acquisition = track(port.pendingStartup, adapter.requestDevice());
        observed(acquisition.then(device => {
          port.device = device; port.deviceAcquiredByCollector = true; port.deviceLoss = 'pending'; port.deviceLost = observed(device.lost);
          observed(port.deviceLost.then(info => {
            port.deviceLoss = 'fulfilled'; port.deviceLossInfo = { reason: info.reason, message: info.message };
            if (!port.intentionalDestroy) nativeFault('unexpected-device-loss', { portIndex: port.index, ...port.deviceLossInfo });
          }, cause => { port.deviceLoss = 'rejected'; nativeFault('device-loss-rejection', { portIndex: port.index, error: errorRecord(cause) }); })).catch(cause => first(cause));
          device.addEventListener('uncapturederror', event => nativeFault('uncaptured-gpu-error', { portIndex: port.index, error: errorRecord(event.error) }));
        }, () => undefined)).catch(cause => first(cause));
        await bounded(acquisition, 'requestDevice');
        requireValue(!closing && !port.closing, 'Close began during device acquisition');
        requireValue(Date.now() < operationDeadlineUTC, 'Host creation deadline expired', 'PROBE_DEADLINE');
        port.host = createHost({ canvas: port.canvas, device: { kind: 'borrow', device: port.device }, pixelRatio: 1,
          maxBackingPixels: 32, enableReadback: true, onDiagnostic: diagnostic => append(diagnostics, { portIndex: port.index, ...diagnostic, cause: errorRecord(diagnostic.cause) }) });
      } else port.host = createHost({ canvas: port.canvas, pixelRatio: 1, maxBackingPixels: 32 });
      requireValue(Date.now() < operationDeadlineUTC, 'Engine startup deadline expired', 'PROBE_DEADLINE');
      const acquisition = track(port.pendingStartup, egret.createEngine({ host: port.host, shutdownTimeoutMs: 20000, clock: { maxDeltaSeconds: 0.5 },
        onDiagnostic: diagnostic => append(diagnostics, { portIndex: port.index, ...diagnostic, cause: errorRecord(diagnostic.cause) }) }));
      // Record a late engine before cleanup decides whether to close its host.
      observed(acquisition.then(engine => { port.engine = engine; }, () => undefined)).catch(cause => first(cause));
      await bounded(acquisition, 'createEngine and actual host startup');
      requireValue(!closing && !port.closing, 'Close began during engine startup');
      port.startup = 'fulfilled'; return port;
    } catch (cause) { port.startup = 'rejected'; throw first(cause); }
  }
  function closePort(port) {
    if (port.closingPromise) return port.closingPromise;
    port.closing = true; port.close = 'pending';
    port.closingPromise = observed((async () => {
      try {
        // Settle acquisition first so a late engine cannot appear after host close.
        await bounded(Promise.allSettled([...port.pendingStartup]), 'startup settlement', closeDeadlineUTC);
        requireValue(port.pendingStartup.size === 0, 'Startup still pending', 'PROBE_CLOSE_UNSAFE');
        if (port.engine) {
          await bounded(port.engine.dispose(), 'Engine.dispose and host close', closeDeadlineUTC);
          port.engineDisposeFulfilled = true;
        } else if (port.host) await bounded(port.host.close(), 'host.close without acquired engine', closeDeadlineUTC);
        else port.noHostLeaseCreated = true;
        // Host close cancels/drains queued tickets; then their promises settle.
        await bounded(Promise.allSettled([...port.pendingNative]), 'native ticket settlement', closeDeadlineUTC);
        requireValue(port.pendingNative.size === 0, 'Native work still pending', 'PROBE_CLOSE_UNSAFE');
        const current = status(port);
        port.safeHostReturn = !port.host || backend === 'canvas' || current.state === 'closed' && current.cleanupOutcome === 'safe'
          && current.pendingFrames === 0 && current.pendingUploadBytes === 0 && current.pendingReadbackBytes === 0;
        requireValue(port.safeHostReturn, 'Host did not return safely', 'PROBE_CLOSE_UNSAFE');
        if (port.device) {
          port.intentionalDestroy = true; port.device.destroy(); port.deviceDestroyedByCollector = true;
          const info = await bounded(port.deviceLost, 'owned device.lost after safe host return and destroy', closeDeadlineUTC);
          requireValue(info.reason === 'destroyed', 'Owned device loss reason differs', 'PROBE_CLOSE_UNSAFE');
        }
        port.canvas.remove(); port.close = 'fulfilled';
      } catch (cause) {
        first(cause); port.close = 'rejected'; port.quarantine = true; port.cleanupError = errorRecord(cause);
        // Never destroy a borrowed device on timeout or rejected safe return.
      }
      return portRecord(port);
    })());
    return port.closingPromise;
  }

  async function start(input) {
    requireValue(!started && !closing, 'Start only once'); started = true;
    operationDeadlineUTC = input.operationDeadlineUTC; closeDeadlineUTC = input.closeDeadlineUTC;
    requireValue(Number.isSafeInteger(operationDeadlineUTC) && Number.isSafeInteger(closeDeadlineUTC)
      && operationDeadlineUTC > Date.now() && operationDeadlineUTC <= Date.now() + 240000
      && closeDeadlineUTC > operationDeadlineUTC && closeDeadlineUTC <= Date.now() + 280000,
      'Finite released deadlines required');
    try {
      const origin = await openPort();
      requireValue(typeof origin.engine.createSequencePlayback === 'function',
        'Live Engine SequencePlayback factory required');
      image = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(ATLAS),
        format: 'rgba8unorm', colorSpace: 'srgb', alphaMode: 'straight', origin: 'top-left' });
      resources.imagesCreated++;
      const copied = egret.copyImageData2DPixels(image);
      requireValue(copied.length === 48 && copied.every((byte, index) => byte === ATLAS[index]),
        'Authentic atlas CPU copy differs');
      imageObservation = { width: image.width, height: image.height, bytesPerRow: image.bytesPerRow,
        byteLength: image.byteLength, format: image.format, colorSpace: image.colorSpace,
        alphaMode: image.alphaMode, origin: image.origin, frozen: Object.isFrozen(image),
        copiedRGBA: Array.from(copied) };
      texture = egret.createTexture(image); resources.texturesCreated++;
      const type = egret.createAssetType('sequence-playback-browser-atlas', egret.isTexture);
      origin.engine.assets.register(type, {
        load: async () => { resources.providerLoads++; return texture; },
        dispose: value => { resources.providerDisposals++; value.dispose(); } });
      lease = await bounded(track(origin.pendingStartup,
        origin.engine.assets.acquire(egret.createAssetRef(type, 'single-atlas'))), 'one atlas lease');
      resources.leasesAcquired++; requireValue(!closing, 'Close began during asset acquisition');
      resourceScope = origin.engine.createScope(); playbackScope = origin.engine.createScope();
      observerScope = origin.engine.createScope();
      resourceScope.use(lease);
      bitmap = resourceScope.use(new egret.Bitmap(lease)); resources.bitmapsCreated++;
      bitmap.x = 1; bitmap.y = 1; origin.engine.stage.addChild(bitmap);
      clip = egret.createSequenceClip({ atlasWidth: 6, atlasHeight: 2, frames: [
        { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.125 },
        { x: 2, y: 0, width: 1, height: 2, durationSeconds: 0.25 },
        { x: 3, y: 0, width: 3, height: 1, durationSeconds: 0.125 },
      ] });
      requireValue(advance(origin.engine, 0) === undefined && origin.engine.clock.elapsedSeconds === 0
        && origin.engine.clock.tickId === 0, 'Actual source baseline required');
      observerSubscription = origin.engine.clock.onTick(observerScope, tick => {
        append(ticks, { tickId: tick.tickId, elapsedSeconds: tick.elapsedSeconds, deltaSeconds: tick.deltaSeconds });
        return undefined;
      });
      const initialRect = bitmap.sourceRect;
      once = origin.engine.createSequencePlayback(playbackScope, bitmap, clip);
      resources.playbackHandlesCreated++;
      construction = { cropUnchanged: bitmap.sourceRect === initialRect,
        naturalSize: [bitmap.naturalWidth, bitmap.naturalHeight],
        leaseIdentitySame: bitmap.textureLease === lease && lease.value === texture,
        initialState: once.state, initialElapsed: once.elapsedSeconds,
        initialLastSampleAbsent: once.lastSample === undefined, initiallyLive: once.isDisposed === false,
        clockUnchanged: origin.engine.clock.elapsedSeconds === 0 && origin.engine.clock.tickId === 0 };
      requireValue(construction.cropUnchanged && construction.naturalSize[0] === 6
        && construction.naturalSize[1] === 2 && construction.leaseIdentitySame
        && construction.initialState === 'idle' && construction.initialElapsed === 0
        && construction.initialLastSampleAbsent && construction.initiallyLive && construction.clockUnchanged,
        'Public idle factory changed target/time');
      return snapshot();
    } catch (cause) { throw first(cause); }
  }
  async function collectStep(step) {
    requireValue(started && !closing && nextStep < IDS.length && step === IDS[nextStep]
      && ports[0].startup === 'fulfilled', 'Nine exact ordered submissions only');
    requireValue(Date.now() < operationDeadlineUTC, 'Frame deadline expired', 'PROBE_DEADLINE');
    const index = nextStep++; let port = ports[0], frame, naturalSize = null, leaseIdentitySame = false;
    try {
      if (index < 8) {
        const engine = port.engine;
        if (index === 0) once.start();
        else if (index === 1) advance(engine, 0.5);
        else if (index === 2) {
          const priorCrop = bitmap.sourceRect, priorClock = engine.clock.elapsedSeconds;
          loop = engine.createSequencePlayback(playbackScope, bitmap, clip, { mode: 'loop' });
          resources.playbackHandlesCreated++;
          loopConstruction = { priorOnceCompleted: once.state === 'completed' && once.isDisposed,
            cropUnchanged: bitmap.sourceRect === priorCrop, initialState: loop.state,
            initialElapsed: loop.elapsedSeconds, initialLastSampleAbsent: loop.lastSample === undefined,
            clockUnchanged: engine.clock.elapsedSeconds === priorClock };
          requireValue(loopConstruction.priorOnceCompleted && loopConstruction.cropUnchanged
            && loopConstruction.initialState === 'idle' && loopConstruction.initialElapsed === 0
            && loopConstruction.initialLastSampleAbsent && loopConstruction.clockUnchanged,
            'Completed once claim did not admit unchanged idle loop');
          loop.start();
        } else if (index === 3) advance(engine, 1);
        else if (index === 4) advance(engine, 1.125);
        else if (index === 5) {
          heldSample = loop.lastSample; loop.pause(); advance(engine, 1.625);
          pausedSampleIdentitySame = loop.lastSample === heldSample;
          requireValue(pausedSampleIdentitySame, 'Paused gap replaced held sample');
        } else if (index === 6) {
          loop.resume();
          resumedSampleFrozen = Object.isFrozen(loop.lastSample) && Object.isFrozen(loop.lastSample.region);
        } else advance(engine, 1.875);
        const current = index < 2 ? once : loop;
        requireValue(stableClockAndSample(engine, current, () => engine.advanceTime(lastSource)) === undefined,
          'Equal source produced a new tick');
        frame = stableClockAndSample(engine, current,
          () => engine.captureFrame(Object.freeze({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 })));
        naturalSize = [bitmap.naturalWidth, bitmap.naturalHeight];
        leaseIdentitySame = bitmap.textureLease === lease && lease.value === texture;
        if (index === 0) savedFrame = frame;
      } else {
        const onceSample = once.lastSample, loopSample = loop.lastSample;
        playbackScope.dispose();
        borrowerProof = { onceRemainsCompleted: once.state === 'completed' && once.isDisposed,
          loopStopped: loop.state === 'stopped' && loop.isDisposed,
          cachedSamplesIdentical: once.lastSample === onceSample && loop.lastSample === loopSample,
          playbackScopeClosed: playbackScope.state === 'closed', bitmapStillLive: !bitmap.isDisposed,
          leaseIdentitySame: bitmap.textureLease === lease, liveLeaseReadEqualsOriginalTexture: lease.value === texture,
          textureStillLive: !texture.isDisposed, providerDisposalsBeforeCallerRelease: resources.providerDisposals };
        requireValue(Object.values(borrowerProof).every(value => value === true || value === 0),
          'Playback cleanup changed borrowed resources/cache');
        resourceScope.dispose(); observerScope.dispose(); texture.dispose();
        let leaseReadCode = null;
        try { void lease.value; } catch (cause) { leaseReadCode = cause?.code ?? null; }
        const returned = await closePort(port);
        shutdownProof = { leaseReadCode, textureDisposed: texture.isDisposed,
          bitmapDisposed: bitmap.isDisposed, bitmapCleared: bitmap.textureLease === undefined
            && bitmap.sourceRect === undefined && bitmap.naturalWidth === 0 && bitmap.naturalHeight === 0,
          scopesClosed: [resourceScope, playbackScope, observerScope].every(scope => scope.state === 'closed'),
          observerDisposed: observerSubscription.isDisposed, clockClosed: port.engine.clock.state === 'closed',
          retainedSamplesIdentical: once.lastSample === onceSample && loop.lastSample === loopSample,
          originEngineDisposeFulfilled: returned.engineDisposeFulfilled, originHostSafe: returned.safeHostReturn,
          originDeviceDestroyed: returned.deviceDestroyedByCollector, originDeviceLoss: returned.deviceLossInfo };
        requireValue(returned.close === 'fulfilled' && !returned.quarantine
          && leaseReadCode === 'ASSET_LEASE_RELEASED' && shutdownProof.textureDisposed
          && shutdownProof.bitmapDisposed && shutdownProof.bitmapCleared && shutdownProof.scopesClosed
          && shutdownProof.observerDisposed && shutdownProof.clockClosed && shutdownProof.retainedSamplesIdentical
          && resources.providerDisposals === 1, 'Caller/origin shutdown incomplete', 'PROBE_CLOSE_UNSAFE');
        const copied = egret.copyImageData2DPixels(image);
        requireValue(copied.length === 48 && copied.every((byte, offset) => byte === ATLAS[offset]),
          'Saved authentic image changed after shutdown');
        port = await openPort(); frame = savedFrame;
      }
      requireValue(frame.commands.length === 1 && frame.images.length === 1 && frame.images[0] === image,
        'One shared authentic image command required');
      const command = frame.commands[0], issues = [];
      const originClock = clockRecord(), cachedOnce = once.lastSample, cachedLoop = loop?.lastSample;
      let raw, metadata;
      if (backend === 'webgpu') {
        // Acquire the readback ticket before render and register idle before waiting.
        const ticket = track(port.pendingNative, port.host.requestReadback());
        port.renderCalls++; if (port.host.renderFrame(frame) !== undefined) issues.push('renderFrame result differs');
        const idle = track(port.pendingNative, port.host.whenIdle());
        const [readback] = await bounded(Promise.all([ticket, idle]), 'raw readback and whenIdle');
        requireValue(readback.bytes instanceof Uint8Array && readback.bytes.length === 128, 'Raw GPU storage envelope');
        raw = Array.from(readback.bytes);
        metadata = { frameId: readback.frameId, serial: readback.serial, width: readback.width, height: readback.height,
          format: readback.format, sourceFormat: readback.sourceFormat, colorSpace: readback.colorSpace,
          alphaMode: readback.alphaMode, byteLength: raw.length, origin: 'top-left', hostStatus: status(port) };
      } else {
        port.renderCalls++; if (port.host.renderFrame(frame) !== undefined) issues.push('renderFrame result differs');
        const context = port.canvas.getContext('2d'); requireValue(context !== null, 'Intrinsic Canvas context unavailable');
        const attributes = context.getContextAttributes(), capture = context.getImageData(0, 0, 8, 4, { colorSpace: 'srgb' });
        requireValue(capture.data instanceof Uint8ClampedArray && capture.data.length === 128, 'Raw Canvas storage envelope');
        raw = Array.from(capture.data);
        metadata = { frameId: frame.frameId, serial: null, width: capture.width, height: capture.height, format: 'rgba8unorm',
          sourceFormat: null, colorSpace: capture.colorSpace, alphaMode: 'straight', byteLength: raw.length,
          origin: 'top-left', contextAttributes: { ...attributes }, hostStatus: null };
        if (attributes.colorSpace !== 'srgb' || context.isContextLost?.()) issues.push('Canvas context metadata/loss');
      }
      requireValue(clockRecord().elapsedSeconds === originClock.elapsedSeconds && clockRecord().tickId === originClock.tickId
        && once.lastSample === cachedOnce && loop?.lastSample === cachedLoop, 'Render/replay advanced original clock/sample');
      const rect = port.canvas.getBoundingClientRect();
      const css = { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        canvasWidth: port.canvas.width, canvasHeight: port.canvas.height, browserDPR: devicePixelRatio };
      return { step, backend, portIndex: port.index, raw, metadata, css, command: { ...command },
        naturalSize, leaseIdentitySame, imageIdentitySame: frame.images[0] === image,
        textureBase: { ...texture.sourceRect }, captureAfterShutdown: false,
        replayHostDistinct: index === 8 ? port.host !== ports[0].host && port.engine !== ports[0].engine : null,
        replayDeviceDistinct: index === 8 && backend === 'webgpu' ? port.device !== ports[0].device : null,
        savedFrameFrozen: Object.isFrozen(savedFrame) && Object.isFrozen(savedFrame.commands)
          && Object.isFrozen(savedFrame.images) && Object.isFrozen(savedFrame.commands[0])
          && Object.isFrozen(savedFrame.commands[0].sourceRect) && Object.isFrozen(savedFrame.commands[0].rect)
          && Object.isFrozen(savedFrame.commands[0].matrix), issues, ...snapshot() };
    } catch (cause) { throw first(cause); }
  }
  function close() {
    if (closingPromise) return closingPromise;
    closing = true;
    closingPromise = observed((async () => {
      // Failure cleanup is caller ownership, never substituted for borrower proof.
      for (const action of [() => playbackScope?.dispose(), () => resourceScope?.dispose(),
        () => observerScope?.dispose(), () => bitmap?.dispose(), () => lease?.release(), () => texture?.dispose()]) {
        try { action(); } catch (cause) { first(cause); }
      }
      for (const port of [...ports].reverse()) await closePort(port);
      return snapshot();
    })());
    return closingPromise;
  }
  return Object.freeze({ start, collectStep, close, snapshot });
}
