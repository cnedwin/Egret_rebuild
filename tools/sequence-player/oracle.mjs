// Independently authored literal opaque-region oracle. Apache-2.0.
// No product, sampler, rasterizer, captured-data fitting or screenshot imports.
export const STEPS = Object.freeze(['red', 'green', 'blue', 'saved-red']);
const masks = Object.freeze([
  ['........', '.RR.....', '.RR.....', '........'],
  ['........', '.G......', '.G......', '........'],
  ['........', '.BBB....', '........', '........'],
  ['........', '.RR.....', '.RR.....', '........'],
]);
const colors = Object.freeze({ '.': [0, 0, 0, 0], R: [255, 0, 0, 255], G: [0, 255, 0, 255], B: [0, 0, 255, 255] });
const crops = Object.freeze([
  { x: 0, y: 0, width: 2, height: 2 }, { x: 2, y: 0, width: 1, height: 2 },
  { x: 3, y: 0, width: 3, height: 1 }, { x: 0, y: 0, width: 2, height: 2 },
]);
const frameIds = [1, 2, 3, 1], serials = [1, 2, 3, 1];
const literal = index => masks[index].flatMap(row => [...row].flatMap(char => colors[char]));
export function expectationManifest() {
  return { schemaVersion: 'bitmap-opaque-region-oracle/1', width: 8, height: 4, browserDPR: 1, hostPixelRatio: 1,
    backendIds: ['canvas', 'webgpu'], steps: STEPS.map((id, index) => ({ id, frameId: frameIds[index],
      sourceRect: crops[index], destination: { x: 0, y: 0, width: crops[index].width, height: crops[index].height },
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 1 }, mask: masks[index], expectedRGBA: literal(index) })),
    expectationAuthority: 'independent fixed coordinate masks and literal RGBA, saved before launch',
    usesActualBytesToChooseExpectations: false, tolerance: 0, alphaBlendCalibration: false,
    maximumRawPixels: 256, maximumRawChannelComparisons: 1024, fullA2: false, performance: false };
}
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function inspectCapture(packet) {
  const index = STEPS.indexOf(packet?.step), issues = [], mismatches = [];
  let channelComparisons = 0, pixelComparisons = 0;
  const check = (condition, message) => { if (!condition) issues.push(message); };
  check(index >= 0 && ['canvas', 'webgpu'].includes(packet?.backend), 'Unknown step/backend');
  if (index < 0) return { pass: false, issues, mismatches, pixelComparisons, channelComparisons };
  const crop = crops[index], metadata = packet.metadata, command = packet.command;
  check(Array.isArray(packet.raw) && packet.raw.length === 128 && packet.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255), 'Exactly 128 raw RGBA bytes required');
  check(metadata?.width === 8 && metadata?.height === 4 && metadata?.byteLength === 128 && metadata?.frameId === frameIds[index], 'Readback dimensions/frame identity');
  check(metadata?.format === 'rgba8unorm' && metadata?.colorSpace === 'srgb' && metadata?.origin === 'top-left', 'Readback pixel contract');
  check(metadata?.alphaMode === (packet.backend === 'canvas' ? 'straight' : 'premultiplied'), 'Backend raw alpha representation');
  check(metadata?.serial === (packet.backend === 'canvas' ? null : serials[index]), 'Host submission serial');
  check(same(packet.css, { x: 0, y: 0, width: 8, height: 4, canvasWidth: 8, canvasHeight: 4, browserDPR: 1 }), 'CSS/backing/DPR');
  check(command?.kind === 'image' && command?.imageIndex === 0 && command?.alpha === 1 && command?.clips?.length === 0, 'One opaque unclipped image command');
  check(same(command?.sourceRect, crop) && same(command?.rect, { x: 0, y: 0, width: crop.width, height: crop.height }), 'Literal source/destination selection');
  check(same(command?.matrix, { a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 1 }), 'Literal destination matrix');
  check(packet.imageIdentitySame === true && packet.savedFrameFrozen === true, 'Authentic shared image/frozen saved frame');
  check(packet.image?.width === 6 && packet.image?.height === 2 && packet.image?.bytesPerRow === 24 && packet.image?.byteLength === 48
    && packet.image?.format === 'rgba8unorm' && packet.image?.colorSpace === 'srgb' && packet.image?.alphaMode === 'straight' && packet.image?.origin === 'top-left' && packet.image?.frozen === true, 'Authentic full-atlas metadata');
  check(packet.resources?.imagesCreated === 1 && packet.resources?.texturesCreated === 1 && packet.resources?.leasesAcquired === 1 && packet.resources?.bitmapsCreated === 1 && packet.resources?.providerLoads === 1, 'One logical atlas/Texture/lease/Bitmap per backend');
  check(packet.issues?.length === 0 && packet.firstError === null && packet.events?.length === 0 && packet.diagnostics?.length === 0, 'Fixture protocol/native events');
  if (index < 3) {
    check(packet.elapsedSeconds === [0, 0.125, 0.375][index] && packet.sequenceSample?.frameIndex === index
      && packet.sequenceSample?.positionSeconds === [0, 0.125, 0.375][index] && packet.sequenceSample?.atEnd === false && packet.sequenceSample?.stopped === false, 'Explicit caller seconds and bounded once sample');
    check(packet.portIndex === 0 && packet.ports?.length === 1 && packet.ports[0].renderCalls === index + 1, 'Origin-only ordered render calls');
    check(packet.resources?.providerDisposals === 0 && packet.leaseIdentitySame === true, 'Live unchanged borrowed lease');
    check(same(packet.naturalSize, [crop.width, crop.height]) && same(packet.textureBase, { x: 0, y: 0, width: 6, height: 2 }), 'Selected dimensions and unchanged full-atlas base');
  } else {
    const proof = packet.borrowerProof;
    check(proof?.liveLeaseReadEqualsOriginalTexture === true && proof?.providerDisposalsBeforeCallerRelease === 0 && proof?.clearedBitmap === true, 'Actual live lease read after borrower disposal');
    check(packet.resources?.providerDisposals === 1 && packet.shutdownProof?.leaseReadCode === 'ASSET_LEASE_RELEASED' && packet.shutdownProof?.textureDisposed === true && packet.shutdownProof?.originEngineDisposeFulfilled === true && packet.shutdownProof?.originHostSafe === true, 'Caller release and old-engine safe shutdown before replay');
    check(packet.portIndex === 1 && packet.captureAfterShutdown === false, 'Replay uses a separately owned new compatible host, no new capture');
    check(packet.elapsedSeconds === null && packet.sequenceSample === null, 'Replay does not resample or advance a clock');
    check(packet.replayHostDistinct === true && packet.ports?.length === 2 && packet.ports[0].renderCalls === 3 && packet.ports[1].renderCalls === 1, 'Distinct replay host and exact 3+1 render calls');
    if (packet.backend === 'webgpu') check(packet.replayDeviceDistinct === true && packet.shutdownProof?.originDeviceDestroyed === true && packet.shutdownProof?.originDeviceLoss?.reason === 'destroyed', 'Distinct replay-owned device after original device retirement');
  }
  if (packet.backend === 'webgpu') {
    const status = metadata?.hostStatus;
    check(['rgba8unorm', 'bgra8unorm'].includes(metadata?.sourceFormat), 'Actual WebGPU source format');
    check(status?.state === 'active' && status?.lastSerial === serials[index] && status?.pendingFrames === 0 && status?.pendingUploadBytes === 0 && status?.pendingReadbackBytes === 0 && status?.firstFailure === null && status?.callbackFailureCount === 0 && status?.lastCallbackFailure === null, 'WebGPU readback drain/failure status');
  }
  if (Array.isArray(packet.raw) && packet.raw.length === 128 && packet.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    const expected = literal(index);
    for (let pixel = 0; pixel < 32; pixel++) {
      pixelComparisons++;
      for (let channel = 0; channel < 4; channel++) {
        const offset = pixel * 4 + channel; channelComparisons++;
        if (packet.raw[offset] !== expected[offset] && mismatches.length < 32) mismatches.push({ x: pixel % 8, y: Math.floor(pixel / 8), channel, expected: expected[offset], actual: packet.raw[offset] });
      }
    }
    check(mismatches.length === 0, 'Raw literal RGBA mismatch');
  }
  return { pass: issues.length === 0, issues, mismatches, pixelComparisons, channelComparisons, tolerance: 0 };
}
