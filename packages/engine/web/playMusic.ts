// SPDX-License-Identifier: Apache-2.0
// Music made in code, for a game that has no music files. A piece is a few bars in a mood, written once from a seed
// as four parts of the same length: a pad of held chords, a bass, drums and a tune. Played together and looped, the
// parts stay in time; a game brings them in and out by how intense the moment is. Nothing here needs a page.

/** The moods there are. Each has its own key, harmony, tempo and parts. */
export type MusicMood = 'calm' | 'mystery' | 'tense' | 'battle' | 'triumph';
export const MUSIC_MOODS: readonly MusicMood[] = Object.freeze(['calm', 'mystery', 'tense', 'battle', 'triumph']);
/** The parts of a piece, from the quietest moment to the most intense. */
export const MUSIC_PARTS = Object.freeze(['pad', 'bass', 'drums', 'tune'] as const);
export type MusicPart = (typeof MUSIC_PARTS)[number];

export interface MusicOptions {
  readonly mood?: MusicMood;
  /** The same seed writes the same piece. */
  readonly seed?: number | string;
  /** Beats a minute; the mood's own unless given, from 50 to 200. */
  readonly tempo?: number;
  /** Bars of four beats before the piece repeats: 4 or 8; 8 unless given. */
  readonly bars?: 4 | 8;
}
export interface MusicPiece {
  readonly mood: MusicMood;
  readonly tempo: number;
  readonly bars: number;
  readonly rate: number;
  readonly seconds: number;
  /** Each part as samples from -1 to 1, all of one length, each joining itself where it repeats. */
  readonly parts: Readonly<Record<MusicPart, Float32Array>>;
}

