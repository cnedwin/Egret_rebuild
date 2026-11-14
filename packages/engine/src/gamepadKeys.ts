// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { GamepadButtonName, GamepadKeyAction, GamepadKeys, GamepadKeysOptions, GamepadPad, GamepadStickName } from './gamepadTypes.js';

type Direction = 'up' | 'down' | 'left' | 'right';
interface Hold {
  readonly action: GamepadKeyAction;
  /** Directions and moves of the focus repeat while held. Enter and Escape do not. */
  readonly repeats: boolean;
  next: number;
}
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const NAMES: readonly GamepadButtonName[] = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right', 'home'];
/**
 * What a pad does to a UI unless told otherwise. A direction is an arrow key, and an arrow nobody
 * took moves the focus, so one cross walks both inside a control and from control to control.
 */
const USUAL: Readonly<Partial<Record<GamepadButtonName, GamepadKeyAction>>> = Object.freeze({
  up: { key: 'ArrowUp', otherwise: 'previous' }, down: { key: 'ArrowDown', otherwise: 'next' },
  left: { key: 'ArrowLeft', otherwise: 'previous' }, right: { key: 'ArrowRight', otherwise: 'next' },
  a: { key: 'Enter' }, b: { key: 'Escape' }, l1: { focus: 'previous' }, r1: { focus: 'next' },
});
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const within = (value: unknown, least: number, most: number): value is number => typeof value === 'number' && value >= least && value <= most;
const way = (value: unknown): value is 'next' | 'previous' => value === 'next' || value === 'previous';
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 32;

/** Drives a keyboard input from the pads: the keys a UI already answers, held and repeated as a pad holds them. */
export function bindGamepadKeys(options: GamepadKeysOptions): GamepadKeys {
  if (!record(options)) throw new EgretError('GAMEPAD_OPTIONS_INVALID');
  const { gamepad, keyboard, pad: only, map: given = {}, stick = 'left', wrap = true, threshold = 0.5, repeatDelay = 400, repeatInterval = 100 } = options;
  if (!record(gamepad) || typeof gamepad.subscribe !== 'function' || typeof gamepad.onSample !== 'function'
    || !record(keyboard) || typeof keyboard.keyDown !== 'function' || typeof keyboard.keyUp !== 'function' || typeof keyboard.moveFocus !== 'function'
    || (only !== undefined && !(Number.isSafeInteger(only) && within(only, 0, 31))) || !record(given) || (stick !== false && stick !== 'left' && stick !== 'right') || typeof wrap !== 'boolean'
    || !within(threshold, 0.1, 1) || !within(repeatDelay, 50, 5000) || !within(repeatInterval, 20, 5000)) throw new EgretError('GAMEPAD_OPTIONS_INVALID');
  const map = new Map<GamepadButtonName, GamepadKeyAction>();
  for (const name of NAMES) {
    const action = Object.hasOwn(given, name) ? given[name] : USUAL[name];
    if (action === null || action === undefined) continue;
    if (!record(action) || !('focus' in action ? way(action.focus) : text(action['key']) && (action['code'] === undefined || text(action['code'])) && (action['otherwise'] === undefined || way(action['otherwise']))))
      throw new EgretError('GAMEPAD_OPTIONS_INVALID');
    map.set(name, action);
  }
  for (const name of Object.keys(given)) if (!NAMES.includes(name as GamepadButtonName)) throw new EgretError('GAMEPAD_BUTTON_UNKNOWN');

  /** What is held, by pad and button. A key held by two buttons is one key: it goes down once and up once. */
  const holds = new Map<string, Hold>();
  const keys = new Map<string, number>();
  /** The direction each stick is taken to point at, kept until it clearly lets go. */
  const pointed = new Map<number, Direction>();
  let disposed = false, time = 0;

  function fire(hold: Hold, repeat: boolean): void {
    const action = hold.action;
    if ('focus' in action) { keyboard.moveFocus(action.focus, wrap); return; }
    const taken = keyboard.keyDown({ code: action.code ?? action.key, key: action.key, repeat });
    if (!taken && action.otherwise !== undefined) keyboard.moveFocus(action.otherwise, wrap);
  }
  function press(id: string, name: GamepadButtonName, timestamp: number): void {
    const action = map.get(name);
    if (action === undefined) return;
    const hold: Hold = { action, repeats: 'focus' in action || DIRECTIONS.includes(name as Direction), next: timestamp + repeatDelay };
    holds.set(id, hold);
    if ('key' in action) {
      const count = keys.get(action.key) ?? 0;
      keys.set(action.key, count + 1);
      if (count > 0) return;
    }
    fire(hold, false);
  }
  function release(id: string, hold: Hold): void {
    holds.delete(id);
    const action = hold.action;
    if (!('key' in action)) return;
    const count = (keys.get(action.key) ?? 1) - 1;
    if (count > 0) { keys.set(action.key, count); return; }
    keys.delete(action.key);
    keyboard.keyUp({ code: action.code ?? action.key, key: action.key });
  }
  /** Where a stick points: the side it leans to most, once it passes the threshold, until it falls well below it. */
  function lean(pad: GamepadPad, name: GamepadStickName): Direction | undefined {
    const { x, y } = pad.stick(name), before = pointed.get(pad.index);
    const along = (direction: Direction): number => direction === 'up' ? -y : direction === 'down' ? y : direction === 'left' ? -x : x;
    if (before !== undefined && along(before) >= threshold * 0.7) return before;
    const now = Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
    const direction = along(now) >= threshold ? now : undefined;
    if (direction === undefined) pointed.delete(pad.index); else pointed.set(pad.index, direction);
    return direction;
  }
  /** Brings what is held into line with what the pads say now, then repeats what has been held long enough. */
  function sync(timestamp: number, repeat: boolean): void {
    if (disposed) return;
    time = Math.max(time, timestamp);
    const wanted = new Map<string, GamepadButtonName>();
    for (const pad of gamepad.pads) {
      if (only !== undefined && pad.index !== only) continue;
      const direction = stick === false ? undefined : lean(pad, stick);
      for (const name of map.keys()) if (pad.pressed(name) || name === direction) wanted.set(pad.index + ':' + name, name);
    }
    // What was let go goes up before what was pressed goes down, as fingers do it.
    for (const [id, hold] of [...holds]) if (!wanted.has(id)) release(id, hold);
    for (const [id, name] of wanted) if (!holds.has(id)) press(id, name, time);
    for (const index of [...pointed.keys()]) if (gamepad.pad(index) === undefined) pointed.delete(index);
    if (!repeat) return;
    for (const hold of [...holds.values()]) {
      if (!hold.repeats || time < hold.next) continue;
      // One repeat for one look, however late the look is.
      hold.next = time + repeatInterval;
      fire(hold, true);
    }
  }
  const off = [gamepad.subscribe(change => { sync(change.timestamp, false); }), gamepad.onSample(timestamp => { sync(timestamp, true); })];

  return Object.freeze({
    get held(): readonly string[] { return Object.freeze([...keys.keys()]); },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const stop of off) stop();
      const failures: unknown[] = [];
      for (const [id, hold] of [...holds]) try { release(id, hold); } catch (cause) { failures.push(cause); }
      pointed.clear();
      if (failures.length > 0) throw new EgretError('GAMEPAD_LISTENER_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
}
