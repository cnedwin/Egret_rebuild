import type { Engine, Scope } from '@egret/engine';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestByteSourceOptions, ManifestByteSourceStatus, ManifestTextureProviderStatus } from '@egret/engine/web/resources';
import type { SpineContentLoader, SpineContentOptions } from './types.js';
export interface ManifestSpineContentLoader extends SpineContentLoader {
    getTransportStatus(): Readonly<{
        source: ManifestByteSourceStatus;
        provider: ManifestTextureProviderStatus;
    }>;
}
/** The existing transport owns integrity, strict UTF-8, native PNG decode and cancellation. */
export declare function createManifestSpineContentLoader(engine: Engine, ownerScope: Scope, manifest: AdmittedResourceManifest, sourceOptions: ManifestByteSourceOptions, options?: SpineContentOptions): ManifestSpineContentLoader;
//# sourceMappingURL=web.d.ts.map