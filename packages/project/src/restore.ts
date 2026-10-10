import type { JsonValue, ProjectSnapshot, ProjectTransaction, ProjectRestoreTransaction } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectLimits, ProjectValueResult } from "./public.js";
import type { StoreState } from "./state.js";
import { applyEdit } from "./edit.js";
import { validateSnapshot } from "./validate-snapshot.js";
import { validationDiagnostic } from "./validation-order.js";

function unavailable(): ProjectValueResult<never> {
  return Object.freeze({ ok: false, diagnostics: Object.freeze([validationDiagnostic("PROJECT_RESTORE_UNAVAILABLE", "/targetRevision", "transaction")]) });
}

// Restore authored content, while accumulating every identity learned on the
// current branch and in the retained target. Historical categories live in the
// journal records themselves; no former-kind/role metadata is retained.
function restoreSnapshot(current: ProjectSnapshot, target: ProjectSnapshot, limits: ProjectLimits): ProjectValueResult<Prepared<ProjectSnapshot>> {
  const entities = new Set([...current.entities.map(item => item.id), ...current.retiredEntityIds, ...target.retiredEntityIds]);
  const files = new Set([...current.files.map(item => item.id), ...current.retiredFileIds, ...target.retiredFileIds]);
  for (const entity of target.entities) entities.delete(entity.id);
  for (const file of target.files) files.delete(file.id);
  return validateSnapshot({ ...target, revision: current.revision + 1, retiredEntityIds: [...entities], retiredFileIds: [...files] } as unknown as JsonValue, { limits, pointerPrefix: "" });
}

export function reconstructRevision(baseline: ProjectSnapshot, commands: readonly ProjectTransaction[], prefixCosts: readonly number[], targetRevision: number, limits: ProjectLimits): ProjectValueResult<ProjectSnapshot> {
  const target = targetRevision - baseline.revision;
  if (!Number.isSafeInteger(target) || target < 0 || target > commands.length) return unavailable();
  type Frame = { readonly target: number; next: number; head: ProjectSnapshot };
  const frames: Frame[] = [];
  const push = (index: number): boolean => {
    const cost = prefixCosts[index];
    if (cost === undefined || cost > limits.maxReplayWorkUnits) return false;
    frames.push({ target: index, next: 1, head: baseline });
    return true;
  };
  const budgetFailure = (): ProjectValueResult<never> => Object.freeze({ ok: false, diagnostics: Object.freeze([validationDiagnostic("PROJECT_LIMIT_EXCEEDED", "/targetRevision", "transaction")]) });
  if (!push(target)) return budgetFailure();
  while (frames.length) {
    const frame = frames[frames.length - 1]!;
    if (frame.next > frame.target) {
      const reconstructed = frame.head;
      frames.pop();
      if (!frames.length) return Object.freeze({ ok: true, value: reconstructed, diagnostics: Object.freeze([]) });
      const parent = frames[frames.length - 1]!;
      const restored = restoreSnapshot(parent.head, reconstructed, limits);
      if (!restored.ok) return restored;
      parent.head = restored.value.value; parent.next++;
      continue;
    }
    const command = commands[frame.next - 1]!;
    if (command.command === "edit") {
      const edited = applyEdit(frame.head, command, limits);
      if (!edited.ok) return edited;
      frame.head = edited.value.value; frame.next++;
    } else {
      const index = command.targetRevision - baseline.revision;
      if (index < 0 || index >= frame.next) return unavailable();
      // Prefix admission is checked before expanding a target. Frames and their
      // working heads are disposable and never enter the store's authority.
      if (!push(index)) return budgetFailure();
    }
  }
  throw new TypeError("Private reconstruction stack exhausted without a result.");
}

export function restoreCandidate(state: StoreState, command: ProjectRestoreTransaction): ProjectValueResult<Prepared<ProjectSnapshot>> {
  if (command.targetRevision < state.baseline.revision || command.targetRevision > state.head.revision) return unavailable();
  const target = reconstructRevision(state.baseline, state.commands, state.prefixCosts, command.targetRevision, state.limits);
  if (!target.ok) return target;
  return restoreSnapshot(state.head, target.value, state.limits);
}
