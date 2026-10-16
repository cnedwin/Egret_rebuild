// SPDX-License-Identifier: Apache-2.0
import {createAtlasImportPlan, ATLAS_IMPORT_LIMITS} from '@egret/project/atlas';
import type {AtlasImportProfile, AtlasProvenance, AtlasTextSource, AtlasPageBinding, AtlasImportInput, AtlasSourceSpan, AtlasImportDiagnostic, AtlasNormalizedFrameLayout, AtlasSpriteSheetFrame, AtlasSequenceFrame, AtlasSequenceInput, AtlasFrameOrigin, AtlasImportPlan, AtlasImportResult, AtlasImportDiagnosticCode, AtlasImportLimits} from '@egret/project/atlas';
import {createSpriteSheet, createSequenceClip} from '@egret/engine';
import type {AssetLease, Texture} from '@egret/engine';
type EveryErasedName = [AtlasImportProfile, AtlasProvenance, AtlasTextSource, AtlasPageBinding, AtlasImportInput, AtlasSourceSpan, AtlasImportDiagnostic, AtlasNormalizedFrameLayout, AtlasSpriteSheetFrame, AtlasSequenceFrame, AtlasSequenceInput, AtlasFrameOrigin, AtlasImportPlan, AtlasImportResult, AtlasImportDiagnosticCode, AtlasImportLimits];
export function consume(request: unknown, lease: AssetLease<Texture>): EveryErasedName | undefined {
  const result: AtlasImportResult = createAtlasImportPlan(request);
  const limits: Readonly<AtlasImportLimits> = ATLAS_IMPORT_LIMITS;
  if (result.ok) {
    const plan: AtlasImportPlan = result.value;
    const profile: AtlasImportProfile = plan.profile;
    const provenance: AtlasProvenance = plan.sourceDeclarations.metadata.provenance;
    const source: AtlasTextSource = {id: plan.sourceDeclarations.metadata.id, text: '{}', provenance};
    const page: AtlasPageBinding = plan.page;
    const input: AtlasImportInput = {profile, source, page};
    const origin: AtlasFrameOrigin = plan.origins[0]!;
    const span: AtlasSourceSpan = origin.frame;
    const sheetFrame: AtlasSpriteSheetFrame = plan.spriteSheetFrames[0]!;
    const sequenceFrame: AtlasSequenceFrame = plan.sequenceInput.frames[0]!;
    const sequence: AtlasSequenceInput = plan.sequenceInput;
    const layout: AtlasNormalizedFrameLayout = sheetFrame.layout;
    const rotation: 0 = layout.packedRotation;
    const names: readonly string[] = plan.names;
    const sheet = createSpriteSheet(lease, plan.spriteSheetFrames, 'trim-rotation-v1');
    const clip = createSequenceClip(plan.sequenceInput, 'trim-rotation-v1');
    void [rotation, names, sheet, clip];
    const code: AtlasImportDiagnosticCode = 'ATLAS_SCHEMA_INVALID';
    const diagnostic: AtlasImportDiagnostic = {code, severity: 'error', source: 'metadata', pointer: '', message: 'Typed consumer', span};
    return [profile, provenance, source, page, input, span, diagnostic, layout, sheetFrame, sequenceFrame, sequence, origin, plan, result, code, limits];
  }
  const diagnostic: AtlasImportDiagnostic = result.diagnostics[0];
  if (diagnostic.cause instanceof Error) void diagnostic.cause.message;
  return undefined;
}
