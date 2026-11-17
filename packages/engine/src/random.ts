// SPDX-License-Identifier: Apache-2.0
// Repeatable random numbers for game rules. The same seed gives the same run,
// so a bug report can name a seed, a test can play a whole level, and a replay
// can be checked. The generator is sfc32: small, fast and good enough for
// games; it is not for secrets. Its state can be saved and restored.
import { EgretError } from '@egret/runtime';

export interface Random {
  /** A number in [0, 1). */
  next(): number;
  /** A number in [min, max). */
  range(min: number, max: number): number;
  /** A whole number from min to max, both included. */
  int(min: number, max: number): number;
  /** True with probability `chance`, 0.5 by default. */
  chance(chance?: number): boolean;
  /** One item of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** One item of a list, each as likely as its weight. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** The list in a new random order; the list itself is not changed. */
  shuffle<T>(items: readonly T[]): T[];
  /** A number around `mean` with the given spread, from a normal distribution. */
  normal(mean?: number, deviation?: number): number;
  /** A new generator seeded from this one, so one part of the game cannot change another's numbers. */
  fork(): Random;
  /** The state, to save and give to `createRandom` later. */
  state(): RandomState;
}

/** Four 32-bit words. */
export type RandomState = readonly [number, number, number, number];

/** Turns a string or number into a 32-bit seed. */
export function hashSeed(seed: string | number): number {
  const text = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A generator from a seed (a number or string) or a saved state. */
export function createRandom(seed: number | string | RandomState = Date.now()): Random {
  let a: number, b: number, c: number, d: number;
  if (Array.isArray(seed)) {
    if (seed.length !== 4 || !seed.every(word => Number.isInteger(word))) throw new EgretError('RANDOM_SEED_INVALID');
    [a, b, c, d] = seed.map(word => word >>> 0) as [number, number, number, number];
  } else {
    if (typeof seed !== 'string' && !(typeof seed === 'number' && Number.isFinite(seed)))
      throw new EgretError('RANDOM_SEED_INVALID');
    const h = hashSeed(seed);
    a = 0x9e3779b9;
    b = 0x243f6a88;
    c = 0xb7e15162;
    d = h;
    // Mix the seed in before the first number is drawn.
    for (let i = 0; i < 12; i++) step();
  }
  function step(): number {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  let spare: number | undefined;
  const random: Random = {
    next: step,
    range(min, max) {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new EgretError('RANDOM_RANGE_INVALID');
      return min + (max - min) * step();
    },
    int(min, max) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min)
        throw new EgretError('RANDOM_RANGE_INVALID');
      return min + Math.floor(step() * (max - min + 1));
    },
    chance(p = 0.5) {
      if (!(p >= 0 && p <= 1)) throw new EgretError('RANDOM_RANGE_INVALID');
      return step() < p;
    },
    pick(items) {
      if (!Array.isArray(items) || items.length === 0) throw new EgretError('RANDOM_RANGE_INVALID');
      return items[Math.floor(step() * items.length)]!;
    },
    weighted(items, weights) {
      if (!Array.isArray(items) || !Array.isArray(weights) || items.length === 0 || items.length !== weights.length)
        throw new EgretError('RANDOM_RANGE_INVALID');
      let total = 0;
      for (const weight of weights) {
        if (!(weight >= 0) || !Number.isFinite(weight)) throw new EgretError('RANDOM_RANGE_INVALID');
        total += weight;
      }
      if (!(total > 0)) throw new EgretError('RANDOM_RANGE_INVALID');
      let roll = step() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i]!;
        if (roll < 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(step() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    normal(mean = 0, deviation = 1) {
      if (spare !== undefined) {
        const value = spare;
        spare = undefined;
        return mean + deviation * value;
      }
      let u = 0,
        v = 0,
        s = 0;
      do {
        u = step() * 2 - 1;
        v = step() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const factor = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * factor;
      return mean + deviation * u * factor;
    },
    fork() {
      return createRandom([
        (step() * 4294967296) >>> 0,
        (step() * 4294967296) >>> 0,
        (step() * 4294967296) >>> 0,
        (step() * 4294967296) >>> 0
      ]);
    },
    state() {
      return Object.freeze([a >>> 0, b >>> 0, c >>> 0, d >>> 0]) as RandomState;
    }
  };
  return Object.freeze(random);
}
