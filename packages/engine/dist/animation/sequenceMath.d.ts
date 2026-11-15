export type CapturedSequenceMarker = Readonly<{
    id: string;
    timeSeconds: number;
    markerIndex: number;
}>;
export type SequencePosition = Readonly<{
    playIndex: number;
    positionSeconds: number;
    complete: boolean;
}>;
export type PlannedSequenceEvent = Readonly<{
    kind: 'marker';
    id: string;
    markerIndex: number;
    playIndex: number;
    timelineSeconds: number;
    positionSeconds: number;
}> | Readonly<{
    kind: 'complete';
    totalPlays: number;
    timelineSeconds: number;
}>;
export interface SequenceEventPlanOptions {
    readonly includeStart?: boolean;
    readonly includeComplete?: boolean;
}
/** Locate one admitted position without dividing by a possibly subnormal duration. */
export declare function locatePosition(duration: number, totalPlays: number | 'infinite', time: number): SequencePosition;
/**
 * Plan a copied marker list's interval without writing a target or an event history.
 * Scalar bounds are checked here; locatePosition owns the candidate's local-position
 * search. Count every occurrence before expanding any event, including without a listener.
 */
export declare function planEvents(duration: number, totalPlays: number | 'infinite', markers: readonly CapturedSequenceMarker[], oldElapsed: number, newElapsed: number, options: SequenceEventPlanOptions, remainingBudget: number): readonly PlannedSequenceEvent[];
//# sourceMappingURL=sequenceMath.d.ts.map