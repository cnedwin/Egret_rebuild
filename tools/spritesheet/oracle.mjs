// Original first-party literal SpriteSheet oracle. SPDX-License-Identifier: Apache-2.0
// No product imports, sampler, crop algorithm, observed-byte fitting or renderer-generated expectations.
export const STEPS = Object.freeze(['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9']);
const selections = Object.freeze(['R', 'G', 'B', 'B', 'R', 'R', 'G', 'R', 'R']);
// Each 128-channel literal is the entire 8x4 output, including static blue at (4,1).
const RGBA = Object.freeze({
  R: Object.freeze([
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 255,0,0,255, 255,0,0,255, 0,0,0,0, 0,0,255,255, 0,0,255,255, 0,0,255,255, 0,0,0,0,
    0,0,0,0, 255,0,0,255, 255,0,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  ]),
  G: Object.freeze([
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,255,255, 0,0,255,255, 0,0,255,255, 0,0,0,0,
    0,0,0,0, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  ]),
  B: Object.freeze([
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,0,255,255, 0,0,255,255, 0,0,255,255, 0,0,255,255, 0,0,255,255, 0,0,255,255, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  ]),
});
const ATLAS = Object.freeze([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0,
]);
const crops = Object.freeze({ R: Object.freeze({ x: 0, y: 0, width: 2, height: 2 }),
  G: Object.freeze({ x: 2, y: 0, width: 1, height: 2 }), B: Object.freeze({ x: 3, y: 0, width: 3, height: 1 }) });
const ids = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 1]);
const clockElapsed = Object.freeze([0, 0.125, 0.375, 0.5, 0.5, 1, 1.125, 1.5, 1.5]);
const clockTicks = Object.freeze([0, 1, 2, 3, 3, 4, 5, 6, 6]);
const observerTicks = Object.freeze([
  { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 },
  { tickId: 2, elapsedSeconds: 0.375, deltaSeconds: 0.25 },
  { tickId: 3, elapsedSeconds: 0.5, deltaSeconds: 0.125 },
  { tickId: 4, elapsedSeconds: 1, deltaSeconds: 0.5 },
  { tickId: 5, elapsedSeconds: 1.125, deltaSeconds: 0.125 },
  { tickId: 6, elapsedSeconds: 1.5, deltaSeconds: 0.375 },
]);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sample = (frameIndex, positionSeconds, atEnd, region) => ({ frameIndex, positionSeconds,
  atEnd, stopped: false, region, frozen: true });
