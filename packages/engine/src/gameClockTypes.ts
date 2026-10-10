import type { Disposable } from '@egret/contracts';
import type { Scope } from '@egret/runtime';

export interface GameClockOptions {
  readonly maxDeltaSeconds?: number;
}
export type GameClockState = 'running' | 'paused' | 'closed';
export interface GameClockTick {
  readonly tickId: number;
  readonly elapsedSeconds: number;
  readonly deltaSeconds: number;
}
export type GameClockHandler = (tick: GameClockTick) => undefined;

// Declaration-only identities provide opaque types without emitted brand values.
declare const clockBrand: unique symbol;
declare const subscriptionBrand: unique symbol;
export interface GameClockSubscription extends Disposable {
  readonly [subscriptionBrand]: true;
  readonly isDisposed: boolean;
  dispose(): void;
}
export interface GameClock {
  readonly [clockBrand]: true;
  readonly state: GameClockState;
  readonly elapsedSeconds: number;
  readonly tickId: number;
  readonly maxDeltaSeconds: number;
  onTick(scope: Scope, handler: GameClockHandler): GameClockSubscription;
  pause(): void;
  resume(): void;
}
