import { reportDiagnostic } from "./diagnostics.js";
class Signal {
    cancelled = false;
    cancellationReason = undefined;
    subscriptions = new Map();
    get aborted() {
        return this.cancelled;
    }
    get reason() {
        return this.cancellationReason;
    }
    addEventListener(_type, listener, options = {}) {
        if (this.cancelled || this.subscriptions.has(listener))
            return;
        this.subscriptions.set(listener, { listener, once: options.once ?? false, active: true });
    }
    removeEventListener(_type, listener) {
        const subscription = this.subscriptions.get(listener);
        if (subscription === undefined)
            return;
        subscription.active = false;
        this.subscriptions.delete(listener);
    }
    abort(reason, onDiagnostic) {
        if (this.cancelled)
            return;
        this.cancelled = true;
        this.cancellationReason = reason;
        // Snapshot listeners; removals take effect through active flags during callbacks.
        const candidates = [...this.subscriptions.values()];
        for (const candidate of candidates) {
            if (!candidate.active)
                continue;
            if (candidate.once) {
                // Retire internally before callbacks; public removal is replaceable.
                candidate.active = false;
                this.subscriptions.delete(candidate.listener);
            }
            try {
                candidate.listener();
            }
            catch (cause) {
                reportDiagnostic(onDiagnostic, {
                    code: "CANCELLATION_LISTENER_FAILED",
                    phase: "cancellation",
                    severity: "error",
                    cause
                });
            }
        }
        this.subscriptions.clear();
    }
}
/** Owns the mutable signal; consumers receive the read-only cancellation port. */
export class CancellationController {
    mutableSignal = new Signal();
    onDiagnostic;
    signal = this.mutableSignal;
    constructor(onDiagnostic) {
        this.onDiagnostic = onDiagnostic;
    }
    abort(reason) {
        this.mutableSignal.abort(reason, this.onDiagnostic);
    }
}
//# sourceMappingURL=CancellationController.js.map