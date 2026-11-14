// SPDX-License-Identifier: Apache-2.0
// What the mixer makes a browser render, measured sample by sample. Each case renders ahead of time
// through an output that is no loudspeaker, so the numbers do not depend on the machine or on
// anybody listening. The verifier imports this module in the page and compares the numbers.
import { createBrowserAudio } from '@egret/engine/web/audio';
import { tone, wav } from './sounds.mjs';

const RATE = 44100;
const span = (data, from, to) => data.subarray(Math.round(from * RATE), Math.round(to * RATE));
const peak = (data, from, to) => span(data, from, to).reduce((most, sample) => Math.max(most, Math.abs(sample)), 0);
const rms = (data, from, to) => { const part = span(data, from, to); return Math.sqrt(part.reduce((sum, sample) => sum + sample * sample, 0) / part.length); };
/** The amplitude of one frequency in a stretch of samples. */
function amplitude(data, frequency, from, to) {
  const part = span(data, from, to);
  let real = 0, imaginary = 0;
  for (let index = 0; index < part.length; index++) {
    const angle = 2 * Math.PI * frequency * index / RATE;
    real += part[index] * Math.cos(angle); imaginary += part[index] * Math.sin(angle);
  }
  return 2 * Math.hypot(real, imaginary) / part.length;
}
/** The frequency of a steady tone, from how often it crosses zero upwards. */
function pitch(data, from, to) {
  const part = span(data, from, to);
  let count = 0;
  for (let index = 1; index < part.length; index++) if (part[index - 1] < 0 && part[index] >= 0) count++;
  return count / (to - from);
}
/**
 * Renders the seconds given. `arrange` is given the mixer and a way to do something at a time of
 * the render; what it returns is kept beside the two sides that were rendered.
 */
async function render(seconds, options, arrange) {
  const context = new OfflineAudioContext(2, Math.round(seconds * RATE), RATE);
  const audio = createBrowserAudio({ context, ...options });
  const at = (time, action) => { context.suspend(time).then(() => { action(); context.resume(); }); };
  const kept = await arrange(audio.mixer, at, context);
  const buffer = await context.startRendering();
  await new Promise(resolve => setTimeout(resolve, 0));
  const after = typeof kept === 'function' ? kept() : kept;
  audio.dispose();
  return { left: buffer.getChannelData(0), right: buffer.getChannelData(1), after };
}

