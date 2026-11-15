import type { ProjectSnapshot, ProjectTransaction, ProjectRestoreTransaction } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectCommitResult, ProjectValueResult } from "./public.js";
import type { StoreState } from "./state.js";
export type CommitTransition = {
    readonly state: StoreState;
    readonly result: ProjectCommitResult;
};
export type RestoreCandidate = (state: StoreState, command: ProjectRestoreTransaction) => ProjectValueResult<Prepared<ProjectSnapshot>>;
export declare function commitPrepared(state: StoreState, prepared: Prepared<ProjectTransaction>, restore: RestoreCandidate): CommitTransition;
//# sourceMappingURL=commit.d.ts.map