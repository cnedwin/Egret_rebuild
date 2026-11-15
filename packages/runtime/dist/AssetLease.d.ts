import type { EngineContext } from "./ownership.js";
declare const LEASE_VALUE: unique symbol;
export declare let createAssetLease: <T>(engine: EngineContext, leaseId: number, generation: number, read: () => T, release: () => void) => AssetLease<T>;
/** One independently revocable CPU-value borrow, bound to its originating Engine. */
export declare class AssetLease<T> {
    readonly [LEASE_VALUE]?: (value: T) => T;
    readonly leaseId: number;
    readonly resourceGeneration: number;
    private constructor();
    get value(): T;
    /** Revoke before invoking the manager so disposer reentry sees a released lease. */
    release(): void;
}
/** Manager shutdown revokes all leases before any external cleanup callback. */
export declare function revokeAssetLease(lease: AssetLease<unknown>): void;
/** Install one cache-owned, counter-only retirement observer without changing the lease. */
export declare function observeAssetLeaseRetirement(lease: unknown, onRetired: () => void): boolean;
/** Runtime-private identity guard; proxies and lookalikes cannot supply entitlement. */
export declare function isAssetLease(value: unknown): value is AssetLease<unknown>;
/** Read the manager-owned value, without overridable getters or descriptor callbacks. */
export declare function readAssetLeaseValue(value: unknown): unknown;
export {};
//# sourceMappingURL=AssetLease.d.ts.map