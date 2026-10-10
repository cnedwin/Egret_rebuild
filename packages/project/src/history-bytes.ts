import type { ProjectSnapshot, ProjectTransaction } from "@egret/contracts";
import { canonicalize } from "./canonical.js";

// Only the baseline and accepted commands are persisted authority.
export function historyBytes(baseline: ProjectSnapshot, commands: readonly ProjectTransaction[]): string {
  return canonicalize({ historySchemaVersion: "1.0", baseline, transactions: commands });
}
