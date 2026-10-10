import type { JsonValue, ProjectSnapshot, ProjectEditTransaction, ProjectEntity, ProjectFile } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectDiagnosticCode, ProjectLimits, ProjectValueResult } from "./public.js";
import { validateSnapshot } from "./validate-snapshot.js";
import { validationDiagnostic } from "./validation-order.js";

// Preconditions: head and command were admitted through the private safe clone
// and ordered validators. Operation meaning and final targets are checked here.
export function applyEdit(head: ProjectSnapshot, command: ProjectEditTransaction, limits: ProjectLimits): ProjectValueResult<Prepared<ProjectSnapshot>> {
  const entities = new Map(head.entities.map(entity => [entity.id, entity]));
  const files = new Map(head.files.map(file => [file.id, file]));
  const retiredEntities = new Set(head.retiredEntityIds), retiredFiles = new Set(head.retiredFileIds);
  const entityScope = new Set(command.scope.entityIds), fileScope = new Set(command.scope.fileIds);
  const entityTargets = new Set<string>(), fileTargets = new Set<string>();
  let metadataSeen = false, rootsSeen = false;
  let name = head.name, versions = head.versions, roots = head.roots;
  const failed = (code: ProjectDiagnosticCode, index: number): ProjectValueResult<Prepared<ProjectSnapshot>> => Object.freeze({
    ok: false, diagnostics: Object.freeze([validationDiagnostic(code, `/operations/${index}`, "transaction", { operationIndex: index })])
  });
  for (let index = 0; index < command.operations.length; index++) {
    const operation = command.operations[index]!;
    if (operation.op === "putEntity" || operation.op === "removeEntity") {
      const id = operation.op === "putEntity" ? operation.entity.id : operation.id;
      if (!entityScope.has(id)) return failed("PROJECT_SCOPE_VIOLATION", index);
      if (entityTargets.has(id)) return failed("PROJECT_OPERATION_DUPLICATE", index);
      entityTargets.add(id);
      const existing = entities.get(id);
      if (operation.op === "removeEntity") {
        if (!existing) return failed("PROJECT_INPUT_INVALID", index);
        entities.delete(id); retiredEntities.add(id);
      } else {
        if (retiredEntities.has(id) || existing && existing.kind !== operation.entity.kind) return failed("PROJECT_ID_REUSED", index);
        entities.set(id, operation.entity);
      }
    } else if (operation.op === "putFile" || operation.op === "removeFile") {
      const id = operation.op === "putFile" ? operation.file.id : operation.id;
      if (!fileScope.has(id)) return failed("PROJECT_SCOPE_VIOLATION", index);
      if (fileTargets.has(id)) return failed("PROJECT_OPERATION_DUPLICATE", index);
      fileTargets.add(id);
      const existing = files.get(id);
      if (operation.op === "removeFile") {
        if (!existing) return failed("PROJECT_INPUT_INVALID", index);
        files.delete(id); retiredFiles.add(id);
      } else {
        if (retiredFiles.has(id) || existing && existing.role !== operation.file.role) return failed("PROJECT_ID_REUSED", index);
        files.set(id, operation.file);
      }
    } else if (operation.op === "setMetadata") {
      if (!command.scope.metadata) return failed("PROJECT_SCOPE_VIOLATION", index);
      if (metadataSeen) return failed("PROJECT_OPERATION_DUPLICATE", index);
      metadataSeen = true; name = operation.name; versions = operation.versions;
    } else {
      if (!command.scope.roots) return failed("PROJECT_SCOPE_VIOLATION", index);
      if (rootsSeen) return failed("PROJECT_OPERATION_DUPLICATE", index);
      rootsSeen = true; roots = operation.roots;
    }
  }
  if (head.revision === Number.MAX_SAFE_INTEGER) return Object.freeze({ ok: false, diagnostics: Object.freeze([validationDiagnostic("PROJECT_LIMIT_EXCEEDED", "/revision", "transaction")]) });
  const candidate: ProjectSnapshot = {
    ...head, revision: head.revision + 1, name, versions, roots,
    entities: Array.from(entities.values()) as readonly ProjectEntity[], files: Array.from(files.values()) as readonly ProjectFile[],
    retiredEntityIds: Array.from(retiredEntities), retiredFileIds: Array.from(retiredFiles)
  };
  // Every descendant came from admitted snapshots/operations. Candidate paths
  // are no deeper than those inputs; completed-reference validation precedes
  // snapshot byte/count admission. The validator freezes new output containers.
  return validateSnapshot(candidate as unknown as JsonValue, { limits, pointerPrefix: "" });
}
