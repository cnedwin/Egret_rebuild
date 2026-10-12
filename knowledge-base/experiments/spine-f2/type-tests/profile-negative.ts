// SPDX-License-Identifier: Apache-2.0
// Unsuppressed source intents; actual complete compiler tuples remain pending.
import { createF2MeshProfilePlan } from "../dist/index.js";
import type {
  F2MeshSourcePlan, F2MeshSourceResult, F2MeshSourceDiagnostic,
  F2MeshProfilePlan, F2MeshProfileResult, F2MeshProfileDiagnostic,
  F2MeshProfileDiagnosticCode,
} from "../dist/index.js";
import * as experimental from "../dist/index.js";
import type { SpineImportInput, SpineImportDiagnostic, SpineSourceSpan } from "@egret/project/spine";
import * as project from "@egret/project";
import * as sp1 from "@egret/project/spine";
import * as engine from "@egret/engine";
import * as runtime from "@egret/runtime";
import * as contracts from "@egret/contracts";

declare const input: SpineImportInput;
declare const plan: F2MeshProfilePlan;
declare const sourcePlan: F2MeshSourcePlan;
declare const sourceResult: F2MeshSourceResult;
declare const result: F2MeshProfileResult;
declare const diagnostic: F2MeshProfileDiagnostic;
declare const location: SpineSourceSpan;
declare const binding: SpineImportInput["pages"][number];
declare const bone: F2MeshProfilePlan["bones"][number];
declare const slot: F2MeshProfilePlan["slots"][number];
declare const attachment: F2MeshProfilePlan["attachments"][number];
declare const animation: F2MeshProfilePlan["animations"][number];
declare const timeline: F2MeshProfilePlan["animations"][number]["timelines"][number];

// F2BN required-input
createF2MeshProfilePlan();
// F2BN one-input-only
createF2MeshProfilePlan(input, input);
// F2BN nonnull-input
createF2MeshProfilePlan(null);
// F2BN text-is-primitive-string
createF2MeshProfilePlan({ ...input, skeleton: { ...input.skeleton, text: 4 } });
// F2BN pages-is-readonly-bindings
createF2MeshProfilePlan({ ...input, pages: "page.rgba" });
// F2BN no-core-parameter
createF2MeshProfilePlan({ ...input, core: {} });
// F2BN source-plan-is-not-input
createF2MeshProfilePlan(sourcePlan);
// F2BN source-result-is-not-input
createF2MeshProfilePlan(sourceResult);
// F2BN profile-plan-is-not-input
createF2MeshProfilePlan(plan);
// F2BN synchronous-result-is-not-promise
const asyncResult: Promise<F2MeshProfileResult> = createF2MeshProfilePlan(input);
// F2BN synchronous-result-has-no-then
createF2MeshProfilePlan(input).then;

