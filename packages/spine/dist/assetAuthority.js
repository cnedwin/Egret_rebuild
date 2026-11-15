// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
const assets = new WeakMap();
/** Only loader-created, group-lifetime views may authorize an instance. */
export function registerSpineAsset(asset, port) {
    assets.set(asset, port);
}
export function requireSpineAsset(asset) {
    const port = assets.get(asset);
    if (!port)
        throw new EgretError('SPINE_INSTANCE_ASSET_INVALID');
    port.assertOpen();
    return port;
}
//# sourceMappingURL=assetAuthority.js.map