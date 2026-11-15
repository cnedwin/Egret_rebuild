import type { ProjectSnapshot } from '@egret/contracts';
import type { AdmittedResourceManifest, ResourceBuildDescription } from '@egret/contracts/resources';
import type { ProjectValueResult } from '../public.js';
export declare function parseResourceManifest(text: string): ProjectValueResult<AdmittedResourceManifest>;
export declare function serializeResourceManifest(manifest: AdmittedResourceManifest): ProjectValueResult<string>;
export declare function describeResourceBuild(snapshot: ProjectSnapshot, target: string): ProjectValueResult<ResourceBuildDescription>;
//# sourceMappingURL=manifest.d.ts.map