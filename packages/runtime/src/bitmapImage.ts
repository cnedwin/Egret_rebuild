import type { ImageData2D } from '@egret/contracts';
import { isAssetLease, readAssetLeaseValue } from './AssetLease.js';
import type { AssetLease } from './AssetLease.js';
import { EgretError } from './EgretError.js';
import { isTexture, readTextureImage, readTextureSnapshot } from './Texture.js';
import type { Texture, TextureSnapshot2D } from './Texture.js';

/** Exact entitlement precedes value/live checks; public value getters are not authority. */
export function readBitmapImage(lease: AssetLease<Texture>): TextureSnapshot2D {
  if (!isAssetLease(lease)) throw new EgretError('BITMAP_LEASE_INVALID');
  const value = readAssetLeaseValue(lease);
  if (!isTexture(value)) throw new EgretError('BITMAP_TEXTURE_INVALID');
  return readTextureSnapshot(value);
}

/**
 * The image of a lease that `readBitmapImage` has admitted before: the same entitlement, value and live
 * checks with the same refusals, and no record made. A lease stays a lease, so that one check is not repeated.
 */
export function readBitmapSource(lease: AssetLease<Texture>): ImageData2D {
  const value = readAssetLeaseValue(lease);
  if (!isTexture(value)) throw new EgretError('BITMAP_TEXTURE_INVALID');
  return readTextureImage(value);
}
