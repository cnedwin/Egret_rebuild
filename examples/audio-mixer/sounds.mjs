// SPDX-License-Identifier: Apache-2.0
// The sounds of the example, made here so that the repository carries no recording: each is a WAV
// file of 16-bit samples built from sine waves, the kind of bytes a game would load from a file.

const RATE = 22050;
/** A WAV file of one channel from samples between -1 and 1. */
export function wav(samples, sampleRate = RATE) {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  const text = (offset, value) => { for (let index = 0; index < value.length; index++) bytes[offset + index] = value.charCodeAt(index); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) view.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), true);
  return bytes;
}
/** A steady tone, for what is measured rather than listened to. */
export function tone(frequency, seconds, amplitude = 0.5, sampleRate = RATE) {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let index = 0; index < samples.length; index++) samples[index] = amplitude * Math.sin(2 * Math.PI * frequency * index / sampleRate);
  return wav(samples, sampleRate);
}
/** Notes of the same length one after another, each rising and falling so that the tune loops without a click. */
export function tune(frequencies, noteSeconds = 0.5, amplitude = 0.3) {
  const length = Math.round(noteSeconds * RATE), samples = new Float32Array(length * frequencies.length);
  frequencies.forEach((frequency, note) => {
    for (let index = 0; index < length; index++) {
      const time = index / RATE, shape = Math.min(1, time / 0.02, (noteSeconds - time) / 0.08);
      samples[note * length + index] = amplitude * shape * (Math.sin(2 * Math.PI * frequency * time) + 0.3 * Math.sin(4 * Math.PI * frequency * time));
    }
  });
  return wav(samples);
}
/** A struck sound that dies away. */
export function chime(frequency = 880, seconds = 0.6, amplitude = 0.5) {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (let index = 0; index < samples.length; index++) {
    const time = index / RATE;
    samples[index] = amplitude * Math.exp(-6 * time) * Math.min(1, time / 0.004) * (Math.sin(2 * Math.PI * frequency * time) + 0.4 * Math.sin(2 * Math.PI * frequency * 2.01 * time));
  }
  return wav(samples);
}
