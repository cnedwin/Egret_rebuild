import type { EntityId, ProjectEditTransaction, ProjectEntity, ProjectFile, ProjectSnapshot } from '@egret/contracts';
import type { AdmittedResourceManifest, ResourceBuildPlanDescription } from '@egret/contracts/resources';
import type { ProjectValueResult } from '../public.js';
export interface ContentProducer {
    readonly nodeVersion: string;
    readonly pngjsVersion: string;
    readonly zlibVersion: string;
}
export interface ContentOutputFile {
    readonly name: 'primary' | 'rgba';
    readonly mediaType: string;
    readonly sha256: string;
    readonly byteLength: number;
}
export interface ContentOutput {
    readonly resourceId: EntityId;
    readonly buildKey: string;
    readonly files: readonly ContentOutputFile[];
}
export interface ContentBoundOutput {
    readonly resourceId: EntityId;
    readonly buildKey: string;
    readonly files: readonly {
        readonly name: 'primary' | 'rgba';
        readonly file: ProjectFile;
    }[];
}
export interface ContentArtifactBinding {
    readonly plan: ResourceBuildPlanDescription;
    readonly manifest: AdmittedResourceManifest;
    readonly files: readonly ProjectFile[];
    readonly entities: readonly ProjectEntity[];
    readonly outputs: readonly ContentBoundOutput[];
    readonly outputPrefix: string;
}
export interface ContentAdoptionOptions {
    readonly generationId: string;
    readonly manifest: {
        readonly sha256: string;
        readonly byteLength: number;
    };
    readonly outputPrefix: string;
    readonly selectorId: EntityId;
    readonly transactionId: string;
}
/** Describe finite content recipes without creating artifacts or verifying bytes. */
export declare function describeContentRecipes(snapshot: ProjectSnapshot, recipeDocument: unknown, producer: ContentProducer): ProjectValueResult<ResourceBuildPlanDescription>;
/** Bind complete declared output descriptors; no filesystem or readiness claim. */
export declare function bindContentArtifacts(snapshot: ProjectSnapshot, plan: ResourceBuildPlanDescription, outputs: readonly ContentOutput[], outputPrefix: string): ProjectValueResult<ContentArtifactBinding>;
/** Build and validate one edit transaction; the caller owns the real store commit. */
export declare function createContentAdoption(snapshot: ProjectSnapshot, binding: ContentArtifactBinding, options: ContentAdoptionOptions): ProjectValueResult<ProjectEditTransaction>;
//# sourceMappingURL=content.d.ts.map