import type { DiagnosticHandler, HostAdapter } from "@egret/contracts";
import { EgretError, reportDiagnostic } from "@egret/runtime";

function closeFailure(errors: readonly unknown[]): EgretError {
  return new EgretError("ENGINE_CLOSE_FAILED", { cause: errors[0], cleanupErrors: errors.slice(1) });
}

/** Deadline rejects the caller; it never cancels or destroys borrowed host work. */
export function closeHost(
  host: HostAdapter,
  timeoutMs: number,
  releaseSurface: () => void,
  errors: unknown[],
  onDiagnostic: DiagnosticHandler | undefined,
): Promise<void> {
  let closing: Promise<void>;
  try { closing = Promise.resolve(host.close()); }
  catch (cause) { closing = Promise.reject(cause); }

  return new Promise<void>((resolve, reject) => {
    // Caller deadline and physical host completion are independent states.
    let callerSettled = false;
    let cancelTimer: () => void = (): void => {};
    const complete = (failed: boolean, cause?: unknown): void => {
      // A rejection cannot prove safe return of borrowed/in-flight host resources.
      // Even after a timeout, only successful host completion releases it.
      if (!failed) releaseSurface();
      if (callerSettled) {
        if (failed) reportDiagnostic(onDiagnostic, { code: "HOST_CLOSE_LATE_FAILURE", phase: "engine", severity: "error", cause });
        return;
      }
      callerSettled = true;
      try { cancelTimer(); }
      catch (timerCause) { errors.push(timerCause); }
      if (failed) errors.push(cause);
      if (errors.length !== 0) reject(closeFailure(errors));
      else resolve();
    };
    // Both outcomes are attached before the deadline port can call user code.
    void closing.then((): void => complete(false), (cause: unknown): void => complete(true, cause));
    try {
      cancelTimer = host.setTimeout((): void => {
        if (callerSettled) return;
        callerSettled = true;
        const error = new EgretError("ENGINE_CLOSE_TIMEOUT", { cause: errors[0], cleanupErrors: errors.slice(1) });
        reportDiagnostic(onDiagnostic, { code: error.code, phase: "engine", severity: "error", cause: error });
        reject(error);
      }, timeoutMs);
    } catch (cause) {
      callerSettled = true;
      errors.push(cause);
      reject(closeFailure(errors));
    }
  });
}
