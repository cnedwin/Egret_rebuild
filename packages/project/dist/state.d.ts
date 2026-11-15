import type { ProjectSnapshot, ProjectTransaction, TransactionId } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectLimits, ProjectTransactionReceipt, ProjectValueResult } from "./public.js";
export type StoreState = {
    readonly limits: ProjectLimits;
    readonly baseline: ProjectSnapshot;
    readonly head: ProjectSnapshot;
    readonly commands: readonly ProjectTransaction[];
    readonly receipts: ReadonlyMap<TransactionId, ProjectTransactionReceipt>;
    readonly identities: ReadonlyMap<TransactionId, string>;
    readonly prefixCosts: readonly number[];
    readonly historyUtf8Bytes: number;
};
export declare function createState(baseline: Prepared<ProjectSnapshot>, limits: ProjectLimits): ProjectValueResult<StoreState>;
//# sourceMappingURL=state.d.ts.map