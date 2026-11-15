import type { Disposable } from '@egret/contracts';
import type { SequencePlaybackMode, SequenceSample } from '@egret/runtime';
export type SequencePlaybackState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
export interface SequencePlaybackOptions {
    readonly mode?: SequencePlaybackMode;
}
declare const sequencePlaybackBrand: unique symbol;
export interface SequencePlayback extends Disposable {
    readonly [sequencePlaybackBrand]: true;
    readonly state: SequencePlaybackState;
    readonly isDisposed: boolean;
    readonly elapsedSeconds: number;
    readonly lastSample: SequenceSample | undefined;
    start(): void;
    pause(): void;
    resume(): void;
    stop(): void;
    dispose(): void;
}
export {};
//# sourceMappingURL=sequencePlaybackTypes.d.ts.map