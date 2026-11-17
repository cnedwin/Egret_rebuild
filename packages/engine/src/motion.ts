// SPDX-License-Identifier: Apache-2.0
// Motion: several numbers of one object moved together, one step after another, on the Engine's scalar tween. Each
// step is one tween from 0 to 1 on the Engine's clock; this module only says what that fraction means.
import { EgretError } from '@egret/runtime';
import type { Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { Tween } from './tweenTypes.js';

/** How a step runs from its start to its end: a name, or a function from 0–1 to 0–1 (it may pass both on the way). */
export type MotionEasing = MotionEasingName | ((fraction: number) => number);
export type MotionEasingName =
  | 'linear'
  | 'quadIn'
  | 'quadOut'
  | 'quadInOut'
  | 'cubicIn'
  | 'cubicOut'
  | 'cubicInOut'
  | 'quartIn'
  | 'quartOut'
  | 'quartInOut'
  | 'sineIn'
  | 'sineOut'
  | 'sineInOut'
  | 'expoIn'
  | 'expoOut'
  | 'expoInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'elasticOut'
  | 'bounceOut';
export type MotionState = 'idle' | 'running' | 'paused' | 'finished' | 'stopped';
/** A chain of steps for one object. Steps are added before `start`; the calls return the motion, so they chain. */
export interface Motion<T extends object> {
  readonly state: MotionState;
  /** Moves the named numbers of the object from what they are when the step begins to these values, over seconds. */
  to(values: { readonly [K in keyof T]?: number }, seconds: number, easing?: MotionEasing): this;
  /** Holds for seconds. */
  wait(seconds: number): this;
  /** Calls a function when the chain reaches it. */
  call(callback: () => void): this;
  /** Runs the chain this many times in all; without a number, until it is stopped. */
  loop(times?: number): this;
  /** Called once when the last step of the last run has ended. */
  onFinish(callback: () => void): this;
  start(): this;
  pause(): void;
  resume(): void;
  /** Ends the motion where it is. The object keeps the values it has. */
  stop(): void;
}

const invalid = (): EgretError => new EgretError('MOTION_OPTIONS_INVALID');
const out =
  (ease: (t: number) => number) =>
  (t: number): number =>
    1 - ease(1 - t);
const inOut =
  (ease: (t: number) => number) =>
  (t: number): number =>
    t < 0.5 ? ease(2 * t) / 2 : 1 - ease(2 - 2 * t) / 2;
const power =
  (n: number) =>
  (t: number): number =>
    t ** n;
const sine = (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
  expo = (t: number): number => (t === 0 ? 0 : 2 ** (10 * t - 10));
const back = (t: number): number => 2.70158 * t * t * t - 1.70158 * t * t;
function bounceOut(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  }
  if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + 0.984375;
}
const EASINGS: Readonly<Record<MotionEasingName, (t: number) => number>> = {
  linear: t => t,
  quadIn: power(2),
  quadOut: out(power(2)),
  quadInOut: inOut(power(2)),
  cubicIn: power(3),
  cubicOut: out(power(3)),
  cubicInOut: inOut(power(3)),
  quartIn: power(4),
  quartOut: out(power(4)),
  quartInOut: inOut(power(4)),
  sineIn: sine,
  sineOut: out(sine),
  sineInOut: inOut(sine),
  expoIn: expo,
  expoOut: out(expo),
  expoInOut: inOut(expo),
  backIn: back,
  backOut: out(back),
  backInOut: inOut(back),
  elasticOut: t => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
  bounceOut
};

type Step =
  | {
      readonly kind: 'to';
      readonly names: readonly string[];
      readonly ends: readonly number[];
      readonly seconds: number;
      readonly ease: (t: number) => number;
    }
  | { readonly kind: 'wait'; readonly seconds: number }
  | { readonly kind: 'call'; readonly callback: () => void };

/**
 * A motion of one object: `animate(engine, scope, sprite).to({ x: 100, alpha: 0.5 }, 0.5, 'quadOut').wait(0.2).to({ x: 0 }, 0.5).start()`.
 * It runs on the Engine's clock, like a tween, and ends with its scope.
 */
export function animate<T extends object>(engine: Engine, scope: Scope, target: T): Motion<T> {
  if (target === null || (typeof target !== 'object' && typeof target !== 'function')) throw invalid();
  const steps: Step[] = [],
    record = target as Record<string, unknown>;
  let state: MotionState = 'idle',
    runs = 1,
    run = 0,
    at = 0,
    tween: Tween | undefined,
    finish: (() => void) | undefined;
  const seconds = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid();
    return value;
  };
  const building = (): void => {
    if (state !== 'idle') throw new EgretError('MOTION_ALREADY_STARTED');
  };
  /** One tween from 0 to 1 over seconds; a step of no length is taken at once. */
  function span(length: number, update: (fraction: number) => void): void {
    if (length === 0) {
      update(1);
      next();
      return;
    }
    tween = engine.createTween(scope, {
      from: 0,
      to: 1,
      durationSeconds: length,
      onUpdate: (fraction): undefined => {
        update(fraction);
      },
      onComplete: (): undefined => {
        tween = undefined;
        next();
      }
    });
    tween.start();
  }
  function next(): void {
    // A callback may have stopped the motion.
    while (state === 'running') {
      if (at === steps.length) {
        run++;
        at = 0;
        if (run >= runs || steps.length === 0) {
          state = 'finished';
          const callback = finish;
          finish = undefined;
          callback?.();
          return;
        }
      }
      const step = steps[at++]!;
      if (step.kind === 'call') {
        step.callback();
        continue;
      }
      if (step.kind === 'wait') {
        span(step.seconds, () => {});
        return;
      }
      // The values the step starts from are the ones the object has now, not those it had when the chain was written.
      const starts = step.names.map(name => {
        const value = record[name];
        if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid();
        return value;
      });
      span(step.seconds, fraction => {
        // An object that was disposed while it moved is left alone, and the motion ends there.
        if (record['isDisposed'] === true) {
          motion.stop();
          return;
        }
        const eased = fraction === 1 ? 1 : step.ease(fraction);
        for (let i = 0; i < step.names.length; i++)
          record[step.names[i]!] = fraction === 1 ? step.ends[i]! : starts[i]! + (step.ends[i]! - starts[i]!) * eased;
      });
      return;
    }
  }
  const motion: Motion<T> = {
    get state() {
      return state;
    },
    to(values, length, easing = 'linear') {
      building();
      if (values === null || typeof values !== 'object') throw invalid();
      const ease = typeof easing === 'function' ? easing : Object.hasOwn(EASINGS, easing) ? EASINGS[easing] : undefined;
      if (ease === undefined) throw invalid();
      const names = Object.keys(values),
        ends = names.map(name => (values as Record<string, unknown>)[name]);
      if (names.length === 0 || ends.some(value => typeof value !== 'number' || !Number.isFinite(value)))
        throw invalid();
      steps.push({ kind: 'to', names, ends: ends as number[], seconds: seconds(length), ease });
      return this;
    },
    wait(length) {
      building();
      steps.push({ kind: 'wait', seconds: seconds(length) });
      return this;
    },
    call(callback) {
      building();
      if (typeof callback !== 'function') throw invalid();
      steps.push({ kind: 'call', callback });
      return this;
    },
    loop(times = Infinity) {
      building();
      if (typeof times !== 'number' || !(times >= 1) || (times !== Infinity && !Number.isInteger(times)))
        throw invalid();
      // A chain that takes no time cannot be run without end.
      runs = times;
      return this;
    },
    onFinish(callback) {
      building();
      if (typeof callback !== 'function') throw invalid();
      finish = callback;
      return this;
    },
    start() {
      building();
      if (runs === Infinity && !steps.some(step => step.kind !== 'call' && step.seconds > 0)) throw invalid();
      state = 'running';
      next();
      return this;
    },
    pause() {
      if (state === 'running' && tween !== undefined) {
        tween.pause();
        state = 'paused';
      }
    },
    resume() {
      if (state === 'paused') {
        state = 'running';
        tween?.resume();
      }
    },
    stop() {
      if (state === 'finished' || state === 'stopped') return;
      state = 'stopped';
      const active = tween;
      tween = undefined;
      finish = undefined;
      active?.dispose();
    }
  };
  return motion;
}
