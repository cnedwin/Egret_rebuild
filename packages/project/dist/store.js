import { cloneLive } from "./live-input.js";
import { validateTransaction } from "./validate-transaction.js";
import { validateSnapshot } from "./validate-snapshot.js";
import { commitPrepared } from "./commit.js";
import { restoreCandidate } from "./restore.js";
import { historyBytes } from "./history-bytes.js";
// The closure owns coupled state. Clone and validate commands before retry/CAS,
// then assign authority only for a fully admitted committed transition. Rejected
// and replayed results retain current head and successful-command history.
export function makeStore(initial) {
    let state = initial;
    const store = {
        limits: state.limits,
        earliestRevision: state.baseline.revision,
        getSnapshot: () => state.head,
        commit(transaction) {
            const copied = cloneLive(transaction, "transaction", state.limits);
            const checked = copied.ok
                ? validateTransaction(copied.value, { limits: state.limits, pointerPrefix: "" })
                : copied;
            if (!checked.ok) {
                const head = validateSnapshot(state.head, { limits: state.limits, pointerPrefix: "" });
                if (!head.ok)
                    throw new TypeError("Private admitted head is invalid.");
                return Object.freeze({
                    status: "rejected",
                    snapshot: state.head,
                    diagnostics: Object.freeze([...checked.diagnostics, ...head.diagnostics])
                });
            }
            const transition = commitPrepared(state, checked.value, restoreCandidate);
            if (transition.result.status === "committed")
                state = transition.state;
            return transition.result;
        },
        exportHistory: () => Object.freeze({
            ok: true,
            value: historyBytes(state.baseline, state.commands),
            diagnostics: Object.freeze([])
        })
    };
    Object.freeze(store.getSnapshot);
    Object.freeze(store.commit);
    Object.freeze(store.exportHistory);
    return Object.freeze(store);
}
//# sourceMappingURL=store.js.map