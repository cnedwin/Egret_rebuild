// SPDX-License-Identifier: Apache-2.0
// Independent opt-in declaration consumer; this file grants no runtime authority.
import { createF2MeshSourcePlan, createF2MeshProfilePlan } from "../dist/index.js";
import type {
  F2MeshSourceSummary, F2SetupReference, F2MeshSourcePlan,
  F2MeshSourceDiagnostic, F2MeshSourceDiagnosticCode, F2MeshSourceResult,
  F2MeshProfilePlan, F2MeshProfileResult, F2MeshProfileDiagnostic,
  F2MeshProfileDiagnosticCode,
} from "../dist/index.js";
import type {
  SpineImportInput, SpineImportDiagnostic, SpineSourceSpan,
} from "@egret/project/spine";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ExactSourceFactory = Assert<Equal<typeof createF2MeshSourcePlan,
  (input: SpineImportInput) => F2MeshSourceResult>>;
type ExactProfileFactory = Assert<Equal<typeof createF2MeshProfilePlan,
  (input: SpineImportInput) => F2MeshProfileResult>>;
type ExactProfileCodes = Assert<Equal<F2MeshProfileDiagnosticCode,
  | "F2_PROFILE_SHAPE" | "F2_PROFILE_FIELD" | "F2_PROFILE_ATLAS"
  | "F2_PROFILE_REFERENCE" | "F2_PROFILE_TRANSFORM" | "F2_PROFILE_NUMBER"
  | "F2_PROFILE_TIME" | "F2_PROFILE_DEFORM" | "F2_PROFILE_LIMIT"
  | "F2_PROFILE_REQUIRED" | "F2_PROFILE_INTERNAL">>;
