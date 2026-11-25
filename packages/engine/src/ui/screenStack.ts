// SPDX-License-Identifier: Apache-2.0
// The screens of a game and which is in front: pages in a stack, popups over them and one modal at a time, with
// what each screen gives back when it closes. The stack draws nothing. A screen is made by its definition's `open`
// and told, through its handle, when it is shown, covered, revealed, made active or closed; the application, or the
// data-described screens built on this, shows and hides what it drew.
import { CancellationController, EgretError } from '@egret/runtime';
import type { CancellationSignal } from '@egret/contracts';

/** Where a screen goes: a page of the stack, a popup over the pages, or a modal, of which one is shown at a time. */
export type UiScreenLayer = 'page' | 'popup' | 'modal';

/** What a screen is told. Every call is optional; one that throws does not stop the stack. */
export interface UiScreenHandle {
  /** It is now on the screen. */
  show?(): void;
  /** It is no longer on the screen, just before `close`. */
  hide?(): void;
  /** A full-screen page opened over it: hide it, and pause what moves in it. */
  cover?(): void;
  /** The page over it closed: show it again, and go on. */
  reveal?(): void;
  /** It is the screen in front, the one that takes input. */
  activate?(): void;
  /** Another screen is in front of it now. */
  deactivate?(): void;
  /** It has closed: let go of what it made. */
  close?(): void;
}

/** What a screen is given when it is made: its parameters, how it closes itself, and whether it is covered. */
export interface UiScreenContext<P = undefined, R = undefined> {
  readonly params: P;
  /** Closes this screen, giving `result` to whoever opened it. */
  close(result?: R): void;
  /** Aborted when this screen closes: hand it to what the screen starts, such as a request. */
  readonly signal: CancellationSignal;
  /** Whether a full-screen page is over it now. */
  readonly covered: boolean;
  /** Whether it is the screen in front now. */
  readonly active: boolean;
}

/** A kind of screen: its name, its layer, what the back key does on it, and how it is made. */
export interface UiScreenDefinition<P = undefined, R = undefined> {
  /** A name for the screen, unique in a stack: letters, digits, `.`, `-` and `_`. */
  readonly id: string;
  readonly layer: UiScreenLayer;
  /** For a page: whether it hides the pages under it. True unless false is given. */
  readonly fullScreen?: boolean;
  /** What the back key does while it is in front: close it (the default), nothing, or what the function does. */
  readonly back?: 'close' | 'none' | (() => void);
  /** Makes the screen. It may return a promise: the screen opens when it settles. */
  open(context: UiScreenContext<P, R>): UiScreenHandle | void | Promise<UiScreenHandle | void>;
}

/** A screen stack to make: how many screens it holds, and who is told of failures nothing else is told of. */
export interface UiScreenStackOptions {
  /** How many screens may be open or waiting at once: 32 unless given, at most 256. */
  readonly maxScreens?: number;
  /** Told of a failure of a screen's handle when an earlier one was already given to the caller. */
  readonly onError?: (cause: unknown) => void;
}

/** The stack as it is now, by the screens' ids. */
export interface UiScreenStackSnapshot {
  readonly state: 'open' | 'closed';
  /** Pages from the bottom up, popups from the bottom up, the modal shown and those waiting their turn. */
  readonly pages: readonly string[];
  readonly popups: readonly string[];
  readonly modal: string | undefined;
  readonly waiting: readonly string[];
  /** The screen in front, which takes input; undefined when none is open. */
  readonly active: string | undefined;
  /** The pages a full-screen page above hides. */
  readonly covered: readonly string[];
}

/** Pages, popups and modals, opened and closed in turn. */
export interface UiScreenStack {
  /**
   * Opens a screen with its parameters, after what was asked before is done. The promise settles when it closes:
   * with what it gave to `close`, or undefined. Opening a screen that is open, or opening, with equal parameters gives
   * the same promise; with other parameters it is refused.
   */
  open<P, R>(screen: UiScreenDefinition<P, R>, params?: P): Promise<R | undefined>;
  /** Closes a screen, giving `result` to whoever opened it. A screen not open is left alone. */
  close<R>(screen: UiScreenDefinition<never, R> | UiScreenDefinition<any, R>, result?: R): Promise<void>;
  /** Closes the page on top, if any, and opens `screen` as a page in its place. */
  replace<P, R>(screen: UiScreenDefinition<P, R>, params?: P): Promise<R | undefined>;
  /**
   * What the back key does: to the screen in front, what its `back` says. A page with nothing over it and no page
   * under it is not closed. True when something was done.
   */
  back(): Promise<boolean>;
  /** Closes every screen over `screen`, which stays. */
  popTo(screen: UiScreenDefinition<any, any>): Promise<void>;
  /** Closes every screen of a layer, or of all of them, waiting modals too. */
  closeAll(layer?: UiScreenLayer): Promise<void>;
  /** Whether a screen is open, opening or waiting. */
  isOpen(screen: UiScreenDefinition<any, any>): boolean;
  /** The screen in front, or undefined. */
  readonly active: UiScreenDefinition<any, any> | undefined;
  snapshot(): UiScreenStackSnapshot;
  /** Calls `listener` with the stack after each change. Returns its removal. */
  onChange(listener: (snapshot: UiScreenStackSnapshot) => void): () => void;
  /** Closes every screen, then refuses what is asked after. */
  dispose(): Promise<void>;
}

