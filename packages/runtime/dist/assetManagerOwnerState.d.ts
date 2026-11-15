import type { AssetAcquireOptions, AssetProvider } from "./AssetManager.js";
import type { AssetLease } from "./AssetLease.js";
import type { AssetRef, AssetType } from "./AssetRef.js";
import type { EngineContext } from "./ownership.js";
/** @internal Narrow immutable group assembly; no manager or owner lookup escapes. */
export interface AssetGroupOperations {
    readonly admitGroupRefs: (refs: readonly unknown[]) => void;
    readonly acquire: <T>(ref: AssetRef<T>, options?: AssetAcquireOptions) => Promise<AssetLease<T>>;
    readonly claimGroupLease: (lease: unknown, group: object) => void;
    readonly releaseGroupLease: (lease: unknown) => void;
}
/** Private authority installed only by authentic AssetManager construction. */
interface AssetManagerOwner {
    readonly context: EngineContext;
    readonly assertOpen: () => void;
    readonly register: <T>(type: AssetType<T>, provider: AssetProvider<NoInfer<T>>) => void;
    readonly acquire: <T>(ref: AssetRef<T>, options?: AssetAcquireOptions) => Promise<AssetLease<T>>;
    readonly invalidate: <T>(ref: AssetRef<T>) => void;
}
/** Called once from the manager constructor; no cache or provider import is needed. */
export declare function registerAssetManagerOwner(manager: object, owner: AssetManagerOwner): void;
/** Return the immutable intrinsic operations, never a structural caller port. */
export declare function requireAssetManagerOwner(value: unknown): AssetManagerOwner;
/** Only pre-commit preparation can be retried; the release callback is idempotent. */
export declare function beginTextCacheCreation(manager: object): () => void;
/** Consume the sole lifetime before provider registration or the fixed 32 ref IDs. */
export declare function commitTextCacheLifetime(manager: object, closeCache: () => void): void;
/** Make the manager unavailable without invoking any cache or external callback. */
export declare function markAssetManagerOwnerClosed(manager: object): void;
/** Consume first; trusted cache close handles and diagnoses its own cleanup faults. */
export declare function closeOwnedTextCache(manager: object): void;
/** One additional fixed paragraph profile shares the same manager and shutdown boundary. */
export declare function beginParagraphCacheCreation(manager: object): () => void;
export declare function commitParagraphCacheLifetime(manager: object, close: () => void): void;
export {};
//# sourceMappingURL=assetManagerOwnerState.d.ts.map