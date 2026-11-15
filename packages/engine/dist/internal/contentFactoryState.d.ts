import type { AssetProvider, AssetType, Scope, SequenceClip, SequenceFrameInput } from '@egret/runtime';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestAssetGroup, ManifestBinding, ManifestGroupOptions } from '../manifestResourceTypes.js';
export interface ContentEngineOperations {
    assertOpen(): void;
    isScope(value: unknown): value is Scope;
    register<T>(type: AssetType<T>, provider: AssetProvider<T>): void;
    group(scope: Scope, manifest: AdmittedResourceManifest, roots: readonly string[], bindings: readonly ManifestBinding[], options?: ManifestGroupOptions): ManifestAssetGroup;
    own(dispose: () => void): () => void;
}
/** Only genuine Engine construction installs captured manager and Scope authority. */
export declare function registerContentEngine(engine: object, operations: ContentEngineOperations): void;
export declare function requireContentEngine(engine: unknown): ContentEngineOperations;
export declare function registerContentLoader(loader: object, authenticate: (scope: Scope, imageId: string, sequenceId: string) => void): void;
export declare function authenticateContentLoader(loader: unknown, scope: Scope, imageId: string, sequenceId: string): void;
export declare function registerSequenceTimeline(clip: SequenceClip, frames: readonly SequenceFrameInput[]): void;
export declare function hasSequenceTimeline(clip: SequenceClip): boolean;
export declare function hasMatchingSequenceTimeline(source: SequenceClip, candidate: SequenceClip): boolean;
//# sourceMappingURL=contentFactoryState.d.ts.map