// F2BN readonly-plan-version
plan.planVersion = 1;
// F2BN readonly-profile-literal
plan.profile = "static-unweighted-linear-4.3.13";
// F2BN readonly-source-plan
plan.sourcePlan = sourcePlan;
// F2BN readonly-owned-input
plan.ownedInput = input;
// F2BN readonly-owned-skeleton-text
plan.ownedInput.skeleton.text = "{}";
// F2BN readonly-owned-atlas-text
plan.ownedInput.atlas.text = "page.rgba";
// F2BN readonly-owned-skeleton-id
plan.ownedInput.skeleton.id = "changed";
// F2BN readonly-owned-skeleton-provenance
plan.ownedInput.skeleton.provenance.origin = "changed";
// F2BN readonly-owned-atlas-provenance
plan.ownedInput.atlas.provenance.notice = "changed";
// F2BN readonly-owned-pages-array
plan.ownedInput.pages.push(binding);
// F2BN readonly-owned-page-binding
binding.assetId = "changed";
// F2BN readonly-owned-page-provenance
binding.provenance.license = "changed";
// F2BN readonly-page-summary
plan.page.regionCount = 1;
// F2BN readonly-bone-array
plan.bones.push(bone);
// F2BN readonly-bone-parent
bone.parentIndex = -1;
// F2BN readonly-bone-span
bone.span.offset = 0;
// F2BN readonly-slot-array
plan.slots.push(slot);
// F2BN readonly-slot-target
slot.attachmentPointer = null;
// F2BN readonly-slot-span
slot.span.length = 0;
// F2BN readonly-attachment-array
plan.attachments.push(attachment);
// F2BN readonly-attachment-path
attachment.path = "changed";
// F2BN readonly-attachment-span
attachment.span.line = 1;
// F2BN readonly-animation-array
plan.animations.push(animation);
// F2BN readonly-animation-duration
animation.duration = 1;
// F2BN readonly-animation-span
animation.span.column = 1;
// F2BN readonly-timeline-array
animation.timelines.push(timeline);
// F2BN readonly-timeline-target
timeline.boneIndex = null;
// F2BN readonly-timeline-expansion
timeline.expandedDeformScalarCount = 0;
// F2BN readonly-timeline-span
timeline.span.sourceId = "changed";
// F2BN readonly-acceptance
plan.acceptance.sourceProfile = "passed";
// F2BN retained-source-plan-readonly
plan.sourcePlan.setup.vertexCount = 1;
// F2BN retained-sp1-names-readonly
plan.sourcePlan.sp1.names.bones.push("new");
// F2BN readonly-diagnostic-code
diagnostic.code = "F2_PROFILE_FIELD";
// F2BN readonly-diagnostic-span
location.column = 0;

// F2BN exact-profile-literal
const wrongProfile: F2MeshProfilePlan["profile"] = "static-unweighted-linear-4.3.14";
// F2BN exact-plan-version
const wrongVersion: F2MeshProfilePlan["planVersion"] = 2;
// F2BN exact-eleven-code-union
const wrongCode: F2MeshProfileDiagnosticCode = "F2_PROFILE_TIME_ORDER";
// F2BN profile-code-excludes-a-code
const inheritedCode: F2MeshProfileDiagnosticCode = "F2_MESH_INDEX";
// F2BN exact-error-severity
const wrongSeverity: F2MeshProfileDiagnostic["severity"] = "warning";
// F2BN exact-diagnostic-source
const wrongSource: F2MeshProfileDiagnostic["source"] = "core";
// F2BN exact-profile-stage
const wrongStage: Extract<F2MeshProfileResult, { readonly stage: "profile" }>["stage"] = "raw";
// F2BN profile-refusal-is-single-tuple
const emptyProfileDiagnostics: Extract<F2MeshProfileResult, { readonly stage: "profile" }>["diagnostics"] = [];
// F2BN source-admission-is-not-runtime-pass
const corePassed: "passed" = plan.acceptance.coreCompatibility;
// F2BN pose-numerics-not-run
const posePassed: "passed" = plan.acceptance.poseNumerics;
// F2BN resources-not-run
const resourcesPassed: "passed" = plan.acceptance.resourceIdentity;
// F2BN playback-not-run
const playbackPassed: "passed" = plan.acceptance.playback;
// F2BN rendering-not-run
const renderingPassed: "passed" = plan.acceptance.rendering;
// F2BN rights-unverified
const verifiedRights: "verified" = plan.acceptance.licenseEntitlement;
// F2BN source-profile-passed-only
const pendingSource: "not_run" = plan.acceptance.sourceProfile;
// F2BN linear-source-passed-only
const pendingLinear: "not_run" = plan.acceptance.linearTimelineSourceAdmission;
// F2BN bone-index-is-number-or-null
const wrongBoneTarget: typeof timeline = { ...timeline, boneIndex: "root" };
// F2BN slot-index-is-number-or-null
const wrongSlotTarget: typeof timeline = { ...timeline, slotIndex: "slot" };
// F2BN attachment-target-is-string-or-null
const wrongAttachmentTarget: typeof timeline = { ...timeline, attachmentPointer: 0 };
// F2BN nullable-bone-cannot-be-number
const nonnullBone: number = timeline.boneIndex;
// F2BN nullable-slot-cannot-be-number
const nonnullSlot: number = timeline.slotIndex;
// F2BN nullable-attachment-cannot-be-string
const nonnullAttachment: string = timeline.attachmentPointer;
// F2BN empty-setup-slot-target-cannot-be-string
const selectedAttachment: string = slot.attachmentPointer;
// F2BN timeline-kind-is-exact
const wrongTimelineKind: typeof timeline = { ...timeline, kind: "rotate" };
// F2BN attachment-kind-is-exact
const wrongAttachmentKind: typeof attachment = { ...attachment, kind: "linkedmesh" };
// F2BN numeric-summary-is-not-string
const wrongDuration: typeof animation = { ...animation, duration: "1" };

