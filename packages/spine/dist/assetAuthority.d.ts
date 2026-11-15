import type { Scope, AssetLease, Texture } from '@egret/engine';
import type { ParsedSpineSetup } from './parse.js';
import type { SpineAsset } from './types.js';
export interface SpineAssetPort {
    getSetup(): ParsedSpineSetup;
    assertOpen(): void;
    authenticate(scope: Scope, capacity?: boolean): void;
    getPages(): readonly AssetLease<Texture>[];
    own(scope: Scope, instance: {
        dispose(): void;
    }): () => void;
}
/** Only loader-created, group-lifetime views may authorize an instance. */
export declare function registerSpineAsset(asset: SpineAsset, port: SpineAssetPort): void;
export declare function requireSpineAsset(asset: SpineAsset): SpineAssetPort;
//# sourceMappingURL=assetAuthority.d.ts.map