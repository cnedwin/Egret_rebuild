import { Scope } from '@egret/runtime';
import type { GameClock } from './gameClockTypes.js';
import type { Tween } from './tweenTypes.js';
export interface TweenContext {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
    readonly clock: GameClock;
}
export interface TweenOwner {
    create(scope: unknown, options: unknown): Tween;
    close(): void;
}
/** Private Engine assembly; live records alone belong to the owner inventory. */
export declare function createTweenOwner(context: TweenContext): TweenOwner;
//# sourceMappingURL=tween.d.ts.map