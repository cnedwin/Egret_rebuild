import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { Engine } from './Engine.js';
import type { FontContentLoader, FontContentProviderFactory } from './fontContentTypes.js';
/** One typed font catalog over the existing manager and genuine dependency groups. */
export declare function createFontContentLoader(engine: Engine, manifest: AdmittedResourceManifest, factory: FontContentProviderFactory): FontContentLoader;
//# sourceMappingURL=fontContentLoader.d.ts.map