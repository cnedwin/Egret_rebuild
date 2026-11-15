import type { AtlasFrameLayout } from './atlasFrameLayout.js';
export interface SequenceFrameInput {
    readonly layout?: AtlasFrameLayout;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly durationSeconds: number;
}
export interface SequenceClipInput {
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    readonly frames: readonly SequenceFrameInput[];
}
export type SequencePlaybackMode = 'once' | 'loop';
/** Public immutable sequence metadata; authentic values come from createSequenceClip. */
export interface SequenceClip {
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    readonly frameCount: number;
    readonly durationSeconds: number;
}
export interface SequenceRegion {
    readonly layout?: AtlasFrameLayout;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface SequenceSample {
    readonly frameIndex: number;
    readonly region: SequenceRegion;
    readonly positionSeconds: number;
    readonly atEnd: boolean;
    readonly stopped: boolean;
}
export declare function createSequenceClip(input: unknown, profile?: 'trim-rotation-v1'): SequenceClip;
export declare function sampleSequenceClip(clip: SequenceClip, elapsedSeconds: number, options: {
    readonly mode: 'once' | 'loop';
    readonly stopAtSeconds?: number;
}): SequenceSample;
//# sourceMappingURL=sequenceClip.d.ts.map