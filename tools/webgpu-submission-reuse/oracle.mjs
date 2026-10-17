// SPDX-License-Identifier: Apache-2.0
// Independent literal 16 x 16 masks. No product geometry, packing or cache code is imported.
export const CASES = Object.freeze(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
export const CONTROLS = Object.freeze(['wrong-alpha', 'wrong-order']);
export const CHANNELS = 1024;
export function expectedPixels(id, step, variant = 'baseline') {
  if (!CASES.includes(id) || !Number.isInteger(step) || step < 0 || step > 3
    || !['baseline', ...CONTROLS].includes(variant)) throw Error('ORACLE_DOMAIN');
  const bytes = new Uint8Array(CHANNELS);
  const changed = step === 2 && ['C1', 'C2', 'C3', 'C4'].includes(id);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const inside = (left, top, right, bottom) => x >= left && x < right && y >= top && y < bottom;
    let rgba = [0, 0, 0, 255];
    if (id === 'C1') {
      if (inside(2, 2, 10, 10)) rgba = [255, 0, 0, 255];
      const low = changed ? 4 : 6, high = changed ? 12 : 14;
      if (inside(low, low, high, high)) {
        if (variant === 'wrong-alpha') rgba = [rgba[0] ? 191 : 0, 64, 0, 255];
        else if (changed) rgba = [rgba[0] ? 127 : 0, 128, 0, 255];
        else rgba = [0, 255, 0, 255];
      }
      if (variant === 'wrong-order' && inside(2, 2, 10, 10)) rgba = [255, 0, 0, 255];
    } else if (id === 'C2' || id === 'C4') {
      if (id === 'C4' && inside(2, 2, 14, 14)) rgba = [255, 0, 0, 255];
      if (inside(2, 2, 10, 10)) rgba = [0, 255, 0, 255];
      const low = changed ? 4 : 6, high = changed ? 12 : 14;
      if (inside(low, low, high, high)) rgba = changed
        ? [rgba[0] ? 127 : 0, rgba[1] ? 255 : 128, 0, 255] : [0, 255, 0, 255];
    } else if (id === 'C3') {
      if (inside(2, 2, 14, 14)) rgba = [255, 0, 0, 255];
      const low = changed ? 4 : 6, high = changed ? 12 : 14;
      if (inside(low, low, high, high)) rgba = changed ? [127, 128, 0, 255] : [0, 255, 0, 255];
    } else if (id === 'C5') {
      if (inside(4, 4, 12, 12)) rgba = step === 1 ? [0, 0, 255, 255] : [0, 255, 0, 255];
    } else if (inside(4, 4, 12, 12)) rgba = [0, 255, 0, 255];
    bytes.set(rgba, (y * 16 + x) * 4);
  }
  return bytes;
}
export function comparePixels(readback, id, step, variant = 'baseline') {
  if (readback.width !== 16 || readback.height !== 16 || readback.format !== 'rgba8unorm'
    || !['rgba8unorm', 'bgra8unorm'].includes(readback.sourceFormat)
    || readback.colorSpace !== 'srgb' || readback.alphaMode !== 'premultiplied'
    || readback.bytes?.length !== CHANNELS) throw Error('READBACK_METADATA');
  const expected = expectedPixels(id, step, variant), mismatches = [];
  let failedChannels = 0;
  for (let index = 0; index < CHANNELS; index++) {
    const actual = readback.bytes[index];
    if (!Number.isInteger(actual) || actual < 0 || actual > 255) throw Error('READBACK_CHANNEL');
    // Fixed one-byte tolerance covers unorm blend rounding, never geometry or stale-data errors.
    if (Math.abs(actual - expected[index]) > 1) {
      failedChannels++;
      if (mismatches.length < 8) mismatches.push({ x: (index >> 2) % 16, y: index >> 6,
        channel: index % 4, expected: expected[index], actual });
    }
  }
  return { comparisons: CHANNELS, failedChannels, mismatches, passed: failedChannels === 0 };
}
export function verifyControl(readback, control) {
  if (!CONTROLS.includes(control)) throw Error('CONTROL_DOMAIN');
  const baseline = comparePixels(readback, 'C1', 0), changed = comparePixels(readback, 'C1', 0, control);
  const offset = (6 * 16 + 6) * 4, actual = Array.from(readback.bytes.slice(offset, offset + 4));
  const expectedWrong = control === 'wrong-alpha' ? [191, 64, 0, 255] : [255, 0, 0, 255];
  if (baseline.passed || !changed.passed || actual.some((value, index) => Math.abs(value - expectedWrong[index]) > 1)) {
    throw Error('CONTROL_DID_NOT_DETECT_ASSIGNED_ERROR');
  }
  return { detected: true, baseline, changed, witness: { x: 6, y: 6, expected: [0, 255, 0, 255], expectedWrong, actual } };
}
// Each row is cumulative after settled readback, before close. Staging and depth are separate.
export function expectedCounts(id, step) {
  if (!CASES.includes(id) || !Number.isInteger(step) || step < 0 || step > 3) throw Error('COUNT_DOMAIN');
  const ordinary = {
    C1: [3, 1, 1, 3], C2: [4, 2, 1, 4], C3: [5, 2, 1, 5], C4: [7, 3, 1, 7],
  }[id];
  const frames = step + 1;
  if (ordinary) return { eligibleCreated: ordinary[0], eligibleDestroyed: 0, bindingsCreated: ordinary[1],
    imageCreated: ordinary[2], imageDestroyed: 0, imageUploads: ordinary[2], bufferWrites: ordinary[3] * frames,
    stagingCreated: frames, stagingDestroyed: frames, stagingUnmapped: frames, submits: frames,
    depthCreated: ['C3', 'C4'].includes(id) ? frames : 0, depthDestroyed: ['C3', 'C4'].includes(id) ? frames : 0 };
  if (id === 'C5') return { eligibleCreated: 2, eligibleDestroyed: 0, bindingsCreated: [1, 2, 3, 3][step],
    imageCreated: [1, 2, 3, 3][step], imageDestroyed: 0, imageUploads: [1, 2, 3, 3][step], bufferWrites: 2 * frames,
    stagingCreated: frames, stagingDestroyed: frames, stagingUnmapped: frames, submits: frames, depthCreated: 0, depthDestroyed: 0 };
  return { eligibleCreated: [4098, 4098, 4098, 4100][step], eligibleDestroyed: [2, 2, 2, 4][step],
    bindingsCreated: [2049, 2049, 2049, 2050][step], imageCreated: 1, imageDestroyed: 0, imageUploads: 1,
    bufferWrites: [4098, 4100, 4102, 8200][step], stagingCreated: frames, stagingDestroyed: frames,
    stagingUnmapped: frames, submits: frames, depthCreated: 0, depthDestroyed: 0 };
}
export function verifyCounts(actual, id, step) {
  const expected = expectedCounts(id, step);
  for (const [name, value] of Object.entries(expected)) if (actual[name] !== value) throw Error(`NATIVE_COUNT:${id}:${step}:${name}:${actual[name]}!=${value}`);
  if (actual.unknownCreated !== 0 || actual.failedCalls !== 0) throw Error('UNCLASSIFIED_OR_FAILED_NATIVE_CALL');
  return { expected, passed: true };
}
