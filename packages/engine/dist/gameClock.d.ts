import type { Diagnostic } from '@egret/contracts';
import { Scope } from '@egret/runtime';
import type { GameClock, GameClockTick } from './gameClockTypes.js';
export interface AdmittedGameClockOptions {
    readonly maxDeltaSeconds: number;
}
export interface GameClockContext {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
    isFrameBusy(): boolean;
    report(diagnostic: Diagnostic): void;
}
export interface GameClockOwner {
    readonly clock: GameClock;
    advance(sourceSeconds: unknown): GameClockTick | undefined;
    close(): void;
    isBusy(): boolean;
    whenIdle(): Promise<void>;
}
/** Admission retains only a frozen scalar, never the caller's option object. */
export declare function admitGameClockOptions(value: unknown): AdmittedGameClockOptions;
/** Private owner; public facades supply observation and receiver-checked service. */
export declare function createGameClockOwner(context: GameClockContext, options: AdmittedGameClockOptions): GameClockOwner;
//# sourceMappingURL=gameClock.d.ts.map