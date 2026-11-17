// SPDX-License-Identifier: Apache-2.0
// Sound effects made in code, for a game that has no sound files: a few tones one after another, each a wave whose
// pitch slides and whose loudness dies away. `play` turns them into sounds of the mixer; nothing here needs a page.

/** The wave of a tone. `noise` is a new random level `from`..`to` times a second, which gives it a pitch. */
export type SfxWave = 'sine' | 'square' | 'saw' | 'triangle' | 'noise';
/** One tone of an effect. */
export interface SfxTone {
  /** `square` unless given. */
  readonly wave?: SfxWave;
  /** The pitch it starts at, in hertz, from 20 to 12000. */
  readonly from: number;
  /** The pitch it slides to. The same as `from` unless given. */
  readonly to?: number;
  /** How long it sounds, from 0.01 to 3 seconds. */
  readonly seconds: number;
  /** 0 to 1; 0.5 unless given. */
  readonly volume?: number;
  /** How fast it dies away: 0 holds its loudness to the end, 4 (the default) is a pluck, 10 a tick. */
  readonly decay?: number;
  /** White noise mixed into the wave, 0 to 1; 0 unless given. */
  readonly noise?: number;
  /**
   * Made to be looped: its ends are not eased, so a tone of whole waves joins itself without a click. Give it a
   * `decay` of 0 and a length of whole waves, as `hum` has: 110 hertz for 1 second is 110 waves.
   */
  readonly seamless?: boolean;
}
/** An effect: one tone, or several played one after another. */
export type SfxRecipe = SfxTone | readonly SfxTone[];

/** The effects every game is given, by name. */
export const SFX_PRESETS: Readonly<Record<string, SfxRecipe>> = Object.freeze({
  jump: { wave: 'square', from: 300, to: 620, seconds: 0.16, volume: 0.4, decay: 3 },
  coin: [
    { wave: 'square', from: 988, seconds: 0.06, volume: 0.35, decay: 1 },
    { wave: 'square', from: 1319, seconds: 0.22, volume: 0.35, decay: 5 }
  ],
  hit: { wave: 'square', from: 220, to: 90, seconds: 0.12, volume: 0.5, decay: 5, noise: 0.6 },
  hurt: { wave: 'saw', from: 320, to: 80, seconds: 0.28, volume: 0.5, decay: 3, noise: 0.25 },
  explosion: { wave: 'noise', from: 1400, to: 60, seconds: 0.55, volume: 0.7, decay: 3.5 },
  shoot: { wave: 'saw', from: 900, to: 180, seconds: 0.13, volume: 0.35, decay: 4 },
  powerup: [
    { wave: 'triangle', from: 523, seconds: 0.07, volume: 0.5, decay: 1 },
    { wave: 'triangle', from: 659, seconds: 0.07, volume: 0.5, decay: 1 },
    { wave: 'triangle', from: 784, seconds: 0.07, volume: 0.5, decay: 1 },
    { wave: 'triangle', from: 1047, seconds: 0.2, volume: 0.5, decay: 4 }
  ],
  bounce: { wave: 'sine', from: 420, to: 250, seconds: 0.09, volume: 0.6, decay: 4 },
  pop: { wave: 'sine', from: 650, to: 1150, seconds: 0.07, volume: 0.5, decay: 5 },
  click: { wave: 'square', from: 800, seconds: 0.04, volume: 0.5, decay: 5 },
  // Made for sfx.loop: an engine or a machine, whose pitch a game raises with its speed, and the wind.
  hum: [{ wave: 'saw', from: 55, seconds: 1, volume: 0.35, decay: 0, noise: 0.08, seamless: true }],
  wind: { wave: 'noise', from: 600, seconds: 2, volume: 0.3, decay: 0, seamless: true },
  win: [
    { wave: 'square', from: 523, seconds: 0.1, volume: 0.35, decay: 1 },
    { wave: 'square', from: 659, seconds: 0.1, volume: 0.35, decay: 1 },
    { wave: 'square', from: 784, seconds: 0.1, volume: 0.35, decay: 1 },
    { wave: 'square', from: 1047, seconds: 0.1, volume: 0.35, decay: 1 },
    { wave: 'square', from: 1319, seconds: 0.32, volume: 0.35, decay: 3 }
  ],
  lose: [
    { wave: 'saw', from: 392, seconds: 0.16, volume: 0.4, decay: 1.5 },
    { wave: 'saw', from: 330, seconds: 0.16, volume: 0.4, decay: 1.5 },
    { wave: 'saw', from: 262, seconds: 0.16, volume: 0.4, decay: 1.5 },
    { wave: 'saw', from: 196, to: 150, seconds: 0.4, volume: 0.4, decay: 2.5 }
  ]
});

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const WAVES: readonly string[] = ['sine', 'square', 'saw', 'triangle', 'noise'];

