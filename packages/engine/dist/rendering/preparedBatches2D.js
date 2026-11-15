const SCRATCH_LIMIT = 8388608;
/** CPU concat ownership only. The Host retains the original GPU retirement proof. */
export class PreparedBatchScratch2D {
    retained = 0;
    available() {
        return SCRATCH_LIMIT - this.retained;
    }
    reserve(plan, bytes) {
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.available())
            return false;
        this.retained += bytes;
        plan.bytes += bytes;
        return true;
    }
    refund(plan, bytes) {
        this.retained -= bytes;
        plan.bytes -= bytes;
    }
    release(plan) {
        if (plan.released)
            return;
        plan.released = true;
        this.retained -= plan.bytes;
        plan.bytes = 0;
        plan.logicalDraws = undefined;
        plan.draws.length = 0;
        plan.logicalSpans.length = 0;
    }
}
//# sourceMappingURL=preparedBatches2D.js.map