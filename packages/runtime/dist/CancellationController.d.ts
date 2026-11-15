import type { CancellationSignal, DiagnosticHandler } from "@egret/contracts";
/** Owns the mutable signal; consumers receive the read-only cancellation port. */
export declare class CancellationController {
    private readonly mutableSignal;
    private readonly onDiagnostic;
    readonly signal: CancellationSignal;
    constructor(onDiagnostic?: DiagnosticHandler);
    abort(reason?: unknown): void;
}
//# sourceMappingURL=CancellationController.d.ts.map