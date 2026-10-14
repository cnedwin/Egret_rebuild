// SPDX-License-Identifier: Apache-2.0
// Literal native expectations are independent of Core and the bridge implementation.
export const FRAME = Object.freeze({ width: 64, height: 48, clearColor: 0, clearAlpha: 0 });
export const TIMES = Object.freeze([0, 0.25, 0.5, 0.75, 1, 0.5, 0.25]);
export const PIXELS = Object.freeze([
  Object.freeze({ x: 21, y: 17, rgba: Object.freeze([255, 0, 0, 255]) }),
  Object.freeze({ x: 26, y: 17, rgba: Object.freeze([0, 255, 0, 255]) }),
  Object.freeze({ x: 21, y: 11, rgba: Object.freeze([0, 0, 255, 255]) }),
  Object.freeze({ x: 26, y: 11, rgba: Object.freeze([255, 255, 0, 255]) }),
  Object.freeze({ x: 19, y: 15, rgba: Object.freeze([0, 0, 0, 0]) }),
]);
export function requireNative(condition, message, code = 'F2C_NATIVE_ASSERTION') {
  if (!condition) throw Object.assign(new Error(message), { code });
}
export function sameBytes(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
/** Inspect saved original readback bytes; never infer pixels from CPU geometry. */
export function inspectCaptures(packets) {
  const comparisons = [];
  requireNative(Array.isArray(packets) && packets.length === TIMES.length, 'Seven original manual submissions required');
  for (const [index, packet] of packets.entries()) {
    requireNative(packet.timeSeconds === TIMES[index] && packet.raw.length === 64 * 48 * 4
      && packet.raw.every(value => Number.isInteger(value) && value >= 0 && value <= 255), 'Original readback envelope');
    requireNative(packet.metadata.width === 64 && packet.metadata.height === 48
      && packet.metadata.byteLength === 64 * 48 * 4 && packet.metadata.format === 'rgba8unorm'
      && packet.metadata.colorSpace === 'srgb' && packet.metadata.alphaMode === 'premultiplied', 'Original WebGPU readback dimensions/modes');
    requireNative(packet.frame.commands === 1 && packet.frame.geometries === 1 && packet.frame.images === 1
      && packet.clockDidNotTick && packet.oldGeometryUnchanged && packet.oldFrameUnchanged, 'Genuine immutable capture and manual clock');
    const opaquePixels = packet.raw.filter((value, offset) => offset % 4 === 3 && value !== 0).length;
    requireNative(opaquePixels > 0, 'Every original manual sample must remain nonblank');
    comparisons.push({ index, timeSeconds: packet.timeSeconds, opaquePixels, pass: true });
  }
  const initial = packets[0];
  const literalPixels = PIXELS.map(expected => {
    const offset = (expected.y * 64 + expected.x) * 4, actual = initial.raw.slice(offset, offset + 4);
    return { ...expected, actual, pass: sameBytes(actual, expected.rgba), absoluteTolerance: 0 };
  });
  requireNative(literalPixels.every(row => row.pass), 'Original t0 literal RGBA probes');
  requireNative(packets.slice(1, 5).every(packet => !sameBytes(packet.raw, initial.raw)), 'Every moving sample changes original whole-frame bytes');
  requireNative(sameBytes(packets[2].raw, packets[5].raw) && sameBytes(packets[1].raw, packets[6].raw), 'Repeat/backward whole frames must be byte-exact');
  return { pass: true, submissions: 7, originalReadbacks: 7, literalPixels,
    literalChannelsCompared: 20, wholeFrameRepeatChannelsCompared: 2 * 64 * 48 * 4,
    comparisons, repeatAbsoluteTolerance: 0, geometryRetentionTolerance: 0 };
}
