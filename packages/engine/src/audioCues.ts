// SPDX-License-Identifier: Apache-2.0
// Sound effects by name, the way games play them: a footstep, a sword hit or a
// coin is one of several takes, never the same one twice in a row, a little
// higher or lower each time, and not more often than the ear can tell apart.
// A crowd of hits in one moment then sounds like a crowd and not like one
// sample machine-gunned. `encodeWav` turns samples a game synthesised into
// bytes the mixer decodes, for games that make their sounds in code.
import { EgretError } from '@egret/runtime';
import type { AudioMixer, AudioPlayOptions, AudioSound, AudioVoice } from './audioTypes.js';

/** A named sound effect: its takes, its bus and volume, and how often and how many at once it plays. */
export interface AudioCueDefinition {
  /** The takes; one is chosen each time. */
  readonly sounds: readonly AudioSound[];
  /** Defaults to the mixer's effects bus. */
  readonly bus?: string;
  /** Volume, as one number or a range that each play picks within. Defaults to 1. */
  readonly volume?: number | readonly [number, number];
  /** Rate (pitch and speed), as one number or a range. Defaults to 1. */
  readonly rate?: number | readonly [number, number];
  /** Seconds that must pass before the cue sounds again; plays inside it are skipped. Defaults to 0. */
  readonly cooldown?: number;
  /** At most this many voices of the cue at once; the oldest gives its place. Defaults to 4. */
  readonly maxVoices?: number;
}
/** How one play of a cue differs: its volume, pan and rate. */
export interface AudioCuePlayOptions {
  /** Multiplies the cue's volume, as for distance. */
  readonly volume?: number;
  readonly pan?: number;
  /** Multiplies the chosen rate. */
  readonly rate?: number;
}
/** Sound effects by name, each with its takes, cool-down and voice limit. */
export interface AudioCues {
  /** Plays a take of the cue, or nothing when it is cooling down. */
  play(name: string, options?: AudioCuePlayOptions): AudioVoice | undefined;
  /** Stops every voice of a cue. */
  stop(name: string, fade?: number): void;
  readonly names: readonly string[];
}
/** The clock and the random numbers cues choose by; give your own for tests and replays. */
export interface AudioCuesOptions {
  /** Seconds now; `performance.now()` by default. Tests and replays give their own clock. */
  readonly now?: () => number;
  /** Numbers from 0 to 1 for choosing takes and ranges; `Math.random` by default. */
  readonly random?: () => number;
}

const pickIn = (
  value: number | readonly [number, number] | undefined,
  fallback: number,
  roll: () => number
): number => {
  if (value === undefined) return fallback;
  if (typeof value === 'number') return value;
  return value[0] + (value[1] - value[0]) * roll();
};
const valid = (value: unknown, low: number, high: number): boolean =>
  value === undefined ||
  (typeof value === 'number' && value >= low && value <= high) ||
  (Array.isArray(value) &&
    value.length === 2 &&
    value.every(v => typeof v === 'number' && v >= low && v <= high) &&
    value[0] <= value[1]);

/** Names the sound effects of a game over `mixer`. */
export function createAudioCues(
  mixer: AudioMixer,
  cues: Readonly<Record<string, AudioCueDefinition>>,
  options: AudioCuesOptions = {}
): AudioCues {
  if (!mixer || typeof mixer.play !== 'function' || typeof cues !== 'object' || cues === null)
    throw new EgretError('AUDIO_CUES_INVALID');
  const clock = (globalThis as { performance?: { now(): number } }).performance;
  const now = options.now ?? ((): number => (clock ? clock.now() : Date.now()) / 1000);
  const roll = options.random ?? Math.random;
  const state = new Map<
    string,
    { definition: AudioCueDefinition; last: number; lastTake: number; voices: AudioVoice[] }
  >();
  for (const [name, definition] of Object.entries(cues)) {
    if (
      !definition ||
      !Array.isArray(definition.sounds) ||
      definition.sounds.length === 0 ||
      !valid(definition.volume, 0, 1) ||
      !valid(definition.rate, 0.25, 4) ||
      !(definition.cooldown === undefined || definition.cooldown >= 0) ||
      !(definition.maxVoices === undefined || (Number.isSafeInteger(definition.maxVoices) && definition.maxVoices >= 1))
    )
      throw new EgretError('AUDIO_CUES_INVALID', { cause: new TypeError(name) });
    state.set(name, { definition, last: -Infinity, lastTake: -1, voices: [] });
  }
  const cue = (name: string) => {
    const entry = state.get(name);
    if (!entry) throw new EgretError('AUDIO_CUES_INVALID', { cause: new TypeError('unknown cue ' + name) });
    return entry;
  };
  return Object.freeze({
    names: Object.freeze([...state.keys()]),
    play(name: string, play: AudioCuePlayOptions = {}): AudioVoice | undefined {
      const entry = cue(name),
        { definition } = entry;
      const t = now();
      if (t - entry.last < (definition.cooldown ?? 0)) return undefined;
      entry.last = t;
      // A different take from last time whenever there is more than one.
      const count = definition.sounds.length;
      let take = Math.min(count - 1, Math.floor(roll() * count));
      if (count > 1 && take === entry.lastTake) take = (take + 1 + Math.floor(roll() * (count - 1))) % count;
      entry.lastTake = take;
      entry.voices = entry.voices.filter(voice => voice.state !== 'ended');
      const limit = definition.maxVoices ?? 4;
      while (entry.voices.length >= limit) entry.voices.shift()!.stop({ fade: 0.03 });
      const volume = Math.min(1, Math.max(0, pickIn(definition.volume, 1, roll) * (play.volume ?? 1)));
      const rate = Math.min(4, Math.max(0.25, pickIn(definition.rate, 1, roll) * (play.rate ?? 1)));
      const request: AudioPlayOptions = {
        volume,
        rate,
        ...(definition.bus === undefined ? {} : { bus: definition.bus }),
        ...(play.pan === undefined ? {} : { pan: Math.min(1, Math.max(-1, play.pan)) })
      };
      const voice = mixer.play(definition.sounds[take]!, request);
      entry.voices.push(voice);
      return voice;
    },
    stop(name: string, fade = 0): void {
      const entry = cue(name);
      for (const voice of entry.voices.splice(0)) voice.stop({ fade });
    }
  });
}

/**
 * 16-bit PCM WAV bytes from channels of samples between -1 and 1, all the same length. The mixer decodes them
 * like a file, so sounds a game synthesised can be played, mixed and limited like recorded ones.
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 8) throw new EgretError('AUDIO_WAV_INVALID');
  const frames = channels[0]!.length;
  if (!channels.every(channel => channel instanceof Float32Array && channel.length === frames) || frames < 1)
    throw new EgretError('AUDIO_WAV_INVALID');
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 3000 || sampleRate > 384000)
    throw new EgretError('AUDIO_WAV_INVALID');
  const count = channels.length,
    dataBytes = frames * count * 2;
  if (dataBytes > 0x7fffffff - 44) throw new EgretError('AUDIO_WAV_INVALID');
  const bytes = new Uint8Array(44 + dataBytes),
    view = new DataView(bytes.buffer);
  const text = (at: number, value: string): void => {
    for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  let at = 44;
  for (let frame = 0; frame < frames; frame++)
    for (let c = 0; c < count; c++) {
      const sample = channels[c]![frame]!;
      const clamped = Number.isNaN(sample) ? 0 : Math.max(-1, Math.min(1, sample));
      view.setInt16(at, Math.round(clamped < 0 ? clamped * 32768 : clamped * 32767), true);
      at += 2;
    }
  return bytes;
}
