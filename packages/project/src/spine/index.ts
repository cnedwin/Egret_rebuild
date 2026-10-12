// SPDX-License-Identifier: Apache-2.0
// Optional planning-only entry. The retained Project root gains no Spine exports.
export { createSpineImportPlan, SPINE_IMPORT_LIMITS } from "./preflight.js";
export type {
  SpineImportInput, SpineTextSource, SpinePageBinding, SpineProvenance,
  SpineImportPlan, SpineImportResult, SpineImportDiagnostic,
  SpineImportDiagnosticCode, SpineSourceSpan, SpinePagePlan, SpineRegionPlan
} from "./types.js";
