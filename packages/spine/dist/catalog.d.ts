import { EgretError } from '@egret/engine';
import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';
export interface SpineCatalog {
    readonly entries: ReadonlyMap<string, ResourceManifestEntry>;
    readonly skeletons: ReadonlyMap<string, ResourceManifestEntry>;
    readonly selected: readonly ResourceManifestEntry[];
}
/** Select the existing admitted closure; this transient walk is not retained by groups. */
export declare function selectSpineDependencies(catalog: SpineCatalog, roots: readonly string[]): readonly string[];
export declare function spineFault(stage: string, id: string, cause?: unknown): EgretError;
/** Admit only the optional profile; unrelated game resources stay in the same manifest. */
export declare function admitSpineCatalog(manifest: AdmittedResourceManifest): SpineCatalog;
//# sourceMappingURL=catalog.d.ts.map