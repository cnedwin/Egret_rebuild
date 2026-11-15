import { Scope } from '@egret/runtime';
import type { Bitmap, SequenceClip } from '@egret/runtime';
import type { GameClock } from './gameClockTypes.js';
import type { SequencePlayback } from './sequencePlaybackTypes.js';
import type { SequenceTargetClaims } from './sequenceTargetClaims.js';
export interface SequencePlaybackContext {
    assertOpen(): void;
    isEngineScope(scope: unknown): scope is Scope;
    readonly clock: GameClock;
    readonly claims: SequenceTargetClaims;
    captureCleanup(cause: unknown): void;
}
export interface SequencePlaybackOwner {
    create(scope: unknown, bitmap: Bitmap, clip: SequenceClip, options: unknown): SequencePlayback;
    close(): void;
}
/** Only private Engine assembly owns inventory and authentic-clock subscriptions. */
export declare function createSequencePlaybackOwner(context: SequencePlaybackContext): SequencePlaybackOwner;
//# sourceMappingURL=sequencePlayback.d.ts.map