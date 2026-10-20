// SPDX-License-Identifier: Apache-2.0
import type { EntityId, JsonObject, ProjectFile, ProjectId, ProjectVersionPins } from './ProjectFormat.generated.js';

declare const admittedManifestBrand: unique symbol;
export interface ResourceBuildEntry {
  readonly id: EntityId;
  readonly resourceKind: string;
  readonly source: ProjectFile;
  readonly artifact: ProjectFile;
  readonly importer: { readonly id: string; readonly version: string };
  readonly settings: JsonObject;
  readonly artifactFormatVersion: string;
  readonly targetProfile: string;
  readonly dependencies: readonly EntityId[];
  readonly provenance: JsonObject;
}
export interface ResourceBuildDescription {
  readonly format: 'egret.resource-build/1';
  readonly projectId: ProjectId;
  readonly targetProfile: string;
  readonly versions: ProjectVersionPins;
  readonly entries: readonly ResourceBuildEntry[];
}
export interface ResourceManifestEntry extends ResourceBuildEntry {
  readonly buildKey: string;
  readonly runtimeIdentity: string;
}
export interface AdmittedResourceManifest {
  readonly [admittedManifestBrand]: true;
  readonly format: 'egret.resource-manifest/1';
  readonly projectId: ProjectId;
  readonly targetProfile: string;
  readonly versions: ProjectVersionPins;
  readonly entries: readonly ResourceManifestEntry[];
}
export type ResourceManifestDiagnosticCode = 'RESOURCE_INPUT_INVALID' | 'RESOURCE_LIMIT_EXCEEDED'
  | 'RESOURCE_FORMAT_UNSUPPORTED' | 'RESOURCE_DEPENDENCY_INVALID' | 'RESOURCE_ID_DUPLICATE'
  | 'RESOURCE_KEY_MISMATCH' | 'RESOURCE_FILE_MISMATCH' | 'RESOURCE_PATH_INVALID';
export interface ResourceManifestDiagnostic {
  readonly code: ResourceManifestDiagnosticCode;
  readonly pointer: string;
  readonly message: string;
}
export type ResourceManifestResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly [ResourceManifestDiagnostic] };
export interface ResourceManifestIdentityInputs {
  readonly build: string;
  readonly runtime: string;
}
