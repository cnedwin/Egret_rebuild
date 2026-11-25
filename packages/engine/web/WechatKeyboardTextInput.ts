// SPDX-License-Identifier: Apache-2.0
// Text input in a WeChat mini game, through the keyboard WeChat shows with its own field: wx.showKeyboard, and the
// keyboard's input, confirm and complete events. It gives a game the same object as createBrowserTextInput, so one
// game can type into a page's field in a browser and into WeChat's keyboard in a mini game.
import { EgretError } from '@egret/runtime';
import type {
  BrowserTextInput,
  BrowserTextInputEnterHint,
  BrowserTextInputRectangle,
  BrowserTextInputRequest,
  BrowserTextInputSnapshot
} from '@egret/engine/web/text-input';

/** What a keyboard event of WeChat carries: the text in the keyboard's field. */
export interface WechatKeyboardEvent {
  readonly value: string;
}
/** A listener of WeChat's keyboard events. */
export type WechatKeyboardListener = (event: WechatKeyboardEvent) => void;
/** The part of `wx` the text input uses. Its `off…` functions remove a listener when the input is disposed. */
export interface WechatKeyboard {
  showKeyboard(options: {
    readonly defaultValue: string;
    readonly maxLength: number;
    readonly multiple: boolean;
    readonly confirmHold: boolean;
    readonly confirmType: 'done' | 'next' | 'search' | 'go' | 'send';
    readonly fail?: (failure: unknown) => void;
  }): void;
  hideKeyboard(options?: { readonly fail?: (failure: unknown) => void }): void;
  updateKeyboard?(options: { readonly value: string; readonly fail?: (failure: unknown) => void }): void;
  onKeyboardInput(listener: WechatKeyboardListener): void;
  onKeyboardConfirm(listener: WechatKeyboardListener): void;
  onKeyboardComplete(listener: WechatKeyboardListener): void;
  offKeyboardInput?(listener: WechatKeyboardListener): void;
  offKeyboardConfirm?(listener: WechatKeyboardListener): void;
  offKeyboardComplete?(listener: WechatKeyboardListener): void;
}
/** WeChat text input to make: the keyboard to use, and where errors of the game's callbacks go. */
export interface WechatTextInputOptions {
  /** By default the global `wx`. */
  readonly keyboard?: WechatKeyboard;
  readonly onError?: (error: unknown) => void;
}

const TEXT_LIMIT = 1048576;
/**
 * Milliseconds after a keyboard is shown in which a completion is taken for the keyboard closed just before it. WeChat
 * tells of a keyboard closed by the game as of one the player closed, after the call; a game that opens the next field
 * from `onCommit` would otherwise see that field end at once.
 */
const STALE_COMPLETION_MS = 500;
/** WeChat's keyboard holds 100 characters unless told otherwise; a session with no limit asks for this many. */
const KEYBOARD_LIMIT = 65536;
const HINTS: readonly string[] = ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'];
const CONFIRM: Record<BrowserTextInputEnterHint, 'done' | 'next' | 'search' | 'go' | 'send'> = {
  enter: 'done',
  done: 'done',
  go: 'go',
  next: 'next',
  previous: 'done',
  search: 'search',
  send: 'send'
};
const MODES: readonly string[] = ['text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none'];
function fault(code: string): EgretError {
  return new EgretError('BROWSER_TEXT_INPUT_' + code);
}
function text(value: unknown, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0')) throw fault(code);
  return value;
}
function scalar(value: unknown, minimum: number, maximum: number, code: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw fault(code);
  return value;
}
function rectangle(value: BrowserTextInputRectangle, code: string): void {
  if (!value || typeof value !== 'object') throw fault(code);
  scalar(value.x, -1048576, 1048576, code);
  scalar(value.y, -1048576, 1048576, code);
  scalar(value.width, 1, 16384, code);
  scalar(value.height, 1, 16384, code);
}
/** The first `count` characters (code points) of a value. */
function head(value: string, count: number | undefined): string {
  if (count === undefined) return value;
  let at = 0;
  for (const point of value) {
    if (count-- <= 0) break;
    at += point.length;
  }
  return value.slice(0, at);
}

