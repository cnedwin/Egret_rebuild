// SPDX-License-Identifier: Apache-2.0
/** Shared Host lifecycle metadata. Native ownership remains in each Host. */
export type SharedDeviceSessionState =
    | 'new' | 'starting' | 'ready' | 'stopped' | 'lost'
    | 'restoring' | 'failed' | 'closing' | 'closed';

/** A frozen observation of one Host, with historical and current failures separate. */
export interface SharedDeviceSessionStatus<Failure> {
    readonly state: SharedDeviceSessionState;
    readonly generation: number;
    readonly attempt: number;
    readonly firstFailure: Failure | null;
    readonly generationFailure: Failure | null;
}

/** Logical ownership gauges. Credits and overlapping subsets are not additive memory. */
interface SharedHostResourceCurrent {
    readonly pending: { readonly frames:number; readonly uploadCreditBytes:number; readonly pageCreditBytes:number; readonly readbackCreditBytes:number; readonly geometryCreditBytes:number; readonly colorCreditBytes:number; readonly sceneCreditBytes:number; readonly uniformCreditBytes:number; readonly depthCreditBytes:number; };
    readonly cpu: { readonly canonicalBytes:number; readonly scratchBytes:number; readonly temporaryBytes:number; };
    readonly images: { readonly readyBytes:number; readonly readyEntries:number; readonly pinnedReadyBytes:number; readonly pinnedReadyEntries:number; readonly allocatedLogicalBytes:number; readonly reservedCreditBytes:number; };
    readonly reusable: { readonly idleBytes:number; readonly idleEntries:number; readonly leasedBytes:number; readonly leasedEntries:number; readonly reservedBytes:number; readonly reservedEntries:number; readonly detachedBytes:number; readonly detachedEntries:number; readonly unknownBytes:number; readonly unknownEntries:number; };
    readonly unknownNative: { readonly knownLogicalBytes:number; readonly objects:number; };
}
/** Fresh immutable data; reads do no native work. Lifetime maxima may peak at different times. */
export interface SharedHostResourceStatus {
    readonly current:SharedHostResourceCurrent;
    readonly highWater:SharedHostResourceCurrent;
    readonly totals:{readonly pageWriteCalls:number;readonly pageWriteBytes:number;readonly readyCapacityEvictions:number;};
    /** A saturated lifetime observation cannot prove an exact quantitative row. */
    readonly saturated:boolean;
}