if (result.ok) {
  // F2BN success-has-no-stage
  result.stage;
  // F2BN success-warnings-are-not-profile-error-tuple
  const errors: readonly [F2MeshProfileDiagnostic] = result.diagnostics;
  void errors;
} else {
  // F2BN refusal-has-no-value
  result.value;
  // F2BN readonly-refusal-diagnostics
  result.diagnostics.push(diagnostic);
  if (result.stage === "profile") {
    // F2BN profile-diagnostic-is-not-a-diagnostic
    const aError: F2MeshSourceDiagnostic = result.diagnostics[0];
    // F2BN profile-diagnostic-is-not-sp1-diagnostic
    const sp1Error: SpineImportDiagnostic = result.diagnostics[0];
    // F2BN readonly-profile-tuple-element
    result.diagnostics[0] = diagnostic;
    void aError; void sp1Error;
  } else if (result.stage === "sp1") {
    // F2BN sp1-diagnostics-are-not-profile-tuple
    const profileErrors: readonly [F2MeshProfileDiagnostic] = result.diagnostics;
    void profileErrors;
  } else {
    // F2BN inherited-a-tuple-is-not-profile-tuple
    const profileErrors: readonly [F2MeshProfileDiagnostic] = result.diagnostics;
    void profileErrors;
  }
}
// F2BN unrefined-result-has-no-value
result.value;
// F2BN plan-has-no-core
plan.core;
// F2BN plan-has-no-play-method
plan.play;
// F2BN no-parsed-view
plan.parsed;
// F2BN no-bone-pose
bone.worldX;
// F2BN no-attachment-geometry-payload
attachment.vertices;
// F2BN no-timeline-keyframe-payload
timeline.keyframes;
// F2BN profile-diagnostic-no-related-span
diagnostic.relatedSpan;
// F2BN no-extra-core-type
type ExtraCore = experimental.Core;
// F2BN no-extra-skeleton-type
type ExtraSkeleton = experimental.Skeleton;

// F2BN project-default-no-profile-value
project.createF2MeshProfilePlan;
// F2BN project-spine-no-profile-value
sp1.createF2MeshProfilePlan;
// F2BN engine-default-no-profile-value
engine.createF2MeshProfilePlan;
// F2BN runtime-default-no-profile-value
runtime.createF2MeshProfilePlan;
// F2BN contracts-default-no-profile-value
contracts.createF2MeshProfilePlan;
// F2BN project-default-no-profile-plan-type
type ProjectLeak = project.F2MeshProfilePlan;
// F2BN project-spine-no-profile-result-type
type SP1Leak = sp1.F2MeshProfileResult;
// F2BN engine-default-no-profile-code-type
type EngineLeak = engine.F2MeshProfileDiagnosticCode;
// F2BN runtime-default-no-profile-diagnostic-type
type RuntimeLeak = runtime.F2MeshProfileDiagnostic;
// F2BN contracts-default-no-profile-plan-type
type ContractsLeak = contracts.F2MeshProfilePlan;

void asyncResult; void wrongProfile; void wrongVersion; void wrongCode; void inheritedCode;
void wrongSeverity; void wrongSource; void wrongStage; void emptyProfileDiagnostics;
void corePassed; void posePassed; void resourcesPassed; void playbackPassed; void renderingPassed;
void verifiedRights; void pendingSource; void pendingLinear; void wrongBoneTarget; void wrongSlotTarget;
void wrongAttachmentTarget; void nonnullBone; void nonnullSlot; void nonnullAttachment;
void selectedAttachment; void wrongTimelineKind; void wrongAttachmentKind; void wrongDuration;
