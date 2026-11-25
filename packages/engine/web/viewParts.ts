// SPDX-License-Identifier: Apache-2.0
// Parts most game screens need, as plain logic that draws nothing: red dots that add up from what they hold, numbers
// written short in the reader's way (12.3K, 1.2万), and a request that a button cannot send twice. Part of the
// optional entry @egret/engine/web/view; play draws them through `game.show`.
import { EgretError } from '@egret/runtime';

/** Red dots that add up: a dot on `mail/system` shows on `mail` too. */
export interface Badges {
  /** Sets what a path shows: a count, true for a dot without a number, or 0 or false for none. */
  set(path: string, value: number | boolean): void;
  /** The count of a path and of everything under it; a dot without a number counts 1. */
  count(path: string): number;
  /** Whether a path, or anything under it, has a dot. */
  has(path: string): boolean;
  /** Takes the dots away from a path and everything under it. */
  clear(path?: string): void;
  /** Every path that has a dot of its own, in order. */
  paths(): readonly string[];
  /** Calls `listener` after each change. Returns its removal. */
  onChange(listener: () => void): () => void;
}

const PATH = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
const badPath = (path: unknown): EgretError =>
  new EgretError('UI_BADGE_PATH_INVALID', { cause: String(path) + ' is not a path such as mail/system' });

