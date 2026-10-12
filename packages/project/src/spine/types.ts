// SPDX-License-Identifier: Apache-2.0
// This planning contract owns copied data; it grants no runtime or asset authority.
export interface SpineProvenance {
  readonly origin: string;
  readonly license: string;
  readonly notice: string;
  readonly sha256?: string;
}

export interface SpineTextSource {
  readonly id: string;
  readonly text: string;
  readonly provenance: SpineProvenance;
}

export interface SpinePageBinding {
  readonly pageName: string;
  readonly assetId: string;
  readonly provenance: SpineProvenance;
}

export interface SpineImportInput {
  readonly skeleton: SpineTextSource;
  readonly atlas: SpineTextSource;
  readonly pages: readonly SpinePageBinding[];
}

export type SpineImportDiagnosticCode =
  | "SPINE_INPUT_INVALID" | "SPINE_LIMIT_EXCEEDED" | "SPINE_JSON_SYNTAX"
  | "SPINE_JSON_DUPLICATE_KEY" | "SPINE_JSON_SCHEMA" | "SPINE_VERSION_INVALID"
  | "SPINE_VERSION_PRERELEASE" | "SPINE_VERSION_MISMATCH" | "SPINE_ATLAS_SYNTAX"
  | "SPINE_ATLAS_PROFILE_UNSUPPORTED" | "SPINE_ATLAS_DUPLICATE"
  | "SPINE_PAGE_BINDING_INVALID" | "SPINE_PROFILE_UNSUPPORTED"
  | "SPINE_INVENTORY_PARTIAL" | "SPINE_PROVENANCE_UNVERIFIED";

export interface SpineSourceSpan {
  readonly source: "skeleton" | "atlas";
  readonly sourceId: string;
  readonly offset: number;
  readonly length: number;
  readonly line: number;
  readonly column: number;
}

export interface SpineImportDiagnostic {
  readonly code: SpineImportDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly source: "input" | "skeleton" | "atlas";
  readonly pointer: string;
  readonly message: string;
  readonly span?: SpineSourceSpan;
  readonly relatedSpan?: SpineSourceSpan;
}

type ExtraField = {
  readonly key: string;
  readonly value: string;
  readonly span: SpineSourceSpan;
};
type AtlasFilter = "Nearest" | "Linear" | "MipMap" | "MipMapNearestNearest"
  | "MipMapLinearNearest" | "MipMapNearestLinear" | "MipMapLinearLinear";

export interface SpineRegionPlan {
  readonly name: string;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: 0 | 90;
  readonly offsetLeft: number;
  readonly offsetBottom: number;
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly span: SpineSourceSpan;
  readonly extraFields: readonly ExtraField[];
}

export interface SpinePagePlan {
  readonly name: string;
  readonly assetId: string;
  readonly provenance: SpineProvenance;
  readonly width: number;
  readonly height: number;
  readonly format: "Alpha" | "Intensity" | "LuminanceAlpha" | "RGB565"
    | "RGBA4444" | "RGB888" | "RGBA8888";
  readonly minFilter: AtlasFilter;
  readonly magFilter: AtlasFilter;
  readonly repeat: "x" | "y" | "xy" | "none";
  readonly pma: boolean;
  readonly span: SpineSourceSpan;
  readonly regions: readonly SpineRegionPlan[];
  readonly extraFields: readonly ExtraField[];
}

type SourceDeclaration = {
  readonly id: string;
  readonly provenance: SpineProvenance;
  readonly utf8Bytes: number;
  readonly hashVerification: "declared_unverified";
};

export interface SpineImportPlan {
  readonly planVersion: 1;
  readonly sourceDeclarations: {
    readonly skeleton: SourceDeclaration;
    readonly atlas: SourceDeclaration;
  };
  readonly exportVersion: string;
  readonly runtimeCandidate: {
    readonly series: "4.3";
    readonly package: "@esotericsoftware/spine-core";
    readonly sourceTag: "spine-ts-4.3.13";
    readonly sourceCommit: "b7beb2ccbbce667a12c02f44d070644f59b04968";
    readonly artifactVerification: "not_run";
  };
  readonly names: {
    readonly bones: readonly string[];
    readonly slots: readonly string[];
    readonly skins: readonly string[];
    readonly animations: readonly string[];
  };
  readonly pages: readonly SpinePagePlan[];
  readonly observations: readonly {
    readonly kind: "unknown-root-field" | "slot-blend" | "slot-dark"
      | "attachment-type" | "attachment-sequence" | "constraint" | "dark-timeline"
      | "atlas-sampler" | "atlas-repeat" | "atlas-pma" | "atlas-format" | "extra-atlas-field";
    readonly pointer: string;
    readonly span: SpineSourceSpan;
    readonly value?: string;
  }[];
  readonly acceptance: {
    readonly animationSemantics: "not_run";
    readonly rendering: "not_run";
    readonly licenseEntitlement: "unverified";
    readonly featureInventory: "partial";
  };
}

export type SpineImportResult =
  | { readonly ok: true; readonly value: SpineImportPlan;
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly SpineImportDiagnostic[] };
