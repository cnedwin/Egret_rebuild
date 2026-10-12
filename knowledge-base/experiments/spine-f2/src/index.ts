// SPDX-License-Identifier: Apache-2.0
// This opt-in experiment exposes source admission, not a runtime or rendering capability.
export { createF2MeshSourcePlan } from './source-plan.js';
export type {
  F2MeshSourceDiagnosticCode,
  F2MeshSourceDiagnostic,
  F2MeshSourceSummary,
  F2SetupReference,
  F2MeshSourcePlan,
  F2MeshSourceResult,
} from './source-plan.js';

export { createF2MeshProfilePlan } from './profile-plan.js';
export type {
  F2MeshProfileDiagnosticCode,
  F2MeshProfileDiagnostic,
  F2MeshProfilePlan,
  F2MeshProfileResult,
} from './profile-plan.js';
