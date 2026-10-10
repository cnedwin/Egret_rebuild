import type { ProjectSnapshot, ProjectTransaction } from "@egret/contracts";
import type { ProjectLimits, ProjectStore, ProjectValueResult } from "./public.js";
import { resolveLimits } from "./limits.js";
import { readText } from "./text-input.js";
import { cloneLive } from "./live-input.js";
import { validateSnapshot } from "./validate-snapshot.js";
import { validateTransaction } from "./validate-transaction.js";
import { createState } from "./state.js";
import { openHistoryDocument } from "./history.js";
import { makeStore } from "./store.js";

// Resolve limits and admit text or descriptor-only live input before selected
// validation. Public success contains only validated immutable values; a store
// is exposed only after baseline or complete journal admission succeeds.
export function parseProjectSnapshot(text: string, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectSnapshot> {
  const resolved = resolveLimits(limits); if (!resolved.ok) return resolved;
  const parsed = readText(text, "snapshot", resolved.value); if (!parsed.ok) return parsed;
  const checked = validateSnapshot(parsed.value.value, { limits: resolved.value, numericTokens: parsed.value.numericTokens, pointerPrefix: "" });
  return checked.ok ? Object.freeze({ ok: true, value: checked.value.value, diagnostics: checked.diagnostics }) : checked;
}
export function serializeProjectSnapshot(snapshot: ProjectSnapshot, limits?: Partial<ProjectLimits>): ProjectValueResult<string> {
  const resolved = resolveLimits(limits); if (!resolved.ok) return resolved;
  const copied = cloneLive(snapshot, "snapshot", resolved.value); if (!copied.ok) return copied;
  const checked = validateSnapshot(copied.value, { limits: resolved.value, pointerPrefix: "" });
  return checked.ok ? Object.freeze({ ok: true, value: checked.value.canonical, diagnostics: checked.diagnostics }) : checked;
}
export function parseProjectTransaction(text: string, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectTransaction> {
  const resolved = resolveLimits(limits); if (!resolved.ok) return resolved;
  const parsed = readText(text, "transaction", resolved.value); if (!parsed.ok) return parsed;
  const checked = validateTransaction(parsed.value.value, { limits: resolved.value, numericTokens: parsed.value.numericTokens, pointerPrefix: "" });
  return checked.ok ? Object.freeze({ ok: true, value: checked.value.value, diagnostics: checked.diagnostics }) : checked;
}
export function createProjectStore(baseline: ProjectSnapshot, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectStore> {
  const resolved = resolveLimits(limits); if (!resolved.ok) return resolved;
  const copied = cloneLive(baseline, "snapshot", resolved.value); if (!copied.ok) return copied;
  const checked = validateSnapshot(copied.value, { limits: resolved.value, pointerPrefix: "" }); if (!checked.ok) return checked;
  const state = createState(checked.value, resolved.value);
  return state.ok ? Object.freeze({ ok: true, value: makeStore(state.value), diagnostics: state.diagnostics }) : state;
}
export function openProjectHistory(text: string, limits?: Partial<ProjectLimits>): ProjectValueResult<ProjectStore> {
  const resolved = resolveLimits(limits); if (!resolved.ok) return resolved;
  const parsed = readText(text, "history", resolved.value); if (!parsed.ok) return parsed;
  const state = openHistoryDocument(parsed.value, resolved.value);
  return state.ok ? Object.freeze({ ok: true, value: makeStore(state.value), diagnostics: state.diagnostics }) : state;
}
