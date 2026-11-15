import type { CapturedSequenceMarker } from './sequenceMath.js';
import type { SequenceControllerEvent } from './types.js';
export interface CapturedOptions {
    readonly rate: number;
    readonly totalPlays: number | 'infinite';
    readonly markers: readonly CapturedSequenceMarker[];
    readonly listener: ((event: SequenceControllerEvent) => undefined) | undefined;
}
export type Command = Readonly<{
    kind: 'start' | 'pause' | 'resume';
}> | Readonly<{
    kind: 'rate';
    rate: number;
}> | Readonly<{
    kind: 'seek';
    time: number;
    replay: boolean;
}>;
export declare function admitRate(value: unknown): number;
/** Copy only bounded scalar descriptors, including one array-length observation. */
export declare function captureOptions(value: unknown, duration: number, durationKnown?: boolean): CapturedOptions;
export declare function captureSeek(value: unknown): Command & {
    kind: 'seek';
};
//# sourceMappingURL=sequenceInput.d.ts.map