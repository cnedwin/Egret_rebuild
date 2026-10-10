import type { JsonValue } from "@egret/contracts";
import type { TextDocument } from "./internal.js";
import type { ProjectDiagnostic, ProjectLimits, ProjectValueResult } from "./public.js";
import type { StoreState } from "./state.js";
import { FORMAT_DEFINITIONS } from "./format-shape.generated.js";
import type { FormatNode } from "./format-shape.generated.js";
import { inspectShapeNode } from "./shape.js";
import { makeDiagnostic, mapShapeFailure } from "./diagnostics.js";
import { escapePointer } from "./live-input.js";
import { validateSnapshot } from "./validate-snapshot.js";
import { validateTransaction } from "./validate-transaction.js";
import { validationDiagnostic } from "./validation-order.js";
import { createState } from "./state.js";
import { commitPrepared } from "./commit.js";
import { restoreCandidate } from "./restore.js";

function failed(diagnostic: ProjectDiagnostic): ProjectValueResult<never> {
  return Object.freeze({ ok: false, diagnostics: Object.freeze([diagnostic]) });
}
function entryFailure(diagnostic: ProjectDiagnostic, index: number, prefix: string, alreadyPrefixed: boolean): ProjectValueResult<never> {
  if (diagnostic.code === "PROJECT_FORMAT_UNSUPPORTED") return failed(diagnostic);
  return failed(makeDiagnostic({ code: "PROJECT_HISTORY_INVALID", phase: "history", severity: "error",
    jsonPointer: alreadyPrefixed ? diagnostic.jsonPointer : prefix + diagnostic.jsonPointer,
    message: "Project history entry is invalid.", details: { causeCode: diagnostic.code, index } }));
}

// Whole-text safety precedes this port. There is deliberately no recursive
// ProjectHistory validation or header-required-field sweep: generated declared
// nodes interleave with baseline and command admission in that same order.
export function openHistoryDocument(parsed: TextDocument, limits: ProjectLimits): ProjectValueResult<StoreState> {
  const root = FORMAT_DEFINITIONS.ProjectHistory;
  const shape = inspectShapeNode(parsed.value, root, "");
  if (!shape.ok) return failed(mapShapeFailure(shape, root, ""));
  const object = parsed.value as { readonly [key: string]: JsonValue };
  let state: StoreState | undefined;
  let diagnostics: readonly ProjectDiagnostic[] = Object.freeze([]);
  for (const field of root.properties) {
    const prefix = "/" + escapePointer(field.name);
    const value = object[field.name];
    const check = inspectShapeNode(value, field.node as FormatNode, prefix);
    if (!check.ok) {
      const diagnostic = mapShapeFailure(check, field.node, prefix);
      return field.name === "baseline" ? entryFailure(diagnostic, 0, prefix, true) : failed(diagnostic);
    }
    if (field.name === "baseline") {
      const baseline = validateSnapshot(value!, { limits, numericTokens: parsed.numericTokens, pointerPrefix: prefix });
      if (!baseline.ok) return entryFailure(baseline.diagnostics[0]!, 0, prefix, true);
      const created = createState(baseline.value, limits);
      if (!created.ok) return entryFailure(created.diagnostics[0]!, 0, prefix, false);
      state = created.value; diagnostics = baseline.diagnostics;
    } else if (field.name === "transactions") {
      if (!state) throw new TypeError("Generated history declaration order lacks an admitted baseline.");
      const entries = value as readonly JsonValue[];
      for (let index = 0; index < entries.length; index++) {
        const entryPrefix = prefix + "/" + index;
        const command = validateTransaction(entries[index]!, { limits, numericTokens: parsed.numericTokens, pointerPrefix: entryPrefix });
        if (!command.ok) return entryFailure(command.diagnostics[0]!, index + 1, entryPrefix, true);
        // Unlike live retry, every journal entry must be a fresh unique command.
        if (state.identities.has(command.value.value.transactionId)) return entryFailure(validationDiagnostic("PROJECT_TRANSACTION_ID_REUSED", "/transactionId", "history"), index + 1, entryPrefix, false);
        const transition = commitPrepared(state, command.value, restoreCandidate);
        if (transition.result.status !== "committed") return entryFailure(transition.result.diagnostics[0]!, index + 1, entryPrefix, false);
        state = transition.state; diagnostics = transition.result.diagnostics;
      }
    }
  }
  if (!state) throw new TypeError("Generated history lacks a baseline.");
  return Object.freeze({ ok: true, value: state, diagnostics });
}
