import type { ProjectId, EntityId, FileId, TransactionId, ProjectRevision, JsonObject, ProjectSnapshot, ProjectTransactionSource, ProjectTransaction } from "@egret/contracts";

// These operational declarations preserve the contract's exact public surface.
// Readonly annotations describe ownership; public adapters and the store enforce
// deep runtime immutability before returning protocol values to callers.
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
