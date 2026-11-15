import type { ProjectSnapshot, ProjectTransaction, ProjectRestoreTransaction } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectLimits, ProjectValueResult } from "./public.js";
import type { StoreState } from "./state.js";
export declare function reconstructRevision(baseline: ProjectSnapshot, commands: readonly ProjectTransaction[], prefixCosts: readonly number[], targetRevision: number, limits: ProjectLimits): ProjectValueResult<ProjectSnapshot>;
export declare function restoreCandidate(state: StoreState, command: ProjectRestoreTransaction): ProjectValueResult<Prepared<ProjectSnapshot>>;
//# sourceMappingURL=restore.d.ts.map