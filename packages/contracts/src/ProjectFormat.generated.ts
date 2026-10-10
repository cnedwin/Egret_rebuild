// Generated from project-format.schema.json; source-sha256: 85617c17f23323bf4a0fd8ef31abba6040b244f6c199c62cd40f3a389bbef789
// DO NOT EDIT. Run node tools/generate-project-format.mjs.

declare const projectIdBrand: unique symbol;
declare const entityIdBrand: unique symbol;
declare const fileIdBrand: unique symbol;
declare const transactionIdBrand: unique symbol;

export type ProjectId = string & { readonly [projectIdBrand]: true };

export type EntityId = string & { readonly [entityIdBrand]: true };

export type FileId = string & { readonly [fileIdBrand]: true };

export type TransactionId = string & { readonly [transactionIdBrand]: true };

export type ProjectRevision = number;

export type Sha256 = string;

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export interface ProjectVersionPins {
  readonly engineVersion: string;
  readonly resourceFormatVersion: string;
  readonly toolProtocolVersion: "1.0";
}

export type ProjectReference = { readonly slot: string; readonly target: "entity"; readonly id: EntityId; readonly expectedKind: string } | { readonly slot: string; readonly target: "file"; readonly id: FileId; readonly expectedRole: ProjectFileRole };

export interface ProjectEntity {
  readonly id: EntityId;
  readonly kind: string;
  readonly dataSchemaVersion: string;
  readonly name: string;
  readonly data: JsonObject;
  readonly references: readonly ProjectReference[];
}

export type ProjectFileRole = "source" | "asset" | "configuration" | "legacy-original" | "other";

export interface ProjectFile {
  readonly id: FileId;
  readonly path: string;
  readonly role: ProjectFileRole;
  readonly mediaType: string;
  readonly sha256: Sha256;
  readonly byteLength: number;
}

export interface ProjectSnapshot {
  readonly projectSchemaVersion: "1.0";
  readonly projectId: ProjectId;
  readonly revision: ProjectRevision;
  readonly name: string;
  readonly versions: ProjectVersionPins;
  readonly roots: readonly EntityId[];
  readonly entities: readonly ProjectEntity[];
  readonly files: readonly ProjectFile[];
  readonly retiredEntityIds: readonly EntityId[];
  readonly retiredFileIds: readonly FileId[];
}

export interface ProjectTransactionSource {
  readonly actorId: string;
  readonly actorKind: "creator" | "agent" | "legacy-converter" | "tool";
  readonly toolId: string;
  readonly toolVersion: string;
  readonly intent: string;
}

export interface ProjectTransactionScope {
  readonly entityIds: readonly EntityId[];
  readonly fileIds: readonly FileId[];
  readonly metadata: boolean;
  readonly roots: boolean;
}

export type ProjectOperation = { readonly op: "putEntity"; readonly entity: ProjectEntity } | { readonly op: "removeEntity"; readonly id: EntityId } | { readonly op: "putFile"; readonly file: ProjectFile } | { readonly op: "removeFile"; readonly id: FileId } | { readonly op: "setMetadata"; readonly name: string; readonly versions: ProjectVersionPins } | { readonly op: "setRoots"; readonly roots: readonly EntityId[] };

export interface ProjectEditTransaction {
  readonly command: "edit";
  readonly toolProtocolVersion: "1.0";
  readonly projectId: ProjectId;
  readonly transactionId: TransactionId;
  readonly baseRevision: ProjectRevision;
  readonly source: ProjectTransactionSource;
  readonly scope: ProjectTransactionScope;
  readonly operations: readonly ProjectOperation[];
}

export interface ProjectRestoreTransaction {
  readonly command: "restore";
  readonly toolProtocolVersion: "1.0";
  readonly projectId: ProjectId;
  readonly transactionId: TransactionId;
  readonly baseRevision: ProjectRevision;
  readonly source: ProjectTransactionSource;
  readonly targetRevision: ProjectRevision;
}

export type ProjectTransaction = ProjectEditTransaction | ProjectRestoreTransaction;

export interface ProjectHistory {
  readonly historySchemaVersion: "1.0";
  readonly baseline: ProjectSnapshot;
  readonly transactions: readonly ProjectTransaction[];
}
