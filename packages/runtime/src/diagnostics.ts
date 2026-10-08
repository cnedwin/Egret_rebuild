import type { Diagnostic, DiagnosticHandler } from "@egret/contracts";

/** Observer failures have no authority to interrupt cancellation or cleanup. */
export function reportDiagnostic(handler: DiagnosticHandler | undefined, diagnostic: Diagnostic): void {
  try {
    // Freeze the diagnostic envelope; application-owned cause objects stay borrowed.
    handler?.(Object.freeze(diagnostic));
  } catch (cause) {
    // The lifecycle failure remains in Diagnostic.cause / Engine's failure list.
    // Do not call a failing observer recursively or replace the original failure.
    void cause;
  }
}
