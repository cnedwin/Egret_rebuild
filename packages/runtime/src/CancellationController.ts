import type { CancellationListener, CancellationSignal, DiagnosticHandler } from "@egret/contracts";
import { reportDiagnostic } from "./diagnostics.js";

interface Subscription {
  readonly listener: CancellationListener;
  readonly once: boolean;
  active: boolean;
}

class Signal implements CancellationSignal {
  private cancelled = false;
  private cancellationReason: unknown = undefined;
  private readonly subscriptions = new Map<CancellationListener, Subscription>();

  public get aborted(): boolean { return this.cancelled; }
  public get reason(): unknown { return this.cancellationReason; }

  public addEventListener(
    _type: "abort",
    listener: CancellationListener,
    options: { readonly once?: boolean } = {},
  ): void {
    if (this.cancelled || this.subscriptions.has(listener)) return;
    this.subscriptions.set(listener, { listener, once: options.once ?? false, active: true });
  }

  public removeEventListener(_type: "abort", listener: CancellationListener): void {
    const subscription = this.subscriptions.get(listener);
    if (subscription === undefined) return;
    subscription.active = false;
    this.subscriptions.delete(listener);
  }

  public abort(reason: unknown, onDiagnostic: DiagnosticHandler | undefined): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.cancellationReason = reason;
    // Snapshot listeners; removals take effect through active flags during callbacks.
    const candidates = [...this.subscriptions.values()];
    for (const candidate of candidates) {
      if (!candidate.active) continue;
      if (candidate.once) this.removeEventListener("abort", candidate.listener);
      try {
        candidate.listener();
      } catch (cause) {
        reportDiagnostic(onDiagnostic, { code: "CANCELLATION_LISTENER_FAILED", phase: "cancellation", severity: "error", cause });
      }
    }
    this.subscriptions.clear();
  }
}

/** Owns the mutable signal; consumers receive the read-only cancellation port. */
export class CancellationController {
  private readonly mutableSignal = new Signal();
  private readonly onDiagnostic: DiagnosticHandler | undefined;
  public readonly signal: CancellationSignal = this.mutableSignal;

  public constructor(onDiagnostic?: DiagnosticHandler) { this.onDiagnostic = onDiagnostic; }
  public abort(reason?: unknown): void { this.mutableSignal.abort(reason, this.onDiagnostic); }
}
