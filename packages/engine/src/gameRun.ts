// SPDX-License-Identifier: Apache-2.0
// Two parts most games wrote for themselves.
//
// Quality variants: the same model or picture at several levels of detail, and
// the one to load for the picture quality a player chose. A tier that is not
// there gives the nearest one below it, then above it.
//
// Headless runs: the game's rules played to the end without a page, by a
// stand-in player, once per seed, with how long each step took. Rules kept
// apart from the picture can then be tested whole and balanced from a script.
import { EgretError } from '@egret/runtime';

/** Quality tiers from lowest to highest, as World3D names them. */
export const QUALITY_TIERS = Object.freeze(['low', 'medium', 'high'] as const);
export type QualityTier = (typeof QUALITY_TIERS)[number];

/**
 * Of several variants of one asset, the one for `quality`: an exact tier, or else the nearest below, or else the
 * nearest above. `variants` maps tiers to anything: a URL, a bundle entry name, a loaded model.
 */
export function pickQualityVariant<T>(variants: Partial<Record<QualityTier, T>>, quality: QualityTier): T {
  if (typeof variants !== 'object' || variants === null) throw new EgretError('QUALITY_VARIANT_INVALID');
  const at = QUALITY_TIERS.indexOf(quality);
  if (at < 0) throw new EgretError('QUALITY_VARIANT_INVALID', { cause: new TypeError(String(quality)) });
  for (let i = at; i >= 0; i--) if (variants[QUALITY_TIERS[i]!] !== undefined) return variants[QUALITY_TIERS[i]!]!;
  for (let i = at + 1; i < QUALITY_TIERS.length; i++)
    if (variants[QUALITY_TIERS[i]!] !== undefined) return variants[QUALITY_TIERS[i]!]!;
  throw new EgretError('QUALITY_VARIANT_MISSING');
}

/**
 * Names of the form `<base>-<tier>.<ext>` grouped by base and chosen for `quality`, as a bundle or a folder lists
 * them: `hero-high.glb`, `hero-low.glb` and `hall.webp` give `hero-low.glb` (for `medium`) and `hall.webp`.
 */
export function pickQualityFiles(names: readonly string[], quality: QualityTier): string[] {
  if (!Array.isArray(names)) throw new EgretError('QUALITY_VARIANT_INVALID');
  const groups = new Map<string, Partial<Record<QualityTier, string>> | string>();
  for (const name of names) {
    if (typeof name !== 'string') throw new EgretError('QUALITY_VARIANT_INVALID');
    const match = /^(.*)-(low|medium|high)(\.[^./]+)?$/.exec(name);
    if (!match) {
      groups.set(name, name);
      continue;
    }
    const key = match[1]! + (match[3] ?? '');
    const group = groups.get(key);
    const variants = typeof group === 'object' ? group : {};
    variants[match[2] as QualityTier] = name;
    groups.set(key, variants);
  }
  return [...groups.values()].map(group => (typeof group === 'string' ? group : pickQualityVariant(group, quality)));
}

/** What a headless run needs of a game: its state and one step of its rules. */
export interface HeadlessGame<Input> {
  /** One step of `seconds` with the stand-in player's input. */
  update(seconds: number, input: Input): void;
}
export interface HeadlessRunOptions<G extends HeadlessGame<Input>, Input> {
  /** A new game for a seed. */
  readonly createGame: (seed: number) => G;
  /** The stand-in player for that game: given the game and a step, it returns the input. */
  readonly createPlayer: (game: G, seed: number) => (seconds: number) => Input;
  /** True when the run is over, as when the game is won or lost. */
  readonly done: (game: G) => boolean;
  /** The seeds to play: a count from 1, or a list. Defaults to 1. */
  readonly seeds?: number | readonly number[];
  /** Seconds a step. Defaults to 1/60. */
  readonly step?: number;
  /** Game seconds after which a run is stopped as unfinished. Defaults to 1200. */
  readonly maxSeconds?: number;
  /** What to record of a finished game, such as its outcome and score. */
  readonly summary?: (game: G) => Record<string, unknown>;
  /** Milliseconds now; `performance.now()` by default. */
  readonly now?: () => number;
}
export interface HeadlessRunResult {
  readonly seed: number;
  /** False when the run reached `maxSeconds` without `done`. */
  readonly finished: boolean;
  readonly seconds: number;
  readonly steps: number;
  /** Milliseconds per step: the average and the slowest. */
  readonly averageMs: number;
  readonly slowestMs: number;
  readonly summary: Record<string, unknown>;
}

/** Plays the game once per seed with the stand-in player and reports each run. */
export function runHeadless<G extends HeadlessGame<Input>, Input>(
  options: HeadlessRunOptions<G, Input>
): HeadlessRunResult[] {
  if (
    !options ||
    typeof options.createGame !== 'function' ||
    typeof options.createPlayer !== 'function' ||
    typeof options.done !== 'function'
  )
    throw new EgretError('HEADLESS_RUN_INVALID');
  const step = options.step ?? 1 / 60,
    maxSeconds = options.maxSeconds ?? 1200;
  if (!(step > 0 && step <= 1) || !(maxSeconds > 0) || !Number.isFinite(maxSeconds))
    throw new EgretError('HEADLESS_RUN_INVALID');
  const seeds =
    typeof options.seeds === 'number'
      ? Array.from({ length: options.seeds }, (_, i) => i + 1)
      : [...(options.seeds ?? [1])];
  if (seeds.length === 0 || !seeds.every(seed => Number.isFinite(seed))) throw new EgretError('HEADLESS_RUN_INVALID');
  const clock = (globalThis as { performance?: { now(): number } }).performance;
  const now = options.now ?? (() => (clock ? clock.now() : Date.now()));
  const maxSteps = Math.ceil(maxSeconds / step);
  return seeds.map(seed => {
    const game = options.createGame(seed);
    const player = options.createPlayer(game, seed);
    let steps = 0,
      total = 0,
      slowest = 0;
    while (!options.done(game) && steps < maxSteps) {
      const before = now();
      game.update(step, player(step));
      const took = now() - before;
      total += took;
      slowest = Math.max(slowest, took);
      steps++;
    }
    return Object.freeze({
      seed,
      finished: options.done(game),
      seconds: steps * step,
      steps,
      averageMs: steps ? total / steps : 0,
      slowestMs: slowest,
      summary: options.summary ? options.summary(game) : {}
    });
  });
}
