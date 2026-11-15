import type { AssetGroupOperations } from '@egret/runtime';
import type { AssetGroupContext } from './assetGroup.js';
import type { ManifestAssetGroup } from './manifestResourceTypes.js';
export interface ManifestAssetGroupOwner {
    create(scope: unknown, manifest: unknown, roots: unknown, bindings: unknown, options: unknown): ManifestAssetGroup;
    close(): void;
}
/** One finite acquisition scheduler, using only captured manager lease authority. */
export declare function createManifestAssetGroupOwner(context: AssetGroupContext, operations: AssetGroupOperations): ManifestAssetGroupOwner;
//# sourceMappingURL=manifestAssetGroup.d.ts.map