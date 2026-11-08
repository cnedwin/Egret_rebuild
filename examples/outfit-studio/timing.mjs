// SPDX-License-Identifier: Apache-2.0
const sampleCap = 60_000;
const durationMs = 335_000;

/** Keep bounded monotonic observations. Report UI elapsed and Host-inclusive spans separately. */
export function createStudioTiming(mode) {
  const samples = [];
  let origin, saturated = false;
  return {
    record(sample) {
      origin ??= sample.completedAt;
      if (sample.completedAt-origin > durationMs) return;
      if (samples.length === sampleCap) { saturated = true; return; }
      samples.push(sample);
    },
    read() { return {mode,origin,saturated,samples:samples.slice()}; }
  };
}
