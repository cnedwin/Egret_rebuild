import type { Disposable } from '@egret/contracts';

/** The easing a tween uses. */
export type TweenEasing = 'linear' | 'quadIn' | 'quadOut' | 'quadInOut';
/** Whether a tween is idle, running, paused, completed, stopped or failed. */
export type TweenState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
/** A tween to make: from and to which number, for how long, with which easing, and what it calls. */
export interface TweenOptions {
  readonly from: number;
  readonly to: number;
  readonly durationSeconds: number;
  readonly easing?: TweenEasing;
  readonly onUpdate: (value: number) => undefined;
  readonly onComplete?: () => undefined;
}
// Declaration-only identity: the opaque handle adds no emitted brand value.
declare const tweenBrand: unique symbol;
/** A number tweened on the game clock: start, pause, resume and stop it, and read its value. */
export interface Tween extends Disposable {
  readonly [tweenBrand]: true;
  readonly state: TweenState;
  readonly isDisposed: boolean;
  readonly elapsedSeconds: number;
  readonly progress: number; // Uneased progress in [0, 1].
  readonly value: number; // Initial from, then the last offered value.
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  dispose(): void;
}
