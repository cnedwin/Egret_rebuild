// SPDX-License-Identifier: Apache-2.0
// Expectations come only from the independently sealed literal schedule.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function inspectBrowserPngCapture(packet, schedule, expectationMask) {
  const issues = [], mismatches = [];
  const check = (value, label) => { if (!value) issues.push(label); };
  const step = schedule.stepsPerBackend.find(row => row.id === packet?.step);
  if (!step) return { pass: false, issues: ['Unlisted schedule step'], mismatches, pixelsCompared: 0, channelsCompared: 0 };
  const expected = schedule.literalFullFrameRGBA[expectationMask ?? step.expectedMask];
  if (!expected) return { pass: false, issues: ['Unlisted literal mask'], mismatches, pixelsCompared: 0, channelsCompared: 0 };
  const valid = Array.isArray(packet?.raw) && packet.raw.length === expected.length
    && packet.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255);
  check(valid, 'Complete original RGBA8 buffer');
  check(schedule.backends.includes(packet?.backend), 'Fixed admitted backend');
  check(packet.frame?.width === schedule.frame.width && packet.frame.height === schedule.frame.height
    && packet.frame.clearColor === 0 && packet.frame.clearAlpha === 0
    && packet.frame.commands === 3 && packet.frame.images === 2 && packet.frame.frozen && packet.frameFullyFrozen,
  'Authentic complete three-command/two-image frame');
  check(packet.metadata?.width === 8 && packet.metadata.height === 4 && packet.metadata.byteLength === 128
    && packet.metadata.frameId === packet.frame.frameId && packet.metadata.format === 'rgba8unorm'
    && packet.metadata.colorSpace === 'srgb' && packet.metadata.origin === 'top-left'
    && packet.metadata.alphaMode === (packet.backend === 'canvas' ? 'straight' : 'premultiplied'), 'Native readback metadata');
  check(equal(packet.css, { width: 8, height: 4, backingWidth: 8, backingHeight: 4, devicePixelRatio: 1 }), 'Actual CSS/backing/DPR');
  const crops = [step.actorSourceRect, schedule.geometry.staticGreen.sourceRect, schedule.geometry.rgbaPair.sourceRect];
  const xs = [1, 2, 4], imageIndices = [0, 0, 1];
  check(packet.commands?.length === 3 && packet.commands.every((command, index) => command.kind === 'image'
    && command.imageIndex === imageIndices[index] && command.alpha === 1 && command.clips?.length === 0
    && equal(command.sourceRect, { x: crops[index][0], y: crops[index][1], width: crops[index][2], height: crops[index][3] })
    && equal(command.rect, { x: 0, y: 0, width: crops[index][2], height: crops[index][3] })
    && equal(command.matrix, { a: 1, b: 0, c: 0, d: 1, tx: xs[index], ty: 1 })), 'Literal original painter geometry/crops');
  check(packet.originalImageIdentities && packet.sameOriginalLeases && packet.captureDidNotTick
    && packet.renderDidNotTick && packet.heldSampleUnchanged, 'Original resource/frame/sample ownership');
  check(packet.clock?.elapsedSeconds === (packet.step === 'N1' ? 0 : 0.125)
    && packet.clock.tickId === (packet.step === 'N1' ? 0 : 1), 'Only the single scheduled advancing tick');
  check(equal(packet.snapshot?.ticks, packet.step === 'N1' ? []
    : [{ tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 }]), 'Complete original tick witness');
  if (packet.step === 'N3') check(packet.exactSavedN1 && packet.freshReplayHost && packet.freshReplayEngine
    && packet.originRetired && packet.savedImagesReadable && (packet.backend !== 'webgpu' || packet.freshReplayDevice),
  'Retired origin and distinct asset-free exact saved-frame replay');
  if (packet.backend === 'webgpu') {
    const state = packet.metadata.hostStatus;
    check(state?.state === 'active' && state.pendingFrames === 0 && state.pendingUploadBytes === 0
      && state.pendingReadbackBytes === 0 && state.firstFailure === null && state.callbackFailureCount === 0,
    'Actual GPU idle/readback barriers');
  }
  check(packet.sourceImages?.length === 2 && packet.sourceImages.every((image, index) => image.width === 2
    && image.height === 1 && image.format === 'rgba8unorm' && image.alphaMode === 'straight'
    && image.colorSpace === 'srgb' && image.origin === 'top-left'
    && equal(image.bytes, schedule.fixtures[index].literalRGBA)), 'Original decoded image bytes, separately from rendered comparisons');
  let channelsCompared = 0, pixelsCompared = 0;
  if (valid) for (let pixel = 0; pixel < 32; pixel++) {
    pixelsCompared++;
    for (let channel = 0; channel < 4; channel++) {
      const offset = pixel * 4 + channel; channelsCompared++;
      if (packet.raw[offset] !== expected[offset]) mismatches.push({ x: pixel % 8, y: Math.floor(pixel / 8),
        channel, expected: expected[offset], actual: packet.raw[offset] });
    }
  }
  check(mismatches.length === 0, 'Literal full RGBA mismatch');
  return { pass: issues.length === 0, issues, mismatches, pixelsCompared, channelsCompared, tolerance: 0 };
}
export function inspectWrongOracle(packet, schedule) {
  const result = inspectBrowserPngCapture(packet, schedule, 'RED');
  const first = result.mismatches[0];
  return { pass: packet.step === 'N2' && !result.pass && result.issues.length === 1
    && result.issues[0] === 'Literal full RGBA mismatch' && first?.x === 1 && first.y === 1 && first.channel === 0
    && first.expected === 255 && first.actual === 0, observed: result,
  additionalSubmissions: 0, additionalReadbacks: 0 };
}