type ExactProfileDiagnostic = Assert<Equal<F2MeshProfileDiagnostic, {
  readonly code: F2MeshProfileDiagnosticCode; readonly severity: "error";
  readonly source: "input" | "skeleton" | "atlas"; readonly pointer: string;
  readonly message: string; readonly span?: SpineSourceSpan;
}>>;
type ExactProfilePlan = Assert<Equal<F2MeshProfilePlan, {
  readonly planVersion: 1;
  readonly profile: "static-unweighted-linear-4.3.13";
  readonly sourcePlan: F2MeshSourcePlan;
  readonly ownedInput: SpineImportInput;
  readonly page: {
    readonly pageName: string; readonly assetId: string;
    readonly width: number; readonly height: number; readonly regionCount: number;
  };
  readonly bones: readonly {
    readonly name: string; readonly pointer: string; readonly span: SpineSourceSpan;
    readonly parentIndex: number; readonly depth: number; readonly x: number; readonly y: number;
  }[];
  readonly slots: readonly {
    readonly name: string; readonly pointer: string; readonly span: SpineSourceSpan;
    readonly boneIndex: number; readonly attachmentPointer: string | null;
  }[];
  readonly attachments: readonly {
    readonly pointer: string; readonly span: SpineSourceSpan; readonly slotIndex: number;
    readonly attachmentName: string; readonly path: string; readonly kind: "region" | "mesh";
    readonly vertexCount: number; readonly indexCount: number;
  }[];
  readonly animations: readonly {
    readonly name: string; readonly pointer: string; readonly span: SpineSourceSpan;
    readonly duration: number; readonly timelineCount: number; readonly keyframeCount: number;
    readonly expandedDeformScalarCount: number;
    readonly timelines: readonly {
      readonly kind: "translate" | "deform"; readonly pointer: string; readonly span: SpineSourceSpan;
      readonly boneIndex: number | null; readonly slotIndex: number | null;
      readonly attachmentPointer: string | null; readonly keyframeCount: number;
      readonly firstTime: number; readonly lastTime: number; readonly expandedDeformScalarCount: number;
    }[];
  }[];
  readonly acceptance: {
    readonly sourceProfile: "passed"; readonly linearTimelineSourceAdmission: "passed";
    readonly coreCompatibility: "not_run"; readonly poseNumerics: "not_run";
    readonly resourceIdentity: "not_run"; readonly playback: "not_run";
    readonly rendering: "not_run"; readonly licenseEntitlement: "unverified";
  };
}>>;
type ExactProfileResult = Assert<Equal<F2MeshProfileResult,
  | { readonly ok: true; readonly value: F2MeshProfilePlan;
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | Extract<F2MeshSourceResult, { readonly ok: false }>
  | { readonly ok: false; readonly stage: "profile";
      readonly diagnostics: readonly [F2MeshProfileDiagnostic] }>>;
type ExactOwnedInput = Assert<Equal<F2MeshProfilePlan["ownedInput"], SpineImportInput>>;
type ExactTimeline = Assert<Equal<F2MeshProfilePlan["animations"][number]["timelines"][number], {
  readonly kind: "translate" | "deform"; readonly pointer: string; readonly span: SpineSourceSpan;
  readonly boneIndex: number | null; readonly slotIndex: number | null;
  readonly attachmentPointer: string | null; readonly keyframeCount: number;
  readonly firstTime: number; readonly lastTime: number; readonly expandedDeformScalarCount: number;
}>>;

const everyProfileCode: readonly F2MeshProfileDiagnosticCode[] = [
  "F2_PROFILE_SHAPE", "F2_PROFILE_FIELD", "F2_PROFILE_ATLAS", "F2_PROFILE_REFERENCE",
  "F2_PROFILE_TRANSFORM", "F2_PROFILE_NUMBER", "F2_PROFILE_TIME", "F2_PROFILE_DEFORM",
  "F2_PROFILE_LIMIT", "F2_PROFILE_REQUIRED", "F2_PROFILE_INTERNAL",
];
void everyProfileCode;

export function consumeBothFactories(input: SpineImportInput): F2MeshProfileResult {
  const a: F2MeshSourceResult = createF2MeshSourcePlan(input);
  const b: F2MeshProfileResult = createF2MeshProfilePlan(input);
  void a;
  return b;
}

export function consumeOwnedSource(plan: F2MeshProfilePlan): SpineImportInput {
  const originalSkeletonText: string = plan.ownedInput.skeleton.text;
  const originalAtlasText: string = plan.ownedInput.atlas.text;
  const callerSourceId: string = plan.ownedInput.skeleton.id;
  const callerPageName: string | undefined = plan.ownedInput.pages[0]?.pageName;
  const provenance: SpineImportInput["skeleton"]["provenance"] = plan.ownedInput.skeleton.provenance;
  const pages: SpineImportInput["pages"] = plan.ownedInput.pages;
  const declaredHash: string | undefined = provenance.sha256;
  const sourcePlan: F2MeshSourcePlan = plan.sourcePlan;
  const rawAdmission: "passed" = sourcePlan.acceptance.rawMeshNumericAdmission;
  const retainedAProfile: "not_run" = sourcePlan.acceptance.profileSemantics;
  const retainedAAnimation: "not_run" = sourcePlan.acceptance.animationSemantics;
  const summaries: readonly F2MeshSourceSummary[] = sourcePlan.meshes;
  const setup: readonly F2SetupReference[] = sourcePlan.setup.references;
  void originalSkeletonText; void originalAtlasText; void callerSourceId; void callerPageName;
  void pages; void declaredHash; void rawAdmission; void retainedAProfile; void retainedAAnimation;
  void summaries; void setup;
  return plan.ownedInput;
}

export function consumeInventory(plan: F2MeshProfilePlan): readonly SpineSourceSpan[] {
  const version: 1 = plan.planVersion;
  const profile: "static-unweighted-linear-4.3.13" = plan.profile;
  const page: F2MeshProfilePlan["page"] = plan.page;
  const dimensions: readonly number[] = [page.width, page.height, page.regionCount];
  const spans: SpineSourceSpan[] = [];
  for (const bone of plan.bones) {
    const numericFields: readonly number[] = [bone.parentIndex, bone.depth, bone.x, bone.y];
    const callerName: string = bone.name;
    void numericFields; void callerName;
    spans.push(bone.span);
  }
  for (const slot of plan.slots) {
    const attachmentPointer: string | null = slot.attachmentPointer;
    if (attachmentPointer === null) { const empty: null = attachmentPointer; void empty; }
    const boneIndex: number = slot.boneIndex;
    void attachmentPointer; void boneIndex;
    spans.push(slot.span);
  }
  for (const attachment of plan.attachments) {
    const kind: "region" | "mesh" = attachment.kind;
    const declaredPath: string = attachment.path;
    const dimensions: readonly number[] = [attachment.slotIndex, attachment.vertexCount, attachment.indexCount];
    void kind; void declaredPath; void dimensions;
    spans.push(attachment.span);
  }
  for (const animation of plan.animations) {
    const summary: readonly number[] = [animation.duration, animation.timelineCount,
      animation.keyframeCount, animation.expandedDeformScalarCount];
    const timelines: F2MeshProfilePlan["animations"][number]["timelines"] = animation.timelines;
    void summary;
    spans.push(animation.span);
    for (const timeline of timelines) {
      const kind: "translate" | "deform" = timeline.kind;
      const bone: number | null = timeline.boneIndex;
      const slot: number | null = timeline.slotIndex;
      const attachment: string | null = timeline.attachmentPointer;
      const times: readonly number[] = [timeline.firstTime, timeline.lastTime,
        timeline.keyframeCount, timeline.expandedDeformScalarCount];
      void kind; void bone; void slot; void attachment; void times;
      spans.push(timeline.span);
    }
  }
  void version; void profile; void dimensions;
  return spans;
}

export function createStructuralTargetExamples(span: SpineSourceSpan):
    readonly F2MeshProfilePlan["animations"][number]["timelines"][number][] {
  return [
    { kind: "translate", pointer: "/animations/caller/bones/root/translate", span,
      boneIndex: 0, slotIndex: null, attachmentPointer: null, keyframeCount: 2,
      firstTime: 0, lastTime: 1, expandedDeformScalarCount: 0 },
    { kind: "deform", pointer: "/animations/caller/attachments/default/slot/mesh/deform", span,
      boneIndex: null, slotIndex: 0, attachmentPointer: "/skins/0/attachments/slot/mesh",
      keyframeCount: 2, firstTime: 0, lastTime: 1, expandedDeformScalarCount: 24 },
  ];
}

export function consumeAcceptance(plan: F2MeshProfilePlan): "not_run" {
  const source: "passed" = plan.acceptance.sourceProfile;
  const timelines: "passed" = plan.acceptance.linearTimelineSourceAdmission;
  const core: "not_run" = plan.acceptance.coreCompatibility;
  const pose: "not_run" = plan.acceptance.poseNumerics;
  const resources: "not_run" = plan.acceptance.resourceIdentity;
  const playback: "not_run" = plan.acceptance.playback;
  const rendering: "not_run" = plan.acceptance.rendering;
  const rights: "unverified" = plan.acceptance.licenseEntitlement;
  void source; void timelines; void core; void pose; void resources; void playback; void rights;
  return rendering;
}

export function consumeResult(result: F2MeshProfileResult): SpineSourceSpan | undefined {
  if (result.ok) {
    const plan: F2MeshProfilePlan = result.value;
    const warnings: readonly SpineImportDiagnostic[] = result.diagnostics;
    void warnings;
    return plan.bones[0]?.span;
  }
  if (result.stage === "profile") {
    const stage: "profile" = result.stage;
    const tuple: readonly [F2MeshProfileDiagnostic] = result.diagnostics;
    const diagnostic: F2MeshProfileDiagnostic = tuple[0];
    const code: F2MeshProfileDiagnosticCode = diagnostic.code;
    const severity: "error" = diagnostic.severity;
    const source: "input" | "skeleton" | "atlas" = diagnostic.source;
    void stage; void code; void severity; void source;
    return diagnostic.span;
  }
  if (result.stage === "sp1") {
    const stage: "sp1" = result.stage;
    const diagnostics: readonly SpineImportDiagnostic[] = result.diagnostics;
    const related: SpineSourceSpan | undefined = diagnostics[0]?.relatedSpan;
    void stage;
    return related;
  }
  const inheritedA: Extract<F2MeshSourceResult, { readonly ok: false }> = result;
  const stage: "snapshot" | "raw" | "internal" = result.stage;
  const tuple: readonly [F2MeshSourceDiagnostic] = result.diagnostics;
  const code: F2MeshSourceDiagnosticCode = tuple[0].code;
  void inheritedA; void stage; void code;
  return tuple[0].span;
}

export type { ExactSourceFactory, ExactProfileFactory, ExactProfileCodes,
  ExactProfileDiagnostic, ExactProfilePlan, ExactProfileResult, ExactOwnedInput, ExactTimeline };
