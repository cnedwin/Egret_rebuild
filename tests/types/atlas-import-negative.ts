// SPDX-License-Identifier: Apache-2.0
import type {AtlasImportPlan, AtlasImportResult, AtlasImportProfile, AtlasNormalizedFrameLayout, AtlasImportDiagnostic} from '@egret/project/atlas';
declare const plan: AtlasImportPlan;
declare const result: AtlasImportResult;
declare const diagnostic: AtlasImportDiagnostic;
// ATLAS_IMPORT_CASE readonly-provenance
plan.sourceDeclarations.metadata.provenance.origin = 'changed';
// ATLAS_IMPORT_CASE readonly-names
plan.names.push('extra');
// ATLAS_IMPORT_CASE readonly-layout
plan.spriteSheetFrames[0]!.layout.trimX = 9;
// ATLAS_IMPORT_CASE un-narrowed-result
const value = result.value;
// ATLAS_IMPORT_CASE wrong-profile
const profile: AtlasImportProfile = 'aseprite-json-array-1.3.18.6-dev';
// ATLAS_IMPORT_CASE rotation-literal
const layout: AtlasNormalizedFrameLayout = {sourceWidth:4, sourceHeight:5, trimX:1, trimY:1, packedRotation:90};
// ATLAS_IMPORT_CASE cause-is-unknown
const cause: Error = diagnostic.cause;
void [value, profile, layout, cause];
