// SPDX-License-Identifier: Apache-2.0
// Opt-in declaration consumer: no Core, host, ambient globals or execution setup.
import { createF2MeshSourcePlan } from "../dist/index.js";
import type {
  F2MeshSourceSummary, F2SetupReference, F2MeshSourcePlan,
  F2MeshSourceDiagnostic, F2MeshSourceDiagnosticCode, F2MeshSourceResult,
} from "../dist/index.js";
import type {
  SpineImportInput, SpineImportPlan, SpineImportDiagnostic, SpineSourceSpan,
} from "@egret/project/spine";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ExactFactory = Assert<Equal<typeof createF2MeshSourcePlan,
  (input: SpineImportInput) => F2MeshSourceResult>>;
type ExactSummary = Assert<Equal<F2MeshSourceSummary, {
  readonly pointer: string; readonly span: SpineSourceSpan;
  readonly skinName: string; readonly slotName: string; readonly attachmentName: string;
  readonly vertexCount: number; readonly indexCount: number; readonly triangleCount: number;
}>>;
type ExactReference = Assert<Equal<F2SetupReference, {
  readonly slotPointer: string; readonly attachmentPointer: string; readonly span: SpineSourceSpan;
  readonly vertexCount: number; readonly indexCount: number;
}>>;
type ExactCodes = Assert<Equal<F2MeshSourceDiagnosticCode,
  | "F2_INPUT_SHAPE" | "F2_INPUT_LIMIT" | "F2_SOURCE_VERSION" | "F2_SOURCE_VIEW"
  | "F2_MESH_CONTAINER" | "F2_MESH_ENCODING" | "F2_MESH_SHAPE" | "F2_MESH_NUMBER"
  | "F2_MESH_UV" | "F2_MESH_INDEX" | "F2_MESH_LIMIT" | "F2_SETUP_REFERENCE"
  | "F2_INTERNAL_ERROR">>;
type ExactDiagnostic = Assert<Equal<F2MeshSourceDiagnostic, {
  readonly code: F2MeshSourceDiagnosticCode; readonly severity: "error";
  readonly source: "input" | "skeleton"; readonly pointer: string;
  readonly message: string; readonly span?: SpineSourceSpan;
}>>;
type ExactPlan = Assert<Equal<F2MeshSourcePlan, {
  readonly planVersion: 1; readonly sp1: SpineImportPlan;
  readonly meshes: readonly F2MeshSourceSummary[];
  readonly setup: {
    readonly references: readonly F2SetupReference[]; readonly attachmentCount: number;
    readonly vertexCount: number; readonly indexCount: number;
  };
  readonly acceptance: {
    readonly rawMeshNumericAdmission: "passed"; readonly profileSemantics: "not_run";
    readonly animationSemantics: "not_run"; readonly resourceIdentity: "not_run";
    readonly coreCompatibility: "not_run"; readonly rendering: "not_run";
    readonly licenseEntitlement: "unverified";
  };
}>>;
type ExactResult = Assert<Equal<F2MeshSourceResult,
  | { readonly ok: true; readonly value: F2MeshSourcePlan;
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | { readonly ok: false; readonly stage: "sp1";
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | { readonly ok: false; readonly stage: "snapshot" | "raw" | "internal";
      readonly diagnostics: readonly [F2MeshSourceDiagnostic] }>>;

export function consumeReadonlyInput(input: SpineImportInput): F2MeshSourceResult {
  const pages: SpineImportInput["pages"] = input.pages;
  const text: string = input.skeleton.text;
  const declaredSha: string | undefined = input.skeleton.provenance.sha256;
  void pages; void text; void declaredSha;
  return createF2MeshSourcePlan(input);
}

export function consumeResult(result: F2MeshSourceResult): SpineSourceSpan | undefined {
  if (result.ok) {
    const plan: F2MeshSourcePlan = result.value;
    const sp1: SpineImportPlan = plan.sp1;
    const summaries: readonly F2MeshSourceSummary[] = plan.meshes;
    const references: readonly F2SetupReference[] = plan.setup.references;
    const warnings: readonly SpineImportDiagnostic[] = result.diagnostics;
    const admission: "passed" = plan.acceptance.rawMeshNumericAdmission;
    const rendering: "not_run" = plan.acceptance.rendering;
    const first: F2MeshSourceSummary | undefined = summaries[0];
    const setupSpan: SpineSourceSpan | undefined = references[0]?.span;
    void sp1; void warnings; void admission; void rendering; void setupSpan;
    return first?.span;
  }
  if (result.stage === "sp1") {
    const diagnostics: readonly SpineImportDiagnostic[] = result.diagnostics;
    const related: SpineSourceSpan | undefined = diagnostics[0]?.relatedSpan;
    return related;
  }
  const stage: "snapshot" | "raw" | "internal" = result.stage;
  const tuple: readonly [F2MeshSourceDiagnostic] = result.diagnostics;
  const diagnostic: F2MeshSourceDiagnostic = tuple[0];
  const code: F2MeshSourceDiagnosticCode = diagnostic.code;
  const severity: "error" = diagnostic.severity;
  const source: "input" | "skeleton" = diagnostic.source;
  void stage; void code; void severity; void source;
  return diagnostic.span;
}

export type { ExactFactory, ExactSummary, ExactReference, ExactCodes,
  ExactDiagnostic, ExactPlan, ExactResult };
