import type * as Actual from "@egret/project";
import type { JSONScanner, JSONVisitor, JSONPath, ParseOptions, SyntaxKind, ScanError, ParseErrorCode } from "../../packages/project/src/json-foundation.js";
import { createScanner, visit } from "../../packages/project/src/json-foundation.js";

declare namespace Expected {

export type ProjectId = Actual.ProjectId;
export type EntityId = Actual.EntityId;
export type FileId = Actual.FileId;
export type TransactionId = Actual.TransactionId;
export type ProjectRevision = number;
export type Sha256 = string;
export type JsonValue = null | boolean | number | string
  | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

export interface ProjectVersionPins {
  readonly engineVersion: string;
  readonly resourceFormatVersion: string;
  readonly toolProtocolVersion: "1.0";
}

export type ProjectReference =
  | { readonly slot: string; readonly target: "entity";
      readonly id: EntityId; readonly expectedKind: string }
  | { readonly slot: string; readonly target: "file";
      readonly id: FileId; readonly expectedRole: ProjectFileRole };

export interface ProjectEntity {
  readonly id: EntityId;
  readonly kind: string;
  readonly dataSchemaVersion: string;
  readonly name: string;
  readonly data: JsonObject;
  readonly references: readonly ProjectReference[];
}

export type ProjectFileRole =
  "source" | "asset" | "configuration" | "legacy-original" | "other";

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

export type ProjectOperation =
  | { readonly op: "putEntity"; readonly entity: ProjectEntity }
  | { readonly op: "removeEntity"; readonly id: EntityId }
  | { readonly op: "putFile"; readonly file: ProjectFile }
  | { readonly op: "removeFile"; readonly id: FileId }
  | { readonly op: "setMetadata"; readonly name: string;
      readonly versions: ProjectVersionPins }
  | { readonly op: "setRoots"; readonly roots: readonly EntityId[] };

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

export interface ProjectDiff {
  readonly addedEntityIds: readonly EntityId[];
  readonly changedEntityIds: readonly EntityId[];
  readonly removedEntityIds: readonly EntityId[];
  readonly addedFileIds: readonly FileId[];
  readonly changedFileIds: readonly FileId[];
  readonly removedFileIds: readonly FileId[];
  readonly metadataChanged: boolean;
  readonly rootsChanged: boolean;
}

export type ProjectDiagnosticCode =
  | "PROJECT_INPUT_INVALID" | "PROJECT_FORMAT_UNSUPPORTED"
  | "PROJECT_LIMIT_EXCEEDED" | "PROJECT_ID_INVALID"
  | "PROJECT_ID_DUPLICATE" | "PROJECT_ID_REUSED"
  | "PROJECT_REFERENCE_MISSING" | "PROJECT_REFERENCE_TYPE_MISMATCH"
  | "PROJECT_PATH_INVALID" | "PROJECT_PATH_COLLISION"
  | "PROJECT_SCOPE_VIOLATION" | "PROJECT_OPERATION_DUPLICATE"
  | "PROJECT_REVISION_CONFLICT" | "PROJECT_TRANSACTION_ID_REUSED"
  | "PROJECT_RESTORE_UNAVAILABLE" | "PROJECT_HISTORY_INVALID"
  | "PROJECT_KIND_UNCHECKED" | "PROJECT_CONTENT_UNVERIFIED";

export interface ProjectDiagnostic {
  readonly code: ProjectDiagnosticCode;
  readonly phase: "parse" | "schema" | "references" | "transaction" | "history";
  readonly severity: "error" | "warning";
  readonly projectId?: ProjectId;
  readonly revision?: ProjectRevision;
  readonly entityId?: EntityId;
  readonly fileId?: FileId;
  readonly transactionId?: TransactionId;
  readonly jsonPointer: string;
  readonly operationIndex?: number;
  readonly message: string;
  readonly details: JsonObject;
}

export type ProjectValueResult<T> =
  | { readonly ok: true; readonly value: T;
      readonly diagnostics: readonly ProjectDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly ProjectDiagnostic[] };

export interface ProjectTransactionReceipt {
  readonly transactionId: TransactionId;
  readonly beforeRevision: ProjectRevision;
  readonly afterRevision: ProjectRevision;
  readonly source: ProjectTransactionSource;
  readonly diff: ProjectDiff;
}

export type ProjectCommitResult =
  | { readonly status: "committed" | "replayed";
      readonly snapshot: ProjectSnapshot;
      readonly receipt: ProjectTransactionReceipt;
      readonly diagnostics: readonly ProjectDiagnostic[] }
  | { readonly status: "rejected";
      readonly snapshot: ProjectSnapshot;
      readonly diagnostics: readonly ProjectDiagnostic[] };

// The baseline and commands are the persisted authority. Head/receipts are
// rebuilt on open, avoiding two independently editable copies of the truth.
export interface ProjectHistory {
  readonly historySchemaVersion: "1.0";
  readonly baseline: ProjectSnapshot;
  readonly transactions: readonly ProjectTransaction[];
}

export interface ProjectLimits {
  readonly maxSnapshotUtf8Bytes: number;
  readonly maxHistoryUtf8Bytes: number;
  readonly maxTransactionUtf8Bytes: number;
  readonly maxJsonDepth: number;
  readonly maxStringUtf8Bytes: number;
  readonly maxEntities: number;
  readonly maxFiles: number;
  readonly maxReferencesPerEntity: number;
  readonly maxOperationsPerTransaction: number;
  readonly maxTransactions: number;
  readonly maxReplayWorkUnits: number;
}

export interface ProjectStore {
  readonly limits: ProjectLimits;
  readonly earliestRevision: ProjectRevision;
  getSnapshot(): ProjectSnapshot;
  commit(transaction: ProjectTransaction): ProjectCommitResult;
  exportHistory(): ProjectValueResult<string>;
}

export const DEFAULT_PROJECT_LIMITS: ProjectLimits;
export function parseProjectSnapshot(
  text: string, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectSnapshot>;
export function serializeProjectSnapshot(
  snapshot: ProjectSnapshot, limits?: Partial<ProjectLimits>
): ProjectValueResult<string>;
export function parseProjectTransaction(
  text: string, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectTransaction>;
export function createProjectStore(
  baseline: ProjectSnapshot, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectStore>;
export function openProjectHistory(
  text: string, limits?: Partial<ProjectLimits>
): ProjectValueResult<ProjectStore>;

}
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type ProjectEntityNamespaceDistinct = Assert<Equal<Actual.ProjectId, Actual.EntityId> extends false ? true : false>;
type ProjectFileNamespaceDistinct = Assert<Equal<Actual.ProjectId, Actual.FileId> extends false ? true : false>;
type ProjectTransactionNamespaceDistinct = Assert<Equal<Actual.ProjectId, Actual.TransactionId> extends false ? true : false>;
type EntityFileNamespaceDistinct = Assert<Equal<Actual.EntityId, Actual.FileId> extends false ? true : false>;
type EntityTransactionNamespaceDistinct = Assert<Equal<Actual.EntityId, Actual.TransactionId> extends false ? true : false>;
type FileTransactionNamespaceDistinct = Assert<Equal<Actual.FileId, Actual.TransactionId> extends false ? true : false>;
type CheckProjectId = Assert<Equal<Actual.ProjectId, Expected.ProjectId>>;
type CheckEntityId = Assert<Equal<Actual.EntityId, Expected.EntityId>>;
type CheckFileId = Assert<Equal<Actual.FileId, Expected.FileId>>;
type CheckTransactionId = Assert<Equal<Actual.TransactionId, Expected.TransactionId>>;
type CheckProjectRevision = Assert<Equal<Actual.ProjectRevision, Expected.ProjectRevision>>;
type CheckSha256 = Assert<Equal<Actual.Sha256, Expected.Sha256>>;
type CheckJsonValue = Assert<Equal<Actual.JsonValue, Expected.JsonValue>>;
type CheckJsonObject = Assert<Equal<Actual.JsonObject, Expected.JsonObject>>;
type CheckProjectVersionPins = Assert<Equal<Actual.ProjectVersionPins, Expected.ProjectVersionPins>>;
type CheckProjectReference = Assert<Equal<Actual.ProjectReference, Expected.ProjectReference>>;
type CheckProjectEntity = Assert<Equal<Actual.ProjectEntity, Expected.ProjectEntity>>;
type CheckProjectFileRole = Assert<Equal<Actual.ProjectFileRole, Expected.ProjectFileRole>>;
type CheckProjectFile = Assert<Equal<Actual.ProjectFile, Expected.ProjectFile>>;
type CheckProjectSnapshot = Assert<Equal<Actual.ProjectSnapshot, Expected.ProjectSnapshot>>;
type CheckProjectTransactionSource = Assert<Equal<Actual.ProjectTransactionSource, Expected.ProjectTransactionSource>>;
type CheckProjectTransactionScope = Assert<Equal<Actual.ProjectTransactionScope, Expected.ProjectTransactionScope>>;
type CheckProjectOperation = Assert<Equal<Actual.ProjectOperation, Expected.ProjectOperation>>;
type CheckProjectEditTransaction = Assert<Equal<Actual.ProjectEditTransaction, Expected.ProjectEditTransaction>>;
type CheckProjectRestoreTransaction = Assert<Equal<Actual.ProjectRestoreTransaction, Expected.ProjectRestoreTransaction>>;
type CheckProjectTransaction = Assert<Equal<Actual.ProjectTransaction, Expected.ProjectTransaction>>;
type CheckProjectDiff = Assert<Equal<Actual.ProjectDiff, Expected.ProjectDiff>>;
type CheckProjectDiagnosticCode = Assert<Equal<Actual.ProjectDiagnosticCode, Expected.ProjectDiagnosticCode>>;
type CheckProjectDiagnostic = Assert<Equal<Actual.ProjectDiagnostic, Expected.ProjectDiagnostic>>;
type CheckProjectValueResult = Assert<Equal<Actual.ProjectValueResult<Actual.ProjectSnapshot>, Expected.ProjectValueResult<Expected.ProjectSnapshot>>>;
type CheckProjectValueResultNever = Assert<Equal<Actual.ProjectValueResult<never>, Expected.ProjectValueResult<never>>>;
type CheckProjectTransactionReceipt = Assert<Equal<Actual.ProjectTransactionReceipt, Expected.ProjectTransactionReceipt>>;
type CheckProjectCommitResult = Assert<Equal<Actual.ProjectCommitResult, Expected.ProjectCommitResult>>;
type CheckProjectHistory = Assert<Equal<Actual.ProjectHistory, Expected.ProjectHistory>>;
type CheckProjectLimits = Assert<Equal<Actual.ProjectLimits, Expected.ProjectLimits>>;
type CheckProjectStore = Assert<Equal<Actual.ProjectStore, Expected.ProjectStore>>;
const scanner: JSONScanner = createScanner("1e0", false);
const kind: SyntaxKind = scanner.scan();
const error: ScanError = scanner.getTokenError();
const lexeme: string = scanner.getTokenValue();
const options: ParseOptions = {disallowComments: true, allowTrailingComma: false, allowEmptyContent: false};
const visitor: JSONVisitor = {onLiteralValue(_value, _offset, _length, _line, _column, path) { const pointer: JSONPath = path(); void pointer; }, onError(code) { const typed: ParseErrorCode = code; void typed; }};
visit("{}", visitor, options);
void kind; void error; void lexeme;
