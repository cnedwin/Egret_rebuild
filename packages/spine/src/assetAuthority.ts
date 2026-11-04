// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
import type { Scope, AssetLease, Texture } from '@egret/engine';
import type { ParsedSpineSetup } from './parse.js';
import type { SpineAsset } from './types.js';

export interface SpineAssetPort {
  getSetup(): ParsedSpineSetup;
  assertOpen(): void;
  authenticate(scope: Scope, capacity?: boolean): void;
  getPages(): readonly AssetLease<Texture>[];
  own(scope: Scope, instance: { dispose(): void }): () => void;
}
const assets = new WeakMap<object, SpineAssetPort>();
/** Only loader-created, group-lifetime views may authorize an instance. */
export function registerSpineAsset(asset: SpineAsset, port: SpineAssetPort): void { assets.set(asset, port); }
export function requireSpineAsset(asset: SpineAsset): SpineAssetPort {
  const port = assets.get(asset);
  if (!port) throw new EgretError('SPINE_INSTANCE_ASSET_INVALID');
  port.assertOpen();
  return port;
}
