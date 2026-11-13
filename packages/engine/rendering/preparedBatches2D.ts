/** The one owner of the optional copy that joins the rows of a batch. */
export interface PreparedBatchScratchPlan2D { readonly draws:unknown[]; logicalDraws:readonly unknown[]|undefined; readonly logicalSpans:unknown[]; bytes:number; released:boolean; }
const SCRATCH_LIMIT = 8388608;
/** CPU concat ownership only. The Host retains the original GPU retirement proof. */
export class PreparedBatchScratch2D {
    private retained = 0;
    public available(): number { return SCRATCH_LIMIT - this.retained; }
    public reserve(plan: PreparedBatchScratchPlan2D, bytes: number): boolean {
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.available()) return false;
        this.retained += bytes; plan.bytes += bytes; return true;
    }
    public refund(plan: PreparedBatchScratchPlan2D, bytes: number): void { this.retained -= bytes; plan.bytes -= bytes; }
    public release(plan: PreparedBatchScratchPlan2D): void {
        if (plan.released) return;
        plan.released = true; this.retained -= plan.bytes; plan.bytes = 0;
        plan.logicalDraws = undefined; plan.draws.length = 0; plan.logicalSpans.length = 0;
    }
}
