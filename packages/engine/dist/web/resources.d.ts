import type { ManifestByteSource } from './ManifestByteSource.js';
import type { BrowserPngPorts, ManifestTextureProvider } from './BrowserTextureProvider.js';
import type { Engine } from '@egret/engine';
import type { ContentLoader } from '@egret/engine/resources';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestByteSourceOptions, ManifestByteSourceStatus } from './ManifestByteSource.js';
import type { ManifestTextureProviderStatus } from './BrowserTextureProvider.js';
export { createManifestByteSource } from './ManifestByteSource.js';
export type { ManifestByteSource, ManifestByteSourceOptions, ManifestByteSourceStatus } from './ManifestByteSource.js';
export type { ManifestTextureProvider, ManifestTextureProviderStatus } from './BrowserTextureProvider.js';
export interface ManifestTextureProviderOptions {
    readonly ports?: BrowserPngPorts;
}
/** Source authentication precedes every caller-controlled options read. */
export declare function createManifestTextureProvider(source: ManifestByteSource, options?: ManifestTextureProviderOptions): ManifestTextureProvider;
export interface ManifestContentLoader extends ContentLoader {
    close(): Promise<void>;
    getStatus(): Readonly<{
        source: ManifestByteSourceStatus;
        provider: ManifestTextureProviderStatus;
    }>;
}
/** Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. */
export declare function createManifestContentLoader(engine: Engine, manifest: AdmittedResourceManifest, options: ManifestByteSourceOptions): ManifestContentLoader;
export { createManifestFontContentLoader } from './ManifestFontContentLoader.js';
export type { ManifestFontContentLoader } from './ManifestFontContentLoader.js';
//# sourceMappingURL=resources.d.ts.map