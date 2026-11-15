import { Engine, Scope } from '@egret/engine';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { SpineContentOptions, SpineContentProviderFactory, SpineContentLoader } from './types.js';
/** Explicit optional SDK. All source, setup and image ownership stays in Egret's manager. */
export declare function createSpineContentLoader(engine: Engine, ownerScope: Scope, manifest: AdmittedResourceManifest, factory: SpineContentProviderFactory, options?: SpineContentOptions): SpineContentLoader;
//# sourceMappingURL=loader.d.ts.map