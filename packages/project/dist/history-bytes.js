import { canonicalize } from "./canonical.js";
// Only the baseline and accepted commands are persisted authority.
export function historyBytes(baseline, commands) {
    return canonicalize({ historySchemaVersion: "1.0", baseline, transactions: commands });
}
//# sourceMappingURL=history-bytes.js.map