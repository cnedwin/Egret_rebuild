import { isAssetLease, readAssetLeaseValue } from './AssetLease.js';
import { isTexture, readTextureSnapshot } from './Texture.js';
import { EgretError } from './EgretError.js';
/** Exact lease entitlement precedes Texture brand and live-image authority. */
export function readMeshCaptureImage(slot) {
    if (!isAssetLease(slot.lease))
        throw new EgretError('MESH_LEASE_INVALID');
    const value = readAssetLeaseValue(slot.lease);
    if (!isTexture(value))
        throw new EgretError('MESH_TEXTURE_INVALID');
    return readTextureSnapshot(value);
}
//# sourceMappingURL=meshCaptureSnapshot.js.map