/** Makes a tree of red dots. Paths are names joined by `/`: letters, digits, `_`, `-` and `.`. */
export function createBadges(): Badges {
  const own = new Map<string, number>();
  const listeners = new Set<() => void>();
  const check = (path: unknown): string => {
    if (typeof path !== 'string' || !PATH.test(path) || path.length > 256) throw badPath(path);
    return path;
  };
  const under = (path: string, of: string): boolean => path === of || path.startsWith(of + '/');
  const told = (): void => {
    for (const listener of [...listeners]) listener();
  };
  return {
    set(path, value) {
      check(path);
      const next =
        value === true
          ? 1
          : value === false
            ? 0
            : typeof value === 'number' && Number.isFinite(value)
              ? Math.max(0, Math.floor(value))
              : NaN;
      if (Number.isNaN(next))
        throw new EgretError('UI_BADGE_PATH_INVALID', { cause: path + ': a count, or true or false' });
      if ((own.get(path) ?? 0) === next) return;
      if (next === 0) own.delete(path);
      else own.set(path, next);
      told();
    },
    count(path) {
      check(path);
      let total = 0;
      for (const [at, value] of own) if (under(at, path)) total += value;
      return total;
    },
    has(path) {
      check(path);
      for (const at of own.keys()) if (under(at, path)) return true;
      return false;
    },
    clear(path) {
      if (path !== undefined) check(path);
      let changed = false;
      for (const at of [...own.keys()])
        if (path === undefined || under(at, path)) {
          own.delete(at);
          changed = true;
        }
      if (changed) told();
    },
    paths: () => Object.freeze([...own.keys()].sort()),
    onChange(listener) {
      if (typeof listener !== 'function')
        throw new EgretError('UI_BADGE_PATH_INVALID', { cause: 'a listener is a function' });
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/** How a number is written short: in Chinese with 万 and 亿, or in English with K, M, B and T. */
export interface CompactOptions {
  /** `'en'` unless given; `'zh'` writes 万 (10 000) and 亿 (100 000 000). */
  readonly locale?: 'en' | 'zh';
  /** Figures after the point, 0 to 3: 1 unless given. Zeros at the end are left off. */
  readonly digits?: number;
}

/**
 * A number written short for a screen: 999, 12.3K and 4.5M in English; 9999, 1.2万 and 3.4亿 in Chinese. Below the
 * first step it is written whole; a minus sign is kept. Written by hand, so it is the same wherever it runs.
 */
export function formatCompact(value: number, options: CompactOptions = {}): string {
  if (typeof value !== 'number' || Number.isNaN(value))
    throw new EgretError('UI_COMPACT_INVALID', { cause: 'a number' });
  const locale = options.locale ?? 'en',
    digits = options.digits ?? 1;
  if ((locale !== 'en' && locale !== 'zh') || !Number.isInteger(digits) || digits < 0 || digits > 3)
    throw new EgretError('UI_COMPACT_INVALID', { cause: "locale is 'en' or 'zh'; digits are 0 to 3" });
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  const sign = value < 0 ? '-' : '',
    size = Math.abs(value);
  const steps: readonly (readonly [number, string])[] =
    locale === 'zh'
      ? [
          [1e12, '万亿'],
          [1e8, '亿'],
          [1e4, '万']
        ]
      : [
          [1e12, 'T'],
          [1e9, 'B'],
          [1e6, 'M'],
          [1e3, 'K']
        ];
  const scale = 10 ** digits;
  for (let index = 0; index < steps.length; index++) {
    const [step, mark] = steps[index]!;
    if (size < step) continue;
    // Cut, not round, so that 9999 is never 10K short of what it is; a cut that reaches the next step uses it.
    const shown = Math.floor((size / step) * scale) / scale;
    const above = steps[index - 1];
    if (above !== undefined && shown * step >= above[0])
      return sign + trim(Math.floor((size / above[0]) * scale) / scale, digits) + above[1];
    return sign + trim(shown, digits) + mark;
  }
  return sign + String(Math.floor(size));
}
const trim = (value: number, digits: number): string => value.toFixed(digits).replace(/\.?0+$/, '');

/** A request a button sends: whether it is out, what it came back with, and the failure if it failed. */
export interface Request<A extends unknown[], R> {
  /**
   * Sends it, unless it is out already: then the promise of the one that is out is given again, so a second press
   * sends nothing. The promise settles with the result, or with undefined when it failed; it is never rejected.
   */
  run(...args: A): Promise<R | undefined>;
  /** Whether it is out: bind a button's `disabled` and its words to this. */
  readonly busy: boolean;
  /** What the last that came back gave, or undefined. */
  readonly result: R | undefined;
  /** Why the last one failed, or undefined when it did not. Cleared when it is sent again. */
  readonly error: unknown;
  /** How many have been sent. */
  readonly sent: number;
}

/** Wraps what a button sends, such as a purchase, so that it is sent once at a time and its state can be shown. */
export function createRequest<A extends unknown[], R>(send: (...args: A) => R | Promise<R>): Request<A, R> {
  if (typeof send !== 'function')
    throw new EgretError('UI_REQUEST_INVALID', { cause: 'a request sends with a function' });
  let out: Promise<R | undefined> | undefined,
    result: R | undefined,
    error: unknown,
    sent = 0;
  return {
    run(...args) {
      if (out !== undefined) return out;
      sent++;
      error = undefined;
      const going = (async () => {
        try {
          result = await send(...args);
          return result;
        } catch (cause) {
          error = cause ?? new EgretError('UI_REQUEST_INVALID', { cause: 'it failed without a reason' });
          return undefined;
        } finally {
          out = undefined;
        }
      })();
      // The function above runs to its first `await` and no further, so `out` is let go only after it is set here.
      out = going;
      return going;
    },
    get busy() {
      return out !== undefined;
    },
    get result() {
      return result;
    },
    get error() {
      return error;
    },
    get sent() {
      return sent;
    }
  };
}

/** The words of a key or a button, as a player reads them on a key cap. */
export function keyCap(key: string, device: 'keyboard' | 'gamepad'): string {
  if (typeof key !== 'string' || key === '') return '';
  if (device === 'gamepad') {
    const pad: Record<string, string> = {
      a: 'A',
      b: 'B',
      x: 'X',
      y: 'Y',
      l1: 'LB',
      r1: 'RB',
      l2: 'LT',
      r2: 'RT',
      select: 'View',
      start: 'Menu',
      up: 'D-pad Up',
      down: 'D-pad Down',
      left: 'D-pad Left',
      right: 'D-pad Right'
    };
    return pad[key.replace(/^pad:/, '').toLowerCase()] ?? key;
  }
  const named: Record<string, string> = {
    space: 'Space',
    enter: 'Enter',
    escape: 'Esc',
    shift: 'Shift',
    tab: 'Tab',
    left: 'Left',
    right: 'Right',
    up: 'Up',
    down: 'Down',
    backspace: 'Backspace'
  };
  const lower = key.toLowerCase();
  if (named[lower] !== undefined) return named[lower];
  if (/^Key[A-Z]$/.test(key)) return key.slice(3);
  if (/^Digit[0-9]$/.test(key)) return key.slice(5);
  if (/^Arrow(Left|Right|Up|Down)$/.test(key)) return key.slice(5);
  return key.length === 1 ? key.toUpperCase() : key;
}