interface Entry {
  readonly screen: UiScreenDefinition<any, any>;
  readonly params: unknown;
  readonly result: Promise<unknown>;
  readonly settle: (value: unknown) => void;
  readonly fail: (cause: unknown) => void;
  readonly abort: CancellationController;
  state: 'waiting' | 'opening' | 'open' | 'closed';
  handle: UiScreenHandle | undefined;
  covered: boolean;
  active: boolean;
  /** A close asked for while it was being made. */
  closing?: { readonly result: unknown };
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const invalid = (what: string): EgretError => new EgretError('UI_SCREENS_DEFINITION_INVALID', { cause: what });

/** Equal parameters: the same value, or plain objects and arrays of equal values, whatever the order of their keys. */
function sameParams(a: unknown, b: unknown, depth = 0): boolean {
  if (Object.is(a, b)) return true;
  if (depth > 16 || a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a))
    return (
      a.length === (b as unknown[]).length && a.every((item, i) => sameParams(item, (b as unknown[])[i], depth + 1))
    );
  const plain = (value: object): boolean => [Object.prototype, null].includes(Object.getPrototypeOf(value));
  if (!plain(a) || !plain(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      key =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        sameParams((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth + 1)
    )
  );
}

function checkScreen(screen: unknown): UiScreenDefinition<any, any> {
  if (screen === null || typeof screen !== 'object') throw invalid('screen');
  const s = screen as UiScreenDefinition<any, any>;
  if (typeof s.id !== 'string' || !ID.test(s.id)) throw invalid('id');
  if (s.layer !== 'page' && s.layer !== 'popup' && s.layer !== 'modal') throw invalid('layer');
  if (s.fullScreen !== undefined && typeof s.fullScreen !== 'boolean') throw invalid('fullScreen');
  if (s.back !== undefined && s.back !== 'close' && s.back !== 'none' && typeof s.back !== 'function')
    throw invalid('back');
  if (typeof s.open !== 'function') throw invalid('open');
  return s;
}

/**
 * Makes a screen stack. Each call that changes it waits for the ones before, so a screen opened from a button while
 * another is being made opens after it. Screens are told, in this order: when one opens, `show`, then `cover` on the
 * pages it hides, then `deactivate` on the screen that was in front and `activate` on the new one; when one closes,
 * `deactivate` if it was in front, `hide`, `close`, then `reveal` and `activate` on what is in front after it.
 */
export function createUiScreenStack(options: UiScreenStackOptions = {}): UiScreenStack {
  if (options === null || typeof options !== 'object') throw new EgretError('UI_SCREENS_OPTIONS_INVALID');
  const limit = options.maxScreens ?? 32,
    onError = options.onError;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 256 ||
    (onError !== undefined && typeof onError !== 'function')
  )
    throw new EgretError('UI_SCREENS_OPTIONS_INVALID');
  const pages: Entry[] = [],
    popups: Entry[] = [],
    waiting: Entry[] = [];
  let modal: Entry | undefined,
    closed = false,
    queue: Promise<unknown> = Promise.resolve(),
    front: Entry | undefined;
  const entries = new Map<string, Entry>();
  const listeners = new Set<(snapshot: UiScreenStackSnapshot) => void>();

