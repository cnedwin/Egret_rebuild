import { Bitmap } from './Bitmap.js';
import type { SequenceClip, SequencePlaybackMode, SequenceSample } from './sequenceClip.js';
/** Explicit absolute-time selection borrowing a target and its exact current lease. */
export declare class SequencePlayer {
    constructor(bitmap: Bitmap, clip: SequenceClip, mode?: SequencePlaybackMode);
    applyAt(elapsedSeconds: number): SequenceSample;
    get lastSample(): SequenceSample | undefined;
    get isDisposed(): boolean;
    /** Drop every borrow; the last owned immutable sample is safe to retain. */
    dispose(): void;
}
//# sourceMappingURL=SequencePlayer.d.ts.map