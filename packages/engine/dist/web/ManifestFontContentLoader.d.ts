import type { Engine } from '@egret/engine';
import type { FontContentLoader } from '@egret/engine/resources';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestByteSource, ManifestByteSourceOptions } from './ManifestByteSource.js';
export interface ManifestFontContentLoader {
    readonly loader: FontContentLoader;
    readonly source: ManifestByteSource;
    close(): Promise<void>;
}
/** Fonts share the authenticated byte transport and the Engine's existing resource manager. */
export declare function createManifestFontContentLoader(engine: Engine, manifest: AdmittedResourceManifest, options: Omit<ManifestByteSourceOptions, 'profile'>): ManifestFontContentLoader;
//# sourceMappingURL=ManifestFontContentLoader.d.ts.map