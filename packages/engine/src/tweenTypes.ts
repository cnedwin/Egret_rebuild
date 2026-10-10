import type { Disposable } from '@egret/contracts';

export type TweenEasing = 'linear' | 'quadIn' | 'quadOut' | 'quadInOut';
export type TweenState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
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