interface Session {
  readonly request: BrowserTextInputRequest;
  readonly maxLength: number | undefined;
  readonly blur: 'commit' | 'cancel';
  value: string;
}

/**
 * Text input through WeChat's keyboard, with the object of `createBrowserTextInput`. WeChat shows its own field above
 * the keyboard, so the place and the look a request gives are checked but not used; `move`, `resize` and `sync` have
 * nothing to place. The keyboard's confirm key commits, also for a multiline session. The keyboard closed another
 * way ends the session as `blur` says: committed by default.
 */
export function createWechatTextInput(options: WechatTextInputOptions = {}): BrowserTextInput {
  if (!options || typeof options !== 'object') throw fault('OPTIONS');
  const keyboard = options.keyboard ?? (globalThis as { readonly wx?: WechatKeyboard }).wx;
  const onError = options.onError;
  if (
    !keyboard ||
    typeof keyboard !== 'object' ||
    typeof keyboard.showKeyboard !== 'function' ||
    typeof keyboard.hideKeyboard !== 'function' ||
    typeof keyboard.onKeyboardInput !== 'function' ||
    typeof keyboard.onKeyboardConfirm !== 'function' ||
    typeof keyboard.onKeyboardComplete !== 'function'
  )
    throw fault('SURFACE');
  if (onError !== undefined && typeof onError !== 'function') throw fault('OPTIONS');
  let disposed = false,
    session: Session | undefined,
    listening = false,
    // Whether the keyboard is up, whether this input closed it and has not yet been told, and until when a completion
    // belongs to the keyboard before the one shown now.
    up = false,
    closing = false,
    staleUntil = 0;

  function report(cause: unknown): void {
    try {
      if (onError) {
        onError(cause);
        return;
      }
    } catch (secondary) {
      cause = secondary;
    }
    if (typeof globalThis.reportError === 'function') globalThis.reportError(cause);
    else
      queueMicrotask(() => {
        throw cause;
      });
  }
  function guard(action: () => void): void {
    try {
      action();
    } catch (cause) {
      report(cause);
    }
  }
  function changed(current: Session, value: string): void {
    const next = head(value, current.maxLength);
    // WeChat's field may hold more than the limit counted in characters; it is given the value kept.
    if (next !== value && keyboard!.updateKeyboard) {
      const update = keyboard!.updateKeyboard.bind(keyboard);
      guard(() => update({ value: next, fail: report }));
    }
    if (next === current.value) return;
    current.value = next;
    const notify = current.request.onChange;
    if (notify) guard(() => notify({ value: next, composing: false }));
  }
  /**
   * Ends the session. `hide`: the keyboard is closed, before the game is told, so a field the game opens from its
   * callback shows a keyboard of its own. `keep`: the keyboard is already down, or another session takes it.
   */
  function end(kind: 'commit' | 'cancel', keyboardDoes: 'hide' | 'keep'): void {
    const current = session;
    if (!current) return;
    session = undefined;
    if (keyboardDoes === 'hide' && up) {
      up = false;
      closing = true;
      guard(() => keyboard!.hideKeyboard({ fail: () => {} }));
    }
    const request = current.request;
    if (kind === 'commit') {
      const value = current.value;
      if (request.onCommit) guard(() => request.onCommit!(value));
    } else if (request.onCancel) guard(() => request.onCancel!());
  }
  // One listener of each event for the input's life; each acts on the session open when it fires.
  const input: WechatKeyboardListener = event => {
    const current = session;
    if (current && event && typeof event.value === 'string') changed(current, event.value);
  };
  const confirm: WechatKeyboardListener = event => {
    const current = session;
    if (!current) return;
    if (event && typeof event.value === 'string') changed(current, event.value);
    if (session === current) end('commit', 'hide');
  };
  const complete: WechatKeyboardListener = event => {
    const current = session;
    if (closing) {
      // The completion of the keyboard this input closed: told after the call, perhaps after the next was shown.
      closing = false;
      if (!current || Date.now() < staleUntil) return;
    }
    up = false;
    if (!current) return;
    if (event && typeof event.value === 'string') changed(current, event.value);
    if (session === current) end(current.blur, 'keep');
  };
  function listen(): void {
    if (listening) return;
    keyboard!.onKeyboardInput(input);
    keyboard!.onKeyboardConfirm(confirm);
    keyboard!.onKeyboardComplete(complete);
    listening = true;
  }
  function alive(): void {
    if (disposed) throw fault('DISPOSED');
  }

  return {
    open(request) {
      alive();
      if (!request || typeof request !== 'object') throw fault('REQUEST');
      rectangle(request, 'REQUEST');
      const multiline = request.multiline ?? false,
        password = request.password ?? false,
        blur = request.blur ?? 'commit';
      if (
        typeof multiline !== 'boolean' ||
        typeof password !== 'boolean' ||
        (multiline && password) ||
        (blur !== 'commit' && blur !== 'cancel')
      )
        throw fault('REQUEST');
      const maxLength = request.maxLength;
      if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > TEXT_LIMIT))
        throw fault('REQUEST');
      const value = head(text(request.value ?? '', TEXT_LIMIT, 'REQUEST'), maxLength);
      if (
        (request.inputMode !== undefined && !MODES.includes(request.inputMode)) ||
        (request.enterKeyHint !== undefined && !HINTS.includes(request.enterKeyHint))
      )
        throw fault('REQUEST');
      for (const callback of [request.onChange, request.onCommit, request.onCancel])
        if (callback !== undefined && typeof callback !== 'function') throw fault('REQUEST');
      // A session still open is cancelled; its keyboard stays up for the next.
      end('cancel', 'keep');
      if (disposed) throw fault('DISPOSED');
      if (session) throw fault('REENTRANT');
      listen();
      const current: Session = { request, maxLength, blur, value };
      session = current;
      staleUntil = closing || up ? Date.now() + STALE_COMPLETION_MS : 0;
      if (up) closing = true;
      up = true;
      try {
        keyboard!.showKeyboard({
          defaultValue: value,
          maxLength: Math.min(maxLength ?? KEYBOARD_LIMIT, KEYBOARD_LIMIT),
          multiple: multiline,
          // The keyboard stays up after its confirm key until this input closes it, so that WeChat does not close the
          // keyboard of a field the game opens from onCommit.
          confirmHold: true,
          confirmType: CONFIRM[request.enterKeyHint ?? (multiline ? 'enter' : 'done')],
          // A keyboard WeChat would not show ends the session, as a cancel.
          fail: failure => {
            if (session !== current) return;
            up = false;
            report(failure);
            end('cancel', 'keep');
          }
        });
      } catch (cause) {
        if (session === current) session = undefined;
        up = false;
        throw cause;
      }
    },
    commit() {
      alive();
      end('commit', 'hide');
    },
    cancel() {
      alive();
      end('cancel', 'hide');
    },
    setValue(value) {
      alive();
      const current = session;
      if (!current) throw fault('IDLE');
      const next = head(text(value, TEXT_LIMIT, 'VALUE'), current.maxLength);
      current.value = next;
      if (keyboard.updateKeyboard) {
        const update = keyboard.updateKeyboard.bind(keyboard);
        guard(() => update({ value: next, fail: report }));
      }
    },
    move(place) {
      alive();
      if (!session) throw fault('IDLE');
      rectangle(place, 'RECTANGLE');
    },
    resize(width, height) {
      alive();
      scalar(width, 0.25, 16384, 'SIZE');
      scalar(height, 0.25, 16384, 'SIZE');
    },
    sync() {
      alive();
    },
    getSnapshot(): BrowserTextInputSnapshot {
      if (disposed) return { state: 'disposed', value: '', composing: false };
      return session
        ? { state: 'open', value: session.value, composing: false }
        : { state: 'idle', value: '', composing: false };
    },
    dispose() {
      if (disposed) return;
      end('cancel', 'hide');
      disposed = true;
      if (listening) {
        listening = false;
        guard(() => keyboard.offKeyboardInput?.(input));
        guard(() => keyboard.offKeyboardConfirm?.(confirm));
        guard(() => keyboard.offKeyboardComplete?.(complete));
      }
    }
  };
}
