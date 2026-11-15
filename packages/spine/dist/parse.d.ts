import * as Core from '@esotericsoftware/spine-core';
import { AssetLease, Texture } from '@egret/engine';
import type { SpineAssetInfo } from './types.js';
export interface ParsedSpineSetup {
    readonly data: Core.SkeletonData;
    readonly atlas: Core.TextureAtlas;
    readonly info: SpineAssetInfo;
}
export declare function parseSpineSetup(id: string, source: string | Uint8Array, atlasText: string, pageNames: readonly string[], imageIds: readonly string[], leases: readonly AssetLease<Texture>[], allowPrerelease: boolean): ParsedSpineSetup;
//# sourceMappingURL=parse.d.ts.map