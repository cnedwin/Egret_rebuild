import type { Disposable } from '@egret/contracts';
import type { Scope } from '@egret/runtime';

/** The longest step the game clock takes in one tick, in seconds. */
export interface GameClockOptions {
  readonly maxDeltaSeconds?: number;
}
/** Whether the game clock is running, paused or closed. */
export type GameClockState = 'running' | 'paused' | 'closed';
/** One tick of the game clock: its number, the seconds so far and the seconds since the last tick. */
export interface GameClockTick {
  readonly tickId: number;
  readonly elapsedSeconds: number;
  readonly deltaSeconds: number;
}
/** Called on each tick of the game clock. */
export type GameClockHandler = (tick: GameClockTick) => undefined;

// Declaration-only identities provide opaque types without emitted brand values.
declare const clockBrand: unique symbol;
declare const subscriptionBrand: unique symbol;
/** A handler's place on the game clock; disposing it stops the calls. */
export interface GameClockSubscription extends Disposable {
  readonly [subscriptionBrand]: true;
  readonly isDisposed: boolean;
  dispose(): void;
}
/** The Engine's game clock: it ticks while running, and handlers are called on each tick. */
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
