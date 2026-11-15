import type { ProjectSnapshot, ProjectTransaction } from "@egret/contracts";
import type { ProjectLimits, ProjectStore, ProjectValueResult } from "./public.js";
export declare function parseProjectSnapshot(text: string, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectSnapshot>;
export declare function serializeProjectSnapshot(snapshot: ProjectSnapshot, limits?: Partial<ProjectLimits>): ProjectValueResult<string>;
export declare function parseProjectTransaction(text: string, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectTransaction>;
export declare function createProjectStore(baseline: ProjectSnapshot, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectStore>;
export declare function openProjectHistory(text: string, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectStore>;
//# sourceMappingURL=api.d.ts.map