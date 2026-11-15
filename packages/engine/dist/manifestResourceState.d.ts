import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';
import type { AssetRef, AssetType } from '@egret/runtime';
import type { ManifestAssetBinding } from './manifestResourceTypes.js';
/** Private immutable metadata, shared only through the exact assembly alias. */
export interface ManifestBindingState {
    readonly manifest: AdmittedResourceManifest;
    readonly entry: ResourceManifestEntry;
    readonly ref: AssetRef<unknown>;
}
/** Authentication never reads a structural lookalike or proxy property. */
export declare function requireManifestBinding(value: unknown): ManifestBindingState;
/** A matching ref ID alone cannot turn caller metadata into a verified source. */
export declare function requireManifestAssetRef(value: unknown): ManifestBindingState;
export declare function createManifestAssetBinding<T>(manifest: AdmittedResourceManifest, assetId: string, type: AssetType<T>): ManifestAssetBinding<T>;
export type { ManifestBinding } from './manifestResourceTypes.js';
//# sourceMappingURL=manifestResourceState.d.ts.map