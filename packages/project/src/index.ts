// The package root exposes exactly six runtime values; protocol and operational
// declarations are type-only exports and add no runtime dependency on contracts.
export { DEFAULT_PROJECT_LIMITS } from "./limits.js";
export { parseProjectSnapshot, serializeProjectSnapshot, parseProjectTransaction, createProjectStore, openProjectHistory } from "./api.js";
export type { ProjectId, EntityId, FileId, TransactionId, ProjectRevision, Sha256, JsonValue, JsonObject, ProjectVersionPins, ProjectReference, ProjectEntity, ProjectFileRole, ProjectFile, ProjectSnapshot, ProjectTransactionSource, ProjectTransactionScope, ProjectOperation, ProjectEditTransaction, ProjectRestoreTransaction, ProjectTransaction, ProjectHistory } from "@egret/contracts";
export type { ProjectDiff, ProjectDiagnosticCode, ProjectDiagnostic, ProjectValueResult, ProjectTransactionReceipt, ProjectCommitResult, ProjectLimits, ProjectStore } from "./public.js";
