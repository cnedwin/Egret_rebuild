// Independently authored literal opaque and public-state oracle. Apache-2.0.
// No product/sampler/rasterizer imports or expected-value fitting from observed bytes.
export const STEPS = Object.freeze(['once-start', 'once-end', 'loop-start', 'loop-cross',
  'loop-green', 'paused-gap', 'resumed-held', 'resumed-blue', 'saved-red']);
const selections = Object.freeze(['R', 'B', 'R', 'R', 'G', 'G', 'G', 'B', 'R']);
const masks = Object.freeze({
  R: Object.freeze(['........', '.RR.....', '.RR.....', '........']),
  G: Object.freeze(['........', '.G......', '.G......', '........']),
  B: Object.freeze(['........', '.BBB....', '........', '........']),
});
const colors = Object.freeze({ '.': [0, 0, 0, 0], R: [255, 0, 0, 255],
  G: [0, 255, 0, 255], B: [0, 0, 255, 255] });
const crops = Object.freeze({
  R: Object.freeze({ x: 0, y: 0, width: 2, height: 2 }),
  G: Object.freeze({ x: 2, y: 0, width: 1, height: 2 }),
  B: Object.freeze({ x: 3, y: 0, width: 3, height: 1 }),
});
const frameIds = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 1]);
const serials = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 1]);
const clockElapsed = Object.freeze([0, 0.5, 0.5, 1, 1.125, 1.625, 1.625, 1.875, 1.875]);
const clockTicks = Object.freeze([0, 1, 1, 2, 3, 4, 4, 5, 5]);
const loopElapsed = Object.freeze([0, 0.5, 0.625, 0.625, 0.625, 0.875, 0.875]);
const loopPositions = Object.freeze([0, 0, 0.125, 0.125, 0.125, 0.375, 0.375]);
const loopFrames = Object.freeze([0, 0, 1, 1, 1, 2, 2]);
const expectedObserverTicks = Object.freeze([
  { tickId: 1, elapsedSeconds: 0.5, deltaSeconds: 0.5 },
  { tickId: 2, elapsedSeconds: 1, deltaSeconds: 0.5 },
  { tickId: 3, elapsedSeconds: 1.125, deltaSeconds: 0.125 },
  { tickId: 4, elapsedSeconds: 1.625, deltaSeconds: 0.5 },
  { tickId: 5, elapsedSeconds: 1.875, deltaSeconds: 0.25 },
]);
const literal = index => masks[selections[index]].flatMap(row => [...row].flatMap(char => colors[char]));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function expectationManifest() {
  return { schemaVersion: 'sequence-playback-opaque-oracle/1', width: 8, height: 4,
    browserDPR: 1, hostPixelRatio: 1, backendIds: ['canvas', 'webgpu'],
    steps: STEPS.map((id, index) => { const crop = crops[selections[index]]; return {
      id, frameId: frameIds[index], serial: serials[index], sourceRect: crop,
      destination: { x: 0, y: 0, width: crop.width, height: crop.height },
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 1 }, mask: masks[selections[index]],
      expectedRGBA: literal(index), clockElapsedSeconds: clockElapsed[index],
      tickId: clockTicks[index], isReplay: index === 8 }; }),
    expectationAuthority: 'accepted named step matrix, independent literal RGBA/coordinates, sealed before launch',
    usesActualBytesToChooseExpectations: false, tolerance: 0,
    requiredSubmissions: 18, requiredNewCaptures: 16, requiredReplays: 2,
    requiredPixelComparisons: 576, requiredChannelComparisons: 2304,
    countsAreCompletenessRequirementsNotObservedResults: true,
    fullPlayerLifecycle: false, alphaBlendCalibration: false, performance: false };
}
function sampleExpected(frameIndex, positionSeconds, atEnd, crop) {
  return { frameIndex, positionSeconds, atEnd, stopped: false, region: crop, frozen: true };
}
export function inspectPlaybackProof(packet, retired = false) {
  const index = retired ? 8 : STEPS.indexOf(packet?.step), issues = [];
  const check = (condition, message) => { if (!condition) issues.push(message); };
  check(index >= 0 && packet?.nextStep === index + 1, 'Ordered current public playback protocol');
  if (index < 0) return { pass: false, issues };
  const constructor = packet.construction, playback = packet.playback;
  check(constructor?.cropUnchanged === true && same(constructor.naturalSize, [6, 2])
    && constructor.leaseIdentitySame === true && constructor.initialState === 'idle'
    && constructor.initialElapsed === 0 && constructor.initialLastSampleAbsent === true
    && constructor.initiallyLive === true && constructor.clockUnchanged === true,
    'Actual public idle factory preserves target and clock');
  const once = playback?.once;
  check(once?.state === (index === 0 ? 'running' : 'completed')
    && once.isDisposed === (index !== 0) && once.elapsedSeconds === (index === 0 ? 0 : 0.5)
    && once.frozen === true
    && same(once.lastSample, sampleExpected(index === 0 ? 0 : 2, index === 0 ? 0 : 0.5,
      index !== 0, index === 0 ? crops.R : crops.B)), 'Once public clock-driven completion/sample');
  if (index < 2) check(playback?.loop === null && packet.loopConstruction === null, 'Loop not created early');
  else {
    const initial = packet.loopConstruction, loop = playback?.loop;
    check(initial?.priorOnceCompleted === true && initial.cropUnchanged === true
      && initial.initialState === 'idle' && initial.initialElapsed === 0
      && initial.initialLastSampleAbsent === true && initial.clockUnchanged === true,
      'Completed same-target claim admits real idle loop');
    const state = index === 8 ? 'stopped' : index === 5 ? 'paused' : 'running';
    check(loop?.state === state && loop.isDisposed === (index === 8) && loop.frozen === true
      && loop.elapsedSeconds === loopElapsed[index - 2]
      && same(loop.lastSample, sampleExpected(loopFrames[index - 2], loopPositions[index - 2],
        false, loopFrames[index - 2] === 0 ? crops.R : loopFrames[index - 2] === 1 ? crops.G : crops.B)),
      'Loop crossing/pause/resume literal elapsed and sample');
  }
  check(packet.clock?.state === (index === 8 ? 'closed' : 'running')
    && packet.clock.elapsedSeconds === clockElapsed[index] && packet.clock.tickId === clockTicks[index]
    && packet.clock.maxDeltaSeconds === 0.5, 'Actual public clock state and finite ceiling');
  check(packet.observer?.exists === true && packet.observer.isDisposed === (index === 8)
    && same(packet.observer.ticks, expectedObserverTicks.slice(0, clockTicks[index])),
    'Authentic public observer tick prefix/disposal; no internal handler count');
  check(packet.scopes?.resource === (index === 8 ? 'closed' : 'open')
    && packet.scopes.playback === (index === 8 ? 'closed' : 'open')
    && packet.scopes.observer === (index === 8 ? 'closed' : 'open'), 'Separate actual Scope states');
  check(index < 5 ? playback.pausedSampleIdentitySame === null : playback.pausedSampleIdentitySame === true,
    'Pause gap keeps exact held sample');
  check(index < 6 ? playback.resumedSampleFrozen === null : playback.resumedSampleFrozen === true,
    'Resume held sample remains immutable');
  check(packet.resources?.imagesCreated === 1 && packet.resources.texturesCreated === 1
    && packet.resources.leasesAcquired === 1 && packet.resources.bitmapsCreated === 1
    && packet.resources.providerLoads === 1 && packet.resources.providerDisposals === (index === 8 ? 1 : 0)
    && packet.resources.playbackHandlesCreated === (index < 2 ? 1 : 2), 'Logical creation and caller-owned disposal');
  check(packet.firstError === null && packet.events?.length === 0 && packet.diagnostics?.length === 0,
    'No fixture native or cleanup fault');
  if (index === 8) {
    const proof = packet.borrowerProof, close = packet.shutdownProof;
    check(proof?.onceRemainsCompleted === true && proof.loopStopped === true
      && proof.cachedSamplesIdentical === true && proof.playbackScopeClosed === true
      && proof.bitmapStillLive === true && proof.leaseIdentitySame === true
      && proof.liveLeaseReadEqualsOriginalTexture === true && proof.textureStillLive === true
      && proof.providerDisposalsBeforeCallerRelease === 0, 'Live exact borrow after playback Scope cleanup');
    check(close?.leaseReadCode === 'ASSET_LEASE_RELEASED' && close.textureDisposed === true
      && close.bitmapDisposed === true && close.bitmapCleared === true && close.scopesClosed === true
      && close.observerDisposed === true && close.clockClosed === true && close.retainedSamplesIdentical === true
      && close.originEngineDisposeFulfilled === true && close.originHostSafe === true,
      'Caller resources and origin Engine retire before saved replay');
    if (packet.backend === 'webgpu') check(close.originDeviceDestroyed === true
      && close.originDeviceLoss?.reason === 'destroyed', 'Original owned device destroyed only after safe return');
    if (retired) check(packet.closing === true, 'Final fixture closed through own cleanup');
  } else check(packet.borrowerProof === null && packet.shutdownProof === null, 'No fabricated early retirement proof');
  return { pass: issues.length === 0, issues };
}
export function inspectCapture(packet) {
  const index = STEPS.indexOf(packet?.step), issues = [], mismatches = [];
  let channelComparisons = 0, pixelComparisons = 0;
  const check = (condition, message) => { if (!condition) issues.push(message); };
  check(index >= 0 && ['canvas', 'webgpu'].includes(packet?.backend), 'Unknown named step/backend');
  if (index < 0) return { pass: false, issues, mismatches, pixelComparisons, channelComparisons, tolerance: 0 };
  issues.push(...inspectPlaybackProof(packet).issues);
  const crop = crops[selections[index]], metadata = packet.metadata, command = packet.command;
  const rawValid = Array.isArray(packet.raw) && packet.raw.length === 128
    && packet.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255);
  check(rawValid, 'Exactly 128 original raw RGBA bytes');
  check(metadata?.width === 8 && metadata.height === 4 && metadata.byteLength === 128
    && metadata.frameId === frameIds[index] && metadata.serial === (packet.backend === 'webgpu' ? serials[index] : null),
    'Literal frame identity and owned host submission serial');
  check(metadata?.format === 'rgba8unorm' && metadata.colorSpace === 'srgb' && metadata.origin === 'top-left'
    && metadata.alphaMode === (packet.backend === 'canvas' ? 'straight' : 'premultiplied'), 'Canonical raw pixel contract');
  check(same(packet.css, { x: 0, y: 0, width: 8, height: 4, canvasWidth: 8, canvasHeight: 4, browserDPR: 1 }),
    '8x4 actual CSS/backing and DPR1');
  check(command?.kind === 'image' && command.imageIndex === 0 && command.alpha === 1 && command.clips?.length === 0
    && same(command.sourceRect, crop) && same(command.rect, { x: 0, y: 0, width: crop.width, height: crop.height })
    && same(command.matrix, { a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 1 }), 'Literal opaque image geometry');
  check(packet.imageIdentitySame === true && packet.savedFrameFrozen === true && packet.issues?.length === 0,
    'Authentic shared image, frozen saved frame and submission protocol');
  check(packet.image?.width === 6 && packet.image.height === 2 && packet.image.bytesPerRow === 24
    && packet.image.byteLength === 48 && packet.image.format === 'rgba8unorm' && packet.image.colorSpace === 'srgb'
    && packet.image.alphaMode === 'straight' && packet.image.origin === 'top-left' && packet.image.frozen === true,
    'Authentic complete atlas metadata');
  check(same(packet.textureBase, { x: 0, y: 0, width: 6, height: 2 }), 'Full atlas base unchanged');
  if (index < 8) check(packet.portIndex === 0 && packet.ports?.length === 1
    && packet.ports[0].renderCalls === index + 1 && packet.leaseIdentitySame === true
    && same(packet.naturalSize, [crop.width, crop.height]) && packet.captureAfterShutdown === false,
    'Eight live-origin explicit captures with exact borrowed lease');
  else {
    check(packet.portIndex === 1 && packet.ports?.length === 2 && packet.ports[0].renderCalls === 8
      && packet.ports[1].renderCalls === 1 && packet.replayHostDistinct === true
      && packet.captureAfterShutdown === false && packet.naturalSize === null && packet.leaseIdentitySame === false,
      'Distinct asset-free host replays original frame without recapture');
    if (packet.backend === 'webgpu') check(packet.replayDeviceDistinct === true, 'Distinct collector-owned replay device');
  }
  if (packet.backend === 'webgpu') {
    const status = metadata?.hostStatus;
    check(['rgba8unorm', 'bgra8unorm'].includes(metadata?.sourceFormat)
      && status?.state === 'active' && status.lastSerial === serials[index] && status.pendingFrames === 0
      && status.pendingUploadBytes === 0 && status.pendingReadbackBytes === 0
      && status.firstFailure === null && status.callbackFailureCount === 0 && status.lastCallbackFailure === null,
      'Actual GPU format, raw readback drain and error-free active host');
  }
  if (rawValid) {
    const expected = literal(index);
    for (let pixel = 0; pixel < 32; pixel++) {
      pixelComparisons++;
      for (let channel = 0; channel < 4; channel++) {
        const offset = pixel * 4 + channel; channelComparisons++;
        if (packet.raw[offset] !== expected[offset] && mismatches.length < 32) mismatches.push({
          x: pixel % 8, y: Math.floor(pixel / 8), channel, expected: expected[offset], actual: packet.raw[offset] });
      }
    }
    check(mismatches.length === 0, 'Literal RGBA mismatch, including transparent exterior');
  }
  return { pass: issues.length === 0, issues, mismatches, pixelComparisons, channelComparisons, tolerance: 0 };
}
