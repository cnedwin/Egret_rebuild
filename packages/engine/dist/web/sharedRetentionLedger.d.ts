/** Backend validators supply complete compatibility keys; this ledger owns metadata only. */
export interface RetentionRequestBase {
    readonly id: number;
    readonly byteLength: number;
}
export interface KeyedRetentionRequest<R extends RetentionRequestBase> {
    readonly request: R;
    readonly key: string;
}
export type LedgerHandle<R extends RetentionRequestBase, T extends object> = R & {
    readonly resource: T;
    readonly identity: object;
    readonly session: object;
};
export interface LedgerLease<R extends RetentionRequestBase, T extends object> {
    readonly requestId: number;
    readonly handle: LedgerHandle<R, T>;
    readonly offset: 0;
    readonly size: number;
}
export interface LedgerPlan<R extends RetentionRequestBase, T extends object> {
    readonly session: object;
    readonly revision: object;
    readonly requests: readonly R[];
    readonly matches: ReadonlyMap<number, LedgerHandle<R, T>>;
    readonly leases: readonly LedgerLease<R, T>[];
    readonly victims: readonly LedgerHandle<R, T>[];
}
export interface LedgerReturnPlan<R extends RetentionRequestBase, T extends object> {
    readonly identity: object;
    readonly retained: readonly LedgerHandle<R, T>[];
    readonly transient: readonly LedgerHandle<R, T>[];
}
export interface RetentionLedgerStatus {
    readonly idleBytes: number;
    readonly idleEntries: number;
    readonly reservedBytes: number;
    readonly reservedEntries: number;
    readonly unknownBytes: number;
    readonly unknownEntries: number;
}
interface RetentionResourceGauges extends RetentionLedgerStatus {
    readonly leasedBytes: number;
    readonly leasedEntries: number;
    readonly detachedBytes: number;
    readonly detachedEntries: number;
}
/** Existing unknown obligations projected without native references. */
export interface NativeUnknownDiagnostics {
    knownLogicalBytes: number;
    objects: number;
    highKnownLogicalBytes: number;
    highObjects: number;
    saturated: boolean;
}
/** Fixed-size Host observation shared by successive original generation ledgers. */
export interface RetentionLedgerDiagnostics {
    current: {
        -readonly [K in keyof RetentionResourceGauges]: number;
    };
    highWater: {
        -readonly [K in keyof RetentionResourceGauges]: number;
    };
    saturated: boolean;
    unknownNative?: NativeUnknownDiagnostics;
}
export type RetentionSettlement = 'destroyed' | 'unknown' | 'context-invalidated';
export interface RetentionLedger<R extends RetentionRequestBase, T extends object> {
    assertActive(): void;
    plan(requests: readonly KeyedRetentionRequest<R>[]): LedgerPlan<R, T>;
    claim(plan: LedgerPlan<R, T>): readonly LedgerLease<R, T>[];
    registerCreated(request: KeyedRetentionRequest<R>, resource: T): LedgerLease<R, T>;
    reserveReturns(leases: readonly LedgerLease<R, T>[]): LedgerReturnPlan<R, T>;
    publishReturns(plan: LedgerReturnPlan<R, T>): readonly LedgerHandle<R, T>[];
    cancelReturns(plan: LedgerReturnPlan<R, T>): readonly LedgerHandle<R, T>[];
    detach(handle: LedgerHandle<R, T>): void;
    settled(handle: LedgerHandle<R, T>, outcome: RetentionSettlement): void;
    invalidate(): void;
    detachIdleForClose(): readonly LedgerHandle<R, T>[];
    getStatus(): RetentionLedgerStatus;
}
/** Native proofs belong to the Host; confirmed outcomes alone change these charges. */
export declare function createRetentionLedger<Request extends RetentionRequestBase, Resource extends object>(session: object, diagnostics?: RetentionLedgerDiagnostics): RetentionLedger<Request, Resource>;
export {};
//# sourceMappingURL=sharedRetentionLedger.d.ts.map