/** Whether a value is a recipe `synthesizeSfx` takes. */
export function isSfxRecipe(recipe: unknown): recipe is SfxRecipe {
  const tones = Array.isArray(recipe) ? recipe : [recipe];
  return (
    tones.length > 0 &&
    tones.length <= 32 &&
    tones.every(
      tone =>
        tone !== null &&
        typeof tone === 'object' &&
        (tone.wave === undefined || WAVES.includes(tone.wave)) &&
        finite(tone.from) &&
        tone.from >= 20 &&
        tone.from <= 12000 &&
        (tone.to === undefined || (finite(tone.to) && tone.to >= 20 && tone.to <= 12000)) &&
        finite(tone.seconds) &&
        tone.seconds >= 0.01 &&
        tone.seconds <= 3 &&
        (tone.volume === undefined || (finite(tone.volume) && tone.volume >= 0 && tone.volume <= 1)) &&
        (tone.decay === undefined || (finite(tone.decay) && tone.decay >= 0 && tone.decay <= 40)) &&
        (tone.noise === undefined || (finite(tone.noise) && tone.noise >= 0 && tone.noise <= 1)) &&
        (tone.seamless === undefined || typeof tone.seamless === 'boolean')
    )
  );
}

/**
 * The samples of an effect, one channel, from -1 to 1. The same recipe and seed give the same samples, so an
 * effect can be checked without a sound card.
 */
export function synthesizeSfx(recipe: SfxRecipe, sampleRate = 22050, seed = 1): Float32Array {
  const tones: readonly SfxTone[] = Array.isArray(recipe) ? recipe : [recipe as SfxTone];
  const lengths = tones.map(tone => Math.max(1, Math.round(tone.seconds * sampleRate)));
  const samples = new Float32Array(lengths.reduce((sum, length) => sum + length, 0));
  // A small generator of its own: the effect does not depend on Math.random or on the game's dice.
  let state = seed >>> 0 || 1;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296) * 2 - 1;
  };
  let at = 0;
  tones.forEach((tone, index) => {
    const length = lengths[index]!,
      wave = tone.wave ?? 'square',
      to = tone.to ?? tone.from,
      volume = tone.volume ?? 0.5,
      decay = tone.decay ?? 4,
      mixed = tone.noise ?? 0;
    // The ends are eased over a few milliseconds, so a tone neither starts nor stops with a click.
    const edge = tone.seamless === true ? 0 : Math.min(Math.round(sampleRate * 0.004), length >> 1);
    let phase = 0,
      held = random();
    for (let i = 0; i < length; i++) {
      const u = i / length,
        frequency = tone.from + (to - tone.from) * u,
        before = phase;
      phase += frequency / sampleRate;
      const turn = phase % 1;
      let value: number;
      if (wave === 'sine') value = Math.sin(phase * 2 * Math.PI);
      else if (wave === 'square') value = turn < 0.5 ? 0.7 : -0.7;
      else if (wave === 'saw') value = (turn * 2 - 1) * 0.8;
      else if (wave === 'triangle') value = Math.abs(turn * 4 - 2) - 1;
      else {
        if (Math.floor(phase) !== Math.floor(before)) held = random();
        value = held;
      }
      if (mixed > 0) value = value * (1 - mixed) + random() * mixed;
      const fade = edge === 0 ? 1 : Math.min(1, i / edge, (length - 1 - i) / edge);
      samples[at + i] = Math.max(-1, Math.min(1, value * volume * Math.exp(-decay * u) * fade));
    }
    at += length;
  });
  return samples;
}
