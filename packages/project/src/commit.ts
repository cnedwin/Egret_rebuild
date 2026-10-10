import type { ProjectSnapshot, ProjectTransaction, ProjectRestoreTransaction } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectCommitResult, ProjectDiagnostic, ProjectDiagnosticCode, ProjectTransactionReceipt, ProjectValueResult } from "./public.js";
import type { StoreState } from "./state.js";
import { applyEdit } from "./edit.js";
import { diffSnapshots } from "./diff.js";
import { historyBytes } from "./history-bytes.js";
import { nextPrefixCost } from "./replay-cost.js";
import { utf8Length } from "./unicode.js";
import { validationDiagnostic } from "./validation-order.js";
import { makeDiagnostic } from "./diagnostics.js";

export type CommitTransition = { readonly state: StoreState; readonly result: ProjectCommitResult };
// First-party history reconstruction only. The future facade never accepts a
// caller callback and keeps this function and all StoreState containers private.
export type RestoreCandidate = (state: StoreState, command: ProjectRestoreTransaction) => ProjectValueResult<Prepared<ProjectSnapshot>>;

function headWarnings(head: ProjectSnapshot): readonly ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  if (head.entities.length) diagnostics.push(makeDiagnostic({ code: "PROJECT_KIND_UNCHECKED", phase: "schema", severity: "warning", jsonPointer: "/entities", message: "Entity domain data was not checked.", details: { count: head.entities.length } }));
  if (head.files.length) diagnostics.push(makeDiagnostic({ code: "PROJECT_CONTENT_UNVERIFIED", phase: "schema", severity: "warning", jsonPointer: "/files", message: "File content was not verified.", details: { count: head.files.length } }));
  return Object.freeze(diagnostics);
}

// The adapter must safely clone and validate schema/canonical command bounds
// first. A Prepared value is not a caller assertion or a public API input.
export function commitPrepared(state: StoreState, prepared: Prepared<ProjectTransaction>, restore: RestoreCandidate): CommitTransition {
  const command = prepared.value;
  const reject = (diagnostics: readonly ProjectDiagnostic[]): CommitTransition => Object.freeze({
    state, result: Object.freeze({ status: "rejected", snapshot: state.head, diagnostics: Object.freeze([...diagnostics.filter(item => item.severity === "error"), ...headWarnings(state.head)]) })
  });
  const fail = (code: ProjectDiagnosticCode, pointer: string): CommitTransition => reject([validationDiagnostic(code, pointer, "transaction")]);
  const identity = state.identities.get(command.transactionId);
  if (identity !== undefined) {
    if (identity !== prepared.canonical) return fail("PROJECT_TRANSACTION_ID_REUSED", "/transactionId");
    const receipt = state.receipts.get(command.transactionId);
    if (!receipt) throw new TypeError("Private retry indexes disagree.");
    return Object.freeze({ state, result: Object.freeze({ status: "replayed", snapshot: state.head, receipt, diagnostics: headWarnings(state.head) }) });
  }
  if (command.projectId !== state.head.projectId) return fail("PROJECT_INPUT_INVALID", "/projectId");
  if (command.baseRevision !== state.head.revision) return fail("PROJECT_REVISION_CONFLICT", "/baseRevision");
  if (state.head.revision === Number.MAX_SAFE_INTEGER) return fail("PROJECT_LIMIT_EXCEEDED", "/baseRevision");
  const candidate = command.command === "edit" ? applyEdit(state.head, command, state.limits) : restore(state, command);
  if (!candidate.ok) return reject(candidate.diagnostics);
  if (state.commands.length >= state.limits.maxTransactions) return fail("PROJECT_LIMIT_EXCEEDED", "");
  const commands = Object.freeze([...state.commands, command]);
  const bytes = utf8Length(historyBytes(state.baseline, commands));
  if (!bytes.ok) throw new TypeError("Validated journal contains invalid Unicode.");
  if (bytes.value > state.limits.maxHistoryUtf8Bytes) return fail("PROJECT_LIMIT_EXCEEDED", "");
  const targetCost = command.command === "restore" ? state.prefixCosts[command.targetRevision - state.baseline.revision] : undefined;
  if (command.command === "restore" && targetCost === undefined) throw new TypeError("Private restore candidate has no retained target.");
  const prefixCost = nextPrefixCost(state.prefixCosts[state.prefixCosts.length - 1]!, prepared.nodeCount, candidate.value.nodeCount, targetCost, state.limits.maxReplayWorkUnits);
  if (prefixCost > state.limits.maxReplayWorkUnits) return fail("PROJECT_LIMIT_EXCEEDED", "");
  const receipt: ProjectTransactionReceipt = Object.freeze({
    transactionId: command.transactionId, beforeRevision: state.head.revision, afterRevision: candidate.value.value.revision,
    source: command.source, diff: diffSnapshots(state.head, candidate.value.value)
  });
  const receipts = new Map(state.receipts), identities = new Map(state.identities);
  receipts.set(command.transactionId, receipt); identities.set(command.transactionId, prepared.canonical);
  const next: StoreState = Object.freeze({
    limits: state.limits, baseline: state.baseline, head: candidate.value.value,
    commands, receipts, identities, prefixCosts: Object.freeze([...state.prefixCosts, prefixCost]), historyUtf8Bytes: bytes.value
  });
  // Sole successful transition: all coupled authority is ready. Task 5's store
  // closure will publish this state once, synchronously, without exposing it.
  return Object.freeze({ state: next, result: Object.freeze({ status: "committed", snapshot: next.head, receipt, diagnostics: candidate.diagnostics }) });
}
