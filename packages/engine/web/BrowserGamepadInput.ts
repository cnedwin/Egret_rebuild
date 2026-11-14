// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createGamepadInput } from '@egret/engine/input/gamepad';
import type { GamepadInput, GamepadInputOptions, GamepadSample } from '@egret/engine/input/gamepad';

export interface BrowserGamepadInputOptions extends GamepadInputOptions {
  /**
   * Told what failed where nothing could be returned: in a listener of the page, or when a pad
   * was asked to shake. Without it the failure is reported to the page.
   */
  readonly onError?: (cause: unknown) => void;
}
export interface GamepadRumble {
  /** Milliseconds, up to 5000. Defaults to 200. */
  readonly duration?: number;
  /** The light, fast motor, 0 to 1. Defaults to 0.5. */
  readonly weak?: number;
  /** The heavy, slow motor, 0 to 1. Defaults to 0.5. */
  readonly strong?: number;
}
export interface BrowserGamepadInput {
  readonly input: GamepadInput;
  /**
   * Looks at the pads of the page once. A game calls it once a frame. The timestamp is the frame's,
   * in milliseconds; without it the clock of the page is read. A hidden page is not looked at.
   */
  poll(timestamp?: number): void;
  /** Shakes a pad that can be shaken. Says whether the pad was asked to. */
  rumble(pad: number, options?: GamepadRumble): boolean;
  /** The same as disposing the input. A scope can own the pads of a game through this. */
  dispose(): void;
}
interface Pair { readonly target: EventTarget; readonly type: string; readonly listener: EventListener; }
interface Actuator { playEffect?(type: string, parameters: object): Promise<unknown> | undefined; }
const within = (value: unknown, least: number, most: number): value is number => typeof value === 'number' && value >= least && value <= most;

/**
 * The pads of a page. A browser tells nothing when a button goes down: it has to be asked, so the
 * game asks once a frame through `poll`. Buttons are let go when the page is hidden or the window
 * loses the person, because what happens to a pad then is not told either.
 */
export function createBrowserGamepadInput(options: BrowserGamepadInputOptions = {}): BrowserGamepadInput {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('GAMEPAD_OPTIONS_INVALID');
  const { onError, ...configuration } = options;
  if (onError !== undefined && typeof onError !== 'function') throw new EgretError('GAMEPAD_OPTIONS_INVALID');
  const host = globalThis.navigator, page = globalThis.document, win = globalThis.window;
  if (host === undefined || typeof host.getGamepads !== 'function') throw new EgretError('GAMEPAD_HOST_UNAVAILABLE');
  const input = createGamepadInput(configuration);
  const pairs: Pair[] = [];
  let closed = false, last = 0;

  function report(cause: unknown): void {
    if (onError !== undefined) onError(cause);
    else if (typeof globalThis.reportError === 'function') globalThis.reportError(cause);
  }
  function listen(target: EventTarget | undefined, type: string, listener: EventListener): void {
    if (target === undefined) return;
    target.addEventListener(type, listener);
    pairs.push({ target, type, listener });
  }
  function cleanup(): void {
    if (closed) return;
    closed = true;
    for (const pair of pairs.splice(0).reverse()) try { pair.target.removeEventListener(pair.type, pair.listener); } catch (cause) { report(cause); }
  }
  const letGo: EventListener = () => {
    if (closed) return;
    try { input.release(); } catch (cause) { report(cause); }
  };
  try {
    listen(page, 'visibilitychange', event => { if (page!.visibilityState === 'hidden') letGo(event); });
    listen(win, 'blur', letGo);
    listen(win, 'pagehide', letGo);
  } catch (cause) {
    cleanup();
    input.dispose();
    throw cause;
  }

  return Object.freeze({
    input,
    poll(timestamp?: number): void {
      if (timestamp !== undefined && !within(timestamp, 0, Number.MAX_VALUE)) throw new EgretError('GAMEPAD_SAMPLE');
      if (closed || input.state === 'closed' || page?.visibilityState === 'hidden') return;
      const samples: GamepadSample[] = [];
      for (const pad of host.getGamepads()) {
        // A browser keeps a place for a pad that was taken away.
        if (pad === null || pad === undefined || pad.connected === false) continue;
        samples.push({
          index: pad.index, id: pad.id, mapping: pad.mapping,
          buttons: Array.from(pad.buttons, button => ({ pressed: button.pressed, value: Math.min(1, Math.max(0, button.value)) })),
          axes: Array.from(pad.axes, axis => Number.isFinite(axis) ? Math.min(1, Math.max(-1, axis)) : 0),
        });
      }
      // A clock of the page may be coarse or handed in out of step: the input is never told that time went back.
      last = Math.max(last, timestamp ?? globalThis.performance.now());
      input.sample(samples, last);
    },
    rumble(index: number, rumble: GamepadRumble = {}): boolean {
      if (rumble === null || typeof rumble !== 'object') throw new EgretError('GAMEPAD_OPTIONS_INVALID');
      const { duration = 200, weak = 0.5, strong = 0.5 } = rumble;
      if (!Number.isSafeInteger(index) || !within(index, 0, 31) || !within(duration, 0, 5000) || !within(weak, 0, 1) || !within(strong, 0, 1)) throw new EgretError('GAMEPAD_OPTIONS_INVALID');
      if (closed || page?.visibilityState === 'hidden') return false;
      const pad = [...host.getGamepads()].find(candidate => candidate !== null && candidate !== undefined && candidate.index === index && candidate.connected !== false);
      const actuator = (pad as { vibrationActuator?: Actuator | null } | undefined)?.vibrationActuator;
      if (actuator === null || actuator === undefined || typeof actuator.playEffect !== 'function') return false;
      try {
        const played = actuator.playEffect('dual-rumble', { startDelay: 0, duration, weakMagnitude: weak, strongMagnitude: strong });
        if (played !== undefined && typeof played.then === 'function') played.then(undefined, report);
      } catch (cause) { report(cause); return false; }
      return true;
    },
    dispose(): void {
      cleanup();
      input.dispose();
    },
  });
}