function imageCommand(command, crop, x) {
  return command?.kind === 'image' && command.imageIndex === 0 && command.alpha === 1 && command.clips?.length === 0
    && same(command.sourceRect, crop) && same(command.rect, { x: 0, y: 0, width: crop.width, height: crop.height })
    && same(command.matrix, { a: 1, b: 0, c: 0, d: 1, tx: x, ty: 1 });
}
export function expectationManifest() {
  return { schemaVersion: 'spritesheet-opaque-oracle/1', width: 8, height: 4, browserDPR: 1, hostPixelRatio: 1,
    backendIds: ['canvas', 'webgpu'], originalAtlasRGBA: [...ATLAS], literalMasks: RGBA,
    steps: STEPS.map((id, index) => ({ id, frameId: ids[index], serial: ids[index], isReplay: index === 8,
      actorSourceRect: crops[selections[index]], staticSourceRect: crops.B, actorAt: [1, 1], staticAt: [4, 1],
      expectedRGBA: [...RGBA[selections[index]]], clockElapsedSeconds: clockElapsed[index], tickId: clockTicks[index] })),
    expectationAuthority: 'Accepted original source schedule and independent complete literal RGBA sealed before launch',
    usesActualBytesToChooseExpectations: false, tolerance: 0, requiredSubmissions: 18,
    requiredNewCaptures: 16, requiredReplays: 2, requiredPixelComparisons: 576, requiredChannelComparisons: 2304,
    countsAreCompletenessRequirementsNotObservedResults: true, performance: false, fullSpine: false, migration: false };
}
export function inspectSpriteSheetProof(packet, retired = false) {
  const index = retired ? 8 : STEPS.indexOf(packet?.step), issues = [];
  const check = (condition, message) => { if (!condition) issues.push(message); };
  check(index >= 0 && packet?.nextStep === index + 1, 'Nine ordered public SpriteSheet observations');
  if (index < 0) return { pass: false, issues };
  const constructor = packet.construction, playback = packet.playback, sheet = packet.sheet;
  check(packet.clip?.atlasWidth === 6 && packet.clip.atlasHeight === 2 && packet.clip.frameCount === 3
    && packet.clip.durationSeconds === 0.5 && packet.clip.frozen === true, 'Real immutable clip has the literal three-frame half-second metadata');
  check(constructor?.cropUnchanged === true && same(constructor.naturalSize, [2, 2])
    && constructor.leaseIdentitySame === true && constructor.initialState === 'idle' && constructor.initialElapsed === 0
    && constructor.initialLastSampleAbsent === true && constructor.initiallyLive === true && constructor.clockUnchanged === true,
    'Genuine idle controller preserves the sheet-created red target and seeded zero clock');
  const regionNames = ['red', 'green', 'blue', '__proto__'];
  check(sheet?.frameCount === 4 && same(sheet.names, regionNames) && sheet.atlasWidth === 6 && sheet.atlasHeight === 2
    && sheet.isDisposed === (index >= 2) && sheet.frozen === true && sheet.namesFrozen === true
    && sheet.namesIdentitySame === true && sheet.inputOwned === true && sheet.regions?.length === 4
    && regionNames.every((name, slot) => { const region = sheet.regions[slot], crop = slot === 0 ? crops.R : slot === 1 ? crops.G : crops.B;
      return region.name === name && region.x === crop.x && region.y === crop.y && region.width === crop.width
        && region.height === crop.height && region.frozen === true && region.identitySame === true; }),
    'Owned exact-name canonical metadata survives Sheet and caller/Engine retirement');
  const onceState = index === 0 ? 'idle' : index < 3 ? 'running' : 'completed';
  const oncePosition = index === 0 ? 0 : index === 1 ? 0.125 : index === 2 ? 0.375 : 0.5;
  const onceSample = index === 0 ? null : sample(index === 1 ? 1 : 2, oncePosition, index >= 3, index === 1 ? crops.G : crops.B);
  check(playback?.once?.state === onceState && playback.once.isDisposed === (index >= 3)
    && playback.once.elapsedSeconds === oncePosition && playback.once.frozen === true && same(playback.once.lastSample, onceSample),
    'Literal once positions and completion release the same-target claim');
  if (index < 4) check(playback?.loop === null && packet.loopConstruction === null, 'Loop not created before once completion');
  else {
    const initial = packet.loopConstruction, loop = playback?.loop;
    check(initial?.priorOnceCompleted === true && initial.cropUnchanged === true && initial.initialState === 'idle'
      && initial.initialElapsed === 0 && initial.initialLastSampleAbsent === true && initial.clockUnchanged === true,
      'Completed once claim admits unchanged idle loop on the same genuine Bitmap');
    const elapsed = index < 6 ? 0 : index === 6 ? 0.125 : 0.5;
    check(loop?.state === (index === 8 ? 'stopped' : index === 5 ? 'paused' : 'running')
      && loop.isDisposed === (index === 8) && loop.frozen === true && loop.elapsedSeconds === elapsed
      && same(loop.lastSample, sample(index === 6 ? 1 : 0, index === 6 ? 0.125 : 0, false, index === 6 ? crops.G : crops.R)),
      'Literal loop boundary and paused-gap state/sample');
  }
  check(packet.clock?.state === (index === 8 ? 'closed' : 'running') && packet.clock.elapsedSeconds === clockElapsed[index]
    && packet.clock.tickId === clockTicks[index] && packet.clock.maxDeltaSeconds === 0.5, 'Six explicit ticks, no capture/render/resume tick');
  check(packet.observer?.exists === true && packet.observer.isDisposed === (index === 8)
    && same(packet.observer.ticks, observerTicks.slice(0, clockTicks[index])), 'Complete public observer tick prefix/disposal');
  check(packet.scopes?.resource === (index === 8 ? 'closed' : 'open') && packet.scopes.playback === (index === 8 ? 'closed' : 'open')
    && packet.scopes.observer === (index === 8 ? 'closed' : 'open'), 'Actual separate caller/driver/observer Scopes');
  check(index < 5 ? playback.pausedSampleIdentitySame === null : playback.pausedSampleIdentitySame === true, 'Paused gap preserves held sample identity');
  check(index < 6 ? playback.resumedSampleFrozen === null && playback.resumeHeldSample === null
    : playback.resumedSampleFrozen === true && same(playback.resumeHeldSample, sample(0, 0, false, crops.R)),
    'Resume publishes immutable held red without a tick before the next green sample');
  check(packet.resources?.imagesCreated === 1 && packet.resources.texturesCreated === 1 && packet.resources.leasesAcquired === 1
    && packet.resources.sheetsCreated === 1 && packet.resources.bitmapsCreated === 2 && packet.resources.providerLoads === 1
    && packet.resources.providerDisposals === (index === 8 ? 1 : 0) && packet.resources.playbackHandlesCreated === (index < 4 ? 1 : 2),
    'Exactly one original asset lease and two caller-owned sheet Bitmaps');
  check(packet.image?.width === 6 && packet.image.height === 2 && packet.image.bytesPerRow === 24 && packet.image.byteLength === 48
    && packet.image.format === 'rgba8unorm' && packet.image.colorSpace === 'srgb' && packet.image.alphaMode === 'straight'
    && packet.image.origin === 'top-left' && packet.image.frozen === true && same(packet.image.copiedRGBA, ATLAS),
    'Complete original atlas bytes and canonical immutable image metadata');
  check(packet.firstError === null && packet.events?.length === 0 && packet.diagnostics?.length === 0, 'No hidden native or cleanup fault');
  if (index === 8) {
    const proof = packet.borrowerProof, close = packet.shutdownProof;
    check(proof?.onceRemainsCompleted === true && proof.loopStopped === true && proof.cachedSamplesIdentical === true
      && proof.playbackScopeClosed === true && proof.bitmapStillLive === true && proof.leaseIdentitySame === true
      && proof.liveLeaseReadEqualsOriginalTexture === true && proof.textureStillLive === true && proof.sheetDisposed === true
      && proof.sheetMetadataIdentical === true && proof.providerDisposalsBeforeCallerRelease === 0,
      'Playback Scope cleanup leaves the exact original caller borrows and retired sheet metadata live');
    check(close?.leaseReadCode === 'ASSET_LEASE_RELEASED' && close.textureDisposed === true && close.bitmapDisposed === true
      && close.bitmapCleared === true && close.sheetDisposed === true && close.sheetMetadataIdentical === true && close.scopesClosed === true
      && close.observerDisposed === true && close.clockClosed === true && close.retainedSamplesIdentical === true
      && close.originEngineDisposeFulfilled === true && close.originHostSafe === true, 'Caller/origin retirement precedes replay');
    if (packet.backend === 'webgpu') check(close.originDeviceDestroyed === true && close.originDeviceLoss?.reason === 'destroyed',
      'Origin application device is destroyed only after safe host return');
    if (retired) check(packet.closing === true, 'Final fixture close was observed');
  } else check(packet.borrowerProof === null && packet.shutdownProof === null, 'No early fabricated retirement proof');
  return { pass: issues.length === 0, issues };
}
export function inspectCapture(packet) {
  const index = STEPS.indexOf(packet?.step), issues = [], mismatches = [];
  let channelComparisons = 0, pixelComparisons = 0;
  const check = (condition, message) => { if (!condition) issues.push(message); };
  check(index >= 0 && ['canvas', 'webgpu'].includes(packet?.backend), 'Unknown named step/backend');
  if (index < 0) return { pass: false, issues, mismatches, pixelComparisons, channelComparisons, tolerance: 0 };
  issues.push(...inspectSpriteSheetProof(packet).issues);
  const crop = crops[selections[index]], metadata = packet.metadata;
  const valid = Array.isArray(packet.raw) && packet.raw.length === 128
    && packet.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255);
  check(valid, 'Exactly 128 original raw RGBA channels');
  check(metadata?.width === 8 && metadata.height === 4 && metadata.byteLength === 128 && metadata.frameId === ids[index]
    && metadata.serial === (packet.backend === 'webgpu' ? ids[index] : null), 'Literal frame IDs1..8/original1 and host serials');
  check(metadata?.format === 'rgba8unorm' && metadata.colorSpace === 'srgb' && metadata.origin === 'top-left'
    && metadata.alphaMode === (packet.backend === 'canvas' ? 'straight' : 'premultiplied'), 'Canonical raw pixel contract');
  check(same(packet.css, { x: 0, y: 0, width: 8, height: 4, canvasWidth: 8, canvasHeight: 4, browserDPR: 1 }), 'Actual 8x4 CSS/backing DPR1');
  check(same(packet.frame, { frameId: ids[index], width: 8, height: 4, clearColor: 0, clearAlpha: 0,
    commands: 2, images: 1, frozen: true }), 'Complete authentic frozen frame header and explicit transparent clear');
  check(packet.commands?.length === 2 && imageCommand(packet.commands[0], crop, 1)
    && imageCommand(packet.commands[1], crops.B, 4), 'Both painter-ordered literal opaque geometries share image0');
  check(packet.imageIdentitySame === true && packet.frameFullyFrozen === true && packet.savedFrameFrozen === true && packet.issues?.length === 0
    && same(packet.textureBase, { x: 0, y: 0, width: 6, height: 2 }), 'Original image/frame frozen and full atlas base unchanged');
  if (index < 8) check(packet.portIndex === 0 && packet.ports?.length === 1 && packet.ports[0].renderCalls === index + 1
    && packet.leaseIdentitySame === true && same(packet.naturalSize, [crop.width, crop.height]) && same(packet.iconNaturalSize, [3, 1])
    && packet.captureAfterShutdown === false, 'Eight explicit origin captures retain both exact lease identities');
  else {
    check(packet.portIndex === 1 && packet.ports?.length === 2 && packet.ports[0].renderCalls === 8 && packet.ports[1].renderCalls === 1
      && packet.replayOriginalFrameIdentitySame === true && packet.replayHostDistinct === true && packet.captureAfterShutdown === false
      && packet.naturalSize === null && packet.iconNaturalSize === null && packet.leaseIdentitySame === false,
      'Distinct asset-free host replays the exact original N1 frame without recapture');
    if (packet.backend === 'webgpu') check(packet.replayDeviceDistinct === true, 'Replay uses a distinct application-owned WebGPU device');
  }
  if (packet.backend === 'webgpu') {
    const state = metadata?.hostStatus;
    check(['rgba8unorm', 'bgra8unorm'].includes(metadata?.sourceFormat) && state?.state === 'active' && state.lastSerial === ids[index]
      && state.pendingFrames === 0 && state.pendingUploadBytes === 0 && state.pendingReadbackBytes === 0
      && state.firstFailure === null && state.callbackFailureCount === 0 && state.lastCallbackFailure === null,
      'Raw readback drains actual WebGPU work without callback/native errors');
  }
  if (valid) {
    const expected = RGBA[selections[index]];
    for (let pixel = 0; pixel < 32; pixel++) {
      pixelComparisons++;
      for (let channel = 0; channel < 4; channel++) {
        const offset = pixel * 4 + channel; channelComparisons++;
        if (packet.raw[offset] !== expected[offset] && mismatches.length < 32) mismatches.push({
          x: pixel % 8, y: Math.floor(pixel / 8), channel, expected: expected[offset], actual: packet.raw[offset] });
      }
    }
    check(mismatches.length === 0, 'Literal RGBA mismatch including every transparent exterior channel');
  }
  return { pass: issues.length === 0, issues, mismatches, pixelComparisons, channelComparisons, tolerance: 0 };
}
