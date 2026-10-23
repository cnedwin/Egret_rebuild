// SPDX-License-Identifier: Apache-2.0
import {EgretError} from '@egret/runtime';
import type {CapturedSequenceMarker} from './sequenceMath.js';
import type {SequenceControllerEvent} from './types.js';

export interface CapturedOptions {
  readonly rate: number;
  readonly totalPlays: number | 'infinite';
  readonly markers: readonly CapturedSequenceMarker[];
  readonly listener: ((event: SequenceControllerEvent) => undefined) | undefined;
}
export type Command = Readonly<{kind: 'start' | 'pause' | 'resume'}>
  | Readonly<{kind: 'rate'; rate: number}>
  | Readonly<{kind: 'seek'; time: number; replay: boolean}>;

/** Wrap only caller operations, so a deliberately thrown EgretError remains the cause. */
function external<T>(code: string, read: () => T): T {
  try { return read(); } catch (cause) {
    if (cause instanceof EgretError && cause.code === 'ANIMATION_REENTRANT') throw cause;
    throw new EgretError(code, {cause});
  }
}
function fields(value: unknown, allowed: readonly string[], code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') throw new EgretError(code);
  if (external(code, (): boolean => Array.isArray(value))) throw new EgretError(code);
  for (const key of external(code, (): (string | symbol)[] => Reflect.ownKeys(value))) {
    if (typeof key !== 'string' || !allowed.includes(key)) throw new EgretError(code);
  }
  return value as Record<string, unknown>;
}
function own(input: Record<string, unknown>, key: string, code: string): unknown {
  return external(code, (): unknown => Object.hasOwn(input, key) ? input[key] : undefined);
}
export function admitRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 16) throw new EgretError('ANIMATION_RATE_INVALID');
  return value === 0 ? 0 : value;
}
/** Copy only bounded scalar descriptors, including one array-length observation. */
export function captureOptions(value: unknown, duration: number): CapturedOptions {
  const code = 'ANIMATION_OPTIONS_INVALID';
  const input = fields(value, ['profile','rate','totalPlays','markers','onEvent'], code);
  const profile = own(input, 'profile', code), rawRate = own(input, 'rate', code);
  const rawPlays = own(input, 'totalPlays', code), rawMarkers = own(input, 'markers', code);
  const listener = own(input, 'onEvent', code);
  if (profile !== 'egret.sequence-control/1') throw new EgretError(code);
  let rate: number;
  try { rate = admitRate(rawRate === undefined ? 1 : rawRate); } catch { throw new EgretError(code); }
  const totalPlays = rawPlays === undefined ? 1 : rawPlays;
  if (totalPlays !== 'infinite' && (typeof totalPlays !== 'number' || !Number.isInteger(totalPlays) || totalPlays < 1 || totalPlays > 1_000_000)) throw new EgretError(code);
  if (typeof duration !== 'number' || duration <= 0 || !Number.isFinite(duration) || duration > 2 ** 32
    || (totalPlays !== 'infinite' && (!Number.isFinite(duration * totalPlays) || duration * totalPlays <= 0 || duration * totalPlays > 2 ** 32))) throw new EgretError('ANIMATION_TIME_LIMIT');
  if (listener !== undefined && typeof listener !== 'function') throw new EgretError(code);
  const markers: CapturedSequenceMarker[] = [], ids = new Set<string>();
  if (rawMarkers !== undefined) {
    if (!external(code, (): boolean => Array.isArray(rawMarkers))) throw new EgretError(code);
    const array = rawMarkers as unknown[];
    const length: unknown = external(code, (): number => array.length);
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > 64) throw new EgretError(code);
    for (let index = 0; index < length; index++) {
      if (!external(code, (): boolean => Object.hasOwn(array, index))) throw new EgretError(code);
      const marker = fields(external(code, (): unknown => array[index]), ['id','timeSeconds'], code);
      const id = own(marker, 'id', code), time = own(marker, 'timeSeconds', code);
      if (typeof id !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(id) || ids.has(id)
        || typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > duration) throw new EgretError(code);
      ids.add(id); markers.push(Object.freeze({id, timeSeconds: time === 0 ? 0 : time, markerIndex: index}));
    }
  }
  markers.sort((a,b) => a.timeSeconds - b.timeSeconds || a.markerIndex - b.markerIndex);
  return Object.freeze({rate, totalPlays, markers: Object.freeze(markers), listener: listener as CapturedOptions['listener']});
}
export function captureSeek(value: unknown): Command & {kind: 'seek'} {
  const code = 'ANIMATION_SEEK_INVALID';
  const input = fields(value, ['timeSeconds','replayEvents'], code);
  const time = own(input, 'timeSeconds', code), replay = own(input, 'replayEvents', code);
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0
    || (replay !== undefined && typeof replay !== 'boolean')) throw new EgretError(code);
  return Object.freeze({kind: 'seek', time: time === 0 ? 0 : time, replay: replay ?? false});
}
