/** The one owner of the optional copy that joins the rows of a batch. */
export interface PreparedBatchScratchPlan2D {
    readonly draws: unknown[];
    logicalDraws: readonly unknown[] | undefined;
    readonly logicalSpans: unknown[];
    bytes: number;
    released: boolean;
}
/** CPU concat ownership only. The Host retains the original GPU retirement proof. */
export declare class PreparedBatchScratch2D {
    private retained;
    available(): number;
    reserve(plan: PreparedBatchScratchPlan2D, bytes: number): boolean;
    refund(plan: PreparedBatchScratchPlan2D, bytes: number): void;
    release(plan: PreparedBatchScratchPlan2D): void;
}
//# sourceMappingURL=preparedBatches2D.d.ts.map