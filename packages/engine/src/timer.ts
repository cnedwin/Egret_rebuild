// SPDX-License-Identifier: Apache-2.0
// Timers on the Engine's clock, for code that used Egret's Timer and setTimeout. They count the clock's seconds, so
// they stop while the clock is paused and keep pace with a game run by hand. A timer ends with its scope.
import { EgretError } from '@egret/runtime';
import type { Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { GameClockSubscription } from './gameClockTypes.js';

/** Calls a function every `delay` seconds, `repeatCount` times or until it is stopped, as Egret's Timer. */
export interface Timer {
  /** Seconds between calls. It can be changed while it runs; the next call comes that long after the last. */
  delay: number;
  /** How many calls in all before it completes; 0 for no end. */
  repeatCount: number;
  /** How many calls there have been since it was made or reset. */
  readonly currentCount: number;
  readonly running: boolean;
  /** Called each time, with the count so far. Several can be added; they are called in the order they were. */
  onTimer(callback: (count: number) => void): this;
  /** Called once, after the last call of a timer with a `repeatCount`. */
  onComplete(callback: () => void): this;
  start(): this;
  /** Stops it, keeping its count; `start` waits a whole delay again before the next call, as Egret's did. */
  stop(): this;
  /** Stops it and sets its count back to 0. */
  reset(): this;
}
/** A call to come: `cancel` takes it back if it has not been made. */
export interface Delayed {
  readonly done: boolean;
  cancel(): void;
}

const invalid = (): EgretError => new EgretError('TIMER_OPTIONS_INVALID');
/** The shortest delay: shorter ones would call more times in a frame than a frame should hold. */
const SHORTEST = 0.001;
const seconds = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < SHORTEST) throw invalid();
  return value;
};
const count = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
};

/**
 * A timer: `createTimer(engine, scope, 1, 5).onTimer(n => …).onComplete(() => …).start()`. A frame longer than the
 * delay makes as many calls as the delay fits into it, so a count of seconds stays right however the frames fall.
 */
export function createTimer(engine: Engine, scope: Scope, delay: number, repeatCount = 0): Timer {
  let every = seconds(delay),
    limit = count(repeatCount),
    done = 0,
    owed = 0,
    subscription: GameClockSubscription | undefined;
  const ticks: ((count: number) => void)[] = [],
    ends: (() => void)[] = [];
  const halt = (): void => {
    subscription?.dispose();
    subscription = undefined;
  };
  const timer: Timer = {
    get delay() {
      return every;
    },
    set delay(value: number) {
      every = seconds(value);
    },
    get repeatCount() {
      return limit;
    },
    set repeatCount(value: number) {
      limit = count(value);
    },
    get currentCount() {
      return done;
    },
    get running() {
      return subscription !== undefined && !subscription.isDisposed;
    },
    onTimer(callback) {
      if (typeof callback !== 'function') throw invalid();
      ticks.push(callback);
      return timer;
    },
    onComplete(callback) {
      if (typeof callback !== 'function') throw invalid();
      ends.push(callback);
      return timer;
    },
    start() {
      if (timer.running || (limit > 0 && done >= limit)) return timer;
      subscription = engine.clock.onTick(scope, tick => {
        owed += tick.deltaSeconds;
        // A callback may stop, reset or restart the timer, or change its delay.
        while (owed >= every && timer.running) {
          owed -= every;
          done++;
          for (const callback of [...ticks]) callback(done);
          if (limit > 0 && done >= limit && timer.running) {
            halt();
            owed = 0;
            for (const callback of [...ends]) callback();
          }
        }
        return undefined;
      });
      return timer;
    },
    stop() {
      halt();
      owed = 0;
      return timer;
    },
    reset() {
      halt();
      done = 0;
      owed = 0;
      return timer;
    }
  };
  return timer;
}

/** Calls a function once, `seconds` from now on the Engine's clock, as Egret's setTimeout. */
export function after(engine: Engine, scope: Scope, seconds: number, callback: () => void): Delayed {
  if (typeof callback !== 'function') throw invalid();
  let done = false;
  const timer = createTimer(engine, scope, seconds, 1)
    .onComplete(() => {
      done = true;
      callback();
    })
    .start();
  return {
    get done() {
      return done;
    },
    cancel() {
      if (!done) {
        done = true;
        timer.stop();
      }
    }
  };
}
