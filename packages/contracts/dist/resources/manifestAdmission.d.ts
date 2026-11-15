import type { AdmittedResourceManifest, ResourceBuildDescription, ResourceBuildPlanDescription, ResourceBuildKeyPlan, ResourceManifestIdentityInputs, ResourceManifestResult } from '../ResourceManifest.js';
export declare function validateResourceBuildPlanDescription(input: unknown): ResourceManifestResult<ResourceBuildPlanDescription>;
export declare function evaluateResourceBuildKeys(description: ResourceBuildPlanDescription): ResourceManifestResult<ResourceBuildKeyPlan>;
export declare function validateResourceBuildDescription(input: unknown): ResourceManifestResult<ResourceBuildDescription>;
export declare function buildResourceManifest(description: ResourceBuildDescription): ResourceManifestResult<AdmittedResourceManifest>;
export declare function admitResourceManifest(value: unknown): ResourceManifestResult<AdmittedResourceManifest>;
export declare function isAdmittedResourceManifest(value: unknown): value is AdmittedResourceManifest;
export declare function serializeResourceManifest(manifest: AdmittedResourceManifest): ResourceManifestResult<string>;
export declare function getResourceManifestIdentityInputs(manifest: AdmittedResourceManifest, id: string): ResourceManifestIdentityInputs;
//# sourceMappingURL=manifestAdmission.d.ts.map