  /** Runs `work` after everything asked before; its failures reach its caller only. */
  function enqueue<T>(work: () => Promise<T> | T): Promise<T> {
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  }
  /** Calls a hook of a handle; what it throws is kept to give the caller once the step is done. */
  function call(entry: Entry, name: keyof UiScreenHandle, errors: unknown[]): void {
    const hook = entry.handle?.[name];
    if (typeof hook !== 'function') return;
    try {
      hook.call(entry.handle);
    } catch (cause) {
      errors.push(cause);
    }
  }
  /** The first failure goes to the caller; the rest are told to `onError`, or to the page. */
  function settleErrors(errors: unknown[]): void {
    if (errors.length === 0) return;
    for (const extra of errors.slice(1)) {
      if (onError !== undefined) onError(extra);
      else (globalThis as { reportError?: (cause: unknown) => void }).reportError?.(extra);
    }
    throw errors[0];
  }
  const shownTop = (): Entry | undefined => modal ?? popups.at(-1) ?? pages.at(-1);
  /** Covers and reveals pages, and moves the front, as the stack now stands. */
  function arrange(errors: unknown[]): void {
    let hidden = false;
    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i]!;
      if (hidden !== page.covered) {
        page.covered = hidden;
        call(page, hidden ? 'cover' : 'reveal', errors);
      }
      if (page.screen.fullScreen !== false) hidden = true;
    }
    const next = shownTop();
    if (next !== front) {
      const before = front;
      front = next;
      if (before !== undefined && before.state === 'open' && before.active) {
        before.active = false;
        call(before, 'deactivate', errors);
      }
      if (next !== undefined) {
        next.active = true;
        call(next, 'activate', errors);
      }
    }
  }
  function tell(): void {
    const now = snapshot();
    for (const listener of [...listeners])
      try {
        listener(now);
      } catch (cause) {
        if (onError !== undefined) onError(cause);
        else (globalThis as { reportError?: (cause: unknown) => void }).reportError?.(cause);
      }
  }
  function listOf(layer: UiScreenLayer): Entry[] {
    return layer === 'page' ? pages : popups;
  }
  /** Makes and shows a screen. A modal waits while another is shown. */
  async function show(entry: Entry): Promise<void> {
    if (entry.state === 'closed') return;
    if (entry.screen.layer === 'modal' && modal !== undefined && modal !== entry) {
      entry.state = 'waiting';
      if (!waiting.includes(entry)) waiting.push(entry);
      return;
    }
    entry.state = 'opening';
    if (entry.screen.layer === 'modal') modal = entry;
    let handle: UiScreenHandle | void;
    try {
      handle = await entry.screen.open(contextOf(entry));
      if (handle !== undefined && (handle === null || typeof handle !== 'object')) throw invalid('handle');
    } catch (cause) {
      // A screen that could not be made is not kept, and the one who opened it is told why.
      entries.delete(entry.screen.id);
      entry.state = 'closed';
      entry.abort.abort();
      if (modal === entry) modal = undefined;
      entry.fail(cause);
      const errors: unknown[] = [];
      arrange(errors);
      await showNextModal();
      tell();
      settleErrors(errors);
      return;
    }
    entry.handle = handle ?? undefined;
    if (entry.screen.layer !== 'modal') listOf(entry.screen.layer).push(entry);
    entry.state = 'open';
    const errors: unknown[] = [];
    call(entry, 'show', errors);
    arrange(errors);
    tell();
    const asked = entry.closing;
    if (asked !== undefined) await shut([entry], asked.result);
    settleErrors(errors);
  }
  async function showNextModal(): Promise<void> {
    while (modal === undefined && waiting.length > 0) await show(waiting.shift()!);
  }
  /** Closes screens, top first, and arranges the stack once after. */
  async function shut(closing: Entry[], result?: unknown, results?: Map<Entry, unknown>): Promise<void> {
    const errors: unknown[] = [];
    let modalClosed = false;
    for (const entry of closing) {
      if (entry.state === 'closed') continue;
      const given = results?.has(entry) ? results.get(entry) : result;
      if (entry.state === 'opening') {
        entry.closing = { result: given };
        continue;
      }
      if (entry.state === 'waiting') {
        waiting.splice(waiting.indexOf(entry), 1);
        entries.delete(entry.screen.id);
        entry.state = 'closed';
        entry.abort.abort();
        entry.settle(given);
        continue;
      }
      if (entry.active) {
        entry.active = false;
        call(entry, 'deactivate', errors);
      }
      if (front === entry) front = undefined;
      if (entry === modal) {
        modal = undefined;
        modalClosed = true;
      } else {
        const list = listOf(entry.screen.layer);
        list.splice(list.indexOf(entry), 1);
      }
      entries.delete(entry.screen.id);
      entry.state = 'closed';
      call(entry, 'hide', errors);
      call(entry, 'close', errors);
      entry.abort.abort();
      entry.settle(given);
    }
    arrange(errors);
    tell();
    if (modalClosed) await showNextModal();
    settleErrors(errors);
  }
  function contextOf(entry: Entry): UiScreenContext<any, any> {
    return Object.freeze({
      params: entry.params,
      close: (result?: unknown) => {
        if (entry.state === 'closed' || closed) return;
        void enqueue(() => shut([entry], result)).catch(cause => {
          if (onError !== undefined) onError(cause);
          else (globalThis as { reportError?: (cause: unknown) => void }).reportError?.(cause);
        });
      },
      signal: entry.abort.signal,
      get covered() {
        return entry.covered;
      },
      get active() {
        return entry.active;
      }
    });
  }
  function refuseClosed(): void {
    if (closed) throw new EgretError('UI_SCREENS_CLOSED');
  }
  function begin(screen: UiScreenDefinition<any, any>, params: unknown): { entry: Entry; fresh: boolean } {
    const known = entries.get(screen.id);
    if (known !== undefined) {
      if (known.screen === screen && sameParams(known.params, params)) return { entry: known, fresh: false };
      throw new EgretError('UI_SCREENS_ALREADY_OPEN', { cause: screen.id });
    }
    if (entries.size >= limit) throw new EgretError('UI_SCREENS_FULL', { cause: limit });
    let settle!: (value: unknown) => void, fail!: (cause: unknown) => void;
    const result = new Promise<unknown>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    const entry: Entry = {
      screen,
      params,
      result,
      settle,
      fail,
      abort: new CancellationController(),
      state: 'waiting',
      handle: undefined,
      covered: false,
      active: false
    };
    entries.set(screen.id, entry);
    return { entry, fresh: true };
  }
  /** Every open, opening or waiting screen, from the one in front down. */
  function stacked(): Entry[] {
    return [...[...waiting].reverse(), ...(modal ? [modal] : []), ...[...popups].reverse(), ...[...pages].reverse()];
  }
  function snapshot(): UiScreenStackSnapshot {
    return Object.freeze({
      state: closed ? 'closed' : 'open',
      pages: Object.freeze(pages.map(entry => entry.screen.id)),
      popups: Object.freeze(popups.map(entry => entry.screen.id)),
      modal: modal?.state === 'open' ? modal.screen.id : undefined,
      waiting: Object.freeze(waiting.map(entry => entry.screen.id)),
      active: front?.screen.id,
      covered: Object.freeze(pages.filter(entry => entry.covered).map(entry => entry.screen.id))
    });
  }

  const stack: UiScreenStack = {
    open(screen, params) {
      refuseClosed();
      checkScreen(screen);
      const { entry, fresh } = begin(screen, params);
      if (fresh) void enqueue(() => show(entry)).catch(() => undefined);
      return entry.result as Promise<never>;
    },
    close(screen, result) {
      refuseClosed();
      checkScreen(screen);
      return enqueue(async () => {
        const entry = entries.get(screen.id);
        if (entry !== undefined && entry.screen === screen) await shut([entry], result);
      });
    },
    replace(screen, params) {
      refuseClosed();
      if (checkScreen(screen).layer !== 'page') throw invalid('replace takes a page');
      const top = pages.at(-1);
      const { entry, fresh } = begin(screen, params);
      if (fresh)
        void enqueue(async () => {
          if (top !== undefined && top !== entry && top.state !== 'closed') await shut([top]);
          await show(entry);
        }).catch(() => undefined);
      return entry.result as Promise<never>;
    },
    back() {
      refuseClosed();
      return enqueue(async () => {
        const top = front;
        if (top === undefined || top.state !== 'open') return false;
        // The page at the bottom is where a game starts again; the back key does not close it.
        if (top.screen.layer === 'page' && pages.length === 1 && popups.length === 0 && modal === undefined)
          return false;
        const back = top.screen.back ?? 'close';
        if (back === 'none') return false;
        if (typeof back === 'function') {
          back();
          return true;
        }
        await shut([top]);
        return true;
      });
    },
    popTo(screen) {
      refuseClosed();
      checkScreen(screen);
      return enqueue(async () => {
        const target = entries.get(screen.id);
        if (target === undefined || target.screen !== screen || target.state !== 'open') return;
        const all = stacked(),
          above = all.slice(0, all.indexOf(target));
        await shut(above);
      });
    },
    closeAll(layer) {
      refuseClosed();
      if (layer !== undefined && layer !== 'page' && layer !== 'popup' && layer !== 'modal') throw invalid('layer');
      return enqueue(() => shut(stacked().filter(entry => layer === undefined || entry.screen.layer === layer)));
    },
    isOpen(screen) {
      return screen !== null && typeof screen === 'object' && entries.get(screen.id)?.screen === screen;
    },
    get active() {
      return front?.screen;
    },
    snapshot,
    onChange(listener) {
      if (typeof listener !== 'function') throw new EgretError('UI_SCREENS_OPTIONS_INVALID');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (closed) return queue.then(() => undefined);
      const done = enqueue(async () => {
        await shut(stacked());
      }).finally(() => {
        closed = true;
        tell();
        listeners.clear();
      });
      return done;
    }
  };
  return Object.freeze(stack);
}
