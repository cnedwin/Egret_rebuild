import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { Engine } from './Engine.js';
import type { ContentLoader, ContentProviderFactory } from './contentTypes.js';
/** One manifest/source catalog, independent of global IDs and of other loaders. */
export declare function createContentLoader(engine: Engine, manifest: AdmittedResourceManifest, factory: ContentProviderFactory): ContentLoader;
//# sourceMappingURL=contentLoader.d.ts.map