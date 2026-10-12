// SPDX-License-Identifier: Apache-2.0
// Unsuppressed intent cases. Actual compiler tuples are frozen only after genuine setup.
import { createF2MeshSourcePlan } from "../dist/index.js";
import type {
  F2MeshSourceSummary, F2SetupReference, F2MeshSourcePlan,
  F2MeshSourceDiagnostic, F2MeshSourceDiagnosticCode, F2MeshSourceResult,
} from "../dist/index.js";
import type { SpineImportInput, SpineSourceSpan } from "@egret/project/spine";
import * as project from "@egret/project";
import * as sp1 from "@egret/project/spine";
import * as engine from "@egret/engine";
import * as runtime from "@egret/runtime";
import * as contracts from "@egret/contracts";
declare const input: SpineImportInput;
declare const plan: F2MeshSourcePlan;
declare const summary: F2MeshSourceSummary;
declare const reference: F2SetupReference;
declare const diagnostic: F2MeshSourceDiagnostic;
declare const location: SpineSourceSpan;
declare const result: F2MeshSourceResult;

// F2AN required-input
createF2MeshSourcePlan();
// F2AN one-input-only
createF2MeshSourcePlan(input, input);
// F2AN nonnull-input
createF2MeshSourcePlan(null);
// F2AN text-is-primitive-string
createF2MeshSourcePlan({ ...input, skeleton: { ...input.skeleton, text: 4 } });
// F2AN pages-is-readonly-bindings
createF2MeshSourcePlan({ ...input, pages: "page.rgba" });
// F2AN provenance-notice-is-string
createF2MeshSourcePlan({ ...input, atlas: { ...input.atlas,
  provenance: { ...input.atlas.provenance, notice: false } } });
// F2AN no-core-parameter
createF2MeshSourcePlan({ ...input, core: {} });

// F2AN readonly-input-text
input.skeleton.text = "{}";
// F2AN readonly-input-pages
input.pages.push(input.pages[0]);
// F2AN readonly-plan-version
plan.planVersion = 1;
// F2AN readonly-summary-pointer
summary.pointer = "/changed";
// F2AN readonly-summary-array
plan.meshes.push(summary);
// F2AN readonly-summary-span
summary.span.offset = 0;
// F2AN readonly-reference-pointer
reference.attachmentPointer = "/changed";
// F2AN readonly-setup-references
plan.setup.references.push(reference);
// F2AN readonly-setup-total
plan.setup.vertexCount = 1;
// F2AN readonly-acceptance
plan.acceptance.rendering = "not_run";
// F2AN readonly-diagnostic-message
diagnostic.message = "changed";
// F2AN readonly-span-column
location.column = 0;
// F2AN readonly-retained-sp1-names
plan.sp1.names.slots.push("new");

if (result.ok) {
  // F2AN success-has-no-stage
  result.stage;
} else {
  // F2AN refusal-has-no-value
  result.value;
  if (result.stage === "sp1") {
    // F2AN sp1-diagnostics-not-f2-tuple
    const f2Tuple: readonly [F2MeshSourceDiagnostic] = result.diagnostics;
    void f2Tuple;
  }
}
// F2AN unrefined-result-has-no-value
result.value;
// F2AN summary-no-geometry-payload
summary.uvs;
// F2AN reference-no-mesh-authority
reference.mesh;
// F2AN plan-no-core
plan.core;
// F2AN f2-diagnostic-no-related-span
diagnostic.relatedSpan;
// F2AN exact-thirteen-code-union-typo
const mistypedCode: F2MeshSourceDiagnosticCode = "F2_MESH_INDEXX";
void mistypedCode;

// F2AN project-default-no-f2-value
project.createF2MeshSourcePlan;
// F2AN project-spine-no-f2-value
sp1.createF2MeshSourcePlan;
// F2AN engine-default-no-f2-value
engine.createF2MeshSourcePlan;
// F2AN runtime-default-no-f2-value
runtime.createF2MeshSourcePlan;
// F2AN contracts-default-no-f2-value
contracts.createF2MeshSourcePlan;
// F2AN project-default-no-f2-plan-type
type ProjectLeak = project.F2MeshSourcePlan;
// F2AN project-spine-no-f2-result-type
type SP1Leak = sp1.F2MeshSourceResult;
// F2AN engine-default-no-f2-summary-type
type EngineLeak = engine.F2MeshSourceSummary;
// F2AN runtime-default-no-f2-reference-type
type RuntimeLeak = runtime.F2SetupReference;
// F2AN contracts-default-no-f2-diagnostic-type
type ContractsLeak = contracts.F2MeshSourceDiagnostic;