interface Mood {
  readonly tempo: number;
  /** The MIDI note of the key's root, in the bass register. */
  readonly root: number;
  /** The steps of the scale above the root. */
  readonly scale: readonly number[];
  /** Each bar's chord, as the degree of the scale it is built on (0 is the root). */
  readonly chords: readonly number[];
  readonly pad: 'saw' | 'triangle' | 'sine';
  /** Drum pattern of sixteen steps a bar: k kick, s snare, h hat, '.' nothing. */
  readonly drums: string;
  /** Notes of the tune a bar, and how far it may leap. */
  readonly tune: { readonly notes: number; readonly leap: number; readonly wave: 'square' | 'triangle' | 'sine' };
  readonly bass: 'whole' | 'eighths' | 'pulse';
}
const MINOR = [0, 2, 3, 5, 7, 8, 10],
  MAJOR = [0, 2, 4, 5, 7, 9, 11],
  DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MOODS: Readonly<Record<MusicMood, Mood>> = Object.freeze({
  calm: {
    tempo: 84,
    root: 41,
    scale: MAJOR,
    chords: [0, 5, 3, 4, 0, 5, 3, 4],
    pad: 'triangle',
    drums: 'h.......h.......',
    tune: { notes: 4, leap: 2, wave: 'triangle' },
    bass: 'whole'
  },
  mystery: {
    tempo: 72,
    root: 38,
    scale: DORIAN,
    chords: [0, 6, 0, 3, 0, 6, 5, 4],
    pad: 'sine',
    drums: '....h.......h...',
    tune: { notes: 3, leap: 3, wave: 'sine' },
    bass: 'pulse'
  },
  tense: {
    tempo: 108,
    root: 40,
    scale: MINOR,
    chords: [0, 0, 5, 4, 0, 0, 5, 6],
    pad: 'saw',
    drums: 'k...h...k.k.h...',
    tune: { notes: 4, leap: 2, wave: 'square' },
    bass: 'pulse'
  },
  battle: {
    tempo: 140,
    root: 38,
    scale: MINOR,
    chords: [0, 5, 6, 4, 0, 5, 3, 4],
    pad: 'saw',
    drums: 'k.h.s.h.k.k.s.hh',
    tune: { notes: 8, leap: 3, wave: 'square' },
    bass: 'eighths'
  },
  triumph: {
    tempo: 120,
    root: 43,
    scale: MAJOR,
    chords: [0, 3, 4, 0, 5, 3, 4, 4],
    pad: 'saw',
    drums: 'k...s...k.k.s...',
    tune: { notes: 4, leap: 2, wave: 'square' },
    bass: 'eighths'
  }
});
const hertz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
/** A small seeded generator, so a seed writes the same piece in every engine. */
function generator(seed: number | string | undefined): () => number {
  let h = 2166136261 >>> 0;
  for (const character of String(seed ?? 'egret')) h = Math.imul(h ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const waveAt = (wave: string, phase: number): number => {
  const p = phase - Math.floor(phase);
  if (wave === 'sine') return Math.sin(2 * Math.PI * p);
  if (wave === 'square') return p < 0.5 ? 1 : -1;
  if (wave === 'saw') return 2 * p - 1;
  return 1 - 4 * Math.abs(p - 0.5);
};

/**
 * Adds one note to a part. A note that runs past the end of the piece continues at its start, so the part joins
 * itself. `attack` and `release` are in seconds; `bright` softens a bright wave with a simple low pass.
 */
function note(
  out: Float32Array,
  rate: number,
  start: number,
  seconds: number,
  midi: number,
  wave: string,
  volume: number,
  attack: number,
  release: number,
  bright = 1
): void {
  const frequency = hertz(midi),
    length = Math.round((seconds + release) * rate),
    first = Math.round(start * rate),
    held = seconds * rate,
    smoothing = Math.min(1, bright);
  let filtered = 0;
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    let envelope = Math.min(1, t / Math.max(attack, 1e-3));
    if (i > held) envelope *= Math.max(0, 1 - (i - held) / Math.max(release * rate, 1));
    const raw = waveAt(wave, frequency * t);
    filtered += (raw - filtered) * smoothing;
    out[(first + i) % out.length]! += filtered * envelope * volume;
  }
}
function noiseHit(
  out: Float32Array,
  rate: number,
  start: number,
  seconds: number,
  volume: number,
  random: () => number,
  tone = 0
): void {
  const length = Math.round(seconds * rate),
    first = Math.round(start * rate);
  for (let i = 0; i < length; i++) {
    const t = i / rate,
      envelope = Math.exp((-t / seconds) * 5),
      body = tone > 0 ? Math.sin(2 * Math.PI * tone * t * (1 - t / (seconds * 2))) : 0;
    out[(first + i) % out.length]! += ((random() * 2 - 1) * (tone > 0 ? 0.35 : 1) + body) * envelope * volume;
  }
}
/** Brings a part to a peak of `peak`, so parts of different density are heard alike. */
function level(part: Float32Array, peak: number): Float32Array {
  let most = 0;
  for (let i = 0; i < part.length; i++) most = Math.max(most, Math.abs(part[i]!));
  if (most > 0) for (let i = 0; i < part.length; i++) part[i]! *= peak / most;
  return part;
}

/** Writes a piece. Every call with the same options gives the same samples. */
export function composeMusic(options: MusicOptions = {}, rate = 22050): MusicPiece {
  const mood = options.mood ?? 'calm';
  const shape = MOODS[mood];
  if (shape === undefined) throw new TypeError('the mood of music is one of: ' + MUSIC_MOODS.join(', '));
  const tempo =
    typeof options.tempo === 'number' && Number.isFinite(options.tempo)
      ? Math.max(50, Math.min(200, options.tempo))
      : shape.tempo;
  const bars = options.bars === 4 ? 4 : 8;
  if (!Number.isSafeInteger(rate) || rate < 8000 || rate > 96000) throw new RangeError('a rate of 8000 to 96000');
  const random = generator(options.seed),
    beat = 60 / tempo,
    bar = 4 * beat,
    seconds = bars * bar,
    length = Math.round(seconds * rate);
  const parts = {
    pad: new Float32Array(length),
    bass: new Float32Array(length),
    drums: new Float32Array(length),
    tune: new Float32Array(length)
  };
  const degree = (index: number): number => {
    const octave = Math.floor(index / shape.scale.length),
      step = ((index % shape.scale.length) + shape.scale.length) % shape.scale.length;
    return shape.root + 12 * octave + shape.scale[step]!;
  };
  // A tune walks the scale over the chord of each bar, starting on a note of the chord.
  let walk = 14;
  for (let b = 0; b < bars; b++) {
    const chord = shape.chords[b % shape.chords.length]!,
      at = b * bar;
    // Pad: the three notes of the chord an octave and more above the bass, held the whole bar.
    for (const third of [0, 2, 4])
      note(parts.pad, rate, at, bar * 0.98, degree(chord + third) + 12, shape.pad, 0.3, 0.25, 0.4, 0.08);
    // Bass: the root of the chord.
    const low = degree(chord);
    if (shape.bass === 'whole') note(parts.bass, rate, at, bar * 0.9, low, 'triangle', 0.8, 0.02, 0.2, 0.5);
    else
      for (let step = 0; step < (shape.bass === 'eighths' ? 8 : 4); step++) {
        const each = shape.bass === 'eighths' ? beat / 2 : beat;
        note(
          parts.bass,
          rate,
          at + step * each,
          each * 0.7,
          low + (step % 4 === 3 ? 7 : 0),
          'saw',
          0.7,
          0.005,
          0.05,
          0.2
        );
      }
    // Drums.
    for (let step = 0; step < 16; step++) {
      const when = at + (step * beat) / 4,
        hit = shape.drums[step];
      if (hit === 'k') noiseHit(parts.drums, rate, when, 0.18, 0.9, random, 55);
      else if (hit === 's') noiseHit(parts.drums, rate, when, 0.14, 0.6, random, 180);
      else if (hit === 'h') noiseHit(parts.drums, rate, when, 0.04, 0.25, random);
    }
    // Tune.
    const notes = shape.tune.notes,
      each = bar / notes;
    walk = chord + 14 + Math.round(random() * 2) * 2 - 2 + (walk > chord + 18 ? -2 : 0);
    for (let n = 0; n < notes; n++) {
      if (n > 0) walk += Math.round((random() * 2 - 1) * shape.tune.leap);
      walk = Math.max(chord + 9, Math.min(chord + 21, walk));
      // A rest now and then lets the tune breathe.
      if (n > 0 && random() < 0.18) continue;
      note(parts.tune, rate, at + n * each, each * 0.8, degree(walk), shape.tune.wave, 0.5, 0.01, each * 0.3, 0.25);
    }
  }
  level(parts.pad, 0.5);
  level(parts.bass, 0.6);
  level(parts.drums, 0.6);
  level(parts.tune, 0.45);
  return Object.freeze({ mood, tempo, bars, rate, seconds: length / rate, parts: Object.freeze(parts) });
}
/** How loud each part is at an intensity from 0 to 1: the pad always, then the bass, the drums and the tune. */
export function musicMix(intensity: number): Record<MusicPart, number> {
  const x = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0));
  const ramp = (from: number): number => Math.max(0, Math.min(1, (x - from) / 0.2));
  return { pad: 1, bass: ramp(0.15), drums: ramp(0.45), tune: ramp(0.7) };
}
