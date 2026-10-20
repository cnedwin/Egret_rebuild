// SPDX-License-Identifier: Apache-2.0
import type { AssetLease, AssetRef } from '@egret/runtime';

declare const manifestBindingBrand: unique symbol;
declare const manifestBindingValue: unique symbol;
declare const manifestGroupBrand: unique symbol;

/** Immutable resource metadata; only the optional binding factory creates it. */
export interface ManifestBinding {
  readonly [manifestBindingBrand]: true;
}

/** A genuine invariant ref paired with one exact admitted manifest entry. */
export interface ManifestAssetBinding<T> extends ManifestBinding {
  readonly ref: AssetRef<T>;
  readonly [manifestBindingValue]?: (value: T) => T;
}

export interface ManifestGroupOptions {
  readonly priority?: 'interactive' | 'background';
}

/** Scope-owned dependency group. Member leases are borrowed, never transferred. */
export interface ManifestAssetGroup {
  readonly [manifestGroupBrand]: true;
  readonly ready: Promise<void>;
  get<T>(binding: ManifestAssetBinding<T>): AssetLease<T>;
  dispose(): void;
}
