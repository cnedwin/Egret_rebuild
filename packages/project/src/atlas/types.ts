// SPDX-License-Identifier: Apache-2.0
export type AtlasImportProfile = 'aseprite-json-array-1.3.18.6-v1';
export interface AtlasProvenance {
  readonly origin: string;
  readonly license: string;
  readonly notice: string;
  readonly sha256?: string;
}
export interface AtlasTextSource {
  readonly id: string;
  readonly text: string;
  readonly provenance: AtlasProvenance;
}
export interface AtlasPageBinding {
  readonly pageName: string;
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly provenance: AtlasProvenance;
}
export interface AtlasImportInput {
  readonly profile: AtlasImportProfile;
  readonly source: AtlasTextSource;
  readonly page: AtlasPageBinding;
}
export interface AtlasSourceSpan {
  readonly source: 'metadata';
  readonly sourceId: string;
  readonly offset: number;
  readonly length: number;
  readonly line: number;
  readonly column: number;
}
export interface AtlasImportDiagnostic {
  readonly code: AtlasImportDiagnosticCode;
  readonly severity: 'error';
  readonly source: 'input' | 'metadata';
  readonly pointer: string;
  readonly message: string;
  readonly span?: AtlasSourceSpan;
  readonly relatedSpan?: AtlasSourceSpan;
  readonly cause?: unknown;
}
export interface AtlasNormalizedFrameLayout {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly packedRotation: 0;
}
export interface AtlasSpriteSheetFrame {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly layout: AtlasNormalizedFrameLayout;
}
export interface AtlasSequenceFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly layout: AtlasNormalizedFrameLayout;
}
export interface AtlasSequenceInput {
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly frames: readonly AtlasSequenceFrame[];
}
export interface AtlasFrameOrigin {
  readonly index: number;
  readonly pointer: string;
  readonly name: AtlasSourceSpan;
  readonly frame: AtlasSourceSpan;
  readonly sourceSize: AtlasSourceSpan;
  readonly spriteSourceSize: AtlasSourceSpan;
  readonly duration: AtlasSourceSpan;
}
export interface AtlasImportPlan {
  readonly planVersion: 1;
  readonly profile: AtlasImportProfile;
  readonly exportVersion: '1.3.18.6';
  readonly sourceDeclarations: {
    readonly metadata: {
      readonly id: string;
      readonly provenance: AtlasProvenance;
      readonly utf8Bytes: number;
      readonly hashVerification: 'declared_unverified';
    }
  };
  readonly page: AtlasPageBinding;
  readonly names: readonly string[];
  readonly spriteSheetFrames: readonly AtlasSpriteSheetFrame[];
  readonly sequenceInput: AtlasSequenceInput;
  readonly origins: readonly AtlasFrameOrigin[];
  readonly acceptance: {
    readonly exporterArtifact: 'unverified';
    readonly assetPixels: 'not_run';
    readonly runtimeComposition: 'not_run';
    readonly rendering: 'not_run';
    readonly licenseEntitlement: 'unverified';
  };
}
export type AtlasImportResult = | {
  readonly ok: true;
  readonly value: AtlasImportPlan;
  readonly diagnostics: readonly []
}
| {
  readonly ok: false;
  readonly diagnostics: readonly [AtlasImportDiagnostic]
};
export type AtlasImportDiagnosticCode = "ATLAS_INPUT_INVALID" | "ATLAS_READ_FAILED" | "ATLAS_LIMIT_EXCEEDED" | "ATLAS_JSON_SYNTAX" | "ATLAS_JSON_DUPLICATE_KEY" | "ATLAS_SCHEMA_INVALID" | "ATLAS_MARKER_MISSING" | "ATLAS_MARKER_INVALID" | "ATLAS_PROFILE_UNSUPPORTED" | "ATLAS_PAGE_BINDING_INVALID" | "ATLAS_NAME_INVALID" | "ATLAS_REGION_INVALID" | "ATLAS_TIME_INVALID";
export interface AtlasImportLimits {
  readonly maxSourceUtf8Bytes: number;
  readonly maxJsonDepth: number;
  readonly maxJsonNodes: number;
  readonly maxJsonProperties: number;
  readonly maxJsonKeyUtf8Bytes: number;
  readonly maxJsonStringUtf8Bytes: number;
  readonly maxSourceIdUtf8Bytes: number;
  readonly maxAssetIdUtf8Bytes: number;
  readonly maxNameUtf8Bytes: number;
  readonly maxNameUtf16Units: number;
  readonly maxTotalNameUtf16Units: number;
  readonly maxPageNameUtf8Bytes: number;
  readonly maxFrames: number;
  readonly maxAtlasEdge: number;
  readonly maxAtlasPixels: number;
  readonly maxSourceDimension: number;
  readonly maxDurationMilliseconds: number;
  readonly maxProvenanceFieldUtf8Bytes: number;
  readonly maxProvenanceTotalUtf8Bytes: number;
  readonly maxDiagnosticPointerUtf8Bytes: number;
}
