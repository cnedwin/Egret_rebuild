// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type {
  GamepadButtonChange, GamepadButtonName, GamepadButtonSample, GamepadConnectionChange, GamepadInput, GamepadInputOptions, GamepadPad, GamepadSample, GamepadStick, GamepadStickName,
} from './gamepadTypes.js';

/** The standard layout: the place of each named button, and the two axes of each stick. */
const NAMES: readonly GamepadButtonName[] = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right', 'home'];
const STICKS: Readonly<Record<GamepadStickName, number>> = { left: 0, right: 2 };
const NONE: GamepadStick = Object.freeze({ x: 0, y: 0 });
const LET_GO: GamepadButtonSample = Object.freeze({ pressed: false, value: 0 });

interface Pad {
  readonly index: number;
  readonly id: string;
  readonly standard: boolean;
  buttons: GamepadButtonSample[];
  axes: number[];
  readonly face: GamepadPad;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const within = (value: unknown, least: number, most: number): value is number => typeof value === 'number' && value >= least && value <= most;
const whole = (value: unknown, least: number, most: number): value is number => Number.isSafeInteger(value) && within(value, least, most);

/** Pads as a stream of samples a host gives it: what is held, how far a stick is pushed, and what changed since the last look. */
export function createGamepadInput(options: GamepadInputOptions = {}): GamepadInput {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('GAMEPAD_OPTIONS_INVALID');
  const { deadZone = 0.15, maxPads = 4, onButton, onConnection } = options;
  if (!within(deadZone, 0, 0.9) || !whole(maxPads, 1, 8) || (onButton !== undefined && typeof onButton !== 'function')
    || (onConnection !== undefined && typeof onConnection !== 'function')) throw new EgretError('GAMEPAD_OPTIONS_INVALID');

  const pads = new Map<number, Pad>();
  const buttonListeners = new Set<(change: GamepadButtonChange) => void>();
  const sampleListeners = new Set<(timestamp: number) => void>();
  let closed = false, closing = false, busy = false, last = 0, faces: readonly GamepadPad[] = Object.freeze([]);

  function place(pad: Pad, button: unknown): number {
    const index = typeof button === 'number' ? button : NAMES.indexOf(button as GamepadButtonName);
    if (!whole(index, 0, 63)) throw new EgretError('GAMEPAD_BUTTON_UNKNOWN');
    // A name means a place only where the host has arranged the pad in the standard layout.
    return typeof button === 'number' || pad.standard ? index : -1;
  }
  function makePad(sample: GamepadSample): Pad {
    const pad: Pad = {
      index: sample.index, id: sample.id, standard: sample.mapping === 'standard', buttons: [], axes: [],
      face: Object.freeze({
        index: sample.index, id: sample.id, standard: sample.mapping === 'standard',
        get buttonCount(): number { return pad.buttons.length; },
        get axisCount(): number { return pad.axes.length; },
        pressed: (button: GamepadButtonName | number): boolean => pad.buttons[place(pad, button)]?.pressed ?? false,
        value: (button: GamepadButtonName | number): number => pad.buttons[place(pad, button)]?.value ?? 0,
        axis(index: number): number {
          if (!whole(index, 0, 15)) throw new EgretError('GAMEPAD_AXIS_UNKNOWN');
          return pad.axes[index] ?? 0;
        },
        stick(name: GamepadStickName): GamepadStick {
          if (!Object.hasOwn(STICKS, name)) throw new EgretError('GAMEPAD_STICK_UNKNOWN');
          if (!pad.standard) return NONE;
          const x = pad.axes[STICKS[name]] ?? 0, y = pad.axes[STICKS[name] + 1] ?? 0, length = Math.hypot(x, y);
          if (length <= deadZone) return NONE;
          // What is left of the travel outside the dead zone, stretched to reach 1 and held there.
          const scale = Math.min(1, (length - deadZone) / (1 - deadZone)) / length;
          return Object.freeze({ x: x * scale, y: y * scale });
        },
      }),
    };
    return pad;
  }
  /** A sample is read whole before anything is told: one that is not what it should be changes nothing. */
  function admit(sample: unknown): { readonly sample: GamepadSample; readonly buttons: GamepadButtonSample[]; readonly axes: number[] } {
    if (!record(sample)) throw new EgretError('GAMEPAD_SAMPLE');
    const { index, id, mapping, buttons, axes } = sample;
    if (!whole(index, 0, 31) || typeof id !== 'string' || typeof mapping !== 'string' || !Array.isArray(buttons) || buttons.length > 64 || !Array.isArray(axes) || axes.length > 16) throw new EgretError('GAMEPAD_SAMPLE');
    const held: GamepadButtonSample[] = [], pushed: number[] = [];
    for (const button of buttons as readonly unknown[]) {
      if (!record(button) || typeof button['pressed'] !== 'boolean' || !within(button['value'], 0, 1)) throw new EgretError('GAMEPAD_SAMPLE');
      held.push(Object.freeze({ pressed: button['pressed'], value: button['value'] }));
    }
    for (const axis of axes as readonly unknown[]) {
      if (!within(axis, -1, 1)) throw new EgretError('GAMEPAD_SAMPLE');
      pushed.push(axis);
    }
    return { sample: { index, id, mapping, buttons: held, axes: pushed }, buttons: held, axes: pushed };
  }
  /** Every listener is told, whatever an earlier one did. What they threw is kept for the end of the look. */
  function tell<T>(listeners: Iterable<((value: T) => void) | undefined>, value: T, failures: unknown[]): void {
    for (const listener of [...listeners]) {
      if (listener === undefined) continue;
      try { listener(value); } catch (cause) { failures.push(cause); }
    }
  }
  function change(pad: Pad, index: number, button: GamepadButtonSample, timestamp: number, failures: unknown[]): void {
    const told: GamepadButtonChange = Object.freeze({ pad: pad.index, index, name: pad.standard ? NAMES[index] : undefined, pressed: button.pressed, value: button.value, timestamp });
    tell([onButton, ...buttonListeners], told, failures);
  }
  function letGo(pad: Pad, timestamp: number, failures: unknown[]): void {
    const before = pad.buttons;
    pad.buttons = before.map(() => LET_GO);
    pad.axes = pad.axes.map(() => 0);
    before.forEach((button, index) => { if (button.pressed) change(pad, index, LET_GO, timestamp, failures); });
  }
  function connection(pad: Pad, connected: boolean, timestamp: number, failures: unknown[]): void {
    tell([onConnection], Object.freeze({ pad: pad.index, id: pad.id, connected, standard: pad.standard, timestamp }), failures);
  }
  /** By index, whatever order the pads came in: what is told is told in the same order every time. */
  const ordered = (): Pad[] => [...pads.values()].sort((a, b) => a.index - b.index);
  function refresh(): void {
    faces = Object.freeze(ordered().map(pad => pad.face));
  }
  function close(failures: unknown[]): void {
    for (const pad of ordered()) letGo(pad, last, failures);
    closed = true;
    pads.clear();
    refresh();
    buttonListeners.clear();
    sampleListeners.clear();
  }
  /** One look at a time: a listener may read the pads but not give the next look. */
  function exclusive(action: (failures: unknown[]) => void): void {
    if (busy) throw new EgretError('GAMEPAD_REENTRANT');
    busy = true;
    const failures: unknown[] = [];
    try {
      action(failures);
      // Asked for by a listener while it was being told: done once the telling is over.
      if (closing && !closed) close(failures);
    } finally { busy = false; }
    if (failures.length > 0) throw new EgretError('GAMEPAD_LISTENER_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
  }

  return Object.freeze({
    get state(): 'active' | 'closed' { return closed ? 'closed' : 'active'; },
    get pads(): readonly GamepadPad[] { return faces; },
    pad: (index: number): GamepadPad | undefined => pads.get(index)?.face,
    sample(samples: readonly (GamepadSample | null | undefined)[], timestamp: number): void {
      if (!Array.isArray(samples) || samples.length > 32 || !within(timestamp, last, Number.MAX_VALUE)) throw new EgretError('GAMEPAD_SAMPLE');
      if (closed) return;
      const admitted = new Map<number, ReturnType<typeof admit>>();
      for (const sample of samples as readonly unknown[]) {
        if (sample === null || sample === undefined) continue;
        const entry = admit(sample);
        if (admitted.has(entry.sample.index)) throw new EgretError('GAMEPAD_SAMPLE');
        admitted.set(entry.sample.index, entry);
      }
      exclusive(failures => {
        last = timestamp;
        // Taken away, or another pad in its place: what it held is let go before it is forgotten.
        for (const pad of ordered()) {
          const now = admitted.get(pad.index);
          if (now !== undefined && now.sample.id === pad.id && (now.sample.mapping === 'standard') === pad.standard) continue;
          letGo(pad, timestamp, failures);
          pads.delete(pad.index);
          refresh();
          connection(pad, false, timestamp, failures);
        }
        for (const index of [...admitted.keys()].sort((a, b) => a - b)) {
          const { sample, buttons, axes } = admitted.get(index)!;
          let pad = pads.get(index);
          if (pad === undefined) {
            if (pads.size >= maxPads) continue;
            pad = makePad(sample);
            pads.set(index, pad);
            refresh();
            connection(pad, true, timestamp, failures);
          }
          const before = pad.buttons;
          pad.buttons = buttons;
          pad.axes = axes;
          const count = Math.max(before.length, buttons.length);
          for (let button = 0; button < count; button++) {
            const was = before[button]?.pressed ?? false, is = buttons[button] ?? LET_GO;
            if (was !== is.pressed) change(pad, button, is, timestamp, failures);
          }
        }
        tell(sampleListeners, timestamp, failures);
      });
    },
    release(): void {
      if (closed) return;
      exclusive(failures => { for (const pad of ordered()) letGo(pad, last, failures); });
    },
    subscribe(listener: (change: GamepadButtonChange) => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('GAMEPAD_OPTIONS_INVALID');
      if (closed) throw new EgretError('GAMEPAD_CLOSED');
      buttonListeners.add(listener);
      return (): void => { buttonListeners.delete(listener); };
    },
    onSample(listener: (timestamp: number) => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('GAMEPAD_OPTIONS_INVALID');
      if (closed) throw new EgretError('GAMEPAD_CLOSED');
      sampleListeners.add(listener);
      return (): void => { sampleListeners.delete(listener); };
    },
    dispose(): void {
      if (closed) return;
      if (busy) { closing = true; return; }
      exclusive(close);
    },
  });
}
