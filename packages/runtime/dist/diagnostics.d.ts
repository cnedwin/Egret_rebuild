import type { Diagnostic, DiagnosticHandler } from "@egret/contracts";
/** Observer failures have no authority to interrupt cancellation or cleanup. */
export declare function reportDiagnostic(handler: DiagnosticHandler | undefined, diagnostic: Diagnostic): void;
//# sourceMappingURL=diagnostics.d.ts.map