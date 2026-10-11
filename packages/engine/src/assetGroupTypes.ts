import type { AssetLease } from '@egret/runtime';

declare const assetGroupBrand: unique symbol;

export type AssetGroupState = 'pending' | 'ready' | 'failed' | 'disposed';

export interface AssetGroupOptions {
  readonly concurrency?: number;
}

/** One opaque cleanup owner; members remain borrowed genuine invariant leases. */
export interface AssetGroup<T> {
  readonly [assetGroupBrand]: true;
  readonly state: AssetGroupState;
  readonly ready: Promise<readonly AssetLease<T>[]>;
  dispose(): void;
}
