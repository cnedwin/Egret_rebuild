import type { CancellationSignal } from "@egret/contracts";
import { AssetLease } from "./AssetLease.js";
import type { AssetRef, AssetType } from "./AssetRef.js";
import type { EngineContext } from "./ownership.js";
import type { AssetLoadContext } from "./assetState.js";
export type { AssetLoadContext } from "./assetState.js";
export interface AssetProvider<T> {
    load(ref: AssetRef<T>, context: AssetLoadContext): Promise<T>;
    dispose(value: T): void;
}
export interface AssetAcquireOptions {
    readonly signal?: CancellationSignal;
}
export declare let createAssetManager: (engine: EngineContext) => AssetManager;
/** CPU acquisition only: demand retains values; completed unused values are evicted. */
export declare class AssetManager {
    #private;
    private closed;
    private taskId;
    private leaseId;
    private readonly providers;
    private readonly identities;
    private readonly current;
    private readonly entries;
    private constructor();
    private assertOpen;
    /** Snapshot method identity and receiver once, including getter reentry checks. */
    register<T>(type: AssetType<T>, provider: AssetProvider<NoInfer<T>>): void;
    /** The executor commits an entry and its first waiter before any loader callback. */
    acquire<T>(ref: AssetRef<T>, options?: AssetAcquireOptions): Promise<AssetLease<T>>;
    private identityFor;
    /** Authenticate all positions without reserving identity or creating demand. */
    private admitGroupRefs;
    /** Lease identity, affinity and one cleanup owner are checked before publication. */
    private claimGroupLease;
    /** Invalidation changes future routing, while old demand keeps its own entry. */
    invalidate<T>(ref: AssetRef<T>): void;
    private installSignal;
    /** Mark local subscription inert before adapter removal; throws retain diagnostics. */
    private detach;
    private start;
    private receive;
    private deliver;
    private failWaiter;
    private failEntry;
    /** Remove only this entry: old-generation cleanup cannot delete its replacement. */
    private markTerminal;
    private isTerminal;
    private retireUnused;
    /** One attempted disposal per successful result, even if the disposer throws. */
    private cleanup;
    private diagnose;
    /** Close the gate and revoke every local demand before the first external hook. */
    dispose(): void;
}
//# sourceMappingURL=AssetManager.d.ts.map