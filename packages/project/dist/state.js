import { cloneLive } from "./live-input.js";
import { validateSnapshot } from "./validate-snapshot.js";
import { validationDiagnostic } from "./validation-order.js";
import { historyBytes } from "./history-bytes.js";
import { utf8Length } from "./unicode.js";
export function createState(baseline, limits) {
    // Recheck local bounds under this history's limits, even if preparation used
    // another set. No state or mutable index escapes a failed creation.
    const copied = cloneLive(baseline.value, "snapshot", limits);
    if (!copied.ok)
        return copied;
    const checked = validateSnapshot(copied.value, { limits, pointerPrefix: "" });
    if (!checked.ok)
        return checked;
    const prepared = checked.value;
    const history = utf8Length(historyBytes(prepared.value, []));
    if (!history.ok)
        throw new TypeError("Validated history contains invalid Unicode.");
    if (history.value > limits.maxHistoryUtf8Bytes || prepared.nodeCount > limits.maxReplayWorkUnits) {
        return Object.freeze({
            ok: false,
            diagnostics: Object.freeze([validationDiagnostic("PROJECT_LIMIT_EXCEEDED", "", "history")])
        });
    }
    const state = Object.freeze({
        limits,
        baseline: prepared.value,
        head: prepared.value,
        commands: Object.freeze([]),
        receipts: new Map(),
        identities: new Map(),
        prefixCosts: Object.freeze([prepared.nodeCount]),
        historyUtf8Bytes: history.value
    });
    return Object.freeze({ ok: true, value: state, diagnostics: checked.diagnostics });
}
//# sourceMappingURL=state.js.map