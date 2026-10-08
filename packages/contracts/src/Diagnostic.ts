/** Diagnostics describe this headless lifecycle slice only. */
export interface Diagnostic {
  readonly code: string;
  readonly phase: "cancellation" | "scope" | "display-tree" | "engine" | "assets" | "graphics";
  readonly severity: "error" | "warning";
  readonly cause?: unknown;
  readonly cleanupErrors?: readonly unknown[];
}

/** Observation only: throwing cannot change cleanup or cancellation progress. */
export type DiagnosticHandler = (diagnostic: Diagnostic) => void;