export async function measure() {
  const result = {};
  {
    // A tone of 0.8 through a voice, a bus and a master at half each is a tone of 0.1 on both sides.
    const { left, right } = await render(0.5, { volume: 0.5, buses: [{ name: 'effects', volume: 0.5 }] }, async mixer => { mixer.play(await mixer.decode(tone(440, 0.5, 0.8)), { volume: 0.5 }); });
    result.chain = [peak(left, 0.1, 0.4), peak(right, 0.1, 0.4), amplitude(left, 440, 0.1, 0.4)];
  }
  for (const pan of [-1, -0.5, 0, 0.5, 1]) {
    const { left, right } = await render(0.3, {}, async mixer => { mixer.play(await mixer.decode(tone(440, 0.3, 0.5)), { pan }); });
    (result.pan ??= {})[pan] = [amplitude(left, 440, 0.05, 0.25), amplitude(right, 440, 0.05, 0.25)];
  }
  {
    // A voice that leaves the middle while it plays, and comes back.
    const { left, right } = await render(0.6, {}, async (mixer, at) => {
      const voice = mixer.play(await mixer.decode(tone(440, 0.6, 0.5)));
      at(0.2, () => voice.setPan(1)); at(0.4, () => voice.setPan(0));
    });
    result.moved = [[0.05, 0.15], [0.25, 0.35], [0.45, 0.55]].map(([from, to]) => [amplitude(left, 440, from, to), amplitude(right, 440, from, to)]);
  }
  {
    const { left } = await render(0.6, {}, async mixer => { mixer.play(await mixer.decode(tone(440, 0.6, 0.5)), { fadeIn: 0.4 }); });
    result.fadeIn = [amplitude(left, 440, 0.09, 0.11), amplitude(left, 440, 0.19, 0.21), amplitude(left, 440, 0.29, 0.31), amplitude(left, 440, 0.45, 0.55)];
  }
  {
    const { left, after } = await render(0.7, {}, async (mixer, at) => {
      const voice = mixer.play(await mixer.decode(tone(440, 0.7, 0.5)));
      at(0.2, () => voice.stop({ fade: 0.2 }));
      return () => [voice.state, voice.endReason];
    });
    result.fadeOut = { heard: [amplitude(left, 440, 0.1, 0.19), amplitude(left, 440, 0.29, 0.31), peak(left, 0.45, 0.7)], after };
  }
  {
    const { left, after } = await render(0.5, {}, async mixer => {
      const sound = await mixer.decode(tone(440, 0.1, 0.5));
      const once = mixer.play(sound, { volume: 0 }), loop = mixer.play(sound, { loop: true });
      return () => [once.state, once.endReason, loop.state, loop.position];
    });
    const once = await render(0.5, {}, async mixer => { mixer.play(await mixer.decode(tone(440, 0.1, 0.5))); });
    result.loop = { looped: amplitude(left, 440, 0.35, 0.45), once: [amplitude(once.left, 440, 0.02, 0.08), peak(once.left, 0.15, 0.5)], after };
  }
  {
    const { left } = await render(0.3, {}, async mixer => { mixer.play(await mixer.decode(tone(500, 0.6, 0.5)), { rate: 2 }); });
    const slow = await render(0.3, {}, async mixer => { mixer.play(await mixer.decode(tone(500, 0.3, 0.5)), { rate: 0.5 }); });
    result.rate = [pitch(left, 0.05, 0.25), pitch(slow.left, 0.05, 0.25)];
  }
  {
    // Silence for a fifth of a second, then a tone: started a fifth of a second in, the tone is there at once.
    const samples = new Float32Array(Math.round(0.4 * 22050));
    for (let index = samples.length / 2; index < samples.length; index++) samples[index] = 0.5 * Math.sin(2 * Math.PI * 441 * index / 22050);
    const from = async offset => (await render(0.2, {}, async mixer => { mixer.play(await mixer.decode(wav(samples)), { offset }); })).left;
    result.offset = [peak(await from(0), 0, 0.15), amplitude(await from(0.2), 441, 0.02, 0.15)];
  }
  {
    // One music gives way to the next across a fade of 0.4 seconds that starts at 0.5.
    const { left, after } = await render(1.2, { buses: [{ name: 'music', volume: 0.5 }] }, async (mixer, at) => {
      const first = await mixer.decode(tone(500, 0.5, 0.8)), second = await mixer.decode(tone(1500, 0.5, 0.8));
      const before = mixer.playMusic(first);
      let next, seen;
      at(0.5, () => { next = mixer.playMusic(second, { fade: 0.4 }); seen = [before.state, mixer.snapshot().voices, before.position]; });
      return () => ({ seen, before: [before.state, before.endReason], next: next.state, music: mixer.music === next, voices: mixer.snapshot().voices });
    });
    result.music = { first: [[0.3, 0.45], [0.69, 0.71], [0.95, 1.15]].map(([from, to]) => amplitude(left, 500, from, to)),
      second: [[0.3, 0.45], [0.69, 0.71], [0.95, 1.15]].map(([from, to]) => amplitude(left, 1500, from, to)), after };
  }
  {
    // A bus that is muted, heard again, and turned down over a fade.
    const { left } = await render(1, {}, async (mixer, at) => {
      mixer.play(await mixer.decode(tone(440, 1, 0.5)));
      const bus = mixer.bus('effects');
      at(0.2, () => bus.setMuted(true)); at(0.4, () => bus.setMuted(false)); at(0.6, () => bus.setVolume(0.5, { fade: 0.2 }));
    });
    result.bus = [[0.05, 0.15], [0.25, 0.35], [0.45, 0.55], [0.69, 0.71], [0.85, 0.95]].map(([from, to]) => amplitude(left, 440, from, to));
  }
  {
    // A voice paused for a fifth of a second goes on from where it was.
    const { left, after } = await render(0.7, {}, async (mixer, at) => {
      const voice = mixer.play(await mixer.decode(tone(440, 0.4, 0.5)));
      const seen = [];
      at(0.2, () => { voice.pause(); seen.push(voice.state, voice.position); }); at(0.4, () => { seen.push(voice.position); voice.resume(); });
      return () => [...seen, voice.state, voice.endReason];
    });
    result.pause = { heard: [amplitude(left, 440, 0.05, 0.15), peak(left, 0.25, 0.35), amplitude(left, 440, 0.45, 0.55), peak(left, 0.65, 0.7)], after };
  }
  return result;
}
